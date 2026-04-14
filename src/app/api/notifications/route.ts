import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ notifications: [], unread: 0 })

  try {
    const { data, count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    const unread = (data || []).filter((n: any) => !n.read).length

    // Fetch actor profiles separately to avoid FK join issues
    const actorIds = (data || []).map((n: any) => n.actor_id).filter((id: any) => id != null).filter((id: string, i: number, a: string[]) => a.indexOf(id) === i)
    let actorMap: Record<string, any> = {}
    if (actorIds.length > 0) {
      const { data: actors } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', actorIds)
      actorMap = Object.fromEntries((actors || []).map((a: any) => [a.id, a]))
    }

    const notifications = (data || []).map((n: any) => ({
      ...n,
      actor: n.actor_id ? actorMap[n.actor_id] || null : null,
    }))

    return NextResponse.json({ notifications, unread })
  } catch {
    return NextResponse.json({ notifications: [], unread: 0 })
  }
}

export async function PATCH(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await request.json()
  if (id === 'all') {
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id)
  } else {
    await supabase.from('notifications').update({ read: true }).eq('id', id).eq('user_id', user.id)
  }
  return NextResponse.json({ success: true })
}