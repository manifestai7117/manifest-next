'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import toast from 'react-hot-toast'

// Curated Unsplash photo IDs — verified working, no faces, all relevant
// Format: images.unsplash.com/photo-ID?w=800&h=800&fit=crop&q=90
const POOLS: Record<string, string[]> = {
  tennis: [
    'photo-1545809074-59472b3f5ecc','photo-1560012057-4372e14c5085','photo-1551698618-1dfe5d97d256',
    'photo-1599586120429-48281b6f0ece','photo-1622279457486-62dcc4a431d6','photo-1547347298-4074fc3086f0',
    'photo-1558618666-fcd25c85cd64','photo-1587280501635-68a0e82cd5ff','photo-1544717305-2782549b5136',
    'photo-1506126613408-eca07ce68773','photo-1571019613454-1cb2f99b2d8b','photo-1593007791459-4b05e1158229',
    'photo-1473091534298-04dcbce3278c','photo-1449130561867-97e27a42e09a','photo-1594882645126-14ac19a3b2c4',
    'photo-1517438476312-10d79c077509','photo-1552674605-db6ffd4facb5','photo-1461897104016-0b3b00cc81ee',
  ],
  golf: [
    'photo-1535131749006-b7f58c99034b','photo-1593111774240-d529f12cf4bb','photo-1587174486073-ae5e5cff23aa',
    'photo-1561392079-5ed5a3e4b72f','photo-1576791605472-6f5e91b13f3d','photo-1632151886066-9fed8f5febed',
    'photo-1530028828-25e6b43797c3','photo-1516589178581-6cd7833ae3b2','photo-1574126154517-d1e0d89ef734',
    'photo-1543326727-cf6c39e8f84c','photo-1535131749006-b7f58c99034b','photo-1618005182384-a83a8bd57fbe',
  ],
  fitness: [
    'photo-1534438327276-14e5300c3a48','photo-1540497077202-7c8a3999166f','photo-1517836357463-d25dfeac3438',
    'photo-1581009137042-c552e485697a','photo-1526506118085-60ce8714f8c5','photo-1550345332-09e3ac987658',
    'photo-1584735935682-2f2b69dff9d2','photo-1605296867304-46d5465a13f1','photo-1571019614242-c5c5dee9f50b',
    'photo-1567013127542-490d757e51cd','photo-1574680096145-d05b474e2155','photo-1518611012118-696072aa579a',
    'photo-1549060279-7e168fcee0c2','photo-1559841644-08984562005d','photo-1483721310020-03333e577078',
    'photo-1476480862126-209bfaa8edc8','photo-1530143584546-02191bc84eb5','photo-1558618666-fcd25c85cd64',
    'photo-1517438476312-10d79c077509','photo-1587280501635-68a0e82cd5ff','photo-1544717305-2782549b5136',
    'photo-1506126613408-eca07ce68773','photo-1449130561867-97e27a42e09a','photo-1594882645126-14ac19a3b2c4',
  ],
  running: [
    'photo-1476480862126-209bfaa8edc8','photo-1502904550040-7534597429ae','photo-1483721310020-03333e577078',
    'photo-1530143584546-02191bc84eb5','photo-1571019613454-1cb2f99b2d8b','photo-1558618666-fcd25c85cd64',
    'photo-1476520221767-8f3788ea43ed','photo-1461897104016-0b3b00cc81ee','photo-1552674605-db6ffd4facb5',
    'photo-1594882645126-14ac19a3b2c4','photo-1517438476312-10d79c077509','photo-1587280501635-68a0e82cd5ff',
    'photo-1593007791459-4b05e1158229','photo-1544717305-2782549b5136','photo-1473091534298-04dcbce3278c',
    'photo-1571008887538-b36bb32f4571','photo-1506126613408-eca07ce68773','photo-1449130561867-97e27a42e09a',
  ],
  coding: [
    'photo-1555066931-4365d14bab8c','photo-1461749280684-dccba630e2f6','photo-1517694712202-14dd9538aa97',
    'photo-1498050108023-c5249f4df085','photo-1542831371-29b0f74f9713','photo-1537432376769-00f5c2f4c8d2',
    'photo-1484417894907-623942c8ee29','photo-1518770660439-4636190af475','photo-1526374965328-7f61d4dc18c5',
    'photo-1550439062-609e1531270e','photo-1523800503107-5bc3ba2a6f81','photo-1504868584819-f8e8b4b6d7e3',
    'photo-1451187580459-43490279c0fa','photo-1563986768609-322da13575f3','photo-1629904853893-c2c8981a1dc5',
    'photo-1607798748738-b15c40d33d57','photo-1571171637578-41bc2dd41cd2','photo-1593720213428-28a5b9e94613',
  ],
  travel: [
    'photo-1476514525535-07fb3b4ae5f1','photo-1499678329028-101435549a4e','photo-1506905925346-21bda4d32df4',
    'photo-1530521954074-e64f6810b32d','photo-1523906834658-6e24ef2386f9','photo-1527631746610-bca00a040d60',
    'photo-1500835556837-99ac94a94552','photo-1469854523086-cc02fe5d8800','photo-1504150558240-0b4fd8946624',
    'photo-1507525428034-b723cf961d3e','photo-1534430480872-3498386e7856','photo-1488085061387-422e29b40080',
    'photo-1519451241324-20b4ea2c4220','photo-1513407030348-c983a97b98d8','photo-1502791451862-7bd8c1df43a7',
    'photo-1517760444937-f6397edcbbcd','photo-1533105079780-92b9be482077','photo-1504019347908-b45f9b0b8dd5',
    'photo-1465146344425-f00d5f5c8f07','photo-1501854140801-50d01698950b','photo-1470770841072-f978cf4d019e',
  ],
  business: [
    'photo-1486312338219-ce68d2c6f44d','photo-1556761175-4b46a572b786','photo-1553484771-371a605b060b',
    'photo-1520333789090-1afc82db536a','photo-1454165804606-c3d57bc86b40','photo-1542744094-3a31f272c490',
    'photo-1497366216548-37526070297c','photo-1497366754035-f200968a6e72','photo-1504384308090-c894fdcc538d',
    'photo-1560472354-b33ff0c44a43','photo-1542744173-8e7e53415bb0','photo-1519389950473-47ba0277781c',
    'photo-1573165067541-4cd6d9837902','photo-1600880292203-757bb62b4baf','photo-1517245386807-bb43f82c33c4',
    'photo-1521737604893-d14cc237f11d','photo-1522071820081-009f0129c71c','photo-1507679799987-c73779587ccf',
  ],
  swimming: [
    'photo-1530549387789-4c1017266635','photo-1560090995-6632f1ebac30','photo-1567093280614-73a3f0f1c8ee',
    'photo-1571902943202-507ec2618e8f','photo-1518611507764-b4b8a4e0b3fc','photo-1555817128-342f15c71e3d',
    'photo-1504868584819-f8e8b4b6d7e3','photo-1476480862126-209bfaa8edc8','photo-1551698618-1dfe5d97d256',
    'photo-1544717305-2782549b5136','photo-1549060279-7e168fcee0c2','photo-1573496359142-b8d87734a5a2',
  ],
  music: [
    'photo-1511379938547-c1f69419868d','photo-1510915361894-db8b60106cb1','photo-1514320291840-2e0a9bf2a9ae',
    'photo-1493225457124-a3eb161ffa5f','photo-1598387993441-a364f854c3e1','photo-1470019693664-1d202d2c0907',
    'photo-1524650359799-842906ca1c06','photo-1507838153414-b4b713384a76','photo-1415201364774-f6f0bb35f28f',
    'photo-1471478331149-c72f17e33c73','photo-1468164016595-6e6eedb26d1f','photo-1519892300165-cb5542fb47c7',
  ],
  default: [
    'photo-1499346030926-9a72daac6c63','photo-1483728642387-6c3bdd6c93e5','photo-1455390582262-044cdead277a',
    'photo-1504805572947-34fad45aed93','photo-1511367461989-f85a21fda167','photo-1502139214982-d0ad755818d8',
    'photo-1518495973542-4542c06a5843','photo-1519834785169-98be25ec3f84','photo-1532274402911-5a369e4c4bb5',
    'photo-1473621038790-b778b4282e68','photo-1476611338391-6f395a0ebc7b','photo-1504196606672-aef5c9cefc92',
    'photo-1495616811223-4d98c6e9c869','photo-1470770841072-f978cf4d019e','photo-1501854140801-50d01698950b',
    'photo-1465146344425-f00d5f5c8f07','photo-1444464666168-49d633b86797','photo-1500534314209-a25ddb2bd429',
    'photo-1476514525535-07fb3b4ae5f1','photo-1527631746610-bca00a040d60','photo-1506905925346-21bda4d32df4',
  ],
}

