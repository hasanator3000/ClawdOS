#!/usr/bin/env node
/**
 * Create a ClawdOS user with a personal workspace.
 *
 * Usage:
 *   node scripts/create-user.mjs <username> <password>
 *
 * If the user already exists, the password is updated.
 * A personal workspace + membership is always upserted (idempotent).
 */
import argon2 from 'argon2'
import pg from 'pg'

const { Pool } = pg

const [,, username, password] = process.argv
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}
if (!username || !password) {
  console.error('Usage: node scripts/create-user.mjs <username> <password>')
  process.exit(1)
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

try {
  const hash = await argon2.hash(password)

  // 1. Create or update user
  const userRes = await pool.query(
    `INSERT INTO core."user" (username, password_hash)
     VALUES ($1, $2)
     ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING id, username, created_at`,
    [username, hash]
  )
  const user = userRes.rows[0]

  // 2. Create personal workspace (upsert by slug)
  const wsName = username.charAt(0).toUpperCase() + username.slice(1)
  const wsRes = await pool.query(
    `INSERT INTO core.workspace (slug, name, kind, owner_user_id)
     VALUES ($1, $2, 'personal', $3)
     ON CONFLICT (slug) DO UPDATE SET owner_user_id = EXCLUDED.owner_user_id
     RETURNING id, slug, name, kind`,
    [username, wsName, user.id]
  )
  const workspace = wsRes.rows[0]

  // 3. Add user as owner of their personal workspace
  await pool.query(
    `INSERT INTO core.membership (workspace_id, user_id, role)
     VALUES ($1, $2, 'owner')
     ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'owner'`,
    [workspace.id, user.id]
  )

  console.log(JSON.stringify({ user, workspace }, null, 2))
} finally {
  await pool.end()
}
