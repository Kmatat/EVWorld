-- =====================================================================
-- EVWorld backend schema (Supabase / PostgreSQL 15+)
-- =====================================================================
-- Privacy and money rules are enforced HERE, in the database, not only in
-- the app, so a modified app can't break them:
--   * a user's phone number is visible only to that user (and to the sellers
--     shipping their order, through the order snapshot);
--   * other users only ever see "First L." and ratings;
--   * a community charger's exact location and access instructions are
--     visible only to the host and to drivers whose request was accepted;
--   * chat messages have phone numbers, emails and WhatsApp/social links
--     removed before they are stored;
--   * booking status changes follow the allowed steps, and the session
--     price is calculated by the server.
--
-- Supabase provides auth.users and auth.uid() (Apple, Google and phone OTP
-- sign-in). Enable Realtime on public.messages for live chat.
-- =====================================================================

-- ---------- helpers ----------

-- "Karim Ahmed Matat" -> "Karim M."
create or replace function public.public_name(full_name text) returns text
language sql immutable as $$
  with parts as (select regexp_split_to_array(trim(coalesce(full_name, '')), '\s+') as p)
  select case
    when trim(coalesce(full_name, '')) = '' then 'EVWorld user'
    when array_length(p, 1) = 1 then p[1]
    else p[1] || ' ' || upper(left(p[array_length(p, 1)], 1)) || '.'
  end
  from parts
$$;

-- Removes phone numbers (incl. Arabic-Indic digits), emails and messaging/social links.
create or replace function public.mask_contact_info(body text, out masked_body text, out was_masked boolean)
language plpgsql immutable as $$
declare
  m text;
  hidden constant text := '[contact hidden]';
begin
  masked_body := body;
  masked_body := regexp_replace(masked_body,
    '(https?://)?(www\.)?(wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com|t\.me|telegram\.me|instagram\.com|facebook\.com|fb\.me|m\.me)/\S*',
    hidden, 'gi');
  masked_body := regexp_replace(masked_body, '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', hidden, 'g');
  masked_body := regexp_replace(masked_body,
    '\m(zero|one|two|three|four|five|six|seven|eight|nine)(\W+(zero|one|two|three|four|five|six|seven|eight|nine)){6,}\M',
    hidden, 'gi');
  -- Digit runs with separators; only runs of 9+ digits (phone-length) are hidden,
  -- so prices, kW and times stay readable.
  for m in select (regexp_matches(masked_body, '\+?[0-9٠-٩۰-۹][0-9٠-٩۰-۹ .()-]{6,}[0-9٠-٩۰-۹]', 'g'))[1] loop
    if length(regexp_replace(translate(m, '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789'), '[^0-9]', '', 'g')) >= 9 then
      masked_body := replace(masked_body, m, hidden);
    end if;
  end loop;
  was_masked := masked_body is distinct from body;
end $$;

