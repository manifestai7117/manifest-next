'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const MOOD_LABELS = ['','Terrible','Bad','Okay','Good','Amazing']
const MOOD_COLORS = ['','#ef4444','#f97316','#eab308','#22c55e','#10b981']

export default function StreakPage() {
  const supabase = createClient()
  const [goals, setGoals] = useState<any[]>([])
  const [selectedGoal, setSelectedGoal] = useState<any>(null)
  const [checkins, setCheckins] = useState<any[]>([])
  const [checkedInToday, setCheckedInToday] = useState(false)
  const [loading, setLoading] = useState(true)
  const [moodStats, setMoodStats] = useState({ avg:0, trend:'stable', bestDay:'', worstDay:'' })

  useEffect(()=>{
    const load = async () => {
      const {data:{user}} = await supabase.auth.getUser()
      if (!user) return
      const {data:gs} = await supabase.from('goals').select('*').eq('user_id',user.id).eq('is_active',true).order('created_at',{ascending:false})
      setGoals(gs||[])
      if (gs?.length) loadGoalStreak(gs[0])
      setLoading(false)
    }
    load()
  },[])

  const loadGoalStreak = async (goal:any) => {
    setSelectedGoal(goal)
    const today = new Date().toISOString().split('T')[0]
    const [checkinsRes,todayRes] = await Promise.all([
      supabase.from('checkins').select('created_at,mood,note').eq('goal_id',goal.id).order('created_at',{ascending:false}).limit(30),
      supabase.from('checkins').select('id').eq('goal_id',goal.id).gte('created_at',`${today}T00:00:00`).single(),
    ])
    const ci = checkinsRes.data||[]
    setCheckins(ci)
    setCheckedInToday(!!todayRes.data)
    // Compute mood stats
    if (ci.length) {
      const moods = ci.map(c=>c.mood).filter(Boolean)
      const avg = moods.reduce((a,b)=>a+b,0)/moods.length
      const recent5 = ci.slice(0,5).map(c=>c.mood||3)
      const older5 = ci.slice(5,10).map(c=>c.mood||3)
      const recentAvg = recent5.reduce((a,b)=>a+b,0)/recent5.length
      const olderAvg = older5.length ? older5.reduce((a,b)=>a+b,0)/older5.length : recentAvg
      const trend = recentAvg > olderAvg+0.3 ? 'improving' : recentAvg < olderAvg-0.3 ? 'declining' : 'stable'
      const best = ci.reduce((a,b)=>b.mood>a.mood?b:a,ci[0])
      const worst = ci.reduce((a,b)=>b.mood<a.mood?b:a,ci[0])
      setMoodStats({
        avg:Math.round(avg*10)/10,
        trend,
        bestDay: best?.created_at ? new Date(best.created_at).toLocaleDateString('en',{month:'short',day:'numeric'}) : '',
        worstDay: worst?.created_at ? new Date(worst.created_at).toLocaleDateString('en',{month:'short',day:'numeric'}) : '',
      })
    }
  }

  const today = new Date().toISOString().split('T')[0]
  const checkinDates = new Set(checkins.map(c=>c.created_at.split('T')[0]))
  const days = Array.from({length:28},(_,i)=>{
    const d = new Date(); d.setDate(d.getDate()-(27-i))
    const ds = d.toISOString().split('T')[0]
    const checkin = checkins.find(c=>c.created_at.startsWith(ds))
    return {ds,day:d.getDate(),dayName:d.toLocaleDateString('en',{weekday:'short'}),isToday:ds===today,done:checkinDates.has(ds),future:d>new Date(),mood:checkin?.mood,note:checkin?.note}
  })
  const completionRate = checkins.length ? Math.round((checkins.length/28)*100) : 0
  const recent14 = [...checkins].reverse().slice(-14)

  if (loading) return <div className="text-[#999] text-[14px]">Loading...</div>

  return (
    <div className="fade-up max-w-[800px]">
      <h1 className="font-serif text-[32px] mb-1">Streak tracker</h1>
      <p className="text-[14px] text-[#666] mb-6">Don't break the chain.</p>

      {goals.length>1 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          {goals.map(g=>(
            <button key={g.id} onClick={()=>loadGoalStreak(g)} className={`px-4 py-2 rounded-full text-[13px] border transition-all ${selectedGoal?.id===g.id?'bg-[#111] text-white border-[#111]':'bg-white text-[#666] border-[#e8e8e8] hover:border-[#d0d0d0]'}`}>
              {(g.display_title||g.title).slice(0,30)}{(g.display_title||g.title).length>30?'…':''}
            </button>
          ))}
        </div>
      )}

      {selectedGoal && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-5">
            {[
              {val:`${selectedGoal.streak}`,label:'Current streak',emoji:'🔥'},
              {val:`${selectedGoal.longest_streak||selectedGoal.streak}`,label:'Longest streak',emoji:'🏆'},
              {val:`${completionRate}%`,label:'28-day rate',emoji:'📊'},
            ].map(s=>(
              <div key={s.label} className="bg-white border border-[#e8e8e8] rounded-2xl p-5 text-center">
                <p className="text-[24px] mb-1">{s.emoji}</p>
                <p className="font-serif text-[32px] leading-none mb-1">{s.val}</p>
                <p className="text-[11px] font-medium text-[#999] uppercase tracking-[.06em]">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Affirmation */}
          <div className="bg-[#111] rounded-2xl p-5 mb-5">
            <p className="text-[10px] font-medium tracking-[.1em] uppercase text-white/30 mb-2">Today's affirmation</p>
            <p className="font-serif italic text-[16px] text-white/85 leading-[1.65]">"{selectedGoal.affirmation}"</p>
          </div>

          {/* Calendar */}
          <div className="bg-white border border-[#e8e8e8] rounded-2xl p-6 mb-5">
            <p className="font-medium mb-4 text-[15px]">Last 28 days</p>
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['S','M','T','W','T','F','S'].map((d,i)=><div key={i} className="text-center text-[11px] font-medium text-[#999]">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {days.map(d=>(
                <div key={d.ds} title={d.done ? `${d.ds}${d.mood?` · Mood: ${MOOD_LABELS[d.mood]}`:''}${d.note?` · ${d.note}`:''}` : d.ds}
                  className={`aspect-square rounded-lg flex items-center justify-center text-[12px] font-medium cursor-default transition-all ${d.isToday?'streak-today':d.future?'streak-future':d.done?'streak-done':'streak-missed'}`}
                  style={d.done&&d.mood ? {background:MOOD_COLORS[d.mood],color:'white'} : {}}>
                  {d.day}
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-4 flex-wrap">
              {[['bg-[#b8922a]','Done'],['bg-[#111]','Today'],['bg-[#f2f0ec]','Missed'],['bg-[#f8f7f5]','Future']].map(([c,l])=>(
                <div key={l} className="flex items-center gap-1.5 text-[12px] text-[#666]"><div className={`w-3 h-3 rounded-sm ${c}`}/>{l}</div>
              ))}
              <div className="flex items-center gap-1.5 text-[12px] text-[#666]"><div className="w-3 h-3 rounded-sm bg-[#10b981]"/>Amazing mood</div>
            </div>
          </div>

          {/* Detailed mood chart */}
          {checkins.length>0 && (
            <div className="bg-white border border-[#e8e8e8] rounded-2xl p-6 mb-5">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <p className="font-medium text-[15px] mb-1">Mood over time</p>
                  <p className="text-[13px] text-[#666]">
                    Average: <strong style={{color:MOOD_COLORS[Math.round(moodStats.avg)]}}>{MOOD_LABELS[Math.round(moodStats.avg)]||'—'}</strong>
                    {' '}({moodStats.avg}/5) ·{' '}
                    Trend: <strong className={moodStats.trend==='improving'?'text-green-600':moodStats.trend==='declining'?'text-red-500':'text-[#666]'}>
                      {moodStats.trend==='improving'?'↑ Improving':moodStats.trend==='declining'?'↓ Declining':'→ Stable'}
                    </strong>
                  </p>
                </div>
                <div className="text-right text-[11px] text-[#999]">
                  <p>Best: <span className="text-green-600 font-medium">{moodStats.bestDay}</span></p>
                  <p>Toughest: <span className="text-red-500 font-medium">{moodStats.worstDay}</span></p>
                </div>
              </div>

              {/* Bar chart */}
              <div className="flex items-end gap-1.5 h-28 mb-2">
                {recent14.map((c,i)=>{
                  const mood = c.mood||3
                  const pct = (mood/5)*100
                  const d = new Date(c.created_at)
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${d.toLocaleDateString('en',{month:'short',day:'numeric'})}: ${MOOD_LABELS[mood]}${c.note?` — ${c.note}`:''}`}>
                      <div className="w-full rounded-t-sm transition-all" style={{height:`${pct}%`,background:MOOD_COLORS[mood],minHeight:4}}/>
                    </div>
                  )
                })}
              </div>
              {/* X-axis labels */}
              <div className="flex gap-1.5">
                {recent14.map((c,i)=>(
                  <div key={i} className="flex-1 text-center">
                    <p className="text-[9px] text-[#999]">{new Date(c.created_at).toLocaleDateString('en',{month:'numeric',day:'numeric'})}</p>
                  </div>
                ))}
              </div>

              {/* Mood legend */}
              <div className="flex gap-3 mt-3 flex-wrap">
                {[1,2,3,4,5].map(n=>(
                  <div key={n} className="flex items-center gap-1.5 text-[11px] text-[#666]">
                    <div className="w-3 h-3 rounded-sm" style={{background:MOOD_COLORS[n]}}/>
                    {MOOD_LABELS[n]}
                  </div>
                ))}
              </div>

              {/* Recent notes */}
              {checkins.some(c=>c.note) && (
                <div className="mt-4 border-t border-[#e8e8e8] pt-4">
                  <p className="text-[12px] font-medium text-[#666] mb-2">Recent notes</p>
                  {checkins.filter(c=>c.note).slice(0,3).map((c,i)=>(
                    <div key={i} className="flex gap-3 mb-2">
                      <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{background:MOOD_COLORS[c.mood||3]}}/>
                      <div>
                        <p className="text-[11px] text-[#999]">{new Date(c.created_at).toLocaleDateString('en',{month:'short',day:'numeric'})}</p>
                        <p className="text-[13px] text-[#666]">{c.note}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!checkedInToday ? (
            <div className="bg-[#111] rounded-2xl p-5 flex items-center justify-between">
              <div>
                <p className="font-serif text-[18px] text-white mb-1">Log today</p>
                <p className="text-[13px] text-white/50">Keep your streak alive</p>
              </div>
              <a href="/dashboard" className="px-5 py-2.5 bg-[#b8922a] text-white rounded-xl text-[13px] font-medium hover:bg-[#9a7820] transition-colors">Log now ✓</a>
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
      )}
      {!selectedGoal && !loading && (
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-8 text-center">
          <p className="text-[#666] mb-4">No active goal</p>
          <a href="/onboarding" className="inline-block px-5 py-2.5 bg-[#111] text-white rounded-xl text-[13px] font-medium">Create a goal →</a>
        </div>
      )}
    </div>
  )
}
