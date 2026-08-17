import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 60 // Vercel Pro allows up to 60s

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function getPersonDesc(goal: any) {
  const gender = goal.user_gender === 'Man' ? 'man' : goal.user_gender === 'Woman' ? 'woman' : 'person'
  const age = goal.user_age ? `${goal.user_age}-year-old` : 'adult'
  const ethnicity = goal.user_ethnicity && goal.user_ethnicity !== 'Prefer not to say' ? goal.user_ethnicity : ''
  return [ethnicity, age, gender].filter(Boolean).join(' ')
}

function getStyleDesc(aesthetic: string) {
  const map: Record<string, string> = {
    'Minimal & clean': 'clean minimal photography, soft diffused natural light, neutral palette, Kinfolk editorial',
    'Bold & dark': 'dramatic cinematic photography, deep shadows, rich contrast, moody powerful atmosphere',
    'Warm & natural': 'golden hour photography, warm amber tones, analog film grain, National Geographic quality',
    'Bright & energetic': 'vibrant Nike campaign photography, punchy bold colors, dynamic energy, aspirational sports editorial',
  }
  return map[aesthetic] || map['Bright & energetic']
}

async function generateDalleImage(prompt: string): Promise<string | null> {
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) return null
  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: '1024x1792',
        quality: 'standard', // use standard not hd — faster, cheaper
        style: 'vivid',
        response_format: 'url',
      }),
      signal: AbortSignal.timeout(45000),
    })
    if (!res.ok) {
      const err = await res.json()
      console.error('DALL-E error:', err.error?.message)
      return null
    }
    const data = await res.json()
    return data.data?.[0]?.url || null
  } catch (e) {
    console.error('DALL-E error:', e)
    return null
  }
}

async function searchUnsplash(query: string): Promise<string | null> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY
  if (!accessKey) return null
  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=5&orientation=portrait&content_filter=high`,
      { headers: { Authorization: `Client-ID ${accessKey}` }, signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    const photo = data.results?.[0]
    return photo ? `${photo.urls.regular}&w=1024&h=1792&fit=crop` : null
  } catch { return null }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { goalId } = await request.json()
    const { data: goal } = await supabase.from('goals').select('*').eq('id', goalId).eq('user_id', user.id).single()
    if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })

    const personDesc = getPersonDesc(goal)
    const styleDesc = getStyleDesc(goal.aesthetic)
    const city = goal.user_city || ''
    const regenCount = goal.vision_board_regenerations || 0

    // Step 1: Generate 3 scene concepts via Claude
    const conceptRes = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: `Generate 3 different vision board image concepts for this goal.

Goal: "${goal.title}"
Why: "${goal.why || ''}"
Person: ${personDesc || 'adult person'}
City: ${city || 'not specified'}
Style: ${styleDesc}
Variation: ${regenCount}

Return ONLY a JSON array of 3 objects, each with:
- "label": short evocative name e.g. "The Achievement"
- "type": "person_back" | "city_scene" | "symbolic"
- "dallePrompt": DALL-E prompt string (only for person_back, else null)
- "unsplashQuery": search string (for city_scene and symbolic, else null)
- "description": one sentence describing the image

person_back rules: person from behind, fully clothed, ${city ? `in ${city}` : 'cinematic setting'}, no face, no text.
city_scene: real location relevant to the goal, use Unsplash.
symbolic: object or environment representing goal completion, use Unsplash.

Return pure JSON only, no markdown.`
      }]
    })

    const conceptText = conceptRes.content[0].type === 'text' ? conceptRes.content[0].text.trim() : '[]'
    let concepts: any[] = []
    try {
      concepts = JSON.parse(conceptText.replace(/```json|```/g, '').trim())
    } catch {
      // Fallback concepts if parse fails
      concepts = [
        { label: 'The Journey', type: 'symbolic', dallePrompt: null, unsplashQuery: goal.title, description: 'A symbolic image of the goal' },
        { label: 'The Place', type: 'city_scene', dallePrompt: null, unsplashQuery: city || goal.title, description: 'An inspiring location' },
        { label: 'The Vision', type: 'person_back', dallePrompt: `A ${personDesc || 'person'} from behind, achieving ${goal.title}, cinematic photography, ${styleDesc}`, unsplashQuery: null, description: 'You achieving your goal' },
      ]
    }

    // Step 2: Generate images — do person_back with DALL-E, others with Unsplash
    // Run sequentially to avoid timeout from 3 parallel DALL-E calls
    const results = []
    for (let i = 0; i < concepts.length; i++) {
      const concept = concepts[i]
      let imageUrl: string | null = null

      if (concept.type === 'person_back' && concept.dallePrompt) {
        const fullPrompt = `${concept.dallePrompt}. Style: ${styleDesc}. Photorealistic, ultra high resolution. Person seen strictly from behind — back of head visible, face completely hidden. No text, no numbers, no logos.`
        imageUrl = await generateDalleImage(fullPrompt)
        // Fallback to Unsplash if DALL-E fails
        if (!imageUrl) {
          imageUrl = await searchUnsplash(city ? `${city} ${goal.title.split(' ').slice(0, 3).join(' ')}` : goal.title)
        }
      } else if (concept.unsplashQuery) {
        imageUrl = await searchUnsplash(concept.unsplashQuery)
        if (!imageUrl && city) imageUrl = await searchUnsplash(`${city} ${concept.unsplashQuery}`)
        // Last resort: DALL-E for any type if Unsplash fails
        if (!imageUrl) {
          imageUrl = await generateDalleImage(`${concept.description}. ${styleDesc}. Photorealistic, cinematic, no text, no faces visible.`)
        }
      }

      if (imageUrl) {
        results.push({ ...concept, imageUrl, index: i })
      }
    }

    if (results.length === 0) {
      return NextResponse.json({ error: 'Could not generate images. Check OPENAI_API_KEY and UNSPLASH_ACCESS_KEY env vars.' }, { status: 500 })
    }

    // Step 3: Save to Supabase Storage so URLs don't expire (skip if too slow)
    const savedResults = await Promise.all(results.map(async (r) => {
      try {
        const imgRes = await fetch(r.imageUrl, { signal: AbortSignal.timeout(10000) })
        if (!imgRes.ok) return r
        const buf = await imgRes.arrayBuffer()
        const ext = r.type === 'person_back' ? 'png' : 'jpg'
        const path = `${user.id}/${goalId}-opt${r.index}-${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('vision-art')
          .upload(path, buf, { contentType: `image/${ext}`, upsert: true })
        if (upErr) return r
        const { data: { publicUrl } } = supabase.storage.from('vision-art').getPublicUrl(path)
        return { ...r, imageUrl: publicUrl }
      } catch {
        return r // Return original URL if storage fails
      }
    }))

    return NextResponse.json({ options: savedResults })
  } catch (error: any) {
    console.error('Vision art options error:', error)
    return NextResponse.json({ error: error.message || 'Generation failed' }, { status: 500 })
  }
}