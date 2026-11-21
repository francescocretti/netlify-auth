# netlify-auth

Cancello di autenticazione per piccole app Netlify: **una password condivisa,
una pagina di login, un cookie firmato**. Niente utenti, ruoli, provider di
identità o archivio di sessioni.

## A cosa serve

Piccole applicazioni di utilità usate da una persona o da 4-5 persone fidate,
dove l'unico obiettivo è non lasciare i dati pubblici su Internet. Non è un
sistema per gestire persone diverse, permessi o audit.

## Generico vs Electric Circus

Il codice è **lo stesso**. Cambiano solo i valori di configurazione:

| | Generico | EC Todos |
|---|---|---|
| hash password | `AUTH_PASSWORD_HASH` | `APP_PASSWORD_HASH` |
| segreto cookie | `AUTH_SECRET` | `AUTH_SECRET` |
| bearer cron | `AUTH_BEARER_TOKEN` | `CRON_TOKEN` |
| nome cookie | `app_auth` | `ec_auth` |
| realm | `Protected` | `EC Todos` |

In pratica EC è un *profilo*, non un fork:

```js
// auth.config.mjs di un progetto EC
import { createAuth } from './auth.mjs'

export const auth = createAuth({
  passwordHashEnv: 'APP_PASSWORD_HASH',
  bearerEnv: 'CRON_TOKEN',
  cookieName: 'ec_auth',
  realm: 'EC Todos',
})
```

Se un progetto non ha esigenze particolari, usa i default `AUTH_*`. Non c'è
motivo di duplicare il file per EC: la specializzazione è tutta qui.

## Come funziona

1. La persona apre il sito: la UI chiama `GET /api/session`.
2. Cookie valido → 200 e l'app carica i dati; cookie assente/scaduto → 401 e
   la UI mostra la pagina di login.
3. `POST /api/login` con `{ "password": "..." }`: la Function confronta la
   password con l'hash scrypt e, se corretta, mette un cookie firmato
   `v1.<emesso>.<hmac>` con `HttpOnly; SameSite=Lax; Max-Age=30 giorni`.
4. Le API proteggono con `auth.authorized(req)`: cookie per le persone,
   bearer per cron e script.
5. `POST /api/logout` cancella il cookie.

Non c'è un archivio di sessioni: il cookie è un lasciapassare firmato con
scadenza. Cambiare `AUTH_SECRET` invalida tutti i lasciapassare; cambiare
l'hash della password revoca la password vecchia.

## Setup in un progetto Netlify

1. Copia `auth.mjs` in `netlify/functions/_auth.mjs`.
2. Copia i template:
   - `templates/netlify/functions/login.mjs` → `netlify/functions/login.mjs`
   - `templates/netlify/functions/logout.mjs` → `netlify/functions/logout.mjs`
   - `templates/netlify/functions/session.mjs` → `netlify/functions/session.mjs`
3. Env su Netlify:

   ```bash
   node hash-password.mjs "la-password-condivisa"
   # incolla l'output in AUTH_PASSWORD_HASH
   openssl rand -hex 32   # AUTH_SECRET
   openssl rand -hex 32   # AUTH_BEARER_TOKEN, se serve un cron
   ```

4. Pagina di login: usa `templates/public/login.html` come pagina statica, o
   una schermata della tua UI che posta a `/api/login`.
5. Proteggi le API:

   ```js
   import { createAuth, json } from './_auth.mjs'

   const auth = createAuth({ realm: 'Nome App' })

   export default async (req) => {
     if (!auth.authorized(req)) return auth.unauthorized()
     return json(200, { ok: true })
   }
   ```

6. `GET /api/session` per la UI, `POST /api/logout` per uscire.

## Variabili d'ambiente

| Variabile | Obbligatoria | Uso |
|---|---|---|
| `AUTH_PASSWORD_HASH` | sì | hash scrypt `salt:key` della password condivisa |
| `AUTH_SECRET` | sì | firma del cookie; `openssl rand -hex 32` |
| `AUTH_BEARER_TOKEN` | no | bearer per cron/script |
| `AUTH_COOKIE_NAME` | no | default `app_auth` |
| `AUTH_MAX_AGE_DAYS` | no | default 30 |
| `AUTH_REALM` | no | solo per la modalità basic |
| `AUTH_USER` | no | solo per la modalità basic, default `ec` |

Mai la password o il token nel bundle: solo env lato Function. Dopo un cambio
di env serve un nuovo deploy.

## API del modulo

- `createAuth(options)` → istanza con `authorized`, `verifyCookie`,
  `verifyBearer`, `verifyBasic`, `verifyPassword`, `issueCookie`,
  `clearCookie`, `unauthorized`.
- `json(status, body)` → `Response` JSON con `no-store`.

## Test

```bash
npm test
```

14 test senza rete: cookie emesso/verificato/manomesso/scaduto/futuro, firma
sbagliata, bearer, password, basic opzionale, sfida 401 e attributi del cookie.

## Sicurezza e limiti

- Basic auth è opzionale (`basic: true`), utile per curl; la login page usa il
  cookie.
- Il cookie è `HttpOnly` e `Secure` su HTTPS: il JavaScript della pagina non lo
  può leggere.
- `SameSite=Lax` impedisce l'invio del cookie su POST cross-site.
- Il login fallito aspetta 300 ms: rallenta i tentativi a raffica, non li
  blocca. Usa una password lunga e cambiala se circola.
- Il guscio statico del sito resta pubblico; i **dati** sono dietro l'API. Se
  vuoi nascondere anche l'HTML/JS, serve un Edge Function o un servizio di
  password protection: per una piccola utility di solito non vale la pena.
- Non usare questo modulo per utenti separati, ruoli o audit per persona: in
  quel caso serve Netlify Identity, Supabase Auth o Auth0.
