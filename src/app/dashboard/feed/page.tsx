'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import MediaUploader from '@/components/dashboard/MediaUploader'

type Profile = { id: string; full_name: string; avatar_url: string; plan: string }
type Comment = { id: string; post_id: string; user_id: string; content: string; created_at: string; profiles?: Profile }
type Post = {
  id: string
  user_id: string
  content: string
  post_type: string
  visibility: string
  created_at: string
  profiles?: Profile
  likes_count: number
  user_liked: boolean
  goal_title?: string
  goal_id?: string
  comments?: Comment[]
  comment_count: number
  is_archived?: boolean
  relevance_score?: number
  media_url?: string | null
  media_type?: 'image' | 'video' | null
}

const TYPE_CFG: Record<string, { emoji: string; color: string; bg: string }> = {
  achievement: { emoji: 'ðŸ†', color: 'text-yellow-700', bg: 'bg-yellow-50' },
  checkin:     { emoji: 'âœ…', color: 'text-green-700',  bg: 'bg-green-50'  },
  goal_start:  { emoji: 'ðŸŽ¯', color: 'text-blue-700',   bg: 'bg-blue-50'   },
  feeling:     { emoji: 'ðŸ’­', color: 'text-purple-700', bg: 'bg-purple-50' },
  reward:      { emoji: 'â­', color: 'text-[#b8922a]',  bg: 'bg-[#faf3e0]' },
  milestone:   { emoji: 'ðŸš€', color: 'text-indigo-700', bg: 'bg-indigo-50' },
  general:     { emoji: 'ðŸ“', color: 'text-[#666]',     bg: 'bg-[#f8f7f5]' },
}
const POST_TYPES = [
  { v: 'general', l: 'General' }, { v: 'achievement', l: 'Achievement' },
  { v: 'checkin', l: 'Daily log' }, { v: 'feeling', l: 'Feeling' },
  { v: 'reward', l: 'Reward' }, { v: 'milestone', l: 'Milestone' },
]
const REPORT_REASONS = ['Inappropriate content', 'Spam', 'Harassment', 'False information', 'Hate speech', 'Off-topic', 'Other']

function timeAgo(d: string) {
  const s = (Date.now() - new Date(d).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s/60)}m`
  if (s < 86400) return `${Math.floor(s/3600)}h`
  return `${Math.floor(s/86400)}d`
}

function Avatar({ p, size = 10 }: { p: any; size?: number }) {
  const cls = `w-${size} h-${size} rounded-full flex-shrink-0`
  return p?.avatar_url
    ? <img src={p.avatar_url} alt="" className={`${cls} object-cover`}/>
    : <div className={`${cls} bg-[#b8922a] flex items-center justify-center text-white font-semibold text-[13px]`}>{p?.full_name?.[0]?.toUpperCase() || '?'}</div>
}

