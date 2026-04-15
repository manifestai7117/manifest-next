'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import Link from 'next/link'

export default function ProfilePage() {
  const supabase = createClient()
  const router = useRouter()
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
  const [showDeleteAccount, setShowDeleteAccount] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUser(user)

      const [
        { data: prof },
        { data: active },
        { data: paused },
        { data: completed },
        { data: rwds },
        { count: posts },
        { count: checkins },
      ] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('goals').select('*').eq('user_id', user.id).eq('is_active', true).eq('is_paused', false).order('created_at', { ascending: false }),
        supabase.from('goals').select('*').eq('user_id', user.id).eq('is_active', true).eq('is_paused', true).order('paused_at', { ascending: false }),
        supabase.from('goals').select('title, completed_at, success_note').eq('user_id', user.id).eq('is_active', false).not('completed_at', 'is', null).order('completed_at', { ascending: false }),
        supabase.from('rewards').select('*').eq('user_id', user.id).order('earned_at', { ascending: false }),
        supabase.from('feed_posts').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_archived', false),
        supabase.from('checkins').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      ])

      setProfile(prof)
      setActiveGoals(active || [])
      setPausedGoals(paused || [])
      setCompletedGoals(completed || [])
      setRewards(rwds || [])
      setPostCount(posts || 0)
      setTotalCheckins(checkins || 0)
      setLoading(false)
    }
    load()
  }, [])

  const resumeGoal = async (goalId: string) => {
    setResuming(goalId)
    await supabase.from('goals').update({ is_paused: false, paused_at: null, pause_reason: null }).eq('id', goalId)
    setPausedGoals(prev => prev.filter(g => g.id !== goalId))
    const resumed = pausedGoals.find(g => g.id === goalId)
    if (resumed) setActiveGoals(prev => [{ ...resumed, is_paused: false }, ...prev])
    toast.success('Goal resumed!')
    setResuming(null)
  }

  const deleteGoal = async (goalId: string) => {
    if (!confirm('Delete this paused goal permanently?')) return
    await supabase.from('goals').delete().eq('id', goalId)
    setPausedGoals(prev => prev.filter(g => g.id !== goalId))
    toast.success('Goal deleted')
  }

  const deleteAccount = async () => {
    toast.error('Please contact support to delete your account.')
    setShowDeleteAccount(false)
  }

  if (loading) return <div className="text-[#999] text-[14px]">Loading...</div>

  const totalStreak = activeGoals.reduce((a, g) => a + (g.streak || 0), 0)
  const bestStreak = [...activeGoals, ...completedGoals].reduce((a, g) => Math.max(a, g.longest_streak || g.streak || 0), 0)
  const isPro = profile?.plan === 'pro' || profile?.plan === 'pro_trial'

  return (
    <div className="fade-up max-w-[720px]">
      {/* Profile header */}
      <div className="bg-white border border-[#e8e8e8] rounded-2xl overflow-hidden mb-4">
        <div className="bg-[#111] h-20"/>
        <div className="px-6 pb-6">
          <div className="-mt-10 mb-4 flex items-end justify-between">
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt="" className="w-20 h-20 rounded-2xl border-4 border-white object-cover"/>
              : <div className="w-20 h-20 rounded-2xl border-4 border-white bg-[#b8922a] flex items-center justify-center text-white text-[32px] font-semibold">{profile?.full_name?.[0]}</div>
            }
            <div className="flex gap-2 pb-1">
              {isPro && <span className="text-[11px] font-semibold bg-[#b8922a] text-white px-2.5 py-1 rounded-full">PRO</span>}
              <Link href="/dashboard/settings" className="text-[12px] px-3 py-1.5 border border-[#e8e8e8] rounded-xl hover:bg-[#f8f7f5] transition-colors">⚙ Settings</Link>
            </div>
          </div>
          <h1 className="font-serif text-[24px] mb-0.5">{profile?.full_name}</h1>
          <p className="text-[13px] text-[#999] mb-4">{user?.email}</p>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { val: activeGoals.length, label: 'Active goals' },
              { val: completedGoals.length, label: 'Completed' },
              { val: `${totalStreak}🔥`, label: 'Total streak' },
              { val: postCount, label: 'Posts' },
              { val: totalCheckins, label: 'Check-ins' },
            ].map(({ val, label }) => (
              <div key={label} className="bg-[#f8f7f5] rounded-xl p-3 text-center">
                <p className="font-serif text-[20px] leading-none mb-0.5">{val}</p>
                <p className="text-[10px] text-[#999] uppercase tracking-[.05em]">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Active goals summary */}
      {activeGoals.length > 0 && (
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="font-medium text-[14px]">Active goals <span className="text-[#999] font-normal">({activeGoals.length})</span></p>
            <Link href="/onboarding" className="text-[12px] text-[#b8922a] hover:underline">+ Add goal</Link>
          </div>
          <div className="space-y-3">
            {activeGoals.map(g => (
              <div key={g.id} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[13px] font-medium truncate">{g.title}</p>
                    <span className="text-[11px] text-[#b8922a] font-medium flex-shrink-0 ml-2">{g.streak}🔥</span>
                  </div>
                  <div className="h-1.5 bg-[#f0ede8] rounded-full overflow-hidden">
                    <div className="h-full bg-[#b8922a] rounded-full" style={{ width: `${g.progress || 0}%` }}/>
                  </div>
                  <p className="text-[10px] text-[#999] mt-0.5">{g.progress || 0}% · {g.timeline}</p>
                </div>
                <Link href="/dashboard/goal" className="flex-shrink-0 text-[11px] px-3 py-1.5 border border-[#e8e8e8] rounded-lg hover:bg-[#f8f7f5] transition-colors">View</Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Paused goals */}
      {pausedGoals.length > 0 && (
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 mb-4">
          <p className="font-medium text-[14px] mb-3">Paused goals <span className="text-[#999] font-normal">({pausedGoals.length})</span></p>
          <div className="space-y-3">
            {pausedGoals.map(g => (
              <div key={g.id} className="flex items-center gap-3 p-3 bg-[#f8f7f5] rounded-xl">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium">{g.title}</p>
                  <p className="text-[11px] text-[#999] mt-0.5">
                    Paused {g.paused_at ? new Date(g.paused_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}{g.pause_reason ? ` · ${g.pause_reason}` : ''}
                  </p>
                  <p className="text-[11px] text-[#b8922a] mt-0.5">{g.streak} day streak saved</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => resumeGoal(g.id)} disabled={resuming === g.id}
                    className="text-[11px] px-3 py-1.5 bg-[#111] text-white rounded-lg hover:bg-[#2a2a2a] transition-colors disabled:opacity-50">
                    {resuming === g.id ? '...' : 'Resume'}
                  </button>
                  <button onClick={() => deleteGoal(g.id)}
                    className="text-[11px] px-3 py-1.5 border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition-colors">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed goals */}
      {completedGoals.length > 0 && (
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 mb-4">
          <p className="font-medium text-[14px] mb-3">Completed goals 🎯 <span className="text-[#999] font-normal">({completedGoals.length})</span></p>
          <div className="space-y-2">
            {completedGoals.map((g: any) => (
              <div key={g.title} className="p-3 bg-green-50 border border-green-100 rounded-xl">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-medium text-green-800">{g.title}</p>
                  <span className="text-[10px] text-green-600 font-medium">
                    {g.completed_at ? new Date(g.completed_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Completed'}
                  </span>
                </div>
                {g.success_note && <p className="text-[12px] text-green-700 mt-1 italic">"{g.success_note}"</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rewards */}
      {rewards.length > 0 && (
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 mb-4">
          <p className="font-medium text-[14px] mb-3">Badges earned <span className="text-[#999] font-normal">({rewards.length})</span></p>
          <div className="flex flex-wrap gap-2">
            {rewards.map((r: any) => (
              <div key={r.id} className="flex items-center gap-2 bg-[#faf3e0] border border-[#b8922a]/20 rounded-xl px-3 py-2" title={r.description}>
                <span className="text-[20px]">{r.emoji}</span>
                <div>
                  <p className="text-[12px] font-medium text-[#111]">{r.title}</p>
                  <p className="text-[10px] text-[#999]">{r.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Public profile link */}
      <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 mb-4">
        <p className="font-medium text-[14px] mb-1">Your public profile</p>
        <p className="text-[12px] text-[#999] mb-3">Share your goal journey with others</p>
        <div className="flex gap-2">
          <input readOnly value={`${typeof window !== 'undefined' ? window.location.origin : 'https://manifest-next.vercel.app'}/profile/${user?.id}`}
            className="flex-1 text-[12px] text-[#666] bg-[#f8f7f5] border border-[#e8e8e8] rounded-xl px-3 py-2 outline-none"/>
          <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/profile/${user?.id}`); toast.success('Link copied!') }}
            className="px-4 py-2 bg-[#111] text-white rounded-xl text-[12px] font-medium">Copy</button>
        </div>
      </div>

      {/* Danger zone */}
      <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5">
        <p className="font-medium text-[14px] mb-3 text-red-500">Danger zone</p>
        <button onClick={() => setShowDeleteAccount(true)}
          className="px-4 py-2 border border-red-200 text-red-500 rounded-xl text-[13px] hover:bg-red-50 transition-colors">
          Delete account
        </button>
        {showDeleteAccount && (
          <div className="mt-3 p-4 bg-red-50 border border-red-100 rounded-xl">
            <p className="text-[13px] text-red-700 mb-2">This will permanently delete all your data. Contact support at <a href="mailto:support@manifest-next.vercel.app" className="underline">support@manifest-next.vercel.app</a> to proceed.</p>
            <button onClick={() => setShowDeleteAccount(false)} className="text-[12px] text-[#666] hover:underline">Cancel</button>
          </div>
        )}
      </div>
    </div>
  )
}