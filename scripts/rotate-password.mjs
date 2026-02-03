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
  console.error('Usage: node scripts/rotate-password.mjs <username> <new_password>')
  process.exit(1)
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const hash = await argon2.hash(password)

const res = await pool.query(
  `UPDATE core."user" SET password_hash=$2 WHERE username=$1 RETURNING id, username`,
  [username, hash]
)

if (res.rowCount === 0) {
  console.error('User not found')
  process.exit(2)
}

console.log(JSON.stringify({ ok: true, user: res.rows[0] }, null, 2))
await pool.end()
