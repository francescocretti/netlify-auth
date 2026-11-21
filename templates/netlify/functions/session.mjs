// Copia in netlify/functions/session.mjs
// La UI chiama GET /api/session: 200 = cookie valido, 401 = mostrare login.
import { createAuth, json } from './_auth.mjs'

const auth = createAuth({ realm: 'Nome App' })

export default async (req) => {
  if (!auth.verifyCookie(req)) return json(401, { error: 'Non autenticato' })
  return json(200, { ok: true })
}
