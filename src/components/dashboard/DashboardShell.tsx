'use client'
import React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useState, useEffect } from 'react'

const NAV = [
  { href: '/dashboard',          label: 'My Goals',    emoji: '⌂' },
  { href: '/dashboard/coach',    label: 'AI Coach',    emoji: '✦' },
  { href: '/dashboard/circles',  label: 'Circles',     emoji: '◉' },
  { href: '/dashboard/friends',  label: 'Friends',     emoji: '♡' },
  { href: '/dashboard/feed',     label: 'Feed',        emoji: '◈' },
  { href: '/dashboard/art',      label: 'Vision Art',  emoji: '⬡' },
  { href: '/dashboard/streak',   label: 'Streak',      emoji: '⚡' },
  { href: '/dashboard/settings', label: 'Settings',    emoji: '⚙' },
  { href: '/dashboard/profile',  label: 'Profile',     emoji: '◯' },
]

const MOBILE_PRIMARY_NAV = [
  { href: '/dashboard',         label: 'Goals',   emoji: '⌂' },
  { href: '/dashboard/coach',   label: 'Coach',   emoji: '✦' },
  { href: '/dashboard/feed',    label: 'Feed',    emoji: '◈' },
  { href: '/dashboard/circles', label: 'Circles', emoji: '◉' },
  { href: '/dashboard/profile', label: 'Profile', emoji: '◯' },
]

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'My Goals',
  '/dashboard/coach': 'AI Coach',
  '/dashboard/circles': 'Circles',
  '/dashboard/friends': 'Friends',
  '/dashboard/feed': 'Feed',
  '/dashboard/art': 'Vision Art',
  '/dashboard/streak': 'Streak',
  '/dashboard/settings': 'Settings',
  '/dashboard/profile': 'Profile',
  '/dashboard/upgrade': 'Upgrade',
}

function isPathActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(`${href}/`)
}

function getPageTitle(pathname: string) {
  const exact = PAGE_TITLES[pathname]
  if (exact) return exact

  const match = Object.keys(PAGE_TITLES)
    .filter(key => pathname.startsWith(key) && key !== '/dashboard')
    .sort((a, b) => b.length - a.length)[0]

  return match ? PAGE_TITLES[match] : 'Manifest'
}

