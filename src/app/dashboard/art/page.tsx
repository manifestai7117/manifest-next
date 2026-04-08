'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import toast from 'react-hot-toast'

// Extract smart search keywords from goal title
// Returns array of 6 different search terms — each specific to the goal
function getSearchTerms(goal: any, regenCount: number): string[] {
  const t = (goal?.title || '').toLowerCase()
  const c = (goal?.category || '').toLowerCase()
  const why = (goal?.why || '').toLowerCase()

  // Sports detection
  const sports: Record<string, string[]> = {
    tennis: ['tennis court sunset','tennis racket ball','tennis player training','tennis match competition','tennis practice court','tennis serve action'],
    golf: ['golf course fairway','golf swing sunset','golf green hole flag','golf ball fairway','golf training practice','golf tournament course'],
    basketball: ['basketball court hoop','basketball training dribble','basketball slam dunk','basketball player practice','basketball game action','basketball court night'],
    soccer: ['soccer field sunset','soccer ball training','soccer player dribbling','soccer match stadium','soccer practice drill','soccer goal celebration'],
    football: ['football field lights','football player running','football practice drill','football stadium crowd','football touchdown moment','football team training'],
    swimming: ['swimming pool lane','swimmer racing water','swimming training pool','swim competition race','swimmer diving pool','swimming underwater blue'],
    cycling: ['cycling road mountain','cyclist racing road','bicycle trail outdoor','cycling training route','cyclist mountain road','road cycling sunset'],
    yoga: ['yoga pose sunrise','yoga meditation peace','yoga mat nature','yoga stretch outdoor','yoga practice studio','yoga mindfulness calm'],
    meditation: ['meditation sunrise peaceful','meditation nature calm','mindfulness practice peace','meditation cushion morning','meditation breathing calm','mindfulness outdoor nature'],
    marathon: ['marathon runner finish line','running race crowd','marathon training road','runner silhouette sunrise','marathon race morning','long distance running path'],
    climbing: ['rock climbing wall','mountain climbing adventure','climbing gear outdoor','bouldering climbing gym','rock climbing nature','climbing summit mountain'],
    boxing: ['boxing gym training','boxing ring practice','boxing gloves workout','boxing training session','boxer training bag','boxing fitness training'],
    surfing: ['surfing wave ocean','surfer riding wave','surfing beach sunset','surfboard ocean wave','surfer silhouette sunset','surfing ocean adventure'],
  }

  // Check for specific sport
  for (const [sport, terms] of Object.entries(sports)) {
    if (t.includes(sport)) {
      const offset = regenCount * 2
      return terms.map((term, i) => terms[(i + offset) % terms.length])
    }
  }

  // Category-based terms
  if (t.includes('cod') || t.includes('program') || t.includes('develop') || t.includes('software') || t.includes('tech') || t.includes('app')) {
    const sets = [
      ['coding workspace night','programming dark monitor','developer laptop code','software development desk','coding setup minimal','tech workspace aesthetic'],
      ['code on screen dark','programming multiple monitors','developer home office','laptop code terminal','tech startup workspace','coding late night'],
      ['software engineering desk','programming keyboard dark','developer tools workspace','code review screen','tech office minimal','coding environment setup'],
    ]
    return sets[regenCount % sets.length]
  }

  if (t.includes('run') || t.includes('marathon') || t.includes('5k') || t.includes('10k') || t.includes('race')) {
    const sets = [
      ['runner silhouette sunrise','running road morning','marathon finish line','running shoes pavement','runner trail forest','running motivation path'],
      ['running track stadium','marathon training road','runner misty morning','running shoes closeup','trail running mountain','runner city bridge'],
      ['running race crowd','early morning run','runner shadow road','marathon runner pack','running motivation quote','runner finish line triumph'],
    ]
    return sets[regenCount % sets.length]
  }

  if (t.includes('gym') || t.includes('fit') || t.includes('muscle') || t.includes('weight') || t.includes('body') || t.includes('fat') || t.includes('lean') || t.includes('physique')) {
    const sets = [
      ['gym equipment weights','fitness training barbell','workout motivation gym','fitness aesthetic body','weight training equipment','gym workout session'],
      ['barbell squat rack','fitness gym interior','weight room training','gym motivation equipment','strength training weights','fitness bodybuilding gym'],
      ['dumbbell rack gym','functional fitness training','gym mirror workout','fitness progress journey','strength equipment gym','athletic training gym'],
    ]
    return sets[regenCount % sets.length]
  }

  if (t.includes('travel') || t.includes('trip') || t.includes('visit') || t.includes('explore') || c.includes('travel')) {
    const sets = [
      ['travel adventure landscape','mountain travel scenic','travel destination beautiful','backpacking adventure nature','travel road trip scenic','wanderlust destination explore'],
      ['travel ocean coast cliff','european travel city','travel tropical paradise','adventure travel hiking','travel photography landscape','cultural travel destination'],
      ['travel sunrise mountain','solo travel adventure','travel bucket list scenic','exotic travel destination','travel nature landscape','world travel adventure'],
    ]
    return sets[regenCount % sets.length]
  }

  if (t.includes('business') || t.includes('startup') || t.includes('company') || t.includes('launch') || t.includes('entrepreneur') || t.includes('found')) {
    const sets = [
      ['entrepreneur office city view','startup workspace modern','business success meeting','entrepreneur working laptop','modern office workspace','business growth chart'],
      ['startup office team','entrepreneur vision board','business meeting boardroom','office city skyline view','professional workspace desk','entrepreneur success journey'],
      ['business strategy planning','startup launch moment','entrepreneur morning routine','business office aesthetic','success mindset workspace','professional growth journey'],
    ]
    return sets[regenCount % sets.length]
  }

  if (t.includes('write') || t.includes('novel') || t.includes('book') || t.includes('author') || t.includes('publish')) {
    const sets = [
      ['writing desk morning coffee','author notebook pen','writing inspiration desk','book writing cozy study','typewriter desk vintage','writing creative space'],
      ['books stacked desk lamp','writing journal morning','author desk window view','literary writing space','notebook pen coffee shop','writing cozy atmosphere'],
      ['book manuscript desk','creative writing space','author morning writing','bookshelf writing desk','journaling morning light','writing inspiration cozy'],
    ]
    return sets[regenCount % sets.length]
  }

  if (t.includes('music') || t.includes('sing') || t.includes('guitar') || t.includes('piano') || t.includes('album') || t.includes('band')) {
    const sets = [
      ['guitar music studio','piano keys music','music studio recording','guitar sunset aesthetic','music performance stage','musician practice studio'],
      ['music studio microphone','piano music keys dark','guitar player silhouette','music recording session','stage music performance','musician creating music'],
      ['acoustic guitar close','music studio equipment','piano keys dramatic light','musician stage spotlight','music creation process','guitar music aesthetic'],
    ]
    return sets[regenCount % sets.length]
  }

  if (t.includes('learn') || t.includes('study') || t.includes('degree') || t.includes('course') || t.includes('skill') || t.includes('master')) {
    const sets = [
      ['study desk books morning','learning education books','student studying focused','knowledge books library','study motivation desk','learning growth mindset'],
      ['library books studying','education learning desk','focused study session','books knowledge growth','academic study space','learning journey books'],
      ['study notes desk coffee','knowledge learning path','student motivation books','education desk lamp','study aesthetic morning','learning progress journey'],
    ]
    return sets[regenCount % sets.length]
  }

  if (t.includes('finance') || t.includes('money') || t.includes('invest') || t.includes('save') || t.includes('wealth') || t.includes('income') || t.includes('rich')) {
    const sets = [
      ['financial growth chart','wealth building investment','money success motivation','financial freedom goal','investment growth plant','financial planning desk'],
      ['stock market trading','financial success journey','wealth management desk','money growth investment','financial independence goal','investment portfolio growth'],
      ['financial planning morning','wealth building strategy','money mindset success','financial goal achievement','investment returns growth','financial freedom path'],
    ]
    return sets[regenCount % sets.length]
  }

  if (c.includes('health') || t.includes('health') || t.includes('diet') || t.includes('nutrition') || t.includes('sleep') || t.includes('stress') || t.includes('mental')) {
    const sets = [
      ['healthy lifestyle morning','wellness routine sunrise','healthy food nutrition','mindfulness nature calm','healthy living outdoor','wellness morning routine'],
      ['healthy breakfast morning','wellness practice yoga','nature walk mindfulness','healthy lifestyle choice','morning routine wellness','clean eating healthy food'],
      ['wellness spa calm','healthy mind body spirit','nature therapy calm','mindfulness practice morning','healthy lifestyle motivation','wellness journey path'],
    ]
    return sets[regenCount % sets.length]
  }

  // Generic but goal-aware default — extract key nouns from title
  const titleWords = goal.title.split(' ')
    .filter((w: string) => w.length > 3 && !['want','will','from','with','into','that','this','your','have','been','goal'].includes(w.toLowerCase()))
    .slice(0, 3)
    .join(' ')

  const defaults = [
    [`${titleWords} motivation inspiration`, 'goal achievement success', 'personal growth journey', 'success mindset motivation', 'achievement celebration moment', 'goal progress milestone'],
    [`${titleWords} success journey`, 'motivation determination focus', 'goal setting achievement', 'personal development growth', 'success celebration moment', 'achievement milestone path'],
    [`${titleWords} progress journey`, 'achievement success path', 'growth mindset motivation', 'goal achievement celebration', 'personal success journey', 'determination focus success'],
  ]
  return defaults[regenCount % defaults.length]
}

