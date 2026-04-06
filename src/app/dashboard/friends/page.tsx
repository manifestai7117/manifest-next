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
  const [conversations, setConversations] = useState<any[]>([])
  const [activeChat, setActiveChat] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [inp, setInp] = useState('')
  const [loading, setLoading] = useState(true)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      if (!user) return

      // Load all users except self
      const { data: allUsers } = await supabase
        .from('profiles')
        .select('id, full_name, email, plan')
        .neq('id', user.id)
        .limit(50)

      // Load my friendships
      const { data: myFriendships } = await supabase
        .from('friendships')
        .select('*, requester_profile:profiles!friendships_requester_fkey(id,full_name,email), addressee_profile:profiles!friendships_addressee_fkey(id,full_name,email)')
        .or(`requester.eq.${user.id},addressee.eq.${user.id}`)

      const acceptedFriends = (myFriendships || [])
        .filter(f => f.status === 'accepted')
        .map(f => f.requester === user.id ? f.addressee_profile : f.requester_profile)

      const pendingRequests = (myFriendships || [])
        .filter(f => f.status === 'pending' && f.addressee === user.id)
        .map(f => ({ ...f.requester_profile, friendshipId: f.id }))

      const sentIds = new Set((myFriendships || []).map(f => f.requester === user.id ? f.addressee : f.requester))
      const friendIds = new Set(acceptedFriends.map((f: any) => f?.id))

      // Mark status on all users
      const usersWithStatus = (allUsers || []).map(u => ({
        ...u,
        isFriend: friendIds.has(u.id),
        isPending: sentIds.has(u.id) && !friendIds.has(u.id),
      }))

      setUsers(usersWithStatus)
      setFriends(acceptedFriends.filter(Boolean))
      setRequests(pendingRequests)
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

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
    toast.success(`You and ${fromUser.full_name} are now friends!`)
  }

  const declineRequest = async (friendshipId: string) => {
    await supabase.from('friendships').delete().eq('id', friendshipId)
    setRequests(prev => prev.filter((r: any) => r.friendshipId !== friendshipId))
    toast.success('Request declined')
  }

  const unfriend = async (friendId: string) => {
    await supabase.from('friendships').delete()
      .or(`and(requester.eq.${user.id},addressee.eq.${friendId}),and(requester.eq.${friendId},addressee.eq.${user.id})`)
    setFriends(prev => prev.filter((f: any) => f.id !== friendId))
    toast.success('Unfriended')
  }

  const openChat = async (friend: any) => {
    setActiveChat(friend)
    setTab('messages')
    // Load DM history
    const { data: msgs } = await supabase
      .from('direct_messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},recipient_id.eq.${friend.id}),and(sender_id.eq.${friend.id},recipient_id.eq.${user.id})`)
      .order('created_at', { ascending: true })
      .limit(50)
    setMessages(msgs || [])

    // Mark as read
    await supabase.from('direct_messages')
      .update({ read: true })
      .eq('recipient_id', user.id)
      .eq('sender_id', friend.id)
  }

  const sendDM = async () => {
    if (!inp.trim() || !activeChat) return
    const content = inp.trim()
    setInp('')

    const { data: msg } = await supabase.from('direct_messages').insert({
      sender_id: user.id,
      recipient_id: activeChat.id,
      content,
    }).select().single()

    if (msg) setMessages(prev => [...prev, msg])
  }

  const avatar = (name: string, plan?: string) => (
    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-semibold text-white flex-shrink-0 ${plan === 'pro' ? 'bg-[#b8922a]' : plan === 'elite' ? 'bg-[#111]' : 'bg-[#888]'}`}>
      {name?.[0]?.toUpperCase() || '?'}
    </div>
  )

  return (
    <div className="fade-up max-w-[900px]">
      <h1 className="font-serif text-[32px] mb-1">Friends & Messages</h1>
      <p className="text-[14px] text-[#666] mb-6">Connect with people on the same journey. Friends can DM each other.</p>

      {/* Tabs */}
      <div className="flex gap-0 mb-6 border-b border-[#e8e8e8]">
        {([
          ['discover', 'Discover People'],
          ['friends', `Friends (${friends.length})`],
          ['requests', `Requests (${requests.length})`],
          ['messages', 'Messages'],
        ] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id as any)}
            className={`px-5 py-3 text-[13px] font-medium border-b-2 transition-all ${tab === id ? 'border-[#111] text-[#111]' : 'border-transparent text-[#999] hover:text-[#666]'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* DISCOVER */}
      {tab === 'discover' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {loading ? (
            <div className="col-span-2 text-center py-8 text-[#999] text-[14px]">Loading...</div>
          ) : users.length === 0 ? (
            <div className="col-span-2 text-center py-8 text-[#999] text-[14px]">No other users yet. Invite people to join!</div>
          ) : users.map(u => (
            <div key={u.id} className="bg-white border border-[#e8e8e8] rounded-2xl p-4 flex items-center gap-3 hover:border-[#d0d0d0] transition-all">
              {avatar(u.full_name, u.plan)}
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium truncate">{u.full_name}</p>
                <p className="text-[11px] text-[#999] capitalize">{u.plan} member</p>
              </div>
              {u.isFriend ? (
                <span className="text-[11px] font-medium text-green-600 bg-green-50 px-3 py-1 rounded-full">Friends ✓</span>
              ) : u.isPending ? (
                <span className="text-[11px] font-medium text-[#b8922a] bg-[#faf3e0] px-3 py-1 rounded-full">Pending...</span>
              ) : (
                <button onClick={() => sendRequest(u.id)} className="px-3 py-1.5 bg-[#111] text-white rounded-lg text-[12px] font-medium hover:bg-[#2a2a2a] transition-colors">
                  + Follow
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* FRIENDS */}
      {tab === 'friends' && (
        <div>
          {friends.length === 0 ? (
            <div className="text-center py-12 text-[#999]">
              <p className="text-[16px] mb-2">No friends yet</p>
              <p className="text-[14px]">Discover people and send friend requests</p>
              <button onClick={() => setTab('discover')} className="mt-4 px-4 py-2 bg-[#111] text-white rounded-xl text-[13px] font-medium">Discover people →</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {friends.map((f: any) => (
                <div key={f.id} className="bg-white border border-[#e8e8e8] rounded-2xl p-4 flex items-center gap-3">
                  {avatar(f.full_name, f.plan)}
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium truncate">{f.full_name}</p>
                    <p className="text-[11px] text-[#999] capitalize">{f.plan} member</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openChat(f)} className="px-3 py-1.5 bg-[#111] text-white rounded-lg text-[12px] font-medium hover:bg-[#2a2a2a] transition-colors">
                      Message
                    </button>
                    <button onClick={() => unfriend(f.id)} className="px-3 py-1.5 border border-[#e8e8e8] rounded-lg text-[12px] text-[#999] hover:border-red-200 hover:text-red-500 transition-colors">
                      Unfriend
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* REQUESTS */}
      {tab === 'requests' && (
        <div>
          {requests.length === 0 ? (
            <div className="text-center py-12 text-[#999] text-[14px]">No pending friend requests</div>
          ) : (
            <div className="flex flex-col gap-3">
              {requests.map((r: any) => (
                <div key={r.friendshipId} className="bg-white border border-[#e8e8e8] rounded-2xl p-4 flex items-center gap-3">
                  {avatar(r.full_name, r.plan)}
                  <div className="flex-1">
                    <p className="text-[14px] font-medium">{r.full_name}</p>
                    <p className="text-[12px] text-[#999]">Wants to be your friend</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => acceptRequest(r.friendshipId, r)} className="px-4 py-2 bg-[#111] text-white rounded-xl text-[13px] font-medium hover:bg-[#2a2a2a] transition-colors">
                      Accept
                    </button>
                    <button onClick={() => declineRequest(r.friendshipId)} className="px-4 py-2 border border-[#e8e8e8] rounded-xl text-[13px] text-[#999] hover:border-red-200 hover:text-red-500 transition-colors">
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MESSAGES */}
      {tab === 'messages' && (
        <div>
          {!activeChat ? (
            <div>
              {friends.length === 0 ? (
                <div className="text-center py-12 text-[#999] text-[14px]">Add friends to start messaging</div>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-[13px] text-[#999] mb-2">Select a friend to message</p>
                  {friends.map((f: any) => (
                    <button key={f.id} onClick={() => openChat(f)}
                      className="flex items-center gap-3 p-4 bg-white border border-[#e8e8e8] rounded-2xl hover:border-[#d0d0d0] transition-all text-left">
                      {avatar(f.full_name, f.plan)}
                      <div>
                        <p className="text-[14px] font-medium">{f.full_name}</p>
                        <p className="text-[12px] text-[#999]">Click to open chat</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-[#e8e8e8] rounded-2xl overflow-hidden">
              {/* Chat header */}
              <div className="px-5 py-3.5 border-b border-[#e8e8e8] flex items-center gap-3">
                <button onClick={() => setActiveChat(null)} className="text-[#999] hover:text-[#111] text-[18px] mr-1">←</button>
                {avatar(activeChat.full_name, activeChat.plan)}
                <div>
                  <p className="text-[14px] font-medium">{activeChat.full_name}</p>
                  <p className="text-[11px] text-green-500">Friends ✓</p>
                </div>
              </div>

              {/* Messages */}
              <div className="h-[380px] overflow-y-auto p-5 flex flex-col gap-3">
                {messages.length === 0 && (
                  <div className="text-center text-[#999] text-[13px] mt-8">
                    Start the conversation with {activeChat.full_name}!
                  </div>
                )}
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

              {/* Input */}
              <div className="border-t border-[#e8e8e8] flex">
                <input
                  value={inp}
                  onChange={e => setInp(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendDM()}
                  placeholder={`Message ${activeChat.full_name}...`}
                  className="flex-1 px-5 py-3.5 text-[14px] outline-none bg-transparent"
                />
                <button onClick={sendDM} disabled={!inp.trim()}
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
