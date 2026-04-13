// Ansvar: Alle Supabase-queries til Historik v2.
// Fase 1 — kun læser fra eksisterende tabeller, views og RPCs.
import { supabaseClient } from '../core/config-and-supabase.js';
import { getInstitutionId, getCurrentAdmin } from './session-store.js';

// ─── HJÆLPERE ───

function instId() {
  return getInstitutionId();
}

function adminId() {
  return getCurrentAdmin()?.id;
}

/** Hent alle rækker via paginering (undgår Supabase's 1000-rækkers standardgrænse).
 *  @param {() => PostgrestFilterBuilder} buildQuery — factory der returnerer et nyt query hver gang.
 */
const PAGE_SIZE = 1000;
async function fetchAllRows(buildQuery) {
  let allRows = [];
  let offset = 0;
  while (true) {
    const { data, error } = await buildQuery().range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allRows = allRows.concat(data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return allRows;
}

/** Cached set af test-bruger IDs for aktuel institution. */
let _testUserIdsCache = null;
let _testUserIdsCacheInst = null;
async function getTestUserIds() {
  const iid = instId();
  if (_testUserIdsCache && _testUserIdsCacheInst === iid) return _testUserIdsCache;
  const { data } = await supabaseClient
    .from('users')
    .select('id')
    .eq('institution_id', iid)
    .eq('is_test_user', true);
  _testUserIdsCache = new Set((data || []).map(u => u.id));
  _testUserIdsCacheInst = iid;
  return _testUserIdsCache;
}

/** Filtrér rækker der vedrører test-brugere (post-filter via cached IDs). */
async function filterTestUsers(rows, userIdField, includeTestUsers) {
  if (includeTestUsers || !rows.length) return rows;
  const testIds = await getTestUserIds();
  if (!testIds.size) return rows;
  return rows.filter(r => !testIds.has(r[userIdField]));
}

/** Hent dato for institutionens første salg (ekskl. testbrugere). Cached pr. session. */
let _firstSaleDateCache = null;
export async function getFirstSaleDate() {
  if (_firstSaleDateCache) return _firstSaleDateCache;
  try {
    const testIds = await getTestUserIds();
    // Hent ældste salg, sortér ASC, limit 1
    let query = supabaseClient
      .from('sales')
      .select('created_at, customer_id')
      .eq('institution_id', instId())
      .order('created_at', { ascending: true })
      .limit(50); // hent lidt ekstra så vi kan filtrere testbrugere client-side
    const { data, error } = await query;
    if (error) { console.error('getFirstSaleDate', error); return null; }
    const rows = (data || []).filter(r => !testIds.size || !testIds.has(r.customer_id));
    if (!rows.length) return null;
    const d = new Date(rows[0].created_at);
    _firstSaleDateCache = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return _firstSaleDateCache;
  } catch (err) {
    console.error('getFirstSaleDate', err);
    return null;
  }
}

/** Beregn from/to for en periode-streng ('idag','uge','maaned','altid'). */
export function periodRange(period) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = new Date(today);
  to.setHours(23, 59, 59, 999);
  let from;
  switch (period) {
    case 'uge': {
      from = new Date(today);
      from.setDate(from.getDate() - 6);
      break;
    }
    case 'maaned': {
      from = new Date(today);
      from.setMonth(from.getMonth() - 1);
      break;
    }
    case 'altid': {
      from = new Date('2020-01-01');
      break;
    }
    default: // 'idag'
      from = new Date(today);
  }
  return { from, to };
}

/** Formatér Date til ISO-dato streng (YYYY-MM-DD). */
export function fmtDate(d) {
  return d.toISOString().split('T')[0];
}

/** Formatér Date til visnings-dato ("27.02 · 16:34"). */
export function fmtDateTime(dateStr) {
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}.${mm} · ${hh}:${mi}`;
}

/** Formatér minutter til "Xt Ym". */
export function fmtMinutes(min) {
  if (!min || min <= 0) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}t`;
  return `${h}t ${m}m`;
}

/** Formatér beløb til "X,XX kr" eller "X kr". */
export function fmtKr(amount) {
  if (amount == null) return '—';
  const n = Number(amount);
  if (Number.isInteger(n)) return `${n.toLocaleString('da-DK')} kr`;
  return `${n.toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr`;
}

