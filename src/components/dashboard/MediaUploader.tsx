'use client'
import { useState, useRef } from 'react'
import toast from 'react-hot-toast'

interface Props {
  onUpload: (url: string, type: 'image' | 'video') => void
  onClear: () => void
  mediaUrl?: string
  mediaType?: 'image' | 'video'
  context?: string
  disabled?: boolean
}

export default function MediaUploader({ onUpload, onClear, mediaUrl, mediaType, context = 'post', disabled }: Props) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    if (uploading || disabled) return
    setUploading(true)
    const form = new FormData()
    form.append('file', file)
    form.append('context', context)
    try {
      const res = await fetch('/api/media', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Upload failed')
        setUploading(false)
        return
      }
      onUpload(data.url, data.type)
    } catch {
      toast.error('Upload failed — please try again')
    }
    setUploading(false)
  }

  if (mediaUrl) {
    return (
      <div className="relative rounded-xl overflow-hidden mb-2 border border-[#e8e8e8]">
        {mediaType === 'video'
          ? <video src={mediaUrl} controls className="w-full max-h-48 object-cover"/>
          : <img src={mediaUrl} alt="" className="w-full max-h-48 object-cover"/>
        }
        <button onClick={onClear}
          className="absolute top-2 right-2 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center text-[14px] hover:bg-black/80 transition-colors">
          ×
        </button>
      </div>
    )
  }

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
        className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
        disabled={disabled || uploading}
      />
      <button type="button" onClick={() => inputRef.current?.click()}
        disabled={disabled || uploading}
        className="flex items-center gap-1.5 text-[12px] text-[#999] hover:text-[#666] transition-colors disabled:opacity-40 py-1">
        {uploading
          ? <><span className="w-3.5 h-3.5 border-2 border-[#999]/30 border-t-[#999] rounded-full spin-anim"/>Uploading & checking...</>
          : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>Photo / Video</>
        }
      </button>
      <p className="text-[9px] text-[#bbb] mt-0.5">All media is AI-checked before posting. Max 10MB image / 50MB video.</p>
    </div>
  )
}