'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import MemberProfile from '@/components/dashboard/MemberProfile'
import MediaUploader from '@/components/dashboard/MediaUploader'

const CATEGORIES = ['All','Health & fitness','Career & business','Financial freedom','Learning & skills','Personal growth','Travel & adventure','Creative work','Other']

export default function CirclesPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [myCircles, setMyCircles] = useState<any[]>([])
  const [allCircles, setAllCircles] = useState<any[]>([])
  const [myCircleIds, setMyCircleIds] = useState<string[]>([])
  const [requestedIds, setRequestedIds] = useState<string[]>([])
  const [tab, setTab] = useState<'my'|'discover'>('my')
  const [activeCircle, setActiveCircle] = useState<any>(null)
  const [msgs, setMsgs] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [inp, setInp] = useState('')
  const [sending, setSending] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const [viewingMember, setViewingMember] = useState<string|null>(null)
  const [filterCat, setFilterCat] = useState('All')
  const [memberCounts, setMemberCounts] = useState<Record<string,number>>({})
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newCircle, setNewCircle] = useState({ name: '', category: '', goal_description: '', is_private: false })
  const [joining, setJoining] = useState<string|null>(null)
  const [circleMediaUrl, setCircleMediaUrl] = useState('')
  const [circleMediaType, setCircleMediaType] = useState<'image'|'video'|undefined>()
  const [leaving, setLeaving] = useState<string|null>(null)
  const [clearedAt, setClearedAt] = useState<Record<string,string>>({})
  const [confirmLeave, setConfirmLeave] = useState<string|null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      if (!user) return
      const [{ data: prof }, { data: all }, { data: mc }, { data: reqs }] = await Promise.all([
        supabase.from('profiles').select('plan').eq('id', user.id).single(),
        supabase.from('circles').select('*').order('created_at', { ascending: false }),
        supabase.from('circle_members').select('circle_id').eq('user_id', user.id),
        supabase.from('circle_requests').select('circle_id').eq('user_id', user.id).eq('status', 'pending'),
      ])
      setProfile(prof)
      const ids = (mc || []).map((m: any) => m.circle_id)
      setMyCircleIds(ids)
      setRequestedIds((reqs || []).map((r: any) => r.circle_id))
      const mine = (all || []).filter((c: any) => ids.includes(c.id))
      setMyCircles(mine)
      setAllCircles(all || [])
      const counts: Record<string,number> = {}
      await Promise.all((all || []).map(async (c: any) => {
        const { count } = await supabase.from('circle_members').select('*', { count: 'exact', head: true }).eq('circle_id', c.id)
        counts[c.id] = count || 0
      }))
      setMemberCounts(counts)
      if (typeof window !== 'undefined') {
        try { const s = localStorage.getItem('circle_cleared_at'); if (s) setClearedAt(JSON.parse(s)) } catch {}
      }
    }
    load()
  }, [])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  // Supabase Realtime for circle messages
  useEffect(() => {
    if (!activeCircle || !user) return

    const channel = supabase
      .channel(`circle-messages-${activeCircle.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'circle_messages',
          filter: `circle_id=eq.${activeCircle.id}`,
        },
        async (payload) => {
          const newMsg = payload.new as any
          // Skip if we already have this message (sent by us via sendMsg)
          setMsgs(prev => {
            if (prev.find(m => m.id === newMsg.id)) return prev
            return prev // hold off until we fetch the full row with profile + media
          })
          // Always fetch the full row — payload.new doesn't include joined columns
          const { data: fullMsg } = await supabase
            .from('circle_messages')
            .select('*, profiles:profiles(id, full_name, avatar_url)')
            .eq('id', newMsg.id)
            .single()
          if (fullMsg) {
            setMsgs(prev => prev.find(m => m.id === fullMsg.id) ? prev : [...prev, fullMsg])
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [activeCircle, user])

  const openCircle = async (circle: any) => {
    setActiveCircle(circle)
    setShowMembers(false)
    const { data: history } = await supabase
      .from('circle_messages')
      .select('*, profiles:profiles(id, full_name, avatar_url)')
      .eq('circle_id', circle.id)
      .order('created_at', { ascending: true })
      .limit(80)
    const cleared = clearedAt[circle.id]
    const filtered = (history || []).filter((m: any) => !cleared || new Date(m.created_at) > new Date(cleared))
    setMsgs(filtered)
    const { data: mems } = await supabase.from('circle_members').select('*, profiles:profiles(id, full_name, avatar_url, plan)').eq('circle_id', circle.id)
    setMembers(mems || [])
  }

  const join = async (circle: any) => {
    if (!user || joining) return
    setJoining(circle.id)
    if (circle.is_private) {
      const { error } = await supabase.from('circle_requests').insert({ circle_id: circle.id, user_id: user.id })
      if (!error) {
        setRequestedIds(prev => [...prev, circle.id])
        toast.success('Request sent! Waiting for approval.')
      }
      setJoining(null)
      return
    }
    const { error } = await supabase.from('circle_members').insert({ circle_id: circle.id, user_id: user.id })
    if (error) { toast.error('Could not join'); setJoining(null); return }
    setMyCircleIds(prev => [...prev, circle.id])
    setMyCircles(prev => [circle, ...prev])
    setMemberCounts(prev => ({ ...prev, [circle.id]: (prev[circle.id] || 0) + 1 }))
    toast.success('Joined!')
    setTab('my')
    await openCircle(circle)
    setJoining(null)
  }

  const leaveCircle = async (circleId: string) => {
    if (!user) return
    if (confirmLeave !== circleId) { setConfirmLeave(circleId); return }
    setLeaving(circleId)
    await supabase.from('circle_members').delete().eq('circle_id', circleId).eq('user_id', user.id)
    setMyCircleIds(prev => prev.filter(id => id !== circleId))
    setMyCircles(prev => prev.filter(c => c.id !== circleId))
    if (activeCircle?.id === circleId) setActiveCircle(null)
    setLeaving(null)
    setConfirmLeave(null)
    toast.success('Left circle')
  }

  const clearMyView = (circleId: string) => {
    const now = new Date().toISOString()
    const updated = { ...clearedAt, [circleId]: now }
    setClearedAt(updated)
    localStorage.setItem('circle_cleared_at', JSON.stringify(updated))
    setMsgs([])
    toast.success('View cleared')
  }

  const sendMsg = async () => {
    if ((!inp.trim() && !circleMediaUrl) || sending || !activeCircle || !user) return
    const text = inp.trim()
    const mediaUrl = circleMediaUrl
    const mediaType = circleMediaType
    setInp('')
    setCircleMediaUrl('')
    setCircleMediaType(undefined)
    setSending(true)

    const res = await fetch('/api/circles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        circleId: activeCircle.id,
        content: text || null,
        media_url: mediaUrl || null,
        media_type: mediaType || null,
      }),
    })

    if (res.ok) {
      const data = await res.json()
      // Add the real message (with correct id + media fields) from the server response
      const savedMsg = data.message || data.userMessage
      if (savedMsg) {
        setMsgs(prev => prev.find(m => m.id === savedMsg.id) ? prev : [...prev, savedMsg])
      }
      // Add AI reply if present
      if (data.aiMessage) {
        setMsgs(prev => prev.find(m => m.id === data.aiMessage.id) ? prev : [...prev, data.aiMessage])
      }
    } else {
      toast.error('Failed to send message')
    }

    setSending(false)
  }

  const createCircle = async () => {
    if (!newCircle.name.trim() || !newCircle.category || !newCircle.goal_description.trim() || creating) return
    setCreating(true)
    const { data, error } = await supabase.from('circles').insert({
      name: newCircle.name.trim(),
      category: newCircle.category,
      goal_description: newCircle.goal_description.trim(),
      is_private: newCircle.is_private,
      created_by: user.id,
      member_count: 1,
    }).select().single()
    if (error || !data) { toast.error('Could not create circle'); setCreating(false); return }
    await supabase.from('circle_members').insert({ circle_id: data.id, user_id: user.id })
    setMyCircles(prev => [data, ...prev])
    setMyCircleIds(prev => [...prev, data.id])
    setAllCircles(prev => [data, ...prev])
    setMemberCounts(prev => ({ ...prev, [data.id]: 1 }))
    setNewCircle({ name: '', category: '', goal_description: '', is_private: false })
    setShowCreate(false)
    setCreating(false)
    toast.success('Circle created!')
    await openCircle(data)
  }

  const isPro = profile?.plan === 'pro' || profile?.plan === 'pro_trial'

  // Active circle chat view
  if (activeCircle) {
    const joined = myCircleIds.includes(activeCircle.id)
    const count = memberCounts[activeCircle.id] ?? 0
    return (
      <div className="fade-up max-w-[760px]">
        {/* Leave confirm modal */}
        {confirmLeave && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6">
            <div className="bg-white rounded-2xl max-w-[380px] w-full p-6 shadow-2xl">
              <h3 className="font-serif text-[20px] mb-2">Leave this circle?</h3>
              <p className="text-[13px] text-[#666] mb-5">You can rejoin anytime. Your previous messages will remain.</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmLeave(null)} className="flex-1 py-2.5 border border-[#e8e8e8] rounded-xl text-[13px]">Cancel</button>
                <button onClick={() => leaveCircle(confirmLeave)} className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-[13px] font-medium hover:bg-red-600">Leave</button>
              </div>
            </div>
          </div>
        )}

        <button onClick={() => setActiveCircle(null)} className="flex items-center gap-1.5 text-[13px] text-[#666] mb-5 hover:text-[#111]">← Back to circles</button>

        <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="font-serif text-[26px]">{activeCircle.name}</h1>
              {activeCircle.is_private && <span className="text-[10px] bg-[#f2f0ec] text-[#666] px-2 py-0.5 rounded-full">🔒 Private</span>}
            </div>
            <p className="text-[13px] text-[#666]"><span className="text-[#b8922a] font-medium">{count} members</span> · {activeCircle.goal_description}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => clearMyView(activeCircle.id)} className="px-3 py-2 border border-[#e8e8e8] rounded-xl text-[12px] text-[#999] hover:bg-[#f8f7f5]">Clear view</button>
            <button onClick={() => setShowMembers(!showMembers)} className="px-3 py-2 border border-[#e8e8e8] rounded-xl text-[12px] font-medium hover:bg-[#f8f7f5]">Members ({count})</button>
            {joined && (
              <button
                onClick={() => setConfirmLeave(activeCircle.id)}
                className="px-3 py-2 border border-red-200 text-red-500 rounded-xl text-[12px] hover:bg-red-50 transition-colors"
              >
                Leave
              </button>
            )}
          </div>
        </div>

        {showMembers && members.length > 0 && (
          <div className="bg-white border border-[#e8e8e8] rounded-2xl p-4 mb-4">
            <p className="font-medium text-[13px] mb-3">Members</p>
            <div className="flex flex-wrap gap-2">
              {members.map((m: any) => (
                <button key={m.id} onClick={() => setViewingMember(m.profiles?.id || m.user_id)} className="flex items-center gap-2 px-3 py-1.5 bg-[#f8f7f5] rounded-xl hover:bg-[#f0ede8] transition-colors">
                  {m.profiles?.avatar_url
                    ? <img src={m.profiles.avatar_url} className="w-6 h-6 rounded-full object-cover"/>
                    : <div className="w-6 h-6 rounded-full bg-[#b8922a] flex items-center justify-center text-white text-[10px]">{m.profiles?.full_name?.[0]}</div>
                  }
                  <span className="text-[12px] font-medium">{m.profiles?.full_name || 'Member'}</span>
                  {m.profiles?.plan === 'pro' && <span className="text-[9px] bg-[#b8922a] text-white px-1.5 py-0.5 rounded-full">PRO</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chat box */}
        <div className="bg-white border border-[#e8e8e8] rounded-2xl overflow-hidden flex flex-col" style={{ height: 520 }}>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-0">
            {msgs.length === 0 && <p className="text-center text-[#999] text-[13px] py-8">No messages yet. Be the first!</p>}
            {msgs.map((m: any) => {
              const isMe = m.user_id === user?.id
              const isAI = m.user_id === 'ai'
              return (
                <div key={m.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                  {!isMe && (
                    <button onClick={() => !isAI && setViewingMember(m.profiles?.id || m.user_id)}>
                      {m.profiles?.avatar_url
                        ? <img src={m.profiles.avatar_url} className="w-8 h-8 rounded-full object-cover flex-shrink-0"/>
                        : <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[12px] font-semibold ${isAI ? 'bg-[#b8922a]' : 'bg-[#666]'}`}>{isAI ? 'M' : m.profiles?.full_name?.[0] || '?'}</div>
                      }
                    </button>
                  )}
                  <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                    {!isMe && <p className="text-[11px] text-[#999] px-1">{isAI ? 'Manifest Coach' : m.profiles?.full_name}</p>}
                    <div className={`rounded-2xl overflow-hidden ${isMe ? 'bg-[#111] text-white rounded-tr-sm' : isAI ? 'bg-[#faf3e0] text-[#111] rounded-tl-sm' : 'bg-[#f8f7f5] text-[#111] rounded-tl-sm'}`}>
                      {m.media_url && (
                        <div>
                          {m.media_type === 'video'
                            ? <video src={m.media_url} controls className="w-full max-h-40 object-cover"/>
                            : <img src={m.media_url} alt="" className="w-full max-h-40 object-cover cursor-pointer" onClick={() => window.open(m.media_url, '_blank')}/>
                          }
                        </div>
                      )}
                      {m.content && m.content !== '📎' && <p className="px-4 py-2.5 text-[14px] leading-[1.6]">{m.content}</p>}
                    </div>
                    <p className="text-[10px] text-[#bbb] px-1">
                      {new Date(m.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              )
            })}
            {sending && (
              <div className="flex gap-3 flex-row-reverse">
                <div className="bg-[#f8f7f5] px-4 py-3 rounded-2xl flex gap-1.5 items-center rounded-tr-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#b8922a] bounce-1"/><span className="w-1.5 h-1.5 rounded-full bg-[#b8922a] bounce-2"/><span className="w-1.5 h-1.5 rounded-full bg-[#b8922a] bounce-3"/>
                </div>
              </div>
            )}
            <div ref={endRef}/>
          </div>

          {/* Input area */}
          {joined ? (
            <div className="border-t border-[#e8e8e8] flex-shrink-0">
              {/* Media preview */}
              {circleMediaUrl && (
                <div className="px-4 pt-2">
                  <MediaUploader
                    onUpload={(url, t) => { setCircleMediaUrl(url); setCircleMediaType(t) }}
                    onClear={() => { setCircleMediaUrl(''); setCircleMediaType(undefined) }}
                    mediaUrl={circleMediaUrl}
                    mediaType={circleMediaType}
                    context="circle"
                  />
                </div>
              )}
              <div className="flex items-center gap-2 px-3 py-2">
                {!circleMediaUrl && (
                  <MediaUploader
                    onUpload={(url, t) => { setCircleMediaUrl(url); setCircleMediaType(t) }}
                    onClear={() => { setCircleMediaUrl(''); setCircleMediaType(undefined) }}
                    context="circle"
                  />
                )}
                <input
                  value={inp}
                  onChange={e => setInp(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMsg()}
                  placeholder="Share your update..."
                  className="flex-1 px-4 py-3 text-[14px] outline-none bg-transparent"
                />
                <button
                  onClick={sendMsg}
                  disabled={sending || (!inp.trim() && !circleMediaUrl)}
                  className="w-9 h-9 bg-[#111] text-white rounded-full flex items-center justify-center disabled:opacity-40 hover:bg-[#2a2a2a] transition-colors flex-shrink-0"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22,2 15,22 11,13 2,9"/>
                  </svg>
                </button>
              </div>
            </div>
          ) : (
            <div className="border-t border-[#e8e8e8] p-4 flex items-center justify-between flex-shrink-0">
              <p className="text-[13px] text-[#666]">Join to participate</p>
              <button onClick={() => join(activeCircle)} disabled={joining === activeCircle.id} className="px-4 py-2 bg-[#111] text-white rounded-xl text-[13px] font-medium hover:bg-[#2a2a2a] disabled:opacity-50">
                {joining === activeCircle.id ? 'Joining...' : 'Join circle'}
              </button>
            </div>
          )}
        </div>

        {viewingMember && user && <MemberProfile userId={viewingMember} currentUserId={user.id} onClose={() => setViewingMember(null)}/>}
      </div>
    )
  }

  const filteredDiscover = allCircles.filter(c =>
    !myCircleIds.includes(c.id) &&
    (filterCat === 'All' || c.category === filterCat)
  )

  return (
    <div className="fade-up max-w-[900px]">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-[32px] mb-0.5">Goal Circles</h1>
          <p className="text-[13px] text-[#666]">Your accountability community</p>
        </div>
        {isPro && (
          <button onClick={() => setShowCreate(!showCreate)} className="px-4 py-2.5 bg-[#111] text-white rounded-xl text-[13px] font-medium hover:bg-[#2a2a2a] transition-colors">
            + Create circle
          </button>
        )}
      </div>

      <div className="flex gap-1 p-1 bg-[#f2f0ec] rounded-xl mb-5 w-fit">
        <button onClick={() => setTab('my')} className={`px-5 py-2 rounded-lg text-[13px] font-medium transition-all ${tab === 'my' ? 'bg-white shadow-sm text-[#111]' : 'text-[#666]'}`}>
          My Circles {myCircles.length > 0 && `(${myCircles.length})`}
        </button>
        <button onClick={() => setTab('discover')} className={`px-5 py-2 rounded-lg text-[13px] font-medium transition-all ${tab === 'discover' ? 'bg-white shadow-sm text-[#111]' : 'text-[#666]'}`}>
          Discover {allCircles.filter(c => !myCircleIds.includes(c.id)).length > 0 && `(${allCircles.filter(c => !myCircleIds.includes(c.id)).length})`}
        </button>
      </div>

      {showCreate && isPro && (
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 mb-5">
          <p className="font-medium text-[15px] mb-4">Create a new circle</p>
          <div className="space-y-3">
            <input value={newCircle.name} onChange={e => setNewCircle(p => ({ ...p, name: e.target.value }))} placeholder="Circle name" className="w-full border border-[#e8e8e8] rounded-xl px-3.5 py-2.5 text-[14px] outline-none focus:border-[#111]"/>
            <select value={newCircle.category} onChange={e => setNewCircle(p => ({ ...p, category: e.target.value }))} className="w-full border border-[#e8e8e8] rounded-xl px-3.5 py-2.5 text-[14px] outline-none focus:border-[#111]">
              <option value="">Select category...</option>
              {CATEGORIES.slice(1).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <textarea value={newCircle.goal_description} onChange={e => setNewCircle(p => ({ ...p, goal_description: e.target.value }))} placeholder="What shared goal does this circle work toward?" className="w-full border border-[#e8e8e8] rounded-xl px-3.5 py-2.5 text-[14px] outline-none focus:border-[#111] resize-none" rows={2}/>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <div onClick={() => setNewCircle(p => ({ ...p, is_private: !p.is_private }))} className={`w-10 h-6 rounded-full transition-colors relative ${newCircle.is_private ? 'bg-[#b8922a]' : 'bg-[#e8e8e8]'}`}>
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${newCircle.is_private ? 'right-1' : 'left-1'}`}/>
              </div>
              <span className="text-[13px] text-[#666]">🔒 Private circle (members request to join)</span>
            </label>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 border border-[#e8e8e8] rounded-xl text-[13px] text-[#666]">Cancel</button>
              <button onClick={createCircle} disabled={creating || !newCircle.name || !newCircle.category || !newCircle.goal_description} className="px-4 py-2 bg-[#111] text-white rounded-xl text-[13px] font-medium disabled:opacity-40">{creating ? 'Creating...' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}

      {tab === 'my' && (
        myCircles.length === 0 ? (
          <div className="bg-white border border-[#e8e8e8] rounded-2xl p-10 text-center">
            <p className="text-[40px] mb-3">◉</p>
            <p className="font-medium text-[16px] mb-2">No circles yet</p>
            <p className="text-[14px] text-[#666] mb-5">Discover circles to find your accountability community.</p>
            <button onClick={() => setTab('discover')} className="px-5 py-2.5 bg-[#111] text-white rounded-xl text-[13px] font-medium">Discover circles →</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myCircles.map(c => (
              <div key={c.id} className="bg-white border border-[#e8e8e8] rounded-2xl p-5 hover:border-[#d0d0d0] transition-all">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-[10px] font-medium tracking-[.1em] uppercase text-[#999] bg-[#f2f0ec] px-2.5 py-1 rounded-full">{c.category}</span>
                  <div className="flex items-center gap-1.5">
                    {c.is_private && <span className="text-[10px] text-[#666]">🔒</span>}
                    <span className="text-[10px] font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Joined ✓</span>
                  </div>
                </div>
                <h3 className="font-medium text-[15px] mb-1">{c.name}</h3>
                <p className="text-[12px] text-[#666] mb-3 leading-[1.5]">{c.goal_description}</p>
                <p className="text-[11px] text-[#999] mb-4">{memberCounts[c.id] || 0} members</p>
                <div className="flex gap-2">
                  <button onClick={() => openCircle(c)} className="flex-1 py-2 text-[12px] font-medium bg-[#111] text-white rounded-xl hover:bg-[#2a2a2a] transition-colors">Open →</button>
                  <button onClick={() => leaveCircle(c.id)} disabled={leaving === c.id} className="px-3 py-2 border border-red-200 text-red-500 rounded-xl text-[12px] hover:bg-red-50 transition-colors disabled:opacity-50">Leave</button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'discover' && (
        <div>
          <div className="flex gap-2 mb-4 flex-wrap">
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setFilterCat(cat)}
                className={`px-3.5 py-1.5 rounded-full text-[12px] border transition-all ${filterCat === cat ? 'bg-[#111] text-white border-[#111]' : 'bg-white text-[#666] border-[#e8e8e8]'}`}>
                {cat}
              </button>
            ))}
          </div>
          {filteredDiscover.length === 0 ? (
            <div className="bg-white border border-[#e8e8e8] rounded-2xl p-10 text-center">
              <p className="text-[14px] text-[#666]">No circles available in this category yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDiscover.map(c => {
                const requested = requestedIds.includes(c.id)
                return (
                  <div key={c.id} className="bg-white border border-[#e8e8e8] rounded-2xl p-5 hover:border-[#d0d0d0] transition-all flex flex-col">
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-[10px] font-medium tracking-[.1em] uppercase text-[#999] bg-[#f2f0ec] px-2.5 py-1 rounded-full">{c.category}</span>
                      {c.is_private && <span className="text-[11px] text-[#666] bg-[#f2f0ec] px-2 py-0.5 rounded-full">🔒 Private</span>}
                    </div>
                    <h3 className="font-medium text-[15px] mb-1">{c.name}</h3>
                    <p className="text-[12px] text-[#666] leading-[1.55] mb-3 flex-1">{c.goal_description}</p>
                    <p className="text-[11px] text-[#999] mb-4">{memberCounts[c.id] || 0} members</p>
                    {requested ? (
                      <div className="w-full py-2.5 text-center text-[12px] font-medium text-[#b8922a] bg-[#faf3e0] rounded-xl">Requested to join ⏳</div>
                    ) : (
                      <button onClick={() => join(c)} disabled={joining === c.id}
                        className="w-full py-2.5 text-[12px] font-medium bg-[#111] text-white rounded-xl hover:bg-[#2a2a2a] transition-colors disabled:opacity-50">
                        {joining === c.id ? 'Joining...' : c.is_private ? '🔒 Request to join' : 'Join circle'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}