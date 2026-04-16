import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/_{1,2}(.*?)_{1,2}/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/`(.*?)`/g, '$1')
    .replace(/^\s*[-*+]\s/gm, '• ')
    .replace(/^\s*\d+\.\s/gm, '')
    .trim()
}

// GET - get today's task (and check if yesterday was logged)
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const goalId = searchParams.get('goalId')
  if (!goalId) return NextResponse.json({ error: 'Missing goalId' }, { status: 400 })

  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

  // Check if today's task exists
  const { data: todayTask } = await supabase.from('daily_tasks').select('*').eq('goal_id', goalId).eq('user_id', user.id).eq('task_date', today).maybeSingle()

  // Check if yesterday's task was completed
  const { data: yesterdayTask } = await supabase.from('daily_tasks').select('*').eq('goal_id', goalId).eq('user_id', user.id).eq('task_date', yesterday).maybeSingle()

  // Check if checked in today
  const { data: todayCheckin } = await supabase.from('checkins').select('id, note, mood').eq('goal_id', goalId).eq('user_id', user.id).gte('created_at', `${today}T00:00:00`).maybeSingle()

  return NextResponse.json({
    todayTask,
    yesterdayTask,
    checkedInToday: !!todayCheckin,
    todayCheckin,
    needsYesterdayLog: yesterdayTask && !yesterdayTask.completed && !todayCheckin,
  })
}

// POST - generate today's task OR submit yesterday's completion
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { goalId, action, completionNote, yesterdayTaskId } = await request.json()
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

  // Action: log yesterday's completion
  if (action === 'log_yesterday' && yesterdayTaskId && completionNote) {
    await supabase.from('daily_tasks').update({
      completed: true,
      completion_note: completionNote.trim(),
    }).eq('id', yesterdayTaskId).eq('user_id', user.id)

    // Also update last_checkin_note on goal
    await supabase.from('goals').update({ last_checkin_note: completionNote.trim() }).eq('id', goalId)

    return NextResponse.json({ success: true })
  }

  // Action: generate today's task
  const [{ data: goal }, { data: recentCheckins }, { data: recentCoach }, { data: recentTasks }] = await Promise.all([
    supabase.from('goals').select('*').eq('id', goalId).eq('user_id', user.id).single(),
    supabase.from('checkins').select('note, mood, created_at').eq('goal_id', goalId).order('created_at', { ascending: false }).limit(7),
    supabase.from('coach_messages').select('role, content').eq('goal_id', goalId).order('created_at', { ascending: false }).limit(10),
    supabase.from('daily_tasks').select('*').eq('goal_id', goalId).eq('user_id', user.id).order('task_date', { ascending: false }).limit(5),
  ])

  if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })

  // Check if task already exists today
  const { data: existing } = await supabase.from('daily_tasks').select('*').eq('goal_id', goalId).eq('user_id', user.id).eq('task_date', today).maybeSingle()
  if (existing) return NextResponse.json({ task: existing })

  // Get yesterday's task context
  const yesterdayTask = recentTasks?.find(t => t.task_date === yesterday)
  const yesterdayContext = yesterdayTask
    ? `Yesterday's task was: "${yesterdayTask.task}". ${yesterdayTask.completed ? `User reported: "${yesterdayTask.completion_note}"` : 'User did NOT log completion of this task.'}`
    : 'No task was assigned yesterday.'

  const recentCheckinContext = recentCheckins?.length
    ? recentCheckins.slice(0, 5).map((c: any) => `${new Date(c.created_at).toLocaleDateString('en-US', { weekday: 'short' })}: mood ${c.mood}/5${c.note ? ` — "${c.note}"` : ''}`).join('\n')
    : 'No recent check-ins'

  const coachContext = recentCoach?.slice(0, 6).reverse().map((m: any) => `${m.role === 'user' ? 'User' : 'Coach'}: ${m.content.slice(0, 120)}`).join('\n') || 'No recent coaching conversations'

  const prompt = `You are a strict but caring life coach generating ONE specific daily task.

GOAL: "${goal.title}"
WHY: ${goal.why}
STREAK: ${goal.streak} days
PROGRESS: ${goal.progress}%
PHASE 1: ${goal.milestone_30 || 'Build foundation'}
PHASE 2: ${goal.milestone_60 || 'Build momentum'}
TIMELINE: ${goal.timeline}
PHASE COMPLETED: ${goal.phase1_completed ? 'Phase 1 ✓' : ''} ${goal.phase2_completed ? 'Phase 2 ✓' : ''} ${goal.phase3_completed ? 'Phase 3 ✓' : ''}
COACH SUMMARY: ${goal.coach_summary || 'No summary yet'}

${yesterdayContext}

RECENT CHECK-INS:
${recentCheckinContext}

RECENT COACHING:
${coachContext}

Generate TODAY's specific task. Rules:
- ONE clear, actionable task that takes 30-90 minutes max
- Must directly advance "${goal.title}"
- If yesterday's task was NOT completed, make today's task easier/simpler version of it first
- If yesterday WAS completed and went well, increase difficulty slightly
- Reference the actual goal — not generic advice
- No markdown, no asterisks, no bullet symbols
- Format: Start with a direct action verb. Be specific with numbers/times/outcomes.
- End with: "Why this matters today: [1 sentence connecting to their goal]"

Output ONLY the task text. No preamble, no "Today's task:", just the task itself.`

  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }]
  })

  const rawTask = res.content[0].type === 'text' ? res.content[0].text : ''
  const task = stripMarkdown(rawTask).trim()

  const { data: newTask } = await supabase.from('daily_tasks').insert({
    user_id: user.id,
    goal_id: goalId,
    task_date: today,
    task,
    context: yesterdayContext,
  }).select().single()

  return NextResponse.json({ task: newTask })
}