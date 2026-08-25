import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { supabase } from './lib/supabase.js';
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

// POST /api/links -> create a short link
// Two-step insert: we need the row's auto-incrementing `id` before we
// can base62-encode it into a code, so insert first (code left null),
// then update the row with the encoded code.
app.post('/api/links', async (req, res) => {
  const { destinationUrl } = req.body;

  if (!destinationUrl || !isValidUrl(destinationUrl)) {
    return res.status(400).json({ error: 'A valid http(s) URL is required' });
  }

  const { data: inserted, error: insertError } = await supabase
    .from('links')
    .insert({ destination_url: destinationUrl })
    .select('id')
    .single();

  if (insertError) return res.status(500).json({ error: insertError.message });

  const code = encodeBase62(inserted.id);

  const { data: updated, error: updateError } = await supabase
    .from('links')
    .update({ code })
    .eq('id', inserted.id)
    .select()
    .single();

  if (updateError) return res.status(500).json({ error: updateError.message });

  res.status(201).json({
    id: updated.id,
    code: updated.code,
    shortUrl: `${PUBLIC_BASE_URL}/${updated.code}`,
    destinationUrl: updated.destination_url,
    clicks: updated.clicks,
    createdAt: updated.created_at,
  });
});

// GET /api/links -> list all links, newest first
app.get('/api/links', async (req, res) => {
  const { data, error } = await supabase
    .from('links')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  res.json(
    data.map((row) => ({
      id: row.id,
      code: row.code,
      shortUrl: `${PUBLIC_BASE_URL}/${row.code}`,
      destinationUrl: row.destination_url,
      clicks: row.clicks,
      createdAt: row.created_at,
    }))
  );
});

// DELETE /api/links/:id
app.delete('/api/links/:id', async (req, res) => {
  const { error } = await supabase.from('links').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// GET /:code -> the actual short-link redirect. This is the route that
// makes it a real URL shortener rather than a UI mockup: anyone,
// anywhere, hitting PUBLIC_BASE_URL/:code gets sent to the original URL.
// Registered LAST so it doesn't swallow /api/* routes above it.
app.get('/:code', async (req, res) => {
  const { code } = req.params;

  const { data, error } = await supabase.from('links').select('*').eq('code', code).maybeSingle();

  if (error) return res.status(500).send('Something went wrong');
  if (!data) return res.status(404).send('Short link not found');

  // Fire-and-forget click increment — don't make the redirect wait on it.
  supabase
    .from('links')
    .update({ clicks: data.clicks + 1 })
    .eq('id', data.id)
    .then(() => {});

  res.redirect(302, data.destination_url);
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`Linkly backend running on port ${port}`));
