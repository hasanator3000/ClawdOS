import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { withUser } from '@/lib/db'
import { getUserSettings, setUserSetting, deleteUserSetting } from '@/lib/db/repositories/user-setting.repository'
import { formatZodErrors } from '@/lib/validation'
import { settingsPutSchema, settingsDeleteKeySchema } from '@/lib/validation-schemas'

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

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON', fields: {} }, { status: 400 })

  const parsed = settingsPutSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', fields: formatZodErrors(parsed.error) }, { status: 400 })
  }

  await withUser(session.userId, (client) => setUserSetting(client, parsed.data.key, parsed.data.value))

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const key = req.nextUrl.searchParams.get('key')
  const keyParsed = settingsDeleteKeySchema.safeParse(key)
  if (!keyParsed.success) {
    return NextResponse.json({ error: 'Validation failed', fields: { key: keyParsed.error.issues[0]?.message ?? 'Invalid key' } }, { status: 400 })
  }

  const deleted = await withUser(session.userId, (client) => deleteUserSetting(client, keyParsed.data))

  return NextResponse.json({ ok: true, deleted })
}
