# Linkly — URL Shortener

Frontend (your existing `index.html` + `styles.css`) is unchanged.
`app.js` is rewritten to call a real backend instead of localStorage,
and `backend/` is new — this is what makes it an actual URL shortener:
short links now resolve for anyone, not just in your own browser.

## What changed and why

Your original version stored links in `localStorage`, so
`yourlink.com/abc123` only ever meant something inside your own
browser — nobody else could visit it. That skipped the actual point of
the project: routing, ID generation, and persistence that works for
real.

Now:
- **IDs**: Postgres auto-increments a `bigserial` id per link. That id
  gets base62-encoded into the short code (`backend/lib/base62.js`) —
  read the comments in that file, it's the concept this project exists
  to teach.
- **Routing**: `GET /:code` in `backend/server.js` is a real
  server-side redirect. Whoever hits it — from any device, anywhere —
  gets sent to the original URL. This has to be a server route, not
  something client-side JS can do, because the browser has to actually
  navigate away before your React/vanilla JS ever runs.
- **Persistence**: links live in Postgres via Supabase, survive
  refreshes, restarts, and work across devices.

## 1. Database setup

Create a free Supabase project, then run `backend/schema.sql` in its
SQL editor.

## 2. Backend setup

```bash
cd backend
cp .env.example .env
```

Fill in your Supabase URL and **service role key** (Project Settings →
API — the service key, not the anon key, since this server writes
directly and doesn't go through Row Level Security).

```bash
npm install
npm run dev
```

Runs on `http://localhost:3001` by default.

## 3. Frontend

`app.js` points at `API_BASE = 'http://localhost:3001'`. Just open
`index.html` — no build step, same as before. Update `API_BASE` (and
`PUBLIC_BASE_URL` in `backend/.env`) once you deploy the backend
somewhere like Render or Railway's free tier.

## What you should be able to explain after this

- Why base62 encoding an auto-incrementing id guarantees no
  collisions, instead of generating a random string and hoping
- Why the redirect (`GET /:code`) has to live on the server, not in
  `app.js`
- Why the backend uses the Supabase **service role** key while a
  project like your password manager uses the **anon** key with RLS
  policies instead (this server is the only writer, so there's no
  browser-facing access to lock down)

## Folder structure

```
index.html              unchanged
styles.css               unchanged (yours)
app.js                  rewritten — calls backend API instead of localStorage
backend/
  server.js              routes: POST/GET /api/links, DELETE /api/links/:id, GET /:code
  lib/base62.js           encode/decode — the ID-generation lesson
  lib/supabase.js          Supabase client (service role key)
  schema.sql                run this in Supabase's SQL editor
  .env.example
  package.json
```
