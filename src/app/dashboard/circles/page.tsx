'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

export default function CirclesPage() {
  const supabase = createClient()
  const [circles, setCircles] = useState<any[]>([])
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({})
  const [myCircleIds, setMyCircleIds] = useState<string[]>([])
  const [activeCircle, setActiveCircle] = useState<any>(null)
  const [msgs, setMsgs] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [inp, setInp] = useState('')
  const [sending, setSending] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [showMembers, setShowMembers] = useState(false)
  const [clearedAt, setClearedAt] = useState<Record<string, string>>({})
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      const { data: c } = await supabase.from('circles').select('*').order('created_at', { ascending: false })
      setCircles(c || [])
      const { data: m } = await supabase.from('circle_members').select('circle_id').eq('user_id', user?.id)
      setMyCircleIds(m?.map((x: any) => x.circle_id) || [])
      if (c?.length) {
        const counts: Record<string, number> = {}
        await Promise.all(c.map(async (circle: any) => {
          const { count } = await supabase.from('circle_members').select('*', { count: 'exact', head: true }).eq('circle_id', circle.id)
          counts[circle.id] = count || 0
        }))
        setMemberCounts(counts)
      }
    }
    load()
    // Load cleared timestamps from localStorage
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('circle_cleared_at')
        if (saved) setClearedAt(JSON.parse(saved))
      } catch {}
    }
  }, [])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  // Realtime subscription
  useEffect(() => {
    if (!activeCircle) return
    const channel = supabase
      .channel(`circle-${activeCircle.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'circle_messages', filter: `circle_id=eq.${activeCircle.id}` },
        (payload) => {
          const newMsg = payload.new as any
          if (newMsg.is_system) return // never show system messages
          const cleared = clearedAt[activeCircle.id]
          if (cleared && new Date(newMsg.created_at) <= new Date(cleared)) return
          setMsgs(prev => prev.find(m => m.id === newMsg.id) ? prev : [...prev, newMsg])
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [activeCircle, clearedAt])

  const clearMyView = (circleId: string) => {
    const now = new Date().toISOString()
    const updated = { ...clearedAt, [circleId]: now }
    setClearedAt(updated)
    if (typeof window !== 'undefined') localStorage.setItem('circle_cleared_at', JSON.stringify(updated))
    setMsgs([])
    toast.success('Chat cleared from your view — others still see it')
  }

  const openCircle = async (circle: any) => {
    setActiveCircle(circle)
    setShowMembers(false)
    const res = await fetch(`/api/circles?circleId=${circle.id}`)
    const data = await res.json()
    // Filter by user's cleared timestamp
    const cleared = clearedAt[circle.id]
    const visible = (data.messages || []).filter((m: any) => {
      if (m.is_system) return false
      if (cleared && new Date(m.created_at) <= new Date(cleared)) return false
      return true
    })
    setMsgs(visible.length ? visible : [{
      id: 'seed', circle_id: circle.id, sender_name: 'Manifest Coach', is_ai: true, is_system: false,
      content: `Welcome to ${circle.name}! You're all working toward the same goal. Share an update and let's keep each other accountable.`,
      created_at: new Date().toISOString()
    }])
    // Load members
    const { data: memberData } = await supabase.from('circle_members').select('*, profile:profiles(id,full_name,avatar_url,plan)').eq('circle_id', circle.id)
    setMembers(memberData || [])
  }

  const join = async (circleId: string) => {
    if (!user) return
    const { error } = await supabase.from('circle_members').insert({ circle_id: circleId, user_id: user.id })
    if (error) { toast.error('Could not join circle'); return }
    setMyCircleIds(prev => [...prev, circleId])
    setMemberCounts(prev => ({ ...prev, [circleId]: (prev[circleId] || 0) + 1 }))
    const circle = circles.find(c => c.id === circleId)
    if (circle) {
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
      const name = profile?.full_name || 'A new member'
      // Send icebreaker as system message — API handles it invisibly
      await fetch('/api/circles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ circleId, content: `[SYSTEM: ${name} just joined the circle. Send a warm icebreaker to welcome them and help them introduce themselves.]`, isSystem: true }),
      })
    }
    toast.success('Joined! Welcome to the circle.')
    await openCircle(circles.find(c => c.id === circleId))
  }

  const sendMsg = async () => {
    if (!inp.trim() || sending || !activeCircle) return
    const text = inp.trim()
    setInp('')
    setSending(true)
    await fetch('/api/circles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ circleId: activeCircle.id, content: text }),
    })
    setSending(false)
  }

  if (activeCircle) {
    const joined = myCircleIds.includes(activeCircle.id)
    const memberCount = memberCounts[activeCircle.id] ?? 0
    return (
      <div className="fade-up max-w-[760px]">
        <button onClick={() => { setActiveCircle(null); setShowMembers(false) }} className="flex items-center gap-1.5 text-[13px] text-[#666] mb-5 hover:text-[#111]">
          ← Back to circles
        </button>
        <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
          <div>
            <h1 className="font-serif text-[28px] mb-1">{activeCircle.name}</h1>
            <div className="flex gap-2 items-center flex-wrap text-[12px] text-[#666]">
              <span className="text-[#b8922a] font-medium">{memberCount} member{memberCount !== 1 ? 's' : ''}</span>
              <span>· {activeCircle.goal_description}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => clearMyView(activeCircle.id)}
              className="px-4 py-2 border border-[#e8e8e8] rounded-xl text-[13px] text-[#999] hover:bg-[#f8f7f5] transition-colors">
              Clear my view
            </button>
            <button onClick={() => setShowMembers(!showMembers)}
              className="px-4 py-2 border border-[#e8e8e8] rounded-xl text-[13px] font-medium hover:bg-[#f8f7f5] transition-colors">
              {showMembers ? 'Hide members' : `Members (${memberCount})`}
            </button>
          </div>
        </div>

        {showMembers && members.length > 0 && (
          <div className="bg-white border border-[#e8e8e8] rounded-2xl p-4 mb-4">
            <p className="text-[11px] font-medium tracking-[.1em] uppercase text-[#999] mb-3">Circle members</p>
            <div className="flex flex-wrap gap-3">
              {members.map((m: any) => (
                <div key={m.profile?.id} className="flex items-center gap-2">
                  {m.profile?.avatar_url
                    ? <img src={m.profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0"/>
                    : <div className="w-8 h-8 rounded-full bg-[#b8922a] flex items-center justify-center text-white text-[12px] font-semibold flex-shrink-0">{m.profile?.full_name?.[0]?.toUpperCase() || '?'}</div>
                  }
                  <span className="text-[13px] font-medium">{m.profile?.full_name || 'Member'}</span>
                  {m.profile?.id === activeCircle.created_by && (
                    <span className="text-[10px] text-[#b8922a] bg-[#faf3e0] px-2 py-0.5 rounded-full">Creator</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white border border-[#e8e8e8] rounded-2xl overflow-hidden mb-4">
          <div className="h-[400px] overflow-y-auto p-5 flex flex-col gap-4">
            {msgs.map((m: any) => {
              const isMe = m.user_id === user?.id
              const isAI = m.is_ai
              return (
                <div key={m.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-[12px] font-semibold ${isAI ? 'bg-[#b8922a] text-white' : 'bg-[#f2f0ec] text-[#666]'}`}>
                    {isAI ? 'M' : m.sender_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className={`max-w-[78%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <p className="text-[11px] text-[#999] mb-1">{isAI ? 'Manifest Coach' : m.sender_name}</p>
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
                <div className="bg-[#faf3e0] px-4 py-3 rounded-2xl flex gap-1.5 items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#b8922a] bounce-1"/><span className="w-1.5 h-1.5 rounded-full bg-[#b8922a] bounce-2"/><span className="w-1.5 h-1.5 rounded-full bg-[#b8922a] bounce-3"/>
                </div>
              </div>
            )}
            <div ref={endRef}/>
          </div>
          {joined ? (
            <div className="border-t border-[#e8e8e8] flex">
              <input value={inp} onChange={e => setInp(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMsg()} placeholder="Share your update..." className="flex-1 px-5 py-3.5 text-[14px] outline-none"/>
              <button onClick={sendMsg} disabled={sending || !inp.trim()} className="px-5 bg-[#111] text-white disabled:opacity-40 hover:bg-[#2a2a2a] transition-colors">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22,2 15,22 11,13 2,9"/></svg>
              </button>
            </div>
          ) : (
            <div className="border-t border-[#e8e8e8] p-4 flex items-center justify-between">
              <p className="text-[13px] text-[#666]">Join to participate</p>
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
      <p className="text-[14px] text-[#666] mb-8">Groups working toward the same goal. Real accountability.</p>
      {circles.length === 0 ? (
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-8 text-center">
          <p className="text-[#666] text-[14px]">No circles yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {circles.map((c: any) => {
            const joined = myCircleIds.includes(c.id)
            const count = memberCounts[c.id] ?? 0
            return (
              <div key={c.id} className="bg-white border border-[#e8e8e8] rounded-2xl p-5 hover:border-[#d0d0d0] transition-all hover-lift">
                <div className="flex justify-between items-start mb-3">
                  <span className="text-[10px] font-medium tracking-[.1em] uppercase text-[#999] bg-[#f2f0ec] px-2.5 py-1 rounded-full">{c.category}</span>
                  {joined && <span className="text-[10px] font-medium text-green-600 bg-green-50 px-2.5 py-1 rounded-full">Joined ✓</span>}
                </div>
                <h3 className="font-medium text-[15px] mb-1.5">{c.name}</h3>
                <p className="text-[12px] text-[#666] mb-3 leading-[1.5]">{c.goal_description}</p>
                <p className="text-[11px] text-[#999] mb-4">{count} member{count !== 1 ? 's' : ''}</p>
                <div className="flex gap-2">
                  <button onClick={() => openCircle(c)} className="flex-1 py-2 text-[12px] font-medium border border-[#e8e8e8] rounded-xl hover:bg-[#f8f7f5] transition-colors">
                    {joined ? 'Open' : 'Preview'}
                  </button>
                  {!joined && (
                    <button onClick={() => join(c.id)} className="flex-1 py-2 text-[12px] font-medium bg-[#111] text-white rounded-xl hover:bg-[#2a2a2a] transition-colors">Join</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}