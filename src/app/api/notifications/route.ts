import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const serviceSupabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - fetch notifications for current user
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ notifications: [], unread: 0 })

  try {
    const { data } = await serviceSupabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    const actorIds = [...new Set((data || []).map((n: any) => n.actor_id).filter(Boolean))]
    let actorMap: Record<string, any> = {}
    if (actorIds.length > 0) {
      const { data: actors } = await serviceSupabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', actorIds)
      actorMap = Object.fromEntries((actors || []).map((a: any) => [a.id, a]))
    }

    const notifications = (data || []).map((n: any) => ({
      ...n,
      actor: n.actor_id ? actorMap[n.actor_id] || null : null,
    }))
    const unread = notifications.filter((n: any) => !n.read).length

    return NextResponse.json({ notifications, unread })
  } catch (e: any) {
    return NextResponse.json({ notifications: [], unread: 0 })
  }
}

// POST - create a notification (cross-user, needs service role)
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { user_id, type, title, body, link } = await request.json()
    if (!user_id || !type || !title) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }
    // Use service role to bypass RLS — actor is verified as authenticated above
    await serviceSupabase.from('notifications').insert({
      user_id,
      actor_id: user.id,
      type,
      title,
      body: body || null,
      link: link || null,
      read: false,
    })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PATCH - mark notifications as read
export async function PATCH(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await request.json()
  if (id === 'all') {
    await serviceSupabase.from('notifications').update({ read: true }).eq('user_id', user.id)
  } else {
    await serviceSupabase.from('notifications').update({ read: true }).eq('id', id).eq('user_id', user.id)
  }
  return NextResponse.json({ success: true })
}