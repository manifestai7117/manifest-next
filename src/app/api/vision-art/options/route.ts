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

// Immediately download DALL-E temp URL → Supabase Storage (permanent, never expires)
async function persistImage(tempUrl: string, goalId: string, idx: number): Promise<string> {
  try {
    const res = await fetch(tempUrl, { signal: AbortSignal.timeout(30000) })
    if (!res.ok) return tempUrl
    const buffer = Buffer.from(await res.arrayBuffer())
    const filename = `vision-art/${goalId}/option-${idx}-${Date.now()}.png`
    const { error } = await serviceSupabase.storage
      .from('user-media')
      .upload(filename, buffer, { contentType: 'image/png', upsert: true, cacheControl: '31536000' })
    if (error) { console.error('Storage upload error:', error); return tempUrl }
    const { data: { publicUrl } } = serviceSupabase.storage.from('user-media').getPublicUrl(filename)
    return publicUrl
  } catch (e) {
    console.error('persistImage error:', e)
    return tempUrl
  }
}

async function generateDalleImage(prompt: string): Promise<string | null> {
  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
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
    if (!res.ok) { console.error('DALL-E error:', await res.text()); return null }
    const data = await res.json()
    return data.data?.[0]?.url ?? null
  } catch (e: any) {
    console.error('DALL-E fetch error:', e.message)
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

    const personParts = [
      goal.user_gender && goal.user_gender !== 'Prefer not to say' ? goal.user_gender.toLowerCase() : null,
      goal.user_age ? `${goal.user_age}-year-old` : null,
      goal.user_ethnicity && goal.user_ethnicity !== 'Prefer not to say' ? goal.user_ethnicity : null,
    ].filter(Boolean)
    const personDesc = personParts.length > 0 ? personParts.join(' ') : 'person'
    const city = goal.user_city || 'the city'
    const aesthetic = goal.aesthetic || 'Bold & dark'

    const aestheticStyle = {
      'Bold & dark': 'dramatic chiaroscuro lighting, deep shadows, high contrast, cinematic',
      'Warm & natural': 'golden hour light, warm earth tones, soft shadows, organic textures',
      'Minimal & clean': 'clean natural light, minimal composition, airy negative space, calm',
      'Bright & energetic': 'vibrant saturated colors, dynamic angles, kinetic energy, bold',
    }[aesthetic] || 'cinematic, dramatic lighting'

    // Step 1: Generate 3 DISTINCT concept types with Claude Haiku
    const conceptRes = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Create 3 vision board images for this goal. Each image must be a COMPLETELY DIFFERENT visual type.

GOAL: "${goal.title}"
WHY: ${goal.why || 'personal growth'}
PERSON: ${personDesc} in ${city}
AESTHETIC: ${aesthetic} — ${aestheticStyle}

IMPORTANT — The 3 images MUST follow these exact types:
1. PERSON IMAGE: A ${personDesc} silhouette or figure (shown from behind or mid-distance, never a portrait face) in the moment of achieving this goal. Real location, golden moment, powerful.
2. ACTIVITY IMAGE: The specific activity, equipment, environment, or practice involved in achieving this goal — NO person at all. Just the scene, tools, or setting.
3. SYMBOLIC IMAGE: An abstract or symbolic visual metaphor representing the essence of this goal — could be nature, architecture, light, patterns, or objects. Conceptual, not literal. NO person.

Return ONLY valid JSON array, no markdown:
[
  {"type":"person","label":"3-5 word title","description":"one sentence","dallePrompt":"detailed DALL-E prompt, portrait orientation 1024x1792, ${aestheticStyle}, photorealistic, 8K, no text"},
  {"type":"activity","label":"3-5 word title","description":"one sentence","dallePrompt":"detailed DALL-E prompt focusing on the activity/scene/equipment without any person, portrait orientation, ${aestheticStyle}, photorealistic, 8K, no text"},
  {"type":"symbolic","label":"3-5 word title","description":"one sentence","dallePrompt":"detailed symbolic/metaphorical DALL-E prompt with no person at all, abstract or nature-based visual, portrait orientation, ${aestheticStyle}, photorealistic, 8K, no text"}
]`,
      }],
    })

    let concepts: any[] = []
    try {
      const raw = conceptRes.content[0].type === 'text' ? conceptRes.content[0].text : '[]'
      concepts = JSON.parse(raw.replace(/```json|```/g, '').trim())
      if (!Array.isArray(concepts) || concepts.length < 3) throw new Error('not 3')
    } catch {
      // Fallback concepts if Claude fails
      concepts = [
        {
          type: 'person',
          label: 'The Victory Moment',
          description: `Achieving: ${goal.title}`,
          dallePrompt: `A ${personDesc} silhouette viewed from behind standing triumphantly in ${city}, having achieved ${goal.title}. ${aestheticStyle}, photorealistic, 8K, no text, no watermarks`,
        },
        {
          type: 'activity',
          label: 'The Practice',
          description: `The work behind: ${goal.title}`,
          dallePrompt: `The environment, tools, and setting associated with ${goal.title} in ${city}, no people, showing the space and equipment beautifully. ${aestheticStyle}, photorealistic, 8K, no text, no watermarks`,
        },
        {
          type: 'symbolic',
          label: 'The Essence',
          description: `Symbol of: ${goal.title}`,
          dallePrompt: `Abstract symbolic visual metaphor for ${goal.title}. Natural elements, light, or geometric forms conveying the feeling of this achievement. No people. ${aestheticStyle}, photorealistic, 8K, no text, no watermarks`,
        },
      ]
    }

    // Step 2: Generate all 3 images in parallel, with stagger + retry
    const generateWithRetry = async (prompt: string, idx: number): Promise<string | null> => {
      await new Promise(r => setTimeout(r, idx * 700)) // stagger to avoid rate limits
      let url = await generateDalleImage(prompt)
      if (!url) {
        console.log(`Image ${idx} failed on first try, retrying after 3s...`)
        await new Promise(r => setTimeout(r, 3000))
        url = await generateDalleImage(prompt)
      }
      return url
    }

    const results = await Promise.all(
      concepts.slice(0, 3).map(async (concept: any, i: number) => {
        const tempUrl = await generateWithRetry(concept.dallePrompt, i)
        // Immediately persist to Supabase Storage — DALL-E URLs expire in ~1 hour
        const permanentUrl = tempUrl ? await persistImage(tempUrl, goalId, i) : null
        return {
          label: concept.label || `Vision ${i + 1}`,
          description: concept.description || '',
          type: concept.type || ['person', 'activity', 'symbolic'][i],
          imageUrl: permanentUrl,
        }
      })
    )

    const successCount = results.filter(r => r.imageUrl).length
    console.log(`Vision art: ${successCount}/3 generated for goal ${goalId}`)

    if (successCount === 0) {
      return NextResponse.json({ error: 'Image generation failed. Please try again in a moment.', options: [] }, { status: 500 })
    }

    // Save to DB (permanent URLs — never expire)
    await serviceSupabase.from('goals').update({
      vision_options: JSON.stringify(results),
      vision_chosen_idx: null,
    }).eq('id', goalId)

    return NextResponse.json({ options: results, successCount })
  } catch (error: any) {
    console.error('Vision art error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}