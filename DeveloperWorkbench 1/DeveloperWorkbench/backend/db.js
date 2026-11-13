import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const SCHEMA = 'workbench'

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || undefined,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  max: 10,
})

export async function query(sql, params = []) {
  return pool.query(sql, params)
}

export async function withTransaction(work) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await work(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function ensureSchema() {
  const file = path.join(path.dirname(fileURLToPath(import.meta.url)), 'sql', '001_schema.sql')
  const sql = fs.readFileSync(file, 'utf8')
  await pool.query(sql)
}

export async function closePool() {
  await pool.end()
}

export { SCHEMA }
