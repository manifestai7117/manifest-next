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
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState(true)

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
      setSelectedGoal(g)
      setLoading(false)
    }
    load()
  }, [])

  const selectGoal = (g: any) => {
    setSelectedGoal(g)
    if (typeof window !== 'undefined') localStorage.setItem('selectedGoalId', g.id)
  }

  const generate = async () => {
    if (!selectedGoal || generating) return
    setGenerating(true)
    try {
      const res = await fetch('/api/vision-art/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalId: selectedGoal.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      const updated = { ...selectedGoal, art_image_url: data.imageUrl, vision_board_regenerations: data.regenerations }
      setSelectedGoal(updated)
      setGoals(gs => gs.map(g => g.id === selectedGoal.id ? updated : g))
      toast.success('Your vision art is ready!')
    } catch (e: any) {
      toast.error(e.message || 'Generation failed — try again')
    }
    setGenerating(false)
  }

  const download = () => {
    const isPro = profile?.plan === 'pro' || profile?.plan === 'pro_trial'
    if (!isPro) { toast.error('Download is a Pro feature'); return }
    if (!selectedGoal?.art_image_url) { toast.error('Generate your art first'); return }
    const a = document.createElement('a')
    a.href = selectedGoal.art_image_url
    a.download = `manifest-vision-${selectedGoal.title.slice(0, 30).replace(/\s+/g, '-')}.jpg`
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
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
  const hasImage = !!selectedGoal.art_image_url
  const regenCount = selectedGoal.vision_board_regenerations || 0

  return (
    <div className="fade-up max-w-[900px]">
      {/* Header */}
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-[32px] mb-1">Vision Art</h1>
          <p className="text-[14px] text-[#666]">AI-generated art showing you achieving your goal</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isPro && hasImage && (
            <button onClick={download}
              className="flex items-center gap-2 px-4 py-2.5 border border-[#e8e8e8] bg-white rounded-xl text-[13px] font-medium hover:bg-[#f8f7f5] transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download
            </button>
          )}
          <button onClick={generate} disabled={generating}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#111] text-white rounded-xl text-[13px] font-medium hover:bg-[#2a2a2a] transition-colors disabled:opacity-50">
            {generating ? (
              <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full spin-anim"/>Generating (~30s)...</>
            ) : hasImage ? (
              <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>Regenerate</>
            ) : (
              <>✦ Generate my vision art</>
            )}
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

      <div className="grid grid-cols-1 md:grid-cols-[1fr_340px] gap-6 items-start">

        {/* Image — full bleed, tall portrait */}
        <div>
          {generating ? (
            <div className="rounded-2xl bg-gradient-to-br from-[#0d1117] to-[#1a2332] flex flex-col items-center justify-center text-center p-10" style={{ aspectRatio: '4/5' }}>
              <div className="w-12 h-12 border-2 border-white/10 border-t-[#b8922a] rounded-full spin-anim mb-6"/>
              <p className="font-serif italic text-white/60 text-[20px] mb-2">Creating your vision...</p>
              <p className="text-white/30 text-[13px] leading-[1.7] max-w-[240px]">
                Claude is writing a cinematic prompt specific to your goal, then fal.ai is generating your image
              </p>
              <div className="mt-6 flex flex-col gap-2 w-full max-w-[260px]">
                {['Writing scene prompt...','Generating image...','Applying style...'].map((step, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#b8922a] opacity-60"/>
                    <span className="text-white/30 text-[12px]">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : hasImage ? (
            <div className="rounded-2xl overflow-hidden relative group shadow-2xl" style={{ aspectRatio: '4/5' }}>
              <img
                src={selectedGoal.art_image_url}
                alt={selectedGoal.art_title || selectedGoal.title}
                className="w-full h-full object-cover"
              />
              {/* Gradient overlay at bottom */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent p-6">
                <p className="font-serif italic text-white text-[20px] leading-tight mb-1">
                  {selectedGoal.art_title || selectedGoal.display_title || selectedGoal.title}
                </p>
                <p className="text-white/40 text-[10px] tracking-[.2em] uppercase">Manifest · Vision Art</p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-gradient-to-br from-[#0d1117] to-[#1a2332] flex flex-col items-center justify-center text-center p-10 cursor-pointer hover:from-[#111] hover:to-[#1e2a3a] transition-all" style={{ aspectRatio: '4/5' }} onClick={generate}>
              <div className="text-[56px] mb-5 opacity-15 font-serif">✦</div>
              <p className="font-serif italic text-white/50 text-[18px] mb-3">
                {selectedGoal.art_title || 'Your vision'}
              </p>
              <p className="text-white/25 text-[13px] leading-[1.7] mb-8 max-w-[240px]">
                {selectedGoal.art_description || 'Claude will write a cinematic scene prompt specific to your goal, then generate a stunning image'}
              </p>
              <button
                onClick={e => { e.stopPropagation(); generate() }}
                disabled={generating}
                className="px-6 py-3 bg-[#b8922a] text-white rounded-xl text-[13px] font-medium hover:bg-[#9a7820] transition-colors">
                ✦ Generate my vision art
              </button>
              <p className="text-white/20 text-[11px] mt-3">AI-generated · ~30 seconds · unique every time</p>
            </div>
          )}
        </div>

        {/* Info panel */}
        <div className="space-y-4">
          {hasImage && (
            <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5">
              <p className="text-[10px] font-medium tracking-[.12em] uppercase text-[#b8922a] mb-2">Vision scene</p>
              <p className="font-serif italic text-[18px] leading-tight mb-2">{selectedGoal.art_title || selectedGoal.title}</p>
              <p className="text-[13px] text-[#666] leading-[1.65]">{selectedGoal.art_description}</p>
            </div>
          )}

          <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5">
            <p className="text-[10px] font-medium tracking-[.12em] uppercase text-[#b8922a] mb-3">Your goal</p>
            <p className="font-medium text-[15px] mb-2">{selectedGoal.title}</p>
            <div className="flex gap-2 flex-wrap">
              <span className="text-[11px] font-medium text-[#b8922a] bg-[#faf3e0] px-2.5 py-1 rounded-full">{selectedGoal.timeline}</span>
              <span className="text-[11px] font-medium text-[#666] bg-[#f2f0ec] px-2.5 py-1 rounded-full">{selectedGoal.category}</span>
            </div>
          </div>

          <div className="bg-[#faf3e0] border border-[#b8922a]/20 rounded-2xl p-5">
            <p className="text-[10px] font-medium tracking-[.12em] uppercase text-[#b8922a] mb-2">Daily affirmation</p>
            <p className="font-serif italic text-[15px] text-[#111] leading-[1.65]">"{selectedGoal.affirmation}"</p>
          </div>

          {selectedGoal.why && (
            <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5">
              <p className="text-[10px] font-medium tracking-[.12em] uppercase text-[#b8922a] mb-2">Your why</p>
              <p className="text-[13px] text-[#666] leading-[1.65] italic">"{selectedGoal.why}"</p>
            </div>
          )}

          {regenCount > 0 && (
            <p className="text-[11px] text-[#999]">Generated {regenCount} time{regenCount !== 1 ? 's' : ''} · each one unique</p>
          )}

          {!isPro && hasImage && (
            <p className="text-[12px] text-[#999] bg-white border border-[#e8e8e8] rounded-xl p-3 text-center">
              <Link href="/dashboard/upgrade" className="text-[#b8922a] hover:underline font-medium">Upgrade to Pro</Link> to download your art
            </p>
          )}

          <Link href="/dashboard/print"
            className="block w-full py-3 bg-[#b8922a] text-white rounded-xl text-[13px] font-medium text-center hover:bg-[#9a7820] transition-colors">
            Order a print →
          </Link>
        </div>
      </div>
    </div>
  )
}
