import { json } from '../auth.mjs'

export function loginHandler(auth, { delayMs = 300 } = {}) {
  return async function login(req) {
    if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })
    if (!auth.hasPassword || !auth.hasSecret) {
      return json(500, { error: 'Authentication is not configured' })
    }

    let body
    try {
      body = await req.json()
    } catch {
      return json(400, { error: 'Invalid request' })
    }

    const password = String(body?.password || '')
    if (!auth.verifyPassword(password)) {
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
      return json(401, { error: 'Incorrect password' })
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Set-Cookie': auth.issueCookie(req),
      },
    })
  }
}
