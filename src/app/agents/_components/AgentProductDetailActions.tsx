import AgentStorefrontProductActions from "@/app/agents/_components/AgentStorefrontProductActions";
import type { ShopProduct } from "@/app/shop/shopData";

type AgentProductDetailActionsProps = {
  product: ShopProduct;
  loginHref: string;
  loggedIn: boolean;
};

export default function AgentProductDetailActions({
  product,
  loginHref,
  loggedIn,
}: AgentProductDetailActionsProps) {
  return (
    <AgentStorefrontProductActions
      product={product}
      loginHref={loginHref}
      loggedIn={loggedIn}
    />
  );
}
