import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function awardIfNew(supabase: any, userId: string, type: string, title: string, description: string, emoji: string) {
  const { data: existing } = await supabase.from('rewards').select('id').eq('user_id', userId).eq('type', type).maybeSingle()
  if (!existing) {
    await supabase.from('rewards').insert({ user_id: userId, type, title, description, emoji, earned_at: new Date().toISOString() })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { goalId, note, mood } = await request.json()
    if (!goalId || !mood) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const today = new Date().toISOString().split('T')[0]
    const { data: existing } = await supabase.from('checkins').select('id').eq('goal_id', goalId).eq('user_id', user.id).gte('created_at', `${today}T00:00:00`).maybeSingle()
    if (existing) return NextResponse.json({ error: 'Already checked in today' }, { status: 400 })

    await supabase.from('checkins').insert({ goal_id: goalId, user_id: user.id, note, mood })

    const { data: goal } = await supabase.from('goals').select('streak, longest_streak, last_checkin, progress, timeline').eq('id', goalId).single()
    if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })

    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    let newStreak = 1
    if (goal.last_checkin === yesterdayStr) newStreak = (goal.streak || 0) + 1
    else if (goal.last_checkin === today) newStreak = goal.streak || 1

    const { count } = await supabase.from('checkins').select('*', { count: 'exact', head: true }).eq('goal_id', goalId)
    const timelineDays: Record<string, number> = {
      '1 week': 7, '2 weeks': 14, '1 month': 30, '6 weeks': 42,
      '2 months': 60, '3 months': 90, '6 months': 180, '1 year': 365, '2 years': 730
    }
    const totalDays = timelineDays[goal.timeline] || 90
    const newProgress = Math.min(Math.round(((count || 1) / totalDays) * 100), 100)

    await supabase.from('goals').update({
      streak: newStreak,
      longest_streak: Math.max(newStreak, goal.longest_streak || 0),
      last_checkin: today,
      progress: newProgress,
    }).eq('id', goalId)

    // Award badges automatically
    const checkinCount = count || 1

    // First check-in
    if (checkinCount === 1) {
      await awardIfNew(supabase, user.id, 'first_checkin', 'First Step', 'Completed your first check-in', '🌱')
    }

    // Streak badges
    if (newStreak >= 7) await awardIfNew(supabase, user.id, 'streak_7', 'Week Warrior', '7-day check-in streak', '🔥')
    if (newStreak >= 14) await awardIfNew(supabase, user.id, 'streak_14', 'Fortnight Fire', '14-day check-in streak', '⚡')
    if (newStreak >= 30) await awardIfNew(supabase, user.id, 'streak_30', 'Month Legend', '30-day check-in streak', '🏆')

    return NextResponse.json({ success: true, streak: newStreak, progress: newProgress })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}