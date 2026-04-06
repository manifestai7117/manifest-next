import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function GoalPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: goals } = await supabase.from('goals').select('*').eq('user_id', user.id).eq('is_active', true).order('created_at', { ascending: false })
  const goal = goals?.[0]

  if (!goal) return (
    <div className="fade-up">
      <h1 className="font-serif text-[32px] mb-4">My Goal</h1>
      <div className="bg-white border border-[#e8e8e8] rounded-2xl p-8 text-center">
        <p className="text-[#666] mb-4">No active goal yet.</p>
        <Link href="/onboarding" className="inline-block px-5 py-2.5 bg-[#111] text-white rounded-xl text-[13px] font-medium">Create my first goal →</Link>
      </div>
    </div>
  )

  return (
    <div className="fade-up max-w-[800px]">
      <h1 className="font-serif text-[32px] mb-1">My Goal</h1>
      <p className="text-[14px] text-[#666] mb-8">Your complete goal profile and roadmap</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-6">
          <p className="text-[10px] font-medium tracking-[.12em] uppercase text-[#b8922a] mb-3">The goal</p>
          <p className="font-serif text-[20px] leading-[1.4] mb-4">{goal.title}</p>
          <div className="flex gap-2 flex-wrap">
            <span className="text-[11px] font-medium text-[#b8922a] bg-[#faf3e0] px-2.5 py-1 rounded-full">{goal.timeline}</span>
            <span className="text-[11px] font-medium text-[#666] bg-[#f2f0ec] px-2.5 py-1 rounded-full">{goal.category}</span>
          </div>
        </div>
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-6">
          <p className="text-[10px] font-medium tracking-[.12em] uppercase text-[#b8922a] mb-3">The why</p>
          <p className="text-[14px] text-[#666] leading-[1.72]">{goal.why}</p>
        </div>
      </div>

      <div className="bg-white border border-[#e8e8e8] rounded-2xl p-6 mb-4">
        <p className="font-medium mb-4 text-[15px]">90-day roadmap</p>
        {[['30 days', goal.milestone_30, true],['60 days', goal.milestone_60, false],['90 days', goal.milestone_90, false]].map(([t,v,active], i) => (
          <div key={String(t)} className={`flex gap-4 py-3.5 ${i < 2 ? 'border-b border-[#e8e8e8]' : ''} items-start`}>
            <span className="text-[12px] font-medium text-[#b8922a] w-16 flex-shrink-0 pt-0.5">{String(t)}</span>
            <span className="text-[14px] flex-1 leading-[1.6]">{String(v)}</span>
            <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${active ? 'bg-green-50 text-green-700' : 'bg-[#f2f0ec] text-[#999]'}`}>{active ? 'In progress' : 'Upcoming'}</span>
          </div>
        ))}
      </div>

      <div className="bg-[#111] rounded-2xl p-6">
        <p className="text-[10px] font-medium tracking-[.12em] uppercase text-white/30 mb-3">Your affirmation</p>
        <p className="font-serif italic text-[18px] text-white/85 leading-[1.6]">"{goal.affirmation}"</p>
      </div>
    </div>
  )
}
