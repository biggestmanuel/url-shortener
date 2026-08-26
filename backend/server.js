import express from 'express';
import cors from 'cors';
import 'dotenv/config';

import { pool } from './lib/db.js';
import { encodeBase62 } from './lib/base62.js';

const app = express();

app.use(cors());
app.use(express.json());

const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL || 'http://localhost:3001';

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

// POST /api/links -> create a short link
//
// The insert + code update happen inside one transaction.
// This prevents partially-created rows with code = NULL.
app.post('/api/links', async (req, res) => {
  const { destinationUrl } = req.body;

  if (!destinationUrl || !isValidUrl(destinationUrl)) {
    return res
      .status(400)
      .json({ error: 'A valid http(s) URL is required' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const insertResult = await client.query(
      'INSERT INTO links (destination_url) VALUES ($1) RETURNING id',
      [destinationUrl]
    );

    const id = insertResult.rows[0].id;
    const code = encodeBase62(id);

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

    res.status(500).json({
      error: 'Failed to create short link',
    });
  } finally {
    client.release();
  }
});

// GET /api/links -> list all links, newest first
app.get('/api/links', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM links WHERE code IS NOT NULL ORDER BY created_at DESC'
    );

    res.json(result.rows.map(toLinkResponse));
  } catch (err) {
    console.error('List links error:', err);

    res.status(500).json({
      error: 'Failed to fetch links',
    });
  }
});

// DELETE /api/links/:id
app.delete('/api/links/:id', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM links WHERE id = $1',
      [req.params.id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Delete link error:', err);

    res.status(500).json({
      error: 'Failed to delete link',
    });
  }
});

// GET /:code -> actual short-link redirect
//
// Registered LAST so it doesn't swallow /api/* routes.
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

    // Fire-and-forget click increment.
    pool
      .query(
        'UPDATE links SET clicks = clicks + 1 WHERE id = $1',
        [link.id]
      )
      .catch(() => {});

    res.redirect(302, link.destination_url);
  } catch (err) {
    console.error('Redirect error:', err);

    res.status(500).send('Something went wrong');
  }
});

const port = process.env.PORT || 3001;

app.listen(port, () => {
  console.log(`Linkly backend running on port ${port}`);
});