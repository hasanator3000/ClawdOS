import type { PoolClient } from 'pg'
import { getPool } from '../index'

// User Settings

export async function getUserSetting<T = unknown>(
  client: PoolClient,
  userId: string,
  key: string
): Promise<T | null> {
  const result = await client.query('select value from core.user_setting where user_id = $1 and key = $2', [
    userId,
    key,
  ])
  return result.rows[0]?.value ?? null
}

export async function setUserSetting(
  client: PoolClient,
  userId: string,
  key: string,
  value: unknown
): Promise<void> {
  await client.query(
    `insert into core.user_setting (user_id, key, value, updated_at)
     values ($1, $2, $3, now())
     on conflict (user_id, key)
     do update set value = $3, updated_at = now()`,
    [userId, key, JSON.stringify(value)]
  )
}

export async function deleteUserSetting(client: PoolClient, userId: string, key: string): Promise<boolean> {
  const result = await client.query('delete from core.user_setting where user_id = $1 and key = $2', [
    userId,
    key,
  ])
  return (result.rowCount ?? 0) > 0
}

export async function getAllUserSettings(
  client: PoolClient,
  userId: string
): Promise<Record<string, unknown>> {
  const result = await client.query('select key, value from core.user_setting where user_id = $1', [userId])

  const settings: Record<string, unknown> = {}
  for (const row of result.rows) {
    settings[row.key] = row.value
  }
  return settings
}

// Workspace Settings

export async function getWorkspaceSetting<T = unknown>(
  client: PoolClient,
  workspaceId: string,
  key: string
): Promise<T | null> {
  const result = await client.query(
    'select value from core.workspace_setting where workspace_id = $1 and key = $2',
    [workspaceId, key]
  )
  return result.rows[0]?.value ?? null
}

export async function setWorkspaceSetting(
  client: PoolClient,
  workspaceId: string,
  key: string,
  value: unknown
): Promise<void> {
  await client.query(
    `insert into core.workspace_setting (workspace_id, key, value, updated_at)
     values ($1, $2, $3, now())
     on conflict (workspace_id, key)
     do update set value = $3, updated_at = now()`,
    [workspaceId, key, JSON.stringify(value)]
  )
}

export async function deleteWorkspaceSetting(
  client: PoolClient,
  workspaceId: string,
  key: string
): Promise<boolean> {
  const result = await client.query(
    'delete from core.workspace_setting where workspace_id = $1 and key = $2',
    [workspaceId, key]
  )
  return (result.rowCount ?? 0) > 0
}

export async function getAllWorkspaceSettings(
  client: PoolClient,
  workspaceId: string
): Promise<Record<string, unknown>> {
  const result = await client.query('select key, value from core.workspace_setting where workspace_id = $1', [
    workspaceId,
  ])

  const settings: Record<string, unknown> = {}
  for (const row of result.rows) {
    settings[row.key] = row.value
  }
  return settings
}

// Convenience functions without client (for simple reads)

export async function getUserSettingDirect<T = unknown>(userId: string, key: string): Promise<T | null> {
  const pool = getPool()
  const result = await pool.query('select value from core.user_setting where user_id = $1 and key = $2', [
    userId,
    key,
  ])
  return result.rows[0]?.value ?? null
}

export async function setUserSettingDirect(userId: string, key: string, value: unknown): Promise<void> {
  const pool = getPool()
  await pool.query(
    `insert into core.user_setting (user_id, key, value, updated_at)
     values ($1, $2, $3, now())
     on conflict (user_id, key)
     do update set value = $3, updated_at = now()`,
    [userId, key, JSON.stringify(value)]
  )
}
