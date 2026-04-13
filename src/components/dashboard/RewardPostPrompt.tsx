'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

interface Props {
  reward: { type: string; title: string; description: string; emoji: string }
  goalTitle: string
  onDismiss: () => void
}

export default function RewardPostPrompt({ reward, goalTitle, onDismiss }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [posting, setPosting] = useState(false)
  const [aiContent, setAiContent] = useState('')
  const [generated, setGenerated] = useState(false)

  const generatePost = async () => {
    setPosting(true)
    try {
      const res = await fetch('/api/generate-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rewardTitle: reward.title, rewardEmoji: reward.emoji, goalTitle, rewardDescription: reward.description }),
      })
      const data = await res.json()
      setAiContent(data.content || `Just earned the ${reward.emoji} ${reward.title} badge for "${goalTitle}"! ${reward.description}. Consistency is everything. 💪`)
      setGenerated(true)
    } catch {
      setAiContent(`Just earned the ${reward.emoji} ${reward.title} badge for "${goalTitle}"! ${reward.description}. Consistency is everything. 💪`)
      setGenerated(true)
    }
    setPosting(false)
  }

  const sharePost = async () => {
    if (!aiContent) return
    setPosting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('feed_posts').insert({
      user_id: user.id, content: aiContent, post_type: 'reward', goal_title: goalTitle,
    })
    toast.success('Shared to your feed! 🎉')
    onDismiss()
    router.push('/dashboard/feed')
    setPosting(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-[420px] overflow-hidden shadow-2xl">
        <div className="bg-gradient-to-br from-[#b8922a] to-[#9a7820] p-6 text-center">
          <div className="text-[56px] mb-2">{reward.emoji}</div>
          <p className="font-serif text-[22px] text-white mb-1">{reward.title}</p>
          <p className="text-white/70 text-[13px]">{reward.description}</p>
        </div>
        <div className="p-6">
          <p className="font-medium text-[15px] mb-1">Share your achievement!</p>
          <p className="text-[13px] text-[#666] mb-4">Let your friends know about this milestone. We've written a post for you.</p>

          {!generated ? (
            <button onClick={generatePost} disabled={posting}
              className="w-full py-3 bg-[#b8922a] text-white rounded-xl text-[13px] font-medium hover:bg-[#9a7820] transition-colors disabled:opacity-50 mb-3">
              {posting ? 'Generating...' : '✦ Generate my post'}
            </button>
          ) : (
            <>
              <textarea value={aiContent} onChange={e => setAiContent(e.target.value)}
                className="w-full text-[14px] border border-[#e8e8e8] rounded-xl px-3.5 py-3 outline-none focus:border-[#111] resize-none leading-[1.6] mb-3"
                rows={3} maxLength={500}/>
              <button onClick={sharePost} disabled={posting}
                className="w-full py-3 bg-[#111] text-white rounded-xl text-[13px] font-medium hover:bg-[#2a2a2a] transition-colors disabled:opacity-50 mb-2">
                {posting ? 'Sharing...' : '🚀 Share to feed'}
              </button>
            </>
          )}
          <button onClick={onDismiss} className="w-full py-2.5 text-[13px] text-[#999] hover:text-[#666] transition-colors">
            Maybe later
          </button>
        </div>
      </div>
    </div>
  )
}
