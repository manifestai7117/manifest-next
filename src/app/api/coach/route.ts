import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Strip markdown formatting from AI responses
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')  // **bold**
    .replace(/\*(.*?)\*/g, '$1')       // *italic*
    .replace(/__(.*?)__/g, '$1')       // __bold__
    .replace(/_(.*?)_/g, '$1')         // _italic_
    .replace(/#{1,6}\s/g, '')          // headings
    .replace(/`(.*?)`/g, '$1')         // inline code
    .replace(/^\s*[-*+]\s/gm, '')      // bullet points
    .replace(/^\s*\d+\.\s/gm, '')      // numbered lists
    .trim()
}

export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const goalId = searchParams.get('goalId')

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { count } = await supabase
      .from('coach_messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('role', 'user')
      .gte('created_at', today.toISOString())

    const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).single()
    const isPro = profile?.plan === 'pro' || profile?.plan === 'pro_trial'
    const limit = isPro ? 15 : 5
    const used = count || 0

    return NextResponse.json({ used, limit, remaining: Math.max(0, limit - used) })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { messages, goalId } = await request.json()

    // Check rate limit
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const { count } = await supabase
      .from('coach_messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('role', 'user')
      .gte('created_at', today.toISOString())

    const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).single()
    const isPro = profile?.plan === 'pro' || profile?.plan === 'pro_trial'
    const limit = isPro ? 15 : 5
    if ((count || 0) >= limit) {
      return NextResponse.json({ error: `Daily limit reached (${limit} chats/day). Resets at midnight.` }, { status: 429 })
    }

    let goalContext = ''
    if (goalId) {
      const { data: goal } = await supabase.from('goals').select('*').eq('id', goalId).eq('user_id', user.id).single()
      if (goal) {
        goalContext = `
USER'S GOAL: "${goal.title}"
CATEGORY: ${goal.category}
TIMELINE: ${goal.timeline}
WHY IT MATTERS: ${goal.why}
PAST OBSTACLES: ${goal.obstacles || 'Not shared'}
CURRENT STREAK: ${goal.streak} days
PROGRESS: ${goal.progress}%
AFFIRMATION: ${goal.affirmation}
COACH STYLE: ${goal.coach_style || 'Direct and motivating'}
MOTIVATOR: ${goal.motivator || 'Achievement'}
BEST TIME: ${goal.best_time || 'Morning'}
`
      }
    }

    const { data: checkins } = await supabase
      .from('checkins')
      .select('note, mood, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)

    const checkinContext = checkins?.length
      ? `\nRECENT CHECK-INS:\n${checkins.map(c => `- ${new Date(c.created_at).toLocaleDateString()}: mood ${c.mood}/5${c.note ? `, note: "${c.note}"` : ''}`).join('\n')}`
      : ''

    const systemPrompt = `You are a direct, warm, expert life coach inside the Manifest app. You have full context about this person's goal.
${goalContext}${checkinContext}

YOUR COACHING STYLE:
- Write in plain conversational prose — no bullet points, no bold text, no markdown formatting whatsoever
- No asterisks, no hashtags, no dashes at line starts — just natural sentences and paragraphs
- Be specific — always reference their actual goal, not generic advice
- Be direct and human — sound like a real coach who knows them well
- Keep responses to 2-4 sentences unless they ask for more detail
- End every response with ONE clear question or action
- Call out excuses firmly but kindly
- Celebrate wins specifically
- Reference their "why" when motivation drops`

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: systemPrompt,
      messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
    })

    const rawReply = message.content[0].type === 'text' ? message.content[0].text : "Tell me more about what's on your mind."
    const reply = stripMarkdown(rawReply)

    await supabase.from('coach_messages').insert([
      { goal_id: goalId, user_id: user.id, role: 'user', content: messages[messages.length - 1].content },
      { goal_id: goalId, user_id: user.id, role: 'assistant', content: reply },
    ])

    return NextResponse.json({ reply })
  } catch (error: any) {
    console.error('Coach error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
