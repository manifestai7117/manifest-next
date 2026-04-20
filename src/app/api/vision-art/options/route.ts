import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 300

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const serviceSupabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function persistImage(tempUrl: string, goalId: string): Promise<string> {
  try {
    const res = await fetch(tempUrl, { signal: AbortSignal.timeout(30000) })
    if (!res.ok) return tempUrl
    const buffer = Buffer.from(await res.arrayBuffer())
    const filename = `vision-art/${goalId}/vision-${Date.now()}.jpg`
    const { error } = await serviceSupabase.storage
      .from('user-media')
      .upload(filename, buffer, { contentType: 'image/jpeg', upsert: true, cacheControl: '31536000' })
    if (error) { console.error('Storage upload error:', error); return tempUrl }
    const { data: { publicUrl } } = serviceSupabase.storage.from('user-media').getPublicUrl(filename)
    return publicUrl
  } catch (e) {
    console.error('persistImage error:', e)
    return tempUrl
  }
}

async function generateImage(prompt: string): Promise<string | null> {
  // Try Replicate Flux first (far superior photorealism)
  const replicateKey = process.env.REPLICATE_API_TOKEN
  if (replicateKey) {
    try {
      const startRes = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-1.1-pro/predictions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${replicateKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'wait=60',
        },
        body: JSON.stringify({
          input: {
            prompt,
            aspect_ratio: '2:3',
            output_format: 'jpeg',
            output_quality: 95,
            safety_tolerance: 2,
            prompt_upsampling: true,
          },
        }),
        signal: AbortSignal.timeout(90000),
      })
      if (startRes.ok) {
        const prediction = await startRes.json()
        if (prediction.output) {
          const out = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output
          if (typeof out === 'string' && out.startsWith('http')) return out
        }
        // Poll if still processing
        if (prediction.id) {
          for (let i = 0; i < 20; i++) {
            await new Promise(r => setTimeout(r, 3000))
            const poll = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
              headers: { 'Authorization': `Bearer ${replicateKey}` },
              signal: AbortSignal.timeout(10000),
            })
            if (!poll.ok) break
            const p = await poll.json()
            if (p.status === 'succeeded') {
              const out = Array.isArray(p.output) ? p.output[0] : p.output
              if (typeof out === 'string') return out
              break
            }
            if (p.status === 'failed' || p.status === 'canceled') break
          }
        }
      }
    } catch (e: any) { console.error('Replicate error:', e.message) }
  }

  // Fallback: DALL-E 3
  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: prompt.slice(0, 4000),
        n: 1,
        size: '1024x1792',
        quality: 'hd',
        style: 'vivid',
      }),
      signal: AbortSignal.timeout(60000),
    })
    if (!res.ok) { console.error('DALL-E error:', await res.text()); return null }
    const data = await res.json()
    return data.data?.[0]?.url ?? null
  } catch (e: any) {
    console.error('DALL-E error:', e.message)
    return null
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { goalId } = await request.json()
    const { data: goal } = await serviceSupabase
      .from('goals').select('*').eq('id', goalId).eq('user_id', user.id).single()
    if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })

    // Build person description from profile data
    const age = goal.user_age || 25
    const ethnicity = goal.user_ethnicity && goal.user_ethnicity !== 'Prefer not to say' ? goal.user_ethnicity : ''
    const gender = goal.user_gender && goal.user_gender !== 'Prefer not to say' ? goal.user_gender.toLowerCase() : 'person'
    const city = goal.user_city || ''
    const aesthetic = goal.aesthetic || 'Bold & dark'

    const styleMap: Record<string, string> = {
      'Bold & dark':        'dramatic cinematic lighting, deep shadows, golden backlight, high contrast, moody atmosphere',
      'Warm & natural':     'warm golden hour sunlight, soft bokeh background, earth tones, organic textures',
      'Minimal & clean':    'clean soft natural light, airy open space, minimalist composition, calm',
      'Bright & energetic': 'vibrant saturated colors, dynamic angle, sharp clarity, energetic feel',
    }
    const styleGuide = styleMap[aesthetic] || 'dramatic cinematic lighting, high contrast'

    // Use Claude to write one exceptional, specific DALL-E/Flux prompt
    const conceptRes = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: `Write one exceptional image generation prompt for a vision board photo.

GOAL: "${goal.title}"
WHY: ${goal.why || ''}
PERSON: ${age}-year-old ${ethnicity} ${gender}${city ? `, based in ${city}` : ''}
AESTHETIC: ${aesthetic}
STYLE: ${styleGuide}

The image must:
- Show the person at the MOMENT of having achieved this goal — the arrival, not the struggle
- Body viewed from BEHIND or as a powerful silhouette — NEVER show the face, NEVER a frontal portrait
- The body language alone should radiate the emotion: confidence, triumph, peace, power
- Ground it in a HYPER-SPECIFIC real location: name a real place, real time of day, real weather
- The environment and lighting should amplify the emotion of the achievement
- Ultra-photorealistic — this should look like a photo taken by a world-class photographer
- ${city ? `The location should be in or near ${city} if it fits the goal` : 'Choose the most cinematic location that fits this goal'}

RULES FOR THE PROMPT:
- Start with the exact camera shot type (e.g. "Wide-angle shot from behind at low angle...")
- Describe the person's body, posture, clothing in detail (but NO face, shown from behind or side silhouette only)
- Describe the environment in rich detail — light, textures, atmosphere, time of day
- End with technical photography specs
- NO text overlays, NO watermarks, NO logos
- Length: 120-150 words

Output ONLY the image generation prompt, nothing else.`,
      }],
    })

    const prompt = conceptRes.content[0].type === 'text' ? conceptRes.content[0].text.trim() : ''
    if (!prompt) return NextResponse.json({ error: 'Failed to generate prompt' }, { status: 500 })

    console.log('Vision art prompt:', prompt)

    // Generate with retry
    let tempUrl = await generateImage(prompt)
    if (!tempUrl) {
      console.log('First attempt failed, retrying...')
      await new Promise(r => setTimeout(r, 3000))
      tempUrl = await generateImage(prompt)
    }

    if (!tempUrl) {
      return NextResponse.json({ error: 'Image generation failed. Please try again.' }, { status: 500 })
    }

    // Persist to Supabase Storage immediately (DALL-E URLs expire in ~1 hour)
    const permanentUrl = await persistImage(tempUrl, goalId)

    // Build a label and description from the goal
    const labelRes = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 60,
      messages: [{
        role: 'user',
        content: `Give this vision board image a 3-5 word poetic title for the goal: "${goal.title}". Return ONLY the title, nothing else.`,
      }],
    })
    const label = labelRes.content[0].type === 'text' ? labelRes.content[0].text.trim().replace(/^["']|["']$/g, '') : 'Your Vision'

    const result = {
      label,
      description: `Your vision of achieving: ${goal.title.slice(0, 60)}`,
      imageUrl: permanentUrl,
    }

    // Save to DB
    await serviceSupabase.from('goals').update({
      vision_options: JSON.stringify([result]),
      vision_chosen_idx: 0,
      art_image_url: permanentUrl,
      art_title: label,
    }).eq('id', goalId)

    return NextResponse.json({ options: [result], successCount: 1 })
  } catch (e: any) {
    console.error('Vision art error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}