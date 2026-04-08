'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import toast from 'react-hot-toast'

// Category-based collage image sets from Unsplash
const COLLAGE_SETS: Record<string, string[]> = {
  running: [
    'photo-1571019613454-1cb2f99b2d8b',
    'photo-1502904550040-7534597429ae',
    'photo-1483721310020-03333e577078',
    'photo-1476480862126-209bfaa8edc8',
    'photo-1530143584546-02191bc84eb5',
    'photo-1549060279-7e168fcee0c2',
  ],
  fitness: [
    'photo-1571019613454-1cb2f99b2d8b',
    'photo-1534438327276-14e5300c3a48',
    'photo-1583454110551-21f2fa2afe61',
    'photo-1549060279-7e168fcee0c2',
    'photo-1540497077202-7c8a3999166f',
    'photo-1517836357463-d25dfeac3438',
  ],
  travel: [
    'photo-1476514525535-07fb3b4ae5f1',
    'photo-1499678329028-101435549a4e',
    'photo-1506905925346-21bda4d32df4',
    'photo-1530521954074-e64f6810b32d',
    'photo-1523906834658-6e24ef2386f9',
    'photo-1527631746610-bca00a040d60',
  ],
  business: [
    'photo-1486312338219-ce68d2c6f44d',
    'photo-1507679799987-c73779587ccf',
    'photo-1556761175-4b46a572b786',
    'photo-1553484771-371a605b060b',
    'photo-1520333789090-1afc82db536a',
    'photo-1454165804606-c3d57bc86b40',
  ],
  creative: [
    'photo-1513364776144-60967b0f800f',
    'photo-1542744094-3a31f272c490',
    'photo-1460661419201-fd4cecdf8a8b',
    'photo-1484480974693-6ca0a78fb36b',
    'photo-1471086569966-db3eebc25a59',
    'photo-1519389950473-47ba0277781c',
  ],
  wellness: [
    'photo-1544367567-0f2fcb009e0b',
    'photo-1506126613408-eca07ce68773',
    'photo-1498837167922-ddd27525d352',
    'photo-1545205597-3d9d02c29597',
    'photo-1490645935967-10de6ba17061',
    'photo-1447452001602-7090c7ab2db3',
  ],
  default: [
    'photo-1499346030926-9a72daac6c63',
    'photo-1502139214982-d0ad755818d8',
    'photo-1483728642387-6c3bdd6c93e5',
    'photo-1455390582262-044cdead277a',
    'photo-1504805572947-34fad45aed93',
    'photo-1511367461989-f85a21fda167',
  ],
}

function getCollageSet(goal: any): string[] {
  const t = (goal?.title || '').toLowerCase()
  const c = (goal?.category || '').toLowerCase()
  if (t.includes('run') || t.includes('marathon') || t.includes('race')) return COLLAGE_SETS.running
  if (t.includes('gym') || t.includes('fit') || t.includes('weight') || t.includes('body') || c.includes('health')) return COLLAGE_SETS.fitness
  if (t.includes('travel') || t.includes('trip') || t.includes('visit') || c.includes('travel')) return COLLAGE_SETS.travel
  if (t.includes('business') || t.includes('startup') || t.includes('launch') || c.includes('career')) return COLLAGE_SETS.business
  if (t.includes('write') || t.includes('art') || t.includes('music') || t.includes('creat') || c.includes('creative')) return COLLAGE_SETS.creative
  if (t.includes('health') || t.includes('wellnes') || t.includes('meditat') || t.includes('mind')) return COLLAGE_SETS.wellness
  return COLLAGE_SETS.default
}

