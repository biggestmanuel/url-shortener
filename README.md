# Linkly — URL Shortener

A polished public-facing URL shortener frontend built with HTML, CSS and Vanilla JavaScript.

## Important architecture note

This package is the **frontend/product V1**. It creates short IDs and persists links in the user's browser using `localStorage`.

That makes it immediately deployable as a free public demo, but it is **not yet a real internet-wide URL shortening service**. A true short URL such as `lnk.ly/abc123` requires a backend/database and redirect endpoint so any visitor can resolve `abc123`.

## Current features

- URL validation
- Short-code generation
- Copy short link
- Recent links dashboard
- Delete links
- Local click counter
- Local persistence
- Dark/light mode
- Responsive UI
- No external dependencies

## Run

Open `index.html` in a browser. No build step is required.

## Next production upgrade

For the real service:
1. Add a backend redirect route: `GET /:code`
2. Store `{code, destination, createdAt, clicks}` in a database.
3. Return a real public domain for generated links.
4. Add rate limiting and abuse protection.
5. Add custom aliases and authenticated link management.
6. Add analytics.

The frontend is deliberately separated so that backend integration can be added without rebuilding the UI.
# url-shortener
