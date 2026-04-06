'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import toast from 'react-hot-toast'

export default function DashboardPage() {
  const supabase = createClient()
  const [profile, setProfile] = useState<any>(null)
  const [goals, setGoals] = useState<any[]>([])
  const [selectedGoal, setSelectedGoal] = useState<any>(null)
  const [checkedInToday, setCheckedInToday] = useState(false)
  const [recentCheckins, setRecentCheckins] = useState<any[]>([])
  const [showCheckin, setShowCheckin] = useState(false)
  const [checkinNote, setCheckinNote] = useState('')
  const [checkinMood, setCheckinMood] = useState(3)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [chatUsage, setChatUsage] = useState({ remaining: 5, limit: 5 })

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [profRes, goalRes, usageRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('goals').select('*').eq('user_id', user.id).eq('is_active', true).order('created_at', { ascending: false }),
        fetch('/api/coach').then(r => r.ok ? r.json() : { remaining: 5, limit: 5 }),
      ])
      setProfile(profRes.data)
      const gs = goalRes.data || []
      setGoals(gs)
      if (gs.length) loadGoalData(gs[0], user.id)
      setChatUsage(usageRes)
      setLoading(false)
    }
    load()
  }, [])

  const loadGoalData = async (goal: any, userId?: string) => {
    setSelectedGoal(goal)
    const today = new Date().toISOString().split('T')[0]
    const { data: { user } } = await supabase.auth.getUser()
    const uid = userId || user?.id
    const [checkinRes, recentRes] = await Promise.all([
      supabase.from('checkins').select('id').eq('goal_id', goal.id).gte('created_at', `${today}T00:00:00`).single(),
      supabase.from('checkins').select('*').eq('goal_id', goal.id).order('created_at', { ascending: false }).limit(7),
    ])
    setCheckedInToday(!!checkinRes.data)
    setRecentCheckins(recentRes.data || [])
  }

  const submitCheckin = async () => {
    if (!selectedGoal) return
    setSubmitting(true)
    const res = await fetch('/api/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goalId: selectedGoal.id, note: checkinNote, mood: checkinMood }),
    })
    const data = await res.json()
    setSubmitting(false)
    if (!res.ok) { toast.error(data.error || 'Check-in failed'); return }
    toast.success(`✓ Checked in! Streak: ${data.streak} days 🔥`)
    setCheckedInToday(true)
    setShowCheckin(false)
    setCheckinNote('')
    setCheckinMood(3)
    setSelectedGoal((g: any) => g ? { ...g, streak: data.streak, progress: data.progress } : g)
    setGoals(gs => gs.map(g => g.id === selectedGoal.id ? { ...g, streak: data.streak, progress: data.progress } : g))
  }

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = profile?.full_name?.split(' ')[0] || 'there'

  if (loading) return <div className="text-[#999] text-[14px] p-4">Loading...</div>

  if (goals.length === 0) return (
    <div className="fade-up max-w-[600px]">
      <h1 className="font-serif text-[32px] mb-2">{greeting}, {firstName}.</h1>
      <p className="text-[#666] mb-8">You haven't set a goal yet. Let's change that.</p>
      <Link href="/onboarding" className="inline-flex items-center gap-2 px-6 py-3 bg-[#111] text-white rounded-xl text-[14px] font-medium hover:bg-[#2a2a2a] transition-colors">
        Create my first goal →
      </Link>
    </div>
  )

  return (
    <div className="fade-up max-w-[900px]">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-[32px] mb-1">{greeting}, {firstName}.</h1>
          <p className="text-[#666] text-[14px]">
            {checkedInToday ? `Checked in today ✓  ·  ${selectedGoal?.streak || 0} day streak 🔥` : "You haven't checked in today yet."}
          </p>
        </div>
        <div className="flex items-center gap-2 text-[12px]">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${chatUsage.remaining <= 1 ? 'border-red-200 bg-red-50 text-red-600' : chatUsage.remaining <= 3 ? 'border-orange-200 bg-orange-50 text-orange-600' : 'border-green-200 bg-green-50 text-green-700'}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${chatUsage.remaining <= 1 ? 'bg-red-500' : chatUsage.remaining <= 3 ? 'bg-orange-500' : 'bg-green-500'}`}/>
            {chatUsage.remaining} coach chats left
          </div>
        </div>
      </div>

      {/* Goal tabs */}
      {goals.length > 1 && (
        <div className="flex gap-2 mb-5 flex-wrap">
          {goals.map(g => (
            <button key={g.id} onClick={() => loadGoalData(g)}
              className={`px-4 py-2 rounded-full text-[13px] border transition-all ${selectedGoal?.id === g.id ? 'bg-[#111] text-white border-[#111]' : 'bg-white text-[#666] border-[#e8e8e8] hover:border-[#d0d0d0]'}`}>
              {g.title.length > 30 ? g.title.slice(0, 30) + '…' : g.title}
            </button>
          ))}
        </div>
      )}

      {selectedGoal && (
        <>
          {/* Check-in banner */}
          {!checkedInToday && !showCheckin && (
            <div className="bg-[#111] rounded-2xl p-5 mb-5 flex items-center justify-between">
              <div>
                <p className="font-serif text-[18px] text-white mb-0.5">Daily check-in</p>
                <p className="text-[13px] text-white/50">Did you work toward "{selectedGoal.title.slice(0, 40)}" today?</p>
              </div>
              <button onClick={() => setShowCheckin(true)} className="px-5 py-2.5 bg-[#b8922a] text-white rounded-xl text-[13px] font-medium hover:bg-[#9a7820] transition-colors whitespace-nowrap">
                Log today ✓
              </button>
            </div>
          )}

          {/* Inline check-in form */}
          {showCheckin && (
            <div className="bg-[#111] rounded-2xl p-5 mb-5">
              <p className="font-serif text-[18px] text-white mb-4">How did today go?</p>
              <div className="flex gap-2 mb-3">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => setCheckinMood(n)}
                    className={`flex-1 py-2.5 rounded-xl text-[16px] transition-all ${checkinMood === n ? 'bg-[#b8922a]' : 'bg-white/10 hover:bg-white/15'}`}>
                    {['😞', '😐', '🙂', '😊', '🔥'][n - 1]}
                  </button>
                ))}
              </div>
              <textarea value={checkinNote} onChange={e => setCheckinNote(e.target.value)} placeholder="Quick note (optional)..." className="w-full bg-white/10 text-white placeholder-white/30 text-[13px] px-3 py-2.5 rounded-xl border border-white/10 outline-none resize-none mb-3" rows={2}/>
              <div className="flex gap-2">
                <button onClick={() => setShowCheckin(false)} className="flex-1 py-2.5 text-[13px] text-white/50 border border-white/10 rounded-xl hover:bg-white/5">Cancel</button>
                <button onClick={submitCheckin} disabled={submitting} className="flex-1 py-2.5 text-[13px] bg-[#b8922a] text-white rounded-xl font-medium disabled:opacity-50">
                  {submitting ? 'Saving...' : 'Log check-in ✓'}
                </button>
              </div>
            </div>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
            {[
              { val: `${selectedGoal.streak}`, label: 'Day streak 🔥' },
              { val: `${selectedGoal.progress}%`, label: 'Progress', prog: selectedGoal.progress },
              { val: `${recentCheckins.length}`, label: 'This week' },
              { val: selectedGoal.timeline, label: 'Timeline' },
            ].map(({ val, label, prog }) => (
              <div key={label} className="bg-white border border-[#e8e8e8] rounded-2xl p-5">
                <p className="font-serif text-[28px] leading-none mb-1">{val}</p>
                <p className="text-[11px] font-medium text-[#999] uppercase tracking-[.06em]">{label}</p>
                {prog !== undefined && (
                  <div className="mt-2 h-1.5 bg-[#f0ede8] rounded-full overflow-hidden">
                    <div className="h-full bg-[#b8922a] rounded-full" style={{ width: `${prog}%` }} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Goal + affirmation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <Link href="/dashboard/goals" className="bg-white border border-[#e8e8e8] rounded-2xl p-6 block hover:border-[#d0d0d0] transition-colors">
              <p className="text-[10px] font-medium tracking-[.12em] uppercase text-[#b8922a] mb-2">Current goal</p>
              <p className="font-serif text-[18px] leading-[1.4] mb-3">{selectedGoal.title}</p>
              <div className="flex gap-2 flex-wrap">
                <span className="text-[11px] font-medium text-[#b8922a] bg-[#faf3e0] px-2.5 py-1 rounded-full">{selectedGoal.timeline}</span>
                <span className="text-[11px] font-medium text-[#666] bg-[#f2f0ec] px-2.5 py-1 rounded-full">{selectedGoal.category}</span>
              </div>
            </Link>

            {/* Per-goal affirmation */}
            <div className="bg-[#111] rounded-2xl p-6">
              <p className="text-[10px] font-medium tracking-[.12em] uppercase text-white/30 mb-3">Today's affirmation</p>
              <p className="font-serif italic text-[16px] text-white/85 leading-[1.65]">"{selectedGoal.affirmation}"</p>
              <p className="text-[11px] text-white/30 mt-3">{selectedGoal.title.slice(0, 40)}</p>
            </div>
          </div>

          {/* Coach + today's action */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link href="/dashboard/coach" className="bg-white border border-[#e8e8e8] rounded-2xl p-6 block hover:border-[#d0d0d0] transition-colors group">
              <p className="text-[10px] font-medium tracking-[.12em] uppercase text-[#b8922a] mb-3">Coach message</p>
              <p className="font-serif italic text-[15px] text-[#666] leading-[1.7] line-clamp-3">"{selectedGoal.coach_opening}"</p>
              <p className="text-[12px] text-[#b8922a] mt-3 group-hover:underline">Continue with coach →</p>
            </Link>

            {selectedGoal.today_action && (
              <div className="bg-[#faf3e0] border border-[#b8922a]/20 rounded-2xl p-6">
                <p className="text-[10px] font-medium tracking-[.12em] uppercase text-[#b8922a] mb-3">Today's action</p>
                <p className="text-[14px] text-[#111] leading-[1.65]">{selectedGoal.today_action}</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
