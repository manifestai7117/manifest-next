import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Service-role client for storage uploads (bypasses RLS — we do our own auth check)
const serviceSupabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']
const MAX_IMAGE_BYTES = 10 * 1024 * 1024  // 10MB
const MAX_VIDEO_BYTES = 50 * 1024 * 1024  // 50MB

async function moderateImage(base64Data: string, mimeType: string): Promise<{ safe: boolean; reason?: string }> {
  try {
    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 80,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType as any, data: base64Data },
          },
          {
            type: 'text',
            text: 'Content moderator for a goal-tracking app. Reject ONLY if the image clearly contains nudity, sexual content, graphic violence, gore, or hate symbols. Reply ONLY with JSON: {"safe": true} or {"safe": false, "reason": "specific violation"}',
          },
        ],
      }],
    })
    const raw = res.content[0].type === 'text' ? res.content[0].text.trim() : '{"safe":true}'
    return JSON.parse(raw.replace(/```json|```/g, '').trim())
  } catch (e) {
    // Fail open — if moderation is unavailable, allow the upload
    console.error('Moderation error (failing open):', e)
    return { safe: true }
  }
}

export async function POST(request: Request) {
  try {
    // Auth check using the session-aware server client
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await request.formData()
    const file = formData.get('file') as File
    const context = formData.get('context') as string || 'post'

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const mimeType = file.type
    const isImage = ALLOWED_IMAGE_TYPES.includes(mimeType)
    const isVideo = ALLOWED_VIDEO_TYPES.includes(mimeType)

    if (!isImage && !isVideo) {
      return NextResponse.json({ error: 'File type not allowed. Use JPEG, PNG, WebP, GIF, MP4, or WebM.' }, { status: 400 })
    }

    const maxBytes = isImage ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES
    if (file.size > maxBytes) {
      return NextResponse.json({ error: `File too large. Max ${isImage ? '10MB for images' : '50MB for videos'}.` }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Moderate images — truncate base64 to ~750KB to avoid token limits
    if (isImage) {
      const base64 = buffer.toString('base64').slice(0, 750000)
      const modResult = await moderateImage(base64, mimeType)
      if (!modResult.safe) {
        return NextResponse.json({
          error: `Image not allowed: ${modResult.reason || 'This image violates community guidelines.'}`,
          blocked: true,
        }, { status: 422 })
      }
    }

    // Upload using service-role client (bypasses storage RLS)
    // We've already verified the user is authenticated above
    const ext = mimeType.split('/')[1].replace('quicktime', 'mov')
    const path = `${user.id}/${context}/${Date.now()}.${ext}`

    const { error: uploadError } = await serviceSupabase.storage
      .from('user-media')
      .upload(path, buffer, { contentType: mimeType, upsert: false })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return NextResponse.json({ error: 'Upload failed: ' + uploadError.message }, { status: 500 })
    }

    const { data: { publicUrl } } = serviceSupabase.storage.from('user-media').getPublicUrl(path)

    // Log to media_uploads using service client (bypasses table RLS too)
    try {
      await serviceSupabase.from('media_uploads').insert({
        user_id: user.id,
        storage_path: path,
        public_url: publicUrl,
        media_type: isImage ? 'image' : 'video',
        mime_type: mimeType,
        size_bytes: file.size,
        moderation_status: 'approved',
        context,
      })
    } catch {} // non-fatal audit log

    return NextResponse.json({ url: publicUrl, type: isImage ? 'image' : 'video' })
  } catch (error: any) {
    console.error('Media upload error:', error)
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 })
  }
}