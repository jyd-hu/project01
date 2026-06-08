import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const REASONS = new Set([
  'not_using',
  'missing_features',
  'privacy',
  'other',
])

type DeleteAccountBody = {
  reason?: string
  otherReason?: string
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }

  let body: DeleteAccountBody

  try {
    body = (await request.json()) as DeleteAccountBody
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const reason = body.reason?.trim()

  if (!reason || !REASONS.has(reason)) {
    return NextResponse.json({ error: 'Select a reason.' }, { status: 400 })
  }

  const otherReason = body.otherReason?.trim() ?? ''

  if (reason === 'other' && !otherReason) {
    return NextResponse.json(
      { error: 'Tell us more when selecting Other.' },
      { status: 400 }
    )
  }

  let admin

  try {
    admin = createSupabaseAdminClient()
  } catch {
    return NextResponse.json(
      { error: 'Account deletion is not configured.' },
      { status: 503 }
    )
  }

  const { error: insertError } = await admin
    .from('account_deletion_feedback')
    .insert({
      user_id: user.id,
      reason,
      other_reason: reason === 'other' ? otherReason : null,
    })

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  await supabase.auth.signOut()

  return NextResponse.json({ ok: true })
}
