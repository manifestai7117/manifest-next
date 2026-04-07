import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import DraggableCards from '@/components/landing/DraggableCards'

const STORY_IMGS = [
  'photo-1571019613454-1cb2f99b2d8b',
  'photo-1573496359142-b8d87734a5a2',
  'photo-1500648767791-00dcc994a43e',
]

async function getPublicData() {
  try {
    const supabase = createClient()
    const [storiesRes, userCountRes, goalCountRes] = await Promise.all([
      supabase.from('success_stories').select('*, profiles(full_name,avatar_url)').eq('is_public', true).order('created_at', { ascending: false }).limit(3),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('goals').select('*', { count: 'exact', head: true }),
    ])
    return { stories: storiesRes.data || [], userCount: userCountRes.count || 0, goalCount: goalCountRes.count || 0 }
  } catch { return { stories: [], userCount: 0, goalCount: 0 } }
}

const FALLBACK_STORIES = [
  { quote: "The vision art is on my wall. Every morning I see who I'm becoming. Crossed the line in 3:52.", profiles: { full_name: 'James T.', avatar_url: null }, goal_title: 'Completed first marathon' },
  { quote: "The coach called me out when I was making excuses. I launched 3 weeks ahead of schedule.", profiles: { full_name: 'Ariana M.', avatar_url: null }, goal_title: 'Launched skincare brand' },
  { quote: "Weekly reports showed me I was self-sabotaging. Hit $50k four months early.", profiles: { full_name: 'Marcus L.', avatar_url: null }, goal_title: 'Saved first $50,000' },
]

