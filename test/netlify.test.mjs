import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { createAuth } from '../auth.mjs'
import { healthHandler } from '../netlify/health.mjs'
import { loginHandler } from '../netlify/login.mjs'
import { logoutHandler } from '../netlify/logout.mjs'
import { sessionHandler } from '../netlify/session.mjs'

function hash(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const key = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${key}`
}

process.env.HANDLER_PASSWORD_HASH = hash('shared password')
process.env.HANDLER_SECRET = 'handler-test-secret'

const auth = createAuth({
  passwordHashEnv: 'HANDLER_PASSWORD_HASH',
  secretEnv: 'HANDLER_SECRET',
  cookieName: 'handler_auth',
})

const login = loginHandler(auth, { delayMs: 0 })
const session = sessionHandler(auth)
const logout = logoutHandler(auth)
const health = healthHandler()

test('health reports availability without exposing configuration', async () => {
  const response = health(new Request('https://example.test/.netlify/functions/health'))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { ok: true })

  const post = health(new Request('https://example.test/.netlify/functions/health', {
    method: 'POST',
  }))
  assert.equal(post.status, 405)
})

test('login handler rejects unsupported methods and invalid JSON', async () => {
  assert.equal((await login(new Request('https://example.test/api/login'))).status, 405)

  const invalid = new Request('https://example.test/api/login', {
    method: 'POST',
    body: 'not-json',
  })
  assert.equal((await login(invalid)).status, 400)
})

test('login handler rejects a wrong password', async () => {
  const req = new Request('https://example.test/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'wrong' }),
  })
  assert.equal((await login(req)).status, 401)
})

test('login cookie authenticates session and logout clears it', async () => {
  const req = new Request('https://example.test/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'shared password' }),
  })
  const loginResponse = await login(req)
  assert.equal(loginResponse.status, 200)

  const setCookie = loginResponse.headers.get('set-cookie')
  assert.ok(setCookie)
  const cookie = setCookie.split(';')[0]
  const sessionResponse = session(new Request('https://example.test/api/session', {
    headers: { cookie },
  }))
  assert.equal(sessionResponse.status, 200)

  const logoutResponse = logout(new Request('https://example.test/api/logout', {
    method: 'POST',
  }))
  assert.equal(logoutResponse.status, 200)
  assert.match(logoutResponse.headers.get('set-cookie'), /Max-Age=0/)
})

test('session rejects missing cookies and non-GET requests', () => {
  assert.equal(session(new Request('https://example.test/api/session')).status, 401)
  assert.equal(session(new Request('https://example.test/api/session', { method: 'POST' })).status, 405)
})
