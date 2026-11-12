# Getting accurate charger data in Egypt

*How EVWorld gets real, live charger data from Egypt's charging networks: who to talk to, what to ask for, and how the app is already built to take it.*

---

## 1. Why this matters

Charger accuracy is the core promise of the app. A driver who finds a broken or busy charger at night on the Sahel road will delete the app. Data must come **from the networks themselves**, refreshed every few minutes, with driver reports to fill the gaps.

## 2. Who runs public charging in Egypt (to verify in meetings)

| Network | What's publicly reported | Their app | Notes |
|---|---|---|---|
| **Infinity EV** (Infinity Power) | 200 stations, 700+ charging points across 16 governorates (Feb 2025). Joint venture with Hassan Allam Utilities, Misr Petroleum and Gastec to install chargers at fuel stations | InfinityEV (wallet top-up by card) | Largest network: **first partner to approach** |
| **Sha7en** (MB Engineering Group) | Claims 270+ charging points in 14 governorates. Took over Revolta Egypt's ~65 stations in 2022. Partnership with Petromin Energy announced in 2026 | Sha7en | Second partner |
| **ELSEWEDY Plug** (Elsewedy Electric) | EgyptERA licence (2023). Chargers in residential compounds (e.g. PRE Group) | ELSEWEDY Plug (iOS, Apple Pay) | Strong in compounds; also sells home chargers, so a marketplace partner too |
| **Ikarus Electric** | EgyptERA licence (2023), alongside Plug | — | Smaller |
| **Fuel-station brands** (Misr Petroleum, Gastec, Petromin…) | Hosting chargers through the networks above | — | Location partners, not data owners |
| Others (mall operators, hotels, new entrants) | Many single-site chargers | — | Covered by driver reports + Open Charge Map |

*Figures are each company's own announcements and press reports. Counts change fast, so confirm them directly. Sources are listed at the end.*

**Regulation:** EgyptERA (the electricity regulator) licenses charging operators. The Ministry of Electricity sets maximum public charging tariffs. In 2025–26 the reported caps were roughly **EGP 1.7–3.4/kWh for AC and EGP 3.75–6.55/kWh for DC**. Reports differ, so check the current tariff in the Official Gazette or with EgyptERA.

## 3. How to connect: three options, in order of preference

### Option A: OCPI (the industry standard)
**OCPI** (Open Charge Point Interface) is the free, global protocol charging networks use to share data with apps. EVWorld would be the "eMSP" (e-mobility service provider) and the network the "CPO" (charge point operator). Through OCPI a network shares:
- **Locations**: address, GPS, plugs and power, opening hours, facilities
- **Live status** of every plug (available / charging / out of order), pushed within seconds
- **Tariffs**: price per kWh, per minute, parking fees
- Later: **sessions & payment** ("start charging from the EVWorld app")

**What's built:** `src/core/chargerFeeds.ts` converts OCPI 2.2.1 data into the app's format (tested with a realistic sample), and `src/services/chargerData.ts` downloads it with paging and authentication. Connecting a network that speaks OCPI mostly means exchanging credentials.

**Roaming hubs:** instead of one connection per network, a hub (e.g. Hubject or ENAPI) can carry many networks through one connection. That's worth it once several Egyptian networks are on a hub.

### Option B: the network's own API
Many young networks run white-label software (from charging-management vendors) that already includes OCPI or a REST API. Ask which platform they use; the OCPI module is often a configuration switch.

### Option C: data-sharing agreement + periodic export
For a network without any API: a CSV/JSON export of locations and prices, refreshed weekly. No live status, so driver reports are essential.

### Always: Open Charge Map + driver reports
- **Open Charge Map** is a public, community-maintained database with a free API key. It's good for filling in locations not covered by partners. Live status isn't available. Its client is in `src/services/chargerData.ts`.
- **Driver reports** ("charger broken", "wrong price", photos) are in the app today. In production they go to a moderation queue and automatically flag a charger as "unverified".

The app merges all feeds (`mergeFeeds`). The same site reported by two sources becomes one, live OCPI data wins, and missing prices are filled in from the others. Status older than 15 minutes shows as "unknown".

## 4. What's in it for the networks (the pitch)

1. **More customers:** EVWorld sends drivers to their chargers through the trip planner, especially on highways where drivers plan ahead.
2. **Fewer angry customers:** drivers see real status before they drive there.
3. **Demand data:** where drivers get stranded and which corridors need chargers (anonymous, aggregated). This is valuable for siting new stations.
4. **Later, revenue share:** "start & pay in EVWorld" brings paying sessions. Sponsored placement for new stations.
5. **No cost to them:** OCPI is free, and most charging software already supports it.

## 5. Practical next steps

| # | Step | Owner |
|---|---|---|
| 1 | Meet Infinity EV and Sha7en: ask about OCPI support, their charging software, and data-sharing terms | Business development |
| 2 | Sign a simple data-sharing agreement (data use, refresh rate, attribution, no resale of raw data) | Legal |
| 3 | Get OCPI test credentials, connect in a test environment, verify 20 stations on the ground | Tech + field team |
| 4 | Register for an Open Charge Map API key and review Egypt coverage | Tech |
| 5 | Plan for commercial use of map/routing/weather APIs (Google/Mapbox, weather provider) | Tech + finance |

## Sources

- Infinity network size: [Zawya](https://www.zawya.com/en/press-release/companies-news/infinity-expands-to-16-governorates-reaching-200-ev-charging-stations-with-more-than-700-charging-points-enymk0o8), [eMobility+](https://emobilityplus.com/2025/02/13/infinity-expands-egypts-ev-charging-network-with-200-stations-over-700-charging-points/); fuel-station JV: [EVCandI](https://www.evcandi.com/news/egypt-public-and-private-sectors-combine-expand-ev-charging-network), [ESI Africa](https://www.esi-africa.com/renewable-energy/solar/egypt-partnership-to-grow-ev-charging-infrastructure/)
- Sha7en: [sha7en.co](https://www.sha7en.co/en), [Petromin partnership](https://www.mobilityplaza.com/news/petromin-energy-and-sha7en-partner-to-expand-ev-charging-in-egypt), [Revolta stations](https://enterpriseam.com/egypt/2022/03/21/sha7en-to-operate-manage-revolta-egypt-charging-stations/)
- ELSEWEDY Plug: [Elsewedy Electric](https://elsewedyelectric.com/en/news-room/elsewedy-electric-introduces-plug-for-ev-charging-stations/), [App Store](https://apps.apple.com/us/app/id6504866807), [compounds](https://www.zawya.com/en/business/energy/plug-expands-ev-charging-network-across-egypts-premium-residential-compounds-iq71kk6c), [EgyptERA licence](https://enterpriseam.com/climate/2023/07/05/elsewedy-plug-and-ikarus-electric-set-to-build-ev-charging-stations-in-egypt)
- Tariffs: [EnterpriseAM (2025)](https://enterpriseam.com/egypt/2025/09/07/govt-hikes-ev-charging-tariffs/), [Select](https://select.co.ae/egypts-new-ev-charging-tariffs/), [Daily News Egypt (licensing framework)](https://www.dailynewsegypt.com/2020/09/22/investment-controls-for-charging-stations-ev-tariffs-presented-to-egypt-cabinet/)
- OCPI roaming: [AMPECO OCPI guide](https://www.ampeco.com/guides/the-complete-ocpi-guide/), [AMPECO × ENAPI](https://www.automotiveworld.com/news/ampeco-teams-with-enapi-for-cross-border-charging/)
