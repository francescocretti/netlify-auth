#!/usr/bin/env node
// Generate the scrypt hash to store in Netlify as AUTH_PASSWORD_HASH.
// Usage: node hash-password.mjs "your-password"
import crypto from 'node:crypto'

const password = process.argv[2]
if (!password) {
  console.error('Usage: node hash-password.mjs "your-password"')
  process.exit(1)
}
const salt = crypto.randomBytes(16).toString('hex')
const key = crypto.scryptSync(password, salt, 64).toString('hex')
console.log(`${salt}:${key}`)
