'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

const CATEGORIES = [
  { v: 'bug',         l: '🐛 Bug report',       d: 'Something is broken' },
  { v: 'feature',     l: '✨ Feature request',   d: 'I want this' },
  { v: 'improvement', l: '⚡ Improvement',       d: 'Make something better' },
  { v: 'praise',      l: '❤️ Praise',            d: 'What I love' },
  { v: 'other',       l: '💬 Other',             d: 'General' },
]

export default function FeedbackPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [category, setCategory] = useState('improvement')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [todayCount, setTodayCount] = useState(0)
  const [myFeedback, setMyFeedback] = useState<any[]>([])
  const [avgRating, setAvgRating] = useState('—')
  const [totalRatings, setTotalRatings] = useState(0)
  // Weekly rating
  const [weekRating, setWeekRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [canRateThisWeek, setCanRateThisWeek] = useState(false)
  const [ratingSubmitted, setRatingSubmitted] = useState(false)
  const DAILY_LIMIT = 5

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      if (!user) return

      const today = new Date().toISOString().split('T')[0]
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()

      const [{ data: todayFb }, { data: mine }, { data: myRating }, { data: allRatings }] = await Promise.all([
        supabase.from('app_feedback').select('id').eq('user_id', user.id).gte('created_at', `${today}T00:00:00`),
        supabase.from('app_feedback').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
        supabase.from('app_ratings').select('rating, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('app_ratings').select('user_id, rating, created_at'),
      ])

      setTodayCount(todayFb?.length || 0)
      setMyFeedback(mine || [])

      // Check if can rate this week
      const lastRated = myRating?.created_at ? new Date(myRating.created_at) : null
      const canRate = !lastRated || (Date.now() - lastRated.getTime() > 7 * 86400000)
      setCanRateThisWeek(canRate)

      // Calculate avg using latest rating per user
      if (allRatings?.length) {
        const latestPerUser: Record<string, { rating: number; created_at: string }> = {}
        allRatings.forEach((r: any) => {
          if (!latestPerUser[r.user_id] || r.created_at > latestPerUser[r.user_id].created_at) {
            latestPerUser[r.user_id] = r
          }
        })
        const vals = Object.values(latestPerUser).map(r => r.rating)
        setTotalRatings(vals.length)
        setAvgRating((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1))
      }
    }
    load()
  }, [])

  const submitRating = async () => {
    if (!weekRating || !canRateThisWeek) return
    await supabase.from('app_ratings').upsert({ user_id: user.id, rating: weekRating, created_at: new Date().toISOString() }, { onConflict: 'user_id' })
    setRatingSubmitted(true)
    setCanRateThisWeek(false)
    toast.success('Rating submitted! Thank you ⭐')
    // Refresh avg
    const { data: allRatings } = await supabase.from('app_ratings').select('user_id, rating, created_at')
    if (allRatings?.length) {
      const latest: Record<string, number> = {}
      allRatings.forEach((r: any) => { if (!latest[r.user_id] || r.created_at > latest[r.user_id]) latest[r.user_id] = r.rating })
      const vals = Object.values(latest)
      setTotalRatings(vals.length)
      setAvgRating((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1))
    }
  }

  const submit = async () => {
    if (!message.trim() || submitting || todayCount >= DAILY_LIMIT) return
    setSubmitting(true)
    const { error } = await supabase.from('app_feedback').insert({ user_id: user.id, category, message: message.trim() })
    if (error) { toast.error('Could not submit'); setSubmitting(false); return }
    setTodayCount(c => c + 1)
    setMyFeedback(prev => [{ id: Date.now(), category, message: message.trim(), created_at: new Date().toISOString(), status: 'open' }, ...prev])
    setMessage('')
    toast.success('Feedback received! We read every message.')
    setSubmitting(false)
  }

  const remaining = DAILY_LIMIT - todayCount
  const stars = (n: number, filled: number) => Array.from({ length: 5 }, (_, i) => (
    <span key={i} className="text-[22px] transition-transform hover:scale-125 cursor-pointer" style={{ color: i < filled ? '#b8922a' : '#e8e8e8' }}>★</span>
  ))

  return (
    <div className="fade-up max-w-[680px]">
      <h1 className="font-serif text-[32px] mb-1">Feedback & Reviews</h1>
      <p className="text-[14px] text-[#666] mb-6">Every message is read by the team. Help us build the best goal app.</p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-4 text-center">
          <p className="font-serif text-[28px] mb-1">{avgRating}</p>
          <div className="flex justify-center gap-0.5 mb-1">{stars(5, Math.round(parseFloat(avgRating as string) || 0))}</div>
          <p className="text-[11px] text-[#999] uppercase tracking-[.08em]">Avg rating</p>
        </div>
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-4 text-center">
          <p className="font-serif text-[28px] mb-0.5">{totalRatings}</p>
          <p className="text-[11px] text-[#999] uppercase tracking-[.08em]">Total ratings</p>
        </div>
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-4 text-center">
          <p className="font-serif text-[28px] mb-0.5">{remaining}</p>
          <p className="text-[11px] text-[#999] uppercase tracking-[.08em]">Posts left today</p>
        </div>
      </div>

      {/* Weekly rating */}
      <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 mb-5">
        <p className="font-medium text-[15px] mb-1">Rate Manifest this week</p>
        <p className="text-[13px] text-[#999] mb-4">You can rate once per week. Your latest rating is used in the average.</p>
        {canRateThisWeek && !ratingSubmitted ? (
          <div className="flex items-center gap-4">
            <div className="flex gap-1">
              {[1,2,3,4,5].map(s => (
                <button key={s} onMouseEnter={() => setHoverRating(s)} onMouseLeave={() => setHoverRating(0)} onClick={() => setWeekRating(s)}
                  className="text-[28px] transition-transform hover:scale-125">
                  <span style={{ color: s <= (hoverRating || weekRating) ? '#b8922a' : '#e8e8e8' }}>★</span>
                </button>
              ))}
            </div>
            {weekRating > 0 && (
              <button onClick={submitRating} className="px-4 py-2 bg-[#111] text-white rounded-xl text-[13px] font-medium hover:bg-[#2a2a2a] transition-colors">
                Submit rating
              </button>
            )}
          </div>
        ) : ratingSubmitted ? (
          <p className="text-green-600 font-medium text-[14px]">✓ Thanks for rating! Come back next week.</p>
        ) : (
          <p className="text-[13px] text-[#999]">You've already rated this week. Come back in a few days.</p>
        )}
      </div>

      {/* Compose feedback */}
      <div className="bg-white border border-[#e8e8e8] rounded-2xl p-6 mb-6">
        <p className="font-medium text-[15px] mb-4">Send feedback</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
          {CATEGORIES.map(c => (
            <button key={c.v} onClick={() => setCategory(c.v)}
              className={`p-3 rounded-xl border text-left transition-all ${category === c.v ? 'bg-[#111] border-[#111]' : 'bg-white border-[#e8e8e8] hover:border-[#d0d0d0]'}`}>
              <p className={`text-[13px] font-medium ${category === c.v ? 'text-white' : 'text-[#111]'}`}>{c.l}</p>
              <p className={`text-[11px] mt-0.5 ${category === c.v ? 'text-white/50' : 'text-[#999]'}`}>{c.d}</p>
            </button>
          ))}
        </div>
        <textarea value={message} onChange={e => setMessage(e.target.value)}
          placeholder="Be as specific as possible — what page, what you expected, what happened instead..."
          className="w-full text-[14px] border border-[#e8e8e8] rounded-xl px-3.5 py-3 outline-none focus:border-[#111] resize-none leading-[1.65] mb-3"
          rows={4} maxLength={1000} disabled={remaining <= 0}/>
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-[#999]">{message.length}/1000 · {remaining} left today</span>
          <button onClick={submit} disabled={!message.trim() || submitting || remaining <= 0}
            className="px-5 py-2.5 bg-[#111] text-white rounded-xl text-[13px] font-medium disabled:opacity-40 hover:bg-[#2a2a2a] transition-colors">
            {submitting ? 'Sending...' : 'Send feedback'}
          </button>
        </div>
        {remaining <= 0 && <p className="text-[12px] text-[#b8922a] mt-2">Daily limit reached — resets at midnight.</p>}
      </div>

      {/* History */}
      {myFeedback.length > 0 && (
        <div>
          <p className="font-medium text-[14px] mb-3">Your feedback history</p>
          <div className="space-y-2">
            {myFeedback.map((fb: any) => {
              const cat = CATEGORIES.find(c => c.v === fb.category)
              return (
                <div key={fb.id} className="bg-white border border-[#e8e8e8] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-[11px] font-medium text-[#666] bg-[#f2f0ec] px-2 py-0.5 rounded-full">{cat?.l || fb.category}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${fb.status === 'resolved' ? 'bg-green-50 text-green-700' : 'bg-[#faf3e0] text-[#b8922a]'}`}>
                      {fb.status === 'resolved' ? '✓ Resolved' : 'Open'}
                    </span>
                    <span className="text-[11px] text-[#999]">{new Date(fb.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-[13px] text-[#666] leading-[1.6]">{fb.message}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
