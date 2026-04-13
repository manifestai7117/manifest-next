'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

type Post = {
  id: string
  user_id: string
  content: string
  post_type: string
  created_at: string
  profiles: { full_name: string; avatar_url: string; plan: string }
  likes_count: number
  user_liked: boolean
  goal_title?: string
}

const POST_TYPE_CONFIG: Record<string, { emoji: string; color: string; bg: string }> = {
  achievement: { emoji: '🏆', color: 'text-yellow-700', bg: 'bg-yellow-50' },
  checkin:     { emoji: '✅', color: 'text-green-700',  bg: 'bg-green-50'  },
  goal_start:  { emoji: '🎯', color: 'text-blue-700',   bg: 'bg-blue-50'   },
  feeling:     { emoji: '💭', color: 'text-purple-700', bg: 'bg-purple-50' },
  reward:      { emoji: '⭐', color: 'text-[#b8922a]',  bg: 'bg-[#faf3e0]' },
  milestone:   { emoji: '🚀', color: 'text-indigo-700', bg: 'bg-indigo-50' },
  general:     { emoji: '📝', color: 'text-[#666]',     bg: 'bg-[#f8f7f5]' },
}

const POST_TYPES = [
  { value: 'achievement', label: 'Achievement' },
  { value: 'checkin',     label: 'Daily log' },
  { value: 'goal_start',  label: 'New goal' },
  { value: 'feeling',     label: 'Feeling' },
  { value: 'reward',      label: 'Reward earned' },
  { value: 'milestone',   label: 'Milestone' },
  { value: 'general',     label: 'General' },
]

