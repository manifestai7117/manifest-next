import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { goalId } = await request.json()
    if (!goalId) return NextResponse.json({ error: 'Missing goalId' }, { status: 400 })

    const { data: goal } = await supabase
      .from('goals')
      .select('*')
      .eq('id', goalId)
      .eq('user_id', user.id)
      .single()

    if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })

    const falKey = process.env.FAL_KEY
    if (!falKey) return NextResponse.json({ error: 'FAL_KEY not configured' }, { status: 500 })

    // Build person descriptor
    const gender = goal.user_gender && goal.user_gender !== 'Prefer not to say' ? goal.user_gender.toLowerCase() : 'person'
    const isMale = gender === 'man'
    const isFemale = gender === 'woman'
    const age = goal.user_age_range ? `${goal.user_age_range}-year-old` : ''
    const ethnicity = goal.user_ethnicity && goal.user_ethnicity !== 'Prefer not to say' ? goal.user_ethnicity : ''
    const personDesc = [ethnicity, age, gender].filter(Boolean).join(' ')

    // Aesthetic styles
    const aestheticStyle: Record<string, string> = {
      'Minimal & clean': 'Kinfolk magazine editorial, soft diffused light, clean neutral tones, elegant and minimal',
      'Bold & dark': 'dramatic cinematic photography, rich shadows, moody and powerful, Christopher Nolan film still',
      'Warm & natural': 'golden hour photography, warm amber tones, analog film grain, National Geographic quality',
      'Bright & energetic': 'vibrant Nike campaign photography, punchy colors, dynamic energy, aspirational',
    }
    const style = aestheticStyle[goal.aesthetic] || aestheticStyle['Bright & energetic']

    // Category + title based scene variations — multiple options per category for variety
    const category = (goal.category || '').toLowerCase()
    const title = (goal.title || '').toLowerCase()
    const regenCount = (goal.vision_board_regenerations || 0)

    // Scene variations — pick different one each regeneration
    const getScene = (): string => {
      const variation = regenCount % 4 // 4 variations per category

      if (title.includes('cod') || title.includes('program') || title.includes('develop') || title.includes('software') || title.includes('tech')) {
        const scenes = [
          `a ${personDesc} silhouette from behind at a sleek dark desk with three monitors glowing with code, city lights through floor-to-ceiling windows at night, blue-green screen light the only illumination`,
          `a ${personDesc} silhouette hunched over a glowing laptop in a dark minimalist home office, neon city reflections in the window, lines of code reflected in the glass`,
          `overhead view of ${personDesc} hands typing on a mechanical keyboard, multiple screens with terminal windows, late night atmosphere, a coffee cup steaming nearby`,
          `a ${personDesc} silhouette standing at a large monitor wall displaying a live dashboard and code, dramatic backlighting, startup office aesthetic at golden hour`,
        ]
        return scenes[variation]
      }

      if (title.includes('marathon') || title.includes('run') || title.includes('race')) {
        const scenes = [
          `a ${personDesc} silhouette crossing a marathon finish line at golden sunrise, arms raised in triumph, motion blur on the legs, golden mist rising from the track`,
          `a ${personDesc} silhouette from behind running alone on an empty coastal road at dawn, ocean on one side, dramatic sky`,
          `close-up of ${personDesc} running shoes pounding the ground at speed, motion blur, early morning mist, urban marathon route`,
          `a ${personDesc} silhouette running through a forest trail at golden hour, dappled light through trees, powerful stride, back to camera`,
        ]
        return scenes[variation]
      }

      if (title.includes('gym') || title.includes('fit') || title.includes('weight') || title.includes('body') || category.includes('health')) {
        const scenes = [
          `a ${personDesc} silhouette in a modern gym at sunrise, back to camera, standing before a mirror, dramatic light cutting through windows`,
          `a ${personDesc} silhouette at the top of a mountain hike, arms outstretched, vast landscape below, golden hour`,
          `a ${personDesc} silhouette doing yoga on a cliff edge at sunrise, ocean below, total peace and strength`,
          `a ${personDesc} silhouette in a dark gym, dramatic spotlight, weights in foreground, powerful and determined`,
        ]
        return scenes[variation]
      }

      if (title.includes('business') || title.includes('startup') || title.includes('launch') || category.includes('career') || category.includes('business')) {
        const scenes = [
          `a ${personDesc} silhouette standing at floor-to-ceiling windows of a high-rise, back to camera, overlooking a glowing city at golden hour`,
          `a ${personDesc} silhouette at a whiteboard covered in ideas, dramatic office light, city view behind, in deep thought`,
          `a ${personDesc} silhouette shaking hands across a boardroom table, city skyline at dusk through windows, powerful and confident`,
          `a ${personDesc} silhouette walking purposefully through a glass office building lobby, dramatic architectural light`,
        ]
        return scenes[variation]
      }

      if (title.includes('travel') || title.includes('trip') || title.includes('italy') || title.includes('europe') || category.includes('travel')) {
        const scenes = [
          `a ${personDesc} silhouette standing at the edge of a cliff overlooking a turquoise Mediterranean sea, back to camera, clothes billowing in the breeze`,
          `a ${personDesc} silhouette on a cobblestone street in an ancient European city at golden hour, warm light, total freedom`,
          `a ${personDesc} silhouette at the bow of a boat on crystal clear water, islands in the distance, golden afternoon light`,
          `a ${personDesc} silhouette on top of a mountain overlooking a valley with a historic village, dramatic sky`,
        ]
        return scenes[variation]
      }

      if (title.includes('write') || title.includes('novel') || title.includes('book') || title.includes('author')) {
        const scenes = [
          `${personDesc} hands typing on a vintage typewriter by a rain-streaked window, morning light, steaming coffee, stacked books in soft focus`,
          `a ${personDesc} silhouette at a writing desk in a cozy study, warm lamplight, bookshelves floor to ceiling, deep in thought`,
          `overhead of ${personDesc} hands writing in a leather journal at a cafe table, morning light, coffee and flowers`,
          `a ${personDesc} silhouette at a standing desk by a large window overlooking trees, laptop open, golden hour`,
        ]
        return scenes[variation]
      }

      if (title.includes('music') || title.includes('sing') || title.includes('guitar') || title.includes('album')) {
        const scenes = [
          `a ${personDesc} musician silhouette on a stage, back to the crowd, spotlight through dramatic smoke, thousands of blurred lights`,
          `a ${personDesc} silhouette playing guitar in a dark recording studio, dramatic lighting, equipment in background`,
          `a ${personDesc} silhouette at a piano in a sunlit room, back to camera, sheet music, golden afternoon light`,
          `a ${personDesc} silhouette performing on an outdoor stage at sunset, crowd silhouettes in foreground, dramatic sky`,
        ]
        return scenes[variation]
      }

      // Default symbolic scene
      const defaults = [
        `a ${personDesc} silhouette standing at the threshold of a vast glowing horizon, back to camera, arms slightly raised, golden light flooding the scene`,
        `a ${personDesc} silhouette on a hilltop at sunrise, back to camera, vast misty valley below, rays of sun breaking through clouds`,
        `a ${personDesc} silhouette walking toward a bright doorway of light, back to camera, symbolic and aspirational`,
        `a ${personDesc} silhouette at the edge of a calm lake at golden hour, back to camera, perfect reflection, total peace`,
      ]
      return defaults[variation]
    }

    const scene = getScene()

    const prompt = [
      `Breathtaking ${style}.`,
      `${scene}.`,
      `Shot on Hasselblad H6D medium format camera, 85mm lens, f/1.4 aperture, beautiful bokeh.`,
      `Cinematic color grading, deeply emotional and aspirational.`,
      `Subject seen from behind or as silhouette — no faces visible.`,
      `No text, no letters, no numbers, no words anywhere in the image.`,
      `The kind of image that makes you believe anything is possible.`,
      `Ultra high resolution, award-winning photography.`,
    ].join(' ')

    const negativePrompt = [
      'face, faces, frontal view, looking at camera',
      isMale ? 'woman, female, girl' : isFemale ? 'man, male, boy' : '',
      'text, letters, words, numbers, signs, watermark, logo',
      'ugly, deformed, distorted, bad anatomy',
      'cartoon, anime, illustration, CGI, 3D render, sketch',
      'low quality, blurry, grainy, pixelated',
      'dark, gloomy, depressing, scary',
      'stock photo, generic, cheesy',
    ].filter(Boolean).join(', ')

    console.log(`Generating art for: ${goal.title} (regen #${regenCount + 1})`)

    // Try flux/dev first, fall back to schnell
    let imageUrl: string | null = null

    const falRes = await fetch('https://fal.run/fal-ai/flux/dev', {
      method: 'POST',
      headers: { 'Authorization': `Key ${falKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        negative_prompt: negativePrompt,
        image_size: 'portrait_4_3',
        num_inference_steps: 28,
        guidance_scale: 3.5,
        num_images: 1,
        enable_safety_checker: true,
        output_format: 'jpeg',
        seed: Math.floor(Math.random() * 999999), // different seed every time
      }),
      signal: AbortSignal.timeout(90000),
    })

    if (falRes.ok) {
      const data = await falRes.json()
      imageUrl = data.images?.[0]?.url || null
    } else {
      const errText = await falRes.text()
      console.error('flux/dev failed:', errText.slice(0, 200))
      // Fallback to schnell
      const fallback = await fetch('https://fal.run/fal-ai/flux/schnell', {
        method: 'POST',
        headers: { 'Authorization': `Key ${falKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, image_size: 'portrait_4_3', num_inference_steps: 8, num_images: 1, seed: Math.floor(Math.random() * 999999) }),
        signal: AbortSignal.timeout(60000),
      })
      if (fallback.ok) {
        const data = await fallback.json()
        imageUrl = data.images?.[0]?.url || null
      } else {
        const fbErr = await fallback.text()
        return NextResponse.json({ error: fbErr.slice(0, 200) }, { status: 500 })
      }
    }

    if (!imageUrl) return NextResponse.json({ error: 'No image returned' }, { status: 500 })

    // Store in Supabase Storage
    let finalUrl = imageUrl
    try {
      const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) })
      if (imgRes.ok) {
        const buf = await imgRes.arrayBuffer()
        const path = `${user.id}/${goalId}-${Date.now()}.jpg`
        const { error: upErr } = await supabase.storage.from('vision-art').upload(path, buf, { contentType: 'image/jpeg', upsert: true })
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage.from('vision-art').getPublicUrl(path)
          finalUrl = publicUrl
        }
      }
    } catch { /* use fal URL */ }

    // Save to goal
    await supabase.from('goals').update({
      art_image_url: finalUrl,
      vision_board_last_generated: new Date().toISOString(),
      vision_board_regenerations: (goal.vision_board_regenerations || 0) + 1,
    }).eq('id', goalId)

    return NextResponse.json({ imageUrl: finalUrl })
  } catch (error: any) {
    console.error('Vision art error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
