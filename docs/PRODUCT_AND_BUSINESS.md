# EVWorld: Product & Business Guide

*Written for non-developers. It explains what the prototype does, how the logic works, how the business can make money, and the main challenges before launch.*

---

## 1. What EVWorld is

EVWorld is one app for EV drivers in Egypt, built on three pillars:

| Pillar | What the driver gets | Compared with LiveEV |
|---|---|---|
| **Charge** | Map and list of chargers with live status, filters (fits my car, DC fast, free now, 100 kW+), prices, navigation, "alert me when free", and problem reports | Same core features (LiveEV's store listing describes live status, filters, route planning, alerts and reporting) |
| **Range & trip planner** *(addition 1)* | Enter battery %, pick a destination, and get: can I make it, where to charge, for how long, what it costs, and the chargers near the start and the destination | LiveEV plans routes with charging stops. EVWorld adds a range model built from battery %, car model, temperature, AC, road type and passengers, and shows its full calculation |
| **Marketplace** *(addition 2)* | Multivendor store for EV accessories, booking for certified repair shops, and EVs for sale from dealers and owners | New: LiveEV has no commerce |
| **Community charging** *(addition 3)* | Drivers share home or office chargers and get paid per kWh. Requests, chat and payment happen in the app, and phone numbers stay private | New |
| **In the car** *(addition 4)* | CarPlay / Android Auto screens. Live battery during the trip, from the car where possible. Automatic weather, AC and driving-style inputs | Goes beyond LiveEV's navigation hand-off |

The marketplace is what turns a free utility app into a business. The charging map brings EV drivers in every day. The marketplace monetizes them at the moments they need something: a home charger, an adapter, a repair, or their next car.

---

## 2. What's in the prototype

| Feature | Status in this prototype | What production needs |
|---|---|---|
| Charger map and list, filters, search | ✅ Working (48 demo chargers on real routes) | Real charger data from networks |
| Live plug status, "updated X min ago" | ✅ Simulated (changes every 5 min) | OCPI / partner API feeds |
| Station page: plugs, price, time and cost to charge *my* car | ✅ Working | — |
| Navigate (Google Maps hand-off) | ✅ Working | — |
| Alert me when free, report a problem | ✅ Saved on the phone | Server + push / WhatsApp notifications |
| Battery % input and live range | ✅ Working (manual input) | Optional auto-read (see §5.1) |
| Trip planner with charging stops | ✅ Working (offline road network of Egypt) | Commercial routing API for turn-by-turn accuracy |
| "How we calculated this" panel | ✅ Working | — |
| 16 EV models + custom car | ✅ Working | Bigger catalogue, trims |
| Accessories: browse, "fits my car", cart, multivendor checkout | ✅ Working (demo payment) | Payment gateway, vendor portal, delivery |
| Repair shops: services, booking with time slots | ✅ Working (demo) | Shop calendar sync, confirmations |
| Cars for sale: filters, battery health, "can it do my trips?", offers, inspection booking | ✅ Working (demo) | Photo upload, ID verification, moderation |
| Sell on EVWorld: business application, earnings calculator, list my car | ✅ Working (demo) | Vendor onboarding, KYC, admin panel |
| Sign in with Apple / Google, required verified mobile (OTP), delivery addresses | ✅ Working (Apple real on iPhone; Google & SMS simulated) | Supabase Auth + SMS provider |
| Community chargers: host form, approximate pin, requests, accept, pay per kWh, ratings | ✅ Working (other side simulated) | Server (schema ready) |
| In-app chat with automatic hiding of phone numbers, emails, WhatsApp links | ✅ Working | Server realtime (schema ready, masking enforced in the database) |
| Trip mode: live battery, next stop, automatic re-plan, learning real consumption | ✅ Working (GPS on phones, simulator in the demo) | — |
| Battery from the car | ✅ Demo car; Android Auto bridge ready in code | Native car module, car-data provider contract |
| CarPlay / Android Auto screens | ✅ In-app preview; screen logic built and tested | Native module + Apple/Google approval |
| Automatic temperature (weather) / AC / road type / driving style | ✅ Working (typical-climate fallback offline) | Commercial weather plan |
| Real charger feeds (OCPI, Open Charge Map) | ✅ Connectors built and tested with sample data | Data agreements with networks |
| Backend with privacy rules (who sees phone, exact location, messages, orders) | ✅ Database schema, tested (6 checks) | Deploy on Supabase |
| Arabic / right-to-left | ❌ Not yet | Required for launch |
| Admin / review panel | ❌ Not yet | Required for launch |

All operators, sellers, products and prices are **fictional demo data**. They are clearly labelled in the app.

---

## 3. How the logic works (plain language)

### 3.1 Range: "how far can I go with X%?"

```
safe range = (energy left in the battery − safety reserve) ÷ energy used per km
```

**Energy left** = battery size × battery %. Example: a BYD Atto 3 has 60.5 kWh usable, so 64% ≈ 38.7 kWh.

**Safety reserve:** we never plan to arrive below 10% (the driver can change this). Arriving at 0% is not acceptable.

**Energy used per km** starts from the official WLTP figure and is adjusted for real life:

| Factor | Effect | Why |
|---|---|---|
| WLTP → real world | +10% | WLTP is a lab test and optimistic |
| Highway (100–120 km/h) | +22% | Air resistance grows fast with speed |
| City | −12% | Regenerative braking recovers energy |
| Air-conditioning | +0.5 to 2.5 kW of constant power | A fixed draw, so it hurts most in slow Cairo traffic: 1.6 kW at 28 km/h adds ~57 Wh/km, but only ~16 Wh/km at 100 km/h |
| Driving style | Eco −7% / Sporty +12% | — |
| Passengers | +1.5% per extra person | Weight |

**Worked example** (in the app under *Trip → How we calculated this*): BYD Atto 3, 64%, highway, 32°C, AC on, 2 people → ~212 Wh/km → **154 km safe range** (182 km to empty).

### 3.2 Road distances

Straight lines are misleading in Egypt. Zafarana and El Tor are 135 km apart in a straight line, but the drive is 300+ km around the Gulf of Suez, through the Ahmed Hamdi tunnel. The prototype contains a **mini map of Egypt's main highways** (43 junctions: Cairo–Alex desert road, Sahel coastal road, Sokhna and the Red Sea road, Sinai through the tunnel, the Nile valley, the Delta and Canal). It finds the shortest way through them. Results are close to real distances: Cairo→Hurghada ≈ 470 km, Cairo→Sharm ≈ 500 km, Cairo→Aswan ≈ 850 km.

In production, a routing API (Google Directions or Mapbox) replaces this for exact, traffic-aware routes. The code is built so this is a contained swap.

### 3.3 Charging time and cost

- Speed is limited by **the lower of the charger's power and what the car accepts**. An Atto 3 takes at most 88 kW even on a 180 kW charger, and 7 kW AC even on a 22 kW post.
- Batteries charge **fast when low and slowly above ~80%**, to protect the battery. The app models this curve, which is why it usually suggests stopping around 80%.
- **Cost** = energy put in the battery + ~8% charging losses (the charger bills for these too) × price per kWh.

### 3.4 The trip planner: "can I make it, and where do I charge?"

1. Estimate distance and energy → battery % on arrival. If that's at least the reserve, no stop is needed ("You can reach … without charging").
2. Otherwise, collect chargers that are **near the route, fit the car's plug, and are online**. Busy chargers stay in the list with **+15 min expected waiting**.
3. Compare **every possible chain of stops** (start → A → B → destination) and keep the one with the **shortest total trip time**: driving + charging + ~8 min per stop to park and plug in. Fast chargers and fewer stops win naturally. (Technically: Dijkstra's shortest-path algorithm, the same idea navigation apps use. It runs in milliseconds.)
4. At each stop, **charge just enough** to reach the next stop with the reserve plus a small buffer. Charging is fastest when the battery is low, so this is what experienced EV drivers do.
5. If no chain works, the app says **how far you can get** and shows the nearest chargers. This exposes real gaps in Egypt's network, e.g. Upper Egypt when a station is down.
6. **Recalculate** takes your current GPS position and battery and re-runs the plan with the latest charger status.

The planner also finds **chargers on your route that don't fit your plug**. For a China-spec car (GB/T plug) it points to a CCS2→GB/T adapter in the marketplace. This is a natural, useful cross-sell.

### 3.5 Live charger status

In production, status comes from each charging network through **OCPI** (Open Charge Point Interface, the global standard for sharing charger status, location and price data between networks and apps) or through a private partner API. Driver reports fill the gaps. In the prototype, status is simulated so the app behaves "live".

### 3.6 The multivendor marketplace

- **One basket, many sellers.** The customer checks out once. Behind the scenes the basket is split into **one order per seller**. Each seller ships their own items and charges their own delivery fee (or offers free delivery above a threshold).
- **Commission by category** (placeholder rates): home chargers 6%, portable chargers 8%, cables & adapters 10%, interior/exterior 12%, electronics 10%, services 10%. Margins differ by category, so rates do too.
- **Payouts:** EVWorld collects the money (card, mobile wallet/InstaPay, Fawry, cash on delivery). It releases it to the seller after delivery and the return window, minus commission. This is buyer protection (escrow).
- **Repair shops:** listed with high-voltage-certified technicians, services with prices from X, online booking by day and time slot, "comes to you" mobile service.
- **Cars for sale** (dealers and owners): price, km, spec (Egypt agent / European / Gulf / China spec), and above all **battery health**. Badges separate *certified* from *seller-reported*. "Can this car do your trips?" reuses the range engine. One tap books a pre-purchase battery inspection at a partner workshop, which links the car marketplace to the services marketplace.
- **Personalization:** every product knows which car models or plugs it fits. The app shows "Fits your BYD Atto 3" and "Picked for your car".

### 3.7 Live battery during a trip
- **Real readings** come from the car when possible: Android Auto, a connected-car account (Enode / Smartcar: BYD, MG, Tesla, Hyundai/Kia…) or an OBD dongle.
- **Between readings** the app estimates: battery drops by km driven × energy per km.
- **Learning:** when a real reading arrives, the app compares it with its estimate and learns this car's real consumption. The result is saved as a personal factor (e.g. "+8% vs the model"), so every future range and trip plan gets more accurate.
- **Re-planning:** the plan is recalculated automatically when the battery is 3%+ off the plan, every 25 km, or every 15 minutes (charger availability changes).
- Apple does **not** allow apps to read car data through CarPlay. On iPhone the live battery therefore comes from a car account or OBD dongle (details in [CAR_INTEGRATION.md](CAR_INTEGRATION.md)).

### 3.8 Automatic driving conditions
- **Temperature:** live weather at the start and destination (the warmer one counts, since AC load follows the heat). Offline: the typical daytime temperature for that part of Egypt and that month (Luxor in July ≈ 41°C, Alexandria ≈ 30°C).
- **AC:** from the car where it reports it. Otherwise on above 26°C (or below 12°C for heating), which is right most of the year in Egypt.
- **Road type:** from the trip distance, then from live speed.
- **Driving style:** detected from real driving (hard accelerations/braking per 10 km, share of time above 130 km/h). Once the car reports real battery use, the learned consumption replaces the style guess entirely.

### 3.9 Community charging (peer-to-peer)
1. A host lists a charger: plug type, power, price per kWh, hours, parking type, area. EVWorld suggests a price from the host's own electricity cost and shows a monthly earnings estimate.
2. The listing is **public**. By default the map shows an **approximate pin 250–450 m away**, and the exact spot and access instructions ("black gate, ring flat 3") go only to drivers whose request the host accepts. Hosts can switch to an exact pin.
3. A driver requests a time slot and an amount (kWh). The host accepts or declines in the chat.
4. After charging, kWh are measured by the host's smart charger, by meter readings (photo before/after), or estimated from charging time × power.
5. **The driver pays the host's price plus a 10% service fee** (min EGP 5). The host receives the full energy amount, and both rate each other.

### 3.10 Accounts, mobile number and privacy
- Sign in with **Apple or Google**, then a **verified Egyptian mobile number is required** (OTP by SMS) before ordering, chatting, booking or hosting. Browsing stays open without an account, which Apple's App Store rules expect.
- Offering Google sign-in makes Sign in with Apple mandatory on iPhone. Both are offered.
- Other users see only **"First L."**, a verified-mobile badge and ratings. Never the phone number.
- **Chats** automatically hide phone numbers (including Arabic digits and spelled-out numbers), emails, and WhatsApp/Telegram/social links. Prices, kW and times stay readable. The same rule runs inside the database, so a modified app can't bypass it.
- **Delivery addresses** (governorate, city, street, building, floor, apartment, landmark, optional map pin) stay in the user's address book. A seller only sees the address and phone **snapshot on their own order**.

---

## 4. Business model

| Revenue stream | How it works | Placeholder price |
|---|---|---|
| Accessory commission | % of every product sale | 6–12% by category |
| Service bookings | % of booked service value, or a fee per confirmed booking | 10% |
| Featured car listings | Owner pays to be on top for 14 days | EGP 750 |
| Dealer subscription | Unlimited listings, dealer badge, lead dashboard | EGP 4,500 / month |
| Battery inspection reports | Share of the inspection fee with partner workshops | EGP 1,500 per report (shared) |
| Sponsored placement | Brands and operators promote products or chargers to matching drivers ("adapter for your GB/T car") | CPM / CPC |
| Community charging fee | Service fee paid by the driver on every peer-to-peer session | 10% (min EGP 5) |
| Charging-network partnerships (later) | "Start & pay in EVWorld" at partner networks, sponsored new stations | Revenue share |
| Driver premium (later) | Advanced planner, unlimited alerts, auto battery sync | Monthly subscription |
| Data & insights (later) | Anonymous demand data for charging operators, investors and government ("where are drivers getting stranded?") | B2B contracts |

**Example unit economics** for one accessory order of EGP 10,000 (cables & adapters, paid by card):
commission EGP 1,000 − payment gateway (~2.75%) EGP 275 = **EGP 725 net to EVWorld**. The seller receives EGP 9,000 plus their delivery fee.

*All prices and rates are assumptions to validate with sellers before launch.*

---

## 5. Key challenges (and how to handle them)

### 5.1 Reading the battery % automatically, the hardest technical piece

| Option | Pros | Cons |
|---|---|---|
| **Manual input** (prototype) | Works for every car, zero cost | Driver has to type it |
| **Connected-car APIs** (aggregators that connect to carmakers' clouds) | Automatic, accurate, no hardware | Monthly fee per car. Good for Tesla, BMW, Hyundai/Kia, Mercedes, VW. **Weak coverage for Chinese brands (BYD, MG, grey imports), which dominate in Egypt** |
| **Bluetooth OBD-II dongle** | Works offline and with many Chinese cars | Hardware logistics (~EGP 1,500); each model needs its own decoding |
| **Android Automotive / Android Auto** | Native, free | Only some cars; Apple CarPlay limits this for third parties |

**CarPlay vs Android Auto:** both can show EVWorld on the car screen (as an EV-charging app, after Apple/Google approval). Only Android Auto can pass the battery % to the app, and only for cars that share it. Apple doesn't allow it through CarPlay.

**Recommendation (now built into the app's design):** manual input plus distance-based estimates for everyone, with learning of each car's real consumption. Add Android Auto battery where available. Make connected-car accounts a premium feature (Enode made BYD and MG generally available in January 2026, which matters for Egypt). Pilot an OBD dongle sold in the marketplace for cars without a cloud API.

### 5.2 Charger data accuracy and live status
Live status is only as good as the data feeds. Sign data partnerships with every network (OCPI where supported), starting with the largest (Infinity EV, then Sha7en and ELSEWEDY Plug). Add driver reports and photos, with a verification team. LiveEV already aggregates networks, so EVWorld must match on data quality and win on the planner, community chargers and the marketplace. Full plan, operator list and pitch: [CHARGER_DATA_EGYPT.md](CHARGER_DATA_EGYPT.md).

### 5.3 Plug fragmentation in Egypt
CCS2 is the public standard, but many imported cars use **GB/T** and older Leafs use **CHAdeMO**, which is rare. The app handles this per car, and it's a product opportunity: adapters, portable chargers, and clear "fits your car" labelling.

### 5.4 Marketplace cold start (chicken-and-egg)
Sellers won't join without buyers, and buyers won't come without products. Use the free charging app to build the driver base first. Hand-pick the first 20–30 vendors in high-intent categories: home chargers + installation, adapters, battery inspection, repair. Waive commission for early sellers.

### 5.5 Trust and fraud (especially cars)
Verify vendors with their commercial register, and owners with their national ID. Use certified battery reports, keep phone numbers private (in-app chat / WhatsApp relay), show "never pay a deposit before seeing the car" safety tips, add report-listing tools, and moderate listings before they go live.

### 5.6 Payments, payouts and tax in Egypt
Cash on delivery is still common. It raises return and fraud risk, so add a small COD fee. Online payments need a local gateway, escrow logic, refunds, scheduled vendor payouts, and compliance with e-invoicing / VAT requirements. Plan finance operations early.

### 5.7 Legal and regulatory
Marketplace liability, consumer-protection rules (returns, warranties), and Egypt's personal-data-protection law (location data is sensitive). Range estimates need a clear disclaimer. **Take local legal advice before launch.**

### 5.8 Community charging: legal, safety and trust
- **Is reselling home electricity allowed?** EgyptERA licenses charging operators, and public charging tariffs are regulated. Charging a fee for electricity from a residential meter may not be allowed as-is. Options to validate with a lawyer and EgyptERA:
  1. present it as **cost-sharing** for the host's electricity plus a platform service fee;
  2. partner with a **licensed operator** that owns the commercial relationship;
  3. limit hosting to **businesses** (offices, cafés, hotels, compounds) that can be licensed.
- **Safety:** home wiring must be rated for EV charging. Ask hosts to confirm a dedicated breaker, and offer a paid inspection through partner electricians in the marketplace (another revenue line). Consider insurance for damage during sessions.
- **Trust:** verified mobiles, ratings on both sides, approximate location until accepted, in-app chat only, payment held by EVWorld until the session is complete, and a report button.
- **kWh disputes:** smart chargers with an app or OCPP connection report kWh automatically, so prefer them. Otherwise use meter photos before/after. Time-based estimates come last.

### 5.9 Localization
Arabic with right-to-left layout must be first-class, not an afterthought. EGP pricing, local payment methods, WhatsApp as the main communication channel.

---

## 6. From prototype to launch: suggested roadmap

| Phase | Scope |
|---|---|
| **1. MVP launch** | Deploy the backend (schema ready), admin & review panel, real charger data with 2–3 network partners, Arabic/RTL, SMS OTP, push notifications, payment gateway, vendor portal, App Store & Google Play release |
| **2. Car & community** | CarPlay / Android Auto (entitlement + native module), Android Auto battery, connected-car accounts (premium), community charging pilot in 2–3 compounds after the legal review, OCPI live status for all partners |
| **2b. Growth** | Car listings with photos and ID verification, ratings and reviews, WhatsApp alerts, OBD dongle pilot |
| **3. Scale** | Courier integration, sponsored listings, fleet/B2B accounts, in-app charging payments with operators, data products |

**Team for phase 1:** 2 mobile developers (the codebase already runs on iOS, Android and web), 1 backend developer, 1 product designer, 1 product manager, and 1–2 people for vendor onboarding and data quality.

---

## 7. KPIs to track

- **Drivers:** monthly active users, trips planned, % of plans with a stop, "stranded" warnings (shows where the network has gaps)
- **Data quality:** reports per station, time to fix, % of stations with live status
- **Marketplace:** GMV (total sales value), take rate, orders per active seller, repeat purchase rate, booking conversion, car-listing leads
- **Trust:** dispute and return rate, fraud reports, seller rating

---

## 8. Technology in one paragraph

One codebase (React Native with Expo, TypeScript) produces the **iPhone app, Android app and a web version**. All calculations live in a separate "core" module with automated tests (85 tests): range, charging, trip planner, live battery & learning, automatic conditions, marketplace checkout, community pricing, contact masking, charger feeds and car screens. The backend design (`backend/supabase/schema.sql`) puts the privacy and payment rules inside the database. It is checked by 6 automated tests on a real PostgreSQL engine. The phone apps use Apple / Google Maps. The web demo uses a built-in drawing of Egypt, so it runs without map keys.
