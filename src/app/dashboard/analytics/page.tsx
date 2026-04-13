'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

function MoodChart({ data }: { data: { date: string; mood: number }[] }) {
  const max = 5
  const w = 100 / Math.max(data.length, 1)
  const colors = ['', '#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981']
  return (
    <div className="flex items-end gap-1 h-24">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${d.date}: ${d.mood}/5`}>
          <div className="w-full rounded-t-sm transition-all" style={{ height: `${(d.mood / max) * 100}%`, background: colors[d.mood] || '#e8e8e8', minHeight: '4px' }}/>
          {i % 7 === 0 && <span className="text-[8px] text-[#999]">{new Date(d.date).getDate()}</span>}
        </div>
      ))}
    </div>
  )
}

export default function AnalyticsPage() {
  const supabase = createClient()
  const [goals, setGoals] = useState<any[]>([])
  const [selectedGoalId, setSelectedGoalId] = useState('')
  const [checkins, setCheckins] = useState<any[]>([])
  const [insight, setInsight] = useState('')
  const [insightLoading, setInsightLoading] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: gs } = await supabase.from('goals').select('*').eq('user_id', user.id).eq('is_active', true).order('created_at', { ascending: false })
      setGoals(gs || [])
      const savedId = localStorage.getItem('selectedGoalId')
      const g = gs?.find((x: any) => x.id === savedId) || gs?.[0]
      if (g) { setSelectedGoalId(g.id); await loadCheckins(g.id) }
      setLoading(false)
    }
    load()
  }, [])

  const loadCheckins = async (goalId: string) => {
    const { data } = await supabase.from('checkins').select('created_at, mood, note').eq('goal_id', goalId).order('created_at', { ascending: true }).limit(90)
    setCheckins(data || [])
  }

  const switchGoal = async (id: string) => {
    setSelectedGoalId(id)
    setInsight('')
    localStorage.setItem('selectedGoalId', id)
    await loadCheckins(id)
  }

  const loadInsight = async () => {
    if (!selectedGoalId || insightLoading) return
    setInsightLoading(true)
    const res = await fetch(`/api/insights?goalId=${selectedGoalId}`)
    const data = await res.json()
    setInsight(data.insight || '')
    setInsightLoading(false)
  }

  const goal = goals.find(g => g.id === selectedGoalId)
  const moodData = checkins.map(c => ({ date: c.created_at.split('T')[0], mood: c.mood || 3 }))
  const avgMood = checkins.length ? (checkins.reduce((a, c) => a + (c.mood || 3), 0) / checkins.length).toFixed(1) : '—'
  const weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  const byDayOfWeek: Record<number, number[]> = { 0:[], 1:[], 2:[], 3:[], 4:[], 5:[], 6:[] }
  checkins.forEach(c => { const d = new Date(c.created_at).getDay(); byDayOfWeek[d].push(c.mood || 3) })
  const bestDay = Object.entries(byDayOfWeek).filter(([,v]) => v.length > 0).sort(([,a],[,b]) => (b.reduce((x,y)=>x+y,0)/b.length) - (a.reduce((x,y)=>x+y,0)/a.length))[0]

  // 4-week completion grid
  const today = new Date()
  const last28 = Array.from({ length: 28 }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() - (27 - i))
    const dateStr = d.toISOString().split('T')[0]
    const checkin = checkins.find(c => c.created_at.startsWith(dateStr))
    return { dateStr, done: !!checkin, mood: checkin?.mood || 0 }
  })
  const completionRate = Math.round((last28.filter(d => d.done).length / 28) * 100)
  const moodColors = ['bg-[#f0ede8]', 'bg-red-200', 'bg-orange-200', 'bg-yellow-200', 'bg-green-200', 'bg-emerald-300']

  if (loading) return <div className="text-[#999] text-[14px]">Loading...</div>
  if (!goal) return (
    <div className="fade-up"><h1 className="font-serif text-[32px] mb-4">Analytics</h1><p className="text-[#666]">Create a goal to see analytics.</p></div>
  )

  return (
    <div className="fade-up max-w-[800px]">
      <h1 className="font-serif text-[32px] mb-1">Analytics</h1>
      <p className="text-[14px] text-[#666] mb-5">Deep insights into your consistency and patterns</p>

      {goals.length > 1 && (
        <div className="flex gap-2 mb-5 flex-wrap">
          {goals.map(g => (
            <button key={g.id} onClick={() => switchGoal(g.id)}
              className={`px-4 py-2 rounded-full text-[13px] border transition-all ${g.id === selectedGoalId ? 'bg-[#111] text-white border-[#111]' : 'bg-white text-[#666] border-[#e8e8e8]'}`}>
              {(g.display_title || g.title).slice(0, 24)}
            </button>
          ))}
        </div>
      )}

      {/* Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { val: `${goal.streak}`, label: 'Current streak 🔥' },
          { val: `${completionRate}%`, label: '28-day rate' },
          { val: avgMood, label: 'Avg mood (/5)' },
          { val: checkins.length, label: 'Total check-ins' },
        ].map(({ val, label }) => (
          <div key={label} className="bg-white border border-[#e8e8e8] rounded-2xl p-4">
            <p className="font-serif text-[26px] leading-none mb-1">{val}</p>
            <p className="text-[11px] text-[#999] uppercase tracking-[.05em]">{label}</p>
          </div>
        ))}
      </div>

      {/* Mood chart */}
      {moodData.length > 0 && (
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 mb-4">
          <p className="font-medium text-[14px] mb-1">Mood over time</p>
          <p className="text-[12px] text-[#999] mb-4">Last {moodData.length} check-ins</p>
          <MoodChart data={moodData}/>
          <div className="flex gap-3 mt-3 text-[11px] text-[#999]">
            {['', 'Struggling','Hard','Okay','Good','Amazing'].filter(Boolean).map((l,i) => (
              <span key={l} className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: ['','#ef4444','#f97316','#eab308','#22c55e','#10b981'][i+1] }}/>
                {l}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Best days of week */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5">
          <p className="font-medium text-[14px] mb-3">Check-ins by day of week</p>
          <div className="space-y-2">
            {weekdays.map((day, i) => {
              const dayCheckins = byDayOfWeek[i]
              const avg = dayCheckins.length ? dayCheckins.reduce((a,b) => a+b, 0) / dayCheckins.length : 0
              return (
                <div key={day} className="flex items-center gap-3">
                  <span className="text-[12px] text-[#666] w-8">{day}</span>
                  <div className="flex-1 bg-[#f0ede8] rounded-full h-2 overflow-hidden">
                    <div className="h-full bg-[#b8922a] rounded-full" style={{ width: `${(dayCheckins.length / Math.max(...Object.values(byDayOfWeek).map(v => v.length), 1)) * 100}%` }}/>
                  </div>
                  <span className="text-[11px] text-[#999] w-8 text-right">{dayCheckins.length}x</span>
                </div>
              )
            })}
          </div>
          {bestDay && <p className="text-[12px] text-[#b8922a] mt-3">Best day: {weekdays[parseInt(bestDay[0])]}</p>}
        </div>

        {/* 28-day heatmap */}
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5">
          <p className="font-medium text-[14px] mb-3">28-day heatmap</p>
          <div className="grid grid-cols-7 gap-1.5">
            {last28.map(({ dateStr, done, mood }) => (
              <div key={dateStr} className={`aspect-square rounded-md ${done ? moodColors[mood] || 'bg-[#b8922a]' : 'bg-[#f0ede8]'}`} title={dateStr}/>
            ))}
          </div>
        </div>
      </div>

      {/* AI Insight */}
      <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-medium text-[14px]">AI Progress Insight</p>
            <p className="text-[12px] text-[#999]">Personalized analysis of your goal</p>
          </div>
          <button onClick={loadInsight} disabled={insightLoading}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-[#e8e8e8] rounded-xl text-[12px] text-[#666] hover:bg-[#f8f7f5] transition-colors disabled:opacity-50">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={insightLoading ? 'spin-anim' : ''}><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            {insightLoading ? 'Analyzing...' : insight ? 'Refresh' : 'Get insight'}
          </button>
        </div>
        {insight ? (
          <div className="bg-[#faf3e0] border border-[#b8922a]/20 rounded-xl p-4">
            <p className="text-[14px] text-[#111] leading-[1.7]">{insight}</p>
          </div>
        ) : (
          <div className="bg-[#f8f7f5] rounded-xl p-4 text-center">
            <p className="text-[13px] text-[#999]">Click "Get insight" for an AI-powered analysis of your progress, pace, and patterns.</p>
          </div>
        )}
      </div>
    </div>
  )
}
