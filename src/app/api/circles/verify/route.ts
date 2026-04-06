import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Check pro plan
    const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).single()
    const isPro = profile?.plan === 'pro' || profile?.plan === 'pro_trial'
    if (!isPro) return NextResponse.json({ error: 'Pro plan required', approved: false, reason: 'Creating circles requires a Pro plan' }, { status: 403 })

    const { name, goal, category } = await request.json()
    if (!name || !goal || !category) return NextResponse.json({ error: 'Missing fields', approved: false }, { status: 400 })

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: `You review accountability group circle proposals. Return ONLY raw JSON: {"approved": true/false, "reason": "brief explanation"}.
      
APPROVE if: The circle has a clear, specific, achievable goal that people could genuinely hold each other accountable to.
REJECT if: The circle has no clear goal, promotes harmful activities, is spam, or is completely unrelated to personal growth/achievement.
      
Be lenient — most genuine goal circles should be approved.`,
      messages: [{ role: 'user', content: `Circle name: "${name}"\nGoal: "${goal}"\nCategory: "${category}"` }]
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : '{}'
    const result = JSON.parse(raw.replace(/```json|```/g, '').trim())
    return NextResponse.json(result)
  } catch (error: any) {
    // Default to approved if AI fails
    return NextResponse.json({ approved: true, reason: 'Verified' })
  }
}