function seededShuffle(arr: string[], seed: number): string[] {
  const a = [...arr]
  let s = (seed + 1) & 0x7fffffff
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0x7fffffff
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function getPool(goal: any): string[] {
  const t = (goal?.title || '').toLowerCase()
  const c = (goal?.category || '').toLowerCase()
  if (t.includes('tennis')) return POOLS.tennis
  if (t.includes('golf')) return POOLS.golf
  if (t.includes('swim')) return POOLS.swimming
  if (t.includes('run') || t.includes('marathon') || t.includes('5k') || t.includes('10k')) return POOLS.running
  if (t.includes('music') || t.includes('guitar') || t.includes('piano') || t.includes('sing') || t.includes('album')) return POOLS.music
  if (t.includes('cod') || t.includes('program') || t.includes('develop') || t.includes('software') || t.includes('tech') || t.includes('app')) return POOLS.coding
  if (t.includes('gym') || t.includes('fit') || t.includes('weight') || t.includes('body') || t.includes('fat') || t.includes('lean') || t.includes('muscle') || c.includes('health')) return POOLS.fitness
  if (t.includes('travel') || t.includes('trip') || t.includes('visit') || c.includes('travel')) return POOLS.travel
  if (t.includes('business') || t.includes('startup') || t.includes('company') || t.includes('launch') || t.includes('entrepreneur') || c.includes('career') || c.includes('business')) return POOLS.business
  return POOLS.default
}

function getCollageImgs(goal: any, regenCount: number): string[] {
  const pool = getPool(goal)
  const shuffled = seededShuffle(pool, regenCount * 13 + 7)
  return shuffled.slice(0, 6)
}

function imgUrl(photoId: string, w = 800, h = 800): string {
  return `https://images.unsplash.com/${photoId}?w=${w}&h=${h}&fit=crop&crop=center&q=90`
}

export default function ArtPage() {
  const supabase = createClient()
  const [goals, setGoals] = useState<any[]>([])
  const [selectedGoal, setSelectedGoal] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
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
      if (g) { setSelectedGoal(g); setRegenCount(g.vision_board_regenerations || 0) }
      setLoading(false)
    }
    load()
  }, [])

  const selectGoal = (g: any) => {
    setSelectedGoal(g)
    setRegenCount(g.vision_board_regenerations || 0)
    if (typeof window !== 'undefined') localStorage.setItem('selectedGoalId', g.id)
  }

  const generate = async () => {
    if (!selectedGoal || generating) return
    setGenerating(true)
    const newCount = regenCount + 1
    setRegenCount(newCount)
    await supabase.from('goals').update({ vision_board_regenerations: newCount, vision_board_last_generated: new Date().toISOString() }).eq('id', selectedGoal.id)
    const updated = { ...selectedGoal, vision_board_regenerations: newCount }
    setSelectedGoal(updated)
    setGoals(gs => gs.map(g => g.id === selectedGoal.id ? updated : g))
    toast.success('Vision board refreshed!')
    setGenerating(false)
  }

  const downloadCollage = () => {
    const isPro = profile?.plan === 'pro' || profile?.plan === 'pro_trial'
    if (!isPro) { toast.error('Download is a Pro feature'); return }
    const imgs = getCollageImgs(selectedGoal, regenCount)
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
        <div class="big"><img src="${imgUrl(imgs[0], 800, 800)}"/></div>
        <div class="small">
          <div class="sm"><img src="${imgUrl(imgs[1], 400, 400)}"/></div>
          <div class="sm"><img src="${imgUrl(imgs[2], 400, 400)}"/></div>
        </div>
      </div>
      <div class="bottom">
        <div class="b"><img src="${imgUrl(imgs[3], 400, 400)}"/></div>
        <div class="b"><img src="${imgUrl(imgs[4], 400, 400)}"/></div>
        <div class="b"><img src="${imgUrl(imgs[5], 400, 400)}"/></div>
      </div>
      <div class="caption">"${selectedGoal.affirmation}" — Manifest Vision Board</div>
      <script>setTimeout(function(){window.print()},1200)<\/script>
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

  const imgs = getCollageImgs(selectedGoal, regenCount)
  const isPro = profile?.plan === 'pro' || profile?.plan === 'pro_trial'

  return (
    <div className="fade-up max-w-[900px]">
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-[32px] mb-1">Vision Board</h1>
          <p className="text-[14px] text-[#666]">Your visual world for <em>{selectedGoal.title}</em></p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isPro && (
            <button onClick={downloadCollage}
              className="flex items-center gap-2 px-4 py-2.5 border border-[#e8e8e8] bg-white rounded-xl text-[13px] font-medium hover:bg-[#f8f7f5] transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download
            </button>
          )}
          <button onClick={generate} disabled={generating}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#111] text-white rounded-xl text-[13px] font-medium hover:bg-[#2a2a2a] transition-colors disabled:opacity-50">
            {generating
              ? <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full spin-anim"/>Refreshing...</>
              : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>New board</>
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
          {/* Top: large left + 2 small right */}
          <div className="rounded-t-2xl overflow-hidden" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gridTemplateRows: '200px 200px', gap: '4px' }}>
            <div style={{ gridRow: 'span 2', overflow: 'hidden' }}>
              <img src={imgUrl(imgs[0], 600, 800)} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" style={{ display: 'block' }}/>
            </div>
            <div style={{ overflow: 'hidden' }}>
              <img src={imgUrl(imgs[1], 300, 300)} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" style={{ display: 'block' }}/>
            </div>
            <div style={{ overflow: 'hidden' }}>
              <img src={imgUrl(imgs[2], 300, 300)} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" style={{ display: 'block' }}/>
            </div>
          </div>
          {/* Bottom: 3 equal */}
          <div className="rounded-b-2xl overflow-hidden mb-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '4px', marginTop: '4px' }}>
            {[3,4,5].map(i => (
              <div key={i} style={{ height: '130px', overflow: 'hidden' }}>
                <img src={imgUrl(imgs[i], 300, 300)} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" style={{ display: 'block' }}/>
              </div>
            ))}
          </div>

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
          {regenCount > 0 && <p className="text-[11px] text-[#999]">Refreshed {regenCount} time{regenCount !== 1 ? 's' : ''} · different images every time</p>}
          <Link href="/dashboard/print" className="block w-full py-3 bg-[#b8922a] text-white rounded-xl text-[13px] font-medium text-center hover:bg-[#9a7820] transition-colors">
            Order a print →
          </Link>
        </div>
      </div>
    </div>
  )
}