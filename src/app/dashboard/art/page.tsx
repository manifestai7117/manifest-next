'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import toast from 'react-hot-toast'

export default function ArtPage() {
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

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ data: gs }, { data: prof }] = await Promise.all([
        supabase.from('goals').select('*').eq('user_id', user.id).eq('is_active', true).order('created_at', { ascending: false }),
        supabase.from('profiles').select('*').eq('id', user.id).single(),
      ])
      setGoals(gs || [])
      setProfile(prof)
      const savedId = typeof window !== 'undefined' ? localStorage.getItem('selectedGoalId') : null
      const g = gs?.find((x: any) => x.id === savedId) || gs?.[0] || null
      if (g) {
        setSelectedGoal(g)
        // Restore cached options
        const cached = typeof window !== 'undefined' ? localStorage.getItem(`vb_options_${g.id}`) : null
        if (cached) try { const parsed = JSON.parse(cached); setOptions(parsed.options || []); setChosenIdx(parsed.chosen ?? null) } catch {}
      }
      setLoading(false)
    }
    load()
  }, [])

  const selectGoal = (g: any) => {
    setSelectedGoal(g)
    setOptions([])
    setChosenIdx(null)
    localStorage.setItem('selectedGoalId', g.id)
    const cached = localStorage.getItem(`vb_options_${g.id}`)
    if (cached) try { const parsed = JSON.parse(cached); setOptions(parsed.options || []); setChosenIdx(parsed.chosen ?? null) } catch {}
  }

  const generate = async () => {
    if (!selectedGoal || generating) return
    setGenerating(true)
    setOptions([])
    setChosenIdx(null)
    setEmailSent(false)
    try {
      const res = await fetch('/api/vision-art/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalId: selectedGoal.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setOptions(data.options || [])
      localStorage.setItem(`vb_options_${selectedGoal.id}`, JSON.stringify({ options: data.options, chosen: null }))
      toast.success(`${data.options.length} vision options generated!`)
    } catch (e: any) {
      toast.error(e.message || 'Generation failed')
    }
    setGenerating(false)
  }

  const chooseOption = async (idx: number) => {
    setChosenIdx(idx)
    const chosen = options[idx]
    if (!chosen?.imageUrl) return

    // Save chosen image to goal
    const newCount = (selectedGoal.vision_board_regenerations || 0) + 1
    await supabase.from('goals').update({
      art_image_url: chosen.imageUrl,
      vision_board_regenerations: newCount,
      vision_board_last_generated: new Date().toISOString(),
    }).eq('id', selectedGoal.id)

    const updated = { ...selectedGoal, art_image_url: chosen.imageUrl, vision_board_regenerations: newCount }
    setSelectedGoal(updated)
    setGoals(gs => gs.map(g => g.id === selectedGoal.id ? updated : g))
    localStorage.setItem(`vb_options_${selectedGoal.id}`, JSON.stringify({ options, chosen: idx }))
    toast.success('Vision art saved!')
  }

  const sendEmail = async () => {
    if (!profile?.email || chosenIdx === null || sendingEmail) return
    setSendingEmail(true)
    const chosen = options[chosenIdx]
    try {
      await fetch('/api/email/vision-art', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: profile.email,
          name: profile.full_name,
          imageUrl: chosen.imageUrl,
          goalTitle: selectedGoal.title,
          affirmation: selectedGoal.affirmation,
          label: chosen.label,
        }),
      })
      setEmailSent(true)
      toast.success(`Vision art sent to ${profile.email}!`)
    } catch { toast.error('Email failed') }
    setSendingEmail(false)
  }

  const download = () => {
    const isPro = profile?.plan === 'pro' || profile?.plan === 'pro_trial'
    if (!isPro) { toast.error('Download is a Pro feature'); return }
    const chosen = chosenIdx !== null ? options[chosenIdx] : null
    const url = chosen?.imageUrl || selectedGoal?.art_image_url
    if (!url) return
    window.open(url, '_blank')
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
          <h1 className="font-serif text-[32px] mb-1">Vision Art</h1>
          <p className="text-[14px] text-[#666]">
            {selectedGoal.user_city ? `Personalised for you in ${selectedGoal.user_city}` : 'AI-generated art for your goal'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {hasChosen && isPro && (
            <button onClick={download} className="flex items-center gap-2 px-4 py-2.5 border border-[#e8e8e8] bg-white rounded-xl text-[13px] font-medium hover:bg-[#f8f7f5] transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download
            </button>
          )}
          {hasChosen && !emailSent && (
            <button onClick={sendEmail} disabled={sendingEmail}
              className="flex items-center gap-2 px-4 py-2.5 border border-[#e8e8e8] bg-white rounded-xl text-[13px] font-medium hover:bg-[#f8f7f5] transition-colors disabled:opacity-50">
              {sendingEmail ? 'Sending...' : '✉ Email to me'}
            </button>
          )}
          {emailSent && <span className="px-4 py-2.5 text-[13px] text-green-600 font-medium">✓ Sent to {profile?.email}</span>}
          <button onClick={generate} disabled={generating}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#111] text-white rounded-xl text-[13px] font-medium hover:bg-[#2a2a2a] transition-colors disabled:opacity-50">
            {generating
              ? <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full spin-anim"/>Generating 3 options...</>
              : options.length > 0
                ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>Regenerate</>
                : <>✦ Generate my vision art</>
            }
          </button>
        </div>
      </div>

      {/* Goal tabs */}
      {goals.length > 1 && (
        <div className="flex gap-2 mb-5 flex-wrap">
          {goals.map(g => (
            <button key={g.id} onClick={() => selectGoal(g)}
              className={`px-4 py-2 rounded-full text-[13px] border transition-all ${selectedGoal?.id === g.id ? 'bg-[#111] text-white border-[#111]' : 'bg-white text-[#666] border-[#e8e8e8] hover:border-[#d0d0d0]'}`}>
              {(g.display_title || g.title).slice(0, 28)}{(g.display_title || g.title).length > 28 ? '…' : ''}
            </button>
          ))}
        </div>
      )}

      {/* Generating state */}
      {generating && (
        <div className="rounded-2xl bg-gradient-to-br from-[#0d1117] to-[#1a2332] p-12 text-center mb-6">
          <div className="w-12 h-12 border-2 border-white/10 border-t-[#b8922a] rounded-full spin-anim mx-auto mb-6"/>
          <p className="font-serif italic text-white/60 text-[20px] mb-3">Creating 3 personalised visions...</p>
          <p className="text-white/30 text-[13px] max-w-[320px] mx-auto leading-[1.7]">
            Claude is writing scene concepts specific to your goal{selectedGoal.user_city ? ` in ${selectedGoal.user_city}` : ''}, then generating each image
          </p>
          <div className="flex justify-center gap-6 mt-6">
            {['Concept 1', 'Concept 2', 'Concept 3'].map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#b8922a] opacity-60" style={{ animationDelay: `${i * 0.3}s` }}/>
                <span className="text-white/30 text-[12px]">{c}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3 Options grid */}
      {!generating && options.length > 0 && (
        <div>
          {chosenIdx === null && (
            <p className="text-[14px] text-[#666] mb-4 font-medium">Choose the vision that resonates most with you:</p>
          )}
          <div className={`grid gap-4 mb-6 ${options.length === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
            {options.map((opt, i) => (
              <div key={i}
                onClick={() => chooseOption(i)}
                className={`rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 ${
                  chosenIdx === i
                    ? 'ring-4 ring-[#b8922a] shadow-2xl scale-[1.02]'
                    : chosenIdx !== null
                      ? 'opacity-40 hover:opacity-60'
                      : 'hover:shadow-xl hover:scale-[1.01]'
                }`}>
                {/* Image */}
                <div className="relative" style={{ aspectRatio: '3/4' }}>
                  {opt.imageUrl ? (
                    <img src={opt.imageUrl} alt={opt.label} className="w-full h-full object-cover"/>
                  ) : (
                    <div className="w-full h-full bg-[#f0ede8] flex items-center justify-center">
                      <p className="text-[#999] text-[13px]">Image unavailable</p>
                    </div>
                  )}
                  {/* Label overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-4">
                    <p className="font-serif italic text-white text-[16px] leading-tight">{opt.label}</p>
                    <p className="text-white/50 text-[11px] mt-1">{opt.description}</p>
                  </div>
                  {/* Chosen badge */}
                  {chosenIdx === i && (
                    <div className="absolute top-3 right-3 bg-[#b8922a] text-white text-[11px] font-bold px-3 py-1.5 rounded-full">
                      ✓ Selected
                    </div>
                  )}
                  {/* Option letter */}
                  {chosenIdx === null && (
                    <div className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white text-[13px] font-bold">
                      {String.fromCharCode(65 + i)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Chosen image detail view */}
          {chosenImage && (
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
                <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5">
                  <p className="text-[10px] font-medium tracking-[.12em] uppercase text-[#b8922a] mb-3">Your goal</p>
                  <p className="font-medium text-[15px] mb-2">{selectedGoal.title}</p>
                  <div className="flex gap-2 flex-wrap">
                    <span className="text-[11px] font-medium text-[#b8922a] bg-[#faf3e0] px-2.5 py-1 rounded-full">{selectedGoal.timeline}</span>
                    {selectedGoal.user_city && <span className="text-[11px] font-medium text-[#666] bg-[#f2f0ec] px-2.5 py-1 rounded-full">📍 {selectedGoal.user_city}</span>}
                  </div>
                </div>
                {!isPro && (
                  <p className="text-[12px] text-[#999] bg-white border border-[#e8e8e8] rounded-xl p-3 text-center">
                    <Link href="/dashboard/upgrade" className="text-[#b8922a] hover:underline font-medium">Upgrade to Pro</Link> to download your art in full resolution
                  </p>
                )}
                <button onClick={() => { setChosenIdx(null) }}
                  className="w-full py-2.5 border border-[#e8e8e8] rounded-xl text-[13px] text-[#666] hover:bg-[#f8f7f5] transition-colors">
                  ← See all options again
                </button>
                <Link href="/dashboard/print" className="block w-full py-3 bg-[#b8922a] text-white rounded-xl text-[13px] font-medium text-center hover:bg-[#9a7820] transition-colors">
                  Order a print →
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!generating && options.length === 0 && (
        <div className="rounded-2xl bg-gradient-to-br from-[#0d1117] to-[#1a2332] flex flex-col items-center justify-center text-center p-12" style={{ minHeight: '480px' }}>
          <div className="text-[56px] mb-5 opacity-15 font-serif">✦</div>
          <p className="font-serif italic text-white/60 text-[20px] mb-3">{selectedGoal.art_title || 'Your vision awaits'}</p>
          <p className="text-white/30 text-[13px] leading-[1.7] mb-2 max-w-[300px]">
            We'll generate <strong className="text-white/50">3 different interpretations</strong> of your goal as stunning imagery
          </p>
          {selectedGoal.user_city && (
            <p className="text-[#b8922a]/60 text-[12px] mb-6">📍 Personalised for {selectedGoal.user_city}</p>
          )}
          <div className="flex gap-4 mb-8 text-[12px] text-white/25">
            <span>A · Achievement scene</span>
            <span>B · Your city</span>
            <span>C · Symbolic</span>
          </div>
          <button onClick={generate} className="px-8 py-3.5 bg-[#b8922a] text-white rounded-xl text-[14px] font-medium hover:bg-[#9a7820] transition-colors">
            ✦ Generate my 3 visions
          </button>
          <p className="text-white/20 text-[11px] mt-3">Takes ~30 seconds · pick your favourite · email it to yourself</p>
        </div>
      )}

      {/* Existing art if no options generated yet */}
      {!generating && options.length === 0 && selectedGoal.art_image_url && (
        <div className="mt-6">
          <p className="text-[12px] text-[#999] mb-3">Previously generated:</p>
          <div className="rounded-2xl overflow-hidden shadow-xl" style={{ maxWidth: '300px', aspectRatio: '4/5' }}>
            <img src={selectedGoal.art_image_url} alt="" className="w-full h-full object-cover"/>
          </div>
        </div>
      )}
    </div>
  )
}