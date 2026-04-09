import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function buildPrompt(goal: any): Promise<{ prompt: string; negativePrompt: string }> {
  const rawGender = goal.user_gender || ''
  const ageRange = goal.user_age_range || ''
  const aesthetic = goal.aesthetic || 'Bright & energetic'
  const regenCount = goal.vision_board_regenerations || 0

  // Build detailed person descriptor
  const genderWord = rawGender === 'Man' ? 'man' : rawGender === 'Woman' ? 'woman' : rawGender === 'Non-binary' ? 'person' : 'person'
  const ageWord = ageRange && ageRange !== 'Prefer not to say'
    ? ageRange === 'Under 18' ? 'teenage' : ageRange === '18–24' ? 'young' : ageRange === '25–34' ? 'in their late 20s' : ageRange === '35–44' ? 'in their late 30s' : ageRange === '45–54' ? 'in their late 40s' : 'in their 50s'
    : ''
  const ethnicity = goal.user_ethnicity && goal.user_ethnicity !== 'Prefer not to say' ? goal.user_ethnicity : ''

  // Compose person string — specific and real
  const personParts = [ethnicity, ageWord, genderWord].filter(Boolean)
  const personDesc = personParts.length > 1 ? personParts.join(' ') : genderWord

  const styleMap: Record<string, string> = {
    'Minimal & clean': 'clean minimal photography, soft diffused natural light, neutral warm palette, Kinfolk magazine editorial',
    'Bold & dark': 'dramatic cinematic photography, deep shadows and rich contrast, moody powerful atmosphere, Christopher Nolan film still quality',
    'Warm & natural': 'golden hour photography, warm amber and orange tones, analog film grain, National Geographic editorial quality',
    'Bright & energetic': 'vibrant Nike campaign photography, punchy bold colors, dynamic energy, aspirational sports editorial',
  }
  const styleDesc = styleMap[aesthetic] || styleMap['Bright & energetic']

  const sceneRes = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: `Write a 2-sentence cinematic photo description for a vision board image.

Goal: "${goal.title}"
Why: "${goal.why || ''}"
Person: ${personDesc}
Style: ${styleDesc}
Variation: ${regenCount}

ABSOLUTE RULES — any violation ruins the image:
1. Show the ${personDesc} from DIRECTLY BEHIND — we see their back, hair/neck, shoulders, full body walking/standing away from camera. Camera is behind them looking at the back of their head. NEVER side profile. NEVER any part of their face.
2. The scene must be 100% specific to the goal — show them in the exact environment where they achieve it
3. Describe their body language, clothing, the environment in rich detail
4. ZERO text, scoreboards, numbers, signs, logos anywhere
5. Different variation number = different scene/moment/environment

Person examples for "from behind":
- "their back to the camera, dark curly hair visible above broad shoulders"
- "seen from behind, athletic frame, hair tied back"
- "walking away from camera, back to viewer"

Scene examples (combine person + environment):
- Tennis: "A ${personDesc}, back to camera, stands at the baseline of a clay tennis court at golden sunset — racket raised having just hit a winner, the red clay surface stretching toward the net, empty stadium seats glowing in warm light, long afternoon shadows"
- Marathon: "A ${personDesc} seen from behind crosses a marathon finish line, arms raised in triumph, motion blur on legs, crowd blurred on both sides, golden sunrise ahead, finish tape just broken"
- Startup: "A ${personDesc}, back to camera, stands at floor-to-ceiling windows of a modern startup office at night, city skyline blazing below, their reflection faintly visible in the glass, a pitch deck open on the desk behind them"

Write only the scene. No quotes. No explanation.`
    }]
  })

  const scene = sceneRes.content[0].type === 'text' ? sceneRes.content[0].text.trim() : ''

  const prompt = [
    `Breathtaking ${styleDesc}.`,
    scene,
    `The ${personDesc} is photographed strictly from behind — we see the back of their head, hair, shoulders, and body. Camera is positioned behind them. Face is completely hidden from view.`,
    'Professional color grading, cinematic depth of field, deeply aspirational.',
    'NO text, NO numbers, NO scoreboards, NO signs, NO logos anywhere in the image.',
    'Shot on Hasselblad medium format, ultra high resolution, award-winning photography.',
  ].join(' ')

  const isMale = rawGender === 'Man'
  const isFemale = rawGender === 'Woman'

  const negativePrompt = [
    // Face — exhaustive
    'face, faces, eyes, nose, mouth, lips, teeth, ears, chin, cheeks, forehead, facial features, frontal face, side profile, three-quarter face, portrait, selfie, looking at camera, looking toward camera',
    // Anatomy errors
    'extra limbs, extra legs, extra feet, extra shoes, three legs, four legs, extra arms, extra hands, floating limbs, disconnected limbs, fused fingers, bad hands, poorly drawn hands, missing limbs, deformed, disfigured, distorted, ugly, bad anatomy, mutation, malformed, watermark',
    // Text
    'text, letters, words, numbers, digits, scoreboard, score, sign, logo, brand, watermark, caption, jersey number',
    // Wrong gender
    isMale ? 'woman, female, girl, feminine' : isFemale ? 'man, male, boy, masculine' : '',
    // Style
    'cartoon, anime, illustration, painting, CGI, 3D render, sketch, digital art',
    'low quality, blurry, grainy, pixelated, overexposed, underexposed, noise',
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
    console.log(`Vision art for "${goal.title}" (v${(goal.vision_board_regenerations || 0) + 1}):`, prompt.slice(0, 200))

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
