# Linkly — URL Shortener

A small production-minded URL shortener with a vanilla HTML/CSS/JS frontend, Express backend, and PostgreSQL/Neon persistence.

## Fixed in this version

- Repaired the frontend/CSS class mismatch that made the link dashboard look unstyled.
- Added a complete responsive UI for desktop and mobile.
- Added working light/dark theme toggle.
- Added loading and submit states.
- Added reliable clipboard fallback.
- Added URL validation and clearer errors.
- Added safe DOM escaping for link data.
- Added a backend health response at `/`.
- Limited the links API to recent links instead of returning thousands of load-test rows.
- Added a database index for recent-link queries.
- Hardened the PostgreSQL SSL configuration to explicitly use `verify-full`.
- Kept real server-side redirects and click tracking.
- Added 404 handling for deleting missing links.

## Run locally

### 1. Database

Create a Neon PostgreSQL database and run:

```bash
backend/schema.sql
```

### 2. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

The API runs on `http://localhost:3001`.

Check:

```bash
curl http://localhost:3001/
```

You should get a small JSON health response.

### 3. Frontend

Open `index.html` in your browser.

The frontend defaults to:

```text
http://localhost:3001
```

If the backend is deployed elsewhere, change `API_BASE` in `app.js`, or define:

```html
<script>
  window.LINKLY_API_BASE = 'https://your-backend.example.com';
</script>
```

before loading `app.js`.

## API

- `POST /api/links` — create a short link
- `GET /api/links?limit=50` — list recent links
- `DELETE /api/links/:id` — delete a link
- `GET /:code` — increment clicks and redirect

## Project structure

```text
index.html
styles.css
app.js
loadtest.js
backend/
  server.js
  package.json
  schema.sql
  .env.example
  lib/
    base62.js
    db.js
```
