'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import CheckInButton from './CheckInButton'

interface Props {
  goals: any[]
  profile: any
  allTodayCheckins: Record<string, boolean>
  allCheckins: Record<string, any[]>
  allCoachMsgs: Record<string, string>
  existingRating: boolean
  userId: string
  greeting: string
  firstName: string
  dayOfYear: number
}

export default function DashboardClient({
  goals, profile, allTodayCheckins, allCheckins, allCoachMsgs,
  existingRating, userId, greeting, firstName, dayOfYear
}: Props) {
  const supabase = createClient()
  const [selectedGoalId, setSelectedGoalId] = useState(goals[0]?.id || '')

  useEffect(() => {
    const saved = localStorage.getItem('selectedGoalId')
    if (saved && goals.find((g: any) => g.id === saved)) {
      setSelectedGoalId(saved)
    }
  }, [])
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [ratingDismissed, setRatingDismissed] = useState(existingRating)
  const [ratingSubmitted, setRatingSubmitted] = useState(false)

  const goal = goals.find(g => g.id === selectedGoalId) || goals[0]
  if (!goal) return null

  const checkedInToday = allTodayCheckins[goal.id] || false
  const recentCheckins = allCheckins[goal.id] || []
  const coachMsg = allCoachMsgs[goal.id] || goal.coach_opening || ''

  // Rotate affirmation daily — use day of year to pick variation
  const affirmations = [
    goal.affirmation,
    goal.affirmation ? `Today I take one step closer to: ${goal.title}` : null,
    goal.affirmation ? `I am committed. I am capable. I will achieve: ${goal.title}` : null,
  ].filter(Boolean)
  const todayAffirmation = affirmations[dayOfYear % affirmations.length]

  const avgMood = recentCheckins.length
    ? Math.round(recentCheckins.reduce((a: number, c: any) => a + (c.mood || 3), 0) / recentCheckins.length)
    : 3

  const switchGoal = (id: string) => {
    setSelectedGoalId(id)
    if (typeof window !== 'undefined') localStorage.setItem('selectedGoalId', id)
  }

  const submitRating = async () => {
    if (!rating) return
    await supabase.from('app_ratings').upsert({ user_id: userId, rating, created_at: new Date().toISOString() })
    setRatingSubmitted(true)
    toast.success('Thanks for the feedback!')
    setTimeout(() => setRatingDismissed(true), 2000)
  }

  return (
    <div className="fade-up max-w-[900px]">
      <div className="flex items-start justify-between mb-1 flex-wrap gap-2">
        <h1 className="font-serif text-[32px]">{greeting}, {firstName}.</h1>
        <Link href="/onboarding" className="px-4 py-2 border border-[#e8e8e8] bg-white rounded-xl text-[13px] font-medium text-[#666] hover:bg-[#f8f7f5] transition-colors flex-shrink-0">
          + Add goal
        </Link>
      </div>
      <p className="text-[#666] mb-5 text-[14px]">
        {checkedInToday
          ? `Checked in today ✓ · ${goal.streak} day streak 🔥`
          : "You haven't checked in yet today. Keep the streak alive."}
      </p>

      {/* Goal selector tabs — only if multiple goals */}
      {goals.length > 1 && (
        <div className="flex gap-2 mb-5 flex-wrap">
          {goals.map(g => (
            <button key={g.id} onClick={() => switchGoal(g.id)}
              className={`px-4 py-2 rounded-full text-[13px] font-medium border transition-all ${g.id === selectedGoalId ? 'bg-[#111] text-white border-[#111]' : 'bg-white text-[#666] border-[#e8e8e8] hover:border-[#d0d0d0]'}`}>
              {(g.display_title || g.title).slice(0, 32)}
            </button>
          ))}
        </div>
      )}

      {/* Check-in banner */}
      {!checkedInToday && (
        <div className="bg-[#111] rounded-2xl p-6 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="font-serif text-[20px] text-white mb-1">Daily check-in</p>
            <p className="text-[13px] text-white/50">Did you work toward "{goal.title}" today?</p>
          </div>
          <CheckInButton goalId={goal.id} />
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { val: `${goal.streak}`, label: 'Day streak 🔥' },
          { val: `${goal.progress}%`, label: 'Goal progress', progress: goal.progress },
          { val: `${recentCheckins.length}`, label: 'This week' },
          { val: goal.timeline, label: 'Timeline' },
        ].map(({ val, label, progress }) => (
          <div key={label} className="bg-white border border-[#e8e8e8] rounded-2xl p-5">
            <p className="font-serif text-[28px] leading-none mb-1">{val}</p>
            <p className="text-[11px] font-medium text-[#999] uppercase tracking-[.06em]">{label}</p>
            {progress !== undefined && (
              <div className="mt-2 h-1.5 bg-[#f0ede8] rounded-full overflow-hidden">
                <div className="h-full bg-[#b8922a] rounded-full transition-all duration-700" style={{ width: `${progress}%` }}/>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Goal + Coach */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-6">
          <p className="text-[10px] font-medium tracking-[.12em] uppercase text-[#b8922a] mb-3">Current goal</p>
          <p className="font-serif text-[18px] leading-[1.4] mb-4">{goal.title}</p>
          <div className="flex gap-2 flex-wrap">
            <span className="text-[11px] font-medium text-[#b8922a] bg-[#faf3e0] px-2.5 py-1 rounded-full">{goal.timeline}</span>
            <span className="text-[11px] font-medium text-[#666] bg-[#f2f0ec] px-2.5 py-1 rounded-full">{goal.category}</span>
            {avgMood >= 4 && <span className="text-[11px] font-medium text-green-700 bg-green-50 px-2.5 py-1 rounded-full">High energy 🔥</span>}
            {avgMood <= 2 && <span className="text-[11px] font-medium text-[#999] bg-[#f2f0ec] px-2.5 py-1 rounded-full">Tough week 💪</span>}
          </div>
        </div>
        <Link href="/dashboard/coach" className="bg-white border border-[#e8e8e8] rounded-2xl p-6 block hover:border-[#d0d0d0] transition-colors group">
          <p className="text-[10px] font-medium tracking-[.12em] uppercase text-[#b8922a] mb-3">Coach message</p>
          <p className="font-serif italic text-[15px] text-[#666] leading-[1.7] line-clamp-3">"{coachMsg}"</p>
          <p className="text-[12px] text-[#b8922a] mt-3 group-hover:underline">Continue with coach →</p>
        </Link>
      </div>

      {/* Today's affirmation */}
      <div className="bg-[#faf3e0] border border-[#b8922a]/20 rounded-2xl p-5 mb-4">
        <p className="text-[10px] font-medium tracking-[.12em] uppercase text-[#b8922a] mb-2">Today's affirmation</p>
        <p className="font-serif italic text-[16px] text-[#111] leading-[1.65]">"{todayAffirmation}"</p>
      </div>

      {/* Today's action */}
      {goal.today_action && (
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 mb-4">
          <p className="text-[10px] font-medium tracking-[.12em] uppercase text-[#b8922a] mb-2">Today's action</p>
          <p className="text-[14px] text-[#111] leading-[1.65]">{goal.today_action}</p>
        </div>
      )}

      {/* Rating */}
      {!ratingDismissed && goal.streak >= 3 && (
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 flex items-center justify-between gap-4 flex-wrap">
          {ratingSubmitted ? (
            <p className="text-[14px] text-[#666] w-full text-center">Thanks for rating Manifest! ⭐</p>
          ) : (
            <>
              <div>
                <p className="font-medium text-[14px] mb-0.5">Enjoying Manifest?</p>
                <p className="text-[12px] text-[#999]">Rate your experience</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(s => (
                    <button key={s} onMouseEnter={() => setHoverRating(s)} onMouseLeave={() => setHoverRating(0)} onClick={() => setRating(s)} className="text-[24px] transition-transform hover:scale-125">
                      <span style={{ color: s <= (hoverRating || rating) ? '#b8922a' : '#e8e8e8' }}>★</span>
                    </button>
                  ))}
                </div>
                {rating > 0 && (
                  <button onClick={submitRating} className="px-4 py-2 bg-[#111] text-white rounded-xl text-[12px] font-medium hover:bg-[#2a2a2a] transition-colors">Submit</button>
                )}
                <button onClick={() => setRatingDismissed(true)} className="text-[#ccc] hover:text-[#999] text-[20px] leading-none">×</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}