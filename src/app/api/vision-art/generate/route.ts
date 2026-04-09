import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function buildPrompt(goal: any): Promise<string> {
  const rawGender = goal.user_gender || ''
  const age = goal.user_age ? parseInt(goal.user_age) : null
  const ethnicity = goal.user_ethnicity && goal.user_ethnicity !== 'Prefer not to say' ? goal.user_ethnicity : ''
  const aesthetic = goal.aesthetic || 'Bright & energetic'
  const regenCount = goal.vision_board_regenerations || 0

  const genderWord = rawGender === 'Man' ? 'man' : rawGender === 'Woman' ? 'woman' : 'person'
  const ageDesc = age ? `${age}-year-old` : 'adult'
  const personDesc = [ethnicity, ageDesc, genderWord].filter(Boolean).join(' ')

  const styleMap: Record<string, string> = {
    'Minimal & clean': 'clean minimal photography, soft diffused natural light, neutral palette, Kinfolk editorial',
    'Bold & dark': 'dramatic cinematic photography, deep shadows, rich contrast, moody powerful atmosphere',
    'Warm & natural': 'golden hour photography, warm amber tones, analog film grain, National Geographic quality',
    'Bright & energetic': 'vibrant Nike campaign photography, punchy bold colors, dynamic energy, aspirational sports editorial',
  }
  const styleDesc = styleMap[aesthetic] || styleMap['Bright & energetic']

  const sceneRes = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 250,
    messages: [{
      role: 'user',
      content: `Write a DALL-E 3 image prompt for a vision board. Be specific and cinematic.

Goal: "${goal.title}"
Why: "${goal.why || ''}"
Person: a ${personDesc}
Style: ${styleDesc}
Variation: ${regenCount}

RULES — follow every single one:
1. Person wears appropriate FULLY COVERING athletic/professional clothing for the activity. No bare skin, no shirtless, no swimwear, no shorts above knee. Fully dressed at all times.
2. Person shown from DIRECTLY BEHIND — camera is behind them, we see their back, hair, back of head. Absolutely no facial features. No side profile.
3. Scene is 100% specific to this exact goal — if tennis, show the clay court and net; if weight loss, show a gym at sunrise; if startup, show a modern office
4. Rich detail: exact clothing color, posture, environment, lighting, time of day
5. Zero text, numbers, scoreboards, signs, logos anywhere
6. Variation ${regenCount} = produce a different scene/moment than previous variations
7. All content must be completely safe for work — no beach, no water bodies showing skin, no potentially revealing scenarios

Write one detailed paragraph. Cinematic and specific. No explanation, just the scene description.`
    }]
  })

  const scene = sceneRes.content[0].type === 'text' ? sceneRes.content[0].text.trim() : ''

  return `${scene} Style: ${styleDesc}. Photorealistic, tack-sharp focus, ultra high resolution, award-winning photography. The ${personDesc} is photographed strictly from behind — only the back of their head, hair, and fully clothed body visible. Face completely hidden. No text, numbers, signs, or logos anywhere in the image.`
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { goalId } = await request.json()
    if (!goalId) return NextResponse.json({ error: 'Missing goalId' }, { status: 400 })

    const { data: goal } = await supabase.from('goals').select('*').eq('id', goalId).eq('user_id', user.id).single()
    if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })

    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })

    const prompt = await buildPrompt(goal)
    console.log(`DALL-E 3 for "${goal.title}" v${(goal.vision_board_regenerations||0)+1}:`, prompt.slice(0, 180))

    const dalleRes = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: '1024x1792',
        quality: 'hd',
        style: 'vivid',
        response_format: 'url',
      }),
      signal: AbortSignal.timeout(120000),
    })

    if (!dalleRes.ok) {
      const err = await dalleRes.json()
      console.error('DALL-E 3 error:', err)
      if (err.error?.code === 'content_policy_violation') {
        // Retry once with a simpler safe fallback prompt
        console.log('Content filter hit — retrying with safe fallback prompt')
        const rawGender = goal.user_gender || ''
        const age = goal.user_age ? parseInt(goal.user_age) : null
        const ethnicity = goal.user_ethnicity && goal.user_ethnicity !== 'Prefer not to say' ? goal.user_ethnicity : ''
        const genderWord = rawGender === 'Man' ? 'man' : rawGender === 'Woman' ? 'woman' : 'person'
        const ageDesc = age ? `${age}-year-old` : 'adult'
        const personDesc = [ethnicity, ageDesc, genderWord].filter(Boolean).join(' ')

        const fallbackPrompt = `A ${personDesc} wearing athletic clothing, photographed from directly behind, standing at the top of a hill at golden sunrise, arms slightly raised in triumph, dramatic sky ahead, back of their head and hair visible, full body from behind. Photorealistic, tack-sharp, cinematic photography. No face visible. No text anywhere.`

        const retry = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'dall-e-3', prompt: fallbackPrompt, n: 1, size: '1024x1792', quality: 'hd', style: 'vivid', response_format: 'url' }),
          signal: AbortSignal.timeout(120000),
        })
        if (!retry.ok) {
          return NextResponse.json({ error: 'Image generation blocked by content filter. Please try again.' }, { status: 422 })
        }
        const retryData = await retry.json()
        const retryUrl = retryData.data?.[0]?.url
        if (!retryUrl) return NextResponse.json({ error: 'No image returned' }, { status: 500 })

        // Save and return fallback
        let finalUrl = retryUrl
        try {
          const imgRes = await fetch(retryUrl, { signal: AbortSignal.timeout(30000) })
          if (imgRes.ok) {
            const buf = await imgRes.arrayBuffer()
            const path = `${user.id}/${goalId}-${Date.now()}.png`
            const { error: upErr } = await supabase.storage.from('vision-art').upload(path, buf, { contentType: 'image/png', upsert: true })
            if (!upErr) {
              const { data: { publicUrl } } = supabase.storage.from('vision-art').getPublicUrl(path)
              finalUrl = publicUrl
            }
          }
        } catch {}
        const newCount = (goal.vision_board_regenerations || 0) + 1
        await supabase.from('goals').update({ art_image_url: finalUrl, vision_board_last_generated: new Date().toISOString(), vision_board_regenerations: newCount }).eq('id', goalId)
        return NextResponse.json({ imageUrl: finalUrl, regenerations: newCount })
      }
      return NextResponse.json({ error: err.error?.message || 'DALL-E 3 failed' }, { status: 500 })
    }

    const dalleData = await dalleRes.json()
    const imageUrl = dalleData.data?.[0]?.url
    if (!imageUrl) return NextResponse.json({ error: 'No image returned' }, { status: 500 })

    // Save to Supabase Storage — OpenAI URLs expire after 1 hour
    let finalUrl = imageUrl
    try {
      const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(30000) })
      if (imgRes.ok) {
        const buf = await imgRes.arrayBuffer()
        const path = `${user.id}/${goalId}-${Date.now()}.png`
        const { error: upErr } = await supabase.storage.from('vision-art').upload(path, buf, { contentType: 'image/png', upsert: true })
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage.from('vision-art').getPublicUrl(path)
          finalUrl = publicUrl
        }
      }
    } catch {}

    const newCount = (goal.vision_board_regenerations || 0) + 1
    await supabase.from('goals').update({
      art_image_url: finalUrl,
      vision_board_last_generated: new Date().toISOString(),
      vision_board_regenerations: newCount,
    }).eq('id', goalId)

    return NextResponse.json({ imageUrl: finalUrl, regenerations: newCount })
  } catch (error: any) {
    console.error('Vision art error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}