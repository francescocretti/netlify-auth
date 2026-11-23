# netlify-auth

A small authentication gate for private Netlify utilities: **one shared
password, one login screen, and one signed cookie**. There are no users, roles,
identity providers, or server-side sessions.

Use it for a small app shared by one person or a trusted group when the goal is
simply to keep API data off the public internet. It is not an identity or
permissions system.

## How it works

1. The UI calls `GET /api/session` when it starts.
2. A valid cookie returns `200`; a missing or expired cookie returns `401` and
   the UI shows the login screen.
3. `POST /api/login` with `{ "password": "..." }` checks the scrypt hash and
   sets a signed `HttpOnly` cookie.
4. API functions call `auth.authorized(req)`. Browser requests use the cookie;
   cron jobs and scripts can use an optional bearer token.
5. `POST /api/logout` clears the cookie.

The cookie contains only its version, issue time, and an HMAC signature. There
is no session database. Rotating `AUTH_SECRET` invalidates all existing
cookies. Changing `AUTH_PASSWORD_HASH` changes the accepted password, but does
not invalidate cookies that were already issued; rotate both values when you
need to revoke every existing login.

## Add it to a Netlify project

1. Copy `auth.mjs` to `netlify/functions/_auth.mjs`.
2. Copy the function templates:

   - `templates/netlify/functions/login.mjs` to
     `netlify/functions/login.mjs`
   - `templates/netlify/functions/logout.mjs` to
     `netlify/functions/logout.mjs`
   - `templates/netlify/functions/session.mjs` to
     `netlify/functions/session.mjs`

3. Create the secrets and add them to the Netlify environment:

   ```bash
   node hash-password.mjs "your-long-shared-password"
   # Store the output as AUTH_PASSWORD_HASH.

   openssl rand -hex 32 # AUTH_SECRET
   openssl rand -hex 32 # AUTH_BEARER_TOKEN, only if a job needs it
   ```

4. Add a login UI. For a static site, copy `templates/public/login.html`. For
   React, copy `templates/react/AuthGate.tsx` and `auth-gate.css`, then wrap
   the private part of the app:

   ```tsx
   import { AuthGate } from './AuthGate'

   export function App() {
     return (
       <AuthGate appName="My Utility">
         <Dashboard />
       </AuthGate>
     )
   }
   ```

5. Protect every function that returns or changes private data:

   ```js
   import { createAuth, json } from './_auth.mjs'

   const auth = createAuth({ realm: 'My Utility' })

   export default async (req) => {
     if (!auth.authorized(req)) return auth.unauthorized()
     return json(200, { ok: true })
   }
   ```

The UI gate is only presentation. It does not secure an endpoint by itself;
the authorization check in each private function is what protects the data.

## Adapting the gate to another project

The defaults work when Netlify exposes functions under `/api/*`. If your app
uses different routes, pass them to the React component:

```tsx
<AuthGate
  appName="Internal Reports"
  loginUrl="/.netlify/functions/login"
  sessionUrl="/.netlify/functions/session"
>
  <Reports />
</AuthGate>
```

Customize colors and spacing in `auth-gate.css`. Keep the request contract the
same, or update both the component and functions together:

- session: `GET`, with `200` for an authenticated browser and `401` otherwise;
- login: `POST` JSON `{ "password": "..." }`, returning the signed cookie;
- protected APIs: reject unauthenticated requests with `401`;
- logout: `POST`, returning an expired cookie.

For project-specific environment variable names or cookie settings, configure
the same `createAuth` options in every function:

```js
const auth = createAuth({
  passwordHashEnv: 'MY_APP_PASSWORD_HASH',
  secretEnv: 'MY_APP_AUTH_SECRET',
  bearerEnv: 'MY_APP_JOB_TOKEN',
  cookieName: 'my_app_auth',
  maxAgeDays: 14,
  realm: 'My App',
})
```

## Environment variables

| Variable | Required | Purpose |
|---|---:|---|
| `AUTH_PASSWORD_HASH` | yes | scrypt `salt:key` hash of the shared password |
| `AUTH_SECRET` | yes | signs cookies; use at least 32 random bytes |
| `AUTH_BEARER_TOKEN` | no | bearer token for cron jobs or scripts |
| `AUTH_COOKIE_NAME` | no | cookie name; defaults to `app_auth` |
| `AUTH_MAX_AGE_DAYS` | no | cookie lifetime; defaults to 30 days |
| `AUTH_REALM` | no | Basic auth realm, if Basic auth is enabled |
| `AUTH_USER` | no | Basic auth username; defaults to `user` |

Never put the password, hash, secret, or bearer token in the browser bundle.
They belong in server-side Netlify environment variables. Redeploy after an
environment change.

## Module API

- `createAuth(options)` returns `authorized`, `verifyCookie`, `verifyBearer`,
  `verifyBasic`, `verifyPassword`, `issueCookie`, `clearCookie`, and
  `unauthorized`.
- `json(status, body)` creates a JSON `Response` with `Cache-Control: no-store`.
- Set `basic: true` only if you explicitly need HTTP Basic auth for tools such
  as curl. It is disabled by default.

## Security and limits

- Cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` on HTTPS.
- Failed logins wait 300 ms. This slows bursts down but is not distributed
  rate limiting. Use a long password and consider Netlify rate limiting or an
  upstream control if the endpoint is exposed to sustained attacks.
- The static HTML and JavaScript remain public; private data must live behind
  protected functions. Hiding the site shell too requires an edge gate or a
  platform access-control feature.
- This design intentionally has no per-user revocation, roles, audit trail,
  password reset, or multi-factor authentication. Use a real identity service
  when any of those become requirements.
- Run the app over HTTPS in production. Basic auth and bearer tokens are not
  safe over plaintext HTTP.

## Tests

```bash
npm test
```

The tests run locally with Node's built-in test runner and require no network.
