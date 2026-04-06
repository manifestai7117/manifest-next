'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

const AVATARS = [
  'photo-1507003211169-0a1dd7228f2d','photo-1494790108755-2616b612b786',
  'photo-1438761681033-6461ffad8d80','photo-1472099645785-5658abf4ff4e',
  'photo-1500648767791-00dcc994a43e','photo-1573496359142-b8d87734a5a2',
]

export default function CirclesPage() {
  const supabase = createClient()
  const [circles, setCircles] = useState<any[]>([])
  const [myCircleIds, setMyCircleIds] = useState<string[]>([])
  const [activeCircle, setActiveCircle] = useState<any>(null)
  const [msgs, setMsgs] = useState<any[]>([])
  const [inp, setInp] = useState('')
  const [sending, setSending] = useState(false)
  const [user, setUser] = useState<any>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      const { data: c } = await supabase.from('circles').select('*').order('streak', { ascending: false })
      setCircles(c || [])
      const { data: m } = await supabase.from('circle_members').select('circle_id').eq('user_id', user?.id)
      setMyCircleIds(m?.map(x => x.circle_id) || [])
    }
    load()
  }, [])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  const openCircle = async (circle: any) => {
    setActiveCircle(circle)
    const res = await fetch(`/api/circles?circleId=${circle.id}`)
    const data = await res.json()
    if (data.messages?.length) {
      setMsgs(data.messages)
    } else {
      setMsgs([{
        id: 'seed', circle_id: circle.id, sender_name: 'Coach AI', is_ai: true,
        content: `Welcome to ${circle.name}! We're all working toward: ${circle.goal_description}. The group has a ${circle.streak}-day streak going. Share your update and let's keep each other accountable.`,
        created_at: new Date().toISOString()
      }])
    }
  }

  const join = async (circleId: string) => {
    if (!user) return
    const { error } = await supabase.from('circle_members').insert({ circle_id: circleId, user_id: user.id })
    if (error) { toast.error('Could not join circle'); return }
    setMyCircleIds(prev => [...prev, circleId])
    await supabase.from('circles').update({ member_count: (circles.find(c=>c.id===circleId)?.member_count||0)+1 }).eq('id', circleId)
    toast.success('Joined! Welcome to the circle.')
  }

  const sendMsg = async () => {
    if (!inp.trim() || sending || !activeCircle) return
    const text = inp.trim()
    setInp('')
    setSending(true)

    const tempMsg = { id: Date.now().toString(), sender_name: user?.email?.split('@')[0] || 'You', content: text, is_ai: false, created_at: new Date().toISOString(), user_id: user?.id }
    setMsgs(prev => [...prev, tempMsg])

    const res = await fetch('/api/circles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ circleId: activeCircle.id, content: text }),
    })
    const data = await res.json()
    if (res.ok) {
      // Replace temp with real + add AI if present
      setMsgs(prev => {
        const updated = prev.filter(m => m.id !== tempMsg.id)
        updated.push(data.userMessage)
        if (data.aiMessage) updated.push(data.aiMessage)
        return updated
      })
    }
    setSending(false)
  }

  if (activeCircle) {
    const joined = myCircleIds.includes(activeCircle.id)
    return (
      <div className="fade-up max-w-[760px]">
        <button onClick={() => setActiveCircle(null)} className="flex items-center gap-1.5 text-[13px] text-[#666] mb-5 hover:text-[#111] transition-colors">
          ← Back to circles
        </button>
        <div className="mb-5">
          <h1 className="font-serif text-[28px] mb-1">{activeCircle.name}</h1>
          <div className="flex gap-2 items-center flex-wrap">
            <span className="text-[11px] font-medium text-[#b8922a] bg-[#faf3e0] px-2.5 py-1 rounded-full">⚡ {activeCircle.streak}-day streak</span>
            <span className="text-[11px] text-[#666]">{activeCircle.member_count} members</span>
            <span className="text-[11px] text-[#666]">Goal: {activeCircle.goal_description}</span>
            {activeCircle.next_checkin && <span className="text-[11px] text-[#666]">Next call: {activeCircle.next_checkin}</span>}
          </div>
        </div>

        <div className="bg-white border border-[#e8e8e8] rounded-2xl overflow-hidden mb-4">
          <div className="h-[400px] overflow-y-auto p-5 flex flex-col gap-4">
            {msgs.map((m: any) => {
              const isMe = m.user_id === user?.id
              const isAI = m.is_ai
              return (
                <div key={m.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center text-[12px] font-semibold ${isAI ? 'bg-[#b8922a] text-white' : 'bg-[#f2f0ec] text-[#666]'}`}>
                    {isAI ? 'M' : m.sender_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className={`max-w-[78%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                    <p className="text-[11px] text-[#999] mb-1">{isAI ? 'Coach AI' : m.sender_name}</p>
                    <div className={`px-4 py-3 text-[13px] leading-[1.6] rounded-2xl ${isMe ? 'bg-[#111] text-white rounded-br-sm' : isAI ? 'bg-[#faf3e0] text-[#111] rounded-bl-sm border border-[#b8922a]/20' : 'bg-[#f8f7f5] text-[#111] rounded-bl-sm'}`}>
                      {m.content}
                    </div>
                  </div>
                </div>
              )
            })}
            {sending && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-[#b8922a] flex items-center justify-center text-white text-[12px] font-semibold">M</div>
                <div className="bg-[#faf3e0] px-4 py-3 rounded-2xl rounded-bl-sm flex gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#b8922a] bounce-1"/>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#b8922a] bounce-2"/>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#b8922a] bounce-3"/>
                </div>
              </div>
            )}
            <div ref={endRef}/>
          </div>
          {joined ? (
            <div className="border-t border-[#e8e8e8] flex">
              <input value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendMsg()} placeholder="Share your update with the circle..." className="flex-1 px-5 py-3.5 text-[14px] outline-none"/>
              <button onClick={sendMsg} disabled={sending||!inp.trim()} className="px-5 bg-[#111] text-white disabled:opacity-40 hover:bg-[#2a2a2a] transition-colors">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22,2 15,22 11,13 2,9"/></svg>
              </button>
            </div>
          ) : (
            <div className="border-t border-[#e8e8e8] p-4 flex items-center justify-between">
              <p className="text-[13px] text-[#666]">Join this circle to participate</p>
              <button onClick={() => join(activeCircle.id)} className="px-4 py-2 bg-[#111] text-white rounded-xl text-[13px] font-medium hover:bg-[#2a2a2a] transition-colors">Join circle</button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="fade-up max-w-[900px]">
      <h1 className="font-serif text-[32px] mb-1">Goal Circles</h1>
      <p className="text-[14px] text-[#666] mb-8">Matched groups working toward the same goal. Real accountability, real people.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {circles.map((c, i) => {
          const joined = myCircleIds.includes(c.id)
          return (
            <div key={c.id} className="bg-white border border-[#e8e8e8] rounded-2xl p-5 hover:border-[#d0d0d0] transition-all hover-lift">
              <div className="flex justify-between items-start mb-3">
                <span className="text-[10px] font-medium tracking-[.1em] uppercase text-[#999] bg-[#f2f0ec] px-2.5 py-1 rounded-full">{c.category}</span>
                {joined && <span className="text-[10px] font-medium text-green-600 bg-green-50 px-2.5 py-1 rounded-full">Joined</span>}
              </div>
              <h3 className="font-medium text-[15px] mb-1.5">{c.name}</h3>
              <p className="text-[12px] text-[#666] mb-4 leading-[1.5]">{c.goal_description}</p>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex">
                  {AVATARS.slice(i % 3, (i % 3) + 3).map((av, j) => (
                    <div key={j} className="w-7 h-7 rounded-full border-2 border-white overflow-hidden" style={{ marginLeft: j > 0 ? -7 : 0 }}>
                      <img src={`https://images.unsplash.com/${av}?w=56&h=56&fit=crop&crop=face`} alt="" className="w-full h-full object-cover"/>
                    </div>
                  ))}
                </div>
                <span className="text-[12px] text-[#666]">{c.member_count} members</span>
                <span className="text-[11px] text-[#b8922a] font-medium ml-auto">⚡ {c.streak}d</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openCircle(c)} className="flex-1 py-2 text-[12px] font-medium border border-[#e8e8e8] rounded-xl hover:bg-[#f8f7f5] transition-colors">
                  {joined ? 'Open circle' : 'Preview'}
                </button>
                {!joined && (
                  <button onClick={() => join(c.id)} className="flex-1 py-2 text-[12px] font-medium bg-[#111] text-white rounded-xl hover:bg-[#2a2a2a] transition-colors">
                    Join
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
