'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export default function CheckInButton({ goalId }: { goalId: string }) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [mood, setMood] = useState(3)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const submit = async () => {
    setLoading(true)
    const res = await fetch('/api/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goalId, note, mood }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { toast.error(data.error || 'Check-in failed'); return }
    toast.success(`✓ Checked in! Streak: ${data.streak} days 🔥`)
    setOpen(false)
    router.refresh()
  }

  if (open) {
    return (
      <div className="bg-white/10 rounded-xl p-4 min-w-[280px]">
        <p className="text-[12px] text-white/60 mb-3">How did today go?</p>
        <div className="flex gap-2 mb-3">
          {[1,2,3,4,5].map(n => (
            <button key={n} onClick={() => setMood(n)}
              className={`flex-1 py-2 rounded-lg text-[13px] font-medium transition-all ${mood === n ? 'bg-[#b8922a] text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}>
              {['😞','😐','🙂','😊','🔥'][n-1]}
            </button>
          ))}
        </div>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Quick note (optional)..."
          className="w-full bg-white/10 text-white placeholder-white/30 text-[13px] px-3 py-2 rounded-lg border border-white/10 outline-none resize-none mb-3"
          rows={2}
        />
        <div className="flex gap-2">
          <button onClick={() => setOpen(false)} className="flex-1 py-2 text-[12px] text-white/50 border border-white/10 rounded-lg hover:bg-white/5">Cancel</button>
          <button onClick={submit} disabled={loading} className="flex-1 py-2 text-[12px] bg-[#b8922a] text-white rounded-lg font-medium disabled:opacity-50">
            {loading ? 'Saving...' : 'Log check-in ✓'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <button onClick={() => setOpen(true)} className="px-5 py-2.5 bg-[#b8922a] text-white rounded-xl text-[13px] font-medium hover:bg-[#9a7820] transition-colors whitespace-nowrap">
      Log today ✓
    </button>
  )
}