function timeAgo(date: string) {
  const diff = (Date.now() - new Date(date).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function FeedPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [posting, setPosting] = useState(false)
  const [showCompose, setShowCompose] = useState(false)
  const [content, setContent] = useState('')
  const [postType, setPostType] = useState('general')
  const [pullStart, setPullStart] = useState(0)
  const [pullDist, setPullDist] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      if (user) await loadFeed(user.id)
      setLoading(false)
    }
    load()
  }, [])

  const loadFeed = useCallback(async (userId?: string) => {
    const uid = userId || user?.id
    if (!uid) return

    // Get friend IDs
    const { data: friendships } = await supabase
      .from('friendships')
      .select('requester, addressee')
      .or(`requester.eq.${uid},addressee.eq.${uid}`)
      .eq('status', 'accepted')

    const friendIds = (friendships || []).map((f: any) => f.requester === uid ? f.addressee : f.requester)
    const viewableIds = [uid, ...friendIds]

    const { data: feedPosts } = await supabase
      .from('feed_posts')
      .select('*')
      .in('user_id', viewableIds)
      .order('created_at', { ascending: false })
      .limit(30)

    if (!feedPosts) { setPosts([]); return }

    // Fetch profiles separately
    const uniqueUserIds = [...new Set(feedPosts.map((p: any) => p.user_id))]
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, plan')
      .in('id', uniqueUserIds)
    const profileMap = Object.fromEntries((profilesData || []).map((p: any) => [p.id, p]))

    // Get likes
    const { data: myLikes } = await supabase
      .from('post_likes')
      .select('post_id')
      .eq('user_id', uid)

    const likedIds = new Set((myLikes || []).map((l: any) => l.post_id))

    const { data: likeCounts } = await supabase
      .from('post_likes')
      .select('post_id')

    const countMap: Record<string, number> = {}
    ;(likeCounts || []).forEach((l: any) => { countMap[l.post_id] = (countMap[l.post_id] || 0) + 1 })

    setPosts(feedPosts.map((p: any) => ({
      ...p,
      profiles: profileMap[p.user_id] || null,
      likes_count: countMap[p.id] || 0,
      user_liked: likedIds.has(p.id),
    })))
  }, [user])

  const refresh = async () => {
    setRefreshing(true)
    await loadFeed()
    setRefreshing(false)
    toast.success('Feed refreshed')
  }

  const submitPost = async () => {
    if (!content.trim() || posting) return
    setPosting(true)
    const { data: goal } = await supabase.from('goals').select('title').eq('user_id', user.id).eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle()

    const { data: newPost, error } = await supabase.from('feed_posts').insert({
      user_id: user.id,
      content: content.trim(),
      post_type: postType,
      goal_title: goal?.title || null,
    }).select('*').single()

    if (error) { toast.error(error.message || 'Could not post'); console.error('Feed post error:', error); setPosting(false); return }
    const { data: myProfile } = await supabase.from('profiles').select('id, full_name, avatar_url, plan').eq('id', user.id).single()
    setPosts(prev => [{ ...newPost, profiles: myProfile, likes_count: 0, user_liked: false }, ...prev])
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
    await supabase.from('feed_posts').delete().eq('id', postId)
    setPosts(prev => prev.filter(p => p.id !== postId))
    toast.success('Post deleted')
  }

  // Pull to refresh
  const handleTouchStart = (e: React.TouchEvent) => setPullStart(e.touches[0].clientY)
  const handleTouchMove = (e: React.TouchEvent) => {
    const el = scrollRef.current
    if (!el || el.scrollTop > 0) return
    const dist = Math.max(0, Math.min(80, e.touches[0].clientY - pullStart))
    setPullDist(dist)
  }
  const handleTouchEnd = async () => {
    if (pullDist > 60) await refresh()
    setPullDist(0)
  }

  const avatarEl = (profile: any, size = 10) => (
    profile?.avatar_url
      ? <img src={profile.avatar_url} alt="" className={`w-${size} h-${size} rounded-full object-cover flex-shrink-0`}/>
      : <div className={`w-${size} h-${size} rounded-full flex items-center justify-center text-white text-[13px] font-semibold flex-shrink-0 bg-[#b8922a]`}>
          {profile?.full_name?.[0]?.toUpperCase() || '?'}
        </div>
  )

  return (
    <div className="fade-up max-w-[680px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-serif text-[32px] mb-0.5">Feed</h1>
          <p className="text-[14px] text-[#666]">What your friends are achieving</p>
        </div>
        <div className="flex gap-2">
          <button onClick={refresh} disabled={refreshing}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-[#e8e8e8] rounded-xl text-[13px] text-[#666] hover:bg-[#f8f7f5] transition-colors disabled:opacity-50">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={refreshing ? 'spin-anim' : ''}><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button onClick={() => setShowCompose(!showCompose)}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#111] text-white rounded-xl text-[13px] font-medium hover:bg-[#2a2a2a] transition-colors">
            + Post
          </button>
        </div>
      </div>

      {/* Pull to refresh indicator */}
      {pullDist > 10 && (
        <div className="flex justify-center mb-3 transition-all" style={{ height: `${pullDist}px` }}>
          <div className="flex items-center gap-2 text-[12px] text-[#999]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: `rotate(${(pullDist / 80) * 360}deg)` }}><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            {pullDist > 60 ? 'Release to refresh' : 'Pull to refresh'}
          </div>
        </div>
      )}

      {/* Compose */}
      {showCompose && (
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 mb-5 shadow-sm">
          <div className="flex gap-3 mb-3">
            {avatarEl(user?.user_metadata)}
            <div className="flex-1">
              <div className="flex gap-2 mb-2 flex-wrap">
                {POST_TYPES.map(t => (
                  <button key={t.value} onClick={() => setPostType(t.value)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${postType === t.value ? 'bg-[#111] text-white border-[#111]' : 'bg-white text-[#666] border-[#e8e8e8]'}`}>
                    {POST_TYPE_CONFIG[t.value].emoji} {t.label}
                  </button>
                ))}
              </div>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Share an achievement, how you're feeling, or an update..."
                className="w-full text-[14px] border border-[#e8e8e8] rounded-xl px-3.5 py-3 outline-none focus:border-[#111] resize-none leading-[1.6]"
                rows={3}
                maxLength={500}
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-[#999]">{content.length}/500</span>
                <div className="flex gap-2">
                  <button onClick={() => setShowCompose(false)} className="px-3 py-1.5 text-[12px] text-[#999] hover:text-[#666] transition-colors">Cancel</button>
                  <button onClick={submitPost} disabled={!content.trim() || posting}
                    className="px-4 py-1.5 bg-[#111] text-white rounded-lg text-[12px] font-medium disabled:opacity-40 hover:bg-[#2a2a2a] transition-colors">
                    {posting ? 'Posting...' : 'Post'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feed */}
      <div ref={scrollRef} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
        {loading ? (
          <div className="space-y-4">
            {[1,2,3].map(i => (
              <div key={i} className="bg-white border border-[#e8e8e8] rounded-2xl p-5 animate-pulse">
                <div className="flex gap-3 mb-3"><div className="w-10 h-10 rounded-full bg-[#f0ede8]"/><div className="flex-1"><div className="h-3 bg-[#f0ede8] rounded w-1/3 mb-2"/><div className="h-2 bg-[#f0ede8] rounded w-1/4"/></div></div>
                <div className="h-3 bg-[#f0ede8] rounded mb-2"/><div className="h-3 bg-[#f0ede8] rounded w-3/4"/>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16 text-[#999]">
            <div className="text-[48px] mb-4">🌱</div>
            <p className="text-[16px] font-medium mb-2">Nothing yet</p>
            <p className="text-[14px] mb-6">Add friends and start posting your journey</p>
            <button onClick={() => setShowCompose(true)} className="px-5 py-2.5 bg-[#111] text-white rounded-xl text-[13px] font-medium">Make your first post</button>
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map(post => {
              const typeConf = POST_TYPE_CONFIG[post.post_type] || POST_TYPE_CONFIG.general
              const isOwn = post.user_id === user?.id
              return (
                <div key={post.id} className="bg-white border border-[#e8e8e8] rounded-2xl p-5 hover:border-[#d0d0d0] transition-all">
                  <div className="flex gap-3 mb-3">
                    {avatarEl(post.profiles)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[14px] font-medium">{post.profiles?.full_name}</p>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${typeConf.bg} ${typeConf.color}`}>
                          {typeConf.emoji} {POST_TYPES.find(t => t.value === post.post_type)?.label}
                        </span>
                        {post.goal_title && (
                          <span className="text-[10px] text-[#b8922a] bg-[#faf3e0] px-2 py-0.5 rounded-full truncate max-w-[120px]">
                            🎯 {post.goal_title}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#999]">{timeAgo(post.created_at)}</p>
                    </div>
                    {isOwn && (
                      <button onClick={() => deletePost(post.id)} className="text-[#ccc] hover:text-red-400 transition-colors text-[18px] leading-none flex-shrink-0">×</button>
                    )}
                  </div>
                  <p className="text-[14px] text-[#111] leading-[1.65] mb-3">{post.content}</p>
                  <div className="flex items-center gap-4 pt-2 border-t border-[#f0ede8]">
                    <button onClick={() => toggleLike(post)}
                      className={`flex items-center gap-1.5 text-[13px] transition-colors ${post.user_liked ? 'text-red-500' : 'text-[#999] hover:text-red-400'}`}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill={post.user_liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                      {post.likes_count > 0 && <span>{post.likes_count}</span>}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}