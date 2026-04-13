import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

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

async function generateDalleImage(prompt: string, openaiKey: string): Promise<string | null> {
  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
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
    if (!res.ok) {
      const err = await res.json()
      console.error('DALL-E error:', err.error?.message)
      return null
    }
    const data = await res.json()
    return data.data?.[0]?.url || null
  } catch (e) {
    console.error('DALL-E timeout/error:', e)
    return null
  }
}

async function searchUnsplash(query: string, accessKey: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=5&orientation=portrait&content_filter=high`,
      { headers: { Authorization: `Client-ID ${accessKey}` }, signal: AbortSignal.timeout(10000) }
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

    const openaiKey = process.env.OPENAI_API_KEY
    const unsplashKey = process.env.UNSPLASH_ACCESS_KEY

    const personDesc = getPersonDesc(goal)
    const styleDesc = getStyleDesc(goal.aesthetic)
    const city = goal.user_city || ''
    const cityContext = city ? `The person lives in ${city}.` : ''
    const regenCount = goal.vision_board_regenerations || 0

    // Generate 3 different scene concepts using Claude
    const conceptRes = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: `Generate 3 completely different vision board image concepts for this goal.

Goal: "${goal.title}"
Why: "${goal.why || ''}"
Person: ${personDesc}
City: ${city || 'unknown'}
Style: ${styleDesc}
Variation seed: ${regenCount}

Return ONLY a JSON array of 3 objects. Each must have:
- "label": short name like "The Achievement", "The Journey", "The Moment"  
- "type": one of "person_back" | "city_scene" | "symbolic"
- "dallePrompt": full DALL-E prompt (for person_back type only — others use null)
- "unsplashQuery": search query for Unsplash (for city_scene and symbolic types)
- "description": 1 sentence describing what the image shows

Rules for person_back type:
- Person photographed from directly behind — fully clothed in appropriate attire
- ${city ? `Scene set in ${city} — use specific ${city} landmarks or environments` : 'Scene set in a cinematic environment specific to the goal'}
- No face, no text, no numbers, no scoreboards
- Person fully dressed, tack-sharp, photorealistic

Rules for city_scene type (use real Unsplash photos):
- If city known: search for "${city} [goal-relevant location]"  
- Focus on the environment where the goal happens
- No AI generation needed

Rules for symbolic type:
- Abstract/symbolic image representing the goal achievement
- Could be equipment, trophy, finish line, office, court etc.

Make all 3 concepts meaningfully different. Return pure JSON only.`
      }]
    })

    const conceptText = conceptRes.content[0].type === 'text' ? conceptRes.content[0].text.trim() : '[]'
    let concepts: any[] = []
    try {
      concepts = JSON.parse(conceptText.replace(/```json|```/g, '').trim())
    } catch (e) {
      console.error('Concept parse error:', conceptText.slice(0, 200))
      return NextResponse.json({ error: 'Failed to generate concepts' }, { status: 500 })
    }

    // Generate all 3 images in parallel
    const imagePromises = concepts.map(async (concept: any, i: number) => {
      let imageUrl: string | null = null

      if (concept.type === 'person_back' && openaiKey && concept.dallePrompt) {
        const fullPrompt = `${concept.dallePrompt}\n\nStyle: ${styleDesc}. Photorealistic, tack-sharp focus, ultra high resolution, award-winning photography. The ${personDesc} is seen strictly from behind — back of head and hair visible, face completely hidden. No text, numbers, signs, or logos anywhere.`
        imageUrl = await generateDalleImage(fullPrompt, openaiKey)

        // Fallback if DALL-E fails or gets filtered
        if (!imageUrl && unsplashKey) {
          const fallbackQuery = city ? `${city} ${goal.title.split(' ').slice(0, 3).join(' ')}` : goal.title
          imageUrl = await searchUnsplash(fallbackQuery, unsplashKey)
        }
      } else if (unsplashKey && concept.unsplashQuery) {
        imageUrl = await searchUnsplash(concept.unsplashQuery, unsplashKey)
        // Try alternative query if first fails
        if (!imageUrl) {
          const altQuery = city ? `${city} ${concept.unsplashQuery}` : concept.unsplashQuery
          imageUrl = await searchUnsplash(altQuery, unsplashKey)
        }
      }

      // Last resort fallback
      if (!imageUrl && openaiKey) {
        const fallbackPrompt = `${concept.description || goal.title}. ${styleDesc}. Photorealistic, cinematic, no text, no people's faces visible.`
        imageUrl = await generateDalleImage(fallbackPrompt, openaiKey)
      }

      return {
        ...concept,
        imageUrl,
        index: i,
      }
    })

    const results = await Promise.all(imagePromises)
    const validResults = results.filter(r => r.imageUrl)

    if (validResults.length === 0) {
      return NextResponse.json({ error: 'Could not generate any images' }, { status: 500 })
    }

    // Save URLs to Supabase storage so they don't expire
    const savedResults = await Promise.all(validResults.map(async (r) => {
      if (!r.imageUrl) return r
      try {
        const imgRes = await fetch(r.imageUrl, { signal: AbortSignal.timeout(20000) })
        if (imgRes.ok) {
          const buf = await imgRes.arrayBuffer()
          const ext = r.type === 'person_back' ? 'png' : 'jpg'
          const path = `${user.id}/${goalId}-option${r.index}-${Date.now()}.${ext}`
          const { error: upErr } = await supabase.storage.from('vision-art').upload(path, buf, { contentType: `image/${ext}`, upsert: true })
          if (!upErr) {
            const { data: { publicUrl } } = supabase.storage.from('vision-art').getPublicUrl(path)
            return { ...r, imageUrl: publicUrl }
          }
        }
      } catch {}
      return r
    }))

    return NextResponse.json({ options: savedResults })
  } catch (error: any) {
    console.error('Vision art options error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
