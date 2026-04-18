import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const serviceSupabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const uid = user.id

  try {
    // Delete all user data in parallel — keep app_ratings and feedback (anonymous analytics)
    await Promise.allSettled([
      serviceSupabase.from('goals').delete().eq('user_id', uid),
      serviceSupabase.from('checkins').delete().eq('user_id', uid),
      serviceSupabase.from('coach_messages').delete().eq('user_id', uid),
      serviceSupabase.from('feed_posts').delete().eq('user_id', uid),
      serviceSupabase.from('daily_tasks').delete().eq('user_id', uid),
      serviceSupabase.from('rewards').delete().eq('user_id', uid),
      serviceSupabase.from('notifications').delete().eq('user_id', uid),
      serviceSupabase.from('notifications').delete().eq('actor_id', uid),
      serviceSupabase.from('circle_members').delete().eq('user_id', uid),
      serviceSupabase.from('circle_messages').delete().eq('user_id', uid),
      serviceSupabase.from('direct_messages').delete().or(`sender_id.eq.${uid},recipient_id.eq.${uid}`),
      serviceSupabase.from('friendships').delete().or(`requester.eq.${uid},addressee.eq.${uid}`),
      serviceSupabase.from('blocked_users').delete().or(`blocker_id.eq.${uid},blocked_id.eq.${uid}`),
      serviceSupabase.from('content_reports').delete().eq('reporter_id', uid),
      // Keep: app_ratings, feedback (anonymous aggregate data)
    ])

    // Delete the profile row
    await serviceSupabase.from('profiles').delete().eq('id', uid)

    // Delete the auth user permanently — this is the critical step
    // supabase.auth.signOut() alone does NOT delete the account
    const { error: deleteError } = await serviceSupabase.auth.admin.deleteUser(uid)
    if (deleteError) {
      console.error('Auth delete error:', deleteError)
      return NextResponse.json({ error: 'Failed to delete auth user' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('Delete account error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}