'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

export default function StreakPage() {
  const supabase = createClient()
  const [goals, setGoals] = useState<any[]>([])
  const [selectedGoal, setSelectedGoal] = useState<any>(null)
  const [checkins, setCheckins] = useState<any[]>([])
  const [checkedInToday, setCheckedInToday] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: gs } = await supabase.from('goals').select('*').eq('user_id', user.id).eq('is_active', true).order('created_at', { ascending: false })
      setGoals(gs || [])
      if (gs?.length) loadGoalStreak(gs[0])
      setLoading(false)
    }
    load()
  }, [])

  const loadGoalStreak = async (goal: any) => {
    setSelectedGoal(goal)
    const today = new Date().toISOString().split('T')[0]
    const [checkinsRes, todayRes] = await Promise.all([
      supabase.from('checkins').select('created_at, mood').eq('goal_id', goal.id).order('created_at', { ascending: false }).limit(28),
      supabase.from('checkins').select('id').eq('goal_id', goal.id).gte('created_at', `${today}T00:00:00`).single(),
    ])
    setCheckins(checkinsRes.data || [])
    setCheckedInToday(!!todayRes.data)
  }

  const today = new Date().toISOString().split('T')[0]
  const checkinDates = new Set(checkins.map(c => c.created_at.split('T')[0]))
  const days = Array.from({ length: 28 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (27 - i))
    const ds = d.toISOString().split('T')[0]
    return { ds, day: d.getDate(), isToday: ds === today, done: checkinDates.has(ds), future: d > new Date() }
  })
  const completionRate = checkins.length ? Math.round((checkins.length / 28) * 100) : 0

  if (loading) return <div className="text-[#999] text-[14px]">Loading...</div>

  return (
    <div className="fade-up max-w-[700px]">
      <h1 className="font-serif text-[32px] mb-1">Streak tracker</h1>
      <p className="text-[14px] text-[#666] mb-6">Don't break the chain.</p>

      {/* Goal tabs */}
      {goals.length > 1 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          {goals.map(g => (
            <button key={g.id} onClick={() => loadGoalStreak(g)}
              className={`px-4 py-2 rounded-full text-[13px] border transition-all ${selectedGoal?.id === g.id ? 'bg-[#111] text-white border-[#111]' : 'bg-white text-[#666] border-[#e8e8e8] hover:border-[#d0d0d0]'}`}>
              {g.title.length > 28 ? g.title.slice(0, 28) + '…' : g.title}
            </button>
          ))}
        </div>
      )}

      {selectedGoal ? (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-5">
            {[
              { val: `${selectedGoal.streak}`, label: 'Current streak', emoji: '🔥' },
              { val: `${selectedGoal.longest_streak || selectedGoal.streak}`, label: 'Longest streak', emoji: '🏆' },
              { val: `${completionRate}%`, label: '28-day rate', emoji: '📊' },
            ].map(s => (
              <div key={s.label} className="bg-white border border-[#e8e8e8] rounded-2xl p-5 text-center">
                <p className="text-[24px] mb-1">{s.emoji}</p>
                <p className="font-serif text-[32px] leading-none mb-1">{s.val}</p>
                <p className="text-[11px] font-medium text-[#999] uppercase tracking-[.06em]">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Affirmation for this goal */}
          <div className="bg-[#111] rounded-2xl p-5 mb-5">
            <p className="text-[10px] font-medium tracking-[.1em] uppercase text-white/30 mb-2">Affirmation for this goal</p>
            <p className="font-serif italic text-[16px] text-white/85 leading-[1.65]">"{selectedGoal.affirmation}"</p>
          </div>

          {/* Calendar */}
          <div className="bg-white border border-[#e8e8e8] rounded-2xl p-6 mb-5">
            <p className="font-medium mb-4 text-[15px]">Last 28 days — {selectedGoal.title.slice(0, 40)}</p>
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <div key={i} className="text-center text-[11px] font-medium text-[#999]">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {days.map(d => (
                <div key={d.ds} title={d.ds}
                  className={`aspect-square rounded-lg flex items-center justify-center text-[12px] font-medium ${d.isToday ? 'streak-today' : d.future ? 'streak-future' : d.done ? 'streak-done' : 'streak-missed'}`}>
                  {d.day}
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-4 flex-wrap">
              {[['bg-[#b8922a]', 'Done'], ['bg-[#111]', 'Today'], ['bg-[#f2f0ec]', 'Missed'], ['bg-[#f8f7f5]', 'Future']].map(([c, l]) => (
                <div key={l} className="flex items-center gap-1.5 text-[12px] text-[#666]">
                  <div className={`w-3 h-3 rounded-sm ${c}`} />{l}
                </div>
              ))}
            </div>
          </div>

          {/* Mood chart */}
          {checkins.length > 0 && (
            <div className="bg-white border border-[#e8e8e8] rounded-2xl p-6 mb-5">
              <p className="font-medium mb-4 text-[15px]">Mood over time</p>
              <div className="flex gap-1.5 items-end h-16">
                {checkins.slice(0, 14).reverse().map((c, i) => (
                  <div key={i} className="flex-1 bg-[#faf3e0] rounded-sm relative overflow-hidden" style={{ height: `${(c.mood / 5) * 100}%`, minHeight: 4 }}>
                    <div className="absolute bottom-0 left-0 right-0 bg-[#b8922a] rounded-sm" style={{ height: `${(c.mood / 5) * 100}%` }} />
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-[#999] mt-2">Last {Math.min(checkins.length, 14)} check-ins</p>
            </div>
          )}

          {/* Check in CTA */}
          {!checkedInToday ? (
            <div className="bg-[#111] rounded-2xl p-5 flex items-center justify-between">
              <div>
                <p className="font-serif text-[18px] text-white mb-1">Log today's check-in</p>
                <p className="text-[13px] text-white/50">Keep the streak alive</p>
              </div>
              <a href="/dashboard" className="px-5 py-2.5 bg-[#b8922a] text-white rounded-xl text-[13px] font-medium hover:bg-[#9a7820] transition-colors">
                Log now ✓
              </a>
            </div>
          ) : (
            <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#b8922a]/20 flex items-center justify-center text-[#b8922a] text-[18px]">✓</div>
              <div>
                <p className="font-medium text-[14px]">Checked in today!</p>
                <p className="text-[12px] text-[#666]">Come back tomorrow to extend your streak.</p>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-8 text-center">
          <p className="text-[#666] mb-4">No active goal</p>
          <a href="/onboarding" className="inline-block px-5 py-2.5 bg-[#111] text-white rounded-xl text-[13px] font-medium">Create a goal →</a>
        </div>
      )}
    </div>
  )
}
