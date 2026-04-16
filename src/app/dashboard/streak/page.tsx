'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import CheckInButton from '@/components/dashboard/CheckInButton'
import Link from 'next/link'

const MOOD_LABEL = ['', 'Struggling', 'Hard day', 'Okay', 'Good', 'Amazing']
const MOOD_EMOJI = ['', '😞', '😕', '😐', '🙂', '😄']
const MOOD_COLORS = ['', 'bg-red-200', 'bg-orange-200', 'bg-yellow-200', 'bg-green-200', 'bg-emerald-300']

function MoodChart({ data }: { data: { date: string; mood: number }[] }) {
  const colors = ['', '#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981']
  return (
    <div className="flex items-end gap-0.5 h-20">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-0.5" title={`${d.date}: ${MOOD_LABEL[d.mood] || 'Checked in'}`}>
          <div className="w-full rounded-sm transition-all" style={{ height: `${(d.mood / 5) * 100}%`, background: colors[d.mood] || '#e8e8e8', minHeight: '3px' }}/>
          {i % 7 === 0 && <span className="text-[8px] text-[#999]">{new Date(d.date).getDate()}</span>}
        </div>
      ))}
    </div>
  )
}

export default function StreakAnalyticsPage() {
  const supabase = createClient()
  const [goals, setGoals] = useState<any[]>([])
  const [goal, setGoal] = useState<any>(null)
  const [checkins, setCheckins] = useState<any[]>([])
  const [todayDone, setTodayDone] = useState(false)
  const [selectedDay, setSelectedDay] = useState<any>(null)
  const [insight, setInsight] = useState('')
  const [insightLoading, setInsightLoading] = useState(false)
  const [postCount, setPostCount] = useState(0)
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
      if (g) await loadCheckins(g.id, user.id)
      setLoading(false)
    }
    load()
  }, [])

  const loadCheckins = async (goalId: string, uid: string) => {
    const today = new Date().toISOString().split('T')[0]
    const [{ data: c }, { count: pc }] = await Promise.all([
      supabase.from('checkins').select('created_at, mood, note').eq('goal_id', goalId).order('created_at', { ascending: false }).limit(90),
      supabase.from('feed_posts').select('*', { count: 'exact', head: true }).eq('user_id', uid).eq('is_archived', false),
    ])
    setCheckins(c || [])
    setPostCount(pc || 0)
    setTodayDone(!!(c || []).find((x: any) => x.created_at.startsWith(today)))
  }

  const switchGoal = async (g: any) => {
    setGoal(g)
    setSelectedDay(null)
    setInsight('')
    localStorage.setItem('selectedGoalId', g.id)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) await loadCheckins(g.id, user.id)
  }

  const loadInsight = async () => {
    if (!goal || insightLoading) return
    setInsightLoading(true)
    const res = await fetch(`/api/insights?goalId=${goal.id}`)
    const data = await res.json()
    setInsight(data.insight || '')
    setInsightLoading(false)
  }

  if (loading) return <div className="text-[#999] text-[14px]">Loading...</div>
  if (!goal) return (
    <div className="fade-up"><h1 className="font-serif text-[32px] mb-4">Streak & Analytics</h1><p className="text-[#666]">No active goal yet.</p></div>
  )

  const today = new Date().toISOString().split('T')[0]
  const checkinMap: Record<string, any> = {}
  checkins.forEach((c: any) => { checkinMap[c.created_at.split('T')[0]] = c })
  const last28 = Array.from({ length: 28 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (27 - i))
    const dateStr = d.toISOString().split('T')[0]
    return { dateStr, day: d.getDate(), isToday: dateStr === today, checkin: checkinMap[dateStr], future: d > new Date() }
  })
  const moodData = checkins.slice(0, 60).reverse().map((c: any) => ({ date: c.created_at.split('T')[0], mood: c.mood || 3 }))
  const completionRate = checkins.length ? Math.round((last28.filter(d => d.checkin).length / 28) * 100) : 0
  const avgMood = checkins.length ? (checkins.reduce((a: number, c: any) => a + (c.mood || 3), 0) / checkins.length).toFixed(1) : '—'
  const weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  const byDay: Record<number, number[]> = { 0:[], 1:[], 2:[], 3:[], 4:[], 5:[], 6:[] }
  checkins.forEach((c: any) => { const d = new Date(c.created_at).getDay(); byDay[d].push(c.mood || 3) })
  const bestDay = Object.entries(byDay).filter(([,v]) => v.length > 0).sort(([,a],[,b]) => (b.reduce((x,y)=>x+y,0)/b.length) - (a.reduce((x,y)=>x+y,0)/a.length))[0]

  return (
    <div className="fade-up max-w-[800px]">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-[32px] mb-0.5">Streak & Analytics</h1>
          <p className="text-[14px] text-[#666]">Your consistency, patterns and progress</p>
        </div>
      </div>

      {goals.length > 1 && (
        <div className="flex gap-2 mb-5 flex-wrap">
          {goals.map(g => (
            <button key={g.id} onClick={() => switchGoal(g)}
              className={`px-4 py-2 rounded-full text-[13px] border transition-all ${goal?.id === g.id ? 'bg-[#111] text-white border-[#111]' : 'bg-white text-[#666] border-[#e8e8e8]'}`}>
              {g.title.slice(0, 24)}
            </button>
          ))}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        {[
          { val: `${goal.streak}`, label: 'Streak 🔥' },
          { val: `${goal.longest_streak || goal.streak}`, label: 'Best streak' },
          { val: `${completionRate}%`, label: '28-day rate' },
          { val: avgMood, label: 'Avg mood' },
          { val: postCount, label: 'Posts shared' },
        ].map(({ val, label }) => (
          <div key={label} className="bg-white border border-[#e8e8e8] rounded-2xl p-4">
            <p className="font-serif text-[24px] leading-none mb-1">{val}</p>
            <p className="text-[11px] text-[#999] uppercase tracking-[.05em]">{label}</p>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* 28-day calendar */}
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5">
          <p className="font-medium text-[14px] mb-4">Last 28 days — tap for notes</p>
          <div className="grid grid-cols-7 gap-1.5">
            {['M','T','W','T','F','S','S'].map((d, i) => <p key={i} className="text-[9px] text-[#999] text-center font-medium uppercase">{d}</p>)}
            {last28.map(({ day, dateStr, isToday, checkin, future }) => {
              const mood = checkin?.mood || 0
              const bg = checkin ? MOOD_COLORS[mood] || 'bg-[#b8922a]' : future ? 'bg-[#f8f7f5]' : 'bg-[#f0ede8]'
              return (
                <button key={dateStr} onClick={() => checkin && setSelectedDay(selectedDay?.dateStr === dateStr ? null : { ...checkin, dateStr, day })}
                  disabled={!checkin}
                  title={checkin ? `${MOOD_LABEL[mood]}${checkin.note ? ': ' + checkin.note : ''}` : ''}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center text-[11px] font-medium transition-all ${bg} ${isToday ? 'ring-2 ring-[#b8922a] ring-offset-1' : ''} ${checkin ? 'cursor-pointer hover:opacity-80' : 'cursor-default'} ${selectedDay?.dateStr === dateStr ? 'ring-2 ring-[#111] ring-offset-1' : ''}`}>
                  <span className={checkin ? 'text-white' : future ? 'text-[#ccc]' : 'text-[#bbb]'}>{day}</span>
                  {checkin && <span className="text-[9px]">{MOOD_EMOJI[mood]}</span>}
                </button>
              )
            })}
          </div>
          <div className="flex gap-3 mt-3 text-[10px] text-[#999] flex-wrap">
            {['Amazing','Good','Okay','Hard','Struggling'].map((l, i) => (
              <span key={l} className="flex items-center gap-1"><span className={`w-2.5 h-2.5 rounded-sm ${['bg-emerald-300','bg-green-200','bg-yellow-200','bg-orange-200','bg-red-200'][i]}`}/>{l}</span>
            ))}
          </div>
        </div>

        {/* Best day of week */}
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5">
          <p className="font-medium text-[14px] mb-3">Check-ins by day</p>
          <div className="space-y-2">
            {weekdays.map((day, i) => {
              const dc = byDay[i]
              const maxCount = Math.max(...Object.values(byDay).map(v => v.length), 1)
              return (
                <div key={day} className="flex items-center gap-2">
                  <span className="text-[12px] text-[#666] w-8">{day}</span>
                  <div className="flex-1 bg-[#f0ede8] rounded-full h-2 overflow-hidden">
                    <div className="h-full bg-[#b8922a] rounded-full" style={{ width: `${(dc.length / maxCount) * 100}%` }}/>
                  </div>
                  <span className="text-[11px] text-[#999] w-6 text-right">{dc.length}</span>
                </div>
              )
            })}
          </div>
          {bestDay && <p className="text-[12px] text-[#b8922a] mt-3 font-medium">Best day: {weekdays[parseInt(bestDay[0])]}</p>}
        </div>
      </div>

      {/* Mood chart */}
      {moodData.length > 0 && (
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 mb-4">
          <p className="font-medium text-[14px] mb-3">Mood over time ({moodData.length} check-ins)</p>
          <MoodChart data={moodData}/>
        </div>
      )}

      {/* Selected day detail */}
      {selectedDay && (
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 mb-4 border-l-4 border-l-[#b8922a]">
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-[18px] ${MOOD_COLORS[selectedDay.mood] || 'bg-[#f2f0ec]'}`}>{MOOD_EMOJI[selectedDay.mood] || '😐'}</div>
            <div>
              <p className="font-medium text-[14px]">{new Date(selectedDay.dateStr).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
              <p className="text-[12px] text-[#666]">{MOOD_LABEL[selectedDay.mood] || 'Checked in'}</p>
            </div>
          </div>
          {selectedDay.note ? <div className="bg-[#f8f7f5] rounded-xl p-3"><p className="text-[14px] text-[#111] italic">"{selectedDay.note}"</p></div> : <p className="text-[13px] text-[#999] italic">No note added.</p>}
        </div>
      )}

      {/* AI Insight */}
      <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div><p className="font-medium text-[14px]">AI Progress Insight</p><p className="text-[12px] text-[#999]">Based on your logs, coach chats & patterns</p></div>
          <button onClick={loadInsight} disabled={insightLoading} className="flex items-center gap-1.5 px-3.5 py-2 border border-[#e8e8e8] rounded-xl text-[12px] text-[#666] hover:bg-[#f8f7f5] transition-colors disabled:opacity-50">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={insightLoading ? 'spin-anim' : ''}><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            {insightLoading ? 'Analyzing...' : insight ? 'Refresh' : 'Get insight'}
          </button>
        </div>
        {insight ? <div className="bg-[#faf3e0] border border-[#b8922a]/20 rounded-xl p-4"><p className="text-[14px] text-[#111] leading-[1.7]">{insight}</p></div> : <div className="bg-[#f8f7f5] rounded-xl p-4 text-center"><p className="text-[13px] text-[#999]">Click "Get insight" for AI analysis of your patterns, pace, and what to focus on next.</p></div>}
      </div>

      {/* Affirmation */}
      <div className="bg-[#111] rounded-2xl p-5">
        <p className="text-[10px] font-medium tracking-[.12em] uppercase text-white/30 mb-2">Your affirmation</p>
        <p className="font-serif italic text-[18px] text-white/85 leading-[1.6]">"{goal.affirmation}"</p>
      </div>
    </div>
  )
}