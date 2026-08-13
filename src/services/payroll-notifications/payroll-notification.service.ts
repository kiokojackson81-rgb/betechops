import { prisma } from "@/lib/prisma";
import { getBranding } from "@/lib/branding";
import { launchChromiumBrowser } from "@/lib/pdf/chromium";
import { buildPayrollRow } from "@/lib/adminPayroll";
import { applyCanonicalPayrollOverrides } from "@/lib/payrollCanonical";
import { buildPayslipPayload, renderPayslipDocumentHtml, sanitizeFilename } from "@/lib/payrollPayslip";
import { sendTransactionalSms } from "@/lib/africasTalking";
import { describeEmailError, sendGeneralCustomerNotificationEmail } from "@/lib/email";
import { normalizeKenyanPhone } from "@/lib/phone";
import type { TradingPeriod } from "@/lib/tradingPeriod";

type PayrollAdjustmentType = "CHAMA" | "LATENESS" | "DISCIPLINE" | "BONUS" | "COMMISSION_TOPUP" | "OTHER";
type PayrollAdjustmentKind = "ADDITION" | "DEDUCTION";

type PayrollAttendant = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  notificationPhoneNumber: string | null;
  attendantCategory: string | null;
  isActive: boolean;
};

export type PayrollNotificationChannelResult = {
  channel: "SMS" | "EMAIL";
  status: "sent" | "skipped" | "failed";
  detail: string;
};

export type PayrollNotificationResult = {
  attendantId: string;
  attendantName: string;
  periodKey: string;
  channels: PayrollNotificationChannelResult[];
};

export type PayrollAdjustmentNotificationResult = {
  attendantId: string;
  attendantName: string;
  periodKey: string;
  adjustmentType: PayrollAdjustmentType;
  adjustmentKind: PayrollAdjustmentKind;
  channels: PayrollNotificationChannelResult[];
};

function formatKes(amount: number | null | undefined) {
  return `KES ${new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 }).format(Number(amount ?? 0))}`;
}

function isValidEmailAddress(value: string | null | undefined) {
  const email = String(value || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getDisplayName(attendant: PayrollAttendant) {
  return attendant.name || attendant.email || attendant.id;
}

function getNotificationPhone(attendant: PayrollAttendant) {
  return normalizeKenyanPhone(attendant.notificationPhoneNumber || attendant.phone || "");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function describeAdjustment(args: {
  adjustmentType: PayrollAdjustmentType;
  adjustmentKind: PayrollAdjustmentKind;
  amount: number;
  label: string;
}) {
  const formattedAmount = formatKes(args.amount);
  const safeLabel = String(args.label || "").trim();

  if (args.adjustmentKind === "ADDITION") {
    if (args.adjustmentType === "COMMISSION_TOPUP") {
      return {
        subject: "Commission applied to your account",
        shortText: `a commission of ${formattedAmount} has been applied to your account`,
        longText: `A commission of <strong>${formattedAmount}</strong> has been applied to your payroll account.`,
      };
    }

    if (args.adjustmentType === "BONUS") {
      return {
        subject: "Bonus applied to your account",
        shortText: `a bonus of ${formattedAmount} has been applied to your account`,
        longText: `A bonus of <strong>${formattedAmount}</strong> has been applied to your payroll account.`,
      };
    }

    return {
      subject: "Payroll addition applied to your account",
      shortText: `a payroll addition of ${formattedAmount} has been applied to your account`,
      longText: `A payroll addition of <strong>${formattedAmount}</strong> has been applied to your payroll account.`,
    };
  }

  if (args.adjustmentType === "DISCIPLINE") {
    return {
      subject: "Fine applied to your account",
      shortText: `a fine of ${formattedAmount} has been applied to your account`,
      longText: `A fine of <strong>${formattedAmount}</strong> has been applied to your payroll account.`,
    };
  }

  const labelSnippet = safeLabel ? ` for ${safeLabel}` : "";
  return {
    subject: "Deduction applied to your account",
    shortText: `a deduction of ${formattedAmount} has been applied to your account${labelSnippet}`,
    longText: `A deduction of <strong>${formattedAmount}</strong> has been applied to your payroll account${
      labelSnippet ? ` for <strong>${escapeHtml(safeLabel)}</strong>` : ""
    }.`,
  };
}

async function buildPayslipPdfBuffer(attendant: PayrollAttendant, period: TradingPeriod) {
  const [row, branding] = await Promise.all([
    applyCanonicalPayrollOverrides(
      await buildPayrollRow(
        {
          id: attendant.id,
          name: attendant.name,
          email: attendant.email,
          attendantCategory: attendant.attendantCategory,
          isActive: attendant.isActive,
        },
        period,
      ),
      period,
    ),
    getBranding(),
  ]);

  const html = renderPayslipDocumentHtml({
    documentTitle: `${getDisplayName(attendant)} payslip ${period.label}`,
    slips: [
      buildPayslipPayload({
        attendant,
        row,
        period,
        branding,
      }),
    ],
  });

  const browser = await launchChromiumBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });

    return {
      row,
      pdfBuffer,
      filename: sanitizeFilename(`${getDisplayName(attendant)} payslip ${period.key}.pdf`),
    };
  } finally {
    await browser.close();
  }
}

