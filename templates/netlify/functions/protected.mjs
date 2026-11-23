// Copy to netlify/functions/tasks.mjs (or your own API function).
// Cookies are for people; bearer tokens are for cron jobs.
import { createAuth, json } from './_auth.mjs'

const auth = createAuth({ realm: 'Your App' })

export default async (req) => {
  if (!auth.authorized(req)) return auth.unauthorized()

  if (req.method === 'GET') {
    return json(200, { ok: true, data: [] })
  }
  return json(405, { error: 'Method not allowed' })
}
