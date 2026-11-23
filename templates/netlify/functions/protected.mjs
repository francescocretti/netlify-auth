import { json } from '@francescocretti/netlify-auth'
import { auth } from './_auth-config.mjs'

export default async (req) => {
  if (!auth.authorized(req)) return auth.unauthorized()

  if (req.method === 'GET') {
    return json(200, { ok: true, data: [] })
  }
  return json(405, { error: 'Method not allowed' })
}
