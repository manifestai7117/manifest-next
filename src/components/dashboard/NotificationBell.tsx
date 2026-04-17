'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Notif = {
  id: string
  type: string
  title: string
  body?: string
  link?: string
  read: boolean
  created_at: string
  actor?: { full_name: string; avatar_url?: string } | null
}

const TYPE_ICON: Record<string, string> = {
  friend_request: '👋',
  friend_accept: '🤝',
  like: '❤️',
  comment: '💬',
  circle_message: '🔔',
  milestone: '🏆',
  streak_at_risk: '🔥',
  reward: '⭐',
}

function timeAgo(d: string) {
  if (!d) return 'just now'
  const ms = Date.now() - new Date(d).getTime()
  if (isNaN(ms) || ms < 0) return 'just now'
  const s = ms / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

function buildTitle(n: Notif): string {
  const name = n.actor?.full_name || 'Someone'
  switch (n.type) {
    case 'friend_request': return `${name} sent you a friend request`
    case 'friend_accept':  return `${name} accepted your friend request`
    case 'like':           return `${name} liked your post`
    case 'comment':        return `${name} sent you a message`
    case 'circle_message': return `New message in your circle`
    default:               return n.title || 'New notification'
  }
}

export default function NotificationBell() {
  const supabase = createClient()
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const channelRef = useRef<any>(null)
  const intervalRef = useRef<any>(null)

  const loadNotifs = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      setNotifs(data.notifications || [])
      setUnread((data.notifications || []).filter((n: Notif) => !n.read).length)
    } catch {}
  }, [])

  useEffect(() => {
    let mounted = true
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!mounted || !user) return
      await loadNotifs()
      // Poll every 10s as a reliable fallback for realtime
      intervalRef.current = setInterval(loadNotifs, 10000)
      // Supabase Realtime
      const channel = supabase
        .channel(`notifbell-${user.id}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        }, () => { loadNotifs() })
        .subscribe()
      channelRef.current = channel
    }
    init()
    return () => {
      mounted = false
      if (channelRef.current) supabase.removeChannel(channelRef.current)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const markAll = async () => {
    try {
      await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'all' }) })
      setNotifs(p => p.map(n => ({ ...n, read: true })))
      setUnread(0)
    } catch {}
  }

  const markOne = async (id: string, link?: string) => {
    try {
      await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
      setNotifs(p => p.map(n => n.id === id ? { ...n, read: true } : n))
      setUnread(p => Math.max(0, p - 1))
    } catch {}
    setOpen(false)
    if (link) window.location.href = link
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => { setOpen(v => { if (!v) loadNotifs(); return !v }) }}
        className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-[#f0ede8] dark:hover:bg-white/10 transition-colors">
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
        <div className="absolute right-0 top-11 w-[340px] bg-white dark:bg-[#1a1a1a] border border-[#e8e8e8] dark:border-[#333] rounded-2xl shadow-2xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-[#f0ede8] dark:border-[#333] flex items-center justify-between">
            <p className="font-medium text-[14px]">Notifications</p>
            {unread > 0 && <button onClick={markAll} className="text-[11px] text-[#b8922a] hover:underline">Mark all read</button>}
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            {notifs.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-[28px] mb-2">🔔</p>
                <p className="text-[13px] text-[#999]">No notifications yet</p>
                <p className="text-[11px] text-[#bbb] mt-1">Friend requests and messages show here</p>
              </div>
            ) : notifs.map(n => (
              <div key={n.id} onClick={() => markOne(n.id, n.link)}
                className={`px-4 py-3.5 flex gap-3 cursor-pointer hover:bg-[#f8f7f5] dark:hover:bg-white/5 transition-colors border-b border-[#f5f5f5] dark:border-[#222] last:border-0 ${!n.read ? 'bg-[#faf9f7] dark:bg-[#b8922a]/5' : ''}`}>
                <div className="w-9 h-9 rounded-full flex-shrink-0 overflow-hidden bg-[#f0ede8] dark:bg-[#333] flex items-center justify-center">
                  {n.actor?.avatar_url
                    ? <img src={n.actor.avatar_url} alt="" className="w-full h-full object-cover"/>
                    : <span className="text-[17px]">{TYPE_ICON[n.type] || '🔔'}</span>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#111] dark:text-white leading-[1.4]">{buildTitle(n)}</p>
                  {n.body && <p className="text-[12px] text-[#666] dark:text-[#999] mt-0.5 leading-[1.4] line-clamp-2">{n.body}</p>}
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