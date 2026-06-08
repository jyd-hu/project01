'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type AuthMode = 'login' | 'signup'

const inputClass =
  'w-full rounded border border-gray-200 bg-white p-2 text-gray-900 placeholder:text-gray-400'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [userCount, setUserCount] = useState<number | null>(null)

  useEffect(() => {
    let mounted = true

    async function loadUserCount() {
      try {
        const response = await fetch('/api/users/count')
        if (!response.ok || !mounted) return

        const payload = (await response.json()) as { count: number | null }
        if (mounted && typeof payload.count === 'number') {
          setUserCount(payload.count)
        }
      } catch {
        // Omit count if unavailable.
      }
    }

    void loadUserCount()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let mounted = true

    async function redirectIfSignedIn() {
      const { data } = await supabase.auth.getSession()

      if (mounted && data.session) {
        router.replace('/')
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        router.replace('/')
      }
    })

    void redirectIfSignedIn()

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [router])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) {
      setMessage('Enter your email and password.')
      return
    }

    setIsSubmitting(true)
    setMessage(null)

    const result =
      mode === 'login'
        ? await supabase.auth.signInWithPassword({
            email: trimmedEmail,
            password,
          })
        : await supabase.auth.signUp({
            email: trimmedEmail,
            password,
          })

    setIsSubmitting(false)

    if (result.error) {
      setMessage(result.error.message)
      return
    }

    if (result.data.session) {
      router.replace('/')
      return
    }

    setMessage('Check your email to confirm your account, then log in.')
  }

  const isSignup = mode === 'signup'

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-4">
      <section className="space-y-4 rounded-xl bg-gray-100 p-4 text-gray-900">
        <div>
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-2xl font-semibold">AI Financial Coach</h1>
            <span className="shrink-0 rounded bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
              dev
            </span>
          </div>
          <p className="text-sm text-gray-600">
            Helping young professionals build smarter money habits.
          </p>
        </div>

        <form className="space-y-3" onSubmit={(event) => void handleSubmit(event)}>
          <label className="block space-y-1 text-sm font-medium">
            <span>Email</span>
            <input
              className={inputClass}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>

          <label className="block space-y-1 text-sm font-medium">
            <span>Password</span>
            <input
              className={inputClass}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              required
            />
          </label>

          {message ? (
            <p className="text-sm text-red-600" role="alert">
              {message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded bg-black p-2 text-white disabled:cursor-not-allowed disabled:bg-gray-500"
          >
            {isSubmitting ? 'Please wait...' : isSignup ? 'Sign up' : 'Log in'}
          </button>
        </form>

        {isSignup ? (
          <button
            type="button"
            onClick={() => {
              setMode('login')
              setMessage(null)
            }}
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Already have an account? Log in
          </button>
        ) : (
          <div className="flex items-center justify-between gap-3 text-sm">
            {userCount !== null ? (
              <span className="text-gray-600">
                {userCount.toLocaleString()}{' '}
                {userCount === 1 ? 'user' : 'users'} registered
              </span>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={() => {
                setMode('signup')
                setMessage(null)
              }}
              className="font-medium text-blue-600 hover:text-blue-700"
            >
              Sign up
            </button>
          </div>
        )}
      </section>
    </main>
  )
}