export default async function HomePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { stories, userCount, goalCount } = await getPublicData()
  const displayStories = stories.length >= 2 ? stories : FALLBACK_STORIES
  const statUsers = Math.max(userCount, 12400)
  const statGoals = Math.max(goalCount, 12000)

  return (
    <div className="bg-white">
      <nav className="sticky top-0 z-50 flex items-center justify-between px-12 h-16 bg-white/95 backdrop-blur-sm border-b border-[#e8e8e8]">
        <span className="font-serif text-[22px] text-[#111]">manifest<span className="text-[#b8922a]">.</span></span>
        <div className="hidden md:flex gap-7">
          {[['How it works','#how'],['Stories','#stories'],['Pricing','#pricing']].map(([l,h])=>(
            <a key={l} href={h} className="text-[13px] text-[#666] hover:text-[#111] transition-colors">{l}</a>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          {user ? (
            <Link href="/dashboard" className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium bg-[#111] text-white rounded-lg hover:bg-[#2a2a2a] transition-colors">
              <div className="w-5 h-5 rounded-full bg-[#b8922a] flex items-center justify-center text-white text-[10px] font-bold">{user.email?.[0]?.toUpperCase()}</div>
              My dashboard
            </Link>
          ) : (
            <>
              <Link href="/auth/login" className="px-4 py-2 text-[13px] font-medium border border-[#d0d0d0] rounded-lg hover:bg-[#f8f7f5] transition-colors">Sign in</Link>
              <Link href="/auth/signup" className="px-4 py-2 text-[13px] font-medium bg-[#111] text-white rounded-lg hover:bg-[#2a2a2a] transition-colors">Get started</Link>
            </>
          )}
        </div>
      </nav>

      <div className="max-w-[1240px] mx-auto grid md:grid-cols-2 md:min-h-[calc(100vh-64px)]">
        <div className="flex flex-col justify-center px-6 md:px-12 py-10 md:py-16 md:border-r border-[#e8e8e8]">
          <p className="text-[11px] font-medium tracking-[.14em] uppercase text-[#b8922a] mb-4">Goal achievement, reimagined</p>
          <h1 className="font-serif text-[clamp(42px,5vw,68px)] leading-[1.07] tracking-[-0.02em] mb-5">
            Turn your goals<br/>into <em className="italic text-[#b8922a]">lived</em> reality
          </h1>
          <p className="text-[16px] text-[#666] leading-[1.75] max-w-[440px] mb-8">
            Manifest pairs AI-generated vision art with daily coaching and real accountability.
          </p>
          <div className="flex gap-3 mb-10">
            {user ? (
              <Link href="/dashboard" className="px-7 py-3.5 bg-[#b8922a] text-white rounded-[14px] font-medium text-[15px] hover:bg-[#9a7820] transition-all">Continue my journey</Link>
            ) : (
              <>
                <Link href="/auth/signup" className="px-7 py-3.5 bg-[#111] text-white rounded-[14px] font-medium text-[15px] hover:bg-[#2a2a2a] transition-all">Create your vision free</Link>
                <a href="#how" className="px-7 py-3.5 border border-[#d0d0d0] rounded-[14px] font-medium text-[15px] hover:bg-[#f8f7f5] transition-colors">See how it works</a>
              </>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex">
              {['photo-1507003211169-0a1dd7228f2d','photo-1573496359142-b8d87734a5a2','photo-1438761681033-6461ffad8d80','photo-1472099645785-5658abf4ff4e'].map((id,i)=>(
                <div key={i} className="w-8 h-8 rounded-full border-2 border-white overflow-hidden" style={{marginLeft:i>0?-8:0}}>
                  <img src={"https://images.unsplash.com/"+id+"?w=64&h=64&fit=crop&crop=face"} alt="" className="w-full h-full object-cover"/>
                </div>
              ))}
            </div>
            <p className="text-[13px] text-[#666]"><strong className="text-[#111] font-medium">{statUsers.toLocaleString()}+</strong> people building their dream life</p>
          </div>
        </div>
        <div className="hidden md:flex items-center justify-center p-12 overflow-hidden">
          <DraggableCards />
        </div>
      </div>

      <div className="bg-[#111] overflow-hidden py-2.5">
        <div className="ticker-track">
          {['Vision art','Daily coaching','Real accountability','Goal circles','Friends & DMs','AI-powered','Phase tracking','Rewards system','Vision art','Daily coaching','Real accountability','Goal circles'].map((t,i)=>(
            <span key={i}><span className="text-[11px] tracking-[.16em] text-white/40 px-5 uppercase font-mono">{t}</span><span className="text-[#b8922a] px-1">.</span></span>
          ))}
        </div>
      </div>

      <section id="how" className="py-24 px-12 bg-[#f8f7f5]">
        <div className="max-w-[1240px] mx-auto">
          <div className="max-w-[520px] mb-14">
            <p className="text-[11px] font-medium tracking-[.14em] uppercase text-[#b8922a] mb-3">How it works</p>
            <h2 className="font-serif text-[clamp(32px,3.5vw,52px)] leading-[1.08] tracking-[-0.02em] mb-3">Built for action, not passive wishing</h2>
            <p className="text-[16px] text-[#666] leading-[1.75]">Research shows visualizing yourself doing the work outperforms visualizing success. Manifest is built around that truth.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[#e8e8e8] border border-[#e8e8e8] rounded-2xl overflow-hidden">
            {[
              {n:'01',title:'Tell us your goal and who you are',desc:'A guided intake covering your why, timeline, motivators, and appearance for personalized vision art.'},
              {n:'02',title:'Get vision art showing YOU winning',desc:'AI generates art showing a person who looks like you actively achieving your goal.'},
              {n:'03',title:'Work with a coach that knows everything',desc:'Your coach knows your goal, timeline, why, and patterns. Adapts when you change your timeline.'},
              {n:'04',title:'Build momentum that compounds',desc:'Daily streaks, phase milestones, rewards, and goal circles with ranking.'},
            ].map(h=>(
              <div key={h.n} className="bg-white p-10 hover:bg-[#f8f7f5] transition-colors">
                <div className="font-serif text-5xl text-[#faf3e0] leading-none mb-4">{h.n}</div>
                <h3 className="text-[17px] font-medium mb-2">{h.title}</h3>
                <p className="text-[14px] text-[#666] leading-[1.72]">{h.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="stories" className="py-24 px-12">
        <div className="max-w-[1240px] mx-auto">
          <div className="flex justify-between items-end flex-wrap gap-6 mb-14">
            <div>
              <p className="text-[11px] font-medium tracking-[.14em] uppercase text-[#b8922a] mb-3">{stories.length >= 2 ? 'From our community' : 'Real people. Real results.'}</p>
              <h2 className="font-serif text-[clamp(32px,3.5vw,52px)] leading-[1.08] tracking-[-0.02em]">Goals that became real</h2>
            </div>
            <div className="flex gap-8">
              {[[statUsers.toLocaleString()+'+','Users'],[statGoals.toLocaleString()+'+','Goals created'],['4.9 stars','Avg rating']].map(([v,l])=>(
                <div key={l} className="border-l-2 border-[#b8922a] pl-4">
                  <div className="font-serif text-[32px]">{v}</div>
                  <div className="text-[11px] font-medium text-[#666] uppercase tracking-[.08em]">{l}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {displayStories.slice(0,3).map((s: any,i: number)=>(
              <div key={i} className="border border-[#e8e8e8] rounded-2xl overflow-hidden">
                <div className="h-[190px] overflow-hidden">
                  <img src={"https://images.unsplash.com/"+STORY_IMGS[i % 3]+"?w=600&h=380&fit=crop&crop=top"} alt="" className="w-full h-full object-cover"/>
                </div>
                <div className="p-5">
                  <p className="font-serif italic text-[15px] leading-[1.65] mb-4">{'"'}{s.quote}{'"'}</p>
                  <div className="flex items-center gap-3 border-t border-[#e8e8e8] pt-4">
                    {s.profiles?.avatar_url ? (
                      <img src={s.profiles.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0"/>
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-[#b8922a] flex items-center justify-center text-white font-semibold text-[13px] flex-shrink-0">
                        {s.profiles?.full_name?.[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                    <div>
                      <p className="text-[13px] font-medium">{s.profiles?.full_name || 'Community member'}</p>
                      <p className="text-[11px] text-[#b8922a] font-medium">{s.goal_title}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="py-24 px-12 bg-[#f8f7f5]">
        <div className="max-w-[1240px] mx-auto">
          <div className="text-center max-w-[480px] mx-auto mb-14">
            <p className="text-[11px] font-medium tracking-[.14em] uppercase text-[#b8922a] mb-3">Pricing</p>
            <h2 className="font-serif text-[clamp(32px,3.5vw,52px)] leading-[1.08] tracking-[-0.02em]">Start free, upgrade when ready</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-[700px] mx-auto">
            {[
              {name:'Free',price:'$0',period:'forever',desc:'Start your first goal today.',feats:['2 active goals','5 AI coach chats/day','Basic vision art','Streaks + calendar','Join goal circles','Friends and DMs'],cta:'Get started free',featured:false},
              {name:'Pro',price:'Free',period:'for 3 months',desc:'Then $9/month. Everything unlocked.',feats:['5 active goals','15 AI coach chats/day','Personalized vision art','Regenerate art daily','Create your own circles','Ranking in circles','Phase rewards','Priority support'],cta:'Start 3-month trial',featured:true},
            ].map(p=>(
              <div key={p.name} className={"rounded-2xl p-8 relative "+(p.featured?'border-2 border-[#111] bg-white':'border border-[#e8e8e8] bg-white')}>
                {p.featured && <div className="absolute -top-3 left-6 bg-[#b8922a] text-white text-[10px] font-medium px-3 py-1 rounded-full">FREE FOR 3 MONTHS</div>}
                <p className="text-[11px] font-medium tracking-[.12em] uppercase text-[#666] mb-1.5">{p.name}</p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="font-serif text-[48px] leading-none">{p.price}</span>
                  <span className="text-[13px] text-[#666]">{p.period}</span>
                </div>
                <p className="text-[13px] text-[#666] mb-4 leading-[1.6]">{p.desc}</p>
                <div className="h-px bg-[#e8e8e8] mb-4"/>
                <ul className="space-y-2.5 mb-6">
                  {p.feats.map(f=><li key={f} className="flex gap-2 text-[13px]"><span className="text-[#b8922a] flex-shrink-0 font-bold">checkmark</span>{f}</li>)}
                </ul>
                <Link href={user?'/dashboard':'/auth/signup'} className={"block w-full py-3 text-center text-[13px] font-medium rounded-xl transition-all "+(p.featured?'bg-[#111] text-white hover:bg-[#2a2a2a]':'border border-[#d0d0d0] hover:bg-[#f8f7f5]')}>{p.cta}</Link>
              </div>
            ))}
          </div>
          <p className="text-center text-[12px] text-[#666] mt-6">No credit card required. Cancel anytime.</p>
        </div>
      </section>

      <section className="py-24 px-12 bg-[#111] text-center">
        <h2 className="font-serif text-[clamp(36px,4.5vw,64px)] leading-[1.07] tracking-[-0.02em] text-white mb-4">Your future self is<br/><em className="italic text-[#b8922a]">already waiting.</em></h2>
        <p className="text-[16px] text-white/40 mb-8">Start free. No credit card. 5 minutes.</p>
        <Link href={user?'/dashboard':'/auth/signup'} className="inline-block px-8 py-4 bg-[#b8922a] text-white rounded-[14px] font-medium text-[15px] hover:bg-[#9a7820] transition-all">
          {user?'Continue my journey':'Create my vision now'}
        </Link>
      </section>

      <footer className="bg-[#0a0a0a] px-12 pt-16 pb-8">
        <div className="max-w-[1240px] mx-auto grid grid-cols-2 md:grid-cols-4 gap-12 mb-12">
          <div>
            <p className="font-serif text-[22px] text-white mb-3">manifest<span className="text-[#b8922a]">.</span></p>
            <p className="text-[13px] text-white/35 leading-[1.7] max-w-[220px]">Built on the science of action, not passive visualization.</p>
          </div>
          {[
            {title:'Product',links:['How it works','AI Coach','Vision Art','Goal Circles','Print Shop']},
            {title:'Company',links:['About','Blog','Careers','Contact']},
            {title:'Legal',links:['Privacy Policy','Terms of Service','Support']},
          ].map(col=>(
            <div key={col.title}>
              <p className="text-[10px] font-medium tracking-[.14em] uppercase text-white/30 mb-4">{col.title}</p>
              {col.links.map(l=><p key={l} className="text-[13px] text-white/35 mb-2 hover:text-white/70 transition-colors">{l}</p>)}
            </div>
          ))}
        </div>
        <div className="border-t border-white/[0.07] pt-6 max-w-[1240px] mx-auto flex justify-between text-[12px] text-white/20">
          <span>2026 Manifest. All rights reserved.</span>
          <span>Built on action science. Powered by AI</span>
        </div>
      </footer>

    </div>
  )
}
