/**
 * MULTIVENDOR MARKETPLACE LOGIC
 * =============================
 * "Multivendor" means many independent sellers share one storefront. That
 * creates three rules the app has to handle:
 *
 *  1. One basket, many sellers. A customer can buy a cable from Seller A and
 *     floor mats from Seller B in one checkout. Behind the scenes it is split
 *     into one sub-order per seller. Each seller ships their own items and
 *     charges their own delivery fee.
 *  2. The platform takes a commission on each sale. It differs by category,
 *     because margins differ: chargers are low-margin, accessories higher.
 *  3. The seller is paid the rest (the payout) after the order is delivered
 *     and the return window closes. This protects buyers from fraud.
 */

export type ListingKind = 'product' | 'service' | 'car';

export type VendorType = 'accessories' | 'service_center' | 'dealer' | 'private_seller';

export interface Vendor {
  id: string;
  name: string;
  type: VendorType;
  city: string;
  verified: boolean;
  rating: number;
  reviews: number;
  since: number;
  color: string;
  description: string;
  /** Flat delivery fee in EGP charged per order from this vendor (products only). */
  deliveryFeeEgp: number;
  /** Order subtotal above which delivery is free. */
  freeDeliveryOverEgp?: number;
}

export type ProductCategory = 'home_charging' | 'portable_charging' | 'cables_adapters' | 'interior' | 'exterior' | 'electronics' | 'tires_tools';

export const PRODUCT_CATEGORY_LABEL: Record<ProductCategory, string> = {
  home_charging: 'Home chargers',
  portable_charging: 'Portable chargers',
  cables_adapters: 'Cables & adapters',
  interior: 'Interior',
  exterior: 'Exterior',
  electronics: 'Electronics',
  tires_tools: 'Tires & tools',
};

export interface Product {
  id: string;
  vendorId: string;
  title: string;
  category: ProductCategory;
  priceEgp: number;
  /** Old price, when the item is on sale. */
  compareAtEgp?: number;
  stock: number;
  rating: number;
  reviews: number;
  /** Car models or connector types it works with. Empty = universal. */
  compatibleWith: string[];
  description: string;
  icon: string;
  /** Plug types this product makes usable, e.g. an adapter that lets a GB/T car use CCS2. */
  unlocksConnectors?: string[];
}

export interface ServiceOffer {
  name: string;
  priceFromEgp: number;
  durationMin: number;
}

export interface ServiceShop {
  id: string;
  vendorId: string;
  title: string;
  specialties: string[];
  brands: string[];
  services: ServiceOffer[];
  address: string;
  location: { lat: number; lng: number };
  hours: string;
  /** Mobile service: technician comes to you. */
  mobile: boolean;
}

export type SellerKind = 'dealer' | 'owner';

export interface CarListing {
  id: string;
  vendorId: string;
  sellerKind: SellerKind;
  make: string;
  model: string;
  year: number;
  km: number;
  priceEgp: number;
  /** Battery state of health in %, the most important number when buying a used EV. */
  batteryHealthPercent?: number;
  /** Who measured the battery health. */
  batteryHealthSource?: 'certified_inspection' | 'seller_reported';
  rangeKm: number;
  city: string;
  color: string;
  connector: string;
  spec: string;
  warrantyMonths?: number;
  featured: boolean;
  postedDaysAgo: number;
  description: string;
}

/** Platform commission by category, as a share of the item price. */
export const COMMISSION_RATE: Record<ProductCategory | 'service' | 'car_lead', number> = {
  home_charging: 0.06,
  portable_charging: 0.08,
  cables_adapters: 0.1,
  interior: 0.12,
  exterior: 0.12,
  electronics: 0.1,
  tires_tools: 0.08,
  service: 0.1,
  car_lead: 0,
};

/** Car listings earn per listing, not per sale (cars are paid offline). */
export const CAR_LISTING_FEES = {
  ownerBasic: 0,
  ownerFeatured: 750,
  dealerMonthly: 4500,
  inspectionReport: 1500,
};

/** Card / wallet payment gateway fee (charged to the platform). */
export const PAYMENT_GATEWAY_RATE = 0.0275;

export type PaymentMethod = 'cod' | 'card' | 'wallet' | 'fawry';

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cod: 'Cash on delivery',
  card: 'Credit / debit card',
  wallet: 'Mobile wallet / InstaPay',
  fawry: 'Fawry reference code',
};

