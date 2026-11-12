#!/usr/bin/env node
/**
 * Runs backend/supabase/schema.sql in an in-memory PostgreSQL (PGlite) and
 * checks the privacy and money rules from the point of view of different
 * users. Supabase's auth schema is stubbed for the test.
 *
 *   npm run test:backend
 */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const db = new PGlite();
const HOST = '11111111-1111-1111-1111-111111111111';
const DRIVER = '22222222-2222-2222-2222-222222222222';
const STRANGER = '33333333-3333-3333-3333-333333333333';
const UNVERIFIED = '44444444-4444-4444-4444-444444444444';
const SELLER = '55555555-5555-5555-5555-555555555555';

// --- Supabase stand-ins ---
await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon nologin;
  create role authenticated nologin;
  grant usage on schema auth to anon, authenticated;
`);
await db.exec(readFileSync(new URL('./supabase/schema.sql', import.meta.url), 'utf8'));

// --- seed as admin ---
await db.exec(`
  insert into auth.users values ('${HOST}'), ('${DRIVER}'), ('${STRANGER}'), ('${UNVERIFIED}'), ('${SELLER}');
  insert into public.profiles (id, full_name, phone, phone_verified_at) values
    ('${HOST}', 'Mona Samir Hassan', '+201012345678', now()),
    ('${DRIVER}', 'Omar Khaled', '+201112345678', now()),
    ('${STRANGER}', 'Sara Adel', '+201212345678', now()),
    ('${UNVERIFIED}', 'New User', null, null),
    ('${SELLER}', 'Volt Gear', '+201512345678', now());
