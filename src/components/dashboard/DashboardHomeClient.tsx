'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

// ─── Constants ───────────────────────────────────────────────────
const TIMELINES = ['1 week','2 weeks','1 month','6 weeks','2 months','3 months','6 months','1 year','2 years']
const MOODS = ['😞','😐','🙂','😊','🔥']
const MOOD_LABELS = ['Tough','Okay','Good','Great','On fire!']
const TIMELINE_DAYS: Record<string, number> = {
  '1 week':7,'2 weeks':14,'1 month':30,'6 weeks':42,
  '2 months':60,'3 months':90,'6 months':180,'1 year':365,'2 years':730,
}

// ─── Auto-milestone generator (mirrors goal page logic) ──────────
function autoMilestone(goal: any, phase: number): string {
  const title = (goal.title||'your goal').trim()
  const tl = title.toLowerCase()
  const total = TIMELINE_DAYS[goal.timeline]||90
  const d1 = Math.round(total*0.33), d2 = Math.round(total*0.66)
  if (tl.match(/(weight|lbs|kg|fat|muscle|body)/)) {
    return [
      `Track every meal for ${d1} days, hit macro targets 80% of days, start your workout routine`,
      `Lose/gain the first visible increment toward your goal, never miss a workout week through day ${d2}`,
      `Achieve "${title}" — hit your target and maintain it for 2 weeks`,
    ][phase-1]||''
  }
  if (tl.match(/(run|marathon|5k|10k)/)) {
    return [
      `Run 3x per week, build to 30 min non-stop by day ${d1}`,
      `Increase weekly mileage by 10%, run your longest distance yet by day ${d2}`,
      `Complete "${title}" — cross the finish line or hit your target pace`,
    ][phase-1]||''
  }
  return [
    `Commit to daily action — establish your core habit and hit a ${d1}-day streak`,
    `Push past the plateau — increase intensity, solve your biggest obstacle by day ${d2}`,
    `Complete "${title}" — achieve the exact outcome you set out for`,
  ][phase-1]||''
}

// ─── Phase label helper ──────────────────────────────────────────
function phaseLabel(goal: any): string {
  if (goal.phase3_completed) return 'Phase 3 complete ✓'
  if (goal.phase2_completed) return 'Phase 3 — Final push'
  if (goal.phase1_completed) return 'Phase 2 — Building momentum'
  return 'Phase 1 — Building foundations'
}

