import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import './auth-gate.css'

export type AuthGateProps = {
  children: ReactNode
  appName?: string
  loginUrl?: string
  sessionUrl?: string
  sessionCheckIntervalMs?: number
}

type Status = 'checking' | 'signed-out' | 'signed-in'

export function AuthGate({
  children,
  appName = 'Your App',
  loginUrl = '/.netlify/functions/login',
  sessionUrl = '/.netlify/functions/session',
  sessionCheckIntervalMs = 60_000,
}: AuthGateProps) {
  const [status, setStatus] = useState<Status>('checking')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    async function checkSession() {
      try {
        const response = await fetch(sessionUrl, {
          credentials: 'same-origin',
          signal: controller.signal,
        })
        setStatus(response.ok ? 'signed-in' : 'signed-out')
        if (response.ok) setError('')
      } catch (requestError: unknown) {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') return
        setError('Unable to reach the server. Please try again.')
        setStatus((current) => current === 'checking' ? 'signed-out' : current)
      }
    }

    void checkSession()
    const interval = sessionCheckIntervalMs > 0
      ? window.setInterval(checkSession, sessionCheckIntervalMs)
      : undefined
    window.addEventListener('focus', checkSession)

    return () => {
      controller.abort()
      if (interval !== undefined) window.clearInterval(interval)
      window.removeEventListener('focus', checkSession)
    }
  }, [sessionCheckIntervalMs, sessionUrl])

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const response = await fetch(loginUrl, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (!response.ok) {
        setError(response.status === 401 ? 'Incorrect password.' : 'Sign-in failed. Please try again.')
        return
      }

      setPassword('')
      setStatus('signed-in')
    } catch {
      setError('Unable to reach the server. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (status === 'checking') {
    return <div className="auth-gate__status" role="status">Checking session…</div>
  }

  if (status === 'signed-out') {
    return (
      <main className="auth-gate">
        <form className="auth-gate__card" onSubmit={signIn}>
          <div>
            <p className="auth-gate__eyebrow">{appName}</p>
            <h1>Sign in</h1>
            <p className="auth-gate__description">Enter the shared password to continue.</p>
          </div>

          <label>
            Password
            <span className="auth-gate__password">
              <input
                autoComplete="current-password"
                autoFocus
                disabled={submitting}
                onChange={(event) => setPassword(event.target.value)}
                required
                type={showPassword ? 'text' : 'password'}
                value={password}
              />
              <button
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                className="auth-gate__toggle"
                onClick={() => setShowPassword((current) => !current)}
                type="button"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </span>
          </label>

          <button disabled={submitting} type="submit">
            {submitting ? 'Signing in…' : 'Continue'}
          </button>
          <p className="auth-gate__error" role="alert">{error}</p>
        </form>
      </main>
    )
  }

  return <>{children}</>
}
