import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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

    const { circleId, content } = await request.json()
    if (!circleId || !content?.trim()) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    const senderName = profile?.full_name || user.email?.split('@')[0] || 'Member'

    const { data: circle } = await supabase
      .from('circles')
      .select('*')
      .eq('id', circleId)
      .single()

    if (!circle) return NextResponse.json({ error: 'Circle not found' }, { status: 404 })

    // Insert user message
    const { data: userMsg } = await supabase
      .from('circle_messages')
      .insert({
        circle_id: circleId,
        user_id: user.id,
        sender_name: senderName,
        content: content.trim(),
        is_ai: false,
      })
      .select()
      .single()

    // Fetch recent messages for AI context
    const { data: recentMsgs } = await supabase
      .from('circle_messages')
      .select('sender_name, content, is_ai')
      .eq('circle_id', circleId)
      .order('created_at', { ascending: false })
      .limit(10)

    const msgHistory = (recentMsgs || []).reverse()

    // Decide whether AI should respond
    const shouldRespond =
      content.toLowerCase().includes('coach') ||
      content.toLowerCase().includes('help') ||
      content.toLowerCase().includes('stuck') ||
      content.toLowerCase().includes('struggling') ||
      msgHistory.filter(m => !m.is_ai).length % 3 === 0

    let aiMsg = null
    if (shouldRespond) {
      const aiResponse = await anthropic.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 200,
        system: `You are the AI accountability coach for "${circle.name}", a goal circle focused on: ${circle.goal_description}. The group has ${circle.member_count} members and a ${circle.streak}-day streak.

Be encouraging, specific, and brief (1-3 sentences max). Reference the group's specific goal. Celebrate wins. Ask one focused question. Sound like a real supportive coach, not a bot. Use the member's name when responding to them directly.`,
        messages: msgHistory.slice(-6).map(m => ({
          role: (m.is_ai ? 'assistant' : 'user') as 'user' | 'assistant',
          content: m.is_ai ? m.content : `${m.sender_name}: ${m.content}`
        }))
      })

      const replyText = aiResponse.content[0].type === 'text' ? aiResponse.content[0].text : ''

      const { data: insertedAi } = await supabase
        .from('circle_messages')
        .insert({
          circle_id: circleId,
          user_id: null,
          sender_name: 'Coach AI',
          content: replyText,
          is_ai: true,
        })
        .select()
        .single()

      aiMsg = insertedAi
    }

    return NextResponse.json({ userMessage: userMsg, aiMessage: aiMsg })
  } catch (error: any) {
    console.error('Circle message error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
