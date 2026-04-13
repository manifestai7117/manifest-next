'use client'
import { useEffect } from 'react'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <div className="min-h-screen bg-[#f8f7f5] flex items-center justify-center p-6">
      <div className="text-center max-w-[420px]">
        <div className="text-[64px] mb-4">⚡</div>
        <h1 className="font-serif text-[28px] mb-3">Something went wrong</h1>
        <p className="text-[14px] text-[#666] leading-[1.7] mb-6">An unexpected error occurred. This has been logged and we'll fix it.</p>
        <div className="flex gap-3 justify-center">
          <button onClick={reset} className="px-5 py-2.5 bg-[#111] text-white rounded-xl text-[13px] font-medium hover:bg-[#2a2a2a] transition-colors">Try again</button>
          <a href="/dashboard" className="px-5 py-2.5 border border-[#e8e8e8] rounded-xl text-[13px] text-[#666] hover:bg-[#f0ede8] transition-colors">Dashboard</a>
        </div>
      </div>
    </div>
  )
}
