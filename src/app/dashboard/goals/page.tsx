'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

const ALL_TLS = ['2 weeks','1 month','2 months','3 months','6 months','1 year','2+ years']
const TL_DAYS: Record<string,number> = {'2 weeks':14,'1 month':30,'2 months':60,'3 months':90,'6 months':180,'1 year':365,'2+ years':730}

export default function GoalsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [goals, setGoals] = useState<any[]>([])
  const [completedGoals, setCompletedGoals] = useState<any[]>([])
  const [rewards, setRewards] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState<string|null>(null)
  const [showExtend, setShowExtend] = useState<string|null>(null)
  const [showComplete, setShowComplete] = useState<string|null>(null)
  const [newTimeline, setNewTimeline] = useState('')
  const [completionNote, setCompletionNote] = useState('')
  const [completionPublic, setCompletionPublic] = useState(true)

  const isPro = profile?.plan==='pro'||profile?.plan==='pro_trial'
  const maxGoals = isPro ? 5 : 2

  useEffect(()=>{
    const load = async () => {
      const {data:{user}} = await supabase.auth.getUser()
      if (!user) return
      const [profRes,activeRes,doneRes,rewardsRes] = await Promise.all([
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
    setCompleting(goal.id+'-'+phase)
    const {data:{user}} = await supabase.auth.getUser()
    await supabase.from('goals').update({[field]:true,[fieldAt]:new Date().toISOString()}).eq('id',goal.id)
    if (user) {
      await supabase.from('rewards').insert({
        user_id:user.id,goal_id:goal.id,type:'phase_complete',
        title:`Phase ${phase} Complete`,emoji:'⭐',
        description:`Completed phase ${phase} of "${goal.display_title||goal.title}"`
      })
      // Update score in any circle memberships
      await supabase.from('circle_members').update({score: (50 * phase)}).eq('user_id',user.id)
    }
    setGoals(prev=>prev.map(g=>g.id===goal.id?{...g,[field]:true,[fieldAt]:new Date().toISOString()}:g))
    toast.success(`🎉 Phase ${phase} complete! +50 points earned.`)
    setCompleting(null)
  }

  const adjustTimeline = async (goalId:string) => {
    if (!newTimeline) { toast.error('Select a new timeline'); return }
    const days = TL_DAYS[newTimeline]||90
    const m1 = Math.round(days*0.33), m2 = Math.round(days*0.66)
    const goal = goals.find(g=>g.id===goalId)
    try {
      const res = await fetch('/api/goals/generate',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          goal:goal.title, category:goal.category, timeline:newTimeline,
          why:goal.why, obstacles:goal.obstacles, aesthetic:goal.aesthetic,
          userName:'user', gender:goal.user_gender, ageRange:goal.user_age_range,
          ethnicity:goal.user_ethnicity, successLooks:goal.success_looks,
          motivator:goal.motivator, coachStyle:goal.coach_style
        })
      })
      const data = await res.json()
      await supabase.from('goals').update({
        timeline:newTimeline, original_timeline:goal.original_timeline||goal.timeline,
        milestone_30:data.milestones?.[0]?.goal,
        milestone_60:data.milestones?.[1]?.goal,
        milestone_90:data.milestones?.[2]?.goal,
      }).eq('id',goalId)
      setGoals(prev=>prev.map(g=>g.id===goalId?{...g,timeline:newTimeline,original_timeline:goal.original_timeline||goal.timeline,milestone_30:data.milestones?.[0]?.goal,milestone_60:data.milestones?.[1]?.goal,milestone_90:data.milestones?.[2]?.goal}:g))
    } catch {
      await supabase.from('goals').update({timeline:newTimeline,original_timeline:goal.original_timeline||goal.timeline}).eq('id',goalId)
      setGoals(prev=>prev.map(g=>g.id===goalId?{...g,timeline:newTimeline}:g))
    }
    setShowExtend(null); setNewTimeline('')
    toast.success(`Timeline updated to ${newTimeline}! New milestones generated.`)
  }

  const markComplete = async (goalId:string) => {
    if (!completionNote.trim()) { toast.error('Share how it changed your life!'); return }
    const {data:{user}} = await supabase.auth.getUser()
    if (!user) return
    const goal = goals.find(g=>g.id===goalId)
    await supabase.from('goals').update({is_active:false,completed_at:new Date().toISOString(),completion_note:completionNote,completion_public:completionPublic,progress:100}).eq('id',goalId)
    if (completionPublic) {
      await supabase.from('success_stories').insert({user_id:user.id,goal_title:goal.display_title||goal.title,quote:completionNote,is_public:true})
    }
    await supabase.from('rewards').insert({user_id:user.id,goal_id:goalId,type:'goal_complete',title:'Goal Achieved!',emoji:'🎯',description:`Completed: ${goal.display_title||goal.title}`})
    await supabase.from('profiles').update({total_rewards:(profile?.total_rewards||0)+200}).eq('id',user.id)
    setGoals(prev=>prev.filter(g=>g.id!==goalId))
    setShowComplete(null); setCompletionNote(''); setCompletionPublic(true)
    toast.success('🎯 Goal completed! You earned 200 points.')
    router.refresh()
  }

  if (loading) return <div className="text-[#999] text-[14px] p-8">Loading...</div>

  return (
    <div className="fade-up max-w-[900px]">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-[32px] mb-1">My Goals</h1>
          <p className="text-[14px] text-[#666]">{goals.length} of {maxGoals} active · {rewards.length} rewards earned</p>
        </div>
        <div className="flex gap-2 items-center">
          {!isPro && <a href="/dashboard/upgrade" className="px-3 py-2 border border-[#b8922a]/30 bg-[#faf3e0] text-[#b8922a] rounded-xl text-[12px] font-medium hover:bg-[#f5e8c0]">↑ Pro: 5 goals</a>}
          {goals.length < maxGoals
            ? <a href="/onboarding" className="px-4 py-2 bg-[#111] text-white rounded-xl text-[13px] font-medium hover:bg-[#2a2a2a]">+ Add goal</a>
            : <div className="px-4 py-2 bg-[#f2f0ec] text-[#999] rounded-xl text-[13px] cursor-not-allowed">+ Limit reached</div>
          }
        </div>
      </div>

      {goals.length===0 ? (
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-10 text-center mb-6">
          <p className="font-serif text-[20px] mb-4">No active goals yet</p>
          <a href="/onboarding" className="inline-block px-6 py-3 bg-[#111] text-white rounded-xl text-[13px] font-medium">Create my first goal →</a>
        </div>
      ) : (
        <div className="flex flex-col gap-5 mb-8">
          {goals.map(goal=>{
            const phases = [
              {num:1,label:'Phase 1',milestone:goal.milestone_30,done:goal.phase1_completed,doneAt:goal.phase1_completed_at},
              {num:2,label:'Phase 2',milestone:goal.milestone_60,done:goal.phase2_completed,doneAt:goal.phase2_completed_at},
              {num:3,label:'Phase 3',milestone:goal.milestone_90,done:goal.phase3_completed,doneAt:goal.phase3_completed_at},
            ]
            return (
              <div key={goal.id} className="bg-white border border-[#e8e8e8] rounded-2xl overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-[#e8e8e8]">
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                    <div className="flex-1">
                      {goal.display_title && <p className="text-[11px] font-medium tracking-[.08em] uppercase text-[#b8922a] mb-1">{goal.display_title}</p>}
                      <p className="font-serif text-[19px] leading-[1.35]">{goal.title}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={()=>{setShowExtend(goal.id);setNewTimeline(goal.timeline)}} className="px-3 py-1.5 border border-[#e8e8e8] rounded-lg text-[12px] hover:bg-[#f8f7f5] transition-colors whitespace-nowrap">
                        ↔ Timeline
                      </button>
                      <a href="/dashboard/coach" className="px-3 py-1.5 border border-[#e8e8e8] rounded-lg text-[12px] hover:bg-[#f8f7f5] transition-colors">Coach</a>
                      <button onClick={()=>setShowComplete(goal.id)} className="px-3 py-1.5 bg-[#b8922a] text-white rounded-lg text-[12px] font-medium hover:bg-[#9a7820] transition-colors">Complete ✓</button>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap mb-4">
                    <span className="text-[11px] font-medium text-[#b8922a] bg-[#faf3e0] px-2.5 py-1 rounded-full">{goal.timeline}</span>
                    <span className="text-[11px] font-medium text-[#666] bg-[#f2f0ec] px-2.5 py-1 rounded-full">{goal.category}</span>
                    <span className="text-[11px] text-[#666] bg-[#f2f0ec] px-2.5 py-1 rounded-full">🔥 {goal.streak} days</span>
                    <span className="text-[11px] text-[#666] bg-[#f2f0ec] px-2.5 py-1 rounded-full">{goal.progress}% done</span>
                    {goal.original_timeline && <span className="text-[11px] text-[#999] bg-[#f8f7f5] px-2.5 py-1 rounded-full">was: {goal.original_timeline}</span>}
                  </div>
                  <div className="h-1.5 bg-[#f0ede8] rounded-full overflow-hidden">
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
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[11px] font-bold ${phase.done?'bg-green-500 text-white':'bg-[#f2f0ec] text-[#999]'}`}>
                        {phase.done?'✓':phase.num}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-[#b8922a] mb-0.5">{phase.label}</p>
                        <p className="text-[13px] text-[#666] leading-[1.5]">{phase.milestone}</p>
                        {phase.done && phase.doneAt && <p className="text-[11px] text-green-600 mt-1">✓ Completed {new Date(phase.doneAt).toLocaleDateString()}</p>}
                      </div>
                      {!phase.done && (
                        <button onClick={()=>completePhase(goal,phase.num as 1|2|3)} disabled={completing===goal.id+'-'+phase.num}
                          className="px-3 py-1.5 border border-[#e8e8e8] rounded-lg text-[11px] font-medium text-[#666] hover:border-green-300 hover:text-green-700 hover:bg-green-50 transition-all disabled:opacity-50 flex-shrink-0 whitespace-nowrap">
                          {completing===goal.id+'-'+phase.num?'Saving...':'Mark done ✓'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Rewards */}
      {rewards.length>0 && (
        <div className="mb-8">
          <h2 className="font-serif text-[22px] mb-4">Rewards earned</h2>
          <div className="flex gap-3 flex-wrap">
            {rewards.map((r,i)=>(
              <div key={i} className="bg-white border border-[#e8e8e8] rounded-xl p-4 flex items-center gap-3">
                <span className="text-[26px]">{r.emoji||'🏅'}</span>
                <div><p className="text-[13px] font-medium">{r.title}</p><p className="text-[11px] text-[#999]">{r.description}</p></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed goals */}
      {completedGoals.length>0 && (
        <div>
          <h2 className="font-serif text-[22px] mb-4">Completed</h2>
          {completedGoals.map(g=>(
            <div key={g.id} className="bg-white border border-[#e8e8e8] rounded-2xl p-5 mb-3 opacity-75">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-[20px]">🎯</span>
                <div>
                  <p className="font-medium text-[14px]">{g.display_title||g.title}</p>
                  <p className="text-[11px] text-[#999]">Completed {g.completed_at?new Date(g.completed_at).toLocaleDateString():''}</p>
                </div>
                {g.completion_public && <span className="ml-auto text-[10px] font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Public</span>}
              </div>
              {g.completion_note && <p className="text-[13px] text-[#666] font-serif italic">"{g.completion_note}"</p>}
            </div>
          ))}
        </div>
      )}

      {/* Adjust timeline modal */}
      {showExtend && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6" onClick={e=>e.target===e.currentTarget&&setShowExtend(null)}>
          <div className="bg-white rounded-2xl p-8 max-w-md w-full">
            <h3 className="font-serif text-[24px] mb-2">Adjust timeline</h3>
            <p className="text-[14px] text-[#666] mb-6">New milestones will be generated for the updated timeframe.</p>
            <div className="flex flex-wrap gap-2 mb-6">
              {ALL_TLS.map(t=>(
                <button key={t} onClick={()=>setNewTimeline(t)}
                  className={`px-3.5 py-2 rounded-full text-[13px] border transition-all ${newTimeline===t?'bg-[#111] text-white border-[#111]':t===goals.find(g=>g.id===showExtend)?.timeline?'border-[#b8922a] text-[#b8922a]':'border-[#e8e8e8] hover:border-[#d0d0d0]'}`}>
                  {t}{t===goals.find(g=>g.id===showExtend)?.timeline?' (current)':''}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={()=>setShowExtend(null)} className="flex-1 py-2.5 border border-[#e8e8e8] rounded-xl text-[13px] hover:bg-[#f8f7f5]">Cancel</button>
              <button onClick={()=>adjustTimeline(showExtend!)} className="flex-1 py-2.5 bg-[#111] text-white rounded-xl text-[13px] font-medium hover:bg-[#2a2a2a]">Update timeline</button>
            </div>
          </div>
        </div>
      )}

      {/* Complete goal modal */}
      {showComplete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6" onClick={e=>e.target===e.currentTarget&&setShowComplete(null)}>
          <div className="bg-white rounded-2xl p-8 max-w-md w-full">
            <div className="text-center mb-6"><div className="text-5xl mb-3">🎉</div>
              <h3 className="font-serif text-[26px] mb-2">You completed it!</h3>
              <p className="text-[14px] text-[#666]">How did achieving this goal change your life?</p>
            </div>
            <div className="mb-4">
              <label className="block text-[12px] font-medium text-[#666] mb-2">Your completion story</label>
              <textarea className="w-full px-3.5 py-3 border border-[#e8e8e8] rounded-xl text-[14px] outline-none focus:border-[#111] resize-none" rows={4} value={completionNote} onChange={e=>setCompletionNote(e.target.value)} placeholder="How did achieving this goal change your life? What did you learn?"/>
            </div>
            {/* Privacy toggle */}
            <div className="flex items-center justify-between p-3 bg-[#f8f7f5] rounded-xl mb-5">
              <div>
                <p className="text-[13px] font-medium">Share publicly?</p>
                <p className="text-[11px] text-[#999]">Your story inspires others on the same journey</p>
              </div>
              <button onClick={()=>setCompletionPublic(p=>!p)}
                className={`w-12 h-6 rounded-full transition-all relative ${completionPublic?'bg-[#b8922a]':'bg-[#e8e8e8]'}`}>
                <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${completionPublic?'left-6':'left-0.5'}`}/>
              </button>
            </div>
            <div className="flex gap-3">
              <button onClick={()=>setShowComplete(null)} className="flex-1 py-2.5 border border-[#e8e8e8] rounded-xl text-[13px] hover:bg-[#f8f7f5]">Not yet</button>
              <button onClick={()=>markComplete(showComplete!)} className="flex-1 py-2.5 bg-[#b8922a] text-white rounded-xl text-[13px] font-medium hover:bg-[#9a7820]">Complete goal 🎉</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
