'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

const CATS = ['Career & business','Health & fitness','Financial freedom','Relationships','Creative work','Personal growth','Travel & adventure','Learning & skills']
const TLS  = ['1 month','2 months','3 months','6 months','1 year','2+ years']
const AES  = [
  { label:'Minimal & clean',    desc:'White space, calm, pure',        bg:'#e8e5de', fg:'#111' },
  { label:'Bold & dark',        desc:'Dramatic, powerful, moody',       bg:'#1a1a2e', fg:'rgba(255,255,255,.9)' },
  { label:'Warm & natural',     desc:'Earth tones, organic warmth',     bg:'#3d2a1a', fg:'rgba(255,255,255,.9)' },
  { label:'Bright & energetic', desc:'Color, movement, alive',          bg:'#0d2137', fg:'rgba(255,255,255,.9)' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState(0)
  const [user, setUser] = useState<any>(null)
  const [data, setData] = useState({ goal:'', category:'', timeline:'', why:'', obstacles:'', aesthetic:'' })
  const [result, setResult] = useState<any>(null)
  const [generating, setGenerating] = useState(false)
  const upd = (k: string, v: string) => setData(d => ({ ...d, [k]: v }))

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/auth/login'); return }
      setUser(data.user)
    })
  }, [])

  const validate = () => {
    if (step === 0 && (!data.goal.trim() || !data.category)) return 'Please describe your goal and pick a category'
    if (step === 1 && !data.timeline) return 'Please choose a timeline'
    if (step === 2 && !data.why.trim()) return 'Please share your why'
    if (step === 3 && !data.aesthetic) return 'Please choose a visual style'
    return null
  }

  const next = async () => {
    const err = validate()
    if (err) { toast.error(err); return }
    if (step === 3) { setStep(4); generate(); }
    else setStep(s => s + 1)
  }

  const generate = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/goals/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, userName: user?.user_metadata?.full_name || user?.email?.split('@')[0] }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setResult(json)
    } catch (e: any) {
      toast.error('AI generation failed, using defaults')
      setResult({
        artTitle: 'The path forward',
        artDescription: `A ${data.aesthetic} visual built around: ${data.goal}`,
        affirmation: `I am fully committed to ${data.goal} and I act on it every single day.`,
        milestone30: 'Establish your daily foundation and complete 20 check-ins',
        milestone60: 'Reach measurable halfway progress with refined strategy',
        milestone90: 'Stand at 75% with undeniable momentum',
        coachOpening: `You just declared a specific goal. That alone puts you ahead of 90% of people.`,
        todayAction: `Block 30 minutes to write your 3 most important first steps toward: "${data.goal}"`,
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
      milestone_30: result.milestone30,
      milestone_60: result.milestone60,
      milestone_90: result.milestone90,
      coach_opening: result.coachOpening,
      today_action: result.todayAction,
      is_active: true,
    })
    if (error) { toast.error('Failed to save goal: ' + error.message); return }
    toast.success('Your manifest is live!')
    router.push('/dashboard')
  }

  const aes = AES.find(a => a.label === data.aesthetic)
  const progress = ((step) / 4) * 100

  return (
    <div className="min-h-screen bg-[#f8f7f5] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl overflow-hidden max-w-[520px] w-full shadow-sm border border-[#e8e8e8]">
        {/* Progress */}
        <div className="h-0.5 bg-[#e8e8e8]">
          <div className="h-full bg-[#b8922a] transition-all duration-500" style={{ width: `${progress}%` }}/>
        </div>
        <div className="p-10">

          {/* Step 0 — Goal */}
          {step === 0 && (
            <div className="fade-up">
              <p className="text-[10px] font-medium tracking-[.14em] uppercase text-[#b8922a] mb-2">Step 1 of 4</p>
              <h2 className="font-serif text-[28px] mb-1.5">What's your goal?</h2>
              <p className="text-[14px] text-[#666] mb-6 leading-[1.6]">Be specific. A vague goal stays a wish.</p>
              <div className="mb-5">
                <label className="block text-[12px] font-medium text-[#666] mb-2">Describe your goal clearly</label>
                <textarea className="w-full px-3.5 py-3 border border-[#e8e8e8] rounded-xl text-[14px] outline-none focus:border-[#111] transition-colors resize-none" rows={3} value={data.goal} onChange={e=>upd('goal',e.target.value)} placeholder="e.g. Run a marathon in under 4 hours within the next 6 months"/>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#666] mb-2">Category</label>
                <div className="flex flex-wrap gap-2">
                  {CATS.map(c=>(
                    <button key={c} onClick={()=>upd('category',c)} className={`px-3.5 py-2 rounded-full text-[13px] border transition-all ${data.category===c ? 'bg-[#111] text-white border-[#111]' : 'bg-white text-[#111] border-[#e8e8e8] hover:border-[#d0d0d0]'}`}>{c}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 1 — Timeline */}
          {step === 1 && (
            <div className="fade-up">
              <p className="text-[10px] font-medium tracking-[.14em] uppercase text-[#b8922a] mb-2">Step 2 of 4</p>
              <h2 className="font-serif text-[28px] mb-1.5">Your timeline</h2>
              <p className="text-[14px] text-[#666] mb-6 leading-[1.6]">When will this be achieved?</p>
              <div className="flex flex-wrap gap-2">
                {TLS.map(t=>(
                  <button key={t} onClick={()=>upd('timeline',t)} className={`px-4 py-2.5 rounded-full text-[13px] border transition-all ${data.timeline===t ? 'bg-[#b8922a] text-white border-[#b8922a]' : 'bg-white text-[#111] border-[#e8e8e8] hover:border-[#d0d0d0]'}`}>{t}</button>
                ))}
              </div>
              {data.timeline && (
                <div className="mt-5 p-4 bg-[#faf3e0] rounded-xl border border-[#b8922a]/20">
                  <p className="text-[13px] text-[#666] leading-[1.6]">
                    Goal: <strong className="text-[#111]">{data.goal}</strong><br/>
                    By: <strong className="text-[#b8922a]">{data.timeline} from today</strong>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 2 — Why */}
          {step === 2 && (
            <div className="fade-up">
              <p className="text-[10px] font-medium tracking-[.14em] uppercase text-[#b8922a] mb-2">Step 3 of 4</p>
              <h2 className="font-serif text-[28px] mb-1.5">Your deeper why</h2>
              <p className="text-[14px] text-[#666] mb-6 leading-[1.6]">This is what carries you through hard days. The more honest, the better your coaching.</p>
              <div className="mb-4">
                <label className="block text-[12px] font-medium text-[#666] mb-2">Why does this truly matter to you?</label>
                <textarea className="w-full px-3.5 py-3 border border-[#e8e8e8] rounded-xl text-[14px] outline-none focus:border-[#111] transition-colors resize-none" rows={4} value={data.why} onChange={e=>upd('why',e.target.value)} placeholder="What does achieving this change about your life? Who do you become?"/>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[#666] mb-2">What's stopped you before? <span className="text-[#999] font-normal">(optional)</span></label>
                <textarea className="w-full px-3.5 py-3 border border-[#e8e8e8] rounded-xl text-[14px] outline-none focus:border-[#111] transition-colors resize-none" rows={2} value={data.obstacles} onChange={e=>upd('obstacles',e.target.value)} placeholder="Knowing your patterns helps your coach be more effective"/>
              </div>
            </div>
          )}

          {/* Step 3 — Aesthetic */}
          {step === 3 && (
            <div className="fade-up">
              <p className="text-[10px] font-medium tracking-[.14em] uppercase text-[#b8922a] mb-2">Step 4 of 4</p>
              <h2 className="font-serif text-[28px] mb-1.5">Your visual style</h2>
              <p className="text-[14px] text-[#666] mb-6 leading-[1.6]">Your vision art will be designed in this style.</p>
              <div className="grid grid-cols-2 gap-3">
                {AES.map(a=>(
                  <button key={a.label} onClick={()=>upd('aesthetic',a.label)} className={`p-4 text-left rounded-xl border-2 transition-all ${data.aesthetic===a.label ? 'border-[#111] bg-[#111]' : 'border-[#e8e8e8] bg-white hover:border-[#d0d0d0]'}`}>
                    <div className="w-8 h-8 rounded-lg mb-3" style={{ background: a.bg }}/>
                    <p className={`text-[13px] font-medium ${data.aesthetic===a.label ? 'text-white' : 'text-[#111]'}`}>{a.label}</p>
                    <p className={`text-[11px] mt-0.5 ${data.aesthetic===a.label ? 'text-white/50' : 'text-[#999]'}`}>{a.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 4 — Result */}
          {step === 4 && (
            <div className="fade-up">
              {generating ? (
                <div className="text-center py-12">
                  <div className="w-10 h-10 border-2 border-[#e8e8e8] border-t-[#b8922a] rounded-full spin-anim mx-auto mb-5"/>
                  <h3 className="font-serif text-[24px] mb-2">Creating your manifest...</h3>
                  <p className="text-[14px] text-[#666]">AI is personalizing everything for you</p>
                </div>
              ) : result && (
                <>
                  <p className="text-[10px] font-medium tracking-[.14em] uppercase text-[#b8922a] mb-2">Your manifest is ready</p>
                  <h2 className="font-serif text-[26px] mb-5">Welcome, {user?.user_metadata?.full_name?.split(' ')[0] || 'friend'}.</h2>

                  {/* Art card */}
                  <div className="rounded-2xl overflow-hidden mb-4 relative" style={{ background: aes?.bg || '#1a1a2e', minHeight: 140 }}>
                    <div className="absolute inset-0 flex items-center justify-center font-serif text-[80px] opacity-[0.07]" style={{ color: aes?.fg }}>✦</div>
                    <div className="relative z-10 p-6" style={{ background: `linear-gradient(to top, ${aes?.bg === '#e8e5de' ? 'rgba(232,229,222,.9)' : 'rgba(0,0,0,.55)'} 0%, transparent 100%)` }}>
                      <p className="font-serif italic text-[20px] mb-1.5" style={{ color: aes?.fg }}>{result.artTitle}</p>
                      <p className="text-[12px] leading-[1.6]" style={{ color: aes?.bg === '#e8e5de' ? 'rgba(0,0,0,.5)' : 'rgba(255,255,255,.5)' }}>{result.artDescription}</p>
                    </div>
                  </div>

                  {/* Affirmation */}
                  <div className="bg-[#f8f7f5] border-l-[3px] border-[#b8922a] p-4 rounded-r-xl mb-4 font-serif italic text-[15px] leading-[1.6]">
                    "{result.affirmation}"
                  </div>

                  {/* Milestones */}
                  <div className="border border-[#e8e8e8] rounded-xl overflow-hidden mb-4">
                    {[['30 days', result.milestone30],['60 days', result.milestone60],['90 days', result.milestone90]].map(([t,v],i)=>(
                      <div key={t} className={`flex gap-4 p-3.5 text-[13px] ${i<2?'border-b border-[#e8e8e8]':''}`}>
                        <span className="text-[#b8922a] font-medium w-14 flex-shrink-0">{t}</span>
                        <span>{v}</span>
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
                  <p className="text-center text-[11px] text-[#999] mt-2">Your vision art will be emailed to {user?.email}</p>
                </>
              )}
            </div>
          )}

          {/* Footer nav */}
          {step < 4 && (
            <div className="flex justify-between items-center mt-7 pt-5 border-t border-[#e8e8e8]">
              {step > 0 ? (
                <button onClick={()=>setStep(s=>s-1)} className="px-4 py-2 text-[13px] font-medium border border-[#e8e8e8] rounded-lg hover:bg-[#f8f7f5] transition-colors">← Back</button>
              ) : <div/>}
              <button onClick={next} className="px-5 py-2.5 bg-[#111] text-white rounded-lg text-[13px] font-medium hover:bg-[#2a2a2a] transition-colors">
                {step === 3 ? 'Create my manifest ✦' : 'Continue →'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
