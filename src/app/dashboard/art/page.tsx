'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import toast from 'react-hot-toast'

export default function ArtPage() {
  const supabase = createClient()
  const [goals, setGoals] = useState<any[]>([])
  const [selectedGoal, setSelectedGoal] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [images, setImages] = useState<string[]>([])
  const [queries, setQueries] = useState<string[]>([])
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [regenCount, setRegenCount] = useState(0)
  const collageRef = useRef<HTMLDivElement>(null)

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
        setRegenCount(g.vision_board_regenerations || 0)
        // Load cached images from localStorage
        const cached = typeof window !== 'undefined' ? localStorage.getItem(`vb_images_${g.id}`) : null
        if (cached) {
          try { setImages(JSON.parse(cached)) } catch {}
        }
      }
      setLoading(false)
    }
    load()
  }, [])

  const selectGoal = (g: any) => {
    setSelectedGoal(g)
    setRegenCount(g.vision_board_regenerations || 0)
    localStorage.setItem('selectedGoalId', g.id)
    const cached = localStorage.getItem(`vb_images_${g.id}`)
    if (cached) {
      try { setImages(JSON.parse(cached)); setQueries([]) } catch {}
    } else {
      setImages([])
    }
  }

  const generate = async () => {
    if (!selectedGoal || generating) return
    setGenerating(true)
    setImages([]) // clear while loading
    toast('Generating your personalised vision board...', { duration: 8000 })
    try {
      const res = await fetch('/api/vision-board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalId: selectedGoal.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setImages(data.images)
      setQueries(data.queries || [])
      setRegenCount(data.regenerations)
      const updated = { ...selectedGoal, vision_board_regenerations: data.regenerations }
      setSelectedGoal(updated)
      setGoals(gs => gs.map(g => g.id === selectedGoal.id ? updated : g))
      // Cache images
      localStorage.setItem(`vb_images_${selectedGoal.id}`, JSON.stringify(data.images))
      toast.success('Vision board ready!')
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate board')
    }
    setGenerating(false)
  }

  const downloadCollage = () => {
    const isPro = profile?.plan === 'pro' || profile?.plan === 'pro_trial'
    if (!isPro) { toast.error('Download is a Pro feature'); return }
    if (!images.length) { toast.error('Generate a board first'); return }
    const win = window.open('', '_blank')
    if (!win) { toast.error('Please allow popups'); return }
    win.document.write(`<!DOCTYPE html><html><head><style>
      *{margin:0;padding:0;box-sizing:border-box}body{background:#f8f7f5;font-family:'Georgia',serif}
      .top{display:grid;grid-template-columns:2fr 1fr;gap:4px;height:400px}
      .big{overflow:hidden}.small{display:grid;grid-template-rows:1fr 1fr;gap:4px}
      .sm{overflow:hidden}.bottom{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;height:200px}
      .b{overflow:hidden}img{width:100%;height:100%;object-fit:cover;display:block}
      .caption{background:#111;color:white;padding:16px 20px;font-style:italic;font-size:14px}
    </style></head><body>
      <div class="top">
        <div class="big"><img src="${images[0]}"/></div>
        <div class="small">
          <div class="sm"><img src="${images[1]}"/></div>
          <div class="sm"><img src="${images[2]}"/></div>
        </div>
      </div>
      <div class="bottom">
        <div class="b"><img src="${images[3]}"/></div>
        <div class="b"><img src="${images[4]}"/></div>
        <div class="b"><img src="${images[5]}"/></div>
      </div>
      <div class="caption">"${selectedGoal.affirmation}" — Manifest Vision Board</div>
      <script>setTimeout(function(){window.print()},1500)<\/script>
    </body></html>`)
    win.document.close()
  }

  if (loading) return <div className="text-[#999] text-[14px]">Loading...</div>
  if (!selectedGoal) return (
    <div className="fade-up">
      <h1 className="font-serif text-[32px] mb-1">Vision Board</h1>
      <p className="text-[14px] text-[#666] mb-6">Create a goal to generate your vision board.</p>
      <Link href="/onboarding" className="inline-block px-5 py-2.5 bg-[#111] text-white rounded-xl text-[13px] font-medium">Create goal →</Link>
    </div>
  )

  const isPro = profile?.plan === 'pro' || profile?.plan === 'pro_trial'
  const hasImages = images.length === 6

  return (
    <div className="fade-up max-w-[900px]">
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-[32px] mb-1">Vision Board</h1>
          <p className="text-[14px] text-[#666]">AI-curated imagery for <em>{selectedGoal.title}</em></p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isPro && hasImages && (
            <button onClick={downloadCollage} className="flex items-center gap-2 px-4 py-2.5 border border-[#e8e8e8] bg-white rounded-xl text-[13px] font-medium hover:bg-[#f8f7f5] transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download
            </button>
          )}
          <button onClick={generate} disabled={generating}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#111] text-white rounded-xl text-[13px] font-medium hover:bg-[#2a2a2a] transition-colors disabled:opacity-50">
            {generating
              ? <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full spin-anim"/>Generating (~15s)...</>
              : hasImages
                ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>New board</>
                : <>✦ Generate my board</>
            }
          </button>
        </div>
      </div>

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div ref={collageRef}>
          {/* Collage */}
          {generating ? (
            <div className="rounded-2xl bg-[#f0ede8] flex flex-col items-center justify-center gap-4" style={{ height: '490px' }}>
              <div className="w-10 h-10 border-2 border-[#d0c9be] border-t-[#b8922a] rounded-full spin-anim"/>
              <div className="text-center px-8">
                <p className="font-medium text-[15px] mb-1">Building your board</p>
                <p className="text-[13px] text-[#666]">AI is searching & scoring images for relevance</p>
                {queries.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 justify-center mt-3">
                    {queries.map((q, i) => <span key={i} className="text-[11px] bg-white px-2 py-1 rounded-full text-[#666]">{q}</span>)}
                  </div>
                )}
              </div>
            </div>
          ) : hasImages ? (
            <>
              <div className="rounded-t-2xl overflow-hidden" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gridTemplateRows: '200px 200px', gap: '4px' }}>
                <div style={{ gridRow: 'span 2', overflow: 'hidden' }}>
                  <img src={images[0]} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" style={{ display: 'block' }}/>
                </div>
                {[1,2].map(i => (
                  <div key={i} style={{ overflow: 'hidden' }}>
                    <img src={images[i]} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" style={{ display: 'block' }}/>
                  </div>
                ))}
              </div>
              <div className="rounded-b-2xl overflow-hidden mb-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '4px', marginTop: '4px' }}>
                {[3,4,5].map(i => (
                  <div key={i} style={{ height: '130px', overflow: 'hidden' }}>
                    <img src={images[i]} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" style={{ display: 'block' }}/>
                  </div>
                ))}
              </div>
              {queries.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {queries.map((q, i) => <span key={i} className="text-[10px] bg-[#f0ede8] px-2 py-1 rounded-full text-[#999]">{q}</span>)}
                </div>
              )}
            </>
          ) : (
            <div className="rounded-2xl bg-gradient-to-br from-[#0d1117] to-[#1a2332] flex flex-col items-center justify-center text-center p-8" style={{ height: '490px' }}>
              <div className="text-[48px] mb-4 opacity-20">✦</div>
              <p className="font-serif italic text-white/60 text-[18px] mb-2">{selectedGoal.art_title || selectedGoal.title}</p>
              <p className="text-white/30 text-[13px] mb-6 leading-[1.6] max-w-[260px]">AI will search Unsplash and score each image for relevance before showing it to you</p>
              <button onClick={generate}
                className="px-6 py-3 bg-[#b8922a] text-white rounded-xl text-[13px] font-medium hover:bg-[#9a7820] transition-colors">
                ✦ Generate my board
              </button>
              <p className="text-white/20 text-[11px] mt-3">Takes ~15 seconds · unique every time</p>
            </div>
          )}

          <div className="bg-[#111] rounded-2xl p-4 mb-2">
            <p className="text-[10px] font-medium tracking-[.12em] uppercase text-[#b8922a] mb-2">Daily affirmation</p>
            <p className="font-serif italic text-[15px] text-white leading-[1.6]">"{selectedGoal.affirmation}"</p>
          </div>
          {!isPro && (
            <p className="text-[11px] text-[#999] mt-1 text-center">
              <Link href="/dashboard/upgrade" className="text-[#b8922a] hover:underline">Upgrade to Pro</Link> to download your board
            </p>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5">
            <p className="text-[10px] font-medium tracking-[.12em] uppercase text-[#b8922a] mb-2">Vision scene</p>
            <p className="font-serif italic text-[20px] leading-tight mb-2">{selectedGoal.art_title || selectedGoal.display_title || selectedGoal.title}</p>
            <p className="text-[13px] text-[#666] leading-[1.65]">{selectedGoal.art_description}</p>
          </div>
          <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5">
            <p className="text-[10px] font-medium tracking-[.12em] uppercase text-[#b8922a] mb-3">Your goal</p>
            <p className="font-medium text-[15px] mb-2">{selectedGoal.title}</p>
            <div className="flex gap-2 flex-wrap">
              <span className="text-[11px] font-medium text-[#b8922a] bg-[#faf3e0] px-2.5 py-1 rounded-full">{selectedGoal.timeline}</span>
              <span className="text-[11px] font-medium text-[#666] bg-[#f2f0ec] px-2.5 py-1 rounded-full">{selectedGoal.category}</span>
            </div>
          </div>
          {selectedGoal.why && (
            <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5">
              <p className="text-[10px] font-medium tracking-[.12em] uppercase text-[#b8922a] mb-2">Your why</p>
              <p className="text-[13px] text-[#666] leading-[1.65] italic">"{selectedGoal.why}"</p>
            </div>
          )}
          {regenCount > 0 && (
            <p className="text-[11px] text-[#999]">Generated {regenCount} time{regenCount !== 1 ? 's' : ''} · AI scores every image for relevance</p>
          )}
          <Link href="/dashboard/print" className="block w-full py-3 bg-[#b8922a] text-white rounded-xl text-[13px] font-medium text-center hover:bg-[#9a7820] transition-colors">
            Order a print →
          </Link>
        </div>
      </div>
    </div>
  )
}
