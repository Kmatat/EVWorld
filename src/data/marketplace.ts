import { CarListing, Product, ServiceShop, Vendor } from '@/core/marketplace';

/**
 * DEMO MARKETPLACE DATA. All sellers, products and prices are fictional.
 * In production, vendors sign up through the seller portal. They add their
 * own listings, and the platform reviews them before they go live.
 */

export const VENDORS: Vendor[] = [
  { id: 'v-voltgear', name: 'VoltGear Egypt', type: 'accessories', city: 'Cairo', verified: true, rating: 4.8, reviews: 412, since: 2023, color: '#0E9F6E', description: 'Chargers, cables and adapters for every EV sold in Egypt. Same-day delivery in Cairo & Giza.', deliveryFeeEgp: 60, freeDeliveryOverEgp: 5000 },
  { id: 'v-ampere', name: 'Ampere Home Charging', type: 'accessories', city: 'Cairo', verified: true, rating: 4.7, reviews: 188, since: 2022, color: '#2563EB', description: 'Wallbox supply and certified installation, including the electricity-company paperwork.', deliveryFeeEgp: 0 },
  { id: 'v-chargego', name: 'Charge&Go Supplies', type: 'accessories', city: 'Alexandria', verified: true, rating: 4.5, reviews: 97, since: 2024, color: '#9333EA', description: 'Portable chargers and GB/T solutions for imported cars. Ships nationwide.', deliveryFeeEgp: 85, freeDeliveryOverEgp: 3000 },
  { id: 'v-autostyle', name: 'AutoStyle EV', type: 'accessories', city: 'Giza', verified: false, rating: 4.3, reviews: 54, since: 2025, color: '#D97706', description: 'Interior and exterior accessories made for BYD, MG and Tesla models.', deliveryFeeEgp: 50 },
  { id: 'v-evdoctor', name: 'EV Doctor Service Center', type: 'service_center', city: 'New Cairo', verified: true, rating: 4.9, reviews: 233, since: 2022, color: '#E11D48', description: 'High-voltage certified technicians. Battery diagnostics, AC, software and brakes.', deliveryFeeEgp: 0 },
  { id: 'v-greengarage', name: 'Green Garage', type: 'service_center', city: '6th of October', verified: true, rating: 4.6, reviews: 141, since: 2023, color: '#059669', description: 'Tires, suspension, alignment and body work for electric cars.', deliveryFeeEgp: 0 },
  { id: 'v-batterylab', name: 'BatteryLab Egypt', type: 'service_center', city: 'Alexandria', verified: true, rating: 4.7, reviews: 76, since: 2024, color: '#7C3AED', description: 'Battery health certificates, cell balancing and module repair.', deliveryFeeEgp: 0 },
  { id: 'v-nilemotors', name: 'Nile Motors EV', type: 'dealer', city: 'Cairo', verified: true, rating: 4.6, reviews: 120, since: 2021, color: '#0369A1', description: 'Certified pre-owned EVs with inspection report and 6-month warranty.', deliveryFeeEgp: 0 },
  { id: 'v-futureauto', name: 'Future Auto Trading', type: 'dealer', city: 'Alexandria', verified: true, rating: 4.4, reviews: 65, since: 2023, color: '#B45309', description: 'New and used imported EVs, including China-spec models.', deliveryFeeEgp: 0 },
  { id: 'v-owner', name: 'Private owners', type: 'private_seller', city: 'Egypt', verified: false, rating: 0, reviews: 0, since: 2026, color: '#475569', description: 'Cars listed directly by their owners, with ID-verified accounts.', deliveryFeeEgp: 0 },
];

