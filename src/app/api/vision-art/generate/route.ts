import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function buildPrompt(goal: any): Promise<{ prompt: string; negativePrompt: string }> {
  const gender = goal.user_gender && goal.user_gender !== 'Prefer not to say' ? goal.user_gender.toLowerCase() : null
  const aesthetic = goal.aesthetic || 'Bright & energetic'
  const regenCount = goal.vision_board_regenerations || 0

  const styleMap: Record<string, string> = {
    'Minimal & clean': 'clean minimal photography, soft natural light, neutral palette, Kinfolk magazine editorial style',
    'Bold & dark': 'cinematic dramatic photography, deep shadows, rich contrast, moody atmosphere',
    'Warm & natural': 'golden hour photography, warm amber light, analog film aesthetic, National Geographic quality',
    'Bright & energetic': 'vibrant energetic photography, bold colors, dynamic composition, Nike campaign quality',
  }
  const styleDesc = styleMap[aesthetic] || styleMap['Bright & energetic']

  // Generate scene — focus on ENVIRONMENT and EQUIPMENT, avoid complex human anatomy
  const sceneRes = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 150,
    messages: [{
      role: 'user',
      content: `Write a 2-sentence cinematic photo description for a vision board.

Goal: "${goal.title}"
Why: "${goal.why || ''}"
Style: ${styleDesc}
Variation number: ${regenCount}

RULES (critical — violation ruins the image):
- Describe the PLACE and EQUIPMENT that represents this goal — NOT a full human figure
- If showing a person: only a tiny distant silhouette, OR just their hands/back, OR no person at all
- ZERO faces, ZERO full bodies, ZERO complex poses
- ZERO text, numbers, scoreboards, signs, logos
- Each variation number should produce a clearly different scene

APPROACH: Make it aspirational through ENVIRONMENT, LIGHT, and ATMOSPHERE — not through a person.

Good examples:
Tennis: "a clay tennis court bathed in golden sunset light, a racket and three yellow balls resting near the baseline, long dramatic shadows stretching across the red clay surface, empty stadium seats glowing in the background"
Marathon: "an empty marathon finish line tape stretched across a misty city street at dawn, golden sunrise breaking between buildings, confetti scattered on the wet pavement, timing arch glowing orange"
Startup: "a sleek glass-walled startup office at night, city skyline blazing below, an open MacBook on a minimalist white desk showing a live product dashboard, single warm desk lamp, a small plant on the windowsill"
Fitness: "a premium gym at golden hour, sunlight cutting through floor-to-ceiling windows, dumbbells and barbell arranged on the rubber floor, chalk dust hanging in the air, motivational atmosphere"

Write only the scene description. No quotes. No explanation.`
    }]
  })

  const scene = sceneRes.content[0].type === 'text' ? sceneRes.content[0].text.trim() : ''

  const prompt = [
    `Breathtaking ${styleDesc}.`,
    scene,
    'Cinematic composition, professional color grading, deeply aspirational and emotional.',
    'NO human faces. NO text. NO numbers. NO scoreboards. NO signs. NO logos. NO watermarks.',
    'Shot on Hasselblad medium format camera, perfect exposure, ultra high resolution, award-winning photography.',
  ].join(' ')

  const negativePrompt = [
    'face, faces, eyes, nose, mouth, ears, teeth, head, portrait, selfie, frontal view, looking at camera, human face, facial features',
    'full body, whole person, complete human figure, standing person, running person, jumping person',
    'deformed, ugly, disfigured, distorted, bad anatomy, extra limbs, extra legs, extra feet, extra shoes, three legs, four legs, mutation, malformed, poorly drawn, bad hands, missing limbs, floating limbs, disconnected limbs, fused fingers',
    'text, letters, words, numbers, digits, scoreboard, score, sign, watermark, logo, brand, jersey, number, caption, written, readable',
    gender === 'man' ? 'woman, female, girl' : gender === 'woman' ? 'man, male, boy' : '',
    'cartoon, anime, illustration, painting, CGI, 3D render, sketch, digital art, unrealistic',
    'low quality, blurry, grainy, pixelated, overexposed, underexposed, noise, jpeg artifacts',
    'depressing, scary, horror, dark, sad',
  ].filter(Boolean).join(', ')

  return { prompt, negativePrompt }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { goalId } = await request.json()
    if (!goalId) return NextResponse.json({ error: 'Missing goalId' }, { status: 400 })

    const { data: goal } = await supabase.from('goals').select('*').eq('id', goalId).eq('user_id', user.id).single()
    if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })

    const falKey = process.env.FAL_KEY
    if (!falKey) return NextResponse.json({ error: 'FAL_KEY not configured' }, { status: 500 })

    const { prompt, negativePrompt } = await buildPrompt(goal)
    console.log(`Vision art for "${goal.title}":`, prompt.slice(0, 150))

    let imageUrl: string | null = null
    const seed = Math.floor(Math.random() * 9999999)

    const falRes = await fetch('https://fal.run/fal-ai/flux/dev', {
      method: 'POST',
      headers: { 'Authorization': `Key ${falKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        negative_prompt: negativePrompt,
        image_size: 'portrait_4_3',
        num_inference_steps: 35,
        guidance_scale: 4.5,
        num_images: 1,
        enable_safety_checker: true,
        output_format: 'jpeg',
        seed,
      }),
      signal: AbortSignal.timeout(120000),
    })

    if (falRes.ok) {
      const data = await falRes.json()
      imageUrl = data.images?.[0]?.url || null
    } else {
      const errText = await falRes.text()
      console.error('flux/dev failed:', errText.slice(0, 200))
      const fallback = await fetch('https://fal.run/fal-ai/flux/schnell', {
        method: 'POST',
        headers: { 'Authorization': `Key ${falKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, negative_prompt: negativePrompt, image_size: 'portrait_4_3', num_inference_steps: 12, num_images: 1, seed }),
        signal: AbortSignal.timeout(60000),
      })
      if (fallback.ok) {
        const data = await fallback.json()
        imageUrl = data.images?.[0]?.url || null
      } else {
        return NextResponse.json({ error: 'Image generation failed' }, { status: 500 })
      }
    }

    if (!imageUrl) return NextResponse.json({ error: 'No image returned' }, { status: 500 })

    let finalUrl = imageUrl
    try {
      const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(20000) })
      if (imgRes.ok) {
        const buf = await imgRes.arrayBuffer()
        const path = `${user.id}/${goalId}-${Date.now()}.jpg`
        const { error: upErr } = await supabase.storage.from('vision-art').upload(path, buf, { contentType: 'image/jpeg', upsert: true })
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage.from('vision-art').getPublicUrl(path)
          finalUrl = publicUrl
        }
      }
    } catch { }

    const newCount = (goal.vision_board_regenerations || 0) + 1
    await supabase.from('goals').update({
      art_image_url: finalUrl,
      vision_board_last_generated: new Date().toISOString(),
      vision_board_regenerations: newCount,
    }).eq('id', goalId)

    return NextResponse.json({ imageUrl: finalUrl, regenerations: newCount })
  } catch (error: any) {
    console.error('Vision art error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}