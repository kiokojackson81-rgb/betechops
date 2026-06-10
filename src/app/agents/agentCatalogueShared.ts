import type { ShopProduct } from "@/app/shop/shopData";

type AgentCommissionProduct = ShopProduct & {
  commissionEnabled?: boolean | null;
  commissionAmount?: number | null;
  commissionRequiresApproval?: boolean | null;
};

export function getAgentCommissionValue(product: ShopProduct) {
  const commissionProduct = product as AgentCommissionProduct;
  return commissionProduct.commissionEnabled ? Number(commissionProduct.commissionAmount ?? 0) : 0;
}

export function getAgentPotentialCommissionValue(product: ShopProduct) {
  const configuredCommission = getAgentCommissionValue(product);
  if (configuredCommission > 0) return configuredCommission;
  const price = Number(product.price ?? 0);
  if (!Number.isFinite(price) || price <= 0) return 0;
  return Math.round(price * 0.06);
}

export function productCommissionRequiresApproval(product: ShopProduct) {
  const commissionProduct = product as AgentCommissionProduct;
  return Boolean(commissionProduct.commissionRequiresApproval);
}
