/* Desk US · Règle A : suivi en direct (Desk Key), journal des setups, suivi du test et règles.
   1.09 : or (XAUUSD) avec second trade, feu rouge des indices (journal, aujourd'hui, mon compte, suivi).
   Les actifs (profils) sont lus dans la base : ajouter un actif validé en backtest suffit pour qu'il apparaisse partout. */
(function () {
  'use strict';

  /* ================= Outils ================= */
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k, f) { try { const v = localStorage.getItem(k); return v == null ? f : JSON.parse(v); } catch (e) { return f; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* stockage indisponible */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* rien */ } }
  };
  const num = v => { const x = parseFloat(String(v).replace(',', '.')); return isFinite(x) ? x : NaN; };
  const fmtN = (v, d = 2) => isFinite(v) ? Number(v).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
  const fmtP = v => isFinite(v) ? Number(v).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
  const fmtR = v => isFinite(v) ? (v > 0 ? '+' : '') + fmtN(v, 2) + ' R' : '—';
  let CUR = store.get('td.cur', 'USD');
  const fmtM = v => isFinite(v) ? (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(Math.round(v)).toLocaleString('fr-FR') + ' ' + (CUR === 'EUR' ? '€' : CUR === 'USD' ? '$' : CUR) : '—';
  const fmtE = v => isFinite(v) ? Math.round(v).toLocaleString('fr-FR') + ' ' + (CUR === 'EUR' ? '€' : CUR === 'USD' ? '$' : CUR) : '—';
  const pct = v => isFinite(v) ? Math.round(v * 100) + ' %' : '—';
  const cls = v => v > 0 ? 'bull' : v < 0 ? 'bear' : '';
  const dur = ms => {
    const s = Math.max(0, Math.round(ms / 1000));
    if (s < 60) return s + ' s';
    const m = Math.floor(s / 60); if (m < 60) return m + ' min';
    const h = Math.floor(m / 60); return h + ' h ' + String(m % 60).padStart(2, '0');
  };

  /* ================= Fuseaux horaires ================= */
  const TZP = 'Europe/Paris', TZN = 'America/New_York';
  const fmtCache = {};
  function partsIn(tz, d) {
    const f = fmtCache[tz] || (fmtCache[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short' }));
    const o = {}; for (const p of f.formatToParts(d)) o[p.type] = p.value;
    return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour % 24, mi: +o.minute, s: +o.second, wd: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(o.weekday) };
  }
  function zoned(tz, y, m, d, h, mi) {
    const guess = Date.UTC(y, m - 1, d, h, mi);
    const p = partsIn(tz, new Date(guess));
    const off = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi) - guess;
    return new Date(guess - off);
  }
  const pad = n => String(n).padStart(2, '0');
  const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
  const hmIn = (tz, t) => { const p = partsIn(tz, t instanceof Date ? t : new Date(t * 1000)); return pad(p.h) + ':' + pad(p.mi); };
  const hmP = t => hmIn(TZP, t);
  const nyToday = () => { const p = partsIn(TZN, new Date()); return { y: p.y, m: p.m, d: p.d, wd: p.wd, str: ymd(p.y, p.m, p.d) }; };
  const JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
  const dateFr = s => { const [y, m, d] = s.split('-').map(Number); return JOURS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] + ' ' + pad(d) + '/' + pad(m); };
  function sessionTimes(y, m, d) {
    const T = (h, mi) => zoned(TZN, y, m, d, h, mi);
    return { pre: T(8, 0), open: T(9, 30), j950: T(9, 50), e10: T(10, 0), e11: T(11, 0), e12: T(12, 0), exit: T(13, 0) };
  }

  /* ================= Préférences ================= */
  const DEF = { tp: 3, risk: 1000, includeHist: false, ftmo: { phase: 'challenge', daily: 5, max: 10, target: 10, init: 0 } };
  const PREF = Object.assign({}, DEF, store.get('dk.pref', {}));
  PREF.ftmo = Object.assign({}, DEF.ftmo, PREF.ftmo || {});
  const savePref = () => store.set('dk.pref', PREF);
  const tpKey = () => String(PREF.tp);

  /* ================= Service (Supabase) ================= */
  const SB_URL = 'https://xakrdapoxthvvqpyjuji.supabase.co';
  const SB_KEY = 'sb_publishable_Hzn2bTrae-TflG_HCzLVWg_QYF4l0ec'; // clé publique par conception
  async function rpc(fn, args) {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SB_KEY }, body: JSON.stringify(args || {}) });
    const txt = await r.text();
    let body = null; try { body = txt ? JSON.parse(txt) : null; } catch (e) { /* texte brut */ }
    if (!r.ok) throw new Error((body && (body.message || body.hint)) || ('HTTP ' + r.status));
    return body;
  }
  const hex = buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  const sha256 = async txt => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt)));

  const LIVE = { key: store.get('td.mt5key', ''), data: null, trades: [], readAt: 0, err: '', n: 0, busy: false };
  let PROFILES = store.get('dk.profiles', []);   // profils tradables
  let COMBINED = store.get('dk.combined', null); // attentes pour l'ensemble
  let SETUPS = [];                                // [{profile, date, data, at}]
  let SETUPS_AT = 0;
  // lectures incrémentales : on ne télécharge que ce qui a changé (quota de transfert Supabase)
  const SINCE = { key: '', setups: 0, trades: 0, full: 0 };
  function sinceFor(key) { if (SINCE.key !== key || Date.now() - SINCE.full > 30 * 60 * 1000) { SINCE.key = key; SINCE.setups = 0; SINCE.trades = 0; SINCE.full = Date.now(); } }
  let EVENTS = [];

  function liveAge() { const d = LIVE.data; if (!d || !d.updated_at) return Infinity; return (d.now - d.updated_at) + (Date.now() - LIVE.readAt) / 1000; }
  const liveOn = () => liveAge() < 30;
  const account = () => (LIVE.data && LIVE.data.account) || null;
  const quoteFor = p => { const q = LIVE.data && LIVE.data.quotes; if (!q) return null; for (const s of p.symbols || []) if (q[s]) return q[s]; return null; };
  const profileForSym = sym => PROFILES.find(p => (p.symbols || []).some(s => s.toLowerCase() === String(sym).toLowerCase())) || null;
  const pColor = p => (p.rules && p.rules.color) || 'var(--accent)';
  const hasGold = () => PROFILES.some(p => p.rules && p.rules.entryEnd === '12:00');

  /* ================= Onglets ================= */
  function showTab(name) {
    $$('nav.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === name ? 'true' : 'false'));
    $$('section.tab').forEach(s => s.classList.toggle('active', s.id === 'tab-' + name));
    store.set('dk.tab', name);
    renderAll();
  }
  $$('nav.tabs button').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
  document.addEventListener('click', ev => { const g = ev.target.closest('[data-goto]'); if (g) showTab(g.dataset.goto); });
  const active = name => $('#tab-' + name).classList.contains('active');

  /* ================= Horloges et séance ================= */
  function sessionPhase(now) {
    const t = nyToday();
    if (t.wd === 0 || t.wd === 6) return { cls: 'off', label: 'Marché fermé (week-end)', phase: 'off' };
    const S = sessionTimes(t.y, t.m, t.d);
    if (now < S.pre) return { cls: 'off', label: 'Avant le pré-marché · ' + hmP(S.pre) + ' Paris', phase: 'before', next: S.pre };
    if (now < S.open) return { cls: 'warn', label: 'Pré-marché (liquidité) · ouverture ' + hmP(S.open), phase: 'pre', next: S.open };
    if (now < S.e10) return { cls: 'warn', label: 'Ouverture : Judas possible · entrées à ' + hmP(S.e10), phase: 'open', next: S.e10 };
    if (now < S.e11) return { cls: 'live', label: 'Fenêtre d\'entrée ouverte · jusqu\'à ' + hmP(S.e11) + (hasGold() ? ' (or : ' + hmP(S.e12) + ')' : ''), phase: 'entry', next: S.e11 };
    if (hasGold() && now < S.e12) return { cls: 'live', label: 'Entrées de l\'or jusqu\'à ' + hmP(S.e12) + ' · gestion des indices', phase: 'entry', next: S.e12 };
    if (now < S.exit) return { cls: 'warn', label: 'Gestion · sortie à ' + hmP(S.exit), phase: 'manage', next: S.exit };
    return { cls: 'off', label: 'Séance terminée', phase: 'done' };
  }
  function setPill(el, c, text) { el.className = 'pill ' + c; el.lastElementChild.textContent = text; }
  function tickClock() {
    const now = new Date();
    $('#clkParis').textContent = partsIn(TZP, now).h.toString().padStart(2, '0') + ':' + pad(partsIn(TZP, now).mi) + ':' + pad(partsIn(TZP, now).s);
    $('#clkNY').textContent = hmIn(TZN, now);
    const ph = sessionPhase(now);
    setPill($('#pillSession'), ph.cls, ph.label + (ph.next ? ' (' + dur(ph.next - now) + ')' : ''));
  }

  /* ================= Libellés des étapes ================= */
  const ETAT = {
    avant: ['off', 'Avant l\'ouverture'], pas_de_trade: ['off', 'Pas de trade aujourd\'hui'], judas: ['off', 'Attente du Judas'],
    cassure: ['warn', 'Judas fait · attente de la cassure'], pret: ['live', 'Setup prêt · ordre limite au 50 %'],
    rempli: ['info', 'Entrée touchée'], ignore: ['off', 'Touché avant 10:00 NY · pas de trade'],
    expire: ['off', 'Pas de remplissage dans la fenêtre'], pas_de_setup: ['off', 'Pas de setup']
  };
  const etatOf = d => ETAT[d.etat] || ['off', d.etat || '—'];
  const sens = v => v > 0 ? '<span class="tag bull">haussière</span>' : v < 0 ? '<span class="tag bear">baissière</span>' : '<span class="tag range">neutre</span>';
  const dirTag = v => v > 0 ? '<span class="tag bull">Achat</span>' : v < 0 ? '<span class="tag bear">Vente</span>' : '<span class="tag range">—</span>';
  // résultat de la règle au TP choisi ; or : trade 1 avec son stop remonté + second trade (s'il a été rempli)
  const s2Filled = d => !!(d && d.s2 && d.s2.etat === 'rempli' && isFinite(num(d.s2.r)) && isFinite(num(d.s2.t1)));
  const resOf = d => {
    if (!d || !d.res) return NaN;
    if (s2Filled(d) && num(d.s2.tpR || 3) === PREF.tp) return num(d.s2.t1) + num(d.s2.r);
    return num(d.res[tpKey()]);
  };
  // feu rouge des indices (Desk Key 1.09) : somme des 10 setups précédents à 3R
  const feuOf = d => d && d.feu ? { rouge: d.feu.c === 'rouge', s: num(d.feu.s), n: num(d.feu.n), on: d.feu.on !== false } : null;
  const sousRouge = d => { const f = feuOf(d); return !!(f && f.rouge); };
  const bloqueRouge = d => { const f = feuOf(d); return !!(f && f.rouge && f.on); };
  function feuTag(d, long) {
    const f = feuOf(d);
    if (!f) return long ? '' : '<span class="muted">—</span>';
    const t = `10 setups précédents : ${fmtR(f.s)}${f.n < 10 ? ' (' + f.n + ' seulement)' : ''}`;
    if (f.rouge) return `<span class="tag bear" style="white-space:nowrap" title="${esc(t)}">● Rouge</span>` + (long ? ` <small class="muted">${esc(t)} · ${f.on ? 'pas de trade, la règle est suivie à blanc' : 'feu désactivé dans Desk Key (prévenir seulement)'}</small>` : '');
    return `<span class="tag bull" style="white-space:nowrap" title="${esc(t)}">● Vert</span>` + (long ? ` <small class="muted">${esc(t)}</small>` : '');
  }
  // second trade de l'or : texte de l'étape
  function s2Text(d) {
    const s = d && d.s2; if (!s) return '';
    const lv = s.e ? `limite <span class="mono">${fmtP(s.e)}</span> · SL <span class="mono">${fmtP(s.sl)}</span> · TP <span class="mono">${fmtP(s.tp)}</span> (${fmtN(num(s.rr), 1)}R)` : '';
    if (s.etat === 'impulsion') return 'attente d\'une impulsion au-delà de la jambe du trade 1';
    if (s.etat === 'repli') return 'impulsion faite · attente d\'un repli au-dessus du stop 1';
    if (s.etat === 'cassure') return `repli à <span class="mono">${fmtP(s.pl)}</span> · attente d'une clôture au-delà de <span class="mono">${fmtP(s.sh)}</span>`;
    if (s.etat === 'pret') return 'prêt · ' + lv + ' · rempli avant 12:00 NY · au remplissage, le stop du trade 1 passe à <span class="mono">' + fmtP(s.sl) + '</span>';
    if (s.etat === 'rempli') return `rempli à ${hmP(s.fill)} · ${lv} · second trade <b class="${cls(num(s.r))}">${fmtR(num(s.r))}</b> · trade 1 avec stop remonté <b class="${cls(num(s.t1))}">${fmtR(num(s.t1))}</b>${s.fini ? '' : ' (en cours)'}`;
    return esc(s.info || 'pas de second trade');
  }
  function realOf(d, key) {
    key = key || 'pris';
    if (!d || !d[key]) return null;
    const row = LIVE.trades.find(t => t.data && String(t.data.id) === String(d[key].id));
    if (!row) return { open: true };
    const t = row.data, risk = t.sl > 0 ? Math.abs(t.pi - t.sl) : 0;
    return { r: risk > 0 ? (t.px - t.pi) * t.dir / risk : NaN, net: t.net, vol: t.vol, pi: t.pi, px: t.px };
  }
  // trades réels du jour : trade 1, plus le second trade de l'or
  function realAll(d) {
    const a = realOf(d), b = realOf(d, 'pris2');
    if (!a && !b) return null;
    if ((a && a.open) || (b && b.open)) return { open: true };
    const xs = [a, b].filter(Boolean);
    return { r: xs.reduce((x, y) => x + (isFinite(y.r) ? y.r : 0), 0), net: xs.reduce((x, y) => x + (y.net || 0), 0), vol: xs[0].vol, pi: xs[0].pi, px: xs[0].px, n: xs.length, t2: b };
  }
  const takenIds = () => { const m = new Map(); SETUPS.forEach(s => { if (s.data.pris) m.set(String(s.data.pris.id), s); if (s.data.pris2) m.set(String(s.data.pris2.id), s); }); return m; };
  const todaySetup = p => SETUPS.find(s => s.profile === p.id && s.date === nyToday().str);

  /* ================= Aujourd'hui ================= */
  function renderSession() {
    const now = new Date(), t = nyToday(), S = sessionTimes(t.y, t.m, t.d), ph = sessionPhase(now);
    const a = S.pre.getTime(), b = S.exit.getTime(), X = v => Math.max(0, Math.min(100, (v - a) / (b - a) * 100));
    const seg = (from, to, c, label) => `<div class="sbar-seg" style="left:${X(from)}%;width:${X(to) - X(from)}%;background:${c}" title="${esc(label)}"><span>${esc(label)}</span></div>`;
    const mark = (at, label) => `<div class="sbar-mark" style="left:${X(at)}%"><span>${esc(label)}</span></div>`;
    const nowPos = now >= S.pre && now <= S.exit ? `<div class="sbar-now" style="left:${X(now)}%"></div>` : '';
    $('#sessionCard').innerHTML = `
      <h2>Séance du ${dateFr(t.str)} (heure de Paris)<span class="spacer"></span><span class="tag ${ph.cls === 'live' ? 'bull' : 'range'}">${esc(ph.label)}</span></h2>
      <div class="sbar">${seg(S.pre, S.open, 'rgba(124,108,240,.35)', 'Pré-marché ' + hmP(S.pre) + '–' + hmP(S.open))}
        ${seg(S.open, S.e10, 'rgba(229,83,75,.22)', 'Judas')}
        ${seg(S.e10, S.e11, 'rgba(63,182,139,.35)', 'Entrées ' + hmP(S.e10) + '–' + hmP(S.e11))}
        ${seg(S.e11, S.exit, 'rgba(228,162,74,.22)', 'Gestion jusqu\'à ' + hmP(S.exit))}
        ${mark(S.j950, '9:50 NY (' + hmP(S.j950) + ')')}${hasGold() ? mark(S.e12, 'Or : fin des entrées ' + hmP(S.e12)) : ''}${nowPos}</div>
      <p class="hint">Règle commune : un sens par jour (tendance du profil), Judas sur le haut ou le bas du pré-marché, cassure M1, ordre limite au 50 % rempli entre ${hmP(S.e10)} et ${hmP(S.e11)} (${hmP(S.e12)} pour l'or), sortie ${hmP(S.exit)}. Si le 50 % est touché avant ${hmP(S.e10)}, pas de trade ce jour-là. Le repère 9:50 NY ne concerne que les profils avec « Judas après 9:50 ». US100 et SP500 : pas de trade sous feu rouge (10 derniers setups négatifs). Or : second trade possible jusqu'à ${hmP(S.e12)}, avec le stop du trade 1 remonté.</p>`;
  }

  function stepRow(ok, title, body) {
    return `<div class="step ${ok === true ? 'ok' : ok === false ? 'ko' : ''}"><b>${ok === true ? '✓' : ok === false ? '✕' : '·'}</b><div><span>${title}</span>${body ? `<small>${body}</small>` : ''}</div></div>`;
  }
  function profileCard(p) {
    const row = todaySetup(p), d = row ? row.data : null, q = quoteFor(p), r = p.rules || {};
    const head = `<h2><span class="dotc" style="background:${pColor(p)}"></span>${esc(p.name)}${q && q.bid ? `<span class="mono muted" style="text-transform:none;letter-spacing:0">${fmtP(q.bid)}</span>` : ''}<span class="spacer"></span>${d ? `<span class="pill ${etatOf(d)[0] === 'live' ? 'live' : etatOf(d)[0] === 'warn' ? 'warn' : etatOf(d)[0] === 'info' ? 'live' : 'off'}"><span class="dot"></span><span>${esc(etatOf(d)[1])}</span></span>` : ''}</h2>`;
    if (!d) {
      return `<div class="card c6">${head}<p class="muted" style="margin:0">Desk Key n'a rien envoyé aujourd'hui pour ${esc(p.name)}. Vérifiez qu'il tourne sur un graphique M1 ${esc((p.symbols || [])[0] || '')} (MT5 ouvert, « Autoriser le trading algorithmique » coché)${r.second ? ', en version 1.09 au moins (profil or)' : ''} et que le robot DeskUS_Bridge 1.05 est à jour. <button class="btn small" data-goto="reglages">Installer</button></p></div>`;
    }
    const trend = `H4 ${sens(d.h4)}${r.trend === 'H4+D1' ? ` · Daily ${sens(d.d1)}` : r.trend === 'H4|H1' ? ` · H1 ${sens(d.h1)} <small class="muted">(H4 ou H1, sans conflit)</small>` : ` · H1 ${sens(d.h1)}`}`;
    const dir = d.dir > 0 ? '<b class="bull">ACHATS uniquement</b>' : d.dir < 0 ? '<b class="bear">VENTES uniquement</b>' : `<b class="muted">Pas de trade : ${esc(d.raison || '')}</b>`;
    const steps = [];
    if (d.pre) steps.push(stepRow(true, 'Pré-marché', `haut <span class="mono">${fmtP(d.pre.hi)}</span> · bas <span class="mono">${fmtP(d.pre.lo)}</span>${d.dir ? ` · cible : le ${d.dir > 0 ? 'bas' : 'haut'}` : ''}`));
    if (d.dir) {
      steps.push(d.judas ? stepRow(true, 'Judas', `à ${hmP(d.judas.t)} · extrême <span class="mono">${fmtP(d.judas.ext)}</span> à ${hmP(d.judas.text)}`)
        : stepRow(null, 'Judas', `attendre un passage ${d.dir > 0 ? 'sous le bas' : 'au-dessus du haut'} du pré-marché`));
      const rule = r.judasAfterMin ? `fond du Judas après 9:50 NY` : r.breakMinR ? `cassure nette (≥ ${Math.round(r.breakMinR * 100)} % du risque)${r.fvg ? ' + FVG M1' : ''}` : '';
      steps.push(d.mss ? stepRow(true, 'Cassure M1', `à ${hmP(d.mss.t)} · niveau <span class="mono">${fmtP(d.mss.niveau)}</span>${r.breakMinR ? ` · +${fmtN(d.mss.pts, 1)} pts` : ''}${d.mss.fvg ? ' · FVG' : ''}`)
        : stepRow(d.info ? false : null, 'Cassure M1', esc(d.info || rule)));
      if (d.entry) {
        const tp = d.tp ? d.tp[tpKey()] : NaN;
        steps.push(stepRow(d.etat === 'rempli' ? true : null, `${d.dir > 0 ? 'Achat' : 'Vente'} limite`,
          `entrée <span class="mono">${fmtP(d.entry)}</span> · SL <span class="mono">${fmtP(d.sl)}</span> · TP ${PREF.tp}R <span class="mono">${fmtP(tp)}</span> · risque ${fmtN(d.risk, 1)} ${esc(r.unit || 'pts')}${d.lot ? ` · lot <b>${fmtN(d.lot, 2)}</b>` : ''}${d.fin ? ` · rempli avant ${hmP(d.fin)}` : ''}`));
      }
      if (d.s2) steps.push(stepRow(d.s2.etat === 'rempli' ? true : d.s2.etat === 'annule' ? false : null, 'Second trade', s2Text(d)));
    }
    let foot = '';
    const real = realAll(d);
    if (d.pris) foot += `<span class="tag mt5">Trade pris${d.pris2 ? ' + second trade' : ''}</span> ${real && !real.open ? `réel ${fmtR(real.r)} · ${fmtM(real.net)}` : 'en cours'}`;
    else if (d.ordre) foot += '<span class="tag mt5">Ordre placé</span>';
    if (d.ordre2) foot += ' <span class="tag mt5">Second trade placé</span>';
    if (bloqueRouge(d)) foot += ' <span class="tag bear">FEU ROUGE</span> <span class="muted">pas d\'ordre aujourd\'hui, la règle est suivie à blanc</span>';
    if (d.etat === 'rempli') foot += ` <span class="muted">Résultat de la règle (${PREF.tp}R) : <b class="${cls(resOf(d))}">${fmtR(resOf(d))}</b>${d.fini ? '' : ' (en cours)'}</span>`;
    if (d.auto) foot += ' <span class="tag bear">AUTO actif</span>';
    if (d.protection) foot += ' <span class="tag info">Protection annonces</span>';
    return `<div class="card c6">${head}
      <div class="muted" style="font-size:14px">Tendance : ${trend} → ${dir}</div>
      ${d.feu ? `<div style="font-size:14px;margin-top:4px">Feu : ${feuTag(d, true)}</div>` : ''}
      <div class="steps">${steps.join('')}</div>
      ${foot ? `<div style="margin-top:10px;font-size:14px">${foot}</div>` : ''}
      <p class="hint">Mis à jour il y a ${dur(Date.now() - row.at * 1000)} par Desk Key ${esc(d.v || '')}</p></div>`;
  }
  function renderProfiles() {
    if (!PROFILES.length) { $('#profileCards').innerHTML = '<div class="card c12 muted">Chargement des profils…</div>'; return; }
    if (!LIVE.key) { $('#profileCards').innerHTML = `<div class="card c12"><p class="muted" style="margin:0">Connectez MT5 pour voir le setup du jour de chaque indice (${PROFILES.map(p => esc(p.name)).join(', ')}). <button class="btn small" data-goto="reglages">Connecter MT5</button></p></div>`; return; }
    $('#profileCards').innerHTML = PROFILES.map(profileCard).join('');
  }
  function renderNews() {
    const t = nyToday();
    const todays = EVENTS.filter(e => e.date === t.str), next = EVENTS.filter(e => e.date > t.str).slice(0, 8);
    const line = e => {
      const [h, mi] = e.time.split(':').map(Number); const [y, m, d] = e.date.split('-').map(Number);
      const at = zoned(TZN, y, m, d, h, mi);
      const where = e.time === '10:00' ? '<span class="tag D">pendant la fenêtre d\'entrée</span>' : e.time === '08:30' ? '<span class="tag A">pendant le pré-marché</span>' : '';
      return `<tr><td class="mono">${e.date === t.str ? '' : dateFr(e.date) + ' '}${hmP(at)}</td><td>${esc(e.name)}</td><td>${where}</td></tr>`;
    };
    $('#newsCard').innerHTML = `<h2>Annonces économiques US</h2>
      ${todays.length ? `<table><tbody>${todays.map(line).join('')}</tbody></table>` : '<p class="muted" style="margin:0">Aucune annonce majeure aujourd\'hui.</p>'}
      ${next.length ? `<h3>Prochains jours</h3><table><tbody>${next.map(line).join('')}</tbody></table>` : ''}
      <p class="hint">Backtest : les annonces de 10:00 NY ne sont pas un motif de perte (elles sont même plutôt favorables au SP500). Elles ne changent pas la règle ; elles expliquent seulement une volatilité plus forte.</p><p class="hint">Compte FTMO financé (hors Swing) : activez la <b>protection annonces</b> dans Desk Key (bouton ANNONCES) pour qu'aucun ordre ne soit placé ni rempli de 2 min avant à 2 min après une annonce ; l'ordre est remis ensuite s'il est encore valide.</p>`;
  }

  /* ---------- Compte FTMO ---------- */
  function ftmoInit() { if (PREF.ftmo.init > 0) return PREF.ftmo.init; const a = account(); return a && a.init > 0 ? a.init : 100000; }
  function ftmoNumbers() {
    const a = account(); if (!a) return null;
    const init = ftmoInit(), dailyLimit = init * PREF.ftmo.daily / 100;
    const dayStart = isFinite(a.day_pl) ? a.bal - a.day_pl : (a.day_start || a.bal);
    const dayLoss = Math.max(0, dayStart - a.eq), dayLeft = dailyLimit - dayLoss;
    const floor = init * (1 - PREF.ftmo.max / 100), maxLeft = a.eq - floor;
    const target = PREF.ftmo.phase === 'funded' ? 0 : init * PREF.ftmo.target / 100;
    return { a, init, dailyLimit, dayStart, dayLoss, dayLeft, floor, maxLeft, target, progress: target > 0 ? (a.bal - init) / target : NaN };
  }
  const bar = (ratio, color) => `<div class="meter" style="height:8px"><i style="width:${Math.max(0, Math.min(1, ratio)) * 100}%;background:${color}"></i></div>`;
  function renderFtmo() {
    const card = $('#ftmoCard');
    if (!LIVE.key) { card.innerHTML = '<h2>Compte FTMO</h2><p class="muted" style="margin:0">Connectez MT5 pour voir le compte en direct. <button class="btn small" data-goto="reglages">Connecter MT5</button></p>'; return; }
    const F = ftmoNumbers();
    if (!F) { card.innerHTML = `<h2>Compte FTMO</h2><p class="muted" style="margin:0">En attente des données du robot DeskUS_Bridge… ${esc(LIVE.err)}</p>`; return; }
    const { a } = F, dayRes = a.eq - F.dayStart, used = F.dailyLimit > 0 ? F.dayLoss / F.dailyLimit : 0;
    const pos = (LIVE.data.positions || []);
    card.innerHTML = `<h2>Compte FTMO<span class="spacer"></span><span class="muted" style="text-transform:none;letter-spacing:0;font-weight:400">${liveOn() ? 'en direct' : 'dernière donnée il y a ' + dur(liveAge() * 1000)}</span></h2>
      <div class="res" style="margin-top:0">
        <div class="kpi"><small>Solde</small><b>${fmtE(a.bal)}</b></div>
        <div class="kpi"><small>Équité</small><b>${fmtE(a.eq)}</b></div>
        <div class="kpi"><small>Flottant</small><b class="${cls(a.pl)}">${fmtM(a.pl)}</b></div>
        <div class="kpi"><small>Résultat du jour</small><b class="${cls(dayRes)}">${fmtM(dayRes)}</b></div>
        <div class="kpi"><small>Marge avant la perte max</small><b>${fmtE(F.maxLeft)}</b></div>
      </div>
      <div class="grid" style="gap:14px;margin-top:14px">
        <div class="c4"><small class="muted">Perte du jour (max ${PREF.ftmo.daily} % = ${fmtE(F.dailyLimit)})</small>${bar(used, used > 0.7 ? 'var(--bear)' : used > 0.4 ? 'var(--accent)' : 'var(--bull)')}<div style="font-size:13px;margin-top:4px">Utilisé ${fmtE(F.dayLoss)} · il reste <b>${fmtE(F.dayLeft)}</b></div></div>
        <div class="c4"><small class="muted">Perte max (${PREF.ftmo.max} % · plancher ${fmtE(F.floor)})</small>${bar(1 - F.maxLeft / (F.init * PREF.ftmo.max / 100), 'var(--bull)')}</div>
        <div class="c4"><small class="muted">${F.target > 0 ? `Objectif +${PREF.ftmo.target} %` : 'Compte financé'}</small>${F.target > 0 ? bar(F.progress, 'var(--accent)') + `<div style="font-size:13px;margin-top:4px">Progression <b>${pct(Math.max(0, F.progress))}</b></div>` : ''}</div>
      </div>
      ${pos.length ? `<h3>Positions ouvertes</h3><div class="tbl-wrap"><table style="min-width:560px"><thead><tr><th>Actif</th><th>Sens</th><th>Lots</th><th>Entrée</th><th>SL</th><th>TP</th><th>P&amp;L</th></tr></thead><tbody>${pos.map(p => {
        const pf = profileForSym(p.sym);
        return `<tr><td>${esc(pf ? pf.name : p.sym)}</td><td>${dirTag(p.dir)}</td><td class="mono">${p.vol}</td><td class="mono">${fmtP(p.po)}</td><td class="mono">${p.sl ? fmtP(p.sl) : '<span style="color:var(--bear)">aucun</span>'}</td><td class="mono">${p.tp ? fmtP(p.tp) : '—'}</td><td class="${p.pl >= 0 ? 'r-pos' : 'r-neg'}">${fmtM(p.pl)}</td></tr>`;
      }).join('')}</tbody></table></div>` : ''}`;
  }

  /* ================= Mon compte ================= */
  // risque par trade : celui réglé dans Desk Key (envoyé avec le setup du jour), sinon celui des Réglages
  function riskNow() {
    const live = SETUPS.filter(s => s.data && s.data.live && num(s.data.rUsd) > 0).sort((a, b) => (b.date > a.date) - (b.date < a.date))[0];
    return live ? { usd: num(live.data.rUsd), src: 'Desk Key', mode: live.data.rMode, val: num(live.data.rVal) } : { usd: PREF.risk, src: 'Réglages', mode: 0, val: PREF.risk };
  }
  function timeSvg(series, fmtY, base, W) {
    W = Math.max(300, Math.round(W || 900)); const H = W < 600 ? 220 : 260, pl = 62, pr = 10, pt = 12, pb = 26;
    const all = series.flatMap(s => s.pts);
    if (all.length < 2) return '';
    const t0 = Math.min(...all.map(p => p[0])), t1 = Math.max(t0 + 3600, ...all.map(p => p[0]));
    let lo = Math.min(base, ...all.map(p => p[1])), hi = Math.max(base, ...all.map(p => p[1]));
    const padY = Math.max(1, (hi - lo) * 0.08); lo -= padY; hi += padY;
    const X = t => pl + (W - pl - pr) * (t - t0) / (t1 - t0), Y = v => pt + (H - pt - pb) * (hi - v) / (hi - lo);
    let g = `<line x1="${pl}" x2="${W - pr}" y1="${Y(base)}" y2="${Y(base)}" stroke="var(--line)" stroke-dasharray="4 4"/>`;
    const stepY = Math.pow(10, Math.floor(Math.log10((hi - lo) / 4))), k = Math.ceil((hi - lo) / 4 / stepY) * stepY;
    for (let v = Math.ceil(lo / k) * k; v <= hi; v += k) g += `<text x="${pl - 8}" y="${Y(v) + 4}" fill="var(--faint)" font-size="11" text-anchor="end">${esc(fmtY(v))}</text>`;
    for (let i = 0; i <= 4; i++) { const t = t0 + (t1 - t0) * i / 4, p = partsIn(TZP, new Date(t * 1000)); g += `<text x="${X(t)}" y="${H - 6}" fill="var(--faint)" font-size="11" text-anchor="${i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}">${pad(p.d)}/${pad(p.m)}</text>`; }
    series.forEach(s => {
      if (s.pts.length < 2) return;
      const d = s.step ? s.pts.map((p, i) => (i ? `L${X(p[0])},${Y(s.pts[i - 1][1])}L` : 'M') + X(p[0]) + ',' + Y(p[1])).join('') : 'M' + s.pts.map(p => X(p[0]) + ',' + Y(p[1])).join('L');
      g += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.w || 2}" ${s.dash ? `stroke-dasharray="${s.dash}"` : ''}/>`;
    });
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;max-width:${W}px">${g}</svg>`;
  }
  function renderCompte() {
    const box = $('#compteBody');
    if (!LIVE.key) { box.innerHTML = '<div class="card c12"><p class="muted" style="margin:0">Connectez MT5 (Réglages) pour suivre votre compte. <button class="btn small" data-goto="reglages">Connecter MT5</button></p></div>'; return; }
    const F = ftmoNumbers();
    if (!F) { box.innerHTML = `<div class="card c12"><p class="muted" style="margin:0">En attente des données du robot DeskUS_Bridge… ${esc(LIVE.err)}</p></div>`; return; }
    const a = F.a, init = F.init, total = a.eq - init, now = Date.now() / 1000;
    const trades = LIVE.trades.map(r => r.data).filter(t => t && isFinite(t.tc)).sort((x, y) => x.tc - y.tc);
    const linked = takenIds();
    const dkT = trades.filter(t => linked.has(String(t.id))), hoT = trades.filter(t => !linked.has(String(t.id)));
    const sum = (arr, f) => arr.reduce((x, y) => x + (f(y) || 0), 0);
    const dkNet = sum(dkT, t => t.net), hoNet = sum(hoT, t => t.net), other = total - dkNet - hoNet - (a.pl || 0);
    const R = riskNow();
    // --- KPIs
    const kpi = (l, v, c = '') => `<div class="kpi"><small>${l}</small><b class="${c}">${v}</b></div>`;
    const pctOf = v => (v >= 0 ? '+' : '−') + fmtN(Math.abs(v / init * 100), 2) + ' %';
    let html = `<div class="card c12"><h2>Mon compte<span class="spacer"></span><span class="muted" style="text-transform:none;letter-spacing:0;font-weight:400">${liveOn() ? 'en direct' : 'dernière donnée il y a ' + dur(liveAge() * 1000)}</span></h2>
      <div class="res" style="margin-top:0">${kpi('Capital de départ', fmtE(init))}${kpi('Équité', fmtE(a.eq))}${kpi('Total réel', fmtM(total) + ' <small>' + pctOf(total) + '</small>', cls(total))}${kpi('Résultat du jour', fmtM(a.eq - F.dayStart), cls(a.eq - F.dayStart))}</div>
      <h3>D'où vient le total</h3>
      <div class="res" style="margin-top:6px">${kpi('Trades Desk Key (' + dkT.length + ')', fmtM(dkNet), cls(dkNet))}${kpi('Trades hors Desk Key (' + hoT.length + ')', fmtM(hoNet), cls(hoNet))}${kpi('Flottant', fmtM(a.pl || 0), cls(a.pl))}${Math.abs(other) >= 1 ? kpi('Avant le suivi / ajustements', fmtM(other), cls(other)) : ''}</div>
      <p class="hint">Total réel = équité − capital de départ : il compte tout (trades Desk Key, trades à la main, frais, swaps). « Avant le suivi » = trades plus anciens que l'historique envoyé par DeskUS_Bridge.</p></div>`;
    // --- objectif et marges, au risque actuel
    const r = R.usd, need = F.target > 0 ? Math.max(0, init + F.target - a.bal) : NaN;
    const wins = r > 0 && isFinite(need) ? Math.ceil(need / (r * PREF.tp)) : NaN, losses = r > 0 ? Math.floor(F.maxLeft / r) : NaN, dayL = r > 0 ? Math.floor(F.dayLeft / r) : NaN;
    html += `<div class="card c12"><h2>Au risque actuel : ${fmtE(r)} par trade <small class="muted" style="text-transform:none;letter-spacing:0;font-weight:400">(${R.src === 'Desk Key' ? 'réglé dans Desk Key' : 'Réglages de l\'appli, en attendant Desk Key 1.06'} · ${fmtN(r / init * 100, 2)} % du capital)</small></h2>
      <div class="res" style="margin-top:0">${F.target > 0 ? kpi('Reste pour l\'objectif', fmtE(need)) + kpi('Gagnants à ' + PREF.tp + 'R nécessaires', isFinite(wins) ? wins : '—') : ''}${kpi('Pertes avant la perte max', isFinite(losses) ? losses : '—', losses <= 6 ? 'bear' : '')}${kpi('Pertes possibles aujourd\'hui', isFinite(dayL) ? Math.max(0, dayL) : '—', dayL < 2 ? 'bear' : '')}</div>
      <p class="hint">Backtest 3 ans (US100, SP500 et or, feu rouge sur les indices) : séries de 8 pertes d'affilée normales sur une année, 11 une année sur 10, 14 au pire une année sur 100 ; pire creux réel −13,6 R. Avec moins de pertes possibles que ça avant la perte max, le compte peut sauter sur une série normale. Les trois actifs peuvent perdre le même jour (pire journée réelle environ −3,5 R) : il faut au moins 3 à 4 pertes possibles sur la journée.</p></div>`;
    // --- courbes : equity réelle contre règle
    // la règle telle qu'elle se trade : entrées vues en direct, sauf celles sous feu rouge (pas de trade ces jours-là)
    const liveAll = SETUPS.filter(s => s.data.live && s.data.etat === 'rempli' && s.data.fini && isFinite(resOf(s.data)) && isFinite(s.data.fill)).sort((x, y) => x.data.fill - y.data.fill);
    const live = liveAll.filter(s => !bloqueRouge(s.data)), redSkip = liveAll.filter(s => bloqueRouge(s.data));
    const starts = [trades.length ? trades[0].to || trades[0].tc : Infinity, live.length ? live[0].data.fill : Infinity];
    const T0 = Math.min(...starts) - 3600;
    if (!isFinite(T0)) { box.innerHTML = html + '<div class="card c12"><h2>Mon equity contre la règle</h2><p class="muted" style="margin:0">Les courbes apparaîtront avec le premier trade clôturé ou la première entrée de la règle vue en direct par Desk Key.</p></div>'; return; }
    const inP = trades.filter(t => t.tc >= T0);
    let bal0 = a.bal - sum(inP, t => t.net), acc = bal0;
    const real = [[T0, bal0]]; inP.forEach(t => { acc += t.net; real.push([t.tc, acc]); }); real.push([now, a.eq]);
    let rv = bal0; const rule = [[T0, bal0]]; live.forEach(s => { rv += resOf(s.data) * r; rule.push([s.data.fill, rv]); }); rule.push([now, rv]);
    const notTaken = sum(live.filter(s => !s.data.pris), s => resOf(s.data) * r);
    const takenRule = sum(live.filter(s => s.data.pris), s => resOf(s.data) * r);
    const takenReal = sum(live.filter(s => s.data.pris), s => { const x = realAll(s.data); return x && !x.open ? x.net : 0; });
    // la règle au risque réellement pris sur chaque trade (pour séparer exécution et taille de position)
    const takenRuleReal = sum(live.filter(s => s.data.pris), s => { const x = realAll(s.data); const ru = x && !x.open && isFinite(x.r) && Math.abs(x.r) > 0.05 ? Math.abs(x.net / x.r) : r; return resOf(s.data) * ru; });
    const redSkipR = sum(redSkip, s => resOf(s.data) * r);
    const hoP = sum(inP.filter(t => !linked.has(String(t.id))), t => t.net);
    const gapReal = a.eq - bal0, gapRule = rv - bal0;
    html += `<div class="card c12"><h2>Mon equity contre la règle</h2>
      ${timeSvg([{ pts: rule, color: 'var(--accent)', w: 2, dash: '6 4', step: true }, { pts: real, color: 'var(--bull)', w: 2.4, step: true }], v => Math.round(v).toLocaleString('fr-FR'), bal0, box.clientWidth - 36)}
      <p class="hint" style="margin-top:0"><span class="dotc" style="background:var(--bull)"></span>Mon equity réelle &nbsp; <span class="dotc" style="background:var(--accent)"></span>La règle (entrées vues en direct par Desk Key × ${fmtE(r)}, objectif ${PREF.tp}R, sans les jours sous feu rouge) · depuis le ${dateFr(new Date(T0 * 1000).toISOString().slice(0, 10))}${redSkip.length ? ` · ${redSkip.length} entrée${redSkip.length > 1 ? 's' : ''} sous feu rouge non comptée${redSkip.length > 1 ? 's' : ''} (${fmtM(redSkipR)} évités)` : ''}</p>
      <div class="res">${kpi('Mon résultat', fmtM(gapReal), cls(gapReal))}${kpi('La règle', fmtM(gapRule), cls(gapRule))}${kpi('Écart', fmtM(gapReal - gapRule), cls(gapReal - gapRule))}</div>
      <h3>Explication de l'écart</h3>
      <div class="res" style="margin-top:6px">${kpi('Entrées de la règle non prises (' + live.filter(s => !s.data.pris).length + ')', fmtM(-notTaken), cls(-notTaken))}${kpi('Trades pris : exécution', fmtM(takenReal - takenRuleReal), cls(takenReal - takenRuleReal))}${Math.abs(takenRuleReal - takenRule) >= 1 ? kpi('Trades pris : risque ≠ ' + fmtE(r), fmtM(takenRuleReal - takenRule), cls(takenRuleReal - takenRule)) : ''}${kpi('Trades hors Desk Key', fmtM(hoP), cls(hoP))}${kpi('Flottant', fmtM(a.pl || 0), cls(a.pl))}</div>
      <p class="hint">« Exécution » : sur les trades pris, résultat réel moins résultat de la règle au même risque (glissement, spread, lot arrondi, sortie différente). « Risque ≠ » : ces trades ont été pris avec un autre risque que ${fmtE(r)}. La règle ne compte que les jours suivis en direct (pas l'historique recalculé). Or : trade 1 avec son stop remonté, plus le second trade quand il a été rempli. Sous feu rouge (feu actif dans Desk Key), l'entrée de la règle n'est ni comptée ni considérée comme ratée.</p></div>`;
    box.innerHTML = html;
  }

  /* ================= Journal ================= */
  function filteredSetups() {
    const prof = $('#jProfile').value, days = +$('#jPeriod').value, type = $('#jType').value;
    const t = nyToday(); const from = new Date(Date.UTC(t.y, t.m - 1, t.d) - days * 86400000).toISOString().slice(0, 10);
    return SETUPS.filter(s => (prof === 'all' || s.profile === prof) && s.date >= from).filter(s => {
      const d = s.data;
      if (type === 'setup') return !!d.entry;
      if (type === 'filled') return d.etat === 'rempli';
      if (type === 'taken') return !!d.pris;
      if (type === 'missed') return d.etat === 'rempli' && !d.pris && !bloqueRouge(d);
      if (type === 'green') return !!d.feu && !sousRouge(d);
      if (type === 'red') return sousRouge(d);
      return true;
    });
  }
  let openRow = null;
  function renderJournal() {
    const sel = $('#jProfile');
    if (sel.options.length !== PROFILES.length + 1) {
      const v = sel.value || 'all';
      sel.innerHTML = '<option value="all">Tous les actifs</option>' + PROFILES.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
      sel.value = v;
    }
    if (!LIVE.key) { $('#jTable').innerHTML = ''; $('#jSummary').innerHTML = '<p class="muted">Connectez MT5 (Réglages) pour recevoir les setups de Desk Key.</p>'; $('#otherTradesCard').innerHTML = ''; return; }
    const rows = filteredSetups();
    const filled = rows.filter(s => s.data.etat === 'rempli' && s.data.fini);
    const wins = filled.filter(s => resOf(s.data) > 0).length, sumR = filled.reduce((a, s) => a + (resOf(s.data) || 0), 0);
    const taken = rows.filter(s => s.data.pris), reals = taken.map(s => realAll(s.data)).filter(x => x && !x.open);
    const realR = reals.reduce((a, x) => a + (isFinite(x.r) ? x.r : 0), 0), realNet = reals.reduce((a, x) => a + (x.net || 0), 0);
    const redDays = rows.filter(s => sousRouge(s.data)).length, traded = filled.filter(s => !bloqueRouge(s.data));
    const tradedR = traded.reduce((a, s) => a + (resOf(s.data) || 0), 0);
    $('#jSummary').innerHTML = `
      <div class="kpi"><small>Jours</small><b>${rows.length}</b></div>
      <div class="kpi"><small>Setups validés</small><b>${rows.filter(s => s.data.entry).length}</b></div>
      <div class="kpi"><small>Entrées touchées</small><b>${filled.length}</b></div>
      <div class="kpi"><small>Win rate règle (${PREF.tp}R)</small><b>${filled.length ? pct(wins / filled.length) : '—'}</b></div>
      <div class="kpi"><small>Règle (${PREF.tp}R)</small><b class="${cls(sumR)}">${fmtR(sumR)}</b></div>
      <div class="kpi"><small>Équivalent à ${fmtE(PREF.risk)} / trade</small><b class="${cls(sumR)}">${fmtM(sumR * PREF.risk)}</b></div>
      ${redDays ? `<div class="kpi"><small>Jours sous feu rouge</small><b>${redDays}</b></div><div class="kpi"><small>Règle telle que tradée (sans le feu rouge)</small><b class="${cls(tradedR)}">${fmtR(tradedR)}</b></div>` : ''}
      <div class="kpi"><small>Trades pris</small><b>${taken.length}</b></div>
      <div class="kpi"><small>Résultat réel</small><b class="${cls(realNet)}">${reals.length ? fmtM(realNet) : '—'}</b></div>`;
    const pname = id => { const p = PROFILES.find(x => x.id === id); return p ? `<span class="dotc" style="background:${pColor(p)}"></span>${esc(p.name)}` : esc(id); };
    const body = rows.map(s => {
      const d = s.data, e = etatOf(d), res = resOf(d), real = realAll(d), key = s.profile + '|' + s.date;
      const pf = PROFILES.find(x => x.id === s.profile), unit = esc((pf && pf.rules && pf.rules.unit) || 'pts');
      const tp = d.tp ? d.tp[tpKey()] : NaN;
      const main = `<tr class="jrow" data-k="${esc(key)}">
        <td class="mono">${dateFr(s.date)}</td><td>${pname(s.profile)}</td><td>${dirTag(d.dir)}</td><td>${feuTag(d)}</td>
        <td><span class="tag ${e[0] === 'live' || e[0] === 'info' ? 'bull' : e[0] === 'warn' ? 'D' : 'range'}">${esc(e[1])}</span>${d.etat === 'pas_de_trade' && d.raison ? ` <small class="muted">${esc(d.raison)}</small>` : ''}${d.live ? '' : ' <small class="muted" title="calculé après coup par Desk Key">histo</small>'}</td>
        <td class="mono">${d.entry ? fmtP(d.entry) : '—'}</td><td class="mono">${d.sl ? fmtP(d.sl) : '—'}</td><td class="mono">${isFinite(tp) ? fmtP(tp) : '—'}</td>
        <td class="${res > 0 ? 'r-pos' : res < 0 ? 'r-neg' : 'r-zero'}">${d.etat === 'rempli' ? fmtR(res) + (d.fini && (!s2Filled(d) || d.s2.fini) ? '' : ' …') + (s2Filled(d) ? ' <small class="muted" title="trade 1 avec stop remonté + second trade">2 trades</small>' : '') : '—'}</td>
        <td>${d.pris ? (real && !real.open ? `<span class="${real.r >= 0 ? 'r-pos' : 'r-neg'}">${fmtR(real.r)} · ${fmtM(real.net)}</span>${real.n > 1 ? ' <small class="muted">2 trades</small>' : ''}` : '<span class="tag mt5">en cours</span>') : d.etat === 'rempli' ? (bloqueRouge(d) ? '<span class="muted">feu rouge</span>' : '<span class="muted">non pris</span>') : ''}</td></tr>`;
      if (openRow !== key) return main;
      const tr = v => isFinite(v) ? fmtR(v) : '—';
      return main + `<tr class="jdetail"><td colspan="10"><div class="steps">
        ${stepRow(null, 'Tendance', `H4 ${sens(d.h4)} · Daily ${sens(d.d1)} · H1 ${sens(d.h1)}${d.raison ? ' · ' + esc(d.raison) : ''}`)}
        ${d.feu ? stepRow(sousRouge(d) ? false : true, 'Feu', feuTag(d, true)) : ''}
        ${d.pre ? stepRow(null, 'Pré-marché', `haut <span class="mono">${fmtP(d.pre.hi)}</span> · bas <span class="mono">${fmtP(d.pre.lo)}</span>`) : ''}
        ${d.judas ? stepRow(true, 'Judas', `à ${hmP(d.judas.t)} · extrême <span class="mono">${fmtP(d.judas.ext)}</span> à ${hmP(d.judas.text)}`) : ''}
        ${d.mss ? stepRow(true, 'Cassure M1', `à ${hmP(d.mss.t)} · niveau <span class="mono">${fmtP(d.mss.niveau)}</span> · +${fmtN(d.mss.pts, 1)} ${unit}${d.mss.fvg ? ' · FVG' : ''}`) : d.info ? stepRow(false, 'Cassure', esc(d.info)) : ''}
        ${d.entry ? stepRow(d.etat === 'rempli', 'Ordre', `entrée <span class="mono">${fmtP(d.entry)}</span> · SL <span class="mono">${fmtP(d.sl)}</span> · risque ${fmtN(d.risk, 1)} ${unit} · TP 2R <span class="mono">${fmtP(d.tp && d.tp['2'])}</span> · 2,5R <span class="mono">${fmtP(d.tp && d.tp['2.5'])}</span> · 3R <span class="mono">${fmtP(d.tp && d.tp['3'])}</span>${d.fill ? ` · touché à ${hmP(d.fill)}` : ''}`) : ''}
        ${d.res ? stepRow(null, 'Résultat de la règle', `2R ${tr(num(d.res['2']))} · 2,5R ${tr(num(d.res['2.5']))} · 3R ${tr(num(d.res['3']))}${s2Filled(d) ? ' (trade 1 seul, sans second trade)' : ''}`) : ''}
        ${d.s2 ? stepRow(d.s2.etat === 'rempli' ? true : d.s2.etat === 'annule' ? false : null, 'Second trade', s2Text(d)) : ''}
        ${s2Filled(d) ? stepRow(null, 'Or : résultat des 2 trades', `trade 1 avec stop remonté ${tr(num(d.s2.t1))} + second trade ${tr(num(d.s2.r))} = <b>${tr(num(d.s2.t1) + num(d.s2.r))}</b>`) : ''}
        ${d.pris ? stepRow(null, 'Trade réel', (() => { const a = realOf(d); return a && !a.open ? `${fmtN(a.vol, 2)} lot · entrée <span class="mono">${fmtP(a.pi)}</span> · sortie <span class="mono">${fmtP(a.px)}</span> · ${fmtR(a.r)} · ${fmtM(a.net)}` : 'position ouverte'; })()) : ''}
        ${d.pris2 ? stepRow(null, 'Second trade réel', (() => { const b = realOf(d, 'pris2'); return b && !b.open ? `${fmtN(b.vol, 2)} lot · entrée <span class="mono">${fmtP(b.pi)}</span> · sortie <span class="mono">${fmtP(b.px)}</span> · ${fmtR(b.r)} · ${fmtM(b.net)}` : 'position ouverte'; })()) : ''}
      </div></td></tr>`;
    }).join('');
    $('#jTable').innerHTML = rows.length ? `<thead><tr><th>Date</th><th>Actif</th><th>Sens</th><th title="feu rouge de l'indice ce jour-là">Feu</th><th>Étape</th><th>Entrée</th><th>SL</th><th>TP ${PREF.tp}R</th><th>Règle</th><th>Trade réel</th></tr></thead><tbody>${body}</tbody>`
      : '<tbody><tr><td class="muted">Aucun setup sur cette période. Desk Key envoie les 7 derniers jours dès son installation, puis chaque séance.</td></tr></tbody>';
    // trades MT5 hors Desk Key
    const linked = takenIds();
    const others = LIVE.trades.map(r => r.data).filter(t => t && !linked.has(String(t.id))).slice(0, 50);
    $('#otherTradesCard').innerHTML = `<h2>Trades MT5 hors Desk Key</h2>` + (others.length ? `<div class="tbl-wrap"><table><thead><tr><th>Date</th><th>Symbole</th><th>Sens</th><th>Lots</th><th>Entrée</th><th>Sortie</th><th>SL</th><th>Net</th></tr></thead><tbody>${others.map(t => {
      const p = partsIn(TZP, new Date(t.to * 1000));
      return `<tr><td class="mono">${pad(p.d)}/${pad(p.m)} ${pad(p.h)}:${pad(p.mi)}</td><td>${esc(t.sym)}</td><td>${dirTag(t.dir)}</td><td class="mono">${t.vol}</td><td class="mono">${fmtP(t.pi)}</td><td class="mono">${fmtP(t.px)}</td><td class="mono">${t.sl ? fmtP(t.sl) : '—'}</td><td class="${t.net >= 0 ? 'r-pos' : 'r-neg'}">${fmtM(t.net)}</td></tr>`;
    }).join('')}</tbody></table></div>` : '<p class="muted" style="margin:0">Aucun : tous les trades clôturés sont reliés à un setup Desk Key.</p>');
  }
  $('#jTable').addEventListener('click', ev => { const tr = ev.target.closest('tr.jrow'); if (!tr) return; openRow = openRow === tr.dataset.k ? null : tr.dataset.k; renderJournal(); });
  ['#jProfile', '#jPeriod', '#jType'].forEach(s => $(s).addEventListener('change', renderJournal));
  $('#jCsv').addEventListener('click', () => {
    const head = ['date', 'actif', 'sens', 'feu', 'feu_10_setups_R', 'etape', 'raison', 'entree', 'sl', 'tp2', 'tp2.5', 'tp3', 'risque_pts', 'judas', 'cassure', 'touche', 'regle_2R', 'regle_2.5R', 'regle_3R', 'or_2e_trade_entree', 'or_2e_trade_sl', 'or_2e_trade_R', 'or_trade1_stop_remonte_R', 'regle_retenue_R', 'pris', 'reel_R', 'reel_net'];
    const lines = filteredSetups().map(s => {
      const d = s.data, real = realAll(d) || {}, t = v => v ? hmP(v) : '', f = feuOf(d), s2 = d.s2 || {};
      return [s.date, s.profile, d.dir, f ? (f.rouge ? 'rouge' : 'vert') : '', f ? f.s : '', d.etat, d.raison || d.info || '', d.entry, d.sl, d.tp && d.tp['2'], d.tp && d.tp['2.5'], d.tp && d.tp['3'], d.risk, d.judas ? t(d.judas.t) : '', d.mss ? t(d.mss.t) : '', t(d.fill), d.res && d.res['2'], d.res && d.res['2.5'], d.res && d.res['3'],
        s2.etat === 'rempli' ? s2.e : '', s2.etat === 'rempli' ? s2.sl : '', s2.etat === 'rempli' ? s2.r : '', s2.etat === 'rempli' ? s2.t1 : '', d.etat === 'rempli' && isFinite(resOf(d)) ? resOf(d).toFixed(2) : '', d.pris ? (d.pris2 ? 'oui (2 trades)' : 'oui') : '', isFinite(real.r) ? real.r.toFixed(2) : '', real.net != null ? real.net : '']
        .map(v => v == null ? '' : /[;"\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v)).join(';');
    });
    const blob = new Blob(['﻿' + head.join(';') + '\n' + lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'desk-us-setups.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });

  /* ================= Suivi du test ================= */
  function seriesFor(ids) {
    const rows = SETUPS.filter(s => ids.includes(s.profile) && s.data.etat === 'rempli' && s.data.fini && (PREF.includeHist || s.data.live))
      .slice().sort((a, b) => (a.data.fill || 0) - (b.data.fill || 0));
    let eq = 0, pk = 0, dd = 0, cur = 0, maxL = 0;
    const pts = [0];
    rows.forEach(s => { const r = resOf(s.data) || 0; eq += r; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); if (r > 0) cur = 0; else { cur++; maxL = Math.max(maxL, cur); } pts.push(eq); });
    const wins = rows.filter(s => resOf(s.data) > 0).length;
    const first = rows.length ? rows[0].date : null, last = rows.length ? rows[rows.length - 1].date : null;
    const months = first ? Math.max(1, (Date.parse(last) - Date.parse(first)) / (30.4 * 86400000)) : 0;
    const taken = rows.filter(s => s.data.pris), reals = taken.map(s => realAll(s.data)).filter(x => x && !x.open);
    const eqVert = rows.filter(s => !bloqueRouge(s.data)).reduce((a, s) => a + (resOf(s.data) || 0), 0), nRouge = rows.filter(s => sousRouge(s.data)).length;
    return { rows, n: rows.length, eq, dd, cur, maxL, win: rows.length ? wins / rows.length : NaN, mean: rows.length ? eq / rows.length : NaN, perMonth: months ? rows.length / months : NaN, pts, first, eqVert, nRouge,
      taken: taken.length, realR: reals.reduce((a, x) => a + (isFinite(x.r) ? x.r : 0), 0), realNet: reals.reduce((a, x) => a + (x.net || 0), 0) };
  }
  function verdict(st, ex) {
    if (!ex || !st.n) return ['range', 'pas encore de données'];
    if (st.dd <= ex.ddAlarm || st.cur >= ex.lsAlarm) return ['bear', 'ALARME : hors des bornes du backtest, arrêter et analyser'];
    if (st.dd <= ex.dd10 || st.cur >= ex.ls90) return ['D', 'à surveiller : creux ou série dans les 10 % les plus durs attendus'];
    return ['bull', 'dans la norme du backtest'];
  }
  function equitySvg(series) {
    const W = 900, H = 200, pl = 40, pr = 10, pt = 10, pb = 20;
    const all = series.flatMap(s => s.pts); const lo = Math.min(-2, ...all), hi = Math.max(2, ...all);
    const n = Math.max(2, ...series.map(s => s.pts.length));
    const X = i => pl + (W - pl - pr) * i / (n - 1), Y = v => pt + (H - pt - pb) * (hi - v) / (hi - lo);
    let g = `<line x1="${pl}" x2="${W - pr}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--line)"/>`;
    for (let v = Math.ceil(lo / 5) * 5; v <= hi; v += 5) g += `<text x="${pl - 6}" y="${Y(v) + 4}" fill="var(--faint)" font-size="11" text-anchor="end">${v} R</text>`;
    series.forEach(s => { if (s.pts.length > 1) g += `<path d="M${s.pts.map((v, i) => X(i) + ',' + Y(v)).join('L')}" fill="none" stroke="${s.color}" stroke-width="${s.w || 2}" opacity="${s.op || 1}"/>`; });
    return `<svg viewBox="0 0 ${W} ${H}" class="equity" preserveAspectRatio="none" style="height:200px">${g}</svg>`;
  }
  function renderSuivi() {
    $('#sHist').checked = !!PREF.includeHist;
    if (!LIVE.key) { $('#suiviBody').innerHTML = '<p class="muted">Connectez MT5 (Réglages) pour suivre le test.</p>'; return; }
    const groups = PROFILES.map(p => ({ id: p.id, name: p.name, color: pColor(p), ids: [p.id], ex: p.stats && p.stats.expect, bt: p.stats }));
    if (PROFILES.length > 1 && COMBINED) groups.push({ id: '_all', name: 'Ensemble', color: 'var(--fg)', ids: PROFILES.map(p => p.id), ex: COMBINED.expect, bt: COMBINED });
    const stats = groups.map(g => Object.assign({ g }, seriesFor(g.ids)));
    if (!stats.some(s => s.n)) {
      $('#suiviBody').innerHTML = `<p class="muted" style="margin:0">Le suivi démarre avec la première entrée touchée observée en direct par Desk Key. ${PREF.includeHist ? '' : 'Cochez « inclure l\'historique » pour voir aussi les 7 jours envoyés à l\'installation.'}</p>`;
      return;
    }
    const rowsHtml = stats.map(s => {
      const ex = s.g.ex || {}, v = verdict(s, ex);
      const today = s.g.id !== '_all' ? SETUPS.find(x => x.profile === s.g.id && x.date === nyToday().str) : null;
      return `<tr><td><span class="dotc" style="background:${s.g.color}"></span><b>${esc(s.g.name)}</b>${today && today.data.feu ? '<br>' + feuTag(today.data) : ''}</td>
        <td class="mono">${s.n}${isFinite(s.perMonth) ? ` <small class="muted">(${fmtN(s.perMonth, 1)}/mois)</small>` : ''}</td>
        <td class="mono">${pct(s.win)} <small class="muted">bt ${s.g.bt && s.g.bt['win' + (PREF.tp === 2.5 ? '25' : PREF.tp)] != null ? s.g.bt['win' + (PREF.tp === 2.5 ? '25' : PREF.tp)] + ' %' : '—'}</small></td>
        <td class="mono ${cls(s.mean)}">${fmtR(s.mean)} <small class="muted">bt ${ex.meanR != null ? fmtN(ex.meanR, 2) : '—'}</small></td>
        <td class="mono ${cls(s.eq)}">${fmtR(s.eq)}<br><small class="muted">${fmtM(s.eq * PREF.risk)}</small>${s.nRouge ? `<br><small class="${cls(s.eqVert)}" title="sans les entrées sous feu rouge">tradé : ${fmtR(s.eqVert)}</small>` : ''}</td>
        <td class="mono">${s.cur} <small class="muted">(max ${s.maxL} · normal ≤ ${ex.ls90 ?? '—'} · alarme ${ex.lsAlarm ?? '—'})</small></td>
        <td class="mono">${fmtN(s.dd, 1)} R <small class="muted">(normal ≥ ${ex.dd10 ?? '—'} · alarme ${ex.ddAlarm ?? '—'})</small></td>
        <td class="mono">${s.taken}${s.taken ? `<br><small class="${cls(s.realNet)}">${fmtM(s.realNet)}</small>` : ''}</td>
        <td><span class="tag ${v[0]}">${esc(v[1])}</span></td></tr>`;
    }).join('');
    $('#suiviBody').innerHTML = `
      <div class="tbl-wrap"><table style="min-width:1080px"><thead><tr><th>Groupe</th><th>Entrées</th><th>Win rate (${PREF.tp}R)</th><th>R moyen</th><th>Total</th><th>Pertes d'affilée</th><th>Creux</th><th>Pris</th><th>Verdict</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>
      <h3>Courbe de la règle en R (${PREF.tp}R)</h3>
      ${equitySvg(stats.slice().sort((x, y) => (y.g.id === '_all') - (x.g.id === '_all')).map(s => ({ pts: s.pts, color: s.g.color, w: s.g.id === '_all' ? 3 : 1.8, op: s.g.id === '_all' ? 0.45 : 1 })))}
      <p class="hint" style="margin-top:0">${stats.map(s => `<span class="dotc" style="background:${s.g.color}"></span>${esc(s.g.name)}`).join(' &nbsp; ')} · axe horizontal : entrées successives de chaque groupe.</p>
      <p class="hint">« Entrées » = jours où le 50 % a été touché dans la fenêtre d'entrée (10:00–11:00 NY, 12:00 NY pour l'or ; résultat simulé par Desk Key, comme le backtest, que vous ayez pris le trade ou non ; or : trade 1 avec stop remonté + second trade). Les entrées sous feu rouge restent comptées ici (c'est la règle elle-même qu'on surveille) ; « tradé » = sans elles. Bornes « normal » et « alarme » : simulations de 10 000 années à partir du backtest sur 3 ans (1 année sur 10 et 1 sur 100). Un creux ou une série dans la zone normale ne remet pas la règle en cause.</p>`;
  }
  $('#sHist').addEventListener('change', e => { PREF.includeHist = e.target.checked; savePref(); renderSuivi(); });

  /* ================= Règles ================= */
  const COMMON = ['Toujours en heure de New York : ouverture 9:30 NY (15:30 Paris, 14:30 pendant les semaines de décalage horaire).',
    'Liquidité : haut et bas du pré-marché (8:00–9:30 NY). Un seul sens par jour, fixé à 9:25 NY par la tendance du profil.',
    'Judas : après 9:30 NY, passage sous le bas (achat) ou au-dessus du haut (vente) du pré-marché.',
    'Cassure M1 : clôture au-delà du dernier sommet (creux) pivot de 2 bougies formé avant l\'extrême du Judas.',
    'Ordre limite au 50 % du Fibo (Judas = 0 %, plus haut de la jambe = 100 %, retracé tant que la jambe s\'allonge).',
    'Remplissage entre 10:00 et 11:00 NY (12:00 NY pour l\'or) ; touché avant 10:00 = pas de trade ; pas de remplissage à la fin de la fenêtre = annulé.',
    'Stop derrière le Judas (marge du profil), objectif en R (3R de référence), sortie à 13:00 NY. Un trade par actif et par jour (plus le second trade de l\'or).'];
  function renderRules() {
    const statKpis = s => `<div class="res" style="margin-top:8px">
      <div class="kpi"><small>Trades</small><b>${s.trades ?? '—'}</b></div><div class="kpi"><small>% des jours</small><b>${s.pctDays != null ? s.pctDays + ' %' : '—'}</b></div>
      <div class="kpi"><small>Win rate 2R / 3R</small><b>${s.win2 ?? '—'} / ${s.win3 ?? '—'} %</b></div>
      <div class="kpi"><small>Résultat 3R</small><b class="bull">${s.usd3 != null ? '+' + Math.round(s.usd3).toLocaleString('fr-FR') + ' $' : '—'}</b></div>
      <div class="kpi"><small>Pire baisse</small><b class="bear">${s.dd3 != null ? Math.round(s.dd3).toLocaleString('fr-FR') + ' $' : '—'}</b></div></div>`;
    const usd = v => `${v >= 0 ? '+' : '−'}${Math.abs(v).toLocaleString('fr-FR')} $`;
    const monthly = (m, head) => m && m.length ? `<div class="tbl-wrap"><table style="min-width:420px"><thead><tr><th>${head || 'Mois'}</th><th>Trades</th><th>Win rate 3R</th><th>Résultat 3R</th></tr></thead><tbody>${m.map(r => `<tr><td class="mono">${r[0]}</td><td class="mono">${r[1]}</td><td class="mono">${r[2]} %</td><td class="${r[3] >= 0 ? 'r-pos' : 'r-neg'}">${usd(r[3])}</td></tr>`).join('')}</tbody></table></div>` : '';
    const lightLine = l => l ? `<p class="hint">Avec le feu rouge : ${l.trades} trades, ${usd(l.usd3)} au lieu du total ci-dessus, pire baisse ${usd(l.dd3)} ; par année ${l.yearly.map(y => y[0] + ' ' + usd(y[1])).join(' · ')}.</p>` : '';
    $('#rulesBody').innerHTML = `<div class="card c12"><h2>Règle A · commun à tous les actifs</h2><ol class="stack" style="margin:0;padding-left:18px;font-size:14px">${COMMON.map(t => `<li>${esc(t)}</li>`).join('')}</ol>
      <p class="hint">Résultats de backtest pour 1 000 $ de risque par trade, vraies bougies M1 FTMO${PROFILES[0] && PROFILES[0].stats.period ? ' (' + esc(PROFILES[0].stats.period) + ')' : ''}.</p></div>
      <div class="card c12"><h2>Feu rouge · US100 et SP500</h2><ul class="stack" style="margin:0;padding-left:18px;font-size:14px">
        <li>Chaque matin, Desk Key additionne le résultat des 10 derniers setups de l'indice (entrées touchées, à 3R, pris ou non).</li>
        <li>Somme négative : <b>feu rouge</b>, pas de trade sur cet indice ; la règle continue d'être suivie à blanc. Somme positive ou nulle : feu vert. Le retour au vert est automatique.</li>
        <li>Pas de feu rouge sur l'or : sur 3 ans, il lui fait perdre plus qu'il ne protège.</li>
        <li>Désactivable dans Desk Key (bouton FEU ROUGE ou paramètre) : Desk Key prévient alors seulement.</li></ul>
        <p class="hint">Backtest 3 ans : US100 +53 → +59 R, pire creux −24,7 → −10,0 R ; SP500 +39 → +39 R, creux −10,5 → −5,1 R. Le journal indique pour chaque jour si l'indice était sous feu vert ou rouge.</p></div>` +
      PROFILES.map(p => `<div class="card c6"><h2><span class="dotc" style="background:${pColor(p)}"></span>${esc(p.name)}<span class="spacer"></span><span class="muted mono" style="text-transform:none;letter-spacing:0">${esc((p.symbols || []).join(' · '))}</span></h2>
        <ul class="stack" style="margin:0;padding-left:18px;font-size:14px">${((p.rules && p.rules.items) || []).map(t => `<li>${esc(t)}</li>`).join('')}</ul>
        ${(p.rules && p.rules.options && p.rules.options.length) ? `<p class="hint">Options : ${p.rules.options.map(esc).join(' · ')}</p>` : ''}
        ${statKpis(p.stats || {})}
        ${p.stats && p.stats.expect ? `<p class="hint">À attendre sur une année : creux normal jusqu'à ${p.stats.expect.dd10} R, jusqu'à ${p.stats.expect.ls90} pertes d'affilée ; alarme au-delà de ${p.stats.expect.ddAlarm} R ou ${p.stats.expect.lsAlarm} pertes d'affilée.</p>` : ''}
        ${lightLine(p.stats && p.stats.light)}
        ${p.stats && p.stats.yearly ? '<h3>Par année</h3>' + monthly(p.stats.yearly, 'Année') : '<h3>Par mois</h3>' + monthly(p.stats && p.stats.monthly)}</div>`).join('') +
      (COMBINED ? `<div class="card c12"><h2>Ensemble des actifs</h2>${statKpis(COMBINED)}${COMBINED.light ? `<p class="hint">Compte tel qu'il se trade (feu rouge sur les indices) : ${usd(COMBINED.light.usd3)}, pire baisse ${usd(COMBINED.light.dd3)} ; par année ${COMBINED.light.yearly.map(y => y[0] + ' ' + usd(y[1])).join(' · ')}.</p>` : ''}<p class="hint">Creux normal sur une année jusqu'à ${COMBINED.expect.dd10} R, séries jusqu'à ${COMBINED.expect.ls90} pertes ; alarme au-delà de ${COMBINED.expect.ddAlarm} R ou ${COMBINED.expect.lsAlarm} pertes d'affilée. Résultat médian attendu sur une année : +${COMBINED.expect.year50} R.</p></div>` : '');
  }

  /* ================= Réglages ================= */
  function renderMt5Settings() {
    const box = $('#mt5Box');
    if (!LIVE.key) {
      box.innerHTML = `<p style="margin-top:0">Première connexion : saisissez le code d'activation. Une clé secrète est créée dans ce navigateur ; vous la collerez dans le robot DeskUS_Bridge.</p>
        <div class="row"><input type="text" id="mt5Code" placeholder="Code d'activation" style="max-width:240px" autocomplete="off"><button class="btn primary" id="mt5Activate">Activer</button></div>
        <p class="hint">Autre appareil déjà configuré ? Collez votre clé :</p>
        <div class="row"><input type="text" id="mt5KeyIn" placeholder="dk_…" style="max-width:360px" autocomplete="off"><button class="btn" id="mt5UseKey">Utiliser cette clé</button></div>
        <p class="hint" id="mt5Msg"></p>`;
      return;
    }
    const d = LIVE.data, a = account();
    const status = LIVE.err ? `<span style="color:var(--bear)">${esc(LIVE.err)}</span>` : !d || !d.updated_at ? 'Clé active. En attente du robot DeskUS_Bridge.'
      : `${liveOn() ? '<b style="color:var(--bull)">Robot connecté</b>' : '<b style="color:var(--accent)">Robot silencieux</b>'} · dernière donnée il y a ${dur(liveAge() * 1000)} · robot v${esc(d.v || '?')}${a ? ` · ${esc(a.server)} · ${esc(a.cur)}` : ''}`;
    const last = PROFILES.map(p => { const s = SETUPS.find(x => x.profile === p.id); return `${esc(p.name)} : ${s ? 'dernier envoi il y a ' + dur(Date.now() - s.at * 1000) : 'rien reçu'}`; }).join(' · ');
    box.innerHTML = `<p style="margin-top:0">${status}</p>
      <p class="hint" style="margin-top:0">Desk Key · ${last || '—'}</p>
      <div class="row"><input type="text" id="mt5KeyShow" readonly value="${'•'.repeat(24)}" style="max-width:360px;font-family:var(--mono)"><button class="btn small" id="mt5Reveal">Afficher</button><button class="btn small" id="mt5Copy">Copier la clé</button></div>
      <ol style="padding-left:18px;margin:10px 0 0;font-size:14px" class="stack">
        <li>MT5 : <b>Outils → Options → Expert Advisors</b> → cocher « Autoriser WebRequest » et ajouter <code class="mono">${SB_URL}</code>.</li>
        <li>Robot <a href="mt5/DeskUS_Bridge.mq5" download>DeskUS_Bridge</a> sur un graphique, clé collée dans « Clé Desk US » (onglet Données d'entrée). Il envoie compte, cours et trades, et transmet la clé à Desk Key.</li>
        <li><a href="mt5/DeskUS_Key.mq5" download>Desk Key</a> sur un graphique M1 par actif (US100, SP500, XAUUSD).</li>
      </ol>
      <div class="row" style="margin-top:10px"><button class="btn small danger" id="mt5Forget">Oublier la clé sur cet appareil</button></div>`;
  }
  $('#mt5Box').addEventListener('click', async ev => {
    const id = ev.target.id;
    if (id === 'mt5Activate') {
      const code = $('#mt5Code').value.trim(), msg = $('#mt5Msg'); if (!code) return;
      try {
        const key = 'dk_' + hex(crypto.getRandomValues(new Uint8Array(32)));
        const ok = await rpc('desk_claim', { p_code: code, p_key_hash: await sha256(key) });
        if (!ok) { msg.textContent = 'Code invalide ou déjà utilisé.'; return; }
        LIVE.key = key; store.set('td.mt5key', key); poll(true); loadSetups(); renderAll();
        alert('Connexion activée. Copiez votre clé (bouton « Copier la clé ») : elle sert au robot MT5 et à vos autres appareils.');
      } catch (e) { msg.textContent = 'Activation impossible : ' + e.message; }
    }
    if (id === 'mt5UseKey') {
      const key = $('#mt5KeyIn').value.trim(), msg = $('#mt5Msg');
      try { await rpc('desk_read', { p_key: key, p_trades: false, p_bars_after: 9e12 }); }
      catch (e) { msg.textContent = /unknown key/.test(e.message) ? 'Clé inconnue.' : 'Vérification impossible : ' + e.message; return; }
      LIVE.key = key; store.set('td.mt5key', key); poll(true); loadSetups(); renderAll();
    }
    if (id === 'mt5Reveal') { const i = $('#mt5KeyShow'), shown = i.value === LIVE.key; i.value = shown ? '•'.repeat(24) : LIVE.key; ev.target.textContent = shown ? 'Afficher' : 'Masquer'; }
    if (id === 'mt5Copy') {
      try { await navigator.clipboard.writeText(LIVE.key); ev.target.textContent = 'Copiée ✓'; } catch (e) { const i = $('#mt5KeyShow'); i.value = LIVE.key; i.select(); ev.target.textContent = 'Sélectionnée : Ctrl+C'; }
      setTimeout(() => { ev.target.textContent = 'Copier la clé'; }, 2500);
    }
    if (id === 'mt5Forget' && confirm('Oublier la clé sur cet appareil ? Notez-la avant si vous ne l\'avez pas ailleurs.')) {
      store.del('td.mt5key'); LIVE.key = ''; LIVE.data = null; LIVE.trades = []; LIVE.err = ''; SETUPS = []; renderAll();
    }
  });
  function initPrefs() {
    $('#pTp').value = String(PREF.tp); $('#pRisk').value = PREF.risk;
    $('#fPhase').value = PREF.ftmo.phase; $('#fDaily').value = PREF.ftmo.daily; $('#fMax').value = PREF.ftmo.max; $('#fTarget').value = PREF.ftmo.target; $('#fInit').value = PREF.ftmo.init || '';
  }
  $('#pTp').addEventListener('change', e => { PREF.tp = num(e.target.value); savePref(); renderAll(); });
  $('#pRisk').addEventListener('change', e => { const v = num(e.target.value); if (v > 0) { PREF.risk = v; savePref(); renderAll(); } });
  $('#fPhase').addEventListener('change', e => { PREF.ftmo.phase = e.target.value; PREF.ftmo.target = e.target.value === 'verification' ? 5 : e.target.value === 'funded' ? 0 : 10; savePref(); initPrefs(); renderFtmo(); });
  [['#fDaily', 'daily'], ['#fMax', 'max'], ['#fTarget', 'target'], ['#fInit', 'init']].forEach(([s, k]) => $(s).addEventListener('change', e => { const v = e.target.value === '' ? 0 : num(e.target.value); if (v >= 0) { PREF.ftmo[k] = v; savePref(); renderFtmo(); } }));

  /* ================= Alertes et barre du haut ================= */
  function renderTop() {
    const pill = $('#pillMT5');
    if (!LIVE.key) { pill.hidden = true; $('#liveQuotes').textContent = ''; }
    else {
      pill.hidden = false;
      if (LIVE.err) setPill(pill, 'danger', 'MT5 · ' + (/Clé/.test(LIVE.err) ? 'clé inconnue' : 'hors ligne'));
      else if (!LIVE.data || !LIVE.data.updated_at) setPill(pill, 'warn', 'MT5 · en attente du robot');
      else if (liveOn()) setPill(pill, 'live', 'MT5 en direct');
      else setPill(pill, 'warn', 'MT5 · silencieux depuis ' + dur(liveAge() * 1000));
      $('#liveQuotes').innerHTML = PROFILES.map(p => { const q = quoteFor(p); return q && q.bid ? `${esc(p.id)} <b>${fmtP(q.bid)}</b>` : ''; }).filter(Boolean).join(' · ');
    }
    const out = [], ph = sessionPhase(new Date());
    if (LIVE.key) {
      if (LIVE.err) out.push(['danger', 'MT5 : ' + esc(LIVE.err)]);
      else if (LIVE.data && LIVE.data.updated_at && liveAge() > 90 && ['pre', 'open', 'entry', 'manage'].includes(ph.phase)) out.push(['warn', `Le robot MT5 n'envoie plus rien depuis ${dur(liveAge() * 1000)} : MT5 est-il ouvert et connecté ?`]);
      if (['open', 'entry'].includes(ph.phase)) PROFILES.forEach(p => { if (!todaySetup(p)) out.push(['warn', `Desk Key ne tourne pas sur ${esc(p.name)} : aucun setup reçu aujourd'hui.`]); });
      PROFILES.forEach(p => { const t = todaySetup(p), f = t && feuOf(t.data); if (f && f.rouge) out.push(['warn', `${esc(p.name)} sous feu rouge aujourd'hui (10 derniers setups ${fmtR(f.s)}) : ${f.on ? 'pas de trade, la règle est suivie à blanc' : 'feu désactivé dans Desk Key, prudence'}.`]); });
      const F = ftmoNumbers();
      if (F) {
        if (F.dayLeft <= 0) out.push(['danger', `Limite de perte journalière FTMO atteinte (${fmtE(F.dayLoss)} sur ${fmtE(F.dailyLimit)}).`]);
        else if (F.dayLeft < PREF.risk) out.push(['danger', `Il reste ${fmtE(F.dayLeft)} avant la limite FTMO du jour : moins d'un trade à ${fmtE(PREF.risk)}.`]);
        if (F.maxLeft < PREF.risk * 2) out.push(['danger', `Plus que ${fmtE(F.maxLeft)} avant la perte maximale FTMO.`]);
        (LIVE.data.positions || []).forEach(p => { if (!p.sl) out.push(['danger', `Position ${esc(p.sym)} ouverte sans stop loss.`]); });
      }
      PROFILES.forEach(p => { const st = seriesFor([p.id]); const v = verdict(st, p.stats && p.stats.expect); if (v[0] === 'bear') out.push(['danger', `${esc(p.name)} : ${esc(v[1])} (série ${st.cur}, creux ${fmtN(st.dd, 1)} R).`]); });
    }
    $('#alerts').innerHTML = out.map(([c, t]) => `<div class="alert ${c}">${t}</div>`).join('');
  }

  /* ================= Chargements ================= */
  async function loadProfiles() {
    try {
      const all = await rpc('desk_profiles_read', {});
      PROFILES = all.filter(p => !(p.rules && p.rules.combined));
      const c = all.find(p => p.rules && p.rules.combined); COMBINED = c ? c.stats : null;
      store.set('dk.profiles', PROFILES); store.set('dk.combined', COMBINED);
      $('#profilesInfo').textContent = 'Actifs suivis : ' + PROFILES.map(p => p.name).join(', ') + '.';
      renderAll();
    } catch (e) { /* on garde la copie locale */ }
  }
  async function loadSetups() {
    if (!LIVE.key) return;
    try {
      sinceFor(LIVE.key);
      const first = !SINCE.setups;
      const r = await rpc('desk_setups_since', { p_key: LIVE.key, p_since: SINCE.setups, p_days: 400 });
      const rows = (r && r.rows) || [];
      if (first) SETUPS = rows;
      else if (rows.length) {
        const m = new Map(SETUPS.map(x => [x.profile + '|' + x.date, x]));
        rows.forEach(x => m.set(x.profile + '|' + x.date, x));
        SETUPS = [...m.values()].sort((a, b) => (b.date > a.date) - (b.date < a.date) || (a.profile > b.profile) - (a.profile < b.profile));
      }
      if (r && r.now) SINCE.setups = r.now;
      SETUPS_AT = Date.now();
      if (first || rows.length) renderAll(); else renderLight();
    } catch (e) { /* nouvel essai */ }
  }
  async function loadEvents() {
    const t = nyToday(), to = new Date(Date.UTC(t.y, t.m - 1, t.d) + 10 * 86400000).toISOString().slice(0, 10);
    try { EVENTS = await rpc('desk_events_read', { p_from: t.str, p_to: to }) || []; if (active('jour')) renderNews(); } catch (e) { /* calendrier indisponible */ }
  }
  async function poll(force) {
    if (!LIVE.key || LIVE.busy) return;
    if (!force && document.hidden && LIVE.n % 4 !== 0) { LIVE.n++; return; }
    LIVE.busy = true;
    try {
      sinceFor(LIVE.key);
      const full = force || !SINCE.trades;
      const d = await rpc('desk_read', { p_key: LIVE.key, p_trades: full, p_bars_after: 9e12 });
      LIVE.readAt = Date.now(); LIVE.err = '';
      if (d.trades) { LIVE.trades = d.trades; delete d.trades; SINCE.trades = d.now || 0; }
      else if (LIVE.n % 10 === 0) {
        const t = await rpc('desk_trades_since', { p_key: LIVE.key, p_since: SINCE.trades });
        if (t && t.trades && t.trades.length) {
          const m = new Map(LIVE.trades.map(x => [String(x.data && x.data.id), x]));
          t.trades.forEach(x => m.set(String(x.data && x.data.id), x));
          LIVE.trades = [...m.values()].sort((a, b) => ((b.data && b.data.tc) || 0) - ((a.data && a.data.tc) || 0));
        }
        if (t && t.now) SINCE.trades = t.now;
      }
      LIVE.data = d;
      if (d.account && d.account.cur && d.account.cur !== CUR) { CUR = d.account.cur; store.set('td.cur', CUR); }
      if (Date.now() - SETUPS_AT > 10000) await loadSetups(); else renderLight();
    } catch (e) {
      LIVE.err = /unknown key/.test(e.message) ? 'Clé inconnue : reconnectez MT5 dans Réglages.' : 'Service injoignable (' + e.message + ').';
      renderTop();
    } finally { LIVE.n++; LIVE.busy = false; }
  }

  /* ================= Rendu ================= */
  function renderLight() { renderTop(); if (active('jour')) { renderProfiles(); renderFtmo(); } if (active('reglages')) renderMt5Settings(); }
  function renderAll() {
    renderTop();
    if (active('jour')) { renderSession(); renderProfiles(); renderNews(); renderFtmo(); }
    if (active('compte')) renderCompte();
    if (active('journal')) renderJournal();
    if (active('suivi')) renderSuivi();
    if (active('regles')) renderRules();
    if (active('reglages')) renderMt5Settings();
  }

  let rsz = 0; window.addEventListener('resize', () => { clearTimeout(rsz); rsz = setTimeout(() => { if (active('compte')) renderCompte(); }, 250); });
  initPrefs();
  const savedTab = store.get('dk.tab', 'jour');
  if ($('#tab-' + savedTab)) showTab(savedTab); else renderAll();
  tickClock(); setInterval(tickClock, 1000);
  setInterval(() => { if (active('jour')) renderSession(); }, 30000);
  loadProfiles(); setInterval(loadProfiles, 30 * 60 * 1000);
  loadEvents(); setInterval(loadEvents, 30 * 60 * 1000);
  if (LIVE.key) { poll(true); loadSetups(); }
  setInterval(() => poll(false), 3000);
})();
