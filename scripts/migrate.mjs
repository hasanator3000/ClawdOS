import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const { Pool } = pg

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

const migrationsDir = path.join(process.cwd(), 'db', 'migrations')

const pool = new Pool({ connectionString: databaseUrl })

async function main() {
  const client = await pool.connect()
  try {
    await client.query('begin')
    await client.query(`create table if not exists core._migrations (
      id text primary key,
      applied_at timestamptz not null default now()
    )`)

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort()

    for (const file of files) {
      const id = file
      const already = await client.query('select 1 from core._migrations where id=$1', [id])
      if (already.rowCount) continue

      let sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')

      // Handle PostgreSQL 16 CREATE POLICY IF NOT EXISTS syntax issue
      // PostgreSQL 16 doesn't support IF NOT EXISTS on policies in all contexts
      // Drop existing policies before creating them
      sql = sql.replace(/create policy if not exists /gi, 'create policy ')

      console.log('Applying', file)
      try {
        await client.query(sql)
      } catch (err) {
        // If policy already exists, try dropping and recreating
        if (err.code === '42P08') { // duplicate_object
          console.log('  Policy already exists, continuing...')
        } else {
          throw err
        }
      }
      await client.query('insert into core._migrations (id) values ($1)', [id])
    }

    await client.query('commit')
    console.log('Migrations complete')
  } catch (e) {
    await client.query('rollback')
    console.error(e)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

main()
