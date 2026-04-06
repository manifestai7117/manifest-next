import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import CheckInButton from '@/components/dashboard/CheckInButton'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const { data: goals } = await supabase.from('goals').select('*').eq('user_id', user.id).eq('is_active', true).order('created_at', { ascending: false })
  const activeGoal = goals?.[0] || null

  // Check if already checked in today
  const today = new Date().toISOString().split('T')[0]
  const { data: todayCheckin } = activeGoal
    ? await supabase.from('checkins').select('id').eq('goal_id', activeGoal.id).gte('created_at', `${today}T00:00:00`).single()
    : { data: null }

  const checkedInToday = !!todayCheckin

  // Get last 7 checkins
  const { data: recentCheckins } = activeGoal
    ? await supabase.from('checkins').select('*').eq('goal_id', activeGoal.id).order('created_at', { ascending: false }).limit(7)
    : { data: [] }

  const firstName = profile?.full_name?.split(' ')[0] || 'there'

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

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="fade-up max-w-[900px]">
      <h1 className="font-serif text-[32px] mb-1">{greeting}, {firstName}.</h1>
      <p className="text-[#666] mb-8 text-[14px]">
        {checkedInToday ? `You've checked in today. Streak: ${activeGoal.streak} days 🔥` : "You haven't checked in yet today. Keep the streak alive."}
      </p>

      {/* Check-in banner */}
      {!checkedInToday && (
        <div className="bg-[#111] rounded-2xl p-6 mb-6 flex items-center justify-between">
          <div>
            <p className="font-serif text-[20px] text-white mb-1">Daily check-in</p>
            <p className="text-[13px] text-white/50">Did you work toward your goal today?</p>
          </div>
          <CheckInButton goalId={activeGoal.id} />
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { val: `${activeGoal.streak}`, label: 'Day streak 🔥' },
          { val: `${activeGoal.progress}%`, label: 'Goal progress', progress: activeGoal.progress },
          { val: `${recentCheckins?.length || 0}`, label: 'Check-ins this week' },
          { val: activeGoal.timeline, label: 'Timeline' },
        ].map(({ val, label, progress }) => (
          <div key={label} className="bg-white border border-[#e8e8e8] rounded-2xl p-5">
            <p className="font-serif text-[28px] leading-none mb-1">{val}</p>
            <p className="text-[11px] font-medium text-[#999] uppercase tracking-[.06em]">{label}</p>
            {progress !== undefined && (
              <div className="mt-2 h-1.5 bg-[#f0ede8] rounded-full overflow-hidden">
                <div className="h-full bg-[#b8922a] rounded-full" style={{ width: `${progress}%` }}/>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Goal + coach */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-6">
          <p className="text-[10px] font-medium tracking-[.12em] uppercase text-[#b8922a] mb-3">Current goal</p>
          <p className="font-serif text-[18px] leading-[1.4] mb-4">{activeGoal.title}</p>
          <div className="flex gap-2 flex-wrap">
            <span className="text-[11px] font-medium text-[#b8922a] bg-[#faf3e0] px-2.5 py-1 rounded-full">{activeGoal.timeline}</span>
            <span className="text-[11px] font-medium text-[#666] bg-[#f2f0ec] px-2.5 py-1 rounded-full">{activeGoal.category}</span>
          </div>
        </div>
        <Link href="/dashboard/coach" className="bg-white border border-[#e8e8e8] rounded-2xl p-6 block hover:border-[#d0d0d0] transition-colors group">
          <p className="text-[10px] font-medium tracking-[.12em] uppercase text-[#b8922a] mb-3">Coach message</p>
          <p className="font-serif italic text-[15px] text-[#666] leading-[1.7] line-clamp-3">
            "{activeGoal.coach_opening}"
          </p>
          <p className="text-[12px] text-[#b8922a] mt-3 group-hover:underline">Continue with coach →</p>
        </Link>
      </div>

      {/* Today's action */}
      {activeGoal.today_action && (
        <div className="bg-[#faf3e0] border border-[#b8922a]/20 rounded-2xl p-5">
          <p className="text-[10px] font-medium tracking-[.12em] uppercase text-[#b8922a] mb-2">Today's action</p>
          <p className="text-[14px] text-[#111] leading-[1.65]">{activeGoal.today_action}</p>
        </div>
      )}
    </div>
  )
}
