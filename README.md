# @francescocretti/netlify-auth

A small shared-password gate for private Netlify apps: one password, one signed
cookie, ready-made Netlify Function handlers, and an optional React gate.

This package is intentionally narrow. It is for small tools used by one person
or a trusted group. It is not a user management or permissions system.

## Quick start: new Netlify + React app

Install the package:

```bash
npm install @francescocretti/netlify-auth
npx netlify-auth-init
```

The initializer creates:

```text
netlify/functions/
├── _auth-config.mjs
├── health.mjs
├── login.mjs
├── logout.mjs
└── session.mjs
```

It never overwrites existing files.

Generate a password hash and a cookie-signing secret:

```bash
npx netlify-auth-hash "your-long-shared-password"
openssl rand -hex 32
```

Add the results to the Netlify environment:

```env
AUTH_PASSWORD_HASH=<output from netlify-auth-hash>
AUTH_SECRET=<output from openssl>
```

Then wrap the React application:

```tsx
import { AuthGate } from '@francescocretti/netlify-auth/react'

export function App() {
  return (
    <AuthGate appName="My Utility">
      <Dashboard />
    </AuthGate>
  )
}
```

`AuthGate` imports its own default stylesheet and calls the standard Netlify
Function URLs, so no redirect configuration is required:

```text
/.netlify/functions/session
/.netlify/functions/login
```

The UI gate controls what is rendered, but it does not secure data by itself.
Every Function that reads or changes private data must also check authorization.

## Plain HTML instead of React

The package also ships a standalone login page. Copy it into the public
directory used by the app:

```bash
cp node_modules/@francescocretti/netlify-auth/ui/html/login.html public/login.html
```

It posts directly to the standard Netlify login Function. Adjust its styles or
the successful-login redirect as needed. The HTML version and the React
component are maintained together under `ui/`; neither contains auth secrets.

## Protect a Function

```js
// netlify/functions/todos.mjs
import { json } from '@francescocretti/netlify-auth'
import { auth } from './_auth-config.mjs'

export default async function handler(req) {
  if (!auth.authorized(req)) return auth.unauthorized()

  return json(200, {
    todos: [],
  })
}
```

The generated `_auth-config.mjs` contains the single shared instance:

```js
import { createAuth } from '@francescocretti/netlify-auth'

export const auth = createAuth({
  realm: 'Your App',
})
```

Change project-specific options there, not separately in every Function.

## Manual setup

If you do not want to use the initializer, create these files yourself.

```js
// netlify/functions/login.mjs
import { loginHandler } from '@francescocretti/netlify-auth/netlify/login'
import { auth } from './_auth-config.mjs'

export default loginHandler(auth)
```

```js
// netlify/functions/session.mjs
import { sessionHandler } from '@francescocretti/netlify-auth/netlify/session'
import { auth } from './_auth-config.mjs'

export default sessionHandler(auth)
```

```js
// netlify/functions/logout.mjs
import { logoutHandler } from '@francescocretti/netlify-auth/netlify/logout'
import { auth } from './_auth-config.mjs'

export default logoutHandler(auth)
```

```js
// netlify/functions/health.mjs
import { healthHandler } from '@francescocretti/netlify-auth/netlify/health'

export default healthHandler()
```

The health endpoint returns only `{ "ok": true }`; it does not reveal whether
password, cookie, or bearer secrets are configured.

The handlers use Netlify's modern Web `Request`/`Response` Function API.

## Custom React routes and styling

If the project maps Functions to `/api/*`, pass the custom URLs:

```tsx
<AuthGate
  appName="Internal Reports"
  loginUrl="/api/login"
  sessionUrl="/api/session"
>
  <Reports />
</AuthGate>
```

The default CSS is included automatically. Override the `.auth-gate*` classes
in the app stylesheet, or copy the source styles and customize them. Its font
and color-scheme rules are scoped to the gate and do not modify `:root` or the
rest of the application's design system.

By default, `AuthGate` checks the session when it mounts, whenever the window
regains focus, and every 60 seconds. This makes the login screen reappear after
the cookie expires or `AUTH_SECRET` is rotated. Change or disable polling with:

```tsx
<AuthGate sessionCheckIntervalMs={5 * 60_000}>
  <App />
</AuthGate>

// Set sessionCheckIntervalMs={0} to check only on mount and window focus.
```

Protected API calls may still receive `401` before the next session check.
Handle that response in the application's data layer when immediate feedback
is important—for example, reload the page or remount the gate.

The component is a convenience layer. A custom login screen only needs to:

- call `GET /.netlify/functions/session` on startup;
- send `POST /.netlify/functions/login` with JSON
  `{ "password": "..." }`;
- show the application after a `200` response.

## Logout

