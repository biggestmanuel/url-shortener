# Linkly — URL Shortener

Frontend (`index.html` + `styles.css`) unchanged. `app.js` calls a real
backend instead of localStorage. `backend/` runs on **Neon** (plain
Postgres), kept separate from your Supabase projects (Cavaner, Qerad)
so load-testing this doesn't touch either of their quotas.

## What changed and why

Original version stored links in `localStorage` — links only ever
resolved inside your own browser, so it wasn't really shortening URLs
for anyone else. Now:

- **IDs**: Postgres auto-increments a `bigserial` id per link, then
  that id gets base62-encoded into the short code
  (`backend/lib/base62.js` — read the comments there, that's the
  concept this project exists to teach).
- **Routing**: `GET /:code` in `backend/server.js` is a real
  server-side redirect — works for anyone, any device.
- **Persistence**: links live in real Postgres via Neon, survive
  restarts, work across devices.

## 1. Create a Neon project

1. Go to neon.tech, sign in, create a new project (free tier).
2. In the dashboard, find **Connection Details** and copy the
   connection string (prefer the "pooled connection" one if offered —
   better suited to a server handling many short requests).
3. Open the **SQL Editor** in Neon's dashboard and run
   `backend/schema.sql`.

## 2. Backend setup

```bash
cd backend
cp .env.example .env
```

Paste your Neon connection string into `DATABASE_URL` in `.env`.

```bash
npm install
npm run dev
```

Runs on `http://localhost:3001`.

## 3. Sanity check

```bash
curl http://localhost:3001/api/links
# -> []

curl -X POST http://localhost:3001/api/links \
  -H "Content-Type: application/json" \
  -d '{"destinationUrl": "https://example.com"}'
# -> { "shortUrl": "http://localhost:3001/1", ... }

curl -i http://localhost:3001/1
# -> HTTP/1.1 302 Found, Location: https://example.com
```

## 4. Frontend

Open `index.html` directly — no build step. `app.js` points at
`API_BASE = 'http://localhost:3001'`; update that (and
`PUBLIC_BASE_URL` in `.env`) once you deploy the backend somewhere.

## Why Neon instead of Supabase here

Your two Supabase free-tier slots are already spoken for — Cavaner
(auth) and Qerad (tied to a pitch competition submission). Rather than
crowd a `links` table into either of those projects, or risk their
quota during load testing, Linkly gets its own free Postgres via Neon.
Same SQL, same concepts — Neon just doesn't bundle the extra
auth/storage/RLS features Supabase does, because this project doesn't
need them.

## What you should be able to explain after this

- Why base62-encoding an auto-incrementing id guarantees no
  collisions, instead of generating a random string and hoping
- Why the redirect (`GET /:code`) has to live on the server, not in
  `app.js`
- The difference between Supabase's query-builder client and using
  `pg` with raw SQL directly against Neon — same database engine,
  different access layer

## Folder structure

```
index.html              unchanged
styles.css               unchanged (yours)
app.js                  calls backend API instead of localStorage
backend/
  server.js              routes: POST/GET /api/links, DELETE /api/links/:id, GET /:code
  lib/base62.js           encode/decode — the ID-generation lesson
  lib/db.js                 pg Pool connected to Neon
  schema.sql                run this in Neon's SQL editor
  .env.example
  package.json
```
