import type { PoolClient } from 'pg'

export interface Project {
  id: string
  workspaceId: string
  name: string
  createdAt: Date
  updatedAt: Date
}

const PROJECT_COLS = `
  id, workspace_id as "workspaceId", name,
  created_at as "createdAt", updated_at as "updatedAt"`

export async function createProject(
  client: PoolClient,
  workspaceId: string,
  name: string
): Promise<Project> {
  const result = await client.query(
    `insert into core.project (workspace_id, name)
     values ($1, $2)
     returning ${PROJECT_COLS}`,
    [workspaceId, name]
  )
  return result.rows[0] as Project
}

export async function getProjectsByWorkspace(
  client: PoolClient,
  workspaceId: string
): Promise<Project[]> {
  const result = await client.query(
    `select ${PROJECT_COLS} from core.project
     where workspace_id = $1
     order by name`,
    [workspaceId]
  )
  return result.rows as Project[]
}

export async function deleteProject(
  client: PoolClient,
  projectId: string
): Promise<boolean> {
  const result = await client.query(
    'delete from core.project where id = $1',
    [projectId]
  )
  return (result.rowCount ?? 0) > 0
}