// ─── RoadmapSection ──────────────────────────────────────────────
function RoadmapSection({ goal, onGoalUpdate }: { goal: any; onGoalUpdate: (g: any) => void }) {
  const supabase = createClient()
  const [completing, setCompleting] = useState<number|null>(null)
  const total = TIMELINE_DAYS[goal.timeline]||90
  const start = new Date(goal.created_at)
  const daysPassed = Math.max(0, Math.floor((Date.now()-start.getTime())/86400000), goal.streak||0)
  const phaseFloor = goal.phase3_completed?100:goal.phase2_completed?66:goal.phase1_completed?33:0
  const pct = Math.min(100, Math.max(phaseFloor, Math.round((daysPassed/total)*100), goal.progress||0))

  const phases = [
    { num:1, label:'Phase 1', pct:33, milestone:goal.milestone_30||goal.milestone_1||autoMilestone(goal,1), done:!!goal.phase1_completed, completedAt:goal.phase1_completed_at, plannedDate:new Date(start.getTime()+Math.round(total*0.33)*86400000), completedField:'phase1_completed', completedAtField:'phase1_completed_at' },
    { num:2, label:'Phase 2', pct:66, milestone:goal.milestone_60||goal.milestone_2||autoMilestone(goal,2), done:!!goal.phase2_completed, completedAt:goal.phase2_completed_at, plannedDate:new Date(start.getTime()+Math.round(total*0.66)*86400000), completedField:'phase2_completed', completedAtField:'phase2_completed_at' },
    { num:3, label:'Phase 3 — Final', pct:100, milestone:goal.milestone_90||goal.milestone_3||autoMilestone(goal,3), done:!!goal.phase3_completed, completedAt:goal.phase3_completed_at, plannedDate:new Date(start.getTime()+total*86400000), completedField:'phase3_completed', completedAtField:'phase3_completed_at' },
  ]

  const markComplete = async (p: typeof phases[0]) => {
    if (completing!==null) return
    setCompleting(p.num)
    const now = new Date().toISOString()
    const newProg = Math.max(goal.progress||0, p.pct)
    const { data } = await supabase.from('goals').update({ [p.completedField]:true, [p.completedAtField]:now, progress:newProg }).eq('id',goal.id).select().single()
    if (data) onGoalUpdate(data)
    setCompleting(null)
    toast.success(`Phase ${p.num} complete! 🎉`)
  }

  const unmark = async (p: typeof phases[0]) => {
    setCompleting(p.num)
    const { data } = await supabase.from('goals').update({ [p.completedField]:false, [p.completedAtField]:null }).eq('id',goal.id).select().single()
    if (data) onGoalUpdate(data)
    setCompleting(null)
    toast.success('Phase unmarked')
  }

  const today = new Date()

  return (
    <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 mb-4">
      <div className="flex items-center justify-between mb-3">
        <p className="font-medium text-[15px]">Roadmap</p>
        <span className="text-[11px] text-[#999]">Day {daysPassed} of {total} · {pct}%</span>
      </div>
      <div className="h-1.5 bg-[#f0ede8] rounded-full overflow-hidden mb-4">
        <div className="h-full bg-[#b8922a] rounded-full transition-all duration-700" style={{width:`${pct}%`}}/>
      </div>
      <div className="space-y-3">
        {phases.map((p, i) => {
          const prevDone = i===0||phases[i-1].done
          const isPast = !p.done && today > p.plannedDate
          const isCurrent = !p.done && prevDone
          const isLocked = !p.done && !prevDone
          const cardBorder = p.done ? 'border-green-200 bg-green-50/30' : isCurrent ? 'border-[#b8922a]/30 bg-[#faf9f7]' : isPast ? 'border-red-100' : 'border-[#f0ede8]'
          const dotBg = p.done ? 'bg-green-500' : isCurrent ? 'bg-[#b8922a]' : 'bg-[#e0ddd8]'
          const badge = p.done ? 'bg-green-100 text-green-700' : isCurrent ? 'bg-[#faf3e0] text-[#b8922a]' : isPast ? 'bg-red-50 text-red-500' : 'bg-[#f2f0ec] text-[#999]'
          const badgeText = p.done ? `Done ✓${p.completedAt && new Date(p.completedAt)<p.plannedDate ? ' (early!)' : ''}` : isCurrent ? 'In progress' : isPast ? 'Overdue' : `Starts day ${i===0?1:phases[i-1].pct*total/100+1|0}`

          return (
            <div key={p.label} className={`border rounded-2xl p-4 transition-all ${cardBorder}`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2.5">
                  <div className={`w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center ${dotBg}`}>
                    {p.done ? <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>
                    : isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-white"/>}
                  </div>
                  <p className="text-[11px] font-bold text-[#b8922a] uppercase tracking-[.1em]">{p.label}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  <span className="text-[10px] text-[#999]">
                    {p.done && p.completedAt ? `Done ${new Date(p.completedAt).toLocaleDateString('en-US',{month:'short',day:'numeric'})}` : `By ${p.plannedDate.toLocaleDateString('en-US',{month:'short',day:'numeric'})}`}
                  </span>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${badge}`}>{badgeText}</span>
                </div>
              </div>
              {p.milestone && <p className="text-[13px] text-[#333] leading-[1.6] mb-3 ml-6">{p.milestone}</p>}
              {!isLocked && (
                <div className="ml-6">
                  {p.done ? (
                    <button onClick={()=>unmark(p)} disabled={completing===p.num} className="text-[11px] text-[#999] hover:text-red-500 transition-colors underline">
                      {completing===p.num ? 'Updating...' : 'Undo completion'}
                    </button>
                  ) : (
                    <button onClick={()=>markComplete(p)} disabled={completing===p.num}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#111] text-white rounded-xl text-[12px] font-medium hover:bg-[#2a2a2a] transition-colors disabled:opacity-50">
                      {completing===p.num ? 'Saving...' : <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>Mark phase complete</>}
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

// ─── Main component ──────────────────────────────────────────────
interface Props {
  goals: any[]
  allDailyState: Record<string,any>
  allCoachMsgs: Record<string,string>
  profile: any
  userId: string
  greeting: string
  firstName: string
  todayDate: string
}

export default function DashboardHomeClient({ goals: initialGoals, allDailyState, allCoachMsgs, profile, userId, greeting, firstName, todayDate }: Props) {
  const supabase = createClient()
  const router = useRouter()

  const [goals, setGoals] = useState(initialGoals)
  const [selectedGoalId, setSelectedGoalId] = useState(initialGoals[0]?.id||'')
  const [dailyState, setDailyState] = useState<Record<string,any>>(allDailyState)

  // Daily task state
  const [yesterdayDone, setYesterdayDone] = useState<boolean|null>(null)
  const [yesterdayNote, setYesterdayNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [mood, setMood] = useState(3)
  const [moodNote, setMoodNote] = useState('')
  const [submittingMood, setSubmittingMood] = useState(false)

  // Story
  const [storyText, setStoryText] = useState('')
  const [showStoryInput, setShowStoryInput] = useState(false)
  const [savingStory, setSavingStory] = useState(false)
  const [storyTaskPrompt, setStoryTaskPrompt] = useState(false)

  // Goal management
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({title:'',why:'',timeline:''})
  const [saving, setSaving] = useState(false)
  const [showPauseModal, setShowPauseModal] = useState(false)
  const [pauseReason, setPauseReason] = useState('')
  const [pausing, setPausing] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [successNote, setSuccessNote] = useState('')
  const [pausedGoals, setPausedGoals] = useState<any[]>([])
  const [resuming, setResuming] = useState<string|null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('selectedGoalId')
    if (saved && goals.find(g=>g.id===saved)) setSelectedGoalId(saved)
    supabase.from('goals').select('*').eq('user_id',userId).eq('is_active',true).eq('is_paused',true)
      .then(({data})=>setPausedGoals(data||[]))
  }, [])

  useEffect(() => {
    localStorage.setItem('selectedGoalId', selectedGoalId)
    const ds = dailyState[selectedGoalId]
    setStoryText(ds?.currentStory||'')
    setYesterdayDone(null); setYesterdayNote('')
    setStoryTaskPrompt(false); setShowStoryInput(false)
    const g = goals.find(g=>g.id===selectedGoalId)
    if (g) setEditForm({title:g.title,why:g.why||'',timeline:g.timeline||''})
  }, [selectedGoalId])

  const goal = goals.find(g=>g.id===selectedGoalId)||goals[0]
  const ds = dailyState[goal?.id]||{}
  const total = TIMELINE_DAYS[goal?.timeline]||90
  const daysRemaining = Math.max(0, total-(goal?.daysPassed||0))

  const refreshState = async (goalId: string) => {
    const res = await fetch(`/api/daily-task?goalId=${goalId}`)
    const data = await res.json()
    if (res.ok) setDailyState(prev=>({...prev,[goalId]:data}))
  }

  // ── Daily task actions ────────────────────────────────────────
  const generateTask = async (action='generate_day1') => {
    setSubmitting(true)
    const res = await fetch('/api/daily-task',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({goalId:goal.id,action})})
    const data = await res.json()
    if (res.ok&&data.task) {
      setDailyState(prev=>({...prev,[goal.id]:{...prev[goal.id],state:'has_task',todayTask:data.task}}))
      toast.success("Today's task is ready!")
    } else toast.error(data.error||'Generation failed — try again')
    setSubmitting(false)
  }

  const submitMoodCheckin = async () => {
    setSubmittingMood(true)
    const res = await fetch('/api/daily-task',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({goalId:goal.id,action:'checkin_mood',mood,note:moodNote})})
    if (res.ok) {
      setDailyState(prev=>({...prev,[goal.id]:{...prev[goal.id],checkedInToday:true}}))
      toast.success('Checked in! 🔥')
    }
    setSubmittingMood(false)
  }

  const logAndGenerate = async () => {
    if (yesterdayDone===null){toast.error('Tell us if you completed yesterday\'s task');return}
    if (!yesterdayNote.trim()){toast.error('Add a short note — helps your coach');return}
    setSubmitting(true)
    const res = await fetch('/api/daily-task',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({goalId:goal.id,action:'log_and_generate',yesterdayDone,yesterdayNote:yesterdayNote.trim(),yesterdayTaskId:ds.yesterdayTask?.id})})
    const data = await res.json()
    if (res.ok&&data.task) {
      setDailyState(prev=>({...prev,[goal.id]:{...prev[goal.id],state:'has_task',todayTask:data.task,checkedInToday:true}}))
      toast.success("Today's task is ready!")
    } else toast.error(data.error||'Failed — try again')
    setSubmitting(false)
  }

  // ── Story ─────────────────────────────────────────────────────
  const saveStory = async () => {
    if (!storyText.trim()) return
    setSavingStory(true)
    await fetch('/api/daily-task',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({goalId:goal.id,action:'update_story',story:storyText})})
    setDailyState(prev=>({...prev,[goal.id]:{...prev[goal.id],currentStory:storyText,canUpdateStory:false,storyUpdatedToday:true}}))
    setSavingStory(false); setShowStoryInput(false)
    if (ds.state==='has_task'&&ds.todayTask) setStoryTaskPrompt(true)
    else toast.success('Story saved — your coach factors this in tomorrow')
  }

  const regenerateAfterStory = async () => {
    setStoryTaskPrompt(false); setSubmitting(true)
    const res = await fetch('/api/daily-task',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({goalId:goal.id,action:'regenerate_after_story'})})
    const data = await res.json()
    if (res.ok&&data.task) {
      setDailyState(prev=>({...prev,[goal.id]:{...prev[goal.id],todayTask:data.task}}))
      toast.success("Task updated with your story!")
    }
    setSubmitting(false)
  }

  // ── Goal management ───────────────────────────────────────────
  const saveGoal = async () => {
    if (!editForm.timeline){toast.error('Please select a timeline');return}
    setSaving(true)
    const {error} = await supabase.from('goals').update({timeline:editForm.timeline,updated_at:new Date().toISOString()}).eq('id',goal.id)
    if (error){toast.error('Save failed');setSaving(false);return}
    const updated = {...goal,timeline:editForm.timeline}
    setGoals(prev=>prev.map(g=>g.id===goal.id?updated:g))
    setEditing(false); setSaving(false)
    toast.success('Goal updated!')
    router.refresh()
  }

  const pauseGoal = async () => {
    if (pausing) return
    setPausing(true)
    await supabase.from('goals').update({is_paused:true,paused_at:new Date().toISOString(),pause_reason:pauseReason}).eq('id',goal.id)
    setGoals(prev=>prev.filter(g=>g.id!==goal.id))
    setShowPauseModal(false); setPausing(false)
    if (goals.length>1) setSelectedGoalId(goals.find(g=>g.id!==goal.id)?.id||'')
    toast.success('Goal paused — your streak is saved')
    router.refresh()
  }

  const resumeGoal = async (gId: string) => {
    setResuming(gId)
    await supabase.from('goals').update({is_paused:false,paused_at:null,pause_reason:null}).eq('id',gId)
    const resumed = pausedGoals.find(g=>g.id===gId)
    if (resumed) { setGoals(prev=>[{...resumed,is_paused:false},...prev]); setPausedGoals(prev=>prev.filter(g=>g.id!==gId)) }
    setResuming(null); toast.success('Goal resumed! 🎯')
    router.refresh()
  }

  const deleteGoal = async () => {
    if (deleting) return
    setDeleting(true)
    await supabase.from('goals').delete().eq('id',goal.id)
    setGoals(prev=>prev.filter(g=>g.id!==goal.id))
    setShowDeleteModal(false); setDeleting(false)
    localStorage.removeItem('selectedGoalId')
    toast.success('Goal deleted')
    router.refresh()
  }

  const completeGoal = async () => {
    if (completing) return
    setCompleting(true)
    await supabase.from('goals').update({is_active:false,completed_at:new Date().toISOString(),success_note:successNote.trim()||null}).eq('id',goal.id)
    await supabase.from('rewards').upsert({user_id:userId,type:'goal_complete',title:'Goal Achieved',description:`Completed: ${goal.title}`,emoji:'🎯',earned_at:new Date().toISOString()},{onConflict:'user_id,type'})
    if (successNote.trim()) await supabase.from('success_stories').upsert({user_id:userId,goal_title:goal.title,quote:successNote.trim(),is_public:true})
    setGoals(prev=>prev.filter(g=>g.id!==goal.id))
    setShowCompleteModal(false); setCompleting(false)
    localStorage.removeItem('selectedGoalId')
    toast.success('🎯 Goal completed! Badge earned.')
    router.refresh()
  }

  if (!goal) return (
    <div className="fade-up text-center py-16">
      <p className="text-[#666] mb-4 text-[16px]">No active goals yet.</p>
      <Link href="/onboarding" className="px-5 py-3 bg-[#111] text-white rounded-xl text-[14px] font-medium">Create my first goal →</Link>
    </div>
  )

  return (
    <div className="fade-up max-w-[900px]">

      {/* ── MODALS ──────────────────────────────────────────── */}
      {showPauseModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl max-w-[420px] w-full p-7 shadow-2xl">
            <div className="text-center mb-5"><div className="text-[40px] mb-2">⏸</div>
              <h2 className="font-serif text-[22px] mb-1">Pause this goal?</h2>
              <p className="text-[13px] text-[#666]">Your streak and progress are saved. Resume anytime.</p>
            </div>
            <input value={pauseReason} onChange={e=>setPauseReason(e.target.value)} placeholder="Why? (optional — vacation, busy period...)"
              className="w-full px-3.5 py-2.5 border border-[#e8e8e8] rounded-xl text-[14px] outline-none focus:border-[#111] mb-4"/>
            <div className="flex gap-3">
              <button onClick={()=>setShowPauseModal(false)} className="flex-1 py-2.5 border border-[#e8e8e8] rounded-xl text-[13px]">Cancel</button>
              <button onClick={pauseGoal} disabled={pausing} className="flex-1 py-2.5 bg-[#b8922a] text-white rounded-xl text-[13px] font-medium disabled:opacity-50">
                {pausing?'Pausing...':'Pause goal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl max-w-[420px] w-full p-7 shadow-2xl">
            <div className="text-center mb-5"><div className="text-[40px] mb-2">🗑</div>
              <h2 className="font-serif text-[22px] mb-1">Delete this goal?</h2>
              <p className="text-[13px] text-[#666]">Permanently deletes <strong>{goal.title}</strong> and all check-ins. Cannot be undone.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={()=>setShowDeleteModal(false)} className="flex-1 py-2.5 border border-[#e8e8e8] rounded-xl text-[13px]">Cancel</button>
              <button onClick={deleteGoal} disabled={deleting} className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-[13px] font-medium disabled:opacity-50 hover:bg-red-600 transition-colors">
                {deleting?'Deleting...':'Yes, delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCompleteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl max-w-[440px] w-full p-8 shadow-2xl">
            <div className="text-center mb-5"><div className="text-[48px] mb-2">🎯</div>
              <h2 className="font-serif text-[26px] mb-1">Mark as completed?</h2>
              <p className="text-[13px] text-[#666] leading-[1.6]">Archives <strong>{goal.title}</strong> and awards you a badge.</p>
            </div>
            <label className="block text-[12px] font-medium text-[#666] mb-1.5">Share your win <span className="font-normal text-[#999]">(optional)</span></label>
            <textarea value={successNote} onChange={e=>setSuccessNote(e.target.value)} placeholder="What did you achieve? How does it feel?"
              className="w-full px-3.5 py-3 border border-[#e8e8e8] rounded-xl text-[14px] outline-none focus:border-[#111] resize-none mb-5" rows={3}/>
            <div className="flex gap-3">
              <button onClick={()=>setShowCompleteModal(false)} className="flex-1 py-3 border border-[#e8e8e8] rounded-xl text-[13px]">Cancel</button>
              <button onClick={completeGoal} disabled={!!completing} className="flex-1 py-3 bg-green-600 text-white rounded-xl text-[13px] font-medium hover:bg-green-700 disabled:opacity-50 transition-colors">
                {completing?'Completing...':'Complete & archive 🎉'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER ──────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <p className="text-[13px] text-[#999] mb-0.5">{todayDate}</p>
          <h1 className="font-serif text-[32px] leading-tight">{greeting}, {firstName}.</h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          {!editing ? (
            <>
              <Link href="/onboarding" className="px-3.5 py-2 border border-[#e8e8e8] rounded-xl text-[12px] font-medium hover:bg-[#f8f7f5] transition-colors">+ Add goal</Link>
              <button onClick={()=>setEditing(true)} className="px-3.5 py-2 border border-[#e8e8e8] rounded-xl text-[12px] font-medium hover:bg-[#f8f7f5] transition-colors">Edit</button>
              <button onClick={()=>setShowPauseModal(true)} className="px-3.5 py-2 border border-[#e8e8e8] rounded-xl text-[12px] text-[#666] hover:bg-[#f8f7f5] transition-colors">⏸ Pause</button>
              <button onClick={()=>setShowCompleteModal(true)} className="px-3.5 py-2 bg-green-600 text-white rounded-xl text-[12px] font-medium hover:bg-green-700 transition-colors">✓ Complete</button>
              <button onClick={()=>setShowDeleteModal(true)} className="px-3.5 py-2 border border-red-200 text-red-500 rounded-xl text-[12px] hover:bg-red-50 transition-colors">🗑</button>
            </>
          ) : (
            <>
              <button onClick={()=>{setEditing(false);setEditForm({title:goal.title,why:goal.why||'',timeline:goal.timeline||''})}} className="px-3.5 py-2 border border-[#e8e8e8] rounded-xl text-[12px]">Cancel</button>
              <button onClick={saveGoal} disabled={saving} className="px-3.5 py-2 bg-[#111] text-white rounded-xl text-[12px] font-medium disabled:opacity-50 hover:bg-[#333] transition-colors">{saving?'Saving...':'Save changes'}</button>
            </>
          )}
        </div>
      </div>

      {/* ── GOAL SELECTOR ───────────────────────────────────── */}
      {goals.length>1 && (
        <div className="flex gap-2 mb-5 flex-wrap">
          {goals.map(g=>(
            <button key={g.id} onClick={()=>setSelectedGoalId(g.id)}
              className={`px-4 py-2 rounded-full text-[12px] font-medium border transition-all ${selectedGoalId===g.id?'bg-[#111] text-white border-[#111]':'border-[#e8e8e8] text-[#666] hover:border-[#ccc]'}`}>
              {g.title.slice(0,28)}{g.title.length>28?'…':''}
            </button>
          ))}
        </div>
      )}

      {/* ── EDIT FORM ───────────────────────────────────────── */}
      {editing && (
        <div className="bg-[#faf3e0] border border-[#b8922a]/20 rounded-2xl p-5 mb-5">
          <p className="text-[12px] text-[#b8922a] mb-4">Only your timeline can be adjusted. To change your goal or why, create a new goal.</p>
          <div>
            <label className="text-[11px] font-medium text-[#666] uppercase tracking-wide mb-1.5 block">Timeline</label>
            <select value={editForm.timeline} onChange={e=>setEditForm(p=>({...p,timeline:e.target.value}))}
              className="border border-[#e8e8e8] rounded-xl px-3.5 py-2 text-[13px] outline-none focus:border-[#b8922a]">
              {TIMELINES.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* ── DAILY TASK STATE MACHINE ─────────────────────────── */}
      {ds.state==='day1_no_task' && (
        <div className="bg-gradient-to-br from-[#111] to-[#1a2332] rounded-2xl p-6 mb-5 text-white">
          <p className="text-[11px] font-bold tracking-[.14em] uppercase text-[#b8922a] mb-2">Day 1 — Let's begin</p>
          <p className="font-serif text-[20px] mb-1 leading-snug">{goal.title}</p>
          <p className="text-white/50 text-[13px] mb-5">Your coach is ready to give you your first task.</p>
          <button onClick={()=>generateTask('generate_day1')} disabled={submitting}
            className="px-5 py-2.5 bg-[#b8922a] text-white rounded-xl text-[13px] font-medium hover:bg-[#9a7820] disabled:opacity-50 flex items-center gap-2 transition-colors">
            {submitting?<><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full spin-anim"/>Getting your first task...</>:'⚡ Get my first task'}
          </button>
        </div>
      )}

      {ds.state==='needs_yesterday_log' && ds.yesterdayTask && (
        <div className="bg-[#111] rounded-2xl p-5 mb-5 border border-[#b8922a]/30">
          <p className="text-[11px] font-bold tracking-[.14em] uppercase text-[#b8922a] mb-3">Log yesterday before getting today's task</p>
          <div className="bg-white/5 rounded-xl p-3.5 mb-4">
            <p className="text-[10px] text-white/40 uppercase tracking-wide mb-1">Yesterday's task</p>
            <p className="text-[14px] text-white/90 leading-[1.6]">{ds.yesterdayTask.task}</p>
          </div>
          <div className="flex gap-2 mb-4">
            <button onClick={()=>setYesterdayDone(true)} className={`flex-1 py-2.5 rounded-xl text-[13px] font-medium transition-all ${yesterdayDone===true?'bg-green-500 text-white':'bg-white/10 text-white/60 hover:bg-white/20'}`}>✓ Yes, did it</button>
            <button onClick={()=>setYesterdayDone(false)} className={`flex-1 py-2.5 rounded-xl text-[13px] font-medium transition-all ${yesterdayDone===false?'bg-red-500/70 text-white':'bg-white/10 text-white/60 hover:bg-white/20'}`}>✗ Didn't do it</button>
          </div>
          {yesterdayDone!==null && (
            <>
              <textarea value={yesterdayNote} onChange={e=>setYesterdayNote(e.target.value)} autoFocus rows={2}
                placeholder={yesterdayDone?'What went well? Any wins to share?':'What got in the way? (helps your coach adapt)'}
                className="w-full bg-white/10 text-white placeholder-white/30 text-[13px] px-4 py-3 rounded-xl border border-white/10 outline-none resize-none mb-3 focus:border-[#b8922a]/50"/>
              <button onClick={logAndGenerate} disabled={submitting||!yesterdayNote.trim()}
                className="w-full py-2.5 bg-[#b8922a] text-white rounded-xl text-[13px] font-medium disabled:opacity-40 flex items-center justify-center gap-2 hover:bg-[#9a7820] transition-colors">
                {submitting?<><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full spin-anim"/>Generating today's task...</>:"Get today's task →"}
              </button>
            </>
          )}
        </div>
      )}

      {ds.state==='has_task' && ds.todayTask && (
        <div className={`rounded-2xl p-5 mb-5 border ${ds.todayTask.completed?'bg-[#f0faf0] border-green-200':'bg-[#faf3e0] border-[#b8922a]/30'}`}>
          <div className="flex items-start justify-between gap-3 mb-2">
            <p className={`text-[10px] font-bold tracking-[.14em] uppercase ${ds.todayTask.completed?'text-green-600':'text-[#b8922a]'}`}>
              {ds.todayTask.completed?"✓ Today's task — complete":"⚡ Today's task"}
            </p>
            {!ds.todayTask.completed && (
              <button onClick={async()=>{
                await supabase.from('daily_tasks').update({completed:true}).eq('id',ds.todayTask.id)
                setDailyState(prev=>({...prev,[goal.id]:{...prev[goal.id],todayTask:{...prev[goal.id].todayTask,completed:true}}}))
                toast.success('Task marked done! Great work.')
              }} className="flex-shrink-0 px-3 py-1.5 bg-[#111] text-white text-[12px] rounded-lg hover:bg-[#333] transition-colors font-medium">
                Mark done ✓
              </button>
            )}
          </div>
          <p className={`text-[14px] leading-[1.7] font-medium ${ds.todayTask.completed?'text-[#666] line-through':'text-[#111]'}`}>{ds.todayTask.task}</p>
        </div>
      )}

      {ds.state==='no_task_yet' && (
        <div className="bg-[#faf3e0] border border-[#b8922a]/30 rounded-2xl p-5 mb-5">
          <p className="text-[10px] font-bold tracking-[.14em] uppercase text-[#b8922a] mb-2">⚡ Ready for today</p>
          <p className="text-[13px] text-[#666] mb-4">Generate your task for today based on your progress so far.</p>
          <button onClick={()=>generateTask('generate_day1')} disabled={submitting}
            className="px-5 py-2.5 bg-[#111] text-white rounded-xl text-[13px] font-medium hover:bg-[#2a2a2a] disabled:opacity-50 flex items-center gap-2 transition-colors">
            {submitting?<><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full spin-anim"/>Generating...</>:"Get today's task →"}
          </button>
        </div>
      )}

      {storyTaskPrompt && (
        <div className="bg-white border border-[#b8922a]/30 rounded-2xl p-4 mb-4 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[13px] text-[#111]">Your story changed — update today's task to reflect it?</p>
          <div className="flex gap-2">
            <button onClick={()=>setStoryTaskPrompt(false)} className="px-3 py-1.5 border border-[#e8e8e8] rounded-lg text-[12px] text-[#666]">Keep current</button>
            <button onClick={regenerateAfterStory} disabled={submitting} className="px-3 py-1.5 bg-[#b8922a] text-white rounded-lg text-[12px] font-medium disabled:opacity-50">
              {submitting?'Updating...':'Yes, update it'}
            </button>
          </div>
        </div>
      )}

      {ds.state==='has_task' && ds.isDay1 && !ds.checkedInToday && (
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 mb-5">
          <p className="font-serif text-[18px] mb-1">How are you feeling starting this?</p>
          <p className="text-[13px] text-[#999] mb-4">Day 1 check-in — just your mood today</p>
          <div className="flex gap-2 mb-3">
            {MOODS.map((e,i)=>(
              <button key={i} onClick={()=>setMood(i+1)} title={MOOD_LABELS[i]}
                className={`flex-1 py-2.5 rounded-xl text-[18px] transition-all ${mood===i+1?'bg-[#b8922a] scale-105':'bg-[#f2f0ec] hover:bg-[#e8e5de]'}`}>{e}</button>
            ))}
          </div>
          <input value={moodNote} onChange={e=>setMoodNote(e.target.value)} placeholder="One word on how you're feeling... (optional)"
            className="w-full px-4 py-2.5 bg-[#f8f7f5] border border-[#e8e8e8] rounded-xl text-[13px] outline-none focus:border-[#b8922a] mb-3 transition-colors"/>
          <button onClick={submitMoodCheckin} disabled={submittingMood} className="w-full py-2.5 bg-[#111] text-white rounded-xl text-[13px] font-medium disabled:opacity-50 hover:bg-[#333] transition-colors">
            {submittingMood?'Logging...':'Log check-in ✓'}
          </button>
        </div>
      )}

      {/* ── STATS ROW ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          {val:String(goal.streak||0),label:'Day streak 🔥'},
          {val:`${goal.progress||0}%`,label:'Goal progress',prog:true},
          {val:String(daysRemaining),label:'Days remaining'},
          {val:phaseLabel(goal),label:'Current phase',small:true},
        ].map(({val,label,prog,small})=>(
          <div key={label} className="bg-white border border-[#e8e8e8] rounded-2xl p-4">
            <p className={`font-serif ${small?'text-[12px] font-medium':'text-[28px]'} text-[#111] leading-tight mb-1`}>{val}</p>
            {prog&&<div className="h-1 bg-[#f0ede8] rounded-full overflow-hidden mb-1"><div className="h-full bg-[#b8922a] rounded-full" style={{width:`${goal.progress||0}%`}}/></div>}
            <p className="text-[10px] font-medium uppercase tracking-[.1em] text-[#999]">{label}</p>
          </div>
        ))}
      </div>

      {/* ── GOAL DETAIL: title + why ──────────────────────────── */}
      {!editing && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5">
            <p className="text-[10px] font-medium tracking-[.12em] uppercase text-[#b8922a] mb-2">The goal</p>
            <p className="font-serif text-[18px] leading-[1.4] mb-3">{goal.title}</p>
            <div className="flex gap-2 flex-wrap">
              <span className="text-[11px] font-medium text-[#b8922a] bg-[#faf3e0] px-2.5 py-1 rounded-full">{goal.timeline}</span>
              <span className="text-[11px] font-medium text-[#666] bg-[#f2f0ec] px-2.5 py-1 rounded-full">{goal.category}</span>
            </div>
          </div>
          <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5">
            <p className="text-[10px] font-medium tracking-[.12em] uppercase text-[#b8922a] mb-2">Why</p>
            <p className="text-[14px] text-[#666] leading-[1.7]">{goal.why}</p>
          </div>
        </div>
      )}

      {/* ── CURRENT STORY ────────────────────────────────────── */}
      <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 mb-5">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="font-medium text-[14px]">Current story</p>
            <p className="text-[11px] text-[#999]">What's happening in your life right now — your coach factors this in</p>
          </div>
          {ds.canUpdateStory && !showStoryInput && (
            <button onClick={()=>setShowStoryInput(true)} className="text-[11px] text-[#b8922a] hover:underline flex-shrink-0 ml-3">
              {ds.currentStory?'Update':'Add'} (once/day)
            </button>
          )}
          {!ds.canUpdateStory && <span className="text-[11px] text-[#999] flex-shrink-0 ml-3">Updated today</span>}
        </div>
        {showStoryInput ? (
          <div className="mt-3">
            <textarea value={storyText} onChange={e=>setStoryText(e.target.value)} autoFocus rows={3}
              placeholder="e.g. Travelling this week, had a late night, feeling low energy, busy with work..."
              className="w-full px-4 py-3 border border-[#e8e8e8] rounded-xl text-[13px] outline-none focus:border-[#b8922a] resize-none mb-3 transition-colors"/>
            <div className="flex gap-2">
              <button onClick={()=>setShowStoryInput(false)} className="px-4 py-2 border border-[#e8e8e8] rounded-xl text-[12px] text-[#666]">Cancel</button>
              <button onClick={saveStory} disabled={savingStory||!storyText.trim()} className="px-4 py-2 bg-[#111] text-white rounded-xl text-[12px] font-medium disabled:opacity-40 hover:bg-[#333] transition-colors">
                {savingStory?'Saving...':'Save story'}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-[13px] text-[#666] leading-[1.6] mt-2">
            {ds.currentStory||<span className="text-[#bbb] italic">No story yet. Tap Update to tell your coach what's going on.</span>}
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

      {/* ── ROADMAP ──────────────────────────────────────────── */}
      <RoadmapSection goal={goal} onGoalUpdate={updated=>{
        setGoals(prev=>prev.map(g=>g.id===updated.id?{...g,...updated}:g))
      }}/>

      {/* ── AFFIRMATION ──────────────────────────────────────── */}
      {goal.affirmation && (
        <div className="bg-[#111] rounded-2xl p-6 mb-5">
          <p className="text-[10px] font-medium tracking-[.12em] uppercase text-white/30 mb-2">Your affirmation</p>
          <p className="font-serif italic text-[18px] text-white/85 leading-[1.6]">"{goal.affirmation}"</p>
        </div>
      )}

      {/* ── PAUSED GOALS ─────────────────────────────────────── */}
      {pausedGoals.length>0 && (
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5">
          <p className="font-medium text-[14px] mb-3">⏸ Paused goals <span className="text-[#999] font-normal">({pausedGoals.length})</span></p>
          <div className="space-y-2">
            {pausedGoals.map(pg=>(
              <div key={pg.id} className="flex items-center gap-3 p-3 bg-[#f8f7f5] rounded-xl">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium truncate">{pg.title}</p>
                  <p className="text-[11px] text-[#999] mt-0.5">
                    Paused {pg.paused_at?new Date(pg.paused_at).toLocaleDateString('en-US',{month:'short',day:'numeric'}):''}{pg.pause_reason?` · ${pg.pause_reason}`:''}
                    {' · '}<span className="text-[#b8922a]">{pg.streak} day streak saved</span>
                  </p>
                </div>
                <button onClick={()=>resumeGoal(pg.id)} disabled={resuming===pg.id}
                  className="flex-shrink-0 px-3 py-1.5 bg-[#111] text-white rounded-lg text-[12px] font-medium hover:bg-[#2a2a2a] transition-colors disabled:opacity-50">
                  {resuming===pg.id?'...':'▶ Resume'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}