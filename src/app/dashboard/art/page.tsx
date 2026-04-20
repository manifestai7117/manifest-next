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
  const [visionImage, setVisionImage] = useState<{ label: string; description: string; imageUrl: string } | null>(null)
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'art'|'print'>('art')
  const [printOrdered, setPrintOrdered] = useState<string[]>([])
  const [emailSent, setEmailSent] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)

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
      if (g) loadSavedVision(g)
      setLoading(false)
    }
    load()
  }, [])

  const loadSavedVision = (g: any) => {
    if (g.vision_options) {
      try {
        const saved = JSON.parse(g.vision_options)
        if (Array.isArray(saved) && saved[0]?.imageUrl) {
          setVisionImage(saved[0])
          return
        }
      } catch {}
    }
    // Fall back to art_image_url
    if (g.art_image_url) {
      setVisionImage({ label: g.art_title || 'Your Vision', description: g.title, imageUrl: g.art_image_url })
    }
  }

  const selectGoal = (g: any) => {
    setSelectedGoal(g)
    setVisionImage(null)
    setEmailSent(false)
    loadSavedVision(g)
    localStorage.setItem('selectedGoalId', g.id)
  }

  const generate = async () => {
    if (!selectedGoal || generating) return
    setGenerating(true)
    setVisionImage(null)

    const res = await fetch('/api/vision-art/options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goalId: selectedGoal.id }),
    })
    const data = await res.json()

    if (res.ok && data.options?.[0]?.imageUrl) {
      setVisionImage(data.options[0])
      setSelectedGoal((prev: any) => ({ ...prev, vision_options: JSON.stringify(data.options), art_image_url: data.options[0].imageUrl, art_title: data.options[0].label }))
      setGoals(prev => prev.map(g => g.id === selectedGoal.id ? { ...g, art_image_url: data.options[0].imageUrl, art_title: data.options[0].label } : g))
      toast.success('Your vision is ready!')
    } else {
      toast.error(data.error || 'Generation failed — please try again')
    }
    setGenerating(false)
  }

  const download = () => {
    const isPro = profile?.plan === 'pro' || profile?.plan === 'pro_trial'
    if (!isPro) { toast.error('Download is a Pro feature'); return }
    if (visionImage?.imageUrl) window.open(visionImage.imageUrl, '_blank')
  }

  const sendEmail = async () => {
    if (!profile?.email || !visionImage || sendingEmail) return
    setSendingEmail(true)
    await fetch('/api/email/vision-art', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: profile.email, imageUrl: visionImage.imageUrl, goalTitle: selectedGoal?.title }) })
    setEmailSent(true); setSendingEmail(false)
    toast.success('Sent to your email!')
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

  return (
    <div className="fade-up max-w-[760px]">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-[32px] mb-1">Vision Art</h1>
          <p className="text-[14px] text-[#666]">
            {selectedGoal.user_city ? `Personalised for ${selectedGoal.user_city}` : 'AI-generated art for your goal'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {visionImage && isPro && (
            <button onClick={download} className="flex items-center gap-2 px-4 py-2.5 border border-[#e8e8e8] bg-white rounded-xl text-[13px] font-medium hover:bg-[#f8f7f5]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download
            </button>
          )}
          {visionImage && !emailSent && (
            <button onClick={sendEmail} disabled={sendingEmail} className="flex items-center gap-2 px-4 py-2.5 border border-[#e8e8e8] bg-white rounded-xl text-[13px] font-medium hover:bg-[#f8f7f5] disabled:opacity-50">
              {sendingEmail ? 'Sending...' : '✉ Email to me'}
            </button>
          )}
          {emailSent && <span className="px-4 py-2.5 text-[13px] text-green-600 font-medium">✓ Sent!</span>}
          <button onClick={generate} disabled={generating}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#111] text-white rounded-xl text-[13px] font-medium hover:bg-[#2a2a2a] disabled:opacity-50 transition-colors">
            {generating
              ? <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full spin-anim"/>Creating your vision...</>
              : visionImage ? '↺ Regenerate' : '✦ Generate vision art'}
          </button>
        </div>
      </div>

      {/* Goal selector */}
      {goals.length > 1 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          {goals.map(g => (
            <button key={g.id} onClick={() => selectGoal(g)}
              className={`px-4 py-2 rounded-full text-[13px] border transition-all ${selectedGoal?.id === g.id ? 'bg-[#111] text-white border-[#111]' : 'bg-white text-[#666] border-[#e8e8e8] hover:border-[#d0d0d0]'}`}>
              {g.title.slice(0, 30)}{g.title.length > 30 ? '…' : ''}
            </button>
          ))}
        </div>
      )}

      {/* Art / Print tabs */}
      <div className="flex gap-1 p-1 bg-[#f2f0ec] rounded-xl mb-6 w-fit">
        <button onClick={() => setTab('art')} className={`px-5 py-2 rounded-lg text-[13px] font-medium transition-all ${tab === 'art' ? 'bg-white shadow-sm text-[#111]' : 'text-[#666]'}`}>✦ Vision Art</button>
        <button onClick={() => setTab('print')} className={`px-5 py-2 rounded-lg text-[13px] font-medium transition-all ${tab === 'print' ? 'bg-white shadow-sm text-[#111]' : 'text-[#666]'}`}>🖼 Print Shop</button>
      </div>

      {/* ART TAB */}
      {tab === 'art' && (
        <>
          {/* Generating state */}
          {generating && (
            <div className="rounded-2xl bg-gradient-to-br from-[#0d1117] to-[#1a2332] p-16 text-center mb-6">
              <div className="w-12 h-12 border-2 border-white/10 border-t-[#b8922a] rounded-full spin-anim mx-auto mb-6"/>
              <p className="font-serif italic text-white/60 text-[22px] mb-3">Creating your vision...</p>
              <p className="text-white/30 text-[13px] max-w-[300px] mx-auto leading-[1.7]">
                Writing your scene, then generating a photorealistic image
              </p>
            </div>
          )}

          {/* Vision image */}
          {!generating && visionImage && (
            <div className="mb-6">
              {/* Full portrait image */}
              <div className="rounded-2xl overflow-hidden shadow-2xl mb-4" style={{ aspectRatio: '2/3', maxWidth: 420, margin: '0 auto 16px' }}>
                <img
                  src={visionImage.imageUrl}
                  alt={visionImage.label}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.style.display = 'none'
                    const parent = target.parentElement
                    if (parent) {
                      parent.innerHTML = '<div class="w-full h-full bg-[#1a1a2e] flex flex-col items-center justify-center gap-3"><p class="text-white/40 text-[15px]">Image unavailable</p><button onclick="window.location.reload()" class="text-[#b8922a] text-[13px] underline">Regenerate</button></div>'
                    }
                  }}
                />
              </div>

              {/* Vision info card */}
              <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 max-w-[420px] mx-auto">
                <p className="font-serif italic text-[20px] mb-2">{visionImage.label}</p>
                <p className="text-[13px] text-[#666] leading-[1.6] mb-4">{visionImage.description}</p>
                {selectedGoal.affirmation && (
                  <div className="bg-[#faf3e0] border border-[#b8922a]/20 rounded-xl p-3.5">
                    <p className="text-[10px] font-bold tracking-[.12em] uppercase text-[#b8922a] mb-1">Daily affirmation</p>
                    <p className="font-serif italic text-[14px] text-[#111] leading-[1.6]">"{selectedGoal.affirmation}"</p>
                  </div>
                )}
              </div>

              {/* Order print CTA */}
              <div className="mt-4 max-w-[420px] mx-auto">
                <button onClick={() => setTab('print')}
                  className="w-full py-3 border-2 border-dashed border-[#b8922a]/40 text-[#b8922a] text-[13px] font-medium rounded-2xl hover:border-[#b8922a] transition-colors">
                  🖼 Order a print of this →
                </button>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!generating && !visionImage && (
            <div className="rounded-2xl border-2 border-dashed border-[#e8e8e8] p-16 text-center">
              <p className="text-[48px] mb-4">✦</p>
              <p className="font-serif text-[22px] mb-2">Your vision awaits</p>
              <p className="text-[13px] text-[#999] max-w-[280px] mx-auto mb-6 leading-[1.7]">
                Generate a personalised photorealistic vision of you having achieved your goal
              </p>
              <button onClick={generate}
                className="px-6 py-3 bg-[#111] text-white rounded-xl text-[13px] font-medium hover:bg-[#2a2a2a] transition-colors">
                ✦ Generate my vision art
              </button>
            </div>
          )}
        </>
      )}

      {/* PRINT TAB */}
      {tab === 'print' && (
        <div>
          {!visionImage && (
            <div className="bg-[#faf3e0] border border-[#b8922a]/20 rounded-2xl p-4 mb-5 flex items-center gap-3">
              <span className="text-[20px]">✦</span>
              <div>
                <p className="text-[13px] font-medium text-[#b8922a]">Generate your vision art first</p>
                <p className="text-[12px] text-[#999]">Create your image from the Art tab, then order a print</p>
              </div>
              <button onClick={() => setTab('art')} className="ml-auto px-3 py-1.5 bg-[#b8922a] text-white rounded-xl text-[12px] font-medium flex-shrink-0">Create art →</button>
            </div>
          )}

          {visionImage && (
            <div className="flex items-start gap-4 bg-[#111] rounded-2xl p-4 mb-5">
              <img src={visionImage.imageUrl} alt="" className="w-16 h-24 object-cover rounded-xl flex-shrink-0"/>
              <div>
                <p className="text-[11px] text-white/40 uppercase tracking-[.1em] mb-1">Printing this vision</p>
                <p className="font-serif italic text-white text-[16px]">{visionImage.label}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {PRINT_PRODUCTS.map(p => (
              <div key={p.type} className={`bg-white rounded-2xl p-6 text-center relative ${p.featured ? 'border-2 border-[#111]' : 'border border-[#e8e8e8]'}`}>
                {p.featured && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#111] text-white text-[10px] font-medium px-3 py-1 rounded-full whitespace-nowrap">Most popular</div>}
                <div className="w-12 h-16 bg-[#1a1a2e] rounded-lg mx-auto mb-4 flex items-center justify-center text-white/20 font-serif text-[18px]">✦</div>
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