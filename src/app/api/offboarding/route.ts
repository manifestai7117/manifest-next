import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { action, reason, pauseDays } = await request.json()

  if (action === 'pause') {
    const pauseUntil = new Date(Date.now() + (pauseDays || 7) * 86400000).toISOString()
    await supabase.from('user_preferences').upsert({ user_id: user.id, paused_until: pauseUntil, pause_reason: reason, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    return NextResponse.json({ success: true, pausedUntil: pauseUntil })
  }
  if (action === 'cancel_pause') {
    await supabase.from('user_preferences').upsert({ user_id: user.id, paused_until: null, pause_reason: null, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    return NextResponse.json({ success: true })
  }
  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
