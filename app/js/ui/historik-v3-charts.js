// Ansvar: SVG-baserede chart primitiver for Historik v3.
// Ingen afhængigheder udover DOM. Genererer inline SVG som HTML-strenge.

const BAR_COLORS = ['#e67e22', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#06b6d4', '#84cc16'];

// ─── HELPERS ───

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtNum(n) {
  return Number(n).toLocaleString('da-DK');
}

// ─── AREA CHART (SVG) ───
/**
 * Renders an area/line chart as SVG.
 * @param {Array<{label:string, value:number}>} data
 * @param {object} opts - { width, height, color, showDots, showGrid, refLine, areaOpacity }
 * @returns {string} HTML string with SVG + tooltip container
 */
export function renderAreaChart(data, opts = {}) {
  const {
    width = 460, height = 200, color = '#e67e22',
    showDots = true, showGrid = true, refLine = null,
    areaOpacity = 0.25, id = 'hv3ac' + Math.random().toString(36).slice(2, 7),
  } = opts;

  if (!data || !data.length) return '<div class="hv3-loading">Ingen data</div>';

  const pad = { top: 20, right: 15, bottom: 28, left: 45 };
  const cw = width - pad.left - pad.right;
  const ch = height - pad.top - pad.bottom;

  const maxVal = Math.max(...data.map(d => d.value), 1);
  const yMax = Math.ceil(maxVal / 50) * 50 || 100;
  const xStep = data.length > 1 ? cw / (data.length - 1) : cw;

  // Y-axis ticks
  const yTicks = [];
  const yTickCount = 4;
  for (let i = 0; i <= yTickCount; i++) {
    yTicks.push(Math.round((yMax / yTickCount) * i));
  }

  // Build path
  const points = data.map((d, i) => ({
    x: pad.left + i * xStep,
    y: pad.top + ch - (d.value / yMax) * ch,
    ...d,
  }));

  // Smooth curve (Catmull-Rom → cubic bezier approximation)
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const p0 = points[Math.max(i - 2, 0)];
    const p1 = points[i - 1];
    const p2 = points[i];
    const p3 = points[Math.min(i + 1, points.length - 1)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    pathD += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }

  // Area fill path (close to bottom)
  const areaD = pathD + ` L ${points[points.length - 1].x},${pad.top + ch} L ${points[0].x},${pad.top + ch} Z`;

  // Grid lines
  let gridLines = '';
  if (showGrid) {
    yTicks.forEach(tick => {
      const y = pad.top + ch - (tick / yMax) * ch;
      gridLines += `<line x1="${pad.left}" y1="${y}" x2="${pad.left + cw}" y2="${y}" stroke="#f0ebe4" stroke-dasharray="3 3"/>`;
    });
  }

  // Y-axis labels
  let yLabels = '';
  yTicks.forEach(tick => {
    const y = pad.top + ch - (tick / yMax) * ch;
    yLabels += `<text x="${pad.left - 8}" y="${y + 3}" text-anchor="end" fill="#b8a998" font-size="10">${tick}</text>`;
  });

  // X-axis labels (skip some if too many)
  let xLabels = '';
  const interval = data.length > 20 ? 4 : data.length > 10 ? 2 : 1;
  data.forEach((d, i) => {
    if (i % interval !== 0 && i !== data.length - 1) return;
    const x = pad.left + i * xStep;
    xLabels += `<text x="${x}" y="${pad.top + ch + 18}" text-anchor="middle" fill="#b8a998" font-size="10">${escHtml(d.label)}</text>`;
  });

  // Reference line
  let refLineHtml = '';
  if (refLine != null) {
    const ry = pad.top + ch - (refLine / yMax) * ch;
    refLineHtml = `<line x1="${pad.left}" y1="${ry}" x2="${pad.left + cw}" y2="${ry}" stroke="${color}" stroke-dasharray="6 4" stroke-opacity="0.35"/>`;
    refLineHtml += `<text x="${pad.left + cw - 4}" y="${ry - 6}" text-anchor="end" fill="${color}" font-size="10" font-weight="600">Gns: ${fmtNum(refLine)} kr</text>`;
  }

  // Dots (with staggered animation delay based on position)
  let dotsHtml = '';
  if (showDots) {
    points.forEach((p, i) => {
      const dotDelay = 0.6 + (i / Math.max(points.length - 1, 1)) * 0.5; // start after area reveal (0.6s–1.1s)
      dotsHtml += `<circle cx="${p.x}" cy="${p.y}" r="3" fill="${color}" stroke="#fff" stroke-width="2"
        data-idx="${i}" class="hv3-chart-dot" style="animation-delay:${dotDelay.toFixed(2)}s"/>`;
    });
  }

  // Invisible hover rects for each data point
  let hoverRects = '';
  const rectW = data.length > 1 ? xStep : cw;
  points.forEach((p, i) => {
    const rx = p.x - rectW / 2;
    hoverRects += `<rect x="${rx}" y="${pad.top}" width="${rectW}" height="${ch}" fill="transparent"
      data-idx="${i}" class="hv3-chart-hover"/>`;
  });

  return `
<div class="hv3-chart-container" id="${id}" data-chart-data='${JSON.stringify(data.map(d => ({ l: d.label, v: d.value, w: d.isWeekend })))}'>
  <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
    <defs>
      <linearGradient id="${id}-grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity="${areaOpacity}"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0.02"/>
      </linearGradient>
    </defs>
    ${gridLines}
    ${yLabels}
    ${xLabels}
    ${refLineHtml}
    <g class="hv3-area-paths">
      <path d="${areaD}" fill="url(#${id}-grad)"/>
      <path d="${pathD}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>
    </g>
    ${dotsHtml}
    ${hoverRects}
  </svg>
  <div class="hv3-chart-tooltip" id="${id}-tip"></div>
</div>`;
}

// ─── BAR CHART (SVG) ───
/**
 * Renders a vertical bar chart as SVG.
 * @param {Array<{label:string, value:number}>} data
 * @param {object} opts
 * @returns {string} HTML string
 */
export function renderBarChart(data, opts = {}) {
  const {
    width = 460, height = 220, color = '#e67e22',
    refLine = null, highlightMax = false, highlightColor = '#22c55e',
    maxBarWidth = 36, showGrid = true,
    colorFn = null, // (item, index) => color
    id = 'hv3bc' + Math.random().toString(36).slice(2, 7),
    yTickSuffix = '',
    partialLast = false,
    barRadius = 6,
    xLabelFontSize = null, // override x-axis label font-size
    xLabelAngle = 0, // rotate x-axis labels (degrees, negative = counter-clockwise)
  } = opts;

  if (!data || !data.length) return '<div class="hv3-loading">Ingen data</div>';

  const pad = { top: 20, right: 15, bottom: xLabelAngle ? 40 : 28, left: 45 };
  const cw = width - pad.left - pad.right;
  const ch = height - pad.top - pad.bottom;

  const maxVal = Math.max(...data.map(d => d.value), 1);
  const yMax = Math.ceil(maxVal * 1.1 / 50) * 50 || 100;

  const barGap = Math.max(4, cw / data.length * 0.2);
  const barW = Math.min(maxBarWidth, (cw - barGap * (data.length + 1)) / data.length);
  const totalBarsW = data.length * barW + (data.length + 1) * barGap;
  const xOffset = pad.left + (cw - totalBarsW) / 2 + barGap;

  const maxItem = highlightMax ? data.reduce((best, d) => d.value > best.value ? d : best, data[0]) : null;

  // Y ticks
  const yTicks = [];
  const yTickCount = 4;
  for (let i = 0; i <= yTickCount; i++) yTicks.push(Math.round((yMax / yTickCount) * i));

  let gridLines = '';
  let yLabels = '';
  if (showGrid) {
    yTicks.forEach(tick => {
      const y = pad.top + ch - (tick / yMax) * ch;
      gridLines += `<line x1="${pad.left}" y1="${y}" x2="${pad.left + cw}" y2="${y}" stroke="#f0ebe4" stroke-dasharray="3 3"/>`;
      yLabels += `<text x="${pad.left - 8}" y="${y + 3}" text-anchor="end" fill="#b8a998" font-size="10">${yTickSuffix ? fmtNum(tick) + yTickSuffix : fmtNum(tick)}</text>`;
    });
  }

  // Reference line
  let refLineHtml = '';
  if (refLine != null) {
    const ry = pad.top + ch - (refLine / yMax) * ch;
    refLineHtml = `<line x1="${pad.left}" y1="${ry}" x2="${pad.left + cw}" y2="${ry}" stroke="${color}" stroke-dasharray="5 4" stroke-opacity="0.4"/>`;
  }

  // Bars
  let barsHtml = '';
  let xLabelsHtml = '';
  data.forEach((d, i) => {
    const barH = (d.value / yMax) * ch;
    const x = xOffset + i * (barW + barGap);
    const y = pad.top + ch - barH;
    const r = Math.min(barRadius, barW / 2);

    let fill = color;
    if (colorFn) fill = colorFn(d, i);
    else if (highlightMax && d === maxItem) fill = highlightColor;
    else if (d.isWeekend) fill = '#e8e0d6';

    const opacity = d.value > 0 ? (partialLast && i === data.length - 1 ? 0.6 : 1) : 0.4;

    // Rounded top corners only: draw full rounded rect then clip bottom
    const clipId = `${id}-clip-${i}`;
    barsHtml += `<defs><clipPath id="${clipId}"><rect x="${x}" y="${y}" width="${barW}" height="${barH + r}"/></clipPath></defs>`;
    barsHtml += `<rect x="${x}" y="${y}" width="${barW}" height="${barH + r}" rx="${r}" ry="${r}" fill="${fill}" opacity="${opacity}"
      clip-path="url(#${clipId})" data-idx="${i}" class="hv3-chart-bar"/>`;

    // X label
    const xlFs = xLabelFontSize || (data.length > 10 ? 10 : data.length <= 5 ? 12 : 11);
    const xlX = x + barW / 2;
    const xlY = pad.top + ch + 18;
    const xlTransform = xLabelAngle ? ` transform="rotate(${xLabelAngle}, ${xlX}, ${xlY})"` : '';
    const xlAnchor = xLabelAngle ? 'end' : 'middle';
    xLabelsHtml += `<text x="${xlX}" y="${xlY}" text-anchor="${xlAnchor}" fill="#917f6c" font-size="${xlFs}" font-weight="600"${xlTransform}>${escHtml(d.label)}</text>`;
  });

  // Hover rects
  let hoverRects = '';
  data.forEach((d, i) => {
    const x = xOffset + i * (barW + barGap);
    hoverRects += `<rect x="${x}" y="${pad.top}" width="${barW}" height="${ch}" fill="transparent" data-idx="${i}" class="hv3-chart-hover"/>`;
  });

  return `
<div class="hv3-chart-container" id="${id}" data-chart-data='${JSON.stringify(data.map(d => ({ l: d.label, v: d.value, s: d.subLabel, w: d.isWeekend, p: d.partial })))}'>
  <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
    ${gridLines}
    ${yLabels}
    ${refLineHtml}
    ${barsHtml}
    ${xLabelsHtml}
    ${hoverRects}
  </svg>
  <div class="hv3-chart-tooltip" id="${id}-tip"></div>
</div>`;
}

// ─── HORIZONTAL BAR (for saldo distribution etc.) ───
/**
 * Renders a horizontal bar list (not SVG, CSS-based).
 * @param {Array<{label:string, value:number, color:string}>} data
 * @returns {string} HTML string
 */
export function renderHorizontalBars(data) {
  if (!data || !data.length) return '';
  const max = Math.max(...data.map(d => d.value), 1);
  return `<div style="display:flex;flex-direction:column;gap:12px;margin-top:8px">${data.map(d => {
    const isNeg = d.color === '#dc2626' || d.color === '#ef4444';
    return `
    <div class="hv3-saldo-row">
      <span class="hv3-saldo-label" style="color:${isNeg ? d.color : 'var(--hv3-text-muted)'}">${escHtml(d.label)}</span>
      <div class="hv3-saldo-bar">
        <div class="hv3-saldo-bar-fill" style="width:${(d.value / max) * 100}%;background:${d.color}"></div>
      </div>
      <span class="hv3-saldo-count">${d.value} børn</span>
    </div>`;
  }).join('')}</div>`;
}

// ─── DONUT CHART (SVG) ───
/**
 * Renders a donut/pie chart as SVG.
 * @param {Array<{label:string, value:number}>} data
 * @param {object} opts
 * @returns {string} HTML
 */
export function renderDonutChart(data, opts = {}) {
  const {
    size = 200, innerRadius = 55, outerRadius = 90,
    id = 'hv3dn' + Math.random().toString(36).slice(2, 7),
  } = opts;

  if (!data || !data.length) return '';

  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return '<div class="hv3-loading">Ingen data</div>';

  const cx = size / 2;
  const cy = size / 2;
  let startAngle = -Math.PI / 2;

  let paths = '';
  data.forEach((d, i) => {
    const sliceAngle = (d.value / total) * 2 * Math.PI;
    const gap = 0.03; // small gap between slices
    const sa = startAngle + gap / 2;
    const ea = startAngle + sliceAngle - gap / 2;

    const x1o = cx + outerRadius * Math.cos(sa);
    const y1o = cy + outerRadius * Math.sin(sa);
    const x2o = cx + outerRadius * Math.cos(ea);
    const y2o = cy + outerRadius * Math.sin(ea);
    const x1i = cx + innerRadius * Math.cos(ea);
    const y1i = cy + innerRadius * Math.sin(ea);
    const x2i = cx + innerRadius * Math.cos(sa);
    const y2i = cy + innerRadius * Math.sin(sa);

    const largeArc = sliceAngle > Math.PI ? 1 : 0;
    const color = BAR_COLORS[i % BAR_COLORS.length];

    const sliceDelay = i * 0.08;
    paths += `<path d="M ${x1o} ${y1o} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2o} ${y2o} L ${x1i} ${y1i} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x2i} ${y2i} Z" fill="${color}" data-idx="${i}" class="hv3-chart-slice hv3-donut-slice" style="transform-origin:${cx}px ${cy}px;animation-delay:${sliceDelay.toFixed(2)}s"/>`;
    startAngle += sliceAngle;
  });

  // Legend (with delayed fade-in after slices)
  const legendDelay = (data.length * 0.08 + 0.3).toFixed(2);
  let legend = `<div class="hv3-legend hv3-legend-animated" style="animation-delay:${legendDelay}s">`;
  data.slice(0, 5).forEach((d, i) => {
    const name = d.label.length > 18 ? d.label.slice(0, 18) + '…' : d.label;
    legend += `<div class="hv3-legend-item"><div class="hv3-legend-dot" style="background:${BAR_COLORS[i % BAR_COLORS.length]}"></div>${escHtml(name)}</div>`;
  });
  legend += '</div>';

  return `
<div class="hv3-chart-container" id="${id}" style="text-align:center">
  <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="margin:0 auto;display:block">
    ${paths}
  </svg>
  ${legend}
</div>`;
}

// ─── GAUGE CHART (SVG circle) ───
/**
 * Renders a gauge (ring progress) for margin display.
 */
export function renderGauge(pct, opts = {}) {
  const { size = 160, stroke = 12 } = opts;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const color = pct > 50 ? '#16a34a' : pct > 25 ? '#f59e0b' : '#dc2626';

  return `
<div class="hv3-gauge" style="width:${size}px;height:${size}px;margin-bottom:12px">
  <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#f3ede5" stroke-width="${stroke}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}"
      stroke-width="${stroke}" stroke-linecap="round"
      stroke-dasharray="${dash} ${circ}" transform="rotate(-90 ${size / 2} ${size / 2})"
      style="transition:stroke-dasharray 0.8s ease"/>
  </svg>
  <div class="hv3-gauge-center">
    <div class="hv3-gauge-pct">${pct}%</div>
    <div class="hv3-gauge-label">AVANCE</div>
  </div>
</div>`;
}

// ─── ATTACH CHART TOOLTIPS ───
/**
 * Call after inserting chart HTML into DOM.
 * Attaches mouseover/out events for tooltip display.
 * @param {string} containerId - The chart container ID
 * @param {object} opts - { valueSuffix: ' kr', showWeekend: true }
 */
export function attachChartTooltips(containerId, opts = {}) {
  const { valueSuffix = ' kr', showWeekend = false, customFormat = null } = opts;
  const container = document.getElementById(containerId);
  if (!container) return;
  const tip = document.getElementById(containerId + '-tip');
  if (!tip) return;

  let chartData;
  try {
    chartData = JSON.parse(container.dataset.chartData || '[]');
  } catch { return; }

  const hovers = container.querySelectorAll('.hv3-chart-hover, .hv3-chart-bar, .hv3-chart-slice');
  hovers.forEach(el => {
    el.addEventListener('mouseenter', (e) => {
      const idx = parseInt(el.dataset.idx);
      const d = chartData[idx];
      if (!d) return;

      if (customFormat) {
        tip.innerHTML = customFormat(d, idx);
      } else {
        let html = `<div class="hv3-chart-tooltip-label">${escHtml(d.l || d.s || '')}</div>`;
        html += `<div class="hv3-chart-tooltip-value">${fmtNum(d.v)}${valueSuffix}</div>`;
        if (showWeekend && d.w) html += `<div class="hv3-chart-tooltip-sub">Lukket</div>`;
        if (d.p) html += `<div class="hv3-chart-tooltip-sub">⚡ Igangværende</div>`;
        tip.innerHTML = html;
      }

      const rect = container.getBoundingClientRect();
      const eRect = el.getBoundingClientRect();
      let left = eRect.left - rect.left + eRect.width / 2;
      let top = eRect.top - rect.top - 10;

      // Ensure tooltip stays in bounds
      tip.style.left = left + 'px';
      tip.style.top = top + 'px';
      tip.style.transform = 'translate(-50%, -100%)';
      tip.classList.add('visible');
    });

    el.addEventListener('mouseleave', () => {
      tip.classList.remove('visible');
    });
  });
}

// ─── PROGRESS BAR (inline HTML) ───
export function progressBar(value, max, color = '#e67e22') {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return `<div class="hv3-progress"><div class="hv3-progress-fill" style="width:${pct}%;background:${color}"></div></div>`;
}

// ─── RANKING LIST ───
export function renderRankingList(data, opts = {}) {
  const { valueKey = 'value', valueLabel = '', subKey = 'sub', subLabel = '', nameKey = 'name', emojiKey = null } = opts;
  if (!data || !data.length) return '<div class="hv3-loading">Ingen data</div>';

  const maxVal = Math.max(...data.map(d => d[valueKey] || 0), 1);
  const medals = ['🥇', '🥈', '🥉'];

  return `<div class="hv3-ranking">${data.map((item, i) => {
    const color = BAR_COLORS[i % BAR_COLORS.length];
    const medal = i < 3 ? medals[i] : `<span class="hv3-ranking-number">${i + 1}</span>`;
    const emoji = emojiKey && item[emojiKey] ? `<span style="font-size:18px">${item[emojiKey]}</span>` : '';

    return `
    <div class="hv3-ranking-item">
      <span class="hv3-ranking-medal">${medal}</span>
      ${emoji}
      <span class="hv3-ranking-name">${escHtml(item[nameKey])}</span>
      <div class="hv3-ranking-bar">
        <div class="hv3-ranking-bar-fill" style="width:${((item[valueKey] || 0) / maxVal) * 100}%;background:linear-gradient(90deg, ${color}, ${color}dd)"></div>
      </div>
      <div class="hv3-ranking-value">
        <span class="hv3-ranking-value-main">${fmtNum(item[valueKey] || 0)} ${escHtml(valueLabel)}</span>
        ${subKey && item[subKey] != null ? `<span class="hv3-ranking-value-sub">· ${fmtNum(item[subKey])} ${escHtml(subLabel)}</span>` : ''}
      </div>
    </div>`;
  }).join('')}</div>`;
}

// ─── CHART ENTRANCE ANIMATIONS ───
/**
 * Call after inserting chart HTML into the DOM.
 * Animates bar charts (grow from bottom), triggers CSS-transition bars
 * (progress, saldo, ranking), and gauge rings.
 * Area charts and donut charts animate via CSS keyframes automatically.
 * @param {HTMLElement|string} container - DOM element or ID to search within
 */
export function animateChartEntrance(container) {
  if (typeof container === 'string') container = document.getElementById(container);
  if (!container) return;

  // 1. AREA CHARTS — reveal from left to right via SVG clipPath
  _animateAreas(container);

  // 2. BAR CHARTS — grow bars from baseline to target height
  _animateBars(container);

  // 3. CSS-TRANSITION BARS — trigger by starting at width 0
  _animateTransitionBars(container);

  // 4. GAUGE — restart stroke-dasharray from 0
  _animateGauges(container);
}

function _animateAreas(container) {
  const groups = container.querySelectorAll('.hv3-area-paths');
  groups.forEach(group => {
    const svg = group.closest('svg');
    if (!svg) return;

    const vb = svg.getAttribute('viewBox');
    if (!vb) return;
    const [, , svgW, svgH] = vb.split(' ').map(Number);

    // Create SVG clipPath with rect that starts at width=0
    const clipId = 'hv3-aclip-' + Math.random().toString(36).slice(2, 7);
    const ns = 'http://www.w3.org/2000/svg';

    let defs = svg.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS(ns, 'defs');
      svg.insertBefore(defs, svg.firstChild);
    }

    const clipPath = document.createElementNS(ns, 'clipPath');
    clipPath.setAttribute('id', clipId);
    const clipRect = document.createElementNS(ns, 'rect');
    clipRect.setAttribute('x', '0');
    clipRect.setAttribute('y', '0');
    clipRect.setAttribute('width', '0');
    clipRect.setAttribute('height', String(svgH));
    clipPath.appendChild(clipRect);
    defs.appendChild(clipPath);

    group.setAttribute('clip-path', `url(#${clipId})`);

    // Animate clipRect width from 0 to svgW
    const duration = 900;
    const start = performance.now();
    const tick = (now) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      // Ease-in-out cubic
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      clipRect.setAttribute('width', String(eased * svgW));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

function _animateBars(container) {
  const bars = container.querySelectorAll('.hv3-chart-bar');
  if (!bars.length) return;

  // Group bars by their parent SVG (multiple bar charts may exist)
  const svgGroups = new Map();
  bars.forEach(bar => {
    const svg = bar.closest('svg');
    if (!svgGroups.has(svg)) svgGroups.set(svg, []);
    svgGroups.get(svg).push(bar);
  });

  svgGroups.forEach((barList) => {
    barList.forEach((bar, i) => {
      const targetY = parseFloat(bar.getAttribute('y'));
      const targetH = parseFloat(bar.getAttribute('height'));
      if (!targetH || targetH <= 0) return;

      // Find matching clipPath rect
      const clipRef = bar.getAttribute('clip-path');
      let clipRect = null;
      if (clipRef) {
        const clipId = clipRef.match(/url\(#(.+)\)/)?.[1];
        if (clipId) clipRect = container.querySelector(`#${clipId} rect`);
      }

      const baselineY = targetY + targetH;
      const clipTargetY = clipRect ? parseFloat(clipRect.getAttribute('y')) : 0;
      const clipTargetH = clipRect ? parseFloat(clipRect.getAttribute('height')) : 0;
      const clipBaseY = clipRect ? clipTargetY + clipTargetH : 0;

      // Set initial state (flat at baseline)
      bar.setAttribute('y', baselineY);
      bar.setAttribute('height', 0);
      if (clipRect) {
        clipRect.setAttribute('y', clipBaseY);
        clipRect.setAttribute('height', 0);
      }

      const delay = i * 50; // stagger 50ms per bar
      const duration = 700;

      setTimeout(() => {
        const start = performance.now();
        const tick = (now) => {
          const elapsed = now - start;
          const t = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - t, 3); // cubic ease-out

          const h = eased * targetH;
          const y = baselineY - h;
          bar.setAttribute('y', y);
          bar.setAttribute('height', h);

          if (clipRect) {
            const ch = eased * clipTargetH;
            const cy = clipBaseY - ch;
            clipRect.setAttribute('y', cy);
            clipRect.setAttribute('height', ch);
          }

          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }, delay);
    });
  });
}

function _animateTransitionBars(container) {
  // Progress bars, saldo bars, ranking bars — they have CSS transitions
  // but render at target width instantly. Set to 0, then restore after a frame.
  const selectors = [
    '.hv3-progress-fill',
    '.hv3-saldo-bar-fill',
    '.hv3-ranking-bar-fill',
  ];

  selectors.forEach(sel => {
    const elements = container.querySelectorAll(sel);
    elements.forEach(el => {
      const targetWidth = el.style.width;
      if (!targetWidth) return;

      // Temporarily disable transition, set width to 0
      el.style.transition = 'none';
      el.style.width = '0%';

      // Force reflow, then re-enable transition and set target width
      requestAnimationFrame(() => {
        el.style.transition = '';
        el.style.width = targetWidth;
      });
    });
  });
}

function _animateGauges(container) {
  const gauges = container.querySelectorAll('.hv3-gauge');
  gauges.forEach(gauge => {
    const circles = gauge.querySelectorAll('circle');
    const circle = circles[1]; // second circle is the colored fill ring
    if (!circle) return;

    const targetDash = circle.getAttribute('stroke-dasharray');
    if (!targetDash) return;

    // Disable transition, set to 0
    circle.style.transition = 'none';
    circle.setAttribute('stroke-dasharray', '0 9999');

    // Force reflow, then re-enable transition and set target
    circle.getBoundingClientRect();
    requestAnimationFrame(() => {
      circle.style.transition = 'stroke-dasharray 0.8s ease';
      circle.setAttribute('stroke-dasharray', targetDash);
    });
  });
}

export { BAR_COLORS, escHtml, fmtNum };
