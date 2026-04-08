'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import toast from 'react-hot-toast'

// TOGGLE: set to false in production to enforce 24h cooldown
const ALLOW_UNLIMITED_REGEN = true

const COLLAGE_SETS: Record<string, string[][]> = {
  running: [
    ['photo-1571019613454-1cb2f99b2d8b','photo-1502904550040-7534597429ae','photo-1483721310020-03333e577078','photo-1476480862126-209bfaa8edc8','photo-1530143584546-02191bc84eb5','photo-1549060279-7e168fcee0c2'],
    ['photo-1476520221767-8f3788ea43ed','photo-1461897104016-0b3b00cc81ee','photo-1552674605-db6ffd4facb5','photo-1506126613408-eca07ce68773','photo-1594882645126-14ac19a3b2c4','photo-1558618666-fcd25c85cd64'],
    ['photo-1593007791459-4b05e1158229','photo-1544717305-2782549b5136','photo-1473091534298-04dcbce3278c','photo-1571008887538-b36bb32f4571','photo-1517438476312-10d79c077509','photo-1587280501635-68a0e82cd5ff'],
  ],
  fitness: [
    ['photo-1534438327276-14e5300c3a48','photo-1583454110551-21f2fa2afe61','photo-1549060279-7e168fcee0c2','photo-1540497077202-7c8a3999166f','photo-1517836357463-d25dfeac3438','photo-1571019613454-1cb2f99b2d8b'],
    ['photo-1518611012118-696072aa579a','photo-1574680096145-d05b474e2155','photo-1607962837359-5e7e89f86776','photo-1581009137042-c552e485697a','photo-1526506118085-60ce8714f8c5','photo-1550345332-09e3ac987658'],
    ['photo-1605296867304-46d5465a13f1','photo-1562088287-bde35a1ea917','photo-1571019614242-c5c5dee9f50b','photo-1567013127542-490d757e51cd','photo-1584735935682-2f2b69dff9d2','photo-1559841644-08984562005d'],
  ],
  travel: [
    ['photo-1476514525535-07fb3b4ae5f1','photo-1499678329028-101435549a4e','photo-1506905925346-21bda4d32df4','photo-1530521954074-e64f6810b32d','photo-1523906834658-6e24ef2386f9','photo-1527631746610-bca00a040d60'],
    ['photo-1500835556837-99ac94a94552','photo-1488085061387-422e29b40080','photo-1469854523086-cc02fe5d8800','photo-1504150558240-0b4fd8946624','photo-1507525428034-b723cf961d3e','photo-1534430480872-3498386e7856'],
    ['photo-1519451241324-20b4ea2c4220','photo-1513407030348-c983a97b98d8','photo-1502791451862-7bd8c1df43a7','photo-1504019347908-b45f9b0b8dd5','photo-1517760444937-f6397edcbbcd','photo-1533105079780-92b9be482077'],
  ],
  business: [
    ['photo-1486312338219-ce68d2c6f44d','photo-1507679799987-c73779587ccf','photo-1556761175-4b46a572b786','photo-1553484771-371a605b060b','photo-1520333789090-1afc82db536a','photo-1454165804606-c3d57bc86b40'],
    ['photo-1497366216548-37526070297c','photo-1497366754035-f200968a6e72','photo-1504384308090-c894fdcc538d','photo-1522071820081-009f0129c71c','photo-1542744094-3a31f272c490','photo-1560472354-b33ff0c44a43'],
    ['photo-1573165067541-4cd6d9837902','photo-1600880292203-757bb62b4baf','photo-1542744173-8e7e53415bb0','photo-1517245386807-bb43f82c33c4','photo-1521737604893-d14cc237f11d','photo-1519389950473-47ba0277781c'],
  ],
  creative: [
    ['photo-1513364776144-60967b0f800f','photo-1542744094-3a31f272c490','photo-1460661419201-fd4cecdf8a8b','photo-1484480974693-6ca0a78fb36b','photo-1471086569966-db3eebc25a59','photo-1519389950473-47ba0277781c'],
    ['photo-1452802447250-470a88ac82bc','photo-1507838153414-b4b713384a76','photo-1493225457124-a3eb161ffa5f','photo-1511671782779-c97d3d27a1d4','photo-1510915361894-db8b60106cb1','photo-1558618666-fcd25c85cd64'],
    ['photo-1487180144351-b8472da7d491','photo-1516981879613-9f5da904015f','photo-1541961017774-22349e4a1262','photo-1484069560501-87d72b0c3669','photo-1500099817043-86d46000d58f','photo-1524368535928-5b5e00ddc76b'],
  ],
  wellness: [
    ['photo-1544367567-0f2fcb009e0b','photo-1506126613408-eca07ce68773','photo-1498837167922-ddd27525d352','photo-1545205597-3d9d02c29597','photo-1490645935967-10de6ba17061','photo-1447452001602-7090c7ab2db3'],
    ['photo-1552693673-1bf958298935','photo-1518611012118-696072aa579a','photo-1540420773420-3366772f4999','photo-1559839734-2b71ea197ec2','photo-1556228720-da6f66e1e2c2','photo-1512621776951-a57141f2eefd'],
    ['photo-1571019613576-2b22c76fd955','photo-1598300042247-d088f8ab3a91','photo-1599901860904-17e6ed7083a0','photo-1531171673193-06cc8b0b17ed','photo-1497366811353-6870744d04b2','photo-1540206395-68808572332f'],
  ],
  coding: [
    ['photo-1555066931-4365d14bab8c','photo-1461749280684-dccba630e2f6','photo-1517694712202-14dd9538aa97','photo-1498050108023-c5249f4df085','photo-1542831371-29b0f74f9713','photo-1537432376769-00f5c2f4c8d2'],
    ['photo-1484417894907-623942c8ee29','photo-1629904853893-c2c8981a1dc5','photo-1593720213428-28a5b9e94613','photo-1607798748738-b15c40d33d57','photo-1571171637578-41bc2dd41cd2','photo-1526374965328-7f61d4dc18c5'],
    ['photo-1518770660439-4636190af475','photo-1451187580459-43490279c0fa','photo-1550439062-609e1531270e','photo-1523800503107-5bc3ba2a6f81','photo-1563986768609-322da13575f3','photo-1504868584819-f8e8b4b6d7e3'],
  ],
  default: [
    ['photo-1499346030926-9a72daac6c63','photo-1502139214982-d0ad755818d8','photo-1483728642387-6c3bdd6c93e5','photo-1455390582262-044cdead277a','photo-1504805572947-34fad45aed93','photo-1511367461989-f85a21fda167'],
    ['photo-1518495973542-4542c06a5843','photo-1504196606672-aef5c9cefc92','photo-1519834785169-98be25ec3f84','photo-1532274402911-5a369e4c4bb5','photo-1473621038790-b778b4282e68','photo-1476611338391-6f395a0ebc7b'],
    ['photo-1495616811223-4d98c6e9c869','photo-1470770841072-f978cf4d019e','photo-1501854140801-50d01698950b','photo-1500534314209-a25ddb2bd429','photo-1465146344425-f00d5f5c8f07','photo-1444464666168-49d633b86797'],
  ],
}

