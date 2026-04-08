'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

export default function DashboardClient({ userId }: { userId: string }) {
  const supabase = createClient()
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [dismissed, setDismissed] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  if (dismissed) return null

  const submit = async () => {
    if (!rating) return
    await supabase.from('app_ratings').upsert({ user_id: userId, rating, created_at: new Date().toISOString() })
    setSubmitted(true)
    toast.success('Thanks for your feedback!')
    setTimeout(() => setDismissed(true), 2000)
  }

  return (
    <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 flex items-center justify-between gap-4 flex-wrap">
      {submitted ? (
        <p className="text-[14px] text-[#666] font-medium w-full text-center">Thanks for rating Manifest! ⭐</p>
      ) : (
        <>
          <div>
            <p className="font-medium text-[14px] mb-0.5">Enjoying Manifest?</p>
            <p className="text-[12px] text-[#999]">Rate your experience to help us improve</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {[1,2,3,4,5].map(s => (
                <button key={s}
                  onMouseEnter={() => setHover(s)}
                  onMouseLeave={() => setHover(0)}
                  onClick={() => setRating(s)}
                  className="text-[24px] transition-transform hover:scale-125">
                  <span style={{ color: s <= (hover || rating) ? '#b8922a' : '#e8e8e8' }}>★</span>
                </button>
              ))}
            </div>
            {rating > 0 && (
              <button onClick={submit} className="px-4 py-2 bg-[#111] text-white rounded-xl text-[12px] font-medium hover:bg-[#2a2a2a] transition-colors">
                Submit
              </button>
            )}
            <button onClick={() => setDismissed(true)} className="text-[#ccc] hover:text-[#999] text-[18px] leading-none">×</button>
          </div>
        </>
      )}
    </div>
  )
}
