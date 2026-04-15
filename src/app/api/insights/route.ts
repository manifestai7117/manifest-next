import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const goalId = searchParams.get('goalId')
  if (!goalId) return NextResponse.json({ error: 'Missing goalId' }, { status: 400 })

  // Check for cached insight from last 24h
  const { data: cached } = await supabase.from('goal_insights').select('*').eq('goal_id', goalId).eq('user_id', user.id).gte('generated_at', new Date(Date.now() - 23 * 3600000).toISOString()).order('generated_at', { ascending: false }).limit(1).maybeSingle()
  if (cached) return NextResponse.json({ insight: cached.insight, fresh: false })

  // Generate fresh insight
  const [{ data: goal }, { data: checkins }, { data: rewards }, { data: coachMsgs }] = await Promise.all([
    supabase.from('goals').select('*').eq('id', goalId).eq('user_id', user.id).single(),
    supabase.from('checkins').select('mood, note, created_at').eq('goal_id', goalId).order('created_at', { ascending: false }).limit(14),
    supabase.from('rewards').select('type, earned_at').eq('user_id', user.id),
    supabase.from('coach_messages').select('role, content').eq('goal_id', goalId).order('created_at', { ascending: false }).limit(20),
  ])

  if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })

  const avgMood = checkins?.length ? (checkins.reduce((a: number, c: any) => a + c.mood, 0) / checkins.length).toFixed(1) : '3'
  const checkinsThisWeek = checkins?.filter((c: any) => new Date(c.created_at) > new Date(Date.now() - 7 * 86400000)).length || 0
  const timelineMap: Record<string, number> = { '1 week': 7, '2 weeks': 14, '1 month': 30, '6 weeks': 42, '2 months': 60, '3 months': 90, '6 months': 180, '1 year': 365, '2 years': 730 }
  const totalDays = timelineMap[goal.timeline] || 90
  const daysPassed = Math.floor((Date.now() - new Date(goal.created_at).getTime()) / 86400000)
  const expectedProgress = Math.round((daysPassed / totalDays) * 100)
  const progressDiff = (goal.progress || 0) - expectedProgress
  const notes = checkins?.filter((c: any) => c.note).slice(0, 3).map((c: any) => c.note)

  // Build coach conversation context
  const recentCoach = (coachMsgs || []).slice(0, 10).reverse().map((m: any) => `${m.role === 'user' ? 'User' : 'Coach'}: ${m.content.slice(0, 100)}`).join('\n')
  const coachContext = recentCoach ? `\nRECENT COACH CONVERSATIONS:\n${recentCoach}` : ''

  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001', max_tokens: 150,
    messages: [{ role: 'user', content: `Goal: "${goal.title}".${coachContext}\n\nProgress: ${goal.progress}% (expected ${expectedProgress}%, ${progressDiff >= 0 ? `${progressDiff}% ahead` : `${Math.abs(progressDiff)}% behind`} pace). Streak: ${goal.streak} days. Check-ins this week: ${checkinsThisWeek}/7. Avg mood: ${avgMood}/5. ${notes?.length ? `Recent notes: "${notes.join('", "')}"` : ''} Write 2-3 sentences of specific, honest insight about where they stand and one concrete next step. Reference their actual goal.` }]
  })
  const insight = res.content[0].type === 'text' ? res.content[0].text.trim() : ''

  if (insight) await supabase.from('goal_insights').insert({ goal_id: goalId, user_id: user.id, insight })
  return NextResponse.json({ insight, fresh: true })
}