async function sendPayrollSms(attendant: PayrollAttendant, period: TradingPeriod, netPay: number) {
  const phone = getNotificationPhone(attendant);
  if (!phone) {
    return {
      channel: "SMS" as const,
      status: "skipped" as const,
      detail: "Missing notification phone number",
    };
  }

  const body = `Hello ${getDisplayName(attendant)}, your Betech payroll payslip for ${period.label} is ready. Net pay: ${formatKes(
    netPay,
  )}. Check your email for the PDF copy or contact admin for clarification.`;

  try {
    await sendTransactionalSms(phone, body);
    return {
      channel: "SMS" as const,
      status: "sent" as const,
      detail: `SMS accepted for ${phone}`,
    };
  } catch (error) {
    return {
      channel: "SMS" as const,
      status: "failed" as const,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function sendPayrollEmail(
  attendant: PayrollAttendant,
  period: TradingPeriod,
  netPay: number,
  pdfBuffer: Buffer,
  filename: string,
) {
  const email = String(attendant.email || "").trim();
  if (!isValidEmailAddress(email)) {
    return {
      channel: "EMAIL" as const,
      status: "skipped" as const,
      detail: "Missing or invalid attendant email",
    };
  }

  try {
    await sendGeneralCustomerNotificationEmail({
      to: email,
      subject: `Payroll payslip ready: ${period.label}`,
      title: "Payroll payslip ready",
      intro: `Hello ${getDisplayName(attendant)},`,
      bodyHtml: `<p>Your Betech payroll payslip for <strong>${period.label}</strong> is ready.</p><p><strong>Net pay:</strong> ${formatKes(
        netPay,
      )}</p><p>The payslip PDF is attached to this email for your records.</p>`,
      bodyText: `Your Betech payroll payslip for ${period.label} is ready. Net pay: ${formatKes(
        netPay,
      )}. The payslip PDF is attached to this email for your records.`,
      outro: "For any payroll clarification, please contact the admin team.",
      attachments: [
        {
          filename,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });

    return {
      channel: "EMAIL" as const,
      status: "sent" as const,
      detail: `Email accepted for ${email}`,
    };
  } catch (error) {
    return {
      channel: "EMAIL" as const,
      status: "failed" as const,
      detail: describeEmailError(error),
    };
  }
}

async function sendPayrollAdjustmentSms(args: {
  attendant: PayrollAttendant;
  periodLabel: string;
  adjustmentType: PayrollAdjustmentType;
  adjustmentKind: PayrollAdjustmentKind;
  amount: number;
  label: string;
}) {
  const phone = getNotificationPhone(args.attendant);
  if (!phone) {
    return {
      channel: "SMS" as const,
      status: "skipped" as const,
      detail: "Missing notification phone number",
    };
  }

  const description = describeAdjustment(args);
  const body = `Hello ${getDisplayName(args.attendant)}, ${description.shortText} for ${args.periodLabel}. Please log in to your account to review.`;

  try {
    await sendTransactionalSms(phone, body);
    return {
      channel: "SMS" as const,
      status: "sent" as const,
      detail: `SMS accepted for ${phone}`,
    };
  } catch (error) {
    return {
      channel: "SMS" as const,
      status: "failed" as const,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function sendPayrollAdjustmentEmail(args: {
  attendant: PayrollAttendant;
  periodLabel: string;
  adjustmentType: PayrollAdjustmentType;
  adjustmentKind: PayrollAdjustmentKind;
  amount: number;
  label: string;
}) {
  const email = String(args.attendant.email || "").trim();
  if (!isValidEmailAddress(email)) {
    return {
      channel: "EMAIL" as const,
      status: "skipped" as const,
      detail: "Missing or invalid attendant email",
    };
  }

  const description = describeAdjustment(args);
  const labelLine = String(args.label || "").trim()
    ? `<p><strong>Label:</strong> ${escapeHtml(String(args.label).trim())}</p>`
    : "";

  try {
    await sendGeneralCustomerNotificationEmail({
      to: email,
      subject: description.subject,
      title: description.subject,
      intro: `Hello ${getDisplayName(args.attendant)},`,
      bodyHtml: `<p>${description.longText}</p><p><strong>Payroll period:</strong> ${escapeHtml(
        args.periodLabel,
      )}</p>${labelLine}<p>Please log in to your account to review.</p>`,
      bodyText: `${description.subject}. Payroll period: ${args.periodLabel}.${String(args.label || "").trim() ? ` Label: ${String(args.label).trim()}.` : ""} Please log in to your account to review.`,
      outro: "For clarification, please contact the admin team.",
    });

    return {
      channel: "EMAIL" as const,
      status: "sent" as const,
      detail: `Email accepted for ${email}`,
    };
  } catch (error) {
    return {
      channel: "EMAIL" as const,
      status: "failed" as const,
      detail: describeEmailError(error),
    };
  }
}

export async function sendPayrollNotificationForAttendant(args: {
  attendantId: string;
  period: TradingPeriod;
}) {
  const attendant = await prisma.user.findUnique({
    where: { id: args.attendantId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      notificationPhoneNumber: true,
      attendantCategory: true,
      isActive: true,
    },
  });

  if (!attendant) {
    throw new Error("Attendant not found");
  }

  const { row, pdfBuffer, filename } = await buildPayslipPdfBuffer(attendant, args.period);
  const channels = await Promise.all([
    sendPayrollSms(attendant, args.period, row.netPay),
    sendPayrollEmail(attendant, args.period, row.netPay, pdfBuffer, filename),
  ]);

  return {
    attendantId: attendant.id,
    attendantName: getDisplayName(attendant),
    periodKey: args.period.key,
    channels,
  } satisfies PayrollNotificationResult;
}

export async function sendPayrollNotificationsForPeriod(args: {
  period: TradingPeriod;
  attendantIds?: string[];
}) {
  const attendants = await prisma.user.findMany({
    where: args.attendantIds?.length
      ? { id: { in: args.attendantIds } }
      : {
          isActive: true,
          role: { in: ["ATTENDANT", "SUPERVISOR", "ADMIN"] },
        },
    select: { id: true },
    orderBy: { name: "asc" },
  });

  const results: PayrollNotificationResult[] = [];
  for (const attendant of attendants) {
    results.push(
      await sendPayrollNotificationForAttendant({
        attendantId: attendant.id,
        period: args.period,
      }),
    );
  }

  return results;
}

export async function notifyPayrollAdjustmentApplied(args: {
  attendantId: string;
  periodKey: string;
  periodLabel: string;
  adjustmentType: PayrollAdjustmentType;
  adjustmentKind: PayrollAdjustmentKind;
  amount: number;
  label: string;
}) {
  const attendant = await prisma.user.findUnique({
    where: { id: args.attendantId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      notificationPhoneNumber: true,
      attendantCategory: true,
      isActive: true,
    },
  });

  if (!attendant) {
    throw new Error("Attendant not found");
  }

  const channels = await Promise.all([
    sendPayrollAdjustmentSms({
      attendant,
      periodLabel: args.periodLabel,
      adjustmentType: args.adjustmentType,
      adjustmentKind: args.adjustmentKind,
      amount: args.amount,
      label: args.label,
    }),
    sendPayrollAdjustmentEmail({
      attendant,
      periodLabel: args.periodLabel,
      adjustmentType: args.adjustmentType,
      adjustmentKind: args.adjustmentKind,
      amount: args.amount,
      label: args.label,
    }),
  ]);

  return {
    attendantId: attendant.id,
    attendantName: getDisplayName(attendant),
    periodKey: args.periodKey,
    adjustmentType: args.adjustmentType,
    adjustmentKind: args.adjustmentKind,
    channels,
  } satisfies PayrollAdjustmentNotificationResult;
}
