import { allShopProducts, type ShopProduct } from "@/app/shop/shopData";

export const SHOP_OPS_API_ENV_KEY = "NEXT_PUBLIC_SHOP_USE_OPS_API";

export function isShopOpsApiEnabled() {
  return process.env.NEXT_PUBLIC_SHOP_USE_OPS_API === "true";
}

export interface EcommerceOrderDraft {
  customerName: string;
  phone: string;
  location: string;
  deliveryMethod: string;
  paymentPreference: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  subtotal: number;
  notes?: string;
  source: "shop";
  status: "pending";
  linkedCustomerId?: string;
  linkedReceiptId?: string;
  createdAt: string;
}

export interface QuoteRequestDraft {
  customerName: string;
  phone: string;
  location: string;
  propertyType: string;
  loadDescription: string;
  budgetRange: string;
  preferredProducts: string;
  notes?: string;
  source: "shop_quote";
  status: "new";
  createdAt: string;
}

export const shopOpsMappingPlan = {
  flag: `${SHOP_OPS_API_ENV_KEY}=false`,
  productToOpsCatalogue: "Shop product -> ops catalogue product",
  customerToOpsCustomer: "Shop customer -> existing customer database",
  checkoutToPendingOrder: "Shop checkout -> pending ecommerce order",
  deliveredOrderToReceipt: "Delivered order -> receipt/POS system",
  quoteToAdminLead: "Quote request -> admin quote lead",
} as const;

export const adminHandoffWorkflow = [
  "Customer checks out on /shop.",
  "Order appears in ops admin as pending ecommerce order.",
  "Admin confirms stock and payment.",
  "Admin processes sale through POS/receipt system.",
  "Receipt links back to order.",
  "Order status updates to confirmed/dispatched/delivered/cancelled.",
] as const;

export const futureOrderStatuses = [
  "pending",
  "confirmed",
  "awaiting_payment",
  "paid",
  "dispatched",
  "delivered",
  "cancelled",
] as const;

export const futureQuoteStatuses = ["new", "contacted", "quoted", "converted", "closed"] as const;

export const phaseNineReadOnlySafetyNotes = [
  "Phase 9 only connects /shop to the ops catalogue in read-only mode.",
  "No ecommerce order creation is allowed against live ops yet.",
  "No POS sale, receipt creation, stock deduction, or payment mutation is allowed.",
  "Mock fallback must remain available until catalogue testing is complete.",
] as const;

export const phaseTenCatalogueQaNotes = [
  "Phase 10 audits live ops catalogue data for ecommerce display in read-only mode only.",
  "No order creation, POS linkage, receipt creation, stock deduction, or payment mutation is allowed in catalogue QA mode.",
  "Customer-facing /shop pages must continue to fall back to mock data if the ops catalogue is incomplete or unavailable.",
] as const;

export const futureShopVisibilityNotes = [
  "Recommended future Product field: showInShop boolean default false.",
  "Once live ecommerce mode is enabled, only products with showInShop=true and status=active should appear in /shop.",
] as const;

export function buildMockOrderReference() {
  return `BT-SHOP-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export function buildMockQuoteReference() {
  return `BT-QUOTE-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export function buildEcommerceOrderDraft(input: {
  customerName: string;
  phone: string;
  location: string;
  deliveryMethod: string;
  paymentPreference: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  notes?: string;
}): EcommerceOrderDraft {
  const subtotal = input.items.reduce((sum, item) => {
    const product = allShopProducts.find((entry) => entry.id === item.productId);
    if (!product) return sum;
    return sum + product.price * item.quantity;
  }, 0);

  return {
    customerName: input.customerName,
    phone: input.phone,
    location: input.location,
    deliveryMethod: input.deliveryMethod,
    paymentPreference: input.paymentPreference,
    items: input.items,
    subtotal,
    notes: input.notes,
    source: "shop",
    status: "pending",
    createdAt: new Date().toISOString(),
  };
}

export function buildQuoteRequestDraft(input: {
  customerName: string;
  phone: string;
  location: string;
  propertyType: string;
  loadDescription: string;
  budgetRange: string;
  preferredProducts: string;
  notes?: string;
}): QuoteRequestDraft {
  return {
    customerName: input.customerName,
    phone: input.phone,
    location: input.location,
    propertyType: input.propertyType,
    loadDescription: input.loadDescription,
    budgetRange: input.budgetRange,
    preferredProducts: input.preferredProducts,
    notes: input.notes,
    source: "shop_quote",
    status: "new",
    createdAt: new Date().toISOString(),
  };
}

export function buildMockProductsResponse(products: ShopProduct[]) {
  return {
    ok: true,
    source: "mock" as const,
    useOpsApi: isShopOpsApiEnabled(),
    products,
  };
}
