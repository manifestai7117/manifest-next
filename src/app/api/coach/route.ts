import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/`(.*?)`/g, '$1')
    .replace(/^\s*[-*+]\s/gm, '')
    .replace(/^\s*\d+\.\s/gm, '')
    .trim()
}

export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const today = new Date(); today.setHours(0, 0, 0, 0)
    const { count } = await supabase.from('coach_messages').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('role', 'user').gte('created_at', today.toISOString())
    const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).single()
    const isPro = profile?.plan === 'pro' || profile?.plan === 'pro_trial'
    const limit = isPro ? 50 : 10
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

    // Rate limit check
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const { count } = await supabase.from('coach_messages').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('role', 'user').gte('created_at', today.toISOString())
    const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).single()
    const isPro = profile?.plan === 'pro' || profile?.plan === 'pro_trial'
    const limit = isPro ? 50 : 10
    if ((count || 0) >= limit) return NextResponse.json({ error: `Daily limit reached (${limit} chats/day). Resets at midnight.` }, { status: 429 })

    // Build comprehensive goal context
    let goalContext = ''
    let goal: any = null
    if (goalId) {
      const { data: g } = await supabase.from('goals').select('*').eq('id', goalId).eq('user_id', user.id).single()
      goal = g
      if (goal) {
        const totalDays = ({ '1 week': 7, '2 weeks': 14, '1 month': 30, '6 weeks': 42, '2 months': 60, '3 months': 90, '6 months': 180, '1 year': 365, '2 years': 730 } as any)[goal.timeline] || 90
        const daysPassed = Math.floor((Date.now() - new Date(goal.created_at).getTime()) / 86400000)
        const daysLeft = Math.max(0, totalDays - daysPassed)

        goalContext = `
GOAL: "${goal.title}"
CATEGORY: ${goal.category}
TIMELINE: ${goal.timeline} (Day ${daysPassed} of ${totalDays} — ${daysLeft} days remaining)
WHY THIS MATTERS: ${goal.why}
PAST OBSTACLES: ${goal.obstacles || 'Not shared'}
CURRENT STREAK: ${goal.streak} days
LONGEST STREAK: ${goal.longest_streak || goal.streak} days
PROGRESS: ${goal.progress}%
AFFIRMATION: ${goal.affirmation}
PHASE 1 TARGET: ${goal.milestone_30 || goal.milestone_1 || 'Not set'}
PHASE 2 TARGET: ${goal.milestone_60 || goal.milestone_2 || 'Not set'}
PHASE 3 TARGET: ${goal.milestone_90 || goal.milestone_3 || 'Not set'}
PHASE COMPLETION STATUS: Phase 1 ${goal.phase1_completed ? `COMPLETED on ${new Date(goal.phase1_completed_at).toLocaleDateString()}` : 'not yet complete'} | Phase 2 ${goal.phase2_completed ? `COMPLETED on ${new Date(goal.phase2_completed_at).toLocaleDateString()}` : 'not yet complete'} | Phase 3 ${goal.phase3_completed ? 'COMPLETED' : 'not yet complete'}
CURRENT STORY / STATE: ${goal.current_story || 'Not shared yet — ask the user how things are going.'}
COACH SUMMARY FROM PREVIOUS SESSIONS: ${goal.coach_summary || 'No previous summary yet.'}
`
      }
    }

    // Get recent checkins with notes
    const { data: checkins } = await supabase
      .from('checkins')
      .select('note, mood, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)

    const checkinContext = checkins?.length
      ? `\nRECENT CHECK-INS (last ${checkins.length}):\n${checkins.map((c: any) => `- ${new Date(c.created_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}: mood ${c.mood}/5${c.note ? `, note: "${c.note}"` : ' (no note)'}`).join('\n')}`
      : '\nNo check-ins yet.'

    // Today's task status
    const todayDate = new Date().toISOString().split('T')[0]
    let todayTaskContext = ''
    if (goalId) {
      const { data: todayTask } = await supabase
        .from('daily_tasks')
        .select('*')
        .eq('goal_id', goalId)
        .eq('user_id', user.id)
        .eq('task_date', todayDate)
        .maybeSingle()

      if (todayTask) {
        if (todayTask.completed === true) {
          todayTaskContext = `\nTODAY'S TASK: "${todayTask.task}" — COMPLETED ✓. Note: "${todayTask.completion_note || 'Done'}"`
        } else if (todayTask.completed === false) {
          todayTaskContext = `\nTODAY'S TASK: "${todayTask.task}" — NOT completed today.`
        } else {
          todayTaskContext = `\nTODAY'S TASK: "${todayTask.task}" — not yet logged as complete or incomplete.`
        }
      } else {
        todayTaskContext = '\nTODAY\'S TASK: Not yet generated for today.'
      }
    }

    // Yesterday's task status
    const yesterdayDate = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    let yesterdayTaskContext = ''
    if (goalId) {
      const { data: yesterdayTask } = await supabase
        .from('daily_tasks')
        .select('*')
        .eq('goal_id', goalId)
        .eq('user_id', user.id)
        .eq('task_date', yesterdayDate)
        .maybeSingle()

      if (yesterdayTask) {
        yesterdayTaskContext = `\nYESTERDAY'S TASK: "${yesterdayTask.task}" — ${yesterdayTask.completed === true ? `COMPLETED. Note: "${yesterdayTask.completion_note}"` : yesterdayTask.completed === false ? 'NOT completed.' : 'Outcome not logged.'}`
      }
    }

    // Missed days analysis
    const checkedToday = checkins?.some((c: any) => c.created_at.startsWith(todayDate))
    const checkedYesterday = checkins?.some((c: any) => c.created_at.startsWith(yesterdayDate))
    const inactivityNote = !checkedToday && !checkedYesterday && (checkins?.length || 0) > 0
      ? '\nNOTE: User has NOT checked in today or yesterday — address this directly if relevant.'
      : checkedToday ? '\nNOTE: User checked in today.' : ''

    const systemPrompt = `You are the Manifest AI coach — a sharp, empathetic, results-focused coach who knows this person deeply.
${goalContext}${checkinContext}${todayTaskContext}${yesterdayTaskContext}${inactivityNote}

YOUR PERSONALITY:
- You have read every check-in note, know their streak, know their why, know their obstacles
- You reference specific details from their history — you never give generic advice
- You are direct, warm, and honest — you call out patterns you see (good and bad)
- You celebrate real wins specifically (not "great job!" but "3 days of 5+ mood means you've found your rhythm")
- You notice when mood dips and probe gently
- You connect today's effort to their larger "why"
- You remember things they told you before and bring them up naturally
- If today's task is marked complete, acknowledge it specifically and build on it
- If today's task is not done, gently address it without being preachy
- When they make excuses, you acknowledge then redirect firmly

FORMAT RULES — CRITICAL:
- Plain conversational prose ONLY — no bullet points, no bold, no asterisks, no markdown
- 2-4 sentences max unless they explicitly ask for more
- End with exactly ONE question or ONE specific action
- Sound like a real person, not an AI assistant`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      system: systemPrompt,
      messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
    })

    const rawReply = response.content[0].type === 'text' ? response.content[0].text : "Tell me what's on your mind."
    const reply = stripMarkdown(rawReply)

    // Save messages
    await supabase.from('coach_messages').insert([
      { goal_id: goalId, user_id: user.id, role: 'user', content: messages[messages.length - 1].content },
      { goal_id: goalId, user_id: user.id, role: 'assistant', content: reply },
    ])

    // Update coach summary every 10 messages
    if (goalId && goal && (count || 0) > 0 && (count || 0) % 10 === 0) {
      try {
        const summaryRes = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 200,
          messages: [{
            role: 'user',
            content: `Summarize what you know about this person's coaching journey in 3-4 sentences. Include: their main struggles, breakthroughs, patterns you've noticed, and any commitments they've made. Be specific. Current context: ${goalContext.slice(0, 500)}. Recent messages: ${messages.slice(-6).map((m: any) => `${m.role}: ${m.content}`).join(' | ')}`
          }]
        })
        const summary = summaryRes.content[0].type === 'text' ? summaryRes.content[0].text : ''
        if (summary) await supabase.from('goals').update({ coach_summary: summary }).eq('id', goalId)
      } catch {}
    }

    return NextResponse.json({ reply })
  } catch (error: any) {
    console.error('Coach error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}