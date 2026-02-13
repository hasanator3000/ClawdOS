#!/usr/bin/env node
/**
 * Bootstrap workspaces for ClawdOS.
 *
 * Usage:
 *   OWNER=<username> node scripts/bootstrap-workspaces.mjs
 *
 * Environment variables:
 *   DATABASE_URL  — required
 *   OWNER         — username of the primary user (must already exist via create-user.mjs)
 *   WS_NAME       — workspace display name (default: capitalised OWNER)
 *
 * Creates one personal workspace owned by OWNER.
 * You can run the script multiple times — it upserts.
 */
import pg from 'pg'

const { Pool } = pg

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}

const owner = process.env.OWNER
if (!owner) {
  console.error('OWNER is required. Set OWNER=<username> (the user must already exist).')
  console.error('Example: OWNER=alice node scripts/bootstrap-workspaces.mjs')
  process.exit(1)
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function ensureWorkspace(slug, name, kind, ownerUsername = null) {
  let ownerId = null
  if (ownerUsername) {
    const u = await pool.query('SELECT id FROM core."user" WHERE username=$1', [ownerUsername])
    if (u.rowCount === 0) throw new Error(`Owner user not found: ${ownerUsername}`)
    ownerId = u.rows[0].id
  }

  const res = await pool.query(
    `INSERT INTO core.workspace (slug, name, kind, owner_user_id)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name, kind=EXCLUDED.kind, owner_user_id=EXCLUDED.owner_user_id
     RETURNING id, slug, name, kind`,
    [slug, name, kind, ownerId]
  )
  return res.rows[0]
}

async function ensureMembership(workspaceId, username, role = 'member') {
  const u = await pool.query('SELECT id FROM core."user" WHERE username=$1', [username])
  if (u.rowCount === 0) throw new Error(`User not found: ${username}`)
  const userId = u.rows[0].id

  const res = await pool.query(
    `INSERT INTO core.membership (workspace_id, user_id, role)
     VALUES ($1,$2,$3)
     ON CONFLICT (workspace_id, user_id) DO UPDATE SET role=EXCLUDED.role
     RETURNING workspace_id, user_id, role`,
    [workspaceId, userId, role]
  )
  return res.rows[0]
}

const wsName = process.env.WS_NAME || owner.charAt(0).toUpperCase() + owner.slice(1)
const ws = await ensureWorkspace(owner, wsName, 'personal', owner)
await ensureMembership(ws.id, owner, 'owner')

console.log(JSON.stringify({ workspace: ws }, null, 2))
await pool.end()