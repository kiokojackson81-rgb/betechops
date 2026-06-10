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

export function productCommissionRequiresApproval(product: ShopProduct) {
  const commissionProduct = product as AgentCommissionProduct;
  return Boolean(commissionProduct.commissionRequiresApproval);
}
