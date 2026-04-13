'use client'
import { useEffect } from 'react'

export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <div className="fade-up text-center py-16">
      <div className="text-[48px] mb-4">⚡</div>
      <h2 className="font-serif text-[24px] mb-2">Something went wrong</h2>
      <p className="text-[14px] text-[#666] mb-6">An error occurred on this page.</p>
      <button onClick={reset} className="px-5 py-2.5 bg-[#111] text-white rounded-xl text-[13px] font-medium hover:bg-[#2a2a2a] transition-colors">Try again</button>
    </div>
  )
}
