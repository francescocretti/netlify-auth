import { copyFile, mkdir } from 'node:fs/promises'

await mkdir(new URL('../dist/react/', import.meta.url), { recursive: true })
await copyFile(
  new URL('../ui/react/auth-gate.css', import.meta.url),
  new URL('../dist/react/auth-gate.css', import.meta.url),
)
