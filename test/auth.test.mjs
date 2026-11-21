// Test senza deploy e senza rete: node --test
import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { createAuth } from '../auth.mjs'

function hash(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const key = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${key}`
}

const SECRET = 'test-secret'
process.env.T_HASH = hash('shared pass')
process.env.T_SECRET = SECRET
process.env.T_BEARER = 'test-bearer'
process.env.T_USER = 'team'

const auth = createAuth({
  passwordHashEnv: 'T_HASH',
  secretEnv: 'T_SECRET',
  bearerEnv: 'T_BEARER',
  userEnv: 'T_USER',
  cookieName: 'test_auth',
  maxAgeDays: 30,
})

const basicAuth = createAuth({
  passwordHashEnv: 'T_HASH',
  secretEnv: 'T_SECRET',
  bearerEnv: 'T_BEARER',
  userEnv: 'T_USER',
  cookieName: 'test_auth',
  maxAgeDays: 30,
  basic: true,
})

const req = (url = 'https://example.test/', headers = {}) =>
  new Request(url, { headers })

const cookieFrom = (setCookie) => setCookie.split(';')[0]

const withCookie = (value, url = 'https://example.test/') =>
  req(url, { cookie: `test_auth=${value}` })

const cookieValue = (setCookie) => cookieFrom(setCookie).split('=')[1]

const basic = (user, password) =>
  'Basic ' + Buffer.from(`${user}:${password}`).toString('base64')

test('issueCookie: attributi di sicurezza', () => {
  const header = auth.issueCookie(req())
  assert.match(header, /HttpOnly/)
  assert.match(header, /SameSite=Lax/)
  assert.match(header, /Path=\//)
  assert.match(header, /Secure/)
  assert.match(header, /Max-Age=2592000/)
})

test('issueCookie su http non mette Secure', () => {
  const header = auth.issueCookie(req('http://localhost:8888/'))
  assert.doesNotMatch(header, /Secure/)
})

test('cookie emesso e verificato', () => {
  const header = auth.issueCookie(req())
  assert.equal(auth.verifyCookie(withCookie(cookieValue(header))), true)
})

test('cookie assente o manomesso', () => {
  assert.equal(auth.verifyCookie(req()), false)
  const header = auth.issueCookie(req())
  const value = cookieValue(header)
  assert.equal(auth.verifyCookie(withCookie(value + 'x')), false)
  assert.equal(auth.verifyCookie(withCookie('v1.1.deadbeef')), false)
})

test('cookie scaduto', () => {
  const old = Math.floor(Date.now() / 1000) - 31 * 86400
  const payload = `v1.${old}`
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url')
  assert.equal(auth.verifyCookie(withCookie(`${payload}.${sig}`)), false)
})

test('cookie con data futura', () => {
  const future = Math.floor(Date.now() / 1000) + 3600
  const payload = `v1.${future}`
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url')
  assert.equal(auth.verifyCookie(withCookie(`${payload}.${sig}`)), false)
})

test('cookie firmato con un altro segreto', () => {
  process.env.T_SECRET2 = 'other-secret'
  const other = createAuth({
    passwordHashEnv: 'T_HASH',
    secretEnv: 'T_SECRET2',
    bearerEnv: 'T_BEARER',
    cookieName: 'test_auth',
  })
  const header = other.issueCookie(req())
  assert.equal(auth.verifyCookie(withCookie(cookieValue(header))), false)
})

test('clearCookie scade il cookie', () => {
  assert.match(auth.clearCookie(req()), /Max-Age=0/)
  assert.match(auth.clearCookie(req()), /test_auth=;/)
})

test('bearer', () => {
  assert.equal(auth.verifyBearer(req('https://example.test/', { authorization: 'Bearer test-bearer' })), true)
  assert.equal(auth.verifyBearer(req('https://example.test/', { authorization: 'Bearer wrong' })), false)
  assert.equal(auth.verifyBearer(req()), false)
})

test('password', () => {
  assert.equal(auth.verifyPassword('shared pass'), true)
  assert.equal(auth.verifyPassword('wrong'), false)
  assert.equal(auth.verifyPassword(''), false)
})

test('basic disabilitato per default', () => {
  const header = basic('team', 'shared pass')
  assert.equal(auth.verifyBasic(req('https://example.test/', { authorization: header })), false)
})

test('basic abilitato', () => {
  const header = basic('team', 'shared pass')
  assert.equal(basicAuth.verifyBasic(req('https://example.test/', { authorization: header })), true)
  assert.equal(basicAuth.verifyBasic(req('https://example.test/', { authorization: basic('team', 'wrong') })), false)
  assert.equal(basicAuth.verifyBasic(req('https://example.test/', { authorization: basic('other', 'shared pass') })), false)
})

test('unauthorized: JSON 401 e sfida solo in modalità basic', () => {
  const plain = auth.unauthorized()
  assert.equal(plain.status, 401)
  assert.equal(plain.headers.get('WWW-Authenticate'), null)
  const withBasic = basicAuth.unauthorized()
  assert.match(withBasic.headers.get('WWW-Authenticate'), /Basic realm="Protected"/)
})

test('authorized accetta cookie e bearer, non basic se disabilitato', () => {
  const header = auth.issueCookie(req())
  assert.equal(auth.authorized(withCookie(cookieValue(header))), true)
  assert.equal(auth.authorized(req('https://example.test/', { authorization: 'Bearer test-bearer' })), true)
  assert.equal(auth.authorized(req('https://example.test/', { authorization: basic('team', 'shared pass') })), false)
  assert.equal(auth.authorized(req()), false)
})