-- A stable point 250–450 m from the real one (same point every time, so it can't be averaged out).
create or replace function public.approximate_point(lat double precision, lng double precision, seed text,
  out a_lat double precision, out a_lng double precision)
language plpgsql immutable as $$
declare
  h bigint := abs(hashtext(seed)::bigint);
  angle double precision := radians(h % 360);
  dist_km double precision := 0.25 + ((h / 512) % 200) / 1000.0;
begin
  a_lat := lat + (dist_km / 111.32) * cos(angle);
  a_lng := lng + (dist_km / (111.32 * cos(radians(lat)))) * sin(angle);
end $$;

-- ---------- profiles (private) ----------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  phone text unique check (phone ~ '^\+201[0125][0-9]{8}$'),
  phone_verified_at timestamptz,
  rating numeric(2, 1) not null default 5.0,
  completed_sessions int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "own profile: read" on public.profiles for select using (id = auth.uid());
create policy "own profile: update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "own profile: create" on public.profiles for insert with check (id = auth.uid());

-- What everyone else may see. The view runs with its owner's rights, so it can
-- read the table, but it only exposes these columns.
create view public.public_profiles as
  select id, public.public_name(full_name) as display_name, rating, completed_sessions,
         phone_verified_at is not null as phone_verified
  from public.profiles;

create or replace function public.is_verified(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = uid and phone_verified_at is not null)
$$;

-- ---------- delivery addresses (owner only) ----------

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text not null default 'Home' check (label in ('Home', 'Work', 'Other')),
  governorate text not null,
  city text not null,
  street text not null,
  building text not null,
  floor text,
  apartment text,
  landmark text,
  lat double precision,
  lng double precision,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index addresses_one_default on public.addresses (user_id) where is_default;
alter table public.addresses enable row level security;
create policy "own addresses" on public.addresses for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- marketplace orders: address & phone go only to the shipping seller ----------

create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  verified boolean not null default false
);
create table public.vendor_members (
  vendor_id uuid references public.vendors (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  primary key (vendor_id, user_id)
);
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles (id),
  vendor_id uuid not null references public.vendors (id),
  deliver_to text not null,      -- address snapshot at order time
  contact_phone text not null,   -- phone snapshot for the courier
  total numeric(12, 2) not null,
  status text not null default 'placed' check (status in ('placed', 'shipped', 'delivered', 'cancelled')),
  created_at timestamptz not null default now()
);
alter table public.vendors enable row level security;
alter table public.vendor_members enable row level security;
alter table public.orders enable row level security;
create policy "vendors are public" on public.vendors for select using (true);
create policy "see own memberships" on public.vendor_members for select using (user_id = auth.uid());
create policy "buyer or shipping seller sees order" on public.orders for select using (
  buyer_id = auth.uid()
  or exists (select 1 from public.vendor_members vm where vm.vendor_id = orders.vendor_id and vm.user_id = auth.uid())
);
create policy "verified buyers place orders" on public.orders for insert with check (buyer_id = auth.uid() and public.is_verified(auth.uid()));

-- ---------- community chargers ----------

create table public.community_chargers (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (length(title) between 4 and 80),
  plug text not null check (plug in ('type2_tethered', 'type2_socket', 'gbt_ac', 'household')),
  power_kw numeric(4, 1) not null check (power_kw > 0 and power_kw <= 22),
  price_per_kwh numeric(6, 2) not null check (price_per_kwh > 0 and price_per_kwh < 50),
  area text not null,
  city text not null,
  show_approximate boolean not null default true,
  -- Public pin: exact or approximate, set from charger_private by a trigger.
  public_lat double precision,
  public_lng double precision,
  availability jsonb not null,  -- {"days":[0..6],"from":"HH:MM","to":"HH:MM"}
  parking text not null,
  description text not null default '',
  paused boolean not null default false,
  status text not null default 'pending_review' check (status in ('pending_review', 'live', 'rejected')),
  created_at timestamptz not null default now()
);

