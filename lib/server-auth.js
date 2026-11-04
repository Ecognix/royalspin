import { cookies } from 'next/headers'
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { ADMIN_SESSION_COOKIE, PLAYER_SESSION_COOKIE } from './auth-constants'

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7

function sessionCookie(role) {
  return role === 'admin' ? ADMIN_SESSION_COOKIE : PLAYER_SESSION_COOKIE
}

function signingKey() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured on the server.')
  return createHash('sha256').update(`royal-spin-session:${serviceKey}`).digest()
}

export function setSessionCookie(response, userId, role) {
  const payload = Buffer.from(JSON.stringify({
    userId,
    role,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  })).toString('base64url')
  const signature = createHmac('sha256', signingKey()).update(payload).digest('base64url')
  response.cookies.set(sessionCookie(role), `${payload}.${signature}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS
  })
}

export function clearSessionCookie(response, role) {
  response.cookies.set(sessionCookie(role), '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0
  })
}

export function getSession(role) {
  const token = cookies().get(sessionCookie(role))?.value
  if (!token) return null

  const [payload, signature, extra] = token.split('.')
  if (!payload || !signature || extra) return null

  const expected = createHmac('sha256', signingKey()).update(payload).digest()
  const received = Buffer.from(signature, 'base64url')
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (data.role !== role || typeof data.userId !== 'string' || data.expiresAt <= Math.floor(Date.now() / 1000)) {
      return null
    }
    return { userId: data.userId, role: data.role }
  } catch {
    return null
  }
}

export function isSameOrigin(request) {
  const origin = request.headers.get('origin')
  if (!origin) return true
  try {
    return new URL(origin).origin === new URL(request.url).origin
  } catch {
    return false
  }
}

export function verifyPassword(password, storedHash) {
  if (typeof password !== 'string' || !password || typeof storedHash !== 'string' || !storedHash) return false
  const candidates = [
    password,
    createHash('sha256').update(password).digest('hex'),
    createHash('sha256').update(`${password}royal-spin-salt`).digest('hex')
  ]
  return candidates.some(candidate => {
    const left = Buffer.from(candidate)
    const right = Buffer.from(storedHash)
    return left.length === right.length && timingSafeEqual(left, right)
  })
}
