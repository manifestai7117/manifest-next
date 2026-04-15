'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'

const TIMELINES = ['1 week','2 weeks','1 month','6 weeks','2 months','3 months','6 months','1 year','2 years']


// Generate smart milestone text from goal context when DB fields are empty
function autoMilestone(goal: any, phase: number): string {
  const title = (goal.title || 'your goal').trim()
  const titleLower = title.toLowerCase()
  const timeline = goal.timeline || '3 months'
  const TDAYS: Record<string, number> = {
    '1 week': 7, '2 weeks': 14, '1 month': 30, '6 weeks': 42,
    '2 months': 60, '3 months': 90, '6 months': 180, '1 year': 365, '2 years': 730,
  }
  const totalDays = TDAYS[timeline] || 90
  const d1 = Math.round(totalDays * 0.33)
  const d2 = Math.round(totalDays * 0.66)

  // Sport / skill-based goals — derive specific targets from the actual goal title
  const sportMatch = titleLower.match(/(pickleball|tennis|golf|basketball|soccer|football|volleyball|chess|poker|swimming|cycling|boxing|yoga|martial arts|guitar|piano|coding|programming|drawing|painting)/)
  if (sportMatch) {
    const sport = sportMatch[1]
    const targets: Record<string, string[]> = {
      pickleball: [
        `Play at least 3 sessions per week, master the dink shot and serve consistency, and win your first competitive point by day ${d1}`,
        `Reduce unforced errors by 50%, hold your own in doubles rallies, and complete ${d2} days of deliberate practice`,
        `Achieve your defined level of play — keep up with your friends in a real match and win sets consistently`,
      ],
      tennis: [
        `Hit ${d1} consecutive days of practice, master the forehand groundstroke, and sustain 10-shot rallies`,
        `Learn backhand and serve, play 5 competitive sets against opponents, reach ${d2} days consistent`,
        `Win a set against someone at your target skill level — complete "${title}"`,
      ],
      golf: [
        `Play 9 holes 3x per week, break 60 for 9 holes, and eliminate 3-putts by day ${d1}`,
        `Break 50 for 9 holes consistently, improve driving accuracy, reach ${d2} rounds played`,
        `Achieve your target handicap and complete "${title}" with a round you're proud of`,
      ],
      guitar: [
        `Learn 5 chords and 2 songs, practice 30 min daily, build calluses — complete by day ${d1}`,
        `Learn 10 songs, practice barre chords, play through a full set without stopping by day ${d2}`,
        `Perform "${title}" — play in front of someone or record yourself playing confidently`,
      ],
      coding: [
        `Complete foundational modules, build 2 small projects, commit code daily through day ${d1}`,
        `Build a real project, get code reviewed, solve 20 algorithm problems by day ${d2}`,
        `Ship something real to production or portfolio — achieve "${title}"`,
      ],
    }
    const sportTargets = targets[sport]
    if (sportTargets) return sportTargets[phase - 1] || sportTargets[0]
    // Generic sport fallback
    const generic = [
      `Practice ${sport} at least 3x per week, focus on fundamentals, and achieve a measurable skill improvement by day ${d1}`,
      `Compete or spar regularly, identify and fix your 2 biggest weaknesses in ${sport} by day ${d2}`,
      `Achieve "${title}" — demonstrate the skill level you set out for in a real situation`,
    ]
    return generic[phase - 1] || generic[0]
  }

  // Running / marathon
  if (titleLower.includes('run') || titleLower.includes('marathon') || titleLower.includes('5k') || titleLower.includes('10k')) {
    const targets = [
      `Run 3x per week without missing, complete a ${d1}-day streak, and build to 30 min non-stop`,
      `Increase weekly mileage by 10%, run your longest distance yet, maintain consistency through day ${d2}`,
      `Complete "${title}" — cross the finish line or hit your target pace/distance`,
    ]
    return targets[phase - 1] || targets[0]
  }

  // Weight / body composition
  if (titleLower.includes('weight') || titleLower.includes('lbs') || titleLower.includes('kg') || titleLower.includes('fat') || titleLower.includes('muscle')) {
    const targets = [
      `Track every meal for ${d1} days, hit your calorie/macro targets 80% of days, start your workout routine`,
      `Lose/gain the first visible increment toward your goal, never miss a workout week through day ${d2}`,
      `Achieve "${title}" — hit your target weight/body composition and maintain it for 2 weeks`,
    ]
    return targets[phase - 1] || targets[0]
  }

  // Reading
  if (titleLower.includes('read') || titleLower.includes('book')) {
    const targets = [
      `Read every day for ${d1} days, finish your first book, build the daily habit`,
      `Complete ${Math.round(totalDays / 30)} books, take notes on every chapter, reach day ${d2}`,
      `Complete "${title}" — finish all books on your list and write a reflection`,
    ]
    return targets[phase - 1] || targets[0]
  }

  // Financial
  if (titleLower.includes('save') || titleLower.includes('money') || titleLower.includes('debt') || titleLower.includes('invest')) {
    const targets = [
      `Automate your savings, cut 2 unnecessary expenses, hit your first monthly target by day ${d1}`,
      `Reach 50% of your financial goal, stay on budget every week through day ${d2}`,
      `Achieve "${title}" — hit your financial number and celebrate responsibly`,
    ]
    return targets[phase - 1] || targets[0]
  }

  // Generic — always uses the actual goal title
  const targets = [
    `Commit to daily action toward "${title}" — check in every day, establish your core habit, and hit a ${d1}-day streak`,
    `Push past the plateau — increase intensity or frequency, solve the hardest obstacle you face, maintain momentum to day ${d2}`,
    `Complete "${title}" — achieve the exact outcome you set out for and document what you learned`,
  ]
  return targets[phase - 1] || targets[0]
}

