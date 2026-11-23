// Copy to netlify/functions/logout.mjs.
import { createAuth, json } from './_auth.mjs'

const auth = createAuth({ realm: 'Your App' })

export default async (req) => {
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