export const PRODUCTS: Product[] = [
  { id: 'p-wallbox7', vendorId: 'v-ampere', title: '7 kW Wallbox Charger (Type 2)', category: 'home_charging', priceEgp: 28500, compareAtEgp: 31000, stock: 14, rating: 4.8, reviews: 63, compatibleWith: ['type2'], description: 'Single-phase 32A wallbox with a 5 m tethered cable. Charges most EVs from 10% to 100% overnight.', icon: 'home-outline' },
  { id: 'p-wallbox11', vendorId: 'v-ampere', title: '11 kW Smart Wallbox + App', category: 'home_charging', priceEgp: 42000, stock: 8, rating: 4.9, reviews: 41, compatibleWith: ['type2'], description: 'Three-phase smart charger. Schedule charging for off-peak hours and track kWh in the app.', icon: 'home-outline' },
  { id: 'p-install', vendorId: 'v-ampere', title: 'Wallbox Installation (Cairo & Giza)', category: 'home_charging', priceEgp: 3500, stock: 99, rating: 4.7, reviews: 88, compatibleWith: [], description: 'Site survey, cabling up to 15 m, breaker and earthing by a certified electrician.', icon: 'construct-outline' },
  { id: 'p-portable-t2', vendorId: 'v-voltgear', title: 'Portable Charger 3.5 kW (Type 2)', category: 'portable_charging', priceEgp: 9800, stock: 37, rating: 4.6, reviews: 120, compatibleWith: ['type2'], description: 'Plugs into a normal wall socket. Adjustable 8–16A with an LCD screen. Ideal backup for trips.', icon: 'battery-charging-outline' },
  { id: 'p-portable-gbt', vendorId: 'v-chargego', title: 'Portable Charger 3.5 kW (GB/T)', category: 'portable_charging', priceEgp: 8900, stock: 22, rating: 4.4, reviews: 58, compatibleWith: ['gbt_ac'], description: 'For China-spec cars with a GB/T AC socket. Wall-socket plug, adjustable current.', icon: 'battery-charging-outline' },
  { id: 'p-adapter-ccs-gbt', vendorId: 'v-chargego', title: 'CCS2 → GB/T DC Fast-Charge Adapter', category: 'cables_adapters', priceEgp: 27500, stock: 6, rating: 4.5, reviews: 31, compatibleWith: ['gbt_dc'], description: 'Lets China-spec cars use CCS2 fast chargers, up to 250 kW. Unlocks most public DC stations.', icon: 'swap-horizontal-outline', unlocksConnectors: ['ccs2'] },
  { id: 'p-adapter-t2-gbt', vendorId: 'v-chargego', title: 'Type 2 → GB/T AC Adapter', category: 'cables_adapters', priceEgp: 3900, stock: 40, rating: 4.6, reviews: 77, compatibleWith: ['gbt_ac'], description: 'Use any Type 2 AC charger or wallbox with a GB/T car. 32A, IP54.', icon: 'swap-horizontal-outline', unlocksConnectors: ['type2'] },
  { id: 'p-cable-t2', vendorId: 'v-voltgear', title: 'Type 2 Charging Cable 32A, 5 m', category: 'cables_adapters', priceEgp: 6500, stock: 50, rating: 4.7, reviews: 95, compatibleWith: ['type2'], description: 'For public AC chargers without a tethered cable. Includes a carry bag.', icon: 'git-network-outline' },
  { id: 'p-mats-atto3', vendorId: 'v-autostyle', title: '3D Floor Mats – BYD Atto 3', category: 'interior', priceEgp: 3200, compareAtEgp: 3800, stock: 18, rating: 4.4, reviews: 22, compatibleWith: ['byd-atto3'], description: 'Waterproof TPE mats with raised edges. Full set, front and rear.', icon: 'layers-outline' },
  { id: 'p-screen-tesla', vendorId: 'v-autostyle', title: 'Matte Screen Protector – Tesla 3/Y', category: 'interior', priceEgp: 950, stock: 60, rating: 4.2, reviews: 39, compatibleWith: ['tesla-m3', 'tesla-my'], description: 'Anti-glare tempered glass for the centre touchscreen. Easy bubble-free fit.', icon: 'phone-portrait-outline' },
  { id: 'p-sunshade', vendorId: 'v-autostyle', title: 'Windshield & Glass-Roof Sunshade', category: 'exterior', priceEgp: 1450, stock: 33, rating: 4.5, reviews: 47, compatibleWith: [], description: 'Cuts cabin heat in Egyptian summers, so the AC uses less battery when you start driving.', icon: 'sunny-outline' },
  { id: 'p-dashcam', vendorId: 'v-voltgear', title: '4K Dash Cam with Parking Mode', category: 'electronics', priceEgp: 4200, stock: 25, rating: 4.6, reviews: 66, compatibleWith: [], description: 'Front and rear cameras, Wi-Fi app, low-power parking mode that protects the 12V battery.', icon: 'videocam-outline' },
  { id: 'p-inflator', vendorId: 'v-voltgear', title: 'Smart Tire Inflator', category: 'tires_tools', priceEgp: 1850, stock: 41, rating: 4.5, reviews: 52, compatibleWith: [], description: 'Correct tire pressure can add up to 3% range. Auto-stop at your set PSI.', icon: 'speedometer-outline' },
];

