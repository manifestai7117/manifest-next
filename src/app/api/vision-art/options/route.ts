import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Sequential image generation with retry — avoids parallel rate limit failures
async function generateImage(prompt: string, retries = 2): Promise<string | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt,
          n: 1,
          size: '1024x1792',
          quality: 'hd',
          style: 'vivid',
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error(`DALL-E attempt ${attempt + 1} failed:`, err)
        if (attempt < retries) await new Promise(r => setTimeout(r, 2000 * (attempt + 1)))
        continue
      }
      const data = await res.json()
      return data.data?.[0]?.url ?? null
    } catch (e) {
      console.error(`generateImage attempt ${attempt + 1} error:`, e)
      if (attempt < retries) await new Promise(r => setTimeout(r, 2000 * (attempt + 1)))
    }
  }
  return null
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { goalId } = await request.json()

    const { data: goal } = await supabase
      .from('goals')
      .select('*')
      .eq('id', goalId)
      .eq('user_id', user.id)
      .single()
    if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })

    // Build specific person description
    const personParts = [
      goal.user_gender && goal.user_gender !== 'Prefer not to say' ? goal.user_gender.toLowerCase() : null,
      goal.user_age ? `${goal.user_age}-year-old` : null,
      goal.user_ethnicity && goal.user_ethnicity !== 'Prefer not to say' ? goal.user_ethnicity : null,
    ].filter(Boolean)
    const personDesc = personParts.length > 0 ? personParts.join(' ') : 'person'
    const cityDesc = goal.user_city ? `in ${goal.user_city}` : ''
    const hasSelfiePermission = !!(goal.selfie_url && goal.selfie_permission)

    // Step 1: Claude generates 3 richly differentiated concepts
    const conceptRes = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1200,
      messages: [{
        role: 'user',
        content: `You are a world-class vision board art director. Create 3 deeply personal, cinematic image concepts for someone's goal.

GOAL: "${goal.title}"
WHY IT MATTERS: ${goal.why}
AESTHETIC: ${goal.aesthetic}
CATEGORY: ${goal.category}
PERSON: ${personDesc} ${cityDesc}
AFFIRMATION: "${goal.affirmation}"
CURRENT STORY: ${goal.current_story || 'Not shared'}
PHASE PROGRESS: ${goal.phase1_completed ? 'Phase 1 complete' : ''} ${goal.phase2_completed ? 'Phase 2 complete' : ''} ${goal.streak > 0 ? `${goal.streak}-day streak` : ''}

RULES FOR GREAT VISION ART:
- Each concept must feel COMPLETELY different in setting, time of day, mood, and composition
- Make it feel like the moment AFTER achieving the goal — not the struggle, but the arrival
- Be hyper-specific: don't say "fit person", say "standing in the kitchen at 6am, shirt off, catching your reflection in the microwave door, realising you've changed"
- Ground it in real life: a specific gym, mirror, street, beach, moment — not a fantasy mountaintop
- The ${personDesc} should be the subject but shown from behind, side, or mid-distance — NOT a close-up portrait (avoids uncanny valley)
- Mood over muscle: emotion, light, atmosphere matter more than physique details
- ${goal.aesthetic === 'Bold & dark' ? 'Use dramatic chiaroscuro lighting, deep shadows, high contrast' : ''}
- ${goal.aesthetic === 'Minimal & clean' ? 'Use clean natural light, negative space, restrained palette' : ''}
- ${goal.aesthetic === 'Warm & natural' ? 'Use golden hour warmth, organic textures, earth tones' : ''}
- ${goal.aesthetic === 'Bright & energetic' ? 'Use vibrant colour, dynamic angles, kinetic energy' : ''}

Return ONLY a JSON array of exactly 3 objects:
[
  {
    "label": "evocative 3-5 word title",
    "description": "one powerful sentence — the emotional story of this image",
    "dallePrompt": "a 120-150 word DALL-E 3 prompt. Start with the shot type and lighting. Describe the specific scene, environment, time of day, the ${personDesc}'s pose and position. End with: cinematic photography, ${goal.aesthetic} aesthetic, photorealistic, 8K, no text."
  }
]`,
      }],
    })

    let concepts: any[] = []
    try {
      const raw = conceptRes.content[0].type === 'text' ? conceptRes.content[0].text : '[]'
      const cleaned = raw.replace(/```json|```/g, '').trim()
      concepts = JSON.parse(cleaned)
    } catch {
      return NextResponse.json({ error: 'Failed to generate scene concepts' }, { status: 500 })
    }

    // Step 2: Generate images SEQUENTIALLY (not parallel) to avoid rate limits
    const options: any[] = []
    for (const concept of concepts) {
      // Add person note to each prompt
      const personNote = hasSelfiePermission && personDesc !== 'person'
        ? `The subject is a ${personDesc}.`
        : personDesc !== 'person'
          ? `The subject appears to be a ${personDesc}.`
          : ''

      const finalPrompt = [concept.dallePrompt, personNote].filter(Boolean).join(' ')

      const imageUrl = await generateImage(finalPrompt)
      options.push({
        label: concept.label,
        description: concept.description,
        imageUrl,
      })

      // Small delay between requests to be kind to the rate limit
      if (options.length < concepts.length) {
        await new Promise(r => setTimeout(r, 800))
      }
    }

    return NextResponse.json({ options })
  } catch (error: any) {
    console.error('Vision art error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}