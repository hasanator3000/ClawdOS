import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth/session'
import { getActiveWorkspace } from '@/lib/workspace'
import { withUser } from '@/lib/db'
import {
  createTask as createTaskRepo,
  completeTask as completeTaskRepo,
  reopenTask as reopenTaskRepo,
  deleteTask as deleteTaskRepo,
} from '@/lib/db/repositories/task.repository'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  priority: z.number().int().min(0).max(4).optional(),
  dueDate: z.string().optional(),
  dueTime: z.string().optional(),
  tags: z.array(z.string().max(64)).optional(),
})

const patchSchema = z.object({
  op: z.enum(['complete', 'reopen']),
  taskId: z.string().uuid(),
})

const delSchema = z.object({
  taskId: z.string().uuid(),
})

export async function POST(req: Request) {
  const session = await getSession()
  if (!session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspace = await getActiveWorkspace()
  if (!workspace) return NextResponse.json({ error: 'No workspace selected' }, { status: 400 })

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const task = await withUser(session.userId, async (client) => {
    return createTaskRepo(client, { ...parsed.data, workspaceId: workspace.id })
  })

  return NextResponse.json({ task })
}

export async function PATCH(req: Request) {
  const session = await getSession()
  if (!session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const task = await withUser(session.userId, async (client) => {
    return parsed.data.op === 'complete'
      ? completeTaskRepo(client, parsed.data.taskId)
      : reopenTaskRepo(client, parsed.data.taskId)
  })

  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  return NextResponse.json({ task })
}

export async function DELETE(req: Request) {
  const session = await getSession()
  if (!session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = delSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const ok = await withUser(session.userId, async (client) => deleteTaskRepo(client, parsed.data.taskId))
  if (!ok) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  return NextResponse.json({ success: true })
}
