import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  ssl: {
    rejectUnauthorized: false,
  },

  // Neon pooled connection budget.
  max: 200,

  // Don't let requests wait forever for a database connection.
  connectionTimeoutMillis: 5000,

  // Release idle connections after 30 seconds.
  idleTimeoutMillis: 30000,
});