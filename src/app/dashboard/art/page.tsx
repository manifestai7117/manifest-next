'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import toast from 'react-hot-toast'

export default function ArtPage() {
  const supabase = createClient()
  const [goals, setGoals] = useState<any[]>([])
  const [selectedGoal, setSelectedGoal] = useState<any>(null)
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: gs } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      setGoals(gs || [])
      if (gs?.length) setSelectedGoal(gs[0])
      setLoading(false)
    }
    load()
  }, [])

  const hoursLeft = () => {
    if (!selectedGoal?.vision_board_last_generated) return 0
    const hours = 24 - (Date.now() - new Date(selectedGoal.vision_board_last_generated).getTime()) / 3600000
    return Math.max(0, Math.ceil(hours))
  }

  const canGenerate = () => {
    if (!selectedGoal?.vision_board_last_generated) return true
    return hoursLeft() === 0
  }

  const generateArt = async () => {
    if (!selectedGoal) return
    if (!canGenerate()) { toast.error(`Next generation available in ${hoursLeft()} hours`); return }
    setGenerating(true)
    try {
      const res = await fetch('/api/vision-art/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalId: selectedGoal.id }),
      })
      const data = await res.json()
      if (res.status === 429) { toast.error(data.error); setGenerating(false); return }
      if (!res.ok) throw new Error(data.error)
      const updated = { ...selectedGoal, art_image_url: data.imageUrl, vision_board_last_generated: new Date().toISOString() }
      setSelectedGoal(updated)
      setGoals(gs => gs.map(g => g.id === selectedGoal.id ? updated : g))
      toast.success('Your vision art has been generated!')
    } catch (e: any) {
      toast.error('Generation failed: ' + e.message)
    }
    setGenerating(false)
  }

  if (loading) return <div className="text-[#999] text-[14px] p-8">Loading...</div>

  return (
    <div className="fade-up max-w-[900px]">
      <h1 className="font-serif text-[32px] mb-1">Vision Art</h1>
      <p className="text-[14px] text-[#666] mb-6">AI-generated art showing you achieving your goal — beautiful enough to frame.</p>

      {/* Goal tabs */}
      {goals.length > 1 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          {goals.map(g => (
            <button key={g.id} onClick={() => setSelectedGoal(g)}
              className={`px-4 py-2 rounded-full text-[13px] border transition-all ${selectedGoal?.id === g.id ? 'bg-[#111] text-white border-[#111]' : 'bg-white text-[#666] border-[#e8e8e8] hover:border-[#d0d0d0]'}`}>
              {(g.display_title || g.title).slice(0, 32)}{(g.display_title || g.title).length > 32 ? '…' : ''}
            </button>
          ))}
        </div>
      )}

      {!selectedGoal ? (
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-8 text-center">
          <p className="text-[#666] mb-4">No active goals. Create a goal to generate your vision art.</p>
          <Link href="/onboarding" className="inline-block px-5 py-2.5 bg-[#111] text-white rounded-xl text-[13px] font-medium">Create goal →</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Art display */}
          <div>
            {selectedGoal.art_image_url ? (
              // Real AI-generated image
              <div className="rounded-2xl overflow-hidden aspect-[3/4] relative group shadow-xl">
                <img
                  src={selectedGoal.art_image_url}
                  alt={selectedGoal.art_title || selectedGoal.title}
                  className="w-full h-full object-cover"
                />
                {/* Subtle overlay with title */}
                <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/70 to-transparent">
                  <p className="font-serif italic text-white text-[20px] leading-tight mb-1">
                    {selectedGoal.art_title || selectedGoal.display_title || selectedGoal.title}
                  </p>
                  <p className="text-white/50 text-[10px] tracking-[.15em] uppercase font-medium">Manifest</p>
                </div>
              </div>
            ) : (
              // No image yet — prompt to generate
              <div className="rounded-2xl aspect-[3/4] flex flex-col items-center justify-center bg-gradient-to-br from-[#0d1117] to-[#1a2332] relative overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center opacity-5">
                  <span className="font-serif text-[200px] text-white">✦</span>
                </div>
                <div className="relative z-10 text-center px-8">
                  <p className="font-serif italic text-white/60 text-[18px] mb-2">{selectedGoal.art_title || 'Your vision'}</p>
                  <p className="text-white/30 text-[13px] leading-[1.6] mb-6">{selectedGoal.art_description}</p>
                  <button onClick={generateArt} disabled={generating}
                    className="px-6 py-3 bg-[#b8922a] text-white rounded-xl text-[13px] font-medium hover:bg-[#9a7820] transition-colors disabled:opacity-50">
                    {generating ? (
                      <span className="flex items-center gap-2">
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full spin-anim"/>
                        Generating your art...
                      </span>
                    ) : 'Generate my vision art ✦'}
                  </button>
                  <p className="text-white/20 text-[11px] mt-3">Takes ~10 seconds · Powered by AI</p>
                </div>
              </div>
            )}
          </div>

          {/* Info + controls */}
          <div className="space-y-4">

            {/* Scene description */}
            <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5">
              <p className="text-[10px] font-medium tracking-[.12em] uppercase text-[#b8922a] mb-2">Vision scene</p>
              <p className="font-serif italic text-[20px] mb-2">{selectedGoal.art_title || selectedGoal.display_title}</p>
              <p className="text-[13px] text-[#666] leading-[1.65]">{selectedGoal.art_description}</p>
            </div>

            {/* Affirmation */}
            <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5">
              <p className="text-[10px] font-medium tracking-[.12em] uppercase text-[#b8922a] mb-2">Daily affirmation</p>
              <p className="font-serif italic text-[16px] leading-[1.65]">"{selectedGoal.affirmation}"</p>
            </div>

            {/* Style */}
            <div className="bg-white border border-[#e8e8e8] rounded-2xl p-4">
              <p className="font-medium text-[13px] mb-0.5">Style: {selectedGoal.aesthetic}</p>
              <p className="text-[12px] text-[#666]">Personalized for: <em>{selectedGoal.title}</em></p>
            </div>

            {/* Actions */}
            {selectedGoal.art_image_url && (
              <Link href="/dashboard/print"
                className="block w-full py-3 bg-[#b8922a] text-white rounded-xl text-[13px] font-medium text-center hover:bg-[#9a7820] transition-colors">
                Order a print →
              </Link>
            )}

            <button
              onClick={generateArt}
              disabled={generating || !canGenerate()}
              className="w-full py-3 border border-[#e8e8e8] rounded-xl text-[13px] font-medium hover:bg-[#f8f7f5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {generating ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-[#999] border-t-transparent rounded-full spin-anim"/>
                  Generating... (~10 seconds)
                </span>
              ) : canGenerate()
                ? (selectedGoal.art_image_url ? '↺ Regenerate art' : '✦ Generate my vision art')
                : `↺ Available in ${hoursLeft()}h`
              }
            </button>

            {!canGenerate() && (
              <p className="text-center text-[11px] text-[#999]">
                You can regenerate once every 24 hours.{' '}
                {selectedGoal.vision_board_regenerations > 0 && `Generated ${selectedGoal.vision_board_regenerations} time${selectedGoal.vision_board_regenerations !== 1 ? 's' : ''}.`}
              </p>
            )}

            {!process.env.NEXT_PUBLIC_FAL_CONFIGURED && !selectedGoal.art_image_url && (
              <div className="bg-[#faf3e0] border border-[#b8922a]/20 rounded-xl p-3 text-[12px] text-[#b8922a]">
                Add <strong>FAL_KEY</strong> to Vercel environment variables to enable AI image generation.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}