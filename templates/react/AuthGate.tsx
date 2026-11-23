import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import './auth-gate.css'

type AuthGateProps = {
  children: ReactNode
  appName?: string
  loginUrl?: string
  sessionUrl?: string
}

type Status = 'checking' | 'signed-out' | 'signed-in'

export function AuthGate({
  children,
  appName = 'Your App',
  loginUrl = '/api/login',
  sessionUrl = '/api/session',
}: AuthGateProps) {
  const [status, setStatus] = useState<Status>('checking')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    fetch(sessionUrl, {
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then((response) => setStatus(response.ok ? 'signed-in' : 'signed-out'))
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') return
        setError('Unable to reach the server. Please try again.')
        setStatus('signed-out')
      })

    return () => controller.abort()
  }, [sessionUrl])

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
            <input
              autoComplete="current-password"
              autoFocus
              disabled={submitting}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
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
