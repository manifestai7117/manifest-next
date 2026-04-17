import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const serviceSupabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1')
    .replace(/#{1,6}\s/g, '').replace(/`(.*?)`/g, '$1')
    .replace(/^\s*[-*+]\s/gm, '').trim()
}

export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(request.url)
  const circleId = searchParams.get('circleId')
  if (!circleId) return NextResponse.json({ error: 'Missing circleId' }, { status: 400 })
  const { data } = await serviceSupabase
    .from('circle_messages')
    .select('*, profiles:profiles(id, full_name, avatar_url)')
    .eq('circle_id', circleId)
    .order('created_at', { ascending: true })
    .limit(80)
  return NextResponse.json({ messages: data || [] })
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { circleId, content, media_url, media_type, isSystem } = body

    if (!circleId) return NextResponse.json({ error: 'Missing circleId' }, { status: 400 })

    const hasContent = typeof content === 'string' && content.trim().length > 0
    const hasMedia = typeof media_url === 'string' && media_url.startsWith('http')

    if (!hasContent && !hasMedia) {
      return NextResponse.json({ error: 'Message needs text or media' }, { status: 400 })
    }

    const { data: profile } = await serviceSupabase
      .from('profiles').select('full_name').eq('id', user.id).single()
    const senderName = profile?.full_name || 'Member'

    const { data: circle } = await serviceSupabase
      .from('circles').select('*').eq('id', circleId).single()
    if (!circle) return NextResponse.json({ error: 'Circle not found' }, { status: 404 })

    // System / AI-only messages
    if (isSystem) {
      const ctx = (content || '').replace('[SYSTEM:', '').replace(']', '').trim()
      const ai = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001', max_tokens: 200,
        system: `You are the coach for "${circle.name}" (${circle.goal_description}). Be warm, brief, no markdown.`,
        messages: [{ role: 'user', content: ctx }],
      })
      const reply = ai.content[0].type === 'text' ? stripMarkdown(ai.content[0].text) : ''
      const { data: aiMsg } = await serviceSupabase.from('circle_messages')
        .insert({ circle_id: circleId, user_id: null, sender_name: 'Manifest Coach', content: reply, is_ai: true })
        .select('*, profiles:profiles(id, full_name, avatar_url)').single()
      return NextResponse.json({ message: aiMsg })
    }

    // Normal user message — use service role to avoid RLS issues
    const { data: userMsg, error: insertErr } = await serviceSupabase
      .from('circle_messages')
      .insert({
        circle_id: circleId,
        user_id: user.id,
        sender_name: senderName,
        content: hasContent ? content.trim() : null,
        media_url: hasMedia ? media_url : null,
        media_type: hasMedia ? (media_type || 'image') : null,
        is_ai: false,
      })
      .select('*, profiles:profiles(id, full_name, avatar_url)')
      .single()

    if (insertErr) {
      console.error('Circle insert error:', insertErr)
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    // AI response for text messages (occasional)
    let aiMsg = null
    if (hasContent) {
      try {
        const { data: recent } = await serviceSupabase.from('circle_messages')
          .select('sender_name, content, is_ai')
          .eq('circle_id', circleId).not('content', 'is', null)
          .order('created_at', { ascending: false }).limit(10)

        const history = (recent || []).reverse()
        const textCount = history.filter((m: any) => !m.is_ai).length
        const shouldRespond =
          content.toLowerCase().includes('coach') ||
          content.toLowerCase().includes('help') ||
          content.toLowerCase().includes('stuck') ||
          textCount % 3 === 0

        if (shouldRespond) {
          const aiRes = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001', max_tokens: 150,
            system: `You are the AI coach for "${circle.name}" (${circle.goal_description}). 1-2 sentences, no markdown, use their name.`,
            messages: history.slice(-6).map((m: any) => ({
              role: (m.is_ai ? 'assistant' : 'user') as 'user' | 'assistant',
              content: m.is_ai ? m.content : `${m.sender_name}: ${m.content}`,
            })),
          })
          const reply = aiRes.content[0].type === 'text' ? stripMarkdown(aiRes.content[0].text) : ''
          const { data: inserted } = await serviceSupabase.from('circle_messages')
            .insert({ circle_id: circleId, user_id: null, sender_name: 'Manifest Coach', content: reply, is_ai: true })
            .select('*, profiles:profiles(id, full_name, avatar_url)').single()
          aiMsg = inserted
        }
      } catch (e) { console.error('AI response error:', e) }
    }

    return NextResponse.json({ message: userMsg, userMessage: userMsg, aiMessage: aiMsg })
  } catch (e: any) {
    console.error('Circle POST error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}