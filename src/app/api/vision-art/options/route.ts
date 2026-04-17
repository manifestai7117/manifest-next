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

// Download a DALL-E image URL and save it to Supabase Storage permanently.
// DALL-E URLs expire after ~1 hour — this is the ONLY reliable way to persist them.
async function persistImage(tempUrl: string, goalId: string, idx: number): Promise<string> {
  try {
    const res = await fetch(tempUrl, { signal: AbortSignal.timeout(30000) })
    if (!res.ok) return tempUrl // fallback to temp URL

    const arrayBuffer = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const filename = `vision-art/${goalId}/option-${idx}-${Date.now()}.png`

    const { data, error } = await serviceSupabase.storage
      .from('user-media')
      .upload(filename, buffer, {
        contentType: 'image/png',
        upsert: true,
        cacheControl: '31536000', // 1 year cache
      })

    if (error) {
      console.error('Storage upload error:', error)
      return tempUrl // fallback
    }

    const { data: { publicUrl } } = serviceSupabase.storage
      .from('user-media')
      .getPublicUrl(filename)

    return publicUrl
  } catch (e) {
    console.error('persistImage error:', e)
    return tempUrl // fallback to temp URL
  }
}

async function generateImage(prompt: string): Promise<string | null> {
  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: prompt.slice(0, 4000),
        n: 1,
        size: '1024x1792', // portrait
        quality: 'standard',
        style: 'vivid',
      }),
      signal: AbortSignal.timeout(55000),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('DALL-E error:', JSON.stringify(err))
      return null
    }
    const data = await res.json()
    return data.data?.[0]?.url ?? null
  } catch (e: any) {
    console.error('generateImage error:', e.message)
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

    // Person description for the prompt
    const parts = [
      goal.user_gender && goal.user_gender !== 'Prefer not to say' ? goal.user_gender.toLowerCase() : null,
      goal.user_age ? `${goal.user_age}-year-old` : null,
      goal.user_ethnicity && goal.user_ethnicity !== 'Prefer not to say' ? goal.user_ethnicity : null,
    ].filter(Boolean)
    const personDesc = parts.length > 0 ? parts.join(' ') : 'person'
    const cityDesc = goal.user_city ? `in ${goal.user_city}` : ''

    // Step 1: Generate scene concepts with Haiku (fast, < 5s)
    const conceptRes = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 900,
      messages: [{
        role: 'user',
        content: `Create 3 distinct vision board scene concepts for this goal.

GOAL: "${goal.title}"
WHY: ${goal.why || 'personal growth'}
AESTHETIC: ${goal.aesthetic || 'Bold & dark'}
PERSON: ${personDesc} ${cityDesc}
STREAK: ${goal.streak || 0} days

Rules:
- Each concept must be COMPLETELY different: different setting, time of day, mood, composition
- Show the moment AFTER achieving the goal — victory, not struggle
- Subject shown from mid-distance or behind, never close-up portrait (avoids AI face issues)
- Hyper-specific and cinematic — real places, real lighting, real feelings
- ${goal.aesthetic === 'Bold & dark' ? 'Dramatic chiaroscuro, deep shadows, high contrast' : ''}
- ${goal.aesthetic === 'Warm & natural' ? 'Golden hour, earth tones, organic textures' : ''}
- ${goal.aesthetic === 'Minimal & clean' ? 'Clean natural light, negative space, calm geometry' : ''}
- ${goal.aesthetic === 'Bright & energetic' ? 'Vibrant colour, dynamic angles, kinetic energy' : ''}

Return ONLY valid JSON — no markdown, no explanation:
[{"label":"3-5 word title","description":"one vivid sentence describing the emotional moment","dallePrompt":"100-word DALL-E 3 prompt: start with the shot type and lighting, describe the exact scene, person, environment, mood; end with: photorealistic, cinematic, 8K resolution, no text, no watermarks"}]`,
      }],
    })

    let concepts: any[] = []
    try {
      const raw = conceptRes.content[0].type === 'text' ? conceptRes.content[0].text : '[]'
      const cleaned = raw.replace(/```json|```/g, '').trim()
      concepts = JSON.parse(cleaned)
      if (!Array.isArray(concepts) || concepts.length === 0) throw new Error('empty')
      // Ensure we have exactly 3
      while (concepts.length < 3) {
        concepts.push({ label: `Vision ${concepts.length + 1}`, description: goal.title, dallePrompt: `A ${personDesc} achieving their goal of ${goal.title}, photorealistic, cinematic, 8K` })
      }
    } catch (e) {
      console.error('Concept parse error:', e)
      // Generate generic concepts as fallback
      concepts = [1, 2, 3].map(i => ({
        label: `Vision ${i}`,
        description: `Achieving: ${goal.title}`,
        dallePrompt: `A ${personDesc} ${cityDesc} at the moment of achieving their goal: ${goal.title}. Scene ${i} of 3. Photorealistic, cinematic, 8K resolution, no text`,
      }))
    }

    const personNote = personDesc !== 'person' ? `The person in the scene is ${personDesc}.` : ''

    // Step 2: Generate ALL 3 images in parallel — MUST succeed, retry once if fail
    const generateWithRetry = async (prompt: string, idx: number): Promise<string | null> => {
      // Small stagger to avoid rate limits
      await new Promise(r => setTimeout(r, idx * 600))
      let url = await generateImage(prompt)
      if (!url) {
        // Retry once after 2 seconds
        console.log(`Image ${idx} failed, retrying...`)
        await new Promise(r => setTimeout(r, 2000))
        url = await generateImage(prompt)
      }
      return url
    }

    const imagePromises = concepts.map(async (concept: any, i: number) => {
      const prompt = [concept.dallePrompt, personNote].filter(Boolean).join(' ')
      const tempUrl = await generateWithRetry(prompt, i)

      let permanentUrl: string | null = null
      if (tempUrl) {
        // CRITICAL: Immediately persist to Supabase Storage before URL expires
        permanentUrl = await persistImage(tempUrl, goalId, i)
      }

      return {
        label: concept.label || `Vision ${i + 1}`,
        description: concept.description || '',
        imageUrl: permanentUrl, // permanent Supabase URL — never expires
      }
    })

    const options = await Promise.all(imagePromises)

    // Count successful images
    const successCount = options.filter(o => o.imageUrl).length
    console.log(`Generated ${successCount}/3 images for goal ${goalId}`)

    if (successCount === 0) {
      return NextResponse.json({
        error: 'Image generation failed. DALL-E may be overloaded — please try again in a moment.',
        options: [],
      }, { status: 500 })
    }

    // Save options (with permanent URLs) to DB immediately
    await serviceSupabase.from('goals').update({
      vision_options: JSON.stringify(options),
      vision_chosen_idx: null,
    }).eq('id', goalId)

    return NextResponse.json({ options, successCount })
  } catch (error: any) {
    console.error('Vision art route error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}