import { NextResponse } from 'next/server'
import { ADMIN_PHONES } from '../../../../lib/auth-constants'
import { clearSessionCookie, isSameOrigin, setSessionCookie, verifyPassword } from '../../../../lib/server-auth'
import { getServiceSupabase } from '../../../../lib/server-supabase'

export const runtime = 'nodejs'

export async function POST(request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }

  let input
  try {
    input = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid sign-in request.' }, { status: 400 })
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return NextResponse.json({ error: 'Invalid sign-in request.' }, { status: 400 })
  }

  const phone = String(input.phone || '').trim()
  const password = String(input.password || '')
  const role = input.role === 'admin' ? 'admin' : 'player'
  if (!phone || !password) {
    return NextResponse.json({ error: 'Enter phone and password.' }, { status: 400 })
  }
  if (role === 'admin' && !ADMIN_PHONES.includes(phone)) {
    return NextResponse.json({ error: 'Invalid admin credentials.' }, { status: 401 })
  }

  try {
    const supabase = getServiceSupabase()
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('phone', phone)
      .maybeSingle()
    if (error) throw error
    if (!user || !verifyPassword(password, user.password_hash)) {
      return NextResponse.json({ error: 'Invalid phone or password.' }, { status: 401 })
    }
    if (role === 'admin' && user.is_admin !== true) {
      return NextResponse.json({ error: 'Invalid admin credentials.' }, { status: 401 })
    }
    if (role === 'player' && user.is_banned) {
      return NextResponse.json({ error: 'Account suspended. Contact support.' }, { status: 403 })
    }

    const response = NextResponse.json({ user }, {
      headers: { 'Cache-Control': 'private, no-store' }
    })
    setSessionCookie(response, user.id, role)
    return response
  } catch (error) {
    console.error('Sign-in session error:', error)
    const missingKey = String(error?.message || '').includes('SUPABASE_SERVICE_ROLE_KEY')
    return NextResponse.json(
      { error: missingKey ? 'The server is missing SUPABASE_SERVICE_ROLE_KEY.' : 'Sign-in service is temporarily unavailable.' },
      { status: missingKey ? 503 : 500 }
    )
  }
}

export async function DELETE(request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }

  const role = new URL(request.url).searchParams.get('role')
  if (role !== 'admin' && role !== 'player') {
    return NextResponse.json({ error: 'Invalid session role.' }, { status: 400 })
  }

  const response = NextResponse.json({ success: true })
  clearSessionCookie(response, role)
  return response
}
