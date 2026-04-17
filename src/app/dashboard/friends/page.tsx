'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import MediaUploader from '@/components/dashboard/MediaUploader'

export default function FriendsPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [tab, setTab] = useState<'discover'|'friends'|'requests'|'messages'>('discover')
  const [users, setUsers] = useState<any[]>([])
  const [friends, setFriends] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set())
  const [activeChat, setActiveChat] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [sharedCircles, setSharedCircles] = useState<Record<string, any[]>>({})
  const [dmClearedAt, setDmClearedAt] = useState<Record<string, string>>({})
  const [inp, setInp] = useState('')
  const [sending, setSending] = useState(false)
  const [dmMediaUrl, setDmMediaUrl] = useState('')
  const [dmMediaType, setDmMediaType] = useState<'image'|'video'|undefined>()
  const [loading, setLoading] = useState(true)
  const [blockModal, setBlockModal] = useState<any>(null)
  const endRef = useRef<HTMLDivElement>(null)

  const notify = async (userId: string, type: string, title: string, body?: string, link?: string) => {
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, type, title, body, link }),
      })
    } catch {}
  }

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
    if (!user) return

    const [{ data: allUsers }, { data: myFriendships }, { data: blocked }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email, plan, avatar_url').neq('id', user.id).limit(50),
      supabase.from('friendships')
        .select('*, requester_profile:profiles!friendships_requester_fkey(id,full_name,email,plan,avatar_url), addressee_profile:profiles!friendships_addressee_fkey(id,full_name,email,plan,avatar_url)')
        .or(`requester.eq.${user.id},addressee.eq.${user.id}`),
      supabase.from('blocked_users').select('blocked_id').eq('blocker_id', user.id),
    ])

    const bIds = new Set((blocked || []).map((b: any) => b.blocked_id))
    setBlockedIds(bIds)

    const acceptedFriends = (myFriendships || [])
      .filter(f => f.status === 'accepted')
      .map(f => f.requester === user.id ? f.addressee_profile : f.requester_profile)
      .filter(Boolean)
      .filter((f: any) => !bIds.has(f.id))

    const pendingRequests = (myFriendships || [])
      .filter(f => f.status === 'pending' && f.addressee === user.id)
      .map(f => ({ ...f.requester_profile, friendshipId: f.id }))
      .filter((r: any) => !bIds.has(r.id))

    const friendIds = new Set(acceptedFriends.map((f: any) => f?.id))
    const sentPending = new Set(
      (myFriendships || []).filter(f => f.status === 'pending' && f.requester === user.id).map(f => f.addressee)
    )

    const nonFriendUsers = (allUsers || [])
      .filter(u => !friendIds.has(u.id) && !bIds.has(u.id))
      .map(u => ({ ...u, isPending: sentPending.has(u.id) }))

    setUsers(nonFriendUsers)
    setFriends(acceptedFriends.filter(Boolean))
    setRequests(pendingRequests)

    const myCircles = await supabase.from('circle_members').select('circle_id, circle:circles(id,name,category)').eq('user_id', user.id)
    const myCircleIds = new Set((myCircles.data || []).map((m: any) => m.circle_id))
    const shared: Record<string, any[]> = {}
    await Promise.all(acceptedFriends.filter(Boolean).map(async (f: any) => {
      const { data: theirCircles } = await supabase.from('circle_members').select('circle_id, circle:circles(id,name,category)').eq('user_id', f.id)
      const inCommon = (theirCircles || []).filter((m: any) => myCircleIds.has(m.circle_id))
      if (inCommon.length) shared[f.id] = inCommon.map((m: any) => m.circle)
    }))
    setSharedCircles(shared)
    setLoading(false)
  }

  useEffect(() => {
    load()
    if (typeof window !== 'undefined') {
      try { const s = localStorage.getItem('dm_cleared_at'); if (s) setDmClearedAt(JSON.parse(s)) } catch {}
    }
  }, [])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // Realtime DMs
  useEffect(() => {
    if (!activeChat || !user) return
    const channel = supabase
      .channel(`dm-${[user.id, activeChat.id].sort().join('-')}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' },
        (payload) => {
          const newMsg = payload.new as any
          const inConvo = (newMsg.sender_id === user.id && newMsg.recipient_id === activeChat.id) ||
                          (newMsg.sender_id === activeChat.id && newMsg.recipient_id === user.id)
          if (!inConvo) return
          setMessages(prev => prev.find(m => m.id === newMsg.id) ? prev : [...prev, newMsg])
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [activeChat, user])

  // Realtime incoming friend requests
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel(`friend-reqs-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'friendships', filter: `addressee=eq.${user.id}` },
        async (payload) => {
          const newFs = payload.new as any
          if (newFs.status !== 'pending') return
          const { data: prof } = await supabase.from('profiles').select('id,full_name,email,plan,avatar_url').eq('id', newFs.requester).single()
          if (prof) setRequests(prev => prev.find(r => r.friendshipId === newFs.id) ? prev : [...prev, { ...prof, friendshipId: newFs.id }])
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user])

  const sendRequest = async (addresseeId: string) => {
    const { error } = await supabase.from('friendships').insert({ requester: user.id, addressee: addresseeId, status: 'pending' })
    if (error) { toast.error('Could not send request'); return }
    await notify(addresseeId, 'friend_request', 'New friend request', undefined, '/dashboard/friends')
    setUsers(prev => prev.map(u => u.id === addresseeId ? { ...u, isPending: true } : u))
    toast.success('Friend request sent!')
  }

  const cancelRequest = async (addresseeId: string) => {
    await supabase.from('friendships').delete().eq('requester', user.id).eq('addressee', addresseeId).eq('status', 'pending')
    setUsers(prev => prev.map(u => u.id === addresseeId ? { ...u, isPending: false } : u))
    toast.success('Request cancelled')
  }

  const acceptRequest = async (friendshipId: string, fromUser: any) => {
    const { error } = await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId)
    if (error) { toast.error('Could not accept'); return }
    await notify(fromUser.id, 'friend_accept', 'Friend request accepted', undefined, '/dashboard/friends')
    setRequests(prev => prev.filter((r: any) => r.friendshipId !== friendshipId))
    setFriends(prev => [...prev, fromUser])
    setUsers(prev => prev.filter(u => u.id !== fromUser.id))
    toast.success(`You and ${fromUser.full_name} are now friends!`)
  }

  const declineRequest = async (friendshipId: string) => {
    await supabase.from('friendships').delete().eq('id', friendshipId)
    setRequests(prev => prev.filter((r: any) => r.friendshipId !== friendshipId))
  }

  const unfriend = async (friendId: string) => {
    await supabase.from('friendships').delete()
      .or(`and(requester.eq.${user.id},addressee.eq.${friendId}),and(requester.eq.${friendId},addressee.eq.${user.id})`)
    setFriends(prev => prev.filter((f: any) => f.id !== friendId))
    // Immediately add back to discover list — no refresh needed
    const unfriended = friends.find((f: any) => f.id === friendId)
    if (unfriended) setUsers(prev => [...prev, { ...unfriended, isPending: false }])
    if (activeChat?.id === friendId) setActiveChat(null)
    toast.success('Unfriended')
  }

  const confirmBlock = async () => {
    if (!blockModal) return
    const blockedId = blockModal.id
    await supabase.from('blocked_users').upsert({ blocker_id: user.id, blocked_id: blockedId })
    await supabase.from('friendships').delete()
      .or(`and(requester.eq.${user.id},addressee.eq.${blockedId}),and(requester.eq.${blockedId},addressee.eq.${user.id})`)
    setBlockedIds(prev => {
      const next = new Set(prev)
      next.add(blockedId)
      return next
    })
    setUsers(prev => prev.filter(u => u.id !== blockedId))
    setFriends(prev => prev.filter((f: any) => f.id !== blockedId))
    if (activeChat?.id === blockedId) setActiveChat(null)
    setBlockModal(null)
    toast.success(`${blockModal.full_name} blocked`)
  }

  const clearDM = (friendId: string) => {
    const now = new Date().toISOString()
    const updated = { ...dmClearedAt, [friendId]: now }
    setDmClearedAt(updated)
    if (typeof window !== 'undefined') localStorage.setItem('dm_cleared_at', JSON.stringify(updated))
    setMessages([])
    toast.success('Chat cleared')
  }

  const openChat = async (friend: any) => {
    setActiveChat(friend)
    setTab('messages')
    const { data: msgs } = await supabase
      .from('direct_messages').select('*')
      .or(`and(sender_id.eq.${user.id},recipient_id.eq.${friend.id}),and(sender_id.eq.${friend.id},recipient_id.eq.${user.id})`)
      .order('created_at', { ascending: true }).limit(80)
    const cleared = dmClearedAt[friend.id]
    setMessages((msgs || []).filter((m: any) => !cleared || new Date(m.created_at) > new Date(cleared)))
    await supabase.from('direct_messages').update({ read: true }).eq('recipient_id', user.id).eq('sender_id', friend.id)
  }

  const sendDM = async () => {
    if ((!inp.trim() && !dmMediaUrl) || !activeChat || sending) return
    const content = inp.trim()
    const mediaUrl = dmMediaUrl
    const mediaType = dmMediaType
    setInp(''); setDmMediaUrl(''); setDmMediaType(undefined)
    setSending(true)
    const { data: msg } = await supabase.from('direct_messages')
      .insert({ sender_id: user.id, recipient_id: activeChat.id, content: content || null, media_url: mediaUrl || null, media_type: mediaType || null })
      .select().single()
    if (msg) {
      setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg])
      await notify(activeChat.id, 'comment', 'New message', content ? content.slice(0, 80) : 'Sent media', '/dashboard/friends')
    }
    setSending(false)
  }

  const avatarEl = (p: any, size = 10) => (
    p?.avatar_url
      ? <img src={p.avatar_url} alt="" className={`w-${size} h-${size} rounded-full object-cover flex-shrink-0`}/>
      : <div className={`w-${size} h-${size} rounded-full flex items-center justify-center text-[14px] font-semibold text-white flex-shrink-0 ${p?.plan === 'pro' || p?.plan === 'pro_trial' ? 'bg-[#b8922a]' : 'bg-[#888]'}`}>
          {p?.full_name?.[0]?.toUpperCase() || '?'}
        </div>
  )

  return (
    <div className="fade-up max-w-[900px]">
      {/* Block confirm modal */}
      {blockModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl max-w-[380px] w-full p-6 shadow-2xl">
            <div className="text-center mb-5">
              <div className="text-[36px] mb-2">🚫</div>
              <h3 className="font-serif text-[20px] mb-2">Block {blockModal.full_name}?</h3>
              <p className="text-[13px] text-[#666] leading-[1.6]">They won't see your profile or be able to message you. You can unblock from your blocked list.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setBlockModal(null)} className="flex-1 py-2.5 border border-[#e8e8e8] rounded-xl text-[13px]">Cancel</button>
              <button onClick={confirmBlock} className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-[13px] font-medium hover:bg-red-600 transition-colors">Block</button>
            </div>
          </div>
        </div>
      )}

      <h1 className="font-serif text-[32px] mb-1">Friends & Messages</h1>
      <p className="text-[14px] text-[#666] mb-6">Connect with people on the same journey.</p>

      <div className="flex gap-0 mb-6 border-b border-[#e8e8e8] overflow-x-auto">
        {([
          ['discover', 'Discover'],
          ['friends', `Friends (${friends.length})`],
          ['requests', `Requests`],
          ['messages', 'Messages'],
        ] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id as any)}
            className={`px-4 py-3 text-[13px] font-medium border-b-2 whitespace-nowrap transition-all flex items-center gap-1.5 ${tab === id ? 'border-[#111] text-[#111]' : 'border-transparent text-[#999] hover:text-[#666]'}`}>
            {label}
            {id === 'requests' && requests.length > 0 && (
              <span className="w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{requests.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* DISCOVER */}
      {tab === 'discover' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {loading
            ? <div className="col-span-2 text-center py-8 text-[#999] text-[14px]">Loading...</div>
            : users.length === 0
              ? <div className="col-span-2 text-center py-8 text-[#999] text-[14px]">No new people to discover.</div>
              : users.map(u => (
                <div key={u.id} className="bg-white dark:bg-[#1a1a1a] border border-[#e8e8e8] dark:border-[#333] rounded-2xl p-4 flex items-center gap-3">
                  {avatarEl(u)}
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium truncate">{u.full_name}</p>
                    <p className="text-[11px] text-[#999] capitalize">{u.plan === 'pro_trial' ? 'Pro trial' : u.plan}</p>
                  </div>
                  <div className="flex gap-1.5 items-center">
                    {u.isPending
                      ? <button onClick={() => cancelRequest(u.id)} className="text-[11px] font-medium text-[#b8922a] bg-[#faf3e0] px-3 py-1.5 rounded-full hover:bg-[#f5e8c8]">Pending ✕</button>
                      : <button onClick={() => sendRequest(u.id)} className="px-3 py-1.5 bg-[#111] text-white rounded-lg text-[12px] font-medium hover:bg-[#2a2a2a] transition-colors">+ Add</button>
                    }
                    <button onClick={() => setBlockModal(u)} title="Block" className="w-7 h-7 flex items-center justify-center text-[#ccc] hover:text-red-400 rounded-full transition-colors">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                    </button>
                  </div>
                </div>
              ))
          }
        </div>
      )}

      {/* FRIENDS */}
      {tab === 'friends' && (
        <div>
          {friends.length === 0 ? (
            <div className="text-center py-12 text-[#999]">
              <p className="text-[16px] mb-2">No friends yet</p>
              <button onClick={() => setTab('discover')} className="mt-4 px-4 py-2 bg-[#111] text-white rounded-xl text-[13px] font-medium">Discover people →</button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {friends.map((f: any) => (
                <div key={f.id} className="bg-white dark:bg-[#1a1a1a] border border-[#e8e8e8] dark:border-[#333] rounded-2xl p-4">
                  <div className="flex items-center gap-3 mb-2">
                    {avatarEl(f)}
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-medium truncate">{f.full_name}</p>
                      <p className="text-[11px] text-[#999]">{f.plan === 'pro_trial' ? 'Pro trial' : f.plan}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openChat(f)} className="px-3 py-1.5 bg-[#111] text-white rounded-lg text-[12px] font-medium hover:bg-[#2a2a2a] transition-colors">Message</button>
                      <button onClick={() => unfriend(f.id)} className="px-3 py-1.5 border border-[#e8e8e8] rounded-lg text-[12px] text-[#999] hover:border-red-200 hover:text-red-500 transition-colors">Unfriend</button>
                      <button onClick={() => setBlockModal(f)} className="px-3 py-1.5 border border-[#e8e8e8] rounded-lg text-[12px] text-[#999] hover:border-red-200 hover:text-red-500 transition-colors">Block</button>
                    </div>
                  </div>
                  {sharedCircles[f.id]?.length > 0 && (
                    <div className="flex gap-2 flex-wrap mt-1">
                      <span className="text-[11px] text-[#999]">Shared circles:</span>
                      {sharedCircles[f.id].map((c: any) => (
                        <span key={c.id} className="text-[11px] font-medium text-[#b8922a] bg-[#faf3e0] px-2 py-0.5 rounded-full">{c.name}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* REQUESTS */}
      {tab === 'requests' && (
        <div>
          {requests.length === 0
            ? <div className="text-center py-12 text-[#999] text-[14px]">No pending friend requests</div>
            : <div className="flex flex-col gap-3">
                {requests.map((r: any) => (
                  <div key={r.friendshipId} className="bg-white dark:bg-[#1a1a1a] border border-[#e8e8e8] dark:border-[#333] rounded-2xl p-4 flex items-center gap-3">
                    {avatarEl(r)}
                    <div className="flex-1"><p className="text-[14px] font-medium">{r.full_name}</p><p className="text-[12px] text-[#999]">Wants to connect</p></div>
                    <div className="flex gap-2">
                      <button onClick={() => acceptRequest(r.friendshipId, r)} className="px-4 py-2 bg-[#111] text-white rounded-xl text-[13px] font-medium hover:bg-[#2a2a2a] transition-colors">Accept</button>
                      <button onClick={() => declineRequest(r.friendshipId)} className="px-4 py-2 border border-[#e8e8e8] rounded-xl text-[13px] text-[#999] hover:border-red-200 hover:text-red-500 transition-colors">Decline</button>
                    </div>
                  </div>
                ))}
              </div>
          }
        </div>
      )}

      {/* MESSAGES */}
      {tab === 'messages' && (
        <div>
          {!activeChat ? (
            friends.length === 0
              ? <div className="text-center py-12 text-[#999] text-[14px]">Add friends to start messaging</div>
              : <div className="flex flex-col gap-2">
                  <p className="text-[13px] text-[#999] mb-2">Select a friend to message</p>
                  {friends.map((f: any) => (
                    <button key={f.id} onClick={() => openChat(f)} className="flex items-center gap-3 p-4 bg-white dark:bg-[#1a1a1a] border border-[#e8e8e8] dark:border-[#333] rounded-2xl hover:border-[#d0d0d0] transition-all text-left">
                      {avatarEl(f)}
                      <div><p className="text-[14px] font-medium">{f.full_name}</p><p className="text-[12px] text-[#999]">Tap to chat</p></div>
                    </button>
                  ))}
                </div>
          ) : (
            <div className="bg-white dark:bg-[#1a1a1a] border border-[#e8e8e8] dark:border-[#333] rounded-2xl overflow-hidden flex flex-col" style={{ height: 520 }}>
              <div className="px-5 py-3.5 border-b border-[#e8e8e8] dark:border-[#333] flex items-center gap-3 flex-shrink-0">
                <button onClick={() => setActiveChat(null)} className="text-[#999] hover:text-[#111] text-[18px] mr-1">←</button>
                {avatarEl(activeChat)}
                <div className="flex-1"><p className="text-[14px] font-medium">{activeChat.full_name}</p></div>
                <button onClick={() => setBlockModal(activeChat)} className="text-[12px] text-[#999] hover:text-red-500 px-3 py-1.5 border border-[#e8e8e8] rounded-full transition-colors">Block</button>
                <button onClick={() => clearDM(activeChat.id)} className="text-[12px] text-[#999] hover:text-[#666] px-3 py-1.5 border border-[#e8e8e8] rounded-full transition-colors">Clear</button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3 min-h-0">
                {messages.length === 0 && <div className="text-center text-[#999] text-[13px] mt-8">Start the conversation!</div>}
                {messages.map((m: any) => {
                  const isMe = m.sender_id === user?.id
                  return (
                    <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
                        {m.media_url && (
                          <div className={`rounded-2xl overflow-hidden ${isMe ? 'rounded-br-sm' : 'rounded-bl-sm'}`} style={{ maxWidth: 240 }}>
                            {m.media_type === 'video'
                              ? <video src={m.media_url} controls className="w-full max-h-40 object-cover"/>
                              : <img src={m.media_url} alt="" className="w-full max-h-48 object-contain bg-black/5 cursor-pointer" onClick={() => window.open(m.media_url, '_blank')}/>
                            }
                          </div>
                        )}
                        {m.content && (
                          <div className={`px-4 py-2.5 text-[14px] leading-[1.55] rounded-2xl ${isMe ? 'bg-[#111] text-white rounded-br-sm' : 'bg-[#f8f7f5] text-[#111] rounded-bl-sm'}`}>
                            {m.content}
                          </div>
                        )}
                        <div className={`text-[10px] px-1 ${isMe ? 'text-[#bbb]' : 'text-[#ccc]'}`}>
                          {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={endRef}/>
              </div>
              <div className="border-t border-[#e8e8e8] dark:border-[#333] flex-shrink-0">
                {dmMediaUrl && (
                  <div className="px-4 pt-2">
                    <MediaUploader onUpload={(url, t) => { setDmMediaUrl(url); setDmMediaType(t) }} onClear={() => { setDmMediaUrl(''); setDmMediaType(undefined) }} mediaUrl={dmMediaUrl} mediaType={dmMediaType} context="dm"/>
                  </div>
                )}
                <div className="flex items-center gap-2 px-3 py-2">
                  {!dmMediaUrl && (
                    <MediaUploader onUpload={(url, t) => { setDmMediaUrl(url); setDmMediaType(t) }} onClear={() => { setDmMediaUrl(''); setDmMediaType(undefined) }} context="dm"/>
                  )}
                  <input value={inp} onChange={e => setInp(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendDM()}
                    placeholder={`Message ${activeChat.full_name}...`} className="flex-1 px-4 py-3 text-[14px] outline-none bg-transparent"/>
                  <button onClick={sendDM} disabled={(!inp.trim() && !dmMediaUrl) || sending}
                    className="w-9 h-9 bg-[#111] text-white rounded-full flex items-center justify-center disabled:opacity-40 hover:bg-[#2a2a2a] transition-colors flex-shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22,2 15,22 11,13 2,9"/></svg>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}