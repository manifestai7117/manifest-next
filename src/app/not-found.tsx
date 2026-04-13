import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#f8f7f5] flex items-center justify-center p-6">
      <div className="text-center max-w-[420px]">
        <div className="font-serif text-[120px] leading-none text-[#e8e5de] mb-4 select-none">404</div>
        <h1 className="font-serif text-[32px] mb-3">Page not found</h1>
        <p className="text-[15px] text-[#666] leading-[1.7] mb-8">This page doesn't exist. Maybe the goal was completed and archived itself.</p>
        <div className="flex gap-3 justify-center">
          <Link href="/dashboard" className="px-5 py-2.5 bg-[#111] text-white rounded-xl text-[13px] font-medium hover:bg-[#2a2a2a] transition-colors">Go to dashboard</Link>
          <Link href="/" className="px-5 py-2.5 border border-[#e8e8e8] rounded-xl text-[13px] text-[#666] hover:bg-[#f0ede8] transition-colors">Home</Link>
        </div>
      </div>
    </div>
  )
}