`);

/** Run SQL as a signed-in user (RLS applies). */
async function as(uid, sql, params = []) {
  await db.exec(`reset role; set request.jwt.claim.sub = '${uid}'; set role authenticated;`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('reset role;');
  }
}
async function expectError(promise, pattern, label) {
  try {
    await promise;
  } catch (e) {
    assert.match(String(e.message), pattern, label);
    return;
  }
  assert.fail(`expected an error: ${label}`);
}
let passed = 0;
const ok = (label) => {
  passed++;
  console.log('  ✓', label);
};

// 1. Phone numbers are private; others see "First L." only.
{
  const own = await as(DRIVER, `select phone from public.profiles where id = $1`, [DRIVER]);
  assert.equal(own.rows[0].phone, '+201112345678');
  const other = await as(DRIVER, `select phone from public.profiles where id = $1`, [HOST]);
  assert.equal(other.rows.length, 0);
  const pub = await as(DRIVER, `select * from public.public_profiles where id = $1`, [HOST]);
  assert.equal(pub.rows[0].display_name, 'Mona H.');
  assert.equal('phone' in pub.rows[0], false);
  ok('phone numbers are visible only to their owner; others see "Mona H."');
}

// 2. Only verified users can host; hosts cannot approve themselves.
let chargerId;
{
  await expectError(
    as(UNVERIFIED, `insert into public.community_chargers (host_id, title, plug, power_kw, price_per_kwh, area, city, availability, parking)
                    values ($1, 'My wallbox', 'type2_tethered', 7.4, 3, 'Zayed', 'Giza', '{"days":[0],"from":"08:00","to":"22:00"}', 'villa_driveway')`, [UNVERIFIED]),
    /row-level security/,
    'unverified host blocked',
  );
  const r = await as(HOST, `insert into public.community_chargers (host_id, title, plug, power_kw, price_per_kwh, area, city, availability, parking)
                            values ($1, 'Villa wallbox', 'type2_tethered', 7.4, 3, 'Sheikh Zayed', 'Giza', '{"days":[0,1,2,3,4,5,6],"from":"08:00","to":"23:00"}', 'villa_driveway') returning id`, [HOST]);
  chargerId = r.rows[0].id;
  await as(HOST, `insert into public.charger_private (charger_id, lat, lng, access_instructions) values ($1, 30.0335, 30.9712, 'Black gate, ring the bell')`, [chargerId]);
  await expectError(as(HOST, `update public.community_chargers set status = 'live' where id = $1`, [chargerId]), /set by EVWorld review/, 'self-approval blocked');
  const hidden = await as(DRIVER, `select id from public.community_chargers where id = $1`, [chargerId]);
  assert.equal(hidden.rows.length, 0, 'pending listing hidden from others');
  await db.query(`update public.community_chargers set status = 'live' where id = $1`, [chargerId]); // review team
  ok('only verified users can host; listings go live only after review');
}

// 3. Exact location stays private until the host accepts.
let bookingId;
{
  const pub = await as(DRIVER, `select public_lat, public_lng from public.community_chargers where id = $1`, [chargerId]);
  const { public_lat, public_lng } = pub.rows[0];
  const meters = Math.hypot((public_lat - 30.0335) * 111320, (public_lng - 30.9712) * 111320 * Math.cos((30.0335 * Math.PI) / 180));
  assert.ok(meters >= 240 && meters <= 460, `approximate pin ${meters.toFixed(0)} m away`);
  const before = await as(DRIVER, `select * from public.charger_private where charger_id = $1`, [chargerId]);
  assert.equal(before.rows.length, 0);
  await expectError(
    as(DRIVER, `insert into public.charging_bookings (charger_id, driver_id, slot_start, est_kwh, price_per_kwh) values ($1, $2, now() + interval '1 hour', 20, 1.00)`, [chargerId, DRIVER]),
    /row-level security/,
    'wrong price snapshot rejected',
  );
  const b = await as(DRIVER, `insert into public.charging_bookings (charger_id, driver_id, slot_start, est_kwh, price_per_kwh) values ($1, $2, now() + interval '1 hour', 20, 3) returning id`, [chargerId, DRIVER]);
  bookingId = b.rows[0].id;
  await expectError(as(DRIVER, `select public.transition_booking($1, 'accepted')`, [bookingId]), /cannot change requested booking to accepted as driver/, 'driver cannot accept');
  await as(HOST, `select public.transition_booking($1, 'accepted')`, [bookingId]);
  const after = await as(DRIVER, `select access_instructions, lat from public.charger_private where charger_id = $1`, [chargerId]);
  assert.equal(after.rows[0].access_instructions, 'Black gate, ring the bell');
  const stranger = await as(STRANGER, `select * from public.charger_private where charger_id = $1`, [chargerId]);
  assert.equal(stranger.rows.length, 0);
  ok('approximate pin is 250–450 m off; exact spot only for the host and accepted drivers');
}

// 4. Server-side pricing.
{
  await expectError(as(DRIVER, `select public.complete_booking($1, 'meter', 20)`, [bookingId]), /not charging/, 'must be charging first');
  await as(DRIVER, `select public.transition_booking($1, 'charging')`, [bookingId]);
  const r = await as(DRIVER, `select * from public.complete_booking($1, 'meter', 20)`, [bookingId]);
  assert.equal(Number(r.rows[0].energy_cost), 60);
  assert.equal(Number(r.rows[0].service_fee), 6);
  assert.equal(Number(r.rows[0].total), 66);
  await expectError(as(DRIVER, `update public.charging_bookings set total = 1 where id = $1 returning id`, [bookingId]).then((x) => { if (x.rows.length === 0) throw new Error('row-level security: no rows'); }), /row-level security/, 'no direct edits');
  const strangerView = await as(STRANGER, `select * from public.charging_bookings where id = $1`, [bookingId]);
  assert.equal(strangerView.rows.length, 0);
  ok('booking steps are enforced and the price (60 + 6 fee = 66) is computed by the server');
}

// 5. Chat: members only, contact details removed before storage.
{
  const conv = (await as(DRIVER, `select public.start_charger_chat($1) as id`, [chargerId])).rows[0].id;
  await as(DRIVER, `insert into public.messages (conversation_id, sender_id, body) values ($1, $2, 'Call me on ٠١٠ ١٢٣٤ ٥٦٧٨ or wa.me/201012345678')`, [conv, DRIVER]);
  await as(HOST, `insert into public.messages (conversation_id, sender_id, body) values ($1, $2, 'Charger is 7.4 kW, come at 10:30')`, [conv, HOST]);
  const msgs = await as(HOST, `select body, masked from public.messages where conversation_id = $1 order by created_at`, [conv]);
  assert.equal(msgs.rows[0].body, 'Call me on [contact hidden] or [contact hidden]');
  assert.equal(msgs.rows[0].masked, true);
  assert.equal(msgs.rows[1].body, 'Charger is 7.4 kW, come at 10:30');
  assert.equal(msgs.rows[1].masked, false);
  const stranger = await as(STRANGER, `select * from public.messages where conversation_id = $1`, [conv]);
  assert.equal(stranger.rows.length, 0);
  await expectError(as(STRANGER, `insert into public.messages (conversation_id, sender_id, body) values ($1, $2, 'hi')`, [conv, STRANGER]), /row-level security/, 'non-member cannot post');
  ok('chats are members-only and phone numbers / WhatsApp links are removed server-side');
}

// 6. Delivery address goes only to the shipping seller.
{
  const vendor = (await db.query(`insert into public.vendors (name, verified) values ('VoltGear', true) returning id`)).rows[0].id;
  await db.query(`insert into public.vendor_members values ($1, $2)`, [vendor, SELLER]);
  await as(DRIVER, `insert into public.addresses (user_id, governorate, city, street, building, is_default) values ($1, 'Cairo', 'New Cairo', '90th Street', '12', true)`, [DRIVER]);
  await as(DRIVER, `insert into public.orders (buyer_id, vendor_id, deliver_to, contact_phone, total) values ($1, $2, 'Bldg 12, 90th Street, New Cairo, Cairo', '+201112345678', 6500)`, [DRIVER, vendor]);
  const seller = await as(SELLER, `select deliver_to, contact_phone from public.orders`);
  assert.equal(seller.rows.length, 1);
  const sellerAddresses = await as(SELLER, `select * from public.addresses`);
  assert.equal(sellerAddresses.rows.length, 0);
  const stranger = await as(STRANGER, `select * from public.orders`);
  assert.equal(stranger.rows.length, 0);
  await expectError(as(UNVERIFIED, `insert into public.orders (buyer_id, vendor_id, deliver_to, contact_phone, total) values ($1, $2, 'x', 'y', 1)`, [UNVERIFIED, vendor]), /row-level security/, 'unverified cannot order');
  ok("the seller sees only their order's delivery snapshot, never the address book");
}

console.log(`\n${passed} backend checks passed`);