/** Formatér dato til "Fre 28.02.2026". */
export function fmtDayDate(dateStr) {
  const d = new Date(dateStr);
  const days = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør'];
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${days[d.getDay()]} ${dd}.${mm}.${d.getFullYear()}`;
}

// ═══════════════════════════════════════════════════
// OVERBLIK
// ═══════════════════════════════════════════════════

/** Hent personlig omsætning for nuværende admin i perioden. */
export async function getMyRevenue(from, to, includeTestUsers = false) {
  try {
    const rows = await fetchAllRows(() =>
      supabaseClient
        .from('sales')
        .select('total_amount, customer_id')
        .eq('institution_id', instId())
        .eq('admin_user_id', adminId())
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString())
    );
    const filtered = await filterTestUsers(rows, 'customer_id', includeTestUsers);
    return filtered.reduce((s, r) => s + Number(r.total_amount || 0), 0);
  } catch (err) {
    console.error('getMyRevenue', err);
    return 0;
  }
}

/** Hent mine transaktioner (antal). */
export async function getMyTransactionCount(from, to, includeTestUsers = false) {
  try {
    const rows = await fetchAllRows(() =>
      supabaseClient
        .from('sales')
        .select('customer_id')
        .eq('institution_id', instId())
        .eq('admin_user_id', adminId())
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString())
    );
    const filtered = await filterTestUsers(rows, 'customer_id', includeTestUsers);
    return filtered.length;
  } catch (err) {
    console.error('getMyTransactionCount', err);
    return 0;
  }
}

/** Hent transaktionssplit: mine (selv-eksp.) vs. børn (assisterede) — antal + omsætning. */
export async function getMyTransactionSplit(from, to, includeTestUsers = false) {
  try {
    const rows = await fetchAllRows(() =>
      supabaseClient
        .from('sales')
        .select('total_amount, clerk_user_id, admin_user_id, customer_id')
        .eq('institution_id', instId())
        .eq('admin_user_id', adminId())
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString())
    );
    const filtered = await filterTestUsers(rows, 'customer_id', includeTestUsers);
    const me = adminId();
    let myCount = 0, myRevenue = 0, childCount = 0, childRevenue = 0;
    filtered.forEach(r => {
      const amt = Number(r.total_amount || 0);
      // Hvis clerk_user_id er null eller lig admin, var det mig selv
      if (!r.clerk_user_id || r.clerk_user_id === me) {
        myCount++;
        myRevenue += amt;
      } else {
        childCount++;
        childRevenue += amt;
      }
    });
    return { total: filtered.length, myCount, myRevenue, childCount, childRevenue, totalRevenue: myRevenue + childRevenue };
  } catch (err) {
    console.error('getMyTransactionSplit', err);
    return { total: 0, myCount: 0, myRevenue: 0, childCount: 0, childRevenue: 0, totalRevenue: 0 };
  }
}

/** Hent ugens omsætning (man-fre/lør/søn) for den uge der indeholder 'referenceDate'. */
export async function getWeekRevenue(referenceDate, includeTestUsers = false) {
  try {
    // Find mandag i ugen
    const d = new Date(referenceDate);
    const day = d.getDay(); // 0=søn, 1=man, ...
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((day + 6) % 7));
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const rawRows = await fetchAllRows(() =>
      supabaseClient
        .from('sales')
        .select('total_amount, created_at, customer_id')
        .eq('institution_id', instId())
        .gte('created_at', monday.toISOString())
        .lte('created_at', sunday.toISOString())
    );
    const rows = await filterTestUsers(rawRows, 'customer_id', includeTestUsers);

    // Byg array med alle 7 dage
    const dayNames = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];
    const days = [];
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(monday);
      dayDate.setDate(monday.getDate() + i);
      const key = `${dayDate.getFullYear()}-${String(dayDate.getMonth() + 1).padStart(2, '0')}-${String(dayDate.getDate()).padStart(2, '0')}`;
      days.push({
        label: dayNames[i],
        date: `${String(dayDate.getDate())}/${String(dayDate.getMonth() + 1)}`,
        dateKey: key,
        revenue: 0,
        isToday: key === fmtDate(new Date()),
      });
    }

    // Aggregér omsætning pr. dag
    rows.forEach(r => {
      const rd = new Date(r.created_at);
      const key = `${rd.getFullYear()}-${String(rd.getMonth() + 1).padStart(2, '0')}-${String(rd.getDate()).padStart(2, '0')}`;
      const dayEntry = days.find(dd => dd.dateKey === key);
      if (dayEntry) dayEntry.revenue += Number(r.total_amount || 0);
    });

    const total = days.reduce((s, dd) => s + dd.revenue, 0);
    const daysWithRevenue = days.filter(dd => dd.revenue > 0).length;
    const avg = daysWithRevenue ? Math.round(total / daysWithRevenue) : 0;

    return { days, total, avg };
  } catch (err) {
    console.error('getWeekRevenue', err);
    return { days: [], total: 0, avg: 0 };
  }
}

/** Hent omsætning pr. time for én dag (til "I dag"-graf). */
export async function getHourlyRevenue(date, includeTestUsers = false) {
  try {
    const from = new Date(date); from.setHours(0, 0, 0, 0);
    const to = new Date(date); to.setHours(23, 59, 59, 999);
    const rawRows = await fetchAllRows(() =>
      supabaseClient
        .from('sales')
        .select('total_amount, created_at, customer_id')
        .eq('institution_id', instId())
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString())
    );
    const rows = await filterTestUsers(rawRows, 'customer_id', includeTestUsers);

    const byHour = {};
    rows.forEach(r => {
      const h = new Date(r.created_at).getHours();
      byHour[h] = (byHour[h] || 0) + Number(r.total_amount || 0);
    });

    // Vis timer fra tidligste salg (min 8) til seneste (min 17)
    const hours = Object.keys(byHour).map(Number);
    const minH = hours.length ? Math.min(...hours, 8) : 8;
    const maxH = hours.length ? Math.max(...hours, 17) : 17;
    const now = new Date();
    const currentHour = now.getHours();
    const isToday = from.toDateString() === now.toDateString();

    const result = [];
    for (let h = minH; h <= maxH; h++) {
      result.push({ label: `${h}`, value: byHour[h] || 0, highlight: isToday && h === currentHour });
    }
    return result;
  } catch (err) {
    console.error('getHourlyRevenue', err);
    return [];
  }
}

/** Hent omsætning pr. dag for en periode (til "Måned"-graf). Fylder huller med 0. */
export async function getDailyRevenue(from, to, includeTestUsers = false) {
  try {
    const rawRows = await fetchAllRows(() =>
      supabaseClient
        .from('sales')
        .select('total_amount, created_at, customer_id')
        .eq('institution_id', instId())
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString())
    );
    const rows = await filterTestUsers(rawRows, 'customer_id', includeTestUsers);

    const byDay = {};
    rows.forEach(r => {
      const d = new Date(r.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      byDay[key] = (byDay[key] || 0) + Number(r.total_amount || 0);
    });

    const today = new Date();
    const result = [];
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      result.push({
        label: `${d.getDate()}`,
        value: byDay[key] || 0,
        highlight: d.toDateString() === today.toDateString(),
      });
    }
    return result;
  } catch (err) {
    console.error('getDailyRevenue', err);
    return [];
  }
}

/** Hent omsætning kun for dage med salg (ingen 0-dage). Til "Altid + Graf". */
export async function getDailyRevenueActive(from, to, includeTestUsers = false) {
  try {
    const rawRows = await fetchAllRows(() =>
      supabaseClient
        .from('sales')
        .select('total_amount, created_at, customer_id')
        .eq('institution_id', instId())
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString())
    );
    const rows = await filterTestUsers(rawRows, 'customer_id', includeTestUsers);

    const byDay = {};
    rows.forEach(r => {
      const d = new Date(r.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      byDay[key] = (byDay[key] || 0) + Number(r.total_amount || 0);
    });

    const today = new Date();
    // Kun dage med mindst ét salg — sorteret kronologisk
    return Object.keys(byDay).sort().map(key => {
      const [y, m, d] = key.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      return {
        label: `${d}/${m}`,
        subLabel: date.toLocaleDateString('da-DK', { weekday: 'short' }),
        value: byDay[key],
        highlight: date.toDateString() === today.toDateString(),
      };
    });
  } catch (err) {
    console.error('getDailyRevenueActive', err);
    return [];
  }
}

/** Hent omsætning pr. måned (til "Altid"-graf). */
export async function getMonthlyRevenue(from, to, includeTestUsers = false) {
  try {
    const rawRows = await fetchAllRows(() =>
      supabaseClient
        .from('sales')
        .select('total_amount, created_at, customer_id')
        .eq('institution_id', instId())
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString())
    );
    const rows = await filterTestUsers(rawRows, 'customer_id', includeTestUsers);

    const byMonth = {};
    rows.forEach(r => {
      const d = new Date(r.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      byMonth[key] = (byMonth[key] || 0) + Number(r.total_amount || 0);
    });

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
    const now = new Date();
    const curKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, revenue]) => {
        const [y, m] = key.split('-');
        return { label: `${monthNames[parseInt(m) - 1]}`, subLabel: `'${y.slice(2)}`, value: revenue, highlight: key === curKey };
      });
  } catch (err) {
    console.error('getMonthlyRevenue', err);
    return [];
  }
}

