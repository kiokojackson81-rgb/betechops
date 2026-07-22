import type { TradingPeriod } from "@/lib/tradingPeriod";

export const OPENFLOAT_ALLOWED_TYPES = ["Mpesa", "Paybill", "Till", "Bank"] as const;
export const OPENFLOAT_HEADERS = [
  "Account Type",
  "Account Name",
  "Account Number",
  "Till or Paybill Number",
  "Till or Paybill Business Name",
  "Notification Phone Number",
  "Amount",
  "Remark",
] as const;

export type OpenfloatReviewRow = {
  attendantId: string;
  name: string;
  email: string;
  attendantCategory: string | null;
  accountType: string;
  accountName: string;
  accountNumber: string;
  tillOrPaybillNumber: string;
  tillOrPaybillBusinessName: string;
  notificationPhoneNumber: string;
  amount: number;
  remark: string;
  isValid: boolean;
  validationErrors: string[];
};

export type PayoutUser = {
  id: string;
  name: string | null;
  email: string | null;
  attendantCategory: string | null;
  isActive: boolean;
  bankName: string | null;
  bankAccountNumber: string | null;
  payoutMethod: string | null;
  payoutAccountName: string | null;
  mobileMoneyPhoneNumber: string | null;
  tillPaybillNumber: string | null;
  tillPaybillBusinessName: string | null;
  paybillAccountNumber: string | null;
  notificationPhoneNumber: string | null;
};

function toOpenfloatAccountType(method: string | null | undefined) {
  switch (String(method ?? "").trim().toUpperCase()) {
    case "MPESA":
      return "Mpesa";
    case "PAYBILL":
      return "Paybill";
    case "TILL":
      return "Till";
    case "BANK":
      return "Bank";
    default:
      return "";
  }
}

function buildRemark(name: string, period: TradingPeriod) {
  return `${name} salary ${period.key}`;
}

export function buildOpenfloatReviewRow(user: PayoutUser, amount: number, period: TradingPeriod): OpenfloatReviewRow {
  const accountType = toOpenfloatAccountType(user.payoutMethod);
  const accountName = String(user.payoutAccountName || user.name || user.email || "").trim();
  const notificationPhoneNumber = String(user.notificationPhoneNumber || "").trim();
  const row: OpenfloatReviewRow = {
    attendantId: user.id,
    name: String(user.name || user.email || "Unnamed"),
    email: String(user.email || ""),
    attendantCategory: user.attendantCategory,
    accountType,
    accountName,
    accountNumber: "",
    tillOrPaybillNumber: "",
    tillOrPaybillBusinessName: "",
    notificationPhoneNumber,
    amount: Number(amount || 0),
    remark: buildRemark(String(user.name || user.email || "Employee"), period),
    isValid: true,
    validationErrors: [],
  };

  switch (accountType) {
    case "Bank":
      row.accountNumber = String(user.bankAccountNumber || "").trim();
      row.tillOrPaybillBusinessName = String(user.bankName || "").trim();
      break;
    case "Mpesa":
      row.accountNumber = String(user.mobileMoneyPhoneNumber || "").trim();
      break;
    case "Till":
      row.tillOrPaybillNumber = String(user.tillPaybillNumber || "").trim();
      row.tillOrPaybillBusinessName = String(user.tillPaybillBusinessName || "").trim();
      break;
    case "Paybill":
      row.accountNumber = String(user.paybillAccountNumber || "").trim();
      row.tillOrPaybillNumber = String(user.tillPaybillNumber || "").trim();
      row.tillOrPaybillBusinessName = String(user.tillPaybillBusinessName || "").trim();
      break;
    default:
      break;
  }

  const errors: string[] = [];
  if (!accountType) errors.push("Missing payout method");
  if (!accountName) errors.push("Missing account name");
  if (!notificationPhoneNumber) errors.push("Missing notification phone number");
  if (!(row.amount > 0)) errors.push("Amount must be greater than zero");

  if (accountType === "Bank") {
    if (!row.accountNumber) errors.push("Missing bank account number");
    if (!row.tillOrPaybillBusinessName) errors.push("Missing bank name");
  }
  if (accountType === "Mpesa" && !row.accountNumber) {
    errors.push("Missing M-Pesa phone number");
  }
  if (accountType === "Till") {
    if (!row.tillOrPaybillNumber) errors.push("Missing till number");
    if (!row.tillOrPaybillBusinessName) errors.push("Missing till business name");
  }
  if (accountType === "Paybill") {
    if (!row.accountNumber) errors.push("Missing paybill account number");
    if (!row.tillOrPaybillNumber) errors.push("Missing paybill number");
    if (!row.tillOrPaybillBusinessName) errors.push("Missing paybill business name");
  }

  row.isValid = errors.length === 0;
  row.validationErrors = errors;
  return row;
}
