// Ansvar: Bar-charts, omsætning pr. dag, saldofordeling for Historik v2.

/**
 * Render bar-chart i et container-element.
 * @param {string} containerId
 * @param {Array<{rank, label, value, secondary?, pct, color}>} items
 */
export function renderBarChart(containerId, items) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const ranks = ['🥇', '🥈', '🥉'];
  el.innerHTML = `<div class="hv2-bar-chart">${items.map((item, i) => `
    <div class="hv2-bar-row">
      <div class="hv2-bar-rank">${i < 3 ? ranks[i] : item.rank}</div>
      <div class="hv2-bar-label">${item.label}</div>
      <div class="hv2-bar-track"><div class="hv2-bar-fill ${item.color}" style="width:${Math.max(item.pct, 2)}%"></div></div>
      <div class="hv2-bar-value">${item.value}${item.secondary ? ` <span style="color:var(--hv2-ink-muted);font-size:11px">· ${item.secondary}</span>` : ''}</div>
    </div>`).join('')}
  </div>`;
}

/**
 * Render daglig omsætning som simpelt bar-chart.
 * @param {string} containerId
 * @param {Array<{dato, omsaetning}>} data
 */
export function renderDailyRevenueChart(containerId, data) {
  const el = document.getElementById(containerId);
  if (!el || !data.length) { if (el) el.innerHTML = '<div style="color:var(--hv2-ink-muted);font-size:13px">Ingen data.</div>'; return; }

  const max = Math.max(...data.map(d => d.omsaetning));
  const min = Math.min(...data.map(d => d.omsaetning));
  const days = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør'];
  const minEntry = data.find(d => d.omsaetning === min);
  const maxEntry = data.find(d => d.omsaetning === max);

  // Begræns til de sidste 14 for læsbarhed
  const visible = data.slice(-14);

  el.innerHTML = `
    <div class="hv2-chart-bars">${visible.map(d => {
      const h = max > 0 ? (d.omsaetning / max) * 100 : 0;
      const dayName = days[new Date(d.dato).getDay()];
      return `<div class="hv2-chart-bar-wrap" title="${dayName} ${d.dato}: ${Math.round(d.omsaetning)} kr">
        <div class="hv2-chart-bar primary" style="height:${Math.max(h, 4)}%"></div>
      </div>`;
    }).join('')}</div>
    <div class="hv2-chart-labels">${visible.map(d => {
      const dayName = days[new Date(d.dato).getDay()];
      return `<span class="hv2-chart-label">${dayName}</span>`;
    }).join('')}</div>
    <div style="display:flex;justify-content:space-between;margin-top:4px;font-size:11px;color:var(--hv2-ink-muted)">
      <span>Lavest: ${Math.round(min)} kr${minEntry ? ` (${days[new Date(minEntry.dato).getDay()]})` : ''}</span>
      <span>Højest: ${Math.round(max)} kr${maxEntry ? ` (${days[new Date(maxEntry.dato).getDay()]})` : ''}</span>
    </div>`;
}

// ═══════════════════════════════════════════════════
// AXIS CHART (lodret søjle-graf med Y-akse + gridlines)
// ═══════════════════════════════════════════════════

/**
 * Beregn pæne Y-akse ticks (0, 50, 100, 150, 200 osv.)
 */
function niceAxisTicks(maxVal, numTicks = 4) {
  if (maxVal <= 0) return [0, 25, 50, 75, 100];
  const rawStep = maxVal / numTicks;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const residual = rawStep / magnitude;
  let niceStep;
  if (residual <= 1) niceStep = magnitude;
  else if (residual <= 2) niceStep = 2 * magnitude;
  else if (residual <= 5) niceStep = 5 * magnitude;
  else niceStep = 10 * magnitude;
  const ticks = [];
  for (let i = 0; i <= numTicks; i++) ticks.push(Math.round(niceStep * i));
  return ticks;
}

function fmtAxisVal(val) {
  if (val >= 10000) return `${(val / 1000).toFixed(0)}k`;
  if (val >= 1000) return `${(val / 1000).toFixed(1).replace('.0', '')}k`;
  return `${val}`;
}

/**
 * Render en rigtig søjlegraf med Y-akse, gridlines og X-akse-labels.
 * @param {string} containerId
 * @param {{data: Array<{label, value, subLabel?, highlight?}>, emptyText?: string}} opts
 */
export function renderAxisChart(containerId, opts) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const { data = [], emptyText = 'Ingen data endnu.' } = opts;

  if (!data.length || data.every(d => !d.value)) {
    el.innerHTML = `<div style="color:var(--hv2-ink-muted);font-size:13px;padding:32px 0;text-align:center">${emptyText}</div>`;
    return;
  }

  const max = Math.max(...data.map(d => d.value));
  const ticks = niceAxisTicks(max);
  const yMax = ticks[ticks.length - 1] || 1;

  // Vis kun hvert N'te label hvis mange datapunkter
  const showEveryNth = data.length > 20 ? Math.ceil(data.length / 12) : data.length > 12 ? 2 : 1;

  el.innerHTML = `
    <div class="hv2-ax">
      <div class="hv2-ax-y">
        ${ticks.slice().reverse().map(t => `<span>${fmtAxisVal(t)}</span>`).join('')}
      </div>
      <div class="hv2-ax-area">
        <div class="hv2-ax-grid">
          ${ticks.map(() => '<div class="hv2-ax-gridline"></div>').join('')}
        </div>
        <div class="hv2-ax-bars">
          ${data.map(d => {
            const h = yMax > 0 ? (d.value / yMax) * 100 : 0;
            return `<div class="hv2-ax-col${d.highlight ? ' hv2-ax-hl' : ''}" title="${d.label}${d.subLabel ? ' ' + d.subLabel : ''}: ${Math.round(d.value)} kr">
              <div class="hv2-ax-bar" style="height:${Math.max(h, d.value > 0 ? 3 : 0)}%"></div>
            </div>`;
          }).join('')}
        </div>
        <div class="hv2-ax-x">
          ${data.map((d, i) => `<span${i % showEveryNth !== 0 && i !== data.length - 1 ? ' class="hv2-ax-x-hide"' : ''}>${d.label}</span>`).join('')}
        </div>
      </div>
    </div>`;
}

/**
 * Render saldofordeling som horisontal bar-chart.
 * @param {string} containerId
 * @param {Array<{segment, antal}>} data
 */
export function renderBalanceChart(containerId, data) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const max = Math.max(...data.map(d => d.antal), 1);
  const colorMap = {
    'Negativ': 'var(--hv2-negative)',
    '0 kr': 'var(--hv2-negative)',
    '1–20 kr': 'orange',
    '21–50 kr': 'flango',
    '51–100 kr': 'blue',
    '100+ kr': 'green',
  };
  el.innerHTML = `<div class="hv2-bar-chart">${data.map(d => {
    const pct = (d.antal / max) * 100;
    const color = colorMap[d.segment] || 'flango';
    const isNeg = d.segment === 'Negativ';
    const isRaw = color.startsWith('var(');
    return `<div class="hv2-bar-row">
      <div class="hv2-bar-label" style="width:80px${isNeg ? ';color:var(--hv2-negative)' : ''}">${d.segment}</div>
      <div class="hv2-bar-track"><div class="hv2-bar-fill${isRaw ? '' : ' ' + color}" style="width:${Math.max(pct, 2)}%${isRaw ? ';background:' + color : ''}"></div></div>
      <div class="hv2-bar-value"${isNeg ? ' style="color:var(--hv2-negative)"' : ''}>${d.antal} børn</div>
    </div>`;
  }).join('')}</div>`;
}
