import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const LIMITS: Record<string,number> = { free: 5, pro: 15, pro_trial: 15, elite: 999 }

export async function GET(request: Request) {
  // Returns today's usage count for the user
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).single()
    const plan = (profile?.plan || 'free') as string
    const limit = LIMITS[plan] || 5

    const { data: usage } = await supabase
      .from('chat_usage')
      .select('count')
      .eq('user_id', user.id)
      .eq('date', new Date().toISOString().split('T')[0])
      .single()

    const used = usage?.count || 0
    return NextResponse.json({ used, limit, remaining: Math.max(0, limit - used), plan })
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

    // Get user plan and check daily limit
    const { data: profile } = await supabase.from('profiles').select('plan, full_name').eq('id', user.id).single()
    const plan = (profile?.plan || 'free') as string
    const limit = LIMITS[plan] || 5
    const today = new Date().toISOString().split('T')[0]

    const { data: usage } = await supabase
      .from('chat_usage')
      .select('count')
      .eq('user_id', user.id)
      .eq('date', today)
      .single()

    const currentUsage = usage?.count || 0
    if (currentUsage >= limit) {
      return NextResponse.json({
        error: `Daily limit reached`,
        limitReached: true,
        limit,
        plan,
        message: plan === 'free'
          ? `You've used all ${limit} free chats today. Upgrade to Pro for ${LIMITS.pro} chats per day. Resets at midnight.`
          : `You've used all ${limit} chats today. Resets at midnight.`
      }, { status: 429 })
    }

    // Fetch the specific goal with full context
    let goalContext = ''
    let allGoalsContext = ''
    if (goalId) {
      const { data: goal } = await supabase.from('goals').select('*').eq('id', goalId).eq('user_id', user.id).single()
      if (goal) {
        goalContext = `
ACTIVE GOAL BEING DISCUSSED:
- Title: "${goal.title}"
- Category: ${goal.category}  
- Timeline: ${goal.timeline}
- Why it matters: ${goal.why}
- Success looks like: ${goal.success_looks || 'not specified'}
- Past obstacles: ${goal.obstacles || 'none shared'}
- Current streak: ${goal.streak} days
- Progress: ${goal.progress}%
- Phase 1 done: ${goal.phase1_completed ? 'YES ✓' : 'No'}
- Phase 2 done: ${goal.phase2_completed ? 'YES ✓' : 'No'}
- Phase 3 done: ${goal.phase3_completed ? 'YES ✓' : 'No'}
- Daily affirmation: "${goal.affirmation}"
- Motivator: ${goal.motivator || 'not specified'}
- Best productive time: ${goal.best_time || 'not specified'}
- Preferred coach style: ${goal.coach_style || 'balanced'}
`
      }
    }

    // Also load other active goals for full picture
    const { data: otherGoals } = await supabase
      .from('goals')
      .select('title, category, timeline, progress, streak')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .neq('id', goalId || '')

    if (otherGoals?.length) {
      allGoalsContext = `\nUSER'S OTHER ACTIVE GOALS:\n${otherGoals.map(g => `- "${g.title}" (${g.category}, ${g.timeline}, ${g.progress}% done, ${g.streak} day streak)`).join('\n')}`
    }

    // Fetch recent check-ins
    const { data: checkins } = await supabase
      .from('checkins')
      .select('note, mood, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)

    const checkinContext = checkins?.length
      ? `\nRECENT CHECK-INS:\n${checkins.map(c => `- ${new Date(c.created_at).toLocaleDateString()}: mood ${c.mood}/5${c.note ? `, "${c.note}"` : ''}`).join('\n')}`
      : ''

    const systemPrompt = `You are a world-class personal life coach inside the Manifest app. You have deep, specific knowledge of this person's goals.

USER: ${profile?.full_name || 'User'} | Plan: ${plan}
${goalContext}${allGoalsContext}${checkinContext}

YOUR COACHING IDENTITY:
- You are direct, warm, and deeply human — not an AI assistant
- You've read everything about their goal and you remember it all
- You adapt to their preferred style: ${goalContext.includes('Preferred coach style') ? goalContext.split('Preferred coach style:')[1]?.split('\n')[0]?.trim() : 'balanced'}
- You reference their specific goal, timeline, why, and progress — never speak generically
- Keep replies 2-4 sentences unless they need more depth
- End with ONE clear question or actionable next step
- Never use bullet points in casual conversation
- If they changed timeline: reference the NEW timeline only — the old one is gone
- Call out patterns you notice from check-in data
- Celebrate streak milestones specifically (7 days, 14, 30, etc.)
- Reference their "why" when they seem demotivated
- Be honest — if they're making excuses, name it kindly but clearly

GUARDRAILS:
- Only coach on their actual goals — don't go off-topic
- Never provide medical, legal, or financial advice
- If someone seems in distress, guide them to professional help
- Keep all conversations positive and growth-oriented`

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: systemPrompt,
      messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
    })

    const reply = message.content[0].type === 'text'
      ? message.content[0].text
      : "Tell me more about what's on your mind regarding your goal."

    // Increment usage
    await supabase.rpc('increment_chat_usage', { p_user_id: user.id })
    const newUsage = currentUsage + 1
    const remaining = Math.max(0, limit - newUsage)

    // Save to database (messages are stored encrypted via Supabase RLS + TLS in transit)
    if (goalId) {
      await supabase.from('coach_messages').insert([
        { goal_id: goalId, user_id: user.id, role: 'user', content: messages[messages.length - 1].content },
        { goal_id: goalId, user_id: user.id, role: 'assistant', content: reply },
      ])
    }

    return NextResponse.json({ reply, remaining, limit, used: newUsage })
  } catch (error: any) {
    console.error('Coach error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
