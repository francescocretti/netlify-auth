import { json } from '../auth.mjs'

export function sessionHandler(auth) {
  return function session(req) {
    if (req.method !== 'GET') return json(405, { error: 'Method not allowed' })
    if (!auth.verifyCookie(req)) return json(401, { error: 'Not authenticated' })
    return json(200, { ok: true })
  }
}