create table public.charger_private (
  charger_id uuid primary key references public.community_chargers (id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  access_instructions text not null
);

create table public.charging_bookings (
  id uuid primary key default gen_random_uuid(),
  charger_id uuid not null references public.community_chargers (id),
  driver_id uuid not null references public.profiles (id),
  status text not null default 'requested' check (status in ('requested', 'accepted', 'declined', 'cancelled', 'charging', 'completed')),
  slot_start timestamptz not null,
  est_kwh numeric(5, 1),
  price_per_kwh numeric(6, 2) not null,  -- price snapshot when requested
  kwh numeric(6, 2),
  kwh_method text check (kwh_method in ('smart_charger', 'meter', 'timer')),
  energy_cost numeric(10, 2),
  service_fee numeric(10, 2),
  total numeric(10, 2),
  driver_rating smallint check (driver_rating between 1 and 5),
  host_rating smallint check (host_rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_public_pin() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  approx boolean;
  p record;
begin
  select show_approximate into approx from community_chargers where id = new.charger_id;
  if approx then
    select * into p from approximate_point(new.lat, new.lng, new.charger_id::text);
    update community_chargers set public_lat = p.a_lat, public_lng = p.a_lng where id = new.charger_id;
  else
    update community_chargers set public_lat = new.lat, public_lng = new.lng where id = new.charger_id;
  end if;
  return new;
end $$;
create trigger charger_private_pin after insert or update on public.charger_private
  for each row execute function public.set_public_pin();

create or replace function public.is_host(charger uuid, uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from community_chargers where id = charger and host_id = uid)
$$;

create or replace function public.has_accepted_booking(charger uuid, uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from charging_bookings
                 where charger_id = charger and driver_id = uid and status in ('accepted', 'charging', 'completed'))
$$;

alter table public.community_chargers enable row level security;
alter table public.charger_private enable row level security;
alter table public.charging_bookings enable row level security;

create policy "live chargers are public" on public.community_chargers for select
  using ((status = 'live' and not paused) or host_id = auth.uid());
create policy "verified users host chargers" on public.community_chargers for insert
  with check (host_id = auth.uid() and public.is_verified(auth.uid()) and status = 'pending_review');
create policy "hosts edit their chargers" on public.community_chargers for update
  using (host_id = auth.uid()) with check (host_id = auth.uid());

-- Only EVWorld's review team (service role) can approve or reject a listing.
create or replace function public.protect_review_status() returns trigger
language plpgsql as $$
begin
  if new.status is distinct from old.status and current_user in ('anon', 'authenticated') then
    raise exception 'listing status is set by EVWorld review';
  end if;
  return new;
end $$;
create trigger community_chargers_review before update on public.community_chargers
  for each row execute function public.protect_review_status();
create policy "hosts delete their chargers" on public.community_chargers for delete using (host_id = auth.uid());

create policy "host or accepted driver sees exact location" on public.charger_private for select
  using (public.is_host(charger_id, auth.uid()) or public.has_accepted_booking(charger_id, auth.uid()));
create policy "host writes exact location" on public.charger_private for insert
  with check (public.is_host(charger_id, auth.uid()));
create policy "host updates exact location" on public.charger_private for update
  using (public.is_host(charger_id, auth.uid()));

create policy "driver or host sees booking" on public.charging_bookings for select
  using (driver_id = auth.uid() or public.is_host(charger_id, auth.uid()));
create policy "verified drivers request" on public.charging_bookings for insert
  with check (
    driver_id = auth.uid()
    and status = 'requested'
    and public.is_verified(auth.uid())
    and not public.is_host(charger_id, auth.uid())
    and price_per_kwh = (select c.price_per_kwh from public.community_chargers c where c.id = charger_id and c.status = 'live' and not c.paused)
  );
-- No direct UPDATE policy: status and money change only through the functions below.

-- Allowed steps (same table as the app's nextBookingActions).
create or replace function public.transition_booking(booking uuid, next_status text) returns public.charging_bookings
language plpgsql security definer set search_path = public as $$
declare
  b charging_bookings;
  role text;
begin
  select * into b from charging_bookings where id = booking for update;
  if not found then raise exception 'booking not found'; end if;
  role := case when b.driver_id = auth.uid() then 'driver'
               when is_host(b.charger_id, auth.uid()) then 'host' end;
  if role is null then raise exception 'not your booking'; end if;
  if not (
       (b.status = 'requested' and role = 'host'   and next_status in ('accepted', 'declined'))
    or (b.status = 'requested' and role = 'driver' and next_status = 'cancelled')
    or (b.status = 'accepted'  and role = 'host'   and next_status = 'cancelled')
    or (b.status = 'accepted'  and role = 'driver' and next_status in ('charging', 'cancelled'))
  ) then
    raise exception 'cannot change % booking to % as %', b.status, next_status, role;
  end if;
  update charging_bookings set status = next_status, updated_at = now() where id = booking returning * into b;
  return b;
end $$;

-- Server-side price: energy + 10% service fee (min EGP 5). The host receives the energy amount.
create or replace function public.complete_booking(booking uuid, method text, delivered_kwh numeric) returns public.charging_bookings
language plpgsql security definer set search_path = public as $$
declare
  b charging_bookings;
  energy numeric;
  fee numeric;
begin
  select * into b from charging_bookings where id = booking for update;
  if not found or b.driver_id <> auth.uid() then raise exception 'not your booking'; end if;
  if b.status <> 'charging' then raise exception 'booking is not charging'; end if;
  if delivered_kwh <= 0 or delivered_kwh > 120 then raise exception 'kWh out of range'; end if;
  energy := round(delivered_kwh * b.price_per_kwh, 2);
  fee := round(greatest(5, energy * 0.10), 2);
  update charging_bookings
     set status = 'completed', kwh = delivered_kwh, kwh_method = method,
         energy_cost = energy, service_fee = fee, total = energy + fee, updated_at = now()
   where id = booking returning * into b;
  return b;
end $$;

-- ---------- in-app chat ----------

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('community', 'car', 'shop')),
  subject_id uuid not null,  -- charger, car listing or shop
  booking_id uuid references public.charging_bookings (id),
  created_at timestamptz not null default now()
);
create table public.conversation_members (
  conversation_id uuid references public.conversations (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id),
  body text not null check (length(body) between 1 and 2000),
  masked boolean not null default false,
  created_at timestamptz not null default now()
);
create index messages_by_conversation on public.messages (conversation_id, created_at);

create or replace function public.is_member(conv uuid, uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from conversation_members where conversation_id = conv and user_id = uid)
$$;

create or replace function public.mask_message() returns trigger
language plpgsql as $$
declare r record;
begin
  select * into r from public.mask_contact_info(new.body);
  new.body := r.masked_body;
  new.masked := r.was_masked;
  return new;
end $$;
create trigger messages_mask before insert or update of body on public.messages
  for each row execute function public.mask_message();

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
create policy "members see conversation" on public.conversations for select using (public.is_member(id, auth.uid()));
create policy "members see members" on public.conversation_members for select using (public.is_member(conversation_id, auth.uid()));
create policy "members update own read marker" on public.conversation_members for update using (user_id = auth.uid());
create policy "members read messages" on public.messages for select using (public.is_member(conversation_id, auth.uid()));
create policy "members send as themselves" on public.messages for insert
  with check (sender_id = auth.uid() and public.is_member(conversation_id, auth.uid()) and public.is_verified(auth.uid()));

-- Starting a chat about a charger (host is added automatically; phone numbers never leave the server).
create or replace function public.start_charger_chat(charger uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  conv uuid;
  host uuid;
begin
  if not is_verified(auth.uid()) then raise exception 'verify your mobile number first'; end if;
  select host_id into host from community_chargers where id = charger and status = 'live';
  if host is null then raise exception 'charger not available'; end if;
  select c.id into conv from conversations c
    join conversation_members a on a.conversation_id = c.id and a.user_id = auth.uid()
    join conversation_members h on h.conversation_id = c.id and h.user_id = host
   where c.kind = 'community' and c.subject_id = charger limit 1;
  if conv is null then
    insert into conversations (kind, subject_id) values ('community', charger) returning id into conv;
    insert into conversation_members (conversation_id, user_id) values (conv, auth.uid()), (conv, host);
  end if;
  return conv;
end $$;

-- ---------- access for the API roles ----------
grant usage on schema public to anon, authenticated;
grant select on public.public_profiles, public.vendors, public.community_chargers to anon, authenticated;
grant select, insert, update on public.profiles, public.addresses, public.community_chargers, public.charger_private,
  public.charging_bookings, public.conversations, public.conversation_members, public.messages, public.orders, public.vendor_members to authenticated;
grant delete on public.addresses, public.community_chargers to authenticated;
grant execute on function public.transition_booking(uuid, text), public.complete_booking(uuid, text, numeric),
  public.start_charger_chat(uuid) to authenticated;
