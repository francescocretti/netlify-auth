#!/usr/bin/env node
import { copyFile, mkdir } from 'node:fs/promises'
import { constants } from 'node:fs'
import path from 'node:path'

const targetDir = path.resolve(process.cwd(), 'netlify/functions')
const templateDir = new URL('./templates/netlify/functions/', import.meta.url)
const files = ['_auth-config.mjs', 'login.mjs', 'logout.mjs', 'session.mjs']

await mkdir(targetDir, { recursive: true })

let created = 0
for (const file of files) {
  const target = path.join(targetDir, file)
  try {
    await copyFile(new URL(file, templateDir), target, constants.COPYFILE_EXCL)
    console.log(`created ${path.relative(process.cwd(), target)}`)
    created += 1
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error
    console.log(`skipped ${path.relative(process.cwd(), target)} (already exists)`)
  }
}

if (created > 0) {
  console.log('\nSet AUTH_PASSWORD_HASH and AUTH_SECRET in Netlify, then protect your data functions with auth.authorized(req).')
}
