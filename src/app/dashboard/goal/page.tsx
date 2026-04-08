'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'

const TIMELINES = ['1 week','2 weeks','1 month','6 weeks','2 months','3 months','6 months','1 year','2 years']

export default function GoalPage() {
  const supabase = createClient()
  const router = useRouter()
  const [goals, setGoals] = useState<any[]>([])
  const [goal, setGoal] = useState<any>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title: '', timeline: '', why: '' })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: gs } = await supabase.from('goals').select('*').eq('user_id', user.id).eq('is_active', true).order('created_at', { ascending: false })
      setGoals(gs || [])
      const savedId = typeof window !== 'undefined' ? localStorage.getItem('selectedGoalId') : null
      const g = gs?.find((x: any) => x.id === savedId) || gs?.[0] || null
      setGoal(g)
      if (g) setForm({ title: g.title, timeline: g.timeline, why: g.why })
      setLoading(false)
    }
    load()
  }, [])

  const selectGoal = (g: any) => {
    setGoal(g)
    setForm({ title: g.title, timeline: g.timeline, why: g.why })
    setEditing(false)
    if (typeof window !== 'undefined') localStorage.setItem('selectedGoalId', g.id)
  }

  const saveChanges = async () => {
    if (!goal || !form.title.trim()) { toast.error('Title required'); return }
    setSaving(true)
    const { error } = await supabase.from('goals').update({
      title: form.title.trim(),
      timeline: form.timeline,
      why: form.why.trim(),
      updated_at: new Date().toISOString(),
    }).eq('id', goal.id)
    if (error) { toast.error('Save failed: ' + error.message); setSaving(false); return }
    // Update local state
    const updated = { ...goal, title: form.title.trim(), timeline: form.timeline, why: form.why.trim() }
    setGoal(updated)
    setGoals(prev => prev.map(g => g.id === goal.id ? updated : g))
    setEditing(false)
    setSaving(false)
    toast.success('Goal updated! Coach will use the new details.')
    // Clear coach history so it regenerates with new context
    router.refresh()
  }

  if (loading) return <div className="text-[#999] text-[14px]">Loading...</div>

  if (!goal) return (
    <div className="fade-up">
      <h1 className="font-serif text-[32px] mb-4">My Goal</h1>
      <div className="bg-white border border-[#e8e8e8] rounded-2xl p-8 text-center">
        <p className="text-[#666] mb-4">No active goal yet.</p>
        <Link href="/onboarding" className="inline-block px-5 py-2.5 bg-[#111] text-white rounded-xl text-[13px] font-medium">Create my first goal →</Link>
      </div>
    </div>
  )

  return (
    <div className="fade-up max-w-[800px]">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-[32px] mb-1">My Goal</h1>
          <p className="text-[14px] text-[#666]">Your goal profile and roadmap</p>
        </div>
        {!editing ? (
          <button onClick={() => setEditing(true)}
            className="px-4 py-2.5 border border-[#e8e8e8] rounded-xl text-[13px] font-medium hover:bg-[#f8f7f5] transition-colors">
            Edit goal
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => { setEditing(false); setForm({ title: goal.title, timeline: goal.timeline, why: goal.why }) }}
              className="px-4 py-2.5 border border-[#e8e8e8] rounded-xl text-[13px] hover:bg-[#f8f7f5] transition-colors">
              Cancel
            </button>
            <button onClick={saveChanges} disabled={saving}
              className="px-4 py-2.5 bg-[#111] text-white rounded-xl text-[13px] font-medium hover:bg-[#2a2a2a] disabled:opacity-50 transition-colors">
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        )}
      </div>

      {/* Goal tabs */}
      {goals.length > 1 && (
        <div className="flex gap-2 mb-5 flex-wrap">
          {goals.map(g => (
            <button key={g.id} onClick={() => selectGoal(g)}
              className={`px-4 py-2 rounded-full text-[13px] border transition-all ${goal?.id === g.id ? 'bg-[#111] text-white border-[#111]' : 'bg-white text-[#666] border-[#e8e8e8] hover:border-[#d0d0d0]'}`}>
              {(g.display_title || g.title).slice(0, 28)}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-6">
          <p className="text-[10px] font-medium tracking-[.12em] uppercase text-[#b8922a] mb-3">The goal</p>
          {editing ? (
            <textarea
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full font-serif text-[18px] leading-[1.4] border border-[#e8e8e8] rounded-xl px-3 py-2.5 outline-none focus:border-[#111] resize-none mb-3"
              rows={3}
            />
          ) : (
            <p className="font-serif text-[20px] leading-[1.4] mb-4">{goal.title}</p>
          )}
          <div className="flex gap-2 flex-wrap">
            {editing ? (
              <select value={form.timeline} onChange={e => setForm(f => ({ ...f, timeline: e.target.value }))}
                className="border border-[#e8e8e8] rounded-xl px-3 py-1.5 text-[13px] outline-none focus:border-[#111]">
                {TIMELINES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            ) : (
              <span className="text-[11px] font-medium text-[#b8922a] bg-[#faf3e0] px-2.5 py-1 rounded-full">{goal.timeline}</span>
            )}
            <span className="text-[11px] font-medium text-[#666] bg-[#f2f0ec] px-2.5 py-1 rounded-full">{goal.category}</span>
          </div>
        </div>

        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-6">
          <p className="text-[10px] font-medium tracking-[.12em] uppercase text-[#b8922a] mb-3">The why</p>
          {editing ? (
            <textarea
              value={form.why}
              onChange={e => setForm(f => ({ ...f, why: e.target.value }))}
              className="w-full text-[14px] text-[#666] border border-[#e8e8e8] rounded-xl px-3 py-2.5 outline-none focus:border-[#111] resize-none leading-[1.72]"
              rows={4}
            />
          ) : (
            <p className="text-[14px] text-[#666] leading-[1.72]">{goal.why}</p>
          )}
        </div>
      </div>

      {editing && (
        <div className="bg-[#faf3e0] border border-[#b8922a]/20 rounded-2xl p-4 mb-4 text-[13px] text-[#b8922a]">
          Updating your timeline or title will refresh your coach's context — they'll respond based on your new details going forward.
        </div>
      )}

      <div className="bg-white border border-[#e8e8e8] rounded-2xl p-6 mb-4">
        <p className="font-medium mb-4 text-[15px]">Roadmap</p>
        {[
          [goal.milestone_1 || goal.milestone_30, 'Phase 1', goal.phase1_completed],
          [goal.milestone_2 || goal.milestone_60, 'Phase 2', goal.phase2_completed],
          [goal.milestone_3 || goal.milestone_90, 'Phase 3', goal.phase3_completed],
        ].filter(([v]) => v).map(([v, label, done], i, arr) => (
          <div key={String(label)} className={`flex gap-4 py-3.5 ${i < arr.length - 1 ? 'border-b border-[#e8e8e8]' : ''} items-start`}>
            <span className="text-[12px] font-medium text-[#b8922a] w-16 flex-shrink-0 pt-0.5">{String(label)}</span>
            <span className="text-[14px] flex-1 leading-[1.6]">{String(v)}</span>
            <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${done ? 'bg-green-50 text-green-700' : 'bg-[#f2f0ec] text-[#999]'}`}>
              {done ? 'Completed ✓' : 'In progress'}
            </span>
          </div>
        ))}
      </div>

      <div className="bg-[#111] rounded-2xl p-6">
        <p className="text-[10px] font-medium tracking-[.12em] uppercase text-white/30 mb-3">Your affirmation</p>
        <p className="font-serif italic text-[18px] text-white/85 leading-[1.6]">"{goal.affirmation}"</p>
      </div>
    </div>
  )
}
