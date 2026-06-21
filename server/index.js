// Etsy SEO & Product Research Tool — Backend
//
// This server is the only thing that knows your Etsy keystring and shared
// secret. The frontend never sees them. It exposes a small set of routes
// that the frontend calls, which in turn call the real Etsy Open API v3.
//
// Run locally:
//   1. cp .env.example .env   (then fill in your real Etsy credentials)
//   2. npm install
//   3. npm start
//
// The server will run on http://localhost:3001 by default.

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const rateLimit = require('express-rate-limit');

const app = express();

app.set('trust proxy', 1);

const PORT = process.env.PORT || 3001;
const ETSY_KEYSTRING = process.env.ETSY_KEYSTRING;
const ETSY_SHARED_SECRET = process.env.ETSY_SHARED_SECRET;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '*';

const ETSY_API_BASE = 'https://openapi.etsy.com/v3/application';

if (!ETSY_KEYSTRING || !ETSY_SHARED_SECRET || ETSY_KEYSTRING === 'your_keystring_here') {
  console.warn(
    '\n[warning] ETSY_KEYSTRING / ETSY_SHARED_SECRET are not set.\n' +
    'Copy .env.example to .env and fill in your real Etsy app credentials.\n'
  );
}

// --- Middleware -------------------------------------------------------

app.use(cors({ origin: FRONTEND_ORIGIN }));
app.use(express.json());

// Basic rate limiting so a runaway frontend loop can't blow through
// Etsy's daily quota (5 requests/sec, 5,000/day on a personal key).
const searchLimiter = rateLimit({
  windowMs: 1000,      // 1 second
  max: 4,              // stay just under Etsy's 5 requests/sec cap
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, slow down a little and try again.' }
});

// --- Helpers ------------------------------------------------------------

function etsyHeaders() {
  return {
    'x-api-key': `${ETSY_KEYSTRING}:${ETSY_SHARED_SECRET}`,
  };
}

function buildEtsyError(status, body) {
  return {
    error: 'Etsy API request failed',
    status,
    details: body,
  };
}

// Shape a raw Etsy listing into the fields the frontend actually needs.
function simplifyListing(listing) {
  const image = listing.images && listing.images.length > 0 ? listing.images[0] : null;
  return {
    listing_id: listing.listing_id,
    title: listing.title,
    description_snippet: (listing.description || '').slice(0, 160),
    price: listing.price ? Number(listing.price.amount) / Number(listing.price.divisor) : null,
    currency: listing.price ? listing.price.currency_code : null,
    quantity: listing.quantity,
    tags: listing.tags || [],
    url: listing.url,
    views: listing.views ?? null,
    num_favorers: listing.num_favorers ?? null,
    shop_id: listing.shop_id,
    image_url: image ? (image.url_170x135 || image.url_fullxfull) : null,
    created_timestamp: listing.created_timestamp,
  };
}

// Derive simple, explainable research stats from a batch of listings.
// This is NOT Etsy's internal search-volume data (that's proprietary and
// not exposed by the public API) — it's a transparent summary computed
// from the live listings returned by your search.
function computeStats(listings) {
  if (!listings.length) {
    return { count: 0, avg_price: null, avg_favorites: null, avg_views: null, top_tags: [] };
  }

  const prices = listings.map(l => l.price).filter(p => typeof p === 'number');
  const favs = listings.map(l => l.num_favorers).filter(f => typeof f === 'number');
  const views = listings.map(l => l.views).filter(v => typeof v === 'number');

  const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  const tagCounts = {};
  listings.forEach(l => {
    (l.tags || []).forEach(tag => {
      const key = tag.toLowerCase();
      tagCounts[key] = (tagCounts[key] || 0) + 1;
    });
  });
  const top_tags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }));

  return {
    count: listings.length,
    avg_price: avg(prices) !== null ? Math.round(avg(prices) * 100) / 100 : null,
    avg_favorites: avg(favs) !== null ? Math.round(avg(favs)) : null,
    avg_views: avg(views) !== null ? Math.round(avg(views)) : null,
    top_tags,
  };
}

// --- Routes ---------------------------------------------------------------

app.get('/health', (req, res) => {
  res.json({ status: 'ok', etsy_key_configured: Boolean(ETSY_KEYSTRING) });
});

// GET /api/etsy/search?keyword=boho+earrings&limit=24
// Searches active Etsy listings by keyword and returns simplified results
// plus aggregate research stats (avg price, avg favorites, top tags).
app.get('/api/etsy/search', searchLimiter, async (req, res) => {
  const keyword = (req.query.keyword || '').trim();
  const limit = Math.min(Number(req.query.limit) || 24, 100);

  if (!keyword) {
    return res.status(400).json({ error: 'Missing required "keyword" query parameter.' });
  }
  if (!ETSY_KEYSTRING || !ETSY_SHARED_SECRET) {
    return res.status(500).json({ error: 'Server is missing Etsy API credentials. Check your .env file.' });
  }

  try {
    const url = new URL(`${ETSY_API_BASE}/listings/active`);
    url.searchParams.set('keywords', keyword);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('sort_on', 'score');
    url.searchParams.set(
      'includes',
      'Images'
    );

    const etsyRes = await fetch(url.toString(), { headers: etsyHeaders() });
    const body = await etsyRes.json();

    if (!etsyRes.ok) {
      return res.status(etsyRes.status).json(buildEtsyError(etsyRes.status, body));
    }

    const listings = (body.results || []).map(simplifyListing);
    const stats = computeStats(listings);

    res.json({
      keyword,
      count: body.count ?? listings.length,
      returned: listings.length,
      stats,
      listings,
    });
  } catch (err) {
    console.error('Etsy search error:', err);
    res.status(502).json({ error: 'Could not reach Etsy. Try again in a moment.' });
  }
});

// GET /api/etsy/listing/:id — full detail for a single listing
app.get('/api/etsy/listing/:id', searchLimiter, async (req, res) => {
  const { id } = req.params;
  if (!ETSY_KEYSTRING || !ETSY_SHARED_SECRET) {
    return res.status(500).json({ error: 'Server is missing Etsy API credentials. Check your .env file.' });
  }

  try {
    const url = new URL(`${ETSY_API_BASE}/listings/${encodeURIComponent(id)}`);
    url.searchParams.set('includes', 'Images,Shop');

    const etsyRes = await fetch(url.toString(), { headers: etsyHeaders() });
    const body = await etsyRes.json();

    if (!etsyRes.ok) {
      return res.status(etsyRes.status).json(buildEtsyError(etsyRes.status, body));
    }

    res.json(simplifyListing(body));
  } catch (err) {
    console.error('Etsy listing fetch error:', err);
    res.status(502).json({ error: 'Could not reach Etsy. Try again in a moment.' });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`Etsy SEO tool backend running on http://localhost:${PORT}`);
});