export const SHOPS: ServiceShop[] = [
  {
    id: 's-evdoctor', vendorId: 'v-evdoctor', title: 'EV Doctor – New Cairo', specialties: ['Battery diagnostics', 'Air-conditioning', 'Software updates', 'Brakes'],
    brands: ['BYD', 'MG', 'Hyundai', 'Kia', 'Tesla'], address: '90th St, New Cairo', location: { lat: 30.025, lng: 31.47 }, hours: 'Sat–Thu 9:00–21:00', mobile: true,
    services: [
      { name: 'Battery health check (SoH report)', priceFromEgp: 1500, durationMin: 60 },
      { name: 'AC service & refrigerant', priceFromEgp: 1200, durationMin: 90 },
      { name: 'Software update & diagnostics', priceFromEgp: 800, durationMin: 45 },
      { name: 'Brake service', priceFromEgp: 1800, durationMin: 120 },
    ],
  },
  {
    id: 's-greengarage', vendorId: 'v-greengarage', title: 'Green Garage – 6th of October', specialties: ['Tires', 'Suspension', 'Alignment', 'Body work'],
    brands: ['All brands'], address: 'Industrial Zone 2, 6th of October', location: { lat: 29.95, lng: 30.93 }, hours: 'Daily 10:00–22:00', mobile: false,
    services: [
      { name: 'EV tires (fitting & balancing)', priceFromEgp: 600, durationMin: 60 },
      { name: 'Wheel alignment', priceFromEgp: 450, durationMin: 45 },
      { name: 'Suspension inspection', priceFromEgp: 700, durationMin: 60 },
      { name: 'Paint & body repair estimate', priceFromEgp: 0, durationMin: 30 },
    ],
  },
  {
    id: 's-batterylab', vendorId: 'v-batterylab', title: 'BatteryLab – Alexandria', specialties: ['Battery certificate', 'Cell balancing', 'Module repair'],
    brands: ['BYD', 'MG', 'Nissan', 'VW', 'Chinese imports'], address: 'Smouha, Alexandria', location: { lat: 31.21, lng: 29.95 }, hours: 'Sun–Thu 9:00–18:00', mobile: false,
    services: [
      { name: 'Pre-purchase battery certificate', priceFromEgp: 1500, durationMin: 60 },
      { name: 'Cell balancing', priceFromEgp: 4500, durationMin: 240 },
      { name: 'Module repair (quote)', priceFromEgp: 0, durationMin: 60 },
    ],
  },
  {
    id: 's-ampere', vendorId: 'v-ampere', title: 'Ampere – Home Charger Installation', specialties: ['Wallbox installation', 'Electrical survey', 'Solar + EV'],
    brands: ['All brands'], address: 'Mobile team, Cairo & Giza', location: { lat: 30.06, lng: 31.3 }, hours: 'Sat–Thu 9:00–19:00', mobile: true,
    services: [
      { name: 'Home electrical survey', priceFromEgp: 500, durationMin: 60 },
      { name: 'Wallbox installation', priceFromEgp: 3500, durationMin: 180 },
    ],
  },
];

