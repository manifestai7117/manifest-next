import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

const ADMIN_EMAIL = 'hpari002@ucr.edu' // Change to your email

export default async function AdminPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('email').eq('id', user.id).single()
  if (profile?.email !== ADMIN_EMAIL) redirect('/dashboard')

  const admin = createAdminClient()
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString()
  const dayAgo = new Date(now.getTime() - 86400000).toISOString()

  const [
    { count: totalUsers }, { count: dau }, { count: wau },
    { count: totalGoals }, { count: totalCheckins },
    { data: reports }, { data: feedback }, { data: topGoals },
  ] = await Promise.all([
    admin.from('profiles').select('*', { count: 'exact', head: true }),
    admin.from('checkins').select('*', { count: 'exact', head: true }).gte('created_at', dayAgo),
    admin.from('checkins').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo),
    admin.from('goals').select('*', { count: 'exact', head: true }).eq('is_active', true),
    admin.from('checkins').select('*', { count: 'exact', head: true }),
    admin.from('content_reports').select('*, reporter:profiles!content_reports_reporter_id_fkey(full_name,email)').eq('status', 'pending').order('created_at', { ascending: false }).limit(20),
    admin.from('app_feedback').select('*, user:profiles!app_feedback_user_id_fkey(full_name,email)').eq('status', 'open').order('created_at', { ascending: false }).limit(20),
    admin.from('goals').select('title, category').eq('is_active', true).limit(100),
  ])

  const categoryCount: Record<string, number> = {}
  ;(topGoals || []).forEach((g: any) => { categoryCount[g.category] = (categoryCount[g.category] || 0) + 1 })
  const sortedCategories = Object.entries(categoryCount).sort(([,a],[,b]) => b - a)

  return (
    <div className="fade-up max-w-[900px]">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="font-serif text-[32px]">Admin</h1>
        <span className="text-[11px] bg-red-100 text-red-700 px-2.5 py-1 rounded-full font-medium">Internal only</span>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { val: totalUsers || 0, label: 'Total users' },
          { val: dau || 0, label: 'DAU (checkins)' },
          { val: wau || 0, label: 'WAU (checkins)' },
          { val: totalGoals || 0, label: 'Active goals' },
          { val: totalCheckins || 0, label: 'Total checkins' },
        ].map(({ val, label }) => (
          <div key={label} className="bg-white border border-[#e8e8e8] rounded-2xl p-4 text-center">
            <p className="font-serif text-[28px] mb-0.5">{val.toLocaleString()}</p>
            <p className="text-[11px] text-[#999] uppercase tracking-[.05em]">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Top categories */}
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5">
          <p className="font-medium text-[14px] mb-3">Top goal categories</p>
          <div className="space-y-2">
            {sortedCategories.slice(0, 8).map(([cat, count]) => (
              <div key={cat} className="flex items-center gap-3">
                <span className="text-[12px] text-[#666] flex-1 truncate">{cat}</span>
                <div className="w-24 bg-[#f0ede8] rounded-full h-2 overflow-hidden">
                  <div className="h-full bg-[#b8922a] rounded-full" style={{ width: `${(count / (sortedCategories[0][1] || 1)) * 100}%` }}/>
                </div>
                <span className="text-[11px] text-[#999] w-6 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Reported content */}
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5">
          <p className="font-medium text-[14px] mb-3">Pending reports <span className="text-red-500 font-semibold">({(reports || []).length})</span></p>
          {(reports || []).length === 0 ? (
            <p className="text-[13px] text-[#999]">No pending reports ✓</p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {(reports || []).map((r: any) => (
                <div key={r.id} className="bg-red-50 border border-red-100 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium capitalize">{r.target_type}</span>
                    <span className="text-[11px] text-[#999]">{r.reporter?.full_name}</span>
                  </div>
                  <p className="text-[12px] text-[#666]">{r.reason}</p>
                  <p className="text-[10px] text-[#999] mt-1">Target ID: {r.target_id.slice(0,8)}...</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Open feedback */}
      <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5">
        <p className="font-medium text-[14px] mb-3">Open feedback <span className="text-[#b8922a] font-semibold">({(feedback || []).length})</span></p>
        {(feedback || []).length === 0 ? (
          <p className="text-[13px] text-[#999]">No open feedback ✓</p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {(feedback || []).map((f: any) => (
              <div key={f.id} className="border border-[#e8e8e8] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[11px] font-medium text-[#666] bg-[#f2f0ec] px-2 py-0.5 rounded-full capitalize">{f.category}</span>
                  <span className="text-[11px] text-[#999]">{f.user?.full_name || f.user?.email}</span>
                  <span className="text-[11px] text-[#999]">· {new Date(f.created_at).toLocaleDateString()}</span>
                </div>
                <p className="text-[13px] text-[#333] leading-[1.6]">{f.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
