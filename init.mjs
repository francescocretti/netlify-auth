#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const targetDir = path.resolve(process.cwd(), 'netlify/functions')
const files = {
  '_auth-config.mjs': `import { createAuth } from '@francescocretti/netlify-auth'

export const auth = createAuth({
  realm: 'Your App',
})
`,
  'login.mjs': `import { loginHandler } from '@francescocretti/netlify-auth/netlify'
import { auth } from './_auth-config.mjs'

export default loginHandler(auth)
`,
  'logout.mjs': `import { logoutHandler } from '@francescocretti/netlify-auth/netlify'
import { auth } from './_auth-config.mjs'

export default logoutHandler(auth)
`,
  'session.mjs': `import { sessionHandler } from '@francescocretti/netlify-auth/netlify'
import { auth } from './_auth-config.mjs'

export default sessionHandler(auth)
`,
}

await mkdir(targetDir, { recursive: true })

let created = 0
for (const [file, contents] of Object.entries(files)) {
  const target = path.join(targetDir, file)
  try {
    await writeFile(target, contents, { flag: 'wx' })
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
