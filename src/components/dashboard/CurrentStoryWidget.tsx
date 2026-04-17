// ================================================================
// PATCH for: src/app/dashboard/goal/page.tsx
// Add a "Current Story" section to the goal detail view.
// Find the section that shows goal actions/details and add this block.
// ================================================================

// 1. Add state near the top of the GoalPage component:
const [currentStory, setCurrentStory] = useState('')
const [savingStory, setSavingStory] = useState(false)
const [storyLoaded, setStoryLoaded] = useState(false)

// 2. When the selected goal loads, populate currentStory:
//    Inside your loadGoal / useEffect where you setSelectedGoal:
//    setCurrentStory(goal?.current_story || '')
//    setStoryLoaded(true)

// 3. Add this save function:
const saveCurrentStory = async () => {
  if (!selectedGoal || savingStory) return
  setSavingStory(true)
  await supabase.from('goals').update({ current_story: currentStory.trim() }).eq('id', selectedGoal.id)
  setSelectedGoal((prev: any) => ({ ...prev, current_story: currentStory.trim() }))
  toast.success('Story saved — your coach will use this context')
  setSavingStory(false)
}

// 4. Add this JSX block in the goal detail view, 
//    AFTER the phases/milestones section and BEFORE the coach opening:

/*
<div className="bg-white border border-[#e8e8e8] rounded-2xl p-5 mt-4">
  <div className="flex items-start justify-between mb-1">
    <div>
      <p className="font-medium text-[15px]">Your current story</p>
      <p className="text-[12px] text-[#999] mt-0.5">
        Tell your coach where you're at right now — your AI coach, daily tasks, and phases all read this.
      </p>
    </div>
  </div>
  <textarea
    value={currentStory}
    onChange={e => setCurrentStory(e.target.value)}
    placeholder="e.g. I've been consistent this week but struggling with the 6am sessions. Work has been intense. Feel like I'm at about 70% capacity right now. Need to figure out a better morning routine..."
    className="w-full mt-3 px-3.5 py-3 border border-[#e8e8e8] rounded-xl text-[14px] outline-none focus:border-[#111] transition-colors resize-none text-[#333] leading-[1.6]"
    rows={4}
    maxLength={1000}
  />
  <div className="flex items-center justify-between mt-2">
    <p className="text-[11px] text-[#bbb]">{currentStory.length}/1000</p>
    <button
      onClick={saveCurrentStory}
      disabled={savingStory || currentStory === (selectedGoal?.current_story || '')}
      className="px-4 py-2 bg-[#111] text-white rounded-xl text-[12px] font-medium hover:bg-[#2a2a2a] transition-colors disabled:opacity-40"
    >
      {savingStory ? 'Saving...' : 'Save story'}
    </button>
  </div>
</div>
*/

// ================================================================
// ALTERNATIVELY — here is a complete self-contained CurrentStoryWidget
// component you can drop anywhere on the goal page:
// ================================================================

'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

interface Props {
  goal: any
  onUpdate?: (story: string) => void
}

export default function CurrentStoryWidget({ goal, onUpdate }: Props) {
  const supabase = createClient()
  const [story, setStory] = useState(goal?.current_story || '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (saving) return
    setSaving(true)
    const { error } = await supabase
      .from('goals')
      .update({ current_story: story.trim() })
      .eq('id', goal.id)
    setSaving(false)
    if (error) { toast.error('Could not save'); return }
    toast.success('Story saved — your coach will use this')
    onUpdate?.(story.trim())
  }

  const changed = story !== (goal?.current_story || '')

  return (
    <div className="bg-white border border-[#e8e8e8] rounded-2xl p-5">
      <div className="mb-3">
        <p className="font-medium text-[15px]">Your current story</p>
        <p className="text-[12px] text-[#999] mt-1 leading-[1.5]">
          Where are you at right now with this goal? Your AI coach, daily tasks, and phase coaching all read this to personalise your experience.
        </p>
      </div>
      <textarea
        value={story}
        onChange={e => setStory(e.target.value)}
        placeholder="e.g. I've been consistent this week but struggling with early mornings. Work has been intense. At about 70% capacity. Need to figure out a better routine..."
        className="w-full px-3.5 py-3 border border-[#e8e8e8] rounded-xl text-[14px] outline-none focus:border-[#111] transition-colors resize-none text-[#333] leading-[1.6]"
        rows={4}
        maxLength={1000}
      />
      <div className="flex items-center justify-between mt-2">
        <p className="text-[11px] text-[#bbb]">{story.length}/1000</p>
        <button
          onClick={save}
          disabled={saving || !changed}
          className="px-4 py-2 bg-[#111] text-white rounded-xl text-[12px] font-medium hover:bg-[#2a2a2a] transition-colors disabled:opacity-40"
        >
          {saving ? 'Saving...' : 'Save story'}
        </button>
      </div>
    </div>
  )
}