/** Cash on delivery carries a small handling fee in Egypt. */
export const COD_FEE_EGP = 20;

export interface CartLine {
  productId: string;
  quantity: number;
}

export interface VendorOrder {
  vendor: Vendor;
  lines: { product: Product; quantity: number; lineTotal: number }[];
  subtotal: number;
  delivery: number;
  total: number;
  commission: number;
  /** What the vendor receives after the platform commission. */
  payout: number;
}

export interface CheckoutSummary {
  orders: VendorOrder[];
  itemsSubtotal: number;
  deliveryTotal: number;
  paymentFee: number;
  grandTotal: number;
  platformCommission: number;
  itemCount: number;
}

/**
 * Split a basket into one order per vendor and work out delivery,
 * commission and payout for each.
 */
export function buildCheckout(
  cart: CartLine[],
  products: Product[],
  vendors: Vendor[],
  payment: PaymentMethod = 'card',
): CheckoutSummary {
  const productById = new Map(products.map((p) => [p.id, p]));
  const vendorById = new Map(vendors.map((v) => [v.id, v]));
  const groups = new Map<string, VendorOrder>();

  for (const line of cart) {
    const product = productById.get(line.productId);
    if (!product || line.quantity <= 0) continue;
    const vendor = vendorById.get(product.vendorId);
    if (!vendor) continue;
    const quantity = Math.min(line.quantity, product.stock);
    if (quantity <= 0) continue;
    let order = groups.get(vendor.id);
    if (!order) {
      order = { vendor, lines: [], subtotal: 0, delivery: 0, total: 0, commission: 0, payout: 0 };
      groups.set(vendor.id, order);
    }
    const lineTotal = product.priceEgp * quantity;
    order.lines.push({ product, quantity, lineTotal });
    order.subtotal += lineTotal;
    order.commission += lineTotal * COMMISSION_RATE[product.category];
  }

  const orders = [...groups.values()].map((o) => {
    const freeDelivery = o.vendor.freeDeliveryOverEgp != null && o.subtotal >= o.vendor.freeDeliveryOverEgp;
    const delivery = freeDelivery ? 0 : o.vendor.deliveryFeeEgp;
    const commission = round2(o.commission);
    return {
      ...o,
      delivery,
      total: o.subtotal + delivery,
      commission,
      // Delivery fees pass through to the vendor, who does the shipping.
      payout: round2(o.subtotal - commission + delivery),
    };
  });

  const itemsSubtotal = sum(orders.map((o) => o.subtotal));
  const deliveryTotal = sum(orders.map((o) => o.delivery));
  const paymentFee = payment === 'cod' && orders.length > 0 ? COD_FEE_EGP * orders.length : 0;
  return {
    orders,
    itemsSubtotal,
    deliveryTotal,
    paymentFee,
    grandTotal: itemsSubtotal + deliveryTotal + paymentFee,
    platformCommission: round2(sum(orders.map((o) => o.commission))),
    itemCount: sum(orders.flatMap((o) => o.lines.map((l) => l.quantity))),
  };
}

/** What a seller keeps from one sale. Shown on the "Sell on EVWorld" calculator. */
export function sellerEarnings(priceEgp: number, category: ProductCategory | 'service', paidOnline = true) {
  const commission = priceEgp * COMMISSION_RATE[category];
  // The platform absorbs gateway fees in the base model; shown here so sellers see the full picture.
  const gatewayFee = paidOnline ? priceEgp * PAYMENT_GATEWAY_RATE : 0;
  return {
    price: priceEgp,
    commissionRate: COMMISSION_RATE[category],
    commission: round2(commission),
    payout: round2(priceEgp - commission),
    platformNet: round2(commission - gatewayFee),
  };
}

/**
 * Does a product fit the driver's car? Products list either car model ids
 * (e.g. floor mats for one model) or plug types (e.g. a GB/T adapter).
 * An empty list means it fits every EV.
 */
export function productFits(product: Product, vehicle: { id: string; acConnector: string; dcConnector: string | null }): boolean {
  if (product.compatibleWith.length === 0) return true;
  return product.compatibleWith.some((c) => c === vehicle.id || c === vehicle.acConnector || c === vehicle.dcConnector);
}

export function formatEgp(value: number): string {
  return `EGP ${Math.round(value).toLocaleString('en-US')}`;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