/** Hent klub-total omsætning og antal cafédage. */
export async function getClubStats(from, to, includeTestUsers = false) {
  try {
    const rawRows = await fetchAllRows(() =>
      supabaseClient
        .from('sales')
        .select('total_amount, created_at, customer_id')
        .eq('institution_id', instId())
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString())
    );
    const rows = await filterTestUsers(rawRows, 'customer_id', includeTestUsers);
    const totalRevenue = rows.reduce((s, r) => s + Number(r.total_amount || 0), 0);
    const saleCount = rows.length;
    const uniqueDays = new Set(rows.map(r => {
      const d = new Date(r.created_at);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    }));
    return { totalRevenue, saleCount, cafeDays: uniqueDays.size || 1 };
  } catch (err) {
    console.error('getClubStats', err);
    return { totalRevenue: 0, saleCount: 0, cafeDays: 0 };
  }
}

/** Hent total indbetalinger (DEPOSIT events). */
export async function getTotalDeposits(from, to, includeTestUsers = false) {
  try {
    const rawRows = await fetchAllRows(() =>
      supabaseClient
        .from('events')
        .select('details, target_user_id')
        .eq('institution_id', instId())
        .eq('event_type', 'DEPOSIT')
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString())
    );
    const rows = await filterTestUsers(rawRows, 'target_user_id', includeTestUsers);
    const amount = rows.reduce((s, r) => s + Number(r.details?.amount || 0), 0);
    return { amount, count: rows.length };
  } catch (err) {
    console.error('getTotalDeposits', err);
    return { amount: 0, count: 0 };
  }
}

/** Hent min tid som ansvarlig (via user_daily_stats). */
export async function getMyMinutesWorked(from, to) {
  try {
    const rows = await fetchAllRows(() =>
      supabaseClient
        .from('user_daily_stats')
        .select('minutes_worked')
        .eq('institution_id', instId())
        .eq('user_id', adminId())
        .gte('stats_date', fmtDate(from))
        .lte('stats_date', fmtDate(to))
    );
    return rows.reduce((s, r) => s + Number(r.minutes_worked || 0), 0);
  } catch (err) {
    console.error('getMyMinutesWorked', err);
    return 0;
  }
}

/** Hent saldoer i alt (live, ikke periodefiltreret). */
export async function getTotalBalances(includeTestUsers = false) {
  try {
    const rows = await fetchAllRows(() => {
      let q = supabaseClient
        .from('users')
        .select('balance')
        .eq('institution_id', instId())
        .eq('role', 'kunde');
      if (!includeTestUsers) q = q.or('is_test_user.eq.false,is_test_user.is.null');
      return q;
    });
    const total = rows.reduce((s, r) => s + Number(r.balance || 0), 0);
    return { total, count: rows.length, avg: rows.length ? Math.round(total / rows.length) : 0 };
  } catch (err) {
    console.error('getTotalBalances', err);
    return { total: 0, count: 0, avg: 0 };
  }
}

/** Top produkter (antal + omsætning). */
export async function getTopProducts(from, to, limit = 5, includeTestUsers = false) {
  // Brug altid fallback når test-brugere skal filtreres (RPC understøtter ikke det)
  if (!includeTestUsers) {
    const testIds = await getTestUserIds();
    if (testIds.size) return getTopProductsFallback(from, to, limit, includeTestUsers);
  }
  const { data, error } = await supabaseClient.rpc('get_top_products_for_historik', {
    p_institution_id: instId(),
    p_from: from.toISOString(),
    p_to: to.toISOString(),
    p_limit: limit,
  });
  // Fallback: direkte query hvis RPC ikke findes
  if (error) {
    console.warn('RPC get_top_products_for_historik ikke fundet, bruger fallback query');
    return getTopProductsFallback(from, to, limit, includeTestUsers);
  }
  return data || [];
}

