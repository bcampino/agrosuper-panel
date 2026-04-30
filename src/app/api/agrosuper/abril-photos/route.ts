import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const formCode = searchParams.get('form_code')

  if (!formCode) {
    return NextResponse.json({ error: 'Missing form_code' }, { status: 400 })
  }

  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('agrosuper_abril_photos')
      .select('*')
      .eq('form_code', parseInt(formCode))

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Group photos by type
    const photoData: Record<string, string[]> = {}
    data?.forEach((photo: any) => {
      if (!photoData[photo.photo_type]) {
        photoData[photo.photo_type] = []
      }
      photoData[photo.photo_type].push(photo.photo_url)
    })

    return NextResponse.json(photoData)
  } catch (error) {
    console.error('Error fetching photos:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
