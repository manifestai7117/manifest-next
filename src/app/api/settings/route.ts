import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data } = await supabase.from('user_preferences').select('*').eq('user_id', user.id).maybeSingle()
  return NextResponse.json(data || {})
}

export async function PATCH(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  const allowed = ['dark_mode', 'email_streak_reminders', 'email_weekly_digest', 'email_friend_activity', 'profile_public']
  const updates: Record<string, any> = { updated_at: new Date().toISOString() }
  for (const key of allowed) { if (key in body) updates[key] = body[key] }
  await supabase.from('user_preferences').upsert({ user_id: user.id, ...updates }, { onConflict: 'user_id' })
  return NextResponse.json({ success: true })
}
