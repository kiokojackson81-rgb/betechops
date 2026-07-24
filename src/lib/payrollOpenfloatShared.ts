import type { TradingPeriod } from "@/lib/tradingPeriod";

export const OPENFLOAT_ALLOWED_TYPES = [
  "Mpesa",
  "Paybill",
  "Till",
  "Airtel Postpaid",
  "Airtel Prepaid",
  "Bamburi Cement KES",
  "Bamburi Special Products",
  "DStv",
  "GOtv",
  "KAKAMEGA COUNTY REVENUE COLLECTION",
  "Kenya Power PostPaid Bill",
  "Kenya Power Tokens",
  "KENYA REVENUE AUTHORITY",
  "KPC IPO PRIVATIZATION AUTHORITY",
  "KPLC POSTPAID",
  "NAIROBI CITY WATER AND SEWERAGE CO",
  "Safaricom Prepaid",
  "Social Health Insurance Fund",
  "SPA HOMABAY WATER",
  "SPA KAKAMEGA COUNTY WATER",
  "SPA LIMURU WATER",
  "SPA NAKURU RURAL ",
  "SPA NITHI WATER",
  "SPA NIWASCO COLLECTION",
  "SPA RUIRUJUJA WASCO REV",
  "SPA SIBO WATER",
  "TAVEVO WATER SPA",
  "Telkom Kenya Postpaid",
  "Telkom Kenya Prepaid",
  "Zuku",
  "ABC Bank Kenya",
  "ABSA Bank",
  "Access Bank Kenya",
  "Bank of Africa",
  "CFC Stanbic Bank",
  "Choice Bank Kenya",
  "Commercial International Bank",
  "Consolidated Bank",
  "Co-op Bank",
  "Credit Bank",
  "Diamond Trust Bank",
  "Ecobank",
  "Equity Bank",
  "Family Bank",
  "First Community Bank Ltd",
  "GTBank",
  "Gulf African Bank",
  "Housing Finance Company Ltd",
  "I & M Bank Limited",
  "Imperial Bank",
  "Jamii Bora Bank",
  "Kenya Commercial Bank",
  "Kingdom Bank",
  "National Bank",
  "NCBA Bank",
  "Paramount Bank",
  "Prime Bank",
  "SBM Bank",
  "Sidian Bank",
  "Spire Bank",
  "Standard Chartered Bank",
  "Transnational Bank",
  "Victoria Commercial Bank",
  "OpenfloatWallet",
] as const;

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
  payoutMethod: string;
  accountType: string;
  accountName: string;
  accountNumber: string;
  tillOrPaybillNumber: string;
  tillOrPaybillBusinessName: string;
  notificationPhoneNumber: string;
  amount: number;
  remark: string;
  isSkipped: boolean;
  skipReason: string | null;
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

const OPENFLOAT_ALLOWED_TYPE_SET = new Set<string>(OPENFLOAT_ALLOWED_TYPES);

