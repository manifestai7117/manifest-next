import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/_{1,2}(.*?)_{1,2}/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/`(.*?)`/g, '$1')
    .replace(/^\s*[-*+]\s/gm, '')
    .replace(/^\s*\d+\.\s/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const goalId = searchParams.get('goalId')
  if (!goalId) return NextResponse.json({ error: 'Missing goalId' }, { status: 400 })

  // Return cached insight from last 6 hours
  const { data: cached } = await supabase
    .from('goal_insights')
    .select('*')
    .eq('goal_id', goalId)
    .eq('user_id', user.id)
    .gte('generated_at', new Date(Date.now() - 6 * 3600000).toISOString())
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (cached) return NextResponse.json({ insight: cached.insight, fresh: false })

  // Gather context
  const [{ data: goal }, { data: checkins }, { data: coachMsgs }, { data: dailyTasks }] = await Promise.all([
    supabase.from('goals').select('*').eq('id', goalId).eq('user_id', user.id).single(),
    supabase.from('checkins').select('mood, note, created_at').eq('goal_id', goalId).order('created_at', { ascending: false }).limit(14),
    supabase.from('coach_messages').select('role, content').eq('goal_id', goalId).order('created_at', { ascending: false }).limit(10),
    supabase.from('daily_tasks').select('task, completed, task_date').eq('goal_id', goalId).order('task_date', { ascending: false }).limit(7),
  ])

  if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })

  const timelineMap: Record<string, number> = {
    '1 week': 7, '2 weeks': 14, '1 month': 30, '6 weeks': 42,
    '2 months': 60, '3 months': 90, '6 months': 180, '1 year': 365, '2 years': 730,
  }
  const totalDays = timelineMap[goal.timeline] || 90
  const daysPassed = Math.floor((Date.now() - new Date(goal.created_at).getTime()) / 86400000)
  const expectedProgress = Math.min(100, Math.round((daysPassed / totalDays) * 100))

  // Use the actual stored progress, not a recalculated one
  const actualProgress = goal.progress || 0
  const progressDiff = actualProgress - expectedProgress

  const avgMood = checkins?.length
    ? (checkins.reduce((a: number, c: any) => a + c.mood, 0) / checkins.length).toFixed(1)
    : '3.0'

  const checkinsThisWeek = (checkins || []).filter(
    (c: any) => new Date(c.created_at) > new Date(Date.now() - 7 * 86400000)
  ).length

  const recentNotes = (checkins || [])
    .filter((c: any) => c.note?.trim())
    .slice(0, 3)
    .map((c: any) => `"${c.note.trim()}"`)
    .join(', ')

  const taskCompletionRate = dailyTasks?.length
    ? `${(dailyTasks || []).filter((t: any) => t.completed === true).length}/${dailyTasks.length} recent tasks completed`
    : ''

  const recentCoach = (coachMsgs || [])
    .slice(0, 6)
    .reverse()
    .map((m: any) => `${m.role === 'user' ? 'User' : 'Coach'}: ${m.content.slice(0, 80)}`)
    .join('\n')

  const prompt = `You are writing a brief, honest coaching insight for someone's goal dashboard.

GOAL: "${goal.title}"
CATEGORY: ${goal.category}
DAY: ${daysPassed} of ${totalDays} (${goal.timeline})
ACTUAL PROGRESS: ${actualProgress}% (expected ${expectedProgress}% at this pace — ${progressDiff >= 0 ? `${progressDiff}% ahead` : `${Math.abs(progressDiff)}% behind`})
STREAK: ${goal.streak} days
CHECK-INS THIS WEEK: ${checkinsThisWeek}/7
AVG MOOD: ${avgMood}/5
${taskCompletionRate ? `TASK COMPLETION: ${taskCompletionRate}` : ''}
${recentNotes ? `RECENT NOTES: ${recentNotes}` : ''}
${recentCoach ? `RECENT COACH EXCHANGE:\n${recentCoach}` : ''}
CURRENT STORY: ${goal.current_story || 'Not shared'}

Write 2-3 sentences of specific, honest insight. Reference the actual goal title and real numbers. End with one concrete next step.

STRICT FORMAT RULES:
- Plain prose only — absolutely no markdown, no bold, no asterisks, no headers, no bullet points
- No formatting characters whatsoever
- Keep it under 80 words total
- Sound like a direct, caring coach — not a report`

  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 180,
    messages: [{ role: 'user', content: prompt }],
  })

  const rawInsight = res.content[0].type === 'text' ? res.content[0].text.trim() : ''
  const insight = stripMarkdown(rawInsight)

  if (insight) {
    await supabase.from('goal_insights').insert({
      goal_id: goalId,
      user_id: user.id,
      insight,
    }).catch(() => {})
  }

  return NextResponse.json({ insight, fresh: true })
}