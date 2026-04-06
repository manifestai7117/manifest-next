import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { goalId, note, mood } = await request.json()
    if (!goalId || !mood) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    // Check if already checked in today
    const today = new Date().toISOString().split('T')[0]
    const { data: existing } = await supabase
      .from('checkins')
      .select('id')
      .eq('goal_id', goalId)
      .eq('user_id', user.id)
      .gte('created_at', `${today}T00:00:00`)
      .single()

    if (existing) return NextResponse.json({ error: 'Already checked in today' }, { status: 400 })

    // Insert check-in
    await supabase.from('checkins').insert({ goal_id: goalId, user_id: user.id, note, mood })

    // Fetch goal for streak calculation
    const { data: goal } = await supabase.from('goals').select('streak, longest_streak, last_checkin, progress, timeline').eq('id', goalId).single()
    if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })

    // Calculate streak
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]
    const lastCheckin = goal.last_checkin

    let newStreak = 1
    if (lastCheckin === yesterdayStr) newStreak = (goal.streak || 0) + 1
    else if (lastCheckin === today) newStreak = goal.streak || 1

    // Calculate progress based on timeline and checkin count
    const timelineDays: Record<string, number> = {
      '1 month': 30, '2 months': 60, '3 months': 90,
      '6 months': 180, '1 year': 365, '2+ years': 730
    }
    const { count } = await supabase.from('checkins').select('*', { count: 'exact', head: true }).eq('goal_id', goalId)
    const totalDays = timelineDays[goal.timeline] || 90
    const newProgress = Math.min(Math.round(((count || 1) / totalDays) * 100), 100)

    // Update goal
    await supabase.from('goals').update({
      streak: newStreak,
      longest_streak: Math.max(newStreak, goal.longest_streak || 0),
      last_checkin: today,
      progress: newProgress,
    }).eq('id', goalId)

    return NextResponse.json({ success: true, streak: newStreak, progress: newProgress })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
