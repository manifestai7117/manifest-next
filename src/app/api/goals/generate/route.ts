import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const TIMELINE_DAYS: Record<string, number> = {
  '2 weeks': 14, '1 month': 30, '2 months': 60,
  '3 months': 90, '6 months': 180, '1 year': 365, '2+ years': 730
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { goal, category, timeline, why, obstacles, aesthetic, userName, successLooks, motivator, bestTime, coachStyle } = body

    if (!goal || !category || !timeline || !why || !aesthetic) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const totalDays = TIMELINE_DAYS[timeline] || 90
    const m1Day = Math.round(totalDays * 0.33)
    const m2Day = Math.round(totalDays * 0.66)
    const m3Day = totalDays

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      system: `You are Manifest's AI. Return ONLY raw JSON, no markdown, no backticks.

The user's timeline is "${timeline}" which is ${totalDays} days total.
Milestones MUST be for day ${m1Day}, day ${m2Day}, and day ${m3Day} of their journey.
Never use "30 days", "60 days", or "90 days" as labels — use the actual day numbers above.

Return this exact structure:
{
  "artTitle": "3-5 poetic words specific to their goal and aesthetic",
  "artDescription": "2 vivid sentences describing their personalized vision art — tied to '${aesthetic}' style and their exact goal",
  "affirmation": "1 present-tense sentence the user would say out loud — must name their specific goal naturally",
  "milestones": [
    { "label": "Day ${m1Day}", "goal": "specific measurable milestone at day ${m1Day} of this ${timeline} journey" },
    { "label": "Day ${m2Day}", "goal": "specific measurable milestone at day ${m2Day}" },
    { "label": "Day ${m3Day}", "goal": "what completing the goal looks like at day ${m3Day}" }
  ],
  "coachOpening": "2-3 warm direct sentences. Reference their goal, their why, and their motivator (${motivator || 'achievement'}). Make them feel seen.",
  "todayAction": "one specific action they can do in the next 2 hours for '${goal}'"
}

Rules:
- All milestones must be specific to "${goal}" — never generic
- Milestone labels must be "Day ${m1Day}", "Day ${m2Day}", "Day ${m3Day}"
- Aesthetic is "${aesthetic}" — art description must match this mood
- Motivator is "${motivator}" — weave this into coaching naturally
- Coach style preference: "${coachStyle}"`,
      messages: [{
        role: 'user',
        content: `Name: ${userName}
Goal: ${goal}
Category: ${category}
Timeline: ${timeline} (${totalDays} days)
Why: ${why}
Success looks like: ${successLooks || 'not specified'}
Obstacles: ${obstacles || 'none shared'}
Aesthetic: ${aesthetic}
Motivator: ${motivator || 'not specified'}
Best time: ${bestTime || 'not specified'}
Coach style: ${coachStyle || 'not specified'}`
      }]
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : '{}'
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())

    return NextResponse.json(parsed)
  } catch (error: any) {
    console.error('Goal generation error:', error)
    return NextResponse.json({ error: error.message || 'Generation failed' }, { status: 500 })
  }
}
