import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { goalId } = await request.json()

    const { data: goal } = await supabase.from('goals').select('*').eq('id', goalId).eq('user_id', user.id).single()
    if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })

    // Check if user has a selfie with permission
    const hasSelfie = !!(goal.selfie_url && goal.selfie_permission)

    // Build person description for DALL-E
    const personDesc = [
      goal.user_gender && goal.user_gender !== 'Prefer not to say' ? goal.user_gender.toLowerCase() : null,
      goal.user_age ? `approximately ${goal.user_age} years old` : null,
      goal.user_ethnicity && goal.user_ethnicity !== 'Prefer not to say' ? goal.user_ethnicity : null,
      goal.user_city ? `from ${goal.user_city}` : null,
    ].filter(Boolean).join(', ')

    const selfieNote = hasSelfie
      ? `IMPORTANT: The user has provided a selfie for vision art personalisation. The AI-generated person in each image should resemble this person (${personDesc || 'the subject'}). Use their facial features, skin tone, and appearance as the basis for the main figure.`
      : personDesc
        ? `The person in the images should appear to be: ${personDesc}.`
        : 'Do not include a recognisable person unless essential to the scene.'

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

Create 3 completely different visual scenes that represent achieving this goal. Each should be distinct in setting, mood, and composition.

Return ONLY a JSON array of 3 objects with this exact structure:
[
  {
    "label": "short evocative title (4-6 words)",
    "description": "one sentence describing this vision",
    "dallePrompt": "detailed DALL-E prompt, photorealistic, ${goal.aesthetic} style, [describe specific scene with rich visual detail, setting, lighting, emotion, composition]"
  }
]

Rules for dallePrompt:
- Photorealistic, cinematic quality
- Rich with specific visual details (lighting, environment, atmosphere)
- Emotionally evocative — should feel like the achieved future state
- No text, words, or typography in the image
- Safe for work, inspiring, aspirational`
      }]
    })

    let concepts: any[] = []
    try {
      const raw = conceptRes.content[0].type === 'text' ? conceptRes.content[0].text : '[]'
      const cleaned = raw.replace(/```json|```/g, '').trim()
      concepts = JSON.parse(cleaned)
    } catch {
      return NextResponse.json({ error: 'Failed to generate concepts' }, { status: 500 })
    }

    // Step 2: Generate images with DALL-E 3 for each concept
    const options = await Promise.all(concepts.map(async (concept: any) => {
      try {
        // Build final prompt — inject selfie note / person description
        const finalPrompt = `${concept.dallePrompt}. ${selfieNote} Photorealistic, professional photography, cinematic lighting, 8K quality. No text or words in the image.`

        let imageUrl: string | null = null

        if (hasSelfie && goal.selfie_url) {
          // Use DALL-E 3 with a strong description including person
          // Note: DALL-E 3 text-to-image — we describe the person based on their selfie
          // (DALL-E doesn't support image-to-image directly, so we use the description approach)
          const response = await openai.images.generate({
            model: 'dall-e-3',
            prompt: finalPrompt,
            n: 1,
            size: '1024x1792', // portrait
            quality: 'hd',
            style: 'vivid',
          })
          imageUrl = response.data[0]?.url || null
        } else {
          const response = await openai.images.generate({
            model: 'dall-e-3',
            prompt: finalPrompt,
            n: 1,
            size: '1024x1792',
            quality: 'hd',
            style: 'vivid',
          })
          imageUrl = response.data[0]?.url || null
        }

        return {
          label: concept.label,
          description: concept.description,
          imageUrl,
        }
      } catch (e: any) {
        console.error('DALL-E error for concept:', e.message)
        return {
          label: concept.label,
          description: concept.description,
          imageUrl: null,
        }
      }
    }))

    return NextResponse.json({ options })
  } catch (error: any) {
    console.error('Vision art error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}