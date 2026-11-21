#!/usr/bin/env node
// Genera l'hash scrypt da mettere in Netlify come AUTH_PASSWORD_HASH.
// Uso: node hash-password.mjs "la-password"
import crypto from 'node:crypto'

const password = process.argv[2]
if (!password) {
  console.error('Uso: node hash-password.mjs "la-password"')
  process.exit(1)
}
const salt = crypto.randomBytes(16).toString('hex')
const key = crypto.scryptSync(password, salt, 64).toString('hex')
console.log(`${salt}:${key}`)
