// src/app/dashboard/art/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const ART_BG: Record<string, { bg: string; fg: string }> = {
  'Minimal & clean':    { bg: '#e8e5de', fg: '#111' },
  'Bold & dark':        { bg: '#1a1a2e', fg: 'rgba(255,255,255,.9)' },
  'Warm & natural':     { bg: '#3d2a1a', fg: 'rgba(255,255,255,.9)' },
  'Bright & energetic': { bg: '#0d2137', fg: 'rgba(255,255,255,.9)' },
}

export default async function ArtPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: goals } = await supabase.from('goals').select('*').eq('user_id', user.id).eq('is_active', true).order('created_at', { ascending: false }).limit(1)
  const goal = goals?.[0]
  const style = ART_BG[goal?.aesthetic] || ART_BG['Bold & dark']

  return (
    <div className="fade-up max-w-[800px]">
      <h1 className="font-serif text-[32px] mb-1">Vision Art</h1>
      <p className="text-[14px] text-[#666] mb-8">Your personalized goal artwork — designed to be seen every day</p>
      {goal ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="rounded-2xl overflow-hidden aspect-[4/5] flex items-center justify-center relative" style={{ background: style.bg }}>
            <div className="absolute inset-0 flex items-center justify-center font-serif text-[80px] opacity-[0.08]" style={{ color: style.fg }}>✦</div>
            <div className="relative z-10 p-8 text-center">
              <p className="font-serif italic text-[26px] mb-3" style={{ color: style.fg }}>{goal.art_title || 'The Vision'}</p>
              <p className="text-[13px] leading-[1.65]" style={{ color: style.fg === '#111' ? 'rgba(0,0,0,.5)' : 'rgba(255,255,255,.5)' }}>{goal.art_description}</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5">
              <p className="text-[10px] font-medium tracking-[.12em] uppercase text-[#b8922a] mb-2">Daily affirmation</p>
              <p className="font-serif italic text-[16px] leading-[1.65]">"{goal.affirmation}"</p>
            </div>
            <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5">
              <p className="font-medium text-[14px] mb-1.5">Style: {goal.aesthetic}</p>
              <p className="text-[13px] text-[#666] leading-[1.65]">Generated specifically for your goal and aesthetic preference. Every element reflects your journey.</p>
            </div>
            <a href="/dashboard/print" className="block w-full py-3 bg-[#b8922a] text-white rounded-xl text-[13px] font-medium text-center hover:bg-[#9a7820] transition-colors">Order a print →</a>
            <button className="w-full py-3 border border-[#e8e8e8] rounded-xl text-[13px] font-medium hover:bg-[#f8f7f5] transition-colors">Generate new concepts</button>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-8 text-center">
          <p className="text-[#666] mb-4">No vision art yet. Create a goal to generate yours.</p>
          <a href="/onboarding" className="inline-block px-5 py-2.5 bg-[#111] text-white rounded-xl text-[13px] font-medium">Create goal →</a>
        </div>
      )}
    </div>
  )
}
