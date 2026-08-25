import pg from 'pg';
import 'dotenv/config';

// Neon is plain Postgres, not a proprietary client like Supabase's
// query builder — so this uses `pg` directly with raw SQL. Neon's
// connection strings require SSL, hence the ssl option below.
const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
