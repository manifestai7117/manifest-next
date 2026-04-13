import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const today = new Date().toISOString().split('T')[0]
  const results = { streakReminders: 0, emailsProcessed: 0, insightsGenerated: 0 }

  // 1. Streak reminders - users with active streaks who haven't checked in today
  const { data: goalsAtRisk } = await supabase
    .from('goals').select('user_id, title, streak, id')
    .eq('is_active', true).neq('last_checkin', today).gt('streak', 0)

  if (goalsAtRisk?.length) {
    const userIds = goalsAtRisk.map(g => g.user_id).filter((id: string, i: number, a: string[]) => a.indexOf(id) === i)
    const { data: prefs } = await supabase.from('user_preferences').select('user_id').in('user_id', userIds).eq('email_streak_reminders', true)
    const prefSet = new Set((prefs || []).map((p: any) => p.user_id))
    const { data: profiles } = await supabase.from('profiles').select('id, email, full_name').in('id', [...prefSet])
    const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]))

    for (const goal of goalsAtRisk) {
      if (!prefSet.has(goal.user_id)) continue
      const profile = profileMap[goal.user_id]
      if (!profile?.email) continue
      const firstName = profile.full_name?.split(' ')[0] || 'there'
      await sendEmail(profile.email, `${firstName}, your ${goal.streak}-day streak needs you 🔥`,
        `<p>You haven't checked in today for <strong>"${goal.title}"</strong>.</p><p>Your ${goal.streak}-day streak is at risk. It takes 2 minutes.</p>`,
        'Check in now →')
      results.streakReminders++
    }
  }

  // 2. Process email queue
  const { data: pendingEmails } = await supabase.from('email_queue').select('*').eq('status', 'pending').lte('scheduled_for', new Date().toISOString()).limit(50)

  for (const item of pendingEmails || []) {
    try {
      const { data: profile } = await supabase.from('profiles').select('email, full_name').eq('id', item.user_id).single()
      if (!profile?.email) { await supabase.from('email_queue').update({ status: 'failed' }).eq('id', item.id); continue }
      const { data: goals } = await supabase.from('goals').select('title, streak, progress').eq('user_id', item.user_id).eq('is_active', true).order('created_at', { ascending: false }).limit(1)
      const goal = goals?.[0]
      const firstName = profile.full_name?.split(' ')[0] || 'there'

      const emailContent: Record<string, { subject: string; body: string }> = {
        welcome_d1: { subject: `Welcome to Manifest, ${firstName} ✦`, body: `<p>You just set a goal. That's the hardest part — most people never get here.</p><p>Your AI coach is ready. Check in daily to build momentum. Every streak starts with day 1.</p>` },
        welcome_d3: { subject: `How's it going, ${firstName}?`, body: `<p>3 days in${goal ? ` on "${goal.title}"` : ''}. The first week is where real habits form.</p><p><strong>Tip:</strong> Join a Goal Circle to find people working on similar goals. Accountability multiplies results by 3x.</p>` },
        welcome_d7: { subject: `One week in — you're building something real`, body: `<p>One full week${goal ? ` — ${goal.streak} check-ins on "${goal.title}"` : ''}. You're building real momentum.</p><p>People who make it past day 7 are 4x more likely to achieve their goal. You're in that group now.</p>` },
      }

      if (item.type === 'weekly_digest') {
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
        const { data: weekCheckins } = await supabase.from('checkins').select('mood').eq('user_id', item.user_id).gte('created_at', weekAgo)
        const { data: allGoals } = await supabase.from('goals').select('title, streak, progress').eq('user_id', item.user_id).eq('is_active', true)
        const avgMood = weekCheckins?.length ? (weekCheckins.reduce((a: number, c: any) => a + c.mood, 0) / weekCheckins.length).toFixed(1) : 'N/A'
        const { data: pref } = await supabase.from('user_preferences').select('email_weekly_digest').eq('user_id', item.user_id).maybeSingle()
        if (pref?.email_weekly_digest === false) { await supabase.from('email_queue').update({ status: 'skipped' }).eq('id', item.id); continue }
        await sendEmail(profile.email, `Your week in review, ${firstName} 📊`,
          `<div style="display:flex;gap:16px;margin-bottom:20px">
            <div style="flex:1;background:#f8f7f5;border-radius:12px;padding:16px;text-align:center"><p style="font-size:28px;margin:0">${weekCheckins?.length || 0}</p><p style="font-size:11px;color:#999;margin:4px 0 0">Check-ins</p></div>
            <div style="flex:1;background:#f8f7f5;border-radius:12px;padding:16px;text-align:center"><p style="font-size:28px;margin:0;color:#b8922a">${allGoals?.[0]?.streak || 0}🔥</p><p style="font-size:11px;color:#999;margin:4px 0 0">Streak</p></div>
            <div style="flex:1;background:#f8f7f5;border-radius:12px;padding:16px;text-align:center"><p style="font-size:28px;margin:0">${avgMood}</p><p style="font-size:11px;color:#999;margin:4px 0 0">Avg mood</p></div>
          </div>
          ${(allGoals || []).map((g: any) => `<div style="border:1px solid #e8e8e8;border-radius:12px;padding:14px;margin-bottom:10px"><p style="font-size:14px;font-weight:500;margin:0 0 8px">${g.title}</p><div style="background:#f0ede8;border-radius:4px;height:5px"><div style="background:#b8922a;height:100%;width:${g.progress}%;border-radius:4px"></div></div><p style="font-size:12px;color:#999;margin:5px 0 0">${g.progress}% complete · ${g.streak} day streak</p></div>`).join('')}`,
          'Open Manifest →')
      } else if (emailContent[item.type]) {
        const { subject, body } = emailContent[item.type]
        await sendEmail(profile.email, subject, body, 'Open my dashboard →')
      }

      await supabase.from('email_queue').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', item.id)
      results.emailsProcessed++
    } catch {
      await supabase.from('email_queue').update({ status: 'failed' }).eq('id', item.id)
    }
  }

  // 3. Schedule weekly digests on Monday
  if (new Date().getDay() === 1) {
    const { data: allUsers } = await supabase.from('profiles').select('id')
    for (const u of allUsers || []) {
      const { data: ex } = await supabase.from('email_queue').select('id').eq('user_id', u.id).eq('type', 'weekly_digest').gte('scheduled_for', new Date().toISOString()).maybeSingle()
      if (!ex) await supabase.from('email_queue').insert({ user_id: u.id, type: 'weekly_digest', scheduled_for: new Date().toISOString() })
    }
  }

  // 4. Generate AI insights for active goals
  const { data: goalsForInsights } = await supabase.from('goals').select('id, user_id, title, streak, progress, timeline').eq('is_active', true).limit(30)
  for (const goal of goalsForInsights || []) {
    const { data: existing } = await supabase.from('goal_insights').select('id').eq('goal_id', goal.id).gte('generated_at', new Date(Date.now() - 23 * 3600000).toISOString()).maybeSingle()
    if (existing) continue
    const { data: checkins } = await supabase.from('checkins').select('mood').eq('goal_id', goal.id).order('created_at', { ascending: false }).limit(7)
    if (!checkins?.length) continue
    try {
      const avgMood = (checkins.reduce((a: number, c: any) => a + c.mood, 0) / checkins.length).toFixed(1)
      const res = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001', max_tokens: 80,
        messages: [{ role: 'user', content: `Goal: "${goal.title}". Progress: ${goal.progress}%. Streak: ${goal.streak} days. Avg mood last ${checkins.length} days: ${avgMood}/5. Write 1 specific insight in 1-2 sentences. Be direct and actionable. No generic advice.` }]
      })
      const insight = res.content[0].type === 'text' ? res.content[0].text.trim() : ''
      if (insight) { await supabase.from('goal_insights').insert({ goal_id: goal.id, user_id: goal.user_id, insight }); results.insightsGenerated++ }
    } catch {}
  }

  return NextResponse.json({ success: true, ...results })
}

async function sendEmail(to: string, subject: string, body: string, ctaText: string) {
  const key = process.env.RESEND_API_KEY
  if (!key || key === 'placeholder') return
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Manifest <onboarding@resend.dev>', to,
      subject,
      html: `<div style="font-family:Georgia,serif;max-width:560px;margin:40px auto;background:white;border-radius:20px;border:1px solid #e8e8e8;overflow:hidden">
        <div style="background:#111;padding:28px 36px"><p style="color:#b8922a;font-size:10px;letter-spacing:.2em;text-transform:uppercase;margin:0">manifest.</p></div>
        <div style="padding:36px">${body}<a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="display:block;background:#111;color:white;text-align:center;padding:15px;border-radius:12px;text-decoration:none;font-size:14px;font-weight:500;margin:24px 0 16px">${ctaText}</a>
        <p style="font-size:11px;color:#bbb;text-align:center"><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings" style="color:#bbb">Manage email preferences</a></p></div>
      </div>`
    })
  })
}
