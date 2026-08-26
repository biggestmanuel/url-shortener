Linkly — Next-Gen URL Shortener & Link Management
A modern, high-polish URL shortener and link analytics platform built with vanilla HTML5, CSS3, JavaScript (ES6+), Express, and PostgreSQL/Neon.

✨ Features & UI Highlights
🎨 Modern SaaS UI: Glassmorphism navigation, ambient mesh glow effects, smooth card transitions, and Dark / Light theme toggle with persistence.
⚡ Zero Build Step: 100% vanilla web stack (index.html, styles.css, app.js) that runs instantly in any browser.
📱 QR Code Generator: Instant client-side QR code generator with single-click PNG download for print, flyers, and slides.
📊 Real-Time Analytics Dashboard: Stat summary cards showing Total Links, Total Clicks, Top Performing Link, and Average Clicks per Link.
🔍 Live Search & Multi-Criteria Sorting: Search links in real-time by domain, URL, or short code; sort by Newest, Oldest, Most Clicks, or Fewest Clicks.
🌐 Rich Favicon Previews: Automatically extracts and displays target website favicons next to destination URLs.
🔗 Custom Link Aliases: Optional custom slug creation (e.g. linkly/my-custom-slug) with frontend and backend duplicate validation.
📤 Data Export & Social Share: 1-click export to CSV or JSON, plus quick sharing to X (Twitter), WhatsApp, LinkedIn, and Telegram.
🛡️ Hybrid Offline/Cloud Resilience: Automatically syncs with Express/PostgreSQL when running, or smoothly falls back to local storage demo mode when offline.
⌨️ Keyboard Shortcuts: / to quickly focus the shorten input, Esc to close any open modal.
🚀 Quick Start
1. Run Frontend Directly (Local Demo Mode)
You can open index.html directly in your browser. If the backend is not running, Linkly automatically operates in Local Demo Mode with full local persistence, click simulation, QR generation, search, and export capabilities.

2. Optional: Run with Live PostgreSQL Backend
Step A: Database
Create a Neon PostgreSQL database and run:

bash

backend/schema.sql
Step B: Backend Server
bash

cd backend
cp .env.example .env
# Edit .env with your DATABASE_URL
npm install
npm run dev
The API will listen on http://localhost:3001.

Check backend health:

bash

curl http://localhost:3001/
Step C: Connect Frontend
Open index.html in your browser. The status pill in the top navigation will automatically switch from Local Demo to Cloud Sync.

If your backend is hosted remotely, set:

html

<script>
  window.LINKLY_API_BASE = 'https://your-backend.example.com';
</script>
before app.js.

📡 API Reference
POST /api/links — create a short link (accepts { destinationUrl, customAlias })
GET /api/links?limit=50 — list recent links
DELETE /api/links/:id — delete a link
GET /:code — increment clicks and redirect to destination URL
📂 Project Structure
text

index.html          # Modern semantic layout with stats, modals, & SVG icons
styles.css          # Design system, CSS variables, glassmorphism, responsive grid
app.js              # Application logic, QR engine, analytics, search/sort, fallback
loadtest.js         # Load testing script
backend/
  server.js         # Express REST API & redirect handlers
  package.json
  schema.sql
  .env.example
  lib/
    base62.js       # Base62 encoder for short codes
    db.js           # PostgreSQL connection pool