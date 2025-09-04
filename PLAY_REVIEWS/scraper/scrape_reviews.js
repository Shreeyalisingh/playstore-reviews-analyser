const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { DateTime } = require('luxon');
require('dotenv').config();

const reviewsDir = path.join(__dirname, '..', 'reviews');
const fetchPath = path.join(reviewsDir, 'fetch.json');

// const apiKey = 'YOUR_API_KEY_HERE';
// const productId = 'YOUR_PRODUCT_ID_HERE';
const apiKey = process.env.SERPAPI_KEY || 'YOUR_API_KEY_HERE';
const productId = process.env.PRODUCT_ID || 'YOUR_PRODUCT_ID_HERE';

const FORCE = process.argv.includes('--force');

function fileIsFromToday(filePath) {
  try {
    const st = fs.statSync(filePath);
    const fileDay = DateTime.fromJSDate(st.mtime).toISODate();
    const today = DateTime.local().toISODate();
    return fileDay === today;
  } catch {
    return false;
  }
}

async function fetchAllReviews({ apiKey, productId, perPage = 100, maxTotal = 300 }) {
  const base = 'https://serpapi.com/search.json';
  let nextPageToken = null;
  let collected = [];
  let calls = 0;

  while (collected.length < maxTotal) {
    const params = {
      engine: 'google_play_product',
      store: 'apps',
      product_id: productId,
      all_reviews: 'true',
      sort_by: '2', // Newest
      num: String(perPage),
      api_key: apiKey,
    };
    if (nextPageToken) params.next_page_token = nextPageToken;

    const { data } = await axios.get(base, { params });
    calls++;

    if (data.error) throw new Error(data.error);
    const chunk = (data.reviews || []).map(r => ({
      id: r.id,
      rating: r.rating,
      snippet: r.snippet,
      date: r.date,
      likes: r.likes,
      title: r.title,
      response: r.response
    }));
    collected = collected.concat(chunk);

    nextPageToken = data.search_metadata?.next_page_token;
    if (!nextPageToken) break;
    if (calls > 10) break; // safety
  }

  return collected.slice(0, maxTotal);
}

(async () => {
  if (!apiKey || apiKey.includes('YOUR_')) {
    console.error('Set SERPAPI_KEY in .env or hardcode in this file.');
    process.exit(1);
  }
  if (!productId || productId.includes('YOUR_')) {
    console.error('Set PRODUCT_ID in .env or hardcode in this file.');
    process.exit(1);
  }

  if (!FORCE && fileIsFromToday(fetchPath)) {
    console.log('fetch.json is from today — skipping scrape. Use --force to override.');
    process.exit(0);
  }

  if (!fs.existsSync(reviewsDir)) fs.mkdirSync(reviewsDir, { recursive: true });

  console.log(`Fetching reviews for ${productId}...`);
  const reviews = await fetchAllReviews({ apiKey, productId, perPage: 100, maxTotal: 300 });
  const payload = {
    product_id: productId,
    fetched_at: new Date().toISOString(),
    count: reviews.length,
    reviews
  };
  fs.writeFileSync(fetchPath, JSON.stringify(payload, null, 2));
  console.log(`Saved ${reviews.length} reviews to reviews/fetch.json`);
})().catch(err => {
  console.error('Scrape failed:', err.message);
  process.exit(1);
});