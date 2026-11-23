export interface CreateAuthOptions {
  passwordHashEnv?: string
  secretEnv?: string
  bearerEnv?: string
  userEnv?: string
  cookieNameEnv?: string
  maxAgeDaysEnv?: string
  realmEnv?: string
  defaultUser?: string
  cookieName?: string
  maxAgeDays?: number
  realm?: string
  basic?: boolean
}

export interface Auth {
  authorized(req: Request): boolean
  verifyCookie(req: Request): boolean
  verifyBearer(req: Request): boolean
  verifyBasic(req: Request): boolean
  verifyPassword(password: string): boolean
  issueCookie(req: Request): string
  clearCookie(req: Request): string
  unauthorized(message?: string): Response
  user: string
  maxAge: number
  hasPassword: boolean
  hasSecret: boolean
  hasBearer: boolean
}

export function createAuth(options?: CreateAuthOptions): Auth
export function json(status: number, body: unknown): Response
