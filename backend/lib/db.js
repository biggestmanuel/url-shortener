import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

// Neon requires SSL. Explicitly use verify-full so pg's upcoming SSL-mode
// semantics do not weaken the connection.
const normalizedConnectionString = connectionString.replace(
  /([?&])sslmode=(prefer|require|verify-ca)(?=(&|$))/i,
  '$1sslmode=verify-full'
);

export const pool = new Pool({
  connectionString: normalizedConnectionString,
  max: 20,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
});
