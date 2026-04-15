'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'

const TIMELINES = ['1 week','2 weeks','1 month','6 weeks','2 months','3 months','6 months','1 year','2 years']


const TIMELINE_DAYS: Record<string, number> = {
  '1 week': 7, '2 weeks': 14, '1 month': 30, '6 weeks': 42,
  '2 months': 60, '3 months': 90, '6 months': 180, '1 year': 365, '2 years': 730,
}

function RoadmapSection({ goal }: { goal: any }) {
  const totalDays = TIMELINE_DAYS[goal.timeline] || 90
  const startDate = new Date(goal.created_at)
  const today = new Date()
  // Use the greater of: actual days since creation OR current streak
  // This handles timezone edge cases where same-day creation shows 0
  const rawDays = Math.floor((today.getTime() - startDate.getTime()) / 86400000)
  const daysPassed = Math.max(0, rawDays, goal.streak || 0)
  const pct = Math.min(100, Math.round((daysPassed / totalDays) * 100))

  const phases = [
    {
      label: 'Phase 1',
      milestone: goal.milestone_1 || goal.milestone_30 || `Build the foundation for ${goal.title} — establish daily habits and hit your first measurable target`,
      actions: (goal.phase1Actions || goal.phase1_actions || '').split('|').filter((a: string) => a.trim()),
      done: goal.phase1_completed,
      dueDate: new Date(startDate.getTime() + Math.round(totalDays * 0.33) * 86400000),
      dayTarget: Math.round(totalDays * 0.33),
    },
    {
      label: 'Phase 2',
      milestone: goal.milestone_2 || goal.milestone_60 || `Build momentum — increase intensity and hit your mid-point milestone for ${goal.title}`,
      actions: (goal.phase2Actions || goal.phase2_actions || '').split('|').filter((a: string) => a.trim()),
      done: goal.phase2_completed,
      dueDate: new Date(startDate.getTime() + Math.round(totalDays * 0.66) * 86400000),
      dayTarget: Math.round(totalDays * 0.66),
    },
    {
      label: 'Phase 3 — Final',
      milestone: goal.milestone_3 || goal.milestone_90 || `Complete ${goal.title} — achieve the exact outcome you set out for`,
      actions: (goal.phase3Actions || goal.phase3_actions || '').split('|').filter((a: string) => a.trim()),
      done: goal.phase3_completed,
      dueDate: new Date(startDate.getTime() + totalDays * 86400000),
      dayTarget: totalDays,
    },
  ]

  return (
    <div className="bg-white border border-[#e8e8e8] rounded-2xl p-6 mb-4">
      <div className="flex items-center justify-between mb-2">
        <p className="font-medium text-[15px]">Roadmap</p>
        <span className="text-[11px] text-[#999]">Day {daysPassed} of {totalDays} · {pct}%</span>
      </div>
      {/* Progress bar */}
      <div className="h-1.5 bg-[#f0ede8] rounded-full overflow-hidden mb-5">
        <div className="h-full bg-[#b8922a] rounded-full transition-all duration-700" style={{ width: `${pct}%` }}/>
      </div>
      <div className="space-y-4">
        {phases.map((p, i) => {
          const isPast = today > p.dueDate && !p.done
          const isCurrent = !p.done && daysPassed < p.dayTarget && (i === 0 || daysPassed >= phases[i-1]?.dayTarget)
          const statusColor = p.done ? 'bg-green-500' : isCurrent ? 'bg-[#b8922a]' : 'bg-[#e0ddd8]'
          const badgeStyle = p.done ? 'bg-green-50 text-green-700' : isCurrent ? 'bg-[#faf3e0] text-[#b8922a]' : isPast ? 'bg-red-50 text-red-500' : 'bg-[#f2f0ec] text-[#999]'
          const badgeText = p.done ? 'Done ✓' : isCurrent ? 'In progress' : isPast ? 'Overdue' : `Starts day ${i === 0 ? 1 : phases[i-1].dayTarget}`
          return (
            <div key={p.label} className={`border rounded-xl p-4 ${isCurrent ? 'border-[#b8922a]/30 bg-[#faf9f7]' : 'border-[#f0ede8]'}`}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2.5">
                  <div className={`w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center ${statusColor}`}>
                    {p.done && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>}
                    {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-white"/>}
                  </div>
                  <p className="text-[11px] font-bold text-[#b8922a] uppercase tracking-[.1em]">{p.label}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[11px] text-[#999]">{p.dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${badgeStyle}`}>{badgeText}</span>
                </div>
              </div>
              <p className="text-[14px] text-[#111] leading-[1.6] mb-2 ml-6">{p.milestone}</p>
              {p.actions.length > 0 && (
                <div className="ml-6 space-y-1">
                  {p.actions.filter((a: string) => a.trim()).map((action: string, ai: number) => (
                    <div key={ai} className="flex items-start gap-2">
                      <span className="text-[#b8922a] text-[11px] mt-[3px] flex-shrink-0">→</span>
                      <p className="text-[12px] text-[#666] leading-[1.5]">{action.trim()}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function GoalPage() {
  const supabase = createClient()
  const router = useRouter()
  const [goals, setGoals] = useState<any[]>([])
  const [goal, setGoal] = useState<any>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [successNote, setSuccessNote] = useState('')
  const [form, setForm] = useState({ title: '', timeline: '', why: '' })
  const [loading, setLoading] = useState(true)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showPauseModal, setShowPauseModal] = useState(false)
  const [pausing, setPausing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [resuming, setResuming] = useState(false)
  const [pausedGoals, setPausedGoals] = useState<any[]>([])
  const [pauseReason, setPauseReason] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ data: gs }, { data: paused }] = await Promise.all([
        supabase.from('goals').select('*').eq('user_id', user.id).eq('is_active', true).eq('is_paused', false).order('created_at', { ascending: false }),
        supabase.from('goals').select('*').eq('user_id', user.id).eq('is_active', true).eq('is_paused', true).order('paused_at', { ascending: false }),
      ])
      setPausedGoals(paused || [])
      setGoals(gs || [])
      const savedId = typeof window !== 'undefined' ? localStorage.getItem('selectedGoalId') : null
      const g = gs?.find((x: any) => x.id === savedId) || gs?.[0] || null
      setGoal(g)
      if (g) setForm({ title: g.title, timeline: g.timeline, why: g.why })
      setLoading(false)
    }
    load()
  }, [])

  const selectGoal = (g: any) => {
    setGoal(g)
    setForm({ title: g.title, timeline: g.timeline, why: g.why })
    setEditing(false)
    if (typeof window !== 'undefined') localStorage.setItem('selectedGoalId', g.id)
  }

  const pauseGoal = async () => {
    if (!goal || pausing) return
    setPausing(true)
    await supabase.from('goals').update({ is_paused: true, paused_at: new Date().toISOString(), pause_reason: pauseReason }).eq('id', goal.id)
    setGoals(prev => prev.filter(g => g.id !== goal.id))
    setShowPauseModal(false)
    setPausing(false)
    toast.success('Goal paused. You can resume it from your profile.')
    router.push('/dashboard')
  }

  const resumeGoal = async (goalId: string) => {
    setResuming(true)
    await supabase.from('goals').update({ is_paused: false, paused_at: null, pause_reason: null }).eq('id', goalId)
    const resumed = pausedGoals.find(g => g.id === goalId)
    if (resumed) {
      setGoals(prev => [{ ...resumed, is_paused: false }, ...prev])
      setPausedGoals(prev => prev.filter(g => g.id !== goalId))
      setGoal({ ...resumed, is_paused: false })
      setForm({ title: resumed.title, timeline: resumed.timeline, why: resumed.why })
    }
    setResuming(false)
    toast.success('Goal resumed!')
  }

  const deleteGoal = async () => {
    if (!goal || deleting) return
    setDeleting(true)
    await supabase.from('goals').delete().eq('id', goal.id)
    setGoals(prev => prev.filter(g => g.id !== goal.id))
    setShowDeleteModal(false)
    setDeleting(false)
    localStorage.removeItem('selectedGoalId')
    toast.success('Goal deleted.')
    router.push('/dashboard')
  }

  const saveChanges = async () => {
    if (!goal || !form.title.trim()) { toast.error('Title required'); return }
    setSaving(true)
    const { error } = await supabase.from('goals').update({
      title: form.title.trim(),
      timeline: form.timeline,
      why: form.why.trim(),
      updated_at: new Date().toISOString(),
    }).eq('id', goal.id)
    if (error) { toast.error('Save failed'); setSaving(false); return }
    const updated = { ...goal, title: form.title.trim(), timeline: form.timeline, why: form.why.trim() }
    setGoal(updated)
    setGoals(prev => prev.map(g => g.id === goal.id ? updated : g))
    setEditing(false)
    setSaving(false)
    toast.success('Goal updated! Coach will use the new details.')
    router.refresh()
  }

  const completeGoal = async () => {
    if (!goal || completing) return
    setCompleting(true)
    // Mark goal inactive
    const { error } = await supabase.from('goals').update({
      is_active: false,
      completed_at: new Date().toISOString(),
      success_note: successNote.trim() || null,
    }).eq('id', goal.id)
    if (error) { toast.error('Could not complete goal'); setCompleting(false); return }

    // Award goal_complete badge
    await supabase.from('rewards').upsert({
      user_id: goal.user_id,
      type: 'goal_complete',
      title: 'Goal Achieved',
      description: `Completed: ${goal.title}`,
      emoji: '🎯',
      earned_at: new Date().toISOString(),
    }, { onConflict: 'user_id,type' })

    // Optionally create public success story
    if (successNote.trim()) {
      await supabase.from('success_stories').upsert({
        user_id: goal.user_id,
        goal_title: goal.title,
        quote: successNote.trim(),
        is_public: true,
      })
    }

    setShowCompleteModal(false)
    setCompleting(false)
    setGoals(prev => prev.filter(g => g.id !== goal.id))
    localStorage.removeItem('selectedGoalId')
    toast.success('🎯 Goal completed! You earned a badge.')
    router.push('/dashboard')
  }

  if (loading) return <div className="text-[#999] text-[14px]">Loading...</div>

  if (!goal) return (
    <div className="fade-up">
      <h1 className="font-serif text-[32px] mb-4">My Goal</h1>
      <div className="bg-white border border-[#e8e8e8] rounded-2xl p-8 text-center">
        <p className="text-[#666] mb-4">No active goal yet.</p>
        <Link href="/onboarding" className="inline-block px-5 py-2.5 bg-[#111] text-white rounded-xl text-[13px] font-medium">Create my first goal →</Link>
      </div>
    </div>
  )

  return (
    <div className="fade-up max-w-[800px]">
      {/* Pause Modal */}
      {showPauseModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl max-w-[420px] w-full p-7 shadow-2xl">
            <div className="text-center mb-5">
              <div className="text-[40px] mb-2">⏸</div>
              <h2 className="font-serif text-[22px] mb-1">Pause this goal?</h2>
              <p className="text-[13px] text-[#666]">Your streak and progress are saved. You can resume anytime from your profile.</p>
            </div>
            <div className="mb-4">
              <label className="block text-[12px] font-medium text-[#666] mb-1.5">Why are you pausing? <span className="text-[#999]">(optional)</span></label>
              <input value={pauseReason} onChange={e => setPauseReason(e.target.value)} placeholder="Vacation, busy period, need a break..."
                className="w-full px-3.5 py-2.5 border border-[#e8e8e8] rounded-xl text-[14px] outline-none focus:border-[#111]"/>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowPauseModal(false)} className="flex-1 py-2.5 border border-[#e8e8e8] rounded-xl text-[13px]">Cancel</button>
              <button onClick={pauseGoal} disabled={pausing} className="flex-1 py-2.5 bg-[#b8922a] text-white rounded-xl text-[13px] font-medium disabled:opacity-50">
                {pausing ? 'Pausing...' : 'Pause goal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl max-w-[420px] w-full p-7 shadow-2xl">
            <div className="text-center mb-5">
              <div className="text-[40px] mb-2">🗑</div>
              <h2 className="font-serif text-[22px] mb-1">Delete this goal?</h2>
              <p className="text-[13px] text-[#666]">This permanently deletes <strong>{goal?.title}</strong> and all check-ins. This cannot be undone.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-2.5 border border-[#e8e8e8] rounded-xl text-[13px]">Cancel</button>
              <button onClick={deleteGoal} disabled={deleting} className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-[13px] font-medium disabled:opacity-50 hover:bg-red-600 transition-colors">
                {deleting ? 'Deleting...' : 'Yes, delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete Goal Modal */}
      {showCompleteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl max-w-[440px] w-full p-8 shadow-2xl">
            <div className="text-center mb-6">
              <div className="text-[48px] mb-3">🎯</div>
              <h2 className="font-serif text-[26px] mb-2">Mark as completed?</h2>
              <p className="text-[14px] text-[#666] leading-[1.6]">This will archive <strong>{goal.title}</strong> and award you a badge. This can't be undone.</p>
            </div>
            <div className="mb-5">
              <label className="block text-[12px] font-medium text-[#666] mb-2">Share your win <span className="text-[#999] font-normal">(optional — shown on community page)</span></label>
              <textarea
                value={successNote}
                onChange={e => setSuccessNote(e.target.value)}
                placeholder="What did you achieve? How does it feel?"
                className="w-full px-3.5 py-3 border border-[#e8e8e8] rounded-xl text-[14px] outline-none focus:border-[#111] resize-none"
                rows={3}
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowCompleteModal(false)} className="flex-1 py-3 border border-[#e8e8e8] rounded-xl text-[13px] font-medium hover:bg-[#f8f7f5] transition-colors">Cancel</button>
              <button onClick={completeGoal} disabled={completing}
                className="flex-1 py-3 bg-green-600 text-white rounded-xl text-[13px] font-medium hover:bg-green-700 disabled:opacity-50 transition-colors">
                {completing ? 'Completing...' : 'Complete & archive 🎉'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-[32px] mb-1">My Goal</h1>
          <p className="text-[14px] text-[#666]">Your goal profile and roadmap</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/onboarding"
            className="px-4 py-2.5 border border-[#e8e8e8] rounded-xl text-[13px] font-medium hover:bg-[#f8f7f5] transition-colors">
            + Add goal
          </Link>
          {!editing ? (
            <>
              <button onClick={() => setEditing(true)}
                className="px-4 py-2.5 border border-[#e8e8e8] rounded-xl text-[13px] font-medium hover:bg-[#f8f7f5] transition-colors">
                Edit
              </button>
              <button onClick={() => setShowPauseModal(true)}
                className="px-4 py-2.5 border border-[#e8e8e8] rounded-xl text-[13px] font-medium text-[#666] hover:bg-[#f8f7f5] transition-colors">
                ⏸ Pause
              </button>
              <button onClick={() => setShowCompleteModal(true)}
                className="px-4 py-2.5 bg-green-600 text-white rounded-xl text-[13px] font-medium hover:bg-green-700 transition-colors">
                ✓ Complete
              </button>
              <button onClick={() => setShowDeleteModal(true)}
                className="px-4 py-2.5 border border-red-200 text-red-500 rounded-xl text-[13px] font-medium hover:bg-red-50 transition-colors">
                🗑
              </button>
            </>
          ) : (
            <>
              <button onClick={() => { setEditing(false); setForm({ title: goal.title, timeline: goal.timeline, why: goal.why }) }}
                className="px-4 py-2.5 border border-[#e8e8e8] rounded-xl text-[13px] hover:bg-[#f8f7f5] transition-colors">
                Cancel
              </button>
              <button onClick={saveChanges} disabled={saving}
                className="px-4 py-2.5 bg-[#111] text-white rounded-xl text-[13px] font-medium hover:bg-[#2a2a2a] disabled:opacity-50 transition-colors">
                {saving ? 'Saving...' : 'Save changes'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Goal tabs */}
      {goals.length > 1 && (
        <div className="flex gap-2 mb-5 flex-wrap">
          {goals.map(g => (
            <button key={g.id} onClick={() => selectGoal(g)}
              className={`px-4 py-2 rounded-full text-[13px] border transition-all ${goal?.id === g.id ? 'bg-[#111] text-white border-[#111]' : 'bg-white text-[#666] border-[#e8e8e8] hover:border-[#d0d0d0]'}`}>
              {g.display_title || g.title}
            </button>
          ))}
        </div>
      )}

      {editing && (
        <div className="bg-[#faf3e0] border border-[#b8922a]/20 rounded-2xl p-4 mb-4 text-[13px] text-[#b8922a]">
          Updating your timeline or title will refresh your coach's context on the next message.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-6">
          <p className="text-[10px] font-medium tracking-[.12em] uppercase text-[#b8922a] mb-3">The goal</p>
          {editing ? (
            <textarea
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full font-serif text-[18px] leading-[1.4] border border-[#e8e8e8] rounded-xl px-3 py-2.5 outline-none focus:border-[#111] resize-none mb-3"
              rows={3}
            />
          ) : (
            <p className="font-serif text-[20px] leading-[1.4] mb-4">{goal.title}</p>
          )}
          <div className="flex gap-2 flex-wrap">
            {editing ? (
              <select value={form.timeline} onChange={e => setForm(f => ({ ...f, timeline: e.target.value }))}
                className="border border-[#e8e8e8] rounded-xl px-3 py-1.5 text-[13px] outline-none focus:border-[#111]">
                {TIMELINES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            ) : (
              <span className="text-[11px] font-medium text-[#b8922a] bg-[#faf3e0] px-2.5 py-1 rounded-full">{goal.timeline}</span>
            )}
            <span className="text-[11px] font-medium text-[#666] bg-[#f2f0ec] px-2.5 py-1 rounded-full">{goal.category}</span>
          </div>
        </div>

        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-6">
          <p className="text-[10px] font-medium tracking-[.12em] uppercase text-[#b8922a] mb-3">The why</p>
          {editing ? (
            <textarea
              value={form.why}
              onChange={e => setForm(f => ({ ...f, why: e.target.value }))}
              className="w-full text-[14px] text-[#666] border border-[#e8e8e8] rounded-xl px-3 py-2.5 outline-none focus:border-[#111] resize-none leading-[1.72]"
              rows={4}
            />
          ) : (
            <p className="text-[14px] text-[#666] leading-[1.72]">{goal.why}</p>
          )}
        </div>
      </div>

      <RoadmapSection goal={goal} />

      {/* Paused goals */}
      {pausedGoals.length > 0 && (
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 mb-4">
          <p className="font-medium text-[14px] mb-3">⏸ Paused goals <span className="text-[#999] font-normal">({pausedGoals.length})</span></p>
          <div className="space-y-2">
            {pausedGoals.map(g => (
              <div key={g.id} className="flex items-center gap-3 p-3 bg-[#f8f7f5] rounded-xl">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium">{g.title}</p>
                  <p className="text-[11px] text-[#999] mt-0.5">
                    Paused {g.paused_at ? new Date(g.paused_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}{g.pause_reason ? ` · ${g.pause_reason}` : ''}
                    {' · '}<span className="text-[#b8922a]">{g.streak} day streak saved</span>
                  </p>
                </div>
                <button onClick={() => resumeGoal(g.id)} disabled={resuming}
                  className="flex-shrink-0 px-3 py-1.5 bg-[#111] text-white rounded-lg text-[12px] font-medium hover:bg-[#2a2a2a] transition-colors disabled:opacity-50">
                  {resuming ? '...' : '▶ Resume'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-[#111] rounded-2xl p-6">
        <p className="text-[10px] font-medium tracking-[.12em] uppercase text-white/30 mb-3">Your affirmation</p>
        <p className="font-serif italic text-[18px] text-white/85 leading-[1.6]">"{goal.affirmation}"</p>
      </div>
    </div>
  )
}