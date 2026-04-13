'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type Notification = {
  id: string; type: string; title: string; body?: string
  link?: string; read: boolean; created_at: string
  actor?: { full_name: string; avatar_url: string }
}

function timeAgo(d: string) {
  const s = (Date.now() - new Date(d).getTime()) / 1000
  if (s < 3600) return `${Math.floor(s/60)}m`
  if (s < 86400) return `${Math.floor(s/3600)}h`
  return `${Math.floor(s/86400)}d`
}

const TYPE_ICONS: Record<string, string> = {
  like: '❤️', comment: '💬', friend_request: '👋', friend_accept: '🤝',
  circle_message: '🔔', milestone: '🏆', streak_at_risk: '🔥', reward: '⭐'
}

export default function NotificationBell() {
  const supabase = createClient()
  const [notifs, setNotifs] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const load = async () => {
    const res = await fetch('/api/notifications')
    const data = await res.json()
    setNotifs(data.notifications || [])
    setUnread(data.unread || 0)
  }

  useEffect(() => {
    load()
    const { data: { user } } = { data: { user: null } }
    // Realtime subscription
    const channel = supabase.channel('notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => { load() })
      .subscribe()
    const interval = setInterval(load, 60000)
    return () => { supabase.removeChannel(channel); clearInterval(interval) }
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const markAllRead = async () => {
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'all' }) })
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
    setUnread(0)
  }

  const markRead = async (id: string) => {
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    setUnread(prev => Math.max(0, prev - 1))
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-[#f0ede8] transition-colors">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-[340px] bg-white border border-[#e8e8e8] rounded-2xl shadow-2xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-[#f0ede8] flex items-center justify-between">
            <p className="font-medium text-[14px]">Notifications</p>
            {unread > 0 && <button onClick={markAllRead} className="text-[11px] text-[#b8922a] hover:underline">Mark all read</button>}
          </div>
          <div className="max-h-[380px] overflow-y-auto">
            {notifs.length === 0 ? (
              <div className="text-center py-10 text-[#999]">
                <p className="text-[32px] mb-2">🔔</p>
                <p className="text-[13px]">No notifications yet</p>
              </div>
            ) : notifs.map(n => (
              <div key={n.id} onClick={() => { markRead(n.id); if (n.link) window.location.href = n.link }}
                className={`px-4 py-3 flex gap-3 cursor-pointer hover:bg-[#f8f7f5] transition-colors border-b border-[#f5f5f5] last:border-0 ${!n.read ? 'bg-[#faf9f7]' : ''}`}>
                <div className="w-8 h-8 rounded-full bg-[#f0ede8] flex items-center justify-center text-[16px] flex-shrink-0">
                  {n.actor?.avatar_url ? <img src={n.actor.avatar_url} className="w-full h-full rounded-full object-cover"/> : TYPE_ICONS[n.type] || '🔔'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#111] leading-tight">{n.title}</p>
                  {n.body && <p className="text-[12px] text-[#666] mt-0.5 leading-tight truncate">{n.body}</p>}
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
