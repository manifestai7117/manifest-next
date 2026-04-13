import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: Request) {
  try {
    const { text } = await request.json()
    if (!text?.trim()) return NextResponse.json({ safe: true })

    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 50,
      messages: [{
        role: 'user',
        content: `Is this text appropriate for a goal-tracking social app? Check for hate speech, explicit content, harassment, spam, or severely offensive material. Reply ONLY with JSON: {"safe": true} or {"safe": false, "reason": "brief reason"}

Text: "${text.slice(0, 500)}"`
      }]
    })
    const raw = res.content[0].type === 'text' ? res.content[0].text.trim() : '{"safe":true}'
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json({ safe: true }) // fail open
  }
}
