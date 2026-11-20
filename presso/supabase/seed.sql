-- =====================================================================
-- Presso Center : données de départ (généré depuis assets/core.js)
-- Réglages et tarifs du business plan, parc de 5 bottes, consommables,
-- partenaires cités dans le plan. Rejouable sans doublon.
-- =====================================================================

insert into public.settings (id, data) values ('main', '{"business_name":"Presso Center","owner_name":"Chris","phone":"","email":"","city":"Tours","base_location":"Lieu précisé à la confirmation (Tours Métropole)","hours":{"0":[["14:00","19:00"]],"1":[["18:00","21:30"]]},"slot_step":15,"rotation_min":5,"travel_min":30,"min_notice_hours":12,"max_days_ahead":28,"weekly_hours_cap":16,"services":[{"code":"express","name":"Récup Express","duration":30,"price":20,"kind":"seance","online":true,"desc":"Découverte, après une séance"},{"code":"plus","name":"Récup+","duration":45,"price":30,"kind":"seance","online":true,"desc":"Entraînements intenses, semaine chargée"},{"code":"integrale","name":"Récup Intégrale","duration":60,"price":35,"kind":"seance","online":true,"desc":"Après une compétition"},{"code":"domicile","name":"À domicile","duration":60,"price":50,"kind":"domicile","online":true,"desc":"Tours Métropole, déplacement inclus"},{"code":"duo","name":"Duo ou équipe","duration":45,"price":25,"kind":"seance","per_person":true,"min_people":2,"max_people":5,"online":true,"desc":"Amis, petites équipes, 2 à 5 personnes"}],"packs":[{"code":"carte10","name":"Carte 10 séances","price":170,"credits":10,"desc":"10 × 30 min, soit 17 € la séance"},{"code":"abonnement","name":"Abonnement mensuel","price":100,"credits":4,"desc":"4 × 45 min par mois"}],"club_plans":[{"code":"starter","name":"Starter","price":250,"passages":30,"target":"Petit club, 1 à 2 équipes","desc":"2 créneaux d''1h30 par mois, environ 30 passages"},{"code":"club","name":"Club","price":450,"passages":60,"target":"Club de taille moyenne","desc":"1 créneau par semaine, environ 60 passages"},{"code":"performance","name":"Performance","price":800,"passages":120,"target":"Grand club, plusieurs équipes","desc":"2 créneaux par semaine, environ 120 passages"},{"code":"elite","name":"Elite","price":1000,"passages":160,"target":"Club régional, plusieurs équipes","desc":"2 créneaux par semaine + 2 jours de match, priorité, environ 160 passages"}],"club_options":[{"name":"Créneau supplémentaire d''1h30","price":120},{"name":"Événement ou tournoi, demi-journée de 4 h","price":300},{"name":"Passage d''un licencié hors forfait","price":10},{"name":"Déplacement au-delà de 20 km","price":15}],"season_discount":0.1,"start_month":"2027-01","social_rate":0.16,"vat_threshold":37500,"opening_cash":500,"break_even":550,"monthly_charges":[{"label":"Déplacements (carburant)","category":"deplacement","amount":100},{"label":"Hygiène (sous-bottes, désinfectant)","category":"hygiene","amount":65},{"label":"Communication","category":"communication","amount":50},{"label":"Banque et divers","category":"banque","amount":30},{"label":"Outils numériques","category":"outils","amount":20}],"loan":{"amount":6000,"monthly":209,"deferral_months":3,"payments":33,"contribution":360},"forecast":[1000,1700,2275,2700,3075,3500,2675,2000,3500,3700,4000,3575]}'::jsonb)
on conflict (id) do nothing;

insert into public.equipment (name, kind, model, size, purchase_price, status)
select * from (values
  ('Botte 1', 'botte', 'Bootech BT-PRO 8.0', 'M/L', 699::numeric, 'ok'),
  ('Botte 2', 'botte', 'Bootech BT-PRO 8.0', 'M/L', 699::numeric, 'ok'),
  ('Botte 3', 'botte', 'Bootech BT-PRO 8.0', 'M/L', 699::numeric, 'ok'),
  ('Botte 4', 'botte', 'Bootech BT-PRO 8.0', 'M/L', 699::numeric, 'ok'),
  ('Botte 5', 'botte', 'Bootech BT-PRO 8.0', 'M/L', 699::numeric, 'ok'),
  ('Bottes taille XL (seconde taille)', 'accessoire', null, null, null::numeric, 'ok'),
  ('Sacs de transport (× 5)', 'accessoire', null, null, null::numeric, 'ok'),
  ('Chariot de transport', 'accessoire', null, null, null::numeric, 'ok'),
  ('Tapis et assises', 'accessoire', null, null, null::numeric, 'ok')
) as v(name, kind, model, size, purchase_price, status)
where not exists (select 1 from public.equipment);

insert into public.stock (name, unit, qty, min_qty, per_passage, unit_cost)
select * from (values
  ('Sous-bottes à usage unique', 'paires', 200::numeric, 50::numeric, 1::numeric, 0.45::numeric),
  ('Désinfectant (flacon 500 ml)', 'flacons', 4, 2, 0.02, 6.5),
  ('Lingettes désinfectantes', 'boîtes', 3, 2, 0.01, 5),
  ('Serviettes', 'pièces', 12, 6, 0, 4)
) as v(name, unit, qty, min_qty, per_passage, unit_cost)
where not exists (select 1 from public.stock);

insert into public.partners (name, kind, sport, status, notes)
select * from (values
  ('JC Touraine', 'club', 'Judo', 'pilote', 'Club partenaire historique. Test pilote validé.'),
  ('Réseau de coachs (4 à 5)', 'coach', 'Préparation physique', 'accord', 'Accord de collaboration, tarifs préférentiels pour leurs groupes.'),
  ('Change by Aida', 'coach', 'Sport-santé, suivi à domicile', 'accord', 'Intérêt confirmé, démarrage visé en janvier 2027.'),
  ('ASAP Run Crew', 'communaute', 'Course à pied', 'discussion', 'Séance de test proposée à la communauté.'),
  ('Contact du réseau sportif', 'autre', null, 'discussion', 'Rendez-vous de présentation prévu.'),
  ('Coach indépendant, salle MyGym', 'coach', 'Musculation', 'prospect', 'Partenariat envisagé dès l''ouverture d''un espace d''accueil.'),
  ('Club de football de Saint-Avertin', 'club', 'Football', 'prospect', 'Prospection via le réseau.'),
  ('Club de football de La Riche', 'club', 'Football', 'prospect', 'Prospection via le réseau.'),
  ('Club de football de Chambray-lès-Tours', 'club', 'Football', 'prospect', 'Prospection via le réseau.'),
  ('Club de football de Saint-Cyr-sur-Loire', 'club', 'Football', 'prospect', 'Prospection via le réseau.')
) as v(name, kind, sport, status, notes)
where not exists (select 1 from public.partners);