function ScrollRestorer({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null)
  const scrollMap = React.useRef<Record<string, number>>({})

  React.useEffect(() => {
    const el = ref.current
    if (!el) return

    const saved = scrollMap.current[pathname] || 0
    el.scrollTop = saved

    const onScroll = () => {
      scrollMap.current[pathname] = el.scrollTop
    }

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
  const pageTitle = getPageTitle(pathname)

  useEffect(() => {
    const stored = localStorage.getItem('manifest_dark_mode')
    if (stored === 'true') document.documentElement.classList.add('dark')

    fetch('/api/settings')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!data) return
        const dm = !!data.dark_mode
        document.documentElement.classList.toggle('dark', dm)
        localStorage.setItem('manifest_dark_mode', String(dm))
      })
      .catch(() => {})
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-[#e8e8e8] flex items-center justify-between">
        <Link href="/" className="font-serif text-[20px] text-[#111]" onClick={() => setMobileOpen(false)}>
          manifest<span className="text-[#b8922a]">.</span>
        </Link>

        {mobile && (
          <button
            onClick={() => setMobileOpen(false)}
            className="w-9 h-9 rounded-full border border-[#e8e8e8] flex items-center justify-center text-[16px] text-[#666]"
            aria-label="Close menu"
          >
            ✕
          </button>
        )}
      </div>

      <div className="px-4 pt-4 pb-3 border-b border-[#e8e8e8]">
        <Link
          href="/dashboard/profile"
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-3"
        >
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-11 h-11 rounded-full bg-[#b8922a] flex items-center justify-center text-white text-[14px] font-semibold flex-shrink-0">
              {profile?.full_name?.[0]?.toUpperCase() || '?'}
            </div>
          )}

          <div className="min-w-0">
            <p className="text-[14px] font-medium text-[#111] truncate">
              {profile?.full_name || 'User'}
            </p>
            <p className="text-[12px] text-[#999]">
              {isPro ? 'Pro plan' : 'Free plan'}
            </p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, emoji }) => {
          const active = isPathActive(pathname, href)
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-2xl text-[13px] font-medium transition-all ${
                active ? 'bg-[#111] text-white shadow-sm' : 'text-[#666] hover:bg-[#f8f7f5] hover:text-[#111]'
              }`}
            >
              <span className="text-[14px] w-5 text-center flex-shrink-0">{emoji}</span>
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t border-[#e8e8e8]">
        {!isPro && (
          <Link
            href="/dashboard/upgrade"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-2 px-3 py-3 mb-2 bg-[#faf3e0] rounded-2xl text-[12px] font-medium text-[#b8922a] hover:bg-[#f5e8c0] transition-colors"
          >
            ★ Upgrade to Pro
          </Link>
        )}

        <button
          onClick={signOut}
          className="px-3 py-3 w-full text-left text-[13px] text-[#999] hover:text-[#666] transition-colors rounded-2xl hover:bg-[#f8f7f5]"
        >
          Sign out
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f8f7f5] flex">
      <aside className="hidden md:flex flex-col w-[220px] bg-white border-r border-[#e8e8e8] fixed h-full z-30">
        <Sidebar />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={() => setMobileOpen(false)} />
          <aside
            className="absolute right-0 top-0 bottom-0 w-[86vw] max-w-[360px] bg-white shadow-2xl overflow-y-auto"
            style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            <Sidebar mobile />
          </aside>
        </div>
      )}

      <div
        className="md:hidden fixed top-0 left-0 right-0 z-40 border-b border-[#e8e8e8] bg-white/90 backdrop-blur-xl"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="h-14 px-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#999] font-medium">Manifest</p>
            <h1 className="text-[16px] font-semibold text-[#111] truncate">{pageTitle}</h1>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/profile"
              className="w-9 h-9 rounded-full border border-[#e8e8e8] flex items-center justify-center overflow-hidden bg-[#f8f7f5]"
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[12px] font-semibold text-[#111]">
                  {profile?.full_name?.[0]?.toUpperCase() || '?'}
                </span>
              )}
            </Link>

            <button
              onClick={() => setMobileOpen(true)}
              className="w-10 h-10 rounded-full border border-[#e8e8e8] flex flex-col justify-center items-center gap-[4px] bg-white"
              aria-label="Menu"
            >
              <span className="block w-[18px] h-[2px] bg-[#111] rounded-full" />
              <span className="block w-[18px] h-[2px] bg-[#111] rounded-full" />
              <span className="block w-[12px] h-[2px] bg-[#111] rounded-full" />
            </button>
          </div>
        </div>
      </div>

      <main className="flex-1 md:ml-[220px] min-h-screen">
        <ScrollRestorer pathname={pathname}>
          <div
            className="p-4 md:p-8 md:pt-6 md:pb-8"
            style={{
              paddingTop: pathname.startsWith('/dashboard')
                ? 'calc(72px + env(safe-area-inset-top, 0px))'
                : undefined,
              paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))',
            }}
          >
            {children}
          </div>
        </ScrollRestorer>
      </main>

      <nav
        className="md:hidden fixed left-0 right-0 z-40 px-3"
        style={{ bottom: 'max(12px, env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="bg-white/92 backdrop-blur-xl border border-[#e8e8e8] rounded-[28px] shadow-[0_10px_35px_rgba(0,0,0,0.08)] px-1.5 py-1.5 flex items-stretch">
          {MOBILE_PRIMARY_NAV.map(({ href, label, emoji }) => {
            const active = isPathActive(pathname, href)
            return (
              <Link
                key={href}
                href={href}
                className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 rounded-[22px] transition-all ${
                  active ? 'bg-[#111] text-white' : 'text-[#999]'
                }`}
              >
                <span className={`text-[16px] leading-none ${active ? 'opacity-100' : 'opacity-60'}`}>{emoji}</span>
                <span className={`text-[10px] font-medium ${active ? 'text-white' : 'text-[#999]'}`}>{label}</span>
              </Link>
            )
          })}

          <button
            onClick={() => setMobileOpen(true)}
            className="w-[62px] flex flex-col items-center justify-center py-2 gap-0.5 rounded-[22px] text-[#999]"
          >
            <span className="text-[16px] leading-none opacity-60">☰</span>
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>
    </div>
  )
}