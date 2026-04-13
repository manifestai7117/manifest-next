export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-[#f8f7f5] flex items-center justify-center p-6">
      <div className="text-center max-w-[360px]">
        <div className="text-[64px] mb-4">📡</div>
        <h1 className="font-serif text-[28px] mb-3">You're offline</h1>
        <p className="text-[14px] text-[#666] leading-[1.7] mb-6">No internet connection. Your data is safe — any check-ins will sync when you're back online.</p>
        <button onClick={() => window.location.reload()} className="px-5 py-2.5 bg-[#111] text-white rounded-xl text-[13px] font-medium">Try again</button>
      </div>
    </div>
  )
}
