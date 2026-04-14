'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import CheckInButton from '@/components/dashboard/CheckInButton'

const MOOD_LABEL = ['', 'Struggling', 'Hard day', 'Okay', 'Good', 'Amazing']
const MOOD_EMOJI = ['', '😞', '😕', '😐', '🙂', '😄']
const MOOD_COLOR = ['', 'bg-red-100 text-red-700', 'bg-orange-100 text-orange-700', 'bg-yellow-100 text-yellow-700', 'bg-green-100 text-green-700', 'bg-emerald-100 text-emerald-700']

export default function StreakPage() {
  const supabase = createClient()
  const [goals, setGoals] = useState<any[]>([])
  const [goal, setGoal] = useState<any>(null)
  const [checkins, setCheckins] = useState<any[]>([])
  const [todayDone, setTodayDone] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<any>(null)

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
    const { data: c } = await supabase
      .from('checkins')
      .select('created_at, mood, note')
      .eq('goal_id', goalId)
      .order('created_at', { ascending: false })
      .limit(28)
    setCheckins(c || [])
    setTodayDone(!!(c || []).find((x: any) => x.created_at.startsWith(today)))
  }

  const switchGoal = async (g: any) => {
    setGoal(g)
    setSelectedDay(null)
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
  // Map checkins by date
  const checkinMap: Record<string, any> = {}
  checkins.forEach((c: any) => { checkinMap[c.created_at.split('T')[0]] = c })

  const days = Array.from({ length: 28 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (27 - i))
    const dateStr = d.toISOString().split('T')[0]
    const checkin = checkinMap[dateStr]
    return { dateStr, day: d.getDate(), month: d.toLocaleString('default', { month: 'short' }), isToday: dateStr === today, checkin, future: d > new Date() }
  })

  const completionRate = checkins.length ? Math.round((checkins.length / 28) * 100) : 0
  const avgMood = checkins.length ? Math.round(checkins.reduce((a: number, c: any) => a + (c.mood || 3), 0) / checkins.length) : 0

  return (
    <div className="fade-up max-w-[700px]">
      <h1 className="font-serif text-[32px] mb-1">Streak tracker</h1>
      <p className="text-[14px] text-[#666] mb-5">Your consistency over the last 28 days</p>

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

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { val: `${goal.streak}`, label: 'Current 🔥' },
          { val: `${goal.longest_streak || goal.streak}`, label: 'Best streak' },
          { val: `${completionRate}%`, label: '28-day rate' },
          { val: `${MOOD_EMOJI[avgMood] || '😐'} ${avgMood}/5`, label: 'Avg mood' },
        ].map(({ val, label }) => (
          <div key={label} className="bg-white border border-[#e8e8e8] rounded-2xl p-4">
            <p className="font-serif text-[24px] leading-none mb-1">{val}</p>
            <p className="text-[11px] font-medium text-[#999] uppercase tracking-[.05em]">{label}</p>
          </div>
        ))}
      </div>

      {!todayDone && (
        <div className="bg-[#111] rounded-2xl p-5 mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="font-serif text-[18px] text-white mb-0.5">Check in today</p>
            <p className="text-[13px] text-white/50">Keep your {goal.streak}-day streak alive</p>
          </div>
          <CheckInButton goalId={goal.id} />
        </div>
      )}

      {/* Calendar grid */}
      <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 mb-4">
        <p className="font-medium text-[14px] mb-4">Last 28 days — tap a day for details</p>
        <div className="grid grid-cols-7 gap-1.5">
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
            <p key={d} className="text-[9px] text-[#999] text-center font-medium uppercase">{d}</p>
          ))}
          {days.map(({ day, dateStr, isToday, checkin, future }) => {
            const mood = checkin?.mood || 0
            const bgColor = checkin ? ['', 'bg-red-200', 'bg-orange-200', 'bg-yellow-200', 'bg-green-200', 'bg-emerald-300'][mood] || 'bg-[#b8922a]' : future ? 'bg-[#f8f7f5]' : 'bg-[#f0ede8]'
            return (
              <button key={dateStr} onClick={() => checkin && setSelectedDay(selectedDay?.dateStr === dateStr ? null : { ...checkin, dateStr, day })}
                disabled={!checkin}
                title={checkin ? `${MOOD_LABEL[checkin.mood] || 'Checked in'}${checkin.note ? ': ' + checkin.note : ''}` : ''}
              className={`aspect-square rounded-lg flex flex-col items-center justify-center text-[11px] font-medium transition-all
                  ${bgColor}
                  ${isToday ? 'ring-2 ring-[#b8922a] ring-offset-1' : ''}
                  ${checkin ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}
                  ${selectedDay?.dateStr === dateStr ? 'ring-2 ring-[#111] ring-offset-1' : ''}
                `}>
                <span className={checkin ? 'text-white' : future ? 'text-[#ccc]' : 'text-[#bbb]'}>{day}</span>
                {checkin && <span className="text-[9px]">{MOOD_EMOJI[mood]}</span>}
              </button>
            )
          })}
        </div>
        <div className="flex gap-4 mt-4 text-[11px] text-[#999] flex-wrap">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-300 inline-block"/>Amazing</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-200 inline-block"/>Good</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-yellow-200 inline-block"/>Okay</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-orange-200 inline-block"/>Hard day</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-200 inline-block"/>Struggling</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#f0ede8] border border-[#e8e8e8] inline-block"/>Missed</span>
        </div>
      </div>

      {/* Selected day detail */}
      {selectedDay && (
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 mb-4 border-l-4 border-l-[#b8922a]">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-[18px] ${MOOD_COLOR[selectedDay.mood] || 'bg-[#f2f0ec]'}`}>
              {MOOD_EMOJI[selectedDay.mood] || '😐'}
            </div>
            <div>
              <p className="font-medium text-[14px]">{new Date(selectedDay.dateStr).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
              <p className={`text-[12px] font-medium ${MOOD_COLOR[selectedDay.mood]?.split(' ')[1] || 'text-[#666]'}`}>
                {MOOD_LABEL[selectedDay.mood] || 'Checked in'}
              </p>
            </div>
          </div>
          {selectedDay.note ? (
            <div className="bg-[#f8f7f5] rounded-xl p-3">
              <p className="text-[11px] font-medium text-[#999] uppercase tracking-[.08em] mb-1">Your note</p>
              <p className="text-[14px] text-[#111] leading-[1.65] italic">"{selectedDay.note}"</p>
            </div>
          ) : (
            <p className="text-[13px] text-[#999] italic">No note added for this day.</p>
          )}
        </div>
      )}

      <div className="bg-[#111] rounded-2xl p-5">
        <p className="text-[10px] font-medium tracking-[.12em] uppercase text-white/30 mb-3">Affirmation</p>
        <p className="font-serif italic text-[18px] text-white/85 leading-[1.6]">"{goal.affirmation}"</p>
      </div>
    </div>
  )
}