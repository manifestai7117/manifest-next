'use client'
import React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useState, useEffect } from 'react'
import NotificationBell from './NotificationBell'

const NAV = [
  { href: '/dashboard',         label: 'Overview',   emoji: '⌂' },
  { href: '/dashboard/goal',    label: 'My Goals',   emoji: '◎' },
  { href: '/dashboard/coach',   label: 'AI Coach',   emoji: '✦' },
  { href: '/dashboard/circles', label: 'Circles',    emoji: '◉' },
  { href: '/dashboard/friends', label: 'Friends',    emoji: '♡' },
  { href: '/dashboard/feed',    label: 'Feed',       emoji: '◈' },
  { href: '/dashboard/art',     label: 'Vision Art', emoji: '⬡' },
  { href: '/dashboard/streak',  label: 'Streak',     emoji: '⚡' },
  { href: '/dashboard/settings',label: 'Settings',   emoji: '⚙' },
  { href: '/dashboard/profile', label: 'Profile',    emoji: '◯' },
]

const BOTTOM_NAV = [
  { href: '/dashboard',        label: 'Home',   emoji: '⌂' },
  { href: '/dashboard/goal',   label: 'Goals',  emoji: '◎' },
  { href: '/dashboard/coach',  label: 'Coach',  emoji: '✦' },
  { href: '/dashboard/feed',   label: 'Feed',   emoji: '◈' },
  { href: '/dashboard/streak', label: 'Streak', emoji: '⚡' },
]

function ScrollRestorer({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null)
  const scrollMap = React.useRef<Record<string, number>>({})

  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const saved = scrollMap.current[pathname] || 0
    el.scrollTop = saved
    const onScroll = () => { scrollMap.current[pathname] = el.scrollTop }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [pathname])

  return (
    // KEY FIX: overflow-x-hidden + min-w-0 prevents any child from causing horizontal scroll
    <div ref={ref} className="flex-1 overflow-y-auto overflow-x-hidden h-screen md:h-auto min-w-0">
      {children}
    </div>
  )
}

export default function DashboardShell({ children, profile }: { children: React.ReactNode; profile: any }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [mobileOpen, setMobileOpen] = useState(false)
  const isPro = profile?.plan === 'pro' || profile?.plan === 'pro_trial'

  useEffect(() => {
    const stored = localStorage.getItem('manifest_dark_mode')
    if (stored === 'true') document.documentElement.classList.add('dark')
    fetch('/api/settings').then(r => r.ok ? r.json() : null).then(data => {
      if (!data) return
      const dm = !!data.dark_mode
      document.documentElement.classList.toggle('dark', dm)
      localStorage.setItem('manifest_dark_mode', String(dm))
    }).catch(() => {})
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const Sidebar = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-[#e8e8e8]">
        <Link href="/" className="font-serif text-[20px] text-[#111]">
          manifest<span className="text-[#b8922a]">.</span>
        </Link>
      </div>
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, emoji }) => (
          <Link key={href} href={href} onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all ${pathname === href || (href !== '/dashboard' && pathname.startsWith(href)) ? 'bg-[#111] text-white' : 'text-[#666] hover:bg-[#f8f7f5] hover:text-[#111]'}`}>
            <span className="text-[14px] w-5 text-center flex-shrink-0">{emoji}</span>
            {label}
          </Link>
        ))}
      </nav>
      <div className="p-3 border-t border-[#e8e8e8]">
        {!isPro && (
          <Link href="/dashboard/upgrade"
            className="flex items-center gap-2 px-3 py-2 mb-2 bg-[#faf3e0] rounded-xl text-[11px] font-medium text-[#b8922a] hover:bg-[#f5e8c0] transition-colors">
            ☆ Upgrade to Pro
          </Link>
        )}
        <Link href="/dashboard/profile"
          className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors mb-1 ${pathname === '/dashboard/profile' ? 'bg-[#111]' : 'hover:bg-[#f8f7f5]'}`}>
          {profile?.avatar_url
            ? <img src={profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0"/>
            : <div className="w-8 h-8 rounded-full bg-[#b8922a] flex items-center justify-center text-white text-[12px] font-semibold flex-shrink-0">
                {profile?.full_name?.[0]?.toUpperCase() || '?'}
              </div>
          }
          <div className="min-w-0 flex-1">
            <p className={`text-[13px] font-medium truncate ${pathname === '/dashboard/profile' ? 'text-white' : 'text-[#111]'}`}>
              {profile?.full_name || 'Profile'}
            </p>
            <p className={`text-[11px] truncate capitalize ${pathname === '/dashboard/profile' ? 'text-white/50' : 'text-[#999]'}`}>
              {profile?.plan === 'pro_trial' ? 'Pro trial' : profile?.plan || 'free'}
            </p>
          </div>
        </Link>
        <button onClick={signOut} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] text-[#999] hover:bg-[#f8f7f5] hover:text-[#111] transition-colors">
          <span className="text-[14px] w-5 text-center flex-shrink-0">→</span>
          Sign out
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f8f7f5] flex">
      {/* Desktop sidebar */}
      <div className="hidden md:flex w-[220px] flex-shrink-0 bg-white border-r border-[#e8e8e8] flex-col fixed top-0 left-0 h-screen z-30">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div className="w-[260px] bg-white h-full shadow-2xl flex flex-col">
            <Sidebar />
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setMobileOpen(false)}/>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 md:ml-[220px] flex flex-col min-w-0">
        {/* Top bar */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-[#e8e8e8] px-5 py-3 flex items-center justify-between flex-shrink-0">
          <button onClick={() => setMobileOpen(true)} className="md:hidden p-1.5 rounded-lg hover:bg-[#f0ede8] transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <div className="md:hidden font-serif text-[18px] text-[#111]">
            manifest<span className="text-[#b8922a]">.</span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <NotificationBell />
          </div>
        </div>

        {/* Page content — KEY: overflow-x-hidden prevents horizontal scroll on mobile */}
        <ScrollRestorer pathname={pathname}>
          <main className="flex-1 px-5 py-6 pb-24 md:pb-6 max-w-full overflow-x-hidden min-w-0">
            {children}
          </main>
        </ScrollRestorer>

        {/* Mobile bottom nav */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#e8e8e8] flex md:hidden z-20 safe-area-pb">
          {BOTTOM_NAV.map(({ href, label, emoji }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            return (
              <Link key={href} href={href}
                className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 transition-colors ${active ? 'text-[#111]' : 'text-[#bbb]'}`}>
                <span className="text-[18px] leading-none">{emoji}</span>
                <span className="text-[9px] font-medium">{label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}