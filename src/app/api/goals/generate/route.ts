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
      max_tokens: 1200,
      system: `You are Manifest's AI goal engine. Return ONLY a raw JSON object — no markdown, no backticks, no extra text.

Required keys:
{
  "artTitle": "3-5 evocative words for vision art title",
  "artDescription": "2 vivid sentences describing personalized vision artwork",
  "affirmation": "1 powerful present-tense 'I am' or 'I' sentence referencing the SPECIFIC goal",
  "milestone30": "VERY SPECIFIC phase 1 target — exact numbers, actions, measurable outcomes. E.g. not 'run more' but 'Run 3x per week, complete a 5K non-stop by day 20'",
  "milestone60": "VERY SPECIFIC phase 2 target — builds on phase 1 with concrete metrics and named sub-goals",
  "milestone90": "VERY SPECIFIC final target — the exact outcome that means the goal is achieved, with a measurable number or event",
  "phase1Actions": "3 specific weekly actions for phase 1 separated by | e.g. 'Run Mon/Wed/Fri 30min|Track meals in MyFitnessPal daily|Sleep 7+ hours every night'",
  "phase2Actions": "3 specific weekly actions for phase 2 separated by |",
  "phase3Actions": "3 specific weekly actions for phase 3 separated by |",
  "coachOpening": "2-3 warm, direct sentences referencing their actual goal and why",
  "todayAction": "one concrete action doable in the next 2 hours, specific to their goal"
}

CRITICAL: Milestones must reference the EXACT goal '${goal}'.
Never use vague language like 'make progress' or 'improve'. Always use numbers, dates, named events, or measurable outcomes.
Timeline is ${timeline} — phase targets should fit within this window.`,
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