import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { email, name, imageUrl, goalTitle, affirmation, label } = await request.json()
    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey || resendKey === 'placeholder') return NextResponse.json({ error: 'Email not configured' }, { status: 500 })

    const firstName = name?.split(' ')[0] || 'there'
    const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f8f7f5;font-family:'Georgia',serif;">
  <div style="max-width:600px;margin:0 auto;background:white;">
    <div style="background:#111;padding:32px;text-align:center;">
      <p style="color:#b8922a;font-size:11px;letter-spacing:.2em;text-transform:uppercase;margin:0 0 8px">manifest.</p>
      <p style="color:white;font-style:italic;font-size:22px;margin:0;">Your Vision Art</p>
    </div>
    <div style="padding:40px 32px;">
      <p style="font-size:16px;color:#111;margin:0 0 8px">Hey ${firstName},</p>
      <p style="font-size:14px;color:#666;line-height:1.7;margin:0 0 24px">Here's your vision art for <strong>"${goalTitle}"</strong>. You chose <em>${label}</em>.</p>
      <div style="border-radius:16px;overflow:hidden;margin-bottom:24px;"><img src="${imageUrl}" alt="Vision Art" style="width:100%;display:block;"/></div>
      <div style="background:#faf3e0;border-left:3px solid #b8922a;padding:20px;border-radius:0 12px 12px 0;margin-bottom:24px;">
        <p style="font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#b8922a;margin:0 0 8px">Your affirmation</p>
        <p style="font-style:italic;font-size:16px;color:#111;line-height:1.6;margin:0">"${affirmation}"</p>
      </div>
      <p style="font-size:13px;color:#999;line-height:1.6;margin:0 0 24px">Set this as your phone wallpaper. Every time you see it, let it remind you of who you're becoming.</p>
      <a href="https://manifest-next.vercel.app/dashboard" style="display:inline-block;background:#111;color:white;padding:14px 28px;border-radius:12px;text-decoration:none;font-size:14px;font-weight:600;">Open Manifest →</a>
    </div>
    <div style="background:#f8f7f5;padding:24px;text-align:center;"><p style="font-size:12px;color:#999;margin:0;">manifest. · Your daily accountability partner</p></div>
  </div></body></html>`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'Manifest <onboarding@resend.dev>', to: email, subject: `Your vision art for "${goalTitle}" ✦`, html }),
    })

    if (!res.ok) { const err = await res.json(); return NextResponse.json({ error: err.message }, { status: 500 }) }
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
