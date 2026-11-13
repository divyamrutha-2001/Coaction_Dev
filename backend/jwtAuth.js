// Portal-minted session tokens. Okta proves identity once; this JWT carries the session after.
import jwt from 'jsonwebtoken'

// One place to read the secret so a missing value fails loudly rather than silently signing with undefined.
export function getJwtSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is not set')
  return secret
}

export function signSessionToken({ email, name, role, user_id }) {
  return jwt.sign(
    { username: email, name, role: role || 'VIEWER', email, user_id },
    getJwtSecret(),
    { expiresIn: '7d' },
  )
}

function readToken(req) {
  const header = req.headers.authorization || ''
  if (header.startsWith('Bearer ')) return header.slice(7)
  return req.cookies?.workbench_token || null
}

// The only auth gate the API has. Not applied globally yet — mounted per route as needed.
export function requireAuth(req, res, next) {
  const token = readToken(req)
  if (!token) return res.status(401).json({ message: 'Authentication required' })
  try {
    const decoded = jwt.verify(token, getJwtSecret())
    req.user = { user_id: decoded.user_id, email: decoded.email, name: decoded.name, role: decoded.role }
    next()
  } catch {
    res.status(401).json({ message: 'Invalid or expired session' })
  }
}