// Build Unsplash source URL — unique per position using seed
function imgUrl(searchTerm: string, seed: number, w = 800, h = 800): string {
  const encoded = encodeURIComponent(searchTerm.trim())
  return `https://source.unsplash.com/featured/${w}x${h}/?${encoded}&sig=${seed}`
}

export default function ArtPage() {
  const supabase = createClient()
  const [goals, setGoals] = useState<any[]>([])
  const [selectedGoal, setSelectedGoal] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [regenCount, setRegenCount] = useState(0)
  const [imgSeeds, setImgSeeds] = useState<number[]>([1,2,3,4,5,6])
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
        const rc = g.vision_board_regenerations || 0
        setRegenCount(rc)
        setImgSeeds(Array.from({length: 6}, (_, i) => rc * 100 + i + 1))
      }
      setLoading(false)
    }
    load()
  }, [])

  const selectGoal = (g: any) => {
    setSelectedGoal(g)
    const rc = g.vision_board_regenerations || 0
    setRegenCount(rc)
    setImgSeeds(Array.from({length: 6}, (_, i) => rc * 100 + i + 1))
    if (typeof window !== 'undefined') localStorage.setItem('selectedGoalId', g.id)
  }

  const generate = async () => {
    if (!selectedGoal || generating) return
    setGenerating(true)
    const newCount = regenCount + 1
    // New seeds = completely different images
    setRegenCount(newCount)
    setImgSeeds(Array.from({length: 6}, (_, i) => newCount * 100 + i + Date.now() % 100))
    try {
      await supabase.from('goals').update({
        vision_board_regenerations: newCount,
        vision_board_last_generated: new Date().toISOString(),
      }).eq('id', selectedGoal.id)
      const updated = { ...selectedGoal, vision_board_regenerations: newCount }
      setSelectedGoal(updated)
      setGoals(gs => gs.map(g => g.id === selectedGoal.id ? updated : g))
      toast.success('Vision board refreshed with new images!')
    } catch {}
    setGenerating(false)
  }

  const downloadCollage = () => {
    const isPro = profile?.plan === 'pro' || profile?.plan === 'pro_trial'
    if (!isPro) { toast.error('Download is a Pro feature — upgrade to access'); return }
    const terms = getSearchTerms(selectedGoal, regenCount)
    const win = window.open('', '_blank')
    if (!win) { toast.error('Please allow popups'); return }
    const imgs = terms.map((term, i) => imgUrl(term, imgSeeds[i], 600, 600))
    win.document.write(`<!DOCTYPE html><html><head><style>
      *{margin:0;padding:0;box-sizing:border-box}body{background:#f8f7f5;font-family:'Georgia',serif}
      .grid{display:grid;grid-template-columns:2fr 1fr;grid-template-rows:1fr 1fr;width:900px;height:600px;gap:4px}
      .big{grid-row:span 2}.cell{overflow:hidden}img{width:100%;height:100%;object-fit:cover;display:block}
      .bottom{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;width:900px}
      .bottom .cell{height:300px}.caption{background:#111;color:white;padding:20px;font-style:italic;font-size:15px;width:900px}
    </style></head><body>
      <div class="grid">
        <div class="big cell"><img src="${imgs[0]}"/></div>
        <div class="cell"><img src="${imgs[1]}"/></div>
        <div class="cell"><img src="${imgs[2]}"/></div>
      </div>
      <div class="bottom">
        <div class="cell"><img src="${imgs[3]}"/></div>
        <div class="cell"><img src="${imgs[4]}"/></div>
        <div class="cell"><img src="${imgs[5]}"/></div>
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

  const terms = getSearchTerms(selectedGoal, regenCount)
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Collage */}
        <div ref={collageRef}>
          {/* Main 2-col grid — top row */}
          <div className="rounded-t-2xl overflow-hidden" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gridTemplateRows: '1fr 1fr', gap: '4px', aspectRatio: '3/2' }}>
            {/* Large left — spans 2 rows */}
            <div style={{ gridRow: 'span 2', overflow: 'hidden' }}>
              <img
                src={imgUrl(terms[0], imgSeeds[0], 600, 600)}
                alt=""
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                style={{ display: 'block' }}
                onError={(e) => { (e.target as HTMLImageElement).src = `https://source.unsplash.com/featured/600x600/?${encodeURIComponent(selectedGoal.title)}&sig=${imgSeeds[0]+50}` }}
              />
            </div>
            {/* Two small right */}
            <div style={{ overflow: 'hidden' }}>
              <img
                src={imgUrl(terms[1], imgSeeds[1], 300, 300)}
                alt=""
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                style={{ display: 'block' }}
                onError={(e) => { (e.target as HTMLImageElement).src = `https://source.unsplash.com/featured/300x300/?${encodeURIComponent(selectedGoal.title)}&sig=${imgSeeds[1]+50}` }}
              />
            </div>
            <div style={{ overflow: 'hidden' }}>
              <img
                src={imgUrl(terms[2], imgSeeds[2], 300, 300)}
                alt=""
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                style={{ display: 'block' }}
                onError={(e) => { (e.target as HTMLImageElement).src = `https://source.unsplash.com/featured/300x300/?${encodeURIComponent(selectedGoal.title)}&sig=${imgSeeds[2]+50}` }}
              />
            </div>
          </div>
          {/* Bottom row — 3 equal */}
          <div className="rounded-b-2xl overflow-hidden mb-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', marginTop: '4px' }}>
            {[3,4,5].map((idx) => (
              <div key={idx} style={{ aspectRatio: '1/1', overflow: 'hidden' }}>
                <img
                  src={imgUrl(terms[idx], imgSeeds[idx], 300, 300)}
                  alt=""
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                  style={{ display: 'block' }}
                  onError={(e) => { (e.target as HTMLImageElement).src = `https://source.unsplash.com/featured/300x300/?${encodeURIComponent(selectedGoal.title)}&sig=${imgSeeds[idx]+50}` }}
                />
              </div>
            ))}
          </div>

          {/* Affirmation */}
          <div className="bg-[#111] rounded-2xl p-4">
            <p className="text-[10px] font-medium tracking-[.12em] uppercase text-[#b8922a] mb-2">Daily affirmation</p>
            <p className="font-serif italic text-[15px] text-white leading-[1.6]">"{selectedGoal.affirmation}"</p>
          </div>

          {!isPro && (
            <p className="text-[11px] text-[#999] mt-2 text-center">
              <Link href="/dashboard/upgrade" className="text-[#b8922a] hover:underline">Upgrade to Pro</Link> to download your board
            </p>
          )}
        </div>

        {/* Info panel */}
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
            <p className="text-[11px] text-[#999]">Refreshed {regenCount} time{regenCount !== 1 ? 's' : ''} · different images every time</p>
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
