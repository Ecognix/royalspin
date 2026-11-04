import { NextResponse } from 'next/server'
import { getSession, isSameOrigin } from '../../../../lib/server-auth'
import { getServiceSupabase } from '../../../../lib/server-supabase'

export const runtime = 'nodejs'

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
          : 'Could not load support chats.'
    },
    { status: missingKey || missingSchema ? 503 : 500 }
  )
}

export async function GET() {
  try {
    const session = getSession('player')
    if (!session) {
      return NextResponse.json({ error: 'Please sign out and sign in again to use support chat.' }, { status: 401 })
    }

    const supabase = getServiceSupabase()
    const { data, error } = await supabase
      .from('support_conversations')
      .select('id, created_at, updated_at')
      .eq('user_id', session.userId)
      .order('updated_at', { ascending: false })
      .limit(100)
    if (error) throw error

    const conversations = data || []
    const previews = {}
    if (conversations.length) {
      const { data: messages, error: messagesError } = await supabase
        .from('support_messages')
        .select('conversation_id, sender_role, message, created_at')
        .in('conversation_id', conversations.map(conversation => conversation.id))
        .order('created_at', { ascending: false })
        .limit(1000)
      if (messagesError) throw messagesError
      for (const message of messages || []) {
        if (!previews[message.conversation_id]) previews[message.conversation_id] = message
      }
    }

    return NextResponse.json({ conversations, previews }, {
      headers: { 'Cache-Control': 'private, no-store' }
    })
  } catch (error) {
    return failure(error, 'conversation load')
  }
}

export async function POST(request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }

  try {
    const session = getSession('player')
    if (!session) {
      return NextResponse.json({ error: 'Please sign out and sign in again to use support chat.' }, { status: 401 })
    }

    const { data, error } = await getServiceSupabase()
      .from('support_conversations')
      .insert({ user_id: session.userId })
      .select('id, created_at, updated_at')
      .single()
    if (error) throw error

    return NextResponse.json({ conversation: data }, { status: 201 })
  } catch (error) {
    return failure(error, 'conversation creation')
  }
}
