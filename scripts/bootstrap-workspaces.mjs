#!/usr/bin/env node
import pg from 'pg'

const { Pool } = pg

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required')
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

async function ensureMembership(workspaceId, username, role='member') {
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

const agUser = process.env.AG_USERNAME || 'ag'
const germanUser = process.env.GERMAN_USERNAME || 'german'

const agWs = await ensureWorkspace('ag', 'AG', 'personal', agUser)
const germanWs = await ensureWorkspace('german', 'German', 'personal', germanUser)
const sharedWs = await ensureWorkspace('shared', 'Shared', 'shared', null)

await ensureMembership(agWs.id, agUser, 'owner')
await ensureMembership(sharedWs.id, agUser, 'owner')

await ensureMembership(germanWs.id, germanUser, 'owner')
await ensureMembership(sharedWs.id, germanUser, 'member')

console.log(JSON.stringify({ workspaces: { ag: agWs, german: germanWs, shared: sharedWs } }, null, 2))
await pool.end()
