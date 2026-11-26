/* Desk US · assistant de séance SMC / AMD (US100 · SP500 en CFD, depuis Paris) */
(function () {
  'use strict';

  /* =========================================================
     Stockage
     ========================================================= */
  const K = { settings: 'td.settings', journal: 'td.journal', dayPrefix: 'td.day.' };
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); }
      catch (e) { return fallback; }
    },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* stockage indisponible */ } },
    del(key) { try { localStorage.removeItem(key); } catch (e) {} },
    keys() { try { return Object.keys(localStorage); } catch (e) { return []; } }
  };

  const DEFAULT_SETTINGS = {
    capital: 10000, risk: 1, rr: 2, maxTrades: 2, maxLoss: 2, newsBuf: 15, notif: false,
    riskBase: 'init',
    ftmo: { phase: 'challenge', daily: 5, max: 10, target: 10, init: 0 },
    instruments: {
      US100: { label: 'US100', symbol: 'OANDA:NAS100USD', mt5: 'US100.cash', ppv: 1, minLot: 0.1, lotStep: 0.1, buffer: 5 },
      SP500: { label: 'SP500', symbol: 'OANDA:SPX500USD', mt5: 'US500.cash', ppv: 1, minLot: 0.1, lotStep: 0.1, buffer: 1.5 }
    }
  };
  function loadSettings() {
    const s = store.get(K.settings, {});
    const out = Object.assign({}, DEFAULT_SETTINGS, s);
    out.ftmo = Object.assign({}, DEFAULT_SETTINGS.ftmo, s.ftmo || {});
    out.instruments = {};
    for (const k of Object.keys(DEFAULT_SETTINGS.instruments)) {
      out.instruments[k] = Object.assign({}, DEFAULT_SETTINGS.instruments[k], (s.instruments || {})[k] || {});
    }
    return out;
  }
  let S = loadSettings();
  const saveSettings = () => store.set(K.settings, S);

  /* =========================================================
     Fuseaux horaires (Paris / New York), sans librairie
     ========================================================= */
  const TZP = 'Europe/Paris', TZN = 'America/New_York';
  const fmtCache = {};
  function partsIn(tz, d) {
    const f = fmtCache[tz] || (fmtCache[tz] = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short'
    }));
    const o = {};
    for (const p of f.formatToParts(d)) o[p.type] = p.value;
    const wd = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[o.weekday];
    return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour % 24, mi: +o.minute, s: +o.second, wd };
  }
  function offsetMin(tz, d) {
    const p = partsIn(tz, d);
    return (Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(d.getTime() / 1000) * 1000) / 60000;
  }
  /** Instant correspondant à y-m-d hh:mm dans le fuseau tz */
  function zoned(tz, y, m, d, h, mi) {
    const t = Date.UTC(y, m - 1, d, h, mi);
    const off = offsetMin(tz, new Date(t));
    let r = t - off * 60000;
    const off2 = offsetMin(tz, new Date(r));
    if (off2 !== off) r = t - off2 * 60000;
    return new Date(r);
  }
  const pad = n => String(n).padStart(2, '0');
  const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
  function addDays(y, m, d, n) {
    const t = new Date(Date.UTC(y, m - 1, d + n));
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), wd: t.getUTCDay() };
  }
  const hm = (tz, date) => { const p = partsIn(tz, date); return `${pad(p.h)}:${pad(p.mi)}`; };
  const parisHM = date => hm(TZP, date);
  const nyHM = date => hm(TZN, date);
  const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const frDate = (y, m, d, wd) => `${JOURS[wd]} ${d} ${MOIS[m - 1]} ${y}`;

  /* =========================================================
     Calendrier NYSE : jours fériés et séances courtes
     ========================================================= */
  function wdOf(y, m, d) { return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); }
  function nthWeekday(y, m, wd, n) {
    const first = wdOf(y, m, 1);
    return 1 + ((wd - first + 7) % 7) + (n - 1) * 7;
  }
  function lastWeekday(y, m, wd) {
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const lw = wdOf(y, m, last);
    return last - ((lw - wd + 7) % 7);
  }
  function easter(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    return { m: Math.floor((h + l - 7 * m + 114) / 31), d: ((h + l - 7 * m + 114) % 31) + 1 };
  }
  const holidayCache = {};
  function nyseCalendar(y) {
    if (holidayCache[y]) return holidayCache[y];
    const hol = {}, early = {};
    const fixed = (m, d, name, isNewYear) => {
      const wd = wdOf(y, m, d);
      if (wd === 6) { if (!isNewYear) { const p = addDays(y, m, d, -1); hol[ymd(p.y, p.m, p.d)] = name + ' (observé)'; } }
      else if (wd === 0) { const p = addDays(y, m, d, 1); hol[ymd(p.y, p.m, p.d)] = name + ' (observé)'; }
      else hol[ymd(y, m, d)] = name;
    };
    fixed(1, 1, 'Jour de l\'an', true);
    hol[ymd(y, 1, nthWeekday(y, 1, 1, 3))] = 'Martin Luther King Day';
    hol[ymd(y, 2, nthWeekday(y, 2, 1, 3))] = 'Presidents\' Day';
    const e = easter(y); const gf = addDays(y, e.m, e.d, -2);
    hol[ymd(gf.y, gf.m, gf.d)] = 'Vendredi saint';
    hol[ymd(y, 5, lastWeekday(y, 5, 1))] = 'Memorial Day';
    if (y >= 2022) fixed(6, 19, 'Juneteenth');
    fixed(7, 4, 'Independence Day');
    hol[ymd(y, 9, nthWeekday(y, 9, 1, 1))] = 'Labor Day';
    const tg = nthWeekday(y, 11, 4, 4);
    hol[ymd(y, 11, tg)] = 'Thanksgiving';
    fixed(12, 25, 'Noël');
    // Séances courtes (clôture 13:00 NY)
    const j3 = wdOf(y, 7, 3); if (j3 >= 1 && j3 <= 4) early[ymd(y, 7, 3)] = 'Veille d\'Independence Day';
    early[ymd(y, 11, tg + 1)] = 'Lendemain de Thanksgiving';
    const d24 = wdOf(y, 12, 24); if (d24 >= 1 && d24 <= 4) early[ymd(y, 12, 24)] = 'Veille de Noël';
    return (holidayCache[y] = { hol, early });
  }
  const holidayOn = (y, m, d) => nyseCalendar(y).hol[ymd(y, m, d)] || null;
  const earlyOn = (y, m, d) => nyseCalendar(y).early[ymd(y, m, d)] || null;

  // Décisions FOMC 2026 (2e jour de réunion) — calendrier publié par la Fed, à confirmer.
  const FOMC = ['2026-01-28', '2026-03-18', '2026-04-29', '2026-06-17', '2026-07-29', '2026-09-16', '2026-10-28', '2026-12-09'];

  /* =========================================================
     Journée de trading : phases AMD et événements récurrents
     Les heures sont définies en heure de New York puis converties.
     ========================================================= */
  const PHASES = [
    { id: 'asia', code: 'A', name: 'Session asiatique', sub: 'Accumulation : marque le range (haut/bas d\'Asie)', from: [20, 0], to: [0, 0], prevDay: true, lane: 1, color: 'var(--asia)', short: 'Asie' },
    { id: 'midnight', code: 'A', name: 'Open de minuit NY', sub: 'Prix d\'ouverture de référence (Power of 3)', from: [0, 0], to: [0, 0], marker: true },
    { id: 'london', code: 'M', name: 'Killzone de Londres', sub: 'Manipulation : prise de liquidité d\'un côté du range asiatique', from: [2, 0], to: [5, 0], lane: 1, color: 'var(--london)', short: 'Londres' },
    { id: 'nyam', code: 'D', name: 'Killzone New York AM', sub: 'Pré-ouverture + news de 8:30 NY. Repère la manipulation du matin', from: [7, 0], to: [9, 30], lane: 1, color: 'var(--ny)', short: 'NY AM' },
    { id: 'open', code: 'M', name: 'Ouverture cash · Judas swing', sub: 'Faux départ fréquent à l\'ouverture : attends le sweep + MSS en M1', from: [9, 30], to: [10, 0], lane: 2, color: 'var(--london)', short: 'Open', trade: true },
    { id: 'sb', code: 'D', name: 'Silver Bullet NY', sub: 'Distribution : meilleure fenêtre d\'entrée M1 sur retracement', from: [10, 0], to: [11, 0], lane: 2, color: 'var(--ny)', short: 'SB', trade: true },
    { id: 'late', code: 'D', name: 'Fin de matinée', sub: 'Gestion des positions, objectifs de liquidité', from: [11, 0], to: [12, 0], lane: 2, color: 'var(--ny)', short: '11h', trade: true },
    { id: 'lunch', code: 'X', name: 'Pause déjeuner NY', sub: 'Faible volume, range : à éviter', from: [12, 0], to: [13, 30], lane: 2, color: 'var(--avoid)', short: 'Lunch' },
    { id: 'pm', code: 'D', name: 'Session PM', sub: 'Second Silver Bullet 14:00–15:00 NY, ou continuation', from: [13, 30], to: [16, 0], lane: 2, color: 'var(--ny)', short: 'PM', trade: true },
  ];
  const TRADE_WINDOW = { from: [9, 30], to: [16, 0] }; // fenêtre de trade pour la checklist

  function recurringFor(y, m, d, wd) {
    const list = [];
    if (wd === 0 || wd === 6 || holidayOn(y, m, d)) return list;
    const add = (h, mi, name, impact, note) => list.push({ ny: [h, mi], name, impact, note: note || '' });
    add(9, 30, 'Ouverture du marché cash (NYSE / Nasdaq)', 'med');
    const tomorrow = addDays(y, m, d, 1);
    if (wd === 4 || (wd === 3 && holidayOn(tomorrow.y, tomorrow.m, tomorrow.d) === 'Thanksgiving')) add(8, 30, 'Inscriptions hebdo au chômage', 'med', 'chaque semaine');
    if (wd === 3) { add(10, 30, 'Stocks de pétrole EIA', 'med', 'chaque mercredi'); }
    // premier vendredi du mois → NFP probable
    if (wd === 5 && d <= 7) add(8, 30, 'Rapport emploi NFP (probable)', 'high', '1er vendredi du mois');
    if (wd === 3 && d <= 7 && d >= 1) add(8, 15, 'ADP emploi privé (probable)', 'med');
    // jours ouvrés du mois
    let bd = 0;
    for (let i = 1; i <= d; i++) { const w = wdOf(y, m, i); if (w > 0 && w < 6 && !holidayOn(y, m, i)) bd++; }
    if (wd > 0 && wd < 6) {
      if (bd === 1) add(10, 0, 'ISM manufacturier (probable)', 'high', '1er jour ouvré');
      if (bd === 3) add(10, 0, 'ISM services (probable)', 'high', '3e jour ouvré');
    }
    if (FOMC.includes(ymd(y, m, d))) { add(14, 0, 'Décision de taux FOMC', 'high'); add(14, 30, 'Conférence de presse du président de la Fed', 'high'); }
    const early = earlyOn(y, m, d);
    add(early ? 13 : 16, 0, early ? 'Clôture anticipée du marché cash' : 'Clôture du marché cash', 'med');
    return list;
  }

  /* =========================================================
     État du jour
     ========================================================= */
  function nowParisDay() { const p = partsIn(TZP, new Date()); return { y: p.y, m: p.m, d: p.d, wd: p.wd }; }
  let DAY = nowParisDay();
  let dayKey = K.dayPrefix + ymd(DAY.y, DAY.m, DAY.d);
  const TF = ['D1', 'H4', 'H1', 'M15'];
  const TF_W = { D1: 3, H4: 2, H1: 1.5, M15: 1 };
  function freshDay() {
    // reprend le biais D1/H4 de la dernière journée enregistrée
    return { bias: { US100: {}, SP500: {} }, smt: '', fonda: '', levels: { US100: {}, SP500: {} }, events: [], removedAuto: [], checks: {}, notes: '' };
  }
  let D = Object.assign(freshDay(), store.get(dayKey, {}));
  const saveDay = () => store.set(dayKey, D);
  function lastStoredDayBefore(key) {
    return store.keys().filter(k => k.startsWith(K.dayPrefix) && k < key).sort().pop();
  }

  function buildDayModel() {
    const { y, m, d, wd } = DAY;
    const prev = addDays(y, m, d, -1);
    const phases = PHASES.map(p => {
      const base = p.prevDay ? prev : { y, m, d };
      const start = zoned(TZN, base.y, base.m, base.d, p.from[0], p.from[1]);
      let end;
      if (p.marker) end = start;
      else if (p.prevDay && p.to[0] === 0) end = zoned(TZN, y, m, d, 0, 0);
      else end = zoned(TZN, y, m, d, p.to[0], p.to[1]);
      return Object.assign({}, p, { start, end });
    });
    const closed = wd === 0 || wd === 6 || !!holidayOn(y, m, d);
    if (closed) phases.forEach(p => { p.cancelled = true; });
    const early = earlyOn(y, m, d);
    if (early) {
      const close = zoned(TZN, y, m, d, 13, 0);
      phases.forEach(p => { if (p.start >= close) p.cancelled = true; else if (p.end > close) p.end = close; });
    }
    const auto = recurringFor(y, m, d, wd)
      .map(e => ({ id: 'auto:' + e.name, auto: true, name: e.name, impact: e.impact, note: e.note, at: zoned(TZN, y, m, d, e.ny[0], e.ny[1]) }))
      .filter(e => !(D.removedAuto || []).includes(e.id));
    const manual = (D.events || []).map(e => {
      const [hh, mm] = e.time.split(':').map(Number);
      return { id: e.id, auto: false, name: e.name, impact: e.impact, at: zoned(TZP, y, m, d, hh, mm) };
    });
    const events = auto.concat(manual).sort((a, b) => a.at - b.at);
    return { phases, events, holiday: holidayOn(y, m, d), early, weekend: wd === 0 || wd === 6 };
  }
  let MODEL = buildDayModel();

  /* =========================================================
     Utilitaires DOM
     ========================================================= */
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = v => { if (v === '' || v == null) return NaN; return parseFloat(String(v).replace(',', '.')); };
  const fmtP = v => isFinite(v) ? (Math.round(v * 100) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '—';
  let CUR = store.get('td.cur', 'EUR');
  const fmtE = v => { if (!isFinite(v)) return '—'; try { return v.toLocaleString('fr-FR', { style: 'currency', currency: CUR, maximumFractionDigits: 2 }); } catch (e) { return v.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' ' + CUR; } };
  const fmtR = v => isFinite(v) ? (v > 0 ? '+' : '') + v.toFixed(2).replace('.', ',') + ' R' : '—';
  const pct = v => (v * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' %';
  const dur = ms => {
    const t = Math.max(0, Math.round(ms / 1000)); const h = Math.floor(t / 3600), mi = Math.floor((t % 3600) / 60), s = t % 60;
    return h ? `${h} h ${pad(mi)}` : `${mi} min ${pad(s)} s`;
  };

  /* =========================================================
     Onglets
     ========================================================= */
  const mounted = {};
  function showTab(name) {
    $$('nav.tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
    $$('section.tab').forEach(s => s.classList.toggle('active', s.id === 'tab-' + name));
    try { sessionStorage.setItem('td.tab', name); } catch (e) {}
    if (name === 'graph' && !mounted.graph) { mounted.graph = true; mountGraph(); }
    if (name === 'fonda' && !mounted.fonda) { mounted.fonda = true; mountFonda(); }
    if (name === 'journal') renderJournal();
    if (name === 'plan') renderPlan();
  }
  $$('nav.tabs button').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));

  /* =========================================================
     Widgets TradingView
     ========================================================= */
  function tv(el, widget, config) {
    if (typeof el === 'string') el = document.getElementById(el);
    if (!el) return;
    el.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'tradingview-widget-container';
    wrap.style.height = '100%'; wrap.style.width = '100%';
    const inner = document.createElement('div');
    inner.className = 'tradingview-widget-container__widget';
    inner.style.height = '100%'; inner.style.width = '100%';
    wrap.appendChild(inner);
    const sc = document.createElement('script');
    sc.type = 'text/javascript'; sc.async = true;
    sc.src = `https://s3.tradingview.com/external-embedding/embed-widget-${widget}.js`;
    sc.text = JSON.stringify(config);
    sc.onerror = () => { el.innerHTML = '<div class="tv-placeholder">Widget TradingView indisponible (connexion ou bloqueur de publicité).</div>'; };
    wrap.appendChild(sc);
    el.appendChild(wrap);
  }
  const TV_BASE = { colorTheme: 'dark', isTransparent: true, locale: 'fr' };
  // Les widgets « jauge » et « bandeau » n'acceptent que certains flux : FOREXCOM est autorisé
  const TV_WIDGET_SYM = { US100: 'FOREXCOM:NSXUSD', SP500: 'FOREXCOM:SPXUSD' };
  const chartInterval = { US100: '15', SP500: '15' };
  const INTERVALS = [['1', 'M1'], ['5', 'M5'], ['15', 'M15'], ['60', 'H1'], ['240', 'H4'], ['D', 'D1']];
  function mountChart(k) {
    tv('tvChart' + k, 'advanced-chart', {
      autosize: true, symbol: S.instruments[k].symbol, interval: chartInterval[k], timezone: 'Europe/Paris',
      theme: 'dark', style: '1', locale: 'fr', allow_symbol_change: true, calendar: false,
      hide_volume: true, support_host: 'https://www.tradingview.com', backgroundColor: 'rgba(16,18,22,1)',
      gridColor: 'rgba(244,243,239,0.05)'
    });
  }
  function mountGraph() {
    tv('tvTape', 'ticker-tape', Object.assign({}, TV_BASE, {
      symbols: [
        { proName: TV_WIDGET_SYM.US100, title: 'US100' },
        { proName: TV_WIDGET_SYM.SP500, title: 'SP500' },
        { proName: 'TVC:VIX', title: 'VIX' },
        { proName: 'TVC:DXY', title: 'Dollar (DXY)' },
        { proName: 'TVC:US10Y', title: 'Taux US 10 ans' },
        { proName: 'TVC:US02Y', title: 'Taux US 2 ans' },
        { proName: 'OANDA:XAUUSD', title: 'Or' }
      ], showSymbolLogo: false, displayMode: 'adaptive'
    }));
    for (const k of ['US100', 'SP500']) {
      const seg = $(`.seg[data-chart="${k}"]`);
      seg.innerHTML = INTERVALS.map(([v, l]) => `<button data-v="${v}" class="${v === chartInterval[k] ? 'on' : ''}">${l}</button>`).join('');
      seg.onclick = ev => {
        const b = ev.target.closest('button'); if (!b) return;
        chartInterval[k] = b.dataset.v;
        $$('button', seg).forEach(x => x.classList.toggle('on', x === b));
        mountChart(k);
      };
      mountChart(k);
      tv('tvTa' + k, 'technical-analysis', Object.assign({}, TV_BASE, {
        interval: '1h', width: '100%', height: '100%', symbol: TV_WIDGET_SYM[k], showIntervalTabs: true, displayMode: 'multiple'
      }));
    }
  }
  function mountFonda() {
    const mini = (id, symbol) => tv(id, 'advanced-chart', {
      autosize: true, symbol, interval: '60', timezone: 'Europe/Paris', theme: 'dark', style: '3', locale: 'fr',
      hide_top_toolbar: true, hide_side_toolbar: true, allow_symbol_change: false, save_image: false, calendar: false,
      hide_volume: true, support_host: 'https://www.tradingview.com', backgroundColor: 'rgba(16,18,22,1)', gridColor: 'rgba(244,243,239,0.05)'
    });
    mini('tvMiniVIX', 'TVC:VIX'); mini('tvMiniDXY', 'TVC:DXY'); mini('tvMiniUS10Y', 'TVC:US10Y');
    tv('tvCalendar', 'events', Object.assign({}, TV_BASE, { width: '100%', height: '100%', importanceFilter: '0,1', countryFilter: 'us' }));
    tv('tvNews', 'timeline', Object.assign({}, TV_BASE, { feedMode: 'market', market: 'index', displayMode: 'regular', width: '100%', height: '100%' }));
    renderFonda();
  }

  /* =========================================================
     Barre du haut + alertes + timeline (rafraîchies chaque seconde)
     ========================================================= */
  function setPill(el, cls, text) { el.className = 'pill ' + cls; el.lastElementChild.textContent = text; }

  function marketState(now) {
    if (MODEL.weekend) return { cls: 'off', text: 'Week-end · marché fermé' };
    if (MODEL.holiday) return { cls: 'danger', text: 'Férié US · ' + MODEL.holiday };
    const { y, m, d } = DAY;
    const open = zoned(TZN, y, m, d, 9, 30), close = zoned(TZN, y, m, d, MODEL.early ? 13 : 16, 0);
    const pre = zoned(TZN, y, m, d, 4, 0);
    if (now >= open && now < close) return { cls: 'live', text: 'Cash ouvert' + (MODEL.early ? ' (séance courte)' : '') };
    if (now >= pre && now < open) return { cls: 'warn', text: 'Pré-ouverture · cash à ' + parisHM(open) };
    if (now >= close) return { cls: 'off', text: 'Cash fermé' };
    return { cls: 'off', text: 'Avant pré-marché' };
  }
  function currentPhase(now) {
    return MODEL.phases.filter(p => !p.marker && !p.cancelled && now >= p.start && now < p.end).pop() || null;
  }

  function newsNear(now) {
    const buf = S.newsBuf * 60000;
    return MODEL.events.filter(e => e.impact === 'high' && Math.abs(e.at - now) <= buf);
  }

  let lastAlertsHtml = '';
  function renderAlerts(now) {
    const out = [];
    const { y, m, d } = DAY;
    if (MODEL.weekend) out.push(['', 'Week-end : les marchés cash US sont fermés. Profites-en pour revoir ton journal et préparer le biais hebdo.']);
    if (MODEL.holiday) out.push(['danger', `Jour férié aux États-Unis (${esc(MODEL.holiday)}) : marché cash fermé, liquidité très faible sur les CFD. Pas de trade aujourd'hui.`]);
    if (MODEL.early) out.push(['warn', `Séance courte (${esc(MODEL.early)}) : clôture du cash à 13:00 NY, soit ${parisHM(zoned(TZN, y, m, d, 13, 0))} à Paris. Volumes faibles.`]);
    const gap = offsetMin(TZP, now) - offsetMin(TZN, now);
    if (!MODEL.weekend && !MODEL.holiday && gap !== 360) out.push(['warn', `Semaine de décalage d'heure d'été : New York n'est qu'à ${gap / 60} h de Paris. Ouverture du cash à ${parisHM(zoned(TZN, y, m, d, 9, 30))} et news de 8:30 NY à ${parisHM(zoned(TZN, y, m, d, 8, 30))} à Paris.`]);
    if (FOMC.includes(ymd(y, m, d))) out.push(['warn', `Jour de FOMC : décision à ${parisHM(zoned(TZN, y, m, d, 14, 0))} Paris. Le mouvement du matin est souvent une manipulation ; prudence avant la décision.`]);
    const near = newsNear(now);
    near.forEach(e => {
      const diff = e.at - now;
      out.push(['danger', diff > 0 ? `News à fort impact dans ${dur(diff)} : ${esc(e.name)} (${parisHM(e.at)}). Pas de nouvelle entrée.` : `News à fort impact publiée il y a ${dur(-diff)} : ${esc(e.name)}. Attends que la volatilité retombe.`]);
    });
    const st = dayStats();
    if (st.count >= S.maxTrades) out.push(['danger', `Limite de ${S.maxTrades} trade(s) atteinte aujourd'hui. Séance terminée.`]);
    if (st.r <= -S.maxLoss) out.push(['danger', `Perte maximale du jour atteinte (${fmtR(st.r)}). On coupe et on revient demain.`]);
    liveAlerts(now).forEach(a => out.push(a));
    const html = out.map(([c, t]) => `<div class="alert ${c}">${t}</div>`).join('');
    if (html !== lastAlertsHtml) { $('#alerts').innerHTML = html; lastAlertsHtml = html; }
  }

  function renderTimeline(now) {
    const { y, m, d } = DAY;
    const t0 = zoned(TZP, y, m, d, 0, 0).getTime();
    const next = addDays(y, m, d, 1);
    const t1 = zoned(TZP, next.y, next.m, next.d, 0, 0).getTime();
    const span = t1 - t0;
    const x = t => ((t - t0) / span * 100);
    let html = '';
    MODEL.phases.forEach(p => {
      if (p.marker || p.cancelled) return;
      const l = Math.max(0, x(p.start)), r = Math.min(100, x(p.end));
      if (r <= l) return;
      html += `<div class="tl-block lane${p.lane}" style="left:${l}%;width:${r - l}%;background:${p.color}" title="${esc(p.name)} ${parisHM(p.start)}–${parisHM(p.end)}">${esc(p.short)}</div>`;
    });
    MODEL.events.forEach(e => {
      if (e.impact === 'high' || !e.auto) html += `<div class="tl-ev ${e.impact === 'high' ? '' : 'med'}" style="left:${x(e.at)}%" title="${parisHM(e.at)} ${esc(e.name)}"></div>`;
    });
    if (now.getTime() >= t0 && now.getTime() < t1) html += `<div class="tl-now" style="left:${x(now)}%" data-t="${parisHM(now)}"></div>`;
    html += '<div class="tl-axis">' + [0, 3, 6, 9, 12, 15, 18, 21, 24].map(h => `<span style="left:${h / 24 * 100}%">${pad(h)}h</span>`).join('') + '</div>';
    $('#timeline').innerHTML = html;
  }

  function renderPhases(now) {
    if (MODEL.weekend) { $('#phases').innerHTML = '<p class="muted" style="margin:0">Week-end : pas de séance. La session asiatique reprend dimanche soir.</p>'; return; }
    $('#phases').innerHTML = MODEL.phases.map(p => {
      const st = p.cancelled ? 'past' : p.marker ? (now >= p.start ? 'past' : '') : now >= p.end ? 'past' : now >= p.start ? 'now' : '';
      const time = p.marker ? parisHM(p.start) : `${parisHM(p.start)}–${parisHM(p.end)}`;
      const label = p.cancelled ? 'annulé' : st === 'now' ? 'en cours' : st === 'past' ? 'terminé' : 'à venir';
      return `<div class="phase ${st}"><span class="t">${time}</span><span class="n"><span class="tag ${p.code}">${p.code}</span> ${esc(p.name)}<small>${esc(p.sub)}</small></span><span class="muted" style="font-size:12px">${label}</span></div>`;
    }).join('');
  }

  const notified = new Set();
  function notify(now) {
    if (!S.notif || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const items = MODEL.phases.filter(p => !p.marker && !p.cancelled).map(p => ({ k: 'p' + p.id, at: p.start, t: `${p.name} à ${parisHM(p.start)}` }))
      .concat(MODEL.events.map(e => ({ k: 'e' + e.id, at: e.at, t: `${e.impact === 'high' ? 'News forte' : 'News'} : ${e.name} à ${parisHM(e.at)}` })));
    items.forEach(it => {
      const diff = it.at - now;
      const key = ymd(DAY.y, DAY.m, DAY.d) + it.k;
      if (diff > 0 && diff <= 5 * 60000 && !notified.has(key)) {
        notified.add(key);
        try { new Notification('Desk US · dans 5 minutes', { body: it.t }); } catch (e) {}
      }
    });
  }

  let lastMinute = -1;
  function tick() {
    const now = new Date();
    // changement de jour à minuit Paris
    const pd = nowParisDay();
    if (pd.d !== DAY.d || pd.m !== DAY.m || pd.y !== DAY.y) { switchDay(pd); }
    const pp = partsIn(TZP, now);
    $('#clkParis').textContent = `${pad(pp.h)}:${pad(pp.mi)}:${pad(pp.s)}`;
    $('#clkNY').textContent = nyHM(now);
    const ms = marketState(now);
    setPill($('#pillMarket'), ms.cls, ms.text);
    const cp = currentPhase(now);
    setPill($('#pillPhase'), cp ? (cp.code === 'X' ? 'off' : 'warn') : 'off', cp ? cp.name : 'Hors session');
    // prochain repère
    const upcoming = MODEL.phases.filter(p => !p.marker && !p.cancelled).map(p => ({ at: p.start, name: p.name }))
      .concat(MODEL.events.map(e => ({ at: e.at, name: e.name })))
      .filter(x => x.at > now).sort((a, b) => a.at - b.at)[0];
    $('#countdown').textContent = upcoming && !MODEL.weekend ? `${upcoming.name} dans ${dur(upcoming.at - now)}` : '';
    renderAlerts(now);
    if (pp.mi !== lastMinute) { lastMinute = pp.mi; renderTimeline(now); renderPhases(now); renderEvents(); renderChecklist(); }
    notify(now);
  }

  function switchDay(pd) {
    DAY = pd;
    dayKey = K.dayPrefix + ymd(DAY.y, DAY.m, DAY.d);
    D = Object.assign(freshDay(), store.get(dayKey, {}));
    if (!store.get(dayKey, null)) carryBias();
    MODEL = buildDayModel();
    renderSeance();
  }

  /* =========================================================
     Biais
     ========================================================= */
  const BIAS_OPTS = [['bull', 'Haussier', '▲'], ['range', 'Range', '▬'], ['bear', 'Baissier', '▼']];
  function carryBias() {
    const prevKey = lastStoredDayBefore(dayKey);
    if (!prevKey) return false;
    const prev = store.get(prevKey, null);
    if (!prev || !prev.bias) return false;
    for (const k of ['US100', 'SP500']) { D.bias[k] = { D1: (prev.bias[k] || {}).D1, H4: (prev.bias[k] || {}).H4 }; }
    saveDay();
    return true;
  }
  function renderBias() {
    $('#biasBody').innerHTML = TF.map(tf => `<tr><td class="mono">${tf}</td>` + ['US100', 'SP500'].map(k => {
      const cur = (D.bias[k] || {})[tf];
      return `<td><span class="seg" data-k="${k}" data-tf="${tf}">` + BIAS_OPTS.map(([v, l, ic]) => `<button data-v="${v}" title="${l}" aria-label="${k} ${tf} ${l}" class="${cur === v ? 'on ' + v : ''}"><span class="lg">${l}</span><span class="sm">${ic}</span></button>`).join('') + '</span></td>';
    }).join('') + '</tr>').join('');
    $('#smt').value = D.smt || '';
    $('#fondaSent').value = D.fonda || '';
    renderVerdict();
  }
  function biasScore(k) {
    const b = D.bias[k] || {};
    let s = 0, w = 0, filled = 0;
    TF.forEach(tf => { const v = b[tf]; if (!v) return; filled++; w += TF_W[tf]; s += TF_W[tf] * (v === 'bull' ? 1 : v === 'bear' ? -1 : 0); });
    return { score: w ? s / w : 0, filled, htf: b.D1 && b.H4 ? (b.D1 === b.H4 ? b.D1 : 'mixed') : null };
  }
  function overallBias() {
    const a = biasScore('US100'), b = biasScore('SP500');
    // 80 % structure, 10 % SMT, 10 % sentiment : 100 % seulement si tout est aligné
    const sig = v => v === 'bull' ? 1 : v === 'bear' ? -1 : 0;
    let s = 0.8 * (a.score + b.score) / 2 + 0.1 * sig(D.smt) + 0.1 * sig(D.fonda);
    s = Math.max(-1, Math.min(1, s));
    const dir = s >= 0.35 ? 'bull' : s <= -0.35 ? 'bear' : 'range';
    return { s, dir, a, b };
  }
  function renderVerdict() {
    const o = overallBias();
    const anyFilled = o.a.filled + o.b.filled > 0;
    if (!anyFilled) { $('#verdict').innerHTML = '<div class="verdict muted">Renseigne au moins le D1 et le H4 pour obtenir le biais du jour.</div>'; return; }
    const words = { bull: 'HAUSSIER', bear: 'BAISSIER', range: 'NEUTRE / RANGE' };
    const conv = Math.round(Math.abs(o.s) * 100);
    const plan = {
      bull: 'Cherche des <b>achats</b> en discount : attends que le prix prenne la liquidité sous un bas (bas d\'Asie, de Londres, ou sous l\'open de minuit), puis un MSS haussier en M1 et une entrée sur retracement 50–68 %.',
      bear: 'Cherche des <b>ventes</b> en premium : attends que le prix prenne la liquidité au-dessus d\'un haut (haut d\'Asie, de Londres, ou au-dessus de l\'open de minuit), puis un MSS baissier en M1 et une entrée sur retracement 50–68 %.',
      range: 'Biais peu clair : réduis la taille ou reste dehors. Ne trade que si un sweep net du range et un displacement fort donnent la direction.'
    }[o.dir];
    const per = k => { const sc = biasScore(k); const v = sc.score >= 0.35 ? 'bull' : sc.score <= -0.35 ? 'bear' : 'range'; return `<span class="tag ${v}">${k} ${words[v].split(' ')[0].toLowerCase()}</span>`; };
    const diverge = (o.a.score > 0.35 && o.b.score < -0.35) || (o.a.score < -0.35 && o.b.score > 0.35);
    $('#verdict').innerHTML = `<div class="verdict">Biais du jour : <b class="${o.dir}">${words[o.dir]}</b> · conviction ${conv} % ${per('US100')} ${per('SP500')}
      <div class="meter"><i style="width:${conv}%;background:var(--${o.dir === 'bull' ? 'bull' : o.dir === 'bear' ? 'bear' : 'range'})"></i></div>
      <p style="margin:8px 0 0">${plan}</p>${diverge ? '<p style="margin:6px 0 0;color:var(--accent)">Les deux indices divergent : prudence, ou trade celui qui est le plus propre.</p>' : ''}</div>`;
  }
  $('#biasBody').addEventListener('click', ev => {
    const btn = ev.target.closest('button'); if (!btn) return;
    const seg = btn.closest('.seg'); const k = seg.dataset.k, tf = seg.dataset.tf;
    D.bias[k] = D.bias[k] || {};
    D.bias[k][tf] = D.bias[k][tf] === btn.dataset.v ? undefined : btn.dataset.v;
    saveDay(); renderBias(); renderChecklist();
  });
  $('#smt').addEventListener('change', e => { D.smt = e.target.value; saveDay(); renderVerdict(); });
  $('#fondaSent').addEventListener('change', e => { D.fonda = e.target.value; saveDay(); renderVerdict(); });
  $('#biasCopy').addEventListener('click', () => {
    if (!carryBias()) { alert('Aucune journée précédente enregistrée.'); return; }
    renderBias();
  });

  /* =========================================================
     Niveaux clés
     ========================================================= */
  const LEVELS = [
    ['pdh', 'Haut de la veille (PDH)'], ['pdl', 'Bas de la veille (PDL)'],
    ['ah', 'Haut d\'Asie'], ['al', 'Bas d\'Asie'],
    ['lh', 'Haut de Londres'], ['ll', 'Bas de Londres'],
    ['mo', 'Open de minuit NY'], ['o930', 'Open 9:30 NY'],
    ['px', 'Prix actuel']
  ];
  let lvlInstr = 'US100';
  function levelsFor(k) {
    if (D.levelsAuto !== false) { const a = autoLevels(k); if (a) return a; }
    return D.levels[k] || {};
  }
  function renderLevels() {
    D.levels[lvlInstr] = D.levels[lvlInstr] || {};
    const auto = D.levelsAuto !== false && !!autoLevels(lvlInstr);
    const L = levelsFor(lvlInstr);
    const v = x => x != null && x !== '' && isFinite(num(x)) ? +num(x) : '';
    $('#lvlAuto').checked = D.levelsAuto !== false;
    $('#lvlAutoWrap').hidden = !LIVE.key;
    $('#lvlGrid').innerHTML = LEVELS.map(([k, l]) => `<label class="f">${l}<input type="number" step="any" inputmode="decimal" data-lvl="${k}" value="${v(L[k])}" ${auto ? 'readonly title="Valeur lue dans MT5"' : ''}></label>`).join('');
    renderPD();
  }
  function refreshLevelValues() {
    if (D.levelsAuto === false || !autoLevels(lvlInstr)) return;
    const L = levelsFor(lvlInstr);
    $$('#lvlGrid input').forEach(inp => { const x = L[inp.dataset.lvl]; const val = x != null && isFinite(num(x)) ? String(+num(x)) : ''; if (inp.value !== val) inp.value = val; });
    renderPD();
  }
  function renderPD() {
    const L = levelsFor(lvlInstr);
    const px = num(L.px);
    // Range de référence : veille si dispo, sinon Asie
    let hi = num(L.pdh), lo = num(L.pdl), src = 'range de la veille';
    if (!(hi > lo)) { hi = num(L.ah); lo = num(L.al); src = 'range asiatique'; }
    if (!(hi > lo) || !isFinite(px)) {
      $('#pdBox').innerHTML = '<span class="muted">Renseigne un range (veille ou Asie) et le prix actuel pour savoir si tu es en premium ou en discount.</span>';
      return;
    }
    const eq = (hi + lo) / 2, pos = (px - lo) / (hi - lo);
    const zone = px > eq ? '<b style="color:var(--bear)">PREMIUM</b> (zone de vente)' : '<b style="color:var(--bull)">DISCOUNT</b> (zone d\'achat)';
    const mo = num(L.mo);
    const moTxt = isFinite(mo) ? ` · prix ${px >= mo ? 'au-dessus' : 'en dessous'} de l'open de minuit (${fmtP(mo)})` : '';
    const clamp = Math.max(0, Math.min(1, pos));
    $('#pdBox').innerHTML = `Sur le ${src} : ${zone} · équilibre ${fmtP(eq)} · position ${Math.round(pos * 100)} %${moTxt}
      <div class="pdbar"><span style="left:6px">Discount</span><span style="right:6px">Premium</span><i style="left:calc(${clamp * 100}% - 1px)"></i></div>`;
  }
  $('#lvlAuto').addEventListener('change', ev => { D.levelsAuto = ev.target.checked; saveDay(); renderLevels(); });
  $('#lvlGrid').addEventListener('input', ev => {
    const k = ev.target.dataset.lvl; if (!k || ev.target.readOnly) return;
    D.levels[lvlInstr][k] = ev.target.value === '' ? null : ev.target.value;
    saveDay(); renderPD();
  });
  $('#lvlInstr').addEventListener('click', ev => {
    const b = ev.target.closest('button'); if (!b) return;
    lvlInstr = b.dataset.v; $$('#lvlInstr button').forEach(x => x.classList.toggle('on', x === b)); renderLevels();
  });

  /* =========================================================
     Événements du jour
     ========================================================= */
  function renderEvents() {
    const now = new Date();
    $('#evBody').innerHTML = MODEL.events.length ? MODEL.events.map(e => `<tr style="${e.at < now ? 'opacity:.5' : ''}">
      <td class="mono">${parisHM(e.at)}</td>
      <td><span class="tag ${e.impact === 'high' ? 'N' : 'D'}">${e.impact === 'high' ? 'FORT' : 'MOY'}</span></td>
      <td>${esc(e.name)}${e.auto ? ' <span class="muted" style="font-size:12px">· auto</span>' : ''}</td>
      <td style="text-align:right"><button class="btn small" data-del="${esc(e.id)}" title="Retirer">✕</button></td></tr>`).join('')
      : '<tr><td class="muted">Aucun événement.</td></tr>';
  }
  $('#evBody').addEventListener('click', ev => {
    const b = ev.target.closest('[data-del]'); if (!b) return;
    const id = b.dataset.del;
    if (id.startsWith('auto:')) { D.removedAuto = (D.removedAuto || []).concat(id); }
    else D.events = D.events.filter(e => e.id !== id);
    saveDay(); MODEL = buildDayModel(); renderEvents(); lastMinute = -1; tick();
  });
  $('#evAddBtn').addEventListener('click', () => { $('#evForm').hidden = false; $('#evTime').value = '14:30'; $('#evName').focus(); });
  $('#evCancel').addEventListener('click', () => { $('#evForm').hidden = true; });
  $('#evSave').addEventListener('click', () => {
    const time = $('#evTime').value, name = $('#evName').value.trim();
    if (!time || !name) return;
    D.events.push({ id: 'm' + Date.now(), time, name, impact: $('#evImpact').value });
    saveDay(); MODEL = buildDayModel(); $('#evForm').hidden = true; $('#evName').value = '';
    renderEvents(); lastMinute = -1; tick();
  });

  /* =========================================================
     Checklist
     ========================================================= */
  const CHECKS = [
    { id: 'htf', label: 'Biais HTF (D1 + H4) défini et aligné avec le sens du trade', req: true, auto: () => { const o = overallBias(); return o.a.filled + o.b.filled ? o.dir !== 'range' : null; } },
    { id: 'acc', label: 'Range d\'accumulation marqué (Asie / pré-ouverture)', req: false },
    { id: 'man', label: 'Manipulation : liquidité prise (sweep d\'un haut/bas, Judas swing)', req: true },
    { id: 'mss', label: 'Displacement + MSS / CHoCH en M1–M5 dans le sens du biais', req: true },
    { id: 'fib', label: 'Entrée sur retracement ≥ 50 % (idéal 61,8–68 %), en discount (achat) ou premium (vente), avec FVG ou OB dans la zone', req: true },
    { id: 'rr', label: 'SL derrière le swing de manipulation, RR ≥ 2:1 vers une liquidité opposée', req: true, auto: () => lastPlan ? lastPlan.rr >= 2 - 1e-9 : null },
    { id: 'news', label: 'Aucune news rouge dans la zone d\'exclusion', req: true, auto: () => newsNear(new Date()).length === 0 },
    { id: 'time', label: 'Dans la fenêtre de trade NY (ouverture → clôture cash, hors pause déjeuner)', req: false, auto: () => { const now = new Date(); const cp = currentPhase(now); return !!(cp && cp.trade); } },
    { id: 'smt', label: 'SMT US100 / SP500 qui confirme (bonus)', req: false },
    { id: 'lim', label: 'Limites du jour respectées (nombre de trades, perte max)', req: true, auto: () => { const s = dayStats(); return s.count < S.maxTrades && s.r > -S.maxLoss; } }
  ];
  function renderChecklist() {
    let okReq = true, done = 0;
    $('#checklist').innerHTML = CHECKS.map(c => {
      const a = c.auto ? c.auto() : null;
      const checked = a === null || a === undefined ? !!D.checks[c.id] : (a && (D.checks[c.id] !== false));
      const forcedOff = a === false;
      const val = forcedOff ? false : checked;
      if (val) done++;
      if (c.req && !val) okReq = false;
      const badge = a === null || a === undefined ? '' : `<span class="auto ${a ? 'ok' : 'ko'}">auto : ${a ? 'OK' : 'NON'}</span>`;
      return `<label class="chk"><input type="checkbox" data-chk="${c.id}" ${val ? 'checked' : ''} ${forcedOff ? 'disabled' : ''}><span>${esc(c.label)}${c.req ? '<span class="req">obligatoire</span>' : ''}${badge}</span></label>`;
    }).join('');
    $('#goBox').innerHTML = okReq
      ? `<div class="go yes">FEU VERT · ${done}/${CHECKS.length} critères · exécute ton plan, rien de plus</div>`
      : `<div class="go no">PAS D'ENTRÉE · il manque des critères obligatoires</div>`;
  }
  $('#checklist').addEventListener('change', ev => {
    const id = ev.target.dataset.chk; if (!id) return;
    D.checks[id] = ev.target.checked; saveDay(); renderChecklist();
  });
  $('#chkReset').addEventListener('click', () => { D.checks = {}; saveDay(); renderChecklist(); });

  /* =========================================================
     Journal
     ========================================================= */
  let J = store.get(K.journal, []);
  const saveJ = () => store.set(K.journal, J);
  const todayStr = () => ymd(DAY.y, DAY.m, DAY.d);
  function dayStats() {
    const t = allTrades().filter(x => x.date === todayStr());
    const closed = t.filter(x => x.outcome !== 'OPEN');
    const riskE = capitalBase() * S.risk / 100;
    const eur = closed.reduce((a, x) => a + (x.net != null ? x.net : (num(x.r) || 0) * riskE), 0);
    return { count: t.length, r: closed.reduce((a, x) => a + (num(x.r) || 0), 0), eur, wins: closed.filter(x => num(x.r) > 0).length };
  }
  function renderSessionStats() {
    const s = dayStats();
    const riskE = capitalBase() * S.risk / 100;
    $('#sessionStats').innerHTML = `
      <div class="kpi"><small>Trades aujourd'hui</small><b>${s.count} / ${S.maxTrades}</b></div>
      <div class="kpi"><small>Résultat du jour</small><b class="${s.r > 0 ? 'bull' : s.r < 0 ? 'bear' : ''}">${fmtR(s.r)}</b></div>
      <div class="kpi"><small>Montant</small><b class="${s.eur > 0 ? 'bull' : s.eur < 0 ? 'bear' : ''}">${fmtE(s.eur)}</b></div>
      <div class="kpi"><small>Risque par trade</small><b>${fmtE(riskE)}</b></div>`;
  }
  const PHASE_OPTS = PHASES.filter(p => !p.marker).map(p => [p.id, p.name]).concat([['other', 'Autre']]);
  $('#jPhase').innerHTML = PHASE_OPTS.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('');
  let editId = null;
  function plannedR(entry, sl, tp) {
    const e = num(entry), s = num(sl), t = num(tp);
    if (![e, s, t].every(isFinite) || e === s) return NaN;
    return Math.abs(t - e) / Math.abs(e - s);
  }
  function autoR() {
    const o = $('#jOutcome').value;
    if (o === 'TP') { const r = plannedR($('#jEntry').value, $('#jSL').value, $('#jTP').value); $('#jR').value = isFinite(r) ? r.toFixed(2) : S.rr; }
    else if (o === 'SL') $('#jR').value = -1;
    else if (o === 'BE') $('#jR').value = 0;
    else if (o === 'OPEN') $('#jR').value = '';
    $('#jR').readOnly = o !== 'MAN';
  }
  ['#jOutcome', '#jEntry', '#jSL', '#jTP'].forEach(s => $(s).addEventListener('input', autoR));
  function clearJForm() {
    editId = null; $('#jFormTitle').textContent = 'Nouveau trade';
    const now = new Date();
    $('#jDate').value = todayStr(); $('#jTime').value = parisHM(now);
    ['#jEntry', '#jSL', '#jTP', '#jLots', '#jNotes'].forEach(s => { $(s).value = ''; });
    $('#jOutcome').value = 'OPEN'; $('#jRule').value = '1';
    const cp = currentPhase(now); $('#jPhase').value = cp ? cp.id : 'sb';
    setJFormMode(false);
    autoR();
  }
  function setJFormMode(isMt5) {
    ['#jDate', '#jTime', '#jInstr', '#jDir', '#jEntry', '#jSL', '#jTP', '#jLots', '#jOutcome', '#jR'].forEach(sel => { $(sel).disabled = isMt5; });
    $('#jMt5Note').hidden = !isMt5;
  }
  function fillJForm(t) {
    setJFormMode(t.src === 'mt5');
    $('#jDate').value = t.date; $('#jTime').value = t.time; $('#jInstr').value = t.instr; $('#jDir').value = t.dir;
    $('#jPhase').value = t.phase; $('#jFib').value = t.fib; $('#jEntry').value = t.entry; $('#jSL').value = t.sl; $('#jTP').value = t.tp;
    $('#jLots').value = t.lots; $('#jOutcome').value = t.outcome; $('#jR').value = t.r; $('#jRule').value = t.rule; $('#jNotes').value = t.notes || '';
    $('#jR').readOnly = t.outcome !== 'MAN';
  }
  $('#jSave').addEventListener('click', async () => {
    if (editId && editId.startsWith('mt5:')) {
      const row = LIVE.trades.find(x => 'mt5:' + x.data.id === editId);
      if (!row) return;
      const annot = Object.assign({}, row.annot, { phase: $('#jPhase').value, fib: $('#jFib').value, rule: $('#jRule').value, notes: $('#jNotes').value });
      try { await rpc('desk_annotate', { p_key: LIVE.key, p_position_id: row.data.id, p_annot: annot }); row.annot = annot; }
      catch (e) { alert('Enregistrement impossible : ' + e.message); return; }
      clearJForm(); renderJournal(); return;
    }
    const t = {
      id: editId || 't' + Date.now(), date: $('#jDate').value, time: $('#jTime').value, instr: $('#jInstr').value, dir: $('#jDir').value,
      phase: $('#jPhase').value, fib: $('#jFib').value, entry: $('#jEntry').value, sl: $('#jSL').value, tp: $('#jTP').value,
      lots: $('#jLots').value, outcome: $('#jOutcome').value, r: $('#jOutcome').value === 'OPEN' ? '' : $('#jR').value, rule: $('#jRule').value, notes: $('#jNotes').value
    };
    if (!t.date) { alert('Indique la date du trade.'); return; }
    if (t.outcome === 'MAN' && !isFinite(num(t.r))) { alert('Indique le R obtenu pour une sortie manuelle.'); return; }
    if (editId) J = J.map(x => x.id === editId ? t : x); else J.push(t);
    saveJ(); clearJForm(); renderJournal(); renderSessionStats(); renderChecklist(); tick();
  });
  $('#jClear').addEventListener('click', clearJForm);
  $('#jBody').addEventListener('click', ev => {
    const ed = ev.target.closest('[data-edit]'), del = ev.target.closest('[data-rm]');
    if (ed) { const t = allTrades().find(x => x.id === ed.dataset.edit); if (t) { editId = t.id; fillJForm(t); $('#jFormTitle').textContent = 'Modifier le trade'; $('#jFormCard').scrollIntoView({ behavior: 'smooth' }); } }
    if (del && del.dataset.rm.startsWith('mt5:')) {
      const row = LIVE.trades.find(x => 'mt5:' + x.data.id === del.dataset.rm);
      if (row && confirm('Masquer ce trade MT5 du journal et des statistiques ?')) {
        const annot = Object.assign({}, row.annot, { hidden: true });
        rpc('desk_annotate', { p_key: LIVE.key, p_position_id: row.data.id, p_annot: annot })
          .then(() => { row.annot = annot; renderJournal(); renderSessionStats(); })
          .catch(e => alert('Impossible : ' + e.message));
      }
      return;
    }
    if (del && confirm('Supprimer ce trade ?')) { J = J.filter(x => x.id !== del.dataset.rm); saveJ(); renderJournal(); renderSessionStats(); renderChecklist(); tick(); }
  });
  const phaseName = id => (PHASE_OPTS.find(p => p[0] === id) || [, id])[1];
  const fibName = f => f ? (parseFloat(f) * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' %' : 'autre';
  const OUT = { TP: 'TP', SL: 'SL', BE: 'BE', MAN: 'Manuel', OPEN: 'En cours' };
  function groupTable(el, keyFn, nameFn, closed) {
    const g = {};
    closed.forEach(t => { const k = keyFn(t); (g[k] = g[k] || []).push(num(t.r) || 0); });
    const rows = Object.entries(g).sort((a, b) => b[1].length - a[1].length);
    el.innerHTML = rows.length ? '<tr><th></th><th>Trades</th><th>Réussite</th><th>Total</th></tr>' + rows.map(([k, rs]) => {
      const tot = rs.reduce((a, b) => a + b, 0), w = rs.filter(r => r > 0).length;
      return `<tr><td>${esc(nameFn(k))}</td><td class="mono">${rs.length}</td><td class="mono">${pct(w / rs.length)}</td><td class="${tot > 0 ? 'r-pos' : tot < 0 ? 'r-neg' : 'r-zero'}">${fmtR(tot)}</td></tr>`;
    }).join('') : '<tr><td class="muted">Pas encore de données.</td></tr>';
  }
  function renderJournal() {
    const sorted = allTrades().sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const closed = sorted.filter(t => t.outcome !== 'OPEN' && isFinite(num(t.r)));
    const rs = closed.map(t => num(t.r));
    const tot = rs.reduce((a, b) => a + b, 0);
    const wins = rs.filter(r => r > 0), losses = rs.filter(r => r < 0);
    let peak = 0, cum = 0, mdd = 0; const curve = [0];
    rs.forEach(r => { cum += r; curve.push(cum); peak = Math.max(peak, cum); mdd = Math.min(mdd, cum - peak); });
    const rule = closed.length ? closed.filter(t => t.rule === '1').length / closed.length : NaN;
    const kpi = (l, v, cls) => `<div class="kpi"><small>${l}</small><b class="${cls || ''}">${v}</b></div>`;
    $('#jStats').innerHTML =
      kpi('Trades clôturés', closed.length) +
      kpi('Taux de réussite', closed.length ? pct(wins.length / closed.length) : '—') +
      kpi('Total', fmtR(tot), tot > 0 ? 'bull' : tot < 0 ? 'bear' : '') +
      kpi('Espérance / trade', closed.length ? fmtR(tot / closed.length) : '—') +
      kpi('Gain moyen', wins.length ? fmtR(wins.reduce((a, b) => a + b, 0) / wins.length) : '—', 'bull') +
      kpi('Perte moyenne', losses.length ? fmtR(losses.reduce((a, b) => a + b, 0) / losses.length) : '—', 'bear') +
      kpi('Drawdown max', fmtR(mdd), mdd < 0 ? 'bear' : '') +
      kpi('Plan respecté', isFinite(rule) ? pct(rule) : '—');
    // courbe
    const svg = $('#equity');
    if (curve.length > 1) {
      const min = Math.min(...curve), max = Math.max(...curve), h = 140, w = 600, padY = 10;
      const sy = v => max === min ? h / 2 : h - padY - (v - min) / (max - min) * (h - 2 * padY);
      const pts = curve.map((v, i) => `${(i / (curve.length - 1) * w).toFixed(1)},${sy(v).toFixed(1)}`).join(' ');
      svg.innerHTML = `<line x1="0" x2="${w}" y1="${sy(0)}" y2="${sy(0)}" stroke="rgba(244,243,239,.2)" stroke-dasharray="4 4"/><polyline points="${pts}" fill="none" stroke="${tot >= 0 ? '#3fb68b' : '#e5534b'}" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
    } else svg.innerHTML = '<text x="300" y="75" text-anchor="middle" fill="rgba(244,243,239,.45)" font-size="13">La courbe apparaîtra après tes premiers trades clôturés.</text>';
    groupTable($('#jByFib'), t => t.fib, fibName, closed);
    groupTable($('#jByPhase'), t => t.phase, phaseName, closed);
    $('#jBody').innerHTML = sorted.length ? sorted.slice().reverse().map(t => {
      const r = num(t.r);
      return `<tr><td class="mono">${esc(t.date)}${t.src === 'mt5' ? ' <span class="tag mt5">MT5</span>' : ''}</td><td class="mono">${esc(t.time)}</td><td>${esc(t.instr)}</td><td>${t.dir === 'buy' ? '<span class="tag bull">Achat</span>' : '<span class="tag bear">Vente</span>'}</td>
        <td>${esc(phaseName(t.phase))}</td><td class="mono">${esc(fibName(t.fib))}</td><td class="mono">${esc(t.entry)}</td><td class="mono">${esc(t.sl)}</td><td class="mono">${esc(t.tp)}</td>
        <td>${OUT[t.outcome] || esc(t.outcome)}</td><td class="${r > 0 ? 'r-pos' : r < 0 ? 'r-neg' : 'r-zero'}" ${t.noSl ? 'title="Pas de stop connu : R estimé sur ton risque par trade"' : ''}>${t.outcome === 'OPEN' ? '—' : (t.noSl ? '≈ ' : '') + fmtR(r)}</td><td>${t.rule === '1' ? 'Oui' : '<span style="color:var(--bear)">Non</span>'}</td>
        <td style="white-space:nowrap"><button class="btn small" data-edit="${t.id}">Modifier</button> <button class="btn small danger" data-rm="${t.id}">✕</button></td></tr>`;
    }).join('') : '<tr><td colspan="13" class="muted">Aucun trade enregistré.</td></tr>';
  }
  function download(name, content, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  $('#jCsv').addEventListener('click', () => {
    const cols = ['date', 'time', 'instr', 'dir', 'phase', 'fib', 'entry', 'sl', 'tp', 'lots', 'outcome', 'r', 'rule', 'notes'];
    const q = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const csv = [cols.join(';')].concat(allTrades().map(t => cols.map(c => q(c === 'phase' ? phaseName(t[c]) : t[c])).join(';'))).join('\n');
    download(`journal-trading-${todayStr()}.csv`, '﻿' + csv, 'text/csv;charset=utf-8');
  });
  $('#jBackup').addEventListener('click', () => {
    const days = {}; store.keys().filter(k => k.startsWith(K.dayPrefix)).forEach(k => { days[k] = store.get(k, null); });
    download(`desk-us-sauvegarde-${todayStr()}.json`, JSON.stringify({ version: 1, settings: S, journal: J, days }, null, 2), 'application/json');
  });
  $('#jRestore').addEventListener('change', ev => {
    const f = ev.target.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const data = JSON.parse(rd.result);
        if (!Array.isArray(data.journal)) throw new Error('format');
        if (!confirm(`Restaurer ${data.journal.length} trade(s) ? Le journal actuel sera remplacé.`)) return;
        J = data.journal; saveJ();
        if (data.settings) { store.set(K.settings, data.settings); S = loadSettings(); }
        if (data.days) Object.entries(data.days).forEach(([k, v]) => { if (k.startsWith(K.dayPrefix)) store.set(k, v); });
        location.reload();
      } catch (e) { alert('Fichier de sauvegarde invalide.'); }
    };
    rd.readAsText(f); ev.target.value = '';
  });

  /* =========================================================
     Plan de trade (Fibonacci + taille de position)
     ========================================================= */
  let planInstr = 'US100', planDir = 'buy', lastPlan = null;
  const P = store.get('td.plan', {});
  function initPlanInputs() {
    $('#pHigh').value = P.high || ''; $('#pLow').value = P.low || '';
    $('#pLevel').value = P.level || '0.5';
    $('#pBuffer').value = P.buffer != null && P.instr === planInstr ? P.buffer : S.instruments[planInstr].buffer;
    $('#pRR').value = S.rr; $('#pRisk').value = S.risk;
  }
  function renderPlan() {
    const I = spec(planInstr);
    const hi = num($('#pHigh').value), lo = num($('#pLow').value), lvl = num($('#pLevel').value);
    const buf = num($('#pBuffer').value) || 0, rr = num($('#pRR').value) || S.rr, riskPct = num($('#pRisk').value) || S.risk;
    store.set('td.plan', { high: $('#pHigh').value, low: $('#pLow').value, level: $('#pLevel').value, buffer: $('#pBuffer').value, instr: planInstr });
    $('#planHelp').innerHTML = planDir === 'buy'
      ? 'Achat : trace le Fibonacci du <b>bas</b> de la manipulation (100 %) au <b>haut</b> du displacement (0 %). Le stop va sous le bas.'
      : 'Vente : trace le Fibonacci du <b>haut</b> de la manipulation (100 %) au <b>bas</b> du displacement (0 %). Le stop va au-dessus du haut.';
    if (!(hi > lo)) { lastPlan = null; $('#planOut').innerHTML = '<p class="muted">Renseigne le swing haut et le swing bas de la jambe d\'impulsion (le displacement après la manipulation). Le haut doit être supérieur au bas.</p>'; renderChecklist(); return; }
    const range = hi - lo;
    const buy = planDir === 'buy';
    const at = r => buy ? hi - r * range : lo + r * range; // r = niveau de retracement
    const entry = at(lvl);
    const sl = buy ? lo - buf : hi + buf;
    const risk = Math.abs(entry - sl);
    const tp = buy ? entry + rr * risk : entry - rr * risk;
    const tpExt = buy ? (tp - hi) / range : (lo - tp) / range; // extension au-delà du swing (0 %)
    const riskMoney = capitalBase() * riskPct / 100;
    const rawLots = riskMoney / (risk * I.ppv);
    const step = I.lotStep > 0 ? I.lotStep : 0.01;
    const lots = Math.floor(rawLots / step + 1e-9) * step;
    const dec = (String(step).split('.')[1] || '').length;
    const lotsOk = lots >= I.minLot;
    const realRisk = lots * risk * I.ppv;
    lastPlan = { instr: planInstr, dir: planDir, entry, sl, tp, rr, lots: lotsOk ? lots : 0, lvl };
    const rows = [
      { r: -rr, label: '', p: tp, cls: 'tp', note: `Objectif ${rr}R` },
      { r: 0, label: '0 %', p: buy ? hi : lo, note: buy ? 'Haut du swing (liquidité)' : 'Bas du swing (liquidité)' },
      { r: 0.5, label: '50 %', p: at(0.5), zone: true, pick: true, note: 'Équilibre · entrée minimum' },
      { r: 0.618, label: '61,8 %', p: at(0.618), zone: true, pick: true },
      { r: 0.68, label: '68 %', p: at(0.68), zone: true, pick: true, note: 'Fin de ta zone 50–68 %' },
      { r: 0.705, label: '70,5 %', p: at(0.705), pick: true, note: 'OTE' },
      { r: 0.786, label: '78,6 %', p: at(0.786), pick: true },
      { r: 1, label: '100 %', p: buy ? lo : hi, note: 'Swing de manipulation' },
      { r: 1.01, label: 'SL', p: sl, cls: 'sl', note: `Stop (marge ${fmtP(buf)} pts)` }
    ];
    rows[0].label = `${(-tpExt * 100).toFixed(0)} %`; // ligne TP, avant le tri par prix
    rows.sort((a, b) => b.p - a.p);
    const ladder = rows.map(x => `<div class="rung ${x.zone ? 'zone' : ''} ${x.pick ? 'pick' : ''} ${x.cls || ''} ${x.pick && Math.abs(x.r - lvl) < 1e-9 ? 'entry' : ''}" ${x.pick ? `data-lvl="${x.r}"` : ''}>
        <span class="mono">${x.label}</span><span class="muted" style="font-size:12px">${x.pick && Math.abs(x.r - lvl) < 1e-9 ? '<b style="color:var(--accent)">ENTRÉE LIMITE</b> · ' : ''}${x.note || ''}</span><span class="p">${fmtP(x.p)}</span></div>`).join('');
    const warn = [];
    if (!lotsOk) warn.push(`La taille calculée (${rawLots.toFixed(3)} lot) est sous le lot minimum (${I.minLot}). Stop trop large pour ton risque : attends un meilleur point d'entrée ou augmente le risque.`);
    if (lvl < 0.5) warn.push('Entrée au-dessus de 50 % : hors de ta règle.');
    if (rr < 2) warn.push('RR sous 2:1 : hors de ta règle.');
    $('#planOut').innerHTML = `
      <div class="res" style="margin-top:0">
        <div class="kpi"><small>Ordre</small><b class="${buy ? 'bull' : 'bear'}">${buy ? 'Achat limite' : 'Vente limite'}</b></div>
        <div class="kpi"><small>Entrée</small><b>${fmtP(entry)}</b></div>
        <div class="kpi"><small>Stop loss</small><b class="bear">${fmtP(sl)}</b></div>
        <div class="kpi"><small>Take profit</small><b class="bull">${fmtP(tp)}</b></div>
        <div class="kpi"><small>Distance SL</small><b>${fmtP(risk)} pts</b></div>
        <div class="kpi"><small>Distance TP</small><b>${fmtP(risk * rr)} pts</b></div>
        <div class="kpi"><small>Taille</small><b>${lotsOk ? lots.toFixed(dec) + ' lot' : '—'}</b></div>
        <div class="kpi"><small>Risque réel</small><b class="bear">${lotsOk ? fmtE(realRisk) : '—'}</b></div>
        <div class="kpi"><small>Gain visé</small><b class="bull">${lotsOk ? fmtE(realRisk * rr) : '—'}</b></div>
        <div class="kpi"><small>Break-even à 1R</small><b>${fmtP(buy ? entry + risk : entry - risk)}</b></div>
      </div>
      <p class="hint">${I.live ? `Spécifications lues dans MT5 : 1 lot = ${fmtE(I.ppv)} par point, lot min ${I.minLot}, pas ${I.lotStep}.` : 'Spécifications saisies dans Réglages (connecte MT5 pour les lire automatiquement).'} Risque calculé sur ${fmtE(capitalBase())}.${(() => { const q = liveQuote(planInstr); return q && q.bid ? ` Prix actuel ${fmtP(q.bid)}, soit ${fmtP(Math.abs(q.bid - entry))} pts de l'entrée.` : ''; })()}</p>
      ${warn.map(w => `<div class="alert warn" style="margin-top:10px">${w}</div>`).join('')}
      <div class="ladder" id="ladder">${ladder}</div>
      <p class="hint">Clique un niveau pour y placer l'entrée. Le TP à ${rr}R tombe sur l'extension ${(-tpExt * 100).toFixed(0)} % : vérifie qu'il vise une liquidité (PDH/PDL, haut/bas d'Asie ou de Londres, equal highs/lows) et qu'aucun niveau majeur ne bloque avant.</p>
      <div class="row" style="margin-top:10px"><button class="btn primary" id="toJournal">Envoyer au journal</button></div>`;
    renderChecklist();
  }
  $('#tab-plan').addEventListener('input', ev => { if (ev.target.closest('.fgrid')) renderPlan(); });
  $('#tab-plan').addEventListener('change', ev => { if (ev.target.id === 'pLevel') renderPlan(); });
  $('#tab-plan').addEventListener('click', ev => {
    const rung = ev.target.closest('.rung.pick');
    if (rung) { $('#pLevel').value = String(parseFloat(rung.dataset.lvl)); renderPlan(); return; }
    if (ev.target.id === 'toJournal' && lastPlan) {
      clearJForm();
      const I = spec(lastPlan.instr);
      const dec = (String(I.lotStep).split('.')[1] || '').length;
      $('#jInstr').value = lastPlan.instr; $('#jDir').value = lastPlan.dir; $('#jFib').value = String(lastPlan.lvl);
      $('#jEntry').value = (+lastPlan.entry.toFixed(2)); $('#jSL').value = (+lastPlan.sl.toFixed(2)); $('#jTP').value = (+lastPlan.tp.toFixed(2));
      $('#jLots').value = lastPlan.lots ? lastPlan.lots.toFixed(dec) : '';
      autoR(); showTab('journal'); $('#jFormCard').scrollIntoView({ behavior: 'smooth' });
    }
  });
  $('#planInstr').addEventListener('click', ev => {
    const b = ev.target.closest('button'); if (!b) return;
    planInstr = b.dataset.v; $$('#planInstr button').forEach(x => x.classList.toggle('on', x === b));
    $('#pBuffer').value = S.instruments[planInstr].buffer; renderPlan();
  });
  const setDir = d => { planDir = d; $('#dirBuy').classList.toggle('on', d === 'buy'); $('#dirSell').classList.toggle('on', d === 'sell'); renderPlan(); };
  $('#dirBuy').addEventListener('click', () => setDir('buy'));
  $('#dirSell').addEventListener('click', () => setDir('sell'));

  /* =========================================================
     Fondamentaux : récurrents, FOMC, fériés
     ========================================================= */
  function renderFonda() {
    const { y, m, d } = DAY;
    const ref = [
      [8, 30, 'CPI, PPI, NFP, PCE, PIB, ventes au détail, inscriptions chômage (jeudi)', 'high'],
      [9, 30, 'Ouverture du cash NYSE / Nasdaq', 'med'],
      [9, 45, 'PMI S&P Global (flash)', 'med'],
      [10, 0, 'ISM, JOLTS, confiance consommateur, Michigan, ventes de logements', 'high'],
      [10, 30, 'Stocks de pétrole EIA (mercredi)', 'med'],
      [14, 0, 'Décision FOMC / minutes du FOMC', 'high'],
      [14, 30, 'Conférence de presse du président de la Fed', 'high'],
      [16, 0, 'Clôture du cash (résultats d\'entreprises juste après)', 'med']
    ];
    $('#recurBody').innerHTML = ref.map(([h, mi, n, imp]) => `<tr><td class="mono">${parisHM(zoned(TZN, y, m, d, h, mi))}</td><td class="mono muted">${pad(h)}:${pad(mi)}</td><td><span class="tag ${imp === 'high' ? 'N' : 'D'}" style="margin-right:6px">${imp === 'high' ? 'FORT' : 'MOY'}</span>${esc(n)}</td></tr>`).join('');
    const today = ymd(y, m, d);
    const nextF = FOMC.filter(x => x >= today).slice(0, 4);
    $('#fomcList').innerHTML = nextF.length ? nextF.map(x => { const [yy, mm, dd] = x.split('-').map(Number); return `${frDate(yy, mm, dd, wdOf(yy, mm, dd))} · ${parisHM(zoned(TZN, yy, mm, dd, 14, 0))} Paris`; }).join('<br>')
      : 'Calendrier FOMC de l\'année suivante pas encore intégré : vérifie sur federalreserve.gov.';
    const hols = [];
    for (const yy of [y, y + 1]) {
      const c = nyseCalendar(yy);
      Object.entries(c.hol).forEach(([k, v]) => hols.push([k, v, 'Fermé']));
      Object.entries(c.early).forEach(([k, v]) => hols.push([k, v, 'Clôture 13:00 NY']));
    }
    $('#holList').innerHTML = hols.filter(h => h[0] >= today).sort((a, b) => a[0].localeCompare(b[0])).slice(0, 6)
      .map(([k, v, t]) => { const [yy, mm, dd] = k.split('-').map(Number); return `${frDate(yy, mm, dd, wdOf(yy, mm, dd))} · ${esc(v)} · <b>${t}</b>`; }).join('<br>');
  }

  /* =========================================================
     Réglages
     ========================================================= */
  function renderSettings() {
    $('#sCapital').value = S.capital; $('#sRisk').value = S.risk; $('#sRR').value = S.rr;
    $('#sMaxTrades').value = S.maxTrades; $('#sMaxLoss').value = S.maxLoss; $('#sNewsBuf').value = S.newsBuf;
    $('#sNotif').checked = !!S.notif;
    $$('.newsBuf').forEach(el => { el.textContent = S.newsBuf; });
    $('#instrSettings').innerHTML = Object.entries(S.instruments).map(([k, I]) => `
      <h3>${k}</h3>
      <div class="fgrid">
        <label class="f">Symbole MT5<input type="text" data-i="${k}" data-f="mt5" value="${esc(I.mt5 || '')}"></label>
        <label class="f">Flux TradingView<input type="text" data-i="${k}" data-f="symbol" value="${esc(I.symbol)}"></label>
        <label class="f">Valeur du point / lot<input type="number" step="any" data-i="${k}" data-f="ppv" value="${I.ppv}"></label>
        <label class="f">Lot minimum<input type="number" step="any" data-i="${k}" data-f="minLot" value="${I.minLot}"></label>
        <label class="f">Pas de lot<input type="number" step="any" data-i="${k}" data-f="lotStep" value="${I.lotStep}"></label>
        <label class="f">Marge SL défaut (pts)<input type="number" step="any" data-i="${k}" data-f="buffer" value="${I.buffer}"></label>
      </div>`).join('');
  }
  const bindNum = (sel, key) => $(sel).addEventListener('change', e => { const v = num(e.target.value); if (isFinite(v)) { S[key] = v; saveSettings(); onSettingsChange(); } });
  bindNum('#sCapital', 'capital'); bindNum('#sRisk', 'risk'); bindNum('#sRR', 'rr'); bindNum('#sMaxTrades', 'maxTrades'); bindNum('#sMaxLoss', 'maxLoss'); bindNum('#sNewsBuf', 'newsBuf');
  $('#sNotif').addEventListener('change', async e => {
    S.notif = e.target.checked;
    if (S.notif && typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
      const p = await Notification.requestPermission();
      if (p !== 'granted') { S.notif = false; e.target.checked = false; alert('Notifications refusées par le navigateur.'); }
    }
    saveSettings();
  });
  $('#instrSettings').addEventListener('change', e => {
    const k = e.target.dataset.i, f = e.target.dataset.f; if (!k) return;
    if (f === 'symbol') S.instruments[k].symbol = e.target.value.trim().toUpperCase();
    else if (f === 'mt5') S.instruments[k].mt5 = e.target.value.trim();
    else { const v = num(e.target.value); if (!isFinite(v) || v < 0) return; S.instruments[k][f] = v; }
    saveSettings(); onSettingsChange();
    if (f === 'symbol') { mounted.graph = false; }
  });
  $('#sWipe').addEventListener('click', () => {
    if (!confirm('Effacer réglages, journal et toutes les journées enregistrées ? Cette action est définitive.')) return;
    store.keys().filter(k => k.startsWith('td.')).forEach(k => store.del(k));
    location.reload();
  });
  function onSettingsChange() {
    $$('.newsBuf').forEach(el => { el.textContent = S.newsBuf; });
    $('#pRR').value = S.rr; $('#pRisk').value = S.risk;
    renderSessionStats(); renderChecklist(); renderPlan(); lastAlertsHtml = ''; tick();
  }

  /* =========================================================
     MT5 en direct (robot DeskUS_Bridge -> Supabase -> ici)
     ========================================================= */
  const SB_URL = 'https://xakrdapoxthvvqpyjuji.supabase.co';
  const SB_KEY = 'sb_publishable_Hzn2bTrae-TflG_HCzLVWg_QYF4l0ec'; // clé publique par conception
  const LIVE = { key: store.get('td.mt5key', ''), data: null, bars: null, barsAt: null, trades: [], readAt: 0, err: '', n: 0, busy: false };

  async function rpc(fn, args) {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SB_KEY }, body: JSON.stringify(args)
    });
    const txt = await r.text();
    let body = null; try { body = txt ? JSON.parse(txt) : null; } catch (e) {}
    if (!r.ok) throw new Error((body && (body.message || body.hint)) || ('HTTP ' + r.status));
    return body;
  }
  const hex = buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  const sha256 = async txt => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt)));

  function liveAge() {
    const d = LIVE.data; if (!d || !d.updated_at) return Infinity;
    return (d.now - d.updated_at) + (Date.now() - LIVE.readAt) / 1000;
  }
  const liveOn = () => liveAge() < 30;
  const account = () => (LIVE.data && LIVE.data.account) || null;
  function liveQuote(k) {
    const q = LIVE.data && LIVE.data.quotes; const sym = S.instruments[k] && S.instruments[k].mt5;
    return q && sym ? (q[sym] || null) : null;
  }
  function spec(k) {
    const I = S.instruments[k], q = liveQuote(k);
    if (q && q.ppv > 0 && q.vstep > 0) return { ppv: q.ppv, minLot: q.vmin || I.minLot, lotStep: q.vstep, buffer: I.buffer, live: true };
    return { ppv: I.ppv, minLot: I.minLot, lotStep: I.lotStep, buffer: I.buffer, live: false };
  }
  function ftmoInit() {
    if (S.ftmo.init > 0) return S.ftmo.init;
    const a = account(); if (a && a.init > 0) return a.init;
    return S.capital;
  }
  function capitalBase() {
    const a = account();
    if (!a) return S.capital;
    if (S.riskBase === 'balance' && a.bal > 0) return a.bal;
    return ftmoInit();
  }
  function instrForSym(sym) {
    const k = Object.keys(S.instruments).find(k => (S.instruments[k].mt5 || '').toLowerCase() === String(sym).toLowerCase());
    return k || null;
  }

  /* ---------- niveaux calculés à partir des bougies M15 de MT5 ---------- */
  function autoLevels(k) {
    const q = liveQuote(k); if (!q) return null;
    const out = { pdh: q.pdh || null, pdl: q.pdl || null, px: q.bid || null };
    const bars = LIVE.bars && LIVE.bars[S.instruments[k].mt5];
    if (bars && bars.length) {
      const { y, m, d } = DAY; const prev = addDays(y, m, d, -1);
      const T = (yy, mm, dd, h, mi) => zoned(TZN, yy, mm, dd, h, mi).getTime() / 1000;
      const win = (a, b) => {
        let hi = -Infinity, lo = Infinity;
        for (const r of bars) if (r[0] >= a && r[0] < b) { if (r[2] > hi) hi = r[2]; if (r[3] < lo) lo = r[3]; }
        return isFinite(hi) ? [hi, lo] : [null, null];
      };
      const openAt = t => { const r = bars.find(r => r[0] >= t && r[0] < t + 900); return r ? r[1] : null; };
      [out.ah, out.al] = win(T(prev.y, prev.m, prev.d, 20, 0), T(y, m, d, 0, 0));
      [out.lh, out.ll] = win(T(y, m, d, 2, 0), T(y, m, d, 5, 0));
      out.mo = openAt(T(y, m, d, 0, 0));
      out.o930 = openAt(T(y, m, d, 9, 30));
    }
    return out;
  }

  /* ---------- trades MT5 -> lignes du journal ---------- */
  function phaseAt(date) {
    const p = partsIn(TZN, date); const mins = p.h * 60 + p.mi;
    if (mins >= 20 * 60) return 'asia';
    const ph = PHASES.find(x => !x.marker && !x.prevDay && mins >= x.from[0] * 60 + x.from[1] && mins < x.to[0] * 60 + x.to[1]);
    return ph ? ph.id : 'other';
  }
  const parisYmd = date => { const p = partsIn(TZP, date); return ymd(p.y, p.m, p.d); };
  function mt5Entry(row) {
    const t = row.data, a = row.annot || {};
    const k = instrForSym(t.sym);
    const open = new Date(t.to * 1000);
    const risk = t.sl > 0 ? Math.abs(t.pi - t.sl) : 0;
    const sp = k ? spec(k) : null;
    const riskMoney = risk > 0 && sp ? risk * sp.ppv * t.vol : 0;
    let r = riskMoney > 0 ? t.net / riskMoney : t.net / (capitalBase() * S.risk / 100);
    let outcome = 'MAN';
    if (risk > 0) {
      const tol = risk * 0.05;
      if (t.tp > 0 && Math.abs(t.px - t.tp) <= tol) outcome = 'TP';
      else if (Math.abs(t.px - t.sl) <= tol && t.net < 0) outcome = 'SL';
      else if (Math.abs((t.px - t.pi) * t.dir) <= tol * 2) outcome = 'BE';
    }
    return {
      id: 'mt5:' + t.id, src: 'mt5', posId: t.id, hidden: !!a.hidden, noSl: !(t.sl > 0),
      date: parisYmd(open), time: parisHM(open), instr: k || t.sym, dir: t.dir > 0 ? 'buy' : 'sell',
      phase: a.phase || phaseAt(open), fib: a.fib != null ? a.fib : '', entry: t.pi, sl: t.sl || '', tp: t.tp || '',
      exit: t.px, lots: t.vol, outcome, r: r.toFixed(2), rule: a.rule != null ? a.rule : '1', notes: a.notes || '', net: t.net
    };
  }
  function allTrades() {
    return J.slice().concat(LIVE.trades.map(mt5Entry).filter(t => !t.hidden));
  }
  // Un trade « En cours » saisi depuis le plan est relié automatiquement au trade MT5 correspondant
  async function linkPlannedTrades() {
    let changed = false;
    for (const row of LIVE.trades) {
      if (row.annot && row.annot.linked) continue;
      const e = mt5Entry(row);
      const risk = e.sl ? Math.abs(e.entry - e.sl) : 0;
      const tol = Math.max(2, risk * 0.25);
      const local = J.find(x => x.outcome === 'OPEN' && x.date === e.date && x.instr === e.instr && x.dir === e.dir && Math.abs(num(x.entry) - e.entry) <= tol);
      if (!local) continue;
      const annot = Object.assign({}, row.annot, { fib: local.fib, phase: local.phase, rule: local.rule, notes: local.notes, linked: true });
      try {
        await rpc('desk_annotate', { p_key: LIVE.key, p_position_id: row.data.id, p_annot: annot });
        row.annot = annot; J = J.filter(x => x !== local); saveJ(); changed = true;
      } catch (err) { /* nouvel essai au prochain passage */ }
    }
    return changed;
  }

  /* ---------- lecture périodique ---------- */
  async function poll(force) {
    if (!LIVE.key || LIVE.busy) return;
    if (!force && document.hidden && LIVE.n % 4 !== 0) { LIVE.n++; return; }
    LIVE.busy = true;
    try {
      const wantTrades = force || LIVE.n % 10 === 0;
      const d = await rpc('desk_read', { p_key: LIVE.key, p_trades: wantTrades, p_bars_after: LIVE.barsAt });
      LIVE.readAt = Date.now(); LIVE.err = '';
      let barsChanged = false;
      if (d.bars) { LIVE.bars = d.bars; LIVE.barsAt = d.bars_updated_at; delete d.bars; barsChanged = true; }
      let tradesChanged = false;
      if (d.trades) { LIVE.trades = d.trades; delete d.trades; tradesChanged = true; }
      LIVE.data = d;
      if (d.account && d.account.cur && d.account.cur !== CUR) { CUR = d.account.cur; store.set('td.cur', CUR); renderSessionStats(); if ($('#tab-journal').classList.contains('active')) renderJournal(); }
      if (tradesChanged && await linkPlannedTrades()) tradesChanged = true;
      onLive(tradesChanged);
      if (barsChanged) renderTrends();
    } catch (e) {
      LIVE.err = /unknown key/.test(e.message) ? 'Clé inconnue : reconnecte MT5 dans Réglages.' : 'Service injoignable (' + e.message + ').';
      renderLiveStatus();
    } finally { LIVE.n++; LIVE.busy = false; }
  }
  function startLive() {
    renderMt5Settings(); renderFtmo(); renderLiveStatus(); renderTrends();
    if (LIVE.key) poll(true);
    setInterval(() => poll(false), 3000);
  }
  function onLive(tradesChanged) {
    renderLiveStatus(); renderFtmo();
    if (D.levelsAuto !== false && autoLevels(lvlInstr)) {
      if ($('#lvlGrid input') && !$('#lvlGrid input').readOnly) renderLevels(); else refreshLevelValues();
    }
    if ($('#tab-plan').classList.contains('active')) renderPlan();
    if ($('#tab-reglages').classList.contains('active')) renderMt5Settings();
    if (tradesChanged) { renderSessionStats(); if ($('#tab-journal').classList.contains('active')) renderJournal(); }
  }

  /* ---------- affichage : barre du haut ---------- */
  function renderLiveStatus() {
    const pill = $('#pillMT5'), q = $('#liveQuotes');
    if (!LIVE.key) { pill.hidden = true; q.textContent = ''; return; }
    pill.hidden = false;
    const age = liveAge();
    if (LIVE.err) setPill(pill, 'danger', 'MT5 · ' + (LIVE.err.startsWith('Clé') ? 'clé inconnue' : 'hors ligne'));
    else if (!LIVE.data || !LIVE.data.updated_at) setPill(pill, 'warn', 'MT5 · en attente du robot');
    else if (age < 30) setPill(pill, 'live', 'MT5 en direct');
    else setPill(pill, 'warn', 'MT5 · silencieux depuis ' + dur(age * 1000));
    const parts = Object.keys(S.instruments).map(k => { const x = liveQuote(k); return x && x.bid ? `${k} <b>${fmtP(x.bid)}</b>` : ''; }).filter(Boolean);
    q.innerHTML = parts.join(' · ');
  }

  /* ---------- affichage : compte FTMO ---------- */
  function ftmoNumbers() {
    const a = account(); if (!a) return null;
    const init = ftmoInit();
    const dailyLimit = init * S.ftmo.daily / 100;
    const dayStart = isFinite(a.day_pl) ? a.bal - a.day_pl : (a.day_start || a.bal);
    const dayLoss = Math.max(0, dayStart - a.eq);
    const dayLeft = dailyLimit - dayLoss;
    const floor = init * (1 - S.ftmo.max / 100);
    const maxLeft = a.eq - floor;
    const target = S.ftmo.phase === 'funded' ? 0 : init * S.ftmo.target / 100;
    const progress = target > 0 ? (a.bal - init) / target : NaN;
    const riskMoney = capitalBase() * S.risk / 100;
    const tradesLeft = riskMoney > 0 ? Math.max(0, Math.floor(Math.min(dayLeft, maxLeft) / riskMoney)) : 0;
    return { a, init, dailyLimit, dayStart, dayLoss, dayLeft, floor, maxLeft, target, progress, riskMoney, tradesLeft };
  }
  function bar(ratio, color) {
    const w = Math.max(0, Math.min(1, ratio)) * 100;
    return `<div class="meter" style="height:8px"><i style="width:${w}%;background:${color}"></i></div>`;
  }
  function renderFtmo() {
    const card = $('#ftmoCard');
    if (!LIVE.key) {
      card.innerHTML = `<h2>Compte FTMO</h2><p class="muted" style="margin:0">Connecte MT5 pour voir ton compte en direct : solde, équité, limite de perte du jour, objectif, positions ouvertes. <button class="btn small" data-goto="reglages">Connecter MT5</button></p>`;
      return;
    }
    const F = ftmoNumbers();
    if (!F) { card.innerHTML = `<h2>Compte FTMO</h2><p class="muted" style="margin:0">En attente des premières données du robot MT5… ${LIVE.err ? esc(LIVE.err) : 'Vérifie qu\'il est bien posé sur un graphique (Réglages > Connexion MT5).'}</p>`; return; }
    const { a } = F;
    const cls = v => v > 0 ? 'bull' : v < 0 ? 'bear' : '';
    const dayRes = a.eq - F.dayStart;
    const usedDay = F.dailyLimit > 0 ? F.dayLoss / F.dailyLimit : 0;
    const phaseLbl = { challenge: 'Challenge', verification: 'Vérification', funded: 'Compte financé' }[S.ftmo.phase] || '';
    const pos = (a && LIVE.data.positions) || [];
    const posRows = pos.map(p => {
      const k = instrForSym(p.sym); const risk = p.sl > 0 ? Math.abs(p.po - p.sl) : 0;
      const rNow = risk > 0 ? ((p.pc - p.po) * p.dir) / risk : NaN;
      return `<tr><td>${esc(k || p.sym)}</td><td>${p.dir > 0 ? '<span class="tag bull">Achat</span>' : '<span class="tag bear">Vente</span>'}</td><td class="mono">${p.vol}</td><td class="mono">${fmtP(p.po)}</td><td class="mono">${p.sl ? fmtP(p.sl) : '<span style="color:var(--bear)">aucun</span>'}</td><td class="mono">${p.tp ? fmtP(p.tp) : '—'}</td><td class="${p.pl >= 0 ? 'r-pos' : 'r-neg'}">${fmtE(p.pl)}</td><td class="mono">${isFinite(rNow) ? fmtR(rNow) : '—'}</td></tr>`;
    }).join('');
    card.innerHTML = `
      <h2>Compte FTMO · ${esc(phaseLbl)}<span class="spacer"></span><span class="muted" style="text-transform:none;letter-spacing:0;font-weight:400">${liveOn() ? 'en direct' : 'dernière donnée il y a ' + dur(liveAge() * 1000)}</span></h2>
      <div class="res" style="margin-top:0">
        <div class="kpi"><small>Solde</small><b>${fmtE(a.bal)}</b></div>
        <div class="kpi"><small>Équité</small><b>${fmtE(a.eq)}</b></div>
        <div class="kpi"><small>Flottant</small><b class="${cls(a.pl)}">${fmtE(a.pl)}</b></div>
        <div class="kpi"><small>Résultat du jour</small><b class="${cls(dayRes)}">${fmtE(dayRes)}</b></div>
        <div class="kpi"><small>Trades possibles</small><b class="${F.tradesLeft < 1 ? 'bear' : ''}">${F.tradesLeft} à ${fmtE(F.riskMoney)}</b></div>
      </div>
      <div class="grid" style="gap:14px;margin-top:14px">
        <div class="c4" style="min-width:0"><small class="muted">Perte du jour (max ${S.ftmo.daily} % = ${fmtE(F.dailyLimit)})</small>
          ${bar(usedDay, usedDay > 0.7 ? 'var(--bear)' : usedDay > 0.4 ? 'var(--accent)' : 'var(--bull)')}
          <div style="font-size:13px;margin-top:4px">Utilisé ${fmtE(F.dayLoss)} · il reste <b>${fmtE(F.dayLeft)}</b><br><span class="muted">Équité plancher du jour : ${fmtE(F.dayStart - F.dailyLimit)}</span></div></div>
        <div class="c4" style="min-width:0"><small class="muted">Perte max (${S.ftmo.max} % = plancher ${fmtE(F.floor)})</small>
          ${bar(1 - F.maxLeft / (F.init * S.ftmo.max / 100), F.maxLeft < F.init * S.ftmo.max / 200 ? 'var(--bear)' : 'var(--bull)')}
          <div style="font-size:13px;margin-top:4px">Marge restante <b>${fmtE(F.maxLeft)}</b></div></div>
        <div class="c4" style="min-width:0"><small class="muted">${F.target > 0 ? `Objectif +${S.ftmo.target} % = ${fmtE(F.init + F.target)}` : 'Compte financé : pas d\'objectif'}</small>
          ${F.target > 0 ? bar(F.progress, 'var(--accent)') : ''}
          <div style="font-size:13px;margin-top:4px">${F.target > 0 ? `Progression <b>${pct(Math.max(0, F.progress))}</b> · reste ${fmtE(Math.max(0, F.init + F.target - a.bal))}` : `Résultat depuis le départ : ${fmtE(a.bal - F.init)}`}</div></div>
      </div>
      ${pos.length ? `<h3>Positions ouvertes</h3><div class="tbl-wrap"><table style="min-width:560px"><thead><tr><th>Instr.</th><th>Sens</th><th>Lots</th><th>Entrée</th><th>SL</th><th>TP</th><th>P&amp;L</th><th>R</th></tr></thead><tbody>${posRows}</tbody></table></div>` : ''}
      <p class="hint">Capital initial ${fmtE(F.init)}${S.ftmo.init > 0 ? ' (saisi)' : ' (lu dans MT5)'} · règles modifiables dans Réglages. FTMO compte l'équité, flottant compris, et remet la limite du jour à zéro à minuit (heure de Prague, la même qu'à Paris).</p>`;
  }
  $('#ftmoCard').addEventListener('click', ev => { const b = ev.target.closest('[data-goto]'); if (b) showTab(b.dataset.goto); });

  function liveAlerts(now) {
    const out = [];
    if (!LIVE.key) return out;
    if (LIVE.err) out.push(['danger', 'MT5 : ' + esc(LIVE.err)]);
    const ms = marketState(now);
    if (!LIVE.err && LIVE.data && LIVE.data.updated_at && liveAge() > 60 && ms.cls === 'live')
      out.push(['warn', `Le robot MT5 n'envoie plus rien depuis ${dur(liveAge() * 1000)} : vérifie que MT5 est ouvert, connecté, et que le robot est actif sur un graphique.`]);
    const F = ftmoNumbers();
    if (F) {
      if (F.dayLeft <= 0) out.push(['danger', `Limite de perte journalière FTMO dépassée (${fmtE(F.dayLoss)} sur ${fmtE(F.dailyLimit)}).`]);
      else if (F.dayLeft < F.riskMoney) out.push(['danger', `Il ne reste que ${fmtE(F.dayLeft)} avant la limite FTMO du jour : moins d'un trade à ton risque. On arrête pour aujourd'hui.`]);
      else if (F.dayLoss > F.dailyLimit * 0.5) out.push(['warn', `Tu as utilisé plus de la moitié de ta perte journalière FTMO (${fmtE(F.dayLoss)} sur ${fmtE(F.dailyLimit)}).`]);
      if (F.maxLeft < F.riskMoney * 2) out.push(['danger', `Plus que ${fmtE(F.maxLeft)} avant la perte maximale FTMO.`]);
      (LIVE.data.positions || []).forEach(p => { if (!p.sl) out.push(['danger', `Position ${esc(instrForSym(p.sym) || p.sym)} ouverte sans stop loss.`]); });
    }
    return out;
  }

  /* ---------- Réglages : connexion MT5 ---------- */
  function renderMt5Settings() {
    const box = $('#mt5Box');
    if (!LIVE.key) {
      box.innerHTML = `
        <p style="margin-top:0">Première connexion : saisis le code d'activation qu'on t'a donné. Une clé secrète est créée dans ce navigateur ; tu la colleras dans le robot MT5.</p>
        <div class="row"><input type="text" id="mt5Code" placeholder="Code d'activation" style="max-width:240px" autocomplete="off"><button class="btn primary" id="mt5Activate">Activer</button></div>
        <p class="hint">Autre appareil déjà configuré ? Colle ta clé existante :</p>
        <div class="row"><input type="text" id="mt5KeyIn" placeholder="dk_…" style="max-width:360px" autocomplete="off"><button class="btn" id="mt5UseKey">Utiliser cette clé</button></div>
        <p class="hint" id="mt5Msg"></p>`;
      return;
    }
    const d = LIVE.data, a = account();
    const status = LIVE.err ? `<span style="color:var(--bear)">${esc(LIVE.err)}</span>`
      : !d || !d.updated_at ? 'Clé active. En attente du robot MT5 (suis les étapes ci-dessous).'
      : `${liveOn() ? '<b style="color:var(--bull)">Robot connecté</b>' : '<b style="color:var(--accent)">Robot silencieux</b>'} · dernière donnée il y a ${dur(liveAge() * 1000)} · robot v${esc(d.v || '?')}${a ? ` · ${esc(a.server)} · ${esc(a.cur)}` : ''}`;
    const syms = d && d.quotes ? Object.keys(d.quotes).map(esc).join(', ') : '';
    box.innerHTML = `
      <p style="margin-top:0">${status}</p>
      ${syms ? `<p class="hint" style="margin-top:0">Symboles reçus : ${syms}</p>` : ''}
      <div class="row"><input type="text" id="mt5KeyShow" readonly value="${'•'.repeat(24)}" style="max-width:360px;font-family:var(--mono)"><button class="btn small" id="mt5Reveal">Afficher</button><button class="btn small" id="mt5Copy">Copier la clé</button></div>
      <h3>Installer le robot dans MT5 (une seule fois)</h3>
      <ol style="padding-left:18px;margin:0;font-size:14px" class="stack">
        <li><a href="mt5/DeskUS_Bridge.mq5" download>Télécharge le robot DeskUS_Bridge.mq5</a>.</li>
        <li>Dans MT5 : <b>Fichier → Ouvrir le dossier des données</b>, puis <b>MQL5 → Experts</b>. Copie le fichier dedans.</li>
        <li>Ouvre-le avec <b>MetaEditor</b> (clic droit → Modifier) et clique <b>Compiler</b> (F7). Il doit afficher « 0 errors ».</li>
        <li><b>Outils → Options → Expert Advisors</b> : coche <b>« Autoriser WebRequest pour les URL listées »</b> et ajoute <code class="mono">${SB_URL}</code>.</li>
        <li>Dans le Navigateur, onglet Experts, glisse <b>DeskUS_Bridge</b> sur un graphique US100.cash. Onglet <b>Données d'entrée</b> : double-clique la valeur de « Clé Desk US » et colle ta clé. Vérifie les symboles (US100.cash,US500.cash). Valide.</li>
        <li>Valide avec OK. Pas besoin de cocher « Autoriser le trading algorithmique » : le robot ne passe aucun ordre. En haut à gauche du graphique, il affiche « Desk US · connecté ». Ici, la pastille passe à « MT5 en direct ».</li>
      </ol>
      <p class="hint">Le robot ne passe aucun ordre : il lit les prix, le compte et l'historique, puis les envoie toutes les 3 secondes. Garde MT5 ouvert pendant ta séance.</p>
      <div class="row" style="margin-top:10px"><button class="btn small danger" id="mt5Forget">Oublier la clé sur cet appareil</button></div>`;
  }
  $('#mt5Box').addEventListener('click', async ev => {
    const id = ev.target.id;
    if (id === 'mt5Activate') {
      const code = $('#mt5Code').value.trim(); const msg = $('#mt5Msg');
      if (!code) return;
      try {
        if (!(window.crypto && crypto.subtle)) throw new Error('navigateur trop ancien');
        const key = 'dk_' + hex(crypto.getRandomValues(new Uint8Array(32)));
        const ok = await rpc('desk_claim', { p_code: code, p_key_hash: await sha256(key) });
        if (!ok) { msg.textContent = 'Code invalide ou déjà utilisé.'; return; }
        LIVE.key = key; store.set('td.mt5key', key);
        renderMt5Settings(); renderFtmo(); renderLiveStatus(); poll(true);
        $('#mt5KeyShow').value = key;
        alert('Connexion activée. Copie ta clé (bouton « Copier la clé ») et garde-la précieusement : elle sert au robot MT5 et à tes autres appareils.');
      } catch (e) { msg.textContent = 'Activation impossible : ' + e.message; }
    }
    if (id === 'mt5UseKey') {
      const key = $('#mt5KeyIn').value.trim(); const msg = $('#mt5Msg');
      try { await rpc('desk_read', { p_key: key, p_trades: false, p_bars_after: 9e12 }); }
      catch (e) { msg.textContent = /unknown key/.test(e.message) ? 'Clé inconnue.' : 'Vérification impossible : ' + e.message; return; }
      LIVE.key = key; store.set('td.mt5key', key); renderMt5Settings(); renderFtmo(); poll(true);
    }
    if (id === 'mt5Reveal') { const i = $('#mt5KeyShow'); const shown = i.value === LIVE.key; i.value = shown ? '•'.repeat(24) : LIVE.key; ev.target.textContent = shown ? 'Afficher' : 'Masquer'; }
    if (id === 'mt5Copy') {
      try { await navigator.clipboard.writeText(LIVE.key); ev.target.textContent = 'Copiée ✓'; }
      catch (e) { const i = $('#mt5KeyShow'); i.value = LIVE.key; i.select(); ev.target.textContent = 'Sélectionnée : Ctrl+C'; }
      setTimeout(() => { ev.target.textContent = 'Copier la clé'; }, 2500);
    }
    if (id === 'mt5Forget' && confirm('Oublier la clé sur cet appareil ? Note-la avant si tu ne l\'as pas ailleurs (le robot MT5 continue de fonctionner).')) {
      store.del('td.mt5key'); LIVE.key = ''; LIVE.data = null; LIVE.trades = []; LIVE.bars = null; LIVE.barsAt = null; LIVE.err = '';
      renderMt5Settings(); renderFtmo(); renderLiveStatus(); renderLevels(); renderJournal(); renderSessionStats(); renderTrends();
    }
  });

  /* ---------- Réglages : règles FTMO ---------- */
  function renderFtmoSettings() {
    $('#fPhase').value = S.ftmo.phase; $('#fDaily').value = S.ftmo.daily; $('#fMax').value = S.ftmo.max;
    $('#fTarget').value = S.ftmo.target; $('#fInit').value = S.ftmo.init || ''; $('#sRiskBase').value = S.riskBase;
  }
  $('#fPhase').addEventListener('change', e => {
    S.ftmo.phase = e.target.value;
    S.ftmo.target = e.target.value === 'verification' ? 5 : e.target.value === 'funded' ? 0 : 10;
    saveSettings(); renderFtmoSettings(); renderFtmo();
  });
  [['#fDaily', 'daily'], ['#fMax', 'max'], ['#fTarget', 'target'], ['#fInit', 'init']].forEach(([sel, key]) => {
    $(sel).addEventListener('change', e => { const v = e.target.value === '' ? 0 : num(e.target.value); if (isFinite(v) && v >= 0) { S.ftmo[key] = v; saveSettings(); renderFtmo(); renderSessionStats(); renderPlan(); } });
  });
  $('#sRiskBase').addEventListener('change', e => { S.riskBase = e.target.value; saveSettings(); renderFtmo(); renderSessionStats(); renderPlan(); });
  renderFtmoSettings();

  /* =========================================================
     Tendance calculée sur les bougies MT5 (structure + EMA)
     ========================================================= */
  function emaArr(vals, n) {
    const k = 2 / (n + 1); let e = vals[0];
    return vals.map((v, i) => (i ? (e = v * k + e * (1 - k)) : e));
  }
  function pivots(bars, w) {
    const hs = [], ls = [];
    for (let i = w; i < bars.length - w; i++) {
      let isH = true, isL = true;
      for (let j = 1; j <= w; j++) {
        if (bars[i][2] <= bars[i - j][2] || bars[i][2] < bars[i + j][2]) isH = false;
        if (bars[i][3] >= bars[i - j][3] || bars[i][3] > bars[i + j][3]) isL = false;
      }
      if (isH) hs.push(bars[i][2]);
      if (isL) ls.push(bars[i][3]);
    }
    return { hs, ls };
  }
  function aggregate(bars, secs, off) {
    const out = []; let cur = null;
    for (const b of bars || []) {
      const key = Math.floor((b[0] + off) / secs);
      if (!cur || cur.k !== key) { if (cur) out.push(cur.b); cur = { k: key, b: b.slice(0, 5) }; }
      else { cur.b[2] = Math.max(cur.b[2], b[2]); cur.b[3] = Math.min(cur.b[3], b[3]); cur.b[4] = b[4]; }
    }
    if (cur) out.push(cur.b);
    return out;
  }
  function trendOf(bars) {
    if (!bars || bars.length < 30) return null;
    const closes = bars.map(b => b[4]);
    const e20 = emaArr(closes, 20), e50 = emaArr(closes, 50);
    const last = closes.length - 1, c = closes[last];
    const { hs, ls } = pivots(bars.slice(-80), 2);
    let st = 0, txt = 'structure indécise';
    if (hs.length >= 2 && ls.length >= 2) {
      const hh = hs[hs.length - 1] > hs[hs.length - 2], hl = ls[ls.length - 1] > ls[ls.length - 2];
      if (hh && hl) { st = 1; txt = 'plus hauts et plus bas croissants'; }
      else if (!hh && !hl) { st = -1; txt = 'plus hauts et plus bas décroissants'; }
      else txt = hh ? 'haut croissant mais bas décroissant' : 'haut décroissant mais bas croissant';
    }
    const lastH = hs[hs.length - 1], lastL = ls[ls.length - 1];
    if (lastH != null && c > lastH) { st = Math.max(st, 1); txt += ' · cassure du dernier haut'; }
    if (lastL != null && c < lastL) { st = Math.min(st, -1); txt += ' · cassure du dernier bas'; }
    const above = c > e50[last], up = e20[last] > e50[last];
    const score = st + (above ? 0.5 : -0.5) + (up ? 0.5 : -0.5);
    return {
      dir: score >= 1 ? 'bull' : score <= -1 ? 'bear' : 'range', score, txt,
      ema: `prix ${above ? 'au-dessus' : 'en dessous'} de l'EMA 50, EMA 20 ${up ? 'au-dessus' : 'en dessous'} de l'EMA 50`
    };
  }
  function trendsFor(k) {
    if (!LIVE.bars) return null;
    const sym = S.instruments[k].mt5; const B = LIVE.bars;
    const off = (account() && account().srv_off) || 0;
    const h1 = B[sym + '@H1'];
    const out = { D1: trendOf(B[sym + '@D1']), H4: trendOf(aggregate(h1, 14400, off)), H1: trendOf(h1), M15: trendOf(B[sym]) };
    return Object.values(out).some(Boolean) ? out : null;
  }
  const DIRW = { bull: 'Haussier', bear: 'Baissier', range: 'Range' };
  function renderTrends() {
    const card = $('#mt5TrendCard'), sug = $('#biasMt5');
    const T = { US100: trendsFor('US100'), SP500: trendsFor('SP500') };
    const any = T.US100 || T.SP500;
    if (!any) {
      const needEa = LIVE.bars && !Object.keys(LIVE.bars).some(x => x.endsWith('@H1'));
      card.innerHTML = `<h2>Tendance calculée sur MT5</h2><p class="muted" style="margin:0">${!LIVE.key ? 'Connecte MT5 (Réglages) pour calculer la tendance D1, H4, H1 et M15 sur les prix de ton compte FTMO.' : needEa ? 'Mets à jour le robot MT5 (version 1.01, Réglages > Connexion MT5) pour recevoir les bougies H1 et D1.' : 'En attente des bougies MT5…'}</p>`;
      sug.innerHTML = '';
      return;
    }
    const cell = t => t ? `<span class="tag ${t.dir}">${DIRW[t.dir]}</span><small class="muted" style="display:block;font-size:12px;margin-top:3px">${esc(t.txt)} · ${esc(t.ema)}</small>` : '<span class="muted">—</span>';
    card.innerHTML = `<h2>Tendance calculée sur MT5<span class="spacer"></span><button class="btn small" data-fillbias>Remplir le biais du jour</button></h2>
      <div class="tbl-wrap"><table style="min-width:560px"><thead><tr><th>UT</th><th>US100</th><th>SP500</th></tr></thead><tbody>
      ${TF.map(tf => `<tr><td class="mono">${tf}</td><td>${cell(T.US100 && T.US100[tf])}</td><td>${cell(T.SP500 && T.SP500[tf])}</td></tr>`).join('')}
      </tbody></table></div>
      <p class="hint">Calcul automatique sur les bougies de ton compte FTMO. La structure compare les deux derniers sommets et creux (pivots à 2 bougies) et repère les cassures. Les moyennes EMA 20 et 50 confirment. Ça reste une aide : valide toujours la structure toi-même sur le graphique.</p>`;
    const short = t => t ? `<span class="tag ${t.dir}">${DIRW[t.dir].slice(0, 4)}.</span>` : '—';
    sug.innerHTML = `<div class="row" style="margin-top:10px;font-size:13px;gap:6px"><span class="muted">MT5 propose :</span>
      US100 ${TF.map(tf => `<span class="mono" style="font-size:11px">${tf}</span> ${short(T.US100 && T.US100[tf])}`).join(' ')}
      · SP500 ${TF.map(tf => `<span class="mono" style="font-size:11px">${tf}</span> ${short(T.SP500 && T.SP500[tf])}`).join(' ')}
      <button class="btn small" data-fillbias>Remplir</button></div>`;
  }
  function fillBiasFromMt5() {
    let n = 0;
    for (const k of ['US100', 'SP500']) {
      const T = trendsFor(k); if (!T) continue;
      D.bias[k] = D.bias[k] || {};
      TF.forEach(tf => { if (T[tf]) { D.bias[k][tf] = T[tf].dir; n++; } });
    }
    if (n) { saveDay(); renderBias(); renderChecklist(); }
    return n;
  }
  document.addEventListener('click', ev => {
    if (!ev.target.closest('[data-fillbias]')) return;
    const n = fillBiasFromMt5();
    ev.target.textContent = n ? 'Biais rempli ✓' : 'Rien à remplir';
    setTimeout(() => renderTrends(), 1800);
  });

  /* =========================================================
     Rendu initial
     ========================================================= */
  function renderSeance() {
    const { y, m, d, wd } = DAY;
    $('#dayLabel').textContent = frDate(y, m, d, wd);
    $$('.midnightParis').forEach(el => { el.textContent = parisHM(zoned(TZN, y, m, d, 0, 0)); });
    renderBias(); renderLevels(); renderEvents(); renderSessionStats();
    $('#dayNotes').value = D.notes || '';
    lastMinute = -1; lastAlertsHtml = '';
    if (mounted.fonda) renderFonda();
  }
  $('#dayNotes').addEventListener('input', e => { D.notes = e.target.value; saveDay(); });

  if (!store.get(dayKey, null)) carryBias();
  renderSettings();
  initPlanInputs();
  renderSeance();
  clearJForm();
  renderPlan();
  tick();
  setInterval(tick, 1000);
  startLive();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { MODEL = buildDayModel(); lastMinute = -1; tick(); } });
  let startTab = 'seance';
  try { startTab = sessionStorage.getItem('td.tab') || 'seance'; } catch (e) {}
  showTab(startTab);

  // Exposé pour les tests
  window.__desk = { zoned, partsIn, nyseCalendar, recurringFor, buildDayModel: () => MODEL, TZN, TZP };
})();
