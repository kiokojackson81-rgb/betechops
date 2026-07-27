import { Prisma } from "@prisma/client";
import { sendTransactionalSms } from "@/lib/africasTalking";
import { noStoreJson } from "@/lib/api";
import { sendGeneralCustomerNotificationEmail } from "@/lib/email";
import { pushReceiptToChatrace } from "@/lib/integrations/chatrace";
import { normalizeKenyanPhone, normalizePhone, getKenyanPhoneVariants } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import {
  ensureQuoteRequestsSchema,
  getQuoteRequestById,
  recordQuotationEvent,
  type SerializedQuoteRequest,
} from "@/lib/quoteRequests";
import {
  prepareQuotationPdfAssets,
} from "@/lib/quotationNotifications";
import { getShopBaseUrl } from "@/lib/runtimeUrls";

const FIRST_FOLLOW_UP_DAYS = 7;
const SECOND_FOLLOW_UP_DAYS = 21;
const RECENT_INSTALLATIONS_URL = "https://www.betech.co.ke/projects";
const QUOTATION_FOLLOW_UP_TEMPLATE = "quotation_follow_up_7_days";

type QuotationFollowUpTrigger = "automatic_7_day" | "automatic_21_day" | "manual";

type QuotationFollowUpActor = {
  userId?: string | null;
  name?: string | null;
  email?: string | null;
};

type ChannelDeliveryResult = {
  ok: boolean;
  error?: string;
};

type QuotationFollowUpChannelResults = {
  whatsapp: ChannelDeliveryResult;
  email: ChannelDeliveryResult;
  sms: ChannelDeliveryResult;
};

type DueFollowUpRow = {
  id: string;
  followUpSent: boolean | null;
  followUpScheduledAt: Date | string | null;
  secondFollowUpScheduledAt: Date | string | null;
  secondFollowUpSentAt: Date | string | null;
};

