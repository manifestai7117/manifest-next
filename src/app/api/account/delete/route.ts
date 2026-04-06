import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function DELETE(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Use service role to bypass RLS for full deletion
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Delete avatar from storage if exists
    try {
      const { data: files } = await serviceClient.storage.from('avatars').list('', {
        search: user.id
      })
      if (files?.length) {
        await serviceClient.storage.from('avatars').remove(files.map(f => f.name))
      }
    } catch { /* ignore storage errors */ }

    // Delete all data via the function
    const { error: fnError } = await serviceClient.rpc('delete_user_account', {
      p_user_id: user.id
    })

    if (fnError) {
      // Fallback: delete manually if function fails
      await serviceClient.from('coach_messages').delete().eq('user_id', user.id)
      await serviceClient.from('checkins').delete().eq('user_id', user.id)
      await serviceClient.from('circle_messages').delete().eq('user_id', user.id)
      await serviceClient.from('circle_members').delete().eq('user_id', user.id)
      await serviceClient.from('direct_messages').delete().or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      await serviceClient.from('friendships').delete().or(`requester.eq.${user.id},addressee.eq.${user.id}`)
      await serviceClient.from('rewards').delete().eq('user_id', user.id)
      await serviceClient.from('chat_usage').delete().eq('user_id', user.id)
      await serviceClient.from('success_stories').delete().eq('user_id', user.id)
      await serviceClient.from('goals').delete().eq('user_id', user.id)
      await serviceClient.from('profiles').delete().eq('id', user.id)
      await serviceClient.auth.admin.deleteUser(user.id)
    }

    // Sign out the user
    await supabase.auth.signOut()

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete account error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}