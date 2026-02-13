#!/usr/bin/env node
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

const hash = await argon2.hash(password)

const res = await pool.query(
  `INSERT INTO core."user" (username, password_hash)
   VALUES ($1, $2)
   ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash
   RETURNING id, username, created_at`,
  [username, hash]
)

console.log(JSON.stringify(res.rows[0], null, 2))
await pool.end()
