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
  // Use exact age — this directly controls hair color, skin, physique in the generation
  const ageDesc = age ? `${age}-year-old` : 'adult'
  const personDesc = [ethnicity, ageDesc, genderWord].filter(Boolean).join(' ')

  const styleMap: Record<string, string> = {
    'Minimal & clean': 'clean minimal photography, soft diffused natural light, neutral palette, Kinfolk editorial',
    'Bold & dark': 'dramatic cinematic photography, deep shadows, rich contrast, moody powerful, film noir inspired',
    'Warm & natural': 'golden hour photography, warm amber tones, analog film grain, National Geographic quality',
    'Bright & energetic': 'vibrant Nike campaign photography, punchy bold colors, dynamic energy, aspirational sports editorial',
  }
  const styleDesc = styleMap[aesthetic] || styleMap['Bright & energetic']

  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 250,
    messages: [{
      role: 'user',
      content: `Write a DALL-E 3 image prompt for a vision board. Be specific and cinematic.

Goal: "${goal.title}"
Why: "${goal.why || ''}"
Person: ${personDesc}
Style: ${styleDesc}
Variation: ${regenCount}

STRICT RULES:
1. The ${personDesc} is shown from DIRECTLY BEHIND — back of head, hair, shoulders, full body. Camera is behind them. Zero facial features visible.
2. Scene must be 100% specific to the goal — exact sport, exact setting, exact moment of achievement
3. Include rich detail: clothing color, body language, environment, lighting, time of day
4. Zero text, zero numbers, zero scoreboards, zero signs, zero logos anywhere
5. Each variation number must produce a meaningfully different scene, angle, or moment

Write a single detailed paragraph. Be cinematic and specific. No generic scenes.`
    }]
  })

  const scene = res.content[0].type === 'text' ? res.content[0].text.trim() : ''

  // DALL-E 3 responds very well to clear, structured prompts
  return `${scene}

Style: ${styleDesc}. Photorealistic, tack-sharp focus, ultra high resolution, award-winning photography quality. Crisp details, no blur, no soft focus.

IMPORTANT: The ${personDesc} must be photographed from directly behind — we see only the back of their head, hair, and body. Their face is completely hidden from view. No text, numbers, signs, logos, or scoreboards visible anywhere in the image.`
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
    console.log(`DALL-E 3 prompt for "${goal.title}":`, prompt.slice(0, 200))

    // Call DALL-E 3
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
        size: '1024x1792', // portrait format
        quality: 'hd',
        style: 'vivid', // vivid produces sharper, more detailed images than 'natural'
        response_format: 'url',
      }),
      signal: AbortSignal.timeout(120000),
    })

    if (!dalleRes.ok) {
      const err = await dalleRes.json()
      console.error('DALL-E 3 error:', err)
      // If content policy rejection, retry with simpler prompt
      if (err.error?.code === 'content_policy_violation') {
        return NextResponse.json({ error: 'Image prompt was rejected by safety filter. Try regenerating.' }, { status: 422 })
      }
      return NextResponse.json({ error: err.error?.message || 'DALL-E 3 failed' }, { status: 500 })
    }

    const dalleData = await dalleRes.json()
    const imageUrl = dalleData.data?.[0]?.url
    if (!imageUrl) return NextResponse.json({ error: 'No image returned' }, { status: 500 })

    // Store in Supabase Storage so URL doesn't expire (OpenAI URLs expire after 1 hour)
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
    } catch (e) {
      console.error('Storage upload failed, using OpenAI URL:', e)
    }

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
