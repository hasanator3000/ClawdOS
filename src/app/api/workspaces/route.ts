import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getWorkspacesForUser } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSession()
  if (!session.userId) return NextResponse.json({ workspaces: [] }, { status: 401 })

  const workspaces = await getWorkspacesForUser()
  return NextResponse.json({ workspaces })
}
