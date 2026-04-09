import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Generate specific search queries for the goal using Claude
async function generateSearchQueries(goal: any): Promise<string[]> {
  const prompt = `You are helping build a vision board for someone with this goal: "${goal.title}"
Category: ${goal.category}
Why: ${goal.why || ''}

Generate exactly 6 highly specific Unsplash search queries that will return RELEVANT images for this vision board.
Rules:
- Each query must directly relate to the goal (e.g. for tennis: "tennis court overhead", "tennis racket ball clay court", "tennis match serve action")
- NO generic motivation/success/mountain images unless the goal is about hiking/nature
- NO portraits or faces — focus on objects, courts, equipment, environments, actions
- Each query should be 2-4 words, very specific
- Queries must be diverse (not all the same scene)
- Return ONLY a JSON array of 6 strings, nothing else

Example for "Become a 4.5 tennis player": ["tennis court aerial view","tennis racket yellow ball","clay tennis court lines","tennis net close up","tennis ball machine practice","outdoor tennis court sunset"]`

  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }]
  })
  const text = res.content[0].type === 'text' ? res.content[0].text.trim() : '[]'
  try {
    const queries = JSON.parse(text.replace(/```json|```/g, '').trim())
    return Array.isArray(queries) ? queries.slice(0, 6) : []
  } catch {
    return []
  }
}

// Score an image for relevance to the goal
async function scoreImage(imageDescription: string, goalTitle: string, query: string): Promise<number> {
  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 10,
    messages: [{
      role: 'user',
      content: `Goal: "${goalTitle}". Search query: "${query}". Image description: "${imageDescription}". Rate relevance 1-10. Reply with ONLY a single number.`
    }]
  })
  const text = res.content[0].type === 'text' ? res.content[0].text.trim() : '5'
  return parseInt(text.match(/\d+/)?.[0] || '5')
}

// Search Unsplash for a query and return best matching image
async function searchUnsplash(query: string, goalTitle: string, usedIds: Set<string>, page = 1): Promise<string | null> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY
  if (!accessKey) return null

  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=10&page=${page}&orientation=squarish&content_filter=high`
  const res = await fetch(url, {
    headers: { Authorization: `Client-ID ${accessKey}` }
  })
  if (!res.ok) return null
  const data = await res.json()
  const results = data.results || []

  for (const photo of results) {
    if (usedIds.has(photo.id)) continue
    // Score the image
    const description = [photo.description, photo.alt_description, ...(photo.tags?.map((t: any) => t.title) || [])].filter(Boolean).join(', ')
    const score = await scoreImage(description, goalTitle, query)
    if (score >= 6) {
      usedIds.add(photo.id)
      return `${photo.urls.regular}&w=800&h=800&fit=crop`
    }
  }

  // If nothing scored well enough on page 1, try page 2
  if (page === 1) return searchUnsplash(query, goalTitle, usedIds, 2)
  return null
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { goalId } = await request.json()
    const { data: goal } = await supabase.from('goals').select('*').eq('id', goalId).eq('user_id', user.id).single()
    if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })

    const unsplashKey = process.env.UNSPLASH_ACCESS_KEY
    if (!unsplashKey) {
      return NextResponse.json({ error: 'UNSPLASH_ACCESS_KEY not configured' }, { status: 500 })
    }

    // Step 1: Generate tailored search queries
    const queries = await generateSearchQueries(goal)
    if (queries.length < 6) {
      return NextResponse.json({ error: 'Could not generate search queries' }, { status: 500 })
    }

    // Step 2: Search Unsplash for each query, score for relevance
    const usedIds = new Set<string>()
    const imageUrls: string[] = []

    await Promise.all(queries.map(async (query, i) => {
      const url = await searchUnsplash(query, goal.title, usedIds)
      if (url) imageUrls[i] = url
    }))

    // Fill any gaps with fallback search on goal title
    for (let i = 0; i < 6; i++) {
      if (!imageUrls[i]) {
        const fallback = await searchUnsplash(goal.title, goal.title, usedIds)
        imageUrls[i] = fallback || `https://images.unsplash.com/photo-1499346030926-9a72daac6c63?w=800&h=800&fit=crop`
      }
    }

    // Step 3: Save queries to goal for display
    const newCount = (goal.vision_board_regenerations || 0) + 1
    await supabase.from('goals').update({
      vision_board_regenerations: newCount,
      vision_board_last_generated: new Date().toISOString(),
      vision_board_queries: queries.join('|'),
    }).eq('id', goalId)

    return NextResponse.json({ images: imageUrls, queries, regenerations: newCount })
  } catch (error: any) {
    console.error('Vision board error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
