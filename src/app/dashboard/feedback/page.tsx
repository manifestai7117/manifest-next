'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

const CATEGORIES = [
  { value: 'bug', label: '🐛 Bug report', desc: 'Something is broken' },
  { value: 'feature', label: '✨ Feature request', desc: 'Something I want' },
  { value: 'improvement', label: '⚡ Improvement', desc: 'Make something better' },
  { value: 'praise', label: '❤️ Praise', desc: 'What I love' },
  { value: 'other', label: '💬 Other', desc: 'General feedback' },
]

export default function FeedbackPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [category, setCategory] = useState('improvement')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [todayCount, setTodayCount] = useState(0)
  const [myFeedback, setMyFeedback] = useState<any[]>([])
  const [allRatings, setAllRatings] = useState<any[]>([])
  const DAILY_LIMIT = 5

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      if (!user) return
      const today = new Date().toISOString().split('T')[0]
      const { data: todayFb } = await supabase.from('app_feedback').select('id').eq('user_id', user.id).gte('created_at', `${today}T00:00:00`)
      setTodayCount(todayFb?.length || 0)
      const { data: mine } = await supabase.from('app_feedback').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20)
      setMyFeedback(mine || [])
      const { data: ratings } = await supabase.from('app_ratings').select('rating')
      setAllRatings(ratings || [])
    }
    load()
  }, [])

  const avgRating = allRatings.length
    ? (allRatings.reduce((a, r) => a + r.rating, 0) / allRatings.length).toFixed(1)
    : '—'

  const submit = async () => {
    if (!message.trim() || submitting) return
    if (todayCount >= DAILY_LIMIT) { toast.error(`Daily limit of ${DAILY_LIMIT} messages reached`); return }
    setSubmitting(true)
    const { error } = await supabase.from('app_feedback').insert({
      user_id: user.id,
      category,
      message: message.trim(),
    })
    if (error) { toast.error('Could not submit'); setSubmitting(false); return }
    setTodayCount(c => c + 1)
    setMyFeedback(prev => [{ id: Date.now(), category, message: message.trim(), created_at: new Date().toISOString() }, ...prev])
    setMessage('')
    toast.success('Thanks! Your feedback helps us improve Manifest.')
    setSubmitting(false)
  }

  const remaining = DAILY_LIMIT - todayCount

  return (
    <div className="fade-up max-w-[680px]">
      <div className="mb-7">
        <h1 className="font-serif text-[32px] mb-1">Feedback & Reviews</h1>
        <p className="text-[14px] text-[#666]">Your voice shapes Manifest. Every message is read by the team.</p>
      </div>

      {/* App stats */}
      <div className="grid grid-cols-3 gap-3 mb-7">
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-4 text-center">
          <p className="font-serif text-[28px] mb-0.5">{avgRating}</p>
          <p className="text-[11px] text-[#999] uppercase tracking-[.08em]">Avg rating</p>
          <div className="flex justify-center gap-0.5 mt-1">
            {[1,2,3,4,5].map(s => (
              <span key={s} className="text-[14px]" style={{ color: s <= Math.round(parseFloat(avgRating as string) || 0) ? '#b8922a' : '#e8e8e8' }}>★</span>
            ))}
          </div>
        </div>
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-4 text-center">
          <p className="font-serif text-[28px] mb-0.5">{allRatings.length}</p>
          <p className="text-[11px] text-[#999] uppercase tracking-[.08em]">Total ratings</p>
        </div>
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-4 text-center">
          <p className="font-serif text-[28px] mb-0.5">{remaining}</p>
          <p className="text-[11px] text-[#999] uppercase tracking-[.08em]">Posts left today</p>
        </div>
      </div>

      {/* Compose */}
      <div className="bg-white border border-[#e8e8e8] rounded-2xl p-6 mb-6">
        <p className="font-medium text-[15px] mb-4">Send feedback</p>

        {/* Category */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
          {CATEGORIES.map(c => (
            <button key={c.value} onClick={() => setCategory(c.value)}
              className={`p-3 rounded-xl border text-left transition-all ${category === c.value ? 'bg-[#111] border-[#111]' : 'bg-white border-[#e8e8e8] hover:border-[#d0d0d0]'}`}>
              <p className={`text-[13px] font-medium ${category === c.value ? 'text-white' : 'text-[#111]'}`}>{c.label}</p>
              <p className={`text-[11px] mt-0.5 ${category === c.value ? 'text-white/50' : 'text-[#999]'}`}>{c.desc}</p>
            </button>
          ))}
        </div>

        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Describe the bug, feature, or improvement in detail. The more specific, the better we can act on it."
          className="w-full text-[14px] border border-[#e8e8e8] rounded-xl px-3.5 py-3 outline-none focus:border-[#111] resize-none leading-[1.65] mb-3"
          rows={4}
          maxLength={1000}
          disabled={remaining <= 0}
        />

        <div className="flex items-center justify-between">
          <span className="text-[12px] text-[#999]">
            {message.length}/1000 · {remaining} message{remaining !== 1 ? 's' : ''} left today
          </span>
          <button onClick={submit} disabled={!message.trim() || submitting || remaining <= 0}
            className="px-5 py-2.5 bg-[#111] text-white rounded-xl text-[13px] font-medium disabled:opacity-40 hover:bg-[#2a2a2a] transition-colors">
            {submitting ? 'Sending...' : 'Send feedback'}
          </button>
        </div>

        {remaining <= 0 && (
          <p className="text-[12px] text-[#b8922a] mt-2">Daily limit reached — come back tomorrow to send more feedback.</p>
        )}
      </div>

      {/* My feedback history */}
      {myFeedback.length > 0 && (
        <div>
          <p className="font-medium text-[14px] mb-3">Your recent feedback</p>
          <div className="space-y-2">
            {myFeedback.map((fb: any) => {
              const cat = CATEGORIES.find(c => c.value === fb.category)
              return (
                <div key={fb.id} className="bg-white border border-[#e8e8e8] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[11px] font-medium text-[#666] bg-[#f2f0ec] px-2 py-0.5 rounded-full">{cat?.label || fb.category}</span>
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
