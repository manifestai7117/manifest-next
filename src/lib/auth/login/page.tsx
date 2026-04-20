'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getAuthCallbackUrl, getResetPasswordUrl } from '@/lib/auth/redirect'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [socialLoading, setSocialLoading] = useState<'google' | 'apple' | null>(null)
  const upd = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.email || !form.password) {
      toast.error('Please fill in all fields')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    })
    setLoading(false)

    if (error) {
      if (error.message.includes('Email not confirmed')) {
        toast.error('Please verify your email first. Check your inbox.')
      } else if (error.message.includes('Invalid login credentials')) {
        toast.error('Incorrect email or password')
      } else {
        toast.error(error.message)
      }
      return
    }

    toast.success('Welcome back!')
    router.push('/dashboard')
    router.refresh()
  }

  const handleOAuth = async (provider: 'google' | 'apple') => {
    try {
      setSocialLoading(provider)

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: getAuthCallbackUrl('/dashboard'),
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

  const handleReset = async () => {
    if (!form.email) {
      toast.error('Enter your email first')
      return
    }

    const { error } = await supabase.auth.resetPasswordForEmail(form.email, {
      redirectTo: getResetPasswordUrl(),
    })

    if (error) {
      toast.error(error.message)
      return
    }

    setResetSent(true)
    toast.success('Password reset email sent!')
  }

  return (
    <div className="min-h-screen bg-[#f8f7f5] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl overflow-hidden max-w-md w-full shadow-sm border border-[#e8e8e8]">
        <div className="p-8">
          <Link href="/" className="font-serif text-[20px] text-[#111] block mb-8">
            manifest<span className="text-[#b8922a]">.</span>
          </Link>

          <h1 className="font-serif text-[28px] mb-1">Welcome back</h1>
          <p className="text-[13px] text-[#666] mb-6">Sign in to your Manifest account</p>

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

          <form onSubmit={handleLogin} className="space-y-3">
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
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-[12px] font-medium text-[#666]">Password</label>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-[11px] text-[#b8922a] hover:underline"
                >
                  {resetSent ? 'Reset email sent ✓' : 'Forgot password?'}
                </button>
              </div>

              <input
                type="password"
                className="w-full px-3.5 py-2.5 border border-[#e8e8e8] rounded-xl text-[14px] outline-none focus:border-[#111] transition-colors"
                value={form.password}
                onChange={e => upd('password', e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading || !!socialLoading}
              className="w-full py-3 bg-[#111] text-white rounded-xl text-[13px] font-medium hover:bg-[#2a2a2a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-1"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p className="text-[11px] text-[#999] text-center mt-4">
            Don't have an account?{' '}
            <Link href="/auth/signup" className="text-[#111] font-medium underline">
              Create one free
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}