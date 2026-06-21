const form = document.getElementById('search-form');
const input = document.getElementById('keyword-input');
const btn = document.getElementById('search-btn');
const statusLine = document.getElementById('status-line');

const statsSection = document.getElementById('stats-section');
const statCount = document.getElementById('stat-count');
const statPrice = document.getElementById('stat-price');
const statFav = document.getElementById('stat-fav');
const statViews = document.getElementById('stat-views');

const tagPanel = document.getElementById('tag-panel');
const tagCloud = document.getElementById('tag-cloud');

const resultsList = document.getElementById('results-list');
const emptyState = document.getElementById('empty-state');

function formatCurrency(amount, currency) {
  if (amount === null || amount === undefined) return '—';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

function formatNumber(n) {
  if (n === null || n === undefined) return '—';
  return new Intl.NumberFormat('en-US').format(n);
}

function setLoading(isLoading) {
  btn.disabled = isLoading;
  btn.querySelector('.btn-label').textContent = isLoading ? 'Searching…' : 'Search listings';
}

function renderSkeleton() {
  resultsList.innerHTML = '';
  emptyState.classList.add('is-hidden');
  for (let i = 0; i < 6; i++) {
    const row = document.createElement('div');
    row.className = 'skeleton-row';
    row.innerHTML = `
      <div class="skeleton-block" style="width:64px;height:64px;"></div>
      <div>
        <div class="skeleton-block" style="width:70%;height:16px;margin-bottom:8px;"></div>
        <div class="skeleton-block" style="width:40%;height:12px;"></div>
      </div>
      <div class="skeleton-block" style="width:60px;height:18px;"></div>
    `;
    resultsList.appendChild(row);
  }
}

function renderStats(stats) {
  if (!stats || stats.count === 0) {
    statsSection.hidden = true;
    return;
  }
  statsSection.hidden = false;
  statCount.textContent = formatNumber(stats.count);
  statPrice.textContent = stats.avg_price !== null ? formatCurrency(stats.avg_price, 'USD') : '—';
  statFav.textContent = formatNumber(stats.avg_favorites);
  statViews.textContent = formatNumber(stats.avg_views);

  if (stats.top_tags && stats.top_tags.length) {
    tagPanel.hidden = false;
    tagCloud.innerHTML = stats.top_tags.map(t => `
      <span class="tag-chip">${escapeHtml(t.tag)} <span class="count">${t.count}</span></span>
    `).join('');
  } else {
    tagPanel.hidden = true;
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderResults(listings) {
  resultsList.innerHTML = '';

  if (!listings.length) {
    emptyState.classList.remove('is-hidden');
    emptyState.querySelector('p:last-child').textContent =
      'No listings matched that keyword. Try something broader.';
    return;
  }

  emptyState.classList.add('is-hidden');

  listings.forEach(item => {
    const row = document.createElement('a');
    row.className = 'result-row';
    row.href = item.url || '#';
    row.target = '_blank';
    row.rel = 'noopener noreferrer';

    const thumb = item.image_url
      ? `<img class="result-thumb" src="${escapeHtml(item.image_url)}" alt="" loading="lazy" />`
      : `<div class="result-thumb-placeholder">◌</div>`;

    const tags = (item.tags || []).slice(0, 3)
      .map(t => `<span class="result-tag">${escapeHtml(t)}</span>`).join('');

    row.innerHTML = `
      ${thumb}
      <div class="result-main">
        <p class="result-title">${escapeHtml(item.title || 'Untitled listing')}</p>
        <div class="result-tags">${tags}</div>
      </div>
      <div class="result-meta">
        <p class="result-price">${formatCurrency(item.price, item.currency)}</p>
        <p class="result-sub">♡ ${formatNumber(item.num_favorers)} · ${formatNumber(item.views)} views</p>
      </div>
    `;
    resultsList.appendChild(row);
  });
}

async function runSearch(keyword) {
  setLoading(true);
  statusLine.classList.remove('is-error');
  statusLine.textContent = `Searching Etsy for "${keyword}"…`;
  renderSkeleton();
  statsSection.hidden = true;
  tagPanel.hidden = true;

  try {
    const url = `${API_BASE_URL}/api/etsy/search?keyword=${encodeURIComponent(keyword)}&limit=24`;
    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `Request failed (${res.status})`);
    }

    statusLine.textContent = `${formatNumber(data.count)} total active listings match "${keyword}" on Etsy. Showing top ${data.returned}.`;
    renderStats(data.stats);
    renderResults(data.listings || []);
  } catch (err) {
    console.error(err);
    statusLine.classList.add('is-error');
    statusLine.textContent = `Couldn't load results: ${err.message}. Is the backend server running?`;
    resultsList.innerHTML = '';
    emptyState.classList.remove('is-hidden');
    emptyState.querySelector('p:last-child').textContent =
      'Something went wrong reaching the backend. Make sure the server is running and your Etsy API keys are set.';
  } finally {
    setLoading(false);
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const keyword = input.value.trim();
  if (!keyword) return;
  runSearch(keyword);
});
