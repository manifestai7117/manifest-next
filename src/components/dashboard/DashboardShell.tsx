'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import NotificationBell from './NotificationBell'

const NAV = [
  { href:'/dashboard',                  label:'Overview',     d:'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10' },
  { href:'/dashboard/goal',             label:'My Goals',     d:'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M12 12h.01' },
  { href:'/dashboard/coach',            label:'AI Coach',     d:'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
  { href:'/dashboard/circles',          label:'Goal Circles', d:'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75' },
  { href:'/dashboard/friends',          label:'Friends & DMs',d:'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z' },
  { href:'/dashboard/feed',             label:'Feed',         d:'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z' },
  { href:'/dashboard/art',              label:'Vision Art',   d:'M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z' },
  { href:'/dashboard/streak',           label:'Streak',       d:'M13 2L3 14h9l-1 8 10-12h-9l1-8z' },
  { href:'/dashboard/analytics',        label:'Analytics',    d:'M18 20V10 M12 20V4 M6 20v-6' },
  { href:'/dashboard/circles/discover', label:'Discover',     d:'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z' },
  { href:'/dashboard/print',            label:'Print Shop',   d:'M6 9V2h12v7 M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2 M6 14h12v8H6z' },
  { href:'/dashboard/feedback',         label:'Feedback',     d:'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z M12 8v4 M12 16h.01' },
  { href:'/dashboard/settings',         label:'Settings',     d:'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z' },
  { href:'/dashboard/profile',          label:'Profile',      d:'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
]

function NavIcon({ d }: { d: string }) {
  const paths = d.split(' M ').map((p, i) => i === 0 ? p : 'M ' + p)
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
      {paths.map((p, i) => <path key={i} d={p}/>)}
    </svg>
  )
}

export default function DashboardShell({ children, profile }: { children: React.ReactNode; profile: any }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [mobileOpen, setMobileOpen] = useState(false)
  const isPro = profile?.plan === 'pro' || profile?.plan === 'pro_trial'

  const signOut = async () => { await supabase.auth.signOut(); router.push('/') }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-[#e8e8e8]">
        <Link href="/" className="font-serif text-[20px] text-[#111]">manifest<span className="text-[#b8922a]">.</span></Link>
      </div>
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, d }) => {
          const active = pathname === href
          return (
            <Link key={href} href={href} onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all ${active ? 'bg-[#111] text-white' : 'text-[#666] hover:bg-[#f8f7f5] hover:text-[#111]'}`}>
              <NavIcon d={d}/>
              {label}
            </Link>
          )
        })}
      </nav>
      <div className="p-3 border-t border-[#e8e8e8]">
        {!isPro && (
          <Link href="/dashboard/upgrade" className="flex items-center gap-2 px-3 py-2 mb-2 bg-[#faf3e0] rounded-xl text-[11px] font-medium text-[#b8922a] hover:bg-[#f5e8c0] transition-colors">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            Upgrade to Pro
          </Link>
        )}
        {isPro && <div className="flex items-center gap-2 px-3 py-1.5 mb-1"><span className="text-[10px] font-semibold bg-[#b8922a] text-white px-2 py-0.5 rounded-full">PRO</span><span className="text-[11px] text-[#999]">{profile?.plan === 'pro_trial' ? 'trial' : 'active'}</span></div>}
        <Link href="/dashboard/profile"
          className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors mb-1 ${pathname === '/dashboard/profile' ? 'bg-[#111]' : ''}`}>
          {profile?.avatar_url
            ? <img src={profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0"/>
            : <div className="w-8 h-8 rounded-full bg-[#b8922a] flex items-center justify-center text-white text-[12px] font-semibold flex-shrink-0">{profile?.full_name?.[0]?.toUpperCase() || '?'}</div>
          }
          <div className="min-w-0">
            <p className={`text-[13px] font-medium truncate ${pathname === '/dashboard/profile' ? 'text-white' : 'text-[#111]'}`}>{profile?.full_name || 'User'}</p>
            <p className={`text-[11px] capitalize ${pathname === '/dashboard/profile' ? 'text-white/50' : 'text-[#999]'}`}>{profile?.plan === 'pro_trial' ? 'Pro trial' : profile?.plan || 'free'}</p>
          </div>
        </Link>
        <button onClick={signOut} className="flex items-center gap-2 px-3 py-2 w-full text-left text-[13px] text-[#999] hover:text-[#666] transition-colors rounded-xl hover:bg-[#f8f7f5]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Sign out
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f8f7f5] flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-[220px] bg-white border-r border-[#e8e8e8] fixed h-full z-30">
        <SidebarContent/>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)}/>
          <aside className="absolute right-0 top-0 bottom-0 w-[260px] bg-white shadow-2xl overflow-y-auto">
            <SidebarContent/>
          </aside>
        </div>
      )}

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-[#e8e8e8] flex items-center justify-between px-4 z-30">
        <Link href="/" className="font-serif text-[20px] text-[#111]">manifest<span className="text-[#b8922a]">.</span></Link>
        <div className="flex items-center gap-2">
          <NotificationBell/>
          <button onClick={() => setMobileOpen(true)} className="w-9 h-9 flex flex-col items-center justify-center gap-1.5 rounded-xl hover:bg-[#f0ede8] transition-colors">
            <span className="w-5 h-0.5 bg-[#111] rounded"/>
            <span className="w-5 h-0.5 bg-[#111] rounded"/>
            <span className="w-3 h-0.5 bg-[#111] rounded self-start"/>
          </button>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 md:ml-[220px] min-h-screen">
        {/* Desktop top bar */}
        <div className="hidden md:flex items-center justify-end px-6 py-3 border-b border-[#e8e8e8] bg-white sticky top-0 z-20">
          <NotificationBell/>
        </div>
        <div className="p-6 md:p-8 pt-20 md:pt-6">
          {children}
        </div>
      </main>
    </div>
  )
}
