'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

export default function CoachPage() {
  const supabase = createClient()
  const [goals, setGoals] = useState<any[]>([])
  const [goal, setGoal] = useState<any>(null)
  const [msgs, setMsgs] = useState<{ role: string; content: string }[]>([])
  const [inp, setInp] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [usage, setUsage] = useState({ used: 0, limit: 50, remaining: 50 })
  // Daily task state
  const [todayTask, setTodayTask] = useState<any>(null)
  const [yesterdayTask, setYesterdayTask] = useState<any>(null)
  const [needsYesterdayLog, setNeedsYesterdayLog] = useState(false)
  const [yesterdayNote, setYesterdayNote] = useState('')
  const [submittingLog, setSubmittingLog] = useState(false)
  const [generatingTask, setGeneratingTask] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: gs } = await supabase.from('goals').select('*').eq('user_id', user.id).eq('is_active', true).eq('is_paused', false).order('created_at', { ascending: false })
      setGoals(gs || [])
      const savedId = localStorage.getItem('selectedGoalId')
      const g = gs?.find((x: any) => x.id === savedId) || gs?.[0] || null
      setGoal(g)
      if (g) { await loadHistory(g); await loadDailyTask(g.id) }
      setLoadingHistory(false)
    }
    load()
  }, [])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, loading])

  const loadHistory = async (g: any) => {
    setLoadingHistory(true)
    const { data: history } = await supabase.from('coach_messages').select('role, content').eq('goal_id', g.id).order('created_at', { ascending: true }).limit(50)
    if (history?.length) {
      setMsgs(history)
    } else {
      setMsgs([{ role: 'assistant', content: `I'm your Manifest coach for "${g.title}". I know your why, your obstacles, and your progress. Before we dive in â€” what did you actually do toward this goal yesterday?` }])
    }
    const res = await fetch(`/api/coach?goalId=${g.id}`)
    const data = await res.json()
    if (res.ok) setUsage(data)
    setLoadingHistory(false)
  }

  const loadDailyTask = async (goalId: string) => {
    const res = await fetch(`/api/daily-task?goalId=${goalId}`)
    const data = await res.json()
    if (res.ok) {
      setTodayTask(data.todayTask)
      setYesterdayTask(data.yesterdayTask)
      setNeedsYesterdayLog(data.needsYesterdayLog)
    }
  }

  const switchGoal = async (g: any) => {
    setGoal(g)
    localStorage.setItem('selectedGoalId', g.id)
    await loadHistory(g)
    await loadDailyTask(g.id)
  }

  const logYesterdayWork = async () => {
    if (!yesterdayNote.trim() || !yesterdayTask || submittingLog) return
    setSubmittingLog(true)
    const res = await fetch('/api/daily-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goalId: goal.id, action: 'log_yesterday', completionNote: yesterdayNote, yesterdayTaskId: yesterdayTask.id }),
    })
    if (res.ok) {
      setNeedsYesterdayLog(false)
      setYesterdayTask((p: any) => ({ ...p, completed: true, completion_note: yesterdayNote }))
      toast.success('Logged! Now getting today\'s task...')
      await generateTodayTask()
    }
    setSubmittingLog(false)
  }

  const generateTodayTask = async () => {
    if (!goal || generatingTask) return
    setGeneratingTask(true)
    const res = await fetch('/api/daily-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goalId: goal.id, action: 'generate' }),
    })
    const data = await res.json()
    if (res.ok && data.task) setTodayTask(data.task)
    setGeneratingTask(false)
  }

  const send = async () => {
    if (!inp.trim() || loading || !goal) return
    if (usage.remaining <= 0) { toast.error('Daily limit reached. Resets at midnight.'); return }
    const userMsg = inp.trim()
    setInp('')
    setMsgs(prev => [...prev, { role: 'user', content: userMsg }])
    setLoading(true)

    // Include daily task context in messages
    const taskContext = todayTask ? `[Today's assigned task: "${todayTask.task}"]` : ''
    const yesterdayContext = yesterdayTask?.completed ? `[Yesterday's task completed: "${yesterdayTask.completion_note}"]` : yesterdayTask ? `[Yesterday's task was NOT logged: "${yesterdayTask.task}"]` : ''
    
    const allMsgs = [
      ...(taskContext || yesterdayContext ? [{ role: 'user', content: `${taskContext} ${yesterdayContext}`.trim() }, { role: 'assistant', content: 'Understood.' }] : []),
      ...msgs,
      { role: 'user', content: userMsg }
    ]

    const res = await fetch('/api/coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: allMsgs.slice(-20), goalId: goal.id }),
    })
    const data = await res.json()
    setLoading(false)
    if (data.error) { toast.error(data.error); return }
    setMsgs(prev => [...prev, { role: 'assistant', content: data.reply }])
    setUsage(prev => ({ ...prev, used: prev.used + 1, remaining: Math.max(0, prev.remaining - 1) }))
  }

  const clearHistory = async () => {
    if (!goal) return
    await supabase.from('coach_messages').delete().eq('goal_id', goal.id)
    setMsgs([{ role: 'assistant', content: `Fresh start. I still know your goal "${goal.title}" and everything about your progress. What's on your mind?` }])
    toast.success('Chat cleared')
  }

  if (loadingHistory) return (
    <div className="fade-up max-w-[760px]">
      <div className="animate-pulse space-y-3">
        <div className="h-8 bg-[#f0ede8] rounded w-32"/>
        <div className="h-48 bg-[#f0ede8] rounded-2xl"/>
      </div>
    </div>
  )

  if (!goal) return (
    <div className="fade-up">
      <h1 className="font-serif text-[32px] mb-4">AI Coach</h1>
      <p className="text-[#666] mb-4">Create a goal first to start coaching.</p>
    </div>
  )

  return (
    <div className="fade-up max-w-[760px]">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-[32px] mb-0.5">AI Coach</h1>
          <p className="text-[13px] text-[#999]">Coaching for: "{goal.title}"</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <span className={`text-[12px] font-medium px-3 py-1.5 rounded-full ${usage.remaining > 5 ? 'bg-green-50 text-green-700' : usage.remaining > 0 ? 'bg-[#faf3e0] text-[#b8922a]' : 'bg-red-50 text-red-600'}`}>
            {usage.remaining} chats left today
          </span>
          <button onClick={clearHistory} className="px-3 py-1.5 border border-[#e8e8e8] rounded-xl text-[12px] text-[#999] hover:bg-[#f8f7f5] transition-colors">Clear chat</button>
        </div>
      </div>

      {/* Goal tabs */}
      {goals.length > 1 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {goals.map(g => (
            <button key={g.id} onClick={() => switchGoal(g)}
              className={`px-3.5 py-1.5 rounded-full text-[12px] border transition-all ${g.id === goal.id ? 'bg-[#111] text-white border-[#111]' : 'bg-white text-[#666] border-[#e8e8e8]'}`}>
              {g.title.slice(0, 30)}
            </button>
          ))}
        </div>
      )}

      {/* MANDATORY: Log yesterday's work first */}
      {needsYesterdayLog && yesterdayTask && (
        <div className="bg-[#111] rounded-2xl p-5 mb-4 border border-[#b8922a]/30">
          <div className="flex items-start gap-3 mb-4">
            <span className="text-[24px]">ðŸ“‹</span>
            <div>
              <p className="font-medium text-white text-[15px] mb-1">Before today's session â€” log yesterday first</p>
              <p className="text-white/60 text-[13px]">Yesterday's task: <span className="text-white/80 italic">"{yesterdayTask.task}"</span></p>
              <p className="text-white/50 text-[12px] mt-1">Accountability is non-negotiable. What did you actually do?</p>
            </div>
          </div>
          <textarea
            value={yesterdayNote}
            onChange={e => setYesterdayNote(e.target.value)}
            placeholder="Be honest â€” did you complete it? What happened? Even if you didn't do it, say so. That's the starting point."
            className="w-full bg-white/10 text-white placeholder-white/30 text-[14px] px-4 py-3 rounded-xl border border-white/10 outline-none resize-none leading-[1.6] mb-3"
            rows={3}
          />
          <button onClick={logYesterdayWork} disabled={!yesterdayNote.trim() || submittingLog}
            className="px-5 py-2.5 bg-[#b8922a] text-white rounded-xl text-[13px] font-medium disabled:opacity-40 hover:bg-[#9a7820] transition-colors">
            {submittingLog ? 'Logging...' : 'Log & continue â†’'}
          </button>
        </div>
      )}

      {/* Today's Daily Task */}
      {!needsYesterdayLog && (
        <div className="mb-4">
          {todayTask ? (
            <div className={`rounded-2xl p-5 border ${todayTask.completed === true ? 'bg-[#f0faf0] border-green-300' : 'bg-[#faf3e0] border-[#b8922a]/30'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-[10px] font-bold tracking-[.12em] uppercase text-[#b8922a] mb-2">
                    {todayTask.completed ? 'âœ“ Today\'s task â€” completed' : 'âš¡ Today\'s task'}
                  </p>
                  <p className={`text-[14px] leading-[1.7] font-medium ${todayTask.completed === true ? 'text-[#666] line-through' : 'text-[#111]'}`}>{todayTask.task}</p>
                </div>
                {!todayTask.completed && (
                  <button onClick={async () => {
                    await supabase.from('daily_tasks').update({ completed: true }).eq('id', todayTask.id)
                    setTodayTask((p: any) => ({ ...p, completed: true }))
                    toast.success('Task marked done! Great work.')
                  }} className="flex-shrink-0 px-3 py-1.5 bg-[#111] text-white rounded-xl text-[12px] font-medium hover:bg-[#2a2a2a] transition-colors">
                    Mark done âœ“
                  </button>
                )}
              </div>
            </div>
          ) : (
            <button onClick={generateTodayTask} disabled={generatingTask}
              className="w-full py-3.5 border-2 border-dashed border-[#b8922a]/40 rounded-2xl text-[13px] text-[#b8922a] hover:border-[#b8922a]/70 transition-colors flex items-center justify-center gap-2">
              {generatingTask
                ? <><span className="w-3.5 h-3.5 border-2 border-[#b8922a]/30 border-t-[#b8922a] rounded-full spin-anim"/> Generating today's task...</>
                : 'âš¡ Generate today\'s task'
              }
            </button>
          )}
        </div>
      )}

      {/* Chat */}
      <div className="bg-white border border-[#e8e8e8] rounded-2xl overflow-hidden">
        {/* Coach header */}
        <div className="px-5 py-4 border-b border-[#f0ede8] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#b8922a] flex items-center justify-center text-white font-semibold text-[14px]">M</div>
            <div>
              <p className="font-medium text-[14px]">Manifest Coach</p>
              <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-500"/><span className="text-[11px] text-green-600">Active</span></div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#b8922a] bg-[#faf3e0] px-2.5 py-1 rounded-full">{goal.streak}d streak</span>
            <span className="text-[11px] text-[#999] bg-[#f2f0ec] px-2.5 py-1 rounded-full">{goal.progress}%</span>
          </div>
        </div>

        {/* Messages */}
        <div className="h-[380px] overflow-y-auto px-5 py-4 space-y-4">
          {msgs.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              {m.role === 'assistant' && <div className="w-8 h-8 rounded-full bg-[#b8922a] flex items-center justify-center text-white text-[12px] font-semibold flex-shrink-0 mt-0.5">M</div>}
              <div className={`max-w-[82%] px-4 py-3 rounded-2xl text-[14px] leading-[1.7] ${m.role === 'user' ? 'bg-[#111] text-white rounded-tr-sm' : 'bg-[#f8f7f5] text-[#111] rounded-tl-sm'}`}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-[#b8922a] flex items-center justify-center text-white text-[12px] font-semibold flex-shrink-0">M</div>
              <div className="bg-[#f8f7f5] px-4 py-3 rounded-2xl flex gap-1.5 items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-[#b8922a] bounce-1"/><span className="w-1.5 h-1.5 rounded-full bg-[#b8922a] bounce-2"/><span className="w-1.5 h-1.5 rounded-full bg-[#b8922a] bounce-3"/>
              </div>
            </div>
          )}
          <div ref={endRef}/>
        </div>

        {/* Input */}
        <div className="border-t border-[#e8e8e8] p-4">
          <div className="flex gap-2">
            <input
              value={inp}
              onChange={e => setInp(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder={needsYesterdayLog ? "Log yesterday's work first â†‘" : "Talk to your coach..."}
              disabled={needsYesterdayLog || usage.remaining <= 0}
              className="flex-1 px-4 py-2.5 bg-[#f8f7f5] border border-[#e8e8e8] rounded-xl text-[14px] outline-none focus:border-[#b8922a] disabled:opacity-50 transition-colors"
            />
            <button onClick={send} disabled={!inp.trim() || loading || needsYesterdayLog || usage.remaining <= 0}
              className="px-4 py-2.5 bg-[#111] text-white rounded-xl hover:bg-[#2a2a2a] transition-colors disabled:opacity-40">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22,2 15,22 11,13 2,9"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}