export const CARS: CarListing[] = [
  { id: 'c-1', vendorId: 'v-owner', sellerKind: 'owner', make: 'BYD', model: 'Atto 3', year: 2023, km: 32000, priceEgp: 1650000, batteryHealthPercent: 96, batteryHealthSource: 'certified_inspection', rangeKm: 420, city: 'New Cairo', color: 'Surf Blue', connector: 'CCS2 / Type 2', spec: 'Egypt agent', warrantyMonths: 48, featured: true, postedDaysAgo: 2, description: 'Single owner, all services at the agent. Home-charged mostly, panoramic roof, 360° camera.' },
  { id: 'c-2', vendorId: 'v-nilemotors', sellerKind: 'dealer', make: 'MG', model: 'ZS EV Long Range', year: 2022, km: 48000, priceEgp: 1050000, batteryHealthPercent: 92, batteryHealthSource: 'certified_inspection', rangeKm: 440, city: 'Heliopolis', color: 'White', connector: 'CCS2 / Type 2', spec: 'Egypt agent', warrantyMonths: 6, featured: false, postedDaysAgo: 5, description: 'Certified pre-owned with 120-point inspection. 6-month dealer warranty included.' },
  { id: 'c-3', vendorId: 'v-nilemotors', sellerKind: 'dealer', make: 'Hyundai', model: 'Kona Electric', year: 2021, km: 61000, priceEgp: 1250000, batteryHealthPercent: 90, batteryHealthSource: 'certified_inspection', rangeKm: 484, city: 'Heliopolis', color: 'Galactic Grey', connector: 'CCS2 / Type 2', spec: 'European import', warrantyMonths: 6, featured: false, postedDaysAgo: 9, description: 'Heat pump, heads-up display, new tires. Inspection report available.' },
  { id: 'c-4', vendorId: 'v-owner', sellerKind: 'owner', make: 'Tesla', model: 'Model Y Long Range', year: 2024, km: 18000, priceEgp: 3400000, batteryHealthPercent: 98, batteryHealthSource: 'seller_reported', rangeKm: 533, city: 'Sheikh Zayed', color: 'Pearl White', connector: 'CCS2 / Type 2', spec: 'European import', featured: true, postedDaysAgo: 1, description: 'Dual motor AWD, FSD hardware, ceramic coating and PPF on the front.' },
  { id: 'c-5', vendorId: 'v-futureauto', sellerKind: 'dealer', make: 'Volkswagen', model: 'ID.4 Crozz', year: 2022, km: 40000, priceEgp: 1450000, batteryHealthPercent: 93, batteryHealthSource: 'certified_inspection', rangeKm: 500, city: 'Alexandria', color: 'Kings Red', connector: 'GB/T', spec: 'China spec', featured: false, postedDaysAgo: 4, description: 'China-spec, English software installed. Includes a CCS2 → GB/T adapter for public fast chargers.' },
  { id: 'c-6', vendorId: 'v-futureauto', sellerKind: 'dealer', make: 'Kia', model: 'EV6 GT-Line', year: 2023, km: 25000, priceEgp: 2600000, batteryHealthPercent: 97, batteryHealthSource: 'certified_inspection', rangeKm: 528, city: 'Alexandria', color: 'Runway Red', connector: 'CCS2 / Type 2', spec: 'Gulf spec', warrantyMonths: 12, featured: true, postedDaysAgo: 3, description: 'Ultra-fast 800V charging (10–80% in 18 min), Meridian sound, vehicle-to-load adapter.' },
  { id: 'c-7', vendorId: 'v-owner', sellerKind: 'owner', make: 'Nissan', model: 'Leaf 40 kWh', year: 2019, km: 80000, priceEgp: 650000, batteryHealthPercent: 78, batteryHealthSource: 'seller_reported', rangeKm: 210, city: 'Maadi', color: 'Silver', connector: 'CHAdeMO / Type 2', spec: 'Japanese import', featured: false, postedDaysAgo: 12, description: 'Perfect city car. Battery reported at 78% health. Buyer can request an inspection.' },
  { id: 'c-8', vendorId: 'v-owner', sellerKind: 'owner', make: 'MG', model: 'MG4 Electric', year: 2024, km: 12000, priceEgp: 1550000, batteryHealthPercent: 99, batteryHealthSource: 'seller_reported', rangeKm: 435, city: 'Smouha, Alexandria', color: 'Volcano Orange', connector: 'CCS2 / Type 2', spec: 'Egypt agent', warrantyMonths: 60, featured: false, postedDaysAgo: 6, description: 'Like new, still under agent warranty. Selling because of relocation.' },
];

export const vendorById = (id: string) => VENDORS.find((v) => v.id === id);
export const productById = (id: string) => PRODUCTS.find((p) => p.id === id);
export const shopById = (id: string) => SHOPS.find((s) => s.id === id);
export const carById = (id: string) => CARS.find((c) => c.id === id);
