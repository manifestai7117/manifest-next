import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase.from('notifications').select('*, actor:profiles!notifications_actor_id_fkey(full_name, avatar_url)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20)
  const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('read', false)

  return NextResponse.json({ notifications: data || [], unread: count || 0 })
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
