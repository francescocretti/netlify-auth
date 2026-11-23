// Copy to netlify/functions/login.mjs.
// POST /api/login  { "password": "..." }  ->  signed Set-Cookie
import { createAuth, json } from './_auth.mjs'

const auth = createAuth({ realm: 'Your App' })

export default async (req) => {
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
    // Slow down bursts of attempts without keeping server-side state.
    await new Promise((resolve) => setTimeout(resolve, 300))
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
