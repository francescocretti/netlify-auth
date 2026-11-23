// Auth for Netlify Functions: shared-password login with a signed cookie,
// plus bearer tokens for machine-to-machine requests. Zero dependencies.
import crypto from 'node:crypto'

function safeEqual(a, b) {
  const ab = Buffer.from(String(a))
  const bb = Buffer.from(String(b))
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

export function createAuth({
  passwordHashEnv = 'AUTH_PASSWORD_HASH',
  secretEnv = 'AUTH_SECRET',
  bearerEnv = 'AUTH_BEARER_TOKEN',
  userEnv = 'AUTH_USER',
  cookieNameEnv = 'AUTH_COOKIE_NAME',
  maxAgeDaysEnv = 'AUTH_MAX_AGE_DAYS',
  realmEnv = 'AUTH_REALM',
  defaultUser = 'user',
  cookieName: cookieNameOption = '',
  maxAgeDays: maxAgeDaysOption = 0,
  realm: realmOption = '',
  basic = false,
} = {}) {
  const env = (name) => process.env[name] || ''
  const passwordHash = env(passwordHashEnv)
  const secret = env(secretEnv)
  const bearer = env(bearerEnv)
  const user = env(userEnv) || defaultUser
  const configuredCookieName = cookieNameOption || env(cookieNameEnv) || 'app_auth'
  // Cookie names must be HTTP tokens. Falling back is safer than emitting an
  // invalid (or injectable) Set-Cookie header from a typo in configuration.
  const cookieName = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(configuredCookieName)
    ? configuredCookieName
    : 'app_auth'
  const configuredMaxAgeDays = Number(maxAgeDaysOption || env(maxAgeDaysEnv) || 30)
  const maxAgeDays = Number.isFinite(configuredMaxAgeDays) && configuredMaxAgeDays > 0
    ? configuredMaxAgeDays
    : 30
  const realm = realmOption || env(realmEnv) || 'Protected'
  const maxAge = Math.max(1, maxAgeDays) * 86400

  function verifyPassword(password) {
    if (!passwordHash || !password) return false
    const [salt, key] = passwordHash.split(':')
    if (!salt || !key || key.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(key)) return false
    const expected = Buffer.from(key, 'hex')
    if (expected.length === 0) return false
    const derived = crypto.scryptSync(password, salt, expected.length)
    return crypto.timingSafeEqual(derived, expected)
  }

  function sign(payload) {
    return crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  }

  function secureFlag(req) {
    try {
      return new URL(req.url).protocol === 'https:' ? '; Secure' : ''
    } catch {
      return ''
    }
  }

  // Use as the Set-Cookie value after a successful login.
  function issueCookie(req) {
    if (!secret) return ''
    const issued = Math.floor(Date.now() / 1000)
    const payload = `v1.${issued}`
    const value = `${payload}.${sign(payload)}`
    return `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secureFlag(req)}`
  }

  // Use as the Set-Cookie value on logout.
  function clearCookie(req) {
    return `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureFlag(req)}`
  }

  function readCookie(req) {
    const raw = req.headers.get('cookie') || ''
    for (const chunk of raw.split(';')) {
      const part = chunk.trim()
      const eq = part.indexOf('=')
      if (eq < 0) continue
      if (part.slice(0, eq) === cookieName) return part.slice(eq + 1)
    }
    return ''
  }

  function verifyCookie(req) {
    if (!secret) return false
    const value = readCookie(req)
    const match = /^v1\.(\d+)\.([A-Za-z0-9_-]+)$/.exec(value)
    if (!match) return false
    const issued = Number(match[1])
    if (!Number.isFinite(issued)) return false
    const age = Math.floor(Date.now() / 1000) - issued
    if (age < 0 || age > maxAge) return false
    return safeEqual(match[2], sign(`v1.${issued}`))
  }

  function verifyBearer(req) {
    const header = req.headers.get('authorization') || ''
    if (!bearer || !header.startsWith('Bearer ')) return false
    return safeEqual(header.slice(7), bearer)
  }

  // Only when basic=true: useful for curl, not for the login page.
  function verifyBasic(req) {
    if (!basic) return false
    const header = req.headers.get('authorization') || ''
    if (!header.startsWith('Basic ')) return false
    let decoded = ''
    try {
      decoded = Buffer.from(header.slice(6), 'base64').toString('utf8')
    } catch {
      return false
    }
    const sep = decoded.indexOf(':')
    if (sep < 0) return false
    return decoded.slice(0, sep) === user && verifyPassword(decoded.slice(sep + 1))
  }

  // Cookie for people, bearer for jobs. Basic only when explicitly enabled.
  function authorized(req) {
    return verifyCookie(req) || verifyBearer(req) || verifyBasic(req)
  }

  function unauthorized(message = 'Authentication required') {
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    }
    if (basic) {
      headers['WWW-Authenticate'] = `Basic realm="${String(realm).replace(/["\\]/g, '')}"`
    }
    return new Response(JSON.stringify({ error: message }), { status: 401, headers })
  }

  return {
    authorized,
    verifyCookie,
    verifyBearer,
    verifyBasic,
    verifyPassword,
    issueCookie,
    clearCookie,
    unauthorized,
    user,
    maxAge,
    hasPassword: Boolean(passwordHash),
    hasSecret: Boolean(secret),
    hasBearer: Boolean(bearer),
  }
}

export function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
