import { json } from '../index.mjs'

export function logoutHandler(auth) {
  return function logout(req) {
    if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Set-Cookie': auth.clearCookie(req),
      },
    })
  }
}
