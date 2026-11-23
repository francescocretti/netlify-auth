import type { Auth } from '../auth.mjs'
import type { NetlifyHandler } from './types.mjs'

export function loginHandler(
  auth: Auth,
  options?: { delayMs?: number },
): NetlifyHandler
