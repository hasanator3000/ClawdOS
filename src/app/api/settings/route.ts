import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { withUser } from '@/lib/db'
import { getUserSettings, setUserSetting, deleteUserSetting } from '@/lib/db/repositories/user-setting.repository'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const keysParam = req.nextUrl.searchParams.get('keys')
  const keys = keysParam ? keysParam.split(',').map((k) => k.trim()).filter(Boolean) : undefined

  const settings = await withUser(session.userId, (client) => getUserSettings(client, keys))

  // Return as key-value map
  const map: Record<string, unknown> = {}
  for (const s of settings) {
    map[s.key] = s.value
  }

  return NextResponse.json({ settings: map })
}

export async function PUT(req: NextRequest) {
  const session = await getSession()
  if (!session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { key, value } = body

  if (!key || typeof key !== 'string') {
    return NextResponse.json({ error: 'Missing or invalid key' }, { status: 400 })
  }

  await withUser(session.userId, (client) => setUserSetting(client, key, value))

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const key = req.nextUrl.searchParams.get('key')
  if (!key) {
    return NextResponse.json({ error: 'Missing key parameter' }, { status: 400 })
  }

  const deleted = await withUser(session.userId, (client) => deleteUserSetting(client, key))

  return NextResponse.json({ ok: true, deleted })
}
