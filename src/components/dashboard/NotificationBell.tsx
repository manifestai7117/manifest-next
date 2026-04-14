'use client'
import { useState, useEffect, useRef } from 'react'

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
  const s = (Date.now() - new Date(d).getTime()) / 1000
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

export default function NotificationBell() {
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const res = await fetch('/api/notifications')
        if (!res.ok || !mounted) return
        const data = await res.json()
        if (mounted) {
          setNotifs(data.notifications || [])
          setUnread(data.unread || 0)
        }
      } catch {}
    }
    load()
    const timer = setInterval(load, 30000)
    return () => { mounted = false; clearInterval(timer) }
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
      <button onClick={() => setOpen(!open)} className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-[#f0ede8] transition-colors">
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
            {unread > 0 && <button onClick={markAll} className="text-[11px] text-[#b8922a] hover:underline">Mark all read</button>}
          </div>
          <div className="max-h-[360px] overflow-y-auto">
            {notifs.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-[32px] mb-2">🔔</p>
                <p className="text-[13px] text-[#999]">No notifications yet</p>
              </div>
            ) : notifs.map(n => (
              <div key={n.id} onClick={() => markOne(n.id, n.link)}
                className={`px-4 py-3 flex gap-3 cursor-pointer hover:bg-[#f8f7f5] transition-colors border-b border-[#f5f5f5] last:border-0 ${!n.read ? 'bg-[#faf9f7]' : ''}`}>
                <div className="w-8 h-8 rounded-full bg-[#f0ede8] flex items-center justify-center text-[15px] flex-shrink-0">
                  {ICONS[n.type] || '🔔'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#111] leading-snug">{n.title}</p>
                  {n.body && <p className="text-[12px] text-[#666] mt-0.5 truncate">{n.body}</p>}
                  <p className="text-[10px] text-[#999] mt-1">{timeAgo(n.created_at)}</p>
                </div>
                {!n.read && <div className="w-2 h-2 rounded-full bg-[#b8922a] flex-shrink-0 mt-2"/>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}