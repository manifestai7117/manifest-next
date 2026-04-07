'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

const NAV = [
  { href:'/dashboard',              label:'Overview',     d:'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10' },
  { href:'/dashboard/goals',        label:'My Goals',     d:'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M12 12h.01' },
  { href:'/dashboard/coach',        label:'AI Coach',     d:'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
  { href:'/dashboard/circles',      label:'Goal Circles', d:'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75' },
  { href:'/dashboard/friends',      label:'Friends & DMs',d:'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z' },
  { href:'/dashboard/art',          label:'Vision Art',   d:'M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z' },
  { href:'/dashboard/streak',       label:'Streak',       d:'M13 2L3 14h9l-1 8 10-12h-9l1-8z' },
  { href:'/dashboard/print',        label:'Print Shop',   d:'M6 9V2h12v7 M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2 M6 14h12v8H6z' },
  { href:'/dashboard/profile',      label:'Profile',      d:'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
]

const BOTTOM_NAV = [
  { href:'/dashboard',         label:'Home',    d:'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10' },
  { href:'/dashboard/goals',   label:'Goals',   d:'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M12 12h.01' },
  { href:'/dashboard/coach',   label:'Coach',   d:'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
  { href:'/dashboard/art',     label:'Art',     d:'M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z' },
  { href:'/dashboard/profile', label:'Profile', d:'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
]

export default function DashboardShell({ children, profile }: { children: React.ReactNode; profile: any }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const isPro = profile?.plan==='pro'||profile?.plan==='pro_trial'
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    toast.success('Signed out')
    router.push('/')
    router.refresh()
  }

  return (
    <div className="flex min-h-screen bg-[#f8f7f5]">

      {/* Desktop sidebar - hidden on mobile */}
      <aside className="hidden md:flex w-[220px] bg-white border-r border-[#e8e8e8] flex-col fixed top-0 left-0 h-full z-10 overflow-y-auto">
        <div className="px-5 py-5 border-b border-[#e8e8e8] flex-shrink-0">
          <Link href="/" className="font-serif text-[20px] text-[#111]">manifest<span className="text-[#b8922a]">.</span></Link>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {NAV.map(({href,label,d})=>{
            const active = pathname===href
            return (
              <Link key={href} href={href} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all ${active?'bg-[#111] text-white':'text-[#666] hover:bg-[#f8f7f5] hover:text-[#111]'}`}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  {d.split(' ').map((seg,i)=><path key={i} d={seg}/>)}
                </svg>
                {label}
              </Link>
            )
          })}
        </nav>
        <div className="p-3 border-t border-[#e8e8e8] flex-shrink-0">
          {!isPro && (
            <Link href="/dashboard/upgrade" className="flex items-center gap-2 px-3 py-2 mb-2 bg-[#faf3e0] rounded-xl text-[11px] font-medium text-[#b8922a] hover:bg-[#f5e8c0] transition-colors">
              <span>✦</span> Pro free 3 months
            </Link>
          )}
          {isPro && (
            <div className="flex items-center gap-2 px-3 py-1.5 mb-2">
              <span className="text-[10px] font-medium text-[#b8922a] bg-[#faf3e0] px-2 py-0.5 rounded-full">PRO</span>
              {profile?.plan==='pro_trial' && <span className="text-[10px] text-[#999]">trial</span>}
            </div>
          )}
          <Link href="/dashboard/profile" className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors mb-1 ${pathname==='/dashboard/profile'?'bg-[#111]':''}`}>
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0"/>
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#b8922a] flex items-center justify-center text-white text-[13px] font-semibold flex-shrink-0">
                {profile?.full_name?.[0]?.toUpperCase()||'?'}
              </div>
            )}
            <div className="min-w-0">
              <p className={`text-[13px] font-medium truncate ${pathname==='/dashboard/profile'?'text-white':'text-[#111]'}`}>{profile?.full_name||'User'}</p>
              <p className={`text-[11px] capitalize ${pathname==='/dashboard/profile'?'text-white/50':'text-[#999]'}`}>{profile?.plan==='pro_trial'?'Pro trial':profile?.plan||'free'}</p>
            </div>
          </Link>
          <button onClick={handleLogout} className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-[13px] text-[#999] hover:bg-[#f8f7f5] hover:text-[#111] transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-20 bg-white border-b border-[#e8e8e8] flex items-center justify-between px-4 h-14">
        <Link href="/" className="font-serif text-[20px] text-[#111]">manifest<span className="text-[#b8922a]">.</span></Link>
        <div className="flex items-center gap-2">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover"/>
          ) : (
            <div className="w-8 h-8 rounded-full bg-[#b8922a] flex items-center justify-center text-white text-[12px] font-semibold">
              {profile?.full_name?.[0]?.toUpperCase()||'?'}
            </div>
          )}
          <button onClick={()=>setMenuOpen(true)} className="w-9 h-9 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile slide-out menu */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={()=>setMenuOpen(false)}/>
          <div className="fixed top-0 right-0 bottom-0 w-[270px] bg-white z-40 md:hidden flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#e8e8e8]">
              <span className="font-serif text-[18px]">manifest<span className="text-[#b8922a]">.</span></span>
              <button onClick={()=>setMenuOpen(false)} className="p-1">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
              {NAV.map(({href,label,d})=>{
                const active = pathname===href
                return (
                  <Link key={href} href={href} onClick={()=>setMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-[14px] font-medium transition-all ${active?'bg-[#111] text-white':'text-[#666] hover:bg-[#f8f7f5]'}`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      {d.split(' ').map((seg,i)=><path key={i} d={seg}/>)}
                    </svg>
                    {label}
                  </Link>
                )
              })}
            </nav>
            <div className="p-3 border-t border-[#e8e8e8]">
              {!isPro && (
                <Link href="/dashboard/upgrade" onClick={()=>setMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 mb-2 bg-[#faf3e0] rounded-xl text-[13px] font-medium text-[#b8922a]">
                  ✦ Pro free 3 months
                </Link>
              )}
              <button onClick={handleLogout} className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl text-[14px] text-[#999] hover:bg-[#f8f7f5] transition-colors">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Sign out
              </button>
            </div>
          </div>
        </>
      )}

      {/* Main content */}
      <main className="w-full md:ml-[220px] min-h-screen pt-14 md:pt-0 pb-20 md:pb-0 px-4 md:px-8 py-4 md:py-8">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-[#e8e8e8] flex items-center justify-around h-16">
        {BOTTOM_NAV.map(({href,label,d})=>{
          const active = pathname===href
          return (
            <Link key={href} href={href} className={`flex flex-col items-center gap-0.5 px-2 py-1 ${active?'text-[#111]':'text-[#bbb]'}`}>
              <div className={`w-8 h-8 flex items-center justify-center rounded-xl ${active?'bg-[#111]':''}`}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={active?'white':'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  {d.split(' ').map((seg,i)=><path key={i} d={seg}/>)}
                </svg>
              </div>
              <span className="text-[9px] font-medium">{label}</span>
            </Link>
          )
        })}
      </nav>

    </div>
  )
}