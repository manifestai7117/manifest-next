'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import Link from 'next/link'

const QUICK = [
  "How am I tracking against my timeline?",
  "I'm feeling stuck today",
  "Help me plan this week",
  "What should I focus on right now?",
]

export default function CoachPage() {
  const supabase = createClient()
  const [goals, setGoals] = useState<any[]>([])
  const [selectedGoal, setSelectedGoal] = useState<any>(null)
  const [msgs, setMsgs] = useState<{role:string;content:string}[]>([])
  const [inp, setInp] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [usage, setUsage] = useState({ used:0, limit:5, remaining:5, plan:'free' })
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(()=>{
    const load = async () => {
      const {data:{user}} = await supabase.auth.getUser()
      if (!user) return
      const {data:goalList} = await supabase.from('goals').select('*').eq('user_id',user.id).eq('is_active',true).order('created_at',{ascending:false})
      setGoals(goalList||[])
      if (goalList?.length) selectGoal(goalList[0], user.id)

      // Get usage
      const res = await fetch('/api/coach')
      if (res.ok) { const u = await res.json(); setUsage(u) }
    }
    load()
  },[])

  const selectGoal = async (goal:any, userId?:string) => {
    setSelectedGoal(goal)
    setLoadingHistory(true)
    const {data:history} = await supabase.from('coach_messages').select('role,content').eq('goal_id',goal.id).order('created_at',{ascending:true}).limit(40)
    if (history?.length) {
      setMsgs(history)
    } else {
      setMsgs([{role:'assistant',content:`Hey! I'm your coach for "${goal.title}". I've read your why, I know your timeline is ${goal.timeline}, and I know what's been holding you back. What's on your mind today?`}])
    }
    setLoadingHistory(false)
  }

  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:'smooth'}) },[msgs,loading])

  const send = async (text?:string) => {
    const content = (text||inp).trim()
    if (!content||loading||usage.remaining<=0) return
    setInp('')
    const next = [...msgs,{role:'user',content}]
    setMsgs(next)
    setLoading(true)
    try {
      const res = await fetch('/api/coach',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({messages:next,goalId:selectedGoal?.id}),
      })
      const data = await res.json()
      if (res.status===429) {
        toast.error(data.message || 'Daily limit reached')
        setMsgs(m=>m.slice(0,-1))
        setLoading(false)
        return
      }
      if (!res.ok) throw new Error(data.error)
      setMsgs(m=>[...m,{role:'assistant',content:data.reply}])
      if (data.remaining!==undefined) setUsage(u=>({...u,remaining:data.remaining,used:data.used}))
    } catch(e:any) {
      toast.error('Coach unavailable. Try again.')
      setMsgs(m=>m.slice(0,-1))
    }
    setLoading(false)
  }

  const limitColor = usage.remaining<=1 ? 'text-red-500' : usage.remaining<=3 ? 'text-orange-500' : 'text-green-600'

  return (
    <div className="fade-up max-w-[760px]">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-[32px] mb-1">AI Coach</h1>
          <p className="text-[14px] text-[#666]">Your coach knows every goal, every check-in, every pattern.</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[12px] font-medium ${usage.remaining<=1?'border-red-200 bg-red-50 text-red-600':usage.remaining<=3?'border-orange-200 bg-orange-50 text-orange-600':'border-green-200 bg-green-50 text-green-700'}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${usage.remaining<=1?'bg-red-500':usage.remaining<=3?'bg-orange-500':'bg-green-500'}`}/>
          {usage.remaining} {usage.remaining===1?'chat':'chats'} left today
          {usage.plan==='free' && <span className="text-[10px] opacity-70 ml-1">· resets midnight</span>}
        </div>
      </div>

      {/* Goal selector if multiple goals */}
      {goals.length > 1 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {goals.map(g=>(
            <button key={g.id} onClick={()=>selectGoal(g)} className={`px-3 py-1.5 rounded-full text-[12px] border transition-all ${selectedGoal?.id===g.id?'bg-[#111] text-white border-[#111]':'bg-white text-[#666] border-[#e8e8e8] hover:border-[#d0d0d0]'}`}>
              {g.title.length>30?g.title.slice(0,30)+'...':g.title}
            </button>
          ))}
        </div>
      )}

      {/* Upgrade banner for free users near limit */}
      {usage.plan==='free' && usage.remaining<=2 && (
        <div className="bg-[#faf3e0] border border-[#b8922a]/30 rounded-xl p-3 mb-4 flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium text-[#b8922a]">{usage.remaining===0?'Daily limit reached':'Almost at your daily limit'}</p>
            <p className="text-[11px] text-[#666]">Pro plan: 15 chats/day + unlimited goals</p>
          </div>
          <Link href="/dashboard/upgrade" className="px-3 py-1.5 bg-[#b8922a] text-white rounded-lg text-[11px] font-medium hover:bg-[#9a7820] transition-colors whitespace-nowrap">
            Upgrade free →
          </Link>
        </div>
      )}

      <div className="bg-white border border-[#e8e8e8] rounded-2xl overflow-hidden mb-4">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#e8e8e8] flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#b8922a] flex items-center justify-center text-white font-semibold text-[14px]">M</div>
          <div className="flex-1">
            <p className="text-[13px] font-medium">Manifest Coach</p>
            <p className="text-[11px] text-green-500">● Active</p>
          </div>
          {selectedGoal && (
            <div className="flex gap-2 text-[11px]">
              <span className="bg-[#faf3e0] text-[#b8922a] px-2 py-1 rounded-full font-medium">{selectedGoal.streak}d streak</span>
              <span className="bg-[#f2f0ec] text-[#666] px-2 py-1 rounded-full">{selectedGoal.progress}% done</span>
              <span className="bg-[#f2f0ec] text-[#666] px-2 py-1 rounded-full">{selectedGoal.timeline}</span>
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="h-[400px] overflow-y-auto p-5 flex flex-col gap-3">
          {loadingHistory ? (
            <div className="flex items-center gap-2 text-[13px] text-[#999]">
              <div className="w-4 h-4 border-2 border-[#e8e8e8] border-t-[#b8922a] rounded-full spin-anim"/>Loading conversation...
            </div>
          ) : msgs.map((m,i)=>(
            <div key={i} className={`msg-in flex ${m.role==='user'?'justify-end':'justify-start'}`}>
              <div className={`max-w-[82%] px-4 py-3 text-[14px] leading-[1.6] rounded-2xl ${m.role==='user'?'bg-[#111] text-white rounded-br-sm':'bg-[#f8f7f5] text-[#111] rounded-bl-sm'}`}>
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

        {/* Input */}
        {usage.remaining > 0 ? (
          <div className="border-t border-[#e8e8e8] flex">
            <input value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&send()} placeholder="Ask your coach anything..." className="flex-1 px-5 py-3.5 text-[14px] outline-none bg-transparent"/>
            <button onClick={()=>send()} disabled={loading||!inp.trim()} className="px-5 bg-[#b8922a] text-white disabled:opacity-40 transition-opacity hover:bg-[#9a7820]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22,2 15,22 11,13 2,9"/></svg>
            </button>
          </div>
        ) : (
          <div className="border-t border-[#e8e8e8] px-5 py-3.5 flex items-center justify-between bg-[#f8f7f5]">
            <p className="text-[13px] text-[#999]">Daily limit reached — resets at midnight</p>
            {usage.plan==='free' && <Link href="/dashboard/upgrade" className="px-3 py-1.5 bg-[#b8922a] text-white rounded-lg text-[12px] font-medium">Upgrade for more →</Link>}
          </div>
        )}
      </div>

      {/* Quick prompts */}
      {usage.remaining > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {QUICK.map(q=>(
            <button key={q} onClick={()=>send(q)} className="text-left px-4 py-3 bg-white border border-[#e8e8e8] rounded-xl text-[13px] text-[#666] hover:border-[#d0d0d0] hover:text-[#111] transition-all">
              {q}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