async function getTopProductsFallback(from, to, limit, includeTestUsers = false) {
  try {
    // Hent alle salgs-IDs med paginering
    const rawSales = await fetchAllRows(() =>
      supabaseClient
        .from('sales')
        .select('id, customer_id')
        .eq('institution_id', instId())
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString())
    );
    const sales = await filterTestUsers(rawSales, 'customer_id', includeTestUsers);
    if (!sales.length) return [];

    // Hent sale_items i chunks (undgå for lang .in() URL)
    const saleIds = sales.map(s => s.id);
    const CHUNK = 500;
    let allItems = [];
    for (let i = 0; i < saleIds.length; i += CHUNK) {
      const chunk = saleIds.slice(i, i + CHUNK);
      const items = await fetchAllRows(() =>
        supabaseClient
          .from('sale_items')
          .select('product_id, quantity, price_at_purchase, product_name_at_purchase')
          .in('sale_id', chunk)
      );
      allItems = allItems.concat(items);
    }

    // Hent produkt-info for emojis
    const productIds = [...new Set(allItems.map(i => i.product_id).filter(Boolean))];
    let productsMap = {};
    if (productIds.length) {
      const { data: prods } = await supabaseClient
        .from('products')
        .select('id, name, emoji, icon_url, icon_storage_path')
        .in('id', productIds);
      (prods || []).forEach(p => { productsMap[p.id] = p; });
    }

    // Aggreger
    const agg = {};
    allItems.forEach(i => {
      const pid = i.product_id || 'unknown';
      if (!agg[pid]) {
        const prod = productsMap[pid];
        agg[pid] = {
          name: prod?.name || i.product_name_at_purchase || 'Ukendt',
          emoji: prod?.emoji || '',
          icon_url: prod?.icon_url || '',
          icon_storage_path: prod?.icon_storage_path || '',
          antal: 0,
          beloeb: 0,
        };
      }
      agg[pid].antal += Number(i.quantity || 0);
      agg[pid].beloeb += Number(i.quantity || 0) * Number(i.price_at_purchase || 0);
    });

    return Object.values(agg)
      .sort((a, b) => b.antal - a.antal)
      .slice(0, limit);
  } catch (err) {
    console.error('getTopProductsFallback', err);
    return [];
  }
}

