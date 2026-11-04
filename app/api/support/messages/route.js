import { NextResponse } from 'next/server'
import { getSession, isSameOrigin } from '../../../../lib/server-auth'
import { getServiceSupabase } from '../../../../lib/server-supabase'

export const runtime = 'nodejs'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function failure(error, operation) {
  console.error(`Support ${operation} error:`, error)
  const missingKey = String(error?.message || '').includes('SUPABASE_SERVICE_ROLE_KEY')
  const missingSchema = ['42P01', '42703', 'PGRST204', 'PGRST205'].includes(error?.code)
  return NextResponse.json(
    {
      error: missingKey
        ? 'Support is not configured on the server.'
        : missingSchema
          ? 'Support tables are missing. Run support_messages_migration.sql in Supabase.'
          : 'Could not process the support message.'
    },
    { status: missingKey || missingSchema ? 503 : 500 }
  )
}

export async function GET(request) {
  try {
    const session = getSession('player')
    if (!session) {
      return NextResponse.json({ error: 'Please sign out and sign in again to use support chat.' }, { status: 401 })
    }

    const conversationId = new URL(request.url).searchParams.get('conversationId')
    if (!uuidPattern.test(conversationId || '')) {
      return NextResponse.json({ error: 'Choose a valid support chat.' }, { status: 400 })
    }

    const supabase = getServiceSupabase()
    const { data: conversation, error: conversationError } = await supabase
      .from('support_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', session.userId)
      .maybeSingle()
    if (conversationError) throw conversationError
    if (!conversation) return NextResponse.json({ error: 'Support chat not found.' }, { status: 404 })

    const { data, error } = await supabase
      .from('support_messages')
      .select('id, sender_role, message, created_at')
      .eq('conversation_id', conversationId)
      .eq('user_id', session.userId)
      .order('created_at', { ascending: true })
      .limit(1000)
    if (error) throw error

    return NextResponse.json({ messages: data || [] }, {
      headers: { 'Cache-Control': 'private, no-store' }
    })
  } catch (error) {
    return failure(error, 'message load')
  }
}

export async function POST(request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }

  let input
  try {
    input = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid support message.' }, { status: 400 })
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return NextResponse.json({ error: 'Invalid support message.' }, { status: 400 })
  }

  const conversationId = String(input.conversationId || '')
  const message = String(input.message || '').trim()
  if (!uuidPattern.test(conversationId) || !message || message.length > 2000) {
    return NextResponse.json({ error: 'Enter a message of 1–2,000 characters.' }, { status: 400 })
  }

  try {
    const session = getSession('player')
    if (!session) {
      return NextResponse.json({ error: 'Please sign out and sign in again to use support chat.' }, { status: 401 })
    }

    const supabase = getServiceSupabase()
    const { data: conversation, error: conversationError } = await supabase
      .from('support_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', session.userId)
      .maybeSingle()
    if (conversationError) throw conversationError
    if (!conversation) return NextResponse.json({ error: 'Support chat not found.' }, { status: 404 })

    const { data, error } = await supabase
      .from('support_messages')
      .insert({
        conversation_id: conversationId,
        user_id: session.userId,
        sender_role: 'user',
        message
      })
      .select('id, sender_role, message, created_at')
      .single()
    if (error) throw error

    return NextResponse.json({ message: data }, { status: 201 })
  } catch (error) {
    return failure(error, 'message send')
  }
}
