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
          <h1 className="text-2xl font-semibold">
            {isSignup ? 'Create account' : 'Log in'}
          </h1>
          <p className="text-sm text-gray-600">
            {isSignup
              ? 'Sign up with your email and password.'
              : 'Log in to manage your expenses.'}
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

        <button
          type="button"
          onClick={() => {
            setMode(isSignup ? 'login' : 'signup')
            setMessage(null)
          }}
          className="text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          {isSignup
            ? 'Already have an account? Log in'
            : 'Need an account? Sign up'}
        </button>
      </section>
    </main>
  )
}
