import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: Request) {
  try {
    const { rewardTitle, rewardEmoji, goalTitle, rewardDescription } = await request.json()
    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 120,
      messages: [{
        role: 'user',
        content: `Write a short, genuine social media post (2-3 sentences max, 200 chars max) from someone who just earned the "${rewardEmoji} ${rewardTitle}" badge for their goal: "${goalTitle}". Context: ${rewardDescription}. Sound real, proud, and motivating — not corporate. No hashtags. No quotes around it. Just the post text.`
      }]
    })
    const content = res.content[0].type === 'text' ? res.content[0].text.trim() : ''
    return NextResponse.json({ content })
  } catch {
    return NextResponse.json({ content: '' })
  }
}
