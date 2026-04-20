import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardHomeClient from '@/components/dashboard/DashboardHomeClient'
import Link from 'next/link'

const TIMELINE_DAYS: Record<string, number> = {
  '1 week': 7, '2 weeks': 14, '1 month': 30, '6 weeks': 42,
  '2 months': 60, '3 months': 90, '6 months': 180, '1 year': 365, '2 years': 730,
}

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const { data: goals } = await supabase
    .from('goals').select('*').eq('user_id', user.id).eq('is_active', true)
    .order('created_at', { ascending: false })

  if (!goals?.length) {
    const firstName = profile?.full_name?.split(' ')[0] || 'there'
    const todayDate = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    return (
      <div className="fade-up">
        <p className="text-[13px] text-[#999] mb-1">{todayDate}</p>
        <h1 className="font-serif text-[32px] mb-2">Welcome, {firstName}.</h1>
        <p className="text-[#666] mb-8">You haven&apos;t set a goal yet. Let&apos;s change that.</p>
        <Link href="/onboarding" className="inline-flex items-center gap-2 px-6 py-3 bg-[#111] text-white rounded-xl text-[14px] font-medium hover:bg-[#2a2a2a] transition-colors">
          Create my first goal &rarr;
        </Link>
      </div>
    )
  }

  const today = new Date().toISOString().split('T')[0]

  // Compute progress for each goal
  const goalsWithProgress = goals.map((goal: any) => {
    const totalDays = TIMELINE_DAYS[goal.timeline] || 90
    const daysPassed = Math.max(0, Math.floor((Date.now() - new Date(goal.created_at).getTime()) / 86400000))
    const phaseFloor = goal.phase3_completed ? 100 : goal.phase2_completed ? 66 : goal.phase1_completed ? 33 : 0
    const timeBased = Math.min(90, Math.round((daysPassed / totalDays) * 70) + Math.min(20, Math.round((goal.streak || 0) / totalDays * 20)))
    const progress = Math.max(goal.progress || 0, phaseFloor, timeBased)
    return { ...goal, progress, daysPassed, totalDays }
  })

  // Fetch today's task + daily state for each goal
  const allDailyState: Record<string, any> = {}
  await Promise.all(goalsWithProgress.map(async (goal: any) => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    const [{ data: todayTask }, { data: yesterdayTask }, { data: todayCheckin }, { data: latestStory }] = await Promise.all([
      supabase.from('daily_tasks').select('*').eq('goal_id', goal.id).eq('user_id', user.id).eq('task_date', today).maybeSingle(),
      supabase.from('daily_tasks').select('*').eq('goal_id', goal.id).eq('user_id', user.id).eq('task_date', yesterday).maybeSingle(),
      supabase.from('checkins').select('id, mood').eq('goal_id', goal.id).eq('user_id', user.id).gte('created_at', `${today}T00:00:00`).maybeSingle(),
      supabase.from('story_updates').select('story, update_date').eq('goal_id', goal.id).eq('user_id', user.id).order('update_date', { ascending: false }).limit(1).maybeSingle(),
    ])

    const goalCreatedDate = new Date(goal.created_at).toISOString().split('T')[0]
    const isDay1 = goalCreatedDate === today
    const canUpdateStory = !latestStory || latestStory.update_date < today

    let state: string
    if (isDay1 && !todayTask) state = 'day1_no_task'
    else if (!isDay1 && yesterdayTask && yesterdayTask.yesterday_done === null && !todayTask) state = 'needs_yesterday_log'
    else if (todayTask) state = 'has_task'
    else state = 'no_task_yet'

    allDailyState[goal.id] = {
      state, todayTask, yesterdayTask,
      checkedInToday: !!todayCheckin,
      isDay1, canUpdateStory,
      currentStory: latestStory?.story || goal.current_story || null,
    }
  }))

  // Coach messages
  const allCoachMsgs: Record<string, string> = {}
  await Promise.all(goalsWithProgress.map(async (goal: any) => {
    const { data: msgs } = await supabase.from('coach_messages').select('role,content').eq('goal_id', goal.id).order('created_at', { ascending: false }).limit(2)
    const last = msgs?.find((m: any) => m.role === 'assistant')
    allCoachMsgs[goal.id] = last?.content?.slice(0, 200) || goal.coach_opening || ''
  }))

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = profile?.full_name?.split(' ')[0] || 'there'
  const todayDate = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <DashboardHomeClient
      goals={goalsWithProgress}
      allDailyState={allDailyState}
      allCoachMsgs={allCoachMsgs}
      profile={profile}
      userId={user.id}
      greeting={greeting}
      firstName={firstName}
      todayDate={todayDate}
    />
  )
}