import { NextResponse } from 'next/server'
import { updateAiSummaryFeedback } from '@/lib/aiInsightsCache'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

type FeedbackBody = {
  id?: string
  feedback?: 'up' | 'down'
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: FeedbackBody

  try {
    body = (await request.json()) as FeedbackBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.id || (body.feedback !== 'up' && body.feedback !== 'down')) {
    return NextResponse.json(
      { error: 'Expected id and feedback ("up" or "down")' },
      { status: 400 }
    )
  }

  const result = await updateAiSummaryFeedback(supabase, body.id, body.feedback)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json(result)
}
