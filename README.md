# EVWorld ⚡ 🇪🇬

An all-in-one app for electric-vehicle drivers in Egypt:

1. **Charge**: find chargers with live status, filter by "fits my car", DC fast, free now; navigate, set alerts, report problems.
2. **Range & trip planner**: enter your battery %, pick a destination, and see whether you can make it. If not: where to charge, how long, what it costs, and the chargers near your start and destination.
3. **Marketplace** (multivendor): EV accessories, certified repair shops with online booking, and EVs for sale from dealers and owners.
4. **Community charging**: share your home charger, get paid per kWh. Requests, in-app chat (phone numbers hidden) and payment all happen in the app.
5. **In the car**: trip mode with live battery updates (from the car where possible) and automatic re-planning. Weather-based temperature, AC and driving style filled in automatically. CarPlay / Android Auto screens.
6. **Accounts**: Sign in with Apple / Google, required verified mobile number, delivery addresses.

> 📘 **Non-developers start here:**
> - [`docs/PRODUCT_AND_BUSINESS.md`](docs/PRODUCT_AND_BUSINESS.md): logic, business model, challenges and roadmap in plain language
> - [`docs/CHARGER_DATA_EGYPT.md`](docs/CHARGER_DATA_EGYPT.md): Egypt's charging networks and how to get live, accurate data from them
> - [`docs/CAR_INTEGRATION.md`](docs/CAR_INTEGRATION.md): what CarPlay and Android Auto allow, and how the battery % is read

This is a **working prototype**. All chargers, operators, sellers and prices are fictional demo data, and checkout takes no payment.

---

## Run it

Requirements: Node.js 20+.

```bash
npm install
```

```bash
npm run web        # opens the app in your browser
```

```bash
npm start          # then scan the QR code with the Expo Go app on your phone
```

Other commands:

```bash
npm test           # 85 automated tests for the app logic
```

```bash
npm run test:backend  # runs the database schema in an in-memory PostgreSQL and checks the privacy rules
```

```bash
npm run typecheck  # TypeScript check
```

```bash
npm run build:web  # static web build in dist/
```

```bash
npm run build:demo # the whole web app packed into one shareable HTML file: demo/evworld-demo.html
```

## Project structure

```
src/
  core/            ← the "brain": plain TypeScript, no UI, fully tested
    range.ts         energy use per km and range from battery %
    charging.ts      charging curve, time and cost, plug compatibility
    roads.ts         mini road network of Egypt (realistic distances, no Gulf crossings)
    tripPlanner.ts   fastest chain of charging stops (Dijkstra shortest path)
    stations.ts      filters, nearest chargers, (simulated) live status
    marketplace.ts   multivendor checkout split, commissions, payouts, product fit
    liveBattery.ts   live battery during a trip: estimates, car readings, learning real consumption
    autoConditions.ts  climate by region/month, weather parsing, AC guess, driving-style detection
    community.ts     peer-to-peer charging: pricing, kWh measurement, location privacy, booking steps
    contactMasking.ts  hides phone numbers / emails / WhatsApp links in chats
    identity.ts      Egyptian mobile validation, public names, delivery addresses
    chargerFeeds.ts  OCPI and Open Charge Map → EVWorld stations, merging feeds
    carScreens.ts    CarPlay / Android Auto screen content
  services/        ← talks to the outside world: auth, weather, car data, charger feeds
  data/            ← demo data: EV models, places, chargers, community chargers, vendors, products, cars
  app/             ← screens (Expo Router: one file = one screen)
    (tabs)/          Charge · Trip · Market · Inbox · My EV
    station/[id]     charger details
    marketplace/     products, product, cart, shops, shop booking, cars, car, vendor, sell
    community/       community charger details, host form, my chargers
    chat/[id]        in-app conversation with booking actions
    auth/, account/  sign-in, mobile verification, addresses
    drive, car-connection, car-display   trip mode, battery source, car screen preview
  components/      ← shared UI (map, cards, battery control, …)
  store/           ← app state (car, battery, cart, account, community & chat, trip mode)
__tests__/         ← automated tests
backend/           ← Supabase database schema with privacy rules + its test
docs/              ← product, business, charger-data and car-integration guides
```

## Tech

- **Expo / React Native + TypeScript**: one codebase for iOS, Android and web
- **Maps:** Apple / Google Maps on phones (`react-native-maps`); an offline drawing of Egypt on the web (`EVMap.web.tsx`), so the demo needs no API keys
- **State:** Zustand, persisted with AsyncStorage
- **Tests:** Jest

### Production notes

- Android release builds need a Google Maps API key in `app.json` (`android.config.googleMaps.apiKey`).
- Replace `src/core/roads.ts` estimates with a routing API through the `RoutingProvider` interface.
- Replace the simulated `liveStatus()` in `src/core/stations.ts` with OCPI / partner feeds (`src/services/chargerData.ts`, run on the server).
- Deploy `backend/supabase/schema.sql` to Supabase and enable Apple, Google and phone sign-in there.
- Google sign-in needs OAuth client IDs. Live weather needs a commercial plan (Open-Meteo's free tier is non-commercial).
- CarPlay / Android Auto need a development build, Apple's EV-charging entitlement and Google's car-app review (see `docs/CAR_INTEGRATION.md`).
