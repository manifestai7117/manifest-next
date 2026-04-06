'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const REWARD_BADGES = [
  { type:'first_checkin',  emoji:'🌱', title:'First Step',     color:'#22c55e' },
  { type:'streak_7',       emoji:'🔥', title:'Week Warrior',   color:'#f97316' },
  { type:'streak_14',      emoji:'⚡', title:'Fortnight Fire', color:'#eab308' },
  { type:'streak_30',      emoji:'🏆', title:'Month Legend',   color:'#b8922a' },
  { type:'phase_complete', emoji:'⭐', title:'Phase Done',     color:'#6366f1' },
  { type:'goal_complete',  emoji:'🎯', title:'Goal Achieved',  color:'#b8922a' },
]

export default function ProfilePage() {
  const supabase = createClient()
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [rewards, setRewards] = useState<any[]>([])
  const [friendCount, setFriendCount] = useState(0)
  const [pendingRequests, setPendingRequests] = useState(0)
  const [goalCount, setGoalCount] = useState(0)
  const [completedCount, setCompletedCount] = useState(0)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState({full_name:''})
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(()=>{
    const load = async () => {
      const {data:{user}} = await supabase.auth.getUser()
      if (!user) return
      setUser(user)
      const [profRes,rewardsRes,friendsRes,reqRes,goalsRes,doneRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id',user.id).single(),
        supabase.from('rewards').select('*').eq('user_id',user.id).order('earned_at',{ascending:false}),
        supabase.from('friendships').select('id',{count:'exact',head:true}).or(`requester.eq.${user.id},addressee.eq.${user.id}`).eq('status','accepted'),
        supabase.from('friendships').select('id',{count:'exact',head:true}).eq('addressee',user.id).eq('status','pending'),
        supabase.from('goals').select('id',{count:'exact',head:true}).eq('user_id',user.id).eq('is_active',true),
        supabase.from('goals').select('id',{count:'exact',head:true}).eq('user_id',user.id).eq('is_active',false),
      ])
      setProfile(profRes.data)
      setForm({full_name:profRes.data?.full_name||''})
      setRewards(rewardsRes.data||[])
      setFriendCount(friendsRes.count||0)
      setPendingRequests(reqRes.count||0)
      setGoalCount(goalsRes.count||0)
      setCompletedCount(doneRes.count||0)
    }
    load()
  },[])

  const uploadPhoto = async (e:React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file||!user) return
    if (file.size>5*1024*1024) { toast.error('Photo must be under 5MB'); return }
    if (!file.type.startsWith('image/')) { toast.error('Please upload an image file'); return }
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()||'jpg'
      const path = `avatars/${user.id}.${ext}`
      // Use upsert to overwrite
      const {error:upErr} = await supabase.storage.from('avatars').upload(path, file, {
        upsert:true,
        contentType:file.type
      })
      if (upErr) {
        // If bucket doesn't exist, give helpful message
        if (upErr.message.includes('not found')||upErr.message.includes('bucket')) {
          toast.error('Please create an "avatars" bucket in Supabase Storage → set to Public')
        } else {
          toast.error('Upload failed: '+upErr.message)
        }
        setUploading(false)
        return
      }
      const {data:{publicUrl}} = supabase.storage.from('avatars').getPublicUrl(path)
      const urlWithCacheBust = publicUrl+'?t='+Date.now()
      const {error:updateErr} = await supabase.from('profiles').update({avatar_url:urlWithCacheBust}).eq('id',user.id)
      if (updateErr) { toast.error('Failed to save photo: '+updateErr.message); setUploading(false); return }
      setProfile((p:any)=>({...p,avatar_url:urlWithCacheBust}))
      toast.success('Profile photo updated! ✓')
      router.refresh()
    } catch(e:any) {
      toast.error('Upload error: '+e.message)
    }
    setUploading(false)
  }

  const saveProfile = async () => {
    if (!form.full_name.trim()) { toast.error('Name required'); return }
    setSaving(true)
    const {error} = await supabase.from('profiles').update({full_name:form.full_name}).eq('id',user.id)
    if (error) { toast.error('Save failed: '+error.message); setSaving(false); return }
    setProfile((p:any)=>({...p,full_name:form.full_name}))
    toast.success('Profile saved ✓')
    setSaving(false)
    router.refresh()
  }

  const isPro = profile?.plan==='pro'||profile?.plan==='pro_trial'
  const trialExpiry = profile?.plan_expires_at ? new Date(profile.plan_expires_at) : null
  const daysLeft = trialExpiry ? Math.max(0,Math.ceil((trialExpiry.getTime()-Date.now())/(1000*60*60*24))) : null
  const totalScore = rewards.reduce((acc,r) => acc + (r.type==='goal_complete'?200:r.type==='phase_complete'?50:r.type?.includes('streak')?30:10), 0)

  if (!profile) return <div className="text-[#999] text-[14px]">Loading...</div>

  return (
    <div className="fade-up max-w-[700px]">
      <h1 className="font-serif text-[32px] mb-1">My Profile</h1>
      <p className="text-[14px] text-[#666] mb-8">Your account, achievements, and settings</p>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          {val:friendCount,label:'Friends',link:'/dashboard/friends'},
          {val:pendingRequests,label:'Requests',link:'/dashboard/friends?tab=requests'},
          {val:goalCount,label:'Active goals',link:'/dashboard/goals'},
          {val:completedCount,label:'Completed',link:'/dashboard/goals'},
        ].map(s=>(
          <Link key={s.label} href={s.link} className="bg-white border border-[#e8e8e8] rounded-2xl p-4 text-center hover:border-[#d0d0d0] transition-colors">
            <p className="font-serif text-[28px] leading-none mb-1">{s.val}</p>
            <p className="text-[11px] font-medium text-[#999] uppercase tracking-[.05em]">{s.label}</p>
          </Link>
        ))}
      </div>

      {/* Photo + name */}
      <div className="bg-white border border-[#e8e8e8] rounded-2xl p-6 mb-4">
        <p className="text-[12px] font-medium text-[#666] uppercase tracking-[.08em] mb-4">Profile photo</p>
        <div className="flex items-center gap-5 mb-5">
          <div className="relative">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-20 h-20 rounded-full object-cover border-2 border-[#e8e8e8]"/>
            ) : (
              <div className="w-20 h-20 rounded-full bg-[#b8922a] flex items-center justify-center text-white text-[28px] font-semibold">
                {profile.full_name?.[0]?.toUpperCase()||'?'}
              </div>
            )}
            {/* Reward badge overlay */}
            {rewards.length>0 && (
              <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-white rounded-full border-2 border-white flex items-center justify-center text-[14px]">
                {rewards[0]?.emoji||'🏅'}
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full spin-anim"/>
              </div>
            )}
          </div>
          <div>
            <button onClick={()=>fileRef.current?.click()} disabled={uploading}
              className="px-4 py-2 bg-[#111] text-white rounded-xl text-[13px] font-medium hover:bg-[#2a2a2a] transition-colors disabled:opacity-50 block mb-2">
              {uploading?'Uploading...':'Upload photo'}
            </button>
            <p className="text-[11px] text-[#999]">JPG, PNG or WebP · Max 5MB</p>
            <p className="text-[10px] text-[#bbb] mt-1">Requires "avatars" bucket in Supabase Storage</p>
            <input ref={fileRef} type="file" accept="image/*" onChange={uploadPhoto} className="hidden"/>
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-[12px] font-medium text-[#666] mb-2">Full name</label>
          <input className="w-full px-3.5 py-2.5 border border-[#e8e8e8] rounded-xl text-[14px] outline-none focus:border-[#111]" value={form.full_name} onChange={e=>setForm(f=>({...f,full_name:e.target.value}))}/>
        </div>
        <div className="mb-5">
          <label className="block text-[12px] font-medium text-[#666] mb-2">Email</label>
          <input className="w-full px-3.5 py-2.5 border border-[#e8e8e8] rounded-xl text-[14px] bg-[#f8f7f5] text-[#999]" value={user?.email||''} readOnly/>
        </div>
        <button onClick={saveProfile} disabled={saving} className="px-5 py-2.5 bg-[#111] text-white rounded-xl text-[13px] font-medium hover:bg-[#2a2a2a] disabled:opacity-50">
          {saving?'Saving...':'Save changes'}
        </button>
      </div>

      {/* Score + badges */}
      <div className="bg-white border border-[#e8e8e8] rounded-2xl p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[12px] font-medium text-[#666] uppercase tracking-[.08em]">Achievements</p>
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-[#b8922a]">{totalScore} pts</span>
            <span className="text-[11px] text-[#999]">total score</span>
          </div>
        </div>
        {rewards.length===0 ? (
          <p className="text-[13px] text-[#999]">Complete check-ins and phases to earn badges</p>
        ) : (
          <div className="flex gap-3 flex-wrap">
            {rewards.slice(0,12).map((r,i)=>{
              const badge = REWARD_BADGES.find(b=>b.type===r.type)||{emoji:r.emoji||'🏅',title:r.title,color:'#b8922a'}
              return (
                <div key={i} title={r.description||r.title} className="flex flex-col items-center gap-1 cursor-help">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-[22px]" style={{background:`${badge.color}15`,border:`2px solid ${badge.color}30`}}>
                    {badge.emoji}
                  </div>
                  <p className="text-[9px] text-[#999] text-center max-w-[48px] leading-tight">{badge.title}</p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Plan */}
      <div className="bg-white border border-[#e8e8e8] rounded-2xl p-6">
        <p className="text-[12px] font-medium text-[#666] uppercase tracking-[.08em] mb-4">Plan</p>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-medium text-[15px] capitalize">{profile.plan==='pro_trial'?'Pro (Free Trial)':profile.plan}</p>
            {isPro && daysLeft!==null && <p className="text-[12px] text-[#b8922a]">{daysLeft} days left in trial</p>}
            {!isPro && <p className="text-[12px] text-[#999]">5 chats/day · 2 goals</p>}
            {isPro && <p className="text-[12px] text-[#999]">15 chats/day · 5 goals · all features</p>}
          </div>
          {!isPro && <Link href="/dashboard/upgrade" className="px-4 py-2 bg-[#b8922a] text-white rounded-xl text-[13px] font-medium hover:bg-[#9a7820]">Upgrade free →</Link>}
        </div>
        {isPro && daysLeft!==null && daysLeft<=14 && (
          <div className="bg-[#faf3e0] border border-[#b8922a]/20 rounded-xl p-3 text-[13px] text-[#b8922a]">
            Trial ends in {daysLeft} days. After that: $9/month.
          </div>
        )}
      </div>
    </div>
  )
}