const BANK_ACCOUNT_TYPE_ALIASES = new Map<string, string>([
  ["ABSA", "ABSA Bank"],
  ["ABSA BANK", "ABSA Bank"],
  ["ABSA KENYA", "ABSA Bank"],
  ["ACCESS BANK", "Access Bank Kenya"],
  ["ACCESS BANK KENYA", "Access Bank Kenya"],
  ["BANK OF AFRICA", "Bank of Africa"],
  ["BOA", "Bank of Africa"],
  ["CFC STANBIC", "CFC Stanbic Bank"],
  ["CFC STANBIC BANK", "CFC Stanbic Bank"],
  ["STANBIC", "CFC Stanbic Bank"],
  ["STANBIC BANK", "CFC Stanbic Bank"],
  ["COMMERCIAL INTERNATIONAL BANK", "Commercial International Bank"],
  ["CONSOLIDATED BANK", "Consolidated Bank"],
  ["CO-OP", "Co-op Bank"],
  ["CO OP", "Co-op Bank"],
  ["CO OP BANK", "Co-op Bank"],
  ["CO-OP BANK", "Co-op Bank"],
  ["COOPERATIVE BANK OF KENYA", "Co-op Bank"],
  ["CO OPERATIVE BANK OF KENYA", "Co-op Bank"],
  ["COOP BANK", "Co-op Bank"],
  ["CREDIT BANK", "Credit Bank"],
  ["DIAMOND TRUST BANK", "Diamond Trust Bank"],
  ["DTB", "Diamond Trust Bank"],
  ["ECOBANK", "Ecobank"],
  ["EQUITY", "Equity Bank"],
  ["EQUITY BANK", "Equity Bank"],
  ["FAMILY BANK", "Family Bank"],
  ["FIRST COMMUNITY BANK", "First Community Bank Ltd"],
  ["FIRST COMMUNITY BANK LTD", "First Community Bank Ltd"],
  ["GTBANK", "GTBank"],
  ["GULF AFRICAN BANK", "Gulf African Bank"],
  ["HOUSING FINANCE", "Housing Finance Company Ltd"],
  ["HOUSING FINANCE COMPANY LTD", "Housing Finance Company Ltd"],
  ["I&M", "I & M Bank Limited"],
  ["I & M", "I & M Bank Limited"],
  ["I & M BANK", "I & M Bank Limited"],
  ["I & M BANK LIMITED", "I & M Bank Limited"],
  ["IMPERIAL BANK", "Imperial Bank"],
  ["JAMII BORA", "Jamii Bora Bank"],
  ["JAMII BORA BANK", "Jamii Bora Bank"],
  ["KCB", "Kenya Commercial Bank"],
  ["KENYA COMMERCIAL BANK", "Kenya Commercial Bank"],
  ["KINGDOM BANK", "Kingdom Bank"],
  ["NATIONAL BANK", "National Bank"],
  ["NCBA", "NCBA Bank"],
  ["NCBA BANK", "NCBA Bank"],
  ["PARAMOUNT BANK", "Paramount Bank"],
  ["PRIME BANK", "Prime Bank"],
  ["SBM", "SBM Bank"],
  ["SBM BANK", "SBM Bank"],
  ["SIDIAN BANK", "Sidian Bank"],
  ["SPIRE BANK", "Spire Bank"],
  ["STANDARD CHARTERED", "Standard Chartered Bank"],
  ["STANDARD CHARTERED BANK", "Standard Chartered Bank"],
  ["TRANSNATIONAL BANK", "Transnational Bank"],
  ["VICTORIA COMMERCIAL BANK", "Victoria Commercial Bank"],
]);

const EMPLOYEE_ACCOUNT_TYPE_OVERRIDES = new Map<string, string>([
  ["JENIFFER MUTIO MUTINDA", "ABSA Bank"],
  ["BRENDAH ACHIENG OWINO", "Co-op Bank"],
  ["BENJAMIN MUTUI MWENDWA", "CFC Stanbic Bank"],
  ["STEPHEN MUSEMBI KINGOLA", "Access Bank Kenya"],
  ["JONATHAN MUGIIRA", "NCBA Bank"],
  ["JUSTUS", "Mpesa"],
]);

