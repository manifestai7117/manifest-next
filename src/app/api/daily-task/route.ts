import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const serviceSupabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function strip(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1')
    .replace(/#{1,6}\s/g, '').replace(/`(.*?)`/g, '$1')
    .replace(/^\s*[-*+]\s/gm, '').replace(/^\s*\d+\.\s/gm, '')
    .trim()
}

function getPhaseLabel(goal: any): string {
  if (goal.phase3_completed) return 'Phase 3 — Mastery (complete)'
  if (goal.phase2_completed) return 'Phase 3 — Push phase'
  if (goal.phase1_completed) return 'Phase 2 — Building momentum'
  return 'Phase 1 — Building foundations'
}

// ─── GET: return current daily state ────────────────────────────
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const goalId = searchParams.get('goalId')
  if (!goalId) return NextResponse.json({ error: 'Missing goalId' }, { status: 400 })

  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

  const [
    { data: goal },
    { data: todayTask },
    { data: yesterdayTask },
    { data: todayCheckin },
    { data: latestStory },
  ] = await Promise.all([
    supabase.from('goals').select('*').eq('id', goalId).eq('user_id', user.id).single(),
    supabase.from('daily_tasks').select('*').eq('goal_id', goalId).eq('user_id', user.id).eq('task_date', today).maybeSingle(),
    supabase.from('daily_tasks').select('*').eq('goal_id', goalId).eq('user_id', user.id).eq('task_date', yesterday).maybeSingle(),
    supabase.from('checkins').select('id, note, mood').eq('goal_id', goalId).eq('user_id', user.id).gte('created_at', `${today}T00:00:00`).maybeSingle(),
    supabase.from('story_updates').select('story, update_date').eq('goal_id', goalId).eq('user_id', user.id).order('update_date', { ascending: false }).limit(1).maybeSingle(),
  ])

  if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })

  const goalCreatedDate = new Date(goal.created_at).toISOString().split('T')[0]
  const isDay1 = goalCreatedDate === today
  const canUpdateStory = !latestStory || latestStory.update_date < today
  const storyUpdatedToday = latestStory?.update_date === today

  // Determine state
  let state: 'day1_no_task' | 'needs_yesterday_log' | 'has_task' | 'no_task_yet'

  if (isDay1 && !todayTask) {
    state = 'day1_no_task' // Day 1: generate immediately, no log needed
  } else if (!isDay1 && yesterdayTask && yesterdayTask.yesterday_done === null && !todayTask) {
    state = 'needs_yesterday_log' // Must log yesterday before getting today
  } else if (todayTask) {
    state = 'has_task'
  } else {
    state = 'no_task_yet' // Shouldn't normally happen
  }

  return NextResponse.json({
    state,
    todayTask,
    yesterdayTask,
    checkedInToday: !!todayCheckin,
    todayCheckin,
    isDay1,
    canUpdateStory,
    storyUpdatedToday,
    currentStory: latestStory?.story || goal.current_story || null,
    goal: { title: goal.title, streak: goal.streak, progress: goal.progress, phase: getPhaseLabel(goal) },
  })
}

