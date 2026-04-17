import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/`(.*?)`/g, '$1')
    .replace(/^\s*[-*+]\s/gm, '')
    .trim()
}

export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const circleId = searchParams.get('circleId')
    if (!circleId) return NextResponse.json({ error: 'Missing circleId' }, { status: 400 })

    const { data: messages } = await supabase
      .from('circle_messages')
      .select('*, profiles:profiles(id, full_name, avatar_url)')
      .eq('circle_id', circleId)
      .eq('is_system', false)
      .order('created_at', { ascending: true })
      .limit(80)

    return NextResponse.json({ messages: messages || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { circleId, content, media_url, media_type, isSystem } = body

    if (!circleId) return NextResponse.json({ error: 'Missing circleId' }, { status: 400 })

    // Must have content OR media
    const hasContent = !!(content && content.trim())
    const hasMedia = !!(media_url && media_url.startsWith('http'))
    if (!hasContent && !hasMedia) {
      return NextResponse.json({ error: 'Message must have content or media' }, { status: 400 })
    }

    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
    const senderName = profile?.full_name || user.email?.split('@')[0] || 'Member'
    const { data: circle } = await supabase.from('circles').select('*').eq('id', circleId).single()
    if (!circle) return NextResponse.json({ error: 'Circle not found' }, { status: 404 })

    // System messages (AI prompt context only)
    if (isSystem || content?.startsWith('[SYSTEM:')) {
      const systemContext = (content || '').replace('[SYSTEM:', '').replace(']', '').trim()
      const aiResponse = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        system: `You are the friendly AI coach for "${circle.name}", a goal circle focused on: ${circle.goal_description}. Be warm, welcoming and brief. No markdown, no bullet points, just natural sentences.`,
        messages: [{ role: 'user', content: systemContext }],
      })
      const replyText = aiResponse.content[0].type === 'text' ? stripMarkdown(aiResponse.content[0].text) : ''
      const { data: aiMsg } = await supabase.from('circle_messages').insert({
        circle_id: circleId, user_id: null, sender_name: 'Manifest Coach',
        content: replyText, is_ai: true, is_system: false,
      }).select().single()
      return NextResponse.json({ userMessage: null, aiMessage: aiMsg })
    }

    // Normal user message — save content + media
    const { data: userMsg, error: insertError } = await supabase.from('circle_messages').insert({
      circle_id: circleId,
      user_id: user.id,
      sender_name: senderName,
      content: hasContent ? content.trim() : null,
      media_url: media_url || null,
      media_type: media_type || null,
      is_ai: false,
      is_system: false,
    }).select('*, profiles:profiles(id, full_name, avatar_url)').single()

    if (insertError) {
      console.error('Circle message insert error:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // AI responds occasionally (not for media-only messages)
    let aiMsg = null
    if (hasContent && content.trim()) {
      const { data: recentMsgs } = await supabase
        .from('circle_messages')
        .select('sender_name, content, is_ai')
        .eq('circle_id', circleId)
        .eq('is_system', false)
        .not('content', 'is', null)
        .order('created_at', { ascending: false })
        .limit(10)

      const msgHistory = (recentMsgs || []).reverse()
      const shouldRespond =
        content.toLowerCase().includes('coach') ||
        content.toLowerCase().includes('help') ||
        content.toLowerCase().includes('stuck') ||
        content.toLowerCase().includes('struggling') ||
        msgHistory.filter(m => !m.is_ai).length % 3 === 0

      if (shouldRespond) {
        try {
          const aiResponse = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 200,
            system: `You are the AI accountability coach for "${circle.name}", focused on: ${circle.goal_description}. Be encouraging, specific, brief (1-3 sentences). No markdown or bullet points. Use the member's name when responding directly.`,
            messages: msgHistory.slice(-6).map(m => ({
              role: (m.is_ai ? 'assistant' : 'user') as 'user' | 'assistant',
              content: m.is_ai ? m.content : `${m.sender_name}: ${m.content}`,
            })),
          })
          const replyText = aiResponse.content[0].type === 'text' ? stripMarkdown(aiResponse.content[0].text) : ''
          const { data: inserted } = await supabase.from('circle_messages').insert({
            circle_id: circleId, user_id: null, sender_name: 'Manifest Coach',
            content: replyText, is_ai: true, is_system: false,
          }).select().single()
          aiMsg = inserted
        } catch (e) {
          console.error('AI response error:', e)
        }
      }
    }

    return NextResponse.json({ message: userMsg, userMessage: userMsg, aiMessage: aiMsg })
  } catch (error: any) {
    console.error('Circle message error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}