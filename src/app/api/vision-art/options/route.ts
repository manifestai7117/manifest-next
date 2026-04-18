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

// Persist image URL to Supabase Storage permanently (DALL-E URLs expire in ~1 hour)
async function persistImage(imageUrl: string, goalId: string, idx: number): Promise<string> {
  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(30000) })
    if (!res.ok) return imageUrl
    const buffer = Buffer.from(await res.arrayBuffer())
    const filename = `vision-art/${goalId}/option-${idx}-${Date.now()}.jpg`
    const { error } = await serviceSupabase.storage
      .from('user-media')
      .upload(filename, buffer, { contentType: 'image/jpeg', upsert: true, cacheControl: '31536000' })
    if (error) { console.error('Storage upload error:', error); return imageUrl }
    const { data: { publicUrl } } = serviceSupabase.storage.from('user-media').getPublicUrl(filename)
    return publicUrl
  } catch (e) {
    console.error('persistImage error:', e)
    return imageUrl
  }
}

// Generate with Flux via Replicate — far superior photorealism vs DALL-E
// Falls back to DALL-E if Replicate key not set
async function generateImage(prompt: string, aspectRatio = '2:3'): Promise<string | null> {
  const replicateKey = process.env.REPLICATE_API_TOKEN

  if (replicateKey) {
    try {
      // Start Flux prediction
      const startRes = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-1.1-pro/predictions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${replicateKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'wait=60', // wait up to 60s for result
        },
        body: JSON.stringify({
          input: {
            prompt,
            aspect_ratio: aspectRatio, // '2:3' for portrait
            output_format: 'jpeg',
            output_quality: 90,
            safety_tolerance: 2,
            prompt_upsampling: false,
          },
        }),
        signal: AbortSignal.timeout(90000),
      })

      if (startRes.ok) {
        const prediction = await startRes.json()
        // If returned with 'wait', output is already there
        if (prediction.output) {
          const out = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output
          if (typeof out === 'string' && out.startsWith('http')) return out
        }
        // Poll for completion if still processing
        if (prediction.id && prediction.status !== 'succeeded') {
          const predId = prediction.id
          for (let i = 0; i < 20; i++) {
            await new Promise(r => setTimeout(r, 3000))
            const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${predId}`, {
              headers: { 'Authorization': `Bearer ${replicateKey}` },
              signal: AbortSignal.timeout(10000),
            })
            if (!pollRes.ok) break
            const poll = await pollRes.json()
            if (poll.status === 'succeeded') {
              const out = Array.isArray(poll.output) ? poll.output[0] : poll.output
              if (typeof out === 'string') return out
              break
            }
            if (poll.status === 'failed' || poll.status === 'canceled') break
          }
        }
      }
    } catch (e: any) {
      console.error('Replicate error:', e.message)
    }
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
        quality: 'standard',
        style: 'vivid',
      }),
      signal: AbortSignal.timeout(55000),
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

    // Build rich context
    const city = goal.user_city || ''
    const aesthetic = goal.aesthetic || 'Bold & dark'
    const age = goal.user_age || 25
    const ethnicity = goal.user_ethnicity && goal.user_ethnicity !== 'Prefer not to say' ? goal.user_ethnicity : ''
    const gender = goal.user_gender && goal.user_gender !== 'Prefer not to say' ? goal.user_gender.toLowerCase() : 'person'

    // Aesthetic-specific style guidance
    const styleMap: Record<string, string> = {
      'Bold & dark':        'dramatic lighting, deep shadows, high contrast, moody atmosphere, cinematic',
      'Warm & natural':     'golden hour sunlight, warm amber tones, soft bokeh, natural textures, organic',
      'Minimal & clean':    'clean bright light, minimal composition, open space, calm, understated elegance',
      'Bright & energetic': 'vibrant saturated colors, dynamic composition, energetic, sharp clarity',
    }
    const style = styleMap[aesthetic] || 'cinematic, dramatic'

    // Step 1: Generate 3 specific scene concepts with Claude
    const conceptRes = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `You are writing prompts for a photorealistic AI image generator (Flux 1.1 Pro) for a vision board.

Goal: "${goal.title}"
Person: ${age}-year-old ${ethnicity} ${gender}${city ? ` in ${city}` : ''}
Aesthetic: ${aesthetic}
Style: ${style}

Generate exactly 3 image concepts. Each MUST be a different visual type:

IMAGE 1 — PERSON (silhouette/back view only — never a face or frontal portrait):
A powerful silhouette or back-view shot of the person at the moment of achieving their goal. Real location. No face visible. The body language and environment tell the story. Cinematic.

IMAGE 2 — PLACE/SCENE (no person at all):
The specific environment, location, or setting associated with achieving this goal. Beautifully lit. No people. Just the space itself — gym, court, office, nature, etc. Photographic.

IMAGE 3 — SYMBOL/OBJECT (no person, abstract or still life):
A close-up, still life, or symbolic object that represents the essence of achieving this goal. Could be equipment, food, a trophy, nature, architecture. No person at all.

CRITICAL rules for the prompts:
- Be hyper-specific — name real places, real equipment, real lighting conditions
- For IMAGE 1: describe body from behind or as silhouette only — say "viewed from behind" or "silhouette" explicitly
- For IMAGE 2 & 3: explicitly say "no people" or "empty scene"
- Each prompt must end with: "${style}, photorealistic, shot on Sony A7R IV, 8K, no text"
- NO AI art clichés: no glowing effects, no floating particles, no lens flares on everything

Return ONLY valid JSON, no markdown:
[
  {"label":"short title","description":"one sentence","prompt":"full detailed image generation prompt"},
  {"label":"short title","description":"one sentence","prompt":"full detailed image generation prompt"},
  {"label":"short title","description":"one sentence","prompt":"full detailed image generation prompt"}
]`,
      }],
    })

    let concepts: any[] = []
    try {
      const raw = conceptRes.content[0].type === 'text' ? conceptRes.content[0].text : '[]'
      concepts = JSON.parse(raw.replace(/```json|```/g, '').trim())
      if (!Array.isArray(concepts) || concepts.length < 3) throw new Error('need 3')
    } catch {
      // Solid fallback prompts
      const goalShort = goal.title.slice(0, 80)
      concepts = [
        {
          label: 'The Victory Moment',
          description: 'Achieving the goal',
          prompt: `${age}-year-old ${ethnicity} ${gender} silhouette viewed from behind, standing triumphantly${city ? ` in ${city}` : ''}, having achieved: ${goalShort}. Full body back view, powerful posture, beautiful environment. ${style}, photorealistic, shot on Sony A7R IV, 8K, no text`,
        },
        {
          label: 'The Arena',
          description: 'The environment of success',
          prompt: `The specific environment for achieving: ${goalShort}${city ? ` in ${city}` : ''}. Beautiful, empty scene, no people. Perfect lighting showing every detail of the space. ${style}, photorealistic, shot on Sony A7R IV, 8K, no text`,
        },
        {
          label: 'The Symbol',
          description: 'What achievement looks like',
          prompt: `Close-up still life of objects symbolising achievement of: ${goalShort}. No people, no person. Beautifully composed flat lay or macro shot. ${style}, photorealistic, shot on Sony A7R IV, 8K, no text`,
        },
      ]
    }

    // Step 2: Generate all 3 in parallel with stagger + retry
    const generateWithRetry = async (prompt: string, idx: number): Promise<string | null> => {
      await new Promise(r => setTimeout(r, idx * 800)) // stagger
      let url = await generateImage(prompt)
      if (!url) {
        console.log(`Image ${idx} failed, retrying after 4s...`)
        await new Promise(r => setTimeout(r, 4000))
        url = await generateImage(prompt)
      }
      return url
    }

    const results = await Promise.all(
      concepts.slice(0, 3).map(async (c: any, i: number) => {
        const tempUrl = await generateWithRetry(c.prompt, i)
        const permanentUrl = tempUrl ? await persistImage(tempUrl, goalId, i) : null
        return {
          label: c.label || `Vision ${i + 1}`,
          description: c.description || '',
          prompt: c.prompt,
          imageUrl: permanentUrl,
        }
      })
    )

    const successCount = results.filter(r => r.imageUrl).length
    console.log(`Vision art: ${successCount}/3 succeeded for goal ${goalId}`)

    if (successCount === 0) {
      return NextResponse.json({ error: 'Generation failed — please try again.', options: [] }, { status: 500 })
    }

    // Save permanent URLs to DB
    await serviceSupabase.from('goals').update({
      vision_options: JSON.stringify(results),
      vision_chosen_idx: null,
    }).eq('id', goalId)

    return NextResponse.json({ options: results, successCount })
  } catch (e: any) {
    console.error('Vision art error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}