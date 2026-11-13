// Owns the browser copy of the portal session token. Bearer auth is read from here on every call.
const TOKEN_KEY = 'workbench_token'
const ID_TOKEN_KEY = 'workbench_id_token'
const JWT_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/

export function isJwtShaped(value) {
  return typeof value === 'string' && JWT_SHAPE.test(value)
}

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function getIdToken() {
  try {
    return localStorage.getItem(ID_TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token, idToken) {
  try {
    if (isJwtShaped(token)) localStorage.setItem(TOKEN_KEY, token)
    if (isJwtShaped(idToken)) localStorage.setItem(ID_TOKEN_KEY, idToken)
  } catch {
    /* storage unavailable — session simply won't persist */
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(ID_TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

// Reads the caller out of the JWT payload without verifying — display only, never for trust.
export function decodeToken() {
  return decodeJwtPayload(getIdToken()) || decodeJwtPayload(getToken())
}

function decodeJwtPayload(token) {
  if (!isJwtShaped(token)) return null
  try {
    return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
  } catch {
    return null
  }
}
