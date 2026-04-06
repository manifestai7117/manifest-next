import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CheckInButton from '@/components/dashboard/CheckInButton'

export default async function StreakPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: goals } = await supabase.from('goals').select('*').eq('user_id', user.id).eq('is_active', true).order('created_at', { ascending: false }).limit(1)
  const goal = goals?.[0]

  const today = new Date().toISOString().split('T')[0]
  const { data: todayCheckin } = goal
    ? await supabase.from('checkins').select('id').eq('goal_id', goal.id).gte('created_at', `${today}T00:00:00`).single()
    : { data: null }

  // Get last 28 checkins
  const { data: checkins } = goal
    ? await supabase.from('checkins').select('created_at, mood').eq('goal_id', goal.id).order('created_at', { ascending: false }).limit(28)
    : { data: [] }

  const checkinDates = new Set(checkins?.map(c => c.created_at.split('T')[0]) || [])

  // Build 28-day grid
  const days = Array.from({ length: 28 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (27 - i))
    const dateStr = d.toISOString().split('T')[0]
    const isToday = dateStr === today
    const done = checkinDates.has(dateStr)
    const future = d > new Date()
    return { dateStr, day: d.getDate(), isToday, done, future }
  })

  const completionRate = checkins?.length ? Math.round((checkins.length / 28) * 100) : 0

  return (
    <div className="fade-up max-w-[700px]">
      <h1 className="font-serif text-[32px] mb-1">Streak tracker</h1>
      <p className="text-[14px] text-[#666] mb-8">
        {goal ? `Tracking: "${goal.title}"` : 'Set up a goal to start tracking'}
      </p>

      {goal ? (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { val: `${goal.streak}`, label: 'Current streak', emoji: '🔥' },
              { val: `${goal.longest_streak || goal.streak}`, label: 'Longest streak', emoji: '🏆' },
              { val: `${completionRate}%`, label: '28-day rate', emoji: '📊' },
            ].map(s => (
              <div key={s.label} className="bg-white border border-[#e8e8e8] rounded-2xl p-5 text-center">
                <p className="text-[28px] mb-0.5">{s.emoji}</p>
                <p className="font-serif text-[32px] leading-none mb-1">{s.val}</p>
                <p className="text-[11px] font-medium text-[#999] uppercase tracking-[.06em]">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Calendar */}
          <div className="bg-white border border-[#e8e8e8] rounded-2xl p-6 mb-5">
            <p className="font-medium mb-4 text-[15px]">Last 28 days</p>
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['S','M','T','W','T','F','S'].map((d,i) => (
                <div key={i} className="text-center text-[11px] font-medium text-[#999]">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {days.map(d => (
                <div key={d.dateStr} className={`aspect-square rounded-lg flex items-center justify-center text-[12px] font-medium ${d.isToday ? 'streak-today' : d.future ? 'streak-future' : d.done ? 'streak-done' : 'streak-missed'}`} title={d.dateStr}>
                  {d.day}
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-4 flex-wrap">
              {[['bg-[#b8922a]','Done'],['bg-[#111]','Today'],['bg-[#f2f0ec]','Missed'],['bg-[#f8f7f5]','Future']].map(([c,l])=>(
                <div key={l} className="flex items-center gap-1.5 text-[12px] text-[#666]">
                  <div className={`w-3 h-3 rounded-sm ${c}`}/>
                  {l}
                </div>
              ))}
            </div>
          </div>

          {/* Mood chart from recent checkins */}
          {checkins && checkins.length > 0 && (
            <div className="bg-white border border-[#e8e8e8] rounded-2xl p-6 mb-5">
              <p className="font-medium mb-4 text-[15px]">Recent mood</p>
              <div className="flex gap-2 items-end h-16">
                {checkins.slice(0,14).reverse().map((c,i) => (
                  <div key={i} className="flex-1 bg-[#b8922a]/20 rounded-sm relative" style={{ height: `${(c.mood/5)*100}%` }}>
                    <div className="absolute bottom-0 left-0 right-0 bg-[#b8922a] rounded-sm" style={{ height: `${(c.mood/5)*100}%` }}/>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-[#999] mt-2">Last {Math.min(checkins.length,14)} check-ins</p>
            </div>
          )}

          {!todayCheckin && (
            <div className="bg-[#111] rounded-2xl p-5 flex items-center justify-between">
              <div>
                <p className="font-serif text-[18px] text-white mb-1">Log today</p>
                <p className="text-[13px] text-white/50">Keep your streak alive</p>
              </div>
              <CheckInButton goalId={goal.id}/>
            </div>
          )}
          {todayCheckin && (
            <div className="bg-[#f8f7f5] border border-[#e8e8e8] rounded-2xl p-5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#b8922a]/20 flex items-center justify-center text-[#b8922a] text-[18px]">✓</div>
              <div>
                <p className="font-medium text-[14px]">Checked in today!</p>
                <p className="text-[12px] text-[#666]">Come back tomorrow to keep the streak going.</p>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-8 text-center">
          <p className="text-[#666] mb-4">No active goal found</p>
          <a href="/onboarding" className="inline-block px-5 py-2.5 bg-[#111] text-white rounded-xl text-[13px] font-medium hover:bg-[#2a2a2a] transition-colors">Create a goal →</a>
        </div>
      )}
    </div>
  )
}
