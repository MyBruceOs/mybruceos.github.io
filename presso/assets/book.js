/* Presso Center — page de réservation client */
(function () {
  'use strict';
  const PC = window.PC;
  const esc = PC.esc;
  const $ = (sel, el) => (el || document).querySelector(sel);
  const root = $('#booking');
  const clubsRoot = $('#clubs');

  document.querySelectorAll('[data-ic]').forEach((el) => el.insertAdjacentHTML('afterbegin', PC.icon(el.dataset.ic)));

  const st = { info: null, busy: [], svc: null, people: 2, day: null, slot: null, sending: false, error: '' };
  let store;

  const remember = {
    get() {
      try { return JSON.parse(localStorage.getItem('presso.me') || '{}'); } catch (e) { return {}; }
    },
    set(v) {
      try { localStorage.setItem('presso.me', JSON.stringify(v)); } catch (e) { /* stockage indisponible */ }
    }
  };

  async function init() {
    try {
      store = PC.createStore();
      if (store.mode === 'local') {
        $('#demo-banner').innerHTML = '<div class="demo-banner">Mode démo : les réservations restent dans ce navigateur. <a href="gestion.html">Voir l\'espace de gestion</a></div>';
      }
      st.info = await store.publicInfo();
      await refreshBusy();
      render();
      renderClubs();
    } catch (e) {
      console.error(e);
      root.innerHTML = '<section class="card"><h2 style="font-size:18px">Réservation momentanément indisponible</h2><p class="muted" style="margin-top:8px">' + esc(e.message) + '</p></section>';
    }
  }

  async function refreshBusy() {
    const now = new Date();
    st.busy = await store.publicBusy(PC.addDays(PC.startOfDay(now), -1), PC.addDays(now, (st.info.max_days_ahead || 28) + 2));
  }

  function svcList() {
    return (st.info.services || []).filter((s) => s.online !== false);
  }

  function days() {
    const out = [];
    const today = PC.startOfDay(new Date());
    for (let i = 0; i <= (st.info.max_days_ahead || 28); i++) {
      const d = PC.addDays(today, i);
      if (PC.windowsFor(d, st.info).length) out.push(d);
    }
    return out;
  }

  function slotsFor(day) {
    if (!st.svc) return [];
    return PC.slotsForDay(day, st.svc, st.people, st.busy, st.info, st.info.capacity, new Date());
  }

  function priceOf() {
    if (!st.svc) return 0;
    return PC.reqFromService(st.svc, st.people).price;
  }

  /* ---------- Rendu ---------- */
  function render() {
    const info = st.info;
    let html = '';

    // Étape 1 : formule
    html += '<section class="card"><div class="step-title"><span class="step-num">1</span><div><h2>Choisis ta formule</h2><p>Tu enfiles les bottes, elles compriment tes jambes par séquences. Tu te détends.</p></div></div>';
    html += '<div class="svc-grid" role="group" aria-label="Formules">';
    svcList().forEach((s) => {
      const on = st.svc && st.svc.code === s.code;
      html += '<button type="button" class="svc" data-svc="' + esc(s.code) + '" aria-pressed="' + on + '">' +
        '<span class="tick">' + PC.icon('check') + '</span>' +
        '<span class="name">' + esc(s.name) + '</span>' +
        '<span class="price">' + PC.eur(s.price) + (s.per_person ? ' <small>/ pers.</small>' : '') + '</span>' +
        '<span class="meta">' + PC.durationLabel(s.duration) + ' · ' + esc(s.desc || '') + '</span></button>';
    });
    html += '</div>';
    if (st.svc && st.svc.per_person) {
      html += '<div class="people"><span class="grow"><b>Nombre de personnes</b><br><span class="small muted">' + (st.svc.min_people || 2) + ' à ' + (st.svc.max_people || 5) + ' personnes en même temps</span></span>' +
        '<span class="stepper"><button type="button" class="btn icon sm soft" data-people="-1" aria-label="Une personne de moins">−</button><output aria-live="polite">' + st.people + '</output><button type="button" class="btn icon sm soft" data-people="1" aria-label="Une personne de plus">+</button></span></div>';
    }
    if (st.svc && st.svc.kind === 'domicile') {
      html += '<div class="alert info" style="margin-top:12px">' + PC.icon('pin') + '<span>On vient chez toi avec le matériel, dans Tours Métropole. Prévois un canapé ou un lit pour t\'allonger.</span></div>';
    }
    if ((info.packs || []).length) {
      html += '<div class="packs">' + info.packs.map((p) => '<span><b>' + esc(p.name) + ' : ' + PC.eur(p.price) + '</b> · ' + esc(p.desc) + '</span>').join('') + '<span>Disponibles sur demande lors d\'une séance.</span></div>';
    }
    html += '</section>';

    // Étape 2 : jour et heure
    if (st.svc) {
      const ds = days();
      html += '<section class="card" id="step-when"><div class="step-title"><span class="step-num">2</span><div><h2>Choisis ton jour et ton heure</h2><p>' + esc(whereText()) + '</p></div></div>';
      if (!info.capacity) {
        html += '<div class="empty">Le matériel n\'est pas disponible en ce moment. Contacte-nous pour convenir d\'un créneau.</div>';
      } else if (!ds.length) {
        html += '<div class="empty">Aucun créneau ouvert pour le moment. Contacte-nous pour convenir d\'un créneau.</div>';
      } else {
        html += '<div class="days" role="group" aria-label="Jours">';
        ds.forEach((d) => {
          const n = slotsFor(d).length;
          const on = st.day && PC.ymd(st.day) === PC.ymd(d);
          html += '<button type="button" class="day" data-day="' + PC.ymd(d) + '" aria-pressed="' + on + '"' + (n ? '' : ' disabled') + '>' +
            '<span class="dw">' + esc(d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '')) + '</span>' +
            '<span class="dn">' + d.getDate() + '</span>' +
            '<span class="dm">' + esc(d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')) + '</span>' +
            '<span class="df">' + (n ? n + ' libre' + (n > 1 ? 's' : '') : 'Complet') + '</span></button>';
        });
        html += '</div>';
        if (st.day) {
          const sl = slotsFor(st.day);
          html += '<p class="slot-group-label">' + esc(PC.capitalize(PC.fmtDayLong(st.day))) + '</p>';
          if (!sl.length) html += '<div class="empty" style="margin-top:10px">Plus de créneau ce jour-là, essaie un autre jour.</div>';
          else {
            html += '<div class="slots" role="group" aria-label="Heures">';
            sl.forEach((x) => {
              const on = st.slot && st.slot.getTime() === x.start.getTime();
              html += '<button type="button" class="slot" data-slot="' + x.start.toISOString() + '" aria-pressed="' + on + '">' + PC.fmtTime(x.start) + '</button>';
            });
            html += '</div>';
          }
        } else {
          html += '<p class="small muted">Choisis un jour pour voir les heures libres.</p>';
        }
      }
      html += '</section>';
    }

    // Étape 3 : coordonnées
    if (st.svc && st.slot) {
      const me = remember.get();
      const end = PC.addMinutes(st.slot, st.svc.duration);
      html += '<section class="card" id="step-who"><div class="step-title"><span class="step-num">3</span><div><h2>Tes coordonnées</h2><p>On te confirme la séance par SMS ou WhatsApp.</p></div></div>';
      html += '<form id="book-form" class="stack" novalidate>';
      html += '<div class="grid-2"><label class="field"><span>Prénom et nom</span><input name="name" autocomplete="name" required value="' + esc(me.name || '') + '"></label>' +
        '<label class="field"><span>Téléphone</span><input name="phone" type="tel" autocomplete="tel" inputmode="tel" required value="' + esc(me.phone || '') + '"></label></div>';
      html += '<div class="grid-2"><label class="field"><span>E-mail <span class="muted">(facultatif)</span></span><input name="email" type="email" autocomplete="email" value="' + esc(me.email || '') + '"></label>' +
        '<label class="field"><span>Ton sport</span><input name="sport" placeholder="Football, course, judo…" value="' + esc(me.sport || '') + '"></label></div>';
      if (st.svc.kind === 'domicile') {
        html += '<label class="field"><span>Adresse de la séance</span><input name="address" autocomplete="street-address" required placeholder="Numéro, rue, commune"></label>';
      }
      html += '<label class="field"><span>Message <span class="muted">(facultatif)</span></span><textarea name="notes" rows="2" placeholder="Compétition ce week-end, douleur aux mollets…"></textarea></label>';
      html += '<label class="check"><input type="checkbox" name="is_minor" id="is-minor"><span>J\'ai moins de 18 ans</span></label>';
      html += '<div id="guardian" class="hide"><label class="field"><span>Nom du parent ou tuteur</span><input name="guardian_name" autocomplete="off"></label>' +
        '<label class="check" style="margin-top:10px"><input type="checkbox" name="guardian_ok"><span>Mon parent ou tuteur autorise cette séance.</span></label></div>';
      html += '<div class="health"><b>Questionnaire de santé</b><p class="small muted" style="margin-top:4px">La pressothérapie est déconseillée en cas de :</p><ul>' + PC.CONTRAINDICATIONS.map((c) => '<li>' + esc(c) + '</li>').join('') + '</ul>' +
        '<label class="check"><input type="checkbox" name="health_ack" required><span>Je ne suis concerné(e) par aucune de ces situations. En cas de doute, je demande d\'abord l\'avis de mon médecin.</span></label></div>';
      html += '<label class="check"><input type="checkbox" name="credit"><span>J\'ai une carte 10 séances ou un abonnement : décompter cette séance.</span></label>';
      html += '<div class="summary"><div class="row between"><span>' + esc(st.svc.name) + (st.svc.per_person ? ' × ' + st.people : '') + '</span><span class="tnum">' + PC.durationLabel(st.svc.duration) + '</span></div>' +
        '<div class="row between"><span>' + esc(PC.capitalize(PC.fmtDayLong(st.slot))) + '</span><span class="tnum">' + PC.fmtTime(st.slot) + ' – ' + PC.fmtTime(end) + '</span></div>' +
        '<div class="row between"><span class="tot">À régler sur place</span><span class="tot tnum">' + PC.eur(priceOf()) + '</span></div>' +
        '<span class="small muted">Carte bancaire, espèces, Lydia ou Wero. Annulation gratuite en nous prévenant au moins 12 h avant.</span></div>';
      if (st.error) html += '<p class="form-error" role="alert">' + esc(st.error) + '</p>';
      html += '<button class="btn gold block" type="submit" style="min-height:50px;font-size:16px"' + (st.sending ? ' disabled' : '') + '>' + (st.sending ? 'Envoi…' : 'Envoyer ma demande') + '</button>';
      html += '</form></section>';
    }

    root.innerHTML = html;
    const minor = $('#is-minor');
    if (minor) minor.addEventListener('change', () => $('#guardian').classList.toggle('hide', !minor.checked));
  }

  function whereText() {
    if (!st.svc) return '';
    if (st.svc.kind === 'domicile') return 'On se déplace chez toi. Durée : ' + PC.durationLabel(st.svc.duration) + '.';
    return 'Durée : ' + PC.durationLabel(st.svc.duration) + '. ' + (st.info.base_location || '');
  }

  function renderConfirm(res, payload) {
    const start = new Date(res.start_at);
    const svc = st.svc;
    const end = PC.addMinutes(start, svc.duration);
    const phone = st.info.phone;
    const msg = 'Bonjour, je viens de réserver « ' + svc.name + ' » le ' + PC.fmtDayLong(start) + ' à ' + PC.fmtTime(start) + ' (réf. ' + res.ref + '). ' + payload.name;
    let html = '<section class="card"><div class="confirm-box">' +
      '<div class="ok-ic">' + PC.icon('check') + '</div>' +
      '<h2 style="font-size:24px">Demande envoyée</h2>' +
      '<span class="ref">' + esc(res.ref) + '</span>' +
      '<p style="margin-top:12px;font-size:16px"><b>' + esc(svc.name) + '</b>' + (svc.per_person ? ' × ' + st.people : '') + '<br>' + esc(PC.capitalize(PC.fmtDayLong(start))) + ', ' + PC.fmtTime(start) + ' – ' + PC.fmtTime(end) + '<br>' + PC.eur(res.price) + ' à régler sur place</p>' +
      '<p class="muted" style="margin-top:12px">On te confirme ta séance par SMS ou WhatsApp. Conserve ta référence.</p>' +
      '<div class="row wrap" style="justify-content:center;margin-top:20px">' +
      '<button type="button" class="btn ghost" id="ics">' + PC.icon('calendar') + 'Ajouter à mon agenda</button>' +
      (phone ? '<a class="btn" href="' + esc(PC.waLink(phone, msg)) + '" target="_blank" rel="noopener">' + PC.icon('message') + 'Nous prévenir sur WhatsApp</a>' : '') +
      '</div><button type="button" class="btn soft sm" id="again" style="margin-top:16px">Faire une autre réservation</button></div></section>';
    root.innerHTML = html;
    $('#ics').addEventListener('click', () => {
      const loc = svc.kind === 'domicile' ? payload.address : st.info.base_location;
      PC.download('presso-center-' + res.ref + '.ics', PC.ics({ title: 'Presso Center · ' + svc.name, start, minutes: svc.duration, location: loc, description: 'Référence ' + res.ref + '. ' + PC.eur(res.price) + ' à régler sur place.' }), 'text/calendar;charset=utf-8');
    });
    $('#again').addEventListener('click', async () => {
      st.svc = null; st.day = null; st.slot = null; st.error = '';
      await refreshBusy();
      render();
      window.scrollTo({ top: root.offsetTop - 20, behavior: 'smooth' });
    });
    root.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------- Clubs ---------- */
  function renderClubs() {
    const info = st.info;
    let html = '<div class="card" style="margin-bottom:22px"><p class="eyebrow">Clubs, coachs et événements</p><h2 style="font-size:24px;margin-top:6px">La récupération vient à vos licenciés</h2>' +
      '<p class="muted" style="margin-top:8px;max-width:44rem">On installe les bottes au club en 10 minutes et on prend en charge jusqu\'à 15 athlètes par créneau d\'1h30. Le club n\'achète rien.</p>' +
      '<div class="plans" style="margin-top:18px">';
    (info.club_plans || []).forEach((p) => {
      html += '<div class="plan"><span class="eyebrow">' + esc(p.name) + '</span><span class="price">' + PC.eur(p.price) + ' <small>/ mois</small></span>' +
        '<span class="pp">≈ ' + PC.eur(PC.round2(p.price / (p.passages || 1))) + ' par passage</span><span class="small"><b>' + esc(p.target) + '</b></span><span class="small muted">' + esc(p.desc) + '</span></div>';
    });
    html += '</div><div class="grid-2" style="margin-top:18px"><div><h3 style="font-size:15px;margin-bottom:8px">Options</h3><ul class="bullets">' +
      (info.club_options || []).map((o) => '<li><span>' + esc(o.name) + ' : <b>' + PC.eur(o.price) + '</b></span></li>').join('') + '</ul></div>' +
      '<div><h3 style="font-size:15px;margin-bottom:8px">Conditions</h3><ul class="bullets"><li>Test pilote gratuit de 2 à 4 semaines</li><li>Sans engagement, préavis de 15 jours</li><li>−' + Math.round((info.season_discount || 0.1) * 100) + ' % en cas d\'engagement sur la saison</li><li>Installation offerte, facturation au club</li></ul></div></div>';
    html += '<form id="club-form" class="stack" style="margin-top:22px;padding-top:18px;border-top:1px solid var(--line)" novalidate><h3 style="font-size:17px">Demander un test pilote gratuit</h3>' +
      '<div class="grid-2"><label class="field"><span>Club ou structure</span><input name="name" required></label><label class="field"><span>Vous êtes</span><select name="kind"><option value="club">Un club</option><option value="coach">Un coach</option><option value="communaute">Une communauté (running…)</option><option value="organisme">Un organisateur d\'événements</option></select></label></div>' +
      '<div class="grid-2"><label class="field"><span>Sport</span><input name="sport"></label><label class="field"><span>Votre nom</span><input name="contact_name" autocomplete="name"></label></div>' +
      '<div class="grid-2"><label class="field"><span>Téléphone</span><input name="phone" type="tel" inputmode="tel" required></label><label class="field"><span>E-mail</span><input name="email" type="email"></label></div>' +
      '<label class="field"><span>Formule envisagée</span><select name="plan"><option value="">Je ne sais pas encore</option>' + (info.club_plans || []).map((p) => '<option value="' + esc(p.code) + '">' + esc(p.name) + ' · ' + PC.eur(p.price) + ' / mois</option>').join('') + '</select></label>' +
      '<label class="field"><span>Effectif, jours d\'entraînement, questions</span><textarea name="message" rows="3"></textarea></label>' +
      '<p class="form-error hide" id="club-error" role="alert"></p>' +
      '<button class="btn" type="submit">Envoyer la demande</button></form></div>';
    clubsRoot.innerHTML = html;
  }

  /* ---------- Événements ---------- */
  root.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.svc) {
      const s = svcList().find((x) => x.code === t.dataset.svc);
      const changed = !st.svc || st.svc.code !== s.code;
      st.svc = s;
      if (s.per_person) st.people = Math.max(s.min_people || 2, Math.min(st.people, s.max_people || 5));
      if (changed) { st.slot = null; }
      st.error = '';
      render();
      const w = $('#step-when');
      if (w && changed) w.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (t.dataset.people) {
      const s = st.svc;
      st.people = Math.max(s.min_people || 2, Math.min(st.people + Number(t.dataset.people), s.max_people || 5));
      st.slot = null;
      render();
    } else if (t.dataset.day) {
      st.day = PC.parseYmd(t.dataset.day);
      st.slot = null;
      render();
    } else if (t.dataset.slot) {
      st.slot = new Date(t.dataset.slot);
      st.error = '';
      render();
      const w = $('#step-who');
      if (w) w.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  root.addEventListener('submit', async (e) => {
    if (e.target.id !== 'book-form') return;
    e.preventDefault();
    const f = new FormData(e.target);
    const p = {
      service: st.svc.code,
      people: st.svc.per_person ? st.people : 1,
      start_at: st.slot.toISOString(),
      name: String(f.get('name') || '').trim(),
      phone: String(f.get('phone') || '').trim(),
      email: String(f.get('email') || '').trim(),
      sport: String(f.get('sport') || '').trim(),
      address: String(f.get('address') || '').trim(),
      notes: String(f.get('notes') || '').trim(),
      is_minor: !!f.get('is_minor'),
      guardian_name: String(f.get('guardian_name') || '').trim(),
      health_ack: !!f.get('health_ack'),
      payment_mode: f.get('credit') ? 'credit' : 'unitaire'
    };
    const formVals = { name: p.name, phone: p.phone, email: p.email, sport: p.sport, address: p.address, notes: p.notes };
    let err = '';
    if (p.name.length < 2) err = 'Indique ton prénom et ton nom.';
    else if (PC.cleanPhone(p.phone).replace('+', '').length < 8) err = 'Indique un numéro de téléphone valide.';
    else if (st.svc.kind === 'domicile' && p.address.length < 5) err = 'Indique l\'adresse de la séance.';
    else if (p.is_minor && (p.guardian_name.length < 2 || !f.get('guardian_ok'))) err = 'Pour un mineur, il faut le nom et l\'accord d\'un parent.';
    else if (!p.health_ack) err = 'Merci de valider le questionnaire de santé.';
    if (err) {
      st.error = err;
      render();
      restore(formVals, p);
      return;
    }
    st.sending = true;
    st.error = '';
    render();
    restore(formVals, p);
    try {
      const res = await store.book(p);
      remember.set({ name: p.name, phone: p.phone, email: p.email, sport: p.sport });
      st.sending = false;
      renderConfirm(res, p);
    } catch (ex) {
      st.sending = false;
      st.error = ex.message || 'Envoi impossible, réessaie.';
      try { await refreshBusy(); } catch (e2) { /* garder l'ancien état */ }
      const still = slotsFor(st.day).some((x) => x.start.getTime() === st.slot.getTime());
      if (!still) st.slot = null;
      render();
      if (st.slot) restore(formVals, p);
      else {
        const w = $('#step-when');
        if (w) w.insertAdjacentHTML('beforeend', '<p class="form-error" role="alert" style="margin-top:12px">' + esc(st.error) + '</p>');
      }
    }
  });

  function restore(vals, p) {
    const form = $('#book-form');
    if (!form) return;
    Object.keys(vals).forEach((k) => {
      if (form.elements[k]) form.elements[k].value = vals[k];
    });
    if (p.is_minor) {
      form.elements.is_minor.checked = true;
      $('#guardian').classList.remove('hide');
      form.elements.guardian_name.value = p.guardian_name;
    }
    if (p.health_ack) form.elements.health_ack.checked = true;
    if (p.payment_mode === 'credit') form.elements.credit.checked = true;
  }

  clubsRoot.addEventListener('submit', async (e) => {
    if (e.target.id !== 'club-form') return;
    e.preventDefault();
    const f = new FormData(e.target);
    const p = Object.fromEntries(f.entries());
    const errEl = $('#club-error');
    if (String(p.name || '').trim().length < 2 || PC.cleanPhone(p.phone).length < 8) {
      errEl.textContent = 'Indiquez le nom du club et un numéro de téléphone.';
      errEl.classList.remove('hide');
      return;
    }
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.textContent = 'Envoi…';
    try {
      await store.clubRequest(p);
      e.target.innerHTML = '<div class="confirm-box"><div class="ok-ic">' + PC.icon('check') + '</div><h3 style="font-size:20px">Demande envoyée</h3><p class="muted" style="margin-top:8px">On vous recontacte rapidement pour organiser le test pilote.</p></div>';
    } catch (ex) {
      errEl.textContent = ex.message || 'Envoi impossible, réessayez.';
      errEl.classList.remove('hide');
      btn.disabled = false;
      btn.textContent = 'Envoyer la demande';
    }
  });

  init();
})();