function addDays(base: Date, days: number) {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

function toDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getQuotationDateBase(request: SerializedQuoteRequest) {
  return (
    toDate(request.quotationDate) ||
    toDate(request.respondedAt) ||
    toDate(request.updatedAt) ||
    toDate(request.createdAt) ||
    new Date()
  );
}

function getQuotationLink(request: SerializedQuoteRequest) {
  return `${getShopBaseUrl().replace(/\/$/, "")}/q/${encodeURIComponent(request.quoteRef)}`;
}

function getQuotationPdfLink(request: SerializedQuoteRequest) {
  return (
    String(request.quotationPdfLink || "").trim() ||
    `${getShopBaseUrl().replace(/\/$/, "")}/api/quotations/${encodeURIComponent(request.id)}/pdf`
  );
}

function formatDateLabel(value: string | Date | null | undefined) {
  const parsed = toDate(value);
  if (!parsed) return "the earlier quotation date";
  return parsed.toLocaleDateString("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function normalizeEmail(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function resolveCustomerPhone(request: SerializedQuoteRequest) {
  const rawPhone = String(request.customerPhone || request.manualCustomerPhone || "").trim();
  return {
    rawPhone,
    normalizedPhone: normalizeKenyanPhone(rawPhone) || normalizePhone(rawPhone),
    phoneVariants: Array.from(new Set([rawPhone, ...getKenyanPhoneVariants(rawPhone)].filter(Boolean))),
  };
}

function resolveCustomerEmails(request: SerializedQuoteRequest) {
  return Array.from(
    new Set(
      [request.customerEmail, request.manualCustomerEmail]
        .map((value) => normalizeEmail(value))
        .filter(Boolean),
    ),
  );
}

function isActiveFollowUpStatus(status: string | null | undefined) {
  return ["QUOTED", "FOLLOW_UP", "REVISED"].includes(String(status || "").trim().toUpperCase());
}

function shouldCancelFollowUps(status: string | null | undefined) {
  return ["APPROVED", "CONVERTED", "CLOSED"].includes(String(status || "").trim().toUpperCase());
}

function buildFollowUpSms(request: SerializedQuoteRequest, quotationLink: string) {
  return [
    `Hello ${request.customerName}, this is Betech Solar Solutions.`,
    `Following up on quotation ${request.quoteRef} sent on ${formatDateLabel(request.quotationDate || request.respondedAt || request.createdAt)}.`,
    `Did you receive it, do you need any adjustment, and if it is above budget, what budget did you have in mind?`,
    `Quote: ${quotationLink}`,
  ].join(" ");
}

function buildFollowUpEmailBody(request: SerializedQuoteRequest, quotationLink: string) {
  const quotationDateLabel = formatDateLabel(request.quotationDate || request.respondedAt || request.createdAt);
  return `
    <div style="font-size:15px;line-height:1.85;color:#334155">
      <p style="margin:0 0 12px">Hello ${request.customerName},</p>
      <p style="margin:0 0 12px">
        I’m following up on quotation <strong>${request.quoteRef}</strong> sent on <strong>${quotationDateLabel}</strong>
        for <strong>${request.quoteTitle || "your requested quotation"}</strong>.
      </p>
      <p style="margin:0 0 12px">
        Kindly confirm whether you received it and whether you need any adjustments.
      </p>
      <p style="margin:0 0 12px">
        If the quotation did not fit your budget, please share the budget you had in mind and we will review a suitable option for you.
      </p>
      <p style="margin:18px 0 12px">
        Review the quotation online here:<br />
        <a href="${quotationLink}">${quotationLink}</a>
      </p>
      <p style="margin:0">
        We have also attached the quotation PDF for convenience.
      </p>
    </div>
  `;
}

function buildFollowUpEmailText(request: SerializedQuoteRequest, quotationLink: string) {
  return [
    `Hello ${request.customerName},`,
    "",
    `I’m following up on quotation ${request.quoteRef} sent on ${formatDateLabel(request.quotationDate || request.respondedAt || request.createdAt)}.`,
    "Kindly confirm whether you received it and whether you need any adjustments.",
    "If the quotation did not fit your budget, please share the budget you had in mind and we will review a suitable option for you.",
    "",
    `Quotation link: ${quotationLink}`,
  ].join("\n");
}

function buildChannelDetail(results: QuotationFollowUpChannelResults) {
  return [
    `WhatsApp: ${results.whatsapp.ok ? "sent" : results.whatsapp.error || "skipped"}`,
    `Email: ${results.email.ok ? "sent" : results.email.error || "skipped"}`,
    `SMS: ${results.sms.ok ? "sent" : results.sms.error || "skipped"}`,
  ].join(" | ");
}

async function updateQuotationFollowUpFields(
  quoteRequestId: string,
  input: {
    quotationDate?: Date | null;
    quotationLink?: string | null;
    quotationPdfLink?: string | null;
    followUpSent?: boolean | null;
    followUpScheduledAt?: Date | null;
    followUpSentAt?: Date | null;
    secondFollowUpScheduledAt?: Date | null;
    secondFollowUpSentAt?: Date | null;
    followUpCancelledAt?: Date | null;
  },
) {
  await ensureQuoteRequestsSchema();
  await prisma.$executeRaw(Prisma.sql`
    UPDATE "QuoteRequest"
    SET
      "quotationDate" = COALESCE(${input.quotationDate ?? null}, "quotationDate"),
      "quotationLink" = COALESCE(${input.quotationLink ?? null}, "quotationLink"),
      "quotationPdfLink" = COALESCE(${input.quotationPdfLink ?? null}, "quotationPdfLink"),
      "followUpSent" = ${
        typeof input.followUpSent === "boolean" ? input.followUpSent : Prisma.raw(`"followUpSent"`)
      },
      "followUpScheduledAt" = ${
        input.followUpScheduledAt === undefined
          ? Prisma.raw(`"followUpScheduledAt"`)
          : input.followUpScheduledAt
      },
      "followUpSentAt" = ${
        input.followUpSentAt === undefined ? Prisma.raw(`"followUpSentAt"`) : input.followUpSentAt
      },
      "secondFollowUpScheduledAt" = ${
        input.secondFollowUpScheduledAt === undefined
          ? Prisma.raw(`"secondFollowUpScheduledAt"`)
          : input.secondFollowUpScheduledAt
      },
      "secondFollowUpSentAt" = ${
        input.secondFollowUpSentAt === undefined
          ? Prisma.raw(`"secondFollowUpSentAt"`)
          : input.secondFollowUpSentAt
      },
      "followUpCancelledAt" = ${
        input.followUpCancelledAt === undefined
          ? Prisma.raw(`"followUpCancelledAt"`)
          : input.followUpCancelledAt
      },
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${quoteRequestId}
  `);
}

async function applyQuotationFollowUpTag(
  request: SerializedQuoteRequest,
  input: {
    quotationLink: string;
    quotationPdfLink: string;
    trigger: QuotationFollowUpTrigger;
  },
) {
  const { normalizedPhone } = resolveCustomerPhone(request);
  if (!normalizedPhone) {
    return { ok: false, error: "missing_phone" };
  }

  const result = await pushReceiptToChatrace({
    phoneE164: normalizedPhone,
    customerName: request.customerName,
    receiptNumber: request.quoteRef,
    amount: "0",
    currency: "KES",
    receiptLink: input.quotationPdfLink,
    receiptUrl: input.quotationPdfLink,
    tagName: "quotation_follow_up",
    skipDefaultTags: true,
    attendant: request.assignedAttendant?.name || request.assignedAttendant?.email || undefined,
    extraFields: {
      customer_name: request.customerName,
      quotation_number: request.quoteRef,
      quotation_date: formatDateLabel(request.quotationDate || request.respondedAt || request.createdAt),
      quotation_link: input.quotationLink,
      quotation_pdf_link: input.quotationPdfLink,
      quotation_url: input.quotationLink,
      recent_installations_url: RECENT_INSTALLATIONS_URL,
      quotation_follow_up_stage: input.trigger,
      quotation_follow_up_template: QUOTATION_FOLLOW_UP_TEMPLATE,
      quote_title: request.quoteTitle || "Betech Solar quotation",
    },
  });

  return result.ok
    ? { ok: true as const }
    : { ok: false as const, error: String(result.debug?.error || "Chatrace flow failed.") };
}

async function hasCustomerPurchasedSinceQuotation(
  request: SerializedQuoteRequest,
  until = new Date(),
) {
  const since = getQuotationDateBase(request);
  const { phoneVariants } = resolveCustomerPhone(request);
  const emailVariants = resolveCustomerEmails(request);
  if (!phoneVariants.length && !emailVariants.length) return false;

  const receiptConditions: Prisma.Sql[] = [];
  if (phoneVariants.length) {
    receiptConditions.push(Prisma.sql`COALESCE("customerPhone", '') IN (${Prisma.join(phoneVariants)})`);
  }
  if (emailVariants.length) {
    receiptConditions.push(
      Prisma.sql`LOWER(COALESCE("customerEmail", '')) IN (${Prisma.join(emailVariants)})`,
    );
  }

  const websiteConditions: Prisma.Sql[] = [];
  if (phoneVariants.length) {
    websiteConditions.push(Prisma.sql`"customerPhone" IN (${Prisma.join(phoneVariants)})`);
  }
  if (emailVariants.length) {
    websiteConditions.push(
      Prisma.sql`LOWER(COALESCE("customerEmail", '')) IN (${Prisma.join(emailVariants)})`,
    );
  }

  const [receiptMatch] = await prisma.$queryRaw<Array<{ matched: boolean }>>(Prisma.sql`
    SELECT EXISTS(
      SELECT 1
      FROM "Order"
      WHERE "createdAt" >= ${since}
        AND "createdAt" <= ${until}
        AND (${Prisma.join(receiptConditions, " OR ")})
        AND UPPER(COALESCE("status"::text, '')) <> 'CANCELLED'
    ) AS "matched"
  `);
  if (Boolean(receiptMatch?.matched)) return true;

  const [websiteMatch] = await prisma.$queryRaw<Array<{ matched: boolean }>>(Prisma.sql`
    SELECT EXISTS(
      SELECT 1
      FROM "WebsiteOrder"
      WHERE "createdAt" >= ${since}
        AND "createdAt" <= ${until}
        AND (${Prisma.join(websiteConditions, " OR ")})
        AND UPPER(COALESCE("status"::text, '')) <> 'CANCELLED'
    ) AS "matched"
  `);

  return Boolean(websiteMatch?.matched);
}

export async function scheduleQuotationFollowUps(
  quoteRequestId: string,
  options?: {
    quotationDate?: Date | null;
    quotationPdfLink?: string | null;
    resetAutomaticFollowUps?: boolean;
    actor?: QuotationFollowUpActor | null;
    applyChatraceTag?: boolean;
  },
) {
  const request = await getQuoteRequestById(quoteRequestId);
  if (!request) return null;

  const quotationDate = options?.quotationDate || getQuotationDateBase(request);
  const quotationLink = getQuotationLink(request);
  const quotationPdfLink = String(options?.quotationPdfLink || request.quotationPdfLink || getQuotationPdfLink(request)).trim();

  if (shouldCancelFollowUps(request.status)) {
    await cancelQuotationFollowUps(quoteRequestId, {
      reason: `Status moved to ${request.status}.`,
      actor: options?.actor,
      suppressEvent: true,
    });
    return request;
  }

  if (!isActiveFollowUpStatus(request.status)) {
    return request;
  }

  await updateQuotationFollowUpFields(quoteRequestId, {
    quotationDate,
    quotationLink,
    quotationPdfLink,
    followUpSent: options?.resetAutomaticFollowUps ? false : undefined,
    followUpScheduledAt: addDays(quotationDate, FIRST_FOLLOW_UP_DAYS),
    followUpSentAt: options?.resetAutomaticFollowUps ? null : undefined,
    secondFollowUpScheduledAt: addDays(quotationDate, SECOND_FOLLOW_UP_DAYS),
    secondFollowUpSentAt: options?.resetAutomaticFollowUps ? null : undefined,
    followUpCancelledAt: null,
  });

  if (options?.applyChatraceTag) {
    await applyQuotationFollowUpTag(request, {
      quotationLink,
      quotationPdfLink,
      trigger: "manual",
    }).catch(() => undefined);
  }

  return getQuoteRequestById(quoteRequestId);
}

export async function cancelQuotationFollowUps(
  quoteRequestId: string,
  options?: {
    reason?: string | null;
    actor?: QuotationFollowUpActor | null;
    suppressEvent?: boolean;
  },
) {
  const request = await getQuoteRequestById(quoteRequestId);
  if (!request) return null;

  await updateQuotationFollowUpFields(quoteRequestId, {
    followUpScheduledAt: null,
    secondFollowUpScheduledAt: null,
    followUpCancelledAt: new Date(),
  });

  if (!options?.suppressEvent) {
    await recordQuotationEvent({
      quoteRequestId,
      eventType: "FOLLOW_UP_CANCELLED",
      eventLabel: "Quotation follow-up cancelled",
      eventDetail: options?.reason || "Automatic quotation follow-up was cancelled.",
      actorUserId: options?.actor?.userId ?? null,
      actorName: options?.actor?.name ?? options?.actor?.email ?? "System",
      metadata: {
        status: request.status,
      },
    }).catch(() => undefined);
  }

  return getQuoteRequestById(quoteRequestId);
}

export async function sendQuotationFollowUp(
  quoteRequestId: string,
  options: {
    trigger: QuotationFollowUpTrigger;
    actor?: QuotationFollowUpActor | null;
    dryRun?: boolean;
  },
) {
  const request = await getQuoteRequestById(quoteRequestId);
  if (!request) {
    throw new Error("Quotation request not found.");
  }

  if (shouldCancelFollowUps(request.status)) {
    await cancelQuotationFollowUps(quoteRequestId, {
      reason: `Quotation is already ${request.status}.`,
      actor: options.actor,
      suppressEvent: true,
    });
    return {
      request,
      skipped: true,
      reason: `Quotation is already ${request.status}.`,
      channels: {
        whatsapp: { ok: false, error: "status_not_eligible" },
        email: { ok: false, error: "status_not_eligible" },
        sms: { ok: false, error: "status_not_eligible" },
      } satisfies QuotationFollowUpChannelResults,
    };
  }

  if (!isActiveFollowUpStatus(request.status)) {
    return {
      request,
      skipped: true,
      reason: "Quotation is not in an active follow-up status.",
      channels: {
        whatsapp: { ok: false, error: "inactive_status" },
        email: { ok: false, error: "inactive_status" },
        sms: { ok: false, error: "inactive_status" },
      } satisfies QuotationFollowUpChannelResults,
    };
  }

  if (options.trigger === "automatic_7_day" && request.followUpSent) {
    return {
      request,
      skipped: true,
      reason: "First automatic follow-up already sent.",
      channels: {
        whatsapp: { ok: false, error: "already_sent" },
        email: { ok: false, error: "already_sent" },
        sms: { ok: false, error: "already_sent" },
      } satisfies QuotationFollowUpChannelResults,
    };
  }

  if (options.trigger === "automatic_21_day" && request.secondFollowUpSentAt) {
    return {
      request,
      skipped: true,
      reason: "Second automatic follow-up already sent.",
      channels: {
        whatsapp: { ok: false, error: "already_sent" },
        email: { ok: false, error: "already_sent" },
        sms: { ok: false, error: "already_sent" },
      } satisfies QuotationFollowUpChannelResults,
    };
  }

  const purchased = await hasCustomerPurchasedSinceQuotation(request);
  if (purchased) {
    await cancelQuotationFollowUps(quoteRequestId, {
      reason: "Customer has already made a purchase after the quotation.",
      actor: options.actor,
      suppressEvent: true,
    });
    await recordQuotationEvent({
      quoteRequestId,
      eventType: "FOLLOW_UP_SKIPPED_PURCHASED",
      eventLabel: "Quotation follow-up skipped",
      eventDetail: "Customer already purchased after the quotation was sent.",
      actorUserId: options.actor?.userId ?? null,
      actorName: options.actor?.name ?? options.actor?.email ?? "System",
      metadata: {
        trigger: options.trigger,
      },
    }).catch(() => undefined);

    return {
      request,
      skipped: true,
      reason: "Customer already purchased after the quotation was sent.",
      channels: {
        whatsapp: { ok: false, error: "customer_purchased" },
        email: { ok: false, error: "customer_purchased" },
        sms: { ok: false, error: "customer_purchased" },
      } satisfies QuotationFollowUpChannelResults,
    };
  }

  const currentDate = getQuotationDateBase(request);
  if (options.dryRun) {
    return {
      request,
      skipped: false,
      reason: null,
      dryRun: true,
      channels: {
        whatsapp: { ok: Boolean(resolveCustomerPhone(request).normalizedPhone) },
        email: { ok: Boolean(request.customerEmail) },
        sms: { ok: Boolean(resolveCustomerPhone(request).normalizedPhone) },
      } satisfies QuotationFollowUpChannelResults,
      quotationDate: currentDate.toISOString(),
    };
  }

  const assets = await prepareQuotationPdfAssets(request, {
    name: options.actor?.name ?? null,
    email: options.actor?.email ?? null,
  });
  const quotationLink = getQuotationLink(request);
  const quotationPdfLink = String(assets.whatsappPdfUrl || assets.pdfUrl || getQuotationPdfLink(request)).trim();
  const { normalizedPhone } = resolveCustomerPhone(request);

  const channels: QuotationFollowUpChannelResults = {
    whatsapp: { ok: false, error: "missing_phone" },
    email: { ok: false, error: "missing_email" },
    sms: { ok: false, error: "missing_phone" },
  };

  if (normalizedPhone) {
    try {
      channels.whatsapp = await applyQuotationFollowUpTag(request, {
        quotationLink,
        quotationPdfLink,
        trigger: options.trigger,
      });
    } catch (error) {
      channels.whatsapp = {
        ok: false,
        error: error instanceof Error ? error.message : "WhatsApp follow-up failed.",
      };
    }
  }

  if (request.customerEmail) {
    try {
      await sendGeneralCustomerNotificationEmail({
        to: request.customerEmail,
        subject: `Follow-up on quotation ${request.quoteRef}`,
        title: request.quoteTitle || "Quotation follow-up",
        intro: `Quotation reference: ${request.quoteRef}`,
        bodyHtml: buildFollowUpEmailBody(request, quotationLink),
        bodyText: buildFollowUpEmailText(request, quotationLink),
        ctaLabel: "Open quotation",
        ctaUrl: quotationLink,
        outro: "Reply to this email if you would like us to revise the quotation.",
        attachments: [
          {
            filename: `${request.quoteRef}.pdf`,
            content: assets.pdfBuffer,
            contentType: "application/pdf",
          },
        ],
      });
      channels.email = { ok: true };
    } catch (error) {
      channels.email = {
        ok: false,
        error: error instanceof Error ? error.message : "Email follow-up failed.",
      };
    }
  }

  if (normalizedPhone) {
    try {
      await sendTransactionalSms(normalizedPhone, buildFollowUpSms(request, quotationLink));
      channels.sms = { ok: true };
    } catch (error) {
      channels.sms = {
        ok: false,
        error: error instanceof Error ? error.message : "SMS follow-up failed.",
      };
    }
  }

  const sentAt = new Date();
  await updateQuotationFollowUpFields(quoteRequestId, {
    quotationDate: currentDate,
    quotationLink,
    quotationPdfLink,
    followUpSent:
      options.trigger === "automatic_7_day" || (options.trigger === "manual" && !request.followUpSent)
        ? true
        : undefined,
    followUpSentAt:
      options.trigger === "automatic_7_day" || (options.trigger === "manual" && !request.followUpSent)
        ? sentAt
        : undefined,
    secondFollowUpSentAt: options.trigger === "automatic_21_day" ? sentAt : undefined,
    followUpCancelledAt: null,
  });

  const label =
    options.trigger === "manual"
      ? "Manual follow-up sent"
      : options.trigger === "automatic_21_day"
        ? "21-day automatic follow-up sent"
        : "Automatic follow-up sent";

  await recordQuotationEvent({
    quoteRequestId,
    eventType:
      options.trigger === "manual"
        ? "FOLLOW_UP_MANUAL_SENT"
        : options.trigger === "automatic_21_day"
          ? "FOLLOW_UP_21_DAY_SENT"
          : "FOLLOW_UP_7_DAY_SENT",
    eventLabel: label,
    eventDetail: buildChannelDetail(channels),
    actorUserId: options.actor?.userId ?? null,
    actorName: options.actor?.name ?? options.actor?.email ?? (options.trigger === "manual" ? "Quotation attendant" : "System"),
    metadata: {
      trigger: options.trigger,
      channels,
      quotationLink,
      quotationPdfLink,
    },
  }).catch(() => undefined);

  return {
    request: await getQuoteRequestById(quoteRequestId),
    skipped: false,
    reason: null,
    channels,
  };
}

export async function processDueQuotationFollowUps(input?: { limit?: number; dryRun?: boolean }) {
  await ensureQuoteRequestsSchema();
  const limit = Math.min(Math.max(Number(input?.limit || 50), 1), 250);
  const now = new Date();

  const rows = await prisma.$queryRaw<DueFollowUpRow[]>(Prisma.sql`
    SELECT
      "id",
      "followUpSent",
      "followUpScheduledAt",
      "secondFollowUpScheduledAt",
      "secondFollowUpSentAt"
    FROM "QuoteRequest"
    WHERE (
      ("followUpScheduledAt" IS NOT NULL AND "followUpScheduledAt" <= ${now} AND COALESCE("followUpSent", FALSE) = FALSE)
      OR
      ("secondFollowUpScheduledAt" IS NOT NULL AND "secondFollowUpScheduledAt" <= ${now} AND "secondFollowUpSentAt" IS NULL)
    )
    ORDER BY COALESCE("followUpScheduledAt", "secondFollowUpScheduledAt") ASC
    LIMIT ${limit}
  `);

  const summary = {
    scanned: rows.length,
    sent: 0,
    skipped: 0,
    failed: 0,
    results: [] as Array<Record<string, unknown>>,
  };

  for (const row of rows) {
    const trigger: QuotationFollowUpTrigger =
      !Boolean(row.followUpSent) && toDate(row.followUpScheduledAt)?.getTime() && (toDate(row.followUpScheduledAt)?.getTime() || 0) <= now.getTime()
        ? "automatic_7_day"
        : "automatic_21_day";
    try {
      const result = await sendQuotationFollowUp(row.id, { trigger, dryRun: input?.dryRun });
      if (result.skipped) summary.skipped += 1;
      else summary.sent += 1;
      summary.results.push({
        quoteRequestId: row.id,
        trigger,
        skipped: result.skipped,
        reason: result.reason,
        channels: result.channels,
      });
    } catch (error) {
      summary.failed += 1;
      summary.results.push({
        quoteRequestId: row.id,
        trigger,
        skipped: false,
        error: error instanceof Error ? error.message : "Failed to send quotation follow-up.",
      });
    }
  }

  return summary;
}

export function quotationFollowUpCronResponse(data: unknown, init?: ResponseInit) {
  return noStoreJson(data, init);
}
