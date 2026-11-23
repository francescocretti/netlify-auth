// Copy to netlify/functions/session.mjs.
// The UI calls GET /api/session: 200 = valid cookie, 401 = show login.
import { createAuth, json } from './_auth.mjs'

const auth = createAuth({ realm: 'Your App' })

export default async (req) => {
  if (req.method !== 'GET') return json(405, { error: 'Method not allowed' })
  if (!auth.verifyCookie(req)) return json(401, { error: 'Not authenticated' })
  return json(200, { ok: true })
}
