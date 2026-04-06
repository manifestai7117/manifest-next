'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

const RANK_LABELS = ['🥇','🥈','🥉','4th','5th','6th','7th','8th']

function computeScore(member: any, checkins: number) {
  // Scoring: checkins × 10 + phase completions × 50 + streak bonus
  const base = (member.checkin_count||0) * 10
  const bonus = member.score||0
  return base + bonus
}

export default function CirclesPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [circles, setCircles] = useState<any[]>([])
  const [myCircleIds, setMyCircleIds] = useState<string[]>([])
  const [myRanks, setMyRanks] = useState<Record<string,{rank:number,score:number,total:number}>>({})
  const [activeCircle, setActiveCircle] = useState<any>(null)
  const [msgs, setMsgs] = useState<any[]>([])
  const [inp, setInp] = useState('')
  const [sending, setSending] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [inviteModal, setInviteModal] = useState<any>(null)
  const [friends, setFriends] = useState<any[]>([])
  const [pendingRequests, setPendingRequests] = useState<any[]>([])
  const [newCircle, setNewCircle] = useState({ name:'', goal:'', category:'', isPublic:true })
  const [verifying, setVerifying] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const isPro = profile?.plan==='pro'||profile?.plan==='pro_trial'

  useEffect(()=>{
    const load = async () => {
      const {data:{user}} = await supabase.auth.getUser()
      setUser(user)
      if (!user) return
      const {data:prof} = await supabase.from('profiles').select('*').eq('id',user.id).single()
      setProfile(prof)
      const {data:c} = await supabase.from('circles').select('*').eq('is_public',true).order('streak',{ascending:false})
      setCircles(c||[])
      const {data:m} = await supabase.from('circle_members').select('circle_id,rank,score').eq('user_id',user.id)
      setMyCircleIds((m||[]).map((x:any)=>x.circle_id))
      // Build rank map
      const rankMap: Record<string,any> = {}
      for (const mem of (m||[])) {
        const {data:allMembers} = await supabase.from('circle_members').select('user_id,score').eq('circle_id',mem.circle_id).order('score',{ascending:false})
        const myIdx = allMembers?.findIndex(mm=>mm.user_id===user.id)??0
        rankMap[mem.circle_id] = { rank: myIdx+1, score: mem.score||0, total: allMembers?.length||1 }
      }
      setMyRanks(rankMap)
      // Load friends
      const {data:fs} = await supabase.from('friendships').select('requester,addressee').or(`requester.eq.${user.id},addressee.eq.${user.id}`).eq('status','accepted')
      const friendIds = (fs||[]).map(f=>f.requester===user.id?f.addressee:f.requester)
      if (friendIds.length) {
        const {data:fps} = await supabase.from('profiles').select('id,full_name').in('id',friendIds)
        setFriends(fps||[])
      }
      // Load join requests for circles I admin
      const {data:myAdminCircles} = await supabase.from('circle_members').select('circle_id').eq('user_id',user.id).eq('role','admin')
      if (myAdminCircles?.length) {
        const adminCircleIds = myAdminCircles.map(c=>c.circle_id)
        const {data:reqs} = await supabase.from('circle_requests').select('*,profiles(full_name)').in('circle_id',adminCircleIds).eq('status','pending')
        setPendingRequests(reqs||[])
      }
    }
    load()
  },[])

  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:'smooth'}) },[msgs])

  const openCircle = async (circle:any) => {
    setActiveCircle(circle)
    const {data:m} = await supabase.from('circle_messages').select('*').eq('circle_id',circle.id).order('created_at',{ascending:true}).limit(50)
    setMsgs(m?.length ? m : [{id:'seed',sender_name:'Coach AI',is_ai:true,content:`Welcome to ${circle.name}! We're all working toward: ${circle.goal_description}. Share your update.`,created_at:new Date().toISOString()}])
  }

  const join = async (circle:any) => {
    if (!user) return
    if (!circle.is_public || circle.invite_only) {
      // Request to join private circle
      const {error} = await supabase.from('circle_requests').insert({circle_id:circle.id,user_id:user.id,status:'pending'})
      if (error && !error.message.includes('duplicate')) { toast.error('Could not request'); return }
      toast.success('Join request sent! The admin will review it.')
      return
    }
    const {error} = await supabase.from('circle_members').insert({circle_id:circle.id,user_id:user.id,role:'member',score:0})
    if (error) { toast.error('Could not join: '+error.message); return }
    await supabase.from('circles').update({member_count:(circle.member_count||0)+1}).eq('id',circle.id)
    setMyCircleIds(prev=>[...prev,circle.id])
    setCircles(prev=>prev.map(c=>c.id===circle.id?{...c,member_count:(c.member_count||0)+1}:c))
    setMyRanks(prev=>({...prev,[circle.id]:{rank:circle.member_count+1,score:0,total:circle.member_count+1}}))
    toast.success('Joined! Welcome to the circle.')
  }

  const sendMsg = async () => {
    if (!inp.trim()||sending||!activeCircle) return
    const text = inp.trim(); setInp(''); setSending(true)
    const temp = {id:Date.now().toString(),sender_name:profile?.full_name||'You',content:text,is_ai:false,user_id:user?.id,created_at:new Date().toISOString()}
    setMsgs(prev=>[...prev,temp])
    const res = await fetch('/api/circles',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({circleId:activeCircle.id,content:text})})
    const data = await res.json()
    if (res.ok) {
      setMsgs(prev=>{
        const updated = prev.filter(m=>m.id!==temp.id)
        updated.push(data.userMessage)
        if (data.aiMessage) updated.push(data.aiMessage)
        return updated
      })
      // Update checkin count for scoring
      await supabase.from('circle_members').update({checkin_count:supabase.rpc('increment_chat_usage',{p_user_id:user.id})}).eq('circle_id',activeCircle.id).eq('user_id',user.id)
    }
    setSending(false)
  }

  const inviteFriend = async (friendId:string, circleId:string) => {
    await supabase.from('circle_invitations').insert({circle_id:circleId,invited_by:user.id,invited_user:friendId,status:'pending'})
    toast.success('Invitation sent!')
  }

  const handleJoinRequest = async (reqId:string, accept:boolean) => {
    if (accept) {
      const req = pendingRequests.find(r=>r.id===reqId)
      if (req) {
        await supabase.from('circle_members').insert({circle_id:req.circle_id,user_id:req.user_id,role:'member',score:0})
        await supabase.from('circle_requests').update({status:'accepted'}).eq('id',reqId)
        toast.success('Request accepted!')
      }
    } else {
      await supabase.from('circle_requests').update({status:'rejected'}).eq('id',reqId)
    }
    setPendingRequests(prev=>prev.filter(r=>r.id!==reqId))
  }

  const verifyAndCreateCircle = async () => {
    if (!newCircle.name||!newCircle.goal||!newCircle.category) { toast.error('Fill in all fields'); return }
    if (!isPro) { toast.error('Creating circles requires Pro plan'); return }
    setVerifying(true)
    // AI verify the circle is goal-related
    try {
      const res = await fetch('/api/circles/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:newCircle.name,goal:newCircle.goal,category:newCircle.category})})
      const data = await res.json()
      if (!res.ok||!data.approved) {
        toast.error(data.reason||'Circle must be clearly goal-focused. Please revise.')
        setVerifying(false); return
      }
    } catch { /* allow if API fails */ }
    setCreating(true)
    const {data:circle,error} = await supabase.from('circles').insert({
      name:newCircle.name, category:newCircle.category, goal_description:newCircle.goal,
      is_public:newCircle.isPublic, invite_only:!newCircle.isPublic,
      created_by:user.id, member_count:1, streak:0, ai_verified:true
    }).select().single()
    if (error||!circle) { toast.error('Failed to create circle'); setCreating(false); setVerifying(false); return }
    await supabase.from('circle_members').insert({circle_id:circle.id,user_id:user.id,role:'admin',score:0})
    setCircles(prev=>[circle,...prev])
    setMyCircleIds(prev=>[...prev,circle.id])
    setShowCreate(false); setCreating(false); setVerifying(false)
    setNewCircle({name:'',goal:'',category:'',isPublic:true})
    toast.success('Circle created and verified by AI! ✓')
  }

  if (activeCircle) {
    const joined = myCircleIds.includes(activeCircle.id)
    const myRank = myRanks[activeCircle.id]
    return (
      <div className="fade-up max-w-[760px]">
        <button onClick={()=>setActiveCircle(null)} className="flex items-center gap-1.5 text-[13px] text-[#666] mb-5 hover:text-[#111]">← Back to circles</button>
        <div className="mb-5 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-serif text-[28px] mb-1">{activeCircle.name}</h1>
            <div className="flex gap-2 flex-wrap items-center">
              <span className="text-[11px] font-medium text-[#b8922a] bg-[#faf3e0] px-2.5 py-1 rounded-full">⚡ {activeCircle.streak}-day streak</span>
              <span className="text-[11px] text-[#666]">{activeCircle.member_count} members</span>
              <span className={`text-[11px] px-2.5 py-1 rounded-full ${activeCircle.is_public?'bg-green-50 text-green-700':'bg-[#f2f0ec] text-[#666]'}`}>
                {activeCircle.is_public?'Public':'Private'}
              </span>
            </div>
          </div>
          {/* My rank — visible only to me */}
          {joined && myRank && (
            <div className="bg-[#faf3e0] border border-[#b8922a]/20 rounded-xl px-4 py-3 text-center">
              <p className="text-[22px] font-bold">{RANK_LABELS[myRank.rank-1]||`${myRank.rank}th`}</p>
              <p className="text-[11px] text-[#b8922a] font-medium">Your rank</p>
              <p className="text-[10px] text-[#999]">{myRank.score} pts · {myRank.total} members</p>
            </div>
          )}
          {/* Invite friends button (if member) */}
          {joined && friends.length>0 && (
            <button onClick={()=>setInviteModal(activeCircle)} className="px-3 py-2 border border-[#e8e8e8] rounded-xl text-[12px] font-medium hover:bg-[#f8f7f5]">
              Invite friends
            </button>
          )}
        </div>

        <div className="bg-white border border-[#e8e8e8] rounded-2xl overflow-hidden">
          <div className="h-[380px] overflow-y-auto p-5 flex flex-col gap-3">
            {msgs.map((m:any)=>{
              const isMe = m.user_id===user?.id
              const isAI = m.is_ai
              return (
                <div key={m.id} className={`flex gap-3 ${isMe?'flex-row-reverse':''}`}>
                  <div className={`w-8 h-8 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center text-[12px] font-semibold ${isAI?'bg-[#b8922a] text-white':'bg-[#f2f0ec] text-[#666]'}`}>
                    {isAI?'M':m.sender_name?.[0]?.toUpperCase()||'?'}
                  </div>
                  <div className={`max-w-[78%] flex flex-col ${isMe?'items-end':''}`}>
                    <p className="text-[11px] text-[#999] mb-1">{isAI?'Coach AI':m.sender_name}</p>
                    <div className={`px-4 py-3 text-[13px] leading-[1.6] rounded-2xl ${isMe?'bg-[#111] text-white rounded-br-sm':isAI?'bg-[#faf3e0] text-[#111] rounded-bl-sm border border-[#b8922a]/20':'bg-[#f8f7f5] text-[#111] rounded-bl-sm'}`}>
                      {m.content}
                    </div>
                  </div>
                </div>
              )
            })}
            {sending && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-[#b8922a] flex items-center justify-center text-white text-[12px] font-semibold">M</div>
                <div className="bg-[#faf3e0] px-4 py-3 rounded-2xl flex gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#b8922a] bounce-1"/><span className="w-1.5 h-1.5 rounded-full bg-[#b8922a] bounce-2"/><span className="w-1.5 h-1.5 rounded-full bg-[#b8922a] bounce-3"/>
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
              <p className="text-[13px] text-[#666]">{activeCircle.is_public?'Join to participate':'Request to join this private circle'}</p>
              <button onClick={()=>join(activeCircle)} className="px-4 py-2 bg-[#111] text-white rounded-xl text-[13px] font-medium">{activeCircle.is_public?'Join circle':'Request to join'}</button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="fade-up max-w-[900px]">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-[32px] mb-1">Goal Circles</h1>
          <p className="text-[14px] text-[#666]">Accountability groups. Real people. Real progress.</p>
        </div>
        {isPro ? (
          <button onClick={()=>setShowCreate(true)} className="px-4 py-2 bg-[#111] text-white rounded-xl text-[13px] font-medium hover:bg-[#2a2a2a]">+ Create circle</button>
        ) : (
          <a href="/dashboard/upgrade" className="px-3 py-2 border border-[#b8922a]/30 bg-[#faf3e0] text-[#b8922a] rounded-xl text-[12px] font-medium">Pro: create your own circle</a>
        )}
      </div>

      {/* Pending join requests (for circle admins) */}
      {pendingRequests.length>0 && (
        <div className="bg-[#faf3e0] border border-[#b8922a]/20 rounded-2xl p-5 mb-6">
          <p className="font-medium text-[14px] mb-3">Pending join requests ({pendingRequests.length})</p>
          {pendingRequests.map(r=>(
            <div key={r.id} className="flex items-center justify-between py-2 border-b border-[#b8922a]/10 last:border-0">
              <p className="text-[13px]">{r.profiles?.full_name||'User'} wants to join</p>
              <div className="flex gap-2">
                <button onClick={()=>handleJoinRequest(r.id,true)} className="px-3 py-1 bg-[#111] text-white rounded-lg text-[12px]">Accept</button>
                <button onClick={()=>handleJoinRequest(r.id,false)} className="px-3 py-1 border border-[#e8e8e8] rounded-lg text-[12px] text-[#999]">Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {circles.map((c,i)=>{
          const joined = myCircleIds.includes(c.id)
          const myRank = myRanks[c.id]
          return (
            <div key={c.id} className="bg-white border border-[#e8e8e8] rounded-2xl p-5 hover:border-[#d0d0d0] transition-all hover-lift">
              <div className="flex justify-between items-start mb-3">
                <div className="flex gap-2">
                  <span className="text-[10px] font-medium tracking-[.08em] uppercase text-[#999] bg-[#f2f0ec] px-2.5 py-1 rounded-full">{c.category}</span>
                  {!c.is_public && <span className="text-[10px] font-medium text-[#666] bg-[#f2f0ec] px-2.5 py-1 rounded-full">🔒 Private</span>}
                </div>
                {joined && myRank && (
                  <span className="text-[11px] font-bold text-[#b8922a]">{RANK_LABELS[myRank.rank-1]||`#${myRank.rank}`}</span>
                )}
                {joined && !myRank && <span className="text-[10px] font-medium text-green-600 bg-green-50 px-2.5 py-1 rounded-full">Joined</span>}
              </div>
              <h3 className="font-medium text-[15px] mb-1.5">{c.name}</h3>
              <p className="text-[12px] text-[#666] mb-4 leading-[1.5]">{c.goal_description}</p>
              <div className="flex items-center gap-3 mb-4 text-[12px] text-[#666]">
                <span>{c.member_count} members</span>
                <span className="text-[#b8922a] font-medium">⚡ {c.streak}d streak</span>
              </div>
              <div className="flex gap-2">
                <button onClick={()=>openCircle(c)} className="flex-1 py-2 text-[12px] font-medium border border-[#e8e8e8] rounded-xl hover:bg-[#f8f7f5]">
                  {joined?'Open circle':'Preview'}
                </button>
                {!joined && (
                  <button onClick={()=>join(c)} className="flex-1 py-2 text-[12px] font-medium bg-[#111] text-white rounded-xl hover:bg-[#2a2a2a]">
                    {c.is_public?'Join':'Request'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Create circle modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6" onClick={e=>e.target===e.currentTarget&&setShowCreate(false)}>
          <div className="bg-white rounded-2xl p-8 max-w-md w-full">
            <h3 className="font-serif text-[24px] mb-2">Create a circle</h3>
            <p className="text-[14px] text-[#666] mb-6">AI will verify your circle is genuinely goal-focused before publishing.</p>
            <div className="mb-4">
              <label className="block text-[12px] font-medium text-[#666] mb-2">Circle name</label>
              <input className="w-full px-3.5 py-2.5 border border-[#e8e8e8] rounded-xl text-[14px] outline-none focus:border-[#111]" value={newCircle.name} onChange={e=>setNewCircle(p=>({...p,name:e.target.value}))} placeholder="e.g. Early Morning Entrepreneurs"/>
            </div>
            <div className="mb-4">
              <label className="block text-[12px] font-medium text-[#666] mb-2">What goal does this circle work toward?</label>
              <textarea className="w-full px-3.5 py-3 border border-[#e8e8e8] rounded-xl text-[14px] outline-none focus:border-[#111] resize-none" rows={3} value={newCircle.goal} onChange={e=>setNewCircle(p=>({...p,goal:e.target.value}))} placeholder="e.g. Build and launch a profitable online business within 6 months"/>
            </div>
            <div className="mb-4">
              <label className="block text-[12px] font-medium text-[#666] mb-2">Category</label>
              <select className="w-full px-3.5 py-2.5 border border-[#e8e8e8] rounded-xl text-[14px] outline-none focus:border-[#111]" value={newCircle.category} onChange={e=>setNewCircle(p=>({...p,category:e.target.value}))}>
                <option value="">Select category</option>
                {['Career & business','Health & fitness','Financial freedom','Relationships','Creative work','Personal growth','Travel & adventure','Learning & skills'].map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex items-center justify-between p-3 bg-[#f8f7f5] rounded-xl mb-6">
              <div><p className="text-[13px] font-medium">{newCircle.isPublic?'Public circle':'Private circle'}</p>
              <p className="text-[11px] text-[#999]">{newCircle.isPublic?'Anyone can join':'Members must request to join'}</p></div>
              <button onClick={()=>setNewCircle(p=>({...p,isPublic:!p.isPublic}))}
                className={`w-12 h-6 rounded-full relative transition-all ${newCircle.isPublic?'bg-[#b8922a]':'bg-[#e8e8e8]'}`}>
                <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${newCircle.isPublic?'left-6':'left-0.5'}`}/>
              </button>
            </div>
            <div className="flex gap-3">
              <button onClick={()=>setShowCreate(false)} className="flex-1 py-2.5 border border-[#e8e8e8] rounded-xl text-[13px]">Cancel</button>
              <button onClick={verifyAndCreateCircle} disabled={creating||verifying} className="flex-1 py-2.5 bg-[#111] text-white rounded-xl text-[13px] font-medium disabled:opacity-50">
                {verifying?'AI verifying...':creating?'Creating...':'Create circle ✓'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite friends modal */}
      {inviteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6" onClick={e=>e.target===e.currentTarget&&setInviteModal(null)}>
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full">
            <h3 className="font-serif text-[22px] mb-5">Invite friends to {inviteModal.name}</h3>
            {friends.length===0 ? <p className="text-[#999] text-[14px]">No friends yet. Add friends first.</p> : (
              <div className="flex flex-col gap-3">
                {friends.map((f:any)=>(
                  <div key={f.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-[#b8922a] flex items-center justify-center text-white text-[12px] font-semibold">{f.full_name?.[0]?.toUpperCase()}</div>
                      <p className="text-[13px] font-medium">{f.full_name}</p>
                    </div>
                    <button onClick={()=>{inviteFriend(f.id,inviteModal.id);setInviteModal(null)}} className="px-3 py-1.5 bg-[#111] text-white rounded-lg text-[11px] font-medium">Invite</button>
                  </div>
                ))}
              </div>
            )}
            <button onClick={()=>setInviteModal(null)} className="mt-5 w-full py-2.5 border border-[#e8e8e8] rounded-xl text-[13px]">Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