export default function ArtPage() {
  const supabase = createClient()
  const [goal, setGoal] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: goals } = await supabase.from('goals').select('*').eq('user_id', user.id).eq('is_active', true).order('created_at', { ascending: false }).limit(1)
      setGoal(goals?.[0] || null)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="text-[#999] text-[14px]">Loading...</div>

  if (!goal) return (
    <div className="fade-up">
      <h1 className="font-serif text-[32px] mb-1">Vision Board</h1>
      <p className="text-[14px] text-[#666] mb-6">Create a goal to generate your personal vision board.</p>
      <Link href="/onboarding" className="inline-block px-5 py-2.5 bg-[#111] text-white rounded-xl text-[13px] font-medium">Create goal →</Link>
    </div>
  )

  const imgs = getCollageSet(goal)

  // Collage layout: 3 rows with varying sizes
  const collage = [
    { img: imgs[0], className: 'col-span-2 row-span-2' },  // large top-left
    { img: imgs[1], className: 'col-span-1 row-span-1' },  // small top-right
    { img: imgs[2], className: 'col-span-1 row-span-1' },  // small mid-right
    { img: imgs[3], className: 'col-span-1 row-span-1' },  // small bottom-left
    { img: imgs[4], className: 'col-span-1 row-span-1' },  // small bottom-mid
    { img: imgs[5], className: 'col-span-1 row-span-1' },  // small bottom-right
  ]

  return (
    <div className="fade-up max-w-[900px]">
      <h1 className="font-serif text-[32px] mb-1">Vision Board</h1>
      <p className="text-[14px] text-[#666] mb-6">Your visual world — curated around <em>{goal.title}</em></p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* LEFT — Collage */}
        <div>
          {/* Main collage grid */}
          <div className="grid grid-cols-3 gap-1.5 rounded-2xl overflow-hidden mb-1.5">
            {/* Row 1: big left + two small right */}
            <div className="col-span-2 row-span-2 aspect-square overflow-hidden" style={{gridRow:'span 2'}}>
              <img src={`https://images.unsplash.com/${imgs[0]}?w=500&h=500&fit=crop&crop=center`}
                alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"/>
            </div>
            <div className="aspect-square overflow-hidden">
              <img src={`https://images.unsplash.com/${imgs[1]}?w=250&h=250&fit=crop&crop=center`}
                alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"/>
            </div>
            <div className="aspect-square overflow-hidden">
              <img src={`https://images.unsplash.com/${imgs[2]}?w=250&h=250&fit=crop&crop=center`}
                alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"/>
            </div>
            {/* Row 2: three equal */}
            <div className="aspect-square overflow-hidden">
              <img src={`https://images.unsplash.com/${imgs[3]}?w=250&h=250&fit=crop&crop=center`}
                alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"/>
            </div>
            <div className="aspect-square overflow-hidden">
              <img src={`https://images.unsplash.com/${imgs[4]}?w=250&h=250&fit=crop&crop=center`}
                alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"/>
            </div>
            <div className="aspect-square overflow-hidden">
              <img src={`https://images.unsplash.com/${imgs[5]}?w=250&h=250&fit=crop&crop=center`}
                alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"/>
            </div>
          </div>

          {/* Affirmation overlay card */}
          <div className="bg-[#111] rounded-2xl p-5">
            <p className="text-[10px] font-medium tracking-[.12em] uppercase text-[#b8922a] mb-2">Daily affirmation</p>
            <p className="font-serif italic text-[17px] text-white leading-[1.6]">"{goal.affirmation}"</p>
          </div>
        </div>

        {/* RIGHT — Goal info */}
        <div className="space-y-4">
          <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5">
            <p className="text-[10px] font-medium tracking-[.12em] uppercase text-[#b8922a] mb-2">Vision scene</p>
            <p className="font-serif italic text-[20px] leading-tight mb-2">{goal.art_title || goal.title}</p>
            <p className="text-[13px] text-[#666] leading-[1.65]">{goal.art_description}</p>
          </div>

          <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5">
            <p className="text-[10px] font-medium tracking-[.12em] uppercase text-[#b8922a] mb-3">Your goal</p>
            <p className="font-medium text-[15px] mb-2">{goal.title}</p>
            <div className="flex gap-2 flex-wrap">
              <span className="text-[11px] font-medium text-[#b8922a] bg-[#faf3e0] px-2.5 py-1 rounded-full">{goal.timeline}</span>
              <span className="text-[11px] font-medium text-[#666] bg-[#f2f0ec] px-2.5 py-1 rounded-full">{goal.category}</span>
              <span className="text-[11px] font-medium text-[#666] bg-[#f2f0ec] px-2.5 py-1 rounded-full">{goal.aesthetic}</span>
            </div>
          </div>

          <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5">
            <p className="text-[10px] font-medium tracking-[.12em] uppercase text-[#b8922a] mb-2">Your why</p>
            <p className="text-[13px] text-[#666] leading-[1.65] italic">"{goal.why}"</p>
          </div>

          <Link href="/dashboard/print"
            className="block w-full py-3 bg-[#b8922a] text-white rounded-xl text-[13px] font-medium text-center hover:bg-[#9a7820] transition-colors">
            Order a print →
          </Link>
        </div>
      </div>
    </div>
  )
}
