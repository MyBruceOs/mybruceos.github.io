/* Desk US · simulateur : challenge FTMO à plusieurs comptes, compte financé, compte propre.
   Données : résultat de chaque séance du compte tel qu'il se trade (US100 et SP500 avec feu rouge, or avec second trade,
   frais 0,05 R par trade), 35 mois de janvier 2024 au 25 novembre 2026. Les parcours sont tirés par blocs de mois.
   Tous les comptes d'un parcours vivent les mêmes séances : ce sont les mêmes trades. */
(function (root) {
  'use strict';
  const MONTHS = [[[0,0],[-0.11,-0.11],[0,0],[-1.05,-1.05],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[-1.58,-1.58],[1.64,0],[0,0],[0,0],[0,0],[6.02,0],[0,0],[0,0],[0,0],[0,0]],[[0,0],[0,0],[-1.05,-1.05],[-2.21,-2.21],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[-1.05,-1.05],[0.25,0],[0,0],[0,0],[0,0],[0.27,0],[-1.05,-1.05],[0,0],[0,0]],[[0,0],[0,0],[-1.05,-1.05],[0,0],[0.87,0],[0,0],[-0.38,-1.05],[-1.05,-1.05],[0,0],[-1.05,-1.05],[-1.05,-1.05],[0,0],[-0.17,-0.17],[-1.05,-1.05],[0,0],[1.29,0],[-1.05,-1.05],[-2.1,-2.1],[-1.05,-1.05],[-1.05,-1.05]],[[-1.05,-1.05],[5.82,0],[0,0],[4.52,0],[0,0],[0,0],[2.95,0],[2.95,0],[0,0],[0,0],[2.95,0],[0,0],[-0.54,-0.54],[0,0],[0,0],[-1.05,-1.05],[0,0],[-2.1,-2.1],[-1.05,-1.05],[2.95,0],[-1.0,-1.05],[0,0]],[[1.9,-1.05],[1.9,-1.05],[0.18,0],[0,0],[0,0],[0,0],[-1.05,-1.05],[-1.05,-1.05],[0,0],[0,0],[0,0],[1.9,-1.05],[0,0],[0,0],[4.15,0],[0,0],[2.95,0],[1.15,0],[1.9,-1.05],[-1.05,-1.05],[-0.1,-1.05],[2.95,0],[8.08,0]],[[-1.05,-1.05],[-0.32,-1.05],[-1.05,-1.05],[1.75,0],[0,0],[1.9,-1.05],[2.17,0],[0,0],[0,0],[0,0],[-1.49,-2.1],[-2.1,-2.1],[-1.05,-1.05],[-2.1,-2.1],[0,0],[0,0],[-2.1,-2.1],[5.9,0],[0,0],[-1.05,-1.05]],[[-2.1,-2.1],[-1.05,-1.05],[2.95,0],[0,0],[2.57,0],[-1.05,-1.05],[-1.05,-1.05],[0,0],[0,0],[0,0],[4.28,0],[-1.05,-1.05],[-1.05,-1.05],[2.75,-0.2],[2.95,0],[0,0],[-1.05,-1.05],[0,0],[2.95,0],[0,0],[5.25,0],[0,0],[-2.1,-2.1]],[[0,0],[0,0],[0,0],[0,0],[1.2,0],[-1.05,-1.05],[0.29,0],[0,0],[0.1,0],[-1.05,-1.05],[1.51,0],[2.95,0],[-1.05,-1.05],[-1.05,-1.05],[2.95,0],[-1.05,-1.05],[3.18,0],[-1.05,-1.05],[3.32,0],[0,0],[0,0],[-2.1,-2.1]],[[-0.75,-0.75],[1.9,-1.05],[0,0],[-1.05,-1.05],[4.85,-1.05],[0.74,-0.21],[5.68,0],[-1.05,-1.05],[0,0],[-1.05,-1.05],[-2.1,-2.1],[-1.05,-1.05],[0,0],[-1.05,-1.05],[-1.05,-1.05],[0.88,0],[0,0],[0,0],[-1.05,-1.05],[0,0],[0,0]],[[0,0],[-2.1,-2.1],[0,0],[0,0],[-0.06,-0.06],[0,0],[-1.05,-1.05],[1.38,0],[0,0],[-1.05,-1.05],[0,0],[0,0],[0,0],[3.91,-0.07],[0,0],[0,0],[-2.1,-2.1],[2.05,-1.05],[-1.05,-1.05],[0,0],[0,0],[-2.04,-2.1],[2.95,0]],[[-1.05,-1.05],[2.95,0],[-1.05,-1.05],[0.83,0],[-1.05,-1.05],[0,0],[-1.91,-1.91],[-1.05,-1.05],[0,0],[-2.1,-2.1],[1.13,0],[0,0],[-1.05,-1.05],[0,0],[0,0],[0,0],[0,0],[2.34,0],[0,0],[-1.05,-1.05],[0,0]],[[0,0],[1.07,0],[1.32,0],[2.95,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[2.95,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[2.95,0]],[[0,0],[-2.1,-2.1],[0,0],[-0.36,-1.05],[-1.05,-1.05],[0,0],[0,0],[-1.3,-2.1],[0,0],[0,0],[0,0],[0,0],[0,0],[2.33,0],[0,0],[0,0],[-1.05,-1.05],[-1.05,-1.05],[0,0],[0.04,0],[0,0],[0,0]],[[0,0],[0,0],[0,0],[-1.05,-1.05],[-1.05,-1.05],[0,0],[-1.05,-1.05],[0,0],[0,0],[0,0],[0,0],[0,0],[1.56,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[-1.05,-1.05]],[[0,0],[0,0],[-2.1,-2.1],[0.03,0],[0,0],[0,0],[0,0],[0,0],[0,0],[-1.05,-1.05],[4.19,0],[0,0],[-1.05,-1.05],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[-1.05,-1.05],[0,0]],[[-1.05,-1.05],[0,0],[2.95,0],[2.95,0],[0,0],[0.06,-1.05],[0,0],[-1.05,-1.05],[-1.05,-1.05],[-1.05,-1.05],[0,0],[0,0],[-1.05,-1.05],[0,0],[-1.05,-1.05],[0,0],[-1.05,-1.05],[2.95,0],[-1.05,-1.05],[2.95,0],[-1.05,-1.05]],[[3.51,-1.05],[0,0],[0,0],[0,0],[-1.05,-1.05],[0,0],[0,0],[0.15,0],[0,0],[0,0],[-1.05,-1.05],[-2.1,-2.1],[0,0],[-1.05,-1.05],[0,0],[0,0],[0,0],[0.87,-0.1],[-1.05,-1.05],[2.07,0],[0,0],[0,0]],[[0,0],[0,0],[0,0],[-1.05,-1.05],[0,0],[-1.05,-1.05],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[-1.05,-1.05],[0,0],[-1.05,-1.05]],[[-1.05,-1.05],[0,0],[0.16,0],[-0.59,-0.59],[-1.05,-1.05],[2.95,0],[-1.05,-1.05],[0,0],[0,0],[-0.54,-1.05],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[-1.05,-1.05],[0,0],[4.58,0],[0,0],[2.95,0],[0,0],[2.95,0]],[[-0.25,-0.25],[0,0],[0,0],[0,0],[0,0],[0,0],[2.95,0],[-1.05,-1.05],[3.92,0],[0,0],[-0.86,-1.05],[0,0],[0,0],[0,0],[2.95,0],[0,0],[2.95,0],[2.95,0],[0,0],[0,0],[0,0]],[[0,0],[5.33,0],[0,0],[0,0],[0,0],[0,0],[2.95,0],[-1.05,-1.05],[0,0],[0,0],[0,0],[2.95,0],[-1.05,-1.05],[0,0],[0,0],[0,0],[0,0],[0,0],[-1.05,-1.05],[0,0],[0.84,0],[-1.05,-1.05]],[[-1.05,-1.05],[0,0],[0,0],[4.45,0],[0,0],[-1.05,-1.05],[0,0],[0,0],[-1.05,-1.05],[3.94,0],[-1.05,-1.05],[-1.05,-1.05],[-1.05,-1.05],[0,0],[0,0],[0,0],[-1.05,-1.05],[-1.05,-1.05],[5.54,0],[-1.05,-1.05],[0,0],[0,0],[0,0]],[[0.6,-0.22],[0,0],[0,0],[0,0],[2.95,0],[1.61,0],[-0.69,-1.05],[0,0],[0,0],[-1.05,-1.05],[1.54,0],[0,0],[0,0],[0,0],[0,0],[0,0],[3.55,0],[0,0],[0,0],[0,0]],[[-0.04,-0.04],[0,0],[0,0],[-1.05,-1.05],[0,0],[0,0],[0,0],[0,0],[1.07,0],[-2.1,-2.1],[0,0],[0,0],[0,0],[2.95,0],[-1.05,-1.05],[0,0],[0,0],[0,0],[0,0],[0,0],[0.95,0],[1.96,0]],[[0,0],[0,0],[-1.05,-1.05],[1.25,0],[-1.05,-1.05],[1.08,0],[0,0],[-0.04,-0.04],[0.04,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[7.15,0],[5.67,0]],[[0,0],[1.9,-1.05],[0,0],[4.07,0],[-1.05,-1.05],[2.95,0],[0.28,0],[0,0],[-1.05,-1.05],[0,0],[0,0],[-0.37,-0.37],[0,0],[-0.31,-0.31],[0,0],[0,0],[0,0],[0.8,-0.3],[0,0],[-1.05,-1.05]],[[-1.05,-1.05],[0,0],[0,0],[0,0],[-1.05,-1.05],[-0.49,-1.05],[1.62,0],[-1.05,-1.05],[0,0],[1.9,-1.05],[-2.1,-2.1],[2.95,0],[2.95,0],[0,0],[1.9,-1.05],[-1.05,-1.05],[0,0],[0.3,0],[-1.05,-1.05],[-1.05,-1.05],[0,0],[0,0]],[[5.9,0],[2.95,0],[-1.05,-1.05],[0,0],[0,0],[0,0],[0,0],[-1.05,-1.05],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[-2.1,-2.1],[-1.05,-1.05],[0,0],[-2.1,-2.1]],[[-1.05,-1.05],[0,0],[-0.65,-1.05],[2.54,0],[0,0],[2.95,0],[-1.05,-1.05],[0,0],[-1.05,-1.05],[4.95,0],[0.46,0],[-1.05,-1.05],[1.44,0],[2.95,0],[-2.1,-2.1],[0,0],[2.95,0],[-1.05,-1.05],[0,0],[-1.05,-1.05],[2.95,0]],[[1.31,0],[0.85,-2.1],[-2.1,-2.1],[0,0],[0,0],[2.95,0],[-1.05,-1.05],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[-1.05,-1.05],[0,0],[0,0],[0,0],[-1.05,-1.05],[0,0],[0,0],[5.9,0]],[[-1.05,-1.05],[0,0],[0,0],[-1.05,-1.05],[0,0],[6.77,-1.05],[-1.05,-1.05],[0,0],[0,0],[0,0],[1.52,0],[2.95,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[2.95,0],[0,0],[1.9,-1.05],[2.95,0]],[[2.95,0],[0,0],[0,0],[0,0],[0,0],[1.9,-1.05],[0,0],[0.25,0],[0,0],[0,0],[1.9,-1.05],[-1.05,-1.05],[2.95,0],[0,0],[4.62,0],[0,0],[-1.05,-1.05],[0,0],[0,0],[-2.1,-2.1],[0.93,0]],[[0,0],[0,0],[2.95,0],[0,0],[0,0],[0.51,0],[0,0],[0,0],[0,0],[0,0],[5.9,0],[-1.05,-1.05],[0,0],[-1.05,-1.05],[2.95,0],[3.67,0],[0,0],[0,0],[-2.1,-2.1],[0,0],[0,0],[0,0]],[[-1.05,-1.05],[0,0],[0,0],[0,0],[0,0],[0,0],[-0.71,-1.05],[0,0],[-1.05,-1.05],[-1.05,-1.05],[0,0],[0,0],[0,0],[2.95,0],[0,0],[1.9,-1.05],[2.95,0],[0,0],[0,0],[-1.05,-1.05],[-1.05,-1.05],[0,0]],[[-1.33,-1.33],[0,0],[2.11,0],[0,0],[4.39,0],[0,0],[0,0],[0,0],[-1.05,-1.05],[0,0],[0.56,0],[-1.05,-1.05],[0,0],[0,0],[0.8,0],[0,0],[2.95,0],[0,0]]];
  const DN = [], DG = [], DT = [], MS = [];
  MONTHS.forEach(mo => { MS.push([DN.length, mo.length]); mo.forEach(([n, g]) => { DN.push(n); DG.push(g); DT.push(n !== 0 || g !== 0 ? 1 : 0); }); });
  const WORST = Math.min(...DG);
  // Avantage gardé en réel (edge) : 1 = comme le backtest. En dessous, les gains des jours gagnants sont réduits
  // pour que le total des 35 mois soit multiplié par edge ; les pertes restent les mêmes (scénario prudent).
  const POS = DN.reduce((a, v) => a + (v > 0 ? v : 0), 0), TOT = DN.reduce((a, v) => a + v, 0), DNC = {};
  function dnFor(edge) {
    const e = edge == null || !isFinite(+edge) ? 1 : +edge;
    if (e >= 1) return DN;
    const key = e.toFixed(3);
    if (!DNC[key]) { const a = Math.max(0, (POS - (1 - e) * TOT) / POS); DNC[key] = DN.map(v => v > 0 ? v * a : v); }
    return DNC[key];
  }

  // FTMO 2-Step : taille du compte ($) et prix du challenge (€)
  const SIZES = [[10000, 89], [25000, 250], [50000, 345], [100000, 540], [200000, 1080]];
  const priceOf = size => { const s = SIZES.find(x => x[0] === size); return s ? s[1] : size * 0.0054; };

  function rng(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  // N parcours de T séances, faits de mois réels tirés au hasard
  function paths(N, T, seed) {
    const r = rng(seed), out = new Int32Array(N * T);
    for (let k = 0; k < N; k++) { let t = 0; while (t < T) { const [s, len] = MS[Math.floor(r() * MS.length)]; for (let i = 0; i < len && t < T; i++) out[k * T + t++] = s + i; } }
    return out;
  }

  const DEF = {
    budget: 1200,   // € disponibles pour acheter des challenges
    fx: 1.15,       // 1 € = fx $ (versements en $, challenges en €)
    split: 0.8,     // part des gains versée
    cycle: 10,      // séances entre deux versements (14 jours)
    d1: 1, d2: 2,   // séances d'attente FTMO après la phase 1, après la phase 2
    cushion: 0,     // % laissé sur le compte financé à chaque versement
    slip: 0,        // pertes plus grosses qu'en backtest (0,05 = +5 %)
    cap: 400000,    // plafond FTMO : taille totale des comptes en cours ($)
    edge: 1,        // avantage gardé en réel (1 = comme le backtest, 0,5 = moitié du gain total)
    relaunch: true, // racheter un challenge après un échec ou un compte perdu
    stagger: false, // ouvrir le compte suivant seulement quand le précédent est financé
    n0: 1,          // comptes ouverts au départ (dans la limite du budget)
    accounts: [{ size: 100000, rc: 1.4, rf: 2.15 }] // un emplacement par compte ; au-delà de n0, ouverts avec les versements
  };

  // Un parcours. rec (facultatif) reçoit le net et le nombre de comptes financés à chaque fin de mois.
  function run(P, k, T, o, rec) {
    const A = o.accounts, M = A.length, S = [], DNx = dnFor(o.edge);
    for (let i = 0; i < M; i++) S.push({ ph: 0, eq: 0, days: 0, wait: 0, next: 0, fT: 0, start: 0, refunded: true, funded: false, bought: false, lostAt: -1 });
    let wallet = o.budget, fees = 0, paid = 0, bought = 0, fundedN = 0, lost = 0, firstPay = -1, noFund = 0, payMonth = 0, monthsNoPay = 0, gaps = 0;
    const passT = [], relaunchT = [];
    for (let t = 0; t < T; t++) {
      // 1. achats (début de séance)
      let used = 0; for (let i = 0; i < M; i++) if (S[i].ph !== 0) used += A[i].size;
      for (let i = 0; i < M; i++) {
        const s = S[i], a = A[i];
        if (s.ph !== 0) continue;
        if (s.bought && !o.relaunch) continue;
        if (!s.bought) {
          if (i >= o.n0 && paid <= 0) continue;                       // compte de réinvestissement : après un premier versement
          if (o.stagger && i > 0 && i < o.n0 && !S[i - 1].funded) continue; // décalé : après le financement du précédent
        }
        const pr = a.price || priceOf(a.size);
        if (wallet < pr || used + a.size > o.cap) continue;
        wallet -= pr; fees += pr; bought++; used += a.size;
        s.ph = 1; s.eq = 0; s.days = 0; s.start = t; s.bought = true;
      }
      // 2. la séance
      const d = P[k * T + t];
      if (o.onDay) o.onDay(DNx[d] + DG[d] * o.slip, DG[d] * (1 + o.slip), t);   // compte propre branché sur les mêmes séances
      let nf = 0;
      for (let i = 0; i < M; i++) {
        const s = S[i], a = A[i];
        if (s.ph === 0) continue;
        if (s.ph === -1) { if (--s.wait <= 0) { s.ph = s.next; s.eq = 0; s.days = 0; if (s.ph === 3) { s.fT = t; s.refunded = false; s.funded = true; fundedN++; passT.push(t - s.start); if (s.lostAt >= 0) { relaunchT.push(t - s.lostAt); s.lostAt = -1; } } } else continue; }
        const r = s.ph === 3 ? a.rf : a.rc, g = DG[d] * (1 + o.slip) * r, n = (DNx[d] + DG[d] * o.slip) * r;
        if (g <= -5 || s.eq + g <= -10) { if (s.ph === 3) { lost++; s.lostAt = t; } s.ph = 0; continue; }
        s.eq += n; s.days += DT[d];
        if (s.ph === 1 && s.eq >= 10 && s.days >= 4) { s.ph = -1; s.next = 2; s.wait = o.d1; }
        else if (s.ph === 2 && s.eq >= 5 && s.days >= 4) { s.ph = -1; s.next = 3; s.wait = o.d2; if (o.d2 <= 0) { s.ph = 3; s.fT = t; s.refunded = false; s.funded = true; fundedN++; passT.push(t - s.start); } }
        else if (s.ph === 3) {
          nf++;
          if ((t - s.fT) % o.cycle === o.cycle - 1 && s.eq > o.cushion) {
            let p = (s.eq - o.cushion) * a.size / 100 * o.split / o.fx;
            if (!s.refunded) { p += a.price || priceOf(a.size); s.refunded = true; }
            wallet += p; paid += p; payMonth += p; s.eq = o.cushion; if (firstPay < 0) firstPay = t;
          }
        }
      }
      if (!nf) noFund++;
      // 3. fin de mois
      if (t % 21 === 20) {
        if (o.onMonth) { const take = o.onMonth((t + 1) / 21, wallet); if (take > 0) wallet -= Math.min(take, wallet); }   // répartition des versements
        if (payMonth <= 0) { monthsNoPay++; if (firstPay >= 0) gaps++; }
        if (rec) rec.push(wallet - o.budget, nf);
        payMonth = 0;
      }
    }
    let active = 0; for (const s of S) if (s.ph !== 0) active++;
    const minPrice = Math.min(...A.map(a => a.price || priceOf(a.size)));
    return { net: wallet - o.budget, fees, paid, bought, funded: fundedN, lost, firstPay, monthsNoPay, gaps, noFund: noFund / T, stuck: !active && wallet < minPrice, passT, relaunchT };
  }

  const q = (a, p) => a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))] : NaN;
  const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
  // N parcours de H mois : résumé + courbes mensuelles
  function sim(opt, H, N, seed) {
    const o = Object.assign({}, DEF, opt), T = H * 21, P = paths(N, T, seed || 7), R = [], curves = [];
    for (let k = 0; k < N; k++) { const rec = []; R.push(run(P, k, T, o, rec)); curves.push(rec); }
    const nets = R.map(r => r.net).sort((a, b) => a - b), fp = R.map(r => r.firstPay).filter(x => x >= 0).sort((a, b) => a - b);
    const pt = R.flatMap(r => r.passT).sort((a, b) => a - b), rl = R.flatMap(r => r.relaunchT).sort((a, b) => a - b);
    const med = [], lo = [], hi = [], fund = [];
    for (let m = 0; m < H; m++) { const c = curves.map(x => x[2 * m]).sort((a, b) => a - b); med.push(q(c, .5)); lo.push(q(c, .1)); hi.push(q(c, .9)); fund.push(mean(curves.map(x => x[2 * m + 1]))); }
    const F = R.reduce((a, r) => a + r.funded, 0);
    return {
      o, H, N, mean: mean(nets), med: q(nets, .5), p10: q(nets, .1), p90: q(nets, .9), loss: nets.filter(x => x < 0).length / N,
      bought: mean(R.map(r => r.bought)), funded: F / N, lostShare: F ? R.reduce((a, r) => a + r.lost, 0) / F : 0,
      firstPay: q(fp, .5), neverPaid: 1 - fp.length / N, monthsNoPay: mean(R.map(r => r.monthsNoPay)), gaps: mean(R.map(r => r.gaps)),
      noFund: mean(R.map(r => r.noFund)), stuck: R.filter(r => r.stuck).length / N,
      passMed: q(pt, .5), pass2m: pt.length ? pt.filter(x => x <= 42).length / pt.length : NaN, relaunchMed: q(rl, .5),
      curve: { med, lo, hi, fund }
    };
  }

  // Challenge seul (une tentative) : réussite par phase et durée, à un risque donné
  function challenge(rc, N, seed, o2) {
    const o = Object.assign({}, DEF, o2), L = 1000, P = paths(N, L, seed || 11), DNx = dnFor(o.edge);
    let p1 = 0, p2 = 0, reach2 = 0; const tb = [];
    for (let k = 0; k < N; k++) {
      let ph = 1, eq = 0, days = 0, t0 = 0;
      for (let t = 0; t < L; t++) {
        const d = P[k * L + t], g = DG[d] * (1 + o.slip) * rc;
        if (g <= -5 || eq + g <= -10) break;
        eq += (DNx[d] + DG[d] * o.slip) * rc; days += DT[d];
        if (ph === 1 && eq >= 10 && days >= 4) { p1++; reach2++; ph = 2; eq = 0; days = 0; t += o.d1; }
        else if (ph === 2 && eq >= 5 && days >= 4) { p2++; tb.push(t + 1 + o.d2 - t0); break; }
      }
    }
    tb.sort((a, b) => a - b);
    return { p1: p1 / N, p2: reach2 ? p2 / reach2 : NaN, both: p2 / N, med: q(tb, .5), p90: q(tb, .9), in2m: tb.filter(x => x <= 42).length / N };
  }

  // Compte propre : capital, risque en % (du solde si compose, sinon du capital de départ), retrait mensuel des gains
  function own(opt, H, N, seed) {
    const o = Object.assign({ capital: 10000, risk: 1, compound: true, withdraw: 0, slip: 0, edge: 1 }, opt), T = H * 21, P = paths(N, T, seed || 5), DNx = dnFor(o.edge);
    const fin = [], dd = [], wd = [], curves = [];
    for (let k = 0; k < N; k++) {
      let bal = o.capital, peak = bal, mdd = 0, out = 0, mStart = bal; const rec = [];
      for (let t = 0; t < T; t++) {
        const d = P[k * T + t], base = o.compound ? bal : o.capital, r = o.risk / 100;
        const low = bal + base * (DG[d] * (1 + o.slip)) * r; if (peak > 0) mdd = Math.min(mdd, low / peak - 1);
        bal += base * (DNx[d] + DG[d] * o.slip) * r; if (bal > peak) peak = bal;
        if (bal <= 0) { bal = 0; }
        if (t % 21 === 20) { if (o.withdraw > 0 && bal > mStart) { const w = (bal - mStart) * o.withdraw; bal -= w; out += w; if (peak > bal) peak = Math.max(bal, peak - w); } mStart = bal; rec.push(bal + out - o.capital); }
      }
      fin.push(bal); dd.push(mdd); wd.push(out); curves.push(rec);
    }
    const f = fin.slice().sort((a, b) => a - b), D = dd.slice().sort((a, b) => a - b), med = [], lo = [], hi = [];
    for (let m = 0; m < H; m++) { const c = curves.map(x => x[m]).sort((a, b) => a - b); med.push(q(c, .5)); lo.push(q(c, .1)); hi.push(q(c, .9)); }
    const tot = fin.map((b, i) => b + wd[i] - o.capital).sort((a, b) => a - b);
    return { o, H, finMed: q(f, .5), totMed: q(tot, .5), totP10: q(tot, .1), totP90: q(tot, .9), wdMed: q(wd.slice().sort((a, b) => a - b), .5), ddMed: q(D, .5), ddP10: q(D, .1), dd20: dd.filter(x => x <= -0.2).length / N, loss: tot.filter(x => x < 0).length / N, curve: { med, lo, hi } };
  }

  const ENGINE = { MONTHS, SIZES, priceOf, WORST, DEF, paths, run, sim, challenge, own, dnFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = ENGINE;
  else root.DeskSimEngine = ENGINE;
})(typeof window !== 'undefined' ? window : this);

/* ================= Onglet « Simulateur » ================= */
(function () {
  'use strict';
  if (typeof document === 'undefined') return;
  const E = window.DeskSimEngine;
  const $ = s => document.querySelector(s);
  const KEY = 'dk.sim';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null') || {}; } catch (e) { return {}; } };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(ST)); } catch (e) { /* stockage indisponible */ } };
  // réglages par défaut : la stratégie proposée le 27/11/2026
  const DEF = { mode: 'ftmo', budget: 1200, size0: 50000, n0: 1, stagger: 0, reinvest: 100000, cap: 400, relaunch: 1, rc: 1.5, rc2: '', rf: 2.15, cushion: 5, H: 12, cycle: 10, split: 80, fx: 1.15, slip: 0, edge: 1, d1: 1, d2: 2,
    own: { capital: 10000, risk: 1, compound: 1, withdraw: 0, H: 12, slip: 0, edge: 1 } };
  const saved = load();
  const ST = Object.assign({}, DEF, saved); ST.own = Object.assign({}, DEF.own, saved.own || {});

  const nf = (v, d = 0) => isFinite(v) ? Number(v).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
  const eur = v => isFinite(v) ? (v < 0 ? '−' : '') + nf(Math.abs(v)) + ' €' : '—';
  const pc = v => isFinite(v) ? nf(v * 100) + ' %' : '—';
  const mo = s => isFinite(s) ? nf(s / 21, 1) + ' mois' : '—';
  const k = v => (v / 1000) + 'k';
  const nice = v => { const p = Math.pow(10, Math.floor(Math.log10(Math.max(v, 1e-9)))), n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; };
  const kpi = (label, val, sub, cls) => `<div class="kpi"><small>${label}</small><b class="${cls || ''}">${val}</b>${sub ? `<div class="hint" style="margin-top:2px">${sub}</div>` : ''}</div>`;

  function chart(box, H, med, lo, hi, fmt, tip) {
    const W = Math.max(300, box.clientWidth || 600), Ht = 200, pl = 66, pr = 14, pt = 10, pb = 24;
    let yMin = Math.min(0, ...(lo || med)), yMax = Math.max(1e-9, ...(hi || med));
    const st = nice((yMax - (yMin < -yMax / 8 ? yMin : 0)) / 4) || 1; yMax = Math.ceil(yMax / st - 1e-9) * st; if (yMin < -yMax / 8) yMin = Math.floor(yMin / st - 1e-9) * st;
    const X = m => pl + (W - pl - pr) * m / H, Y = v => pt + (Ht - pt - pb) * (yMax - v) / (yMax - yMin || 1);
    let g = '';
    for (let v = Math.ceil(yMin / st - 1e-9) * st; v <= yMax + st * 1e-6; v += st) g += `<line x1="${pl}" x2="${W - pr}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="${pl - 6}" y="${Y(v) + 4}" text-anchor="end" font-size="11" fill="var(--faint)" font-family="var(--mono)">${fmt(Math.abs(v) < st / 1e6 ? 0 : v)}</text>`;
    for (let m = 0; m <= H; m += H > 12 ? 6 : 3) g += `<text x="${X(m)}" y="${Ht - 6}" text-anchor="middle" font-size="11" fill="var(--faint)" font-family="var(--mono)">${m} m</text>`;
    if (lo) g += `<path d="M${hi.map((v, m) => X(m) + ',' + Y(v)).join('L')}L${lo.map((v, m) => [m, v]).reverse().map(([m, v]) => X(m) + ',' + Y(v)).join('L')}Z" fill="rgba(228,162,74,.16)"/>`;
    g += `<path d="M${med.map((v, m) => X(m) + ',' + Y(v)).join('L')}" fill="none" stroke="var(--accent)" stroke-width="2"/>`;
    g += `<circle cx="${X(H)}" cy="${Y(med[H])}" r="4" fill="var(--accent)"/>`;
    for (let m = 1; m <= H; m++) g += `<rect x="${X(m - 0.5)}" y="${pt}" width="${(W - pl - pr) / H}" height="${Ht - pt - pb}" fill="transparent"><title>${tip(m)}</title></rect>`;
    box.innerHTML = `<svg viewBox="0 0 ${W} ${Ht}" width="100%" style="display:block" role="img">${g}</svg>`;
  }

  // ---------- comptes à partir des réglages ----------
  function accountsOf(s) {
    const acc = [], rc2 = parseFloat(String(s.rc2).replace(',', '.'));
    for (let i = 0; i < s.n0; i++) acc.push({ size: s.size0, rc: i === 1 && isFinite(rc2) && rc2 > 0 ? rc2 : s.rc, rf: s.rf });
    if (+s.reinvest > 0) {
      const cap = s.cap * 1000; let used = acc.reduce((a, x) => a + x.size, 0);
      while (used + +s.reinvest <= cap) { acc.push({ size: +s.reinvest, rc: s.rc, rf: s.rf }); used += +s.reinvest; }
      for (const [size] of E.SIZES.slice().reverse()) if (size < +s.reinvest && used + size <= cap) { acc.push({ size, rc: s.rc, rf: s.rf }); used += size; }
    }
    return acc;
  }
  const optOf = s => ({ budget: s.budget, fx: s.fx, split: s.split / 100, cycle: +s.cycle, d1: +s.d1, d2: +s.d2, cushion: +s.cushion, slip: +s.slip, edge: +s.edge, cap: s.cap * 1000, relaunch: !!+s.relaunch, stagger: !!+s.stagger, n0: +s.n0, accounts: accountsOf(s) });

  // ---------- gabarit ----------
  const sizeOpts = E.SIZES.map(([s, p]) => `<option value="${s}">${k(s)} (${p} €)</option>`).join('');
  function build() {
    $('#simBody').innerHTML = `
<div class="card c12">
  <h2>Simulateur<span class="spacer"></span><div class="seg" id="smMode"><button data-m="ftmo">Challenge FTMO</button><button data-m="own">Compte propre</button></div></h2>
  <p class="muted" style="margin:0;font-size:14px">Des milliers de parcours faits des mois réels des 3 ans (US100 et SP500 avec feu rouge, or avec second trade, frais compris), remis dans le désordre. Tous les comptes d'un parcours prennent les mêmes trades le même jour : plusieurs comptes au même risque gagnent et perdent ensemble.</p>
</div>
<details class="card c12" id="smPlan">
  <summary>Ma stratégie : des challenges FTMO au compte propre</summary>
  <div class="stack" style="margin-top:12px;font-size:14px">
    <div><b>1 · Démarrage (1 200 €)</b> : un seul challenge 50k à 1,5 % par trade (345 €), les 855 € restants pour deux autres essais. Compte financé à 2,15 %, coussin de 5 % laissé à chaque versement (si FTMO l'autorise). Rien d'autre avant le premier versement (vers le 3e mois).</div>
    <div><b>2 · Montée en charge</b> : chaque versement va dans la caisse challenges ; dès qu'elle le permet, un challenge 100k à 1,5 %, jusqu'à 400 k$ au total. Compte perdu ou challenge raté : racheter tout de suite. <b>Ne rien sortir de la caisse tant qu'elle n'a pas 10 000 €</b> (tous les comptes tombent ensemble : il faut pouvoir tout relancer plusieurs fois).</div>
    <div><b>3 · Compte propre</b> : chaque fin de mois, ce qui dépasse 10 000 € : 70 % sur le compte propre, 30 % pour toi, jusqu'à 100 000 € sur le compte propre. Ensuite, tout l'excédent FTMO est pour toi.</div>
    <div><b>4 · Retraits du compte propre</b> : risque 1 % du solde par trade (jamais 2,15 % : c'est ton argent). Le 1er du mois : si le compte est au-dessus de son plus haut, retirer 50 % de ce qui dépasse ; sinon ne rien retirer. Ne jamais toucher au capital déposé. Mettre de côté une part pour les impôts.</div>
    <div class="tbl-wrap sm-tbl"><table><thead><tr><th>Sur 3 ans</th><th>Avantage du backtest</th><th>Avantage réduit de moitié</th></tr></thead><tbody>
      <tr><td>Argent touché par toi</td><td class="mono">≈ 693 k€</td><td class="mono">≈ 183 k€</td></tr>
      <tr><td>Compte propre à la fin</td><td class="mono">≈ 192 k€</td><td class="mono">≈ 89 k€</td></tr>
      <tr><td>Mois sans revenu, 3e année</td><td class="mono">≈ 4 sur 12</td><td class="mono">≈ 7 sur 12</td></tr>
    </tbody></table></div>
    <div class="row"><button class="btn small primary" id="smPlanLoad">Charger ces réglages dans le simulateur</button><a href="docs/strategie-financement.md" target="_blank" rel="noopener" style="font-size:13px">document complet</a></div>
  </div>
</details>
<div class="c12 grid" id="smFtmo">
  <div class="card c5">
    <h2>Stratégie</h2>
    <h3 style="margin-top:0">Départ</h3>
    <div class="fgrid">
      <label class="f">Budget pour les challenges (€)<input type="number" id="smBudget" min="0" step="50"></label>
      <label class="f">Taille des comptes<select id="smSize0">${sizeOpts}</select></label>
      <label class="f">Comptes achetés au départ<select id="smN0"><option>1</option><option>2</option><option>3</option><option>4</option></select></label>
      <label class="f" title="L'un après l'autre : le compte suivant est acheté quand le précédent devient financé">Ouverture des comptes du départ<select id="smStag"><option value="0">en même temps</option><option value="1">l'un après l'autre</option></select></label>
    </div>
    <h3>Ensuite</h3>
    <div class="fgrid">
      <label class="f">Réinvestir les versements<select id="smRe"><option value="0">non</option><option value="50000">oui, en 50k</option><option value="100000">oui, en 100k</option><option value="200000">oui, en 200k</option></select></label>
      <label class="f">Plafond FTMO (k$ au total)<input type="number" id="smCap" min="10" step="50"></label>
      <label class="f">Après un échec ou un compte perdu<select id="smRel"><option value="1">racheter</option><option value="0">ne pas racheter</option></select></label>
    </div>
    <h3>Risque par trade</h3>
    <div class="fgrid">
      <label class="f">Challenge (%)<input type="number" id="smRc" min="0.1" max="5" step="0.05"></label>
      <label class="f">Challenge du 2e compte (%)<input type="number" id="smRc2" min="0.1" max="5" step="0.05" placeholder="identique"></label>
      <label class="f">Compte financé (%)<input type="number" id="smRf" min="0.1" max="5" step="0.05"></label>
      <label class="f">Coussin laissé sur le compte (%)<input type="number" id="smCush" min="0" max="30" step="1"></label>
    </div>
    <h3>Hypothèses</h3>
    <div class="fgrid">
      <label class="f">Durée<select id="smH"><option value="12">12 mois</option><option value="24">24 mois</option></select></label>
      <label class="f">Versements<select id="smCycle"><option value="10">tous les 14 jours</option><option value="21">tous les mois</option></select></label>
      <label class="f">Part des gains versée (%)<input type="number" id="smSplit" min="10" max="100" step="5"></label>
      <label class="f">1 € = … $<input type="number" id="smFx" min="0.5" max="2" step="0.01"></label>
      <label class="f">Pertes plus grosses qu'en backtest<select id="smSlip"><option value="0">non</option><option value="0.02">+2 %</option><option value="0.05">+5 %</option></select></label>
      <label class="f">Avantage gardé en réel<select id="smEdge"><option value="1">100 % (comme le backtest)</option><option value="0.75">75 %</option><option value="0.5">50 %</option></select></label>
      <label class="f">Attente FTMO après la phase 1 (séances)<input type="number" id="smD1" min="0" max="20" step="1"></label>
      <label class="f">Attente FTMO avant le compte financé (séances)<input type="number" id="smD2" min="0" max="20" step="1"></label>
    </div>
    <div id="smWarn" class="stack" style="margin-top:12px"></div>
    <p class="hint">« Avantage gardé en réel » : les gains des jours gagnants sont réduits pour que le total des 3 ans soit multiplié par 75 % ou 50 % ; les pertes restent les mêmes (scénario prudent : en réel, une règle réglée sur le passé rapporte souvent moins). Prix FTMO 2-Step (en €) ; versement des gains en $, converti en €. Le prix du challenge est remboursé avec le premier versement de chaque compte financé. Un challenge n'est racheté que si la caisse (budget + versements reçus) le permet. Avec « réinvestir », de nouveaux challenges sont achetés dès le premier versement reçu, tant que la caisse et le plafond le permettent.</p>
  </div>
  <div class="card c7">
    <h2>Résultat<span class="spacer"></span><span class="hint" id="smInfo" style="margin:0;text-transform:none;letter-spacing:0"></span></h2>
    <div class="verdict" id="smVerdict" style="margin-top:0"></div>
    <div class="res" id="smKpi"></div>
    <h3>Gain encaissé net, cumulé (versements reçus − challenges payés)</h3>
    <div id="smChart"></div>
    <p class="hint" style="margin-top:2px">Ligne : parcours médian · zone : de 1 parcours sur 10 à 9 sur 10.</p>
    <h3>Comptes financés en même temps (moyenne)</h3>
    <div id="smChart2"></div>
  </div>
  <div class="card c12">
    <h2>Comparer des stratégies<span class="spacer"></span><button class="btn small primary" id="smCmp">Comparer</button></h2>
    <p class="muted" style="margin:0 0 8px;font-size:14px">Mêmes risques, budget et hypothèses que ci-dessus ; seuls les comptes changent. Clique une ligne pour la charger dans les réglages.</p>
    <div class="tbl-wrap sm-tbl"><table id="smCmpT"><tbody><tr><td class="muted">Clique « Comparer » (quelques secondes).</td></tr></tbody></table></div>
  </div>
  <div class="card c12">
    <h2>Challenge seul : réussite et durée selon le risque</h2>
    <div class="tbl-wrap sm-tbl"><table id="smChT"></table></div>
    <p class="hint">Une tentative : phase 1 (+10 %) puis phase 2 (+5 %) juste après, au moins 4 jours de trading par phase, perte du jour 5 % et perte max 10 % du capital de départ, attentes FTMO comprises. « En 2 mois » : parmi les tentatives réussies, part finie en 42 séances ou moins. La phase 2 enchaîne sur la phase 1 dans le temps : sur nos 35 mois, elle réussit 2 à 3 points de moins que si elle commençait un mois pris au hasard.</p>
  </div>
</div>
<div class="c12 grid" id="smOwn" hidden>
  <div class="card c5">
    <h2>Compte propre</h2>
    <div class="fgrid">
      <label class="f">Capital (€)<input type="number" id="soCap" min="100" step="500"></label>
      <label class="f">Risque par trade (%)<input type="number" id="soRisk" min="0.1" max="10" step="0.1"></label>
      <label class="f">Risque calculé sur<select id="soComp"><option value="1">le solde (intérêts composés)</option><option value="0">le capital de départ</option></select></label>
      <label class="f">Retirer chaque mois (% des gains du mois)<input type="number" id="soWd" min="0" max="100" step="10"></label>
      <label class="f">Durée<select id="soH"><option value="12">12 mois</option><option value="24">24 mois</option><option value="36">36 mois</option></select></label>
      <label class="f">Pertes plus grosses qu'en backtest<select id="soSlip"><option value="0">non</option><option value="0.02">+2 %</option><option value="0.05">+5 %</option></select></label>
      <label class="f">Avantage gardé en réel<select id="soEdge"><option value="1">100 % (comme le backtest)</option><option value="0.75">75 %</option><option value="0.5">50 %</option></select></label>
    </div>
    <p class="hint">Pas de règle de prop firm : pas de perte du jour ni de perte max. Le risque d'un trade est un pourcentage du solde du début de séance (ou du capital de départ). Les retraits se font en fin de mois, sur le gain du mois.</p>
  </div>
  <div class="card c7">
    <h2>Résultat</h2>
    <div class="verdict" id="soVerdict" style="margin-top:0"></div>
    <div class="res" id="soKpi"></div>
    <h3>Gain cumulé (solde + retraits − capital)</h3>
    <div id="soChart"></div>
    <p class="hint" style="margin-top:2px">Ligne : parcours médian · zone : de 1 parcours sur 10 à 9 sur 10.</p>
  </div>
</div>`;
    bind();
  }

  // ---------- liens formulaire <-> réglages ----------
  const F = { smBudget: 'budget', smSize0: 'size0', smN0: 'n0', smStag: 'stagger', smRe: 'reinvest', smCap: 'cap', smRel: 'relaunch', smRc: 'rc', smRc2: 'rc2', smRf: 'rf', smCush: 'cushion', smH: 'H', smCycle: 'cycle', smSplit: 'split', smFx: 'fx', smSlip: 'slip', smEdge: 'edge', smD1: 'd1', smD2: 'd2' };
  const FO = { soCap: 'capital', soRisk: 'risk', soComp: 'compound', soWd: 'withdraw', soH: 'H', soSlip: 'slip', soEdge: 'edge' };
  function fill() {
    for (const [id, key] of Object.entries(F)) $('#' + id).value = ST[key];
    for (const [id, key] of Object.entries(FO)) $('#' + id).value = ST.own[key];
    document.querySelectorAll('#smMode button').forEach(b => b.classList.toggle('on', b.dataset.m === ST.mode));
    $('#smFtmo').hidden = ST.mode !== 'ftmo'; $('#smOwn').hidden = ST.mode !== 'own';
  }
  function read() {
    const v = id => { const x = $('#' + id).value; if (id === 'smRc2') return x; const n = parseFloat(String(x).replace(',', '.')); return isFinite(n) ? n : null; };
    for (const [id, key] of Object.entries(F)) { const x = v(id); if (x !== null) ST[key] = x; }
    for (const [id, key] of Object.entries(FO)) { const x = v(id); if (x !== null) ST.own[key] = x; }
    ST.n0 = Math.max(1, Math.min(4, ST.n0 | 0)); ST.rc = Math.max(0.1, ST.rc); ST.rf = Math.max(0.1, ST.rf); ST.cushion = Math.max(0, ST.cushion); ST.cap = Math.max(10, ST.cap);
    save();
  }
  let tm = 0;
  function bind() {
    document.querySelectorAll('#smMode button').forEach(b => b.onclick = () => { ST.mode = b.dataset.m; save(); fill(); compute(); });
    document.querySelectorAll('#smFtmo input, #smFtmo select, #smOwn input, #smOwn select').forEach(el => el.addEventListener('change', () => { read(); clearTimeout(tm); tm = setTimeout(compute, 120); }));
    $('#smCmp').onclick = compare;
    $('#smPlanLoad').onclick = () => { Object.assign(ST, { mode: 'ftmo', budget: 1200, size0: 50000, n0: 1, stagger: 0, reinvest: 100000, cap: 400, relaunch: 1, rc: 1.5, rc2: '', rf: 2.15, cushion: 5 }); save(); fill(); compute(); $('#smFtmo').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    $('#smCmpT').addEventListener('click', ev => { const tr = ev.target.closest('tr[data-i]'); if (!tr || !LAST_CMP) return; Object.assign(ST, LAST_CMP[+tr.dataset.i].set); save(); fill(); compute(); $('#simBody').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  }

  // ---------- calculs ----------
  function warnings(o) {
    const w = [], p0 = E.priceOf(ST.size0), buy = Math.min(ST.n0, Math.floor(ST.budget / p0));
    if (buy < 1) w.push(['danger', `Le budget (${eur(ST.budget)}) n'achète pas un challenge de ${k(ST.size0)} (${eur(p0)}).`]);
    else if (buy < ST.n0) w.push(['warn', `Le budget n'achète que ${buy} compte(s) au départ ; les autres attendront un versement.`]);
    if (ST.n0 * ST.size0 > ST.cap * 1000) w.push(['warn', 'Les comptes du départ dépassent le plafond FTMO : seuls ceux qui tiennent sous le plafond sont ouverts.']);
    const rmax = Math.max(ST.rf, ST.rc);
    if (rmax * -E.WORST >= 5) w.push(['danger', `Au-dessus de ${nf(5 / -E.WORST, 2)} %, la pire journée des 3 ans (${nf(E.WORST, 2)} R) dépasse la perte du jour de 5 % : le compte est perdu.`]);
    else if (ST.rf * 3.15 >= 5) w.push(['warn', 'Compte financé au-dessus de 1,59 % : une journée à 3 pertes pleines (jamais vue en 3 ans, donc absente de la simulation) ferait perdre le compte.']);
    if (+ST.cushion > 0) w.push(['', `Coussin de ${nf(ST.cushion)} % : versements seulement au-dessus de +${nf(ST.cushion)} %, marge de ${nf(10 + +ST.cushion)} % avant la perte max une fois le coussin constitué ; la perte du jour reste à 5 %. À vérifier chez FTMO : laisser une partie des gains au versement.`]);
    $('#smWarn').innerHTML = w.map(([c, t]) => `<div class="alert ${c}">${t}</div>`).join('');
  }
  function compute() {
    if (ST.mode === 'own') return computeOwn();
    const o = optOf(ST), H = +ST.H, t0 = performance.now();
    warnings(o);
    const r = E.sim(o, H, 2000, 7), c = E.challenge(ST.rc, 6000, 11, { slip: o.slip, d1: o.d1, d2: o.d2, edge: o.edge });
    $('#smInfo').textContent = `2 000 parcours · ${Math.round(performance.now() - t0)} ms`;
    $('#smVerdict').innerHTML = `En ${H} mois, <b class="${r.mean >= 0 ? 'bull' : 'bear'}">${eur(r.mean)}</b> encaissés nets en moyenne (médiane ${eur(r.med)}). Aucun versement dans <b>${pc(r.neverPaid)}</b> des parcours (challenges ratés ou comptes perdus avant le premier versement, puis budget épuisé). Premier versement vers <b>${mo(r.firstPay)}</b> (médiane).`;
    $('#smKpi').innerHTML = [
      kpi('Gain net moyen', eur(r.mean), `médiane ${eur(r.med)}`, r.mean >= 0 ? 'bull' : 'bear'),
      kpi('1 parcours sur 10, au pire', eur(r.p10), `9 sur 10 sous ${eur(r.p90)}`, r.p10 >= 0 ? '' : 'bear'),
      kpi('Aucun versement', pc(r.neverPaid), `sans compte ni caisse à la fin : ${pc(r.stuck)}`),
      kpi('1er versement', mo(r.firstPay), 'médiane'),
      kpi('Mois sans versement', nf(r.monthsNoPay, 1) + ' / ' + H, `dont ${nf(r.gaps, 1)} après le 1er`),
      kpi('Sans compte financé', pc(r.noFund), 'part du temps'),
      kpi('Challenges achetés', nf(r.bought, 1), `${nf(r.funded, 1)} comptes financés`),
      kpi('Comptes financés perdus', pc(r.lostShare), `retour au financé : ${mo(r.relaunchMed)}`),
      kpi('Challenge réussi', pc(c.both), `phase 1 ${pc(c.p1)} · phase 2 ${pc(c.p2)}`),
      kpi('Challenge en 2 mois', pc(c.both ? c.in2m / c.both : NaN), `des réussis · médiane ${mo(c.med)}`)
    ].join('');
    const cv = r.curve, z = [0];
    chart($('#smChart'), H, z.concat(cv.med), z.concat(cv.lo), z.concat(cv.hi), v => (Math.abs(v) >= 1000 ? nf(v / 1000) + ' k' : nf(v)) + ' €', m => `Mois ${m} : médiane ${eur(cv.med[m - 1])} · 1 sur 10 ${eur(cv.lo[m - 1])} · 9 sur 10 ${eur(cv.hi[m - 1])}`);
    chart($('#smChart2'), H, z.concat(cv.fund), null, null, v => nf(v, 1), m => `Mois ${m} : ${nf(cv.fund[m - 1], 2)} compte(s) financé(s) en moyenne`);
    challengeTable(o);
  }
  let CT_KEY = '';
  function challengeTable(o) {
    const key = [o.slip, o.d1, o.d2, o.edge, ST.rc].join('|'); if (key === CT_KEY) return; CT_KEY = key;
    const risks = [1, 1.2, 1.4, 1.5, 1.6, 1.8, 2, 2.2, 2.5]; if (!risks.includes(+ST.rc)) { risks.push(+ST.rc); risks.sort((a, b) => a - b); }
    const rows = risks.map(rc => { const c = E.challenge(rc, 5000, 11, { slip: o.slip, d1: o.d1, d2: o.d2, edge: o.edge }); return `<tr${rc === +ST.rc ? ' style="background:rgba(228,162,74,.12)"' : ''}><td class="mono">${nf(rc, 2)} %</td><td class="mono">${pc(c.p1)}</td><td class="mono">${pc(c.p2)}</td><td class="mono"><b>${pc(c.both)}</b></td><td class="mono">${mo(c.med)}</td><td class="mono">${mo(c.p90)}</td><td class="mono">${pc(c.both ? c.in2m / c.both : NaN)}</td></tr>`; }).join('');
    $('#smChT').innerHTML = `<thead><tr><th>Risque</th><th>Phase 1</th><th>Phase 2</th><th>Les deux</th><th>Durée médiane</th><th>9 sur 10 avant</th><th>En 2 mois</th></tr></thead><tbody>${rows}</tbody>`;
  }

  // ---------- comparaison ----------
  let LAST_CMP = null;
  function compare() {
    read();
    const base = { stagger: 0, reinvest: 0, rc2: '' };
    const P = [
      ['1 × 200k d\'un coup', { size0: 200000, n0: 1 }],
      ['2 × 100k d\'un coup', { size0: 100000, n0: 2 }],
      ['3 × 50k d\'un coup', { size0: 50000, n0: 3 }],
      ['2 × 100k l\'un après l\'autre', { size0: 100000, n0: 2, stagger: 1 }],
      ['Double challenge 2 × 100k (le 2e à 2,2 %)', { size0: 100000, n0: 2, rc2: 2.2 }],
      ['1 × 200k, puis réinvestir en 200k', { size0: 200000, n0: 1, reinvest: 200000 }],
      ['2 × 100k, puis réinvestir en 100k', { size0: 100000, n0: 2, reinvest: 100000 }],
      ['3 × 50k, puis réinvestir en 50k', { size0: 50000, n0: 3, reinvest: 50000 }],
      ['1 × 100k + réserve, puis réinvestir en 100k', { size0: 100000, n0: 1, reinvest: 100000 }],
      ['1 × 50k + réserve, puis réinvestir en 100k', { size0: 50000, n0: 1, reinvest: 100000 }],
      ['Double challenge 2 × 50k (le 2e à 2,2 %), puis réinvestir en 100k', { size0: 50000, n0: 2, rc2: 2.2, reinvest: 100000 }]
    ];
    const H = +ST.H, out = []; let i = 0;
    $('#smCmp').disabled = true;
    const step = () => {
      const [name, set] = P[i], s = Object.assign({}, ST, base, set), r = E.sim(optOf(s), H, 1500, 7);
      out.push({ name, set: Object.assign({}, base, set), r });
      $('#smCmpT').innerHTML = `<tbody><tr><td class="muted">Calcul ${i + 1} / ${P.length}…</td></tr></tbody>`;
      if (++i < P.length) setTimeout(step, 0); else { LAST_CMP = out; paintCmp(out, H); $('#smCmp').disabled = false; }
    };
    setTimeout(step, 0);
  }
  function paintCmp(out, H) {
    const best = out.reduce((a, b) => b.r.mean > a.r.mean ? b : a);
    const rows = out.map((x, i) => { const r = x.r; return `<tr data-i="${i}" class="jrow"${x === best ? ' style="background:rgba(63,182,139,.10)"' : ''}><td>${x.name}</td><td class="mono ${r.mean >= 0 ? 'r-pos' : 'r-neg'}"><b>${eur(r.mean)}</b></td><td class="mono">${eur(r.med)}</td><td class="mono">${eur(r.p10)}</td><td class="mono">${pc(r.neverPaid)}</td><td class="mono">${mo(r.firstPay)}</td><td class="mono">${nf(r.monthsNoPay, 1)}</td><td class="mono">${nf(r.bought, 1)}</td></tr>`; }).join('');
    $('#smCmpT').innerHTML = `<thead><tr><th>Stratégie</th><th>Gain net moyen</th><th>Médiane</th><th>1 sur 10</th><th>Aucun versement</th><th>1er versement</th><th>Mois sans versement (/${H})</th><th>Challenges</th></tr></thead><tbody>${rows}</tbody>`;
  }

  // ---------- compte propre ----------
  function computeOwn() {
    const s = ST.own, H = +s.H, r = E.own({ capital: s.capital, risk: s.risk, compound: !!+s.compound, withdraw: s.withdraw / 100, slip: +s.slip, edge: +s.edge }, H, 2000, 5);
    $('#soVerdict').innerHTML = `En ${H} mois, gain médian <b class="${r.totMed >= 0 ? 'bull' : 'bear'}">${eur(r.totMed)}</b> (${pc(r.totMed / s.capital)} du capital) ; 1 parcours sur 10 sous ${eur(r.totP10)}. Pire baisse médiane ${pc(-r.ddMed)}, et 1 parcours sur 10 voit une baisse de ${pc(-r.ddP10)} ou plus.`;
    $('#soKpi').innerHTML = [
      kpi('Gain médian', eur(r.totMed), pc(r.totMed / s.capital) + ' du capital', r.totMed >= 0 ? 'bull' : 'bear'),
      kpi('1 parcours sur 10, au pire', eur(r.totP10), `9 sur 10 sous ${eur(r.totP90)}`, r.totP10 >= 0 ? '' : 'bear'),
      kpi('Retiré (médiane)', eur(r.wdMed), `solde final médian ${eur(r.finMed)}`),
      kpi('Pire baisse (médiane)', pc(-r.ddMed), `1 sur 10 : ${pc(-r.ddP10)} ou plus`),
      kpi('Baisse de 20 % ou plus', pc(r.dd20), 'des parcours'),
      kpi('Finir perdant', pc(r.loss), 'des parcours')
    ].join('');
    const cv = r.curve, z = [0];
    chart($('#soChart'), H, z.concat(cv.med), z.concat(cv.lo), z.concat(cv.hi), v => (Math.abs(v) >= 1000 ? nf(v / 1000) + ' k' : nf(v)) + ' €', m => `Mois ${m} : médiane ${eur(cv.med[m - 1])} · 1 sur 10 ${eur(cv.lo[m - 1])} · 9 sur 10 ${eur(cv.hi[m - 1])}`);
  }

  let built = false, rz = 0;
  function show() { if (!built) { build(); fill(); built = true; setTimeout(compute, 30); } }
  window.addEventListener('resize', () => { if (!built) return; clearTimeout(rz); rz = setTimeout(() => { if (!$('#tab-simu').classList.contains('active')) return; compute(); if (LAST_CMP) paintCmp(LAST_CMP, +ST.H); }, 250); });
  window.DeskSim = { show };
})();
