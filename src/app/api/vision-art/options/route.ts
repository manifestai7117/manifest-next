import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Set max duration for Vercel — add this to route segment config
export const maxDuration = 300 // 5 minutes (requires Pro plan)
// If on hobby plan, this won't work — we handle timeout gracefully below

async function generateImage(prompt: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 55000) // 55s per image
    
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: prompt.slice(0, 4000), // DALL-E prompt limit
        n: 1,
        size: '1024x1792',
        quality: 'standard', // 'standard' is faster than 'hd', still looks great
        style: 'vivid',
      }),
      signal: controller.signal,
    })
    clearTimeout(timeout)
    
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

    const { data: goal } = await supabase
      .from('goals').select('*').eq('id', goalId).eq('user_id', user.id).single()
    if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })

    // Build person description
    const personParts = [
      goal.user_gender && goal.user_gender !== 'Prefer not to say' ? goal.user_gender.toLowerCase() : null,
      goal.user_age ? `${goal.user_age}-year-old` : null,
      goal.user_ethnicity && goal.user_ethnicity !== 'Prefer not to say' ? goal.user_ethnicity : null,
    ].filter(Boolean)
    const personDesc = personParts.length > 0 ? personParts.join(' ') : 'person'
    const cityDesc = goal.user_city ? `in ${goal.user_city}` : ''

    // Step 1: Generate 3 concepts with Claude (fast, <5s)
    const conceptRes = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', // use Haiku for speed
      max_tokens: 900,
      messages: [{
        role: 'user',
        content: `Create 3 distinct vision board image concepts for this goal.

GOAL: "${goal.title}"
WHY: ${goal.why}
AESTHETIC: ${goal.aesthetic || 'Bold & dark'}
PERSON: ${personDesc} ${cityDesc}
STREAK: ${goal.streak} days

Rules:
- Each concept must be completely different in setting, mood, composition
- Show the moment AFTER achieving the goal — the arrival, not the struggle  
- Ground it in real life (specific gym, mirror, street, beach) not fantasy
- Subject shown from behind or mid-distance, never close-up portrait
- Be specific and cinematic, not generic stock photo
- ${goal.aesthetic === 'Bold & dark' ? 'Dramatic chiaroscuro, deep shadows, high contrast' : ''}
- ${goal.aesthetic === 'Warm & natural' ? 'Golden hour, earth tones, organic warmth' : ''}
- ${goal.aesthetic === 'Minimal & clean' ? 'Clean natural light, negative space, calm' : ''}
- ${goal.aesthetic === 'Bright & energetic' ? 'Vibrant colour, dynamic angles, kinetic energy' : ''}

Return ONLY valid JSON array of 3 objects:
[{"label":"3-5 word title","description":"one sentence emotional story","dallePrompt":"80-100 word DALL-E prompt starting with shot type and lighting, describing the scene vividly, ending with: photorealistic, cinematic, 8K, no text"}]`,
      }],
    })

    let concepts: any[] = []
    try {
      const raw = conceptRes.content[0].type === 'text' ? conceptRes.content[0].text : '[]'
      const cleaned = raw.replace(/```json|```/g, '').trim()
      // Handle potential trailing commas or other JSON issues
      concepts = JSON.parse(cleaned)
      if (!Array.isArray(concepts)) concepts = []
    } catch (e) {
      console.error('Concept parse error:', e)
      return NextResponse.json({ error: 'Failed to generate concepts' }, { status: 500 })
    }

    // Step 2: Generate all 3 images in PARALLEL with individual timeouts
    // This is faster overall even if one fails
    const personNote = personDesc !== 'person' ? `Subject is a ${personDesc}.` : ''

    const imagePromises = concepts.map(async (concept: any, i: number) => {
      // Small stagger to avoid hitting rate limits simultaneously
      await new Promise(r => setTimeout(r, i * 500))
      const prompt = [concept.dallePrompt, personNote].filter(Boolean).join(' ')
      const imageUrl = await generateImage(prompt)
      return {
        label: concept.label || `Vision ${i + 1}`,
        description: concept.description || '',
        imageUrl,
      }
    })

    const options = await Promise.all(imagePromises)

    // If ALL images failed, return error
    if (options.every(o => !o.imageUrl)) {
      return NextResponse.json({ 
        error: 'Image generation timed out. Please try again — DALL-E can be slow.',
        options: [] 
      }, { status: 500 })
    }

    return NextResponse.json({ options })
  } catch (error: any) {
    console.error('Vision art error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}