/** Dagens ekspedienter. */
export async function getDailyClerks(from, to, includeTestUsers = false) {
  try {
    const rawRows = await fetchAllRows(() =>
      supabaseClient
        .from('sales')
        .select('id, total_amount, clerk_user_id, admin_user_id, customer_id')
        .eq('institution_id', instId())
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString())
    );
    const rows = await filterTestUsers(rawRows, 'customer_id', includeTestUsers);

    // Aggreger pr. ekspedient (clerk_user_id, fallback admin_user_id)
    const byUser = {};
    rows.forEach(s => {
      const uid = s.clerk_user_id || s.admin_user_id;
      if (!uid) return;
      if (!byUser[uid]) byUser[uid] = { userId: uid, saleCount: 0, revenue: 0 };
      byUser[uid].saleCount++;
      byUser[uid].revenue += Number(s.total_amount || 0);
    });

    // Hent brugerdata
    const userIds = Object.keys(byUser);
    if (!userIds.length) return [];

    const { data: users } = await supabaseClient
      .from('users')
      .select('id, name, role')
      .in('id', userIds);

    // Hent minuttal for dagen
    const { data: stats } = await supabaseClient
      .from('user_daily_stats')
      .select('user_id, minutes_worked')
      .eq('institution_id', instId())
      .in('user_id', userIds)
      .gte('stats_date', fmtDate(from))
      .lte('stats_date', fmtDate(to));

    const statsMap = {};
    (stats || []).forEach(s => {
      statsMap[s.user_id] = (statsMap[s.user_id] || 0) + Number(s.minutes_worked || 0);
    });

    const usersMap = {};
    (users || []).forEach(u => { usersMap[u.id] = u; });

    return Object.values(byUser)
      .map(b => ({
        ...b,
        name: usersMap[b.userId]?.name || 'Ukendt',
        role: usersMap[b.userId]?.role || 'kunde',
        minutes: statsMap[b.userId] || 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  } catch (err) {
    console.error('getDailyClerks', err);
    return [];
  }
}

// ═══════════════════════════════════════════════════
// TRANSAKTIONER
// ═══════════════════════════════════════════════════

/** Hent transaktioner (events). */
export async function getTransactions(from, to, includeTestUsers = false) {
  const data = await fetchAllRows(() =>
    supabaseClient
      .from('events')
      .select(`
        id, created_at, event_type, details,
        session_admin_id, session_admin_name,
        target_user_id, clerk_user_id, admin_user_id
      `)
      .eq('institution_id', instId())
      .gte('created_at', from.toISOString())
      .lte('created_at', to.toISOString())
      .order('created_at', { ascending: false })
  );

  // Hent alle refererede brugere
  const userIds = new Set();
  data.forEach(e => {
    if (e.target_user_id) userIds.add(e.target_user_id);
    if (e.clerk_user_id) userIds.add(e.clerk_user_id);
    if (e.admin_user_id) userIds.add(e.admin_user_id);
  });
  const uids = [...userIds];
  let usersMap = {};
  if (uids.length) {
    // Hent brugere i chunks (undgå for lang .in() URL)
    const CHUNK = 300;
    for (let i = 0; i < uids.length; i += CHUNK) {
      const chunk = uids.slice(i, i + CHUNK);
      const { data: users } = await supabaseClient
        .from('users')
        .select('id, name, role, is_test_user')
        .in('id', chunk);
      (users || []).forEach(u => { usersMap[u.id] = u; });
    }
  }

  let results = data.map(e => ({
    ...e,
    target: usersMap[e.target_user_id] || null,
    clerk: usersMap[e.clerk_user_id] || null,
    admin: usersMap[e.admin_user_id] || null,
  }));

  if (!includeTestUsers) {
    results = results.filter(e => !e.target?.is_test_user);
  }

  return results;
}

/** Hent produktlinjer for et salg. */
export async function getSaleItems(saleId) {
  const { data, error } = await supabaseClient
    .from('sale_items')
    .select('quantity, price_at_purchase, is_refill, product_name_at_purchase, product_id')
    .eq('sale_id', saleId);
  if (error) { console.error('getSaleItems', error); return []; }

  // Hent emojis + icon_url
  const pids = [...new Set((data || []).map(i => i.product_id).filter(Boolean))];
  let prodMap = {};
  if (pids.length) {
    const { data: prods } = await supabaseClient
      .from('products')
      .select('id, emoji, icon_url, icon_storage_path')
      .in('id', pids);
    (prods || []).forEach(p => { prodMap[p.id] = p; });
  }

  return (data || []).map(i => ({
    ...i,
    emoji: prodMap[i.product_id]?.emoji || '',
    icon_url: prodMap[i.product_id]?.icon_url || '',
    icon_storage_path: prodMap[i.product_id]?.icon_storage_path || '',
    name: i.product_name_at_purchase || 'Ukendt',
  }));
}

// ═══════════════════════════════════════════════════
// PERIODER
// ═══════════════════════════════════════════════════

/** Hent daglig opsummering via eksisterende RPC. */
export async function getDailySummary(from, to, includeTestUsers = false) {
  const { data, error } = await supabaseClient.rpc('get_daily_summary', {
    p_institution_id: instId(),
    p_from_date: fmtDate(from),
    p_to_date: fmtDate(to),
    p_include_test_users: includeTestUsers,
    p_only_test_users: false,
  });
  if (error) { console.error('getDailySummary', error); return []; }
  return data || [];
}

/** Hent ugentlig opsummering via eksisterende RPC. */
export async function getWeeklySummary(from, to, includeTestUsers = false) {
  const { data, error } = await supabaseClient.rpc('get_weekly_summary', {
    p_institution_id: instId(),
    p_from_date: fmtDate(from),
    p_to_date: fmtDate(to),
    p_include_test_users: includeTestUsers,
    p_only_test_users: false,
  });
  if (error) { console.error('getWeeklySummary', error); return []; }
  return data || [];
}

/** Hent månedlig opsummering via eksisterende RPC. */
export async function getMonthlySummary(from, to, includeTestUsers = false) {
  const { data, error } = await supabaseClient.rpc('get_monthly_summary', {
    p_institution_id: instId(),
    p_from_date: fmtDate(from),
    p_to_date: fmtDate(to),
    p_include_test_users: includeTestUsers,
    p_only_test_users: false,
  });
  if (error) { console.error('getMonthlySummary', error); return []; }
  return data || [];
}

// ═══════════════════════════════════════════════════
// PERSONALE
// ═══════════════════════════════════════════════════

/** Hent ekspedient-opsummering via eksisterende RPC. */
export async function getEmployeeSummary(from, to, role = 'kunde', includeTestUsers = false) {
  const { data, error } = await supabaseClient.rpc('get_employee_summary', {
    p_institution_id: instId(),
    p_from_date: fmtDate(from),
    p_to_date: fmtDate(to),
    p_include_test_users: includeTestUsers,
    p_only_test_users: false,
    p_employee_role: role,
  });
  if (error) { console.error('getEmployeeSummary', error); return []; }

  // Hent saldoer + minutes for alle returnerede
  const clerkIds = (data || []).map(d => d.clerk_id).filter(Boolean);
  let userExtras = {};
  if (clerkIds.length) {
    const { data: users } = await supabaseClient
      .from('users')
      .select('id, balance, total_minutes_worked, total_sales_count')
      .in('id', clerkIds);
    (users || []).forEach(u => { userExtras[u.id] = u; });
  }

  return (data || []).map(d => ({
    ...d,
    balance: userExtras[d.clerk_id]?.balance ?? null,
    total_minutes: userExtras[d.clerk_id]?.total_minutes_worked ?? 0,
    total_sales_cumulative: userExtras[d.clerk_id]?.total_sales_count ?? 0,
  }));
}

/** Hent selv-salg og assisteret-salg for admins. */
export async function getAdminSalesSplit(adminUserId, from, to) {
  try {
    // Selv-salg (admin var clerk direkte)
    const selfData = await fetchAllRows(() =>
      supabaseClient
        .from('sales')
        .select('total_amount')
        .eq('institution_id', instId())
        .eq('clerk_user_id', adminUserId)
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString())
    );
    const selfSales = selfData.reduce((s, r) => s + Number(r.total_amount || 0), 0);

    // Assisteret-salg (admin var session_admin mens barn ekspederede)
    const assistData = await fetchAllRows(() =>
      supabaseClient
        .from('sales')
        .select('total_amount, clerk_user_id')
        .eq('institution_id', instId())
        .eq('admin_user_id', adminUserId)
        .not('clerk_user_id', 'is', null)
        .neq('clerk_user_id', adminUserId)
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString())
    );
    const assistedSales = assistData.reduce((s, r) => s + Number(r.total_amount || 0), 0);

    return { selfSales, assistedSales };
  } catch (err) {
    console.error('getAdminSalesSplit', err);
    return { selfSales: 0, assistedSales: 0 };
  }
}

/** Hent selv-eksp. tid og børn-eksp. tid for en admin i en periode. */
export async function getAdminTimeSplit(adminUserId, from, to) {
  try {
    // 1) Selv eksp. — adminens egne minutter fra user_daily_stats
    const selfRows = await fetchAllRows(() =>
      supabaseClient
        .from('user_daily_stats')
        .select('minutes_worked')
        .eq('institution_id', instId())
        .eq('user_id', adminUserId)
        .gte('stats_date', fmtDate(from))
        .lte('stats_date', fmtDate(to))
    );
    const selfMinutes = selfRows.reduce((s, r) => s + Number(r.minutes_worked || 0), 0);

    // 2) Børn eksp. — find børn der ekspederede under denne voksen via events
    const childEvents = await fetchAllRows(() =>
      supabaseClient
        .from('events')
        .select('clerk_user_id, created_at')
        .eq('institution_id', instId())
        .eq('session_admin_id', adminUserId)
        .eq('event_type', 'SALE')
        .not('clerk_user_id', 'is', null)
        .neq('clerk_user_id', adminUserId)
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString())
    );

    // Saml unikke (child_id, date) par
    const childDatePairs = new Set();
    const childIds = new Set();
    for (const ev of childEvents) {
      const d = ev.created_at.slice(0, 10); // YYYY-MM-DD
      childDatePairs.add(`${ev.clerk_user_id}|${d}`);
      childIds.add(ev.clerk_user_id);
    }

    let childMinutes = 0;
    if (childIds.size) {
      // Hent user_daily_stats for alle relevante børn i perioden
      const statsRows = await fetchAllRows(() =>
        supabaseClient
          .from('user_daily_stats')
          .select('user_id, stats_date, minutes_worked')
          .eq('institution_id', instId())
          .in('user_id', [...childIds])
          .gte('stats_date', fmtDate(from))
          .lte('stats_date', fmtDate(to))
      );
      // Summér kun de dage hvor barnet faktisk ekspederede under denne voksen
      for (const row of statsRows) {
        if (childDatePairs.has(`${row.user_id}|${row.stats_date}`)) {
          childMinutes += Number(row.minutes_worked || 0);
        }
      }
    }

    return { selfMinutes, childMinutes };
  } catch (err) {
    console.error('getAdminTimeSplit', err);
    return { selfMinutes: 0, childMinutes: 0 };
  }
}

