import type { PoolClient } from 'pg'

export interface UserSetting {
  key: string
  value: unknown
  updatedAt: Date
}

export async function getUserSetting(client: PoolClient, key: string): Promise<unknown | null> {
  const res = await client.query(
    `select value from core.user_setting where user_id = core.current_user_id() and key = $1`,
    [key]
  )
  return res.rows[0]?.value ?? null
}

export async function getUserSettings(client: PoolClient, keys?: string[]): Promise<UserSetting[]> {
  if (keys && keys.length > 0) {
    const res = await client.query(
      `select key, value, updated_at as "updatedAt"
       from core.user_setting
       where user_id = core.current_user_id() and key = any($1)
       order by key`,
      [keys]
    )
    return res.rows as UserSetting[]
  }

  const res = await client.query(
    `select key, value, updated_at as "updatedAt"
     from core.user_setting
     where user_id = core.current_user_id()
     order by key`
  )
  return res.rows as UserSetting[]
}

export async function setUserSetting(client: PoolClient, key: string, value: unknown): Promise<void> {
  await client.query(
    `insert into core.user_setting (user_id, key, value, updated_at)
     values (core.current_user_id(), $1, $2, now())
     on conflict (user_id, key) do update set value = $2, updated_at = now()`,
    [key, JSON.stringify(value)]
  )
}

export async function deleteUserSetting(client: PoolClient, key: string): Promise<boolean> {
  const res = await client.query(
    `delete from core.user_setting where user_id = core.current_user_id() and key = $1`,
    [key]
  )
  return (res.rowCount ?? 0) > 0
}
