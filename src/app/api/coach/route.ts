import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const { userId, goalTitle, artTitle, affirmation, coachOpening, todayAction } = await request.json()

    // Skip email if Resend not configured
    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey || resendKey === 'placeholder') {
      console.log('Resend not configured — skipping welcome email')
      return NextResponse.json({ success: true, skipped: true })
    }

    const { Resend } = await import('resend')
    const resend = new Resend(resendKey)

    const supabase = createAdminClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', userId)
      .single()

    if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const firstName = profile.full_name?.split(' ')[0] || 'friend'
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://manifest-next.vercel.app'

    await resend.emails.send({
      from: `Manifest <${process.env.RESEND_FROM_EMAIL || 'hello@manifestapp.com'}>`,
      to: profile.email,
      subject: `${firstName}, your manifest is live ✦`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8f7f5;font-family:Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:white;border-radius:20px;overflow:hidden;border:1px solid #e8e8e8;">
    <div style="background:#111;padding:32px 40px;">
      <p style="font-size:24px;color:white;margin:0;">manifest<span style="color:#b8922a;">.</span></p>
    </div>
    <div style="padding:40px;">
      <h1 style="font-size:32px;font-weight:400;margin:0 0 8px;line-height:1.2;">Welcome, ${firstName}.</h1>
      <p style="color:#666;font-size:15px;line-height:1.7;margin:0 0 28px;">Your manifest is live. Here's what we built for you:</p>
      <div style="background:#f8f7f5;border-radius:12px;padding:20px;margin-bottom:20px;">
        <p style="font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#b8922a;margin:0 0 6px;">Your goal</p>
        <p style="font-size:18px;margin:0;line-height:1.4;">${goalTitle}</p>
      </div>
      <div style="background:#1a1a2e;border-radius:12px;padding:24px;margin-bottom:20px;">
        <p style="font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:rgba(184,146,42,.7);margin:0 0 8px;">Your vision art</p>
        <p style="font-style:italic;font-size:20px;color:rgba(255,255,255,.9);margin:0 0 8px;">${artTitle}</p>
        <p style="font-size:13px;color:rgba(255,255,255,.5);margin:0;font-style:italic;">"${affirmation}"</p>
      </div>
      <div style="border-left:3px solid #b8922a;padding-left:16px;margin-bottom:24px;">
        <p style="font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#999;margin:0 0 8px;">From your coach</p>
        <p style="font-style:italic;font-size:16px;line-height:1.65;color:#111;margin:0;">"${coachOpening}"</p>
      </div>
      <div style="background:#faf3e0;border-radius:12px;padding:18px;margin-bottom:28px;">
        <p style="font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#b8922a;margin:0 0 6px;">Do this today</p>
        <p style="font-size:14px;color:#111;margin:0;line-height:1.6;">${todayAction}</p>
      </div>
      <a href="${appUrl}/dashboard" style="display:block;background:#111;color:white;text-align:center;padding:16px;border-radius:12px;text-decoration:none;font-size:14px;font-weight:500;">Open my dashboard →</a>
    </div>
    <div style="border-top:1px solid #e8e8e8;padding:24px 40px;text-align:center;">
      <p style="font-size:12px;color:#999;margin:0;">You're receiving this because you created a Manifest account.</p>
    </div>
  </div>
</body>
</html>`,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Email error:', error)
    // Don't fail the whole request if email fails
    return NextResponse.json({ success: true, emailError: error.message })
  }
}