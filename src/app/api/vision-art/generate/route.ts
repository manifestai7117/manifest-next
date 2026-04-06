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

    // Gender descriptor for scene
    const gender = goal.user_gender
    const isMale = gender === 'Man'
    const isFemale = gender === 'Woman'
    const genderWord = isMale ? 'man' : isFemale ? 'woman' : 'person'
    const genderPronoun = isMale ? 'his' : isFemale ? 'her' : 'their'

    // Aesthetic to photography style
    const aestheticStyle: Record<string, string> = {
      'Minimal & clean':    'Kinfolk magazine editorial photography, soft diffused light, clean neutral tones, elegant and minimal',
      'Bold & dark':        'dramatic cinematic photography, rich deep shadows, moody and powerful, Christopher Nolan film still quality',
      'Warm & natural':     'golden hour photography, warm amber tones, analog film grain, emotionally resonant, National Geographic quality',
      'Bright & energetic': 'vibrant Nike campaign photography, punchy colors, dynamic energy, electric and aspirational',
    }
    const style = aestheticStyle[goal.aesthetic] || aestheticStyle['Bright & energetic']

    const category = (goal.category || '').toLowerCase()
    const title = (goal.title || '').toLowerCase()
    const why = (goal.why || '').toLowerCase()

    // Smart keyword matching — title takes priority over category
    let scene = ''

    // CODING / PROGRAMMING / TECH
    if (title.includes('cod') || title.includes('program') || title.includes('develop') || title.includes('software') || title.includes('tech') || title.includes('engineer') || title.includes('app') || title.includes('web') || (category.includes('career') && why.includes('cod'))) {
      scene = `a ${genderWord} silhouette seen from behind, sitting at a sleek minimal desk with multiple monitors glowing with lines of code, dark room lit only by the blue-green screen light, city lights twinkling through floor-to-ceiling windows at night, ${genderPronoun} reflection faintly visible in the glass, intense focus and quiet determination`

    // MARATHON / RUNNING / FITNESS
    } else if (title.includes('marathon') || title.includes('run') || title.includes('race') || title.includes('triathlon')) {
      scene = `a ${genderWord} silhouette from behind crossing a marathon finish line at golden sunrise, arms raised in triumph, motion blur on ${genderPronoun} legs, golden mist rising from the track, stadium lights fading into dawn light, deeply emotional`

    // GYM / WEIGHT LOSS / FITNESS
    } else if (title.includes('gym') || title.includes('weight') || title.includes('fit') || title.includes('muscle') || title.includes('body') || category.includes('health')) {
      scene = `a ${genderWord} silhouette in a modern gym at sunrise, back to camera, standing before a large mirror, dramatic light cutting through floor-to-ceiling windows, equipment in soft focus, powerful and determined atmosphere`

    // FINANCIAL / WEALTH / MONEY
    } else if (title.includes('financ') || title.includes('money') || title.includes('wealth') || title.includes('invest') || title.includes('save') || title.includes('rich') || category.includes('financial')) {
      scene = `hands of a ${genderWord} holding a small thriving plant growing from rich soil placed on a clean marble surface, morning light streaming through a window, a blurred city skyline in background, symbolizing financial growth and abundance`

    // STARTUP / BUSINESS / LAUNCH
    } else if (title.includes('startup') || title.includes('launch') || title.includes('business') || title.includes('company') || title.includes('found') || title.includes('brand') || category.includes('business')) {
      scene = `a ${genderWord} silhouette standing confidently at floor-to-ceiling windows of a high-rise, back to camera, overlooking a glowing city skyline at golden hour, ${genderPronoun} reflection visible in the glass, a whiteboard with ideas faintly visible behind`

    // WRITING / BOOK / NOVEL
    } else if (title.includes('write') || title.includes('novel') || title.includes('book') || title.includes('author') || title.includes('publish')) {
      scene = `${genderWord}'s hands typing on a vintage typewriter on a wooden desk beside a rain-streaked window, morning light, a steaming coffee cup, stacked books in soft focus, creative and cozy atmosphere, cinematic warmth`

    // MUSIC
    } else if (title.includes('music') || title.includes('sing') || title.includes('guitar') || title.includes('piano') || title.includes('album') || title.includes('band')) {
      scene = `a ${genderWord} musician silhouette on a stage, back to the crowd, spotlight cutting through dramatic smoke, thousands of blurred lights stretching into the darkness, arms outstretched, pure euphoria`

    // TRAVEL
    } else if (title.includes('travel') || title.includes('italy') || title.includes('europe') || title.includes('trip') || title.includes('visit') || title.includes('world') || category.includes('travel')) {
      scene = `a ${genderWord} silhouette standing at the edge of a sun-drenched cliff, back to camera, overlooking a breathtaking turquoise Mediterranean coastline, light clothes billowing in the breeze, pure freedom`

    // CREATIVE ART / DESIGN
    } else if (title.includes('design') || title.includes('creat') || title.includes('art') || title.includes('paint') || category.includes('creative')) {
      scene = `a ${genderWord} silhouette from behind, standing in front of a massive canvas in a sunlit studio, paint-streaked walls, warm afternoon light streaming through tall windows, creating something extraordinary`

    // LEARNING / EDUCATION / DEGREE
    } else if (title.includes('learn') || title.includes('study') || title.includes('degree') || title.includes('graduate') || title.includes('course') || category.includes('learning')) {
      scene = `a ${genderWord} silhouette in a grand university lecture hall, back to camera, walking toward a bright light at the end of a long corridor lined with doors of opportunity, symbolic and aspirational`

    // PERSONAL GROWTH / MINDSET / MEDITATION
    } else if (title.includes('meditat') || title.includes('mindset') || title.includes('confidence') || title.includes('mental') || category.includes('personal')) {
      scene = `a ${genderWord} silhouette sitting in meditation on a mountain summit at sunrise, back to camera, legs crossed, arms resting on knees, vast misty valley stretching below, golden rays breaking through dramatic clouds`

    // RELATIONSHIP
    } else if (category.includes('relationship') || title.includes('love') || title.includes('family') || title.includes('partner') || title.includes('friend')) {
      scene = `two silhouettes on a hilltop at sunset, sitting side by side, back to camera, wildflowers in foreground, vast golden landscape, warmth and deep human connection radiating from the scene`

    // DEFAULT — use art description or make something symbolic
    } else {
      const artDesc = goal.art_description || ''
      scene = artDesc.length > 30
        ? `${artDesc}, ${genderWord} silhouette, back to camera, no faces, dreamlike and cinematic`
        : `a ${genderWord} silhouette standing at the threshold of a vast glowing horizon, back to camera, arms slightly raised, golden light flooding the scene, representing the achievement of ${goal.title}`
    }

    const prompt = [
      `Breathtaking ${style}.`,
      `${scene}.`,
      `Shot on Hasselblad H6D medium format camera, 85mm lens, f/1.4 aperture, beautiful bokeh.`,
      `Cinematic color grading, film quality, deeply emotional.`,
      `Subject seen from behind or as a silhouette — absolutely no faces visible.`,
      `No text, no letters, no numbers, no words, no signs anywhere in the image.`,
      `Motivational, dreamlike, and deeply aspirational.`,
      `The kind of image that makes you believe anything is possible.`,
      `Ultra high resolution, award-winning photography.`,
    ].join(' ')

    const negativePrompt = [
      'face, faces, portrait, frontal view, looking at camera, eyes, nose, mouth',
      'female, woman, girl, lady',  // only add opposite gender to negative
      'text, letters, words, numbers, signs, labels, captions, watermark, logo, brand',
      'ugly, deformed, distorted, bad anatomy, extra limbs',
      'cartoon, anime, illustration, painting, CGI, 3D render, sketch',
      'low quality, blurry, grainy, pixelated',
      'dark, gloomy, depressing, scary',
      'stock photo, generic, cheesy',
    ]

    // Remove opposite gender from negative prompt based on user
    const finalNegative = isMale
      ? negativePrompt.filter(p => !p.includes('female')) // keep female in negative for male user
      : isFemale
        ? [...negativePrompt.filter(p => !p.includes('female')), 'man, male, boy, masculine']
        : negativePrompt.filter(p => !p.includes('female'))

    console.log('Generating art for:', goal.title, '| Gender:', genderWord)
    console.log('Scene:', scene.slice(0, 120))

    const falResponse = await fetch('https://fal.run/fal-ai/flux/dev', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        negative_prompt: finalNegative.join(', '),
        image_size: 'portrait_4_3',
        num_inference_steps: 35,
        guidance_scale: 4.0,
        num_images: 1,
        enable_safety_checker: true,
        output_format: 'jpeg',
      }),
      signal: AbortSignal.timeout(90000),
    })

    let imageUrl: string | null = null

    if (falResponse.ok) {
      const falData = await falResponse.json()
      imageUrl = falData.images?.[0]?.url || null
    } else {
      const errText = await falResponse.text()
      console.error('flux/dev failed:', falResponse.status, errText.slice(0, 300))

      // Fallback to schnell
      const fallback = await fetch('https://fal.run/fal-ai/flux/schnell', {
        method: 'POST',
        headers: { 'Authorization': `Key ${falKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          image_size: 'portrait_4_3',
          num_inference_steps: 8,
          num_images: 1,
          enable_safety_checker: true,
        }),
        signal: AbortSignal.timeout(60000),
      })
      if (!fallback.ok) {
        const fbErr = await fallback.text()
        return NextResponse.json({ error: 'Image generation failed: ' + fbErr.slice(0, 200) }, { status: 500 })
      }
      const fbData = await fallback.json()
      imageUrl = fbData.images?.[0]?.url || null
    }

    if (!imageUrl) return NextResponse.json({ error: 'No image returned' }, { status: 500 })

    // Store in Supabase Storage
    let finalUrl = imageUrl
    try {
      const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) })
      if (imgRes.ok) {
        const buf = await imgRes.arrayBuffer()
        const path = `${user.id}/${goalId}-${Date.now()}.jpg`
        const { error: upErr } = await supabase.storage
          .from('vision-art')
          .upload(path, buf, { contentType: 'image/jpeg', upsert: true })
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage.from('vision-art').getPublicUrl(path)
          finalUrl = publicUrl
        }
      }
    } catch { /* use fal URL */ }

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