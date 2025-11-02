export type OrdersQuery = {
  status?: string;
  country?: string;
  shopId?: string;
  dateFrom?: string;
  dateTo?: string;
  q?: string;
  nextToken?: string;
  size?: string;
};

export type OrdersRow = {
  id: string;
  number?: string;
  status?: string;
  pendingSince?: string;
  createdAt: string;
  updatedAt?: string;
  totalItems?: number;
  packedItems?: number;
  totalAmountLocal?: { currency: string; value: number };
  shopName?: string;
  shopId?: string;
  shopIds?: string[];
  isPrepayment?: boolean;
};
