import { NextResponse } from 'next/server'
import { getSession, isSameOrigin } from '../../../../lib/server-auth'
import { getServiceSupabase } from '../../../../lib/server-supabase'

export const runtime = 'nodejs'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function failure(error, operation) {
  console.error(`Admin support ${operation} error:`, error)
  const missingKey = String(error?.message || '').includes('SUPABASE_SERVICE_ROLE_KEY')
  const missingSchema = ['42P01', '42703', 'PGRST204', 'PGRST205'].includes(error?.code)
  return NextResponse.json(
    {
      error: missingKey
        ? 'Support is not configured on the server.'
        : missingSchema
          ? 'Support tables are missing. Run support_messages_migration.sql in Supabase.'
          : 'Could not process admin support.'
    },
    { status: missingKey || missingSchema ? 503 : 500 }
  )
}

export async function GET() {
  try {
    const session = getSession('admin')
    if (!session) {
      return NextResponse.json({ error: 'Please sign out and sign in again to manage support.' }, { status: 401 })
    }

    const { data, error } = await getServiceSupabase()
      .from('support_messages')
      .select('id, user_id, conversation_id, sender_role, message, created_at, users:user_id(phone,name)')
      .order('created_at', { ascending: true })
      .limit(5000)
    if (error) throw error

    return NextResponse.json({ messages: data || [] }, {
      headers: { 'Cache-Control': 'private, no-store' }
    })
  } catch (error) {
    return failure(error, 'load')
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
    return NextResponse.json({ error: 'Invalid support reply.' }, { status: 400 })
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return NextResponse.json({ error: 'Invalid support reply.' }, { status: 400 })
  }

  const conversationId = String(input.conversationId || '')
  const message = String(input.message || '').trim()
  if (!uuidPattern.test(conversationId) || !message || message.length > 2000) {
    return NextResponse.json({ error: 'Enter a message of 1–2,000 characters.' }, { status: 400 })
  }

  try {
    const session = getSession('admin')
    if (!session) {
      return NextResponse.json({ error: 'Please sign out and sign in again to manage support.' }, { status: 401 })
    }

    const supabase = getServiceSupabase()
    const { data: conversation, error: conversationError } = await supabase
      .from('support_conversations')
      .select('id, user_id')
      .eq('id', conversationId)
      .maybeSingle()
    if (conversationError) throw conversationError
    if (!conversation) return NextResponse.json({ error: 'Support chat not found.' }, { status: 404 })

    const { data, error } = await supabase
      .from('support_messages')
      .insert({
        conversation_id: conversationId,
        user_id: conversation.user_id,
        sender_role: 'admin',
        message
      })
      .select('id, user_id, conversation_id, sender_role, message, created_at')
      .single()
    if (error) throw error

    return NextResponse.json({ message: data }, { status: 201 })
  } catch (error) {
    return failure(error, 'reply')
  }
}