// ─── POST: log yesterday + generate today / update story ─────────
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { goalId, action } = body
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

  // ── Action: update current story ────────────────────────────────
  if (action === 'update_story') {
    const { story } = body
    if (!story?.trim()) return NextResponse.json({ error: 'Story is empty' }, { status: 400 })

    // Upsert today's story update
    await serviceSupabase.from('story_updates').upsert({
      user_id: user.id,
      goal_id: goalId,
      story: story.trim(),
      update_date: today,
    }, { onConflict: 'user_id,goal_id,update_date' })

    // Also save to goal for quick access
    await serviceSupabase.from('goals').update({
      current_story: story.trim(),
      story_updated_at: today,
    }).eq('id', goalId).eq('user_id', user.id)

    return NextResponse.json({ success: true })
  }

  // ── Action: check-in mood (day 1 only, no task log) ─────────────
  if (action === 'checkin_mood') {
    const { mood, note } = body
    const { data: existing } = await supabase.from('checkins').select('id')
      .eq('goal_id', goalId).eq('user_id', user.id)
      .gte('created_at', `${today}T00:00:00`).maybeSingle()
    if (existing) return NextResponse.json({ error: 'Already checked in' }, { status: 400 })

    const { data: goal } = await supabase.from('goals').select('streak, last_checkin, timeline, progress').eq('id', goalId).single()
    if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })

    await supabase.from('checkins').insert({ goal_id: goalId, user_id: user.id, mood, note: note || null })

    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    const newStreak = goal.last_checkin === yesterdayStr ? (goal.streak || 0) + 1 : 1
    await supabase.from('goals').update({ streak: newStreak, last_checkin: today }).eq('id', goalId)

    return NextResponse.json({ success: true, streak: newStreak })
  }

  // ── Action: log yesterday + generate today ───────────────────────
  if (action === 'log_and_generate') {
    const { yesterdayDone, yesterdayNote, yesterdayTaskId } = body

    // 1. Save yesterday's log onto the yesterday task row
    if (yesterdayTaskId) {
      await serviceSupabase.from('daily_tasks').update({
        yesterday_done: yesterdayDone,
        yesterday_note: yesterdayNote?.trim() || null,
        completed: yesterdayDone,
        completion_note: yesterdayNote?.trim() || null,
      }).eq('id', yesterdayTaskId).eq('user_id', user.id)
    }

    // 2. Also save as a checkin
    const { data: existingCheckin } = await supabase.from('checkins').select('id')
      .eq('goal_id', goalId).eq('user_id', user.id)
      .gte('created_at', `${today}T00:00:00`).maybeSingle()

    const { data: goal } = await supabase.from('goals').select('*').eq('id', goalId).eq('user_id', user.id).single()
    if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })

    if (!existingCheckin) {
      const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0]
      const newStreak = goal.last_checkin === yesterdayStr ? (goal.streak || 0) + 1 : 1
      await supabase.from('checkins').insert({
        goal_id: goalId, user_id: user.id,
        mood: yesterdayDone ? 4 : 2,
        note: yesterdayNote?.trim() || (yesterdayDone ? 'Completed yesterday\'s task' : 'Did not complete yesterday\'s task'),
      })
      await supabase.from('goals').update({ streak: newStreak, last_checkin: today }).eq('id', goalId)
    }

    // 3. Check today's task doesn't already exist
    const { data: existing } = await supabase.from('daily_tasks').select('*')
      .eq('goal_id', goalId).eq('user_id', user.id).eq('task_date', today).maybeSingle()
    if (existing) return NextResponse.json({ task: existing })

    // 4. Generate today's task
    return generateTask({ supabase, userId: user.id, goal, goalId, today, yesterdayDone, yesterdayNote, isDay1: false })
  }

  // ── Action: generate day 1 task ──────────────────────────────────
  if (action === 'generate_day1') {
    const { data: existing } = await supabase.from('daily_tasks').select('*')
      .eq('goal_id', goalId).eq('user_id', user.id).eq('task_date', today).maybeSingle()
    if (existing) return NextResponse.json({ task: existing })

    const { data: goal } = await supabase.from('goals').select('*').eq('id', goalId).eq('user_id', user.id).single()
    if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })

    return generateTask({ supabase, userId: user.id, goal, goalId, today, yesterdayDone: null, yesterdayNote: null, isDay1: true })
  }

  // ── Action: regenerate today's task after story update ───────────
  if (action === 'regenerate_after_story') {
    const { data: goal } = await supabase.from('goals').select('*').eq('id', goalId).eq('user_id', user.id).single()
    if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })

    // Delete today's task and regenerate
    await serviceSupabase.from('daily_tasks').delete()
      .eq('goal_id', goalId).eq('user_id', user.id).eq('task_date', today)

    const { data: yesterdayTask } = await supabase.from('daily_tasks').select('*')
      .eq('goal_id', goalId).eq('user_id', user.id).eq('task_date', yesterday).maybeSingle()

    return generateTask({
      supabase, userId: user.id, goal, goalId, today,
      yesterdayDone: yesterdayTask?.yesterday_done ?? null,
      yesterdayNote: yesterdayTask?.yesterday_note ?? null,
      isDay1: false,
      forceStoryUpdate: true,
    })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

