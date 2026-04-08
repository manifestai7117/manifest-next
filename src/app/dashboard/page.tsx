import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CheckInButton from '@/components/dashboard/CheckInButton'
import DashboardClient from '@/components/dashboard/DashboardClient'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const { data: goals } = await supabase.from('goals').select('*').eq('user_id', user.id).eq('is_active', true).order('created_at', { ascending: false })

  if (!goals?.length) {
    const firstName = profile?.full_name?.split(' ')[0] || 'there'
    return (
      <div className="fade-up">
        <h1 className="font-serif text-[32px] mb-2">Welcome, {firstName}.</h1>
        <p className="text-[#666] mb-8">You haven't set a goal yet. Let's change that.</p>
        <Link href="/onboarding" className="inline-flex items-center gap-2 px-6 py-3 bg-[#111] text-white rounded-xl text-[14px] font-medium hover:bg-[#2a2a2a] transition-colors">
          Create my first goal →
        </Link>
      </div>
    )
  }

  // Compute progress for all goals
  const timelineMap: Record<string, number> = {
    '1 week': 7, '2 weeks': 14, '1 month': 30, '6 weeks': 42,
    '2 months': 60, '3 months': 90, '6 months': 180, '1 year': 365, '2 years': 730,
  }

  const goalsWithProgress = await Promise.all(goals.map(async (goal: any) => {
    const totalDays = timelineMap[goal.timeline] || 90
    const startDate = new Date(goal.created_at)
    const daysPassed = Math.max(0, Math.floor((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24)))
    const timeProgress = Math.min(100, Math.round((daysPassed / totalDays) * 100))
    let phaseBonus = 0
    if (goal.phase1_completed) phaseBonus += 25
    if (goal.phase2_completed) phaseBonus += 25
    if (goal.phase3_completed) phaseBonus += 25
    const streakBonus = Math.min(25, Math.round((goal.streak / totalDays) * 25))
    const computedProgress = Math.min(100, Math.round((timeProgress * 0.4) + phaseBonus + streakBonus))
    if (computedProgress !== goal.progress) {
      await supabase.from('goals').update({ progress: computedProgress }).eq('id', goal.id)
    }
    return { ...goal, progress: computedProgress }
  }))

  // Check ratings
  const { data: existingRating } = await supabase.from('app_ratings').select('id').eq('user_id', user.id).maybeSingle()

  // Get checkins + coach messages for all goals
  const today = new Date().toISOString().split('T')[0]
  const allCheckins: Record<string, any[]> = {}
  const allTodayCheckins: Record<string, boolean> = {}
  const allCoachMsgs: Record<string, string> = {}

  await Promise.all(goalsWithProgress.map(async (goal: any) => {
    const [{ data: todayCheckin }, { data: recent }, { data: coachMsgs }] = await Promise.all([
      supabase.from('checkins').select('id').eq('goal_id', goal.id).gte('created_at', `${today}T00:00:00`).maybeSingle(),
      supabase.from('checkins').select('mood').eq('goal_id', goal.id).order('created_at', { ascending: false }).limit(7),
      supabase.from('coach_messages').select('role,content').eq('goal_id', goal.id).order('created_at', { ascending: false }).limit(6),
    ])
    allTodayCheckins[goal.id] = !!todayCheckin
    allCheckins[goal.id] = recent || []
    const lastCoach = coachMsgs?.find((m: any) => m.role === 'assistant')
    allCoachMsgs[goal.id] = lastCoach?.content?.slice(0, 150) || goal.coach_opening || ''
  }))

  // Daily rotating affirmation — picks different line each day
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = profile?.full_name?.split(' ')[0] || 'there'

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
    />
  )
}
