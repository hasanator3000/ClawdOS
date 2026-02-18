import { getPool } from '../index'

export type ChallengeKind = 'login' | 'recovery' | 'link'

export async function createChallenge(userId: string, kind: ChallengeKind, code: string) {
  const pool = getPool()
  const res = await pool.query(
    `insert into core.auth_challenge (user_id, kind, code, expires_at)
     values ($1,$2,$3, now() + interval '10 minutes')
     returning id, expires_at`,
    [userId, kind, code]
  )
  return { id: res.rows[0].id as string, expiresAt: res.rows[0].expires_at as string }
}

export async function consumeChallenge(id: string, code: string, kind: ChallengeKind) {
  const pool = getPool()
  const res = await pool.query(
    `update core.auth_challenge
     set consumed_at = now()
     where id = $1
       and kind = $2
       and consumed_at is null
       and expires_at > now()
       and code = $3
     returning user_id`,
    [id, kind, code]
  )
  return (res.rows[0]?.user_id as string | undefined) ?? null
}
