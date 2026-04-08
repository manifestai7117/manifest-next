'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

export default function FriendsPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [tab, setTab] = useState<'discover'|'friends'|'requests'|'messages'>('discover')
  const [users, setUsers] = useState<any[]>([])
  const [friends, setFriends] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [activeChat, setActiveChat] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [sharedCircles, setSharedCircles] = useState<Record<string, any[]>>({})
  const [dmClearedAt, setDmClearedAt] = useState<Record<string, string>>({})
  const [inp, setInp] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      if (!user) return

      const { data: allUsers } = await supabase
        .from('profiles')
        .select('id, full_name, email, plan, avatar_url')
        .neq('id', user.id)
        .limit(50)

      const { data: myFriendships } = await supabase
        .from('friendships')
        .select('*, requester_profile:profiles!friendships_requester_fkey(id,full_name,email,plan,avatar_url), addressee_profile:profiles!friendships_addressee_fkey(id,full_name,email,plan,avatar_url)')
        .or(`requester.eq.${user.id},addressee.eq.${user.id}`)

      const acceptedFriends = (myFriendships || [])
        .filter(f => f.status === 'accepted')
        .map(f => f.requester === user.id ? f.addressee_profile : f.requester_profile)

      const pendingRequests = (myFriendships || [])
        .filter(f => f.status === 'pending' && f.addressee === user.id)
        .map(f => ({ ...f.requester_profile, friendshipId: f.id }))

      const friendIds = new Set(acceptedFriends.map((f: any) => f?.id))
      const sentIds = new Set((myFriendships || []).map(f => f.requester === user.id ? f.addressee : f.requester))

      // Fix 10: exclude friends from discover
      const nonFriendUsers = (allUsers || [])
        .filter(u => !friendIds.has(u.id))
        .map(u => ({ ...u, isPending: sentIds.has(u.id) }))

      setUsers(nonFriendUsers)
      setFriends(acceptedFriends.filter(Boolean))
      setRequests(pendingRequests)

      // Load shared circles for each friend
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
    load()
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try { const s = localStorage.getItem('dm_cleared_at'); if (s) setDmClearedAt(JSON.parse(s)) } catch {}
    }
  }, [])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // Realtime for DMs
  useEffect(() => {
    if (!activeChat || !user) return
    const channel = supabase
      .channel(`dm-${[user.id, activeChat.id].sort().join('-')}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `recipient_id=eq.${user.id}` },
        (payload) => {
          const newMsg = payload.new as any
          if (newMsg.sender_id !== activeChat.id) return
          setMessages(prev => prev.find(m => m.id === newMsg.id) ? prev : [...prev, newMsg])
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [activeChat, user])

  const sendRequest = async (addresseeId: string) => {
    const { error } = await supabase.from('friendships').insert({ requester: user.id, addressee: addresseeId, status: 'pending' })
    if (error) { toast.error('Could not send request'); return }
    setUsers(prev => prev.map(u => u.id === addresseeId ? { ...u, isPending: true } : u))
    toast.success('Friend request sent!')
  }

  const acceptRequest = async (friendshipId: string, fromUser: any) => {
    const { error } = await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId)
    if (error) { toast.error('Could not accept'); return }
    setRequests(prev => prev.filter((r: any) => r.friendshipId !== friendshipId))
    setFriends(prev => [...prev, fromUser])
    // Remove from discover
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
    toast.success('Unfriended')
  }

  const clearDM = (friendId: string) => {
    const now = new Date().toISOString()
    const updated = { ...dmClearedAt, [friendId]: now }
    setDmClearedAt(updated)
    if (typeof window !== 'undefined') localStorage.setItem('dm_cleared_at', JSON.stringify(updated))
    setMessages([])
    toast.success('Chat cleared from your view')
  }

  const openChat = async (friend: any) => {
    setActiveChat(friend)
    setTab('messages')
    const { data: msgs } = await supabase
      .from('direct_messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},recipient_id.eq.${friend.id}),and(sender_id.eq.${friend.id},recipient_id.eq.${user.id})`)
      .order('created_at', { ascending: true })
      .limit(50)
    const cleared = dmClearedAt[friend.id]
    const visible = (msgs || []).filter((m: any) => !cleared || new Date(m.created_at) > new Date(cleared))
    setMessages(visible)
    await supabase.from('direct_messages').update({ read: true }).eq('recipient_id', user.id).eq('sender_id', friend.id)
  }

  const sendDM = async () => {
    if (!inp.trim() || !activeChat || sending) return
    const content = inp.trim()
    setInp('')
    setSending(true)
    const { data: msg } = await supabase.from('direct_messages').insert({ sender_id: user.id, recipient_id: activeChat.id, content }).select().single()
    if (msg) setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg])
    setSending(false)
  }

  const avatarEl = (profile: any, size = 10) => (
    profile?.avatar_url
      ? <img src={profile.avatar_url} alt="" className={`w-${size} h-${size} rounded-full object-cover flex-shrink-0`}/>
      : <div className={`w-${size} h-${size} rounded-full flex items-center justify-center text-[14px] font-semibold text-white flex-shrink-0 ${profile?.plan === 'pro' || profile?.plan === 'pro_trial' ? 'bg-[#b8922a]' : 'bg-[#888]'}`}>
          {profile?.full_name?.[0]?.toUpperCase() || '?'}
        </div>
  )

  return (
    <div className="fade-up max-w-[900px]">
      <h1 className="font-serif text-[32px] mb-1">Friends & Messages</h1>
      <p className="text-[14px] text-[#666] mb-6">Connect with people on the same journey.</p>

      <div className="flex gap-0 mb-6 border-b border-[#e8e8e8]">
        {([['discover','Discover'],['friends',`Friends (${friends.length})`],['requests',`Requests (${requests.length})`],['messages','Messages']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id as any)}
            className={`px-4 py-3 text-[13px] font-medium border-b-2 transition-all ${tab === id ? 'border-[#111] text-[#111]' : 'border-transparent text-[#999] hover:text-[#666]'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'discover' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {loading ? <div className="col-span-2 text-center py-8 text-[#999] text-[14px]">Loading...</div>
          : users.length === 0 ? <div className="col-span-2 text-center py-8 text-[#999] text-[14px]">No new people to discover right now.</div>
          : users.map(u => (
            <div key={u.id} className="bg-white border border-[#e8e8e8] rounded-2xl p-4 flex items-center gap-3 hover:border-[#d0d0d0] transition-all">
              {avatarEl(u)}
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium truncate">{u.full_name}</p>
                <p className="text-[11px] text-[#999] capitalize">{u.plan === 'pro_trial' ? 'Pro trial' : u.plan} member</p>
              </div>
              {u.isPending
                ? <span className="text-[11px] font-medium text-[#b8922a] bg-[#faf3e0] px-3 py-1 rounded-full">Pending...</span>
                : <button onClick={() => sendRequest(u.id)} className="px-3 py-1.5 bg-[#111] text-white rounded-lg text-[12px] font-medium hover:bg-[#2a2a2a] transition-colors">+ Add</button>
              }
            </div>
          ))}
        </div>
      )}

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
                <div key={f.id} className="bg-white border border-[#e8e8e8] rounded-2xl p-4">
                  <div className="flex items-center gap-3 mb-2">
                    {avatarEl(f)}
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-medium truncate">{f.full_name}</p>
                      <p className="text-[11px] text-[#999] capitalize">{f.plan === 'pro_trial' ? 'Pro trial' : f.plan}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openChat(f)} className="px-3 py-1.5 bg-[#111] text-white rounded-lg text-[12px] font-medium hover:bg-[#2a2a2a] transition-colors">Message</button>
                      <button onClick={() => unfriend(f.id)} className="px-3 py-1.5 border border-[#e8e8e8] rounded-lg text-[12px] text-[#999] hover:border-red-200 hover:text-red-500 transition-colors">Unfriend</button>
                    </div>
                  </div>
                  {/* Shared circles */}
                  {sharedCircles[f.id]?.length > 0 && (
                    <div className="flex gap-2 flex-wrap mt-1 pl-13">
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

      {tab === 'requests' && (
        <div>
          {requests.length === 0
            ? <div className="text-center py-12 text-[#999] text-[14px]">No pending friend requests</div>
            : <div className="flex flex-col gap-3">
                {requests.map((r: any) => (
                  <div key={r.friendshipId} className="bg-white border border-[#e8e8e8] rounded-2xl p-4 flex items-center gap-3">
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

      {tab === 'messages' && (
        <div>
          {!activeChat ? (
            friends.length === 0
              ? <div className="text-center py-12 text-[#999] text-[14px]">Add friends to start messaging</div>
              : <div className="flex flex-col gap-2">
                  <p className="text-[13px] text-[#999] mb-2">Select a friend to message</p>
                  {friends.map((f: any) => (
                    <button key={f.id} onClick={() => openChat(f)} className="flex items-center gap-3 p-4 bg-white border border-[#e8e8e8] rounded-2xl hover:border-[#d0d0d0] transition-all text-left">
                      {avatarEl(f)}
                      <div><p className="text-[14px] font-medium">{f.full_name}</p><p className="text-[12px] text-[#999]">Tap to chat</p></div>
                    </button>
                  ))}
                </div>
          ) : (
            <div className="bg-white border border-[#e8e8e8] rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#e8e8e8] flex items-center gap-3">
                <button onClick={() => setActiveChat(null)} className="text-[#999] hover:text-[#111] text-[18px] mr-1">←</button>
                {avatarEl(activeChat)}
                <div><p className="text-[14px] font-medium">{activeChat.full_name}</p><p className="text-[11px] text-green-500">● Active</p></div>
                <button onClick={() => clearDM(activeChat.id)} className="ml-auto text-[12px] text-[#999] hover:text-[#666] px-3 py-1.5 border border-[#e8e8e8] rounded-full hover:border-[#d0d0d0] transition-colors">Clear</button>
              </div>
              <div className="h-[380px] overflow-y-auto p-5 flex flex-col gap-3">
                {messages.length === 0 && <div className="text-center text-[#999] text-[13px] mt-8">Start the conversation!</div>}
                {messages.map((m: any) => {
                  const isMe = m.sender_id === user?.id
                  return (
                    <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] px-4 py-2.5 text-[14px] leading-[1.55] rounded-2xl ${isMe ? 'bg-[#111] text-white rounded-br-sm' : 'bg-[#f8f7f5] text-[#111] rounded-bl-sm'}`}>
                        {m.content}
                        <div className={`text-[10px] mt-1 ${isMe ? 'text-white/40' : 'text-[#999]'}`}>
                          {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={endRef}/>
              </div>
              <div className="border-t border-[#e8e8e8] flex">
                <input value={inp} onChange={e => setInp(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendDM()}
                  placeholder={`Message ${activeChat.full_name}...`} className="flex-1 px-5 py-3.5 text-[14px] outline-none bg-transparent"/>
                <button onClick={sendDM} disabled={!inp.trim() || sending}
                  className="px-5 bg-[#111] text-white disabled:opacity-40 hover:bg-[#2a2a2a] transition-colors">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22,2 15,22 11,13 2,9"/></svg>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}