'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

interface Props {
  userId: string
  currentUserId: string
  onClose: () => void
}

export default function MemberProfile({ userId, currentUserId, onClose }: Props) {
  const supabase = createClient()
  const [profile, setProfile] = useState<any>(null)
  const [goals, setGoals] = useState<any[]>([])
  const [friendship, setFriendship] = useState<'none' | 'pending' | 'friends'>('none')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    const load = async () => {
      const [{ data: prof }, { data: gs }, { data: fs }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('goals').select('title, category, streak, progress').eq('user_id', userId).eq('is_active', true).limit(3),
        supabase.from('friendships').select('*').or(`and(requester.eq.${currentUserId},addressee.eq.${userId}),and(requester.eq.${userId},addressee.eq.${currentUserId})`).maybeSingle(),
      ])
      setProfile(prof)
      setGoals(gs || [])
      setFriendship(fs ? (fs.status === 'accepted' ? 'friends' : 'pending') : 'none')
      setLoading(false)
    }
    load()
  }, [userId])

  const addFriend = async () => {
    setAdding(true)
    await supabase.from('friendships').insert({ requester: currentUserId, addressee: userId, status: 'pending' })
    setFriendship('pending')
    toast.success('Friend request sent!')
    setAdding(false)
  }

  if (loading) return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-8 w-full max-w-[380px]">
        <div className="text-center text-[#999] text-[14px]">Loading...</div>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-[380px] overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-[#111] p-6 text-center relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-white/40 hover:text-white text-[20px] leading-none">×</button>
          {profile?.avatar_url
            ? <img src={profile.avatar_url} alt="" className="w-20 h-20 rounded-full object-cover mx-auto mb-3 border-4 border-white/10"/>
            : <div className="w-20 h-20 rounded-full bg-[#b8922a] flex items-center justify-center text-white text-[28px] font-semibold mx-auto mb-3">{profile?.full_name?.[0]?.toUpperCase() || '?'}</div>
          }
          <p className="text-white font-serif text-[20px] mb-0.5">{profile?.full_name}</p>
          <p className="text-white/40 text-[12px] capitalize">{profile?.plan === 'pro_trial' ? 'Pro Trial' : profile?.plan} member</p>
        </div>

        <div className="p-5">
          {/* Active goals */}
          {goals.length > 0 && (
            <div className="mb-4">
              <p className="text-[10px] font-medium tracking-[.1em] uppercase text-[#999] mb-2">Active goals</p>
              <div className="space-y-2">
                {goals.map((g, i) => (
                  <div key={i} className="bg-[#f8f7f5] rounded-xl p-3">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <p className="text-[13px] font-medium text-[#111] leading-tight">{g.title}</p>
                      <span className="text-[10px] text-[#b8922a] bg-[#faf3e0] px-2 py-0.5 rounded-full flex-shrink-0">{g.streak}🔥</span>
                    </div>
                    <div className="h-1 bg-[#e8e8e8] rounded-full overflow-hidden">
                      <div className="h-full bg-[#b8922a] rounded-full" style={{ width: `${g.progress || 0}%` }}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action */}
          {currentUserId !== userId && (
            <div>
              {friendship === 'friends' ? (
                <div className="flex items-center justify-center gap-2 py-3 bg-green-50 rounded-xl text-green-700 text-[13px] font-medium">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  Already friends
                </div>
              ) : friendship === 'pending' ? (
                <div className="text-center py-3 text-[13px] text-[#999]">Request sent · Pending</div>
              ) : (
                <button onClick={addFriend} disabled={adding}
                  className="w-full py-3 bg-[#111] text-white rounded-xl text-[13px] font-medium hover:bg-[#2a2a2a] transition-colors disabled:opacity-50">
                  {adding ? 'Sending...' : '+ Add friend'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
