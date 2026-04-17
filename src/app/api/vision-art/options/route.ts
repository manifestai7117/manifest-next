import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function generateImage(prompt: string): Promise<string | null> {
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
      console.error('DALL-E error:', err)
      return null
    }
    const data = await res.json()
    return data.data?.[0]?.url ?? null
  } catch (e) {
    console.error('generateImage error:', e)
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
      .from('goals')
      .select('*')
      .eq('id', goalId)
      .eq('user_id', user.id)
      .single()
    if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })

    // Build person description for prompt personalisation
    const personParts = [
      goal.user_gender && goal.user_gender !== 'Prefer not to say' ? goal.user_gender.toLowerCase() : null,
      goal.user_age ? `approximately ${goal.user_age} years old` : null,
      goal.user_ethnicity && goal.user_ethnicity !== 'Prefer not to say' ? goal.user_ethnicity : null,
      goal.user_city ? `from ${goal.user_city}` : null,
    ].filter(Boolean)

    const personDesc = personParts.join(', ')
    const hasSelfiePermission = !!(goal.selfie_url && goal.selfie_permission)

    const personNote = hasSelfiePermission && personDesc
      ? `The main subject in the image should be a ${personDesc} person.`
      : personDesc
        ? `If a person appears in the image, they should appear to be: ${personDesc}.`
        : ''

    // Step 1: Generate 3 scene concepts with Claude
    const conceptRes = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: `You are creating 3 distinct vision board image concepts for someone's goal.

GOAL: "${goal.title}"
WHY: ${goal.why}
AESTHETIC: ${goal.aesthetic}
CATEGORY: ${goal.category}
CITY: ${goal.user_city || 'unspecified'}
AFFIRMATION: ${goal.affirmation}
CURRENT STORY: ${goal.current_story || 'Not shared'}

Create 3 completely different visual scenes representing achieving this goal. Each must be distinct in setting, mood, and composition.

Return ONLY a JSON array of 3 objects:
[
  {
    "label": "short evocative title (4-6 words)",
    "description": "one sentence describing this vision",
    "dallePrompt": "detailed DALL-E prompt, photorealistic, ${goal.aesthetic} style — specific scene with rich visual detail, setting, lighting, emotion, composition. No text or words in the image."
  }
]

Rules:
- Photorealistic, cinematic quality
- Emotionally evocative — the achieved future state
- No text, words, or typography in the image
- Safe for work, inspiring, aspirational`,
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

    // Step 2: Generate images in parallel via OpenAI REST API (no SDK needed)
    const options = await Promise.all(
      concepts.map(async (concept: any) => {
        const finalPrompt = [
          concept.dallePrompt,
          personNote,
          'Photorealistic, professional photography, cinematic lighting, 8K quality. No text or words in the image.',
        ].filter(Boolean).join(' ')

        const imageUrl = await generateImage(finalPrompt)

        return {
          label: concept.label,
          description: concept.description,
          imageUrl,
        }
      })
    )

    return NextResponse.json({ options })
  } catch (error: any) {
    console.error('Vision art error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}