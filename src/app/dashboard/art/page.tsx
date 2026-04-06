'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import toast from 'react-hot-toast'

const ART_THEMES: Record<string, { bg: string; accent: string; light: string }> = {
  'Minimal & clean':    { bg: '#f0ede6', accent: '#8a7a5a', light: '#e0d9cc' },
  'Bold & dark':        { bg: '#0d1117', accent: '#c9a84c', light: '#1a2332' },
  'Warm & natural':     { bg: '#2d1a0e', accent: '#d4845a', light: '#3d2a1a' },
  'Bright & energetic': { bg: '#051428', accent: '#4a9eff', light: '#0a2040' },
}

// Renders a visual scene based on goal category and user description
function VisionArtCanvas({ goal }: { goal: any }) {
  const theme = ART_THEMES[goal.aesthetic] || ART_THEMES['Bold & dark']
  const isDark = goal.aesthetic !== 'Minimal & clean'
  const fg = isDark ? 'rgba(255,255,255,.9)' : '#111'
  const fgMuted = isDark ? 'rgba(255,255,255,.5)' : 'rgba(0,0,0,.45)'
  const cat = goal.category?.toLowerCase() || ''
  const gender = goal.user_gender?.toLowerCase() || 'person'
  const isMan = gender.includes('man') || gender === 'male'
  const isWoman = gender.includes('woman') || gender === 'female'
  const skinBase = getSkinColor(goal.user_ethnicity)

  // Pick scene based on category
  const scene = getScene(cat, goal.title?.toLowerCase() || '')

  return (
    <div className="rounded-2xl overflow-hidden relative" style={{ background: theme.bg, aspectRatio: '3/4' }}>
      <svg viewBox="0 0 300 400" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        {/* Background environment */}
        {scene.bg(theme, isDark)}

        {/* Human figure */}
        {renderFigure(scene.pose, skinBase, theme, isWoman, isDark)}

        {/* Scene elements */}
        {scene.elements(theme, isDark)}

        {/* Overlay gradient for text */}
        <defs>
          <linearGradient id="overlay" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="transparent"/>
            <stop offset="60%" stopColor="transparent"/>
            <stop offset="100%" stopColor={isDark ? 'rgba(0,0,0,.75)' : 'rgba(0,0,0,.5)'}/>
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="300" height="400" fill="url(#overlay)"/>

        {/* Title */}
        <text x="150" y="355" textAnchor="middle" fill={fg} fontSize="13" fontFamily="Georgia, serif" fontStyle="italic" fontWeight="400">
          {truncate(goal.art_title || goal.title, 28)}
        </text>
        <text x="150" y="375" textAnchor="middle" fill={fgMuted} fontSize="9" fontFamily="system-ui, sans-serif" letterSpacing="2">
          MANIFEST
        </text>
      </svg>

      {/* Aesthetic badge */}
      <div className="absolute top-3 right-3 text-[9px] font-medium px-2 py-1 rounded-full" style={{ background: isDark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.1)', color: isDark ? 'rgba(255,255,255,.6)' : 'rgba(0,0,0,.5)' }}>
        {goal.aesthetic}
      </div>
    </div>
  )
}

function getSkinColor(ethnicity?: string) {
  const e = ethnicity?.toLowerCase() || ''
  if (e.includes('asian') || e.includes('south asian')) return { skin: '#C68642', hair: '#1a0a00', shadow: '#8B5A2B' }
  if (e.includes('black') || e.includes('african')) return { skin: '#6B3A2A', hair: '#0d0d0d', shadow: '#4a2218' }
  if (e.includes('hispanic') || e.includes('latino')) return { skin: '#C08560', hair: '#2d1500', shadow: '#8B6040' }
  if (e.includes('middle eastern')) return { skin: '#C8A882', hair: '#1a0800', shadow: '#9a7a5a' }
  return { skin: '#D4956A', hair: '#3d2000', shadow: '#a06840' } // default warm
}

function truncate(str: string, n: number) {
  return str.length > n ? str.slice(0, n - 1) + '…' : str
}

function getScene(category: string, title: string) {
  // Running / marathon
  if (category.includes('health') || title.includes('run') || title.includes('marathon') || title.includes('fitness') || title.includes('gym')) {
    return {
      pose: 'run',
      bg: (t: any, dark: boolean) => (
        <>
          <rect x="0" y="0" width="300" height="400" fill={t.bg}/>
          {/* Road */}
          <ellipse cx="150" cy="320" rx="200" ry="40" fill={dark ? '#1a2a1a' : '#d4e4d4'} opacity="0.6"/>
          {/* Sun/light */}
          <circle cx="240" cy="60" r="35" fill={dark ? '#c9a84c' : '#ffd700'} opacity="0.3"/>
          <circle cx="240" cy="60" r="22" fill={dark ? '#c9a84c' : '#ffd700'} opacity="0.5"/>
          {/* Trees */}
          <rect x="20" y="180" width="8" height="80" fill={dark?'#2a4a2a':'#5a8a5a'}/>
          <ellipse cx="24" cy="175" rx="20" ry="25" fill={dark?'#1a3a1a':'#4a7a4a'}/>
          <rect x="260" y="200" width="6" height="70" fill={dark?'#2a4a2a':'#5a8a5a'}/>
          <ellipse cx="263" cy="195" rx="16" ry="20" fill={dark?'#1a3a1a':'#4a7a4a'}/>
          {/* Finish line */}
          <rect x="100" y="270" width="4" height="60" fill={dark?'rgba(255,255,255,.4)':'rgba(0,0,0,.3)'}/>
          <rect x="196" y="270" width="4" height="60" fill={dark?'rgba(255,255,255,.4)':'rgba(0,0,0,.3)'}/>
          <rect x="100" y="270" width="100" height="6" fill={dark?'rgba(255,255,255,.4)':'rgba(0,0,0,.3)'}/>
          {/* Crowd dots */}
          {[130,145,160,175,190].map((x,i) => <circle key={i} cx={x} cy={240+(i%2)*8} r="4" fill={dark?'rgba(255,255,255,.15)':'rgba(0,0,0,.1)'}/>)}
        </>
      ),
      elements: (t: any, dark: boolean) => (
        <>
          {/* Motion lines */}
          <line x1="60" y1="200" x2="90" y2="198" stroke={dark?'rgba(255,255,255,.1)':'rgba(0,0,0,.08)'} strokeWidth="2"/>
          <line x1="55" y1="215" x2="82" y2="213" stroke={dark?'rgba(255,255,255,.1)':'rgba(0,0,0,.08)'} strokeWidth="1.5"/>
        </>
      )
    }
  }

  // Business / startup / career
  if (category.includes('career') || category.includes('business') || title.includes('launch') || title.includes('startup') || title.includes('business')) {
    return {
      pose: 'present',
      bg: (t: any, dark: boolean) => (
        <>
          <rect x="0" y="0" width="300" height="400" fill={t.bg}/>
          {/* Office window */}
          <rect x="0" y="0" width="300" height="220" fill={dark?'#0a1520':'#e8f0f8'} opacity="0.4"/>
          {/* City skyline */}
          {[[30,120,40,220],[80,90,35,220],[130,80,30,220],[175,100,40,220],[225,70,30,220],[260,110,35,220]].map(([x,h,w,b],i)=>(
            <rect key={i} x={x} y={b-h} width={w} height={h} fill={dark?'rgba(255,255,255,.06)':'rgba(0,0,50,.08)'}/>
          ))}
          {/* Desk */}
          <rect x="30" y="280" width="240" height="12" rx="2" fill={dark?'#2a3a4a':'#c8b89a'}/>
          {/* Monitor */}
          <rect x="100" y="210" width="100" height="70" rx="4" fill={dark?'#0d2030':'#e0e8f0'} stroke={dark?'#2a4a6a':'#c0ccd8'} strokeWidth="2"/>
          <rect x="108" y="218" width="84" height="54" rx="2" fill={dark?'rgba(74,158,255,.15)':'rgba(30,100,200,.1)'}/>
          {/* Chart on screen */}
          {[0,1,2,3,4].map(i=>(
            <rect key={i} x={115+i*14} y={250-i*6} width="10" height={10+i*6} rx="1" fill={dark?'rgba(74,158,255,.5)':'rgba(30,100,200,.4)'}/>
          ))}
          {/* Laptop */}
          <rect x="60" y="265" width="70" height="16" rx="2" fill={dark?'#2a3a4a':'#d0c8b8'}/>
          <rect x="55" y="281" width="80" height="3" rx="1" fill={dark?'#1a2a3a':'#b0a898'}/>
        </>
      ),
      elements: (t: any, dark: boolean) => (
        <>
          {/* Upward arrow */}
          <path d="M240 100 L255 80 L270 100" stroke={dark?'rgba(74,158,255,.4)':'rgba(30,100,200,.3)'} strokeWidth="2" fill="none"/>
          <line x1="255" y1="80" x2="255" y2="130" stroke={dark?'rgba(74,158,255,.4)':'rgba(30,100,200,.3)'} strokeWidth="2"/>
        </>
      )
    }
  }

  // Finance / savings / wealth
  if (category.includes('financial') || title.includes('save') || title.includes('money') || title.includes('invest') || title.includes('wealth')) {
    return {
      pose: 'celebrate',
      bg: (t: any, dark: boolean) => (
        <>
          <rect x="0" y="0" width="300" height="400" fill={t.bg}/>
          {/* Gold coins */}
          {[[80,300],[120,310],[160,305],[200,300],[240,308]].map(([x,y],i)=>(
            <ellipse key={i} cx={x} cy={y} rx="18" ry="8" fill={dark?'#c9a84c':'#d4a444'} opacity="0.7"/>
          ))}
          {[[95,294],[135,302],[175,298],[215,294]].map(([x,y],i)=>(
            <ellipse key={i} cx={x} cy={y} rx="15" ry="7" fill={dark?'#e0c060':'#e8b840'} opacity="0.5"/>
          ))}
          {/* Growth chart background */}
          <path d="M40 260 L80 230 L130 200 L180 160 L230 130 L270 100" stroke={dark?'rgba(201,168,76,.3)':'rgba(180,140,40,.25)'} strokeWidth="2" fill="none"/>
          {/* Building */}
          <rect x="20" y="180" width="40" height="140" fill={dark?'rgba(255,255,255,.04)':'rgba(0,0,0,.06)'}/>
          <rect x="250" y="200" width="35" height="120" fill={dark?'rgba(255,255,255,.04)':'rgba(0,0,0,.06)'}/>
          {/* Dollar signs floating */}
          <text x="50" y="160" fill={dark?'rgba(201,168,76,.25)':'rgba(180,140,40,.2)'} fontSize="20" fontFamily="Georgia,serif">$</text>
          <text x="220" y="170" fill={dark?'rgba(201,168,76,.25)':'rgba(180,140,40,.2)'} fontSize="16" fontFamily="Georgia,serif">$</text>
          <text x="140" y="140" fill={dark?'rgba(201,168,76,.3)':'rgba(180,140,40,.25)'} fontSize="24" fontFamily="Georgia,serif">$</text>
        </>
      ),
      elements: (t: any, dark: boolean) => (
        <path d="M40 260 L80 230 L130 200 L180 160 L230 130 L270 100" stroke={dark?'rgba(201,168,76,.6)':'rgba(180,140,40,.5)'} strokeWidth="2.5" fill="none" strokeDasharray="4,2"/>
      )
    }
  }

  // Creative / writing / art
  if (category.includes('creative') || title.includes('write') || title.includes('novel') || title.includes('art') || title.includes('music')) {
    return {
      pose: 'create',
      bg: (t: any, dark: boolean) => (
        <>
          <rect x="0" y="0" width="300" height="400" fill={t.bg}/>
          {/* Writing desk */}
          <rect x="40" y="270" width="220" height="10" rx="2" fill={dark?'#3a2a1a':'#c8a870'}/>
          {/* Paper/canvas */}
          <rect x="80" y="180" width="140" height="100" rx="3" fill={dark?'rgba(255,255,255,.08)':'rgba(255,255,255,.9)'} stroke={dark?'rgba(255,255,255,.15)':'rgba(0,0,0,.1)'} strokeWidth="1"/>
          {/* Writing lines */}
          {[195,207,219,231,243].map((y,i)=>(
            <line key={i} x1="92" y1={y} x2={160+i*5} y2={y} stroke={dark?'rgba(255,255,255,.15)':'rgba(0,0,0,.12)'} strokeWidth="1"/>
          ))}
          {/* Pen */}
          <rect x="198" y="175" width="4" height="30" rx="2" transform="rotate(-20, 200, 190)" fill={dark?'#c9a84c':'#b8922a'}/>
          {/* Lamp */}
          <line x1="60" y1="150" x2="60" y2="270" stroke={dark?'rgba(255,255,255,.15)':'rgba(0,0,0,.2)'} strokeWidth="3"/>
          <ellipse cx="60" cy="150" rx="30" ry="12" fill={dark?'rgba(255,255,255,.05)':'rgba(255,220,100,.2)'} stroke={dark?'rgba(255,255,255,.1)':'rgba(0,0,0,.1)'} strokeWidth="1"/>
          {/* Light cone */}
          <path d="M40 162 L30 270 L90 270 L80 162" fill={dark?'rgba(255,220,100,.03)':'rgba(255,220,100,.08)'}/>
          {/* Bookshelf */}
          {[[230,150,'#8a4a2a'],[238,155,'#2a5a8a'],[246,148,'#2a8a4a'],[254,153,'#8a7a2a']].map(([x,y,c],i)=>(
            <rect key={i} x={Number(x)} y={Number(y)} width="6" height="120" rx="1" fill={String(c)} opacity={dark?0.4:0.5}/>
          ))}
        </>
      ),
      elements: (t: any, dark: boolean) => (
        <>
          <circle cx="150" cy="100" r="3" fill={dark?'rgba(255,220,100,.3)':'rgba(255,180,0,.3)'}/>
          <circle cx="165" cy="88" r="2" fill={dark?'rgba(255,220,100,.2)':'rgba(255,180,0,.2)'}/>
          <circle cx="135" cy="92" r="2" fill={dark?'rgba(255,220,100,.2)':'rgba(255,180,0,.2)'}/>
        </>
      )
    }
  }

  // Travel
  if (category.includes('travel') || title.includes('travel') || title.includes('trip') || title.includes('visit')) {
    return {
      pose: 'explore',
      bg: (t: any, dark: boolean) => (
        <>
          <rect x="0" y="0" width="300" height="250" fill={dark?'#051428':'#87CEEB'} opacity="0.9"/>
          <rect x="0" y="220" width="300" height="180" fill={dark?'#0a1e0a':'#228B22'} opacity="0.6"/>
          {/* Mountains */}
          <polygon points="0,220 80,100 160,220" fill={dark?'#1a2a3a':'#8a9aaa'} opacity="0.7"/>
          <polygon points="100,220 200,80 300,220" fill={dark?'#142030':'#7a8a9a'} opacity="0.8"/>
          {/* Snow caps */}
          <polygon points="70,115 80,100 90,115" fill={dark?'rgba(255,255,255,.4)':'rgba(255,255,255,.8)'}/>
          <polygon points="190,95 200,80 210,95" fill={dark?'rgba(255,255,255,.4)':'rgba(255,255,255,.8)'}/>
          {/* Sun */}
          <circle cx="250" cy="60" r="28" fill={dark?'rgba(201,168,76,.3)':'rgba(255,200,50,.6)'}/>
          <circle cx="250" cy="60" r="18" fill={dark?'rgba(201,168,76,.5)':'rgba(255,215,0,.8)'}/>
          {/* Path */}
          <path d="M120 280 Q150 260 180 290 Q200 310 230 300" stroke={dark?'rgba(201,168,76,.3)':'rgba(100,60,0,.3)'} strokeWidth="3" fill="none" strokeDasharray="6,4"/>
        </>
      ),
      elements: (t: any, dark: boolean) => (
        <>
          <text x="25" y="95" fill={dark?'rgba(255,255,255,.2)':'rgba(0,0,0,.15)'} fontSize="14">✈</text>
          <text x="250" y="160" fill={dark?'rgba(255,255,255,.15)':'rgba(0,0,0,.12)'} fontSize="12">✈</text>
        </>
      )
    }
  }

  // Default — personal growth / relationships
  return {
    pose: 'celebrate',
    bg: (t: any, dark: boolean) => (
      <>
        <rect x="0" y="0" width="300" height="400" fill={t.bg}/>
        {/* Abstract circles — growth rings */}
        {[120,100,80,60,40].map((r,i) => (
          <circle key={i} cx="150" cy="170" r={r} fill="none" stroke={dark?`rgba(201,168,76,${0.05+i*0.03})`:`rgba(100,80,20,${0.04+i*0.025})`} strokeWidth="1.5"/>
        ))}
        {/* Light rays */}
        {[0,30,60,90,120,150,180,210,240,270,300,330].map((deg,i) => {
          const rad = (deg * Math.PI) / 180
          return <line key={i} x1={150+40*Math.cos(rad)} y1={170+40*Math.sin(rad)} x2={150+130*Math.cos(rad)} y2={170+130*Math.sin(rad)} stroke={dark?`rgba(201,168,76,${0.04+i%3*0.02})`:`rgba(180,140,40,${0.03+i%3*0.015})`} strokeWidth="1"/>
        })}
        {/* Ground */}
        <ellipse cx="150" cy="320" rx="120" ry="20" fill={dark?'rgba(255,255,255,.04)':'rgba(0,0,0,.06)'}/>
      </>
    ),
    elements: (t: any, dark: boolean) => (
      <>
        <text x="138" y="180" fill={dark?'rgba(201,168,76,.5)':'rgba(180,140,40,.4)'} fontSize="28">✦</text>
      </>
    )
  }
}

function renderFigure(pose: string, colors: any, theme: any, isWoman: boolean, isDark: boolean) {
  const { skin, hair, shadow } = colors
  const cy = pose === 'run' ? 200 : pose === 'present' ? 195 : 210
  const hairStyle = isWoman

  if (pose === 'run') {
    return (
      <g transform="translate(130, 140) scale(0.9)">
        {/* Shadow */}
        <ellipse cx="30" cy="155" rx="25" ry="6" fill="rgba(0,0,0,.2)"/>
        {/* Body - running pose */}
        <ellipse cx="30" cy="60" rx="12" ry="14" fill={skin}/>{/* head */}
        {isWoman && <path d="M22 52 Q30 46 38 52" fill={hair} stroke={hair} strokeWidth="1"/>}
        {!isWoman && <path d="M18 56 Q30 48 42 56" fill={hair}/>}
        <rect x="22" y="74" width="16" height="28" rx="4" fill={isDark?'rgba(255,255,255,.15)':'rgba(0,100,200,.25)'}/>{/* torso */}
        {/* Arms swinging */}
        <line x1="22" y1="78" x2="10" y2="95" stroke={skin} strokeWidth="5" strokeLinecap="round"/>
        <line x1="38" y1="78" x2="50" y2="60" stroke={skin} strokeWidth="5" strokeLinecap="round"/>
        {/* Legs running */}
        <line x1="28" y1="102" x2="15" y2="125" stroke={isDark?'rgba(255,255,255,.2)':'rgba(0,0,100,.3)'} strokeWidth="7" strokeLinecap="round"/>
        <line x1="32" y1="102" x2="45" y2="118" stroke={isDark?'rgba(255,255,255,.2)':'rgba(0,0,100,.3)'} strokeWidth="7" strokeLinecap="round"/>
        <line x1="15" y1="125" x2="8" y2="145" stroke={isDark?'rgba(255,255,255,.2)':'rgba(0,0,100,.3)'} strokeWidth="6" strokeLinecap="round"/>
        <line x1="45" y1="118" x2="52" y2="140" stroke={isDark?'rgba(255,255,255,.2)':'rgba(0,0,100,.3)'} strokeWidth="6" strokeLinecap="round"/>
      </g>
    )
  }

  if (pose === 'present') {
    return (
      <g transform="translate(115, 120)">
        <ellipse cx="55" cy="110" rx="30" ry="8" fill="rgba(0,0,0,.15)"/>
        <ellipse cx="55" cy="46" rx="13" ry="15" fill={skin}/>
        {isWoman ? <path d="M42 38 Q55 30 68 38 Q72 50 68 42" fill={hair}/> : <path d="M42 42 Q55 34 68 42" fill={hair}/>}
        <rect x="44" y="61" width="22" height="32" rx="4" fill={isDark?'rgba(255,255,255,.18)':'rgba(30,60,120,.3)'}/>
        {/* Arms - one pointing up at chart */}
        <line x1="44" y1="68" x2="28" y2="52" stroke={skin} strokeWidth="6" strokeLinecap="round"/>
        <line x1="66" y1="68" x2="70" y2="78" stroke={skin} strokeWidth="6" strokeLinecap="round"/>
        {/* Legs standing */}
        <line x1="50" y1="93" x2="47" y2="120" stroke={isDark?'rgba(255,255,255,.2)':'rgba(0,0,80,.25)'} strokeWidth="8" strokeLinecap="round"/>
        <line x1="60" y1="93" x2="63" y2="120" stroke={isDark?'rgba(255,255,255,.2)':'rgba(0,0,80,.25)'} strokeWidth="8" strokeLinecap="round"/>
      </g>
    )
  }

  if (pose === 'create') {
    return (
      <g transform="translate(105, 130)">
        <ellipse cx="60" cy="100" rx="28" ry="7" fill="rgba(0,0,0,.15)"/>
        {/* Seated figure */}
        <ellipse cx="60" cy="32" rx="12" ry="14" fill={skin}/>
        {isWoman ? <path d="M48 25 Q60 18 72 25 Q76 38 48 38 Q44 32 48 25" fill={hair}/> : <path d="M48 28 Q60 20 72 28" fill={hair}/>}
        {/* Torso leaning forward */}
        <rect x="50" y="46" width="20" height="28" rx="4" fill={isDark?'rgba(255,255,255,.15)':'rgba(120,80,40,.3)'}/>
        {/* Arms writing */}
        <line x1="50" y1="52" x2="35" y2="62" stroke={skin} strokeWidth="5" strokeLinecap="round"/>
        <line x1="70" y1="52" x2="80" y2="58" stroke={skin} strokeWidth="5" strokeLinecap="round"/>
        {/* Legs seated */}
        <path d="M52 74 Q48 90 40 95" stroke={isDark?'rgba(255,255,255,.18)':'rgba(0,0,80,.22)'} strokeWidth="8" strokeLinecap="round" fill="none"/>
        <path d="M68 74 Q72 90 80 95" stroke={isDark?'rgba(255,255,255,.18)':'rgba(0,0,80,.22)'} strokeWidth="8" strokeLinecap="round" fill="none"/>
      </g>
    )
  }

  // celebrate / explore / default — arms raised
  return (
    <g transform="translate(115, 130)">
      <ellipse cx="55" cy="130" rx="28" ry="7" fill="rgba(0,0,0,.15)"/>
      <ellipse cx="55" cy="34" rx="13" ry="15" fill={skin}/>
      {isWoman ? <path d="M42 26 Q55 18 68 26 Q72 40 68 30" fill={hair}/> : <path d="M42 30 Q55 22 68 30" fill={hair}/>}
      <rect x="44" y="49" width="22" height="32" rx="4" fill={isDark?'rgba(255,255,255,.16)':'rgba(30,60,120,.28)'}/>
      {/* Arms raised in celebration */}
      <line x1="44" y1="55" x2="22" y2="35" stroke={skin} strokeWidth="6" strokeLinecap="round"/>
      <line x1="66" y1="55" x2="88" y2="35" stroke={skin} strokeWidth="6" strokeLinecap="round"/>
      {/* Legs standing */}
      <line x1="50" y1="81" x2="46" y2="110" stroke={isDark?'rgba(255,255,255,.2)':'rgba(0,0,80,.25)'} strokeWidth="8" strokeLinecap="round"/>
      <line x1="60" y1="81" x2="64" y2="110" stroke={isDark?'rgba(255,255,255,.2)':'rgba(0,0,80,.25)'} strokeWidth="8" strokeLinecap="round"/>
    </g>
  )
}

export default function ArtPage() {
  const supabase = createClient()
  const [goals, setGoals] = useState<any[]>([])
  const [selectedGoal, setSelectedGoal] = useState<any>(null)
  const [regenerating, setRegenerating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      if (!user) return
      const { data: gs } = await supabase.from('goals').select('*').eq('user_id', user.id).eq('is_active', true).order('created_at', { ascending: false })
      setGoals(gs || [])
      if (gs?.length) setSelectedGoal(gs[0])
      setLoading(false)
    }
    load()
  }, [])

  const canRegen = () => {
    if (!selectedGoal?.vision_board_last_generated) return true
    const hours = (Date.now() - new Date(selectedGoal.vision_board_last_generated).getTime()) / 3600000
    return hours >= 24
  }

  const hoursLeft = () => {
    if (!selectedGoal?.vision_board_last_generated) return 0
    const hours = 24 - (Date.now() - new Date(selectedGoal.vision_board_last_generated).getTime()) / 3600000
    return Math.max(0, Math.ceil(hours))
  }

  const regenerate = async () => {
    if (!canRegen()) { toast.error(`Next regeneration in ${hoursLeft()}h`); return }
    if (!selectedGoal) return
    setRegenerating(true)
    try {
      const res = await fetch('/api/goals/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: selectedGoal.title,
          category: selectedGoal.category,
          timeline: selectedGoal.timeline,
          why: selectedGoal.why,
          obstacles: selectedGoal.obstacles,
          aesthetic: selectedGoal.aesthetic,
          userName: user?.user_metadata?.full_name || 'friend',
          successLooks: selectedGoal.success_looks,
          motivator: selectedGoal.motivator,
          coachStyle: selectedGoal.coach_style,
          gender: selectedGoal.user_gender,
          ageRange: selectedGoal.user_age_range,
          ethnicity: selectedGoal.user_ethnicity,
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      await supabase.from('goals').update({
        art_title: data.artTitle,
        art_description: data.artDescription,
        affirmation: data.affirmation,
        vision_art_prompt: data.visionArtPrompt,
        vision_board_last_generated: new Date().toISOString(),
        vision_board_regenerations: (selectedGoal.vision_board_regenerations || 0) + 1,
      }).eq('id', selectedGoal.id)

      const updated = { ...selectedGoal, art_title: data.artTitle, art_description: data.artDescription, affirmation: data.affirmation }
      setSelectedGoal(updated)
      setGoals(gs => gs.map(g => g.id === selectedGoal.id ? updated : g))
      toast.success('New vision art generated!')
    } catch (e: any) {
      toast.error('Generation failed: ' + e.message)
    }
    setRegenerating(false)
  }

  if (loading) return <div className="text-[#999] text-[14px] p-8">Loading...</div>

  return (
    <div className="fade-up max-w-[860px]">
      <h1 className="font-serif text-[32px] mb-1">Vision Art</h1>
      <p className="text-[14px] text-[#666] mb-6">Your personalized goal artwork — designed to be seen every day</p>

      {/* Goal tabs */}
      {goals.length > 1 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          {goals.map(g => (
            <button key={g.id} onClick={() => setSelectedGoal(g)}
              className={`px-4 py-2 rounded-full text-[13px] border transition-all ${selectedGoal?.id === g.id ? 'bg-[#111] text-white border-[#111]' : 'bg-white text-[#666] border-[#e8e8e8] hover:border-[#d0d0d0]'}`}>
              {g.title.length > 28 ? g.title.slice(0, 28) + '…' : g.title}
            </button>
          ))}
        </div>
      )}

      {selectedGoal ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Visual art */}
          <VisionArtCanvas goal={selectedGoal} />

          <div className="space-y-4">
            {/* Art description */}
            <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5">
              <p className="text-[10px] font-medium tracking-[.12em] uppercase text-[#b8922a] mb-2">Vision scene</p>
              <p className="font-serif italic text-[22px] mb-2">{selectedGoal.art_title}</p>
              <p className="text-[13px] text-[#666] leading-[1.65]">{selectedGoal.art_description}</p>
            </div>

            {/* Affirmation */}
            <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5">
              <p className="text-[10px] font-medium tracking-[.12em] uppercase text-[#b8922a] mb-2">Daily affirmation</p>
              <p className="font-serif italic text-[16px] leading-[1.65]">"{selectedGoal.affirmation}"</p>
            </div>

            {/* Style */}
            <div className="bg-white border border-[#e8e8e8] rounded-2xl p-4">
              <p className="font-medium text-[13px] mb-1">Style: {selectedGoal.aesthetic}</p>
              <p className="text-[12px] text-[#666]">Showing you achieving: <em>{selectedGoal.title}</em></p>
            </div>

            <Link href="/dashboard/print" className="block w-full py-3 bg-[#b8922a] text-white rounded-xl text-[13px] font-medium text-center hover:bg-[#9a7820] transition-colors">
              Order a print →
            </Link>

            <button
              onClick={regenerate}
              disabled={regenerating || !canRegen()}
              className="w-full py-3 border border-[#e8e8e8] rounded-xl text-[13px] font-medium hover:bg-[#f8f7f5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {regenerating ? 'Generating...' : canRegen() ? '↺ Generate new concept' : `↺ Available in ${hoursLeft()}h`}
            </button>

            {selectedGoal.vision_board_regenerations > 0 && (
              <p className="text-center text-[11px] text-[#999]">Regenerated {selectedGoal.vision_board_regenerations} time{selectedGoal.vision_board_regenerations !== 1 ? 's' : ''}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-8 text-center">
          <p className="text-[#666] mb-4">No vision art yet. Create a goal to generate yours.</p>
          <Link href="/onboarding" className="inline-block px-5 py-2.5 bg-[#111] text-white rounded-xl text-[13px] font-medium">Create goal →</Link>
        </div>
      )}
    </div>
  )
}