function ReportModal({ targetId, targetType, onClose }: { targetId: string; targetType: 'post'|'comment'; onClose: () => void }) {
  const supabase = createClient()
  const [reason, setReason] = useState('')
  const submit = async () => {
    if (!reason) return
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('content_reports').insert({ reporter_id: user?.id, target_id: targetId, target_type: targetType, reason })
    toast.success('Reported. Our team will review this.')
    onClose()
  }
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-[360px] p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="font-serif text-[18px] mb-3">Report {targetType}</h3>
        <div className="space-y-1.5 mb-4">
          {REPORT_REASONS.map(r => (
            <button key={r} onClick={() => setReason(r)}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl border text-[13px] transition-all ${reason === r ? 'bg-[#111] text-white border-[#111]' : 'border-[#e8e8e8] hover:border-[#d0d0d0]'}`}>{r}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 border border-[#e8e8e8] rounded-xl text-[13px]">Cancel</button>
          <button onClick={submit} disabled={!reason} className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-[13px] font-medium disabled:opacity-40">Report</button>
        </div>
      </div>
    </div>
  )
}

function PostCard({ post, userId, onLike, onDelete, onArchive, onComment, onDeleteComment, onBlock }: {
  post: Post; userId: string
  onLike: (p: Post) => void
  onDelete: (id: string) => void
  onArchive: (id: string, archive: boolean) => void
  onComment: (postId: string, text: string) => Promise<void>
  onDeleteComment: (commentId: string, postId: string) => void
  onBlock: (userId: string) => void
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

  const visibilityBadge = post.visibility === 'public' ? { label: 'ðŸŒ Public', cls: 'bg-blue-50 text-blue-700' } :
    post.visibility === 'private' ? { label: 'ðŸ”’ Only me', cls: 'bg-[#f2f0ec] text-[#666]' } :
    { label: 'ðŸ‘¥ Friends', cls: 'bg-green-50 text-green-700' }

  return (
    <>
      {report && <ReportModal targetId={report.id} targetType={report.type} onClose={() => setReport(null)}/>}
      <div className={`bg-white border border-[#e8e8e8] rounded-2xl overflow-hidden transition-all ${post.is_archived ? 'opacity-60' : 'hover:border-[#d0d0d0]'}`}>
        <div className="p-5 pb-3">
          <div className="flex gap-3 mb-3">
            <Avatar p={post.profiles}/>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[14px] font-semibold">{post.profiles?.full_name}</p>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${tc.bg} ${tc.color}`}>{tc.emoji} {POST_TYPES.find(t => t.v === post.post_type)?.l}</span>
                {post.goal_title && <span className="text-[10px] text-[#b8922a] bg-[#faf3e0] px-2 py-0.5 rounded-full max-w-[120px] truncate">ðŸŽ¯ {post.goal_title}</span>}
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${visibilityBadge.cls}`}>{visibilityBadge.label}</span>
                {post.is_archived && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#f2f0ec] text-[#999]">ðŸ“¦ Archived</span>}
              </div>
              <p className="text-[11px] text-[#999] mt-0.5">{timeAgo(post.created_at)}</p>
            </div>
            <div className="relative">
              <button onClick={() => setShowMenu(!showMenu)} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[#f0ede8] transition-colors text-[#999]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
              </button>
              {showMenu && (
                <div className="absolute right-0 top-8 bg-white border border-[#e8e8e8] rounded-xl shadow-lg z-20 min-w-[170px] overflow-hidden" onClick={() => setShowMenu(false)}>
                  {isOwn ? (
                    <>
                      <button onClick={() => onArchive(post.id, !post.is_archived)} className="w-full text-left px-4 py-2.5 text-[13px] text-[#666] hover:bg-[#f8f7f5]">
                        {post.is_archived ? 'ðŸ“¤ Unarchive' : 'ðŸ“¦ Archive'}
                      </button>
                      <button onClick={() => onDelete(post.id)} className="w-full text-left px-4 py-2.5 text-[13px] text-red-500 hover:bg-red-50">ðŸ—‘ Delete</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => setReport({ id: post.id, type: 'post' })} className="w-full text-left px-4 py-2.5 text-[13px] text-[#666] hover:bg-[#f8f7f5]">ðŸš© Report</button>
                      <button onClick={() => onBlock(post.user_id)} className="w-full text-left px-4 py-2.5 text-[13px] text-red-500 hover:bg-red-50">ðŸš« Block user</button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          <p className="text-[14px] text-[#111] leading-[1.7]">{post.content}</p>
          {post.media_url && (
            <div className="mt-3 rounded-xl overflow-hidden border border-[#f0ede8]">
              {post.media_type === 'video'
                ? <video src={post.media_url} controls className="w-full max-h-[480px] object-contain bg-black rounded-xl"/>
                : <img src={post.media_url} alt="" className="w-full max-h-[480px] object-contain bg-black/5 cursor-pointer rounded-xl" onClick={() => window.open(post.media_url, '_blank')}/>
              }
            </div>
          )}
        </div>

        <div className="px-5 py-2.5 border-t border-[#f0ede8] flex items-center gap-5">
          <button onClick={() => onLike(post)}
            className={`flex items-center gap-1.5 text-[13px] transition-colors ${post.user_liked ? 'text-red-500' : 'text-[#999] hover:text-red-400'}`}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill={post.user_liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            <span>{post.likes_count || ''}</span>
          </button>
          <button onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-1.5 text-[13px] text-[#999] hover:text-[#666] transition-colors">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span>{post.comment_count > 0 ? post.comment_count : ''} {showComments ? 'Hide' : 'Comment'}</span>
          </button>
        </div>

        {showComments && (
          <div className="border-t border-[#f0ede8] bg-[#fafaf9]">
            {(post.comments || []).length > 0 && (
              <div className="px-5 pt-3 pb-1 space-y-2.5">
                {(post.comments || []).map(c => (
                  <div key={c.id} className="flex gap-2.5">
                    <Avatar p={c.profiles} size={7}/>
                    <div className="flex-1 bg-white rounded-xl px-3 py-2 border border-[#e8e8e8]">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[12px] font-semibold">{c.profiles?.full_name}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] text-[#999]">{timeAgo(c.created_at)}</p>
                          {c.user_id === userId
                            ? <button onClick={() => onDeleteComment(c.id, post.id)} className="text-[#ccc] hover:text-red-400 text-[14px]">Ã—</button>
                            : <button onClick={() => setReport({ id: c.id, type: 'comment' })} className="text-[10px] text-[#ccc] hover:text-red-400">ðŸš©</button>
                          }
                        </div>
                      </div>
                      <p className="text-[13px] text-[#444] mt-0.5 leading-[1.5]">{c.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="px-5 py-3 flex gap-2">
              <input value={commentText} onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleComment()}
                placeholder="Add a comment..." maxLength={300}
                className="flex-1 text-[13px] border border-[#e8e8e8] rounded-xl px-3.5 py-2 outline-none focus:border-[#111] bg-white"/>
              <button onClick={handleComment} disabled={!commentText.trim() || commenting}
                className="px-3 py-2 bg-[#111] text-white rounded-xl text-[12px] font-medium disabled:opacity-40">
                {commenting ? '...' : 'Post'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

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
  const [visibility, setVisibility] = useState<'public'|'friends'|'private'>('friends')
  const [mediaUrl, setMediaUrl] = useState('')
  const [mediaType, setMediaType] = useState<'image'|'video'|undefined>()
  const [selectedGoalId, setSelectedGoalId] = useState('')
  const [feedFilter, setFeedFilter] = useState<'all'|'friends'|'public'>('all')
  const [showArchived, setShowArchived] = useState(false)
  const [archivedPosts, setArchivedPosts] = useState<Post[]>([])
  const [loadingArchived, setLoadingArchived] = useState(false)
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
        supabase.from('goals').select('id, title').eq('user_id', user.id).eq('is_active', true),
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

    // Get blocked users
    const { data: blocks } = await supabase.from('blocked_users').select('blocked_id').eq('blocker_id', uid)
    const blockedIds = new Set((blocks || []).map((b: any) => b.blocked_id))

    // Get friends
    const { data: friendships } = await supabase.from('friendships').select('requester, addressee').or(`requester.eq.${uid},addressee.eq.${uid}`).eq('status', 'accepted')
    const friendIds = (friendships || []).map((f: any) => f.requester === uid ? f.addressee : f.requester).filter((id: string) => !blockedIds.has(id))

    // Fetch my posts + friends posts + public posts
    const { data: myPosts } = await supabase.from('feed_posts').select('*').eq('user_id', uid).eq('is_archived', false).order('created_at', { ascending: false }).limit(20)
    const { data: friendPosts } = friendIds.length
      ? await supabase.from('feed_posts').select('*').in('user_id', friendIds).in('visibility', ['friends', 'public']).eq('is_archived', false).order('created_at', { ascending: false }).limit(20)
      : { data: [] }
    const { data: publicPosts } = await supabase.from('feed_posts').select('*').eq('visibility', 'public').eq('is_archived', false).not('user_id', 'in', `(${[uid, ...friendIds].join(',')})`).order('created_at', { ascending: false }).limit(10)

    // Merge and deduplicate
    const allPostsRaw = [...(myPosts || []), ...(friendPosts || []), ...(publicPosts || [])]
    const seen = new Set<string>()
    const allPosts = allPostsRaw.filter((p: any) => { if (seen.has(p.id)) return false; seen.add(p.id); return true })

    if (!allPosts.length) { setPosts([]); return }

    // Get my goals for relevance scoring
    const { data: myGoals } = await supabase.from('goals').select('title, category').eq('user_id', uid).eq('is_active', true)
    const myCategories = (myGoals || []).map((g: any) => g.category).filter(Boolean)

    // Score posts for relevance
    const now = Date.now()
    const scoredPosts = allPosts.map((p: any) => {
      let score = 0
      const ageHours = (now - new Date(p.created_at).getTime()) / 3600000
      score += Math.max(0, 100 - ageHours * 2) // recency
      if (p.user_id === uid) score += 20 // own posts
      if (friendIds.includes(p.user_id)) score += 15 // friends
      if (['achievement', 'milestone', 'reward'].includes(p.post_type)) score += 10 // high-value types
      if (p.goal_title && myGoals?.some((g: any) => g.title === p.goal_title)) score += 25 // same goal
      return { ...p, relevance_score: score }
    })

    // Sort by relevance
    scoredPosts.sort((a: any, b: any) => b.relevance_score - a.relevance_score)

    // Fetch profiles for all unique users
    const uniqueUserIds = scoredPosts.map((p: any) => p.user_id).filter((id: string, i: number, a: string[]) => a.indexOf(id) === i)
    const postIds = scoredPosts.map((p: any) => p.id)

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

    // Add comment author profiles
    const commentAuthorIds = (allComments || []).map((c: any) => c.user_id).filter((id: string, i: number, a: string[]) => a.indexOf(id) === i && !profileMap[id])
    if (commentAuthorIds.length) {
      const { data: extras } = await supabase.from('profiles').select('id, full_name, avatar_url, plan').in('id', commentAuthorIds)
      ;(extras || []).forEach((p: any) => { profileMap[p.id] = p })
    }

    const commentsByPost: Record<string, Comment[]> = {}
    ;(allComments || []).forEach((c: any) => {
      if (!commentsByPost[c.post_id]) commentsByPost[c.post_id] = []
      commentsByPost[c.post_id].push({ ...c, profiles: profileMap[c.user_id] })
    })

    setPosts(scoredPosts.map((p: any) => ({
      ...p,
      profiles: profileMap[p.user_id] || null,
      likes_count: likeCounts[p.id] || 0,
      user_liked: likedIds.has(p.id),
      comments: commentsByPost[p.id] || [],
      comment_count: (commentsByPost[p.id] || []).length,
    })))
  }, [user])

  const loadArchivedPosts = useCallback(async () => {
    if (!user) return
    setLoadingArchived(true)
    const { data: archived } = await supabase.from('feed_posts').select('*').eq('user_id', user.id).eq('is_archived', true).order('created_at', { ascending: false }).limit(20)
    if (!archived?.length) { setArchivedPosts([]); setLoadingArchived(false); return }
    const postIds = archived.map((p: any) => p.id)
    const { data: myLikes } = await supabase.from('post_likes').select('post_id').eq('user_id', user.id)
    const likedIds = new Set((myLikes || []).map((l: any) => l.post_id))
    const { data: allLikes } = await supabase.from('post_likes').select('post_id').in('post_id', postIds)
    const likeCounts: Record<string, number> = {}
    ;(allLikes || []).forEach((l: any) => { likeCounts[l.post_id] = (likeCounts[l.post_id] || 0) + 1 })
    const { data: prof } = await supabase.from('profiles').select('id, full_name, avatar_url, plan').eq('id', user.id).single()
    setArchivedPosts(archived.map((p: any) => ({ ...p, profiles: prof, likes_count: likeCounts[p.id] || 0, user_liked: likedIds.has(p.id), comments: [], comment_count: 0 })))
    setLoadingArchived(false)
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
    const modRes = await fetch('/api/moderate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: content }) })
    const mod = await modRes.json()
    if (!mod.safe) { toast.error(`Post blocked: ${mod.reason || 'inappropriate content'}`); setPosting(false); return }
    const selectedGoal = goals.find(g => g.id === selectedGoalId)
    const { data: newPost, error } = await supabase.from('feed_posts').insert({
      user_id: user.id, content: content.trim(), post_type: postType,
      visibility, goal_title: selectedGoal?.title || null, goal_id: selectedGoalId || null,
      media_url: mediaUrl || null, media_type: mediaType || null,
    }).select('*').single()
    if (error) { toast.error(error.message); setPosting(false); return }
    setPosts(prev => [{ ...newPost, profiles: myProfile, likes_count: 0, user_liked: false, comments: [], comment_count: 0, relevance_score: 999 }, ...prev])
    setContent(''); setMediaUrl(''); setMediaType(undefined); setShowCompose(false)
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

  const archivePost = async (postId: string, archive: boolean) => {
    await supabase.from('feed_posts').update({ is_archived: archive }).eq('id', postId).eq('user_id', user.id)
    if (archive) {
      // Move from feed to archived
      const post = posts.find(p => p.id === postId)
      if (post) setArchivedPosts(prev => [{ ...post, is_archived: true }, ...prev])
      setPosts(prev => prev.filter(p => p.id !== postId))
    } else {
      // Move from archived back to feed and switch to feed tab
      const post = archivedPosts.find(p => p.id === postId)
      if (post) setPosts(prev => [{ ...post, is_archived: false }, ...prev])
      setArchivedPosts(prev => prev.filter(p => p.id !== postId))
      setShowArchived(false) // auto-switch to feed so user sees restored post
      toast.success('Post restored to your feed âœ“')
      return
    }
    toast.success(archive ? 'Archived' : 'Unarchived')
  }

  const blockUser = async (blockedId: string) => {
    if (!confirm('Block this user? Their posts will be hidden from your feed.')) return
    await supabase.from('blocked_users').insert({ blocker_id: user.id, blocked_id: blockedId })
    setPosts(prev => prev.filter(p => p.user_id !== blockedId))
    toast.success('User blocked')
  }

  const addComment = async (postId: string, text: string) => {
    const modRes = await fetch('/api/moderate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) })
    const mod = await modRes.json()
    if (!mod.safe) { toast.error(`Comment blocked: ${mod.reason}`); return }
    const { data: comment, error } = await supabase.from('post_comments').insert({ post_id: postId, user_id: user.id, content: text }).select('*').single()
    if (error) { toast.error(error.message); return }
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: [...(p.comments || []), { ...comment, profiles: myProfile }], comment_count: p.comment_count + 1 } : p))
  }

  const deleteComment = async (commentId: string, postId: string) => {
    await supabase.from('post_comments').delete().eq('id', commentId).eq('user_id', user.id)
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: (p.comments || []).filter(c => c.id !== commentId), comment_count: Math.max(0, p.comment_count - 1) } : p))
  }

  const onTouchStart = (e: React.TouchEvent) => setPullStart(e.touches[0].clientY)
  const onTouchMove = (e: React.TouchEvent) => { if (scrollRef.current?.scrollTop === 0) setPullDist(Math.max(0, Math.min(80, e.touches[0].clientY - pullStart))) }
  const onTouchEnd = async () => { if (pullDist > 60) await refresh(); setPullDist(0) }

  const filteredPosts = showArchived
    ? archivedPosts
    : posts.filter(p => {
        if (feedFilter === 'public') return p.visibility === 'public'
        if (feedFilter === 'friends') return p.user_id === user?.id || p.visibility !== 'public'
        return true
      })

  return (
    <div className="fade-up max-w-[680px]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-serif text-[32px] mb-0.5">Feed</h1>
          <p className="text-[13px] text-[#999]">{posts.length} posts Â· ranked by relevance</p>
        </div>
        <div className="flex gap-2">
          <button onClick={refresh} disabled={refreshing} className="flex items-center gap-1.5 px-3.5 py-2 border border-[#e8e8e8] rounded-xl text-[13px] text-[#666] hover:bg-[#f8f7f5] transition-colors disabled:opacity-50">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={refreshing ? 'spin-anim' : ''}><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            Refresh
          </button>
          <button onClick={() => setShowCompose(!showCompose)} className="px-4 py-2 bg-[#111] text-white rounded-xl text-[13px] font-medium hover:bg-[#2a2a2a] transition-colors">
            + Post
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {([['all', 'âœ¦ For you'], ['friends', 'ðŸ‘¥ Friends'], ['public', 'ðŸŒ Public']] as const).map(([val, label]) => (
          <button key={val} onClick={() => setFeedFilter(val)}
            className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium border transition-all ${feedFilter === val ? 'bg-[#111] text-white border-[#111]' : 'bg-white text-[#666] border-[#e8e8e8]'}`}>
            {label}
          </button>
        ))}
        <button onClick={() => { setShowArchived(prev => { if (!prev) loadArchivedPosts(); return !prev }) }}
          className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium border transition-all ${showArchived ? 'bg-[#b8922a] text-white border-[#b8922a]' : 'bg-white text-[#666] border-[#e8e8e8]'}`}>
          ðŸ“¦ Archived
        </button>
      </div>

      {pullDist > 10 && (
        <div className="flex justify-center mb-3" style={{ height: `${pullDist}px` }}>
          <p className="text-[12px] text-[#999] self-end">{pullDist > 60 ? 'â†‘ Release' : 'â†“ Pull to refresh'}</p>
        </div>
      )}

      {/* Compose */}
      {showCompose && (
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 mb-4 shadow-sm">
          <div className="flex gap-3">
            <Avatar p={myProfile}/>
            <div className="flex-1">
              <div className="flex gap-1.5 mb-2 flex-wrap">
                {POST_TYPES.map(t => (
                  <button key={t.v} onClick={() => setPostType(t.v)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${postType === t.v ? 'bg-[#111] text-white border-[#111]' : 'bg-white text-[#666] border-[#e8e8e8]'}`}>
                    {TYPE_CFG[t.v]?.emoji} {t.l}
                  </button>
                ))}
              </div>
              {/* Visibility selector */}
              <div className="flex gap-2 mb-2">
                {(['friends', 'public', 'private'] as const).map(v => (
                  <button key={v} onClick={() => setVisibility(v)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-medium border transition-all ${visibility === v ? 'bg-[#b8922a] text-white border-[#b8922a]' : 'bg-white text-[#666] border-[#e8e8e8]'}`}>
                    {v === 'public' ? 'ðŸŒ Public' : v === 'private' ? 'ðŸ”’ Only me' : 'ðŸ‘¥ Friends'}
                  </button>
                ))}
              </div>
              {goals.length > 0 && (
                <select value={selectedGoalId} onChange={e => setSelectedGoalId(e.target.value)}
                  className="w-full text-[12px] border border-[#e8e8e8] rounded-xl px-3 py-2 outline-none focus:border-[#111] mb-2 text-[#666]">
                  <option value="">ðŸŽ¯ Tag a goal (optional)</option>
                  {goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
                </select>
              )}
              <textarea value={content} onChange={e => setContent(e.target.value)}
                placeholder="Share your progress, how you're feeling, or a win..."
                className="w-full text-[14px] border border-[#e8e8e8] rounded-xl px-3.5 py-3 outline-none focus:border-[#111] resize-none leading-[1.6]"
                rows={3} maxLength={500}/>
              <MediaUploader
                onUpload={(url, type) => { setMediaUrl(url); setMediaType(type) }}
                onClear={() => { setMediaUrl(''); setMediaType(undefined) }}
                mediaUrl={mediaUrl} mediaType={mediaType} context="post"
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-[#999]">{content.length}/500 Â· AI moderated</span>
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

      {/* Feed */}
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
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-14">
            <div className="text-[48px] mb-3">ðŸŒ±</div>
            <p className="text-[15px] font-medium mb-2">Nothing here yet</p>
            <p className="text-[13px] text-[#666] mb-5">Add friends or make your first post</p>
            <button onClick={() => setShowCompose(true)} className="px-5 py-2.5 bg-[#111] text-white rounded-xl text-[13px] font-medium">Make a post</button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPosts.map(post => (
              <PostCard key={post.id} post={post} userId={user?.id}
                onLike={toggleLike} onDelete={deletePost} onArchive={archivePost}
                onComment={addComment} onDeleteComment={deleteComment} onBlock={blockUser}/>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}