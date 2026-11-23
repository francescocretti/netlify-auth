import { copyFile, mkdir } from 'node:fs/promises'

await mkdir(new URL('../react/', import.meta.url), { recursive: true })
await copyFile(
  new URL('../src/react/auth-gate.css', import.meta.url),
  new URL('../react/auth-gate.css', import.meta.url),
)
