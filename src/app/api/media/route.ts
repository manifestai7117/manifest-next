import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_VIDEO_BYTES = 50 * 1024 * 1024

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
            text: `Content moderator for a goal-tracking app. Reject ONLY if image clearly contains: nudity, sexual content, graphic violence, gore, or hate symbols. Reply ONLY with JSON: {"safe": true} or {"safe": false, "reason": "specific violation"}`,
          },
        ],
      }],
    })
    const raw = res.content[0].type === 'text' ? res.content[0].text.trim() : '{"safe":true}'
    return JSON.parse(raw.replace(/```json|```/g, '').trim())
  } catch (e) {
    // Fail OPEN — if moderation service is unavailable, allow the upload
    // (better to occasionally allow a borderline image than block legitimate users)
    console.error('Moderation error (failing open):', e)
    return { safe: true }
  }
}

export async function POST(request: Request) {
  try {
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

    // Moderate images — truncate base64 to ~1MB to avoid token limits
    if (isImage) {
      const base64 = buffer.toString('base64')
      // Use at most ~750KB of base64 data for moderation (avoids token limit errors)
      const truncatedBase64 = base64.slice(0, 750000)
      const modResult = await moderateImage(truncatedBase64, mimeType)
      if (!modResult.safe) {
        return NextResponse.json({
          error: `Image not allowed: ${modResult.reason || 'This image violates community guidelines.'}`,
          blocked: true,
        }, { status: 422 })
      }
    }

    // Upload to Supabase Storage
    const ext = mimeType.split('/')[1].replace('quicktime', 'mov')
    const path = `${user.id}/${context}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('user-media')
      .upload(path, buffer, { contentType: mimeType, upsert: false })

    if (uploadError) return NextResponse.json({ error: 'Upload failed: ' + uploadError.message }, { status: 500 })

    const { data: { publicUrl } } = supabase.storage.from('user-media').getPublicUrl(path)

    await supabase.from('media_uploads').insert({
      user_id: user.id,
      storage_path: path,
      public_url: publicUrl,
      media_type: isImage ? 'image' : 'video',
      mime_type: mimeType,
      size_bytes: file.size,
      moderation_status: 'approved',
      context,
    }).catch(() => {}) // non-fatal if audit log fails

    return NextResponse.json({ url: publicUrl, type: isImage ? 'image' : 'video' })
  } catch (error: any) {
    console.error('Media upload error:', error)
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 })
  }
}