`AuthGate` deliberately does not add a logout button inside the protected app.
The app controls where that action belongs. Call the logout Function and then
update or reload the UI:

```ts
await fetch('/.netlify/functions/logout', {
  method: 'POST',
  credentials: 'same-origin',
})

location.reload()
```

## Cron jobs and scripts

Browser users authenticate with the signed cookie. A cron job cannot use the
login UI, so it can use an optional bearer token instead.

Generate and store another secret:

```bash
openssl rand -hex 32
```

```env
AUTH_BEARER_TOKEN=<random token>
```

Send it to any Function protected by `auth.authorized(req)`:

```bash
curl \
  -H "Authorization: Bearer $AUTH_BEARER_TOKEN" \
  https://example.netlify.app/.netlify/functions/todos
```

Existing projects can retain a differently named variable:

```js
export const auth = createAuth({
  bearerEnv: 'CRON_TOKEN',
})
```

Never include a bearer token in the React bundle.

## Configuration

```js
const auth = createAuth({
  passwordHashEnv: 'AUTH_PASSWORD_HASH',
  secretEnv: 'AUTH_SECRET',
  bearerEnv: 'AUTH_BEARER_TOKEN',
  cookieName: 'app_auth',
  maxAgeDays: 30,
  realm: 'My App',
})
```

| Environment variable | Required | Purpose |
|---|---:|---|
| `AUTH_PASSWORD_HASH` | yes | scrypt `salt:key` hash of the shared password |
| `AUTH_SECRET` | yes | signs cookies; use at least 32 random bytes |
| `AUTH_BEARER_TOKEN` | no | bearer token for cron jobs or scripts |
| `AUTH_COOKIE_NAME` | no | cookie name; defaults to `app_auth` |
| `AUTH_MAX_AGE_DAYS` | no | cookie lifetime; defaults to 30 days |
| `AUTH_REALM` | no | Basic auth realm when Basic auth is enabled |
| `AUTH_USER` | no | Basic auth username; defaults to `user` |

Environment variable names can be changed through the matching
`passwordHashEnv`, `secretEnv`, `bearerEnv`, `cookieNameEnv`,
`maxAgeDaysEnv`, `realmEnv`, and `userEnv` options.

## Package exports

```js
import { createAuth, json } from '@francescocretti/netlify-auth'
import {
  healthHandler,
  loginHandler,
  logoutHandler,
  sessionHandler,
} from '@francescocretti/netlify-auth/netlify'
import { AuthGate } from '@francescocretti/netlify-auth/react'
```

Granular handler imports are also available:

```js
import { loginHandler } from '@francescocretti/netlify-auth/netlify/login'
```

- `createAuth(options)` creates the configured auth instance.
- `json(status, body)` returns a no-store JSON `Response`.
- `loginHandler(auth)`, `sessionHandler(auth)`, and `logoutHandler(auth)` create
  ready-to-export authenticated Netlify handlers.
- `healthHandler()` creates a minimal public availability endpoint.
- `AuthGate` checks and periodically refreshes the browser session, then
  renders either the React login screen or its children.

TypeScript declarations are included. React is a peer dependency and is not
bundled twice.

## How it works

1. The React gate calls the session Function.
2. A valid cookie returns `200`; a missing or expired cookie returns `401`.
3. The login Function verifies the password against its scrypt hash.
4. A successful login sets an HMAC-signed, `HttpOnly` cookie.
5. Protected Functions accept that cookie or the optional bearer token.
6. The logout Function expires the cookie.

The cookie contains only its version, issue time, and signature. There is no
session database. Rotating `AUTH_SECRET` invalidates every existing cookie.
Changing only `AUTH_PASSWORD_HASH` changes the accepted password but does not
revoke cookies already issued; rotate both to force everybody to sign in again.

## Security and limits

- Cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` on HTTPS.
- Failed logins wait 300 ms. This slows bursts but is not distributed rate
  limiting. Use a long password and add an upstream control if needed.
- The static HTML and JavaScript remain public. Private data must be returned
  only by Functions that call `auth.authorized(req)`.
- There is no per-user revocation, role system, audit trail, password reset, or
  multi-factor authentication. Use an identity service if those become
  requirements.
- Use HTTPS in production. Bearer tokens and Basic auth are unsafe over
  plaintext HTTP.

## Development

Repository layout:

```text
index.mjs          # package entry point and core auth implementation
netlify/           # one ready-made handler per Netlify Function
  health.mjs
  login.mjs
  logout.mjs
  session.mjs
  index.mjs        # optional aggregate export
init.mjs           # generates Function entrypoints
ui/react/          # React source
ui/html/           # standalone HTML alternative
dist/              # generated package build, ignored by Git
```

```bash
npm install
npm test
npm run build
npm pack --dry-run
```

The tests use Node's built-in test runner and require no network.
