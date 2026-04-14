'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import NotificationBell from './NotificationBell'

const NAV = [
  { href: '/dashboard',                  label: 'Overview' },
  { href: '/dashboard/goal',             label: 'My Goals' },
  { href: '/dashboard/coach',            label: 'AI Coach' },
  { href: '/dashboard/circles',          label: 'Goal Circles' },
  { href: '/dashboard/friends',          label: 'Friends & DMs' },
  { href: '/dashboard/feed',             label: 'Feed' },
  { href: '/dashboard/art',              label: 'Vision Art' },
  { href: '/dashboard/streak',           label: 'Streak' },
  { href: '/dashboard/analytics',        label: 'Analytics' },
  { href: '/dashboard/circles/discover', label: 'Discover' },
  { href: '/dashboard/print',            label: 'Print Shop' },
  { href: '/dashboard/feedback',         label: 'Feedback' },
  { href: '/dashboard/settings',         label: 'Settings' },
  { href: '/dashboard/profile',          label: 'Profile' },
]

export default function DashboardShell({ children, profile }: { children: React.ReactNode; profile: any }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [mobileOpen, setMobileOpen] = useState(false)
  const isPro = profile?.plan === 'pro' || profile?.plan === 'pro_trial'

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-[#e8e8e8] flex items-center justify-between">
        <Link href="/" className="font-serif text-[20px] text-[#111]">
          manifest<span className="text-[#b8922a]">.</span>
        </Link>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label }) => {
          const active = pathname === href
          return (
            <Link key={href} href={href} onClick={() => setMobileOpen(false)}
              className={`flex items-center px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all ${active ? 'bg-[#111] text-white' : 'text-[#666] hover:bg-[#f8f7f5] hover:text-[#111]'}`}>
              {label}
            </Link>
          )
        })}
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
            <p className={`text-[11px] capitalize ${pathname === '/dashboard/profile' ? 'text-white/50' : 'text-[#999]'}`}>
              {profile?.plan === 'pro_trial' ? 'Pro trial' : profile?.plan || 'free'}
            </p>
          </div>
        </Link>
        <button onClick={signOut}
          className="flex items-center gap-2 px-3 py-2 w-full text-left text-[13px] text-[#999] hover:text-[#666] transition-colors rounded-xl hover:bg-[#f8f7f5]">
          Sign out
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f8f7f5] flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-[220px] bg-white border-r border-[#e8e8e8] fixed h-full z-30">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)}/>
          <aside className="absolute right-0 top-0 bottom-0 w-[260px] bg-white shadow-2xl overflow-y-auto">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-[#e8e8e8] flex items-center justify-between px-4 z-30">
        <Link href="/" className="font-serif text-[20px] text-[#111]">
          manifest<span className="text-[#b8922a]">.</span>
        </Link>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <button onClick={() => setMobileOpen(true)}
            className="w-9 h-9 flex flex-col items-center justify-center gap-1.5 rounded-xl hover:bg-[#f0ede8] transition-colors">
            <span className="w-5 h-0.5 bg-[#111] rounded"/>
            <span className="w-5 h-0.5 bg-[#111] rounded"/>
            <span className="w-3 h-0.5 bg-[#111] rounded self-start"/>
          </button>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 md:ml-[220px] min-h-screen">
        <div className="hidden md:flex items-center justify-end px-6 py-3 border-b border-[#e8e8e8] bg-white sticky top-0 z-20">
          <NotificationBell />
        </div>
        <div className="p-6 md:p-8 pt-20 md:pt-6">
          {children}
        </div>
      </main>
    </div>
  )
}