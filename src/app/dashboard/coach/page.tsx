'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

const QUICK = [
  "I'm feeling stuck today",
  "Help me plan this week",
  "I missed yesterday — what now?",
  "How do I push through resistance?",
]

export default function CoachPage() {
  const supabase = createClient()
  const [goals, setGoals] = useState<any[]>([])
  const [goal, setGoal] = useState<any>(null)
  const [msgs, setMsgs] = useState<{ role: string; content: string }[]>([])
  const [inp, setInp] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [usage, setUsage] = useState({ used: 0, limit: 5, remaining: 5 })
  const [clearing, setClearing] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: gs } = await supabase.from('goals').select('*').eq('user_id', user.id).eq('is_active', true).order('created_at', { ascending: false })
      setGoals(gs || [])

      // Restore last selected goal from localStorage
      const savedGoalId = localStorage.getItem('selectedGoalId')
      const g = gs?.find((x: any) => x.id === savedGoalId) || gs?.[0] || null
      setGoal(g)
      if (g) await loadHistory(g)
      setLoadingHistory(false)
    }
    load()
  }, [])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, loading])

  const loadHistory = async (g: any) => {
    setLoadingHistory(true)
    const { data: history } = await supabase.from('coach_messages').select('role, content').eq('goal_id', g.id).order('created_at', { ascending: true }).limit(40)
    if (history?.length) {
      setMsgs(history)
    } else {
      setMsgs([{ role: 'assistant', content: `Hey! I'm your Manifest coach. I'm here to help you with "${g.title}". I know your why and what's been stopping you. What's on your mind today?` }])
    }
    // Load usage
    const res = await fetch(`/api/coach?goalId=${g.id}`)
    const data = await res.json()
    if (res.ok) setUsage(data)
    setLoadingHistory(false)
  }

  const switchGoal = async (g: any) => {
    setGoal(g)
    localStorage.setItem('selectedGoalId', g.id)
    await loadHistory(g)
  }

  const clearChat = async () => {
    if (!goal || clearing) return
    setClearing(true)
    // Delete from DB but keep memory — coach will still remember context via system prompt
    await supabase.from('coach_messages').delete().eq('goal_id', goal.id)
    setMsgs([{ role: 'assistant', content: `Chat cleared! I still remember everything about your goal and journey. What's on your mind today?` }])
    toast.success('Chat cleared — memory kept')
    setClearing(false)
  }

  const send = async (text?: string) => {
    const content = (text || inp).trim()
    if (!content || loading) return
    if (usage.remaining <= 0) { toast.error(`Daily limit reached (${usage.limit}/day). Resets at midnight.`); return }
    setInp('')
    const next = [...msgs, { role: 'user', content }]
    setMsgs(next)
    setLoading(true)
    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, goalId: goal?.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMsgs(m => [...m, { role: 'assistant', content: data.reply }])
      setUsage(u => ({ ...u, used: u.used + 1, remaining: Math.max(0, u.remaining - 1) }))
    } catch (e: any) {
      toast.error(e.message || 'Coach unavailable. Try again.')
    }
    setLoading(false)
  }

  return (
    <div className="fade-up max-w-[760px]">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-[32px] mb-1">AI Coach</h1>
          <p className="text-[14px] text-[#666]">
            {goal ? `Coaching for: "${goal.title}"` : 'Set up a goal to unlock full coaching'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[12px] font-medium px-3 py-1.5 rounded-full ${usage.remaining > 0 ? 'bg-green-50 text-green-700' : 'bg-[#f2f0ec] text-[#999]'}`}>
            {usage.remaining} chats left today
          </span>
          {goal && (
            <button onClick={clearChat} disabled={clearing}
              className="text-[12px] text-[#999] hover:text-[#666] px-3 py-1.5 border border-[#e8e8e8] rounded-full hover:border-[#d0d0d0] transition-colors">
              Clear chat
            </button>
          )}
        </div>
      </div>

      {/* Goal tabs if multiple */}
      {goals.length > 1 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {goals.map(g => (
            <button key={g.id} onClick={() => switchGoal(g)}
              className={`px-4 py-2 rounded-full text-[13px] border transition-all ${goal?.id === g.id ? 'bg-[#111] text-white border-[#111]' : 'bg-white text-[#666] border-[#e8e8e8] hover:border-[#d0d0d0]'}`}>
              {(g.display_title || g.title).slice(0, 28)}
            </button>
          ))}
        </div>
      )}

      <div className="bg-white border border-[#e8e8e8] rounded-2xl overflow-hidden mb-4">
        <div className="px-5 py-4 border-b border-[#e8e8e8] flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#b8922a] flex items-center justify-center text-white font-semibold text-[14px]">M</div>
          <div>
            <p className="text-[13px] font-medium">Manifest Coach</p>
            <p className="text-[11px] text-green-500">● Active</p>
          </div>
          {goal && (
            <div className="ml-auto flex gap-2 text-[11px] text-[#999] flex-wrap justify-end">
              <span className="bg-[#faf3e0] text-[#b8922a] px-2 py-1 rounded-full font-medium">{goal.streak}d streak</span>
              <span className="bg-[#f2f0ec] px-2 py-1 rounded-full">{goal.progress}%</span>
            </div>
          )}
        </div>

        <div className="h-[420px] overflow-y-auto p-5 flex flex-col gap-3">
          {loadingHistory ? (
            <div className="flex items-center gap-2 text-[13px] text-[#999]">
              <div className="w-4 h-4 border-2 border-[#e8e8e8] border-t-[#b8922a] rounded-full spin-anim"/>
              Loading conversation...
            </div>
          ) : msgs.map((m, i) => (
            <div key={i} className={`msg-in flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[82%] px-4 py-3 text-[14px] leading-[1.6] rounded-2xl ${m.role === 'user' ? 'bg-[#111] text-white rounded-br-sm' : 'bg-[#f8f7f5] text-[#111] rounded-bl-sm'}`}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-[#f8f7f5] px-4 py-3 rounded-2xl rounded-bl-sm flex gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#999] bounce-1"/>
                <span className="w-1.5 h-1.5 rounded-full bg-[#999] bounce-2"/>
                <span className="w-1.5 h-1.5 rounded-full bg-[#999] bounce-3"/>
              </div>
            </div>
          )}
          <div ref={endRef}/>
        </div>

        <div className="border-t border-[#e8e8e8] flex">
          <input
            value={inp}
            onChange={e => setInp(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder={usage.remaining > 0 ? "Ask your coach anything..." : "Daily limit reached — resets at midnight"}
            disabled={usage.remaining <= 0}
            className="flex-1 px-5 py-3.5 text-[14px] outline-none bg-transparent disabled:opacity-50"
          />
          <button onClick={() => send()} disabled={loading || !inp.trim() || usage.remaining <= 0}
            className="px-5 bg-[#b8922a] text-white disabled:opacity-40 transition-opacity hover:bg-[#9a7820]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22,2 15,22 11,13 2,9"/></svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {QUICK.map(q => (
          <button key={q} onClick={() => send(q)} disabled={usage.remaining <= 0}
            className="text-left px-4 py-3 bg-white border border-[#e8e8e8] rounded-xl text-[13px] text-[#666] hover:border-[#d0d0d0] hover:text-[#111] transition-all disabled:opacity-40">
            {q}
          </button>
        ))}
      </div>
    </div>
  )
}
