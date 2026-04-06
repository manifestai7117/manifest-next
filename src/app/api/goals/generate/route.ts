import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: Request) {
  try {
    const { goal, category, timeline, why, obstacles, aesthetic, userName } = await request.json()

    if (!goal || !category || !timeline || !why || !aesthetic) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: `You are Manifest's AI goal engine. Return ONLY a raw JSON object — no markdown, no backticks, no extra text.
Required keys:
{
  "artTitle": "3-5 evocative words for vision art title — poetic, specific to their goal",
  "artDescription": "2 vivid sentences describing personalized vision artwork tied to their EXACT goal and chosen aesthetic style",
  "affirmation": "1 powerful present-tense sentence starting with 'I am' or 'I' — must reference their SPECIFIC goal verbatim, not generic",
  "milestone30": "specific measurable milestone for 30 days — tied to their exact goal",
  "milestone60": "specific measurable milestone for 60 days",
  "milestone90": "specific measurable milestone for 90 days — should connect to their ${timeline} timeline",
  "coachOpening": "2-3 warm, direct, specific sentences — reference their actual goal and why. No fluff. Make them feel seen.",
  "todayAction": "one concrete action they can take in the next 2 hours — must be specific to their goal"
}

CRITICAL RULES:
- The timeline field says '${timeline}' — DO NOT say 'by X days'. Say 'within ${timeline}' or reference the actual date range.
- Every output must reference their exact goal: '${goal}'
- Never write generic platitudes
- The affirmation must sound like something a real person would say out loud`,
      messages: [{
        role: 'user',
        content: `Name: ${userName}\nGoal: ${goal}\nCategory: ${category}\nTimeline: ${timeline}\nWhy this matters: ${why}\nPast obstacles: ${obstacles || 'None shared'}\nAesthetic preference: ${aesthetic}`
      }]
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())

    return NextResponse.json(parsed)
  } catch (error: any) {
    console.error('Goal generation error:', error)
    return NextResponse.json({ error: error.message || 'Generation failed' }, { status: 500 })
  }
}