function normalizeKey(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function toOpenfloatPayoutMethod(method: string | null | undefined) {
  switch (normalizeKey(method)) {
    case "MPESA":
      return "MPESA";
    case "PAYBILL":
      return "PAYBILL";
    case "TILL":
      return "TILL";
    case "BANK":
      return "BANK";
    default:
      return "";
  }
}

function resolveBankAccountType(user: PayoutUser) {
  const employeeOverride = EMPLOYEE_ACCOUNT_TYPE_OVERRIDES.get(normalizeKey(user.name));
  if (employeeOverride) return employeeOverride;

  const bankName = String(user.bankName || "").trim();
  if (!bankName) return "";
  if (OPENFLOAT_ALLOWED_TYPE_SET.has(bankName)) return bankName;

  return BANK_ACCOUNT_TYPE_ALIASES.get(normalizeKey(bankName)) || "";
}

function isSupportedAccountType(value: string) {
  return OPENFLOAT_ALLOWED_TYPE_SET.has(value);
}

function normalizePhoneNumber(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.replace(/[^\d+]/g, "");
}

function isValidNotificationPhoneNumber(value: string) {
  return /^(\+254|254|0)\d{9}$/.test(value);
}

function buildRemark(name: string, period: TradingPeriod) {
  return `${name} salary ${period.key}`;
}

export function buildOpenfloatReviewRow(user: PayoutUser, amount: number, period: TradingPeriod): OpenfloatReviewRow {
  const payoutMethod = toOpenfloatPayoutMethod(user.payoutMethod);
  const accountType =
    payoutMethod === "BANK"
      ? resolveBankAccountType(user)
      : payoutMethod === "MPESA"
        ? "Mpesa"
        : payoutMethod === "PAYBILL"
          ? "Paybill"
          : payoutMethod === "TILL"
            ? "Till"
            : "";
  const accountName = String(user.payoutAccountName || user.name || user.email || "").trim();
  const notificationPhoneNumber = normalizePhoneNumber(
    user.notificationPhoneNumber || user.mobileMoneyPhoneNumber || "",
  );

  const row: OpenfloatReviewRow = {
    attendantId: user.id,
    name: String(user.name || user.email || "Unnamed"),
    email: String(user.email || ""),
    attendantCategory: user.attendantCategory,
    payoutMethod,
    accountType,
    accountName,
    accountNumber: "",
    tillOrPaybillNumber: "",
    tillOrPaybillBusinessName: "",
    notificationPhoneNumber,
    amount: Number(amount || 0),
    remark: buildRemark(String(user.name || user.email || "Employee"), period),
    isSkipped: false,
    skipReason: null,
    isValid: true,
    validationErrors: [],
  };

  if (!(row.amount > 0)) {
    row.isSkipped = true;
    row.skipReason = row.amount < 0 ? "Negative payroll balance" : "Zero payroll balance";
    row.isValid = false;
    row.validationErrors = [];
    return row;
  }

  switch (payoutMethod) {
    case "BANK":
      row.accountNumber = String(user.bankAccountNumber || "").trim();
      row.tillOrPaybillBusinessName = "";
      break;
    case "MPESA":
      row.accountNumber = normalizePhoneNumber(user.mobileMoneyPhoneNumber || user.notificationPhoneNumber || "");
      break;
    case "TILL":
      row.tillOrPaybillNumber = String(user.tillPaybillNumber || "").trim();
      row.tillOrPaybillBusinessName = String(user.tillPaybillBusinessName || "").trim();
      break;
    case "PAYBILL":
      row.accountNumber = String(user.paybillAccountNumber || "").trim();
      row.tillOrPaybillNumber = String(user.tillPaybillNumber || "").trim();
      row.tillOrPaybillBusinessName = String(user.tillPaybillBusinessName || "").trim();
      break;
    default:
      break;
  }

  const errors: string[] = [];
  if (!payoutMethod) errors.push("Missing payout method");
  if (!accountType) {
    errors.push(
      payoutMethod === "BANK"
        ? `Unsupported bank name: ${String(user.bankName || "Missing")}`
        : "Unsupported account type",
    );
  } else if (!isSupportedAccountType(accountType)) {
    errors.push(`Unsupported account type: ${accountType}`);
  }
  if (!accountName) errors.push("Missing account name");
  if (!notificationPhoneNumber) {
    errors.push("Missing notification phone number");
  } else if (!isValidNotificationPhoneNumber(notificationPhoneNumber)) {
    errors.push(`Invalid notification phone number: ${notificationPhoneNumber}`);
  }
  if (!(row.amount > 0)) errors.push("Missing or zero salary amount");

  if (payoutMethod === "BANK") {
    if (!String(user.bankName || "").trim()) errors.push("Missing bank name");
    if (!row.accountNumber) errors.push("Missing bank account number");
  }
  if (payoutMethod === "MPESA") {
    if (!row.accountNumber) {
      errors.push("Missing M-Pesa phone number");
    } else if (!isValidNotificationPhoneNumber(row.accountNumber)) {
      errors.push(`Invalid M-Pesa phone number: ${row.accountNumber}`);
    }
  }
  if (payoutMethod === "TILL") {
    if (!row.tillOrPaybillNumber) errors.push("Missing till number");
    if (!row.tillOrPaybillBusinessName) errors.push("Missing till business name");
  }
  if (payoutMethod === "PAYBILL") {
    if (!row.accountNumber) errors.push("Missing paybill account number");
    if (!row.tillOrPaybillNumber) errors.push("Missing paybill number");
    if (!row.tillOrPaybillBusinessName) errors.push("Missing paybill business name");
  }

  row.isValid = errors.length === 0;
  row.validationErrors = errors;
  return row;
}
