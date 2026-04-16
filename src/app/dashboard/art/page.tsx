'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import toast from 'react-hot-toast'

const PRINT_PRODUCTS = [
  { size: '8×10"', price: '$29', type: 'Poster', desc: 'Matte fine art paper, vibrant colors. Ships in 3-5 days.' },
  { size: '12×16"', price: '$49', type: 'Canvas', desc: 'Gallery-wrapped canvas, ready to hang. Ships in 5-7 days.', featured: true },
  { size: '18×24"', price: '$79', type: 'Framed', desc: 'Black wood frame, museum glass. Ships in 7-10 days.' },
]

export default function VisionArtPage() {
  const supabase = createClient()
  const [goals, setGoals] = useState<any[]>([])
  const [selectedGoal, setSelectedGoal] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [options, setOptions] = useState<any[]>([])
  const [chosenIdx, setChosenIdx] = useState<number | null>(null)
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [emailSent, setEmailSent] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [tab, setTab] = useState<'art'|'print'>('art')
  const [printOrdered, setPrintOrdered] = useState<string[]>([])

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ data: prof }, { data: gs }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('goals').select('*').eq('user_id', user.id).eq('is_active', true).order('created_at', { ascending: false }),
      ])
      setProfile(prof)
      setGoals(gs || [])
      const savedId = localStorage.getItem('selectedGoalId')
      const g = gs?.find((x: any) => x.id === savedId) || gs?.[0] || null
      setSelectedGoal(g)
      if (g) {
        const cached = localStorage.getItem(`vb_options_${g.id}`)
        if (cached) try { const p = JSON.parse(cached); setOptions(p.options || []); setChosenIdx(p.chosen ?? null) } catch {}
      }
      setLoading(false)
    }
    load()
  }, [])

  const selectGoal = (g: any) => {
    setSelectedGoal(g)
    setOptions([]); setChosenIdx(null); setEmailSent(false)
    const cached = localStorage.getItem(`vb_options_${g.id}`)
    if (cached) try { const p = JSON.parse(cached); setOptions(p.options || []); setChosenIdx(p.chosen ?? null) } catch {}
    localStorage.setItem('selectedGoalId', g.id)
  }

  const generate = async () => {
    if (!selectedGoal || generating) return
    setGenerating(true); setOptions([]); setChosenIdx(null)
    const res = await fetch('/api/vision-art/options', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ goalId: selectedGoal.id }) })
    const data = await res.json()
    if (res.ok && data.options) {
      setOptions(data.options)
      localStorage.setItem(`vb_options_${selectedGoal.id}`, JSON.stringify({ options: data.options, chosen: null }))
      toast.success('3 vision options ready!')
    } else toast.error(data.error || 'Generation failed')
    setGenerating(false)
  }

  const chooseOption = async (idx: number) => {
    if (!selectedGoal) return
    const chosen = options[idx]
    if (!chosen?.imageUrl) return
    setChosenIdx(idx)
    const newCount = (selectedGoal.vision_board_regenerations || 0) + 1
    await supabase.from('goals').update({ art_image_url: chosen.imageUrl, vision_board_regenerations: newCount }).eq('id', selectedGoal.id)
    const updated = { ...selectedGoal, art_image_url: chosen.imageUrl, vision_board_regenerations: newCount }
    setSelectedGoal(updated)
    setGoals(prev => prev.map(g => g.id === selectedGoal.id ? updated : g))
    localStorage.setItem(`vb_options_${selectedGoal.id}`, JSON.stringify({ options, chosen: idx }))
    toast.success('Vision locked in!')
  }

  const sendEmail = async () => {
    if (!profile?.email || chosenIdx === null || sendingEmail) return
    const chosen = options[chosenIdx]
    setSendingEmail(true)
    await fetch('/api/email/vision-art', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: profile.email, imageUrl: chosen.imageUrl, goalTitle: selectedGoal?.title }) })
    setEmailSent(true); setSendingEmail(false)
    toast.success('Sent to your email!')
  }

  const download = () => {
    const isPro = profile?.plan === 'pro' || profile?.plan === 'pro_trial'
    if (!isPro) { toast.error('Download is a Pro feature'); return }
    const url = chosenIdx !== null ? options[chosenIdx]?.imageUrl : selectedGoal?.art_image_url
    if (url) window.open(url, '_blank')
  }

  if (loading) return <div className="text-[#999] text-[14px]">Loading...</div>
  if (!selectedGoal) return (
    <div className="fade-up">
      <h1 className="font-serif text-[32px] mb-1">Vision Art</h1>
      <p className="text-[14px] text-[#666] mb-6">Create a goal to generate your vision art.</p>
      <Link href="/onboarding" className="inline-block px-5 py-2.5 bg-[#111] text-white rounded-xl text-[13px] font-medium">Create goal →</Link>
    </div>
  )

  const isPro = profile?.plan === 'pro' || profile?.plan === 'pro_trial'
  const hasChosen = chosenIdx !== null && options[chosenIdx]
  const chosenImage = hasChosen ? options[chosenIdx] : null

  return (
    <div className="fade-up max-w-[960px]">
      {/* Header */}
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-[32px] mb-1">Vision Art & Print Shop</h1>
          <p className="text-[14px] text-[#666]">{selectedGoal.user_city ? `Personalised for you in ${selectedGoal.user_city}` : 'AI-generated art for your goal'}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {hasChosen && isPro && <button onClick={download} className="flex items-center gap-2 px-4 py-2.5 border border-[#e8e8e8] bg-white rounded-xl text-[13px] font-medium hover:bg-[#f8f7f5]"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Download</button>}
          {hasChosen && !emailSent && <button onClick={sendEmail} disabled={sendingEmail} className="flex items-center gap-2 px-4 py-2.5 border border-[#e8e8e8] bg-white rounded-xl text-[13px] font-medium hover:bg-[#f8f7f5] disabled:opacity-50">{sendingEmail ? 'Sending...' : '✉ Email to me'}</button>}
          {emailSent && <span className="px-4 py-2.5 text-[13px] text-green-600 font-medium">✓ Sent!</span>}
          <button onClick={generate} disabled={generating} className="flex items-center gap-2 px-4 py-2.5 bg-[#111] text-white rounded-xl text-[13px] font-medium hover:bg-[#2a2a2a] disabled:opacity-50">
            {generating ? <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full spin-anim"/>Generating...</> : options.length > 0 ? 'Regenerate ↺' : '✦ Generate vision art'}
          </button>
        </div>
      </div>

      {/* Goal tabs */}
      {goals.length > 1 && (
        <div className="flex gap-2 mb-5 flex-wrap">
          {goals.map(g => (
            <button key={g.id} onClick={() => selectGoal(g)} className={`px-4 py-2 rounded-full text-[13px] border transition-all ${selectedGoal?.id === g.id ? 'bg-[#111] text-white border-[#111]' : 'bg-white text-[#666] border-[#e8e8e8] hover:border-[#d0d0d0]'}`}>
              {g.title.slice(0, 30)}{g.title.length > 30 ? '…' : ''}
            </button>
          ))}
        </div>
      )}

      {/* Tabs: Art / Print */}
      <div className="flex gap-1 p-1 bg-[#f2f0ec] rounded-xl mb-5 w-fit">
        <button onClick={() => setTab('art')} className={`px-5 py-2 rounded-lg text-[13px] font-medium transition-all ${tab === 'art' ? 'bg-white shadow-sm text-[#111]' : 'text-[#666]'}`}>✦ Vision Art</button>
        <button onClick={() => setTab('print')} className={`px-5 py-2 rounded-lg text-[13px] font-medium transition-all ${tab === 'print' ? 'bg-white shadow-sm text-[#111]' : 'text-[#666]'}`}>🖼 Print Shop</button>
      </div>

      {/* ART TAB */}
      {tab === 'art' && (
        <>
          {generating && (
            <div className="rounded-2xl bg-gradient-to-br from-[#0d1117] to-[#1a2332] p-12 text-center mb-6">
              <div className="w-12 h-12 border-2 border-white/10 border-t-[#b8922a] rounded-full spin-anim mx-auto mb-6"/>
              <p className="font-serif italic text-white/60 text-[20px] mb-3">Creating 3 personalised visions...</p>
              <p className="text-white/30 text-[13px] max-w-[320px] mx-auto leading-[1.7]">Claude is writing scene concepts for your goal, then generating each image</p>
            </div>
          )}

          {!generating && options.length > 0 && (
            <>
              {/* Separator */}
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-[#e8e8e8]"/>
                <p className="text-[11px] font-bold tracking-[.14em] uppercase text-[#999]">{chosenIdx === null ? '✦ Choose your vision' : '✦ Suggested visions'}</p>
                <div className="h-px flex-1 bg-[#e8e8e8]"/>
              </div>

              <div className={`grid gap-4 mb-6 ${options.length === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
                {options.map((opt, i) => (
                  <div key={i} onClick={() => chooseOption(i)}
                    className={`rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 ${chosenIdx === i ? 'ring-4 ring-[#b8922a] shadow-2xl scale-[1.02]' : chosenIdx !== null ? 'opacity-40 hover:opacity-60' : 'hover:shadow-xl hover:scale-[1.01]'}`}>
                    <div className="relative" style={{ aspectRatio: '3/4' }}>
                      {opt.imageUrl ? <img src={opt.imageUrl} alt={opt.label} className="w-full h-full object-cover"/> : <div className="w-full h-full bg-[#f0ede8] flex items-center justify-center"><p className="text-[#999] text-[13px]">Unavailable</p></div>}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-4">
                        <p className="font-serif italic text-white text-[16px] leading-tight">{opt.label}</p>
                        <p className="text-white/50 text-[11px] mt-1">{opt.description}</p>
                      </div>
                      {chosenIdx === i && <div className="absolute top-3 right-3 bg-[#b8922a] text-white text-[11px] font-bold px-3 py-1.5 rounded-full">✓ Selected</div>}
                      {chosenIdx === null && <div className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white text-[13px] font-bold">{String.fromCharCode(65 + i)}</div>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Chosen art detail */}
              {chosenImage && (
                <>
                  <div className="flex items-center gap-3 my-5">
                    <div className="h-px flex-1 bg-[#e8e8e8]"/>
                    <p className="text-[11px] font-bold tracking-[.14em] uppercase text-[#b8922a]">✦ Your chosen vision</p>
                    <div className="h-px flex-1 bg-[#e8e8e8]"/>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-2xl overflow-hidden shadow-2xl" style={{ aspectRatio: '4/5' }}>
                      <img src={chosenImage.imageUrl} alt={chosenImage.label} className="w-full h-full object-cover"/>
                    </div>
                    <div className="space-y-4">
                      <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5">
                        <p className="text-[10px] font-medium tracking-[.12em] uppercase text-[#b8922a] mb-2">Your chosen vision</p>
                        <p className="font-serif italic text-[22px] leading-tight mb-2">{chosenImage.label}</p>
                        <p className="text-[13px] text-[#666] leading-[1.65]">{chosenImage.description}</p>
                      </div>
                      <div className="bg-[#faf3e0] border border-[#b8922a]/20 rounded-2xl p-5">
                        <p className="text-[10px] font-medium tracking-[.12em] uppercase text-[#b8922a] mb-2">Daily affirmation</p>
                        <p className="font-serif italic text-[15px] text-[#111] leading-[1.65]">"{selectedGoal.affirmation}"</p>
                      </div>
                      <button onClick={() => setTab('print')} className="w-full py-3 border-2 border-dashed border-[#b8922a]/40 text-[#b8922a] text-[13px] font-medium rounded-2xl hover:border-[#b8922a] transition-colors">
                        🖼 Order a print of this →
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {!generating && options.length === 0 && (
            <div className="rounded-2xl border-2 border-dashed border-[#e8e8e8] p-16 text-center">
              <p className="text-[48px] mb-4">✦</p>
              <p className="font-serif text-[20px] mb-2">Your vision awaits</p>
              <p className="text-[13px] text-[#999] max-w-[280px] mx-auto mb-6 leading-[1.7]">Generate 3 personalised AI images for your goal — choose the one that calls to you</p>
              <button onClick={generate} disabled={generating} className="px-6 py-3 bg-[#111] text-white rounded-xl text-[13px] font-medium hover:bg-[#2a2a2a] transition-colors">✦ Generate my vision art</button>
            </div>
          )}
        </>
      )}

      {/* PRINT TAB */}
      {tab === 'print' && (
        <div>
          {!selectedGoal?.art_image_url && !hasChosen && (
            <div className="bg-[#faf3e0] border border-[#b8922a]/20 rounded-2xl p-4 mb-5 flex items-center gap-3">
              <span className="text-[20px]">✦</span>
              <div>
                <p className="text-[13px] font-medium text-[#b8922a]">Generate your vision art first</p>
                <p className="text-[12px] text-[#999]">Choose a vision from the Art tab, then order a print</p>
              </div>
              <button onClick={() => setTab('art')} className="ml-auto px-3 py-1.5 bg-[#b8922a] text-white rounded-xl text-[12px] font-medium flex-shrink-0">Create art →</button>
            </div>
          )}

          {(selectedGoal?.art_image_url || hasChosen) && (
            <div className="flex items-start gap-4 bg-[#111] rounded-2xl p-4 mb-5">
              <img src={hasChosen ? options[chosenIdx!]?.imageUrl : selectedGoal.art_image_url} alt="" className="w-20 h-24 object-cover rounded-xl flex-shrink-0"/>
              <div>
                <p className="text-[11px] text-white/40 uppercase tracking-[.1em] mb-1">Printing this vision</p>
                <p className="font-serif italic text-white text-[16px]">{hasChosen ? options[chosenIdx!]?.label : selectedGoal.art_title || selectedGoal.title}</p>
                <p className="text-[12px] text-white/40 mt-1">{selectedGoal.title}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {PRINT_PRODUCTS.map(p => (
              <div key={p.type} className={`bg-white rounded-2xl p-6 text-center relative ${p.featured ? 'border-2 border-[#111]' : 'border border-[#e8e8e8]'}`}>
                {p.featured && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#111] text-white text-[10px] font-medium px-3 py-1 rounded-full whitespace-nowrap">Most popular</div>}
                <div className="w-12 h-16 bg-[#1a1a2e] rounded-lg mx-auto mb-4 flex items-center justify-center text-[18px] text-white/20 font-serif">✦</div>
                <p className="font-medium text-[16px] mb-0.5">{p.type}</p>
                <p className="text-[13px] text-[#999] mb-1">{p.size}</p>
                <p className="text-[12px] text-[#999] mb-4 leading-[1.5]">{p.desc}</p>
                <p className="font-serif text-[36px] mb-4">{p.price}</p>
                <button onClick={() => { setPrintOrdered(prev => [...prev, p.type]); toast.success(`${p.type} ordered! Stripe integration connects your Printful account for fulfillment.`) }}
                  disabled={printOrdered.includes(p.type)}
                  className={`w-full py-2.5 rounded-xl text-[13px] font-medium transition-colors ${printOrdered.includes(p.type) ? 'bg-green-50 text-green-700 border border-green-200' : p.featured ? 'bg-[#111] text-white hover:bg-[#2a2a2a]' : 'border border-[#d0d0d0] hover:bg-[#f8f7f5]'}`}>
                  {printOrdered.includes(p.type) ? '✓ Ordered!' : 'Order now'}
                </button>
              </div>
            ))}
          </div>
          <div className="bg-[#f8f7f5] border border-[#e8e8e8] rounded-2xl p-5 flex gap-4 items-start">
            <span className="text-[20px]">🌟</span>
            <div>
              <p className="font-medium text-[14px] mb-1">Automated print fulfillment</p>
              <p className="text-[13px] text-[#666] leading-[1.65]">Connect Printful or Gelato to your Stripe checkout. When someone orders, the print is produced and shipped automatically.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}