/** Indbetalinger registreret af en admin i en periode (antal + beløb). */
export async function getAdminDeposits(adminUserId, from, to) {
  try {
    const rows = await fetchAllRows(() =>
      supabaseClient
        .from('events')
        .select('details')
        .eq('institution_id', instId())
        .eq('admin_user_id', adminUserId)
        .eq('event_type', 'DEPOSIT')
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString())
    );
    const count = rows.length;
    const amount = rows.reduce((s, r) => s + Number(r.details?.amount || 0), 0);
    return { depositCount: count, depositAmount: amount };
  } catch (err) {
    console.error('getAdminDeposits', err);
    return { depositCount: 0, depositAmount: 0 };
  }
}

/**
 * Café-dage for a single admin: per-day breakdown with hours, sales, revenue, dish.
 * A day is "qualified" if ≥1 hour (60 min) AND 20+ sales.
 * @param {string} adminUserId
 * @param {Date|null} from  — null = all time
 * @param {Date|null} to
 * @param {boolean} [includeTestUsers=false]
 * @returns {Promise<Array<{date:string, dayLabel:string, hours:number, sales:number, revenue:number, dish:string, qualified:boolean}>>}
 */
export async function getAdminCafeDays(adminUserId, from, to, includeTestUsers = false) {
  try {
    const WEEKDAYS_DA = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør'];

    // 1) Fetch all sales where this admin was clerk or session_admin
    const fromIso = from ? from.toISOString() : null;
    const toIso = to ? to.toISOString() : null;
    const fromDate = from ? fmtDate(from) : null;
    const toDate = to ? fmtDate(to) : null;
    const iid = instId();

    const rawSalesRows = await fetchAllRows(() => {
      let q = supabaseClient
        .from('sales')
        .select('id, total_amount, created_at, clerk_user_id, customer_id, sale_items(product_id, quantity, product_name_at_purchase)')
        .eq('institution_id', iid)
        .or(`clerk_user_id.eq.${adminUserId},admin_user_id.eq.${adminUserId}`);
      if (fromIso) q = q.gte('created_at', fromIso);
      if (toIso) q = q.lte('created_at', toIso);
      return q;
    });
    const salesRows = await filterTestUsers(rawSalesRows, 'customer_id', includeTestUsers);

    // 2) Fetch user_daily_stats for this admin (hours worked per day)
    const statsRows = await fetchAllRows(() => {
      let q = supabaseClient
        .from('user_daily_stats')
        .select('stats_date, minutes_worked')
        .eq('institution_id', iid)
        .eq('user_id', adminUserId);
      if (fromDate) q = q.gte('stats_date', fromDate);
      if (toDate) q = q.lte('stats_date', toDate);
      return q;
    });

    // 3) Fetch products to detect daily specials
    const { data: productsData } = await supabaseClient
      .from('products')
      .select('id, name, is_daily_special')
      .eq('institution_id', iid);
    const dailySpecialIds = new Set((productsData || []).filter(p => p.is_daily_special).map(p => p.id));
    const productNameMap = {};
    (productsData || []).forEach(p => { productNameMap[p.id] = p.name; });

    // 4) Aggregate sales per day
    const dayMap = {}; // date-string → { sales, revenue, dishCounts: { name: qty } }
    salesRows.forEach(sale => {
      const dateStr = sale.created_at.slice(0, 10); // YYYY-MM-DD
      if (!dayMap[dateStr]) dayMap[dateStr] = { sales: 0, revenue: 0, dishCounts: {} };
      const day = dayMap[dateStr];
      const items = sale.sale_items || [];
      items.forEach(item => {
        const qty = item.quantity || 1;
        day.sales += qty;
        // Track daily special dishes
        if (dailySpecialIds.has(item.product_id)) {
          const dName = item.product_name_at_purchase || productNameMap[item.product_id] || 'Dagens ret';
          day.dishCounts[dName] = (day.dishCounts[dName] || 0) + qty;
        }
      });
      day.revenue += Number(sale.total_amount || 0);
    });

    // 5) Aggregate minutes per day
    const minutesMap = {};
    statsRows.forEach(s => {
      minutesMap[s.stats_date] = (minutesMap[s.stats_date] || 0) + Number(s.minutes_worked || 0);
    });

    // 6) Merge: every date that appears in either sales or stats
    const allDates = new Set([...Object.keys(dayMap), ...Object.keys(minutesMap)]);
    const result = [];
    allDates.forEach(dateStr => {
      const sales = dayMap[dateStr]?.sales || 0;
      const revenue = Math.round(dayMap[dateStr]?.revenue || 0);
      const minutes = minutesMap[dateStr] || 0;
      const hours = Math.round((minutes / 60) * 100) / 100; // 2 decimals

      // Qualified: ≥60 min AND ≥20 sales
      const qualified = minutes >= 60 && sales >= 20;

      // Best dish = most sold daily special that day, or empty
      let dish = '';
      const dc = dayMap[dateStr]?.dishCounts || {};
      const dishEntries = Object.entries(dc);
      if (dishEntries.length) {
        dishEntries.sort((a, b) => b[1] - a[1]);
        dish = dishEntries[0][0];
      }

      // Day label: "Man 3/3"
      const d = new Date(dateStr + 'T12:00:00');
      const dayLabel = `${WEEKDAYS_DA[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;

      result.push({ date: dateStr, dayLabel, hours, sales, dish, revenue, qualified });
    });

    // Sort by date descending (newest first)
    result.sort((a, b) => b.date.localeCompare(a.date));
    return result;
  } catch (err) {
    console.error('getAdminCafeDays', err);
    return [];
  }
}

/** Cached map: product_id → { emoji, icon_url }. Invalideres ved nyt inst. */
let _iconCache = null;
let _iconCacheInst = null;
export async function getProductsIconMap() {
  const iid = instId();
  if (_iconCache && _iconCacheInst === iid) return _iconCache;
  const { data } = await supabaseClient
    .from('products')
    .select('id, emoji, icon_url, icon_storage_path')
    .eq('institution_id', iid);
  const map = {};
  (data || []).forEach(p => { map[p.id] = { emoji: p.emoji || '', icon_url: p.icon_url || '', icon_storage_path: p.icon_storage_path || '' }; });
  _iconCache = map;
  _iconCacheInst = iid;
  return map;
}

// ═══════════════════════════════════════════════════
// TOPLISTER
// ═══════════════════════════════════════════════════

/** Top ekspedienter (børn). */
export async function getTopClerks(from, to, limit = 5, includeTestUsers = false) {
  try {
    const rawRows = await fetchAllRows(() =>
      supabaseClient
        .from('sales')
        .select('id, total_amount, clerk_user_id, customer_id')
        .eq('institution_id', instId())
        .not('clerk_user_id', 'is', null)
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString())
    );
    const rows = await filterTestUsers(rawRows, 'customer_id', includeTestUsers);

    // Hent bruger-roller for at filtrere til børn
    const clerkIds = [...new Set(rows.map(s => s.clerk_user_id))];
    if (!clerkIds.length) return [];

    const { data: users } = await supabaseClient
      .from('users')
      .select('id, name, role')
      .in('id', clerkIds);
    const usersMap = {};
    (users || []).forEach(u => { usersMap[u.id] = u; });

    const agg = {};
    rows.forEach(s => {
      const u = usersMap[s.clerk_user_id];
      if (!u || u.role !== 'kunde') return;
      if (!agg[s.clerk_user_id]) agg[s.clerk_user_id] = { name: u.name, antal_salg: 0, beloeb: 0 };
      agg[s.clerk_user_id].antal_salg++;
      agg[s.clerk_user_id].beloeb += Number(s.total_amount || 0);
    });

    return Object.values(agg).sort((a, b) => b.antal_salg - a.antal_salg).slice(0, limit);
  } catch (err) {
    console.error('getTopClerks', err);
    return [];
  }
}

/** Top kunder. */
export async function getTopCustomers(from, to, limit = 5, includeTestUsers = false) {
  try {
    const rawRows = await fetchAllRows(() =>
      supabaseClient
        .from('sales')
        .select('id, total_amount, customer_id')
        .eq('institution_id', instId())
        .not('customer_id', 'is', null)
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString())
    );
    const rows = await filterTestUsers(rawRows, 'customer_id', includeTestUsers);

    const custIds = [...new Set(rows.map(s => s.customer_id))];
    if (!custIds.length) return [];

    const { data: users } = await supabaseClient
      .from('users')
      .select('id, name')
      .in('id', custIds);
    const usersMap = {};
    (users || []).forEach(u => { usersMap[u.id] = u; });

    const agg = {};
    rows.forEach(s => {
      if (!agg[s.customer_id]) agg[s.customer_id] = { name: usersMap[s.customer_id]?.name || 'Ukendt', antal_koeb: 0, forbrugt: 0 };
      agg[s.customer_id].antal_koeb++;
      agg[s.customer_id].forbrugt += Number(s.total_amount || 0);
    });

    return Object.values(agg).sort((a, b) => b.forbrugt - a.forbrugt).slice(0, limit);
  } catch (err) {
    console.error('getTopCustomers', err);
    return [];
  }
}

/**
 * Hent detaljeret kundeoversigt: alle børn med saldo, forbrug, favorit, indbetalinger.
 * Bruges i Toplister → Kunder tab.
 */
export async function getCustomerStats(from, to, includeTestUsers = false) {
  try {
    const iid = instId();
    const fromIso = from.toISOString();
    const toIso = to.toISOString();
    const fromDate = fmtDate(from);
    const toDate = fmtDate(to);

    // 1) All kunder (non-admin) med saldo
    const { data: usersData } = await supabaseClient
      .from('users')
      .select('id, name, balance, role, is_test_user')
      .eq('institution_id', iid)
      .eq('role', 'kunde');

    let allUsers = usersData || [];
    if (!includeTestUsers) allUsers = allUsers.filter(u => !u.is_test_user);

    // 2) Salg i perioden — med sale_items for favorit-beregning
    const rawSales = await fetchAllRows(() =>
      supabaseClient
        .from('sales')
        .select('id, total_amount, customer_id, sale_items(product_id, quantity, product_name_at_purchase)')
        .eq('institution_id', iid)
        .not('customer_id', 'is', null)
        .gte('created_at', fromIso)
        .lte('created_at', toIso)
    );
    const sales = await filterTestUsers(rawSales, 'customer_id', includeTestUsers);

    // 3) Indbetalinger (DEPOSIT events) i perioden
    const rawDeposits = await fetchAllRows(() =>
      supabaseClient
        .from('events')
        .select('details, target_user_id')
        .eq('institution_id', iid)
        .eq('event_type', 'DEPOSIT')
        .gte('created_at', fromIso)
        .lte('created_at', toIso)
    );
    const deposits = await filterTestUsers(rawDeposits, 'target_user_id', includeTestUsers);

    // 4) Aggregér pr. kunde
    const custMap = {};
    allUsers.forEach(u => {
      custMap[u.id] = { id: u.id, name: u.name || 'Ukendt', saldo: Math.round(Number(u.balance || 0)), forbrug: 0, koeb: 0, favorit: '', indbetalinger: 0, indbetKr: 0, productCounts: {} };
    });

    sales.forEach(s => {
      const c = custMap[s.customer_id];
      if (!c) return;
      c.koeb++;
      c.forbrug += Math.round(Number(s.total_amount || 0));
      const items = s.sale_items || [];
      items.forEach(item => {
        const qty = item.quantity || 1;
        const name = item.product_name_at_purchase || '?';
        c.productCounts[name] = (c.productCounts[name] || 0) + qty;
      });
    });

    deposits.forEach(d => {
      const c = custMap[d.target_user_id];
      if (!c) return;
      c.indbetalinger++;
      c.indbetKr += Math.round(Number(d.details?.amount || 0));
    });

    // 5) Beregn favorit (mest-købt produkt)
    Object.values(custMap).forEach(c => {
      const entries = Object.entries(c.productCounts);
      if (entries.length) {
        entries.sort((a, b) => b[1] - a[1]);
        c.favorit = entries[0][0];
      }
      delete c.productCounts;
    });

    return Object.values(custMap).sort((a, b) => b.forbrug - a.forbrug);
  } catch (err) {
    console.error('getCustomerStats', err);
    return [];
  }
}

// ═══════════════════════════════════════════════════
// STATISTIK
// ═══════════════════════════════════════════════════

/** Omsætning pr. dag. */
export async function getRevenueByDay(from, to, includeTestUsers = false) {
  try {
    const rawRows = await fetchAllRows(() =>
      supabaseClient
        .from('sales')
        .select('total_amount, created_at, customer_id')
        .eq('institution_id', instId())
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString())
        .order('created_at', { ascending: true })
    );
    const rows = await filterTestUsers(rawRows, 'customer_id', includeTestUsers);

    const byDay = {};
    rows.forEach(s => {
      const d = new Date(s.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      byDay[key] = (byDay[key] || 0) + Number(s.total_amount || 0);
    });

    return Object.entries(byDay)
      .map(([dato, omsaetning]) => ({ dato, omsaetning }))
      .sort((a, b) => a.dato.localeCompare(b.dato));
  } catch (err) {
    console.error('getRevenueByDay', err);
    return [];
  }
}

/** Saldofordeling. */
export async function getBalanceDistribution(includeTestUsers = false) {
  try {
    const rows = await fetchAllRows(() => {
      let q = supabaseClient
        .from('users')
        .select('balance')
        .eq('institution_id', instId())
        .eq('role', 'kunde');
      if (!includeTestUsers) q = q.or('is_test_user.eq.false,is_test_user.is.null');
      return q;
    });

    const segments = {
      'Negativ': 0,
      '0 kr': 0,
      '1–20 kr': 0,
      '21–50 kr': 0,
      '51–100 kr': 0,
      '100+ kr': 0,
    };

    rows.forEach(u => {
      const b = Number(u.balance || 0);
      if (b < 0) segments['Negativ']++;
      else if (b === 0) segments['0 kr']++;
      else if (b <= 20) segments['1–20 kr']++;
      else if (b <= 50) segments['21–50 kr']++;
      else if (b <= 100) segments['51–100 kr']++;
      else segments['100+ kr']++;
    });

    return Object.entries(segments).map(([segment, antal]) => ({ segment, antal }));
  } catch (err) {
    console.error('getBalanceDistribution', err);
    return [];
  }
}

// ═══════════════════════════════════════════════════
// RAPPORTER
// ═══════════════════════════════════════════════════

/** Komplet saldoliste. */
export async function getAllBalances(includeTestUsers = false) {
  try {
    return await fetchAllRows(() => {
      let q = supabaseClient
        .from('users')
        .select('name, number, balance')
        .eq('institution_id', instId())
        .eq('role', 'kunde');
      if (!includeTestUsers) q = q.or('is_test_user.eq.false,is_test_user.is.null');
      return q.order('name', { ascending: true });
    });
  } catch (err) {
    console.error('getAllBalances', err);
    return [];
  }
}

/** Negativ saldo. */
export async function getNegativeBalances(includeTestUsers = false) {
  try {
    return await fetchAllRows(() => {
      let q = supabaseClient
        .from('users')
        .select('name, number, balance')
        .eq('institution_id', instId())
        .eq('role', 'kunde')
        .lt('balance', 0);
      if (!includeTestUsers) q = q.or('is_test_user.eq.false,is_test_user.is.null');
      return q.order('balance', { ascending: true });
    });
  } catch (err) {
    console.error('getNegativeBalances', err);
    return [];
  }
}

// ═══════════════════════════════════════════════════
// GAMIFICATION
// ═══════════════════════════════════════════════════

/** Beregn Flango Level client-side. */
export function getLevel(salesCount, minutesWorked) {
  const hours = (minutesWorked || 0) / 60;
  if (salesCount >= 500 || hours >= 30) return '👑 Legendarisk';
  if (salesCount >= 300 || hours >= 18) return '⭐⭐⭐ Pro';
  if (salesCount >= 200 || hours >= 12) return '⭐⭐ Expert';
  if (salesCount >= 100 || hours >= 6) return '⭐ Øvet';
  return 'Nybegynder';
}

// ═══════════════════════════════════════════════════
// SALE ADJUSTMENT & UNDO
// ═══════════════════════════════════════════════════

/** Fortryd helt salg via RPC. Returnerer refunderet beløb. */
export async function undoSale(saleId) {
  const { data, error } = await supabaseClient.rpc('undo_sale', { p_sale_id: saleId });
  if (error) throw error;
  return data?.[0]?.refunded_amount ?? 0;
}

/** Registrér justering via RPC. delta < 0 = refund, > 0 = ekstra opkrævning. */
export async function registerSaleAdjustment(customerId, delta, payload) {
  const { error } = await supabaseClient.rpc('register_sale_adjustment', {
    p_customer_id: customerId,
    p_adjustment_amount: delta,
    p_payload: payload,
  });
  if (error) throw error;
}
