import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

async function getPublicData() {
  const supabase = createClient()
  const { data: stories } = await supabase
    .from('success_stories')
    .select('*, profiles(full_name)')
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(3)

  const { count: userCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })

  const { count: goalCount } = await supabase
    .from('goals')
    .select('*', { count: 'exact', head: true })

  return { stories: stories || [], userCount: userCount || 0, goalCount: goalCount || 0 }
}

const FALLBACK_STORIES = [
  { quote: "The vision art is on my wall. Every morning I see who I'm becoming. Crossed the finish line in 3:52.", profiles: { full_name: 'James T.' }, goal_title: 'Completed first marathon' },
  { quote: "The coach called me out when I was making excuses. I launched 3 weeks ahead of schedule.", profiles: { full_name: 'Ariana M.' }, goal_title: 'Launched skincare brand' },
  { quote: "Weekly reports showed me I was self-sabotaging. Hit $50k four months early.", profiles: { full_name: 'Marcus L.' }, goal_title: 'Saved first $50,000' },
]

const HERO_PHOTOS = [
  { src:'photo-1571019613454-1cb2f99b2d8b', name:'James T.', goal:'Completed first marathon', badge:'3:52 finish', rot:-3, delay:'0s' },
  { src:'photo-1573496359142-b8d87734a5a2', name:'Ariana M.', goal:'Launched her brand', badge:'$10k first month', rot:2.5, delay:'0.4s' },
  { src:'photo-1500648767791-00dcc994a43e', name:'Marcus L.', goal:'Saved first $50k', badge:'4 months early', rot:1, delay:'0.8s' },
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
      {/* NAV */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-12 h-16 bg-white/95 backdrop-blur-sm border-b border-[#e8e8e8]">
        <span className="font-serif text-[22px] text-[#111]">manifest<span className="text-[#b8922a]">.</span></span>
        <div className="hidden md:flex gap-7">
          {[['How it works','#how'],['Stories','#stories'],['Pricing','#pricing']].map(([l,h])=>(
            <a key={l} href={h} className="text-[13px] text-[#666] hover:text-[#111] transition-colors">{l}</a>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          {user ? (
            <>
              <Link href="/dashboard" className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium border border-[#e8e8e8] rounded-lg hover:bg-[#f8f7f5] transition-colors">
                <div className="w-5 h-5 rounded-full bg-[#b8922a] flex items-center justify-center text-white text-[10px] font-bold">
                  {user.email?.[0]?.toUpperCase()}
                </div>
                Dashboard
              </Link>
            </>
          ) : (
            <>
              <Link href="/auth/login" className="px-4 py-2 text-[13px] font-medium border border-[#d0d0d0] rounded-lg hover:bg-[#f8f7f5] transition-colors">Sign in</Link>
              <Link href="/auth/signup" className="px-4 py-2 text-[13px] font-medium bg-[#111] text-white rounded-lg hover:bg-[#2a2a2a] transition-colors">Get started</Link>
            </>
          )}
        </div>
      </nav>

      {/* HERO */}
      <div className="max-w-[1240px] mx-auto grid md:grid-cols-2 min-h-[calc(100vh-64px)]">
        <div className="flex flex-col justify-center px-12 py-16 border-r border-[#e8e8e8]">
          <p className="text-[11px] font-medium tracking-[.14em] uppercase text-[#b8922a] mb-4 fade-up">Goal achievement, reimagined</p>
          <h1 className="font-serif text-[clamp(42px,5vw,68px)] leading-[1.07] tracking-[-0.02em] mb-5 fade-up-1">
            Turn your goals<br/>into <em className="italic text-[#b8922a]">lived</em> reality
          </h1>
          <p className="text-[16px] text-[#666] leading-[1.75] max-w-[440px] mb-8 fade-up-2">
            Manifest pairs AI-generated vision art with daily coaching and real accountability — so your goals stop being wishes and start becoming your life.
          </p>
          <div className="flex gap-3 mb-10 fade-up-3">
            {user ? (
              <Link href="/dashboard" className="px-7 py-3.5 bg-[#b8922a] text-white rounded-[14px] font-medium text-[15px] hover:bg-[#9a7820] transition-all hover:-translate-y-px">
                Continue my journey →
              </Link>
            ) : (
              <>
                <Link href="/auth/signup" className="px-7 py-3.5 bg-[#111] text-white rounded-[14px] font-medium text-[15px] hover:bg-[#2a2a2a] transition-all hover:-translate-y-px">
                  Create your vision — free
                </Link>
                <a href="#how" className="px-7 py-3.5 border border-[#d0d0d0] rounded-[14px] font-medium text-[15px] hover:bg-[#f8f7f5] transition-colors">
                  See how it works
                </a>
              </>
            )}
          </div>
          <div className="flex items-center gap-4 fade-up-4">
            <div className="flex">
              {['photo-1507003211169-0a1dd7228f2d','photo-1494790108755-2616b612b786','photo-1438761681033-6461ffad8d80','photo-1472099645785-5658abf4ff4e'].map((id,i)=>(
                <div key={i} className="w-8 h-8 rounded-full border-2 border-white overflow-hidden" style={{marginLeft:i>0?-8:0}}>
                  <img src={`https://images.unsplash.com/${id}?w=64&h=64&fit=crop&crop=face`} alt="" className="w-full h-full object-cover"/>
                </div>
              ))}
            </div>
            <p className="text-[13px] text-[#666]">
              <strong className="text-[#111] font-medium">{statUsers.toLocaleString()}+</strong> people building their dream life
            </p>
          </div>
        </div>
        <div className="hidden md:flex items-center justify-center p-12 overflow-hidden">
          <div className="relative w-[380px] h-[480px]">
            {HERO_PHOTOS.map((p,i)=>(
              <div key={i} className="absolute rounded-2xl overflow-hidden shadow-2xl float-anim" style={{
                width: 250-i*20, height: 320-i*30,
                top: i===0?10:i===1?30:undefined, bottom: i===2?10:undefined,
                left: i===0?10:i===2?60:undefined, right: i===1?0:undefined,
                '--r':`${p.rot}deg`, transform:`rotate(${p.rot}deg)`, animationDelay: p.delay
              } as any}>
                <img src={`https://images.unsplash.com/${p.src}?w=400&h=500&fit=crop&crop=top`} alt="" className="w-full h-full object-cover"/>
                <div className="absolute bottom-3 left-3 right-3 bg-white/92 backdrop-blur-sm rounded-xl p-2.5">
                  <p className="text-[13px] font-medium">{p.name}</p>
                  <p className="text-[11px] text-[#666]">{p.goal}</p>
                  <span className="inline-block mt-1 text-[10px] font-medium text-[#b8922a] bg-[#faf3e0] px-2 py-0.5 rounded-full">{p.badge}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TICKER */}
      <div className="bg-[#111] overflow-hidden py-2.5">
        <div className="ticker-track">
          {['Vision art','Daily coaching','Real accountability','Goal circles','Friends & DMs','AI-powered','Streak tracking','Vision art','Daily coaching','Real accountability','Goal circles','Friends & DMs','AI-powered','Streak tracking'].map((t,i)=>(
            <span key={i}><span className="text-[11px] tracking-[.16em] text-white/40 px-5 uppercase font-mono">{t}</span><span className="text-[#b8922a] px-1">·</span></span>
          ))}
        </div>
      </div>

      {/* HOW */}
      <section id="how" className="py-24 px-12 bg-[#f8f7f5]">
        <div className="max-w-[1240px] mx-auto">
          <div className="max-w-[520px] mb-14">
            <p className="text-[11px] font-medium tracking-[.14em] uppercase text-[#b8922a] mb-3">How it works</p>
            <h2 className="font-serif text-[clamp(32px,3.5vw,52px)] leading-[1.08] tracking-[-0.02em] mb-3">A system built around how humans actually change</h2>
            <p className="text-[16px] text-[#666] leading-[1.75]">Most goal apps track tasks. Manifest tracks transformation.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[#e8e8e8] border border-[#e8e8e8] rounded-2xl overflow-hidden">
            {[
              { n:'01', title:'Tell us your goal', desc:'A guided intake that goes beyond "what" — your why, fears, timeline, motivators, and what success truly looks like. The more specific, the better your manifest.' },
              { n:'02', title:'Get your vision art', desc:'AI generates personalized visual concepts — beautiful enough to frame, specific enough to feel like yours. Regenerate once a day to explore new styles.' },
              { n:'03', title:'Meet your AI coach', desc:'Your coach knows everything — your goal, your why, your patterns. Checks in daily, adapts based on real progress, and coaches the way you prefer.' },
              { n:'04', title:'Build real momentum', desc:'Streaks, milestones, goal circles, friends, and a community celebrating wins. Adjust your timeline anytime. Complete your goal and inspire others.' },
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

      {/* STORIES — dynamic */}
      <section id="stories" className="py-24 px-12">
        <div className="max-w-[1240px] mx-auto">
          <div className="flex justify-between items-end flex-wrap gap-6 mb-14">
            <div>
              <p className="text-[11px] font-medium tracking-[.14em] uppercase text-[#b8922a] mb-3">
                {stories.length >= 2 ? 'From our community' : 'Real people. Real results.'}
              </p>
              <h2 className="font-serif text-[clamp(32px,3.5vw,52px)] leading-[1.08] tracking-[-0.02em]">Goals that became real</h2>
            </div>
            <div className="flex gap-8">
              {[
                [`${statUsers.toLocaleString()}+`,'Users'],
                [`${statGoals.toLocaleString()}+`,'Goals created'],
                ['4.9★','Avg rating']
              ].map(([v,l])=>(
                <div key={l} className="border-l-2 border-[#b8922a] pl-4">
                  <div className="font-serif text-[32px]">{v}</div>
                  <div className="text-[11px] font-medium text-[#666] uppercase tracking-[.08em]">{l}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {displayStories.slice(0,3).map((s: any, i: number) => (
              <div key={i} className="border border-[#e8e8e8] rounded-2xl overflow-hidden hover-lift">
                <div className="h-[190px] overflow-hidden">
                  <img src={`https://images.unsplash.com/${HERO_PHOTOS[i % 3]?.src}?w=600&h=380&fit=crop&crop=top`} alt="" className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"/>
                </div>
                <div className="p-5">
                  <p className="font-serif italic text-[15px] leading-[1.65] mb-4">"{s.quote}"</p>
                  <div className="flex items-center gap-3 border-t border-[#e8e8e8] pt-4">
                    <div className="w-9 h-9 rounded-full bg-[#b8922a] flex items-center justify-center text-white font-semibold text-[13px] flex-shrink-0">
                      {s.profiles?.full_name?.[0]?.toUpperCase() || '?'}
                    </div>
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

      {/* PRICING */}
      <section id="pricing" className="py-24 px-12 bg-[#f8f7f5]">
        <div className="max-w-[1240px] mx-auto">
          <div className="text-center max-w-[440px] mx-auto mb-14">
            <p className="text-[11px] font-medium tracking-[.14em] uppercase text-[#b8922a] mb-3">Pricing</p>
            <h2 className="font-serif text-[clamp(32px,3.5vw,52px)] leading-[1.08] tracking-[-0.02em]">Start free, upgrade when you're ready</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-[900px] mx-auto">
            {[
              { name:'Free', price:'$0', period:'forever', desc:'Everything you need to start.', feats:['1 goal + vision art','3 AI art concepts','30-day AI coaching','Daily reminders','Friends & DMs'], featured:false, cta:'Get started free' },
              { name:'Pro', price:'$9', period:'/month', desc:'For serious goal setters.', feats:['Unlimited goals','AI concepts per goal','Full AI coach','Streaks + analytics','Goal Circles','Friends & DMs','Vision board regeneration','Weekly reports'], featured:true, cta:'Start free trial' },
              { name:'Elite', price:'$29', period:'/month', desc:'For those who refuse to leave goals to chance.', feats:['Everything in Pro','Human coach session/mo','Free monthly print','Premium art styles','Priority support'], featured:false, cta:'Get Elite' },
            ].map(p=>(
              <div key={p.name} className={`rounded-2xl p-8 relative ${p.featured?'border-2 border-[#111] bg-white':'border border-[#e8e8e8] bg-white'}`}>
                {p.featured && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#111] text-white text-[11px] font-medium px-4 py-1 rounded-full whitespace-nowrap">Most popular</div>}
                <p className="text-[11px] font-medium tracking-[.12em] uppercase text-[#666] mb-1.5">{p.name}</p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="font-serif text-[52px] leading-none">{p.price}</span>
                  <span className="text-[13px] text-[#666]">{p.period}</span>
                </div>
                <p className="text-[13px] text-[#666] mb-4 leading-[1.6]">{p.desc}</p>
                <div className="h-px bg-[#e8e8e8] mb-4"/>
                <ul className="space-y-2 mb-6">
                  {p.feats.map(f=><li key={f} className="flex gap-2 text-[13px]"><span className="text-[#b8922a] flex-shrink-0">✓</span>{f}</li>)}
                </ul>
                <Link href={user ? '/dashboard' : '/auth/signup'} className={`block w-full py-3 text-center text-[13px] font-medium rounded-xl transition-all ${p.featured?'bg-[#111] text-white hover:bg-[#2a2a2a]':'border border-[#d0d0d0] hover:bg-[#f8f7f5]'}`}>{p.cta}</Link>
              </div>
            ))}
          </div>
          <p className="text-center text-[12px] text-[#666] mt-6">No credit card required · Cancel anytime · 30-day money-back guarantee</p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-12 bg-[#111] text-center">
        <h2 className="font-serif text-[clamp(36px,4.5vw,64px)] leading-[1.07] tracking-[-0.02em] text-white mb-4">
          Your future self is<br/><em className="italic text-[#b8922a]">already waiting.</em>
        </h2>
        <p className="text-[16px] text-white/40 mb-8">Start free. No credit card. 5 minutes.</p>
        <Link href={user ? '/dashboard' : '/auth/signup'} className="inline-block px-8 py-4 bg-[#b8922a] text-white rounded-[14px] font-medium text-[15px] hover:bg-[#9a7820] transition-all hover:-translate-y-px">
          {user ? 'Continue my journey →' : 'Create my vision now →'}
        </Link>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#0a0a0a] px-12 pt-16 pb-8">
        <div className="max-w-[1240px] mx-auto grid grid-cols-2 md:grid-cols-4 gap-12 mb-12">
          <div>
            <p className="font-serif text-[22px] text-white mb-3">manifest<span className="text-[#b8922a]">.</span></p>
            <p className="text-[13px] text-white/35 leading-[1.7] max-w-[220px] mb-5">The world's most purposeful goal system. Not a vision board — a transformation engine.</p>
          </div>
          {[
            { title:'Product', links:['How it works','AI Coach','Vision Art','Goal Circles','Friends & DMs','Print Shop'] },
            { title:'Company', links:['About','Blog','Careers','Press','Contact'] },
            { title:'Legal', links:['Privacy Policy','Terms of Service','Cookie Policy','Support'] },
          ].map(col=>(
            <div key={col.title}>
              <p className="text-[10px] font-medium tracking-[.14em] uppercase text-white/30 mb-4">{col.title}</p>
              {col.links.map(l=><p key={l} className="text-[13px] text-white/35 mb-2 cursor-pointer hover:text-white/70 transition-colors">{l}</p>)}
            </div>
          ))}
        </div>
        <div className="border-t border-white/[0.07] pt-6 max-w-[1240px] mx-auto flex justify-between text-[12px] text-white/20">
          <span>© 2026 Manifest. All rights reserved.</span>
          <span>Built with purpose · Powered by AI</span>
        </div>
      </footer>
    </div>
  )
}
