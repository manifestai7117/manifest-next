import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export default async function PublicProfilePage({ params }: { params: { username: string } }) {
  // Use regular client, not admin - safer for public routes
  const supabase = createClient()
  const id = params.username

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle()
  if (!profile) notFound()

  const { data: prefs } = await supabase.from('user_preferences').select('profile_public').eq('user_id', profile.id).maybeSingle()
  if (prefs?.profile_public === false) notFound()

  const [{ data: goals }, { data: rewards }, { count: checkinCount }] = await Promise.all([
    supabase.from('goals').select('title, streak, progress, category').eq('user_id', profile.id).eq('is_active', true).order('streak', { ascending: false }),
    supabase.from('rewards').select('*').eq('user_id', profile.id).order('earned_at', { ascending: false }),
    supabase.from('checkins').select('*', { count: 'exact', head: true }).eq('user_id', profile.id),
  ])

  const totalStreak = (goals || []).reduce((a: number, g: any) => a + (g.streak || 0), 0)

  return (
    <div className="min-h-screen bg-[#f8f7f5]">
      <div className="max-w-[640px] mx-auto px-6 py-12">
        <Link href="/" className="inline-flex items-center gap-1.5 text-[13px] text-[#999] hover:text-[#666] mb-8 transition-colors">
          ← manifest.
        </Link>
        <div className="bg-white rounded-2xl border border-[#e8e8e8] overflow-hidden mb-4">
          <div className="bg-[#111] h-20"/>
          <div className="px-6 pb-6">
            <div className="-mt-10 mb-4">
              {profile.avatar_url
                ? <img src={profile.avatar_url} alt="" className="w-20 h-20 rounded-2xl border-4 border-white object-cover"/>
                : <div className="w-20 h-20 rounded-2xl border-4 border-white bg-[#b8922a] flex items-center justify-center text-white text-[32px] font-semibold">{profile.full_name?.[0]}</div>
              }
            </div>
            <h1 className="font-serif text-[28px] mb-0.5">{profile.full_name}</h1>
            <p className="text-[13px] text-[#999] capitalize mb-4">{profile.plan === 'pro_trial' ? 'Pro Trial' : profile.plan} member</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { val: (goals||[]).length, label: 'Active goals' },
                { val: `${totalStreak}🔥`, label: 'Streak days' },
                { val: checkinCount || 0, label: 'Check-ins' },
              ].map(({val, label}) => (
                <div key={label} className="bg-[#f8f7f5] rounded-xl p-3 text-center">
                  <p className="font-serif text-[22px]">{val}</p>
                  <p className="text-[10px] text-[#999] uppercase tracking-[.05em] mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        {(goals||[]).length > 0 && (
          <div className="bg-white rounded-2xl border border-[#e8e8e8] p-5 mb-4">
            <p className="text-[10px] font-medium tracking-[.12em] uppercase text-[#b8922a] mb-3">Working on</p>
            <div className="space-y-3">
              {(goals||[]).map((g:any, i:number) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[14px] font-medium">{g.title}</p>
                    <span className="text-[11px] text-[#b8922a] font-medium">{g.streak}🔥</span>
                  </div>
                  <div className="h-1.5 bg-[#f0ede8] rounded-full overflow-hidden">
                    <div className="h-full bg-[#b8922a] rounded-full" style={{width:`${g.progress||0}%`}}/>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {(rewards||[]).length > 0 && (
          <div className="bg-white rounded-2xl border border-[#e8e8e8] p-5 mb-6">
            <p className="text-[10px] font-medium tracking-[.12em] uppercase text-[#b8922a] mb-3">Achievements</p>
            <div className="flex flex-wrap gap-2">
              {(rewards||[]).map((r:any) => (
                <div key={r.id} className="flex items-center gap-2 bg-[#f8f7f5] rounded-xl px-3 py-2">
                  <span className="text-[18px]">{r.emoji}</span>
                  <span className="text-[12px] font-medium">{r.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="text-center">
          <Link href="/auth/signup" className="inline-flex items-center gap-2 px-6 py-3 bg-[#111] text-white rounded-xl text-[14px] font-medium hover:bg-[#2a2a2a] transition-colors">
            Start your journey with Manifest →
          </Link>
        </div>
      </div>
    </div>
  )
}
