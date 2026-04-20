'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export default function SettingsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [prefs, setPrefs] = useState({
    dark_mode: false,
    email_streak_reminders: true,
    email_weekly_digest: true,
    email_friend_activity: true,
    profile_public: true,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showPause, setShowPause] = useState(false)
  const [pauseDays, setPauseDays] = useState(7)
  const [pauseReason, setPauseReason] = useState('')
  const [paused, setPaused] = useState<string | null>(null)
  const [showDelete, setShowDelete] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUser(user)
      if (!user) return

      const res = await fetch('/api/settings')
      const data = await res.json()

      if (data) setPrefs(p => ({ ...p, ...data }))
      if (data?.paused_until && new Date(data.paused_until) > new Date()) {
        setPaused(data.paused_until)
      }

      setLoading(false)
    }

    load()
  }, [])

  const save = async (updates: Partial<typeof prefs>) => {
    setSaving(true)
    const newPrefs = { ...prefs, ...updates }
    setPrefs(newPrefs)

    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })

    toast.success('Saved')
    setSaving(false)
  }

  const pauseAccount = async () => {
    const res = await fetch('/api/offboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'pause', reason: pauseReason, pauseDays }),
    })

    const data = await res.json()

    if (data.success) {
      setPaused(data.pausedUntil)
      setShowPause(false)
      toast.success(`Account paused until ${new Date(data.pausedUntil).toLocaleDateString()}`)
    }
  }

  const cancelPause = async () => {
    await fetch('/api/offboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel_pause' }),
    })

    setPaused(null)
    toast.success('Pause cancelled — welcome back!')
  }

  const deleteAccount = async () => {
    if (deleteConfirm.trim().toLowerCase() !== 'delete') {
      toast.error('Type DELETE to confirm')
      return
    }

    try {
      setDeleting(true)

      const res = await fetch('/api/account/delete', { method: 'DELETE' })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || 'Unable to delete account')
      }

      toast.success('Your account has been deleted')
      router.push('/')
      router.refresh()
    } catch (error: any) {
      toast.error(error?.message || 'Unable to delete account')
      setDeleting(false)
    }
  }

  const Toggle = ({
    value,
    onChange,
    label,
    desc,
  }: {
    value: boolean
    onChange: (v: boolean) => void
    label: string
    desc?: string
  }) => (
    <div className="flex items-center justify-between py-3.5 border-b border-[#f0ede8] last:border-0">
      <div>
        <p className="text-[14px] font-medium">{label}</p>
        {desc && <p className="text-[12px] text-[#999] mt-0.5">{desc}</p>}
      </div>

      <button
        onClick={() => onChange(!value)}
        className={`w-11 h-6 rounded-full transition-all relative ${
          value ? 'bg-[#b8922a]' : 'bg-[#e8e8e8]'
        }`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
            value ? 'left-5.5 translate-x-0.5' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  )

  if (loading) return <div className="text-[#999] text-[14px]">Loading...</div>

  return (
    <>
      <div className="fade-up max-w-[640px]">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="font-serif text-[32px] mb-1">Settings</h1>
            <p className="text-[14px] text-[#666]">Manage your preferences and account</p>
          </div>
          {saving && <p className="text-[12px] text-[#999]">Saving…</p>}
        </div>

        {paused && (
          <div className="bg-[#faf3e0] border border-[#b8922a]/30 rounded-2xl p-4 mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="font-medium text-[14px] text-[#b8922a]">Account paused</p>
              <p className="text-[13px] text-[#666]">
                Reminders paused until {new Date(paused).toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={cancelPause}
              className="px-4 py-2 bg-[#b8922a] text-white rounded-xl text-[12px] font-medium"
            >
              Resume
            </button>
          </div>
        )}

        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 mb-4">
          <p className="font-medium text-[14px] mb-1">Profile visibility</p>
          <p className="text-[12px] text-[#999] mb-3">
            Control who can see your public profile page
          </p>

          <Toggle
            value={prefs.profile_public}
            onChange={v => save({ profile_public: v })}
            label="Public profile"
            desc={`manifest-next.vercel.app/profile/${user?.id}`}
          />

          {prefs.profile_public && (
            <div className="mt-3 flex items-center gap-2">
              <input
                readOnly
                value={`${process.env.NEXT_PUBLIC_APP_URL || 'https://manifest-next.vercel.app'}/profile/${user?.id}`}
                className="flex-1 text-[12px] text-[#666] bg-[#f8f7f5] border border-[#e8e8e8] rounded-lg px-3 py-2 outline-none"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    `${process.env.NEXT_PUBLIC_APP_URL || 'https://manifest-next.vercel.app'}/profile/${user?.id}`
                  )
                  toast.success('Link copied!')
                }}
                className="px-3 py-2 bg-[#111] text-white rounded-lg text-[12px] font-medium"
              >
                Copy
              </button>
            </div>
          )}
        </div>

        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 mb-4">
          <p className="font-medium text-[14px] mb-3">Email notifications</p>

          <Toggle
            value={prefs.email_streak_reminders}
            onChange={v => save({ email_streak_reminders: v })}
            label="Streak reminders"
            desc="Daily reminder if you haven't checked in"
          />

          <Toggle
            value={prefs.email_weekly_digest}
            onChange={v => save({ email_weekly_digest: v })}
            label="Weekly digest"
            desc="Your progress summary every Monday"
          />

          <Toggle
            value={prefs.email_friend_activity}
            onChange={v => save({ email_friend_activity: v })}
            label="Friend activity"
            desc="When friends like or comment on your posts"
          />
        </div>

        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 mb-4">
          <p className="font-medium text-[14px] mb-3">Appearance</p>
          <Toggle
            value={prefs.dark_mode}
            onChange={v => {
              save({ dark_mode: v })
              document.documentElement.classList.toggle('dark', v)
              localStorage.setItem('manifest_dark_mode', String(v))
            }}
            label="Dark mode"
            desc="Easy on the eyes"
          />
        </div>

        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 mb-4">
          <p className="font-medium text-[14px] mb-1">Need a break?</p>
          <p className="text-[12px] text-[#999] mb-3">
            Pause reminders temporarily instead of leaving. Your data and streaks are safe.
          </p>

          {!showPause ? (
            <button
              onClick={() => setShowPause(true)}
              className="px-4 py-2 border border-[#e8e8e8] rounded-xl text-[13px] text-[#666] hover:border-[#d0d0d0] transition-colors"
            >
              Take a break →
            </button>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-[12px] text-[#666] block mb-1">Pause for</label>
                <div className="flex gap-2">
                  {[7, 14, 30].map(d => (
                    <button
                      key={d}
                      onClick={() => setPauseDays(d)}
                      className={`px-4 py-2 rounded-xl text-[13px] border transition-all ${
                        pauseDays === d
                          ? 'bg-[#111] text-white border-[#111]'
                          : 'border-[#e8e8e8] text-[#666]'
                      }`}
                    >
                      {d} days
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[12px] text-[#666] block mb-1">
                  What's going on? <span className="text-[#999]">(optional)</span>
                </label>
                <input
                  value={pauseReason}
                  onChange={e => setPauseReason(e.target.value)}
                  placeholder="Vacation, busy period, mental health break..."
                  className="w-full text-[13px] border border-[#e8e8e8] rounded-xl px-3 py-2 outline-none focus:border-[#111]"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowPause(false)}
                  className="px-4 py-2 border border-[#e8e8e8] rounded-xl text-[13px] text-[#666]"
                >
                  Cancel
                </button>
                <button
                  onClick={pauseAccount}
                  className="px-4 py-2 bg-[#b8922a] text-white rounded-xl text-[13px] font-medium hover:bg-[#9a7820] transition-colors"
                >
                  Pause for {pauseDays} days
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white border border-[#f2d5d5] rounded-2xl p-5 mb-4">
          <p className="font-medium text-[14px] text-[#8f3131] mb-1">Delete account</p>
          <p className="text-[12px] text-[#a36a6a] mb-3">
            Permanently remove your account, goals, messages, and profile data.
          </p>

          <button
            onClick={() => setShowDelete(true)}
            className="px-4 py-2 border border-[#f2d5d5] text-[#8f3131] rounded-xl text-[13px] font-medium hover:bg-[#fff5f5] transition-colors"
          >
            Delete my account
          </button>
        </div>
      </div>

      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/45"
            onClick={() => !deleting && setShowDelete(false)}
          />

          <div className="relative w-full max-w-md rounded-3xl border border-[#f2d5d5] bg-white p-6 shadow-2xl">
            <p className="font-serif text-[28px] mb-2">Delete account?</p>
            <p className="text-[13px] text-[#666] leading-[1.7] mb-4">
              This cannot be undone. Your goals, messages, profile, rewards, and account data
              will be permanently deleted.
            </p>

            <div className="bg-[#fff7f7] border border-[#f6dede] rounded-2xl p-3 mb-4">
              <p className="text-[12px] text-[#8f3131] font-medium mb-1">
                Confirm by typing DELETE
              </p>
              <input
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder="DELETE"
                className="w-full text-[13px] border border-[#e8e8e8] rounded-xl px-3 py-2 outline-none focus:border-[#111]"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowDelete(false)}
                disabled={deleting}
                className="px-4 py-2 border border-[#e8e8e8] rounded-xl text-[13px] text-[#666] disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                onClick={deleteAccount}
                disabled={deleting}
                className="px-4 py-2 bg-[#8f3131] text-white rounded-xl text-[13px] font-medium hover:bg-[#772828] transition-colors disabled:opacity-60"
              >
                {deleting ? 'Deleting...' : 'Permanently delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}