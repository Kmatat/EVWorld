# EVWorld ⚡ 🇪🇬

An all-in-one app for electric-vehicle drivers in Egypt:

1. **Charge**: find chargers with live status, filter by "fits my car", DC fast, free now; navigate, set alerts, report problems.
2. **Range & trip planner**: enter your battery %, pick a destination, and see whether you can make it. If not: where to charge, how long, what it costs, and the chargers near your start and destination.
3. **Marketplace** (multivendor): EV accessories, certified repair shops with online booking, and EVs for sale from dealers and owners.

> 📘 **Non-developers start here:** [`docs/PRODUCT_AND_BUSINESS.md`](docs/PRODUCT_AND_BUSINESS.md) explains the logic, business model, challenges and roadmap in plain language.

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
npm test           # 31 automated tests for the range, trip and marketplace logic
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
  data/            ← demo data: EV models, places, chargers, vendors, products, cars
  app/             ← screens (Expo Router: one file = one screen)
    (tabs)/          Charge · Trip · Market · My EV
    station/[id]     charger details
    marketplace/     products, product, cart, shops, shop booking, cars, car, vendor, sell
  components/      ← shared UI (map, cards, battery control, …)
  store/           ← app state saved on the device (car, battery, cart, activity)
__tests__/         ← automated tests
docs/              ← product & business guide
```

## Tech

- **Expo / React Native + TypeScript**: one codebase for iOS, Android and web
- **Maps:** Apple / Google Maps on phones (`react-native-maps`); an offline drawing of Egypt on the web (`EVMap.web.tsx`), so the demo needs no API keys
- **State:** Zustand, persisted with AsyncStorage
- **Tests:** Jest

### Production notes

- Android release builds need a Google Maps API key in `app.json` (`android.config.googleMaps.apiKey`).
- Replace `src/core/roads.ts` estimates with a routing API through the `RoutingProvider` interface.
- Replace the simulated `liveStatus()` in `src/core/stations.ts` with OCPI / partner feeds.
