'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'

export default function ProfilePage() {
  const supabase = createClient()
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState({ full_name: '' })
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(()=>{
    const load = async () => {
      const {data:{user}} = await supabase.auth.getUser()
      if (!user) return
      setUser(user)
      const {data:prof} = await supabase.from('profiles').select('*').eq('id',user.id).single()
      setProfile(prof)
      setForm({full_name: prof?.full_name||''})
    }
    load()
  },[])

  const uploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file||!user) return
    if (file.size > 5*1024*1024) { toast.error('Photo must be under 5MB'); return }
    if (!file.type.startsWith('image/')) { toast.error('Please upload an image file'); return }

    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${user.id}/avatar.${ext}`

    const {error:uploadError} = await supabase.storage.from('avatars').upload(path, file, {upsert:true})
    if (uploadError) { toast.error('Upload failed: '+uploadError.message); setUploading(false); return }

    const {data:{publicUrl}} = supabase.storage.from('avatars').getPublicUrl(path)
    await supabase.from('profiles').update({avatar_url:publicUrl}).eq('id',user.id)
    setProfile((p:any)=>({...p,avatar_url:publicUrl}))
    toast.success('Profile photo updated!')
    setUploading(false)
    router.refresh()
  }

  const saveProfile = async () => {
    if (!form.full_name.trim()) { toast.error('Name required'); return }
    setSaving(true)
    await supabase.from('profiles').update({full_name:form.full_name}).eq('id',user.id)
    setProfile((p:any)=>({...p,full_name:form.full_name}))
    toast.success('Profile saved')
    setSaving(false)
    router.refresh()
  }

  const isPro = profile?.plan==='pro'||profile?.plan==='pro_trial'
  const trialExpiry = profile?.plan_expires_at ? new Date(profile.plan_expires_at) : null
  const daysLeft = trialExpiry ? Math.max(0, Math.ceil((trialExpiry.getTime()-Date.now())/(1000*60*60*24))) : null

  if (!profile) return <div className="text-[#999] text-[14px]">Loading...</div>

  return (
    <div className="fade-up max-w-[600px]">
      <h1 className="font-serif text-[32px] mb-1">My Profile</h1>
      <p className="text-[14px] text-[#666] mb-8">Your account and plan settings</p>

      {/* Avatar */}
      <div className="bg-white border border-[#e8e8e8] rounded-2xl p-6 mb-4">
        <p className="text-[12px] font-medium text-[#666] uppercase tracking-[.08em] mb-4">Profile photo</p>
        <div className="flex items-center gap-5">
          <div className="relative">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-20 h-20 rounded-full object-cover border-2 border-[#e8e8e8]"/>
            ) : (
              <div className="w-20 h-20 rounded-full bg-[#b8922a] flex items-center justify-center text-white text-[28px] font-semibold">
                {profile.full_name?.[0]?.toUpperCase()||'?'}
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full spin-anim"/>
              </div>
            )}
          </div>
          <div>
            <button onClick={()=>fileRef.current?.click()} disabled={uploading} className="px-4 py-2 bg-[#111] text-white rounded-xl text-[13px] font-medium hover:bg-[#2a2a2a] transition-colors disabled:opacity-50 mb-2 block">
              {uploading?'Uploading...':'Upload photo'}
            </button>
            <p className="text-[11px] text-[#999]">JPG, PNG or WebP · Max 5MB</p>
            <input ref={fileRef} type="file" accept="image/*" onChange={uploadPhoto} className="hidden"/>
          </div>
        </div>
      </div>

      {/* Name */}
      <div className="bg-white border border-[#e8e8e8] rounded-2xl p-6 mb-4">
        <p className="text-[12px] font-medium text-[#666] uppercase tracking-[.08em] mb-4">Account details</p>
        <div className="mb-4">
          <label className="block text-[12px] font-medium text-[#666] mb-2">Full name</label>
          <input className="w-full px-3.5 py-2.5 border border-[#e8e8e8] rounded-xl text-[14px] outline-none focus:border-[#111] transition-colors" value={form.full_name} onChange={e=>setForm(f=>({...f,full_name:e.target.value}))}/>
        </div>
        <div className="mb-5">
          <label className="block text-[12px] font-medium text-[#666] mb-2">Email address</label>
          <input className="w-full px-3.5 py-2.5 border border-[#e8e8e8] rounded-xl text-[14px] bg-[#f8f7f5] text-[#999]" value={user?.email||''} readOnly/>
        </div>
        <button onClick={saveProfile} disabled={saving} className="px-5 py-2.5 bg-[#111] text-white rounded-xl text-[13px] font-medium hover:bg-[#2a2a2a] transition-colors disabled:opacity-50">
          {saving?'Saving...':'Save changes'}
        </button>
      </div>

      {/* Plan */}
      <div className="bg-white border border-[#e8e8e8] rounded-2xl p-6">
        <p className="text-[12px] font-medium text-[#666] uppercase tracking-[.08em] mb-4">Your plan</p>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-medium text-[15px] capitalize">{profile.plan==='pro_trial'?'Pro (Free Trial)':profile.plan} plan</p>
            {isPro && daysLeft!==null && <p className="text-[12px] text-[#b8922a]">{daysLeft} days remaining in free trial</p>}
            {!isPro && <p className="text-[12px] text-[#999]">5 chats/day · 2 goals · Basic features</p>}
            {isPro && <p className="text-[12px] text-[#999]">15 chats/day · 5 goals · All features</p>}
          </div>
          {!isPro && (
            <a href="/dashboard/upgrade" className="px-4 py-2 bg-[#b8922a] text-white rounded-xl text-[13px] font-medium hover:bg-[#9a7820] transition-colors">Upgrade free →</a>
          )}
        </div>
        {isPro && daysLeft!==null && daysLeft<=14 && (
          <div className="bg-[#faf3e0] border border-[#b8922a]/20 rounded-xl p-3 text-[13px] text-[#b8922a]">
            Your free trial ends in {daysLeft} days. After that it's $9/month to keep Pro.
          </div>
        )}
      </div>
    </div>
  )
}
