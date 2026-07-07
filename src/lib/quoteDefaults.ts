export const BETECH_COMPANY = {
  name: "Betech Solar Solution Limited",
  registrationNo: "BN-X2CLZGP5",
  kraPin: "P052448598C",
  office: "Pramukh Plaza, 3rd Floor, Shop No. 3, Nairobi CBD",
  salesDesk: "0722 151 083",
  email: "info@betech.co.ke",
  website: "https://www.betech.co.ke/",
  projectsUrl: "https://www.tiktok.com/@betechsolarprojects",
};

export const BETECH_PREPARED_BY_DEFAULTS = {
  team: "Betech Solar Solutions Quotations Team",
  leadTechnicianName: "Jackson",
  leadTechnicianPhone: "0705663175",
  salesDesk: "0722 151 083",
};

export const BETECH_PAYMENT_METHODS = [
  {
    title: "M-PESA PAYBILL",
    lines: ["Paybill: 516600", "Account: 0710098001"],
  },
  {
    title: "ABSA BANK",
    lines: [
      "Bank: Absa Bank Kenya",
      "Account Name: Betech Solar Solution",
      "Account No: 2047639940",
    ],
  },
  {
    title: "EQUITY BANK",
    lines: [
      "Account Name: Betech Technologies Limited",
      "Branch: Moi Avenue",
      "Account No: 0470265072030",
    ],
  },
] as const;

export const BETECH_AFTER_SALES_SUPPORT = [
  "Telephone and WhatsApp technical support",
  "Remote troubleshooting assistance",
  "Warranty support",
  "User training and operating guidance",
  "Genuine spare parts support",
  "Professional maintenance advice",
  "Site revisit if needed for physical support",
] as const;

export const BETECH_WARRANTY_NOTES = [
  "Warranty applies under normal use, correct installation, and manufacturer operating conditions.",
  "Warranty does not cover misuse, accidental damage, unauthorized modification, or force majeure events.",
] as const;

export const BETECH_TERMS = [
  "Quotation validity is subject to confirmation at the time of order placement.",
  "Standard payment options are full payment before installation, 30% deposit with balance after installation, or full payment after installation where approved by management.",
  "Warranty applies under normal use, correct installation, and manufacturer operating conditions.",
  "Customer should confirm the final product scope, payment structure, and site readiness before dispatch or installation planning.",
] as const;
