import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  return (
    <div className="fade-up">
      <h1 className="font-serif text-[32px] mb-4">Dashboard</h1>
      <p className="text-[#666] mb-4">User: {user.email}</p>
      <Link href="/onboarding" className="px-4 py-2 bg-[#111] text-white rounded-xl text-[13px]">Create goal</Link>
    </div>
  )
}