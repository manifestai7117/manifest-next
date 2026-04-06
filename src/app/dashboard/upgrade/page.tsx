'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

const FREE_FEATURES = [
  '2 active goals',
  '5 AI coach chats per day',
  'Basic vision art (1 style)',
  'Streak tracking',
  'Goal circles (view only)',
  'Friends & DMs',
]

const PRO_FEATURES = [
  '5 active goals',
  '15 AI coach chats per day',
  'Personalized vision art with YOU in it',
  'Regenerate vision board daily',
  'All 4 art styles',
  'Goal Circles (full access + AI coach)',
  'Friends & DMs',
  'Streak analytics + mood tracking',
  'Phase completion rewards',
  'Priority support',
]

export default function UpgradePage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  const activateTrial = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const trialExpiry = new Date()
    trialExpiry.setMonth(trialExpiry.getMonth() + 3)

    const { error } = await supabase.from('profiles').update({
      plan: 'pro_trial',
      pro_trial_started_at: new Date().toISOString(),
      plan_expires_at: trialExpiry.toISOString(),
    }).eq('id', user.id)

    if (error) { toast.error('Failed to activate trial'); setLoading(false); return }
    toast.success('🎉 Pro trial activated! 3 months free.')
    router.push('/dashboard')
    router.refresh()
    setLoading(false)
  }

  return (
    <div className="fade-up max-w-[800px]">
      <h1 className="font-serif text-[32px] mb-1">Upgrade to Pro</h1>
      <p className="text-[14px] text-[#666] mb-8">Try Pro free for 3 months. No credit card required.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
        {/* Free */}
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-6">
          <p className="text-[11px] font-medium tracking-[.12em] uppercase text-[#999] mb-2">Free</p>
          <div className="font-serif text-[44px] leading-none mb-1">$0</div>
          <p className="text-[13px] text-[#999] mb-5">forever</p>
          <div className="h-px bg-[#e8e8e8] mb-5"/>
          <ul className="space-y-3">
            {FREE_FEATURES.map(f=>(
              <li key={f} className="flex gap-2.5 text-[13px] text-[#666]">
                <span className="text-[#999] flex-shrink-0">○</span>{f}
              </li>
            ))}
          </ul>
          <div className="mt-6 py-3 text-center text-[13px] text-[#999] border border-[#e8e8e8] rounded-xl">Your current plan</div>
        </div>

        {/* Pro */}
        <div className="bg-white border-2 border-[#111] rounded-2xl p-6 relative">
          <div className="absolute -top-3 left-6 bg-[#b8922a] text-white text-[10px] font-medium px-3 py-1 rounded-full">FREE FOR 3 MONTHS</div>
          <p className="text-[11px] font-medium tracking-[.12em] uppercase text-[#b8922a] mb-2">Pro</p>
          <div className="flex items-baseline gap-1 mb-1">
            <span className="font-serif text-[44px] leading-none line-through text-[#ccc]">$9</span>
            <span className="font-serif text-[32px] text-[#b8922a] ml-2">Free</span>
          </div>
          <p className="text-[13px] text-[#666] mb-5">for 3 months, then $9/month</p>
          <div className="h-px bg-[#e8e8e8] mb-5"/>
          <ul className="space-y-3">
            {PRO_FEATURES.map(f=>(
              <li key={f} className="flex gap-2.5 text-[13px]">
                <span className="text-[#b8922a] flex-shrink-0 font-bold">✓</span>{f}
              </li>
            ))}
          </ul>
          <button onClick={activateTrial} disabled={loading} className="mt-6 w-full py-3.5 bg-[#111] text-white rounded-xl text-[14px] font-medium hover:bg-[#2a2a2a] transition-colors disabled:opacity-50">
            {loading ? 'Activating...' : 'Start 3-month free trial →'}
          </button>
          <p className="text-center text-[11px] text-[#999] mt-2">No credit card · Cancel anytime · After 3 months: $9/month</p>
        </div>
      </div>

      {/* Key differences */}
      <div className="bg-[#f8f7f5] rounded-2xl p-6">
        <h3 className="font-medium text-[15px] mb-4">The key differences</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { title:'5× more coaching', desc:'Free gets 5 chats/day. Pro gets 15. Your coach knows all your goals.' },
            { title:'You in the art', desc:'Vision art generates a person who looks like you achieving your goal — not a generic image.' },
            { title:'More goals', desc:'Free allows 2 active goals. Pro allows 5 — tackle everything you\'re working on.' },
          ].map(d=>(
            <div key={d.title} className="bg-white rounded-xl p-4 border border-[#e8e8e8]">
              <p className="font-medium text-[13px] mb-1">{d.title}</p>
              <p className="text-[12px] text-[#666] leading-[1.6]">{d.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
