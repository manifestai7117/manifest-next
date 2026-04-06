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
    if (!falKey) {
      console.error('FAL_KEY not set')
      return NextResponse.json({ error: 'FAL_KEY not configured in environment variables' }, { status: 500 })
    }

    // Build prompt
    const gender = goal.user_gender && goal.user_gender !== 'Prefer not to say' ? goal.user_gender.toLowerCase() : 'person'
    const age = goal.user_age_range ? `${goal.user_age_range} year old` : ''
    const ethnicity = goal.user_ethnicity && goal.user_ethnicity !== 'Prefer not to say' ? goal.user_ethnicity : ''
    const personDesc = [ethnicity, age, gender].filter(Boolean).join(' ')

    const styleMap: Record<string, string> = {
      'Minimal & clean': 'clean minimal photography, soft natural light, white tones, editorial lifestyle',
      'Bold & dark': 'dramatic cinematic photography, deep shadows, moody high contrast lighting',
      'Warm & natural': 'warm golden hour photography, natural earth tones, film grain, lifestyle',
      'Bright & energetic': 'vibrant editorial photography, bright dynamic lighting, high energy, inspirational',
    }
    const styleDesc = styleMap[goal.aesthetic] || styleMap['Bright & energetic']
    const sceneDesc = goal.art_description || `${personDesc} actively achieving: ${goal.title}`
    const prompt = `Photorealistic inspirational photograph. ${sceneDesc}. ${styleDesc}. Ultra realistic DSLR photography, 8K, professional color grading, cinematic composition. No text, no watermarks.`

    console.log('Calling fal.ai with prompt:', prompt.slice(0, 100))

    // Try fal-ai/flux/schnell first, fall back to fal-ai/fast-sdxl
    let imageUrl: string | null = null
    let lastError = ''

    const endpoints = [
      {
        url: 'https://fal.run/fal-ai/flux/schnell',
        body: {
          prompt,
          image_size: 'portrait_4_3',
          num_inference_steps: 4,
          num_images: 1,
          enable_safety_checker: true,
        }
      },
      {
        url: 'https://fal.run/fal-ai/flux/dev',
        body: {
          prompt,
          image_size: 'portrait_4_3',
          num_inference_steps: 28,
          num_images: 1,
          enable_safety_checker: true,
        }
      },
      {
        url: 'https://fal.run/fal-ai/fast-sdxl',
        body: {
          prompt,
          negative_prompt: 'cartoon, illustration, drawing, anime, sketch, text, watermark, logo, ugly, deformed',
          image_size: 'portrait_4_3',
          num_inference_steps: 25,
          num_images: 1,
        }
      }
    ]

    for (const endpoint of endpoints) {
      try {
        console.log('Trying endpoint:', endpoint.url)
        const falResponse = await fetch(endpoint.url, {
          method: 'POST',
          headers: {
            'Authorization': `Key ${falKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(endpoint.body),
          signal: AbortSignal.timeout(55000), // 55 second timeout
        })

        const responseText = await falResponse.text()
        console.log('fal.ai response status:', falResponse.status)
        console.log('fal.ai response:', responseText.slice(0, 300))

        if (!falResponse.ok) {
          lastError = `${falResponse.status}: ${responseText}`
          continue // try next endpoint
        }

        const falData = JSON.parse(responseText)
        imageUrl = falData.images?.[0]?.url || falData.image?.url || null

        if (imageUrl) {
          console.log('Got image URL:', imageUrl.slice(0, 80))
          break
        }
      } catch (endpointError: any) {
        lastError = endpointError.message
        console.error('Endpoint error:', endpointError.message)
        continue
      }
    }

    if (!imageUrl) {
      console.error('All endpoints failed. Last error:', lastError)
      return NextResponse.json({
        error: 'Image generation failed. Last error: ' + lastError
      }, { status: 500 })
    }

    // Try to store in Supabase Storage (optional — use fal URL as fallback)
    let finalUrl = imageUrl
    try {
      const imageRes = await fetch(imageUrl)
      if (imageRes.ok) {
        const imageBuffer = await imageRes.arrayBuffer()
        const imagePath = `${user.id}/${goalId}-${Date.now()}.jpg`
        const { error: uploadError } = await supabase.storage
          .from('vision-art')
          .upload(imagePath, imageBuffer, { contentType: 'image/jpeg', upsert: true })

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage.from('vision-art').getPublicUrl(imagePath)
          finalUrl = publicUrl
        }
      }
    } catch (storageError) {
      console.log('Storage upload failed, using fal URL directly:', storageError)
    }

    // Save to database
    await supabase.from('goals').update({
      art_image_url: finalUrl,
      vision_board_last_generated: new Date().toISOString(),
      vision_board_regenerations: (goal.vision_board_regenerations || 0) + 1,
    }).eq('id', goalId)

    return NextResponse.json({ imageUrl: finalUrl })
  } catch (error: any) {
    console.error('Vision art generation error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}