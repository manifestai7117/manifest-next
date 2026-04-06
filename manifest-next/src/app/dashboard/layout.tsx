import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardShell from '@/components/dashboard/DashboardShell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const { data: goals } = await supabase.from('goals').select('*').eq('user_id', user.id).eq('is_active', true).order('created_at', { ascending: false })
  const { data: circles } = await supabase.from('circles').select('*').order('streak', { ascending: false })
  const { data: myCircles } = await supabase.from('circle_members').select('circle_id').eq('user_id', user.id)

  const activeGoal = goals?.[0] || null
  const myCircleIds = myCircles?.map(m => m.circle_id) || []

  return (
    <DashboardShell
      profile={profile}
      activeGoal={activeGoal}
      circles={circles || []}
      myCircleIds={myCircleIds}
    >
      {children}
    </DashboardShell>
  )
}
