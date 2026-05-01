import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const formCode = searchParams.get('form_code')

    if (!formCode) {
      return NextResponse.json(
        { error: 'form_code is required' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('agrosuper_abril_photos')
      .select('photo_type, photo_url')
      .eq('form_code', parseInt(formCode))

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch photos' },
        { status: 500 }
      )
    }

    // Group photos by type
    const photosByType: Record<string, string[]> = {}

    ;(data || []).forEach((photo: any) => {
      if (!photosByType[photo.photo_type]) {
        photosByType[photo.photo_type] = []
      }
      photosByType[photo.photo_type].push(photo.photo_url)
    })

    return NextResponse.json(photosByType)
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
