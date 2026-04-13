'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

// ─── Types ───────────────────────────────────────────────────────────────────
type Profile = { id: string; full_name: string; avatar_url: string; plan: string }
type Comment = { id: string; post_id: string; user_id: string; content: string; created_at: string; profiles?: Profile }
type Post = {
  id: string; user_id: string; content: string; post_type: string
  created_at: string; profiles?: Profile; likes_count: number
  user_liked: boolean; goal_title?: string; goal_id?: string
  comments?: Comment[]; comment_count: number; show_comments?: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────
const TYPE_CFG: Record<string, { emoji: string; color: string; bg: string }> = {
  achievement: { emoji: '🏆', color: 'text-yellow-700', bg: 'bg-yellow-50' },
  checkin:     { emoji: '✅', color: 'text-green-700',  bg: 'bg-green-50'  },
  goal_start:  { emoji: '🎯', color: 'text-blue-700',   bg: 'bg-blue-50'   },
  feeling:     { emoji: '💭', color: 'text-purple-700', bg: 'bg-purple-50' },
  reward:      { emoji: '⭐', color: 'text-[#b8922a]',  bg: 'bg-[#faf3e0]' },
  milestone:   { emoji: '🚀', color: 'text-indigo-700', bg: 'bg-indigo-50' },
  general:     { emoji: '📝', color: 'text-[#666]',     bg: 'bg-[#f8f7f5]' },
}
const POST_TYPES = [
  { v: 'general', l: 'General' }, { v: 'achievement', l: 'Achievement' },
  { v: 'checkin', l: 'Daily log' }, { v: 'goal_start', l: 'New goal' },
  { v: 'feeling', l: 'Feeling' }, { v: 'reward', l: 'Reward' }, { v: 'milestone', l: 'Milestone' },
]
const REPORT_REASONS = [
  'Inappropriate / offensive content', 'Spam or self-promotion',
  'Harassment or bullying', 'False information', 'Hate speech',
  'Unrelated to goals / off-topic', 'Other',
]

function timeAgo(d: string) {
  const s = (Date.now() - new Date(d).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s/60)}m`
  if (s < 86400) return `${Math.floor(s/3600)}h`
  return `${Math.floor(s/86400)}d`
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ p, size = 10 }: { p: any; size?: number }) {
  const cls = `w-${size} h-${size} rounded-full flex-shrink-0`
  return p?.avatar_url
    ? <img src={p.avatar_url} alt="" className={`${cls} object-cover`}/>
    : <div className={`${cls} bg-[#b8922a] flex items-center justify-center text-white font-semibold text-[13px]`}>{p?.full_name?.[0]?.toUpperCase() || '?'}</div>
}

// ─── Report Modal ─────────────────────────────────────────────────────────────
function ReportModal({ targetId, targetType, onClose }: { targetId: string; targetType: 'post'|'comment'; onClose: () => void }) {
  const supabase = createClient()
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    if (!reason) return
    setSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('content_reports').insert({ reporter_id: user?.id, target_id: targetId, target_type: targetType, reason })
    toast.success('Reported. Our team will review this.')
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-[380px] p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="font-serif text-[20px] mb-1">Report {targetType}</h3>
        <p className="text-[13px] text-[#666] mb-4">Why are you reporting this?</p>
        <div className="space-y-2 mb-5">
          {REPORT_REASONS.map(r => (
            <button key={r} onClick={() => setReason(r)}
              className={`w-full text-left px-4 py-2.5 rounded-xl border text-[13px] transition-all ${reason === r ? 'bg-[#111] text-white border-[#111]' : 'border-[#e8e8e8] hover:border-[#d0d0d0]'}`}>
              {r}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 border border-[#e8e8e8] rounded-xl text-[13px]">Cancel</button>
          <button onClick={submit} disabled={!reason || submitting}
            className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-[13px] font-medium disabled:opacity-40 hover:bg-red-600 transition-colors">
            {submitting ? 'Reporting...' : 'Submit report'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Post Card ────────────────────────────────────────────────────────────────
function PostCard({ post, userId, onLike, onDelete, onComment, onDeleteComment }: {
  post: Post; userId: string
  onLike: (p: Post) => void
  onDelete: (id: string) => void
  onComment: (postId: string, text: string) => Promise<void>
  onDeleteComment: (commentId: string, postId: string) => void
}) {
  const [showComments, setShowComments] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [commenting, setCommenting] = useState(false)
  const [report, setReport] = useState<{ id: string; type: 'post'|'comment' } | null>(null)
  const [showMenu, setShowMenu] = useState(false)
  const isOwn = post.user_id === userId
  const tc = TYPE_CFG[post.post_type] || TYPE_CFG.general

  const handleComment = async () => {
    if (!commentText.trim() || commenting) return
    setCommenting(true)
    await onComment(post.id, commentText.trim())
    setCommentText('')
    setCommenting(false)
  }

  return (
    <>
      {report && <ReportModal targetId={report.id} targetType={report.type} onClose={() => setReport(null)}/>}
      <div className="bg-white border border-[#e8e8e8] rounded-2xl overflow-hidden hover:border-[#d0d0d0] transition-all">
        {/* Post header */}
        <div className="p-5 pb-3">
          <div className="flex gap-3 mb-3">
            <Avatar p={post.profiles}/>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[14px] font-semibold">{post.profiles?.full_name}</p>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${tc.bg} ${tc.color}`}>
                  {tc.emoji} {POST_TYPES.find(t => t.v === post.post_type)?.l}
                </span>
                {post.goal_title && (
                  <span className="text-[10px] text-[#b8922a] bg-[#faf3e0] px-2 py-0.5 rounded-full max-w-[140px] truncate">
                    🎯 {post.goal_title}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#999] mt-0.5">{timeAgo(post.created_at)}</p>
            </div>
            {/* Menu */}
            <div className="relative">
              <button onClick={() => setShowMenu(!showMenu)} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[#f0ede8] transition-colors text-[#999]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
              </button>
              {showMenu && (
                <div className="absolute right-0 top-8 bg-white border border-[#e8e8e8] rounded-xl shadow-lg z-20 min-w-[160px] overflow-hidden" onClick={() => setShowMenu(false)}>
                  {isOwn ? (
                    <button onClick={() => onDelete(post.id)} className="w-full text-left px-4 py-2.5 text-[13px] text-red-500 hover:bg-red-50 transition-colors">🗑 Delete post</button>
                  ) : (
                    <button onClick={() => setReport({ id: post.id, type: 'post' })} className="w-full text-left px-4 py-2.5 text-[13px] text-[#666] hover:bg-[#f8f7f5] transition-colors">🚩 Report post</button>
                  )}
                </div>
              )}
            </div>
          </div>
          <p className="text-[14px] text-[#111] leading-[1.7]">{post.content}</p>
        </div>

        {/* Actions bar */}
        <div className="px-5 py-2.5 border-t border-[#f0ede8] flex items-center gap-5">
          <button onClick={() => onLike(post)}
            className={`flex items-center gap-1.5 text-[13px] transition-colors ${post.user_liked ? 'text-red-500' : 'text-[#999] hover:text-red-400'}`}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill={post.user_liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            <span>{post.likes_count || ''}</span>
          </button>
          <button onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-1.5 text-[13px] text-[#999] hover:text-[#666] transition-colors">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span>{post.comment_count > 0 ? post.comment_count : ''}</span>
            <span>{showComments ? 'Hide' : 'Comment'}</span>
          </button>
        </div>

        {/* Comments */}
        {showComments && (
          <div className="border-t border-[#f0ede8] bg-[#fafaf9]">
            {(post.comments || []).length > 0 && (
              <div className="px-5 pt-3 pb-1 space-y-3">
                {(post.comments || []).map(c => (
                  <div key={c.id} className="flex gap-2.5">
                    <Avatar p={c.profiles} size={7}/>
                    <div className="flex-1 bg-white rounded-xl px-3 py-2 border border-[#e8e8e8]">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[12px] font-semibold text-[#111]">{c.profiles?.full_name}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] text-[#999]">{timeAgo(c.created_at)}</p>
                          {c.user_id === userId
                            ? <button onClick={() => onDeleteComment(c.id, post.id)} className="text-[#ccc] hover:text-red-400 text-[14px] leading-none transition-colors">×</button>
                            : <button onClick={() => setReport({ id: c.id, type: 'comment' })} className="text-[#ccc] hover:text-red-400 text-[10px] transition-colors">🚩</button>
                          }
                        </div>
                      </div>
                      <p className="text-[13px] text-[#444] mt-0.5 leading-[1.5]">{c.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {/* Comment input */}
            <div className="px-5 py-3 flex gap-2">
              <input value={commentText} onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleComment()}
                placeholder="Add a comment..." maxLength={300}
                className="flex-1 text-[13px] border border-[#e8e8e8] rounded-xl px-3.5 py-2 outline-none focus:border-[#111] bg-white"/>
              <button onClick={handleComment} disabled={!commentText.trim() || commenting}
                className="px-3 py-2 bg-[#111] text-white rounded-xl text-[12px] font-medium disabled:opacity-40 hover:bg-[#2a2a2a] transition-colors">
                {commenting ? '...' : 'Post'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function FeedPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [myProfile, setMyProfile] = useState<any>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [goals, setGoals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [posting, setPosting] = useState(false)
  const [showCompose, setShowCompose] = useState(false)
  const [content, setContent] = useState('')
  const [postType, setPostType] = useState('general')
  const [selectedGoalId, setSelectedGoalId] = useState('')
  const [pullStart, setPullStart] = useState(0)
  const [pullDist, setPullDist] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      if (!user) return
      const [{ data: prof }, { data: gs }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('goals').select('id, title').eq('user_id', user.id).eq('is_active', true).order('created_at', { ascending: false }),
      ])
      setMyProfile(prof)
      setGoals(gs || [])
      const savedGoal = localStorage.getItem('selectedGoalId')
      if (savedGoal) setSelectedGoalId(savedGoal)
      await loadFeed(user.id)
      setLoading(false)
    }
    load()
  }, [])

  const loadFeed = useCallback(async (userId?: string) => {
    const uid = userId || user?.id
    if (!uid) return
    const { data: friendships } = await supabase.from('friendships').select('requester, addressee').or(`requester.eq.${uid},addressee.eq.${uid}`).eq('status', 'accepted')
    const friendIds = (friendships || []).map((f: any) => f.requester === uid ? f.addressee : f.requester)
    const viewableIds = [uid, ...friendIds]

    const { data: feedPosts } = await supabase.from('feed_posts').select('*').in('user_id', viewableIds).order('created_at', { ascending: false }).limit(30)
    if (!feedPosts?.length) { setPosts([]); return }

    const postIds = feedPosts.map((p: any) => p.id)
    const uniqueUserIds = feedPosts.map((p: any) => p.user_id).filter((id: string, i: number, a: string[]) => a.indexOf(id) === i)

    const [{ data: profilesData }, { data: myLikes }, { data: allLikes }, { data: allComments }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, avatar_url, plan').in('id', uniqueUserIds),
      supabase.from('post_likes').select('post_id').eq('user_id', uid),
      supabase.from('post_likes').select('post_id').in('post_id', postIds),
      supabase.from('post_comments').select('*').in('post_id', postIds).order('created_at', { ascending: true }),
    ])

    const profileMap = Object.fromEntries((profilesData || []).map((p: any) => [p.id, p]))
    const likedIds = new Set((myLikes || []).map((l: any) => l.post_id))
    const likeCounts: Record<string, number> = {}
    ;(allLikes || []).forEach((l: any) => { likeCounts[l.post_id] = (likeCounts[l.post_id] || 0) + 1 })

    // Get profiles for comment authors
    const commentAuthorIds = (allComments || []).map((c: any) => c.user_id).filter((id: string, i: number, a: string[]) => a.indexOf(id) === i && !profileMap[id])
    if (commentAuthorIds.length) {
      const { data: extraProfiles } = await supabase.from('profiles').select('id, full_name, avatar_url, plan').in('id', commentAuthorIds)
      ;(extraProfiles || []).forEach((p: any) => { profileMap[p.id] = p })
    }

    const commentsByPost: Record<string, Comment[]> = {}
    ;(allComments || []).forEach((c: any) => {
      if (!commentsByPost[c.post_id]) commentsByPost[c.post_id] = []
      commentsByPost[c.post_id].push({ ...c, profiles: profileMap[c.user_id] })
    })

    setPosts(feedPosts.map((p: any) => ({
      ...p,
      profiles: profileMap[p.user_id] || null,
      likes_count: likeCounts[p.id] || 0,
      user_liked: likedIds.has(p.id),
      comments: commentsByPost[p.id] || [],
      comment_count: (commentsByPost[p.id] || []).length,
    })))
  }, [user])

  const refresh = async () => {
    setRefreshing(true)
    await loadFeed()
    setRefreshing(false)
    toast.success('Refreshed')
  }

  const submitPost = async () => {
    if (!content.trim() || posting) return
    setPosting(true)

    // AI moderation
    const modRes = await fetch('/api/moderate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: content }) })
    const mod = await modRes.json()
    if (!mod.safe) { toast.error(`Post blocked: ${mod.reason || 'inappropriate content'}`); setPosting(false); return }

    const selectedGoal = goals.find(g => g.id === selectedGoalId)
    const { data: newPost, error } = await supabase.from('feed_posts').insert({
      user_id: user.id,
      content: content.trim(),
      post_type: postType,
      goal_title: selectedGoal?.title || null,
      goal_id: selectedGoalId || null,
    }).select('*').single()

    if (error) { toast.error(error.message); setPosting(false); return }
    setPosts(prev => [{ ...newPost, profiles: myProfile, likes_count: 0, user_liked: false, comments: [], comment_count: 0 }, ...prev])
    setContent('')
    setShowCompose(false)
    toast.success('Posted!')
    setPosting(false)
  }

  const toggleLike = async (post: Post) => {
    if (!user) return
    if (post.user_liked) {
      await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', user.id)
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, likes_count: p.likes_count - 1, user_liked: false } : p))
    } else {
      await supabase.from('post_likes').insert({ post_id: post.id, user_id: user.id })
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, likes_count: p.likes_count + 1, user_liked: true } : p))
    }
  }

  const deletePost = async (postId: string) => {
    if (!confirm('Delete this post?')) return
    await supabase.from('feed_posts').delete().eq('id', postId).eq('user_id', user.id)
    setPosts(prev => prev.filter(p => p.id !== postId))
    toast.success('Deleted')
  }

  const addComment = async (postId: string, text: string) => {
    // AI moderation
    const modRes = await fetch('/api/moderate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) })
    const mod = await modRes.json()
    if (!mod.safe) { toast.error(`Comment blocked: ${mod.reason || 'inappropriate content'}`); return }

    const { data: comment, error } = await supabase.from('post_comments').insert({ post_id: postId, user_id: user.id, content: text }).select('*').single()
    if (error) { toast.error(error.message); return }
    const newComment = { ...comment, profiles: myProfile }
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: [...(p.comments || []), newComment], comment_count: p.comment_count + 1 } : p))
  }

  const deleteComment = async (commentId: string, postId: string) => {
    await supabase.from('post_comments').delete().eq('id', commentId).eq('user_id', user.id)
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: (p.comments || []).filter(c => c.id !== commentId), comment_count: Math.max(0, p.comment_count - 1) } : p))
    toast.success('Comment deleted')
  }

  // Pull to refresh
  const onTouchStart = (e: React.TouchEvent) => setPullStart(e.touches[0].clientY)
  const onTouchMove = (e: React.TouchEvent) => {
    if (scrollRef.current && scrollRef.current.scrollTop > 0) return
    setPullDist(Math.max(0, Math.min(80, e.touches[0].clientY - pullStart)))
  }
  const onTouchEnd = async () => { if (pullDist > 60) await refresh(); setPullDist(0) }

  return (
    <div className="fade-up max-w-[680px]">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-serif text-[32px] mb-0.5">Feed</h1>
          <p className="text-[14px] text-[#666]">Friends only · {posts.length} posts</p>
        </div>
        <div className="flex gap-2">
          <button onClick={refresh} disabled={refreshing}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-[#e8e8e8] rounded-xl text-[13px] text-[#666] hover:bg-[#f8f7f5] transition-colors disabled:opacity-50">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={refreshing ? 'spin-anim' : ''}><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            Refresh
          </button>
          <button onClick={() => setShowCompose(!showCompose)}
            className="px-4 py-2 bg-[#111] text-white rounded-xl text-[13px] font-medium hover:bg-[#2a2a2a] transition-colors">
            + Post
          </button>
        </div>
      </div>

      {pullDist > 10 && (
        <div className="flex justify-center mb-3" style={{ height: `${pullDist}px` }}>
          <p className="text-[12px] text-[#999] self-end">{pullDist > 60 ? '↑ Release' : '↓ Pull to refresh'}</p>
        </div>
      )}

      {/* Compose */}
      {showCompose && (
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 mb-5 shadow-sm">
          <div className="flex gap-3">
            <Avatar p={myProfile}/>
            <div className="flex-1">
              {/* Type selector */}
              <div className="flex gap-1.5 mb-3 flex-wrap">
                {POST_TYPES.map(t => (
                  <button key={t.v} onClick={() => setPostType(t.v)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${postType === t.v ? 'bg-[#111] text-white border-[#111]' : 'bg-white text-[#666] border-[#e8e8e8]'}`}>
                    {TYPE_CFG[t.v]?.emoji} {t.l}
                  </button>
                ))}
              </div>
              {/* Goal tag */}
              {goals.length > 0 && (
                <select value={selectedGoalId} onChange={e => setSelectedGoalId(e.target.value)}
                  className="w-full text-[12px] border border-[#e8e8e8] rounded-xl px-3 py-2 outline-none focus:border-[#111] mb-3 text-[#666]">
                  <option value="">🎯 Tag a goal (optional)</option>
                  {goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
                </select>
              )}
              <textarea value={content} onChange={e => setContent(e.target.value)}
                placeholder="Share your progress, how you're feeling, or an update with your friends..."
                className="w-full text-[14px] border border-[#e8e8e8] rounded-xl px-3.5 py-3 outline-none focus:border-[#111] resize-none leading-[1.6]"
                rows={3} maxLength={500}/>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-[#999]">{content.length}/500 · AI moderated</span>
                <div className="flex gap-2">
                  <button onClick={() => setShowCompose(false)} className="px-3 py-1.5 text-[12px] text-[#999]">Cancel</button>
                  <button onClick={submitPost} disabled={!content.trim() || posting}
                    className="px-4 py-1.5 bg-[#111] text-white rounded-lg text-[12px] font-medium disabled:opacity-40 hover:bg-[#2a2a2a] transition-colors">
                    {posting ? 'Checking...' : 'Post'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feed list */}
      <div ref={scrollRef} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="bg-white border border-[#e8e8e8] rounded-2xl p-5 animate-pulse">
                <div className="flex gap-3 mb-3"><div className="w-10 h-10 rounded-full bg-[#f0ede8]"/><div className="flex-1 space-y-2"><div className="h-3 bg-[#f0ede8] rounded w-1/3"/><div className="h-2 bg-[#f0ede8] rounded w-1/4"/></div></div>
                <div className="space-y-2"><div className="h-3 bg-[#f0ede8] rounded"/><div className="h-3 bg-[#f0ede8] rounded w-3/4"/></div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-[48px] mb-4">🌱</div>
            <p className="text-[16px] font-medium text-[#111] mb-2">Nothing yet</p>
            <p className="text-[14px] text-[#666] mb-6">Add friends and share your journey</p>
            <button onClick={() => setShowCompose(true)} className="px-5 py-2.5 bg-[#111] text-white rounded-xl text-[13px] font-medium">Make your first post</button>
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map(post => (
              <PostCard key={post.id} post={post} userId={user?.id}
                onLike={toggleLike} onDelete={deletePost}
                onComment={addComment} onDeleteComment={deleteComment}/>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