// ─── Task generation ─────────────────────────────────────────────
async function generateTask({ supabase, userId, goal, goalId, today, yesterdayDone, yesterdayNote, isDay1, forceStoryUpdate = false }: any) {
  // Get recent context
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  const [{ data: recentTasks }, { data: latestStory }, { data: recentCheckins }] = await Promise.all([
    supabase.from('daily_tasks').select('task_date, task, yesterday_done, yesterday_note').eq('goal_id', goalId).order('task_date', { ascending: false }).limit(7),
    supabase.from('story_updates').select('story, update_date').eq('goal_id', goalId).eq('user_id', userId).order('update_date', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('checkins').select('mood, note, created_at').eq('goal_id', goalId).order('created_at', { ascending: false }).limit(5),
  ])

  const phase = getPhaseLabel(goal)
  const story = latestStory?.story || goal.current_story || null
  const dayNum = (recentTasks?.length || 0) + 1

  // Build context string
  const recentTaskHistory = recentTasks?.slice(0, 5).map((t: any) =>
    `Day task (${t.task_date}): "${t.task}" — ${t.yesterday_done === true ? `Done: "${t.yesterday_note}"` : t.yesterday_done === false ? `Not done: "${t.yesterday_note}"` : 'Not logged'}`
  ).join('\n') || 'No previous tasks'

  const yesterdayContext = isDay1
    ? 'This is Day 1 — no previous task.'
    : yesterdayDone === true
      ? `Yesterday's task: COMPLETED. User said: "${yesterdayNote || 'Done'}"`
      : yesterdayDone === false
        ? `Yesterday's task: NOT COMPLETED. User said: "${yesterdayNote || 'Did not do it"}"`
        : 'No yesterday log available.'

  const moodHistory = recentCheckins?.map((c: any) => `mood ${c.mood}/5${c.note ? ` — "${c.note}"` : ''}`).join(', ') || 'no data'

  const prompt = `You are a personal coach generating one specific, achievable daily task.

GOAL: "${goal.title}"
WHY THEY WANT THIS: ${goal.why || 'not specified'}
TIMELINE: ${goal.timeline} | DAY: ${dayNum} | STREAK: ${goal.streak || 0} days
PHASE: ${phase}
PHASE 1 TARGET: ${goal.milestone_30 || 'Build foundation habits'}
PHASE 2 TARGET: ${goal.milestone_60 || 'Build momentum and consistency'}
CURRENT STORY: ${story ? `"${story}"` : 'No story update today'}
RECENT MOODS: ${moodHistory}

YESTERDAY:
${yesterdayContext}

RECENT TASK HISTORY:
${recentTaskHistory}

${forceStoryUpdate ? 'NOTE: The user just updated their current story. Factor it into today\'s task.\n' : ''}

YOUR JOB: Generate ONE task for today that:
${isDay1 ? '- Is a FIRST STEP — achievable, specific, not overwhelming. This is Day 1.' : ''}
${yesterdayDone === false ? '- Accounts for yesterday\'s miss. Make today simpler or address the blocker directly.' : ''}
${yesterdayDone === true ? '- Builds on yesterday\'s success. Slightly more challenging or progresses to the next step.' : ''}
- Directly advances "${goal.title}"
- Takes 30-90 minutes max
- Is specific (include numbers, times, locations, names where relevant)
- If the goal involves physical activity and recent tasks show 3+ consecutive physical days, assign recovery/rest instead
- If current story suggests a constraint (travelling, busy week, sick), adapt the task accordingly
- Ends with exactly one sentence starting with "Why this matters today:"
- Plain text only — no bullet points, no asterisks, no markdown

Output ONLY the task text. Start with an action verb.`

  const res = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 250,
    messages: [{ role: 'user', content: prompt }],
  })

  const rawTask = res.content[0].type === 'text' ? res.content[0].text : ''
  const task = strip(rawTask).trim()

  const { data: newTask } = await serviceSupabase.from('daily_tasks').insert({
    user_id: userId,
    goal_id: goalId,
    task_date: today,
    task,
    day_number: dayNum,
    story_context: story || null,
    yesterday_done: isDay1 ? null : yesterdayDone,
    yesterday_note: isDay1 ? null : (yesterdayNote || null),
  }).select().single()

  return NextResponse.json({ task: newTask })
}