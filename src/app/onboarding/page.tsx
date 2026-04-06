'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

const CATS = ['Career & business','Health & fitness','Financial freedom','Relationships','Creative work','Personal growth','Travel & adventure','Learning & skills']
const TLS  = ['2 weeks','1 month','2 months','3 months','6 months','1 year','2+ years']
const AES  = [
  { label:'Minimal & clean',    desc:'White space, calm, pure',       bg:'#e8e5de', fg:'#111' },
  { label:'Bold & dark',        desc:'Dramatic, powerful, moody',      bg:'#1a1a2e', fg:'rgba(255,255,255,.9)' },
  { label:'Warm & natural',     desc:'Earth tones, organic warmth',    bg:'#3d2a1a', fg:'rgba(255,255,255,.9)' },
  { label:'Bright & energetic', desc:'Color, movement, alive',         bg:'#0d2137', fg:'rgba(255,255,255,.9)' },
]
const MOTIVATORS = ['Achievement & results','Growth & learning','Freedom & flexibility','Recognition & impact','Security & stability','Connection & relationships']
const TIMES = ['Early morning (5-8am)','Morning (8-11am)','Afternoon (12-4pm)','Evening (5-8pm)','Night (9pm+)','Varies day to day']
const STYLES = ['I need detailed step-by-step plans','I prefer high-level direction','I like accountability check-ins','I want to be pushed hard','I need gentle encouragement','I like data and tracking']

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState(0)
  const [user, setUser] = useState<any>(null)
  const [data, setData] = useState({
    goal: '', category: '', timeline: '', why: '', obstacles: '', aesthetic: '',
    successLooks: '', motivator: '', bestTime: '', coachStyle: '', accountability: ''
  })
  const [result, setResult] = useState<any>(null)
  const [generating, setGenerating] = useState(false)
  const upd = (k: string, v: string) => setData(d => ({ ...d, [k]: v }))

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/auth/login'); return }
      setUser(data.user)
    })
  }, [])

  const steps = [
    { label: 'Your goal', total: 6 },
    { label: 'Timeline', total: 6 },
    { label: 'Your why', total: 6 },
    { label: 'Personalization', total: 6 },
    { label: 'Visual style', total: 6 },
    { label: 'Your manifest', total: 6 },
  ]

  const validate = () => {
    if (step === 0 && (!data.goal.trim() || !data.category)) return 'Please describe your goal and pick a category'
    if (step === 1 && !data.timeline) return 'Please choose a timeline'
    if (step === 2 && (!data.why.trim() || !data.successLooks.trim())) return 'Please answer both questions'
    if (step === 3 && (!data.motivator || !data.bestTime || !data.coachStyle)) return 'Please answer all questions'
    if (step === 4 && !data.aesthetic) return 'Please choose a visual style'
    return null
  }

  const next = async () => {
    const err = validate()
    if (err) { toast.error(err); return }
    if (step === 4) { setStep(5); generate() }
    else setStep(s => s + 1)
  }

  const generate = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/goals/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          userName: user?.user_metadata?.full_name || user?.email?.split('@')[0]
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setResult(json)
    } catch (e: any) {
      toast.error('Generation failed, using smart defaults')
      const tlDays: Record<string,number> = { '2 weeks':14,'1 month':30,'2 months':60,'3 months':90,'6 months':180,'1 year':365,'2+ years':730 }
      const days = tlDays[data.timeline] || 90
      setResult({
        artTitle: 'The path forward',
        artDescription: `A ${data.aesthetic} visual — your goal rendered as a world you step into daily.`,
        affirmation: `I am on my way to ${data.goal} and I show up every single day.`,
        milestones: generateSmartMilestones(data.goal, data.timeline, days),
        coachOpening: `You just did something most people never do — you got specific. Let's build on that.`,
        todayAction: `Write down the single biggest obstacle between you and "${data.goal}" and what you'll do about it today.`,
      })
    }
    setGenerating(false)
  }

  const activate = async () => {
    if (!result || !user) return
    const { error } = await supabase.from('goals').insert({
      user_id: user.id,
      title: data.goal,
      category: data.category,
      timeline: data.timeline,
      why: data.why,
      obstacles: data.obstacles,
      aesthetic: data.aesthetic,
      art_title: result.artTitle,
      art_description: result.artDescription,
      affirmation: result.affirmation,
      milestone_30: result.milestones?.[0]?.goal || result.milestone30,
      milestone_60: result.milestones?.[1]?.goal || result.milestone60,
      milestone_90: result.milestones?.[2]?.goal || result.milestone90,
      coach_opening: result.coachOpening,
      today_action: result.todayAction,
      is_active: true,
      vision_board_last_generated: new Date().toISOString(),
    })
    if (error) { toast.error('Failed to save: ' + error.message); return }
    toast.success('Your manifest is live!')
    router.push('/dashboard')
  }

  const aes = AES.find(a => a.label === data.aesthetic)

  return (
    <div className="min-h-screen bg-[#f8f7f5] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl overflow-hidden max-w-[560px] w-full shadow-sm border border-[#e8e8e8]">
        <div className="h-0.5 bg-[#e8e8e8]">
          <div className="h-full bg-[#b8922a] transition-all duration-500" style={{ width: `${(step / 5) * 100}%` }}/>
        </div>
        <div className="p-10">

          {/* STEP 0 — Goal */}
          {step === 0 && (
            <div className="fade-up">
              <p className="text-[10px] font-medium tracking-[.14em] uppercase text-[#b8922a] mb-2">Step 1 of 5</p>
              <h2 className="font-serif text-[28px] mb-1.5">What's your goal?</h2>
              <p className="text-[14px] text-[#666] mb-6 leading-[1.6]">Be specific. Vague goals stay wishes.</p>
              <div className="mb-5">
                <label className="block text-[12px] font-medium text-[#666] mb-2">Describe your goal in detail</label>
                <textarea className="w-full px-3.5 py-3 border border-[#e8e8e8] rounded-xl text-[14px] outline-none focus:border-[#111] transition-colors resize-none" rows={3} value={data.goal} onChange={e=>upd('goal',e.target.value)} placeholder="e.g. Run a marathon in under 4 hours — I want to cross the finish line at the NYC marathon this November"/>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#666] mb-2">Category</label>
                <div className="flex flex-wrap gap-2">
                  {CATS.map(c=>(
                    <button key={c} onClick={()=>upd('category',c)} className={`px-3.5 py-2 rounded-full text-[13px] border transition-all ${data.category===c?'bg-[#111] text-white border-[#111]':'bg-white text-[#111] border-[#e8e8e8] hover:border-[#d0d0d0]'}`}>{c}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 1 — Timeline */}
          {step === 1 && (
            <div className="fade-up">
              <p className="text-[10px] font-medium tracking-[.14em] uppercase text-[#b8922a] mb-2">Step 2 of 5</p>
              <h2 className="font-serif text-[28px] mb-1.5">Your timeline</h2>
              <p className="text-[14px] text-[#666] mb-6 leading-[1.6]">Your milestones will be tailored exactly to this timeframe.</p>
              <div className="flex flex-wrap gap-2 mb-5">
                {TLS.map(t=>(
                  <button key={t} onClick={()=>upd('timeline',t)} className={`px-4 py-2.5 rounded-full text-[13px] border transition-all ${data.timeline===t?'bg-[#b8922a] text-white border-[#b8922a]':'bg-white text-[#111] border-[#e8e8e8] hover:border-[#d0d0d0]'}`}>{t}</button>
                ))}
              </div>
              {data.timeline && (
                <div className="p-4 bg-[#faf3e0] rounded-xl border border-[#b8922a]/20">
                  <p className="text-[13px] text-[#666] leading-[1.6]">
                    Your AI coach and milestones will be calibrated specifically for a <strong className="text-[#b8922a]">{data.timeline}</strong> journey toward: <strong className="text-[#111]">{data.goal}</strong>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* STEP 2 — Why + Success */}
          {step === 2 && (
            <div className="fade-up">
              <p className="text-[10px] font-medium tracking-[.14em] uppercase text-[#b8922a] mb-2">Step 3 of 5</p>
              <h2 className="font-serif text-[28px] mb-1.5">Your deeper why</h2>
              <p className="text-[14px] text-[#666] mb-6 leading-[1.6]">This powers your coaching. The more honest, the better.</p>
              <div className="mb-4">
                <label className="block text-[12px] font-medium text-[#666] mb-2">Why does this goal truly matter to you?</label>
                <textarea className="w-full px-3.5 py-3 border border-[#e8e8e8] rounded-xl text-[14px] outline-none focus:border-[#111] transition-colors resize-none" rows={3} value={data.why} onChange={e=>upd('why',e.target.value)} placeholder="What changes in your life when you achieve this? Who do you become?"/>
              </div>
              <div className="mb-4">
                <label className="block text-[12px] font-medium text-[#666] mb-2">What does success look and feel like?</label>
                <textarea className="w-full px-3.5 py-3 border border-[#e8e8e8] rounded-xl text-[14px] outline-none focus:border-[#111] transition-colors resize-none" rows={3} value={data.successLooks} onChange={e=>upd('successLooks',e.target.value)} placeholder="Paint a vivid picture — where are you, what are you doing, how do you feel when you've achieved this?"/>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#666] mb-2">What's stopped you before? <span className="text-[#999] font-normal">(optional)</span></label>
                <textarea className="w-full px-3.5 py-3 border border-[#e8e8e8] rounded-xl text-[14px] outline-none focus:border-[#111] transition-colors resize-none" rows={2} value={data.obstacles} onChange={e=>upd('obstacles',e.target.value)} placeholder="Knowing your patterns helps your coach work around them"/>
              </div>
            </div>
          )}

          {/* STEP 3 — Deep personalization */}
          {step === 3 && (
            <div className="fade-up">
              <p className="text-[10px] font-medium tracking-[.14em] uppercase text-[#b8922a] mb-2">Step 4 of 5</p>
              <h2 className="font-serif text-[28px] mb-1.5">Personalize your coaching</h2>
              <p className="text-[14px] text-[#666] mb-6 leading-[1.6]">This shapes how your AI coach talks to you every day.</p>
              <div className="mb-5">
                <label className="block text-[12px] font-medium text-[#666] mb-2">What motivates you most?</label>
                <div className="flex flex-wrap gap-2">
                  {MOTIVATORS.map(m=>(
                    <button key={m} onClick={()=>upd('motivator',m)} className={`px-3 py-1.5 rounded-full text-[12px] border transition-all ${data.motivator===m?'bg-[#111] text-white border-[#111]':'bg-white text-[#111] border-[#e8e8e8] hover:border-[#d0d0d0]'}`}>{m}</button>
                  ))}
                </div>
              </div>
              <div className="mb-5">
                <label className="block text-[12px] font-medium text-[#666] mb-2">When are you most productive?</label>
                <div className="flex flex-wrap gap-2">
                  {TIMES.map(t=>(
                    <button key={t} onClick={()=>upd('bestTime',t)} className={`px-3 py-1.5 rounded-full text-[12px] border transition-all ${data.bestTime===t?'bg-[#111] text-white border-[#111]':'bg-white text-[#111] border-[#e8e8e8] hover:border-[#d0d0d0]'}`}>{t}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#666] mb-2">How do you prefer to be coached?</label>
                <div className="flex flex-wrap gap-2">
                  {STYLES.map(s=>(
                    <button key={s} onClick={()=>upd('coachStyle',s)} className={`px-3 py-1.5 rounded-full text-[12px] border transition-all ${data.coachStyle===s?'bg-[#111] text-white border-[#111]':'bg-white text-[#111] border-[#e8e8e8] hover:border-[#d0d0d0]'}`}>{s}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4 — Aesthetic */}
          {step === 4 && (
            <div className="fade-up">
              <p className="text-[10px] font-medium tracking-[.14em] uppercase text-[#b8922a] mb-2">Step 5 of 5</p>
              <h2 className="font-serif text-[28px] mb-1.5">Your vision board style</h2>
              <p className="text-[14px] text-[#666] mb-6 leading-[1.6]">Your vision art will be designed in this style — beautiful enough to frame.</p>
              <div className="grid grid-cols-2 gap-3">
                {AES.map(a=>(
                  <button key={a.label} onClick={()=>upd('aesthetic',a.label)} className={`p-4 text-left rounded-xl border-2 transition-all ${data.aesthetic===a.label?'border-[#111] bg-[#111]':'border-[#e8e8e8] bg-white hover:border-[#d0d0d0]'}`}>
                    <div className="w-8 h-8 rounded-lg mb-3" style={{ background: a.bg }}/>
                    <p className={`text-[13px] font-medium ${data.aesthetic===a.label?'text-white':'text-[#111]'}`}>{a.label}</p>
                    <p className={`text-[11px] mt-0.5 ${data.aesthetic===a.label?'text-white/50':'text-[#999]'}`}>{a.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 5 — Result */}
          {step === 5 && (
            <div className="fade-up">
              {generating ? (
                <div className="text-center py-12">
                  <div className="w-10 h-10 border-2 border-[#e8e8e8] border-t-[#b8922a] rounded-full spin-anim mx-auto mb-5"/>
                  <h3 className="font-serif text-[24px] mb-2">Building your manifest...</h3>
                  <p className="text-[14px] text-[#666]">Personalizing everything to your exact goal and style</p>
                </div>
              ) : result && (
                <>
                  <p className="text-[10px] font-medium tracking-[.14em] uppercase text-[#b8922a] mb-2">Your manifest is ready</p>
                  <h2 className="font-serif text-[26px] mb-5">Welcome, {user?.user_metadata?.full_name?.split(' ')[0] || 'friend'}. ✦</h2>

                  {/* Art card */}
                  <div className="rounded-2xl overflow-hidden mb-4 relative" style={{ background: aes?.bg || '#1a1a2e', minHeight: 150 }}>
                    <div className="absolute inset-0 flex items-center justify-center font-serif text-[80px] opacity-[0.07]" style={{ color: aes?.fg }}>✦</div>
                    <div className="relative z-10 p-6" style={{ background: `linear-gradient(to top, ${aes?.bg === '#e8e5de' ? 'rgba(232,229,222,.9)' : 'rgba(0,0,0,.55)'} 0%, transparent 100%)` }}>
                      <p className="font-serif italic text-[22px] mb-1.5" style={{ color: aes?.fg }}>{result.artTitle}</p>
                      <p className="text-[12px] leading-[1.6]" style={{ color: aes?.bg === '#e8e5de' ? 'rgba(0,0,0,.5)' : 'rgba(255,255,255,.5)' }}>{result.artDescription}</p>
                    </div>
                  </div>

                  {/* Affirmation */}
                  <div className="bg-[#f8f7f5] border-l-[3px] border-[#b8922a] p-4 rounded-r-xl mb-4 font-serif italic text-[15px] leading-[1.6]">
                    "{result.affirmation}"
                  </div>

                  {/* Smart milestones */}
                  <div className="border border-[#e8e8e8] rounded-xl overflow-hidden mb-4">
                    <div className="px-4 py-2.5 bg-[#f8f7f5] border-b border-[#e8e8e8]">
                      <p className="text-[11px] font-medium text-[#666] uppercase tracking-[.08em]">Your {data.timeline} roadmap</p>
                    </div>
                    {(result.milestones || [
                      { label: 'Phase 1', goal: result.milestone30 },
                      { label: 'Phase 2', goal: result.milestone60 },
                      { label: 'Phase 3', goal: result.milestone90 },
                    ]).map((m: any, i: number) => (
                      <div key={i} className={`flex gap-4 p-3.5 text-[13px] ${i < 2 ? 'border-b border-[#e8e8e8]' : ''}`}>
                        <span className="text-[#b8922a] font-medium w-20 flex-shrink-0 text-[11px] pt-0.5">{m.label}</span>
                        <span>{m.goal}</span>
                      </div>
                    ))}
                  </div>

                  {/* Coach */}
                  <div className="bg-[#111] rounded-xl p-4 mb-5">
                    <p className="text-[10px] font-medium tracking-[.1em] uppercase text-white/30 mb-2">Your coach says</p>
                    <p className="font-serif italic text-[14px] text-white/80 leading-[1.65] mb-3">"{result.coachOpening}"</p>
                    <div className="bg-white/[0.06] rounded-lg p-3 text-[12px] text-white/55">
                      <strong className="text-white/80 font-medium">Today: </strong>{result.todayAction}
                    </div>
                  </div>

                  <button onClick={activate} className="w-full py-3.5 bg-[#b8922a] text-white rounded-xl text-[14px] font-medium hover:bg-[#9a7820] transition-colors">
                    Activate my manifest →
                  </button>
                </>
              )}
            </div>
          )}

          {step < 5 && (
            <div className="flex justify-between items-center mt-7 pt-5 border-t border-[#e8e8e8]">
              {step > 0 ? (
                <button onClick={()=>setStep(s=>s-1)} className="px-4 py-2 text-[13px] font-medium border border-[#e8e8e8] rounded-lg hover:bg-[#f8f7f5] transition-colors">← Back</button>
              ) : <div/>}
              <button onClick={next} className="px-5 py-2.5 bg-[#111] text-white rounded-lg text-[13px] font-medium hover:bg-[#2a2a2a] transition-colors">
                {step === 4 ? 'Create my manifest ✦' : 'Continue →'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function generateSmartMilestones(goal: string, timeline: string, days: number) {
  const third = Math.round(days / 3)
  const two3rd = Math.round(days * 2 / 3)
  return [
    { label: `Day ${third}`, goal: `Foundation built — establish your daily routine and complete first major step toward "${goal}"` },
    { label: `Day ${two3rd}`, goal: `Halfway mark — measurable progress visible, strategy refined based on what's working` },
    { label: `Day ${days}`, goal: `Final push — you're at 90% of "${goal}", the finish line is in sight` },
  ]
}
