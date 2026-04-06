'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import type { Profile, Goal, Circle } from '@/types'

const NAV = [
  { href: '/dashboard',           label: 'Overview',     icon: HomeIcon },
  { href: '/dashboard/goal',      label: 'My Goal',      icon: GoalIcon },
  { href: '/dashboard/coach',     label: 'AI Coach',     icon: CoachIcon },
  { href: '/dashboard/circles',   label: 'Goal Circles', icon: CircleIcon },
  { href: '/dashboard/art',       label: 'Vision Art',   icon: ArtIcon },
  { href: '/dashboard/streak',    label: 'Streak',       icon: StreakIcon },
  { href: '/dashboard/print',     label: 'Print Shop',   icon: PrintIcon },
]

export default function DashboardShell({ children, profile, activeGoal, circles, myCircleIds }: {
  children: React.ReactNode
  profile: Profile | null
  activeGoal: Goal | null
  circles: Circle[]
  myCircleIds: string[]
}) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    toast.success('Signed out')
    router.push('/')
    router.refresh()
  }

  return (
    <div className="flex min-h-screen bg-[#f8f7f5]">
      {/* Sidebar */}
      <aside className="w-[220px] bg-white border-r border-[#e8e8e8] flex flex-col fixed top-0 left-0 h-full z-10">
        <div className="px-5 py-5 border-b border-[#e8e8e8]">
          <Link href="/" className="font-serif text-[20px] text-[#111]">manifest<span className="text-[#b8922a]">.</span></Link>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href
            return (
              <Link key={href} href={href} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all ${active ? 'bg-[#111] text-white' : 'text-[#666] hover:bg-[#f8f7f5] hover:text-[#111]'}`}>
                <Icon size={15} active={active}/>
                {label}
              </Link>
            )
          })}
        </nav>
        <div className="p-3 border-t border-[#e8e8e8]">
          <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
            <div className="w-8 h-8 rounded-full bg-[#b8922a] flex items-center justify-center text-white text-[13px] font-semibold flex-shrink-0">
              {profile?.full_name?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-medium truncate">{profile?.full_name || 'User'}</p>
              <p className="text-[11px] text-[#999] capitalize">{profile?.plan || 'free'} plan</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-[13px] text-[#999] hover:bg-[#f8f7f5] hover:text-[#111] transition-colors">
            <LogoutIcon size={14}/> Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-[220px] flex-1 p-8 min-h-screen">
        {children}
      </main>
    </div>
  )
}

// ── Icons ────────────────────────────────────────
function Svg({ children, size = 16 }: { children: React.ReactNode, size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
}
function HomeIcon({ size, active }: any)   { return <Svg size={size}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></Svg> }
function GoalIcon({ size, active }: any)   { return <Svg size={size}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></Svg> }
function CoachIcon({ size, active }: any)  { return <Svg size={size}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></Svg> }
function CircleIcon({ size, active }: any) { return <Svg size={size}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></Svg> }
function ArtIcon({ size, active }: any)    { return <Svg size={size}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></Svg> }
function StreakIcon({ size, active }: any) { return <Svg size={size}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10"/></Svg> }
function PrintIcon({ size, active }: any)  { return <Svg size={size}><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></Svg> }
function LogoutIcon({ size }: any)         { return <Svg size={size}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></Svg> }
