'use client'
import { useState, useEffect, useRef } from 'react'
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

  // Selfie state
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null)
  const [selfiePermission, setSelfiePermission] = useState(false)
  const [uploadingSelfie, setUploadingSelfie] = useState(false)
  const [showSelfiePanel, setShowSelfiePanel] = useState(false)
  const selfieRef = useRef<HTMLInputElement>(null)

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
        loadGoalArt(g)
      }
      setLoading(false)
    }
    load()
  }, [])

  // Load saved art options from DB (persists across refreshes)
  const loadGoalArt = (g: any) => {
    setSelfieUrl(g.selfie_url || null)
    setSelfiePermission(g.selfie_permission || false)

    // Try DB-stored options first (most reliable)
    if (g.vision_options) {
      try {
        const saved = JSON.parse(g.vision_options)
        if (Array.isArray(saved) && saved.length > 0) {
          setOptions(saved)
          setChosenIdx(g.vision_chosen_idx ?? null)
          return
        }
      } catch {}
    }
    // Fall back to localStorage cache
    const cached = localStorage.getItem(`vb_options_${g.id}`)
    if (cached) {
      try {
        const p = JSON.parse(cached)
        setOptions(p.options || [])
        setChosenIdx(p.chosen ?? null)
      } catch {}
    }
  }

  const selectGoal = (g: any) => {
    setSelectedGoal(g)
    setOptions([])
    setChosenIdx(null)
    setEmailSent(false)
    loadGoalArt(g)
    localStorage.setItem('selectedGoalId', g.id)
  }

  const handleSelfie = async (file: File) => {
    if (uploadingSelfie) return
    setUploadingSelfie(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('context', 'selfie')
      const res = await fetch('/api/media', { method: 'POST', body: form })
      const d = await res.json()
      if (!res.ok) { toast.error(d.error || 'Upload failed'); setUploadingSelfie(false); return }
      setSelfieUrl(d.url)
      toast.success('Photo uploaded!')
    } catch { toast.error('Upload failed') }
    setUploadingSelfie(false)
  }

  const saveSelfieToGoal = async () => {
    if (!selectedGoal || !selfieUrl) return
    await supabase.from('goals').update({ selfie_url: selfieUrl, selfie_permission: selfiePermission }).eq('id', selectedGoal.id)
    setSelectedGoal((prev: any) => ({ ...prev, selfie_url: selfieUrl, selfie_permission: selfiePermission }))
    setShowSelfiePanel(false)
    toast.success(selfiePermission ? 'Photo saved — will be used in vision art' : 'Photo saved')
  }

  const generate = async () => {
    if (!selectedGoal || generating) return
    setGenerating(true)
    setOptions([])
    setChosenIdx(null)

    const res = await fetch('/api/vision-art/options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goalId: selectedGoal.id }),
    })
    const data = await res.json()

    if (res.ok && data.options?.length > 0) {
      const validOptions = data.options.filter((o: any) => o.imageUrl)
      setOptions(data.options)
      // DB is already saved by the API route (with permanent URLs)
      // Also save to localStorage as backup
      localStorage.setItem(`vb_options_${selectedGoal.id}`, JSON.stringify({ options: data.options, chosen: null }))
      // Update local goal state
      setSelectedGoal((prev: any) => ({ ...prev, vision_options: JSON.stringify(data.options), vision_chosen_idx: null }))
      if (validOptions.length === 3) {
        toast.success('3 visions ready! Choose your favourite.')
      } else if (validOptions.length > 0) {
        toast.success(`${validOptions.length}/3 visions ready — click Regenerate to retry any unavailable ones`)
      } else {
        toast.error('Generation failed — please try again')
      }
    } else {
      toast.error(data.error || 'Generation failed — please try again')
    }
    setGenerating(false)
  }

  const chooseOption = async (idx: number) => {
    if (!selectedGoal) return
    const chosen = options[idx]
    if (!chosen?.imageUrl) { toast.error('This image is unavailable — please regenerate'); return }
    setChosenIdx(idx)
    const newCount = (selectedGoal.vision_board_regenerations || 0) + 1
    await supabase.from('goals').update({
      art_image_url: chosen.imageUrl,
      art_title: chosen.label,
      vision_board_regenerations: newCount,
      vision_chosen_idx: idx,
    }).eq('id', selectedGoal.id)
    const updated = { ...selectedGoal, art_image_url: chosen.imageUrl, art_title: chosen.label, vision_board_regenerations: newCount, vision_chosen_idx: idx }
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
  const hasChosen = chosenIdx !== null && options[chosenIdx]?.imageUrl
  const chosenImage = hasChosen ? options[chosenIdx!] : null
  const hasSelfie = !!(selfieUrl && selfiePermission)

  return (
    <div className="fade-up max-w-[960px]">
      {/* Header */}
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-[32px] mb-1">Vision Art & Print Shop</h1>
          <p className="text-[14px] text-[#666]">
            {hasSelfie ? '✦ Personalised with your photo' : selectedGoal.user_city ? `Personalised for ${selectedGoal.user_city}` : 'AI-generated art for your goal'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {hasChosen && isPro && (
            <button onClick={download} className="flex items-center gap-2 px-4 py-2.5 border border-[#e8e8e8] bg-white rounded-xl text-[13px] font-medium hover:bg-[#f8f7f5]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download
            </button>
          )}
          {hasChosen && !emailSent && (
            <button onClick={sendEmail} disabled={sendingEmail} className="flex items-center gap-2 px-4 py-2.5 border border-[#e8e8e8] bg-white rounded-xl text-[13px] font-medium hover:bg-[#f8f7f5] disabled:opacity-50">
              {sendingEmail ? 'Sending...' : '✉ Email to me'}
            </button>
          )}
          {emailSent && <span className="px-4 py-2.5 text-[13px] text-green-600 font-medium">✓ Sent!</span>}
          <button onClick={generate} disabled={generating} className="flex items-center gap-2 px-4 py-2.5 bg-[#111] text-white rounded-xl text-[13px] font-medium hover:bg-[#2a2a2a] disabled:opacity-50">
            {generating
              ? <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full spin-anim"/>Generating...</>
              : options.length > 0 ? 'Regenerate ↺' : '✦ Generate vision art'}
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

      {/* Selfie panel */}
      <div className="bg-white border border-[#e8e8e8] rounded-2xl p-4 mb-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {selfieUrl
              ? <img src={selfieUrl} alt="Your photo" className="w-10 h-10 rounded-full object-cover border-2 border-[#b8922a]/30"/>
              : <div className="w-10 h-10 rounded-full bg-[#f2f0ec] flex items-center justify-center text-[20px]">📸</div>
            }
            <div>
              <p className="text-[13px] font-medium">{hasSelfie ? 'Your photo is used in vision art' : 'Make the art look like you'}</p>
              <p className="text-[11px] text-[#999]">{hasSelfie ? 'AI includes your likeness' : 'Upload a selfie to personalise'}</p>
            </div>
          </div>
          <button onClick={() => setShowSelfiePanel(!showSelfiePanel)} className="px-3 py-1.5 border border-[#e8e8e8] rounded-xl text-[12px] text-[#666] hover:bg-[#f8f7f5] transition-colors">
            {showSelfiePanel ? 'Close' : hasSelfie ? 'Change' : 'Add photo'}
          </button>
        </div>
        {showSelfiePanel && (
          <div className="mt-4 pt-4 border-t border-[#f0ede8]">
            <input ref={selfieRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleSelfie(f); e.target.value = '' }}/>
            {selfieUrl ? (
              <div className="flex items-start gap-4">
                <div className="relative">
                  <img src={selfieUrl} alt="" className="w-20 h-20 rounded-2xl object-cover"/>
                  {uploadingSelfie && <div className="absolute inset-0 rounded-2xl bg-black/40 flex items-center justify-center"><span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full spin-anim"/></div>}
                </div>
                <div className="flex-1">
                  <div className="bg-[#faf3e0] border border-[#b8922a]/20 rounded-xl p-3 mb-3">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input type="checkbox" checked={selfiePermission} onChange={e => setSelfiePermission(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#b8922a]"/>
                      <span className="text-[12px] text-[#666] leading-[1.5]">I allow my photo to be used for AI vision art generation. It will not be shared publicly.</span>
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={saveSelfieToGoal} disabled={uploadingSelfie} className="px-4 py-2 bg-[#111] text-white rounded-xl text-[12px] font-medium hover:bg-[#2a2a2a] disabled:opacity-40 transition-colors">Save</button>
                    <button onClick={() => selfieRef.current?.click()} className="px-4 py-2 border border-[#e8e8e8] rounded-xl text-[12px] text-[#666] hover:bg-[#f8f7f5] transition-colors">Change</button>
                    <button onClick={async () => { setSelfieUrl(null); setSelfiePermission(false); await supabase.from('goals').update({ selfie_url: null, selfie_permission: false }).eq('id', selectedGoal.id) }} className="px-4 py-2 border border-red-100 text-red-400 rounded-xl text-[12px] hover:bg-red-50 transition-colors">Remove</button>
                  </div>
                </div>
              </div>
            ) : (
              <button onClick={() => selfieRef.current?.click()} disabled={uploadingSelfie}
                className="w-full py-4 border-2 border-dashed border-[#e8e8e8] rounded-2xl flex flex-col items-center gap-2 hover:border-[#b8922a]/40 transition-colors">
                <div className="text-[28px]">📸</div>
                <p className="text-[13px] font-medium">Upload a selfie or photo</p>
                <p className="text-[11px] text-[#999]">JPG, PNG or WebP — max 10MB</p>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Art / Print tabs */}
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
              {hasSelfie && <p className="text-[#b8922a] text-[12px] mb-3">✦ Including your photo</p>}
              <p className="text-white/30 text-[13px] max-w-[320px] mx-auto leading-[1.7]">Writing scene concepts, then generating each image</p>
            </div>
          )}

          {!generating && options.length > 0 && (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-[#e8e8e8]"/>
                <p className="text-[11px] font-bold tracking-[.14em] uppercase text-[#999]">{chosenIdx === null ? '✦ Choose your vision' : '✦ Suggested visions'}</p>
                <div className="h-px flex-1 bg-[#e8e8e8]"/>
              </div>

              {/* Portrait grid — 3 columns, portrait aspect ratio */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                {options.map((opt, i) => (
                  <div key={i} onClick={() => opt.imageUrl ? chooseOption(i) : toast.error('Image unavailable — please regenerate')}
                    className={`rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 ${chosenIdx === i ? 'ring-4 ring-[#b8922a] shadow-2xl scale-[1.02]' : chosenIdx !== null ? 'opacity-50 hover:opacity-70' : 'hover:shadow-xl hover:scale-[1.01]'}`}>
                    {/* Portrait aspect ratio 2:3 */}
                    <div className="relative" style={{ aspectRatio: '2/3' }}>
                      {opt.imageUrl ? (
                        <img
                          src={opt.imageUrl}
                          alt={opt.label}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // Image failed to load — show unavailable state
                            const target = e.target as HTMLImageElement
                            target.style.display = 'none'
                            target.nextElementSibling?.classList.remove('hidden')
                          }}
                        />
                      ) : null}
                      {/* Fallback for broken/missing images */}
                      <div className={`${opt.imageUrl ? 'hidden' : 'flex'} absolute inset-0 bg-[#1a1a2e] items-center justify-center flex-col gap-2`}>
                        <p className="text-white/40 text-[13px]">Unavailable</p>
                        <button onClick={(e) => { e.stopPropagation(); generate() }} className="text-[11px] text-[#b8922a] underline">Regenerate</button>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-3">
                        <p className="font-serif italic text-white text-[14px] leading-tight">{opt.label}</p>
                        <p className="text-white/50 text-[10px] mt-0.5 line-clamp-2">{opt.description}</p>
                      </div>
                      {chosenIdx === i && <div className="absolute top-2 right-2 bg-[#b8922a] text-white text-[10px] font-bold px-2 py-1 rounded-full">✓ Selected</div>}
                      {chosenIdx === null && <div className="absolute top-2 left-2 w-7 h-7 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white text-[12px] font-bold">{String.fromCharCode(65 + i)}</div>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Chosen detail */}
              {chosenImage && (
                <>
                  <div className="flex items-center gap-3 my-5">
                    <div className="h-px flex-1 bg-[#e8e8e8]"/>
                    <p className="text-[11px] font-bold tracking-[.14em] uppercase text-[#b8922a]">✦ Your chosen vision</p>
                    <div className="h-px flex-1 bg-[#e8e8e8]"/>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Portrait image */}
                    <div className="rounded-2xl overflow-hidden shadow-2xl mx-auto w-full max-w-[300px]" style={{ aspectRatio: '2/3' }}>
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
                        🖼 Order a print →
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
              <p className="text-[13px] text-[#999] max-w-[280px] mx-auto mb-6 leading-[1.7]">
                Generate 3 personalised AI portrait images for your goal{hasSelfie ? ' — featuring your likeness' : ''}
              </p>
              <button onClick={generate} className="px-6 py-3 bg-[#111] text-white rounded-xl text-[13px] font-medium hover:bg-[#2a2a2a] transition-colors">✦ Generate my vision art</button>
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
              <img src={hasChosen ? options[chosenIdx!]?.imageUrl : selectedGoal.art_image_url} alt="" className="w-16 h-24 object-cover rounded-xl flex-shrink-0"/>
              <div>
                <p className="text-[11px] text-white/40 uppercase tracking-[.1em] mb-1">Printing this vision</p>
                <p className="font-serif italic text-white text-[16px]">{hasChosen ? options[chosenIdx!]?.label : selectedGoal.art_title || selectedGoal.title}</p>
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
                <button onClick={() => { setPrintOrdered(prev => [...prev, p.type]); toast.success(`${p.type} ordered!`) }}
                  disabled={printOrdered.includes(p.type)}
                  className={`w-full py-2.5 rounded-xl text-[13px] font-medium transition-colors ${printOrdered.includes(p.type) ? 'bg-green-50 text-green-700 border border-green-200' : p.featured ? 'bg-[#111] text-white hover:bg-[#2a2a2a]' : 'border border-[#d0d0d0] hover:bg-[#f8f7f5]'}`}>
                  {printOrdered.includes(p.type) ? '✓ Ordered!' : 'Order now'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}