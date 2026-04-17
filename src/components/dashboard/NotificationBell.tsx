'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

type Notif = {
  id: string
  type: string
  title: string
  body?: string
  link?: string
  read: boolean
  created_at: string
}

const ICONS: Record<string, string> = {
  like: '❤️', comment: '💬', friend_request: '👋', friend_accept: '🤝',
  circle_message: '🔔', milestone: '🏆', streak_at_risk: '🔥', reward: '⭐',
}

function timeAgo(d: string) {
  const ms = Date.now() - new Date(d).getTime()
  if (isNaN(ms)) return 'just now'
  const s = ms / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export default function NotificationBell() {
  const supabase = createClient()
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  const loadNotifs = async () => {
    try {
      const res = await fetch('/api/notifications')
      if (!res.ok) return
      const data = await res.json()
      setNotifs(data.notifications || [])
      setUnread((data.notifications || []).filter((n: Notif) => !n.read).length)
    } catch {}
  }

  // Initial load + get userId for realtime subscription
  useEffect(() => {
    let mounted = true
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!mounted || !user) return
      setUserId(user.id)
      loadNotifs()
    }
    init()
    return () => { mounted = false }
  }, [])

  // Supabase Realtime subscription for new notifications
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotif = payload.new as Notif
          setNotifs(prev => {
            if (prev.find(n => n.id === newNotif.id)) return prev
            return [newNotif, ...prev]
          })
          setUnread(prev => prev + 1)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const markAll = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'all' }),
      })
      setNotifs(p => p.map(n => ({ ...n, read: true })))
      setUnread(0)
    } catch {}
  }

  const markOne = async (id: string, link?: string) => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      setNotifs(p => p.map(n => n.id === id ? { ...n, read: true } : n))
      setUnread(p => Math.max(0, p - 1))
    } catch {}
    setOpen(false)
    if (link) window.location.href = link
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-[#f0ede8] transition-colors"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-[320px] bg-white border border-[#e8e8e8] rounded-2xl shadow-2xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-[#f0ede8] flex items-center justify-between">
            <p className="font-medium text-[14px]">Notifications</p>
            {unread > 0 && (
              <button onClick={markAll} className="text-[11px] text-[#b8922a] hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-[360px] overflow-y-auto">
            {notifs.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-[32px] mb-2">🔔</p>
                <p className="text-[13px] text-[#999]">No notifications yet</p>
              </div>
            ) : notifs.map(n => (
              <div
                key={n.id}
                onClick={() => markOne(n.id, n.link)}
                className={`px-4 py-3 flex gap-3 cursor-pointer hover:bg-[#f8f7f5] transition-colors border-b border-[#f8f7f5] last:border-0 ${!n.read ? 'bg-[#faf3e0]/40' : ''}`}
              >
                <span className="text-[20px] flex-shrink-0 mt-0.5">{ICONS[n.type] || '🔔'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#111] leading-[1.4]">{n.title}</p>
                  {n.body && <p className="text-[12px] text-[#666] mt-0.5 leading-[1.4] truncate">{n.body}</p>}
                  <p className="text-[11px] text-[#bbb] mt-1">{timeAgo(n.created_at)}</p>
                </div>
                {!n.read && <div className="w-2 h-2 bg-[#b8922a] rounded-full mt-1.5 flex-shrink-0"/>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}