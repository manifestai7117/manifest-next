'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getAuthCallbackUrl } from '@/lib/auth/redirect'
import toast from 'react-hot-toast'

export default function SignupPage() {
  const supabase = createClient()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [socialLoading, setSocialLoading] = useState<'google' | 'apple' | null>(null)
  const upd = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.name.trim()) {
      toast.error('Please enter your name')
      return
    }
    if (!form.email.includes('@')) {
      toast.error('Please enter a valid email')
      return
    }
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    if (form.password !== form.confirm) {
      toast.error('Passwords do not match')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { full_name: form.name },
        emailRedirectTo: getAuthCallbackUrl('/onboarding'),
      },
    })
    setLoading(false)

    if (error) {
      toast.error(error.message)
      return
    }

    setSent(true)
  }

  const handleOAuth = async (provider: 'google' | 'apple') => {
    try {
      setSocialLoading(provider)

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: getAuthCallbackUrl('/onboarding'),
        },
      })

      if (error) throw error
    } catch (error: any) {
      toast.error(
        error?.message || `Unable to continue with ${provider === 'apple' ? 'Apple' : 'Google'}`
      )
      setSocialLoading(null)
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-[#f8f7f5] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-10 max-w-md w-full text-center shadow-sm border border-[#e8e8e8]">
          <div className="w-16 h-16 bg-[#faf3e0] rounded-full flex items-center justify-center mx-auto mb-5 text-2xl">
            ✉️
          </div>
          <h1 className="font-serif text-[28px] mb-3">Check your email</h1>
          <p className="text-[14px] text-[#666] leading-[1.7] mb-6">
            We sent a confirmation link to <strong className="text-[#111]">{form.email}</strong>.
            <br />
            Click it to verify your account and get started.
          </p>
          <p className="text-[12px] text-[#999]">
            Didn't receive it? Check your spam folder or{' '}
            <button onClick={handleSignup} className="text-[#b8922a] underline">
              resend the email
            </button>
            .
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f7f5] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl overflow-hidden max-w-md w-full shadow-sm border border-[#e8e8e8]">
        <div className="p-8">
          <Link href="/" className="font-serif text-[20px] text-[#111] block mb-8">
            manifest<span className="text-[#b8922a]">.</span>
          </Link>

          <h1 className="font-serif text-[28px] mb-1">Start your journey</h1>
          <p className="text-[13px] text-[#666] mb-6">Free forever. No credit card needed.</p>

          <div className="space-y-2.5 mb-4">
            <button
              onClick={() => handleOAuth('apple')}
              disabled={!!socialLoading}
              className="w-full flex items-center justify-center gap-2.5 py-2.5 bg-[#111] text-white rounded-xl text-[13px] font-medium hover:bg-[#2a2a2a] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <span className="text-[16px] leading-none"></span>
              {socialLoading === 'apple' ? 'Connecting to Apple...' : 'Continue with Apple'}
            </button>

            <button
              onClick={() => handleOAuth('google')}
              disabled={!!socialLoading}
              className="w-full flex items-center justify-center gap-2.5 py-2.5 border border-[#e8e8e8] rounded-xl text-[13px] font-medium hover:bg-[#f8f7f5] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {socialLoading === 'google' ? 'Connecting to Google...' : 'Continue with Google'}
            </button>
          </div>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-[#e8e8e8]" />
            <span className="text-[12px] text-[#999]">or</span>
            <div className="flex-1 h-px bg-[#e8e8e8]" />
          </div>

          <form onSubmit={handleSignup} className="space-y-3">
            <div>
              <label className="block text-[12px] font-medium text-[#666] mb-1.5">
                Full name
              </label>
              <input
                className="w-full px-3.5 py-2.5 border border-[#e8e8e8] rounded-xl text-[14px] outline-none focus:border-[#111] transition-colors"
                value={form.name}
                onChange={e => upd('name', e.target.value)}
                placeholder="Your name"
                required
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[#666] mb-1.5">
                Email address
              </label>
              <input
                type="email"
                className="w-full px-3.5 py-2.5 border border-[#e8e8e8] rounded-xl text-[14px] outline-none focus:border-[#111] transition-colors"
                value={form.email}
                onChange={e => upd('email', e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[#666] mb-1.5">
                Password
              </label>
              <input
                type="password"
                className="w-full px-3.5 py-2.5 border border-[#e8e8e8] rounded-xl text-[14px] outline-none focus:border-[#111] transition-colors"
                value={form.password}
                onChange={e => upd('password', e.target.value)}
                placeholder="At least 8 characters"
                required
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[#666] mb-1.5">
                Confirm password
              </label>
              <input
                type="password"
                className="w-full px-3.5 py-2.5 border border-[#e8e8e8] rounded-xl text-[14px] outline-none focus:border-[#111] transition-colors"
                value={form.confirm}
                onChange={e => upd('confirm', e.target.value)}
                placeholder="Repeat password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading || !!socialLoading}
              className="w-full py-3 bg-[#111] text-white rounded-xl text-[13px] font-medium hover:bg-[#2a2a2a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-1"
            >
              {loading ? 'Creating account...' : 'Create free account'}
            </button>
          </form>

          <p className="text-[11px] text-[#999] text-center mt-4">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-[#111] font-medium underline">
              Sign in
            </Link>
          </p>

          <p className="text-[11px] text-[#bbb] text-center mt-2 leading-[1.6]">
            By signing up you agree to our <a href="#" className="underline">Terms</a> and{' '}
            <a href="#" className="underline">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  )
}