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
| Arabic / right-to-left | ❌ Not yet | Required for launch |
| User accounts, backend, admin | ❌ Not yet (everything is stored on the phone) | Required for launch |

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

**Recommendation:** launch with manual input and learn each driver's real consumption from their trips. Add connected-car APIs for supported brands as a premium feature. Pilot an OBD dongle (possibly sold in the marketplace) for Chinese brands.

### 5.2 Charger data accuracy and live status
Live status is only as good as the data feeds. Sign data partnerships with every network (OCPI where supported). Add driver reports and photos, with a verification team. LiveEV already aggregates networks, so EVWorld must match on data quality and win on the planner and the marketplace.

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

### 5.8 Localization
Arabic with right-to-left layout must be first-class, not an afterthought. EGP pricing, local payment methods, WhatsApp as the main communication channel.

---

## 6. From prototype to launch: suggested roadmap

| Phase | Scope |
|---|---|
| **1. MVP launch** | Backend (accounts, database, admin panel), real charger data with 2–3 network partners, Arabic/RTL, push notifications, payment gateway, vendor portal for accessories and shops, App Store and Google Play release |
| **2. Growth** | OCPI live status for all partners, car listings with photos and ID verification, ratings and reviews, connected-car battery sync (premium), WhatsApp alerts |
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

One codebase (React Native with Expo, TypeScript) produces the **iPhone app, Android app and a web version**. All calculations (range, charging, trip planner, marketplace checkout) live in a separate "core" module with automated tests (31 tests). That module can later also run on the server. The phone apps use Apple / Google Maps. The web demo uses a built-in drawing of Egypt, so it runs without map keys.