function getSetIndex(goal: any, regen: number): number {
  return regen % 3
}

function getCollageImgs(goal: any, regenCount: number): string[] {
  const t = (goal?.title || '').toLowerCase()
  const c = (goal?.category || '').toLowerCase()
  let key = 'default'
  if (t.includes('run') || t.includes('marathon') || t.includes('race')) key = 'running'
  else if (t.includes('cod') || t.includes('program') || t.includes('develop') || t.includes('software')) key = 'coding'
  else if (t.includes('gym') || t.includes('fit') || t.includes('weight') || c.includes('health')) key = 'fitness'
  else if (t.includes('travel') || t.includes('trip') || c.includes('travel')) key = 'travel'
  else if (t.includes('business') || t.includes('startup') || c.includes('career')) key = 'business'
  else if (t.includes('creat') || t.includes('art') || t.includes('music') || t.includes('write')) key = 'creative'
  else if (t.includes('health') || t.includes('wellnes') || t.includes('meditat')) key = 'wellness'
  const sets = COLLAGE_SETS[key]
  return sets[getSetIndex(goal, regenCount)]
}

export default function ArtPage() {
  const supabase = createClient()
  const [goals, setGoals] = useState<any[]>([])
  const [selectedGoal, setSelectedGoal] = useState<any>(null)
  const [regenCount, setRegenCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: gs } = await supabase.from('goals').select('*').eq('user_id', user.id).eq('is_active', true).order('created_at', { ascending: false })
      setGoals(gs || [])
      if (gs?.length) {
        setSelectedGoal(gs[0])
        setRegenCount(gs[0].vision_board_regenerations || 0)
      }
      setLoading(false)
    }
    load()
  }, [])

  const regenerate = async () => {
    if (!selectedGoal) return
    const newCount = regenCount + 1
    setRegenCount(newCount)
    await supabase.from('goals').update({
      vision_board_regenerations: newCount,
      vision_board_last_generated: new Date().toISOString(),
    }).eq('id', selectedGoal.id)
    toast.success('Vision board refreshed!')
  }

  const selectGoal = (g: any) => {
    setSelectedGoal(g)
    setRegenCount(g.vision_board_regenerations || 0)
  }

  if (loading) return <div className="text-[#999] text-[14px]">Loading...</div>

  if (!selectedGoal) return (
    <div className="fade-up">
      <h1 className="font-serif text-[32px] mb-1">Vision Board</h1>
      <p className="text-[14px] text-[#666] mb-6">Create a goal to generate your personal vision board.</p>
      <Link href="/onboarding" className="inline-block px-5 py-2.5 bg-[#111] text-white rounded-xl text-[13px] font-medium">Create goal →</Link>
    </div>
  )

  const imgs = getCollageImgs(selectedGoal, regenCount)

  return (
    <div className="fade-up max-w-[900px]">
      <div className="flex items-start justify-between mb-1 flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-[32px] mb-1">Vision Board</h1>
          <p className="text-[14px] text-[#666]">Your visual world — curated around <em>{selectedGoal.title}</em></p>
        </div>
        <button onClick={regenerate}
          className="flex items-center gap-2 px-4 py-2.5 border border-[#e8e8e8] rounded-xl text-[13px] font-medium hover:bg-[#f8f7f5] transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          Regenerate
        </button>
      </div>

      {/* Goal tabs if multiple goals */}
      {goals.length > 1 && (
        <div className="flex gap-2 mb-6 flex-wrap mt-4">
          {goals.map(g => (
            <button key={g.id} onClick={() => selectGoal(g)}
              className={`px-4 py-2 rounded-full text-[13px] border transition-all ${selectedGoal?.id === g.id ? 'bg-[#111] text-white border-[#111]' : 'bg-white text-[#666] border-[#e8e8e8] hover:border-[#d0d0d0]'}`}>
              {(g.display_title || g.title).slice(0, 28)}{(g.display_title || g.title).length > 28 ? '…' : ''}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
        {/* LEFT — Collage */}
        <div>
          <div className="grid grid-cols-3 gap-1.5 rounded-2xl overflow-hidden mb-1.5">
            {/* Large top-left spanning 2 rows */}
            <div className="col-span-2 overflow-hidden" style={{ aspectRatio: '1/1', gridRow: 'span 2' }}>
              <img src={`https://images.unsplash.com/${imgs[0]}?w=500&h=500&fit=crop&crop=center`}
                alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"/>
            </div>
            <div className="overflow-hidden" style={{ aspectRatio: '1/1' }}>
              <img src={`https://images.unsplash.com/${imgs[1]}?w=250&h=250&fit=crop&crop=center`}
                alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"/>
            </div>
            <div className="overflow-hidden" style={{ aspectRatio: '1/1' }}>
              <img src={`https://images.unsplash.com/${imgs[2]}?w=250&h=250&fit=crop&crop=center`}
                alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"/>
            </div>
            {/* Bottom row: 3 equal */}
            <div className="overflow-hidden" style={{ aspectRatio: '1/1' }}>
              <img src={`https://images.unsplash.com/${imgs[3]}?w=250&h=250&fit=crop&crop=center`}
                alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"/>
            </div>
            <div className="overflow-hidden" style={{ aspectRatio: '1/1' }}>
              <img src={`https://images.unsplash.com/${imgs[4]}?w=250&h=250&fit=crop&crop=center`}
                alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"/>
            </div>
            <div className="overflow-hidden" style={{ aspectRatio: '1/1' }}>
              <img src={`https://images.unsplash.com/${imgs[5]}?w=250&h=250&fit=crop&crop=center`}
                alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"/>
            </div>
          </div>
          {/* Affirmation */}
          <div className="bg-[#111] rounded-2xl p-5">
            <p className="text-[10px] font-medium tracking-[.12em] uppercase text-[#b8922a] mb-2">Daily affirmation</p>
            <p className="font-serif italic text-[16px] text-white leading-[1.6]">"{selectedGoal.affirmation}"</p>
          </div>
        </div>

        {/* RIGHT — Info */}
        <div className="space-y-4">
          <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5">
            <p className="text-[10px] font-medium tracking-[.12em] uppercase text-[#b8922a] mb-2">Vision scene</p>
            <p className="font-serif italic text-[20px] leading-tight mb-2">{selectedGoal.art_title || selectedGoal.title}</p>
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

          <Link href="/dashboard/print"
            className="block w-full py-3 bg-[#b8922a] text-white rounded-xl text-[13px] font-medium text-center hover:bg-[#9a7820] transition-colors">
            Order a print →
          </Link>
        </div>
      </div>
    </div>
  )
}
