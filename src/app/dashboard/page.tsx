import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import CheckInButton from '@/components/dashboard/CheckInButton'
import DashboardClient from '@/components/dashboard/DashboardClient'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const { data: goals } = await supabase.from('goals').select('*').eq('user_id', user.id).eq('is_active', true).order('created_at', { ascending: false })
  const activeGoal = goals?.[0] || null

  const today = new Date().toISOString().split('T')[0]
  const { data: todayCheckin } = activeGoal
    ? await supabase.from('checkins').select('id,mood,note').eq('goal_id', activeGoal.id).gte('created_at', `${today}T00:00:00`).single()
    : { data: null }

  const checkedInToday = !!todayCheckin

  const { data: recentCheckins } = activeGoal
    ? await supabase.from('checkins').select('*').eq('goal_id', activeGoal.id).order('created_at', { ascending: false }).limit(7)
    : { data: [] }

  // Get recent coach messages for dynamic daily message
  const { data: recentCoachMsgs } = activeGoal
    ? await supabase.from('coach_messages').select('role,content').eq('goal_id', activeGoal.id).order('created_at', { ascending: false }).limit(6)
    : { data: [] }

  // Check if user has rated
  const { data: existingRating } = await supabase.from('app_ratings').select('id').eq('user_id', user.id).single().catch(() => ({ data: null }))

  // Compute progress correctly based on timeline + checkins + phases
  let computedProgress = activeGoal?.progress || 0
  if (activeGoal) {
    const timelineMap: Record<string, number> = {
      '1 week': 7, '2 weeks': 14, '1 month': 30, '6 weeks': 42,
      '2 months': 60, '3 months': 90, '6 months': 180, '1 year': 365, '2 years': 730,
    }
    const totalDays = timelineMap[activeGoal.timeline] || 90
    const startDate = new Date(activeGoal.created_at)
    const daysPassed = Math.max(0, Math.floor((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24)))
    const timeProgress = Math.min(100, Math.round((daysPassed / totalDays) * 100))

    // Phase completion bonus
    let phaseBonus = 0
    if (activeGoal.phase1_completed) phaseBonus += 25
    if (activeGoal.phase2_completed) phaseBonus += 25
    if (activeGoal.phase3_completed) phaseBonus += 25

    // Streak bonus
    const streakBonus = Math.min(25, Math.round((activeGoal.streak / totalDays) * 25))
    computedProgress = Math.min(100, Math.round((timeProgress * 0.4) + phaseBonus + streakBonus))

    // Update if different
    if (computedProgress !== activeGoal.progress) {
      await supabase.from('goals').update({ progress: computedProgress }).eq('id', activeGoal.id)
    }
  }

  const firstName = profile?.full_name?.split(' ')[0] || 'there'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  if (!activeGoal) {
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

  // Build dynamic daily message based on recent mood + progress
  const avgMood = recentCheckins?.length
    ? Math.round(recentCheckins.reduce((a: number, c: any) => a + (c.mood || 3), 0) / recentCheckins.length)
    : 3
  const lastCoachMsg = recentCoachMsgs?.find((m: any) => m.role === 'assistant')?.content?.slice(0, 120) || activeGoal.coach_opening

  return (
    <div className="fade-up max-w-[900px]">
      <h1 className="font-serif text-[32px] mb-1">{greeting}, {firstName}.</h1>
      <p className="text-[#666] mb-6 text-[14px]">
        {checkedInToday
          ? `Checked in today ✓ · ${activeGoal.streak} day streak 🔥`
          : "You haven't checked in yet today. Keep the streak alive."}
      </p>

      {/* Check-in banner */}
      {!checkedInToday && (
        <div className="bg-[#111] rounded-2xl p-6 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="font-serif text-[20px] text-white mb-1">Daily check-in</p>
            <p className="text-[13px] text-white/50">Did you work toward "{activeGoal.title}" today?</p>
          </div>
          <CheckInButton goalId={activeGoal.id} />
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { val: `${activeGoal.streak}`, label: 'Day streak 🔥' },
          { val: `${computedProgress}%`, label: 'Goal progress', progress: computedProgress },
          { val: `${recentCheckins?.length || 0}`, label: 'This week' },
          { val: activeGoal.timeline, label: 'Timeline' },
        ].map(({ val, label, progress }) => (
          <div key={label} className="bg-white border border-[#e8e8e8] rounded-2xl p-5">
            <p className="font-serif text-[28px] leading-none mb-1">{val}</p>
            <p className="text-[11px] font-medium text-[#999] uppercase tracking-[.06em]">{label}</p>
            {progress !== undefined && (
              <div className="mt-2 h-1.5 bg-[#f0ede8] rounded-full overflow-hidden">
                <div className="h-full bg-[#b8922a] rounded-full transition-all duration-700" style={{ width: `${progress}%` }}/>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Goal + dynamic coach message */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-6">
          <p className="text-[10px] font-medium tracking-[.12em] uppercase text-[#b8922a] mb-3">Current goal</p>
          <p className="font-serif text-[18px] leading-[1.4] mb-4">{activeGoal.title}</p>
          <div className="flex gap-2 flex-wrap">
            <span className="text-[11px] font-medium text-[#b8922a] bg-[#faf3e0] px-2.5 py-1 rounded-full">{activeGoal.timeline}</span>
            <span className="text-[11px] font-medium text-[#666] bg-[#f2f0ec] px-2.5 py-1 rounded-full">{activeGoal.category}</span>
            {avgMood >= 4 && <span className="text-[11px] font-medium text-green-700 bg-green-50 px-2.5 py-1 rounded-full">High energy 🔥</span>}
            {avgMood <= 2 && <span className="text-[11px] font-medium text-[#999] bg-[#f2f0ec] px-2.5 py-1 rounded-full">Tough week 💪</span>}
          </div>
        </div>
        <Link href="/dashboard/coach" className="bg-white border border-[#e8e8e8] rounded-2xl p-6 block hover:border-[#d0d0d0] transition-colors group">
          <p className="text-[10px] font-medium tracking-[.12em] uppercase text-[#b8922a] mb-3">
            {recentCoachMsgs?.length ? "Your coach said" : "Coach message"}
          </p>
          <p className="font-serif italic text-[15px] text-[#666] leading-[1.7] line-clamp-3">
            "{lastCoachMsg}"
          </p>
          <p className="text-[12px] text-[#b8922a] mt-3 group-hover:underline">Continue with coach →</p>
        </Link>
      </div>

      {/* Today's affirmation — rotates daily based on day of year */}
      <div className="bg-[#faf3e0] border border-[#b8922a]/20 rounded-2xl p-5 mb-4">
        <p className="text-[10px] font-medium tracking-[.12em] uppercase text-[#b8922a] mb-2">Today's affirmation</p>
        <p className="font-serif italic text-[16px] text-[#111] leading-[1.65]">"{activeGoal.affirmation}"</p>
      </div>

      {/* Today's action */}
      {activeGoal.today_action && (
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 mb-4">
          <p className="text-[10px] font-medium tracking-[.12em] uppercase text-[#b8922a] mb-2">Today's action</p>
          <p className="text-[14px] text-[#111] leading-[1.65]">{activeGoal.today_action}</p>
        </div>
      )}

      {/* Rating prompt — show if not yet rated and has been active 3+ days */}
      {!existingRating && activeGoal.streak >= 3 && (
        <DashboardClient userId={user.id} />
      )}
    </div>
  )
}
