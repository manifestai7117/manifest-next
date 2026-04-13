'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import CheckInButton from '@/components/dashboard/CheckInButton'

export default function StreakPage() {
  const supabase = createClient()
  const [goals, setGoals] = useState<any[]>([])
  const [goal, setGoal] = useState<any>(null)
  const [checkins, setCheckins] = useState<any[]>([])
  const [todayDone, setTodayDone] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: gs } = await supabase.from('goals').select('*').eq('user_id', user.id).eq('is_active', true).order('created_at', { ascending: false })
      setGoals(gs || [])
      const savedId = localStorage.getItem('selectedGoalId')
      const g = gs?.find((x: any) => x.id === savedId) || gs?.[0] || null
      setGoal(g)
      if (g) await loadCheckins(g.id)
      setLoading(false)
    }
    load()
  }, [])

  const loadCheckins = async (goalId: string) => {
    const today = new Date().toISOString().split('T')[0]
    const { data: c } = await supabase.from('checkins').select('created_at, mood').eq('goal_id', goalId).order('created_at', { ascending: false }).limit(28)
    setCheckins(c || [])
    setTodayDone(!!(c || []).find((x: any) => x.created_at.startsWith(today)))
  }

  const switchGoal = async (g: any) => {
    setGoal(g)
    localStorage.setItem('selectedGoalId', g.id)
    await loadCheckins(g.id)
  }

  if (loading) return <div className="text-[#999] text-[14px]">Loading...</div>
  if (!goal) return (
    <div className="fade-up">
      <h1 className="font-serif text-[32px] mb-4">Streak tracker</h1>
      <p className="text-[#666] text-[14px]">No active goal yet.</p>
    </div>
  )

  const today = new Date().toISOString().split('T')[0]
  const checkinDates = new Set(checkins.map((c: any) => c.created_at.split('T')[0]))
  const days = Array.from({ length: 28 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (27 - i))
    const dateStr = d.toISOString().split('T')[0]
    return { dateStr, day: d.getDate(), isToday: dateStr === today, done: checkinDates.has(dateStr), future: d > new Date() }
  })
  const completionRate = checkins.length ? Math.round((checkins.length / 28) * 100) : 0
  const avgMood = checkins.length ? Math.round(checkins.reduce((a: number, c: any) => a + (c.mood || 3), 0) / checkins.length) : 0
  const moodEmoji = ['', '😞', '😕', '😐', '🙂', '😄'][avgMood] || '😐'

  return (
    <div className="fade-up max-w-[700px]">
      <h1 className="font-serif text-[32px] mb-1">Streak tracker</h1>
      <p className="text-[14px] text-[#666] mb-5">Your check-in history and consistency</p>

      {goals.length > 1 && (
        <div className="flex gap-2 mb-5 flex-wrap">
          {goals.map(g => (
            <button key={g.id} onClick={() => switchGoal(g)}
              className={`px-4 py-2 rounded-full text-[13px] border transition-all ${goal?.id === g.id ? 'bg-[#111] text-white border-[#111]' : 'bg-white text-[#666] border-[#e8e8e8] hover:border-[#d0d0d0]'}`}>
              {(g.display_title || g.title).slice(0, 28)}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { val: `${goal.streak}`, label: 'Current streak 🔥' },
          { val: `${goal.longest_streak || goal.streak}`, label: 'Longest streak' },
          { val: `${completionRate}%`, label: '28-day rate' },
          { val: moodEmoji, label: `Avg mood (${avgMood}/5)` },
        ].map(({ val, label }) => (
          <div key={label} className="bg-white border border-[#e8e8e8] rounded-2xl p-5">
            <p className="font-serif text-[28px] leading-none mb-1">{val}</p>
            <p className="text-[11px] font-medium text-[#999] uppercase tracking-[.06em]">{label}</p>
          </div>
        ))}
      </div>

      {!todayDone && (
        <div className="bg-[#111] rounded-2xl p-5 mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="font-serif text-[18px] text-white mb-1">Check in today</p>
            <p className="text-[13px] text-white/50">Keep your streak alive for "{goal.title}"</p>
          </div>
          <CheckInButton goalId={goal.id} />
        </div>
      )}

      <div className="bg-white border border-[#e8e8e8] rounded-2xl p-6 mb-4">
        <p className="font-medium text-[14px] mb-4">Last 28 days</p>
        <div className="grid grid-cols-7 gap-2">
          {['M','T','W','T','F','S','S'].map((d, i) => (
            <p key={i} className="text-[10px] text-[#999] text-center font-medium">{d}</p>
          ))}
          {days.map(({ day, isToday, done, future, dateStr }) => (
            <div key={dateStr}
              className={`aspect-square rounded-lg flex items-center justify-center text-[12px] font-medium transition-all
                ${isToday ? 'ring-2 ring-[#b8922a]' : ''}
                ${done ? 'bg-[#b8922a] text-white' : future ? 'bg-[#f8f7f5] text-[#ccc]' : 'bg-[#f0ede8] text-[#999]'}`}>
              {done ? '✓' : day}
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-4 text-[11px] text-[#999]">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#b8922a] inline-block"/>Checked in</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#f0ede8] inline-block"/>Missed</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-2 border-[#b8922a] inline-block"/>Today</span>
        </div>
      </div>

      <div className="bg-[#111] rounded-2xl p-6">
        <p className="text-[10px] font-medium tracking-[.12em] uppercase text-white/30 mb-3">Your affirmation</p>
        <p className="font-serif italic text-[18px] text-white/85 leading-[1.6]">"{goal.affirmation}"</p>
      </div>
    </div>
  )
}
