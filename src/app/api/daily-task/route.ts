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

  // Get goal creation date
  const { data: goal } = await supabase.from('goals').select('created_at').eq('id', goalId).single()
  const goalCreatedDate = goal?.created_at?.split('T')[0]
  const isFirstDay = goalCreatedDate === today

  // Check if today's task exists
  const { data: todayTask } = await supabase
    .from('daily_tasks')
    .select('*')
    .eq('goal_id', goalId)
    .eq('user_id', user.id)
    .eq('task_date', today)
    .maybeSingle()

  // Only check yesterday's task if this is NOT the first day
  let yesterdayTask = null
  let needsYesterdayLog = false

  if (!isFirstDay) {
    const { data: yt } = await supabase
      .from('daily_tasks')
      .select('*')
      .eq('goal_id', goalId)
      .eq('user_id', user.id)
      .eq('task_date', yesterday)
      .maybeSingle()
    yesterdayTask = yt
    // Only ask about yesterday if it exists and hasn't been logged yet
    needsYesterdayLog = !!(yesterdayTask && yesterdayTask.completed === null)
  }

  // Check if checked in today
  const { data: todayCheckin } = await supabase
    .from('checkins')
    .select('id, note, mood')
    .eq('goal_id', goalId)
    .eq('user_id', user.id)
    .gte('created_at', `${today}T00:00:00`)
    .maybeSingle()

  return NextResponse.json({
    todayTask,
    yesterdayTask,
    checkedInToday: !!todayCheckin,
    todayCheckin,
    needsYesterdayLog,
    isFirstDay,
  })
}

// POST - generate today's task OR log yesterday's completion (yes/no)
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { goalId, action, yesterdayTaskId, yesterdayDone, completionNote } = body
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

  // Action: log yesterday's completion (yes or no)
  if (action === 'log_yesterday' && yesterdayTaskId) {
    const done = !!yesterdayDone
    await supabase.from('daily_tasks').update({
      completed: done,
      completion_note: completionNote?.trim() || (done ? 'Completed' : 'Not completed'),
    }).eq('id', yesterdayTaskId).eq('user_id', user.id)

    if (done && completionNote?.trim()) {
      await supabase.from('goals').update({ last_checkin_note: completionNote.trim() }).eq('id', goalId)
    }

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
  const { data: existing } = await supabase
    .from('daily_tasks')
    .select('*')
    .eq('goal_id', goalId)
    .eq('user_id', user.id)
    .eq('task_date', today)
    .maybeSingle()
  if (existing) return NextResponse.json({ task: existing })

  // Determine if this is day 1
  const goalCreatedDate = goal.created_at?.split('T')[0]
  const isFirstDay = goalCreatedDate === today

  // Get yesterday's task context
  const yesterdayTask = recentTasks?.find(t => t.task_date === yesterday)
  let yesterdayContext = isFirstDay
    ? 'This is the very first day of this goal. There is no yesterday task.'
    : yesterdayTask
      ? `Yesterday's task was: "${yesterdayTask.task}". ${yesterdayTask.completed === true ? `User completed it. Note: "${yesterdayTask.completion_note || 'Done'}"` : yesterdayTask.completed === false ? 'User did NOT complete this task.' : 'User has not yet logged whether they completed it.'}`
      : 'No task was assigned yesterday.'

  const recentCheckinContext = recentCheckins?.length
    ? recentCheckins.slice(0, 5).map((c: any) => `${new Date(c.created_at).toLocaleDateString('en-US', { weekday: 'short' })}: mood ${c.mood}/5${c.note ? ` — "${c.note}"` : ''}`).join('\n')
    : 'No recent check-ins'

  const coachContext = recentCoach?.slice(0, 6).reverse().map((m: any) => `${m.role === 'user' ? 'User' : 'Coach'}: ${m.content.slice(0, 120)}`).join('\n') || 'No recent coaching conversations'

  const firstDayNote = isFirstDay
    ? 'IMPORTANT: This is Day 1 of the goal. Generate a welcoming, achievable first task that builds momentum and confidence. Keep it simple — this is about starting, not perfection.'
    : ''

  const prompt = `You are a strict but caring life coach generating ONE specific daily task.

GOAL: "${goal.title}"
WHY: ${goal.why}
STREAK: ${goal.streak} days
PROGRESS: ${goal.progress}%
PHASE 1: ${goal.milestone_30 || 'Build foundation'}
PHASE 2: ${goal.milestone_60 || 'Build momentum'}
TIMELINE: ${goal.timeline}
PHASE COMPLETED: ${goal.phase1_completed ? 'Phase 1 ✓' : ''} ${goal.phase2_completed ? 'Phase 2 ✓' : ''} ${goal.phase3_completed ? 'Phase 3 ✓' : ''}
CURRENT STORY: ${goal.current_story || 'Not shared yet'}
COACH SUMMARY: ${goal.coach_summary || 'No summary yet'}
${firstDayNote}

${yesterdayContext}

RECENT CHECK-INS:
${recentCheckinContext}

RECENT COACHING:
${coachContext}

Generate TODAY's specific task. Critical smart rules:
- ONE clear, actionable task that takes 30-90 minutes max
- Must directly advance "${goal.title}"
- If this is Day 1: make it welcoming, energising, and achievable
- If yesterday's task was NOT completed, make today's task easier/simpler — address the obstacle
- If yesterday WAS completed and went well, increase difficulty slightly
- REST DAY LOGIC: if goal involves physical activity and they've done it 3+ days in a row, assign a recovery task
- Reference the actual goal — not generic advice
- Plain text only — no markdown, no asterisks, no dashes
- Format: Start with a direct action verb. Be specific with numbers/times.
- End with: "Why this matters today: [1 sentence]"

Output ONLY the task text. No label prefix, just the task itself.`

  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }],
  })

  const rawTask = res.content[0].type === 'text' ? res.content[0].text : ''
  const task = stripMarkdown(rawTask).trim()

  const { data: newTask } = await supabase.from('daily_tasks').insert({
    user_id: user.id,
    goal_id: goalId,
    task_date: today,
    task,
    context: yesterdayContext,
    completed: null, // null = not yet logged
  }).select().single()

  return NextResponse.json({ task: newTask })
}