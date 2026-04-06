import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const TIMELINE_DAYS: Record<string,number> = {
  '2 weeks':14,'1 month':30,'2 months':60,'3 months':90,'6 months':180,'1 year':365,'2+ years':730
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      goal, category, timeline, why, obstacles, aesthetic, userName,
      successLooks, motivator, bestTime, coachStyle,
      gender, ageRange, ethnicity
    } = body

    if (!goal||!category||!timeline||!why||!aesthetic) {
      return NextResponse.json({error:'Missing required fields'},{status:400})
    }

    const totalDays = TIMELINE_DAYS[timeline]||90
    const m1Day = Math.round(totalDays*0.33)
    const m2Day = Math.round(totalDays*0.66)
    const m3Day = totalDays

    // Build the appearance descriptor for vision art
    const personDesc = [
      gender && gender !== 'Prefer not to say' ? gender.toLowerCase() : '',
      ageRange ? `${ageRange} years old` : '',
      ethnicity && ethnicity !== 'Prefer not to say' ? ethnicity : ''
    ].filter(Boolean).join(', ')

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1400,
      system: `You are Manifest's AI. Return ONLY raw JSON, no markdown, no backticks, no extra text.

CRITICAL RULE FOR VISION ART:
The vision art description must describe a REAL SCENE showing a PERSON WHO LOOKS LIKE THE USER actively achieving their goal.
- Person description: ${personDesc || 'a person in their prime'}
- The art should show them MID-ACTION doing the goal — not symbols, not objects, not abstract concepts
- Style: ${aesthetic}
- It should look like a real photograph or painting of THEM achieving it
- Example for marathon goal: "A ${personDesc} crossing a marathon finish line, arms raised, crowd cheering, golden hour light"
- Example for business goal: "A ${personDesc} presenting to investors in a sleek boardroom, confident posture, charts behind them"

Required JSON:
{
  "artTitle": "3-5 words — the title of this vision scene",
  "artDescription": "2 sentences describing the scene. MUST show ${personDesc||'the user'} actively doing/achieving '${goal}'. Be vivid and specific to the goal. Mention the ${aesthetic} visual style.",
  "visionArtPrompt": "A detailed image generation prompt: ${personDesc||'person'} actively ${goal}, ${aesthetic.toLowerCase()} photography style, highly detailed, professional quality, inspirational, aspirational",
  "affirmation": "1 sentence the user says out loud — present tense, specific to '${goal}', sounds natural not robotic",
  "milestones": [
    {"label":"Day ${m1Day}","goal":"specific measurable milestone at exactly day ${m1Day} of this ${timeline} journey toward '${goal}'"},
    {"label":"Day ${m2Day}","goal":"specific measurable milestone at day ${m2Day}"},
    {"label":"Day ${m3Day}","goal":"what completing '${goal}' looks like on day ${m3Day}"}
  ],
  "coachOpening": "2-3 warm direct sentences. Know that their timeline is '${timeline}'. Reference their goal AND their why AND their motivator (${motivator||'achievement'}). Make them feel truly seen. Reference their success vision if provided.",
  "todayAction": "One specific action for the next 2 hours. Must be directly about '${goal}'."
}

Rules:
- Milestone labels MUST be "Day ${m1Day}", "Day ${m2Day}", "Day ${m3Day}" — never "30 days", "60 days", "90 days"  
- All milestones specific to '${goal}' — never generic
- Coach style preference is '${coachStyle||'balanced'}'
- Best productive time: '${bestTime||'flexible'}'`,
      messages:[{
        role:'user',
        content:`Name: ${userName}
Goal: ${goal}
Category: ${category}
Timeline: ${timeline} (${totalDays} days)
Why: ${why}
Success looks like: ${successLooks||'not specified'}
Obstacles: ${obstacles||'none'}
Aesthetic: ${aesthetic}
Person: ${personDesc||'not specified'}
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
