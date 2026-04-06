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

    // Aesthetic to photography style
    const aestheticStyle: Record<string, string> = {
      'Minimal & clean':    'clean minimalist editorial photography, soft diffused natural light, airy white and neutral tones, Kinfolk magazine aesthetic, elegant negative space',
      'Bold & dark':        'dramatic cinematic photography, deep moody shadows, rich blacks, chiaroscuro lighting, epic and powerful, like a movie poster',
      'Warm & natural':     'golden hour lifestyle photography, warm amber and terracotta tones, film grain, analog photography feel, emotionally warm and human',
      'Bright & energetic': 'vibrant editorial photography, bright punchy colors, dynamic composition, Nike campaign quality, electric and aspirational',
    }
    const style = aestheticStyle[goal.aesthetic] || aestheticStyle['Bright & energetic']

    // Category-aware symbolic scene — evocative objects and environments, NO people, NO faces
    const category = (goal.category || '').toLowerCase()
    const title = (goal.title || '').toLowerCase()

    let sceneIdea = ''

    if (category.includes('health') || category.includes('fitness') || title.includes('marathon') || title.includes('run')) {
      sceneIdea = 'empty marathon finish line tape glowing in golden morning light, race numbers scattered on the ground, misty stadium in background, a single pair of running shoes'
    } else if (category.includes('financial') || title.includes('money') || title.includes('wealth') || title.includes('financial freedom')) {
      sceneIdea = 'a beautifully lit modern desk with an open laptop showing financial charts trending upward, a leather journal, morning coffee, floor to ceiling windows overlooking a city skyline at sunrise'
    } else if (category.includes('career') || category.includes('business') || title.includes('startup') || title.includes('launch') || title.includes('business')) {
      sceneIdea = 'a sleek modern office with city views at golden hour, an open notebook with bold handwritten goals, a coffee cup, architectural light and shadow casting dramatic patterns across the desk'
    } else if (category.includes('creative') || title.includes('write') || title.includes('novel') || title.includes('book') || title.includes('music') || title.includes('art')) {
      sceneIdea = 'a beautifully arranged writing desk by a rain-streaked window, an open journal with handwritten pages, soft morning light, a vintage typewriter or pen, stacked books with worn spines'
    } else if (category.includes('travel') || title.includes('travel') || title.includes('italy') || title.includes('europe') || title.includes('trip')) {
      sceneIdea = 'a cobblestone alley in a European village bathed in golden afternoon light, a vintage scooter parked by an ancient wall draped in bougainvillea, warm sun flares, no people'
    } else if (category.includes('relationship') || title.includes('love') || title.includes('family') || title.includes('connection')) {
      sceneIdea = 'two empty chairs on a sunlit porch overlooking a vast landscape, wildflowers in a mason jar, warm golden light, a sense of peace and belonging'
    } else if (category.includes('learning') || category.includes('education') || title.includes('degree') || title.includes('learn') || title.includes('skill')) {
      sceneIdea = 'a stack of beautifully curated books on a clean desk beside an open window, morning light streaming in, a fresh cup of coffee, a pen resting on an open notebook'
    } else if (category.includes('personal') || category.includes('growth') || title.includes('confidence') || title.includes('mindset')) {
      sceneIdea = 'a single sunlit path through a lush forest opening toward a brilliant horizon, morning mist rising, dew on leaves, a sense of infinite possibility ahead'
    } else {
      // Use the AI-generated art description as the scene if it's good
      sceneIdea = goal.art_description && goal.art_description.length > 30
        ? goal.art_description
        : `a stunning scene representing the achievement of ${goal.title}, symbolic and evocative, no people`
    }

    const prompt = [
      `Breathtaking ${style}.`,
      `${sceneIdea}.`,
      `No people, no faces, no humans, no body parts.`,
      `Shot on Hasselblad medium format camera.`,
      `Shallow depth of field, bokeh background.`,
      `Cinematic color grading, magazine cover quality.`,
      `Deeply emotional, aspirational, and beautiful.`,
      `The kind of image that makes you believe anything is possible.`,
      `Ultra high resolution, award-winning photography.`,
      `No text, no watermarks, no logos, no borders, no frames.`,
    ].join(' ')

    const negativePrompt = [
      'people, person, human, face, body, man, woman, hands, feet, skin',
      'ugly, deformed, distorted, disfigured',
      'cartoon, anime, illustration, painting, drawing, sketch, CGI, 3D render',
      'low quality, blurry, grainy, noisy, pixelated',
      'text, watermark, logo, signature, border, frame',
      'dark, gloomy, depressing, horror',
      'stock photo feel, generic, cheesy, oversaturated',
    ].join(', ')

    console.log('Generating vision art:', goal.title)
    console.log('Scene:', sceneIdea.slice(0, 100))

    // Use flux/dev for best quality
    const falResponse = await fetch('https://fal.run/fal-ai/flux/dev', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        negative_prompt: negativePrompt,
        image_size: 'portrait_4_3',
        num_inference_steps: 28,
        guidance_scale: 3.5,
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
      console.error('flux/dev failed:', falResponse.status, errText.slice(0, 200))

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
        const fallbackErr = await fallback.text()
        return NextResponse.json({ error: 'Image generation failed. Last error: ' + fallbackErr.slice(0, 200) }, { status: 500 })
      }
      const fallbackData = await fallback.json()
      imageUrl = fallbackData.images?.[0]?.url || null
    }

    if (!imageUrl) return NextResponse.json({ error: 'No image returned' }, { status: 500 })

    // Store in Supabase Storage
    let finalUrl = imageUrl
    try {
      const imageRes = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) })
      if (imageRes.ok) {
        const buf = await imageRes.arrayBuffer()
        const path = `${user.id}/${goalId}-${Date.now()}.jpg`
        const { error: upErr } = await supabase.storage.from('vision-art').upload(path, buf, { contentType: 'image/jpeg', upsert: true })
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage.from('vision-art').getPublicUrl(path)
          finalUrl = publicUrl
        }
      }
    } catch { /* use fal URL as fallback */ }

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