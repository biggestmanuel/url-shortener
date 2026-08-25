import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { pool } from './lib/db.js';
import { encodeBase62 } from './lib/base62.js';

const app = express();
app.use(cors());
app.use(express.json());

const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'http://localhost:3001';

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
// Two-step insert: we need the row's auto-incrementing `id` before we
// can base62-encode it into a code, so insert first (code left null),
// then update the row with the encoded code.
app.post('/api/links', async (req, res) => {
  const { destinationUrl } = req.body;

  if (!destinationUrl || !isValidUrl(destinationUrl)) {
    return res.status(400).json({ error: 'A valid http(s) URL is required' });
  }

  try {
    const insertResult = await pool.query(
      'insert into links (destination_url) values ($1) returning id',
      [destinationUrl]
    );
    const id = insertResult.rows[0].id;
    const code = encodeBase62(id);

    const updateResult = await pool.query(
      'update links set code = $1 where id = $2 returning *',
      [code, id]
    );

    res.status(201).json(toLinkResponse(updateResult.rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/links -> list all links, newest first
app.get('/api/links', async (req, res) => {
  try {
    const result = await pool.query('select * from links order by created_at desc');
    res.json(result.rows.map(toLinkResponse));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/links/:id
app.delete('/api/links/:id', async (req, res) => {
  try {
    await pool.query('delete from links where id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /:code -> the actual short-link redirect. Registered LAST so it
// doesn't swallow /api/* routes above it.
app.get('/:code', async (req, res) => {
  const { code } = req.params;

  try {
    const result = await pool.query('select * from links where code = $1', [code]);
    const link = result.rows[0];

    if (!link) return res.status(404).send('Short link not found');

    // Fire-and-forget click increment — don't make the redirect wait on it.
    pool.query('update links set clicks = clicks + 1 where id = $1', [link.id]).catch(() => {});

    res.redirect(302, link.destination_url);
  } catch (err) {
    res.status(500).send('Something went wrong');
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`Linkly backend running on port ${port}`));
