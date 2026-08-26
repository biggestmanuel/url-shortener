import express from 'express';
import cors from 'cors';
import 'dotenv/config';

import { pool } from './lib/db.js';
import { encodeBase62 } from './lib/base62.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '32kb' }));

const PUBLIC_BASE_URL = (
  process.env.PUBLIC_BASE_URL || 'http://localhost:3001'
).replace(/\/+$/, '');

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function isValidUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function toLinkResponse(row) {
  return {
    id: row.id,
    code: row.code,
    shortUrl: `${PUBLIC_BASE_URL}/${row.code}`,
    destinationUrl: row.destination_url,
    clicks: row.clicks,
    createdAt: row.created_at,
  };
}

app.get('/', (_req, res) => {
  res.json({
    name: 'Linkly API',
    status: 'ok',
    endpoints: {
      links: '/api/links',
      redirect: '/:code',
    },
  });
});

// POST /api/links -> create a short link
app.post('/api/links', async (req, res) => {
  const { destinationUrl } = req.body;

  if (
    typeof destinationUrl !== 'string' ||
    destinationUrl.length === 0 ||
    destinationUrl.length > 2048 ||
    !isValidUrl(destinationUrl)
  ) {
    return res.status(400).json({
      error: 'A valid http(s) URL is required (max 2048 characters)',
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const insertResult = await client.query(
      'INSERT INTO links (destination_url) VALUES ($1) RETURNING id',
      [destinationUrl]
    );

    const id = insertResult.rows[0].id;
    const code = encodeBase62(Number(id));

    const updateResult = await client.query(
      'UPDATE links SET code = $1 WHERE id = $2 RETURNING *',
      [code, id]
    );

    if (updateResult.rows.length === 0) {
      throw new Error('Failed to generate short link');
    }

    await client.query('COMMIT');
    res.status(201).json(toLinkResponse(updateResult.rows[0]));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create link error:', err);
    res.status(500).json({ error: 'Failed to create short link' });
  } finally {
    client.release();
  }
});

// GET /api/links -> list recent links
app.get('/api/links', async (req, res) => {
  const requestedLimit = Number.parseInt(req.query.limit, 10);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), MAX_LIMIT)
    : DEFAULT_LIMIT;

  try {
    const result = await pool.query(
      `SELECT * FROM links
       WHERE code IS NOT NULL
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );

    res.json(result.rows.map(toLinkResponse));
  } catch (err) {
    console.error('List links error:', err);
    res.status(500).json({ error: 'Failed to fetch links' });
  }
});

// DELETE /api/links/:id
app.delete('/api/links/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM links WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Link not found' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Delete link error:', err);
    res.status(500).json({ error: 'Failed to delete link' });
  }
});

// GET /:code -> actual short-link redirect
app.get('/:code', async (req, res) => {
  const { code } = req.params;

  try {
    const result = await pool.query(
      'SELECT * FROM links WHERE code = $1',
      [code]
    );

    const link = result.rows[0];

    if (!link) {
      return res.status(404).send('Short link not found');
    }

    await pool.query(
      'UPDATE links SET clicks = clicks + 1 WHERE id = $1',
      [link.id]
    );

    res.redirect(302, link.destination_url);
  } catch (err) {
    console.error('Redirect error:', err);
    res.status(500).send('Something went wrong');
  }
});

const port = Number(process.env.PORT) || 3001;

app.listen(port, () => {
  console.log(`Linkly backend running on port ${port}`);
});
