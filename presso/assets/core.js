/* Presso Center — noyau partagé : catalogue, règles de réservation, outils, données.
   Utilisé par la page client (index.html) et l'espace de gestion (gestion.html). */
(function () {
  'use strict';
  const PC = (window.PC = window.PC || {});

  /* ------------------------------------------------------------------
     Catalogue et paramètres par défaut (repris du business plan, nov. 2026)
     ------------------------------------------------------------------ */
  PC.DEFAULT_SETTINGS = {
    business_name: 'Presso Center',
    owner_name: 'Chris',
    phone: '',
    email: '',
    city: 'Tours',
    base_location: 'Lieu précisé à la confirmation (Tours Métropole)',
    // Créneaux ouverts à la réservation en ligne (0 = dimanche … 6 = samedi).
    // Semaine type du plan : lundi soir et dimanche pour les séances individuelles,
    // mercredi, vendredi et samedi réservés aux clubs, coachs et événements.
    hours: {
      '1': [['18:00', '21:30']],
      '0': [['14:00', '19:00']]
    },
    slot_step: 15,
    rotation_min: 5,
    travel_min: 30,
    min_notice_hours: 12,
    max_days_ahead: 28,
    weekly_hours_cap: 16,
    services: [
      { code: 'express', name: 'Récup Express', duration: 30, price: 20, kind: 'seance', online: true, desc: 'Découverte, après une séance' },
      { code: 'plus', name: 'Récup+', duration: 45, price: 30, kind: 'seance', online: true, desc: 'Entraînements intenses, semaine chargée' },
      { code: 'integrale', name: 'Récup Intégrale', duration: 60, price: 35, kind: 'seance', online: true, desc: 'Après une compétition' },
      { code: 'domicile', name: 'À domicile', duration: 60, price: 50, kind: 'domicile', online: true, desc: 'Tours Métropole, déplacement inclus' },
      { code: 'duo', name: 'Duo ou équipe', duration: 45, price: 25, kind: 'seance', per_person: true, min_people: 2, max_people: 5, online: true, desc: 'Amis, petites équipes, 2 à 5 personnes' }
    ],
    packs: [
      { code: 'carte10', name: 'Carte 10 séances', price: 170, credits: 10, desc: '10 × 30 min, soit 17 € la séance' },
      { code: 'abonnement', name: 'Abonnement mensuel', price: 100, credits: 4, desc: '4 × 45 min par mois' }
    ],
    club_plans: [
      { code: 'starter', name: 'Starter', price: 250, passages: 30, target: 'Petit club, 1 à 2 équipes', desc: "2 créneaux d'1h30 par mois, environ 30 passages" },
      { code: 'club', name: 'Club', price: 450, passages: 60, target: 'Club de taille moyenne', desc: '1 créneau par semaine, environ 60 passages' },
      { code: 'performance', name: 'Performance', price: 800, passages: 120, target: 'Grand club, plusieurs équipes', desc: '2 créneaux par semaine, environ 120 passages' },
      { code: 'elite', name: 'Elite', price: 1000, passages: 160, target: 'Club régional, plusieurs équipes', desc: '2 créneaux par semaine + 2 jours de match, priorité, environ 160 passages' }
    ],
    club_options: [
      { name: "Créneau supplémentaire d'1h30", price: 120 },
      { name: 'Événement ou tournoi, demi-journée de 4 h', price: 300 },
      { name: "Passage d'un licencié hors forfait", price: 10 },
      { name: 'Déplacement au-delà de 20 km', price: 15 }
    ],
    season_discount: 0.10,
    // Finances
    start_month: '2027-01',
    social_rate: 0.16,
    vat_threshold: 37500,
    opening_cash: 500,
    break_even: 550,
    monthly_charges: [
      { label: 'Déplacements (carburant)', category: 'deplacement', amount: 100 },
      { label: 'Hygiène (sous-bottes, désinfectant)', category: 'hygiene', amount: 65 },
      { label: 'Communication', category: 'communication', amount: 50 },
      { label: 'Banque et divers', category: 'banque', amount: 30 },
      { label: 'Outils numériques', category: 'outils', amount: 20 }
    ],
    loan: { amount: 6000, monthly: 209, deferral_months: 3, payments: 33, contribution: 360 },
    forecast: [1000, 1700, 2275, 2700, 3075, 3500, 2675, 2000, 3500, 3700, 4000, 3575]
  };

  PC.CONTRAINDICATIONS = [
    'Phlébite, thrombose veineuse ou embolie (actuelle ou récente)',
    'Insuffisance cardiaque ou trouble cardiaque sévère',
    'Hypertension non contrôlée',
    'Plaie ouverte, infection ou eczéma aux jambes',
    'Fracture ou blessure récente non consolidée aux jambes',
    'Grossesse',
    'Cancer en cours de traitement',
    'Diabète avec troubles de la circulation ou de la sensibilité'
  ];

  PC.KINDS = {
    seance: { label: 'Séance', exclusive: false },
    domicile: { label: 'À domicile', exclusive: true },
    club: { label: 'Créneau club', exclusive: true },
    evenement: { label: 'Événement', exclusive: true },
    indispo: { label: 'Indisponible', exclusive: true }
  };

  PC.STATUSES = {
    demande: 'À confirmer',
    confirmee: 'Confirmée',
    terminee: 'Terminée',
    annulee: 'Annulée',
    absent: 'Absent'
  };

  PC.PARTNER_STATUSES = {
    demande: 'Demande reçue',
    prospect: 'À contacter',
    discussion: 'En discussion',
    accord: 'Accord / intérêt',
    pilote: 'Test pilote',
    contrat: 'Sous contrat',
    pause: 'En pause',
    perdu: 'Perdu'
  };
  PC.PARTNER_KINDS = { club: 'Club', coach: 'Coach', communaute: 'Communauté', organisme: 'Organisme', autre: 'Autre' };

  PC.INCOME_CATS = {
    seance: 'Séance individuelle',
    carte: 'Carte 10 séances',
    abonnement: 'Abonnement mensuel',
    forfait_club: 'Forfait club',
    evenement: 'Événement',
    vente: 'Vente de bottes',
    autre: 'Autre recette'
  };
  PC.EXPENSE_CATS = {
    deplacement: 'Déplacements',
    hygiene: 'Hygiène',
    communication: 'Communication',
    banque: 'Banque et divers',
    outils: 'Outils numériques',
    materiel: 'Matériel',
    assurance: 'Assurance',
    adie: 'Mensualité Adie',
    cotisations: 'Cotisations URSSAF',
    remuneration: 'Ma rémunération',
    autre: 'Autre dépense'
  };
  // Regroupement des recettes par activité (comme le prévisionnel)
  PC.ACTIVITIES = [
    { key: 'clubs', label: 'Forfaits clubs', cats: ['forfait_club'] },
    { key: 'seances', label: 'Séances individuelles', cats: ['seance', 'carte', 'abonnement'] },
    { key: 'evenements', label: 'Événements', cats: ['evenement'] },
    { key: 'ventes', label: 'Ventes et autres', cats: ['vente', 'autre'] }
  ];
  PC.PAY_METHODS = { cb: 'Carte bancaire', especes: 'Espèces', virement: 'Virement', lydia: 'Lydia / Wero', cheque: 'Chèque' };
  PC.EQUIP_STATUSES = { ok: 'Opérationnelle', a_verifier: 'À vérifier', panne: 'En panne', reparation: 'En réparation', prevue: 'Pas encore reçue', retiree: 'Retirée' };
  PC.CHECK_ITEMS = ['Batterie chargée', 'Tuyaux et raccords', 'Chambres étanches (test de gonflage)', 'Bottes nettoyées et désinfectées'];

  // Colonnes de chaque table (Supabase n'accepte que ces champs)
  PC.SCHEMA = {
    clients: ['id', 'name', 'phone', 'email', 'sport', 'kind', 'is_minor', 'guardian_name', 'health_ok', 'waiver_signed', 'credits', 'notes', 'created_at'],
    partners: ['id', 'name', 'kind', 'sport', 'contact_name', 'phone', 'email', 'location', 'status', 'plan', 'monthly_price', 'season_commitment', 'pilot_start', 'pilot_end', 'slot_info', 'notes', 'created_at'],
    bookings: ['id', 'ref', 'kind', 'service', 'start_at', 'duration_min', 'boots', 'people', 'status', 'client_id', 'partner_id', 'client_name', 'client_phone', 'client_email', 'address', 'location', 'price', 'paid', 'pay_method', 'payment_mode', 'passages', 'source', 'health_ack', 'is_minor', 'guardian_name', 'title', 'notes', 'created_at'],
    transactions: ['id', 'date', 'type', 'category', 'label', 'amount', 'method', 'booking_id', 'partner_id', 'client_id', 'created_at'],
    equipment: ['id', 'name', 'kind', 'model', 'serial', 'size', 'purchase_date', 'purchase_price', 'status', 'last_check', 'notes', 'created_at'],
    stock: ['id', 'name', 'unit', 'qty', 'min_qty', 'per_passage', 'unit_cost', 'notes', 'created_at'],
    checks: ['id', 'date', 'items', 'ok', 'notes', 'created_at']
  };
  PC.TABLES = Object.keys(PC.SCHEMA);

  /* ------------------------------------------------------------------
     Outils
     ------------------------------------------------------------------ */
  PC.esc = function (v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  };
  PC.uid = function () {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  };
  PC.makeRef = function () {
    const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 5; i++) s += a[Math.floor(Math.random() * a.length)];
    return 'PC-' + s;
  };
  PC.round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

  const eur0 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const eur2 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  PC.eur = function (n) {
    n = Number(n) || 0;
    return Math.abs(n % 1) > 0.004 ? eur2.format(n) : eur0.format(n);
  };
  PC.num = (n, d = 0) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: d }).format(Number(n) || 0);

  PC.pad = (n) => String(n).padStart(2, '0');
  PC.ymd = (d) => d.getFullYear() + '-' + PC.pad(d.getMonth() + 1) + '-' + PC.pad(d.getDate());
  PC.monthKey = (d) => d.getFullYear() + '-' + PC.pad(d.getMonth() + 1);
  PC.parseYmd = function (s) {
    const [y, m, d] = String(s).split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  };
  PC.startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  PC.addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());
  PC.addMinutes = (d, n) => new Date(d.getTime() + n * 60000);
  PC.addMonths = function (key, n) {
    const [y, m] = key.split('-').map(Number);
    const d = new Date(y, m - 1 + n, 1);
    return PC.monthKey(d);
  };
  PC.startOfWeek = function (d) {
    const x = PC.startOfDay(d);
    const dow = (x.getDay() + 6) % 7; // lundi = 0
    return PC.addDays(x, -dow);
  };
  PC.atTime = function (day, hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m || 0);
  };
  PC.hhmm = (d) => PC.pad(d.getHours()) + ':' + PC.pad(d.getMinutes());
  PC.fmtTime = (d) => PC.pad(d.getHours()) + 'h' + PC.pad(d.getMinutes());
  PC.fmtDay = (d, opts) => d.toLocaleDateString('fr-FR', opts || { weekday: 'short', day: 'numeric', month: 'short' });
  PC.fmtDayLong = (d) => d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  PC.fmtDate = (s) => (s ? PC.parseYmd(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
  PC.fmtMonth = function (key, short) {
    const [y, m] = key.split('-').map(Number);
    const s = new Date(y, m - 1, 1).toLocaleDateString('fr-FR', short ? { month: 'short' } : { month: 'long', year: 'numeric' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  PC.capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  PC.durationLabel = function (min) {
    const h = Math.floor(min / 60), m = min % 60;
    if (!h) return m + ' min';
    return h + ' h' + (m ? ' ' + PC.pad(m) : '');
  };
  PC.cleanPhone = (p) => String(p || '').replace(/[^0-9+]/g, '');
  PC.waNumber = function (p) {
    let n = PC.cleanPhone(p).replace(/^\+/, '');
    if (n.startsWith('00')) n = n.slice(2);
    if (n.startsWith('0') && n.length === 10) n = '33' + n.slice(1);
    return n;
  };
  PC.waLink = function (phone, text) {
    const n = PC.waNumber(phone);
    return 'https://wa.me/' + n + (text ? '?text=' + encodeURIComponent(text) : '');
  };

  PC.service = (s, code) => (s.services || []).find((x) => x.code === code);
  PC.clubPlan = (s, code) => (s.club_plans || []).find((x) => x.code === code);
  PC.mergeSettings = function (data) {
    const d = JSON.parse(JSON.stringify(PC.DEFAULT_SETTINGS));
    return Object.assign(d, data || {});
  };

  /* ------------------------------------------------------------------
     Règles d'agenda et de capacité
     - une séance occupe 1 botte par personne, plus 5 min de rotation ;
     - à domicile, en club, en événement ou indisponible : le praticien est pris
       entièrement (trajet compris pour le domicile).
     ------------------------------------------------------------------ */
  PC.isActive = (b) => b.status === 'demande' || b.status === 'confirmee';
  PC.isExclusive = (kind) => kind !== 'seance';
  PC.occupancy = function (b, s) {
    const st = new Date(b.start_at).getTime();
    let a = st, z = st + (Number(b.duration_min) || 0) * 60000;
    if (b.kind === 'seance') z += (Number(s.rotation_min) || 0) * 60000;
    if (b.kind === 'domicile') {
      a -= (Number(s.travel_min) || 0) * 60000;
      z += (Number(s.travel_min) || 0) * 60000;
    }
    return [a, z];
  };
  PC.capacity = (equipment) => (equipment || []).filter((e) => (e.kind || 'botte') === 'botte' && e.status === 'ok').length;

  // busy : réservations actives {start_at, duration_min, kind, boots}
  PC.checkSlot = function (req, busy, s, capacity, ignoreId) {
    const [a, z] = PC.occupancy(req, s);
    let used = 0;
    for (const b of busy) {
      if (ignoreId && b.id === ignoreId) continue;
      const [ba, bz] = PC.occupancy(b, s);
      if (ba < z && bz > a) {
        if (req.kind !== 'seance' || b.kind !== 'seance') return { ok: false, reason: 'conflict', with: b };
        used += Number(b.boots) || 1;
      }
    }
    const need = req.kind === 'seance' || req.kind === 'domicile' ? Number(req.boots) || 1 : 0;
    if (need && used + need > capacity) return { ok: false, reason: 'full', free: Math.max(0, capacity - used) };
    return { ok: true, free: capacity - used - (req.kind === 'seance' ? need : 0) };
  };

  PC.windowsFor = function (day, s) {
    const w = (s.hours || {})[String(day.getDay())] || [];
    return w.filter((x) => x && x[0] && x[1]).map(([a, b]) => [PC.atTime(day, a), PC.atTime(day, b)]);
  };

  PC.reqFromService = function (svc, people) {
    const per = !!svc.per_person;
    const n = per ? Math.max(svc.min_people || 1, Math.min(Number(people) || 1, svc.max_people || 5)) : 1;
    return {
      kind: svc.kind === 'domicile' ? 'domicile' : 'seance',
      duration_min: Number(svc.duration),
      boots: n,
      people: n,
      price: PC.round2(Number(svc.price) * (per ? n : 1))
    };
  };

  PC.slotsForDay = function (day, svc, people, busy, s, capacity, now) {
    const out = [];
    const r = PC.reqFromService(svc, people);
    const step = Math.max(5, Number(s.slot_step) || 15) * 60000;
    const minStart = (now || new Date()).getTime() + (Number(s.min_notice_hours) || 0) * 3600000;
    for (const [ws, we] of PC.windowsFor(day, s)) {
      for (let t = ws.getTime(); t + r.duration_min * 60000 <= we.getTime(); t += step) {
        if (t < minStart) continue;
        const res = PC.checkSlot({ start_at: new Date(t).toISOString(), duration_min: r.duration_min, kind: r.kind, boots: r.boots }, busy, s, capacity);
        if (res.ok) out.push({ start: new Date(t), free: res.free });
      }
    }
    return out;
  };

  PC.inWindows = function (start, duration, s) {
    const end = PC.addMinutes(start, duration);
    if (PC.ymd(end) !== PC.ymd(start) && !(end.getHours() === 0 && end.getMinutes() === 0)) return false;
    return PC.windowsFor(start, s).some(([a, b]) => start >= a && end <= b);
  };

  // Validation d'une demande client (miroir de la fonction SQL public.book)
  PC.validateRequest = function (p, s, busy, capacity, now) {
    now = now || new Date();
    const svc = PC.service(s, p.service);
    if (!svc || svc.online === false) return { error: 'Formule inconnue.' };
    const name = String(p.name || '').trim();
    const phone = PC.cleanPhone(p.phone);
    if (name.length < 2 || phone.replace('+', '').length < 8) return { error: 'Nom et téléphone obligatoires.' };
    if (!p.health_ack) return { error: 'Merci de valider le questionnaire de santé.' };
    if (p.is_minor && String(p.guardian_name || '').trim().length < 2) return { error: "L'autorisation d'un parent est obligatoire pour un mineur." };
    const r = PC.reqFromService(svc, p.people);
    if (r.kind === 'domicile' && String(p.address || '').trim().length < 5) return { error: "L'adresse est obligatoire pour une séance à domicile." };
    const start = new Date(p.start_at);
    if (isNaN(start)) return { error: 'Créneau invalide.' };
    if (start.getTime() < now.getTime() + (Number(s.min_notice_hours) || 0) * 3600000) return { error: 'Ce créneau est trop proche, choisis-en un autre.' };
    if (start.getTime() > now.getTime() + ((Number(s.max_days_ahead) || 28) + 1) * 86400000) return { error: 'Ce créneau est trop loin.' };
    if (!PC.inWindows(start, r.duration_min, s)) return { error: "Ce créneau n'est pas ouvert à la réservation." };
    const chk = PC.checkSlot({ start_at: start.toISOString(), duration_min: r.duration_min, kind: r.kind, boots: r.boots }, busy, s, capacity);
    if (!chk.ok) return { error: "Ce créneau vient d'être pris, choisis-en un autre." };
    return {
      booking: {
        kind: r.kind,
        service: svc.code,
        start_at: start.toISOString(),
        duration_min: r.duration_min,
        boots: r.boots,
        people: r.people,
        price: r.price,
        status: 'demande',
        source: 'en_ligne',
        client_name: name,
        client_phone: phone,
        client_email: String(p.email || '').trim() || null,
        address: r.kind === 'domicile' ? String(p.address || '').trim() : null,
        notes: String(p.notes || '').trim() || null,
        health_ack: true,
        is_minor: !!p.is_minor,
        guardian_name: p.is_minor ? String(p.guardian_name || '').trim() : null,
        payment_mode: p.payment_mode === 'credit' ? 'credit' : 'unitaire'
      },
      sport: String(p.sport || '').trim() || null
    };
  };

  PC.publicSubset = function (s, capacity) {
    const keys = ['business_name', 'phone', 'email', 'city', 'base_location', 'hours', 'slot_step', 'rotation_min', 'travel_min', 'min_notice_hours', 'max_days_ahead', 'services', 'packs', 'club_plans', 'club_options', 'season_discount'];
    const o = {};
    keys.forEach((k) => (o[k] = s[k]));
    o.capacity = capacity;
    return o;
  };

  // Fichier .ics pour ajouter la séance à son agenda
  PC.ics = function ({ title, start, minutes, location, description }) {
    const f = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const end = PC.addMinutes(start, minutes);
    const clean = (t) => String(t || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
    return [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Presso Center//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT', 'UID:' + PC.uid() + '@presso-center', 'DTSTAMP:' + f(new Date()), 'DTSTART:' + f(start), 'DTEND:' + f(end),
      'SUMMARY:' + clean(title), 'LOCATION:' + clean(location), 'DESCRIPTION:' + clean(description),
      'END:VEVENT', 'END:VCALENDAR'
    ].join('\r\n');
  };
  PC.download = function (filename, content, type) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: type || 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
  };
  PC.csv = function (rows) {
    const cell = (v) => {
      const s = v == null ? '' : String(v);
      return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    return '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n');
  };

  /* ------------------------------------------------------------------
     Icônes (traits, 24 × 24)
     ------------------------------------------------------------------ */
  const ICONS = {
    home: '<path d="M3 10l9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    euro: '<path d="M18 7.5A7 7 0 1 0 18 16.5"/><path d="M4 10h9M4 14h9"/>',
    box: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.3 7L12 12l8.7-5M12 22V12"/>',
    sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    left: '<path d="M15 18l-6-6 6-6"/>',
    right: '<path d="M9 18l6-6-6-6"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    x: '<path d="M18 6L6 18M6 6l12 12"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
    message: '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/>',
    alert: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5M12 3v12"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6M10 14L21 3"/>',
    trash: '<path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    printer: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/>',
    zap: '<path d="M13 2L3 14h9l-1 8 10-12h-9z"/>',
    tool: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z"/>',
    menu: '<path d="M3 12h18M3 6h18M3 18h18"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>',
    star: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>'
  };
  PC.icon = function (name, cls) {
    return '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
  };

  PC.toast = function (msg, kind) {
    let box = document.getElementById('toasts');
    if (!box) {
      box = document.createElement('div');
      box.id = 'toasts';
      box.setAttribute('role', 'status');
      box.setAttribute('aria-live', 'polite');
      document.body.appendChild(box);
    }
    const t = document.createElement('div');
    t.className = 'toast' + (kind ? ' toast-' + kind : '');
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => t.classList.add('out'), 3200);
    setTimeout(() => t.remove(), 3700);
  };

  /* ------------------------------------------------------------------
     Données de démonstration (mode local uniquement)
     ------------------------------------------------------------------ */
  function rng(seed) {
    let x = seed >>> 0;
    return () => {
      x ^= x << 13; x >>>= 0;
      x ^= x >> 17;
      x ^= x << 5; x >>>= 0;
      return x / 4294967296;
    };
  }

  PC.demoData = function (now) {
    now = now || new Date();
    const R = rng(20270101);
    const pick = (arr) => arr[Math.floor(R() * arr.length)];
    const startKey = PC.addMonths(PC.monthKey(now), -3);
    const startDate = PC.parseYmd(startKey + '-01');
    const iso = () => new Date(startDate.getTime() - 86400000 * 3).toISOString();
    const s = PC.mergeSettings({ start_month: startKey, phone: '06 00 00 00 00', email: 'contact@presso-center.fr' });

    const equipment = [];
    for (let i = 1; i <= 5; i++) {
      equipment.push({ id: PC.uid(), name: 'Botte ' + i, kind: 'botte', model: 'Bootech BT-PRO 8.0', serial: 'BT8-' + (24100 + i * 7), size: 'M/L', purchase_date: PC.ymd(PC.addDays(startDate, -6)), purchase_price: 699, status: 'ok', last_check: PC.ymd(PC.addDays(now, -8)), notes: '', created_at: iso() });
    }
    equipment[3].status = 'a_verifier';
    equipment[3].notes = 'Raccord de la jambe gauche qui fuit légèrement';
    [['Bottes taille XL (seconde taille)', 'accessoire', 0], ['Sacs de transport (× 5)', 'accessoire', 0], ['Chariot de transport', 'accessoire', 0], ['Tapis et assises', 'accessoire', 0]].forEach(([n, k]) =>
      equipment.push({ id: PC.uid(), name: n, kind: k, model: '', serial: '', size: '', purchase_date: PC.ymd(PC.addDays(startDate, -6)), purchase_price: null, status: 'ok', last_check: null, notes: '', created_at: iso() })
    );

    const stock = [
      { id: PC.uid(), name: 'Sous-bottes à usage unique', unit: 'paires', qty: 0, min_qty: 50, per_passage: 1, unit_cost: 0.45, notes: '', created_at: iso() },
      { id: PC.uid(), name: 'Désinfectant (flacon 500 ml)', unit: 'flacons', qty: 3, min_qty: 2, per_passage: 0.02, unit_cost: 6.5, notes: '', created_at: iso() },
      { id: PC.uid(), name: 'Lingettes désinfectantes', unit: 'boîtes', qty: 1, min_qty: 2, per_passage: 0.01, unit_cost: 5, notes: '', created_at: iso() },
      { id: PC.uid(), name: 'Serviettes', unit: 'pièces', qty: 12, min_qty: 6, per_passage: 0, unit_cost: 4, notes: '', created_at: iso() }
    ];

    const P = (name, kind, sport, status, extra) => Object.assign({ id: PC.uid(), name, kind, sport, contact_name: '', phone: '', email: '', location: '', status, plan: null, monthly_price: null, season_commitment: false, pilot_start: null, pilot_end: null, slot_info: '', notes: '', created_at: iso() }, extra || {});
    const partners = [
      P('JC Touraine', 'club', 'Judo', 'contrat', { plan: 'club', monthly_price: 450, slot_info: 'Vendredi 19h00, dojo', notes: 'Club partenaire historique. Test pilote validé puis passage au forfait Club.' }),
      P('ASAP Run Crew', 'communaute', 'Course à pied', 'pilote', { pilot_start: PC.ymd(PC.addDays(now, -10)), pilot_end: PC.ymd(PC.addDays(now, 11)), slot_info: 'Dimanche après la sortie longue', notes: 'Séance de test proposée à la communauté.' }),
      P('Change by Aida', 'coach', 'Sport-santé, suivi à domicile', 'accord', { notes: 'Intérêt confirmé, démarrage visé en janvier 2027.' }),
      P('Réseau de coachs (4 à 5)', 'coach', 'Préparation physique', 'accord', { notes: 'Accord de collaboration, tarifs préférentiels pour leurs groupes.' }),
      P('Coach indépendant, salle MyGym', 'coach', 'Musculation', 'prospect', { notes: "Partenariat envisagé dès l'ouverture d'un espace d'accueil." }),
      P('Club de football de Saint-Avertin', 'club', 'Football', 'discussion', { notes: 'Prospection via le réseau.' }),
      P('Club de football de La Riche', 'club', 'Football', 'prospect', { notes: 'Prospection via le réseau.' }),
      P('Club de football de Chambray-lès-Tours', 'club', 'Football', 'prospect', { notes: 'Prospection via le réseau.' }),
      P('Club de football de Saint-Cyr-sur-Loire', 'club', 'Football', 'demande', { contact_name: 'Responsable U17', phone: '06 00 00 00 01', notes: 'Demande de test pilote reçue depuis le site.' })
    ];
    const jc = partners[0], asap = partners[1];

    const names = [['Léa M.', 'Handball'], ['Yanis B.', 'Football'], ['Inès K.', 'Course à pied'], ['Thomas R.', 'Rugby'], ['Moussa D.', 'Judo'], ['Camille P.', 'Fitness'], ['Hugo L.', 'Basket'], ['Sarah T.', 'Triathlon'], ['Nathan G.', 'Football'], ['Emma V.', 'Course à pied']];
    const clients = names.map(([n, sp], i) => ({ id: PC.uid(), name: n, phone: '06 00 00 0' + (100 + i), email: '', sport: sp, kind: 'particulier', is_minor: i === 8, guardian_name: i === 8 ? 'Parent de Nathan G.' : null, health_ok: true, waiver_signed: true, credits: {}, notes: '', created_at: iso() }));
    clients[5].credits = { carte10: 6 };
    clients[2].credits = { abonnement: 2 };

    const bookings = [], transactions = [];
    const add = (b) => {
      const full = Object.assign({ id: PC.uid(), ref: PC.makeRef(), kind: 'seance', service: null, boots: 1, people: 1, status: 'confirmee', client_id: null, partner_id: null, client_name: null, client_phone: null, client_email: null, address: null, location: null, price: 0, paid: false, pay_method: null, payment_mode: 'unitaire', passages: null, source: 'manuel', health_ack: true, is_minor: false, guardian_name: null, title: null, notes: null, created_at: iso() }, b);
      bookings.push(full);
      return full;
    };
    const tx = (t) => transactions.push(Object.assign({ id: PC.uid(), method: null, booking_id: null, partner_id: null, client_id: null, created_at: iso() }, t));

    const today = PC.startOfDay(now);
    const methods = ['cb', 'especes', 'lydia', 'cb', 'lydia'];
    for (let d = new Date(startDate); d < PC.addDays(today, 15); d = PC.addDays(d, 1)) {
      const past = d < today;
      const dow = d.getDay();
      const monthIdx = Math.max(0, (d.getFullYear() - startDate.getFullYear()) * 12 + d.getMonth() - startDate.getMonth());
      // créneau club le vendredi (JC Touraine)
      if (dow === 5) {
        const st = PC.atTime(d, '19:00');
        const b = add({ kind: 'club', partner_id: jc.id, title: 'JC Touraine — créneau club', start_at: st.toISOString(), duration_min: 90, boots: 5, people: 15, location: 'Dojo du JC Touraine', status: past ? 'terminee' : 'confirmee', passages: past ? 11 + Math.floor(R() * 5) : null, payment_mode: 'forfait' });
        b.price = 0;
      }
      // pilote ASAP le dimanche matin
      if (dow === 0 && asap.pilot_start && PC.ymd(d) >= asap.pilot_start && PC.ymd(d) <= asap.pilot_end) {
        add({ kind: 'club', partner_id: asap.id, title: 'ASAP Run Crew — pilote', start_at: PC.atTime(d, '10:30').toISOString(), duration_min: 90, boots: 5, people: 15, location: 'Parc de la Gloriette', status: past ? 'terminee' : 'confirmee', passages: past ? 9 : null, payment_mode: 'forfait', price: 0 });
      }
      // séances individuelles sur les créneaux ouverts
      const wins = PC.windowsFor(d, s);
      if (!wins.length) continue;
      const nb = past ? 2 + Math.floor(R() * (3 + monthIdx)) : (R() < 0.7 ? 1 + Math.floor(R() * 2) : 0);
      for (let k = 0; k < nb; k++) {
        const [ws, we] = wins[0];
        const slots = Math.floor((we - ws) / 900000) - 4;
        const st = PC.addMinutes(ws, 15 * Math.floor(R() * Math.max(1, slots)));
        const c = pick(clients);
        const svc = pick(['express', 'express', 'plus', 'integrale', 'plus', 'domicile', 'duo']);
        const sv = PC.service(s, svc);
        const r = PC.reqFromService(sv, svc === 'duo' ? 2 + Math.floor(R() * 2) : 1);
        const busy = bookings.filter((b) => PC.isActive(b) || b.status === 'terminee');
        if (!PC.checkSlot({ start_at: st.toISOString(), duration_min: r.duration_min, kind: r.kind, boots: r.boots }, busy, s, 5).ok) continue;
        if (st.getTime() + r.duration_min * 60000 > we.getTime()) continue;
        const useCredit = !!(c.credits.carte10 && svc === 'express' && R() < 0.5);
        const status = past ? (R() < 0.06 ? 'absent' : 'terminee') : (R() < 0.3 ? 'demande' : 'confirmee');
        const m = pick(methods);
        const b = add({ kind: r.kind, service: svc, start_at: st.toISOString(), duration_min: r.duration_min, boots: r.boots, people: r.people, price: r.price, client_id: c.id, client_name: c.name, client_phone: c.phone, address: r.kind === 'domicile' ? '12 rue Nationale, Tours' : null, status, source: R() < 0.6 ? 'en_ligne' : 'manuel', payment_mode: useCredit ? 'credit' : 'unitaire', paid: status === 'terminee' && !useCredit && R() > 0.04, pay_method: null, passages: status === 'terminee' ? r.people : null });
        if (b.paid) {
          b.pay_method = m;
          tx({ date: PC.ymd(st), type: 'recette', category: 'seance', label: sv.name + ' — ' + c.name, amount: b.price, method: m, booking_id: b.id, client_id: c.id });
        }
      }
    }
    // événement
    const evDay = PC.addDays(today, -20);
    const ev = add({ kind: 'evenement', title: 'Tournoi U15 — espace récupération', start_at: PC.atTime(evDay, '13:00').toISOString(), duration_min: 240, boots: 5, people: 30, partner_id: partners[5].id, status: 'terminee', passages: 34, price: 300, paid: true, pay_method: 'virement', payment_mode: 'unitaire', location: 'Stade de Saint-Avertin' });
    tx({ date: PC.ymd(evDay), type: 'recette', category: 'evenement', label: 'Tournoi U15 — demi-journée', amount: 300, method: 'virement', booking_id: ev.id, partner_id: partners[5].id });
    // indisponibilité (partiels)
    const exam = PC.addDays(today, 6);
    add({ kind: 'indispo', title: 'Partiels', start_at: PC.atTime(exam, '08:00').toISOString(), duration_min: 600, boots: 0, people: 0, status: 'confirmee' });

    // recettes et dépenses mensuelles
    for (let i = 0; i <= 3; i++) {
      const key = PC.addMonths(startKey, i);
      const isCurrent = key === PC.monthKey(now);
      if (i >= 1) tx({ date: key + '-05', type: 'recette', category: 'forfait_club', label: 'Forfait Club — JC Touraine — ' + PC.fmtMonth(key), amount: 450, method: 'virement', partner_id: jc.id });
      if (i === 0) tx({ date: key + '-08', type: 'recette', category: 'forfait_club', label: 'Forfait Starter — JC Touraine (fin du pilote)', amount: 250, method: 'virement', partner_id: jc.id });
      s.monthly_charges.forEach((c, j) => {
        if (isCurrent && j > 1) return;
        tx({ date: key + '-' + PC.pad(3 + j * 4), type: 'depense', category: c.category, label: c.label, amount: c.amount + (j === 0 ? Math.round(R() * 20) - 10 : 0), method: 'cb' });
      });
      if (i === 0) tx({ date: key + '-02', type: 'depense', category: 'adie', label: 'Contribution de solidarité Adie', amount: 360, method: 'virement' });
      if (i === 1) tx({ date: key + '-15', type: 'recette', category: 'carte', label: 'Carte 10 séances — Camille P.', amount: 170, method: 'cb', client_id: clients[5].id });
      if (i === 2) tx({ date: key + '-11', type: 'recette', category: 'abonnement', label: 'Abonnement mensuel — Inès K.', amount: 100, method: 'virement', client_id: clients[2].id });
      if (i === 2) tx({ date: key + '-22', type: 'recette', category: 'vente', label: 'Vente d\'une paire de bottes', amount: 820, method: 'virement' });
      if (i >= 1 && i <= 2) tx({ date: key + '-28', type: 'depense', category: 'cotisations', label: 'Cotisations URSSAF ' + PC.fmtMonth(PC.addMonths(key, -1)), amount: 0, method: 'virement' });
    }
    // compléter les montants URSSAF déclarés (16 % du CA du mois précédent)
    transactions.filter((t) => t.category === 'cotisations').forEach((t) => {
      const prev = PC.addMonths(t.date.slice(0, 7), -1);
      const ca = transactions.filter((x) => x.type === 'recette' && x.date.startsWith(prev)).reduce((a, x) => a + x.amount, 0);
      t.amount = Math.round(ca * s.social_rate);
    });
    // sous-bottes : stock restant
    const used = bookings.filter((b) => b.status === 'terminee').reduce((a, b) => a + (b.passages || b.people || 0), 0);
    stock[0].qty = Math.max(38, 400 - used);

    const checks = [
      { id: PC.uid(), date: PC.ymd(PC.addDays(now, -8)), items: equipment.filter((e) => e.kind === 'botte').map((e) => ({ id: e.id, name: e.name, ok: e.status === 'ok', checks: PC.CHECK_ITEMS.map((c, j) => ({ label: c, ok: !(e.status !== 'ok' && j === 1) })) })), ok: false, notes: 'Botte 4 : raccord à surveiller.', created_at: iso() },
      { id: PC.uid(), date: PC.ymd(PC.addDays(now, -15)), items: [], ok: true, notes: 'RAS', created_at: iso() }
    ];

    return { settings: s, clients, partners, bookings, transactions, equipment, stock, checks };
  };

  /* ------------------------------------------------------------------
     Stockage
     - mode local : tout reste dans ce navigateur (démo, ou usage solo) ;
     - mode Supabase : base partagée, les clients réservent en ligne.
     ------------------------------------------------------------------ */
  const LS_KEY = 'presso.v1';

  function localStore() {
    let db = null;
    const load = () => {
      if (db) return db;
      try {
        db = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
      } catch (e) {
        db = null;
      }
      if (!db) {
        db = PC.demoData();
        save();
      }
      return db;
    };
    const save = () => {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(db));
      } catch (e) {
        console.warn('Sauvegarde locale impossible', e);
      }
    };
    const busyFrom = (d) => d.bookings.filter(PC.isActive).map((b) => ({ id: b.id, start_at: b.start_at, duration_min: b.duration_min, kind: b.kind, boots: b.boots }));
    return {
      mode: 'local',
      async session() {
        return { user: { email: 'mode démo' }, admin: true };
      },
      async loadAll() {
        const d = load();
        const out = { settings: PC.mergeSettings(d.settings) };
        PC.TABLES.forEach((t) => (out[t] = JSON.parse(JSON.stringify(d[t] || []))));
        return out;
      },
      async insert(table, obj) {
        const d = load();
        const row = Object.assign({ id: PC.uid(), created_at: new Date().toISOString() }, obj);
        (d[table] = d[table] || []).push(row);
        save();
        return JSON.parse(JSON.stringify(row));
      },
      async update(table, id, patch) {
        const d = load();
        const row = (d[table] || []).find((r) => r.id === id);
        if (!row) throw new Error('Introuvable');
        Object.assign(row, patch);
        save();
        return JSON.parse(JSON.stringify(row));
      },
      async remove(table, id) {
        const d = load();
        d[table] = (d[table] || []).filter((r) => r.id !== id);
        save();
      },
      async saveSettings(s) {
        const d = load();
        d.settings = JSON.parse(JSON.stringify(s));
        save();
      },
      async publicInfo() {
        const d = load();
        return PC.publicSubset(PC.mergeSettings(d.settings), PC.capacity(d.equipment));
      },
      async publicBusy() {
        return busyFrom(load());
      },
      async book(p) {
        const d = load();
        const s = PC.mergeSettings(d.settings);
        const v = PC.validateRequest(p, s, busyFrom(d), PC.capacity(d.equipment));
        if (v.error) throw new Error(v.error);
        let client = d.clients.find((c) => PC.cleanPhone(c.phone) === v.booking.client_phone);
        if (!client) {
          client = { id: PC.uid(), name: v.booking.client_name, phone: v.booking.client_phone, email: v.booking.client_email, sport: v.sport, kind: 'particulier', is_minor: v.booking.is_minor, guardian_name: v.booking.guardian_name, health_ok: true, waiver_signed: false, credits: {}, notes: '', created_at: new Date().toISOString() };
          d.clients.push(client);
        }
        const b = Object.assign({ id: PC.uid(), ref: PC.makeRef(), client_id: client.id, created_at: new Date().toISOString() }, v.booking);
        d.bookings.push(b);
        save();
        return { ref: b.ref, start_at: b.start_at, price: b.price, status: b.status };
      },
      async clubRequest(p) {
        const d = load();
        if (String(p.name || '').trim().length < 2 || PC.cleanPhone(p.phone).length < 8) throw new Error('Nom du club et téléphone obligatoires.');
        d.partners.push({ id: PC.uid(), name: String(p.name).trim(), kind: p.kind || 'club', sport: p.sport || '', contact_name: p.contact_name || '', phone: PC.cleanPhone(p.phone), email: p.email || '', location: '', status: 'demande', plan: p.plan || null, monthly_price: null, season_commitment: false, pilot_start: null, pilot_end: null, slot_info: '', notes: p.message || 'Demande de test pilote depuis le site.', created_at: new Date().toISOString() });
        save();
        return { ok: true };
      },
      async exportAll() {
        return JSON.parse(JSON.stringify(load()));
      },
      async importAll(data) {
        db = data;
        save();
      },
      async reset() {
        db = PC.demoData();
        save();
      }
    };
  }

  function supabaseStore(cfg) {
    const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true } });
    const pick = (table, obj) => {
      const o = {};
      PC.SCHEMA[table].forEach((k) => {
        if (obj[k] !== undefined) o[k] = obj[k];
      });
      return o;
    };
    const fail = (error) => {
      if (error) throw new Error(error.message || String(error));
    };
    const fetchAll = async (table) => {
      const out = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await sb.from(table).select('*').order('created_at', { ascending: true }).range(from, from + 999);
        fail(error);
        out.push(...data);
        if (data.length < 1000) break;
      }
      return out;
    };
    return {
      mode: 'supabase',
      client: sb,
      async session() {
        const { data } = await sb.auth.getSession();
        if (!data.session) return null;
        const { data: admin } = await sb.rpc('is_admin');
        return { user: data.session.user, admin: !!admin };
      },
      async signIn(email, password) {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        fail(error);
      },
      async signUp(email, password) {
        const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.href.split('#')[0] } });
        fail(error);
        return data;
      },
      async resetPassword(email) {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.href.split('#')[0] });
        fail(error);
      },
      async updatePassword(password) {
        const { error } = await sb.auth.updateUser({ password });
        fail(error);
      },
      async signOut() {
        await sb.auth.signOut();
      },
      async claim(code) {
        const { data, error } = await sb.rpc('claim_admin', { p_code: code });
        fail(error);
        return !!data;
      },
      async loadAll() {
        const out = {};
        const res = await Promise.all(PC.TABLES.map((t) => fetchAll(t)));
        PC.TABLES.forEach((t, i) => (out[t] = res[i]));
        const { data, error } = await sb.from('settings').select('data').eq('id', 'main').maybeSingle();
        fail(error);
        out.settings = PC.mergeSettings(data && data.data);
        return out;
      },
      async insert(table, obj) {
        const { data, error } = await sb.from(table).insert(pick(table, obj)).select().single();
        fail(error);
        return data;
      },
      async update(table, id, patch) {
        const p = pick(table, patch);
        delete p.id;
        const { data, error } = await sb.from(table).update(p).eq('id', id).select().single();
        fail(error);
        return data;
      },
      async remove(table, id) {
        const { error } = await sb.from(table).delete().eq('id', id);
        fail(error);
      },
      async saveSettings(s) {
        const { error } = await sb.from('settings').upsert({ id: 'main', data: s, updated_at: new Date().toISOString() });
        fail(error);
      },
      async publicInfo() {
        const { data, error } = await sb.rpc('public_info');
        fail(error);
        return Object.assign(PC.publicSubset(PC.mergeSettings({}), 0), data);
      },
      async publicBusy(from, to) {
        const { data, error } = await sb.rpc('public_busy', { p_from: from.toISOString(), p_to: to.toISOString() });
        fail(error);
        return data || [];
      },
      async book(p) {
        const { data, error } = await sb.rpc('book', { p });
        fail(error);
        return data;
      },
      async clubRequest(p) {
        const { data, error } = await sb.rpc('club_request', { p });
        fail(error);
        return data;
      },
      async exportAll() {
        const all = await this.loadAll();
        return all;
      }
    };
  }

  PC.createStore = function () {
    const cfg = window.PRESSO_CONFIG || {};
    if (cfg.supabaseUrl && cfg.supabaseKey) {
      // Base configurée : jamais de repli silencieux sur le mode local,
      // sinon une réservation client resterait coincée dans son navigateur.
      if (!(window.supabase && window.supabase.createClient)) throw new Error('Connexion au service impossible. Vérifie ta connexion internet puis recharge la page.');
      return supabaseStore(cfg);
    }
    return localStore();
  };
})();