const TIMELINE_DAYS: Record<string, number> = {
  '1 week': 7, '2 weeks': 14, '1 month': 30, '6 weeks': 42,
  '2 months': 60, '3 months': 90, '6 months': 180, '1 year': 365, '2 years': 730,
}

function RoadmapSection({ goal, onGoalUpdate }: { goal: any; onGoalUpdate: (updated: any) => void }) {
  const supabase = createClient()
  const [completing, setCompleting] = useState<number | null>(null)
  
  const totalDays = TIMELINE_DAYS[goal.timeline] || 90
  const startDate = new Date(goal.created_at)
  const today = new Date()
  const rawDays = Math.floor((today.getTime() - startDate.getTime()) / 86400000)
  const daysPassed = Math.max(0, rawDays, goal.streak || 0)
  // Progress: use phase completions as floor (33/66/100%), else use time+streak
  const phaseFloor = goal.phase3_completed ? 100 : goal.phase2_completed ? 66 : goal.phase1_completed ? 33 : 0
  const timePct = Math.round((daysPassed / totalDays) * 100)
  const pct = Math.min(100, Math.max(phaseFloor, timePct, goal.progress || 0))

  // Use AI-generated milestones from DB, not generic fallbacks
  const phases = [
    {
      num: 1,
      label: 'Phase 1',
      milestone: goal.milestone_30 || goal.milestone_1 || autoMilestone(goal, 1),
      actions: (goal.phase1Actions || goal.phase1_actions || '').split('|').filter((a: string) => a.trim()),
      done: !!goal.phase1_completed,
      completedAt: goal.phase1_completed_at,
      // Due date: if completed early, show actual date; else show planned date
      plannedDate: new Date(startDate.getTime() + Math.round(totalDays * 0.33) * 86400000),
      dayTarget: Math.round(totalDays * 0.33),
      completedField: 'phase1_completed',
      completedAtField: 'phase1_completed_at',
    },
    {
      num: 2,
      label: 'Phase 2',
      milestone: goal.milestone_60 || goal.milestone_2 || autoMilestone(goal, 2),
      actions: (goal.phase2Actions || goal.phase2_actions || '').split('|').filter((a: string) => a.trim()),
      done: !!goal.phase2_completed,
      completedAt: goal.phase2_completed_at,
      plannedDate: new Date(startDate.getTime() + Math.round(totalDays * 0.66) * 86400000),
      dayTarget: Math.round(totalDays * 0.66),
      completedField: 'phase2_completed',
      completedAtField: 'phase2_completed_at',
    },
    {
      num: 3,
      label: 'Phase 3 — Final',
      milestone: goal.milestone_90 || goal.milestone_3 || autoMilestone(goal, 3),
      actions: (goal.phase3Actions || goal.phase3_actions || '').split('|').filter((a: string) => a.trim()),
      done: !!goal.phase3_completed,
      completedAt: goal.phase3_completed_at,
      plannedDate: new Date(startDate.getTime() + totalDays * 86400000),
      dayTarget: totalDays,
      completedField: 'phase3_completed',
      completedAtField: 'phase3_completed_at',
    },
  ]

  const markComplete = async (phase: typeof phases[0]) => {
    if (completing !== null) return
    setCompleting(phase.num)
    const now = new Date().toISOString()
    // Progress: Phase 1 = 33%, Phase 2 = 66%, Phase 3 = 100%
    const phaseProgress = { 1: 33, 2: 66, 3: 100 }[phase.num] || 33
    const newProgress = Math.max(goal.progress || 0, phaseProgress)
    const { data } = await supabase.from('goals').update({
      [phase.completedField]: true,
      [phase.completedAtField]: now,
      progress: newProgress,
    }).eq('id', goal.id).select().single()
    if (data) onGoalUpdate(data)
    setCompleting(null)
    toast.success(`Phase ${phase.num} complete! Progress updated to ${newProgress}% 🎉`)
  }

  const unmarkComplete = async (phase: typeof phases[0]) => {
    setCompleting(phase.num)
    const { data } = await supabase.from('goals').update({
      [phase.completedField]: false,
      [phase.completedAtField]: null,
    }).eq('id', goal.id).select().single()
    if (data) onGoalUpdate(data)
    setCompleting(null)
  }

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

      <div className="space-y-3">
        {phases.map((p, i) => {
          const prevDone = i === 0 || phases[i-1].done
          const isPast = !p.done && today > p.plannedDate
          const isCurrent = !p.done && prevDone && daysPassed < p.dayTarget
          const isLocked = !p.done && !prevDone
          const displayDate = p.done && p.completedAt
            ? new Date(p.completedAt)
            : p.plannedDate

          let statusBg = 'bg-[#e0ddd8]'
          let cardBorder = 'border-[#f0ede8]'
          if (p.done) { statusBg = 'bg-green-500'; cardBorder = 'border-green-200 bg-green-50/30' }
          else if (isCurrent) { statusBg = 'bg-[#b8922a]'; cardBorder = 'border-[#b8922a]/30 bg-[#faf9f7]' }
          else if (isPast) { statusBg = 'bg-red-400'; cardBorder = 'border-red-100' }

          const badgeStyle = p.done ? 'bg-green-100 text-green-700'
            : isCurrent ? 'bg-[#faf3e0] text-[#b8922a]'
            : isPast ? 'bg-red-50 text-red-500'
            : 'bg-[#f2f0ec] text-[#999]'
          const completedEarly = p.done && p.completedAt && new Date(p.completedAt) < p.plannedDate
          const badgeText = p.done ? `Done ✓${completedEarly ? ' (ahead of schedule!)' : ''}`
            : isCurrent ? 'In progress'
            : isPast ? 'Overdue'
            : `Starts day ${i === 0 ? 1 : phases[i-1].dayTarget + 1}`

          return (
            <div key={p.label} className={`border rounded-2xl p-4 transition-all ${cardBorder}`}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2.5">
                  <div className={`w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center ${statusBg}`}>
                    {p.done
                      ? <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>
                      : isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-white"/>
                    }
                  </div>
                  <p className="text-[11px] font-bold text-[#b8922a] uppercase tracking-[.1em]">{p.label}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <span className="text-[11px] text-[#999]">
                    {p.done && p.completedAt
                      ? `Done ${new Date(p.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                      : `By ${p.plannedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                  </span>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${badgeStyle}`}>{badgeText}</span>
                </div>
              </div>

              {/* Milestone goal */}
              {p.milestone ? (
                <p className="text-[14px] text-[#111] leading-[1.6] mb-2 ml-6 font-medium">{p.milestone}</p>
              ) : (
                <p className="text-[13px] text-[#999] italic ml-6 mb-2">Create a new goal to generate specific phase targets.</p>
              )}

              {/* Actions */}
              {p.actions.length > 0 && (
                <div className="ml-6 space-y-1 mb-3">
                  {p.actions.map((action: string, ai: number) => (
                    <div key={ai} className="flex items-start gap-2">
                      <span className="text-[#b8922a] text-[11px] mt-[3px] flex-shrink-0">→</span>
                      <p className="text-[12px] text-[#666] leading-[1.5]">{action.trim()}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Mark complete / undo button */}
              {!isLocked && (
                <div className="ml-6 mt-2">
                  {p.done ? (
                    <button onClick={() => unmarkComplete(p)}
                      disabled={completing === p.num}
                      className="text-[11px] text-[#999] hover:text-red-500 transition-colors underline underline-offset-2">
                      {completing === p.num ? 'Updating...' : 'Undo completion'}
                    </button>
                  ) : (
                    <button onClick={() => markComplete(p)}
                      disabled={completing === p.num}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#111] text-white rounded-xl text-[12px] font-medium hover:bg-[#2a2a2a] transition-colors disabled:opacity-50">
                      {completing === p.num
                        ? 'Saving...'
                        : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg> Mark phase complete</>
                      }
                    </button>
                  )}
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
    toast.success('Goal paused.')
    router.refresh()
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
    toast.success('Goal resumed! 🎯')
    router.refresh()
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

      <RoadmapSection goal={goal} onGoalUpdate={(updated) => {
        setGoal(updated)
        setGoals(prev => prev.map(g => g.id === updated.id ? updated : g))
      }} />

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