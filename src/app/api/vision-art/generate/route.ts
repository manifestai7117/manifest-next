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

    // Check 24h cooldown
    if (goal.vision_board_last_generated) {
      const hoursSince = (Date.now() - new Date(goal.vision_board_last_generated).getTime()) / 3600000
      if (hoursSince < 24) {
        return NextResponse.json({
          error: `Available in ${Math.ceil(24 - hoursSince)} hours`,
          hoursLeft: Math.ceil(24 - hoursSince)
        }, { status: 429 })
      }
    }

    const falKey = process.env.FAL_KEY
    if (!falKey) return NextResponse.json({ error: 'Image generation not configured' }, { status: 500 })

    // Build a vivid, photorealistic prompt
    const gender = goal.user_gender && goal.user_gender !== 'Prefer not to say' ? goal.user_gender.toLowerCase() : 'person'
    const age = goal.user_age_range ? `${goal.user_age_range} year old` : ''
    const ethnicity = goal.user_ethnicity && goal.user_ethnicity !== 'Prefer not to say' ? goal.user_ethnicity : ''
    const personDesc = [ethnicity, age, gender].filter(Boolean).join(' ')

    const aesthetic = goal.aesthetic || 'Bright & energetic'
    const styleMap: Record<string, string> = {
      'Minimal & clean': 'clean minimal photography, soft natural light, white background, editorial style',
      'Bold & dark': 'dramatic cinematic photography, deep shadows, moody lighting, high contrast',
      'Warm & natural': 'warm golden hour photography, natural tones, film grain, lifestyle photography',
      'Bright & energetic': 'vibrant editorial photography, dynamic composition, bright natural light, inspirational',
    }
    const styleDesc = styleMap[aesthetic] || styleMap['Bright & energetic']

    // Use the AI-generated art description if available, otherwise build from goal
    const sceneDesc = goal.art_description || goal.vision_art_prompt || `${personDesc} achieving: ${goal.title}`

    const prompt = `Professional inspirational photograph. ${sceneDesc}. ${styleDesc}. The subject is a ${personDesc}. Ultra realistic, high quality DSLR photography, 8K resolution, shallow depth of field, professional color grading. No text, no watermarks, no logos.`

    const negativePrompt = 'cartoon, illustration, drawing, anime, sketch, painting, CGI, 3D render, low quality, blurry, distorted, text, watermark, logo, ugly, deformed, stick figure, clipart'

    // Call fal.ai flux model
    const falResponse = await fetch('https://fal.run/fal-ai/flux/schnell', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        negative_prompt: negativePrompt,
        image_size: 'portrait_4_3',
        num_inference_steps: 4,
        num_images: 1,
        enable_safety_checker: true,
      })
    })

    if (!falResponse.ok) {
      const err = await falResponse.text()
      console.error('fal.ai error:', err)
      return NextResponse.json({ error: 'Image generation failed' }, { status: 500 })
    }

    const falData = await falResponse.json()
    const imageUrl = falData.images?.[0]?.url

    if (!imageUrl) return NextResponse.json({ error: 'No image returned' }, { status: 500 })

    // Download and store in Supabase Storage for persistence
    const imageRes = await fetch(imageUrl)
    const imageBuffer = await imageRes.arrayBuffer()
    const imagePath = `vision-art/${user.id}/${goalId}-${Date.now()}.jpg`

    const { error: uploadError } = await supabase.storage
      .from('vision-art')
      .upload(imagePath, imageBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
      })

    let finalUrl = imageUrl // fallback to fal URL if storage fails
    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage.from('vision-art').getPublicUrl(imagePath)
      finalUrl = publicUrl
    }

    // Update goal with new image URL
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