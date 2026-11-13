// Okta is identity only. Authorization (role) is local, read from workbench_users.
// Local-dev mode (DISABLE_OKTA=true) swaps the Okta hop for /api/auth/local/login.
import { Issuer, generators } from 'openid-client'
import jwt from 'jsonwebtoken'
import { signSessionToken, requireAuth, getJwtSecret } from './jwtAuth.js'

const isProd = () => process.env.NODE_ENV === 'production'
const localAuthEnabled = () => process.env.DISABLE_OKTA === 'true'
const redirectUri = () => (isProd() ? process.env.OKTA_REDIRECT_URI_PROD : process.env.OKTA_REDIRECT_URI_DEV)
const appBaseUrl = () => process.env.APP_BASE_URL || 'http://localhost:5173'

let oktaClientPromise = null

async function buildOktaClient() {
  const domain = process.env.OKTA_DOMAIN
  const issuerUrl = process.env.OKTA_ISSUER || `https://${domain}`
  const endpointBase = (process.env.OKTA_ISSUER || `https://${domain}/oauth2`).replace(/\/$/, '')
  let issuer
  try {
    issuer = await Issuer.discover(issuerUrl)
  } catch (discoverError) {
    // A discovery outage should not take sign-in down with it.
    console.warn('[auth] Okta discovery failed, using static endpoints:', discoverError.message)
    issuer = new Issuer({
      issuer: issuerUrl,
      authorization_endpoint: `${endpointBase}/v1/authorize`,
      token_endpoint: `${endpointBase}/v1/token`,
      userinfo_endpoint: `${endpointBase}/v1/userinfo`,
      jwks_uri: `${endpointBase}/v1/keys`,
      revocation_endpoint: `${endpointBase}/v1/revoke`,
      end_session_endpoint: `${endpointBase}/v1/logout`,
    })
  }
  return new issuer.Client({
    client_id: process.env.OKTA_CLIENT_ID,
    client_secret: process.env.OKTA_CLIENT_SECRET,
    redirect_uris: [redirectUri()],
    response_types: ['code'],
  })
}

async function getOktaClient() {
  if (localAuthEnabled()) return null
  if (!process.env.OKTA_CLIENT_ID || !process.env.OKTA_CLIENT_SECRET) {
    console.warn('[auth] Okta enabled but OKTA_CLIENT_ID/SECRET missing; sign-in will fail until set')
    return null
  }
  if (!oktaClientPromise) oktaClientPromise = buildOktaClient()
  return oktaClientPromise
}

