'use client'
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

export default function DashboardShell({ children, profile }: { children: React.ReactNode; profile: any }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const isPro = profile?.plan==='pro'||profile?.plan==='pro_trial'

  const handleLogout = async () => {
    await supabase.auth.signOut()
    toast.success('Signed out')
    router.push('/')
    router.refresh()
  }

  return (
    <div className="flex min-h-screen bg-[#f8f7f5]">
      <aside className="w-[220px] bg-white border-r border-[#e8e8e8] flex flex-col fixed top-0 left-0 h-full z-10 overflow-y-auto">
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
          {/* Upgrade prompt for free users */}
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
      <main className="ml-[220px] flex-1 p-8 min-h-screen">{children}</main>
    </div>
  )
}

