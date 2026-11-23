import type { Auth } from './auth.mjs'

export type NetlifyHandler = (req: Request) => Response | Promise<Response>

export function loginHandler(
  auth: Auth,
  options?: { delayMs?: number },
): NetlifyHandler

export function sessionHandler(auth: Auth): NetlifyHandler
export function logoutHandler(auth: Auth): NetlifyHandler