export async function ensureAuthSchema(query) {
  await query(`
    CREATE TABLE IF NOT EXISTS workbench_users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      first_name TEXT,
      last_name TEXT,
      display_name TEXT,
      role TEXT NOT NULL DEFAULT 'VIEWER',
      is_active BOOLEAN NOT NULL DEFAULT true,
      sso_provider TEXT,
      sso_id TEXT,
      last_sso_login TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'divya.m@coactionspecialty.com'
  await query(
    `INSERT INTO workbench_users (email, display_name, role, is_active, sso_provider)
     VALUES ($1, $2, 'ADMIN', true, 'seed')
     ON CONFLICT (email) DO NOTHING`,
    [adminEmail, adminEmail.split('@')[0]],
  )
  console.log('✓ Ensured workbench_users table exists')
}

async function findActiveUser(query, email) {
  const { rows } = await query(
    `SELECT id, email, first_name, last_name, display_name, role, is_active
     FROM workbench_users WHERE email ILIKE $1 AND is_active = true LIMIT 1`,
    [email],
  )
  return rows[0] || null
}

// First-time users are provisioned as VIEWER. Who may sign in is controlled in Okta, not here.
async function resolveUser(query, userInfo) {
  const firstName = userInfo.given_name || (userInfo.name || '').split(' ')[0] || ''
  const lastName = userInfo.family_name || (userInfo.name || '').split(' ').slice(1).join(' ') || ''
  const displayName = userInfo.name || `${firstName} ${lastName}`.trim() || userInfo.email

  let dbUser = await findActiveUser(query, userInfo.email)
  if (!dbUser) {
    await query(
      `INSERT INTO workbench_users
         (email, first_name, last_name, display_name, role, is_active, sso_provider, sso_id, last_sso_login)
       VALUES ($1, $2, $3, $4, 'VIEWER', true, 'okta', $5, NOW())
       ON CONFLICT (email) DO UPDATE
         SET is_active = true, sso_provider = 'okta',
             sso_id = COALESCE(workbench_users.sso_id, EXCLUDED.sso_id),
             last_sso_login = NOW()`,
      [userInfo.email, firstName, lastName, displayName, userInfo.sub],
    )
    dbUser = await findActiveUser(query, userInfo.email)
  } else {
    await query('UPDATE workbench_users SET last_sso_login = NOW(), sso_id = COALESCE(sso_id, $2) WHERE id = $1', [dbUser.id, userInfo.sub])
  }
  return dbUser
}

function issueSession(res, dbUser) {
  const token = signSessionToken({
    email: dbUser.email,
    name: dbUser.display_name || dbUser.email,
    role: dbUser.role,
    user_id: dbUser.id,
  })
  res.cookie('workbench_token', token, {
    httpOnly: true,
    secure: isProd(),
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  })
  return token
}

export function registerAuthRoutes(app, { query }) {
  // Frontend asks how to sign in.
  app.get('/api/auth/okta/config', (_req, res) => {
    if (localAuthEnabled()) return res.json({ disabled: true, useLocalAuth: true })
    res.json({
      disabled: false,
      clientId: process.env.OKTA_CLIENT_ID,
      domain: process.env.OKTA_DOMAIN,
      issuer: process.env.OKTA_ISSUER,
      redirectUri: redirectUri(),
      loginUrl: '/api/auth/okta/login',
    })
  })

  // Starts the Authorization Code + PKCE flow.
  app.get('/api/auth/okta/login', async (req, res, next) => {
    try {
      const client = await getOktaClient()
      if (!client) return res.status(503).json({ message: 'Okta is not configured' })
      const state = generators.state()
      const nonce = generators.nonce()
      const codeVerifier = generators.codeVerifier()
      const codeChallenge = generators.codeChallenge(codeVerifier)
      res.cookie('okta_tx', JSON.stringify({ state, nonce, codeVerifier }), {
        httpOnly: true,
        secure: isProd(),
        sameSite: 'lax',
        maxAge: 10 * 60 * 1000,
      })
      res.redirect(client.authorizationUrl({
        scope: 'openid profile email',
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      }))
    } catch (error) {
      next(error)
    }
  })

  // Where Okta sends the user back.
  app.get('/api/auth/okta/callback', async (req, res, next) => {
    try {
      const client = await getOktaClient()
      if (!client) return res.status(503).json({ message: 'Okta is not configured' })
      const params = client.callbackParams(req)
      // IdP-initiated launch arrives with no code — start a proper SP-initiated flow.
      if (!params.code) return res.redirect('/api/auth/okta/login')

      const tx = req.cookies?.okta_tx ? JSON.parse(req.cookies.okta_tx) : {}
      res.clearCookie('okta_tx')
      const tokenSet = await client.callback(redirectUri(), params, {
        state: tx.state,
        nonce: tx.nonce,
        code_verifier: tx.codeVerifier,
      })
      const userInfo = await client.userinfo(tokenSet.access_token)
      const dbUser = await resolveUser(query, userInfo)
      const token = issueSession(res, dbUser)
      const idToken = tokenSet.id_token || ''
      res.redirect(`${appBaseUrl()}/?token=${encodeURIComponent(token)}&id_token=${encodeURIComponent(idToken)}`)
    } catch (error) {
      next(error)
    }
  })

  // Decodes the session and returns the caller, re-read from the database.
  app.get('/api/auth/me', requireAuth, async (req, res, next) => {
    try {
      const { rows } = await query(
        'SELECT id AS user_id, email, display_name AS name, role FROM workbench_users WHERE id = $1 AND is_active = true',
        [req.user.user_id],
      )
      if (!rows[0]) return res.status(401).json({ message: 'User not found or inactive' })
      res.json({ user: rows[0] })
    } catch (error) {
      next(error)
    }
  })

  // Re-reads the row and reissues, so a role change lands without a fresh Okta login.
  app.post('/api/auth/refresh-token', async (req, res, next) => {
    try {
      const header = req.headers.authorization || ''
      const token = header.startsWith('Bearer ') ? header.slice(7) : req.cookies?.workbench_token
      if (!token) return res.status(401).json({ message: 'No token supplied' })
      let decoded
      try {
        // Expired is fine to refresh; a forged signature is not.
        decoded = jwt.verify(token, getJwtSecret(), { ignoreExpiration: true })
      } catch {
        return res.status(401).json({ message: 'Invalid token' })
      }
      const { rows } = await query(
        'SELECT id, email, display_name, role FROM workbench_users WHERE id = $1 AND is_active = true',
        [decoded.user_id],
      )
      if (!rows[0]) return res.status(401).json({ message: 'User not found or inactive' })
      const fresh = issueSession(res, rows[0])
      res.json({ token: fresh, user: { user_id: rows[0].id, email: rows[0].email, name: rows[0].display_name, role: rows[0].role } })
    } catch (error) {
      next(error)
    }
  })

  // Development only. 403 in any deployed environment.
  app.post('/api/auth/local/login', async (req, res, next) => {
    try {
      if (!localAuthEnabled()) return res.status(403).json({ message: 'Local login is disabled' })
      const email = (req.body?.email || '').trim()
      if (!email) return res.status(400).json({ message: 'email is required' })
      const dbUser = await findActiveUser(query, email)
      if (!dbUser) return res.status(401).json({ message: 'No active user with that email' })
      const token = issueSession(res, dbUser)
      res.json({ token, user: { user_id: dbUser.id, email: dbUser.email, name: dbUser.display_name || dbUser.email, role: dbUser.role } })
    } catch (error) {
      next(error)
    }
  })
}
