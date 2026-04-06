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

    const aestheticStyle: Record<string, string> = {
      'Minimal & clean':    'Kinfolk magazine editorial photography, soft diffused light, clean neutral tones, elegant and minimal',
      'Bold & dark':        'dramatic cinematic photography, rich shadows, moody and powerful, like a Christopher Nolan film still',
      'Warm & natural':     'golden hour photography, warm amber tones, analog film grain, emotionally resonant, National Geographic quality',
      'Bright & energetic': 'vibrant Nike campaign photography, punchy colors, dynamic motion blur, electric energy, aspirational',
    }
    const style = aestheticStyle[goal.aesthetic] || aestheticStyle['Bright & energetic']

    const category = (goal.category || '').toLowerCase()
    const title = (goal.title || '').toLowerCase()

    // Scenes: people allowed but NEVER showing faces — silhouettes, backs, side profiles, hands, feet
    // No text, no numbers, no words in the image
    let scene = ''

    if (category.includes('health') || category.includes('fitness') || title.includes('marathon') || title.includes('run') || title.includes('gym') || title.includes('weight')) {
      scene = 'a lone runner silhouetted against a blazing sunrise at the finish line of a marathon, arms outstretched in victory, motion blur on the legs, golden mist rising from the track, shot from behind at ground level, cinematic and emotional'
    } else if (category.includes('financial') || title.includes('money') || title.includes('wealth') || title.includes('invest') || title.includes('save') || title.includes('financial')) {
      scene = 'hands holding a small plant growing from a pile of soil on a clean white surface, morning light streaming through a window casting long shadows, shallow depth of field, symbolizing growth and abundance'
    } else if (category.includes('career') || category.includes('business') || title.includes('startup') || title.includes('launch') || title.includes('business') || title.includes('app')) {
      scene = 'a person in a sharp suit standing at floor-to-ceiling windows of a high-rise office, back to camera, overlooking a glowing city at golden hour, arms relaxed at sides, silhouette bathed in warm amber light'
    } else if (title.includes('write') || title.includes('novel') || title.includes('book') || title.includes('author')) {
      scene = 'hands typing on a vintage typewriter on a wooden desk beside a rain-streaked window, morning light, a steaming coffee cup, stacked books in soft focus background, cozy and creative atmosphere'
    } else if (category.includes('creative') || title.includes('music') || title.includes('sing') || title.includes('paint') || title.includes('art')) {
      scene = 'a musician silhouetted on a stage, back to the audience, spotlight cutting through dramatic smoke, crowd of blurred lights stretching into the distance, concert photography, powerful and dreamlike'
    } else if (category.includes('travel') || title.includes('travel') || title.includes('italy') || title.includes('europe') || title.includes('trip') || title.includes('visit')) {
      scene = 'a solo traveler standing at the edge of a sun-drenched cliff overlooking a turquoise Mediterranean sea, back to camera, light summer clothes billowing gently in the breeze, total freedom and wanderlust'
    } else if (category.includes('relationship') || title.includes('love') || title.includes('family') || title.includes('friend')) {
      scene = 'two silhouettes sitting together on a hilltop watching a breathtaking sunset, warm golden light, wildflowers in foreground, shot from behind, radiating peace love and connection'
    } else if (category.includes('learning') || category.includes('education') || title.includes('degree') || title.includes('learn') || title.includes('study')) {
      scene = 'a student silhouette in a beautiful library, back to camera, reaching for a book on a tall shelf, warm amber library light, rows of books stretching endlessly, dust particles in the light beams'
    } else if (category.includes('personal') || category.includes('growth') || title.includes('confidence') || title.includes('mindset') || title.includes('meditation')) {
      scene = 'a lone person sitting in meditation on a mountain summit at sunrise, back to camera, arms resting on knees, vast misty valley below, rays of sun breaking through clouds, transcendent and peaceful'
    } else {
      // Use the AI art description but strip any face/text references
      const artDesc = goal.art_description || ''
      scene = artDesc.length > 30
        ? `${artDesc} — shot from behind or as a silhouette, no faces visible, dreamlike and cinematic`
        : `a person silhouetted against a breathtaking landscape that symbolizes achieving ${goal.title}, back to camera, golden hour light, vast and inspiring`
    }

    const prompt = [
      `Breathtaking ${style}.`,
      `${scene}.`,
      `Hyper-realistic photography, shot on Hasselblad H6D, 50mm lens, f/1.4 aperture, shallow depth of field.`,
      `Cinematic color grading, film quality.`,
      `No faces visible — subject seen from behind, silhouetted, or in profile only.`,
      `No text, no letters, no numbers, no words anywhere in the image.`,
      `Deeply emotional, motivational, and dreamlike.`,
      `The kind of image that makes you feel you can achieve anything.`,
      `Award-winning photography, 8K resolution.`,
    ].join(' ')

    const negativePrompt = [
      'face, faces, portrait, looking at camera, frontal view',
      'text, letters, words, numbers, signs, labels, captions, watermark, logo',
      'ugly, deformed, distorted, bad anatomy',
      'cartoon, anime, illustration, painting, CGI, 3D render, sketch',
      'low quality, blurry, grainy, pixelated, noisy',
      'dark, gloomy, depressing, scary, horror',
      'stock photo, generic, cheesy',
    ].join(', ')

    console.log('Generating vision art for:', goal.title)

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
      console.log('flux/dev succeeded')
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
      console.log('flux/schnell fallback succeeded')
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