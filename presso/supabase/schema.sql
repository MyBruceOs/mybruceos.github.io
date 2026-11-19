-- =====================================================================
-- Presso Center : schéma de la base Supabase
-- Sécurité :
--   - toutes les tables sont protégées par RLS ;
--   - seul un compte inscrit dans public.admins (le compte gérant) lit et écrit ;
--   - les visiteurs (rôle anon) n'ont accès qu'à 4 fonctions :
--       public_info()   tarifs, horaires, nombre de bottes disponibles
--       public_busy()   créneaux occupés, sans aucune donnée personnelle
--       book()          demande de réservation, entièrement revalidée ici
--       club_request()  demande de test pilote d'un club
--   - l'accès gestion s'active une seule fois avec un code (admin_codes).
-- =====================================================================

create table if not exists public.settings (
  id text primary key default 'main',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  sport text,
  kind text not null default 'particulier',
  is_minor boolean not null default false,
  guardian_name text,
  health_ok boolean not null default false,
  waiver_signed boolean not null default false,
  credits jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists clients_phone_idx on public.clients (phone);

create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'club',
  sport text,
  contact_name text,
  phone text,
  email text,
  location text,
  status text not null default 'prospect',
  plan text,
  monthly_price numeric(10,2),
  season_commitment boolean not null default false,
  pilot_start date,
  pilot_end date,
  slot_info text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  ref text unique,
  kind text not null default 'seance' check (kind in ('seance', 'domicile', 'club', 'evenement', 'indispo')),
  service text,
  start_at timestamptz not null,
  duration_min int not null check (duration_min > 0 and duration_min <= 1440),
  boots int not null default 1,
  people int not null default 1,
  status text not null default 'demande' check (status in ('demande', 'confirmee', 'terminee', 'annulee', 'absent')),
  client_id uuid references public.clients (id) on delete set null,
  partner_id uuid references public.partners (id) on delete set null,
  client_name text,
  client_phone text,
  client_email text,
  address text,
  location text,
  price numeric(10,2) not null default 0,
  paid boolean not null default false,
  pay_method text,
  payment_mode text not null default 'unitaire',
  passages int,
  source text not null default 'manuel',
  health_ack boolean not null default false,
  is_minor boolean not null default false,
  guardian_name text,
  title text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists bookings_start_idx on public.bookings (start_at);
create index if not exists bookings_client_idx on public.bookings (client_id);
create index if not exists bookings_partner_idx on public.bookings (partner_id);
create index if not exists bookings_phone_idx on public.bookings (client_phone);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  type text not null check (type in ('recette', 'depense')),
  category text not null,
  label text,
  amount numeric(10,2) not null check (amount >= 0),
  method text,
  booking_id uuid references public.bookings (id) on delete set null,
  partner_id uuid references public.partners (id) on delete set null,
  client_id uuid references public.clients (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists transactions_date_idx on public.transactions (date);
create index if not exists transactions_booking_idx on public.transactions (booking_id);
create index if not exists transactions_partner_idx on public.transactions (partner_id);
create index if not exists transactions_client_idx on public.transactions (client_id);

create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'botte',
  model text,
  serial text,
  size text,
  purchase_date date,
  purchase_price numeric(10,2),
  status text not null default 'ok',
  last_check date,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.stock (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text,
  qty numeric(10,2) not null default 0,
  min_qty numeric(10,2) not null default 0,
  per_passage numeric(10,3) not null default 0,
  unit_cost numeric(10,2),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.checks (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  items jsonb not null default '[]'::jsonb,
  ok boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_codes (
  code text primary key,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Droits d'accès
-- ---------------------------------------------------------------------
alter table public.settings enable row level security;
alter table public.clients enable row level security;
alter table public.partners enable row level security;
alter table public.bookings enable row level security;
alter table public.transactions enable row level security;
alter table public.equipment enable row level security;
alter table public.stock enable row level security;
alter table public.checks enable row level security;
alter table public.admins enable row level security;
alter table public.admin_codes enable row level security;
-- admins et admin_codes : aucune policy, accessibles uniquement via les fonctions ci-dessous.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

do $$
declare
  t text;
begin
  foreach t in array array['settings', 'clients', 'partners', 'bookings', 'transactions', 'equipment', 'stock', 'checks'] loop
    execute format('drop policy if exists admin_all on public.%I', t);
    execute format('create policy admin_all on public.%I for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
  end loop;
end $$;

-- Activation de l'accès gestion avec un code à usage unique
create or replace function public.claim_admin(p_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or coalesce(length(p_code), 0) < 8 then
    return false;
  end if;
  delete from public.admin_codes where code = btrim(p_code);
  if not found then
    return false;
  end if;
  insert into public.admins (user_id) values (v_uid) on conflict do nothing;
  return true;
end;
$$;

-- ---------------------------------------------------------------------
-- Fonctions publiques (page de réservation)
-- ---------------------------------------------------------------------
create or replace function public.public_info()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
      (select jsonb_object_agg(k, s.data -> k)
         from unnest(array['business_name', 'phone', 'email', 'city', 'base_location', 'hours',
                           'slot_step', 'rotation_min', 'travel_min', 'min_notice_hours', 'max_days_ahead',
                           'services', 'packs', 'club_plans', 'club_options', 'season_discount']) as k
        where s.data ? k),
      '{}'::jsonb)
    || jsonb_build_object('capacity', (select count(*) from public.equipment e where e.kind = 'botte' and e.status = 'ok'))
  from public.settings s
  where s.id = 'main';
$$;

create or replace function public.public_busy(p_from timestamptz, p_to timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('start_at', b.start_at, 'duration_min', b.duration_min, 'kind', b.kind, 'boots', b.boots) order by b.start_at), '[]'::jsonb)
  from public.bookings b
  where b.status in ('demande', 'confirmee')
    and b.start_at < least(p_to, p_from + interval '62 days')
    and b.start_at + make_interval(mins => b.duration_min) > p_from - interval '2 hours';
$$;

create or replace function public.book(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s jsonb;
  svc jsonb;
  w jsonb;
  v_tz constant text := 'Europe/Paris';
  v_name text := btrim(coalesce(p ->> 'name', ''));
  v_phone text := regexp_replace(coalesce(p ->> 'phone', ''), '[^0-9+]', '', 'g');
  v_email text := nullif(btrim(coalesce(p ->> 'email', '')), '');
  v_sport text := nullif(btrim(coalesce(p ->> 'sport', '')), '');
  v_address text := nullif(btrim(coalesce(p ->> 'address', '')), '');
  v_notes text := nullif(btrim(coalesce(p ->> 'notes', '')), '');
  v_minor boolean := coalesce(p ->> 'is_minor', 'false') = 'true';
  v_guardian text := nullif(btrim(coalesce(p ->> 'guardian_name', '')), '');
  v_start timestamptz;
  v_local timestamp;
  v_end_local timestamp;
  v_dur int;
  v_people int;
  v_kind text;
  v_price numeric;
  v_per boolean;
  v_ok boolean := false;
  v_cap int;
  v_rot int;
  v_travel int;
  v_used int;
  v_conflict int;
  v_a timestamptz;
  v_z timestamptz;
  v_client uuid;
  v_ref text;
begin
  -- une réservation à la fois : pas de double attribution du même créneau
  perform pg_advisory_xact_lock(hashtext('presso_book'));

  select data into s from public.settings where id = 'main';
  if s is null then
    raise exception 'Réservation indisponible pour le moment.';
  end if;

  select x into svc
  from jsonb_array_elements(s -> 'services') as x
  where x ->> 'code' = p ->> 'service' and coalesce(x ->> 'online', 'true') <> 'false'
  limit 1;
  if svc is null then
    raise exception 'Formule inconnue.';
  end if;

  if length(v_name) < 2 or length(replace(v_phone, '+', '')) < 8 then
    raise exception 'Nom et téléphone obligatoires.';
  end if;
  if length(v_name) > 120 or length(v_phone) > 20 or length(coalesce(v_email, '')) > 160
     or length(coalesce(v_notes, '')) > 1000 or length(coalesce(v_address, '')) > 300
     or length(coalesce(v_sport, '')) > 80 or length(coalesce(v_guardian, '')) > 120 then
    raise exception 'Informations trop longues.';
  end if;
  if coalesce(p ->> 'health_ack', 'false') <> 'true' then
    raise exception 'Merci de valider le questionnaire de santé.';
  end if;
  if v_minor and coalesce(length(v_guardian), 0) < 2 then
    raise exception 'L''autorisation d''un parent est obligatoire pour un mineur.';
  end if;

  v_per := coalesce(svc ->> 'per_person', 'false') = 'true';
  v_people := 1;
  if v_per then
    begin
      v_people := coalesce((p ->> 'people')::int, 1);
    exception when others then
      v_people := 1;
    end;
    v_people := greatest(coalesce((svc ->> 'min_people')::int, 1), least(v_people, coalesce((svc ->> 'max_people')::int, 5)));
  end if;
  v_dur := (svc ->> 'duration')::int;
  v_price := round((svc ->> 'price')::numeric * case when v_per then v_people else 1 end, 2);
  v_kind := case when svc ->> 'kind' = 'domicile' then 'domicile' else 'seance' end;
  if v_kind = 'domicile' and coalesce(length(v_address), 0) < 5 then
    raise exception 'L''adresse est obligatoire pour une séance à domicile.';
  end if;

  begin
    v_start := (p ->> 'start_at')::timestamptz;
  exception when others then
    raise exception 'Créneau invalide.';
  end;
  if v_start is null then
    raise exception 'Créneau invalide.';
  end if;
  if v_start < now() + make_interval(hours => coalesce((s ->> 'min_notice_hours')::int, 12)) then
    raise exception 'Ce créneau est trop proche, choisis-en un autre.';
  end if;
  if v_start > now() + make_interval(days => coalesce((s ->> 'max_days_ahead')::int, 28) + 1) then
    raise exception 'Ce créneau est trop loin.';
  end if;

  -- dans une plage ouverte à la réservation (heure de Paris)
  v_local := v_start at time zone v_tz;
  v_end_local := v_local + make_interval(mins => v_dur);
  for w in
    select value from jsonb_array_elements(coalesce(s -> 'hours' -> (extract(dow from v_local)::int)::text, '[]'::jsonb))
  loop
    if v_end_local::date = v_local::date
       and v_local::time >= (w ->> 0)::time
       and v_end_local::time <= (w ->> 1)::time then
      v_ok := true;
    end if;
  end loop;
  if not v_ok then
    raise exception 'Ce créneau n''est pas ouvert à la réservation.';
  end if;

  -- capacité : 1 botte par personne, rotation de 5 min ; domicile, club,
  -- événement et indisponibilité occupent le praticien entièrement
  select count(*) into v_cap from public.equipment where kind = 'botte' and status = 'ok';
  v_rot := coalesce((s ->> 'rotation_min')::int, 5);
  v_travel := coalesce((s ->> 'travel_min')::int, 30);
  if v_kind = 'domicile' then
    v_a := v_start - make_interval(mins => v_travel);
    v_z := v_start + make_interval(mins => v_dur + v_travel);
  else
    v_a := v_start;
    v_z := v_start + make_interval(mins => v_dur + v_rot);
  end if;

  with occ as (
    select b.kind,
           b.boots,
           case when b.kind = 'domicile' then b.start_at - make_interval(mins => v_travel) else b.start_at end as a,
           b.start_at + make_interval(mins => b.duration_min
             + case when b.kind = 'seance' then v_rot when b.kind = 'domicile' then v_travel else 0 end) as z
    from public.bookings b
    where b.status in ('demande', 'confirmee')
      and b.start_at > v_a - interval '1 day'
      and b.start_at < v_z + interval '1 day'
  )
  select count(*) filter (where v_kind <> 'seance' or occ.kind <> 'seance'),
         coalesce(sum(occ.boots) filter (where occ.kind = 'seance'), 0)
    into v_conflict, v_used
  from occ
  where occ.a < v_z and occ.z > v_a;

  if v_conflict > 0 or v_used + v_people > v_cap then
    raise exception 'Ce créneau vient d''être pris, choisis-en un autre.';
  end if;

  -- anti-abus
  if (select count(*) from public.bookings where client_phone = v_phone and status = 'demande' and start_at > now()) >= 3 then
    raise exception 'Tu as déjà plusieurs demandes en attente : contacte-nous directement.';
  end if;
  if (select count(*) from public.bookings where source = 'en_ligne' and created_at > now() - interval '1 day') >= 60 then
    raise exception 'Réservation momentanément indisponible : contacte-nous directement.';
  end if;

  select id into v_client
  from public.clients
  where regexp_replace(coalesce(phone, ''), '[^0-9+]', '', 'g') = v_phone
  order by created_at
  limit 1;
  if v_client is null then
    insert into public.clients (name, phone, email, sport, is_minor, guardian_name, health_ok)
    values (v_name, v_phone, v_email, v_sport, v_minor, v_guardian, true)
    returning id into v_client;
  end if;

  loop
    v_ref := 'PC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5));
    exit when not exists (select 1 from public.bookings where ref = v_ref);
  end loop;

  insert into public.bookings (ref, kind, service, start_at, duration_min, boots, people, status, client_id,
                               client_name, client_phone, client_email, address, price, payment_mode, source,
                               health_ack, is_minor, guardian_name, notes)
  values (v_ref, v_kind, svc ->> 'code', v_start, v_dur, v_people, v_people, 'demande', v_client,
          v_name, v_phone, v_email, case when v_kind = 'domicile' then v_address end, v_price,
          case when p ->> 'payment_mode' = 'credit' then 'credit' else 'unitaire' end, 'en_ligne',
          true, v_minor, case when v_minor then v_guardian end, v_notes);

  return jsonb_build_object('ref', v_ref, 'start_at', v_start, 'price', v_price, 'status', 'demande');
end;
$$;

create or replace function public.club_request(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p ->> 'name', ''));
  v_phone text := regexp_replace(coalesce(p ->> 'phone', ''), '[^0-9+]', '', 'g');
  v_kind text := coalesce(nullif(p ->> 'kind', ''), 'club');
  v_msg text := nullif(btrim(coalesce(p ->> 'message', '')), '');
begin
  if length(v_name) < 2 or length(replace(v_phone, '+', '')) < 8 then
    raise exception 'Nom du club et téléphone obligatoires.';
  end if;
  if length(v_name) > 160 or length(v_phone) > 20 or length(coalesce(v_msg, '')) > 2000
     or length(coalesce(p ->> 'email', '')) > 160 or length(coalesce(p ->> 'contact_name', '')) > 120
     or length(coalesce(p ->> 'sport', '')) > 80 then
    raise exception 'Informations trop longues.';
  end if;
  if v_kind not in ('club', 'coach', 'communaute', 'organisme', 'autre') then
    v_kind := 'autre';
  end if;
  if (select count(*) from public.partners where status = 'demande' and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Trop de demandes aujourd''hui : contactez-nous directement.';
  end if;
  insert into public.partners (name, kind, sport, contact_name, phone, email, status, plan, notes)
  values (v_name, v_kind,
          nullif(btrim(coalesce(p ->> 'sport', '')), ''),
          nullif(btrim(coalesce(p ->> 'contact_name', '')), ''),
          v_phone,
          nullif(btrim(coalesce(p ->> 'email', '')), ''),
          'demande',
          case when p ->> 'plan' in ('starter', 'club', 'performance', 'elite') then p ->> 'plan' end,
          coalesce(v_msg, 'Demande de test pilote depuis le site.'));
  return jsonb_build_object('ok', true);
end;
$$;

-- Exécution des fonctions : PostgreSQL et Supabase l'ouvrent à tous par défaut
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.claim_admin(text) from public, anon;
revoke execute on function public.public_info() from public;
revoke execute on function public.public_busy(timestamptz, timestamptz) from public;
revoke execute on function public.book(jsonb) from public;
revoke execute on function public.club_request(jsonb) from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.claim_admin(text) to authenticated;
grant execute on function public.public_info() to anon, authenticated;
grant execute on function public.public_busy(timestamptz, timestamptz) to anon, authenticated;
grant execute on function public.book(jsonb) to anon, authenticated;
grant execute on function public.club_request(jsonb) to anon, authenticated;

-- Pour créer un code d'activation (à exécuter dans l'éditeur SQL, le code n'est pas versionné) :
--   insert into public.admin_codes (code) values (upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16))) returning code;
