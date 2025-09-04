let RAW = null;       // { summary, data }
let FILTERED = null;  // filtered view
let pieChart = null;
let barChart = null;

async function loadData() {
  const res = await fetch('/classified-reviews');
  if (!res.ok) {
    document.getElementById('meta').textContent = 'No data yet. Run script.py first.';
    return null;
  }
  const json = await res.json();
  return json;
}

function parseDateSafe(s) {
  // SerpAPI dates are typically parseable; fallback to NaN if not.
  const t = Date.parse(s);
  return isNaN(t) ? null : new Date(t);
}

function applyFilters() {
  if (!RAW) return;

  // Read controls
  const fromVal = document.getElementById('fromDate').value;
  const toVal = document.getElementById('toDate').value;
  const fromDate = fromVal ? new Date(fromVal + 'T00:00:00') : null;
  const toDate = toVal ? new Date(toVal + 'T23:59:59') : null;

  const catSelect = document.getElementById('categorySelect');
  const selectedCats = Array.from(catSelect.selectedOptions).map(o => o.value);
  const catFilterActive = selectedCats.length > 0;

  // Filter
  const filtered = RAW.data.filter(r => {
    // date filter
    if (fromDate || toDate) {
      const d = parseDateSafe(r.date);
      if (!d) return false;
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
    }
    // category filter
    if (catFilterActive && !selectedCats.includes(r.category)) return false;
    return true;
  });

  FILTERED = {
    summary: summarize(filtered, RAW.summary.product_id, RAW.summary.fetched_at),
    data: filtered
  };

  renderAll(FILTERED);
}

function resetFilters() {
  document.getElementById('fromDate').value = '';
  document.getElementById('toDate').value = '';
  const sel = document.getElementById('categorySelect');
  for (const o of sel.options) o.selected = false;

  FILTERED = { summary: RAW.summary, data: RAW.data };
  renderAll(FILTERED);
}

function summarize(records, productId, fetchedAt) {
  const byCat = { Crashes:0, Bugs:0, Complaints:0, Praises:0, Other:0 };
  const bySent = { positive:0, neutral:0, negative:0 };

  for (const r of records) {
    if (byCat[r.category] != null) byCat[r.category]++; else byCat.Other++;
    if (bySent[r.sentiment] != null) bySent[r.sentiment]++; else bySent.neutral++;
  }

  return {
    by_category: byCat,
    by_sentiment: bySent,
    total: records.length,
    product_id: productId,
    fetched_at: fetchedAt
  };
}

function renderSummary(summary) {
  document.getElementById('meta').textContent =
    `App: ${summary.product_id}\nFetched: ${summary.fetched_at}\nTotal classified: ${summary.total}`;

  const counts = document.getElementById('counts');
  counts.innerHTML = '';
  function stat(label, n) {
    const div = document.createElement('div');
    div.className = 'stat';
    div.innerHTML = `<h4>${label}</h4><div class="num">${n || 0}</div>`;
    return div;
  }
  counts.appendChild(stat('Crashes', summary.by_category.Crashes));
  counts.appendChild(stat('Bugs', summary.by_category.Bugs));
  counts.appendChild(stat('Complaints', summary.by_category.Complaints));
  counts.appendChild(stat('Praises', summary.by_category.Praises));
  counts.appendChild(stat('Other', summary.by_category.Other));
  counts.appendChild(stat('Positive', summary.by_sentiment.positive));
  counts.appendChild(stat('Neutral', summary.by_sentiment.neutral));
  counts.appendChild(stat('Negative', summary.by_sentiment.negative));
}

function renderTable(rows) {
  const tbody = document.getElementById('rows');
  tbody.innerHTML = '';
  for (const r of rows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.rating ?? ''}</td>
      <td>${r.category}</td>
      <td>${r.sentiment}</td>
      <td>${(r.text || '').replace(/</g,'&lt;')}</td>
      <td>${r.date ?? ''}</td>
    `;
    tbody.appendChild(tr);
  }
}

function renderCharts(summary) {
  // Category Pie
  const catLabels = ['Crashes', 'Bugs', 'Complaints', 'Praises', 'Other'];
  const catData = catLabels.map(k => summary.by_category[k] || 0);

  if (pieChart) pieChart.destroy();
  pieChart = new Chart(document.getElementById('categoryPie'), {
    type: 'pie',
    data: {
      labels: catLabels,
      datasets: [{ data: catData }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } }
    }
  });

  // Sentiment Bar
  const sLabels = ['positive', 'neutral', 'negative'];
  const sData = sLabels.map(k => summary.by_sentiment[k] || 0);

  if (barChart) barChart.destroy();
  barChart = new Chart(document.getElementById('sentimentBar'), {
    type: 'bar',
    data: {
      labels: sLabels,
      datasets: [{ label: 'Count', data: sData }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision:0 } } }
    }
  });
}

function renderAll(view) {
  renderSummary(view.summary);
  renderTable(view.data);
  renderCharts(view.summary);
}

async function init() {
  RAW = await loadData();
  if (!RAW) return;
  FILTERED = { summary: RAW.summary, data: RAW.data };
  renderAll(FILTERED);

  document.getElementById('applyBtn').addEventListener('click', applyFilters);
  document.getElementById('resetBtn').addEventListener('click', resetFilters);
}

init();
