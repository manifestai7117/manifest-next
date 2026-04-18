'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

const MOODS = ['😞', '😐', '🙂', '😊', '🔥']
const MOOD_LABELS = ['Tough day', 'Okay', 'Good', 'Great', 'On fire!']

interface Props {
  goalId: string
  todayTask?: { task: string; completed: boolean | null } | null
}

export default function CheckInButton({ goalId, todayTask }: Props) {
  const [open, setOpen] = useState(false)
  const [mood, setMood] = useState(3)
  const [didTask, setDidTask] = useState<boolean | null>(null)
  const [reflection, setReflection] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const submit = async () => {
    if (didTask === null) { toast.error('Tell us how the task went first'); return }
    setLoading(true)
    const note = reflection
      ? `Task ${didTask ? 'completed' : 'not completed'}. ${reflection}`
      : `Task ${didTask ? 'completed' : 'not completed'}.`

    const res = await fetch('/api/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goalId, note, mood }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { toast.error(data.error || 'Check-in failed'); return }
    toast.success(`\u2713 Checked in! Streak: ${data.streak} days \uD83D\uDD25`)
    setOpen(false)
    router.refresh()
  }

  // The task-specific follow-up question
  const taskQuestion = todayTask?.task
    ? didTask === null
      ? `Did you complete today's task?`
      : didTask
        ? `What went well with this task?`
        : `What got in the way?`
    : null

  const taskFollowUp = didTask !== null && todayTask?.task
    ? didTask
      ? `Great! What was the best part of completing it?`
      : `No worries. What blocked you today?`
    : null

  if (open) {
    return (
      <div className="bg-white/10 rounded-xl p-4 min-w-[300px] max-w-[400px]">
        <p className="text-[12px] text-white/60 mb-4 font-medium tracking-wide uppercase">How did today go?</p>

        {/* Today's task check */}
        {todayTask?.task && (
          <div className="mb-4">
            <p className="text-[13px] text-white/80 mb-1 font-medium">Today's task:</p>
            <p className="text-[12px] text-white/50 mb-3 leading-[1.5] line-clamp-2">{todayTask.task}</p>
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setDidTask(true)}
                className={`flex-1 py-2 rounded-lg text-[13px] font-medium transition-all ${didTask === true ? 'bg-green-500 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
              >
                ✓ Done it
              </button>
              <button
                onClick={() => setDidTask(false)}
                className={`flex-1 py-2 rounded-lg text-[13px] font-medium transition-all ${didTask === false ? 'bg-red-500/70 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
              >
                ✗ Not today
              </button>
            </div>
          </div>
        )}

        {/* Follow-up reflection based on task outcome */}
        {todayTask?.task && didTask !== null && (
          <div className="mb-4">
            <p className="text-[13px] text-white/70 mb-2">
              {didTask
                ? 'What was the highlight? (optional)'
                : 'What got in the way? (helps your coach)'}
            </p>
            <textarea
              value={reflection}
              onChange={e => setReflection(e.target.value)}
              placeholder={didTask ? 'e.g. Hit a new PR, felt strong...' : 'e.g. Low energy, got busy...'}
              className="w-full bg-white/10 text-white placeholder-white/30 text-[13px] px-3 py-2 rounded-lg border border-white/10 outline-none resize-none"
              rows={2}
              autoFocus
            />
          </div>
        )}

        {/* No task — just a reflection note */}
        {!todayTask?.task && (
          <div className="mb-4">
            <textarea
              value={reflection}
              onChange={e => setReflection(e.target.value)}
              placeholder="How did you move toward your goal today?"
              className="w-full bg-white/10 text-white placeholder-white/30 text-[13px] px-3 py-2 rounded-lg border border-white/10 outline-none resize-none mb-0"
              rows={2}
            />
          </div>
        )}

        {/* Mood selector */}
        <p className="text-[12px] text-white/50 mb-2">Your energy today</p>
        <div className="flex gap-1.5 mb-4">
          {MOODS.map((emoji, i) => (
            <button
              key={i}
              onClick={() => setMood(i + 1)}
              title={MOOD_LABELS[i]}
              className={`flex-1 py-2 rounded-lg text-[14px] transition-all ${mood === i + 1 ? 'bg-[#b8922a] text-white scale-105' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
            >
              {emoji}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button onClick={() => setOpen(false)} className="flex-1 py-2 text-[12px] text-white/50 border border-white/10 rounded-lg hover:bg-white/5">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={loading || (!!todayTask?.task && didTask === null)}
            className="flex-1 py-2 text-[12px] bg-[#b8922a] text-white rounded-lg font-medium disabled:opacity-40"
          >
            {loading ? 'Saving...' : 'Log check-in ✓'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={() => setOpen(true)}
      className="px-5 py-2.5 bg-[#b8922a] text-white rounded-xl text-[13px] font-medium hover:bg-[#9a7820] transition-colors whitespace-nowrap"
    >
      Log today ✓
    </button>
  )
}