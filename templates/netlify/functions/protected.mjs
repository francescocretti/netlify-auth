// Copia in netlify/functions/tasks.mjs (o nella tua API).
// Cookie per le persone, bearer per i cron.
import { createAuth, json } from './_auth.mjs'

const auth = createAuth({ realm: 'Nome App' })

export default async (req) => {
  if (!auth.authorized(req)) return auth.unauthorized()

  if (req.method === 'GET') {
    return json(200, { ok: true, data: [] })
  }
  return json(405, { error: 'Metodo non consentito' })
}
