import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { messages, goalId } = await request.json()

    // Fetch goal context from database
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
`
      }
    }

    // Fetch recent checkins for context
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
- Be specific — always reference their actual goal, not generic advice
- Be direct — don't hedge, don't be wishy-washy
- Be human — sound like a real coach who knows them, not an AI
- Keep responses to 2-4 sentences unless they ask for more detail
- End every response with ONE clear question or action
- Never use bullet points in casual conversation
- Call out excuses firmly but kindly
- Celebrate wins specifically
- If they mention struggling, ask what specifically is blocking them
- Reference their "why" when motivation drops
- Reference their streak and progress when relevant`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: systemPrompt,
      messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
    })

    const reply = message.content[0].type === 'text' ? message.content[0].text : "Tell me more about what's on your mind."

    // Save to database
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
