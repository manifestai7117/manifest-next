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
        .from('goals').select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      setGoals(gs || [])
      if (gs?.length) setSelectedGoal(gs[0])
      setLoading(false)
    }
    load()
  }, [])

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
      const updated = { ...selectedGoal, art_image_url: data.imageUrl, vision_board_regenerations: (selectedGoal.vision_board_regenerations || 0) + 1 }
      setSelectedGoal(updated)
      setGoals(gs => gs.map(g => g.id === selectedGoal.id ? updated : g))
      toast.success('New vision art generated!')
    } catch (e: any) {
      toast.error(e.message)
    }
    setGenerating(false)
  }

  const selectGoal = (g: any) => setSelectedGoal(g)

  if (loading) return <div className="text-[#999] text-[14px]">Loading...</div>

  if (!selectedGoal) return (
    <div className="fade-up">
      <h1 className="font-serif text-[32px] mb-1">Vision Art</h1>
      <p className="text-[14px] text-[#666] mb-6">Create a goal to generate your vision art.</p>
      <Link href="/onboarding" className="inline-block px-5 py-2.5 bg-[#111] text-white rounded-xl text-[13px] font-medium">Create goal →</Link>
    </div>
  )

  return (
    <div className="fade-up max-w-[900px]">
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-[32px] mb-1">Vision Art</h1>
          <p className="text-[14px] text-[#666]">AI-generated art showing you achieving your goal</p>
        </div>
        <button onClick={generate} disabled={generating}
          className="flex items-center gap-2 px-4 py-2.5 border border-[#e8e8e8] bg-white rounded-xl text-[13px] font-medium hover:bg-[#f8f7f5] transition-colors disabled:opacity-50">
          {generating ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-[#999] border-t-transparent rounded-full spin-anim"/>
              Generating...
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
              {selectedGoal.art_image_url ? 'Regenerate' : 'Generate art'}
            </>
          )}
        </button>
      </div>

      {/* Goal tabs */}
      {goals.length > 1 && (
        <div className="flex gap-2 mb-5 flex-wrap">
          {goals.map(g => (
            <button key={g.id} onClick={() => selectGoal(g)}
              className={`px-4 py-2 rounded-full text-[13px] border transition-all ${selectedGoal?.id === g.id ? 'bg-[#111] text-white border-[#111]' : 'bg-white text-[#666] border-[#e8e8e8] hover:border-[#d0d0d0]'}`}>
              {(g.display_title || g.title).slice(0, 30)}{(g.display_title || g.title).length > 30 ? '…' : ''}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Art display */}
        <div>
          {selectedGoal.art_image_url ? (
            <div className="rounded-2xl overflow-hidden aspect-[3/4] relative shadow-xl group">
              <img
                src={selectedGoal.art_image_url}
                alt={selectedGoal.art_title || selectedGoal.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black/70 to-transparent">
                <p className="font-serif italic text-white text-[18px] leading-tight mb-1">
                  {selectedGoal.art_title || selectedGoal.display_title || selectedGoal.title}
                </p>
                <p className="text-white/40 text-[10px] tracking-[.15em] uppercase">Manifest</p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl aspect-[3/4] flex flex-col items-center justify-center bg-gradient-to-br from-[#0d1117] to-[#1a2332] relative overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center opacity-5">
                <span className="font-serif text-[200px] text-white">✦</span>
              </div>
              <div className="relative z-10 text-center px-8">
                <p className="font-serif italic text-white/60 text-[18px] mb-2">{selectedGoal.art_title || 'Your vision'}</p>
                <p className="text-white/30 text-[13px] leading-[1.6] mb-6">{selectedGoal.art_description}</p>
                <button onClick={generate} disabled={generating}
                  className="px-6 py-3 bg-[#b8922a] text-white rounded-xl text-[13px] font-medium hover:bg-[#9a7820] transition-colors disabled:opacity-50">
                  {generating ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full spin-anim"/>
                      Generating... (~20s)
                    </span>
                  ) : 'Generate my vision art ✦'}
                </button>
                <p className="text-white/20 text-[11px] mt-3">Unique AI image · Takes ~20 seconds</p>
              </div>
            </div>
          )}
        </div>

        {/* Info panel */}
        <div className="space-y-4">
          <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5">
            <p className="text-[10px] font-medium tracking-[.12em] uppercase text-[#b8922a] mb-2">Vision scene</p>
            <p className="font-serif italic text-[20px] leading-tight mb-2">{selectedGoal.art_title || selectedGoal.display_title}</p>
            <p className="text-[13px] text-[#666] leading-[1.65]">{selectedGoal.art_description}</p>
          </div>

          <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5">
            <p className="text-[10px] font-medium tracking-[.12em] uppercase text-[#b8922a] mb-2">Daily affirmation</p>
            <p className="font-serif italic text-[16px] leading-[1.65]">"{selectedGoal.affirmation}"</p>
          </div>

          <div className="bg-white border border-[#e8e8e8] rounded-2xl p-4">
            <p className="font-medium text-[13px] mb-0.5">Style: {selectedGoal.aesthetic}</p>
            <p className="text-[12px] text-[#666]">Goal: <em>{selectedGoal.title}</em></p>
            {selectedGoal.vision_board_regenerations > 0 && (
              <p className="text-[11px] text-[#999] mt-1">Generated {selectedGoal.vision_board_regenerations} time{selectedGoal.vision_board_regenerations !== 1 ? 's' : ''}</p>
            )}
          </div>

          {selectedGoal.art_image_url && (
            <Link href="/dashboard/print"
              className="block w-full py-3 bg-[#b8922a] text-white rounded-xl text-[13px] font-medium text-center hover:bg-[#9a7820] transition-colors">
              Order a print →
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
