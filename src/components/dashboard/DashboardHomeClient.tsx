'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

const MOODS = ['😞', '😐', '🙂', '😊', '🔥']
const MOOD_LABELS = ['Tough', 'Okay', 'Good', 'Great', 'On fire!']
const TIMELINE_DAYS: Record<string, number> = {
  '1 week': 7, '2 weeks': 14, '1 month': 30, '6 weeks': 42,
  '2 months': 60, '3 months': 90, '6 months': 180, '1 year': 365, '2 years': 730,
}

function phaseLabel(goal: any): string {
  if (goal.phase3_completed) return 'Phase 3 complete ✓'
  if (goal.phase2_completed) return 'Phase 3 — Push phase'
  if (goal.phase1_completed) return 'Phase 2 — Building momentum'
  return 'Phase 1 — Building foundations'
}

interface Props {
  goals: any[]
  allDailyState: Record<string, any>
  allCoachMsgs: Record<string, string>
  profile: any
  userId: string
  greeting: string
  firstName: string
  todayDate: string
}

export default function DashboardHomeClient({ goals, allDailyState, allCoachMsgs, profile, userId, greeting, firstName, todayDate }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [selectedGoalId, setSelectedGoalId] = useState(goals[0]?.id || '')
  const [dailyState, setDailyState] = useState<Record<string, any>>(allDailyState)

  // Task interaction state
  const [yesterdayDone, setYesterdayDone] = useState<boolean | null>(null)
  const [yesterdayNote, setYesterdayNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Mood check-in (Day 1 only)
  const [mood, setMood] = useState(3)
  const [moodNote, setMoodNote] = useState('')
  const [submittingMood, setSubmittingMood] = useState(false)

  // Story update
  const [storyText, setStoryText] = useState('')
  const [showStoryInput, setShowStoryInput] = useState(false)
  const [savingStory, setSavingStory] = useState(false)
  const [storyTaskPrompt, setStoryTaskPrompt] = useState(false)

  // Goal management state
  const [showGoalDetail, setShowGoalDetail] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ title: '', why: '', timeline: '' })
  const [saving, setSaving] = useState(false)

  // Paused goals
  const [pausedGoals, setPausedGoals] = useState<any[]>([])

  useEffect(() => {
    const saved = localStorage.getItem('selectedGoalId')
    if (saved && goals.find(g => g.id === saved)) setSelectedGoalId(saved)
    // Load paused goals
    supabase.from('goals').select('*').eq('user_id', userId).eq('is_active', true).eq('is_paused', true)
      .then(({ data }) => setPausedGoals(data || []))
  }, [])

  useEffect(() => {
    localStorage.setItem('selectedGoalId', selectedGoalId)
    const ds = dailyState[selectedGoalId]
    setStoryText(ds?.currentStory || '')
    setYesterdayDone(null)
    setYesterdayNote('')
    setStoryTaskPrompt(false)
    setShowStoryInput(false)
  }, [selectedGoalId])

  const goal = goals.find(g => g.id === selectedGoalId) || goals[0]
  const ds = dailyState[goal?.id] || {}

  const refreshState = async (goalId: string) => {
    const res = await fetch(`/api/daily-task?goalId=${goalId}`)
    const data = await res.json()
    if (res.ok) setDailyState(prev => ({ ...prev, [goalId]: data }))
  }

  // ── Day 1: generate first task immediately ──────────────────────
  const generateDay1Task = async () => {
    setSubmitting(true)
    const res = await fetch('/api/daily-task', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goalId: goal.id, action: 'generate_day1' }),
    })
    const data = await res.json()
    if (res.ok && data.task) {
      setDailyState(prev => ({ ...prev, [goal.id]: { ...prev[goal.id], state: 'has_task', todayTask: data.task } }))
      toast.success("Your first task is ready!")
    } else toast.error('Generation failed — try again')
    setSubmitting(false)
  }

  // ── Day 1: mood check-in only ───────────────────────────────────
  const submitMoodCheckin = async () => {
    if (ds.checkedInToday) return
    setSubmittingMood(true)
    const res = await fetch('/api/daily-task', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goalId: goal.id, action: 'checkin_mood', mood, note: moodNote }),
    })
    if (res.ok) {
      setDailyState(prev => ({ ...prev, [goal.id]: { ...prev[goal.id], checkedInToday: true } }))
      toast.success(`Checked in! Streak building 🔥`)
    }
    setSubmittingMood(false)
  }

  // ── Log yesterday + generate today ─────────────────────────────
  const logAndGenerate = async () => {
    if (yesterdayDone === null) { toast.error('Tell us if you completed yesterday\'s task'); return }
    if (!yesterdayNote.trim()) { toast.error('Add a note — what happened?'); return }
    setSubmitting(true)
    const res = await fetch('/api/daily-task', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        goalId: goal.id, action: 'log_and_generate',
        yesterdayDone, yesterdayNote: yesterdayNote.trim(),
        yesterdayTaskId: ds.yesterdayTask?.id,
      }),
    })
    const data = await res.json()
    if (res.ok && data.task) {
      setDailyState(prev => ({ ...prev, [goal.id]: { ...prev[goal.id], state: 'has_task', todayTask: data.task, checkedInToday: true } }))
      toast.success("Today's task is ready!")
    } else toast.error(data.error || 'Failed — try again')
    setSubmitting(false)
  }

  // ── Story update ────────────────────────────────────────────────
  const saveStory = async () => {
    if (!storyText.trim()) return
    setSavingStory(true)
    await fetch('/api/daily-task', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goalId: goal.id, action: 'update_story', story: storyText }),
    })
    setDailyState(prev => ({ ...prev, [goal.id]: { ...prev[goal.id], currentStory: storyText, canUpdateStory: false, storyUpdatedToday: true } }))
    setSavingStory(false)
    setShowStoryInput(false)
    // Ask if they want to update today's task
    if (ds.state === 'has_task' && ds.todayTask) setStoryTaskPrompt(true)
    else toast.success('Story updated — your coach will factor this in tomorrow')
  }

  const regenerateAfterStory = async () => {
    setStoryTaskPrompt(false)
    setSubmitting(true)
    const res = await fetch('/api/daily-task', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goalId: goal.id, action: 'regenerate_after_story' }),
    })
    const data = await res.json()
    if (res.ok && data.task) {
      setDailyState(prev => ({ ...prev, [goal.id]: { ...prev[goal.id], todayTask: data.task } }))
      toast.success("Today's task updated based on your story!")
    }
    setSubmitting(false)
  }

  if (!goal) return null

  const totalDays = TIMELINE_DAYS[goal.timeline] || 90
  const daysRemaining = Math.max(0, totalDays - (goal.daysPassed || 0))

  return (
    <div className="fade-up max-w-[900px]">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <p className="text-[13px] text-[#999] mb-0.5">{todayDate}</p>
          <h1 className="font-serif text-[32px] leading-tight">{greeting}, {firstName}.</h1>
        </div>
        <Link href="/onboarding"
          className="flex items-center gap-2 px-4 py-2 bg-[#111] text-white rounded-xl text-[13px] font-medium hover:bg-[#2a2a2a] transition-colors">
          + Add goal
        </Link>
      </div>

      {/* Goal selector tabs (if multiple goals) */}
      {goals.length > 1 && (
        <div className="flex gap-2 mb-5 flex-wrap">
          {goals.map(g => (
            <button key={g.id} onClick={() => setSelectedGoalId(g.id)}
              className={`px-4 py-2 rounded-full text-[12px] font-medium border transition-all ${selectedGoalId === g.id ? 'bg-[#111] text-white border-[#111]' : 'border-[#e8e8e8] text-[#666] hover:border-[#ccc]'}`}>
              {g.title.slice(0, 28)}{g.title.length > 28 ? '…' : ''}
            </button>
          ))}
        </div>
      )}

      {/* ── DAILY TASK STATE MACHINE ─────────────────────────── */}
      <div className="mb-5">

        {/* STATE: Day 1 — generate first task */}
        {ds.state === 'day1_no_task' && (
          <div className="bg-gradient-to-br from-[#111] to-[#1a2332] rounded-2xl p-6 mb-4 text-white">
            <p className="text-[11px] font-bold tracking-[.14em] uppercase text-[#b8922a] mb-2">Day 1 — Let's begin</p>
            <h2 className="font-serif text-[22px] mb-2 leading-snug">{goal.title}</h2>
            <p className="text-white/60 text-[13px] mb-5">Your coach is ready to give you your first task.</p>
            <button onClick={generateDay1Task} disabled={submitting}
              className="px-5 py-2.5 bg-[#b8922a] text-white rounded-xl text-[13px] font-medium hover:bg-[#9a7820] disabled:opacity-50 flex items-center gap-2 transition-colors">
              {submitting ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full spin-anim"/>Getting your first task...</> : '⚡ Get my first task'}
            </button>
          </div>
        )}

        {/* STATE: Needs yesterday log */}
        {ds.state === 'needs_yesterday_log' && ds.yesterdayTask && (
          <div className="bg-[#111] rounded-2xl p-5 mb-4 border border-[#b8922a]/30">
            <p className="text-[11px] font-bold tracking-[.14em] uppercase text-[#b8922a] mb-3">Before today's task — log yesterday</p>
            <div className="bg-white/5 rounded-xl p-3.5 mb-4">
              <p className="text-[11px] text-white/40 uppercase tracking-wide mb-1">Yesterday's task was:</p>
              <p className="text-[14px] text-white/90 leading-[1.6]">{ds.yesterdayTask.task}</p>
            </div>
            <p className="text-[13px] text-white/70 mb-3">Did you complete it?</p>
            <div className="flex gap-2 mb-4">
              <button onClick={() => setYesterdayDone(true)}
                className={`flex-1 py-2.5 rounded-xl text-[13px] font-medium transition-all ${yesterdayDone === true ? 'bg-green-500 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}>
                ✓ Yes, I did it
              </button>
              <button onClick={() => setYesterdayDone(false)}
                className={`flex-1 py-2.5 rounded-xl text-[13px] font-medium transition-all ${yesterdayDone === false ? 'bg-red-500/70 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}>
                ✗ Didn't do it
              </button>
            </div>
            {yesterdayDone !== null && (
              <>
                <textarea
                  value={yesterdayNote}
                  onChange={e => setYesterdayNote(e.target.value)}
                  placeholder={yesterdayDone ? 'What went well? Any wins to note?' : 'What got in the way? (helps your coach adapt)'}
                  className="w-full bg-white/10 text-white placeholder-white/30 text-[13px] px-4 py-3 rounded-xl border border-white/10 outline-none resize-none mb-3 focus:border-[#b8922a]/50"
                  rows={2}
                  autoFocus
                />
                <button onClick={logAndGenerate} disabled={submitting || !yesterdayNote.trim()}
                  className="w-full py-2.5 bg-[#b8922a] text-white rounded-xl text-[13px] font-medium disabled:opacity-40 flex items-center justify-center gap-2 hover:bg-[#9a7820] transition-colors">
                  {submitting ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full spin-anim"/>Generating today's task...</> : "Get today's task →"}
                </button>
              </>
            )}
          </div>
        )}

        {/* STATE: Has today's task */}
        {ds.state === 'has_task' && ds.todayTask && (
          <div className={`rounded-2xl p-5 mb-4 border ${ds.todayTask.completed ? 'bg-[#f0faf0] border-green-200' : 'bg-[#faf3e0] border-[#b8922a]/30'}`}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <p className={`text-[10px] font-bold tracking-[.14em] uppercase ${ds.todayTask.completed ? 'text-green-600' : 'text-[#b8922a]'}`}>
                {ds.todayTask.completed ? '✓ Today\'s task — complete' : '⚡ Today\'s task'}
              </p>
              {!ds.todayTask.completed && (
                <button onClick={async () => {
                  await supabase.from('daily_tasks').update({ completed: true }).eq('id', ds.todayTask.id)
                  setDailyState(prev => ({ ...prev, [goal.id]: { ...prev[goal.id], todayTask: { ...prev[goal.id].todayTask, completed: true } } }))
                  toast.success('Task marked done!')
                }}
                  className="flex-shrink-0 px-3 py-1.5 bg-[#111] text-white text-[12px] rounded-lg hover:bg-[#333] transition-colors font-medium">
                  Mark done ✓
                </button>
              )}
            </div>
            <p className={`text-[14px] leading-[1.7] font-medium ${ds.todayTask.completed ? 'text-[#666] line-through' : 'text-[#111]'}`}>
              {ds.todayTask.task}
            </p>
          </div>
        )}

        {/* STATE: no_task_yet — generate directly (gap in streak, or yesterday already logged) */}
        {ds.state === 'no_task_yet' && (
          <div className="bg-[#faf3e0] border border-[#b8922a]/30 rounded-2xl p-5 mb-4">
            <p className="text-[10px] font-bold tracking-[.14em] uppercase text-[#b8922a] mb-2">⚡ Ready for today</p>
            <p className="text-[13px] text-[#666] mb-4">Get your task for today based on your progress.</p>
            <button onClick={generateDay1Task} disabled={submitting}
              className="px-5 py-2.5 bg-[#111] text-white rounded-xl text-[13px] font-medium hover:bg-[#2a2a2a] disabled:opacity-50 flex items-center gap-2 transition-colors">
              {submitting ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full spin-anim"/>Generating...</> : "Get today's task →"}
            </button>
          </div>
        )}

        {/* Story task update prompt */}
        {storyTaskPrompt && (
          <div className="bg-white border border-[#b8922a]/30 rounded-2xl p-4 mb-4 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[13px] text-[#111]">Your story changed — update today's task to match?</p>
            <div className="flex gap-2">
              <button onClick={() => setStoryTaskPrompt(false)} className="px-3 py-1.5 border border-[#e8e8e8] rounded-lg text-[12px] text-[#666]">Keep current</button>
              <button onClick={regenerateAfterStory} disabled={submitting} className="px-3 py-1.5 bg-[#b8922a] text-white rounded-lg text-[12px] font-medium disabled:opacity-50">
                {submitting ? 'Updating...' : 'Yes, update it'}
              </button>
            </div>
          </div>
        )}

        {/* Day 1 mood check-in */}
        {ds.state === 'has_task' && ds.isDay1 && !ds.checkedInToday && (
          <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 mb-4">
            <p className="font-serif text-[18px] mb-1">How are you feeling starting this?</p>
            <p className="text-[13px] text-[#999] mb-4">Day 1 check-in — no task log needed today</p>
            <div className="flex gap-2 mb-3">
              {MOODS.map((emoji, i) => (
                <button key={i} onClick={() => setMood(i + 1)} title={MOOD_LABELS[i]}
                  className={`flex-1 py-2.5 rounded-xl text-[18px] transition-all ${mood === i + 1 ? 'bg-[#b8922a] scale-105' : 'bg-[#f2f0ec] hover:bg-[#e8e5de]'}`}>
                  {emoji}
                </button>
              ))}
            </div>
            <input value={moodNote} onChange={e => setMoodNote(e.target.value)}
              placeholder="One word on how you're feeling... (optional)"
              className="w-full px-4 py-2.5 bg-[#f8f7f5] border border-[#e8e8e8] rounded-xl text-[13px] outline-none focus:border-[#b8922a] mb-3 transition-colors" />
            <button onClick={submitMoodCheckin} disabled={submittingMood}
              className="w-full py-2.5 bg-[#111] text-white rounded-xl text-[13px] font-medium disabled:opacity-50 hover:bg-[#333] transition-colors">
              {submittingMood ? 'Logging...' : 'Log check-in ✓'}
            </button>
          </div>
        )}
      </div>

      {/* ── STATS ROW ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { val: String(goal.streak || 0), label: 'Day streak 🔥' },
          { val: `${goal.progress || 0}%`, label: 'Progress', isProgress: true },
          { val: String(daysRemaining), label: 'Days remaining' },
          { val: phaseLabel(goal), label: 'Current phase', small: true },
        ].map(({ val, label, isProgress, small }) => (
          <div key={label} className="bg-white border border-[#e8e8e8] rounded-2xl p-4">
            <p className={`font-serif ${small ? 'text-[13px] font-medium' : 'text-[28px]'} text-[#111] leading-tight mb-1`}>{val}</p>
            {isProgress && (
              <div className="h-1 bg-[#f0ede8] rounded-full overflow-hidden mb-1">
                <div className="h-full bg-[#b8922a] rounded-full" style={{ width: `${goal.progress || 0}%` }}/>
              </div>
            )}
            <p className="text-[10px] font-medium uppercase tracking-[.1em] text-[#999]">{label}</p>
          </div>
        ))}
      </div>

      {/* ── CURRENT STORY ────────────────────────────────────── */}
      <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 mb-5">
        <div className="flex items-center justify-between mb-2">
          <p className="font-medium text-[14px]">Current story</p>
          {ds.canUpdateStory && !showStoryInput && (
            <button onClick={() => setShowStoryInput(true)}
              className="text-[11px] text-[#b8922a] hover:underline">
              {ds.currentStory ? 'Update' : 'Add'} (once/day)
            </button>
          )}
          {!ds.canUpdateStory && (
            <span className="text-[11px] text-[#999]">Updated today</span>
          )}
        </div>
        {showStoryInput ? (
          <div>
            <textarea value={storyText} onChange={e => setStoryText(e.target.value)}
              placeholder="What's happening in your life right now? Travelling? Busy week? Injured? Your coach factors this in..."
              className="w-full px-4 py-3 border border-[#e8e8e8] rounded-xl text-[13px] outline-none focus:border-[#b8922a] resize-none mb-3 transition-colors"
              rows={3} autoFocus/>
            <div className="flex gap-2">
              <button onClick={() => setShowStoryInput(false)} className="px-4 py-2 border border-[#e8e8e8] rounded-xl text-[12px] text-[#666]">Cancel</button>
              <button onClick={saveStory} disabled={savingStory || !storyText.trim()}
                className="px-4 py-2 bg-[#111] text-white rounded-xl text-[12px] font-medium disabled:opacity-40 hover:bg-[#333] transition-colors">
                {savingStory ? 'Saving...' : 'Save story'}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-[13px] text-[#666] leading-[1.6]">
            {ds.currentStory || <span className="text-[#bbb] italic">No story yet — tap Update to tell your coach what's going on in your life</span>}
          </p>
        )}
      </div>

      {/* ── COACH MESSAGE ────────────────────────────────────── */}
      {allCoachMsgs[goal.id] && (
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 mb-5">
          <p className="text-[10px] font-bold tracking-[.14em] uppercase text-[#b8922a] mb-2">Coach message</p>
          <p className="font-serif italic text-[15px] text-[#333] leading-[1.7]">"{allCoachMsgs[goal.id]}"</p>
          <Link href="/dashboard/coach" className="text-[12px] text-[#b8922a] hover:underline mt-2 inline-block">Continue with coach →</Link>
        </div>
      )}

      {/* ── GOAL DETAIL (collapsible) ─────────────────────────── */}
      <div className="bg-white border border-[#e8e8e8] rounded-2xl overflow-hidden mb-5">
        <button onClick={() => setShowGoalDetail(!showGoalDetail)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#f8f7f5] transition-colors">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-[14px] font-medium text-left">{goal.title.slice(0, 60)}{goal.title.length > 60 ? '…' : ''}</p>
              <p className="text-[11px] text-[#999] text-left">{goal.category} · {goal.timeline}</p>
            </div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className={`text-[#999] transition-transform ${showGoalDetail ? 'rotate-180' : ''}`}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        {showGoalDetail && (
          <div className="px-5 pb-5 border-t border-[#f0ede8]">
            {editing ? (
              <div className="pt-4 space-y-3">
                <div>
                  <label className="text-[11px] font-medium text-[#666] uppercase tracking-wide mb-1 block">Goal</label>
                  <textarea value={editForm.title} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))}
                    className="w-full px-3.5 py-2.5 border border-[#e8e8e8] rounded-xl text-[13px] outline-none focus:border-[#b8922a] resize-none" rows={3}/>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-[#666] uppercase tracking-wide mb-1 block">Why</label>
                  <textarea value={editForm.why} onChange={e => setEditForm(p => ({ ...p, why: e.target.value }))}
                    className="w-full px-3.5 py-2.5 border border-[#e8e8e8] rounded-xl text-[13px] outline-none focus:border-[#b8922a] resize-none" rows={2}/>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setEditing(false)} className="flex-1 py-2 border border-[#e8e8e8] rounded-xl text-[13px]">Cancel</button>
                  <button onClick={async () => {
                    setSaving(true)
                    await supabase.from('goals').update({ title: editForm.title, why: editForm.why }).eq('id', goal.id)
                    setSaving(false); setEditing(false); router.refresh()
                  }} disabled={saving} className="flex-1 py-2 bg-[#111] text-white rounded-xl text-[13px] font-medium disabled:opacity-40">
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="pt-4 space-y-3">
                <div>
                  <p className="text-[11px] text-[#999] uppercase tracking-wide mb-1">Why</p>
                  <p className="text-[13px] text-[#333] leading-[1.6]">{goal.why}</p>
                </div>
                {goal.obstacles && (
                  <div>
                    <p className="text-[11px] text-[#999] uppercase tracking-wide mb-1">Known obstacles</p>
                    <p className="text-[13px] text-[#333] leading-[1.6]">{goal.obstacles}</p>
                  </div>
                )}
                <div className="flex gap-2 pt-1 flex-wrap">
                  <button onClick={() => { setEditing(true); setEditForm({ title: goal.title, why: goal.why || '', timeline: goal.timeline }) }}
                    className="px-4 py-2 border border-[#e8e8e8] rounded-xl text-[12px] text-[#666] hover:bg-[#f8f7f5] transition-colors">
                    Edit goal
                  </button>
                  <button onClick={async () => {
                    if (!confirm('Pause this goal?')) return
                    await supabase.from('goals').update({ is_paused: true }).eq('id', goal.id)
                    router.refresh()
                  }} className="px-4 py-2 border border-[#e8e8e8] rounded-xl text-[12px] text-[#666] hover:bg-[#f8f7f5] transition-colors">
                    Pause
                  </button>
                  <Link href="/dashboard/coach"
                    className="px-4 py-2 bg-[#b8922a] text-white rounded-xl text-[12px] font-medium hover:bg-[#9a7820] transition-colors">
                    Open coach →
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── ROADMAP (phases) ─────────────────────────────────── */}
      <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <p className="font-medium text-[14px]">Roadmap</p>
          <span className="text-[11px] text-[#999]">Day {goal.daysPassed || 0} of {goal.totalDays || 90}</span>
        </div>
        <div className="h-1.5 bg-[#f0ede8] rounded-full overflow-hidden mb-4">
          <div className="h-full bg-[#b8922a] rounded-full transition-all duration-700" style={{ width: `${goal.progress || 0}%` }}/>
        </div>
        {[
          { label: 'Phase 1', pct: 33, target: goal.milestone_30, done: goal.phase1_completed, field: 'phase1_completed' },
          { label: 'Phase 2', pct: 66, target: goal.milestone_60, done: goal.phase2_completed, field: 'phase2_completed' },
          { label: 'Phase 3', pct: 100, target: goal.milestone_100, done: goal.phase3_completed, field: 'phase3_completed' },
        ].map((phase, i) => (
          <div key={phase.label} className={`rounded-xl p-3.5 mb-2 border ${phase.done ? 'bg-green-50/50 border-green-200' : i === 0 && !goal.phase1_completed ? 'bg-[#faf9f7] border-[#b8922a]/30' : 'border-[#f0ede8]'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${phase.done ? 'bg-green-500' : i === 0 && !goal.phase1_completed ? 'bg-[#b8922a]' : 'bg-[#e0ddd8]'}`}>
                  {phase.done && <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                  {!phase.done && i === 0 && !goal.phase1_completed && <span className="w-1.5 h-1.5 rounded-full bg-white"/>}
                </div>
                <p className="text-[11px] font-bold text-[#b8922a] uppercase tracking-[.1em]">{phase.label}</p>
              </div>
              <span className="text-[10px] text-[#999]">{phase.pct}%</span>
            </div>
            {phase.target && <p className="text-[12px] text-[#666] mt-1.5 leading-[1.5] pl-5">{phase.target.slice(0, 120)}</p>}
          </div>
        ))}
      </div>

      {/* ── PAUSED GOALS ─────────────────────────────────────── */}
      {pausedGoals.length > 0 && (
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 mb-5">
          <p className="font-medium text-[14px] mb-3">Paused goals</p>
          <div className="space-y-2">
            {pausedGoals.map(pg => (
              <div key={pg.id} className="flex items-center justify-between gap-3 py-2 border-b border-[#f0ede8] last:border-0">
                <p className="text-[13px] text-[#666] truncate">{pg.title}</p>
                <button onClick={async () => {
                  await supabase.from('goals').update({ is_paused: false }).eq('id', pg.id)
                  setPausedGoals(prev => prev.filter(g => g.id !== pg.id))
                  router.refresh()
                }} className="text-[11px] text-[#b8922a] hover:underline flex-shrink-0">Resume</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}