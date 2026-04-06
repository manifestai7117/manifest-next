'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

const TIMELINE_DAYS: Record<string, number> = {
  '2 weeks': 14, '1 month': 30, '2 months': 60,
  '3 months': 90, '6 months': 180, '1 year': 365, '2+ years': 730
}

const ALL_TIMELINES = ['2 weeks','1 month','2 months','3 months','6 months','1 year','2+ years']

export default function GoalPage() {
  const supabase = createClient()
  const router = useRouter()
  const [goal, setGoal] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showExtend, setShowExtend] = useState(false)
  const [showComplete, setShowComplete] = useState(false)
  const [newTimeline, setNewTimeline] = useState('')
  const [completionNote, setCompletionNote] = useState('')
  const [regenerating, setRegenerating] = useState(false)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      if (!user) return
      const { data: goals } = await supabase.from('goals').select('*').eq('user_id', user.id).eq('is_active', true).order('created_at', { ascending: false }).limit(1)
      setGoal(goals?.[0] || null)
      setLoading(false)
    }
    load()
  }, [])

  const canRegenerateBoard = () => {
    if (!goal?.vision_board_last_generated) return true
    const last = new Date(goal.vision_board_last_generated)
    const now = new Date()
    const hoursDiff = (now.getTime() - last.getTime()) / (1000 * 60 * 60)
    return hoursDiff >= 24
  }

  const regenerateBoard = async () => {
    if (!canRegenerateBoard()) {
      toast.error('You can regenerate your vision board once every 24 hours')
      return
    }
    setRegenerating(true)
    try {
      const res = await fetch('/api/goals/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: goal.title, category: goal.category, timeline: goal.timeline,
          why: goal.why, obstacles: goal.obstacles, aesthetic: goal.aesthetic,
          userName: user?.user_metadata?.full_name || 'friend'
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      await supabase.from('goals').update({
        art_title: data.artTitle,
        art_description: data.artDescription,
        affirmation: data.affirmation,
        vision_board_last_generated: new Date().toISOString(),
        vision_board_regenerations: (goal.vision_board_regenerations || 0) + 1,
      }).eq('id', goal.id)

      setGoal((prev: any) => ({ ...prev, art_title: data.artTitle, art_description: data.artDescription, affirmation: data.affirmation }))
      toast.success('Vision board regenerated!')
    } catch (e: any) {
      toast.error('Regeneration failed: ' + e.message)
    }
    setRegenerating(false)
  }

  const updateTimeline = async () => {
    if (!newTimeline) { toast.error('Select a new timeline'); return }
    const days = TIMELINE_DAYS[newTimeline] || 90
    const m1 = Math.round(days * 0.33)
    const m2 = Math.round(days * 0.66)

    // Regenerate milestones for new timeline
    try {
      const res = await fetch('/api/goals/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: goal.title, category: goal.category, timeline: newTimeline,
          why: goal.why, obstacles: goal.obstacles, aesthetic: goal.aesthetic,
          userName: user?.user_metadata?.full_name || 'friend'
        })
      })
      const data = await res.json()

      await supabase.from('goals').update({
        timeline: newTimeline,
        original_timeline: goal.original_timeline || goal.timeline,
        milestone_30: data.milestones?.[0]?.goal || `Day ${m1}: Foundation built`,
        milestone_60: data.milestones?.[1]?.goal || `Day ${m2}: Halfway progress`,
        milestone_90: data.milestones?.[2]?.goal || `Day ${days}: Goal achieved`,
      }).eq('id', goal.id)

      setGoal((prev: any) => ({ ...prev, timeline: newTimeline }))
      setShowExtend(false)
      toast.success(`Timeline updated to ${newTimeline}! New milestones generated.`)
    } catch {
      // Fallback without AI
      await supabase.from('goals').update({ timeline: newTimeline, original_timeline: goal.original_timeline || goal.timeline }).eq('id', goal.id)
      setGoal((prev: any) => ({ ...prev, timeline: newTimeline }))
      setShowExtend(false)
      toast.success(`Timeline updated to ${newTimeline}`)
    }
  }

  const markComplete = async () => {
    if (!completionNote.trim()) { toast.error('Share how it feels to complete this goal!'); return }

    await supabase.from('goals').update({
      is_active: false,
      completed_at: new Date().toISOString(),
      completion_note: completionNote,
      progress: 100,
    }).eq('id', goal.id)

    // Save as public success story
    await supabase.from('success_stories').insert({
      user_id: user.id,
      goal_title: goal.title,
      quote: completionNote,
      is_public: true,
    })

    toast.success('🎉 Goal completed! Your story has been added to the community.')
    setShowComplete(false)
    router.push('/dashboard?completed=true')
  }

  if (loading) return <div className="text-[#999] text-[14px]">Loading...</div>

  if (!goal) return (
    <div className="fade-up">
      <h1 className="font-serif text-[32px] mb-4">My Goal</h1>
      <div className="bg-white border border-[#e8e8e8] rounded-2xl p-8 text-center">
        <p className="text-[#666] mb-4">No active goal yet.</p>
        <a href="/onboarding" className="inline-block px-5 py-2.5 bg-[#111] text-white rounded-xl text-[13px] font-medium">Create my first goal →</a>
      </div>
    </div>
  )

  const nextRegen = goal.vision_board_last_generated
    ? new Date(new Date(goal.vision_board_last_generated).getTime() + 24*60*60*1000)
    : null
  const hoursUntilRegen = nextRegen ? Math.max(0, Math.ceil((nextRegen.getTime() - Date.now()) / (1000*60*60))) : 0

  return (
    <div className="fade-up max-w-[800px]">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-[32px] mb-1">My Goal</h1>
          <p className="text-[14px] text-[#666]">Your goal profile, roadmap, and settings</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowExtend(true)} className="px-4 py-2 border border-[#e8e8e8] rounded-xl text-[13px] font-medium hover:bg-[#f8f7f5] transition-colors">
            Adjust timeline
          </button>
          <button onClick={() => setShowComplete(true)} className="px-4 py-2 bg-[#b8922a] text-white rounded-xl text-[13px] font-medium hover:bg-[#9a7820] transition-colors">
            Mark complete ✓
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-6">
          <p className="text-[10px] font-medium tracking-[.12em] uppercase text-[#b8922a] mb-3">The goal</p>
          <p className="font-serif text-[20px] leading-[1.4] mb-4">{goal.title}</p>
          <div className="flex gap-2 flex-wrap">
            <span className="text-[11px] font-medium text-[#b8922a] bg-[#faf3e0] px-2.5 py-1 rounded-full">{goal.timeline}</span>
            <span className="text-[11px] font-medium text-[#666] bg-[#f2f0ec] px-2.5 py-1 rounded-full">{goal.category}</span>
            {goal.original_timeline && <span className="text-[11px] text-[#999] bg-[#f8f7f5] px-2.5 py-1 rounded-full">was: {goal.original_timeline}</span>}
          </div>
        </div>
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-6">
          <p className="text-[10px] font-medium tracking-[.12em] uppercase text-[#b8922a] mb-3">The why</p>
          <p className="text-[14px] text-[#666] leading-[1.72]">{goal.why}</p>
        </div>
      </div>

      {/* Roadmap */}
      <div className="bg-white border border-[#e8e8e8] rounded-2xl p-6 mb-4">
        <div className="flex justify-between items-center mb-4">
          <p className="font-medium text-[15px]">Roadmap for {goal.timeline}</p>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-24 bg-[#f0ede8] rounded-full overflow-hidden">
              <div className="h-full bg-[#b8922a] rounded-full" style={{ width: `${goal.progress}%` }}/>
            </div>
            <span className="text-[12px] text-[#999]">{goal.progress}%</span>
          </div>
        </div>
        {[
          ['Phase 1', goal.milestone_30],
          ['Phase 2', goal.milestone_60],
          ['Phase 3', goal.milestone_90],
        ].map(([label, milestone], i) => (
          <div key={String(label)} className={`flex gap-4 py-3.5 ${i < 2 ? 'border-b border-[#e8e8e8]' : ''} items-start`}>
            <span className="text-[11px] font-medium text-[#b8922a] w-16 flex-shrink-0 pt-0.5">{String(label)}</span>
            <span className="text-[14px] flex-1 leading-[1.6]">{String(milestone)}</span>
            <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${i === 0 && goal.progress > 0 ? 'bg-green-50 text-green-700' : 'bg-[#f2f0ec] text-[#999]'}`}>
              {i === 0 && goal.progress > 0 ? 'In progress' : 'Upcoming'}
            </span>
          </div>
        ))}
      </div>

      {/* Affirmation */}
      <div className="bg-[#111] rounded-2xl p-6 mb-4">
        <p className="text-[10px] font-medium tracking-[.12em] uppercase text-white/30 mb-3">Your affirmation</p>
        <p className="font-serif italic text-[18px] text-white/85 leading-[1.6]">"{goal.affirmation}"</p>
      </div>

      {/* Vision board regen */}
      <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 flex items-center justify-between">
        <div>
          <p className="font-medium text-[14px] mb-1">Vision board</p>
          <p className="text-[12px] text-[#999]">
            {canRegenerateBoard()
              ? 'You can regenerate your vision board today'
              : `Available in ${hoursUntilRegen} hour${hoursUntilRegen !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={regenerateBoard}
          disabled={!canRegenerateBoard() || regenerating}
          className="px-4 py-2 bg-[#111] text-white rounded-xl text-[13px] font-medium disabled:opacity-40 hover:bg-[#2a2a2a] transition-colors">
          {regenerating ? 'Generating...' : '↺ Regenerate'}
        </button>
      </div>

      {/* EXTEND/REDUCE MODAL */}
      {showExtend && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6" onClick={e => e.target === e.currentTarget && setShowExtend(false)}>
          <div className="bg-white rounded-2xl p-8 max-w-md w-full">
            <h3 className="font-serif text-[24px] mb-2">Adjust timeline</h3>
            <p className="text-[14px] text-[#666] mb-6">Your milestones will be recalculated for the new timeframe.</p>
            <div className="flex flex-wrap gap-2 mb-6">
              {ALL_TIMELINES.map(t => (
                <button key={t} onClick={() => setNewTimeline(t)}
                  className={`px-3.5 py-2 rounded-full text-[13px] border transition-all ${newTimeline === t ? 'bg-[#111] text-white border-[#111]' : t === goal.timeline ? 'border-[#b8922a] text-[#b8922a]' : 'border-[#e8e8e8] hover:border-[#d0d0d0]'}`}>
                  {t} {t === goal.timeline && '(current)'}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowExtend(false)} className="flex-1 py-2.5 border border-[#e8e8e8] rounded-xl text-[13px] hover:bg-[#f8f7f5] transition-colors">Cancel</button>
              <button onClick={updateTimeline} className="flex-1 py-2.5 bg-[#111] text-white rounded-xl text-[13px] font-medium hover:bg-[#2a2a2a] transition-colors">Update timeline</button>
            </div>
          </div>
        </div>
      )}

      {/* COMPLETE MODAL */}
      {showComplete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6" onClick={e => e.target === e.currentTarget && setShowComplete(false)}>
          <div className="bg-white rounded-2xl p-8 max-w-md w-full">
            <div className="text-center mb-6">
              <div className="text-5xl mb-3">🎉</div>
              <h3 className="font-serif text-[28px] mb-2">You did it!</h3>
              <p className="text-[14px] text-[#666]">Completing a goal is rare. Tell the community how it feels.</p>
            </div>
            <div className="mb-5">
              <label className="block text-[12px] font-medium text-[#666] mb-2">Your completion story (will be shared publicly)</label>
              <textarea
                className="w-full px-3.5 py-3 border border-[#e8e8e8] rounded-xl text-[14px] outline-none focus:border-[#111] transition-colors resize-none"
                rows={4}
                value={completionNote}
                onChange={e => setCompletionNote(e.target.value)}
                placeholder={`e.g. "I finally ${goal.title}. The hardest part was... but what got me through was..."`}
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowComplete(false)} className="flex-1 py-2.5 border border-[#e8e8e8] rounded-xl text-[13px] hover:bg-[#f8f7f5] transition-colors">Not yet</button>
              <button onClick={markComplete} className="flex-1 py-2.5 bg-[#b8922a] text-white rounded-xl text-[13px] font-medium hover:bg-[#9a7820] transition-colors">Complete goal 🎉</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
