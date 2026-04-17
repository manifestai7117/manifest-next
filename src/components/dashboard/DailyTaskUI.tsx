'use client'
// ================================================================
// DailyTaskUI — Drop-in component for the goal page / dashboard
// Handles: first-day welcome, yesterday yes/no log, today's task
// ================================================================
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

interface Props {
  goalId: string
  goalTitle: string
}

export default function DailyTaskUI({ goalId, goalTitle }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [state, setState] = useState<{
    todayTask: any | null
    yesterdayTask: any | null
    checkedInToday: boolean
    needsYesterdayLog: boolean
    isFirstDay: boolean
  } | null>(null)

  // Yesterday log state
  const [yesterdayDone, setYesterdayDone] = useState<boolean | null>(null)
  const [yesterdayNote, setYesterdayNote] = useState('')
  const [loggingYesterday, setLoggingYesterday] = useState(false)

  // Today's task state
  const [generating, setGenerating] = useState(false)
  const [todayCompleted, setTodayCompleted] = useState<boolean | null>(null)
  const [completionNote, setCompletionNote] = useState('')
  const [markingDone, setMarkingDone] = useState(false)

  const loadState = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/daily-task?goalId=${goalId}`)
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setState(data)
      if (data.todayTask) {
        setTodayCompleted(data.todayTask.completed)
      }
    } catch {
      toast.error('Could not load daily task')
    }
    setLoading(false)
  }

  useEffect(() => { loadState() }, [goalId])

  const logYesterday = async () => {
    if (yesterdayDone === null || loggingYesterday) return
    setLoggingYesterday(true)
    try {
      const res = await fetch('/api/daily-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goalId,
          action: 'log_yesterday',
          yesterdayTaskId: state?.yesterdayTask?.id,
          yesterdayDone,
          completionNote: yesterdayNote.trim() || null,
        }),
      })
      if (res.ok) {
        toast.success(yesterdayDone ? '✓ Logged — great work!' : 'Noted. Today is a fresh start.')
        // Refresh to show today's task prompt
        loadState()
      }
    } catch {
      toast.error('Could not log')
    }
    setLoggingYesterday(false)
  }

  const generateTodayTask = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/daily-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalId }),
      })
      const data = await res.json()
      if (res.ok && data.task) {
        setState(prev => prev ? { ...prev, todayTask: data.task } : prev)
        setTodayCompleted(null)
      } else {
        toast.error(data.error || 'Could not generate task')
      }
    } catch {
      toast.error('Failed to generate task')
    }
    setGenerating(false)
  }

  const markTodayDone = async (done: boolean) => {
    if (!state?.todayTask || markingDone) return
    setMarkingDone(true)
    try {
      const res = await fetch('/api/daily-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goalId,
          action: 'log_yesterday', // reuses same endpoint
          yesterdayTaskId: state.todayTask.id,
          yesterdayDone: done,
          completionNote: completionNote.trim() || null,
        }),
      })
      if (res.ok) {
        setTodayCompleted(done)
        setState(prev => prev ? { ...prev, todayTask: { ...prev.todayTask, completed: done } } : prev)
        toast.success(done ? '✓ Marked complete!' : 'Noted for tomorrow')
      }
    } catch {
      toast.error('Could not save')
    }
    setMarkingDone(false)
  }

  if (loading) {
    return (
      <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 animate-pulse">
        <div className="h-4 bg-[#f0ede8] rounded w-1/3 mb-3"/>
        <div className="h-3 bg-[#f0ede8] rounded w-full mb-2"/>
        <div className="h-3 bg-[#f0ede8] rounded w-4/5"/>
      </div>
    )
  }

  if (!state) return null

  // Phase 1: Ask about yesterday (if needed)
  if (state.needsYesterdayLog && state.yesterdayTask) {
    const taskDate = new Date(state.yesterdayTask.task_date + 'T12:00:00')
    const dayLabel = taskDate.toLocaleDateString('en-US', { weekday: 'long' })

    return (
      <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5">
        <div className="flex items-start gap-3 mb-4">
          <span className="text-[22px]">📋</span>
          <div>
            <p className="font-medium text-[14px]">Quick check-in from {dayLabel}</p>
            <p className="text-[12px] text-[#999] mt-0.5">Your task was:</p>
          </div>
        </div>

        <div className="bg-[#f8f7f5] rounded-xl p-4 mb-4">
          <p className="text-[14px] text-[#333] leading-[1.6]">{state.yesterdayTask.task}</p>
        </div>

        <p className="text-[13px] font-medium text-[#111] mb-3">Did you complete it?</p>

        <div className="flex gap-3 mb-4">
          <button
            onClick={() => setYesterdayDone(true)}
            className={`flex-1 py-3 rounded-xl text-[14px] font-medium border-2 transition-all ${yesterdayDone === true ? 'bg-green-600 text-white border-green-600' : 'border-[#e8e8e8] text-[#333] hover:border-green-300'}`}
          >
            ✓ Yes, I did it
          </button>
          <button
            onClick={() => setYesterdayDone(false)}
            className={`flex-1 py-3 rounded-xl text-[14px] font-medium border-2 transition-all ${yesterdayDone === false ? 'bg-[#111] text-white border-[#111]' : 'border-[#e8e8e8] text-[#333] hover:border-[#aaa]'}`}
          >
            ✗ Not this time
          </button>
        </div>

        {yesterdayDone !== null && (
          <div className="mb-4">
            <label className="block text-[12px] font-medium text-[#666] mb-1.5">
              {yesterdayDone ? 'How did it go? (optional)' : 'What got in the way? (optional)'}
            </label>
            <input
              type="text"
              value={yesterdayNote}
              onChange={e => setYesterdayNote(e.target.value)}
              placeholder={yesterdayDone ? 'e.g. Felt great, got it done by 9am' : 'e.g. Got caught up with work'}
              className="w-full px-3.5 py-2.5 border border-[#e8e8e8] rounded-xl text-[13px] outline-none focus:border-[#111] transition-colors"
            />
          </div>
        )}

        <button
          onClick={logYesterday}
          disabled={yesterdayDone === null || loggingYesterday}
          className="w-full py-3 bg-[#b8922a] text-white rounded-xl text-[13px] font-medium hover:bg-[#9a7820] transition-colors disabled:opacity-40"
        >
          {loggingYesterday ? 'Saving...' : 'Continue →'}
        </button>
      </div>
    )
  }

  // Phase 2: Show today's task
  if (state.todayTask) {
    const isComplete = todayCompleted === true
    const isIncomplete = todayCompleted === false

    return (
      <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-[18px]">📌</span>
            <p className="font-medium text-[14px]">Today's task</p>
          </div>
          {isComplete && (
            <span className="text-[11px] font-medium text-green-600 bg-green-50 px-2.5 py-1 rounded-full">✓ Complete</span>
          )}
          {isIncomplete && (
            <span className="text-[11px] font-medium text-[#999] bg-[#f8f7f5] px-2.5 py-1 rounded-full">Not done</span>
          )}
        </div>

        <div className={`rounded-xl p-4 mb-4 transition-all ${isComplete ? 'bg-green-50 border border-green-100' : 'bg-[#f8f7f5]'}`}>
          <p className={`text-[14px] leading-[1.65] ${isComplete ? 'text-green-900 line-through opacity-60' : 'text-[#333]'}`}>
            {state.todayTask.task}
          </p>
        </div>

        {!isComplete && !isIncomplete && (
          <>
            <div className="mb-3">
              <label className="block text-[12px] font-medium text-[#666] mb-1.5">
                Add a note <span className="text-[#bbb] font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={completionNote}
                onChange={e => setCompletionNote(e.target.value)}
                placeholder="e.g. Done! Hit a new PR"
                className="w-full px-3.5 py-2.5 border border-[#e8e8e8] rounded-xl text-[13px] outline-none focus:border-[#111] transition-colors"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => markTodayDone(true)}
                disabled={markingDone}
                className="flex-1 py-3 bg-[#111] text-white rounded-xl text-[13px] font-medium hover:bg-[#2a2a2a] transition-colors disabled:opacity-40"
              >
                {markingDone ? '...' : '✓ Mark complete'}
              </button>
              <button
                onClick={() => markTodayDone(false)}
                disabled={markingDone}
                className="px-4 py-3 border border-[#e8e8e8] rounded-xl text-[13px] text-[#999] hover:border-[#aaa] transition-colors disabled:opacity-40"
              >
                Skip
              </button>
            </div>
          </>
        )}

        {(isComplete || isIncomplete) && (
          <p className="text-[12px] text-[#999] text-center mt-2">
            {isComplete ? 'Great work! Your coach knows. 🎯' : "Tomorrow's task will account for this."}
          </p>
        )}
      </div>
    )
  }

  // Phase 3: Generate today's task
  return (
    <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5">
      {state.isFirstDay ? (
        <>
          <div className="flex items-start gap-3 mb-4">
            <span className="text-[24px]">🎯</span>
            <div>
              <p className="font-medium text-[15px]">Day 1 — Let's begin</p>
              <p className="text-[13px] text-[#666] mt-0.5 leading-[1.5]">
                Get your first AI-generated task for "{goalTitle}".
              </p>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[18px]">⚡</span>
            <p className="font-medium text-[14px]">Today's task ready to generate</p>
          </div>
          <p className="text-[13px] text-[#666] mb-4">Get a personalised task based on your recent check-ins and progress.</p>
        </>
      )}

      <button
        onClick={generateTodayTask}
        disabled={generating}
        className="w-full py-3 bg-[#b8922a] text-white rounded-xl text-[13px] font-medium hover:bg-[#9a7820] transition-colors disabled:opacity-50"
      >
        {generating
          ? <span className="flex items-center justify-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full spin-anim"/>
              Generating...
            </span>
          : state.isFirstDay ? '✦ Get my Day 1 task' : '✦ Get today\'s task'
        }
      </button>
    </div>
  )
}