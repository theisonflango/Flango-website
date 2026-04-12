// Ansvar: CSV/TXT generering og download for Historik v2 rapporter.
import {
  fmtDate, fmtKr, fmtMinutes, fmtDayDate, getLevel,
  getClubStats, getTotalDeposits, getTotalBalances, getTopProducts,
  getTransactions, getAllBalances, getNegativeBalances,
  getDailySummary, getEmployeeSummary,
} from '../domain/historik-data.js?v=3.0.67';
import { showCustomAlert } from './sound-and-alerts.js?v=3.0.67';

/** Download en fil via Blob + createObjectURL. */
function downloadFile(filename, content, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** CSV-escape: omslut med anførselstegn hvis indholdet indeholder komma, newline eller anførselstegn. */
function csvEscape(val) {
  if (val == null) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// ═══════════════════════════════════════════════════
// SALGSRAPPORT (.txt)
// ═══════════════════════════════════════════════════

export async function exportSalesReport(from, to, includeTestUsers = false) {
  try {
    const [club, deposits, balances, topProds, transactions] = await Promise.all([
      getClubStats(from, to, includeTestUsers),
      getTotalDeposits(from, to, includeTestUsers),
      getTotalBalances(includeTestUsers),
      getTopProducts(from, to, 10, includeTestUsers),
      getTransactions(from, to, includeTestUsers),
    ]);

    const lines = [
      '═══════════════════════════════════════',
      '       FLANGO SALGSRAPPORT',
      '═══════════════════════════════════════',
      '',
      `Periode: ${fmtDate(from)} til ${fmtDate(to)}`,
      `Genereret: ${new Date().toLocaleString('da-DK')}`,
      '',
      '── OPSUMMERING ──',
      `Total omsætning:    ${fmtKr(club.totalRevenue)}`,
      `Antal transaktioner: ${club.saleCount}`,
      `Cafédage:           ${club.cafeDays}`,
      `Gns. pr. dag:       ${fmtKr(club.cafeDays ? Math.round(club.totalRevenue / club.cafeDays) : 0)}`,
      `Total indbetalinger: ${fmtKr(deposits.amount)} (${deposits.count} stk)`,
      `Saldoer i alt:      ${fmtKr(balances.total)} (${balances.count} konti)`,
      '',
      '── TOP PRODUKTER ──',
      ...topProds.map((p, i) => `  ${i + 1}. ${p.emoji || ''} ${p.name}: ${p.antal} stk (${fmtKr(p.beloeb)})`),
      '',
      '── TRANSAKTIONER ──',
      `${'Tid'.padEnd(18)} ${'Type'.padEnd(15)} ${'Kunde'.padEnd(25)} ${'Beløb'.padEnd(12)}`,
      '─'.repeat(70),
      ...transactions.slice(0, 200).map(e => {
        const dt = new Date(e.created_at);
        const tid = `${String(dt.getDate()).padStart(2, '0')}.${String(dt.getMonth() + 1).padStart(2, '0')} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
        const type = e.event_type || '';
        const kunde = e.target?.name || '—';
        const amount = e.details?.total_amount || e.details?.amount || 0;
        return `${tid.padEnd(18)} ${type.padEnd(15)} ${kunde.padEnd(25)} ${fmtKr(amount)}`;
      }),
      '',
      '═══════════════════════════════════════',
      `  Genereret af Flango · ${new Date().toLocaleDateString('da-DK')}`,
    ];

    downloadFile(`flango-salgsrapport-${fmtDate(from)}-${fmtDate(to)}.txt`, lines.join('\n'));
  } catch (err) {
    console.error('exportSalesReport', err);
    showCustomAlert('Fejl', 'Fejl ved generering af salgsrapport.');
  }
}

// ═══════════════════════════════════════════════════
// KOMPLET SALDOLISTE (.csv)
// ═══════════════════════════════════════════════════

export async function exportAllBalances(includeTestUsers = false) {
  try {
    const data = await getAllBalances(includeTestUsers);
    const header = 'Navn,Nummer,Saldo';
    const rows = data.map(u => `${csvEscape(u.name)},${csvEscape(u.number)},${u.balance}`);
    downloadFile(`flango-saldoliste-${fmtDate(new Date())}.csv`, [header, ...rows].join('\n'), 'text/csv');
  } catch (err) {
    console.error('exportAllBalances', err);
    showCustomAlert('Fejl', 'Fejl ved eksport af saldoliste.');
  }
}

// ═══════════════════════════════════════════════════
// NEGATIV SALDO (.csv)
// ═══════════════════════════════════════════════════

export async function exportNegativeBalances(includeTestUsers = false) {
  try {
    const data = await getNegativeBalances(includeTestUsers);
    const header = 'Navn,Nummer,Saldo';
    const rows = data.map(u => `${csvEscape(u.name)},${csvEscape(u.number)},${u.balance}`);
    downloadFile(`flango-negativ-saldo-${fmtDate(new Date())}.csv`, [header, ...rows].join('\n'), 'text/csv');
  } catch (err) {
    console.error('exportNegativeBalances', err);
    showCustomAlert('Fejl', 'Fejl ved eksport af negativ saldo.');
  }
}

// ═══════════════════════════════════════════════════
// TRANSAKTIONS-CSV
// ═══════════════════════════════════════════════════

export async function exportTransactionsCsv(from, to, includeTestUsers = false) {
  try {
    const data = await getTransactions(from, to, includeTestUsers);
    const header = 'Tid,Type,Kunde,Beløb,Ekspedient,Voksen ansvarlig';
    const rows = data.map(e => {
      const d = e.details || {};
      const amount = d.total_amount || d.amount || d.adjustment_amount || d.refunded_amount || 0;
      return [
        csvEscape(new Date(e.created_at).toLocaleString('da-DK')),
        csvEscape(e.event_type),
        csvEscape(e.target?.name || ''),
        amount,
        csvEscape(e.clerk?.name || e.admin?.name || ''),
        csvEscape(e.session_admin_name || e.admin?.name || ''),
      ].join(',');
    });
    downloadFile(`flango-transaktioner-${fmtDate(from)}-${fmtDate(to)}.csv`, [header, ...rows].join('\n'), 'text/csv');
  } catch (err) {
    console.error('exportTransactionsCsv', err);
    showCustomAlert('Fejl', 'Fejl ved eksport af transaktioner.');
  }
}

// ═══════════════════════════════════════════════════
// EKSPEDIENT-RAPPORT (.csv)
// ═══════════════════════════════════════════════════

export async function exportClerkReport(from, to, includeTestUsers = false) {
  try {
    const data = await getEmployeeSummary(from, to, 'kunde', includeTestUsers);
    const header = 'Navn,Antal salg,Produkter solgt,Salg beløb,Minutter arbejdet,Flango Level';
    const rows = data.map(d => {
      const level = getLevel(d.total_sales || 0, d.total_minutes || 0);
      return [
        csvEscape(d.clerk_name),
        d.total_sales || 0,
        d.total_items_sold || 0,
        d.total_revenue || 0,
        d.total_minutes || 0,
        csvEscape(level),
      ].join(',');
    });
    downloadFile(`flango-ekspedient-rapport-${fmtDate(from)}-${fmtDate(to)}.csv`, [header, ...rows].join('\n'), 'text/csv');
  } catch (err) {
    console.error('exportClerkReport', err);
    showCustomAlert('Fejl', 'Fejl ved eksport af ekspedient-rapport.');
  }
}

// ═══════════════════════════════════════════════════
// PERIODEOVERSIGT (.csv)
// ═══════════════════════════════════════════════════

export async function exportPeriodReport(from, to, includeTestUsers = false) {
  try {
    const data = await getDailySummary(from, to, includeTestUsers);
    const header = 'Dato,Voksen ansvarlig,Antal salg,Omsætning,Top produkt';
    const rows = (data || []).map(d => [
      csvEscape(d.sale_date || ''),
      csvEscape(d.adult_supervisor || ''),
      d.sale_count || 0,
      d.revenue || 0,
      csvEscape(d.top_product?.name || ''),
    ].join(','));
    downloadFile(`flango-periodeoversigt-${fmtDate(from)}-${fmtDate(to)}.csv`, [header, ...rows].join('\n'), 'text/csv');
  } catch (err) {
    console.error('exportPeriodReport', err);
    showCustomAlert('Fejl', 'Fejl ved eksport af periodeoversigt.');
  }
}
