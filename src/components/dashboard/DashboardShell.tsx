'use client'
import React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useState, useEffect } from 'react'
import NotificationBell from './NotificationBell'

const NAV = [
  { href: '/dashboard',         label: 'My Goals',   emoji: '⌂' },
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
  { href: '/dashboard',         label: 'Goals',   emoji: '⌂' },
  { href: '/dashboard/coach',   label: 'Coach',   emoji: '✦' },
  { href: '/dashboard/feed',    label: 'Feed',    emoji: '◈' },
  { href: '/dashboard/streak',  label: 'Streak',  emoji: '⚡' },
  { href: '/dashboard/friends', label: 'Friends', emoji: '♡' },
]


function ScrollRestorer({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null)
  const scrollMap = React.useRef<Record<string, number>>({})

  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    // Restore scroll for this path
    const saved = scrollMap.current[pathname] || 0
    el.scrollTop = saved
    // Save scroll as user scrolls
    const onScroll = () => { scrollMap.current[pathname] = el.scrollTop }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [pathname])

  return (
    <div ref={ref} className="flex-1 overflow-y-auto h-screen md:h-auto">
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
    // Apply dark mode instantly from localStorage
    const stored = localStorage.getItem('manifest_dark_mode')
    if (stored === 'true') document.documentElement.classList.add('dark')
    // Then verify with API
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
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all ${pathname === href || (href === '/dashboard/circles' && pathname.startsWith('/dashboard/circles')) || (href === '/dashboard' && pathname === '/dashboard') ? 'bg-[#111] text-white' : 'text-[#666] hover:bg-[#f8f7f5] hover:text-[#111]'}`}>
            <span className="text-[14px] w-5 text-center flex-shrink-0">{emoji}</span>
            {label}
          </Link>
        ))}
      </nav>
      <div className="p-3 border-t border-[#e8e8e8]">
        {!isPro && (
          <Link href="/dashboard/upgrade"
            className="flex items-center gap-2 px-3 py-2 mb-2 bg-[#faf3e0] rounded-xl text-[11px] font-medium text-[#b8922a] hover:bg-[#f5e8c0] transition-colors">
            ★ Upgrade to Pro
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
          <div className="min-w-0">
            <p className={`text-[13px] font-medium truncate ${pathname === '/dashboard/profile' ? 'text-white' : 'text-[#111]'}`}>
              {profile?.full_name || 'User'}
            </p>
            <p className={`text-[11px] ${pathname === '/dashboard/profile' ? 'text-white/50' : 'text-[#999]'}`}>
              {isPro ? 'Pro' : 'Free'}
            </p>
          </div>
        </Link>
        <button onClick={signOut}
          className="px-3 py-2 w-full text-left text-[13px] text-[#999] hover:text-[#666] transition-colors rounded-xl hover:bg-[#f8f7f5]">
          Sign out
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f8f7f5] flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-[220px] bg-white border-r border-[#e8e8e8] fixed h-full z-30">
        <Sidebar />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)}/>
          <aside className="absolute left-0 top-0 bottom-0 w-[280px] bg-white shadow-2xl overflow-y-auto">
            <Sidebar />
          </aside>
        </div>
      )}

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-[#e8e8e8] flex items-center justify-between px-4 z-40">
        <Link href="/" className="font-serif text-[20px] text-[#111]">
          manifest<span className="text-[#b8922a]">.</span>
        </Link>
        <div className="flex items-center gap-3">
          <NotificationBell />
          {/* Hamburger — three lines, perfectly aligned right */}
          <button
            onClick={() => setMobileOpen(true)}
            className="flex flex-col justify-center items-end gap-[5px] w-6 h-6"
            aria-label="Menu"
          >
            <span className="block w-[22px] h-[2px] bg-[#111] rounded-full"/>
            <span className="block w-[22px] h-[2px] bg-[#111] rounded-full"/>
            <span className="block w-[14px] h-[2px] bg-[#111] rounded-full"/>
          </button>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 md:ml-[220px] min-h-screen">
        <div className="hidden md:flex items-center justify-end px-6 py-3 border-b border-[#e8e8e8] bg-white sticky top-0 z-20">
          <NotificationBell />
        </div>
        <ScrollRestorer pathname={pathname}>
          <div className="p-4 md:p-8 pt-20 md:pt-6 pb-24 md:pb-8">
            {children}
          </div>
        </ScrollRestorer>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#e8e8e8] z-40 flex items-stretch">
        {BOTTOM_NAV.map(({ href, label, emoji }) => {
          const active = pathname === href
          return (
            <Link key={href} href={href}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${active ? 'text-[#111]' : 'text-[#bbb]'}`}>
              <span className={`text-[16px] leading-none ${active ? 'opacity-100' : 'opacity-50'}`}>{emoji}</span>
              <span className={`text-[9px] font-medium ${active ? 'text-[#111]' : 'text-[#bbb]'}`}>{label}</span>
            </Link>
          )
        })}
        <button
          onClick={() => setMobileOpen(true)}
          className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[#bbb]">
          <span className="text-[16px] leading-none opacity-50">☰</span>
          <span className="text-[9px] font-medium">More</span>
        </button>
      </nav>
    </div>
  )
}