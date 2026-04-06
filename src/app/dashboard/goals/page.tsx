'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import toast from 'react-hot-toast'

const REWARDS_MAP: Record<string,{emoji:string,title:string,desc:string}> = {
  first_checkin: { emoji:'🌱', title:'First Step', desc:'Completed your first check-in' },
  streak_7:      { emoji:'🔥', title:'7-Day Fire', desc:'7 days straight — habits are forming' },
  streak_14:     { emoji:'⚡', title:'Two Weeks Strong', desc:'14 consecutive days' },
  streak_30:     { emoji:'🏆', title:'Month Warrior', desc:'30 days without breaking' },
  phase_complete:{ emoji:'⭐', title:'Phase Complete', desc:'Completed a milestone phase' },
  goal_complete: { emoji:'🎯', title:'Goal Achieved', desc:'You actually did it' },
}

export default function GoalsPage() {
  const supabase = createClient()
  const [goals, setGoals] = useState<any[]>([])
  const [completedGoals, setCompletedGoals] = useState<any[]>([])
  const [rewards, setRewards] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [completingPhase, setCompletingPhase] = useState<string|null>(null)

  const isPro = profile?.plan === 'pro' || profile?.plan === 'pro_trial'
  const maxGoals = isPro ? 5 : 2

  useEffect(()=>{
    const load = async () => {
      const {data:{user}} = await supabase.auth.getUser()
      if (!user) return
      const [profRes, activeRes, doneRes, rewardsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id',user.id).single(),
        supabase.from('goals').select('*').eq('user_id',user.id).eq('is_active',true).order('created_at',{ascending:false}),
        supabase.from('goals').select('*').eq('user_id',user.id).eq('is_active',false).order('completed_at',{ascending:false}).limit(5),
        supabase.from('rewards').select('*').eq('user_id',user.id).order('earned_at',{ascending:false}).limit(20),
      ])
      setProfile(profRes.data)
      setGoals(activeRes.data||[])
      setCompletedGoals(doneRes.data||[])
      setRewards(rewardsRes.data||[])
      setLoading(false)
    }
    load()
  },[])

  const completePhase = async (goal:any, phase:1|2|3) => {
    const field = `phase${phase}_completed`
    const fieldAt = `phase${phase}_completed_at`
    setCompletingPhase(goal.id+'-'+phase)
    await supabase.from('goals').update({[field]:true,[fieldAt]:new Date().toISOString()}).eq('id',goal.id)

    // Award reward
    const {data:{user}} = await supabase.auth.getUser()
    if (user) {
      await supabase.from('rewards').insert({
        user_id:user.id, goal_id:goal.id,
        type:'phase_complete',
        title:`Phase ${phase} Complete`,
        description:`Completed phase ${phase} of "${goal.title}"`
      })
    }

    setGoals(prev=>prev.map(g=>g.id===goal.id?{...g,[field]:true}:g))
    setRewards(prev=>[{type:'phase_complete',title:`Phase ${phase} Complete`,earned_at:new Date().toISOString()},...prev])
    toast.success(`🎉 Phase ${phase} complete! You earned a reward.`)
    setCompletingPhase(null)
  }

  const archiveGoal = async (goalId:string, note:string) => {
    const {data:{user}} = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('goals').update({is_active:false,completed_at:new Date().toISOString(),completion_note:note,progress:100}).eq('id',goalId)
    await supabase.from('success_stories').insert({user_id:user.id,goal_title:goals.find(g=>g.id===goalId)?.title,quote:note,is_public:true})
    await supabase.from('rewards').insert({user_id:user.id,goal_id:goalId,type:'goal_complete',title:'Goal Achieved!',description:`Completed: ${goals.find(g=>g.id===goalId)?.title}`})
    setGoals(prev=>prev.filter(g=>g.id!==goalId))
    toast.success('🎯 Goal completed! Your story is now live on the community page.')
  }

  if (loading) return <div className="text-[#999] text-[14px] p-8">Loading...</div>

  return (
    <div className="fade-up max-w-[900px]">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-[32px] mb-1">My Goals</h1>
          <p className="text-[14px] text-[#666]">{goals.length} of {maxGoals} active goals used</p>
        </div>
        <div className="flex gap-2 items-center">
          {!isPro && (
            <Link href="/dashboard/upgrade" className="px-3 py-2 border border-[#b8922a]/30 bg-[#faf3e0] text-[#b8922a] rounded-xl text-[12px] font-medium hover:bg-[#f5e8c0] transition-colors">
              ↑ Pro: 5 goals + 15 chats/day
            </Link>
          )}
          {goals.length < maxGoals ? (
            <Link href="/onboarding" className="px-4 py-2 bg-[#111] text-white rounded-xl text-[13px] font-medium hover:bg-[#2a2a2a] transition-colors">
              + Add goal
            </Link>
          ) : (
            <div className="px-4 py-2 bg-[#f2f0ec] text-[#999] rounded-xl text-[13px] cursor-not-allowed">
              + Add goal (limit reached)
            </div>
          )}
        </div>
      </div>

      {/* Active Goals */}
      {goals.length===0 ? (
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-10 text-center mb-6">
          <p className="font-serif text-[20px] mb-2">No active goals</p>
          <p className="text-[14px] text-[#666] mb-5">Start your transformation journey</p>
          <Link href="/onboarding" className="inline-block px-6 py-3 bg-[#111] text-white rounded-xl text-[13px] font-medium">Create my first goal →</Link>
        </div>
      ) : (
        <div className="flex flex-col gap-5 mb-8">
          {goals.map(goal=>(
            <GoalCard key={goal.id} goal={goal} onCompletePhase={completePhase} onComplete={archiveGoal} completing={completingPhase}/>
          ))}
        </div>
      )}

      {/* Rewards */}
      {rewards.length > 0 && (
        <div className="mb-8">
          <h2 className="font-serif text-[22px] mb-4">Your rewards</h2>
          <div className="flex gap-3 flex-wrap">
            {rewards.map((r,i)=>{
              const info = REWARDS_MAP[r.type]||{emoji:'🏅',title:r.title,desc:r.description}
              return (
                <div key={i} className="bg-white border border-[#e8e8e8] rounded-xl p-4 flex items-center gap-3 min-w-[160px]">
                  <span className="text-[28px]">{info.emoji}</span>
                  <div><p className="text-[13px] font-medium">{info.title}</p><p className="text-[11px] text-[#999]">{info.desc}</p></div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Completed Goals */}
      {completedGoals.length>0 && (
        <div>
          <h2 className="font-serif text-[22px] mb-4">Completed goals</h2>
          <div className="flex flex-col gap-3">
            {completedGoals.map(g=>(
              <div key={g.id} className="bg-white border border-[#e8e8e8] rounded-2xl p-5 opacity-75">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-[20px]">🎯</span>
                  <div>
                    <p className="font-medium text-[14px]">{g.title}</p>
                    <p className="text-[11px] text-[#999]">Completed {g.completed_at?new Date(g.completed_at).toLocaleDateString():''}</p>
                  </div>
                </div>
                {g.completion_note && <p className="text-[13px] text-[#666] font-serif italic">"{g.completion_note}"</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function GoalCard({goal, onCompletePhase, onComplete, completing}: any) {
  const [showComplete, setShowComplete] = useState(false)
  const [note, setNote] = useState('')
  const phases = [
    {num:1, label:'Phase 1', milestone:goal.milestone_30, done:goal.phase1_completed, doneAt:goal.phase1_completed_at},
    {num:2, label:'Phase 2', milestone:goal.milestone_60, done:goal.phase2_completed, doneAt:goal.phase2_completed_at},
    {num:3, label:'Phase 3', milestone:goal.milestone_90, done:goal.phase3_completed, doneAt:goal.phase3_completed_at},
  ]
  const phasesComplete = phases.filter(p=>p.done).length

  return (
    <div className="bg-white border border-[#e8e8e8] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-[#e8e8e8]">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1">
            <p className="font-serif text-[20px] leading-[1.3] mb-2">{goal.title}</p>
            <div className="flex gap-2 flex-wrap">
              <span className="text-[11px] font-medium text-[#b8922a] bg-[#faf3e0] px-2.5 py-1 rounded-full">{goal.timeline}</span>
              <span className="text-[11px] font-medium text-[#666] bg-[#f2f0ec] px-2.5 py-1 rounded-full">{goal.category}</span>
              <span className="text-[11px] text-[#666] bg-[#f2f0ec] px-2.5 py-1 rounded-full">🔥 {goal.streak} days</span>
              <span className="text-[11px] text-[#666] bg-[#f2f0ec] px-2.5 py-1 rounded-full">{goal.progress}% done</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href={`/dashboard/coach`} className="px-3 py-1.5 border border-[#e8e8e8] rounded-lg text-[12px] hover:bg-[#f8f7f5] transition-colors">Coach</Link>
            <button onClick={()=>setShowComplete(true)} className="px-3 py-1.5 bg-[#b8922a] text-white rounded-lg text-[12px] font-medium hover:bg-[#9a7820] transition-colors">Complete ✓</button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-1.5 bg-[#f0ede8] rounded-full overflow-hidden">
          <div className="h-full bg-[#b8922a] rounded-full transition-all duration-700" style={{width:`${goal.progress}%`}}/>
        </div>
        <div className="flex justify-between text-[11px] text-[#999] mt-1">
          <span>0%</span><span className="text-[#b8922a] font-medium">{goal.progress}%</span><span>100%</span>
        </div>
      </div>

      {/* Phases */}
      <div className="divide-y divide-[#e8e8e8]">
        {phases.map(phase=>(
          <div key={phase.num} className={`flex gap-4 p-4 items-start ${phase.done?'bg-green-50/30':''}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[11px] font-bold transition-all ${phase.done?'bg-green-500 text-white':'bg-[#f2f0ec] text-[#999]'}`}>
              {phase.done?'✓':phase.num}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-[#b8922a] mb-0.5">{phase.label}</p>
              <p className="text-[13px] text-[#666] leading-[1.5]">{phase.milestone}</p>
              {phase.done && phase.doneAt && <p className="text-[11px] text-green-600 mt-1">✓ Completed {new Date(phase.doneAt).toLocaleDateString()}</p>}
            </div>
            {!phase.done && (
              <button
                onClick={()=>onCompletePhase(goal,phase.num)}
                disabled={completing===goal.id+'-'+phase.num}
                className="px-3 py-1.5 border border-[#e8e8e8] rounded-lg text-[11px] font-medium text-[#666] hover:border-green-300 hover:text-green-700 hover:bg-green-50 transition-all disabled:opacity-50 flex-shrink-0">
                {completing===goal.id+'-'+phase.num?'Saving...':'Mark done ✓'}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Complete Goal Modal */}
      {showComplete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6" onClick={e=>e.target===e.currentTarget&&setShowComplete(false)}>
          <div className="bg-white rounded-2xl p-8 max-w-md w-full">
            <div className="text-center mb-6">
              <div className="text-5xl mb-3">🎉</div>
              <h3 className="font-serif text-[26px] mb-2">You completed it!</h3>
              <p className="text-[14px] text-[#666]">Tell the community how achieving this goal changed your life.</p>
            </div>
            <div className="mb-5">
              <label className="block text-[12px] font-medium text-[#666] mb-2">How did completing this goal change your life? <span className="text-[#b8922a]">(shown publicly)</span></label>
              <textarea className="w-full px-3.5 py-3 border border-[#e8e8e8] rounded-xl text-[14px] outline-none focus:border-[#111] transition-colors resize-none" rows={4} value={note} onChange={e=>setNote(e.target.value)} placeholder={`"Achieving ${goal.title} changed everything because..."`}/>
            </div>
            <div className="flex gap-3">
              <button onClick={()=>setShowComplete(false)} className="flex-1 py-2.5 border border-[#e8e8e8] rounded-xl text-[13px] hover:bg-[#f8f7f5] transition-colors">Not yet</button>
              <button onClick={()=>{if(!note.trim()){toast.error('Share how it changed your life!');return}onComplete(goal.id,note);setShowComplete(false)}} className="flex-1 py-2.5 bg-[#b8922a] text-white rounded-xl text-[13px] font-medium hover:bg-[#9a7820] transition-colors">
                Complete goal 🎉
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
