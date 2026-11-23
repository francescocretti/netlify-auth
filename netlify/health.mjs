import { json } from '../auth.mjs'

export function healthHandler() {
  return function health(req) {
    if (req.method !== 'GET') return json(405, { error: 'Method not allowed' })
    return json(200, { ok: true })
  }
}
