import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const TIMELINE_DAYS: Record<string,number> = {
  '2 weeks':14,'1 month':30,'2 months':60,'3 months':90,
  '6 months':180,'1 year':365,'2+ years':730
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { goal, category, timeline, why, obstacles, aesthetic, userName,
            successLooks, motivator, bestTime, coachStyle, gender, ageRange, ethnicity } = body

    if (!goal||!category||!timeline||!why||!aesthetic)
      return NextResponse.json({error:'Missing required fields'},{status:400})

    const totalDays = TIMELINE_DAYS[timeline]||90
    const m1Day = Math.round(totalDays*0.33)
    const m2Day = Math.round(totalDays*0.66)
    const m3Day = totalDays

    const personDesc = [
      gender && gender!=='Prefer not to say' ? gender.toLowerCase() : 'person',
      ageRange ? `${ageRange} years old` : '',
      ethnicity && ethnicity!=='Prefer not to say' ? ethnicity : ''
    ].filter(Boolean).join(', ')

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1400,
      system: `You are Manifest's AI goal engine. Return ONLY raw JSON, zero markdown, no backticks.

ABOUT VISION ART - CRITICAL:
The vision art is a text-based description that will be rendered as an SVG scene.
The artDescription MUST describe a SCENE showing a PERSON actively doing the goal.
Format: "[Person description] is [actively doing the specific goal action]. [Vivid environmental details in ${aesthetic} style]."
Example for marathon: "A focused Asian man in his late 20s crosses a marathon finish line, arms raised, golden hour light casting long shadows across the race track as spectators cheer."
Example for business: "A determined South Asian woman in her 30s presents confidently to a boardroom, gesturing toward growth charts on a screen behind her."
The scene must show the person MID-ACTION achieving their exact goal.

ABOUT DISPLAY TITLE - CRITICAL:
displayTitle should be a SHORT, EVOCATIVE title (4-7 words max) that captures the ESSENCE and AMBITION of the goal.
NOT just repeating what they wrote. Make it inspiring, specific, memorable.
Examples:
- "Build an app for financial freedom" → "My Path to Financial Independence"  
- "Run a marathon" → "Crossing the Finish Line"
- "Write a novel" → "The Author I'm Becoming"
- "Lose 30 lbs" → "The Healthiest Version of Me"
- "Launch my startup" → "Building Something Real"

Return this exact structure:
{
  "displayTitle": "4-7 word inspiring title capturing their goal essence",
  "artTitle": "3-5 poetic words for the artwork — NOT the goal text",
  "artDescription": "1 sentence: [${personDesc}] actively [doing ${goal}]. [Environmental context in ${aesthetic} style].",
  "visionArtPrompt": "Detailed prompt for the scene",
  "affirmation": "Present-tense sentence. Must sound natural spoken aloud. Reference the specific goal.",
  "milestones": [
    {"label":"Day ${m1Day}","goal":"specific measurable milestone at day ${m1Day} of this ${timeline} journey"},
    {"label":"Day ${m2Day}","goal":"specific measurable milestone at day ${m2Day}"},
    {"label":"Day ${m3Day}","goal":"what achieving '${goal}' looks like on day ${m3Day}"}
  ],
  "coachOpening": "2-3 sentences. Reference timeline '${timeline}', their why, motivator '${motivator||'achievement'}'. Make them feel seen and specific.",
  "todayAction": "One concrete action for the next 2 hours. Specific to '${goal}'."
}

Rules:
- Milestone labels MUST be "Day ${m1Day}", "Day ${m2Day}", "Day ${m3Day}"
- Milestones specific to '${goal}' — never generic
- Coach style: '${coachStyle||'balanced'}'
- Person for art: ${personDesc}`,
      messages:[{
        role:'user',
        content:`Name: ${userName}
Goal: ${goal}
Category: ${category}
Timeline: ${timeline} (${totalDays} days total)
Why: ${why}
Success looks like: ${successLooks||'not specified'}
Obstacles: ${obstacles||'none'}
Aesthetic: ${aesthetic}
Person appearance: ${personDesc}
Motivator: ${motivator||'not specified'}
Best time: ${bestTime||'not specified'}
Coach style: ${coachStyle||'not specified'}`
      }]
    })

    const raw = message.content[0].type==='text' ? message.content[0].text : '{}'
    const parsed = JSON.parse(raw.replace(/```json|```/g,'').trim())
    return NextResponse.json(parsed)
  } catch(error:any) {
    console.error('Goal generation error:',error)
    return NextResponse.json({error:error.message||'Generation failed'},{status:500})
  }
}
