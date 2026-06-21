# Listing Lab — Etsy keyword & listing research tool

A small full-stack tool for searching live Etsy listings by keyword. Shows
pricing, favorites, views, and the tags top listings are using — useful for
SEO and product research.

```
etsy-seo-tool/
├── server/      backend (Express) — holds your Etsy API keys, calls Etsy
└── public/      frontend (plain HTML/CSS/JS) — what you see in the browser
```

Your Etsy keystring and shared secret live ONLY in `server/.env`, never in
the frontend. The browser talks to your backend; your backend talks to Etsy.

## 1. Backend setup

```bash
cd server
cp .env.example .env
```

Open `.env` and fill in your real Etsy credentials (from
etsy.com/developers → Your Apps):

```
ETSY_KEYSTRING=your_keystring_here
ETSY_SHARED_SECRET=your_shared_secret_here
```

Then install and run:

```bash
npm install
npm start
```

You should see:

```
Etsy SEO tool backend running on http://localhost:3001
```

Test it's alive: open `http://localhost:3001/health` in your browser — you
should see `{"status":"ok","etsy_key_configured":true}`.

## 2. Frontend setup

The frontend is plain static files — no build step. Easiest way to run it
locally: open `public/index.html` directly, or serve the folder with any
static server, e.g.:

```bash
cd public
npx serve .
```

Make sure `public/config.js` points at your backend's URL (defaults to
`http://localhost:3001`, which is correct for local testing).

## 3. Try it

With the backend running and the frontend open, type a keyword like
"boho earrings" and hit search. You'll see real, live Etsy listings, an
average price, average favorites, average views, and the most common tags
across the results.

## Deploying for real use

- **Backend**: deploy the `server/` folder to a free host like Render,
  Railway, or Fly.io. Set the same environment variables (`ETSY_KEYSTRING`,
  `ETSY_SHARED_SECRET`, `FRONTEND_ORIGIN`) in that host's dashboard —
  never commit your `.env` file.
- **Frontend**: deploy the `public/` folder to any static host (Netlify,
  Vercel, GitHub Pages). Update `public/config.js` to point
  `API_BASE_URL` at your deployed backend's URL.

## Notes on what this does and doesn't do

- Uses Etsy's official `findAllListingsActive` endpoint to search real,
  live, public listings — not scraped or estimated data.
- The "average price / favorites / views / top tags" stats are computed
  transparently from whatever listings your search returns. This is not
  the same as eRank's or Marmalead's proprietary search-volume scoring —
  Etsy doesn't expose internal search-volume data publicly, so no public
  tool (including this one) can give you Etsy's literal internal search
  counts. What you get instead is a real read on current competition,
  pricing, and tagging for any keyword.
- Etsy's free/personal API key allows roughly 5 requests/second and
  5,000/day — the backend includes basic rate limiting to stay under that.
