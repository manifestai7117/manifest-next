'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import Link from 'next/link'

const FEEDBACK_CATS = [
  { v: 'bug', l: '🐛 Bug report', d: 'Something is broken' },
  { v: 'feature', l: '✨ Feature request', d: 'I want this' },
  { v: 'improvement', l: '⚡ Improvement', d: 'Make something better' },
  { v: 'praise', l: '❤️ Praise', d: 'What I love' },
  { v: 'other', l: '💬 Other', d: 'General' },
]

export default function ProfileFeedbackPage() {
  const supabase = createClient()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [activeGoals, setActiveGoals] = useState<any[]>([])
  const [pausedGoals, setPausedGoals] = useState<any[]>([])
  const [completedGoals, setCompletedGoals] = useState<any[]>([])
  const [rewards, setRewards] = useState<any[]>([])
  const [postCount, setPostCount] = useState(0)
  const [totalCheckins, setTotalCheckins] = useState(0)
  const [loading, setLoading] = useState(true)
  const [resuming, setResuming] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  // Feedback state
  const [fbCategory, setFbCategory] = useState('improvement')
  const [fbMessage, setFbMessage] = useState('')
  const [fbSubmitting, setFbSubmitting] = useState(false)
  const [todayFbCount, setTodayFbCount] = useState(0)
  const [myFeedback, setMyFeedback] = useState<any[]>([])
  const [weekRating, setWeekRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [canRate, setCanRate] = useState(false)
  const [ratingSubmitted, setRatingSubmitted] = useState(false)
  const [avgRating, setAvgRating] = useState('—')
  // Subscription cancel
  const [showCancelFlow, setShowCancelFlow] = useState(false)
  const [cancelStep, setCancelStep] = useState(0)
  const [cancelReason, setCancelReason] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteStep, setDeleteStep] = useState(0)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deletingAccount, setDeletingAccount] = useState(false)
  const DAILY_LIMIT = 5

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUser(user)
      const today = new Date().toISOString().split('T')[0]
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
      const [{ data: prof }, { data: active }, { data: paused }, { data: completed }, { data: rwds }, { count: posts }, { count: checkins }, { data: todayFb }, { data: myFb }, { data: myRating }, { data: allRatings }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('goals').select('*').eq('user_id', user.id).eq('is_active', true).eq('is_paused', false).order('created_at', { ascending: false }),
        supabase.from('goals').select('*').eq('user_id', user.id).eq('is_active', true).eq('is_paused', true),
        supabase.from('goals').select('title, completed_at, success_note').eq('user_id', user.id).eq('is_active', false).not('completed_at', 'is', null).order('completed_at', { ascending: false }),
        supabase.from('rewards').select('*').eq('user_id', user.id).order('earned_at', { ascending: false }),
        supabase.from('feed_posts').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_archived', false),
        supabase.from('checkins').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('app_feedback').select('id').eq('user_id', user.id).gte('created_at', `${today}T00:00:00`),
        supabase.from('app_feedback').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
        supabase.from('app_ratings').select('rating, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('app_ratings').select('user_id, rating, created_at'),
      ])
      setProfile(prof); setActiveGoals(active || []); setPausedGoals(paused || [])
      setCompletedGoals(completed || []); setRewards(rwds || [])
      setPostCount(posts || 0); setTotalCheckins(checkins || 0)
      setTodayFbCount(todayFb?.length || 0); setMyFeedback(myFb || [])
      const canRateNow = !myRating?.created_at || (Date.now() - new Date(myRating.created_at).getTime() > 7 * 86400000)
      setCanRate(canRateNow)
      if (allRatings?.length) {
        const latest: Record<string, number> = {}
        allRatings.forEach((r: any) => { if (!latest[r.user_id] || r.created_at > latest[r.user_id]) latest[r.user_id] = r.rating })
        const vals = Object.values(latest)
        setAvgRating((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1))
      }
      setLoading(false)
    }
    load()
  }, [])

  const uploadAvatar = async (file: File) => {
    if (!user || uploadingAvatar) return
    setUploadingAvatar(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${user.id}/avatar.${ext}`
      const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type })
      if (uploadErr) throw uploadErr
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      const { error: updateErr } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id)
      if (updateErr) throw updateErr
      setProfile((p: any) => ({ ...p, avatar_url: publicUrl }))
      toast.success('Profile photo updated!')
    } catch (e: any) {
      toast.error(e.message || 'Upload failed')
    }
    setUploadingAvatar(false)
  }

  const resumeGoal = async (goalId: string) => {
    setResuming(goalId)
    await supabase.from('goals').update({ is_paused: false, paused_at: null, pause_reason: null }).eq('id', goalId)
    const resumed = pausedGoals.find(g => g.id === goalId)
    if (resumed) { setActiveGoals(prev => [{ ...resumed, is_paused: false }, ...prev]); setPausedGoals(prev => prev.filter(g => g.id !== goalId)) }
    toast.success('Goal resumed! 🎯')
    setResuming(null)
    router.refresh()
  }

  const submitFeedback = async () => {
    if (!fbMessage.trim() || fbSubmitting || todayFbCount >= DAILY_LIMIT) return
    setFbSubmitting(true)
    await supabase.from('app_feedback').insert({ user_id: user.id, category: fbCategory, message: fbMessage.trim() })
    setTodayFbCount(c => c + 1)
    setMyFeedback(prev => [{ id: Date.now(), category: fbCategory, message: fbMessage.trim(), created_at: new Date().toISOString(), status: 'open' }, ...prev])
    setFbMessage('')
    toast.success('Feedback received! We read every message.')
    setFbSubmitting(false)
  }

  const submitRating = async () => {
    if (!weekRating || !canRate) return
    await supabase.from('app_ratings').upsert({ user_id: user.id, rating: weekRating, created_at: new Date().toISOString() }, { onConflict: 'user_id' })
    setRatingSubmitted(true); setCanRate(false)
    toast.success('Rating submitted! ⭐')
  }

  const isPro = profile?.plan === 'pro' || profile?.plan === 'pro_trial'
  const totalStreak = activeGoals.reduce((a, g) => a + (g.streak || 0), 0)

  if (loading) return <div className="text-[#999] text-[14px]">Loading...</div>

  return (
    <div className="fade-up max-w-[720px]">
      {/* Profile header */}
      <div className="bg-white border border-[#e8e8e8] rounded-2xl overflow-hidden mb-4">
        <div className="bg-[#111] h-20"/>
        <div className="px-6 pb-6">
          <div className="-mt-10 mb-4 flex items-end justify-between">
            <div className="relative group">
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="" className="w-20 h-20 rounded-2xl border-4 border-white object-cover"/>
                : <div className="w-20 h-20 rounded-2xl border-4 border-white bg-[#b8922a] flex items-center justify-center text-white text-[32px] font-semibold">{profile?.full_name?.[0]}</div>
              }
              <button onClick={() => fileRef.current?.click()}
                className="absolute inset-0 rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white text-[11px] font-medium">{uploadingAvatar ? 'Uploading...' : '📷 Change'}</span>
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(f) }}/>
            </div>
            <div className="flex gap-2 pb-1">
              {isPro && <span className="text-[11px] font-semibold bg-[#b8922a] text-white px-2.5 py-1 rounded-full">PRO</span>}
              <Link href="/dashboard/settings" className="text-[12px] px-3 py-1.5 border border-[#e8e8e8] rounded-xl hover:bg-[#f8f7f5] transition-colors">⚙ Settings</Link>
            </div>
          </div>
          <h1 className="font-serif text-[24px] mb-0.5">{profile?.full_name}</h1>
          <p className="text-[13px] text-[#999] mb-4">{user?.email}</p>
          <div className="grid grid-cols-5 gap-2">
            {[{ val: activeGoals.length, l: 'Active' }, { val: completedGoals.length, l: 'Completed' }, { val: `${totalStreak}🔥`, l: 'Streak' }, { val: postCount, l: 'Posts' }, { val: totalCheckins, l: 'Check-ins' }].map(({ val, l }) => (
              <div key={l} className="bg-[#f8f7f5] rounded-xl p-3 text-center">
                <p className="font-serif text-[18px] leading-none mb-0.5">{val}</p>
                <p className="text-[9px] text-[#999] uppercase tracking-[.04em]">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Active goals */}
      {activeGoals.length > 0 && (
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 mb-4">
          <div className="flex items-center justify-between mb-3"><p className="font-medium text-[14px]">Active goals ({activeGoals.length})</p><Link href="/onboarding" className="text-[12px] text-[#b8922a] hover:underline">+ Add</Link></div>
          <div className="space-y-3">
            {activeGoals.map(g => (
              <div key={g.id} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1"><p className="text-[13px] font-medium truncate">{g.title}</p><span className="text-[11px] text-[#b8922a] font-medium ml-2">{g.streak}🔥</span></div>
                  <div className="h-1.5 bg-[#f0ede8] rounded-full overflow-hidden"><div className="h-full bg-[#b8922a] rounded-full" style={{ width: `${g.progress || 0}%` }}/></div>
                  <p className="text-[10px] text-[#999] mt-0.5">{g.progress || 0}% · {g.timeline}</p>
                </div>
                <Link href="/dashboard/goal" className="flex-shrink-0 text-[11px] px-3 py-1.5 border border-[#e8e8e8] rounded-lg hover:bg-[#f8f7f5]">View</Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Paused goals */}
      {pausedGoals.length > 0 && (
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 mb-4">
          <p className="font-medium text-[14px] mb-3">⏸ Paused ({pausedGoals.length})</p>
          {pausedGoals.map(g => (
            <div key={g.id} className="flex items-center gap-3 p-3 bg-[#f8f7f5] rounded-xl mb-2">
              <div className="flex-1 min-w-0"><p className="text-[13px] font-medium">{g.title}</p><p className="text-[11px] text-[#b8922a] mt-0.5">{g.streak} day streak saved</p></div>
              <button onClick={() => resumeGoal(g.id)} disabled={resuming === g.id} className="px-3 py-1.5 bg-[#111] text-white rounded-lg text-[12px] font-medium disabled:opacity-50">
                {resuming === g.id ? '...' : '▶ Resume'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Completed goals */}
      {completedGoals.length > 0 && (
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 mb-4">
          <p className="font-medium text-[14px] mb-3">Completed 🎯 ({completedGoals.length})</p>
          {completedGoals.map((g: any) => (
            <div key={g.title} className="p-3 bg-green-50 border border-green-100 rounded-xl mb-2">
              <div className="flex items-center justify-between"><p className="text-[13px] font-medium text-green-800">{g.title}</p><span className="text-[10px] text-green-600">{g.completed_at ? new Date(g.completed_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : ''}</span></div>
              {g.success_note && <p className="text-[12px] text-green-700 mt-1 italic">"{g.success_note}"</p>}
            </div>
          ))}
        </div>
      )}

      {/* Badges */}
      {rewards.length > 0 && (
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 mb-4">
          <p className="font-medium text-[14px] mb-3">Badges ({rewards.length})</p>
          <div className="flex flex-wrap gap-2">
            {rewards.map((r: any) => (
              <div key={r.id} className="flex items-center gap-2 bg-[#faf3e0] border border-[#b8922a]/20 rounded-xl px-3 py-2" title={r.description}>
                <span className="text-[18px]">{r.emoji}</span>
                <div><p className="text-[12px] font-medium">{r.title}</p><p className="text-[10px] text-[#999]">{r.description}</p></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Public profile link */}
      <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 mb-4">
        <p className="font-medium text-[14px] mb-1">Public profile</p>
        <div className="flex gap-2 mt-2">
          <input readOnly value={`${typeof window !== 'undefined' ? window.location.origin : ''}/profile/${user?.id}`} className="flex-1 text-[12px] text-[#666] bg-[#f8f7f5] border border-[#e8e8e8] rounded-xl px-3 py-2 outline-none"/>
          <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/profile/${user?.id}`); toast.success('Copied!') }} className="px-4 py-2 bg-[#111] text-white rounded-xl text-[12px] font-medium">Copy</button>
        </div>
      </div>

      {/* FEEDBACK SECTION */}
      <div className="mt-6 mb-2">
        <h2 className="font-serif text-[24px] mb-1">Feedback & Reviews</h2>
        <p className="text-[13px] text-[#999] mb-4">Every message is read by the team.</p>
      </div>

      {/* App rating */}
      <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 mb-4">
        <p className="font-medium text-[15px] mb-1">Rate Manifest this week</p>
        <p className="text-[12px] text-[#999] mb-3">App avg: {avgRating} ⭐ · Once per week</p>
        {canRate && !ratingSubmitted ? (
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {[1,2,3,4,5].map(s => (
                <button key={s} onMouseEnter={() => setHoverRating(s)} onMouseLeave={() => setHoverRating(0)} onClick={() => setWeekRating(s)} className="text-[26px] transition-transform hover:scale-125">
                  <span style={{ color: s <= (hoverRating || weekRating) ? '#b8922a' : '#e8e8e8' }}>★</span>
                </button>
              ))}
            </div>
            {weekRating > 0 && <button onClick={submitRating} className="px-4 py-2 bg-[#111] text-white rounded-xl text-[12px] font-medium">Submit</button>}
          </div>
        ) : ratingSubmitted ? <p className="text-green-600 font-medium text-[13px]">✓ Thanks! Come back next week.</p>
        : <p className="text-[13px] text-[#999]">Already rated this week.</p>}
      </div>

      {/* Feedback form */}
      <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 mb-4">
        <p className="font-medium text-[15px] mb-3">Send feedback</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
          {FEEDBACK_CATS.map(c => (
            <button key={c.v} onClick={() => setFbCategory(c.v)}
              className={`p-3 rounded-xl border text-left transition-all ${fbCategory === c.v ? 'bg-[#111] border-[#111]' : 'border-[#e8e8e8]'}`}>
              <p className={`text-[12px] font-medium ${fbCategory === c.v ? 'text-white' : ''}`}>{c.l}</p>
              <p className={`text-[10px] mt-0.5 ${fbCategory === c.v ? 'text-white/50' : 'text-[#999]'}`}>{c.d}</p>
            </button>
          ))}
        </div>
        <textarea value={fbMessage} onChange={e => setFbMessage(e.target.value)} placeholder="Be specific — what page, what happened, what you expected..." className="w-full text-[13px] border border-[#e8e8e8] rounded-xl px-3.5 py-3 outline-none focus:border-[#111] resize-none mb-2" rows={3} maxLength={1000} disabled={todayFbCount >= DAILY_LIMIT}/>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[#999]">{DAILY_LIMIT - todayFbCount} messages left today</span>
          <button onClick={submitFeedback} disabled={!fbMessage.trim() || fbSubmitting || todayFbCount >= DAILY_LIMIT} className="px-4 py-2 bg-[#111] text-white rounded-xl text-[12px] font-medium disabled:opacity-40">Send</button>
        </div>
      </div>

      {/* Cancel subscription */}
      {isPro && (
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 mb-4">
          <p className="font-medium text-[14px] mb-1">Subscription</p>
          <p className="text-[12px] text-[#999] mb-3">You're on Pro. Your streak and data are safe forever.</p>
          {!showCancelFlow ? (
            <button onClick={() => setShowCancelFlow(true)} className="text-[12px] text-red-400 hover:underline">Cancel subscription</button>
          ) : cancelStep === 0 ? (
            <div className="space-y-2">
              <p className="text-[13px] font-medium">Before you go — what's the reason?</p>
              {['Too expensive', 'Not using it enough', 'Missing a feature I need', 'Switching to another app', 'Other'].map(r => (
                <button key={r} onClick={() => { setCancelReason(r); setCancelStep(1) }} className={`w-full text-left px-3.5 py-2.5 border rounded-xl text-[13px] transition-all ${cancelReason === r ? 'bg-[#111] text-white border-[#111]' : 'border-[#e8e8e8] hover:border-[#d0d0d0]'}`}>{r}</button>
              ))}
              <button onClick={() => setShowCancelFlow(false)} className="text-[12px] text-[#999] hover:underline w-full text-center mt-1">Never mind</button>
            </div>
          ) : (
            <div className="bg-[#faf3e0] border border-[#b8922a]/30 rounded-xl p-4">
              {cancelReason === 'Too expensive' && <p className="text-[13px] text-[#111] mb-3">We hear you. Your Pro account gives you 50 coach chats/day, unlimited vision art, and circle creation. We're adding more every week. Would pausing for 30 days help instead?</p>}
              {cancelReason === 'Not using it enough' && <p className="text-[13px] text-[#111] mb-3">The daily task feature was just built to help with exactly this — it gives you one focused action each day. Give it one more week with daily tasks turned on.</p>}
              {cancelReason === 'Missing a feature I need' && <p className="text-[13px] text-[#111] mb-3">Tell us what's missing via feedback below and we'll build it. Seriously — most features were user requests.</p>}
              {(cancelReason === 'Switching to another app' || cancelReason === 'Other') && <p className="text-[13px] text-[#111] mb-3">We're sorry to see you go. Your streak, goals, and data will be preserved if you ever come back.</p>}
              <div className="flex gap-2">
                <button onClick={() => { setShowCancelFlow(false); setCancelStep(0); toast('Glad you\'re staying! 🎉') }} className="flex-1 py-2 bg-[#111] text-white rounded-xl text-[12px] font-medium">Keep Pro</button>
                <button onClick={() => { (async () => {
                      await supabase.from('profiles').update({ plan: 'free' }).eq('id', user.id)
                      setProfile((p: any) => ({ ...p, plan: 'free' }))
                      setShowCancelFlow(false); setCancelStep(0)
                      toast.success('Subscription cancelled. You are now on the free plan.')
                    })() }} className="flex-1 py-2 border border-red-200 text-red-500 rounded-xl text-[12px]">Cancel anyway</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Danger zone */}
      <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5">
        <p className="font-medium text-[14px] mb-3 text-red-500">Danger zone</p>
        {!showDeleteConfirm ? (
          <button onClick={() => setShowDeleteConfirm(true)} className="px-4 py-2 border border-red-200 text-red-500 rounded-xl text-[13px] hover:bg-red-50 transition-colors">
            Delete my account
          </button>
        ) : deleteStep === 0 ? (
          <div className="space-y-3">
            <p className="text-[13px] font-medium text-[#111]">Are you sure?</p>
            <p className="text-[12px] text-[#999]">This permanently deletes all your goals, streaks, check-ins, and posts. This cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2 border border-[#e8e8e8] rounded-xl text-[13px]">Cancel</button>
              <button onClick={() => setDeleteStep(1)} className="flex-1 py-2 bg-red-500 text-white rounded-xl text-[13px] font-medium">Yes, delete</button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[13px] font-medium text-[#111]">Type DELETE to confirm</p>
            <input value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)}
              placeholder="Type DELETE" className="w-full px-3.5 py-2.5 border border-red-200 rounded-xl text-[13px] outline-none focus:border-red-400"/>
            <div className="flex gap-2">
              <button onClick={() => { setShowDeleteConfirm(false); setDeleteStep(0); setDeleteConfirmText('') }} className="flex-1 py-2 border border-[#e8e8e8] rounded-xl text-[13px]">Cancel</button>
              <button
                disabled={deleteConfirmText !== 'DELETE' || deletingAccount}
                onClick={async () => {
                  setDeletingAccount(true)
                  try {
                    const res = await fetch('/api/delete-account', { method: 'POST' })
                    if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed') }
                    await supabase.auth.signOut()
                    router.push('/')
                  } catch {
                    toast.error('Deletion failed — please try again')
                    setDeletingAccount(false)
                  }
                }}
                className="flex-1 py-2 bg-red-500 text-white rounded-xl text-[13px] font-medium disabled:opacity-40">
                {deletingAccount ? 'Deleting...' : 'Delete forever'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}