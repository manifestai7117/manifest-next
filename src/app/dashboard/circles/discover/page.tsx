'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export default function DiscoverCirclesPage() {
  const supabase = createClient()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [circles, setCircles] = useState<any[]>([])
  const [myCircleIds, setMyCircleIds] = useState<string[]>([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState<string | null>(null)
  const [recommendations, setRecommendations] = useState<any[]>([])

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      if (!user) return

      const [{ data: c }, { data: mc }, { data: rec }] = await Promise.all([
        supabase.from('circles').select('*').order('created_at', { ascending: false }),
        supabase.from('circle_members').select('circle_id').eq('user_id', user.id),
        supabase.from('goal_recommendations').select('*').order('popularity', { ascending: false }).limit(6),
      ])
      setCircles(c || [])
      setMyCircleIds((mc || []).map((m: any) => m.circle_id))
      setRecommendations(rec || [])
      setLoading(false)
    }
    load()
  }, [])

  const join = async (circleId: string) => {
    if (!user || joining) return
    setJoining(circleId)
    const { error } = await supabase.from('circle_members').insert({ circle_id: circleId, user_id: user.id })
    if (error) { toast.error('Could not join'); setJoining(null); return }
    setMyCircleIds(prev => [...prev, circleId])
    toast.success('Joined! Head to Goal Circles to chat.')
    setJoining(null)
  }

  const categories = ['all', ...(circles || []).map((c: any) => c.category).filter(Boolean).filter((c: string, i: number, a: string[]) => a.indexOf(c) === i)]
  const filtered = filter === 'all' ? circles : circles.filter((c: any) => c.category === filter)

  return (
    <div className="fade-up max-w-[900px]">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-[32px] mb-1">Discover Circles</h1>
          <p className="text-[14px] text-[#666]">Find your accountability community</p>
        </div>
        <button onClick={() => router.push('/dashboard/circles')}
          className="px-4 py-2 border border-[#e8e8e8] rounded-xl text-[13px] text-[#666] hover:bg-[#f8f7f5] transition-colors">
          ← My Circles
        </button>
      </div>



      {/* Category filter */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {categories.map(cat => (
          <button key={cat} onClick={() => setFilter(cat)}
            className={`px-4 py-1.5 rounded-full text-[12px] border capitalize transition-all ${filter === cat ? 'bg-[#111] text-white border-[#111]' : 'bg-white text-[#666] border-[#e8e8e8] hover:border-[#d0d0d0]'}`}>
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="bg-white border border-[#e8e8e8] rounded-2xl h-48 animate-pulse"/>)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-[#999]">
          <p className="text-[48px] mb-3">◉</p>
          <p className="text-[15px] font-medium mb-1">No circles yet</p>
          <p className="text-[13px]">Be the first to create one!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c: any) => {
            const joined = myCircleIds.includes(c.id)
            return (
              <div key={c.id} className="bg-white border border-[#e8e8e8] rounded-2xl p-5 flex flex-col hover:border-[#d0d0d0] transition-all">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-[10px] font-medium tracking-[.1em] uppercase text-[#999] bg-[#f2f0ec] px-2.5 py-1 rounded-full">{c.category}</span>
                  {joined && <span className="text-[10px] font-medium text-green-600 bg-green-50 px-2.5 py-1 rounded-full">Joined ✓</span>}
                </div>
                <h3 className="font-medium text-[15px] mb-1">{c.name}</h3>
                <p className="text-[12px] text-[#666] leading-[1.55] mb-3 flex-1">{c.goal_description}</p>
                <div className="flex items-center justify-between text-[11px] text-[#999] mb-3">
                  <span>{c.member_count || 0} members</span>
                  {c.streak > 0 && <span>🔥 {c.streak} day streak</span>}
                </div>
                {joined ? (
                  <button onClick={() => router.push('/dashboard/circles')}
                    className="w-full py-2.5 text-[12px] font-medium border border-[#e8e8e8] rounded-xl hover:bg-[#f8f7f5] transition-colors">
                    Open circle →
                  </button>
                ) : (
                  <button onClick={() => join(c.id)} disabled={joining === c.id}
                    className="w-full py-2.5 text-[12px] font-medium bg-[#111] text-white rounded-xl hover:bg-[#2a2a2a] transition-colors disabled:opacity-50">
                    {joining === c.id ? 'Joining...' : 'Join circle'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}