import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardClient from '@/components/dashboard/DashboardClient'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const { data: goals } = await supabase.from('goals').select('*').eq('user_id', user.id).eq('is_active', true).eq('is_paused', false).order('created_at', { ascending: false })

  if (!goals?.length) {
    const firstName = profile?.full_name?.split(' ')[0] || 'there'
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    return (
      <div className="fade-up">
        <p className="text-[13px] text-[#999] mb-1">{today}</p>
        <h1 className="font-serif text-[32px] mb-2">Welcome, {firstName}.</h1>
        <p className="text-[#666] mb-8">You haven't set a goal yet. Let's change that.</p>
        <Link href="/onboarding" className="inline-flex items-center gap-2 px-6 py-3 bg-[#111] text-white rounded-xl text-[14px] font-medium hover:bg-[#2a2a2a] transition-colors">
          Create my first goal →
        </Link>
      </div>
    )
  }

  const timelineMap: Record<string, number> = {
    '1 week': 7, '2 weeks': 14, '1 month': 30, '6 weeks': 42,
    '2 months': 60, '3 months': 90, '6 months': 180, '1 year': 365, '2 years': 730,
  }

  // Recompute progress — phase completions are the floor (33/66/100%)
  const goalsWithProgress = goals.map((goal: any) => {
    const totalDays = timelineMap[goal.timeline] || 90
    const startDate = new Date(goal.created_at)
    const rawDays = Math.floor((Date.now() - startDate.getTime()) / 86400000)
    const daysPassed = Math.max(0, rawDays, goal.streak || 0)
    const streakBonus = Math.min(20, Math.round(((goal.streak || 0) / Math.max(totalDays, 1)) * 20))
    const timeProgress = Math.min(70, Math.round((daysPassed / totalDays) * 70))
    const timeBased = Math.min(100, timeProgress + streakBonus)
    // Phase completions override time-based calculation
    const phaseFloor = goal.phase3_completed ? 100 : goal.phase2_completed ? 66 : goal.phase1_completed ? 33 : 0
    const computedProgress = Math.max(phaseFloor, timeBased)
    return { ...goal, progress: computedProgress, daysPassed, totalDays }
  })

  const today = new Date().toISOString().split('T')[0]
  const allCheckins: Record<string, any[]> = {}
  const allTodayCheckins: Record<string, boolean> = {}
  const allCoachMsgs: Record<string, string> = {}

  await Promise.all(goalsWithProgress.map(async (goal: any) => {
    const [{ data: todayCheckin }, { data: recent }, { data: coachMsgs }] = await Promise.all([
      supabase.from('checkins').select('id').eq('goal_id', goal.id).gte('created_at', `${today}T00:00:00`).maybeSingle(),
      supabase.from('checkins').select('mood').eq('goal_id', goal.id).order('created_at', { ascending: false }).limit(7),
      supabase.from('coach_messages').select('role,content').eq('goal_id', goal.id).order('created_at', { ascending: false }).limit(2),
    ])
    allTodayCheckins[goal.id] = !!todayCheckin
    allCheckins[goal.id] = recent || []
    const lastCoach = coachMsgs?.find((m: any) => m.role === 'assistant')
    allCoachMsgs[goal.id] = lastCoach?.content?.slice(0, 200) || goal.coach_opening || ''
  }))

  const { data: existingRating } = await supabase.from('app_ratings').select('id').eq('user_id', user.id).maybeSingle()

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = profile?.full_name?.split(' ')[0] || 'there'
  const todayDate = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 86400000)

  // Accountability nudges - check for inactivity
  const nudges: string[] = []
  for (const goal of goalsWithProgress) {
    if (!allTodayCheckins[goal.id] && goal.streak > 2) {
      nudges.push(`Your ${goal.streak}-day streak on "${goal.title}" is at risk — check in today.`)
    }
  }

  return (
    <DashboardClient
      goals={goalsWithProgress}
      profile={profile}
      allTodayCheckins={allTodayCheckins}
      allCheckins={allCheckins}
      allCoachMsgs={allCoachMsgs}
      existingRating={!!existingRating}
      userId={user.id}
      greeting={greeting}
      firstName={firstName}
      dayOfYear={dayOfYear}
      todayDate={todayDate}
      nudges={nudges}
    />
  )
}