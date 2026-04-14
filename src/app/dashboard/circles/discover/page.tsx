'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function DiscoverCirclesPage() {
  const supabase = createClient()
  const router = useRouter()
  const [circles, setCircles] = useState<any[]>([])
  const [recommendations, setRecommendations] = useState<any[]>([])
  const [myCircleIds, setMyCircleIds] = useState<string[]>([])
  const [filter, setFilter] = useState('all')
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ data: c }, { data: mc }, { data: rec }, { data: userGoals }] = await Promise.all([
        supabase.from('circles').select('*').order('member_count', { ascending: false }),
        supabase.from('circle_members').select('circle_id').eq('user_id', user.id),
        supabase.from('goal_recommendations').select('*').order('popularity', { ascending: false }).limit(6),
        supabase.from('goals').select('category').eq('user_id', user.id).eq('is_active', true),
      ])
      setCircles(c || [])
      setMyCircleIds((mc || []).map((m: any) => m.circle_id))
      setRecommendations(rec || [])
      // Get circle leaderboard - circles by member streak
      const { data: lb } = await supabase.from('circle_members').select('circle_id, user_id, profiles:profiles(full_name, avatar_url), goals:goals(streak, title)').limit(50)
      setLoading(false)
    }
    load()
  }, [])

  const categories = ['all', ...(circles || []).map((c: any) => c.category).filter(Boolean).filter((c: string, i: number, a: string[]) => a.indexOf(c) === i)]
  const filtered = filter === 'all' ? circles : circles.filter(c => c.category === filter)

  return (
    <div className="fade-up max-w-[900px]">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-serif text-[32px] mb-1">Discover Circles</h1>
          <p className="text-[14px] text-[#666]">Find your accountability community</p>
        </div>
        <button onClick={() => router.back()} className="px-4 py-2 border border-[#e8e8e8] rounded-xl text-[13px] text-[#666] hover:bg-[#f8f7f5] transition-colors">← Back</button>
      </div>

      {/* Goal recommendations */}
      {recommendations.length > 0 && (
        <div className="mb-6">
          <p className="font-medium text-[14px] mb-3">Popular goals people are tracking</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {recommendations.map((r: any) => (
              <div key={r.id} className="bg-white border border-[#e8e8e8] rounded-2xl p-4 hover:border-[#d0d0d0] transition-all">
                <p className="text-[13px] font-medium mb-1">{r.title}</p>
                <p className="text-[11px] text-[#999] mb-2">{r.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#b8922a] bg-[#faf3e0] px-2 py-0.5 rounded-full">{r.category}</span>
                  <span className="text-[10px] text-[#999]">{r.popularity.toLocaleString()} tracking</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category filter */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {categories.map(cat => (
          <button key={cat} onClick={() => setFilter(cat)}
            className={`px-4 py-1.5 rounded-full text-[12px] border transition-all capitalize ${filter === cat ? 'bg-[#111] text-white border-[#111]' : 'bg-white text-[#666] border-[#e8e8e8] hover:border-[#d0d0d0]'}`}>
            {cat}
          </button>
        ))}
      </div>

      {/* Circles grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((c: any) => {
          const joined = myCircleIds.includes(c.id)
          return (
            <div key={c.id} className="bg-white border border-[#e8e8e8] rounded-2xl p-5 hover:border-[#d0d0d0] transition-all">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-medium tracking-[.1em] uppercase text-[#999] bg-[#f2f0ec] px-2.5 py-1 rounded-full">{c.category}</span>
                {joined && <span className="text-[10px] font-medium text-green-600 bg-green-50 px-2.5 py-1 rounded-full">Joined ✓</span>}
              </div>
              <h3 className="font-medium text-[15px] mb-1">{c.name}</h3>
              <p className="text-[12px] text-[#666] mb-3 leading-[1.5]">{c.goal_description}</p>
              <div className="flex items-center justify-between text-[11px] text-[#999] mb-3">
                <span>{c.member_count || 0} members</span>
                {c.streak > 0 && <span>🔥 {c.streak} day streak</span>}
              </div>
              <button onClick={() => router.push('/dashboard/circles')}
                className={`w-full py-2 text-[12px] font-medium rounded-xl transition-colors ${joined ? 'border border-[#e8e8e8] text-[#666] hover:bg-[#f8f7f5]' : 'bg-[#111] text-white hover:bg-[#2a2a2a]'}`}>
                {joined ? 'Open circle' : 'View & join'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}