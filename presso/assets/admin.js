/* Presso Center — espace de gestion (agenda, clients, finances, matériel) */
(function () {
  'use strict';
  const PC = window.PC;
  const esc = PC.esc;
  const I = PC.icon;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const mq = window.matchMedia('(max-width: 900px)');

  let store;
  let D = null; // données
  let S = null; // réglages
  const UI = {
    view: 'accueil',
    week: PC.startOfWeek(new Date()),
    day: PC.startOfDay(new Date()),
    month: PC.monthKey(new Date()),
    clientsTab: 'particuliers',
    search: '',
    txFilter: 'tout',
    showTable: false,
    user: null,
    recovery: false
  };

  const VIEWS = {
    accueil: { label: 'Accueil', icon: 'home', render: viewHome },
    agenda: { label: 'Agenda', icon: 'calendar', render: viewAgenda },
    clients: { label: 'Clients', icon: 'users', render: viewClients },
    finances: { label: 'Finances', icon: 'euro', render: viewFinances },
    materiel: { label: 'Matériel', icon: 'box', render: viewMateriel },
    reglages: { label: 'Réglages', icon: 'sliders', render: viewReglages }
  };

  /* =================================================================
     Démarrage, connexion
     ================================================================= */
  async function boot() {
    try {
      store = PC.createStore();
    } catch (e) {
      return fatal(e.message);
    }
    if (store.mode === 'supabase') {
      store.client.auth.onAuthStateChange((ev) => {
        if (ev === 'PASSWORD_RECOVERY') {
          UI.recovery = true;
          renderAuth('reset');
        }
      });
      let s = null;
      try {
        s = await store.session();
      } catch (e) {
        return fatal(e.message);
      }
      if (UI.recovery) return renderAuth('reset');
      if (!s) return renderAuth('login');
      if (!s.admin) return renderAuth('claim');
      UI.user = s.user;
    }
    try {
      await load();
    } catch (e) {
      return fatal('Chargement impossible : ' + e.message);
    }
    shell();
    route();
    window.addEventListener('hashchange', route);
    mq.addEventListener('change', render);
    let rz;
    window.addEventListener('resize', () => {
      clearTimeout(rz);
      rz = setTimeout(() => { if (UI.view === 'finances' && !UI.showTable) bindChart(); }, 150);
    });
  }

  function fatal(msg) {
    document.body.innerHTML = '<div class="auth"><div class="card"><span class="brand">Presso Center</span><h2 style="font-size:20px">Une erreur est survenue</h2><p class="muted" style="margin-top:8px">' + esc(msg) + '</p><button class="btn" style="margin-top:16px" onclick="location.reload()">Recharger</button></div></div>';
  }

  function renderAuth(mode, msg) {
    const forms = {
      login: '<h2 style="font-size:22px">Connexion</h2><p class="muted" style="margin:6px 0 18px">Accès réservé à l\'équipe Presso Center.</p>' +
        '<form id="auth-form" class="stack"><label class="field"><span>E-mail</span><input name="email" type="email" autocomplete="email" required></label><label class="field"><span>Mot de passe</span><input name="password" type="password" autocomplete="current-password" required></label><button class="btn block">Se connecter</button></form>' +
        '<div class="row between" style="margin-top:14px"><button class="btn sm soft" data-auth="signup">Créer mon compte</button><button class="btn sm ghost" data-auth="forgot">Mot de passe oublié</button></div>',
      signup: '<h2 style="font-size:22px">Créer mon compte</h2><p class="muted" style="margin:6px 0 18px">Ensuite, tu actives l\'accès avec ton code d\'activation.</p>' +
        '<form id="auth-form" class="stack"><label class="field"><span>E-mail</span><input name="email" type="email" autocomplete="email" required></label><label class="field"><span>Mot de passe (8 caractères minimum)</span><input name="password" type="password" minlength="8" autocomplete="new-password" required></label><button class="btn block">Créer le compte</button></form>' +
        '<button class="btn sm ghost" data-auth="login" style="margin-top:14px">J\'ai déjà un compte</button>',
      forgot: '<h2 style="font-size:22px">Mot de passe oublié</h2><p class="muted" style="margin:6px 0 18px">Tu reçois un lien par e-mail pour en choisir un nouveau.</p>' +
        '<form id="auth-form" class="stack"><label class="field"><span>E-mail</span><input name="email" type="email" autocomplete="email" required></label><button class="btn block">Envoyer le lien</button></form>' +
        '<button class="btn sm ghost" data-auth="login" style="margin-top:14px">Retour</button>',
      reset: '<h2 style="font-size:22px">Nouveau mot de passe</h2><form id="auth-form" class="stack" style="margin-top:18px"><label class="field"><span>Nouveau mot de passe</span><input name="password" type="password" minlength="8" autocomplete="new-password" required></label><button class="btn block">Enregistrer</button></form>',
      claim: '<h2 style="font-size:22px">Activer l\'espace de gestion</h2><p class="muted" style="margin:6px 0 18px">Ton compte est créé. Entre le code d\'activation qu\'on t\'a transmis : il ne sert qu\'une fois.</p>' +
        '<form id="auth-form" class="stack"><label class="field"><span>Code d\'activation</span><input name="code" autocomplete="off" required></label><button class="btn block">Activer</button></form>' +
        '<button class="btn sm ghost" data-auth="logout" style="margin-top:14px">Se déconnecter</button>'
    };
    document.body.innerHTML = '<div class="auth"><div class="card"><span class="brand">Presso Center</span>' + forms[mode] + '<p id="auth-msg" class="small" style="margin-top:14px" role="status">' + (msg ? esc(msg) : '') + '</p></div></div>';
    const msgEl = $('#auth-msg');
    $('.auth').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-auth]');
      if (!b) return;
      if (b.dataset.auth === 'logout') {
        await store.signOut();
        return renderAuth('login');
      }
      renderAuth(b.dataset.auth);
    });
    $('#auth-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target).entries());
      const btn = e.target.querySelector('button');
      btn.disabled = true;
      msgEl.style.color = '';
      try {
        if (mode === 'login') {
          await store.signIn(f.email, f.password);
          location.reload();
        } else if (mode === 'signup') {
          const r = await store.signUp(f.email, f.password);
          if (r && r.session) return renderAuth('claim');
          renderAuth('login', 'Compte créé. Clique sur le lien reçu par e-mail pour le confirmer, puis connecte-toi.');
        } else if (mode === 'forgot') {
          await store.resetPassword(f.email);
          msgEl.textContent = 'Si un compte existe pour cette adresse, un lien vient d\'être envoyé.';
        } else if (mode === 'reset') {
          await store.updatePassword(f.password);
          UI.recovery = false;
          location.hash = '';
          location.reload();
        } else if (mode === 'claim') {
          const ok = await store.claim(String(f.code).trim());
          if (ok) location.reload();
          else msgEl.textContent = 'Code invalide ou déjà utilisé.';
        }
      } catch (ex) {
        msgEl.style.color = 'var(--bad)';
        msgEl.textContent = authError(ex.message);
      }
      btn.disabled = false;
    });
  }

  function authError(m) {
    if (/Invalid login/i.test(m)) return 'E-mail ou mot de passe incorrect.';
    if (/Email not confirmed/i.test(m)) return 'Confirme d\'abord ton adresse avec le lien reçu par e-mail.';
    if (/already registered/i.test(m)) return 'Un compte existe déjà avec cette adresse.';
    if (/Password should be/i.test(m)) return 'Mot de passe trop court (8 caractères minimum).';
    if (/rate limit/i.test(m)) return 'Trop de tentatives, réessaie dans quelques minutes.';
    return m;
  }

  async function load() {
    D = await store.loadAll();
    S = D.settings;
    D.clients.forEach((c) => (c.credits = c.credits || {}));
  }

  /* =================================================================
     Coquille, navigation
     ================================================================= */
  function shell() {
    const nav = (k, v) => '<button class="nav-btn" data-nav="' + k + '">' + I(v.icon) + '<span>' + v.label + '</span><span class="count hide" data-count="' + k + '"></span></button>';
    const tab = (k) => '<button data-nav="' + k + '">' + I(VIEWS[k].icon) + '<span>' + VIEWS[k].label + '</span><span class="count hide" data-count="' + k + '"></span></button>';
    const banner = store.mode === 'local'
      ? '<div class="demo-banner">Mode démo : données fictives, enregistrées dans ce navigateur uniquement. <button data-act="reset-demo">Réinitialiser</button><a href="./" style="color:inherit">Page client</a></div>'
      : '';
    document.body.innerHTML = banner +
      '<div class="app"><aside class="side"><a class="brand" href="#accueil">Presso Center</a>' +
      Object.keys(VIEWS).map((k) => nav(k, VIEWS[k])).join('') +
      '<div class="spacer"></div><a class="nav-btn" href="./" target="_blank" rel="noopener">' + I('external') + '<span>Page de réservation</span></a>' +
      (store.mode === 'supabase' ? '<button class="nav-btn" data-act="logout">' + I('logout') + '<span>Se déconnecter</span></button><div class="who">' + esc(UI.user ? UI.user.email : '') + '</div>' : '') +
      '</aside><div class="content"><header class="topbar"><span class="brand" style="padding:0">Presso Center</span><span class="row"><a class="btn icon" href="./" target="_blank" rel="noopener" aria-label="Page de réservation">' + I('external') + '</a><button class="btn icon" data-nav="reglages" aria-label="Réglages">' + I('sliders') + '</button></span></header>' +
      '<main class="main" id="view"></main></div>' +
      '<nav class="tabbar" aria-label="Navigation">' + ['accueil', 'agenda', 'clients', 'finances', 'materiel'].map(tab).join('') + '</nav></div>' +
      '<dialog class="modal" id="modal"></dialog>';
    document.body.addEventListener('click', onClick);
  }

  function route() {
    const h = location.hash.replace('#', '');
    if (h.includes('=')) return;
    UI.view = VIEWS[h] ? h : 'accueil';
    render();
    window.scrollTo(0, 0);
  }
  function go(view) {
    if (location.hash === '#' + view) render();
    else location.hash = view;
  }

  function render() {
    if (!D) return;
    const v = $('#view');
    if (!v) return;
    v.innerHTML = VIEWS[UI.view].render();
    $$('[data-nav]').forEach((b) => b.setAttribute('aria-current', b.dataset.nav === UI.view ? 'page' : 'false'));
    const counts = { agenda: D.bookings.filter((b) => b.status === 'demande').length, clients: D.partners.filter((p) => p.status === 'demande').length };
    $$('[data-count]').forEach((el) => {
      const n = counts[el.dataset.count] || 0;
      el.textContent = n;
      el.classList.toggle('hide', !n);
    });
    document.title = 'Presso Center · ' + VIEWS[UI.view].label;
    afterRender();
  }

  /* =================================================================
     Données : écritures
     ================================================================= */
  async function save(table, obj) {
    const arr = D[table];
    if (obj.id && arr.some((r) => r.id === obj.id)) {
      const row = await store.update(table, obj.id, obj);
      const i = arr.findIndex((r) => r.id === obj.id);
      arr[i] = Object.assign({}, arr[i], row);
      return arr[i];
    }
    const o = Object.assign({}, obj);
    if (!o.id) delete o.id;
    const row = await store.insert(table, o);
    arr.push(row);
    return row;
  }
  async function patch(table, id, p) {
    return save(table, Object.assign({ id }, p));
  }
  async function remove(table, id) {
    await store.remove(table, id);
    D[table] = D[table].filter((r) => r.id !== id);
  }
  async function saveSettings(next) {
    await store.saveSettings(next);
    S = D.settings = PC.mergeSettings(next);
  }
  async function run(fn, okMsg) {
    try {
      const r = await fn();
      if (okMsg) PC.toast(okMsg);
      render();
      return r;
    } catch (e) {
      console.error(e);
      PC.toast(e.message || 'Erreur', 'bad');
      return undefined;
    }
  }

  /* =================================================================
     Calculs
     ================================================================= */
  const sum = (arr, f) => arr.reduce((a, x) => a + (Number(f ? f(x) : x) || 0), 0);
  const bStart = (b) => new Date(b.start_at);
  const bEnd = (b) => PC.addMinutes(new Date(b.start_at), Number(b.duration_min) || 0);
  const partnerById = (id) => D.partners.find((p) => p.id === id);
  const clientById = (id) => D.clients.find((c) => c.id === id);
  const capacity = () => PC.capacity(D.equipment);
  const activeBusy = () => D.bookings.filter(PC.isActive);

  function bTitle(b) {
    if (b.kind === 'indispo') return b.title || 'Indisponible';
    if (b.kind === 'club' || b.kind === 'evenement') {
      const p = partnerById(b.partner_id);
      return b.title || (p ? p.name : PC.KINDS[b.kind].label);
    }
    return b.client_name || 'Client';
  }
  function bSub(b) {
    if (b.kind === 'indispo') return 'Indisponible';
    if (b.kind === 'club') return 'Créneau club · ' + (b.boots || 0) + ' bottes';
    if (b.kind === 'evenement') return 'Événement · ' + PC.durationLabel(b.duration_min);
    const sv = PC.service(S, b.service);
    return (sv ? sv.name : PC.KINDS[b.kind].label) + (b.people > 1 ? ' × ' + b.people : '');
  }
  function statusBadge(b) {
    const cls = { demande: 'warn', confirmee: 'info', terminee: 'good', annulee: 'plain', absent: 'bad' }[b.status] || '';
    return '<span class="badge ' + cls + '">' + esc(PC.STATUSES[b.status] || b.status) + '</span>';
  }

  function monthsBetween(a, b) {
    const [ya, ma] = a.split('-').map(Number);
    const [yb, mb] = b.split('-').map(Number);
    return (yb - ya) * 12 + (mb - ma);
  }
  function forecastFor(key) {
    const i = monthsBetween(S.start_month, key);
    const f = S.forecast || [];
    return i >= 0 && i < f.length ? Number(f[i]) || 0 : null;
  }
  function txIn(prefix) {
    return D.transactions.filter((t) => String(t.date || '').startsWith(prefix));
  }
  function actOf(cat) {
    const a = PC.ACTIVITIES.find((x) => x.cats.includes(cat));
    return a ? a.key : 'ventes';
  }
  const NOT_CHARGES = ['cotisations', 'remuneration', 'adie'];
  function monthStats(key) {
    const tx = txIn(key);
    const rec = tx.filter((t) => t.type === 'recette');
    const dep = tx.filter((t) => t.type === 'depense');
    const ca = PC.round2(sum(rec, (t) => t.amount));
    const byAct = {};
    PC.ACTIVITIES.forEach((a) => (byAct[a.key] = 0));
    rec.forEach((t) => (byAct[actOf(t.category)] += Number(t.amount) || 0));
    const cotisEst = PC.round2(ca * Number(S.social_rate || 0));
    const charges = PC.round2(sum(dep.filter((t) => !NOT_CHARGES.includes(t.category)), (t) => t.amount));
    const adie = PC.round2(sum(dep.filter((t) => t.category === 'adie'), (t) => t.amount));
    const verse = PC.round2(sum(dep.filter((t) => t.category === 'remuneration'), (t) => t.amount));
    const cotisPaid = PC.round2(sum(dep.filter((t) => t.category === 'cotisations'), (t) => t.amount));
    return { key, ca, byAct, cotisEst, charges, adie, verse, cotisPaid, reste: PC.round2(ca - cotisEst - charges - adie), forecast: forecastFor(key), count: tx.length };
  }
  function cashAt(key) {
    const end = key + '-31';
    const tx = D.transactions.filter((t) => String(t.date) <= end);
    const rec = sum(tx.filter((t) => t.type === 'recette'), (t) => t.amount);
    const dep = sum(tx.filter((t) => t.type === 'depense'), (t) => t.amount);
    const cotisPaid = sum(tx.filter((t) => t.category === 'cotisations'), (t) => t.amount);
    const cash = PC.round2(Number(S.opening_cash || 0) + rec - dep);
    const provision = Math.max(0, PC.round2(rec * Number(S.social_rate || 0) - cotisPaid));
    return { cash, provision, dispo: PC.round2(cash - provision) };
  }
  function yearCA(year) {
    return PC.round2(sum(txIn(String(year)).filter((t) => t.type === 'recette'), (t) => t.amount));
  }
  function loanInfo() {
    const L = S.loan || {};
    const first = PC.addMonths(S.start_month, Number(L.deferral_months) || 0);
    const paid = D.transactions.filter((t) => t.category === 'adie' && Number(t.amount) >= Number(L.monthly || 0) * 0.8 && Number(t.amount) < Number(L.contribution || 1e9)).length;
    const left = Math.max(0, (Number(L.payments) || 0) - paid);
    return { first, paid, left, due: PC.round2(left * Number(L.monthly || 0)) };
  }
  function partnerBilled(p, key) {
    return D.transactions.some((t) => t.category === 'forfait_club' && t.partner_id === p.id && String(t.date).startsWith(key));
  }
  function weekHours(weekStart) {
    const a = weekStart.getTime();
    const z = PC.addDays(weekStart, 7).getTime();
    const iv = D.bookings
      .filter((b) => b.kind !== 'indispo' && ['demande', 'confirmee', 'terminee'].includes(b.status))
      .map((b) => {
        let s = bStart(b).getTime(), e = bEnd(b).getTime();
        if (b.kind === 'domicile') { s -= S.travel_min * 60000; e += S.travel_min * 60000; }
        return [Math.max(s, a), Math.min(e, z)];
      })
      .filter(([s, e]) => e > s)
      .sort((x, y) => x[0] - y[0]);
    let total = 0, cs = -1, ce = -1;
    iv.forEach(([s, e]) => {
      if (s > ce) { if (ce > cs) total += ce - cs; cs = s; ce = e; } else ce = Math.max(ce, e);
    });
    if (ce > cs) total += ce - cs;
    return total / 3600000;
  }
  function bootHours() {
    const mins = sum(D.bookings.filter((b) => b.status === 'terminee' && b.kind !== 'indispo'), (b) => {
      if (b.kind === 'club' || b.kind === 'evenement') return (Number(b.passages) || 0) * 25;
      return (Number(b.duration_min) || 0) * (Number(b.boots) || 1);
    });
    return mins / 60;
  }
  function lastCheck() {
    const c = D.checks.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
    if (!c) return null;
    return { check: c, days: Math.floor((PC.startOfDay(new Date()) - PC.parseYmd(c.date)) / 86400000) };
  }
  function bookingUrl() {
    return new URL('./', location.href).href;
  }
  const fmtH = (h) => {
    const hh = Math.floor(h + 1e-9), mm = Math.round((h - hh) * 60);
    return hh + ' h' + (mm ? ' ' + PC.pad(mm) : '');
  };

  function alerts() {
    const out = [];
    const now = new Date();
    const mk = PC.monthKey(now);
    const dem = D.bookings.filter((b) => b.status === 'demande');
    if (dem.length) out.push({ cls: 'warn', icon: 'clock', html: '<b>' + dem.length + ' demande' + (dem.length > 1 ? 's' : '') + ' à confirmer</b> sur l\'agenda', act: 'nav', arg: 'agenda', btn: 'Voir' });
    const toClose = D.bookings.filter((b) => b.status === 'confirmee' && b.kind !== 'indispo' && bEnd(b) < now);
    if (toClose.length) out.push({ cls: 'info', icon: 'check', html: '<b>' + toClose.length + ' séance' + (toClose.length > 1 ? 's' : '') + ' passée' + (toClose.length > 1 ? 's' : '') + '</b> à clôturer (passages, paiement)', act: 'open-booking', arg: toClose[0].id, btn: 'Clôturer' });
    const unpaid = D.bookings.filter((b) => b.status === 'terminee' && !b.paid && Number(b.price) > 0 && b.payment_mode !== 'credit' && b.payment_mode !== 'forfait');
    if (unpaid.length) out.push({ cls: 'warn', icon: 'euro', html: '<b>' + PC.eur(sum(unpaid, (b) => b.price)) + ' à encaisser</b> sur ' + unpaid.length + ' séance' + (unpaid.length > 1 ? 's' : ''), act: 'open-booking', arg: unpaid[0].id, btn: 'Encaisser' });
    const req = D.partners.filter((p) => p.status === 'demande');
    if (req.length) out.push({ cls: 'info', icon: 'users', html: '<b>' + req.length + ' demande' + (req.length > 1 ? 's' : '') + ' de test pilote</b> : ' + esc(req.map((p) => p.name).join(', ')), act: 'open-partner', arg: req[0].id, btn: 'Voir' });
    const toBill = D.partners.filter((p) => p.status === 'contrat' && Number(p.monthly_price) > 0 && !partnerBilled(p, mk));
    if (toBill.length) out.push({ cls: 'info', icon: 'euro', html: '<b>Forfait' + (toBill.length > 1 ? 's' : '') + ' de ' + PC.fmtMonth(mk).toLowerCase() + ' à facturer</b> : ' + esc(toBill.map((p) => p.name).join(', ')), act: 'bill-partner', arg: toBill[0].id, btn: 'Facturer' });
    const endPilot = D.partners.filter((p) => p.status === 'pilote' && p.pilot_end && (PC.parseYmd(p.pilot_end) - PC.startOfDay(now)) / 86400000 <= 7);
    endPilot.forEach((p) => out.push({ cls: 'info', icon: 'star', html: '<b>Fin du pilote ' + esc(p.name) + '</b> le ' + PC.fmtDate(p.pilot_end) + ' : prépare le bilan et propose un forfait', act: 'report-partner', arg: p.id, btn: 'Bilan' }));
    const broken = D.equipment.filter((e) => e.kind === 'botte' && ['a_verifier', 'panne', 'reparation'].includes(e.status));
    if (broken.length) out.push({ cls: 'bad', icon: 'tool', html: '<b>' + esc(broken.map((e) => e.name).join(', ')) + '</b> : ' + esc(broken.map((e) => PC.EQUIP_STATUSES[e.status].toLowerCase()).join(', ')), act: 'open-equipment', arg: broken[0].id, btn: 'Voir' });
    const lc = lastCheck();
    if (!lc || lc.days > 7) out.push({ cls: 'warn', icon: 'tool', html: lc ? '<b>Contrôle du matériel</b> : le dernier date de ' + lc.days + ' jours' : '<b>Aucun contrôle du matériel</b> enregistré', act: 'new-check', btn: 'Contrôler' });
    const low = D.stock.filter((s) => Number(s.qty) <= Number(s.min_qty));
    if (low.length) out.push({ cls: 'warn', icon: 'box', html: '<b>Stock bas</b> : ' + esc(low.map((s) => s.name + ' (' + PC.num(s.qty, 1) + ')').join(', ')), act: 'nav', arg: 'materiel', btn: 'Voir' });
    const L = loanInfo();
    if (mk >= L.first && L.left > 0 && !txIn(mk).some((t) => t.category === 'adie')) out.push({ cls: 'info', icon: 'euro', html: '<b>Mensualité Adie</b> de ' + PC.eur(S.loan.monthly) + ' pas encore saisie ce mois-ci', act: 'add-adie', btn: 'Saisir' });
    const yr = yearCA(now.getFullYear());
    if (S.vat_threshold && yr >= S.vat_threshold * 0.8) out.push({ cls: yr >= S.vat_threshold ? 'bad' : 'warn', icon: 'alert', html: '<b>TVA</b> : ' + PC.eur(yr) + ' de chiffre d\'affaires cette année, seuil de franchise à ' + PC.eur(S.vat_threshold), act: 'nav', arg: 'finances', btn: 'Voir' });
    return out;
  }

  /* =================================================================
     Vue : Accueil
     ================================================================= */
  function viewHome() {
    const now = new Date();
    const mk = PC.monthKey(now);
    const ms = monthStats(mk);
    const cash = cashAt(mk);
    const wh = weekHours(PC.startOfWeek(now));
    const cap = capacity();
    const totalBoots = D.equipment.filter((e) => e.kind === 'botte' && e.status !== 'retiree').length;
    const fc = ms.forecast;
    const pct = fc ? Math.min(100, Math.round((ms.ca / fc) * 100)) : 0;
    const al = alerts();
    const name = String(S.owner_name || '').trim();

    let h = '<div class="page-head"><div><h1>Bonjour' + (name ? ' ' + esc(name) : '') + '</h1><p>' + esc(PC.capitalize(PC.fmtDayLong(now))) + '</p></div>' +
      '<button class="btn" data-act="new-booking">' + I('plus') + 'Nouvelle séance</button></div>';

    h += '<div class="tiles">' +
      tile('Chiffre d\'affaires de ' + PC.fmtMonth(mk).split(' ')[0].toLowerCase(), PC.eur(ms.ca), fc ? 'Prévu : ' + PC.eur(fc) + ' · ' + pct + ' %' : 'Seuil de rentabilité : ' + PC.eur(S.break_even), fc ? meter(pct, pct >= 100 ? 'good' : pct >= 60 ? '' : 'warn') : '', 'dark') +
      tile('Il me reste ce mois', PC.eur(ms.reste), 'Après cotisations, charges et prêt') +
      tile('Heures cette semaine', fmtH(wh), 'Plafond : ' + S.weekly_hours_cap + ' h', meter(Math.min(100, (wh / (S.weekly_hours_cap || 16)) * 100), wh > S.weekly_hours_cap ? 'bad' : wh > S.weekly_hours_cap * 0.85 ? 'warn' : 'good')) +
      tile('Bottes disponibles', cap + ' / ' + totalBoots, 'Jusqu\'à ' + cap * 2 + ' athlètes par heure') +
      '</div>';

    h += '<div class="cols"><div>';
    if (al.length) {
      h += '<div class="card" style="margin-bottom:16px"><div class="card-head"><h2>À faire</h2></div>' + al.map(alertRow).join('') + '</div>';
    }
    h += '<div class="card"><div class="card-head"><h2>Prochaines séances</h2><button class="btn sm ghost" data-nav="agenda">Agenda</button></div>' + upcomingList(8) + '</div>';
    h += '</div><div>';
    h += '<div class="card" style="margin-bottom:16px"><div class="card-head"><h2>' + esc(PC.fmtMonth(mk)) + '</h2><button class="btn sm ghost" data-nav="finances">Finances</button></div>' + monthBreakdown(ms) +
      '<div class="row between" style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line)"><span class="muted small">En caisse, après provision URSSAF</span><b class="tnum">' + PC.eur(cash.dispo) + '</b></div></div>';
    h += '<div class="card cream"><h3>Lien de réservation</h3><p class="small muted" style="margin:4px 0 12px">À partager sur tes réseaux, par WhatsApp ou sur tes flyers.</p>' +
      '<div class="row"><input readonly value="' + esc(bookingUrl()) + '" aria-label="Lien de réservation" style="min-height:40px;font-size:14px"><button class="btn icon sm" data-act="copy-link" aria-label="Copier le lien">' + I('copy') + '</button></div>' +
      '<button class="btn sm ghost" style="margin-top:10px" data-nav="reglages">QR code pour les flyers</button></div>';
    h += '</div></div>';
    return h;
  }

  function tile(lbl, val, sub, extra, cls) {
    return '<div class="tile ' + (cls || '') + '"><span class="lbl">' + esc(lbl) + '</span><span class="val">' + val + '</span>' + (sub ? '<span class="sub">' + esc(sub) + '</span>' : '') + (extra || '') + '</div>';
  }
  function meter(pct, cls) {
    return '<div class="meter ' + (cls || '') + '" role="img" aria-label="' + Math.round(pct) + ' %"><i style="width:' + Math.max(0, Math.min(100, pct)) + '%"></i></div>';
  }
  function alertRow(a) {
    return '<div class="alert ' + a.cls + '">' + I(a.icon) + '<span class="grow">' + a.html + '</span>' + (a.btn ? '<button class="btn sm soft" data-act="' + a.act + '"' + (a.arg ? ' data-id="' + esc(a.arg) + '"' : '') + '>' + esc(a.btn) + '</button>' : '') + '</div>';
  }
  function dayLabel(d) {
    const t = PC.startOfDay(new Date());
    const diff = Math.round((PC.startOfDay(d) - t) / 86400000);
    if (diff === 0) return 'Aujourd\'hui';
    if (diff === 1) return 'Demain';
    if (diff === -1) return 'Hier';
    return PC.capitalize(PC.fmtDay(d, { weekday: 'long', day: 'numeric', month: 'short' }));
  }
  function bookingRow(b) {
    const s = bStart(b);
    return '<div class="li click" data-act="open-booking" data-id="' + b.id + '"><span class="when">' + PC.fmtTime(s) + '<small>' + PC.durationLabel(b.duration_min) + '</small></span>' +
      '<span class="bar k-' + b.kind + '" style="background:var(--k)"></span>' +
      '<span class="grow"><span class="t">' + esc(bTitle(b)) + '</span><br><span class="s">' + esc(bSub(b)) + (b.kind === 'domicile' && b.address ? ' · ' + esc(b.address) : '') + '</span></span>' +
      statusBadge(b) + '</div>';
  }
  function upcomingList(n) {
    const now = Date.now() - 30 * 60000;
    const list = D.bookings.filter((b) => PC.isActive(b) && b.kind !== 'indispo' && bEnd(b).getTime() >= now).sort((a, b) => bStart(a) - bStart(b)).slice(0, n);
    if (!list.length) return '<div class="empty">Aucune séance à venir. Partage ton lien de réservation !</div>';
    let h = '', last = '';
    list.forEach((b) => {
      const d = PC.ymd(bStart(b));
      if (d !== last) {
        h += '<p class="slot-group-label" style="margin:10px 0 2px">' + esc(dayLabel(bStart(b))) + '</p>';
        last = d;
      }
      h += bookingRow(b);
    });
    return '<div class="list">' + h + '</div>';
  }
  function monthBreakdown(ms) {
    const r = (l, v, strong) => '<tr' + (strong ? ' class="total"' : '') + '><td>' + l + '</td><td class="num">' + v + '</td></tr>';
    return '<table class="tbl"><tbody>' +
      r('Chiffre d\'affaires', PC.eur(ms.ca)) +
      r('− Cotisations (' + Math.round(S.social_rate * 1000) / 10 + ' %)', '− ' + PC.eur(ms.cotisEst)) +
      r('− Charges', '− ' + PC.eur(ms.charges)) +
      r('− Prêt Adie', '− ' + PC.eur(ms.adie)) +
      r('Il me reste', PC.eur(ms.reste), true) +
      '</tbody></table>';
  }

  /* =================================================================
     Vue : Agenda
     ================================================================= */
  function viewAgenda() {
    const mobile = mq.matches;
    const ws = UI.week;
    const we = PC.addDays(ws, 6);
    const days = mobile ? [UI.day] : Array.from({ length: 7 }, (_, i) => PC.addDays(ws, i));
    const label = ws.getMonth() === we.getMonth()
      ? ws.getDate() + ' – ' + we.getDate() + ' ' + we.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
      : PC.fmtDay(ws, { day: 'numeric', month: 'short' }) + ' – ' + PC.fmtDay(we, { day: 'numeric', month: 'short', year: 'numeric' });
    const wh = weekHours(ws);
    const weekB = D.bookings.filter((b) => bStart(b) >= ws && bStart(b) < PC.addDays(ws, 7) && b.status !== 'annulee' && b.kind !== 'indispo');
    const pending = D.bookings.filter((b) => b.status === 'demande').sort((a, b) => bStart(a) - bStart(b));

    let h = '<div class="page-head"><div><h1>Agenda</h1><p>' + esc(label) + '</p></div><button class="btn" data-act="new-booking">' + I('plus') + 'Nouveau</button></div>';
    if (pending.length) {
      h += '<div class="card" style="margin-bottom:16px;border-color:var(--gold)"><div class="card-head"><h2>Demandes à confirmer</h2><span class="badge warn">' + pending.length + '</span></div><div class="list">' +
        pending.map((b) => {
          const s = bStart(b);
          return '<div class="li"><span class="bar k-' + b.kind + '" style="background:var(--k)"></span><span class="grow"><span class="t">' + esc(bTitle(b)) + '</span> <span class="s">· ' + esc(bSub(b)) + '</span><br><span class="s">' + esc(PC.capitalize(PC.fmtDay(s, { weekday: 'long', day: 'numeric', month: 'short' }))) + ' à ' + PC.fmtTime(s) + ' · ' + PC.eur(b.price) + (b.source === 'en_ligne' ? ' · en ligne' : '') + '</span></span>' +
            '<span class="row"><button class="btn sm good" data-act="confirm-booking" data-id="' + b.id + '">' + I('check') + 'Confirmer</button><button class="btn sm ghost" data-act="open-booking" data-id="' + b.id + '">Détails</button></span></div>';
        }).join('') + '</div></div>';
    }
    h += '<div class="toolbar"><span class="month-nav"><button class="btn icon sm ghost" data-act="week" data-d="-1" aria-label="Semaine précédente">' + I('left') + '</button><button class="btn sm ghost" data-act="week" data-d="0">Aujourd\'hui</button><button class="btn icon sm ghost" data-act="week" data-d="1" aria-label="Semaine suivante">' + I('right') + '</button></span>' +
      '<span class="grow"></span><span class="small muted">' + fmtH(wh) + ' sur ' + S.weekly_hours_cap + ' h · ' + weekB.filter((b) => b.kind === 'seance' || b.kind === 'domicile').length + ' séances · ' + weekB.filter((b) => b.kind === 'club' || b.kind === 'evenement').length + ' club / événement</span></div>';
    if (mobile) {
      h += '<div class="days" style="margin-bottom:8px">' + Array.from({ length: 7 }, (_, i) => {
        const d = PC.addDays(ws, i);
        const n = D.bookings.filter((b) => PC.ymd(bStart(b)) === PC.ymd(d) && b.status !== 'annulee' && b.kind !== 'indispo').length;
        return '<button class="day" data-act="cal-day" data-d="' + PC.ymd(d) + '" aria-pressed="' + (PC.ymd(d) === PC.ymd(UI.day)) + '"><span class="dw">' + esc(d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '')) + '</span><span class="dn">' + d.getDate() + '</span><span class="df" style="color:var(--ink-3)">' + (n ? n + ' rdv' : '·') + '</span></button>';
      }).join('') + '</div>';
    }
    h += calendar(days, mobile);
    h += '<div class="legend" style="margin-top:12px"><span><i class="dot" style="background:var(--c-seance)"></i>Séance</span><span><i class="dot" style="background:var(--c-domicile)"></i>À domicile</span><span><i class="dot" style="background:var(--c-club)"></i>Créneau club</span><span><i class="dot" style="background:var(--c-event)"></i>Événement</span><span><i class="dot" style="background:var(--c-indispo)"></i>Indisponible</span><span><i class="dot" style="background:var(--gold-soft);border:1px solid var(--gold)"></i>Ouvert à la réservation en ligne</span><span>Bordure en pointillés : à confirmer</span></div>';
    return h;
  }

  function calendar(days, mobile) {
    const PX = mobile ? 1.1 : 0.9;
    let minH = 9, maxH = 22;
    days.forEach((d) => {
      PC.windowsFor(d, S).forEach(([a, b]) => {
        minH = Math.min(minH, a.getHours());
        maxH = Math.max(maxH, b.getHours() + (b.getMinutes() ? 1 : 0));
      });
      D.bookings.filter((b) => PC.ymd(bStart(b)) === PC.ymd(d) && b.status !== 'annulee').forEach((b) => {
        minH = Math.min(minH, bStart(b).getHours());
        const e = bEnd(b);
        maxH = Math.max(maxH, PC.ymd(e) === PC.ymd(d) ? e.getHours() + (e.getMinutes() ? 1 : 0) : 24);
      });
    });
    maxH = Math.min(24, maxH);
    const startMin = minH * 60;
    const height = (maxH - minH) * 60 * PX;
    const cols = '52px repeat(' + days.length + ', minmax(0, 1fr))';
    const todayKey = PC.ymd(new Date());
    let h = '<div class="cal" data-px="' + PX + '" data-start="' + startMin + '">';
    h += '<div class="cal-head" style="grid-template-columns:' + cols + '"><div></div>' + days.map((d) => '<div class="' + (PC.ymd(d) === todayKey ? 'today' : '') + '">' + esc(d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '')) + '<b>' + d.getDate() + '</b></div>').join('') + '</div>';
    h += '<div class="cal-body" style="grid-template-columns:' + cols + '"><div class="cal-hours" style="height:' + height + 'px">';
    for (let hh = minH + 1; hh < maxH; hh++) h += '<span style="top:' + (hh * 60 - startMin) * PX + 'px">' + hh + 'h</span>';
    h += '</div>';
    days.forEach((d) => {
      const key = PC.ymd(d);
      h += '<div class="cal-col' + (key === todayKey ? ' today' : '') + '" data-day="' + key + '" style="height:' + height + 'px">';
      for (let hh = minH + 1; hh < maxH; hh++) h += '<div class="hl" style="top:' + (hh * 60 - startMin) * PX + 'px"></div>';
      PC.windowsFor(d, S).forEach(([a, b]) => {
        const t = (a.getHours() * 60 + a.getMinutes() - startMin) * PX;
        h += '<div class="win" style="top:' + t + 'px;height:' + ((b - a) / 60000) * PX + 'px"></div>';
      });
      const items = D.bookings
        .filter((b) => PC.ymd(bStart(b)) === key && b.status !== 'annulee')
        .map((b) => ({ b, a: bStart(b).getTime(), z: bEnd(b).getTime() }))
        .sort((x, y) => x.a - y.a || y.z - x.z);
      layoutLanes(items).forEach((it) => {
        const b = it.b;
        const s = bStart(b);
        const top = (s.getHours() * 60 + s.getMinutes() - startMin) * PX;
        const ht = Math.max(22, Math.min(b.duration_min, (24 * 60 - (s.getHours() * 60 + s.getMinutes()))) * PX - 2);
        const w = 100 / it.n;
        const cls = ['ev', 'k-' + b.kind, b.status === 'demande' ? 'pending' : '', b.kind === 'indispo' ? 'indispo' : '', b.status === 'terminee' || b.status === 'absent' ? 'done' : ''].join(' ');
        h += '<button class="' + cls + '" data-act="open-booking" data-id="' + b.id + '" style="top:' + top + 'px;height:' + ht + 'px;left:calc(' + w * it.lane + '% + 2px);width:calc(' + w + '% - 4px)" title="' + esc(PC.fmtTime(s) + ' · ' + bTitle(b) + ' · ' + bSub(b)) + '">' +
          '<b>' + PC.fmtTime(s) + ' ' + esc(bTitle(b)) + '</b>' + (ht > 34 ? '<span>' + esc(bSub(b)) + '</span>' : '') + '</button>';
      });
      if (key === todayKey) {
        const n = new Date();
        const m = n.getHours() * 60 + n.getMinutes();
        if (m >= startMin && m <= maxH * 60) h += '<div class="cal-now" style="top:' + (m - startMin) * PX + 'px"></div>';
      }
      h += '</div>';
    });
    h += '</div></div>';
    return h;
  }

  function layoutLanes(items) {
    const ends = [];
    let cluster = [], clusterEnd = -Infinity;
    const flush = () => {
      const n = Math.max(...cluster.map((x) => x.lane)) + 1;
      cluster.forEach((x) => (x.n = n));
      cluster = [];
      ends.length = 0;
    };
    items.forEach((it) => {
      if (cluster.length && it.a >= clusterEnd) flush();
      let lane = ends.findIndex((e) => e <= it.a);
      if (lane < 0) { lane = ends.length; ends.push(it.z); } else ends[lane] = it.z;
      it.lane = lane;
      cluster.push(it);
      clusterEnd = Math.max(clusterEnd, it.z);
    });
    if (cluster.length) flush();
    return items;
  }

  /* ---------- Fiche d'une séance ---------- */
  function waMessage(b, type) {
    const s = bStart(b);
    const first = String(b.client_name || '').split(' ')[0];
    const sv = PC.service(S, b.service);
    const what = sv ? sv.name : 'séance';
    const where = b.kind === 'domicile' ? 'chez toi (' + (b.address || '') + ')' : (b.location || S.base_location);
    const when = PC.fmtDayLong(s) + ' à ' + PC.fmtTime(s);
    if (type === 'confirm') return 'Bonjour ' + first + ', ici Presso Center. Ta séance ' + what + ' du ' + when + ' est confirmée. Lieu : ' + where + '. À bientôt !';
    if (type === 'refuse') return 'Bonjour ' + first + ', ici Presso Center. Malheureusement, le créneau du ' + when + ' n\'est plus disponible. Tu peux en choisir un autre ici : ' + bookingUrl();
    return 'Bonjour ' + first + ', ici Presso Center. Rappel : ta séance ' + what + ' est prévue le ' + when + '. Lieu : ' + where + '. À bientôt !';
  }

  function openBooking(id) {
    const b = D.bookings.find((x) => x.id === id);
    if (!b) return;
    const s = bStart(b);
    const e = bEnd(b);
    const c = clientById(b.client_id);
    const p = partnerById(b.partner_id);
    const phone = b.client_phone || (c && c.phone) || (p && p.phone);
    const row = (k, v) => (v ? '<tr><td class="muted" style="width:38%">' + k + '</td><td>' + v + '</td></tr>' : '');
    let body = '<div class="row wrap" style="margin-bottom:12px">' + statusBadge(b) + '<span class="badge plain k-' + b.kind + '" style="background:color-mix(in srgb, var(--k) 16%, var(--surface))">' + esc(PC.KINDS[b.kind].label) + '</span>' + (b.source === 'en_ligne' ? '<span class="badge plain">Réservé en ligne</span>' : '') + '</div>';
    body += '<table class="tbl"><tbody>' +
      row('Quand', esc(PC.capitalize(PC.fmtDayLong(s))) + '<br>' + PC.fmtTime(s) + ' – ' + PC.fmtTime(e) + ' (' + PC.durationLabel(b.duration_min) + ')') +
      row('Formule', b.kind === 'seance' || b.kind === 'domicile' ? esc(bSub(b)) : '') +
      row('Client', b.client_name ? (c ? '<button class="btn sm soft" data-act="open-client" data-id="' + c.id + '">' + esc(b.client_name) + '</button>' : esc(b.client_name)) : '') +
      row('Partenaire', p ? '<button class="btn sm soft" data-act="open-partner" data-id="' + p.id + '">' + esc(p.name) + '</button>' : '') +
      row('Téléphone', phone ? esc(phone) : '') +
      row('Adresse', esc(b.address || '')) +
      row('Lieu', esc(b.location || '')) +
      row('Bottes', b.kind !== 'indispo' ? String(b.boots || 0) + (b.passages ? ' · ' + b.passages + ' passage' + (b.passages > 1 ? 's' : '') : '') : '') +
      row('Prix', b.kind === 'indispo' ? '' : b.payment_mode === 'forfait' ? 'Inclus dans le forfait' : PC.eur(b.price) + (b.paid ? ' · <span class="badge good">Payé' + (b.pay_method ? ' · ' + esc(PC.PAY_METHODS[b.pay_method] || b.pay_method) : '') + '</span>' : b.payment_mode === 'credit' ? ' · <span class="badge info">Carte / abonnement</span>' : '')) +
      row('Santé', b.kind === 'seance' || b.kind === 'domicile' ? (b.health_ack ? '<span class="badge good">Questionnaire validé</span>' : '<span class="badge warn">À faire remplir</span>') : '') +
      row('Mineur', b.is_minor ? 'Oui · autorisation de ' + esc(b.guardian_name || '?') : '') +
      row('Notes', esc(b.notes || '').replace(/\n/g, '<br>')) +
      row('Référence', esc(b.ref || '')) +
      '</tbody></table>';
    if (phone && b.kind !== 'indispo') {
      body += '<div class="row wrap" style="margin-top:14px">' +
        (b.status === 'demande' ? '<a class="btn sm soft" target="_blank" rel="noopener" href="' + esc(PC.waLink(phone, waMessage(b, 'confirm'))) + '">' + I('message') + 'Message de confirmation</a><a class="btn sm ghost" target="_blank" rel="noopener" href="' + esc(PC.waLink(phone, waMessage(b, 'refuse'))) + '">Proposer un autre créneau</a>' : '') +
        (b.status === 'confirmee' ? '<a class="btn sm soft" target="_blank" rel="noopener" href="' + esc(PC.waLink(phone, waMessage(b, 'remind'))) + '">' + I('message') + 'Envoyer un rappel</a>' : '') +
        '<a class="btn sm ghost" href="tel:' + esc(PC.cleanPhone(phone)) + '">' + I('phone') + 'Appeler</a></div>';
    }
    const A = (act, label, cls) => '<button class="btn ' + (cls || 'ghost') + '" data-act="' + act + '" data-id="' + b.id + '">' + label + '</button>';
    let foot = '';
    if (b.kind === 'indispo') foot = A('delete-booking', 'Supprimer', 'danger') + A('edit-booking', 'Modifier', '');
    else if (b.status === 'demande') foot = A('cancel-booking', 'Refuser', 'danger') + A('edit-booking', 'Modifier') + A('confirm-booking', 'Confirmer', 'good');
    else if (b.status === 'confirmee') foot = A('cancel-booking', 'Annuler', 'danger') + A('absent-booking', 'Absent') + A('edit-booking', 'Modifier') + A('close-booking', 'Séance faite', 'good');
    else if (b.status === 'terminee') foot = A('edit-booking', 'Modifier') + (!b.paid && Number(b.price) > 0 && b.payment_mode === 'unitaire' ? A('pay-booking', 'Encaisser', 'good') : '');
    else foot = A('delete-booking', 'Supprimer', 'danger') + A('restore-booking', 'Rétablir', '');
    modal({ title: bTitle(b), body, foot });
  }

  async function setStatus(id, status, msg) {
    const b = D.bookings.find((x) => x.id === id);
    await run(async () => {
      await patch('bookings', id, { status });
      if (status === 'annulee' || status === 'absent') {
        const linked = D.transactions.filter((t) => t.booking_id === id);
        for (const t of linked) await remove('transactions', t.id);
      }
      closeModal();
    }, msg);
    if (status === 'confirmee' && b && b.source === 'en_ligne' && (b.client_phone)) {
      PC.toast('Pense à prévenir le client (bouton « Message de confirmation »).');
    }
  }

  function closeBookingDialog(id) {
    const b = D.bookings.find((x) => x.id === id);
    const c = clientById(b.client_id);
    const credits = c ? c.credits || {} : {};
    const credTotal = (Number(credits.carte10) || 0) + (Number(credits.abonnement) || 0);
    const isClub = b.kind === 'club';
    const pays = !isClub && Number(b.price) > 0;
    const defMode = b.payment_mode === 'credit' && credTotal ? 'credit' : 'now';
    let body = '<form id="close-form" class="stack">';
    body += '<label class="field"><span>' + (isClub || b.kind === 'evenement' ? 'Nombre d\'athlètes passés' : 'Nombre de passages') + '</span><input type="number" name="passages" min="0" max="200" value="' + (b.passages || b.people || 1) + '" required><small>Sert au bilan de fréquentation et au suivi du stock de sous-bottes.</small></label>';
    if (isClub) body += '<div class="alert info">' + I('info') + '<span>Créneau inclus dans le forfait mensuel du club : rien à encaisser ici.</span></div>';
    if (pays) {
      body += '<fieldset style="border:0;padding:0;margin:0" class="stack"><legend class="label">Paiement</legend>' +
        '<label class="check"><input type="radio" name="mode" value="now"' + (defMode === 'now' ? ' checked' : '') + '><span>Payé maintenant</span></label>' +
        '<div class="grid-2" style="padding-left:30px"><label class="field"><span>Montant</span><input type="number" step="0.01" min="0" name="amount" value="' + Number(b.price) + '"></label><label class="field"><span>Moyen</span><select name="method">' + Object.entries(PC.PAY_METHODS).map(([k, v]) => '<option value="' + k + '">' + esc(v) + '</option>').join('') + '</select></label></div>' +
        (c ? '<label class="check"><input type="radio" name="mode" value="credit"' + (defMode === 'credit' ? ' checked' : '') + (credTotal ? '' : ' disabled') + '><span>Décompter de sa carte ou de son abonnement <span class="muted">(' + (credTotal ? (credits.carte10 ? credits.carte10 + ' sur la carte' : '') + (credits.carte10 && credits.abonnement ? ', ' : '') + (credits.abonnement ? credits.abonnement + ' sur l\'abonnement' : '') : 'aucun crédit') + ')</span></span></label>' : '') +
        '<label class="check"><input type="radio" name="mode" value="later"><span>Pas encore payé</span></label></fieldset>';
    }
    body += '</form>';
    modal({ title: 'Clôturer la séance', body, foot: '<button class="btn ghost" data-close>Annuler</button><button class="btn good" type="submit" form="close-form">Enregistrer</button>' });
    $('#close-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const passages = Math.max(0, Number(f.get('passages')) || 0);
      const mode = pays ? f.get('mode') : 'none';
      await run(async () => {
        const p = { status: 'terminee', passages };
        if (mode === 'now') {
          const amount = PC.round2(f.get('amount'));
          const method = f.get('method');
          Object.assign(p, { paid: true, pay_method: method, payment_mode: 'unitaire', price: amount });
          await save('transactions', { date: PC.ymd(bStart(b)), type: 'recette', category: b.kind === 'evenement' ? 'evenement' : 'seance', label: (b.kind === 'evenement' ? bTitle(b) : bSub(b) + ' — ' + (b.client_name || '')), amount, method, booking_id: b.id, client_id: b.client_id || null, partner_id: b.partner_id || null });
        } else if (mode === 'credit' && c) {
          const cr = Object.assign({}, c.credits || {});
          const order = b.service === 'express' ? ['carte10', 'abonnement'] : ['abonnement', 'carte10'];
          const k = order.find((x) => Number(cr[x]) > 0);
          if (k) cr[k] = Number(cr[k]) - 1;
          await patch('clients', c.id, { credits: cr });
          Object.assign(p, { paid: true, pay_method: null, payment_mode: 'credit' });
        } else if (mode === 'later') {
          Object.assign(p, { paid: false, payment_mode: 'unitaire' });
        }
        await patch('bookings', b.id, p);
        for (const it of D.stock.filter((x) => Number(x.per_passage) > 0)) {
          await patch('stock', it.id, { qty: Math.max(0, PC.round2(Number(it.qty) - Number(it.per_passage) * passages)) });
        }
        closeModal();
      }, 'Séance clôturée');
    });
  }

  function payDialog(id) {
    const b = D.bookings.find((x) => x.id === id);
    const body = '<form id="pay-form" class="grid-2"><label class="field"><span>Montant</span><input type="number" step="0.01" min="0" name="amount" value="' + Number(b.price) + '"></label><label class="field"><span>Moyen</span><select name="method">' + Object.entries(PC.PAY_METHODS).map(([k, v]) => '<option value="' + k + '">' + esc(v) + '</option>').join('') + '</select></label><label class="field"><span>Date</span><input type="date" name="date" value="' + PC.ymd(new Date()) + '"></label></form>';
    modal({ title: 'Encaisser · ' + bTitle(b), body, foot: '<button class="btn ghost" data-close>Annuler</button><button class="btn good" type="submit" form="pay-form">Encaisser</button>' });
    $('#pay-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const amount = PC.round2(f.get('amount'));
      await run(async () => {
        await save('transactions', { date: f.get('date'), type: 'recette', category: b.kind === 'evenement' ? 'evenement' : 'seance', label: (b.kind === 'evenement' ? bTitle(b) : bSub(b) + ' — ' + (b.client_name || '')), amount, method: f.get('method'), booking_id: b.id, client_id: b.client_id || null, partner_id: b.partner_id || null });
        await patch('bookings', b.id, { paid: true, pay_method: f.get('method'), price: amount });
        closeModal();
      }, 'Paiement enregistré');
    });
  }

  /* ---------- Création / modification ---------- */
  function editBooking(id, defaults) {
    const b = id ? D.bookings.find((x) => x.id === id) : null;
    const now = new Date();
    const nextQ = new Date(Math.ceil(now.getTime() / 900000) * 900000);
    const v = Object.assign({
      kind: 'seance', service: 'express', people: 1, status: 'confirmee', date: PC.ymd(nextQ), time: PC.hhmm(nextQ), duration_min: 30, price: 20,
      client_id: '', client_name: '', client_phone: '', address: '', partner_id: '', title: '', location: '', boots: 5, notes: '', allday: false
    }, defaults || {});
    if (b) {
      const s = bStart(b);
      Object.assign(v, b, { date: PC.ymd(s), time: PC.hhmm(s), client_id: b.client_id || '', partner_id: b.partner_id || '' });
    }
    const draw = () => {
      const k = v.kind;
      const svcs = (S.services || []).filter((s) => (k === 'domicile' ? s.kind === 'domicile' : s.kind !== 'domicile'));
      let h = '<form id="bk-form" class="stack">';
      h += '<div class="seg" role="group" aria-label="Type">' + Object.entries(PC.KINDS).map(([key, x]) => '<button type="button" data-kind="' + key + '" aria-pressed="' + (k === key) + '">' + esc(x.label) + '</button>').join('') + '</div>';
      if (k === 'seance' || k === 'domicile') {
        h += '<div class="grid-2"><label class="field"><span>Formule</span><select name="service">' + svcs.map((s) => '<option value="' + s.code + '"' + (s.code === v.service ? ' selected' : '') + '>' + esc(s.name) + ' · ' + PC.eur(s.price) + (s.per_person ? '/pers.' : '') + '</option>').join('') + '</select></label>';
        const sv = PC.service(S, v.service);
        h += sv && sv.per_person ? '<label class="field"><span>Personnes</span><input type="number" name="people" min="' + (sv.min_people || 2) + '" max="' + (sv.max_people || 5) + '" value="' + Math.max(sv.min_people || 2, v.people || 2) + '"></label>' : '<span></span>';
        h += '</div>';
        h += '<label class="field"><span>Client</span><select name="client_id"><option value="">+ Nouveau client</option>' + D.clients.slice().sort((a, b2) => a.name.localeCompare(b2.name)).map((c) => '<option value="' + c.id + '"' + (c.id === v.client_id ? ' selected' : '') + '>' + esc(c.name) + (c.phone ? ' · ' + esc(c.phone) : '') + '</option>').join('') + '</select></label>';
        if (!v.client_id) h += '<div class="grid-2"><label class="field"><span>Nom du client</span><input name="client_name" value="' + esc(v.client_name) + '"></label><label class="field"><span>Téléphone</span><input name="client_phone" type="tel" value="' + esc(v.client_phone) + '"></label></div>';
        if (k === 'domicile') h += '<label class="field"><span>Adresse</span><input name="address" value="' + esc(v.address || '') + '"></label>';
      } else if (k === 'club' || k === 'evenement') {
        h += '<label class="field"><span>' + (k === 'club' ? 'Club ou partenaire' : 'Organisateur (facultatif)') + '</span><select name="partner_id"><option value="">' + (k === 'club' ? 'Choisir…' : 'Aucun') + '</option>' + D.partners.map((p) => '<option value="' + p.id + '"' + (p.id === v.partner_id ? ' selected' : '') + '>' + esc(p.name) + ' · ' + esc(PC.PARTNER_STATUSES[p.status] || '') + '</option>').join('') + '</select></label>';
        h += '<label class="field"><span>Intitulé</span><input name="title" value="' + esc(v.title || '') + '" placeholder="' + (k === 'club' ? 'Créneau U17, séance après match…' : 'Tournoi, course, stage…') + '"></label>';
        h += '<div class="grid-2"><label class="field"><span>Lieu</span><input name="location" value="' + esc(v.location || '') + '"></label><label class="field"><span>Bottes utilisées</span><input type="number" name="boots" min="1" max="20" value="' + (v.boots || capacity() || 5) + '"></label></div>';
      } else {
        h += '<label class="field"><span>Motif</span><input name="title" value="' + esc(v.title || '') + '" placeholder="Cours, partiels, vacances…"></label>';
      }
      h += '<div class="grid-3"><label class="field"><span>Date</span><input type="date" name="date" value="' + esc(v.date) + '" required></label><label class="field"><span>Heure</span><input type="time" name="time" step="300" value="' + esc(v.time) + '" required></label><label class="field"><span>Durée (min)</span><input type="number" name="duration_min" min="5" step="5" value="' + (v.duration_min || 30) + '" required></label></div>';
      if (k !== 'indispo') {
        h += '<div class="grid-2">' + (k === 'club' ? '<span class="small muted" style="align-self:center">Inclus dans le forfait du club.</span>' : '<label class="field"><span>Prix (€)</span><input type="number" name="price" step="0.01" min="0" value="' + (Number(v.price) || 0) + '"></label>') +
          '<label class="field"><span>Statut</span><select name="status">' + ['demande', 'confirmee', 'terminee'].map((s) => '<option value="' + s + '"' + (v.status === s ? ' selected' : '') + '>' + PC.STATUSES[s] + '</option>').join('') + '</select></label></div>';
      }
      h += '<label class="field"><span>Notes</span><textarea name="notes" rows="2">' + esc(v.notes || '') + '</textarea></label>';
      h += '<p class="form-error hide" id="bk-error" role="alert"></p></form>';
      return h;
    };
    const readForm = () => {
      const form = $('#bk-form');
      if (!form) return;
      const f = new FormData(form);
      for (const [key, val] of f.entries()) v[key] = val;
    };
    const applyService = () => {
      const sv = PC.service(S, v.service);
      if (!sv) return;
      const r = PC.reqFromService(sv, v.people);
      v.duration_min = r.duration_min;
      v.price = r.price;
      v.people = r.people;
    };
    const mount = () => {
      const dlg = $('#modal');
      dlg.querySelector('.modal-body').innerHTML = draw();
      const form = $('#bk-form');
      form.addEventListener('click', (e) => {
        const t = e.target.closest('[data-kind]');
        if (!t) return;
        readForm();
        v.kind = t.dataset.kind;
        if (v.kind === 'seance' && PC.service(S, v.service) && PC.service(S, v.service).kind === 'domicile') v.service = 'express';
        if (v.kind === 'domicile') v.service = 'domicile';
        if (v.kind === 'seance' || v.kind === 'domicile') applyService();
        if (v.kind === 'club') { v.duration_min = 90; v.price = 0; v.boots = capacity() || 5; }
        if (v.kind === 'evenement') { v.duration_min = 240; v.price = (S.club_options[1] || {}).price || 300; v.boots = capacity() || 5; }
        if (v.kind === 'indispo') { v.duration_min = 120; v.price = 0; }
        mount();
      });
      form.addEventListener('change', (e) => {
        const n = e.target.name;
        if (n === 'service' || n === 'people') {
          readForm();
          applyService();
          mount();
        } else if (n === 'client_id') {
          readForm();
          mount();
        } else if (n === 'partner_id' && v.kind === 'club') {
          readForm();
          const p = partnerById(v.partner_id);
          if (p && !v.location) v.location = p.location || '';
          mount();
        }
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        submit();
      });
    };
    const submit = async () => {
      readForm();
      const err = $('#bk-error');
      const k = v.kind;
      const start = PC.atTime(PC.parseYmd(v.date), v.time || '00:00');
      const obj = {
        id: b ? b.id : undefined,
        kind: k,
        start_at: start.toISOString(),
        duration_min: Math.max(5, Number(v.duration_min) || 30),
        notes: String(v.notes || '').trim() || null,
        status: k === 'indispo' ? 'confirmee' : v.status || 'confirmee'
      };
      if (k === 'seance' || k === 'domicile') {
        const sv = PC.service(S, v.service);
        const r = PC.reqFromService(sv, v.people);
        let client = clientById(v.client_id);
        if (!client) {
          const nm = String(v.client_name || '').trim();
          if (nm.length < 2) { err.textContent = 'Choisis un client ou indique son nom.'; err.classList.remove('hide'); return; }
          client = await run(() => save('clients', { name: nm, phone: PC.cleanPhone(v.client_phone) || null, kind: 'particulier', credits: {}, health_ok: false, waiver_signed: false, is_minor: false }));
          if (!client) return;
        }
        Object.assign(obj, { service: sv.code, people: r.people, boots: r.boots, price: PC.round2(v.price), client_id: client.id, client_name: client.name, client_phone: client.phone || null, address: k === 'domicile' ? String(v.address || '').trim() : null, partner_id: null, title: null });
        if (!b) obj.payment_mode = 'unitaire';
      } else if (k === 'club' || k === 'evenement') {
        const p = partnerById(v.partner_id);
        if (k === 'club' && !p) { err.textContent = 'Choisis le club concerné.'; err.classList.remove('hide'); return; }
        Object.assign(obj, { partner_id: p ? p.id : null, title: String(v.title || '').trim() || (p ? p.name + (k === 'club' ? ' — créneau club' : ' — événement') : 'Événement'), location: String(v.location || '').trim() || null, boots: Number(v.boots) || capacity(), people: Number(v.boots) * 3, price: k === 'club' ? 0 : PC.round2(v.price), payment_mode: k === 'club' ? 'forfait' : 'unitaire', service: null, client_id: null, client_name: null, client_phone: null });
      } else {
        Object.assign(obj, { title: String(v.title || '').trim() || 'Indisponible', boots: 0, people: 0, price: 0, service: null, client_id: null, client_name: null, partner_id: null });
      }
      if (!b) Object.assign(obj, { ref: PC.makeRef(), source: 'manuel', health_ack: k === 'seance' || k === 'domicile' ? !!(clientById(obj.client_id) || {}).health_ok : false });
      if (PC.isActive(obj) && k !== 'indispo') {
        const chk = PC.checkSlot(obj, activeBusy(), S, capacity(), b && b.id);
        if (!chk.ok) {
          const msg = chk.reason === 'full' ? 'Toutes les bottes sont déjà prises sur ce créneau.' : 'Ce créneau chevauche « ' + bTitle(chk.with) + ' ».';
          if (!window.confirm(msg + ' Enregistrer quand même ?')) return;
        }
      }
      await run(async () => {
        const saved = await save('bookings', obj);
        UI.week = PC.startOfWeek(bStart(saved));
        UI.day = PC.startOfDay(bStart(saved));
        closeModal();
      }, b ? 'Modifications enregistrées' : 'Ajouté à l\'agenda');
    };
    modal({ title: b ? 'Modifier' : 'Nouveau dans l\'agenda', body: '', foot: '<button class="btn ghost" data-close>Annuler</button><button class="btn" type="submit" form="bk-form">Enregistrer</button>' });
    mount();
  }

  /* =================================================================
     Vue : Clients et partenaires
     ================================================================= */
  function viewClients() {
    const tab = UI.clientsTab;
    let h = '<div class="page-head"><div><h1>Clients</h1><p>' + D.clients.length + ' sportifs · ' + D.partners.filter((p) => p.status === 'contrat').length + ' club(s) sous contrat</p></div>' +
      '<button class="btn" data-act="' + (tab === 'particuliers' ? 'new-client' : 'new-partner') + '">' + I('plus') + (tab === 'particuliers' ? 'Client' : 'Partenaire') + '</button></div>';
    h += '<div class="toolbar"><div class="seg" role="group"><button data-act="clients-tab" data-id="particuliers" aria-pressed="' + (tab === 'particuliers') + '">Sportifs</button><button data-act="clients-tab" data-id="partenaires" aria-pressed="' + (tab === 'partenaires') + '">Clubs et partenaires</button></div>';
    if (tab === 'particuliers') h += '<span class="grow"></span><input type="search" id="client-search" placeholder="Rechercher…" value="' + esc(UI.search) + '" style="max-width:260px;min-height:38px" aria-label="Rechercher un client">';
    h += '</div>';
    h += tab === 'particuliers' ? clientsTable() : partnersPipeline();
    return h;
  }

  function clientStats(c) {
    const bs = D.bookings.filter((b) => b.client_id === c.id);
    const done = bs.filter((b) => b.status === 'terminee');
    const last = done.map(bStart).sort((a, b) => b - a)[0];
    const next = bs.filter((b) => PC.isActive(b) && bStart(b) > new Date()).map(bStart).sort((a, b) => a - b)[0];
    const paid = sum(D.transactions.filter((t) => t.type === 'recette' && t.client_id === c.id), (t) => t.amount);
    return { count: done.length, last, next, paid };
  }

  function clientsTable() {
    const q = UI.search.trim().toLowerCase();
    const list = D.clients.filter((c) => !q || [c.name, c.phone, c.sport, c.email].join(' ').toLowerCase().includes(q)).map((c) => ({ c, st: clientStats(c) })).sort((a, b) => (b.st.last || 0) - (a.st.last || 0) || a.c.name.localeCompare(b.c.name));
    if (!list.length) return '<div class="empty">' + (q ? 'Aucun client ne correspond.' : 'Aucun client pour le moment. Ils s\'ajoutent automatiquement à chaque réservation en ligne.') + '</div>';
    return '<div class="card flat" style="padding:6px 8px"><div class="table-wrap"><table class="tbl"><thead><tr><th>Nom</th><th>Sport</th><th class="num">Séances</th><th>Dernière venue</th><th>Crédits</th><th class="num">Encaissé</th></tr></thead><tbody>' +
      list.map(({ c, st }) => {
        const cr = c.credits || {};
        const creds = [cr.carte10 ? cr.carte10 + ' carte' : '', cr.abonnement ? cr.abonnement + ' abo.' : ''].filter(Boolean).join(' · ');
        return '<tr class="click" data-act="open-client" data-id="' + c.id + '"><td><b>' + esc(c.name) + '</b>' + (c.is_minor ? ' <span class="badge plain">Mineur</span>' : '') + (!c.health_ok ? ' <span class="badge warn">Santé</span>' : '') + '<br><span class="small muted">' + esc(c.phone || '') + '</span></td><td>' + esc(c.sport || '') + '</td><td class="num">' + st.count + '</td><td>' + (st.last ? esc(PC.fmtDay(st.last, { day: 'numeric', month: 'short' })) : '<span class="muted">—</span>') + (st.next ? '<br><span class="small muted">Prochaine : ' + esc(PC.fmtDay(st.next, { day: 'numeric', month: 'short' })) + '</span>' : '') + '</td><td>' + (creds || '<span class="muted">—</span>') + '</td><td class="num">' + PC.eur(st.paid) + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';
  }

  function openClient(id) {
    const c = id ? clientById(id) : { name: '', phone: '', email: '', sport: '', is_minor: false, guardian_name: '', health_ok: false, waiver_signed: false, credits: {}, notes: '' };
    const cr = c.credits || {};
    let body = '<form id="cl-form" class="stack">' +
      '<div class="grid-2"><label class="field"><span>Nom</span><input name="name" value="' + esc(c.name) + '" required></label><label class="field"><span>Téléphone</span><input name="phone" type="tel" value="' + esc(c.phone || '') + '"></label></div>' +
      '<div class="grid-2"><label class="field"><span>E-mail</span><input name="email" type="email" value="' + esc(c.email || '') + '"></label><label class="field"><span>Sport</span><input name="sport" value="' + esc(c.sport || '') + '"></label></div>' +
      '<label class="check"><input type="checkbox" name="health_ok"' + (c.health_ok ? ' checked' : '') + '><span>Questionnaire de santé rempli, pas de contre-indication</span></label>' +
      '<label class="check"><input type="checkbox" name="waiver_signed"' + (c.waiver_signed ? ' checked' : '') + '><span>Décharge signée</span></label>' +
      '<label class="check"><input type="checkbox" name="is_minor"' + (c.is_minor ? ' checked' : '') + '><span>Mineur</span></label>' +
      '<label class="field"><span>Parent ou tuteur (autorisation)</span><input name="guardian_name" value="' + esc(c.guardian_name || '') + '"></label>' +
      '<div class="grid-2"><label class="field"><span>Crédits carte 10 séances</span><input type="number" min="0" name="carte10" value="' + (Number(cr.carte10) || 0) + '"></label><label class="field"><span>Crédits abonnement</span><input type="number" min="0" name="abonnement" value="' + (Number(cr.abonnement) || 0) + '"></label></div>' +
      '<label class="field"><span>Notes</span><textarea name="notes" rows="2">' + esc(c.notes || '') + '</textarea></label></form>';
    if (id) {
      const phone = c.phone;
      body += '<div class="row wrap" style="margin-top:14px">' + (S.packs || []).map((p) => '<button class="btn sm soft" data-act="sell-pack" data-id="' + c.id + '" data-pack="' + p.code + '">' + I('plus') + 'Vendre : ' + esc(p.name) + ' · ' + PC.eur(p.price) + '</button>').join('') +
        '<button class="btn sm soft" data-act="new-booking-for" data-id="' + c.id + '">' + I('calendar') + 'Nouvelle séance</button>' +
        (phone ? '<a class="btn sm ghost" target="_blank" rel="noopener" href="' + esc(PC.waLink(phone, '')) + '">' + I('message') + 'WhatsApp</a><a class="btn sm ghost" href="tel:' + esc(PC.cleanPhone(phone)) + '">' + I('phone') + 'Appeler</a>' : '') + '</div>';
      const hist = D.bookings.filter((b) => b.client_id === c.id).sort((a, b) => bStart(b) - bStart(a)).slice(0, 12);
      body += '<h3 style="font-size:15px;margin:20px 0 6px">Historique</h3>' + (hist.length ? '<div class="list">' + hist.map((b) => '<div class="li click" data-act="open-booking" data-id="' + b.id + '"><span class="grow"><span class="t">' + esc(PC.capitalize(PC.fmtDay(bStart(b), { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }))) + ' · ' + PC.fmtTime(bStart(b)) + '</span><br><span class="s">' + esc(bSub(b)) + ' · ' + PC.eur(b.price) + '</span></span>' + statusBadge(b) + '</div>').join('') + '</div>' : '<p class="muted small">Aucune séance.</p>');
    }
    modal({ title: id ? c.name : 'Nouveau client', body, foot: (id ? '<button class="btn danger" data-act="delete-client" data-id="' + id + '">Supprimer</button>' : '') + '<button class="btn ghost" data-close>Fermer</button><button class="btn" type="submit" form="cl-form">Enregistrer</button>' });
    $('#cl-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const obj = {
        id: id || undefined,
        name: String(f.get('name')).trim(),
        phone: PC.cleanPhone(f.get('phone')) || null,
        email: String(f.get('email') || '').trim() || null,
        sport: String(f.get('sport') || '').trim() || null,
        health_ok: !!f.get('health_ok'),
        waiver_signed: !!f.get('waiver_signed'),
        is_minor: !!f.get('is_minor'),
        guardian_name: String(f.get('guardian_name') || '').trim() || null,
        credits: Object.assign({}, c.credits || {}, { carte10: Number(f.get('carte10')) || 0, abonnement: Number(f.get('abonnement')) || 0 }),
        notes: String(f.get('notes') || '').trim() || null
      };
      if (!id) obj.kind = 'particulier';
      await run(async () => {
        await save('clients', obj);
        if (id) D.bookings.filter((b) => b.client_id === id && b.client_name !== obj.name).forEach((b) => (b.client_name = obj.name));
        closeModal();
      }, 'Client enregistré');
    });
  }

  async function sellPack(clientId, code) {
    const c = clientById(clientId);
    const p = (S.packs || []).find((x) => x.code === code);
    if (!c || !p) return;
    const method = window.prompt('Vente « ' + p.name + ' » à ' + c.name + ' pour ' + PC.eur(p.price) + '.\nMoyen de paiement : cb, especes, virement, lydia ou cheque', 'cb');
    if (method == null) return;
    await run(async () => {
      const cr = Object.assign({}, c.credits || {});
      cr[code] = (Number(cr[code]) || 0) + Number(p.credits || 0);
      await patch('clients', c.id, { credits: cr });
      await save('transactions', { date: PC.ymd(new Date()), type: 'recette', category: code === 'carte10' ? 'carte' : 'abonnement', label: p.name + ' — ' + c.name, amount: p.price, method: PC.PAY_METHODS[method] ? method : 'cb', client_id: c.id });
      openClient(c.id);
    }, p.name + ' vendue : +' + p.credits + ' crédits');
  }

  const PIPE = [
    { title: 'Demandes et prospects', st: ['demande', 'prospect'] },
    { title: 'En discussion', st: ['discussion', 'accord'] },
    { title: 'Test pilote', st: ['pilote'] },
    { title: 'Sous contrat', st: ['contrat'] }
  ];
  function partnersPipeline() {
    const mk = PC.monthKey(new Date());
    const mrr = sum(D.partners.filter((p) => p.status === 'contrat'), (p) => p.monthly_price);
    let h = '<p class="small muted" style="margin-bottom:12px">Forfaits sous contrat : <b style="color:var(--ink)">' + PC.eur(mrr) + ' par mois</b></p><div class="pipe">';
    PIPE.forEach((col) => {
      const list = D.partners.filter((p) => col.st.includes(p.status));
      h += '<div class="pipe-col"><h4><span>' + col.title + '</span><span>' + list.length + '</span></h4>' + list.map((p) => {
        const plan = PC.clubPlan(S, p.plan);
        let meta = esc(PC.PARTNER_KINDS[p.kind] || '') + (p.sport ? ' · ' + esc(p.sport) : '');
        let extra = '';
        if (p.status === 'contrat') extra = '<span class="row between"><span class="badge gold">' + esc(plan ? plan.name : 'Forfait') + ' · ' + PC.eur(p.monthly_price) + '</span>' + (partnerBilled(p, mk) ? '<span class="badge good">Facturé</span>' : '<span class="badge warn">À facturer</span>') + '</span>';
        else if (p.status === 'pilote') extra = '<span class="badge info">Jusqu\'au ' + (p.pilot_end ? PC.fmtDate(p.pilot_end) : '?') + '</span>';
        else if (p.status === 'demande') extra = '<span class="badge warn">Nouvelle demande</span>';
        return '<div class="pcard" data-act="open-partner" data-id="' + p.id + '" role="button" tabindex="0"><span class="n">' + esc(p.name) + '</span><span class="m">' + meta + '</span>' + (p.notes ? '<span class="m">' + esc(p.notes.slice(0, 80)) + (p.notes.length > 80 ? '…' : '') + '</span>' : '') + extra + '</div>';
      }).join('') + '</div>';
    });
    h += '</div>';
    const other = D.partners.filter((p) => p.status === 'pause' || p.status === 'perdu');
    if (other.length) h += '<p class="small muted" style="margin-top:14px">En pause ou perdus : ' + other.map((p) => '<button class="btn sm ghost" data-act="open-partner" data-id="' + p.id + '">' + esc(p.name) + '</button>').join(' ') + '</p>';
    return h;
  }

  function openPartner(id) {
    const p = id ? partnerById(id) : { name: '', kind: 'club', sport: '', contact_name: '', phone: '', email: '', location: '', status: 'prospect', plan: '', monthly_price: '', season_commitment: false, pilot_start: '', pilot_end: '', slot_info: '', notes: '' };
    const opt = (obj, cur) => Object.entries(obj).map(([k, v]) => '<option value="' + k + '"' + (k === cur ? ' selected' : '') + '>' + esc(v) + '</option>').join('');
    let body = '<form id="pa-form" class="stack">' +
      '<div class="grid-2"><label class="field"><span>Nom</span><input name="name" value="' + esc(p.name) + '" required></label><label class="field"><span>Type</span><select name="kind">' + opt(PC.PARTNER_KINDS, p.kind) + '</select></label></div>' +
      '<div class="grid-2"><label class="field"><span>Statut</span><select name="status">' + opt(PC.PARTNER_STATUSES, p.status) + '</select></label><label class="field"><span>Sport</span><input name="sport" value="' + esc(p.sport || '') + '"></label></div>' +
      '<div class="grid-2"><label class="field"><span>Contact</span><input name="contact_name" value="' + esc(p.contact_name || '') + '"></label><label class="field"><span>Téléphone</span><input name="phone" type="tel" value="' + esc(p.phone || '') + '"></label></div>' +
      '<div class="grid-2"><label class="field"><span>E-mail</span><input name="email" type="email" value="' + esc(p.email || '') + '"></label><label class="field"><span>Lieu</span><input name="location" value="' + esc(p.location || '') + '"></label></div>' +
      '<div class="grid-3"><label class="field"><span>Forfait</span><select name="plan"><option value="">Aucun</option>' + (S.club_plans || []).map((x) => '<option value="' + x.code + '"' + (x.code === p.plan ? ' selected' : '') + '>' + esc(x.name) + ' · ' + PC.eur(x.price) + '</option>').join('') + '</select></label><label class="field"><span>Prix mensuel (€)</span><input type="number" step="0.01" min="0" name="monthly_price" value="' + esc(p.monthly_price == null ? '' : p.monthly_price) + '"></label><label class="check" style="align-self:end;padding-bottom:10px"><input type="checkbox" name="season_commitment"' + (p.season_commitment ? ' checked' : '') + '><span>Engagé sur la saison (−' + Math.round(S.season_discount * 100) + ' %)</span></label></div>' +
      '<div class="grid-3"><label class="field"><span>Début du pilote</span><input type="date" name="pilot_start" value="' + esc(p.pilot_start || '') + '"></label><label class="field"><span>Fin du pilote</span><input type="date" name="pilot_end" value="' + esc(p.pilot_end || '') + '"></label><label class="field"><span>Créneau habituel</span><input name="slot_info" value="' + esc(p.slot_info || '') + '" placeholder="Vendredi 19h"></label></div>' +
      '<label class="field"><span>Notes</span><textarea name="notes" rows="3">' + esc(p.notes || '') + '</textarea></label></form>';
    if (id) {
      const mk = PC.monthKey(new Date());
      body += '<div class="row wrap" style="margin-top:14px">' +
        '<button class="btn sm soft" data-act="new-club-slot" data-id="' + p.id + '">' + I('calendar') + 'Planifier un créneau</button>' +
        '<button class="btn sm soft" data-act="report-partner" data-id="' + p.id + '">' + I('printer') + 'Bilan de fréquentation</button>' +
        (Number(p.monthly_price) > 0 ? '<button class="btn sm soft" data-act="bill-partner" data-id="' + p.id + '"' + (partnerBilled(p, mk) ? ' disabled' : '') + '>' + I('euro') + (partnerBilled(p, mk) ? 'Forfait de ' + PC.fmtMonth(mk, true) + ' facturé' : 'Facturer ' + PC.fmtMonth(mk).toLowerCase()) + '</button>' : '') +
        (p.phone ? '<a class="btn sm ghost" target="_blank" rel="noopener" href="' + esc(PC.waLink(p.phone, '')) + '">' + I('message') + 'WhatsApp</a>' : '') + '</div>';
    }
    modal({ title: id ? p.name : 'Nouveau partenaire', body, wide: true, foot: (id ? '<button class="btn danger" data-act="delete-partner" data-id="' + id + '">Supprimer</button>' : '') + '<button class="btn ghost" data-close>Fermer</button><button class="btn" type="submit" form="pa-form">Enregistrer</button>' });
    const form = $('#pa-form');
    const syncPrice = () => {
      const plan = PC.clubPlan(S, form.elements.plan.value);
      if (!plan) return;
      form.elements.monthly_price.value = PC.round2(plan.price * (form.elements.season_commitment.checked ? 1 - S.season_discount : 1));
    };
    form.elements.plan.addEventListener('change', syncPrice);
    form.elements.season_commitment.addEventListener('change', syncPrice);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(form);
      const obj = { id: id || undefined };
      ['name', 'kind', 'status', 'sport', 'contact_name', 'email', 'location', 'slot_info', 'notes'].forEach((k) => (obj[k] = String(f.get(k) || '').trim() || null));
      obj.phone = PC.cleanPhone(f.get('phone')) || null;
      obj.plan = f.get('plan') || null;
      obj.monthly_price = f.get('monthly_price') === '' ? null : PC.round2(f.get('monthly_price'));
      obj.season_commitment = !!f.get('season_commitment');
      obj.pilot_start = f.get('pilot_start') || null;
      obj.pilot_end = f.get('pilot_end') || null;
      if (obj.status === 'pilote' && !obj.pilot_start) {
        obj.pilot_start = PC.ymd(new Date());
        obj.pilot_end = obj.pilot_end || PC.ymd(PC.addDays(new Date(), 21));
      }
      await run(async () => {
        await save('partners', obj);
        closeModal();
      }, 'Partenaire enregistré');
    });
  }

  async function billPartner(id) {
    const p = partnerById(id);
    const mk = PC.monthKey(new Date());
    if (!p || !(Number(p.monthly_price) > 0)) return openPartner(id);
    const plan = PC.clubPlan(S, p.plan);
    await run(async () => {
      await save('transactions', { date: PC.ymd(new Date()), type: 'recette', category: 'forfait_club', label: 'Forfait ' + (plan ? plan.name : '') + ' — ' + p.name + ' — ' + PC.fmtMonth(mk), amount: Number(p.monthly_price), method: 'virement', partner_id: p.id });
      closeModal();
    }, 'Forfait de ' + p.name + ' enregistré en recette');
  }

  function partnerReport(id, key) {
    const p = partnerById(id);
    key = key || PC.monthKey(new Date());
    const list = D.bookings.filter((b) => b.partner_id === id && String(PC.ymd(bStart(b))).startsWith(key) && b.status !== 'annulee').sort((a, b) => bStart(a) - bStart(b));
    const passages = sum(list, (b) => b.passages);
    const plan = PC.clubPlan(S, p.plan);
    const price = Number(p.monthly_price) || 0;
    let body = '<div class="toolbar"><span class="month-nav"><button class="btn icon sm ghost" data-act="report-month" data-id="' + id + '" data-d="' + PC.addMonths(key, -1) + '" aria-label="Mois précédent">' + I('left') + '</button><strong>' + esc(PC.fmtMonth(key)) + '</strong><button class="btn icon sm ghost" data-act="report-month" data-id="' + id + '" data-d="' + PC.addMonths(key, 1) + '" aria-label="Mois suivant">' + I('right') + '</button></span></div>';
    body += '<div class="tiles" style="grid-template-columns:repeat(3,minmax(0,1fr))">' + tile('Créneaux', String(list.length), '') + tile('Passages', String(passages), plan ? 'Forfait : ≈ ' + plan.passages + ' / mois' : '') + tile('Coût par passage', price && passages ? PC.eur(PC.round2(price / passages)) : '—', price ? 'Forfait ' + PC.eur(price) : (p.status === 'pilote' ? 'Pilote gratuit' : '')) + '</div>';
    body += list.length ? '<table class="tbl"><thead><tr><th>Date</th><th>Créneau</th><th class="num">Passages</th><th>Statut</th></tr></thead><tbody>' + list.map((b) => '<tr><td>' + esc(PC.capitalize(PC.fmtDay(bStart(b), { weekday: 'short', day: 'numeric', month: 'short' }))) + '</td><td>' + PC.fmtTime(bStart(b)) + ' – ' + PC.fmtTime(bEnd(b)) + '</td><td class="num">' + (b.passages == null ? '—' : b.passages) + '</td><td>' + statusBadge(b) + '</td></tr>').join('') + '<tr class="total"><td colspan="2">Total</td><td class="num">' + passages + '</td><td></td></tr></tbody></table>' : '<div class="empty">Aucun créneau ce mois-ci.</div>';
    modal({ title: 'Bilan · ' + p.name, body, wide: true, foot: '<button class="btn ghost" data-close>Fermer</button><button class="btn" data-act="print-report" data-id="' + id + '" data-d="' + key + '">' + I('printer') + 'Imprimer / PDF</button>' });
  }

  function printReport(id, key) {
    const p = partnerById(id);
    const list = D.bookings.filter((b) => b.partner_id === id && PC.ymd(bStart(b)).startsWith(key) && b.status !== 'annulee').sort((a, b) => bStart(a) - bStart(b));
    const passages = sum(list, (b) => b.passages);
    const price = Number(p.monthly_price) || 0;
    const w = window.open('', '_blank');
    if (!w) return PC.toast('Autorise les fenêtres pop-up pour imprimer.', 'bad');
    w.document.write('<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Bilan de fréquentation · ' + esc(p.name) + ' · ' + esc(PC.fmtMonth(key)) + '</title><style>body{font-family:Inter,Arial,sans-serif;color:#0f1623;margin:40px;font-size:14px}h1{font-size:24px;margin:6px 0 4px}.e{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#85662a;font-weight:700}.r{width:72px;height:3px;background:#c4a062;margin:14px 0 22px}.k{display:flex;gap:12px;margin:18px 0}.k div{flex:1;background:#f1eee6;border-radius:10px;padding:12px}.k b{display:block;font-size:22px}table{width:100%;border-collapse:collapse;margin-top:10px}th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#626977;border-bottom:1px solid #ccc;padding:8px}td{padding:8px;border-bottom:1px solid #eee}.n{text-align:right}tfoot td{font-weight:700;border-top:2px solid #0f1623}p.f{margin-top:28px;color:#626977;font-size:12px}</style></head><body>' +
      '<div class="e">' + esc(S.business_name) + '</div><h1>Bilan de fréquentation · ' + esc(PC.fmtMonth(key)) + '</h1><div>' + esc(p.name) + (p.sport ? ' · ' + esc(p.sport) : '') + '</div><div class="r"></div>' +
      '<div class="k"><div>Créneaux<b>' + list.length + '</b></div><div>Passages<b>' + passages + '</b></div><div>' + (price ? 'Coût par passage<b>' + (passages ? PC.eur(PC.round2(price / passages)) : '—') + '</b>' : 'Formule<b>' + esc(p.status === 'pilote' ? 'Pilote gratuit' : '—') + '</b>') + '</div></div>' +
      '<table><thead><tr><th>Date</th><th>Horaire</th><th>Lieu</th><th class="n">Passages</th></tr></thead><tbody>' + list.map((b) => '<tr><td>' + esc(PC.capitalize(PC.fmtDayLong(bStart(b)))) + '</td><td>' + PC.fmtTime(bStart(b)) + ' – ' + PC.fmtTime(bEnd(b)) + '</td><td>' + esc(b.location || '') + '</td><td class="n">' + (b.passages == null ? '—' : b.passages) + '</td></tr>').join('') + '</tbody><tfoot><tr><td colspan="3">Total</td><td class="n">' + passages + '</td></tr></tfoot></table>' +
      '<p class="f">' + esc(S.business_name) + (S.phone ? ' · ' + esc(S.phone) : '') + (S.email ? ' · ' + esc(S.email) : '') + ' · Récupération et bien-être sportif, sans visée médicale.</p>' +
      '<script>window.onload=function(){window.print()}<\/script></body></html>');
    w.document.close();
  }

  /* =================================================================
     Vue : Finances
     ================================================================= */
  function viewFinances() {
    const key = UI.month;
    const ms = monthStats(key);
    const cash = cashAt(key);
    const year = Number(key.slice(0, 4));
    const yca = yearCA(year);
    const L = loanInfo();
    const fc = ms.forecast;
    const pct = fc ? Math.round((ms.ca / fc) * 100) : null;

    let h = '<div class="page-head"><div><h1>Finances</h1><p>Micro-entreprise · franchise de TVA · cotisations estimées à ' + Math.round(S.social_rate * 1000) / 10 + ' %</p></div><div class="row wrap"><button class="btn ghost" data-act="new-tx" data-id="depense">' + I('plus') + 'Dépense</button><button class="btn" data-act="new-tx" data-id="recette">' + I('plus') + 'Recette</button></div></div>';
    h += '<div class="toolbar"><span class="month-nav"><button class="btn icon sm ghost" data-act="month" data-d="-1" aria-label="Mois précédent">' + I('left') + '</button><strong>' + esc(PC.fmtMonth(key)) + '</strong><button class="btn icon sm ghost" data-act="month" data-d="1" aria-label="Mois suivant">' + I('right') + '</button></span><span class="grow"></span><button class="btn sm ghost" data-act="export-livre">' + I('download') + 'Livre des recettes ' + year + '</button><button class="btn sm ghost" data-act="export-all">' + I('download') + 'Toutes les opérations</button></div>';

    h += '<div class="tiles">' +
      tile('Chiffre d\'affaires', PC.eur(ms.ca), fc != null ? 'Prévu : ' + PC.eur(fc) + ' · ' + pct + ' %' : 'Hors période du prévisionnel', fc ? meter(Math.min(100, pct), pct >= 100 ? 'good' : pct >= 60 ? '' : 'warn') : '', 'dark') +
      tile('Il me reste', PC.eur(ms.reste), ms.ca >= S.break_even ? 'Seuil de rentabilité atteint (' + PC.eur(S.break_even) + ')' : 'Seuil de rentabilité : ' + PC.eur(S.break_even)) +
      tile('En caisse fin de mois', PC.eur(cash.cash), 'Dont ' + PC.eur(cash.provision) + ' à garder pour l\'URSSAF') +
      tile('Chiffre d\'affaires ' + year, PC.eur(yca), 'Franchise de TVA : ' + PC.eur(S.vat_threshold), meter((yca / (S.vat_threshold || 1)) * 100, yca >= S.vat_threshold ? 'bad' : yca >= S.vat_threshold * 0.8 ? 'warn' : 'good')) +
      '</div>';

    // suggestions
    const sugg = [];
    const hasCharges = txIn(key).some((t) => (S.monthly_charges || []).some((c) => c.category === t.category));
    if (!hasCharges && (S.monthly_charges || []).length) sugg.push('<div class="alert info">' + I('info') + '<span class="grow">Charges fixes du mois pas encore saisies (≈ ' + PC.eur(sum(S.monthly_charges, (c) => c.amount)) + ').</span><button class="btn sm soft" data-act="add-charges">Les saisir</button></div>');
    if (key >= L.first && L.left > 0 && !txIn(key).some((t) => t.category === 'adie')) sugg.push('<div class="alert info">' + I('info') + '<span class="grow">Mensualité Adie de ' + PC.eur(S.loan.monthly) + ' à saisir.</span><button class="btn sm soft" data-act="add-adie">Saisir</button></div>');
    D.partners.filter((p) => p.status === 'contrat' && Number(p.monthly_price) > 0 && !partnerBilled(p, key)).forEach((p) => sugg.push('<div class="alert info">' + I('euro') + '<span class="grow">Forfait de <b>' + esc(p.name) + '</b> (' + PC.eur(p.monthly_price) + ') pas encore enregistré.</span>' + (key === PC.monthKey(new Date()) ? '<button class="btn sm soft" data-act="bill-partner" data-id="' + p.id + '">Enregistrer</button>' : '') + '</div>'));
    const unpaid = D.bookings.filter((b) => b.status === 'terminee' && !b.paid && Number(b.price) > 0 && b.payment_mode === 'unitaire' && PC.ymd(bStart(b)).startsWith(key));
    if (unpaid.length) sugg.push('<div class="alert warn">' + I('alert') + '<span class="grow">' + unpaid.length + ' séance(s) terminée(s) non encaissée(s) : ' + PC.eur(sum(unpaid, (b) => b.price)) + '.</span><button class="btn sm soft" data-act="open-booking" data-id="' + unpaid[0].id + '">Voir</button></div>');

    h += '<div class="cols"><div>';
    h += '<div class="card" style="margin-bottom:16px"><div class="card-head"><h2>Chiffre d\'affaires mois par mois</h2><button class="btn sm ghost" data-act="toggle-table">' + (UI.showTable ? 'Voir le graphique' : 'Voir le tableau') + '</button></div>' + (UI.showTable ? yearTable(key) : yearChart(key)) + '</div>';
    h += txCard(key);
    h += '</div><div>';
    if (sugg.length) h += '<div style="margin-bottom:16px">' + sugg.join('') + '</div>';
    h += '<div class="card" style="margin-bottom:16px"><div class="card-head"><h2>' + esc(PC.fmtMonth(key)) + '</h2></div>' + monthBreakdown(ms) +
      '<table class="tbl" style="margin-top:10px"><tbody><tr><td class="muted">Je me suis versé</td><td class="num">' + PC.eur(ms.verse) + '</td></tr><tr><td class="muted">Cotisations déclarées (URSSAF)</td><td class="num">' + PC.eur(ms.cotisPaid) + '</td></tr><tr><td class="muted">En caisse, après provision URSSAF</td><td class="num"><b>' + PC.eur(cash.dispo) + '</b></td></tr></tbody></table></div>';
    h += '<div class="card"><div class="card-head"><h2>Prêt Adie</h2><span class="badge ' + (L.left ? 'info' : 'good') + '">' + (L.left ? L.left + ' mensualités restantes' : 'Remboursé') + '</span></div>' +
      '<table class="tbl"><tbody><tr><td class="muted">Montant emprunté</td><td class="num">' + PC.eur(S.loan.amount) + '</td></tr><tr><td class="muted">Mensualité</td><td class="num">' + PC.eur(S.loan.monthly) + '</td></tr><tr><td class="muted">Première échéance</td><td class="num">' + esc(PC.fmtMonth(L.first)) + '</td></tr><tr><td class="muted">Mensualités payées</td><td class="num">' + L.paid + ' / ' + S.loan.payments + '</td></tr><tr class="total"><td>Reste à rembourser</td><td class="num">' + PC.eur(L.due) + '</td></tr></tbody></table>' +
      meter((L.paid / (S.loan.payments || 1)) * 100, 'good') + '</div>';
    h += '</div></div>';
    return h;
  }

  function yearWindow(key) {
    let idx = monthsBetween(S.start_month, key);
    if (idx < 0) idx = 0;
    const first = PC.addMonths(S.start_month, Math.floor(idx / 12) * 12);
    return { first, months: Array.from({ length: 12 }, (_, i) => PC.addMonths(first, i)), n: Math.floor(idx / 12) + 1 };
  }

  const ACT_COLORS = { clubs: 'var(--c-club)', seances: 'var(--c-seance)', evenements: 'var(--c-event)', ventes: 'var(--c-vente)' };
  function yearChart(key) {
    const yw = yearWindow(key);
    const stats = yw.months.map(monthStats);
    UI.chart = { stats, key, n: yw.n };
    const legend = '<div class="legend" style="margin-bottom:8px">' + PC.ACTIVITIES.map((a) => '<span><i class="dot" style="background:' + ACT_COLORS[a.key] + '"></i>' + esc(a.label) + '</span>').join('') + '<span><i class="fc-key"></i>Prévisionnel</span></div>';
    const tot = sum(stats, (s) => s.ca), totF = sum(stats.filter((s) => s.forecast != null), (s) => s.forecast);
    return legend + '<div class="chart" id="ca-chart"></div>' +
      '<p class="small muted" style="margin-top:6px">Année ' + yw.n + ' d\'activité (' + esc(PC.fmtMonth(yw.months[0], true)) + ' – ' + esc(PC.fmtMonth(yw.months[11], true)) + ' ' + yw.months[11].slice(0, 4) + ') : ' + PC.eur(tot) + ' encaissés' + (totF ? ' sur ' + PC.eur(totF) + ' prévus' : '') + '. Clique sur un mois pour l\'afficher.</p>';
  }
  // Dessiné à la largeur réelle du conteneur : le texte reste à 11 px sur mobile comme sur ordinateur
  function drawChart(el) {
    const { stats, key, n } = UI.chart;
    const W = Math.max(280, Math.round(el.clientWidth)), H = 240, L = 44, R = 6, T = 20, B = 24;
    const max = Math.max(1, ...stats.map((s) => Math.max(s.ca, s.forecast || 0)));
    const step = niceStep(max / 4);
    const top = Math.ceil(max / step) * step;
    const band = (W - L - R) / 12;
    const bw = Math.min(24, Math.max(8, band * 0.5));
    const y = (v) => T + (H - T - B) * (1 - v / top);
    const narrow = band < 34;
    let svg = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Chiffre d\'affaires mensuel par activité, année ' + n + ' d\'activité, comparé au prévisionnel">';
    svg += '<g class="grid">';
    for (let v = 0; v <= top + 0.001; v += step) svg += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '"></line>';
    svg += '</g><g class="axis">';
    for (let v = 0; v <= top + 0.001; v += step) svg += '<text x="' + (L - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + PC.num(v) + '</text>';
    stats.forEach((s, i) => {
      const lbl = PC.fmtMonth(s.key, true).replace('.', '');
      svg += '<text x="' + (L + band * i + band / 2) + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(narrow ? lbl.charAt(0) : lbl) + '</text>';
    });
    svg += '</g>';
    stats.forEach((s, i) => {
      const cx = L + band * i + band / 2;
      const x = cx - bw / 2;
      let base = 0;
      const segs = PC.ACTIVITIES.map((a) => ({ k: a.key, v: s.byAct[a.key] || 0 })).filter((g) => g.v > 0);
      segs.forEach((g, j) => {
        // 2 px de fond entre deux segments empilés ; extrémité haute arrondie
        const y0 = y(base), y1 = y(base + g.v);
        const gap = j > 0 ? 2 : 0;
        svg += barPath(x, y1, bw, Math.max(0.5, y0 - y1 - gap), j === segs.length - 1 ? 4 : 0, ACT_COLORS[g.k]);
        base += g.v;
      });
      if (s.forecast != null) svg += '<line class="fc" x1="' + (cx - bw / 2 - 5) + '" x2="' + (cx + bw / 2 + 5) + '" y1="' + y(s.forecast) + '" y2="' + y(s.forecast) + '"></line>';
      if (s.key === key && s.ca > 0) svg += '<text class="tot" x="' + cx + '" y="' + (Math.min(y(s.ca), s.forecast != null ? y(s.forecast) : 1e9) - 7) + '" text-anchor="middle">' + PC.num(s.ca) + '</text>';
      svg += '<rect class="hit" tabindex="0" data-i="' + i + '" x="' + (L + band * i) + '" y="' + T + '" width="' + band + '" height="' + (H - T - B) + '" aria-label="' + esc(PC.fmtMonth(s.key) + ' : ' + PC.eur(s.ca) + (s.forecast != null ? ', prévu ' + PC.eur(s.forecast) : '')) + '"></rect>';
    });
    svg += '</svg><div class="tip hide" id="ca-tip"></div>';
    el.innerHTML = svg;
  }
  function barPath(x, yTop, w, h, r, color) {
    r = Math.min(r, w / 2, h);
    const yb = yTop + h;
    if (!r) return '<rect x="' + x + '" y="' + yTop + '" width="' + w + '" height="' + h + '" fill="' + color + '"></rect>';
    return '<path fill="' + color + '" d="M' + x + ',' + yb + ' V' + (yTop + r) + ' Q' + x + ',' + yTop + ' ' + (x + r) + ',' + yTop + ' H' + (x + w - r) + ' Q' + (x + w) + ',' + yTop + ' ' + (x + w) + ',' + (yTop + r) + ' V' + yb + ' Z"></path>';
  }
  function niceStep(raw) {
    const p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1))));
    const n = raw / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
  }
  function yearTable(key) {
    const yw = yearWindow(key);
    const stats = yw.months.map(monthStats);
    const cell = (v) => '<td class="num">' + (v ? PC.eur(v) : '<span class="muted">—</span>') + '</td>';
    let h = '<div class="table-wrap"><table class="tbl"><thead><tr><th>Mois</th>' + PC.ACTIVITIES.map((a) => '<th class="num">' + esc(a.label.split(' ')[0]) + '</th>').join('') + '<th class="num">CA</th><th class="num">Prévu</th><th class="num">Il me reste</th></tr></thead><tbody>';
    stats.forEach((s) => {
      h += '<tr class="click" data-act="goto-month" data-id="' + s.key + '"><td>' + esc(PC.fmtMonth(s.key, true)) + ' ' + s.key.slice(2, 4) + '</td>' + PC.ACTIVITIES.map((a) => cell(s.byAct[a.key])).join('') + '<td class="num"><b>' + PC.eur(s.ca) + '</b></td>' + cell(s.forecast) + '<td class="num">' + PC.eur(s.reste) + '</td></tr>';
    });
    h += '<tr class="total"><td>Total</td>' + PC.ACTIVITIES.map((a) => '<td class="num">' + PC.eur(sum(stats, (s) => s.byAct[a.key])) + '</td>').join('') + '<td class="num">' + PC.eur(sum(stats, (s) => s.ca)) + '</td><td class="num">' + PC.eur(sum(stats, (s) => s.forecast)) + '</td><td class="num">' + PC.eur(sum(stats, (s) => s.reste)) + '</td></tr>';
    return h + '</tbody></table></div>';
  }

  function txCard(key) {
    const f = UI.txFilter;
    const list = txIn(key).filter((t) => f === 'tout' || t.type === f).sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.created_at).localeCompare(String(a.created_at)));
    let h = '<div class="card"><div class="card-head"><h2>Opérations</h2><div class="seg" role="group">' + [['tout', 'Tout'], ['recette', 'Recettes'], ['depense', 'Dépenses']].map(([k, l]) => '<button data-act="tx-filter" data-id="' + k + '" aria-pressed="' + (f === k) + '">' + l + '</button>').join('') + '</div></div>';
    if (!list.length) return h + '<div class="empty">Aucune opération ce mois-ci.</div></div>';
    h += '<div class="table-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Libellé</th><th class="hide-m">Catégorie</th><th class="num">Montant</th></tr></thead><tbody>';
    list.forEach((t) => {
      const cat = t.type === 'recette' ? PC.INCOME_CATS[t.category] : PC.EXPENSE_CATS[t.category];
      h += '<tr class="click" data-act="edit-tx" data-id="' + t.id + '"><td class="tnum">' + esc(PC.parseYmd(t.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })) + '</td><td>' + esc(t.label || '') + '</td><td class="nowrap hide-m"><span class="small muted">' + esc(cat || t.category) + '</span></td><td class="num" style="color:' + (t.type === 'recette' ? 'var(--good)' : 'var(--ink)') + '">' + (t.type === 'recette' ? '+ ' : '− ') + PC.eur(t.amount) + '</td></tr>';
    });
    return h + '</tbody></table></div></div>';
  }

  function editTx(id, type) {
    const t = id ? D.transactions.find((x) => x.id === id) : { type: type || 'recette', date: UI.month === PC.monthKey(new Date()) ? PC.ymd(new Date()) : UI.month + '-01', category: type === 'depense' ? 'deplacement' : 'seance', label: '', amount: '', method: 'cb' };
    const cats = t.type === 'recette' ? PC.INCOME_CATS : PC.EXPENSE_CATS;
    const body = '<form id="tx-form" class="stack"><div class="grid-2"><label class="field"><span>Date</span><input type="date" name="date" value="' + esc(t.date) + '" required></label><label class="field"><span>Montant (€)</span><input type="number" step="0.01" min="0" name="amount" value="' + esc(t.amount) + '" required inputmode="decimal"></label></div>' +
      '<label class="field"><span>Catégorie</span><select name="category">' + Object.entries(cats).map(([k, v]) => '<option value="' + k + '"' + (k === t.category ? ' selected' : '') + '>' + esc(v) + '</option>').join('') + '</select></label>' +
      '<label class="field"><span>Libellé</span><input name="label" value="' + esc(t.label || '') + '" placeholder="' + (t.type === 'recette' ? 'Récup+ — Léa M.' : 'Plein d\'essence') + '"></label>' +
      '<label class="field"><span>Moyen de paiement</span><select name="method"><option value="">—</option>' + Object.entries(PC.PAY_METHODS).map(([k, v]) => '<option value="' + k + '"' + (k === t.method ? ' selected' : '') + '>' + esc(v) + '</option>').join('') + '</select></label>' +
      (t.booking_id ? '<p class="small muted">Liée à une séance de l\'agenda.</p>' : '') + '</form>';
    modal({ title: (id ? 'Modifier ' : 'Nouvelle ') + (t.type === 'recette' ? 'recette' : 'dépense'), body, foot: (id ? '<button class="btn danger" data-act="delete-tx" data-id="' + id + '">Supprimer</button>' : '') + '<button class="btn ghost" data-close>Annuler</button><button class="btn" type="submit" form="tx-form">Enregistrer</button>' });
    $('#tx-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const obj = { id: id || undefined, type: t.type, date: f.get('date'), amount: PC.round2(f.get('amount')), category: f.get('category'), label: String(f.get('label') || '').trim() || (cats[f.get('category')] || ''), method: f.get('method') || null };
      await run(async () => {
        await save('transactions', obj);
        UI.month = obj.date.slice(0, 7);
        closeModal();
      }, 'Opération enregistrée');
    });
  }

  async function addCharges() {
    const key = UI.view === 'finances' ? UI.month : PC.monthKey(new Date());
    const date = key === PC.monthKey(new Date()) ? PC.ymd(new Date()) : key + '-01';
    await run(async () => {
      for (const c of S.monthly_charges || []) await save('transactions', { date, type: 'depense', category: c.category, label: c.label, amount: Number(c.amount), method: 'cb' });
    }, 'Charges du mois ajoutées : ajuste les montants réels si besoin');
  }
  async function addAdie() {
    const key = UI.view === 'finances' ? UI.month : PC.monthKey(new Date());
    const date = key === PC.monthKey(new Date()) ? PC.ymd(new Date()) : key + '-05';
    await run(() => save('transactions', { date, type: 'depense', category: 'adie', label: 'Mensualité Adie', amount: Number(S.loan.monthly), method: 'virement' }), 'Mensualité Adie enregistrée');
  }

  function exportLivre() {
    const year = UI.month.slice(0, 4);
    const rows = [['Date', 'Référence', 'Client', 'Nature de la prestation', 'Montant (€)', 'Mode de règlement']];
    txIn(year).filter((t) => t.type === 'recette').sort((a, b) => String(a.date).localeCompare(String(b.date))).forEach((t) => {
      const b = t.booking_id ? D.bookings.find((x) => x.id === t.booking_id) : null;
      const c = t.client_id ? clientById(t.client_id) : null;
      const p = t.partner_id ? partnerById(t.partner_id) : null;
      rows.push([PC.parseYmd(t.date).toLocaleDateString('fr-FR'), b ? b.ref : '', c ? c.name : p ? p.name : '', (PC.INCOME_CATS[t.category] || t.category) + (t.label ? ' — ' + t.label : ''), String(Number(t.amount).toFixed(2)).replace('.', ','), PC.PAY_METHODS[t.method] || '']);
    });
    PC.download('livre-des-recettes-' + year + '.csv', PC.csv(rows), 'text/csv;charset=utf-8');
  }
  function exportAll() {
    const rows = [['Date', 'Type', 'Catégorie', 'Libellé', 'Montant (€)', 'Moyen']];
    D.transactions.slice().sort((a, b) => String(a.date).localeCompare(String(b.date))).forEach((t) => rows.push([t.date, t.type, (t.type === 'recette' ? PC.INCOME_CATS : PC.EXPENSE_CATS)[t.category] || t.category, t.label || '', String(Number(t.amount).toFixed(2)).replace('.', ','), PC.PAY_METHODS[t.method] || '']));
    PC.download('presso-center-operations.csv', PC.csv(rows), 'text/csv;charset=utf-8');
  }

  function bindChart() {
    const chart = $('#ca-chart');
    if (!chart) return;
    drawChart(chart);
    const tip = $('#ca-tip');
    const show = (rect) => {
      const s = UI.chart.stats[Number(rect.dataset.i)];
      const diff = s.forecast != null ? s.ca - s.forecast : null;
      tip.innerHTML = '<b>' + esc(PC.fmtMonth(s.key)) + '</b><hr>' + PC.ACTIVITIES.map((a) => '<div class="r"><span><i class="dot" style="background:' + ACT_COLORS[a.key] + '"></i>' + esc(a.label) + '</span><b>' + PC.eur(s.byAct[a.key]) + '</b></div>').join('') + '<hr><div class="r"><span>Total</span><b>' + PC.eur(s.ca) + '</b></div>' +
        (s.forecast != null ? '<div class="r"><span><i class="fc-key"></i>Prévu</span><b>' + PC.eur(s.forecast) + '</b></div><div class="r"><span>Écart</span><b>' + (diff >= 0 ? '+ ' : '− ') + PC.eur(Math.abs(diff)) + '</b></div>' : '') +
        '<div class="r"><span>Il me reste</span><b>' + PC.eur(s.reste) + '</b></div>';
      tip.classList.remove('hide');
      const cr = chart.getBoundingClientRect();
      const rr = rect.getBoundingClientRect();
      let left = rr.left - cr.left + rr.width / 2 + 12;
      if (left + 200 > cr.width) left = rr.left - cr.left + rr.width / 2 - 212;
      tip.style.left = Math.max(0, left) + 'px';
      tip.style.top = '0px';
    };
    $$('.hit', chart).forEach((r) => {
      r.addEventListener('mouseenter', () => show(r));
      r.addEventListener('focus', () => show(r));
      r.addEventListener('mouseleave', () => tip.classList.add('hide'));
      r.addEventListener('blur', () => tip.classList.add('hide'));
      r.addEventListener('click', () => {
        UI.month = UI.chart.stats[Number(r.dataset.i)].key;
        render();
      });
      r.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          UI.month = UI.chart.stats[Number(r.dataset.i)].key;
          render();
        }
      });
    });
  }

  /* =================================================================
     Vue : Matériel
     ================================================================= */
  function viewMateriel() {
    const boots = D.equipment.filter((e) => e.kind === 'botte');
    const acc = D.equipment.filter((e) => e.kind !== 'botte');
    const cap = capacity();
    const lc = lastCheck();
    const hours = bootHours();
    const activeBoots = boots.filter((b) => b.status !== 'retiree' && b.status !== 'prevue').length || 1;
    const sb = D.stock.find((s) => /sous-botte/i.test(s.name));
    const value = sum(D.equipment, (e) => e.purchase_price);
    const mk = PC.monthKey(new Date());

    let h = '<div class="page-head"><div><h1>Matériel</h1><p>Parc de bottes, contrôle hebdomadaire et consommables</p></div><button class="btn" data-act="new-check">' + I('check') + 'Contrôle de la semaine</button></div>';
    h += '<div class="tiles">' +
      tile('Bottes opérationnelles', cap + ' / ' + boots.filter((b) => b.status !== 'retiree').length, 'Capacité : ' + cap + ' athlètes en même temps', '', 'dark') +
      tile('Dernier contrôle', lc ? (lc.days === 0 ? 'Aujourd\'hui' : 'Il y a ' + lc.days + ' j') : 'Jamais', lc && lc.days <= 7 ? 'À jour' : 'À faire chaque semaine', lc ? meter(Math.min(100, (lc.days / 7) * 100), lc.days > 7 ? 'bad' : lc.days >= 6 ? 'warn' : 'good') : '') +
      tile('Utilisation', '≈ ' + PC.num(hours / activeBoots, 0) + ' h', 'par botte depuis le début (' + PC.num(hours, 0) + ' h au total)') +
      tile(sb ? 'Sous-bottes' : 'Valeur du parc', sb ? PC.num(sb.qty) + ' ' + esc(sb.unit || '') : PC.eur(value), sb ? 'Soit ≈ ' + PC.num(sb.per_passage ? sb.qty / sb.per_passage : sb.qty) + ' passages' : '') +
      '</div>';

    h += '<div class="card" style="margin-bottom:16px"><div class="card-head"><h2>Bottes</h2><button class="btn sm soft" data-act="new-equipment" data-id="botte">' + I('plus') + 'Ajouter une botte</button></div><div class="boots">';
    boots.forEach((b) => {
      const cls = { ok: 'good', a_verifier: 'warn', panne: 'bad', reparation: 'warn', prevue: 'info', retiree: 'plain' }[b.status] || '';
      h += '<div class="boot" data-act="open-equipment" data-id="' + b.id + '" role="button" tabindex="0"><div class="row between"><span class="n">' + esc(b.name) + '</span><span class="badge ' + cls + '">' + esc(PC.EQUIP_STATUSES[b.status] || b.status) + '</span></div>' +
        '<span class="small muted">' + esc(b.model || '') + (b.size ? ' · ' + esc(b.size) : '') + '</span>' +
        '<span class="kv"><span>Contrôlée</span><b>' + (b.last_check ? esc(PC.fmtDate(b.last_check)) : '—') + '</b></span>' +
        '<span class="kv"><span>Achat</span><b>' + (b.purchase_date ? esc(PC.fmtDate(b.purchase_date)) : '—') + (b.purchase_price ? ' · ' + PC.eur(b.purchase_price) : '') + '</b></span>' +
        (b.notes ? '<span class="small" style="color:var(--warn)">' + esc(b.notes) + '</span>' : '') + '</div>';
    });
    h += '</div>';
    if (boots.filter((b) => b.status !== 'retiree').length < 6) {
      const cash = cashAt(mk);
      h += '<div class="alert info" style="margin-top:14px">' + I('star') + '<span class="grow">Étape du plan : une <b>6<sup>e</sup> botte (≈ 700 €)</b> au 9<sup>e</sup> mois pour lancer la formule Elite. Disponible en caisse aujourd\'hui : <b>' + PC.eur(cash.dispo) + '</b>.</span></div>';
    }
    h += '</div>';

    h += '<div class="cols"><div>';
    h += '<div class="card" style="margin-bottom:16px"><div class="card-head"><h2>Consommables</h2><button class="btn sm soft" data-act="new-stock">' + I('plus') + 'Ajouter</button></div>';
    h += D.stock.length ? '<div class="table-wrap"><table class="tbl"><thead><tr><th>Article</th><th class="num">Stock</th></tr></thead><tbody>' + D.stock.map((s) => {
      const low = Number(s.qty) <= Number(s.min_qty);
      const auto = Number(s.per_passage) > 0 ? ' · ≈ ' + PC.num(Number(s.qty) / Number(s.per_passage)) + ' passages' : '';
      return '<tr><td><button class="btn sm ghost" style="border:0;padding:0;min-height:0;font-weight:600;white-space:normal;text-align:left" data-act="edit-stock" data-id="' + s.id + '">' + esc(s.name) + '</button> ' + (low ? '<span class="badge warn">À commander</span>' : '') + '<br><span class="small muted">' + PC.num(s.qty, 2) + ' ' + esc(s.unit || '') + auto + ' · alerte sous ' + PC.num(s.min_qty, 1) + '</span></td>' +
        '<td class="num"><span class="qty"><button class="btn icon sm soft" data-act="stock-step" data-id="' + s.id + '" data-d="-1" aria-label="Retirer un">−</button><b>' + PC.num(s.qty, 2) + '</b><button class="btn icon sm soft" data-act="stock-step" data-id="' + s.id + '" data-d="1" aria-label="Ajouter un">+</button></span></td></tr>';
    }).join('') + '</tbody></table></div><p class="small muted" style="margin-top:8px">Le stock baisse automatiquement quand tu clôtures une séance (selon la consommation par passage).</p>' : '<div class="empty">Aucun consommable suivi.</div>';
    h += '</div>';
    h += '<div class="card"><div class="card-head"><h2>Accessoires</h2><button class="btn sm soft" data-act="new-equipment" data-id="accessoire">' + I('plus') + 'Ajouter</button></div>' +
      (acc.length ? '<div class="list">' + acc.map((e) => '<div class="li click" data-act="open-equipment" data-id="' + e.id + '"><span class="grow"><span class="t">' + esc(e.name) + '</span>' + (e.notes ? '<br><span class="s">' + esc(e.notes) + '</span>' : '') + '</span><span class="badge ' + (e.status === 'ok' ? 'good' : 'warn') + '">' + esc(PC.EQUIP_STATUSES[e.status] || e.status) + '</span></div>').join('') + '</div>' : '<div class="empty">Aucun accessoire.</div>') + '</div>';
    h += '</div><div>';
    const checks = D.checks.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 8);
    h += '<div class="card"><div class="card-head"><h2>Contrôles hebdomadaires</h2></div>' + (checks.length ? '<div class="list">' + checks.map((c) => '<div class="li click" data-act="open-check" data-id="' + c.id + '"><span class="grow"><span class="t">' + esc(PC.fmtDate(c.date)) + '</span><br><span class="s">' + esc(c.notes || (c.ok ? 'RAS' : 'Points à surveiller')) + '</span></span><span class="badge ' + (c.ok ? 'good' : 'warn') + '">' + (c.ok ? 'Tout est OK' : 'À surveiller') + '</span></div>').join('') + '</div>' : '<div class="empty">Aucun contrôle enregistré.</div>') +
      '<p class="small muted" style="margin-top:10px">Chaque semaine : batterie, tuyaux et raccords, étanchéité des chambres, nettoyage. Garde des pièces d\'usure en réserve.</p></div>';
    h += '</div></div>';
    return h;
  }

  function openEquipment(id, kind) {
    const e = id ? D.equipment.find((x) => x.id === id) : { name: kind === 'accessoire' ? '' : 'Botte ' + (D.equipment.filter((x) => x.kind === 'botte').length + 1), kind: kind || 'botte', model: kind === 'accessoire' ? '' : 'Bootech BT-PRO 8.0', serial: '', size: kind === 'accessoire' ? '' : 'M/L', purchase_date: PC.ymd(new Date()), purchase_price: kind === 'accessoire' ? '' : 699, status: 'ok', notes: '' };
    const body = '<form id="eq-form" class="stack"><div class="grid-2"><label class="field"><span>Nom</span><input name="name" value="' + esc(e.name) + '" required></label><label class="field"><span>État</span><select name="status">' + Object.entries(PC.EQUIP_STATUSES).map(([k, v]) => '<option value="' + k + '"' + (k === e.status ? ' selected' : '') + '>' + esc(v) + '</option>').join('') + '</select></label></div>' +
      (e.kind === 'botte' ? '<div class="grid-3"><label class="field"><span>Modèle</span><input name="model" value="' + esc(e.model || '') + '"></label><label class="field"><span>N° de série</span><input name="serial" value="' + esc(e.serial || '') + '"></label><label class="field"><span>Taille</span><input name="size" value="' + esc(e.size || '') + '"></label></div>' : '') +
      '<div class="grid-2"><label class="field"><span>Date d\'achat</span><input type="date" name="purchase_date" value="' + esc(e.purchase_date || '') + '"></label><label class="field"><span>Prix d\'achat (€)</span><input type="number" step="0.01" min="0" name="purchase_price" value="' + esc(e.purchase_price == null ? '' : e.purchase_price) + '"></label></div>' +
      '<label class="field"><span>Notes</span><textarea name="notes" rows="2">' + esc(e.notes || '') + '</textarea></label>' +
      (!id ? '<label class="check"><input type="checkbox" name="as_expense" checked><span>Enregistrer l\'achat dans les dépenses (matériel)</span></label>' : '') + '</form>';
    modal({ title: id ? e.name : (kind === 'accessoire' ? 'Nouvel accessoire' : 'Nouvelle botte'), body, foot: (id ? '<button class="btn danger" data-act="delete-equipment" data-id="' + id + '">Supprimer</button>' : '') + '<button class="btn ghost" data-close>Annuler</button><button class="btn" type="submit" form="eq-form">Enregistrer</button>' });
    $('#eq-form').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const f = new FormData(ev.target);
      const obj = { id: id || undefined, kind: e.kind, name: String(f.get('name')).trim(), status: f.get('status'), model: f.get('model') != null ? String(f.get('model')).trim() : e.model, serial: f.get('serial') != null ? String(f.get('serial')).trim() : e.serial, size: f.get('size') != null ? String(f.get('size')).trim() : e.size, purchase_date: f.get('purchase_date') || null, purchase_price: f.get('purchase_price') === '' ? null : PC.round2(f.get('purchase_price')), notes: String(f.get('notes') || '').trim() || null };
      await run(async () => {
        await save('equipment', obj);
        if (!id && f.get('as_expense') && obj.purchase_price) await save('transactions', { date: obj.purchase_date || PC.ymd(new Date()), type: 'depense', category: 'materiel', label: 'Achat : ' + obj.name + (obj.model ? ' (' + obj.model + ')' : ''), amount: obj.purchase_price, method: 'cb' });
        closeModal();
      }, 'Matériel enregistré');
    });
  }

  function newCheck(viewId) {
    const existing = viewId ? D.checks.find((c) => c.id === viewId) : null;
    const boots = D.equipment.filter((e) => e.kind === 'botte' && e.status !== 'retiree' && e.status !== 'prevue');
    let body = '<form id="ck-form" class="stack">';
    if (existing) {
      body += '<p class="muted">Contrôle du ' + esc(PC.fmtDate(existing.date)) + '</p>';
      (existing.items || []).forEach((it) => {
        body += '<div class="card cream" style="padding:12px"><div class="row between"><b>' + esc(it.name) + '</b><span class="badge ' + (it.ok ? 'good' : 'warn') + '">' + (it.ok ? 'OK' : 'À surveiller') + '</span></div><ul class="bullets small" style="margin-top:8px">' + (it.checks || []).map((c) => '<li>' + (c.ok ? '' : '⚠ ') + esc(c.label) + '</li>').join('') + '</ul></div>';
      });
      body += '<p>' + esc(existing.notes || '') + '</p></form>';
      return modal({ title: 'Contrôle', body, foot: '<button class="btn danger" data-act="delete-check" data-id="' + existing.id + '">Supprimer</button><button class="btn ghost" data-close>Fermer</button>' });
    }
    body += '<p class="small muted">Décoche ce qui pose problème. La botte passera en « À vérifier ».</p>';
    boots.forEach((b) => {
      body += '<fieldset class="card cream" style="padding:12px;margin:0"><legend class="sr-only">' + esc(b.name) + '</legend><b>' + esc(b.name) + '</b>' + (b.notes ? ' <span class="small muted">· ' + esc(b.notes) + '</span>' : '') +
        '<div class="grid-2" style="margin-top:8px">' + PC.CHECK_ITEMS.map((c, j) => '<label class="check"><input type="checkbox" name="' + b.id + '__' + j + '" checked><span>' + esc(c) + '</span></label>').join('') + '</div></fieldset>';
    });
    body += '<label class="field"><span>Remarques</span><textarea name="notes" rows="2" placeholder="Pièce à commander, réparation…"></textarea></label></form>';
    modal({ title: 'Contrôle de la semaine', body, wide: true, foot: '<button class="btn ghost" data-close>Annuler</button><button class="btn good" type="submit" form="ck-form">Enregistrer le contrôle</button>' });
    $('#ck-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const today = PC.ymd(new Date());
      const items = boots.map((b) => {
        const checks = PC.CHECK_ITEMS.map((c, j) => ({ label: c, ok: !!f.get(b.id + '__' + j) }));
        return { id: b.id, name: b.name, ok: checks.every((c) => c.ok), checks };
      });
      await run(async () => {
        await save('checks', { date: today, items, ok: items.every((i) => i.ok), notes: String(f.get('notes') || '').trim() || null });
        for (const it of items) {
          const b = D.equipment.find((x) => x.id === it.id);
          const p = { last_check: today };
          if (!it.ok && b.status === 'ok') {
            p.status = 'a_verifier';
            p.notes = it.checks.filter((c) => !c.ok).map((c) => c.label).join(', ') + ' à vérifier';
          } else if (it.ok && b.status === 'a_verifier') {
            p.status = 'ok';
            p.notes = null;
          }
          await patch('equipment', b.id, p);
        }
        closeModal();
      }, 'Contrôle enregistré');
    });
  }

  function editStock(id) {
    const s = id ? D.stock.find((x) => x.id === id) : { name: '', unit: '', qty: 0, min_qty: 0, per_passage: 0, unit_cost: '', notes: '' };
    const body = '<form id="st-form" class="stack"><div class="grid-2"><label class="field"><span>Article</span><input name="name" value="' + esc(s.name) + '" required></label><label class="field"><span>Unité</span><input name="unit" value="' + esc(s.unit || '') + '" placeholder="paires, flacons…"></label></div>' +
      '<div class="grid-3"><label class="field"><span>Stock</span><input type="number" step="0.01" min="0" name="qty" value="' + esc(s.qty) + '"></label><label class="field"><span>Alerte sous</span><input type="number" step="0.01" min="0" name="min_qty" value="' + esc(s.min_qty) + '"></label><label class="field"><span>Conso. par passage</span><input type="number" step="0.001" min="0" name="per_passage" value="' + esc(s.per_passage) + '"></label></div>' +
      '<label class="field"><span>Coût unitaire (€)</span><input type="number" step="0.01" min="0" name="unit_cost" value="' + esc(s.unit_cost == null ? '' : s.unit_cost) + '"></label></form>';
    modal({ title: id ? s.name : 'Nouveau consommable', body, foot: (id ? '<button class="btn danger" data-act="delete-stock" data-id="' + id + '">Supprimer</button>' : '') + '<button class="btn ghost" data-close>Annuler</button><button class="btn" type="submit" form="st-form">Enregistrer</button>' });
    $('#st-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const obj = { id: id || undefined, name: String(f.get('name')).trim(), unit: String(f.get('unit') || '').trim() || null, qty: PC.round2(f.get('qty')), min_qty: PC.round2(f.get('min_qty')), per_passage: Number(f.get('per_passage')) || 0, unit_cost: f.get('unit_cost') === '' ? null : PC.round2(f.get('unit_cost')) };
      await run(async () => {
        await save('stock', obj);
        closeModal();
      }, 'Stock enregistré');
    });
  }

  /* =================================================================
     Vue : Réglages
     ================================================================= */
  const DAYS = [['1', 'Lundi'], ['2', 'Mardi'], ['3', 'Mercredi'], ['4', 'Jeudi'], ['5', 'Vendredi'], ['6', 'Samedi'], ['0', 'Dimanche']];
  function viewReglages() {
    let h = '<div class="page-head"><div><h1>Réglages</h1><p>Coordonnées, horaires, tarifs et paramètres financiers</p></div></div>';
    h += '<div class="cols even"><div>';
    // Partage
    h += '<div class="card" style="margin-bottom:16px"><div class="card-head"><h2>Partager la page de réservation</h2></div><div class="row wrap" style="align-items:flex-start;gap:16px"><div class="qr" id="qr" aria-label="QR code vers la page de réservation"></div><div class="grow stack" style="min-width:200px"><input readonly value="' + esc(bookingUrl()) + '" aria-label="Lien"><div class="row wrap"><button class="btn sm" data-act="copy-link">' + I('copy') + 'Copier le lien</button><button class="btn sm soft" data-act="dl-qr">' + I('download') + 'QR code (SVG)</button></div><p class="small muted">Imprime le QR code sur tes flyers et ton kakémono : les sportifs réservent directement.</p></div></div></div>';
    // Coordonnées
    h += '<form class="card" id="set-contact" style="margin-bottom:16px"><div class="card-head"><h2>Coordonnées</h2><button class="btn sm">Enregistrer</button></div><div class="stack">' +
      '<div class="grid-2"><label class="field"><span>Nom de l\'activité</span><input name="business_name" value="' + esc(S.business_name) + '"></label><label class="field"><span>Prénom (accueil de l\'espace de gestion)</span><input name="owner_name" value="' + esc(S.owner_name) + '"></label></div>' +
      '<div class="grid-2"><label class="field"><span>Téléphone WhatsApp</span><input name="phone" type="tel" value="' + esc(S.phone) + '"><small>Affiché aux clients pour te prévenir.</small></label><label class="field"><span>E-mail</span><input name="email" type="email" value="' + esc(S.email) + '"></label></div>' +
      '<label class="field"><span>Lieu des séances individuelles</span><input name="base_location" value="' + esc(S.base_location) + '"></label></div></form>';
    // Horaires
    h += '<form class="card" id="set-hours" style="margin-bottom:16px"><div class="card-head"><h2>Réservation en ligne</h2><button class="btn sm">Enregistrer</button></div><p class="small muted" style="margin-bottom:8px">Plages où les clients peuvent réserver seuls. Les créneaux clubs, événements et indisponibilités de l\'agenda sont retirés automatiquement.</p>';
    DAYS.forEach(([k, label]) => {
      const wins = (S.hours[k] || []);
      h += '<div class="hours-row"><b>' + label + '</b><div data-day="' + k + '">' + wins.map((w, i) => winRow(k, i, w)).join('') + '<button type="button" class="btn sm ghost" data-act="add-window" data-id="' + k + '">' + I('plus') + 'Plage</button></div></div>';
    });
    h += '<div class="grid-3" style="margin-top:12px"><label class="field"><span>Délai minimum (h)</span><input type="number" min="0" name="min_notice_hours" value="' + S.min_notice_hours + '"></label><label class="field"><span>Réservable jusqu\'à (jours)</span><input type="number" min="1" max="90" name="max_days_ahead" value="' + S.max_days_ahead + '"></label><label class="field"><span>Pas des créneaux (min)</span><input type="number" min="5" step="5" name="slot_step" value="' + S.slot_step + '"></label></div>' +
      '<div class="grid-3"><label class="field"><span>Rotation entre athlètes (min)</span><input type="number" min="0" name="rotation_min" value="' + S.rotation_min + '"></label><label class="field"><span>Trajet domicile (min)</span><input type="number" min="0" name="travel_min" value="' + S.travel_min + '"></label><label class="field"><span>Plafond hebdo (h)</span><input type="number" min="1" name="weekly_hours_cap" value="' + S.weekly_hours_cap + '"></label></div></form>';
    h += '</div><div>';
    // Tarifs
    h += '<form class="card" id="set-prices" style="margin-bottom:16px"><div class="card-head"><h2>Tarifs</h2><button class="btn sm">Enregistrer</button></div><div class="table-wrap"><table class="tbl"><thead><tr><th>Formule</th><th class="num">Durée</th><th class="num">Prix</th><th>En ligne</th></tr></thead><tbody>' +
      S.services.map((s, i) => '<tr><td>' + esc(s.name) + (s.per_person ? ' <span class="small muted">/ pers.</span>' : '') + '</td><td class="num"><input type="number" min="5" step="5" name="svc_d_' + i + '" value="' + s.duration + '" style="width:80px;min-height:36px;padding:4px 8px"></td><td class="num"><input type="number" min="0" step="0.5" name="svc_p_' + i + '" value="' + s.price + '" style="width:84px;min-height:36px;padding:4px 8px"></td><td><input type="checkbox" name="svc_o_' + i + '"' + (s.online !== false ? ' checked' : '') + ' aria-label="Réservable en ligne" style="width:20px;height:20px"></td></tr>').join('') +
      (S.packs || []).map((p, i) => '<tr><td>' + esc(p.name) + '</td><td class="num small muted">' + p.credits + ' séances</td><td class="num"><input type="number" min="0" step="0.5" name="pack_p_' + i + '" value="' + p.price + '" style="width:84px;min-height:36px;padding:4px 8px"></td><td></td></tr>').join('') +
      S.club_plans.map((p, i) => '<tr><td>Forfait ' + esc(p.name) + '</td><td class="num small muted">≈ ' + p.passages + ' passages</td><td class="num"><input type="number" min="0" step="10" name="plan_p_' + i + '" value="' + p.price + '" style="width:84px;min-height:36px;padding:4px 8px"></td><td></td></tr>').join('') +
      '</tbody></table></div></form>';
    // Finances
    h += '<form class="card" id="set-finance" style="margin-bottom:16px"><div class="card-head"><h2>Finances</h2><button class="btn sm">Enregistrer</button></div><div class="stack">' +
      '<div class="grid-3"><label class="field"><span>Début d\'activité</span><input type="month" name="start_month" value="' + esc(S.start_month) + '"></label><label class="field"><span>Cotisations (%)</span><input type="number" step="0.1" min="0" max="50" name="social_rate" value="' + Math.round(S.social_rate * 1000) / 10 + '"></label><label class="field"><span>Trésorerie de départ</span><input type="number" step="1" name="opening_cash" value="' + S.opening_cash + '"></label></div>' +
      '<div class="grid-3"><label class="field"><span>Seuil franchise TVA</span><input type="number" step="100" name="vat_threshold" value="' + S.vat_threshold + '"></label><label class="field"><span>Seuil de rentabilité / mois</span><input type="number" step="10" name="break_even" value="' + S.break_even + '"></label><label class="field"><span>Mensualité Adie</span><input type="number" step="1" name="loan_monthly" value="' + S.loan.monthly + '"></label></div>' +
      '<div class="grid-3"><label class="field"><span>Montant du prêt</span><input type="number" step="100" name="loan_amount" value="' + S.loan.amount + '"></label><label class="field"><span>Mois de différé</span><input type="number" min="0" name="loan_deferral" value="' + S.loan.deferral_months + '"></label><label class="field"><span>Nombre de mensualités</span><input type="number" min="1" name="loan_payments" value="' + S.loan.payments + '"></label></div>' +
      '<div><span class="label">Charges fixes mensuelles</span>' + (S.monthly_charges || []).map((c, i) => '<div class="row" style="margin-bottom:6px"><input name="ch_l_' + i + '" value="' + esc(c.label) + '" aria-label="Libellé"><input type="number" step="1" min="0" name="ch_a_' + i + '" value="' + c.amount + '" style="width:90px" aria-label="Montant"></div>').join('') + '</div>' +
      '<div><span class="label">Prévisionnel de chiffre d\'affaires (12 premiers mois)</span><div class="grid-3" style="grid-template-columns:repeat(4,minmax(0,1fr));gap:6px">' + (S.forecast || []).map((v, i) => '<label class="field"><span class="small muted" style="font-weight:500">' + esc(PC.fmtMonth(PC.addMonths(S.start_month, i), true)) + '</span><input type="number" step="25" min="0" name="fc_' + i + '" value="' + v + '" style="min-height:38px;padding:6px 8px"></label>').join('') + '</div></div>' +
      '</div></form>';
    // Données
    h += '<div class="card"><div class="card-head"><h2>Données et affichage</h2></div><div class="stack">' +
      '<div class="row wrap"><span class="label" style="margin:0">Thème</span><div class="seg" role="group">' + [['auto', 'Automatique'], ['light', 'Clair'], ['dark', 'Sombre']].map(([k, l]) => '<button data-act="theme" data-id="' + k + '" aria-pressed="' + ((document.documentElement.dataset.theme || 'auto') === k) + '">' + l + '</button>').join('') + '</div></div>' +
      '<p class="small muted">' + (store.mode === 'local' ? 'Mode démo : les données sont enregistrées dans ce navigateur uniquement. Branche la base Supabase (fichier assets/config.js) pour recevoir les réservations des clients.' : 'Données enregistrées dans la base Supabase de Presso Center.') + '</p>' +
      '<div class="row wrap"><button class="btn sm soft" data-act="backup">' + I('download') + 'Sauvegarde complète (JSON)</button>' +
      (store.mode === 'local' ? '<label class="btn sm soft">' + I('upload') + 'Restaurer<input type="file" accept="application/json" id="restore" class="sr-only"></label><button class="btn sm danger" data-act="reset-demo">Réinitialiser la démo</button>' : '<button class="btn sm ghost" data-act="logout">' + I('logout') + 'Se déconnecter</button>') + '</div></div></div>';
    h += '</div></div>';
    return h;
  }
  function winRow(day, i, w) {
    return '<div class="win-edit"><input type="time" step="900" name="h_' + day + '_' + i + '_a" value="' + esc(w[0]) + '" aria-label="Début"><span>→</span><input type="time" step="900" name="h_' + day + '_' + i + '_b" value="' + esc(w[1]) + '" aria-label="Fin"><button type="button" class="btn icon sm ghost" data-act="del-window" aria-label="Retirer la plage">' + I('x') + '</button></div>';
  }

  function bindSettings() {
    const qrEl = $('#qr');
    if (qrEl && window.qrcode) {
      const q = window.qrcode(0, 'M');
      q.addData(bookingUrl());
      q.make();
      qrEl.innerHTML = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
    }
    const on = (id, fn) => {
      const f = $('#' + id);
      if (f) f.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(f);
        const next = JSON.parse(JSON.stringify(S));
        fn(fd, next, f);
        run(() => saveSettings(next), 'Réglages enregistrés');
      });
    };
    on('set-contact', (fd, n) => ['business_name', 'owner_name', 'phone', 'email', 'base_location'].forEach((k) => (n[k] = String(fd.get(k) || '').trim())));
    on('set-hours', (fd, n, f) => {
      const hours = {};
      $$('[data-day]', f).forEach((el) => {
        const k = el.dataset.day;
        const wins = $$('.win-edit', el).map((row) => {
          const ins = $$('input', row);
          return [ins[0].value, ins[1].value];
        }).filter(([a, b]) => a && b && a < b);
        if (wins.length) hours[k] = wins;
      });
      n.hours = hours;
      ['min_notice_hours', 'max_days_ahead', 'slot_step', 'rotation_min', 'travel_min', 'weekly_hours_cap'].forEach((k) => (n[k] = Number(fd.get(k)) || 0));
      n.slot_step = Math.max(5, n.slot_step);
      n.max_days_ahead = Math.max(1, n.max_days_ahead);
    });
    on('set-prices', (fd, n) => {
      n.services.forEach((s, i) => {
        s.duration = Number(fd.get('svc_d_' + i)) || s.duration;
        s.price = Number(fd.get('svc_p_' + i));
        s.online = !!fd.get('svc_o_' + i);
      });
      (n.packs || []).forEach((p, i) => (p.price = Number(fd.get('pack_p_' + i))));
      n.club_plans.forEach((p, i) => (p.price = Number(fd.get('plan_p_' + i))));
    });
    on('set-finance', (fd, n) => {
      n.start_month = fd.get('start_month') || n.start_month;
      n.social_rate = (Number(fd.get('social_rate')) || 0) / 100;
      n.opening_cash = Number(fd.get('opening_cash')) || 0;
      n.vat_threshold = Number(fd.get('vat_threshold')) || 0;
      n.break_even = Number(fd.get('break_even')) || 0;
      n.loan = Object.assign({}, n.loan, { monthly: Number(fd.get('loan_monthly')) || 0, amount: Number(fd.get('loan_amount')) || 0, deferral_months: Number(fd.get('loan_deferral')) || 0, payments: Number(fd.get('loan_payments')) || 0 });
      n.monthly_charges.forEach((c, i) => {
        c.label = String(fd.get('ch_l_' + i) || c.label);
        c.amount = Number(fd.get('ch_a_' + i)) || 0;
      });
      n.forecast = n.forecast.map((v, i) => Number(fd.get('fc_' + i)) || 0);
    });
    const rs = $('#restore');
    if (rs) rs.addEventListener('change', async () => {
      const file = rs.files[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (!data || !Array.isArray(data.bookings)) throw new Error('Fichier non reconnu');
        await store.importAll(data);
        await load();
        PC.toast('Sauvegarde restaurée');
        render();
      } catch (e) {
        PC.toast(e.message, 'bad');
      }
    });
  }

  /* =================================================================
     Fenêtre modale
     ================================================================= */
  function modal({ title, body, foot, wide }) {
    const dlg = $('#modal');
    dlg.className = 'modal' + (wide ? ' wide' : '');
    dlg.innerHTML = '<div class="modal-head"><h2>' + esc(title) + '</h2><button class="btn icon sm ghost" data-close aria-label="Fermer">' + I('x') + '</button></div><div class="modal-body">' + body + '</div>' + (foot ? '<div class="modal-foot">' + foot + '</div>' : '');
    if (!dlg.open) dlg.showModal();
    dlg.scrollTop = 0;
    return dlg;
  }
  function closeModal() {
    const dlg = $('#modal');
    if (dlg && dlg.open) dlg.close();
  }

  /* =================================================================
     Événements
     ================================================================= */
  function afterRender() {
    if (UI.view === 'finances' && !UI.showTable) bindChart();
    if (UI.view === 'reglages') bindSettings();
    const search = $('#client-search');
    if (search) {
      search.addEventListener('input', () => {
        UI.search = search.value;
        const pos = search.selectionStart;
        render();
        const s2 = $('#client-search');
        s2.focus();
        s2.setSelectionRange(pos, pos);
      });
    }
  }

  async function onClick(e) {
    const dlg = $('#modal');
    if (e.target === dlg) return closeModal();
    if (e.target.closest('[data-close]')) return closeModal();
    const nav = e.target.closest('[data-nav]');
    if (nav) return go(nav.dataset.nav);
    const col = e.target.classList && e.target.classList.contains('cal-col') ? e.target : null;
    if (col) {
      const cal = col.closest('.cal');
      const PX = Number(cal.dataset.px);
      const startMin = Number(cal.dataset.start);
      const y = e.clientY - col.getBoundingClientRect().top;
      const mins = Math.round((startMin + y / PX) / 15) * 15;
      const d = PC.parseYmd(col.dataset.day);
      const t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(mins / 60), mins % 60);
      return editBooking(null, { date: col.dataset.day, time: PC.hhmm(t) });
    }
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    const id = el.dataset.id;
    switch (act) {
      case 'nav': return go(id);
      case 'new-booking': return editBooking(null);
      case 'new-booking-for': {
        const c = clientById(id);
        return editBooking(null, { client_id: id, client_name: c ? c.name : '' });
      }
      case 'new-club-slot': {
        const p = partnerById(id);
        return editBooking(null, { kind: 'club', partner_id: id, duration_min: 90, price: 0, boots: capacity() || 5, location: p ? p.location || '' : '', time: '19:00' });
      }
      case 'open-booking': return openBooking(id);
      case 'edit-booking': return editBooking(id);
      case 'confirm-booking': return setStatus(id, 'confirmee', 'Séance confirmée');
      case 'cancel-booking': {
        const b = D.bookings.find((x) => x.id === id);
        if (!window.confirm(b.status === 'demande' ? 'Refuser cette demande ?' : 'Annuler cette séance ?')) return;
        return setStatus(id, 'annulee', b.status === 'demande' ? 'Demande refusée' : 'Séance annulée');
      }
      case 'absent-booking': return setStatus(id, 'absent', 'Marqué absent');
      case 'restore-booking': return setStatus(id, 'confirmee', 'Séance rétablie');
      case 'close-booking': return closeBookingDialog(id);
      case 'pay-booking': return payDialog(id);
      case 'delete-booking': {
        if (!window.confirm('Supprimer définitivement ?')) return;
        return run(async () => {
          for (const t of D.transactions.filter((x) => x.booking_id === id)) await remove('transactions', t.id);
          await remove('bookings', id);
          closeModal();
        }, 'Supprimé');
      }
      case 'week': {
        const d = Number(el.dataset.d);
        if (d === 0) {
          UI.week = PC.startOfWeek(new Date());
          UI.day = PC.startOfDay(new Date());
        } else {
          UI.week = PC.addDays(UI.week, 7 * d);
          UI.day = PC.addDays(UI.day, 7 * d);
        }
        return render();
      }
      case 'cal-day':
        UI.day = PC.parseYmd(el.dataset.d);
        return render();
      case 'clients-tab':
        UI.clientsTab = id;
        return render();
      case 'new-client': return openClient(null);
      case 'open-client': return openClient(id);
      case 'delete-client': {
        if (!window.confirm('Supprimer ce client ? Ses séances restent dans l\'agenda.')) return;
        return run(async () => {
          await remove('clients', id);
          D.bookings.forEach((b) => { if (b.client_id === id) b.client_id = null; });
          closeModal();
        }, 'Client supprimé');
      }
      case 'sell-pack': return sellPack(id, el.dataset.pack);
      case 'new-partner': return openPartner(null);
      case 'open-partner': return openPartner(id);
      case 'delete-partner': {
        if (!window.confirm('Supprimer ce partenaire ?')) return;
        return run(async () => {
          await remove('partners', id);
          closeModal();
        }, 'Partenaire supprimé');
      }
      case 'bill-partner': return billPartner(id);
      case 'report-partner': return partnerReport(id);
      case 'report-month': return partnerReport(id, el.dataset.d);
      case 'print-report': return printReport(id, el.dataset.d);
      case 'month': {
        UI.month = PC.addMonths(UI.month, Number(el.dataset.d));
        return render();
      }
      case 'goto-month':
        UI.month = id;
        return render();
      case 'toggle-table':
        UI.showTable = !UI.showTable;
        return render();
      case 'tx-filter':
        UI.txFilter = id;
        return render();
      case 'new-tx': return editTx(null, id);
      case 'edit-tx': return editTx(id);
      case 'delete-tx': {
        if (!window.confirm('Supprimer cette opération ?')) return;
        return run(async () => {
          const t = D.transactions.find((x) => x.id === id);
          await remove('transactions', id);
          if (t && t.booking_id) {
            const b = D.bookings.find((x) => x.id === t.booking_id);
            if (b && b.paid) await patch('bookings', b.id, { paid: false });
          }
          closeModal();
        }, 'Opération supprimée');
      }
      case 'add-charges': return addCharges();
      case 'add-adie': return addAdie();
      case 'export-livre': return exportLivre();
      case 'export-all': return exportAll();
      case 'new-check': return newCheck();
      case 'open-check': return newCheck(id);
      case 'delete-check': {
        if (!window.confirm('Supprimer ce contrôle ?')) return;
        return run(async () => {
          await remove('checks', id);
          closeModal();
        }, 'Contrôle supprimé');
      }
      case 'new-equipment': return openEquipment(null, id);
      case 'open-equipment': return openEquipment(id);
      case 'delete-equipment': {
        if (!window.confirm('Supprimer ce matériel ? (Pour une botte hors service, préfère l\'état « Retirée ».)')) return;
        return run(async () => {
          await remove('equipment', id);
          closeModal();
        }, 'Matériel supprimé');
      }
      case 'new-stock': return editStock(null);
      case 'edit-stock': return editStock(id);
      case 'delete-stock': {
        if (!window.confirm('Supprimer cet article ?')) return;
        return run(async () => {
          await remove('stock', id);
          closeModal();
        }, 'Article supprimé');
      }
      case 'stock-step': {
        const s = D.stock.find((x) => x.id === id);
        return run(() => patch('stock', id, { qty: Math.max(0, PC.round2(Number(s.qty) + Number(el.dataset.d))) }));
      }
      case 'add-window': {
        const box = el.parentElement;
        const i = $$('.win-edit', box).length;
        el.insertAdjacentHTML('beforebegin', winRow(id, i, ['18:00', '21:00']));
        return undefined;
      }
      case 'del-window':
        el.closest('.win-edit').remove();
        return undefined;
      case 'copy-link':
        try {
          await navigator.clipboard.writeText(bookingUrl());
          PC.toast('Lien copié');
        } catch (err) {
          window.prompt('Copie ce lien :', bookingUrl());
        }
        return undefined;
      case 'dl-qr': {
        const q = window.qrcode(0, 'M');
        q.addData(bookingUrl());
        q.make();
        const svg = q.createSvgTag({ cellSize: 10, margin: 4, scalable: false }).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
        return PC.download('presso-center-qr.svg', svg, 'image/svg+xml');
      }
      case 'theme': {
        try {
          if (id === 'auto') localStorage.removeItem('presso.theme');
          else localStorage.setItem('presso.theme', id);
        } catch (err) { /* stockage indisponible */ }
        if (id === 'auto') delete document.documentElement.dataset.theme;
        else document.documentElement.dataset.theme = id;
        return render();
      }
      case 'backup': {
        const data = await store.exportAll();
        return PC.download('presso-center-sauvegarde-' + PC.ymd(new Date()) + '.json', JSON.stringify(data, null, 2), 'application/json');
      }
      case 'reset-demo': {
        if (!window.confirm('Remettre les données de démonstration ? Tout ce que tu as saisi dans ce navigateur sera effacé.')) return;
        await store.reset();
        await load();
        PC.toast('Démo réinitialisée');
        return render();
      }
      case 'logout':
        await store.signOut();
        return location.reload();
      default:
        return undefined;
    }
  }

  document.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[role="button"][data-act]')) {
      e.preventDefault();
      e.target.click();
    }
  });

  boot();
})();
