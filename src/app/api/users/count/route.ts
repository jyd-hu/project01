import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('get_user_count')

  if (error) {
    return NextResponse.json({ count: null })
  }

  const count = typeof data === 'number' ? data : Number(data)
  if (!Number.isFinite(count)) {
    return NextResponse.json({ count: null })
  }

  return NextResponse.json({ count })
}
