// Copia in netlify/functions/login.mjs
// POST /api/login  { "password": "..." }  ->  Set-Cookie firmato
import { createAuth, json } from './_auth.mjs'

const auth = createAuth({ realm: 'Nome App' })

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Metodo non consentito' })
  if (!auth.hasPassword || !auth.hasSecret) {
    return json(500, { error: 'Auth non configurata' })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'Richiesta non valida' })
  }

  const password = String(body?.password || '')
  if (!auth.verifyPassword(password)) {
    // Rallenta i tentativi a raffica senza mantenere stato.
    await new Promise((resolve) => setTimeout(resolve, 300))
    return json(401, { error: 'Password errata' })
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
