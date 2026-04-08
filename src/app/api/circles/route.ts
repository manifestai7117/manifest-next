import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Strip markdown from AI responses
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
      .select('*')
      .eq('circle_id', circleId)
      .eq('is_system', false) // never return system messages
      .order('created_at', { ascending: true })
      .limit(50)

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

    const { circleId, content, isSystem } = await request.json()
    if (!circleId || !content?.trim()) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
    const senderName = profile?.full_name || user.email?.split('@')[0] || 'Member'
    const { data: circle } = await supabase.from('circles').select('*').eq('id', circleId).single()
    if (!circle) return NextResponse.json({ error: 'Circle not found' }, { status: 404 })

    // If system message — use as AI prompt context only, don't show to users
    if (isSystem || content.startsWith('[SYSTEM:')) {
      const systemContext = content.replace('[SYSTEM:', '').replace(']', '').trim()
      const aiResponse = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        system: `You are the friendly AI coach for "${circle.name}", a goal circle focused on: ${circle.goal_description}. Be warm, welcoming and brief. No markdown, no bullet points, just natural sentences.`,
        messages: [{ role: 'user', content: systemContext }]
      })
      const replyText = aiResponse.content[0].type === 'text' ? stripMarkdown(aiResponse.content[0].text) : ''
      const { data: aiMsg } = await supabase.from('circle_messages').insert({
        circle_id: circleId,
        user_id: null,
        sender_name: 'Manifest Coach',
        content: replyText,
        is_ai: true,
        is_system: false, // AI reply IS visible
      }).select().single()
      return NextResponse.json({ userMessage: null, aiMessage: aiMsg })
    }

    // Normal user message
    const { data: userMsg } = await supabase.from('circle_messages').insert({
      circle_id: circleId,
      user_id: user.id,
      sender_name: senderName,
      content: content.trim(),
      is_ai: false,
      is_system: false,
    }).select().single()

    // Fetch recent visible messages for AI context
    const { data: recentMsgs } = await supabase
      .from('circle_messages')
      .select('sender_name, content, is_ai')
      .eq('circle_id', circleId)
      .eq('is_system', false)
      .order('created_at', { ascending: false })
      .limit(10)

    const msgHistory = (recentMsgs || []).reverse()
    const shouldRespond = content.toLowerCase().includes('coach') ||
      content.toLowerCase().includes('help') ||
      content.toLowerCase().includes('stuck') ||
      content.toLowerCase().includes('struggling') ||
      msgHistory.filter(m => !m.is_ai).length % 3 === 0

    let aiMsg = null
    if (shouldRespond) {
      const aiResponse = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        system: `You are the AI accountability coach for "${circle.name}", focused on: ${circle.goal_description}. Be encouraging, specific, brief (1-3 sentences). No markdown or bullet points. Use the member's name when responding directly.`,
        messages: msgHistory.slice(-6).map(m => ({
          role: (m.is_ai ? 'assistant' : 'user') as 'user' | 'assistant',
          content: m.is_ai ? m.content : `${m.sender_name}: ${m.content}`
        }))
      })
      const replyText = aiResponse.content[0].type === 'text' ? stripMarkdown(aiResponse.content[0].text) : ''
      const { data: inserted } = await supabase.from('circle_messages').insert({
        circle_id: circleId,
        user_id: null,
        sender_name: 'Manifest Coach',
        content: replyText,
        is_ai: true,
        is_system: false,
      }).select().single()
      aiMsg = inserted
    }

    return NextResponse.json({ userMessage: userMsg, aiMessage: aiMsg })
  } catch (error: any) {
    console.error('Circle message error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
