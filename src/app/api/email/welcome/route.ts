import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/server'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  try {
    const { userId, goalTitle, artTitle, affirmation, coachOpening, todayAction } = await request.json()

    const supabase = createAdminClient()
    const { data: profile } = await supabase.from('profiles').select('email, full_name').eq('id', userId).single()
    if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const firstName = profile.full_name?.split(' ')[0] || 'friend'

    await resend.emails.send({
      from: `Manifest <${process.env.RESEND_FROM_EMAIL || 'hello@manifestapp.com'}>`,
      to: profile.email,
      subject: `${firstName}, your manifest is live ✦`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8f7f5;font-family:'DM Sans',Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:white;border-radius:20px;overflow:hidden;border:1px solid #e8e8e8;">

    <!-- Header -->
    <div style="background:#111;padding:32px 40px;">
      <p style="font-family:Georgia,serif;font-size:24px;color:white;margin:0;">manifest<span style="color:#b8922a;">.</span></p>
    </div>

    <!-- Body -->
    <div style="padding:40px;">
      <h1 style="font-family:Georgia,serif;font-size:32px;font-weight:400;margin:0 0 8px;line-height:1.2;">Welcome, ${firstName}.</h1>
      <p style="color:#666;font-size:15px;line-height:1.7;margin:0 0 28px;">Your manifest is live. Here's what we built for you:</p>

      <!-- Goal -->
      <div style="background:#f8f7f5;border-radius:12px;padding:20px;margin-bottom:20px;">
        <p style="font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#b8922a;margin:0 0 6px;">Your goal</p>
        <p style="font-family:Georgia,serif;font-size:18px;margin:0;line-height:1.4;">${goalTitle}</p>
      </div>

      <!-- Art -->
      <div style="background:#1a1a2e;border-radius:12px;padding:24px;margin-bottom:20px;">
        <p style="font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:rgba(184,146,42,.7);margin:0 0 8px;">Your vision art</p>
        <p style="font-family:Georgia,serif;font-style:italic;font-size:20px;color:rgba(255,255,255,.9);margin:0 0 8px;">${artTitle}</p>
        <p style="font-size:13px;color:rgba(255,255,255,.5);margin:0;font-style:italic;">"${affirmation}"</p>
      </div>

      <!-- Coach -->
      <div style="border-left:3px solid #b8922a;padding-left:16px;margin-bottom:24px;">
        <p style="font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#999;margin:0 0 8px;">From your coach</p>
        <p style="font-family:Georgia,serif;font-style:italic;font-size:16px;line-height:1.65;color:#111;margin:0;">"${coachOpening}"</p>
      </div>

      <!-- Today's action -->
      <div style="background:#faf3e0;border-radius:12px;padding:18px;margin-bottom:28px;">
        <p style="font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#b8922a;margin:0 0 6px;">Do this today</p>
        <p style="font-size:14px;color:#111;margin:0;line-height:1.6;">${todayAction}</p>
      </div>

      <!-- CTA -->
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="display:block;background:#111;color:white;text-align:center;padding:16px;border-radius:12px;text-decoration:none;font-size:14px;font-weight:500;letter-spacing:.02em;">Open my dashboard →</a>
    </div>

    <!-- Footer -->
    <div style="border-top:1px solid #e8e8e8;padding:24px 40px;text-align:center;">
      <p style="font-size:12px;color:#999;margin:0;line-height:1.6;">You're receiving this because you created a Manifest account.<br/>
      <a href="#" style="color:#999;">Unsubscribe</a> · <a href="#" style="color:#999;">Privacy Policy</a></p>
    </div>
  </div>
</body>
</html>`,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Email error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
