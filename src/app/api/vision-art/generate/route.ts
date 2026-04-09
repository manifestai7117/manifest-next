import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function buildPrompt(goal: any): Promise<{ prompt: string; negativePrompt: string }> {
  const gender = goal.user_gender && goal.user_gender !== 'Prefer not to say' ? goal.user_gender.toLowerCase() : null
  const ageRange = goal.user_age_range || null
  const aesthetic = goal.aesthetic || 'Bright & energetic'
  const regenCount = goal.vision_board_regenerations || 0

  // Person descriptor — only if we have data, keep it as silhouette/back-view
  const personDesc = gender === 'man' ? 'a man' : gender === 'woman' ? 'a woman' : 'a person'
  const ageDesc = ageRange && ageRange !== 'Prefer not to say' ? `in their ${ageRange}s` : ''

  // Aesthetic style
  const styleMap: Record<string, string> = {
    'Minimal & clean': 'clean minimal photography, soft natural light, neutral palette, editorial Kinfolk magazine style',
    'Bold & dark': 'cinematic dramatic photography, deep shadows, rich contrast, moody atmosphere, film noir inspired',
    'Warm & natural': 'golden hour photography, warm amber light, analog film aesthetic, National Geographic quality',
    'Bright & energetic': 'vibrant energetic photography, bold colors, dynamic composition, Nike campaign quality',
  }
  const styleDesc = styleMap[aesthetic] || styleMap['Bright & energetic']

  // Use Claude to generate a truly specific, cinematic scene description
  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: `Write a single cinematic image prompt for a vision board. 

Goal: "${goal.title}"
Why: "${goal.why || ''}"
Person: ${personDesc} ${ageDesc}
Visual style: ${styleDesc}
Variation seed: ${regenCount} (use this to make it different from previous versions)

Rules:
- The scene must DIRECTLY show the person achieving or in the world of: "${goal.title}"
- Person must be seen from BEHIND or as a SILHOUETTE — absolutely no faces, no frontal view
- Be extremely specific to the goal (tennis = tennis court, startup = modern office, marathon = finish line)
- Describe lighting, environment, time of day, specific details
- Make it deeply aspirational and emotionally powerful
- 2-3 sentences max, pure scene description only
- No quotes, no explanation, just the scene

Examples of good specificity:
- For "Run a marathon": "a lone runner silhouette crossing a marathon finish line tape at golden sunrise, arms raised, motion blur on legs, spectator crowd blurred in background, morning mist rising"
- For "Launch a startup": "a person silhouette standing at floor-to-ceiling windows of a modern loft office, back to camera, city skyline at night below, laptop and pitch deck on glass desk glowing"
- For "Become a 4.5 tennis player": "a tennis player silhouette from behind mid-serve on a clay court at golden hour, racket raised overhead, ball frozen at peak, empty stadium in background, long shadows across the court"`
    }]
  })

  const scene = res.content[0].type === 'text' ? res.content[0].text.trim() : ''

  const prompt = [
    `Breathtaking ${styleDesc}.`,
    scene,
    'Shot on Hasselblad H6D medium format camera, 85mm prime lens, f/1.8 aperture, cinematic depth of field.',
    'Professional color grading, deeply emotional and aspirational.',
    'Subject seen from behind or as silhouette only — absolutely no faces visible.',
    'No text, no letters, no words, no numbers, no watermarks anywhere.',
    'Ultra high resolution, award-winning photography, the kind of image that makes you believe anything is possible.',
  ].join(' ')

  const negativePrompt = [
    'face, faces, eyes, frontal portrait, looking at camera, selfie',
    gender === 'man' ? 'woman, female, girl, feminine' : gender === 'woman' ? 'man, male, boy, masculine' : '',
    'text, letters, words, numbers, signs, watermark, logo, caption',
    'ugly, deformed, distorted, bad anatomy, extra limbs, mutation',
    'cartoon, anime, illustration, painting, drawing, CGI, 3D render, sketch, digital art',
    'low quality, blurry, grainy, pixelated, overexposed, underexposed',
    'depressing, scary, dark mood, horror, sad, lonely',
    'stock photo look, generic, cheesy, fake, staged',
    'multiple people, crowd in foreground',
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

    // Build prompt using Claude
    const { prompt, negativePrompt } = await buildPrompt(goal)
    console.log(`Vision art prompt for "${goal.title}" (regen #${(goal.vision_board_regenerations || 0) + 1}):`, prompt.slice(0, 120))

    // Generate with fal.ai flux/dev
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
        guidance_scale: 4.0,
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
      console.error('flux/dev failed:', errText.slice(0, 300))
      // Fallback to schnell with same prompt
      const fallback = await fetch('https://fal.run/fal-ai/flux/schnell', {
        method: 'POST',
        headers: { 'Authorization': `Key ${falKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          image_size: 'portrait_4_3',
          num_inference_steps: 12,
          num_images: 1,
          seed,
        }),
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

    // Store in Supabase Storage
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
    } catch { /* use fal URL directly */ }

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
