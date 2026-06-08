'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { OptionCard } from '@/components/onboarding/OptionCard'
import { supabase } from '@/lib/supabase'

const DELETE_REASONS = [
  { value: 'not_using', label: "I don't use it anymore" },
  { value: 'missing_features', label: 'Missing features I need' },
  { value: 'privacy', label: 'Privacy concerns' },
  { value: 'other', label: 'Other' },
] as const

type DeleteReason = (typeof DELETE_REASONS)[number]['value']

type DeleteStep = 'reason' | 'confirm'

const inputClass =
  'w-full rounded border border-gray-200 bg-white p-2 text-gray-900 placeholder:text-gray-400'

export function DeleteAccountSection() {
  const router = useRouter()
  const [step, setStep] = useState<DeleteStep | null>(null)
  const [reason, setReason] = useState<DeleteReason | null>(null)
  const [otherReason, setOtherReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  function closeDialog() {
    if (deleting) return
    setStep(null)
    setReason(null)
    setOtherReason('')
    setError(null)
  }

  function openReasonStep() {
    setStep('reason')
    setReason(null)
    setOtherReason('')
    setError(null)
  }

  function continueToConfirm() {
    if (!reason) return
    if (reason === 'other' && !otherReason.trim()) {
      setError('Tell us more when selecting Other.')
      return
    }
    setError(null)
    setStep('confirm')
  }

  async function deleteAccount() {
    if (!reason) return

    setDeleting(true)
    setError(null)

    try {
      const response = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason,
          otherReason: reason === 'other' ? otherReason.trim() : undefined,
        }),
      })

      const data = (await response.json()) as { error?: string }

      if (!response.ok) {
        setError(data.error ?? 'Unable to delete account.')
        setDeleting(false)
        return
      }

      await supabase.auth.signOut()
      router.replace('/login')
    } catch {
      setError('Unable to delete account.')
      setDeleting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openReasonStep}
        className="mt-2 w-full text-sm text-red-600 hover:underline"
      >
        Delete account
      </button>

      {step ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="presentation"
          onClick={closeDialog}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            className="w-full max-w-md rounded-xl bg-white p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {step === 'reason' ? (
              <>
                <h2
                  id="delete-account-title"
                  className="text-base font-medium text-gray-900"
                >
                  Why are you leaving?
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Your feedback helps us improve.
                </p>
                <div className="mt-4 space-y-2">
                  {DELETE_REASONS.map((option) => (
                    <OptionCard
                      key={option.value}
                      label={option.label}
                      selected={reason === option.value}
                      onToggle={() => setReason(option.value)}
                    />
                  ))}
                </div>
                {reason === 'other' ? (
                  <input
                    className={`${inputClass} mt-3`}
                    placeholder="Tell us more"
                    value={otherReason}
                    onChange={(e) => setOtherReason(e.target.value)}
                  />
                ) : null}
                {error ? (
                  <p className="mt-3 text-sm text-red-600" role="alert">
                    {error}
                  </p>
                ) : null}
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={closeDialog}
                    className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={continueToConfirm}
                    disabled={!reason}
                    className="flex-1 rounded-lg bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
                  >
                    Continue
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2
                  id="delete-account-title"
                  className="text-base font-medium text-gray-900"
                >
                  Delete your account?
                </h2>
                <p className="mt-2 text-sm text-gray-600">
                  This permanently deletes your account and all expenses,
                  categories, and budgets. This cannot be undone.
                </p>
                {error ? (
                  <p className="mt-3 text-sm text-red-600" role="alert">
                    {error}
                  </p>
                ) : null}
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setError(null)
                      setStep('reason')
                    }}
                    disabled={deleting}
                    className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteAccount()}
                    disabled={deleting}
                    className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {deleting ? 'Deleting…' : 'Delete account'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}
