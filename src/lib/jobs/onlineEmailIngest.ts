import "server-only";

import { prisma } from "@/lib/prisma";
import { MarketplaceDigestBucket, MarketplaceEmailParseStatus, MarketplaceEmailParserType, Platform } from "@prisma/client";
import {
  decodeMaybeQuotedPrintable,
  extractBodyParts,
  extractEmailAddress,
  getHeader,
  gmailGetMessage,
  gmailListMessages,
  refreshGmailAccessToken,
  type GmailHeader,
} from "@/lib/integrations/gmail";

const DEFAULT_LOOKBACK_DAYS = Number.parseInt(process.env.ONLINE_EMAIL_LOOKBACK_DAYS || "", 10) || 2;
const DEFAULT_MAX_MESSAGES = Number.parseInt(process.env.ONLINE_EMAIL_MAX_MESSAGES || "", 10) || 250;

const afterSalesKeywords = [
  "after sales",
  "after-sales",
  "refund",
  "return",
  "complaint",
  "dispute",
  "chargeback",
  "cancellation",
  "refund request",
];

const NAIROBI_TZ = "Africa/Nairobi";
const NAIROBI_TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: NAIROBI_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function normalizeKey(input: string | null | undefined): string {
  return (input ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeBodyText(input: string): string {
  return input
    .replace(/\u00a0/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/[’‘]/g, "'")
    // Common mojibake seen in some exports/encodings.
    .replace(/â€™/g, "'")
    .replace(/â€“/g, "-");
}

function getDigestBucket(receivedAt: Date): MarketplaceDigestBucket {
  // Bucket by closest expected send time in Nairobi: ~07:30 and ~13:30.
  // This is robust to slight delivery delays (e.g., 07:42 still counts as "morning").
  const parts = NAIROBI_TIME_FORMATTER.formatToParts(receivedAt);
  const hour = Number.parseInt(parts.find((p) => p.type === "hour")?.value ?? "", 10);
  const minute = Number.parseInt(parts.find((p) => p.type === "minute")?.value ?? "", 10);
  const totalMinutes = (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0);

  const MORNING_TARGET = 7 * 60 + 30;
  const MIDDAY_TARGET = 13 * 60 + 30;
  const diffMorning = Math.abs(totalMinutes - MORNING_TARGET);
  const diffMidday = Math.abs(totalMinutes - MIDDAY_TARGET);

  return diffMorning <= diffMidday ? MarketplaceDigestBucket.MORNING : MarketplaceDigestBucket.MIDDAY;
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

function parseDateOnlyUtc(iso: string): Date | null {
  const s = iso.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function htmlToText(html: string): string {
  const stripped = html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/table>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"');
  return stripped.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function inferPlatform(fromEmail: string | null, subject: string | null, bodyText: string): Platform | null {
  const hay = normalizeBodyText(`${fromEmail ?? ""}\n${subject ?? ""}\n${bodyText}`).toLowerCase();
  if (hay.includes("jumia")) return Platform.JUMIA;
  if (hay.includes("kilimall")) return Platform.KILIMALL;
  if (hay.includes("ordersn")) return Platform.KILIMALL;
  if (hay.includes("daily order report") || hay.includes("today's order summary")) return Platform.JUMIA;
  return null;
}

function inferParserType(subject: string | null, bodyText: string, platform: Platform | null): MarketplaceEmailParserType {
  const s = (subject ?? "").toLowerCase();
  const t = normalizeBodyText(bodyText).toLowerCase();

  const hasTodaysSummary = t.includes("today's order summary") || t.includes("todays order summary");
  const kpiLabels = [
    "new orders",
    "pending today",
    "ready to ship",
    "returned today",
    "cancelled today",
    "delivered today",
    "delivery failed",
  ];
  const kpiHits = kpiLabels.reduce((acc, k) => acc + (t.includes(k) ? 1 : 0), 0);
  if ((s.includes("daily order report") || hasTodaysSummary) && kpiHits >= 3) return MarketplaceEmailParserType.JUMIA_DAILY_REPORT;

  const isPickup = s.includes("ready for pickup") || t.includes("ready for pickup");
  const hasTrackingTable = t.includes("package / tracking number") || (t.includes("tracking number") && t.includes("remaining days"));
  if (isPickup && hasTrackingTable) return MarketplaceEmailParserType.JUMIA_RETURN_PICKUP;

  if (t.includes("your store") && t.includes("ordersn")) return MarketplaceEmailParserType.KILIMALL_NEW_ORDER;

  if ((platform === Platform.KILIMALL || t.includes("kilimall")) && afterSalesKeywords.some((k) => t.includes(k))) {
    return MarketplaceEmailParserType.KILIMALL_AFTERSALES;
  }
  return MarketplaceEmailParserType.UNKNOWN;
}

function extractForwardedFromEmail(bodyText: string): string | null {
  const t = bodyText;
  // Common Gmail forwarded block: "---------- Forwarded message ---------\nFrom: Name <email>"
  const forwardedBlock = t.match(/forwarded message[\s\S]{0,500}?from:\s*([^\n]+)/i);
  const rawFrom = forwardedBlock?.[1] ?? null;
  const email = extractEmailAddress(rawFrom);
  if (email) return email;
  // Generic "forwarded from: email"
  const marker = t.match(/forwarded\s+from:\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
  return marker?.[1] ? marker[1].trim().toLowerCase() : null;
}

function parseJumiaDailyDigest(bodyText: string, subject: string | null): {
  digestDate: Date;
  newOrders: number;
  pendingToday: number;
  readyToShip: number;
  returnedToday: number;
  cancelledToday: number;
  deliveredToday: number;
  deliveryFailed: number;
} | null {
  const s = normalizeBodyText(`${subject ?? ""}\n${bodyText}`);
  const dateMatch =
    s.match(/Daily Order Report\s*-\s*(\d{4}-\d{2}-\d{2})/i) ??
    s.match(/Today's Order Summary\s*(\d{4}-\d{2}-\d{2})/i) ??
    s.match(/Todays Order Summary\s*(\d{4}-\d{2}-\d{2})/i) ??
    s.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  const dateStr = dateMatch?.[1];
  const digestDate = dateStr ? parseDateOnlyUtc(dateStr) : null;
  if (!digestDate) return null;

  const escapeRe = (input: string) => input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const labelRe = (label: string) => escapeRe(label).replace(/\s+/g, "\\s+");
  const getInt = (label: string) => {
    const re = new RegExp(String.raw`(?:^|\b)(\d+)\s+${labelRe(label)}\b`, "i");
    const m = s.match(re);
    return m?.[1] ? Number.parseInt(m[1], 10) : 0;
  };

  return {
    digestDate,
    newOrders: getInt("New Orders"),
    pendingToday: getInt("Pending Today"),
    readyToShip: getInt("Ready to Ship"),
    returnedToday: getInt("Returned Today"),
    cancelledToday: getInt("Cancelled Today"),
    deliveredToday: getInt("Delivered Today"),
    deliveryFailed: getInt("Delivery Failed"),
  };
}

function parseJumiaReturnPickup(bodyText: string): {
  stationName: string | null;
  totalItems: number | null;
  totalPackages: number | null;
  rows: { trackingNumber: string; orderNumber: string | null; itemDescription: string; remainingDays: number }[];
} | null {
  const t = normalizeBodyText(bodyText);
  const totals = t.match(/total\s+of\s+(\d+)\s+item\(s\)\s+in\s+(\d+)\s+package\(s\)/i);
  const totalItems = totals?.[1] ? Number.parseInt(totals[1], 10) : null;
  const totalPackages = totals?.[2] ? Number.parseInt(totals[2], 10) : null;
  const station = t.match(/pick\s*up\s*in\s+([^\n\r]+)/i);
  const stationNameRaw = station?.[1]?.trim() ? station[1].trim() : null;
  const stationName = stationNameRaw ? stationNameRaw.replace(/[.。]\s*$/, "") : null;

  const rows: { trackingNumber: string; orderNumber: string | null; itemDescription: string; remainingDays: number }[] = [];

  // Variant A (labelled blocks, as in earlier sample exports)
  const rowRegex =
    /Package\s*\/\s*Tracking\s*Number\s*([A-Z0-9-]+)[\s\S]*?Order\s*Number\s*([A-Z0-9-]+)?[\s\S]*?Item\s*Description\s*([\s\S]*?)\s*Remaining\s*Days\s*(\d+)\s*day\(s\)/gi;
  let m: RegExpExecArray | null;
  while ((m = rowRegex.exec(t))) {
    const trackingNumber = (m[1] ?? "").trim();
    const orderNumber = (m[2] ?? "").trim() || null;
    const itemDescription = (m[3] ?? "").replace(/\s+/g, " ").trim();
    const remainingDays = m[4] ? Number.parseInt(m[4], 10) : 0;
    if (!trackingNumber) continue;
    rows.push({ trackingNumber, orderNumber, itemDescription, remainingDays });
  }

  // Variant B (table-style rows)
  if (!rows.length) {
    const lines = t
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean);
    const headerIdx = lines.findIndex((l) =>
      /Package\s*\/\s*Tracking\s*Number/i.test(l) &&
      /Order\s*Number/i.test(l) &&
      /Item\s*Description/i.test(l) &&
      /Remaining\s*Days/i.test(l),
    );
    if (headerIdx >= 0) {
      for (const line of lines.slice(headerIdx + 1)) {
        if (/^note:/i.test(line) || /^these are some important/i.test(line)) break;
        const mm = line.match(/^([A-Z0-9-]+)\s+([A-Z0-9-]+)\s+(.+?)\s+(\d+)\s*day\(s\)\b/i);
        if (!mm) continue;
        const trackingNumber = mm[1].trim();
        const orderNumber = mm[2].trim() || null;
        const itemDescription = mm[3].replace(/^Item\s*Description\s*/i, "").replace(/\s+/g, " ").trim();
        const remainingDays = Number.parseInt(mm[4], 10);
        if (!trackingNumber) continue;
        rows.push({ trackingNumber, orderNumber, itemDescription, remainingDays: Number.isFinite(remainingDays) ? remainingDays : 0 });
      }
    }
  }

  if (!rows.length && !stationName && totalItems == null && totalPackages == null) return null;
  return { stationName, totalItems, totalPackages, rows };
}

function parseKilimallNewOrder(bodyText: string): { shopLabel: string | null; orderNumber: string; itemTitle: string | null } | null {
  const orderMatch = bodyText.match(/ordersn\s+(\d+)/i);
  const orderNumber = orderMatch?.[1]?.trim();
  if (!orderNumber) return null;

  const t = normalizeBodyText(bodyText);
  const shopMatch =
    t.match(/Your store\s*(?:【|\[|\()?\s*([^】\]\)]+?)\s*(?:】|\]|\))\s+has received/i) ??
    t.match(/Your store\s*(?:【|\[|\()?\s*([^】\]\)]+?)\s*(?:】|\]|\))?/i);
  const shopLabel = shopMatch?.[1]?.trim() || null;

  let itemTitle: string | null = null;
  const productSection = t.split(/\bProduct information\b/i);
  if (productSection.length > 1) {
    const after = productSection[1];
    const line = after
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l && !/^(sku|qty|quantity|price|amount|receiver|address|phone)\b/i.test(l));
    if (line) itemTitle = line.slice(0, 200);
  }

  return { shopLabel, orderNumber, itemTitle };
}

async function mapAccountForEmail(opts: {
  platform: Platform;
  mailboxEmail: string;
  fromEmail: string | null;
  forwardedFromEmail: string | null;
  shopLabel: string | null;
}): Promise<{ id: string; displayName: string; platform: Platform } | null> {
  const platform = opts.platform;
  const mailboxEmail = normalizeKey(opts.mailboxEmail);
  const fromEmail = normalizeKey(opts.fromEmail);
  const forwardedFromEmail = normalizeKey(opts.forwardedFromEmail);
  const shopLabel = normalizeKey(opts.shopLabel);

  let accounts: Array<{
    id: string;
    displayName: string;
    platform: Platform;
    primaryInboxEmail?: string | null;
    forwarderEmails?: string[];
  }> = [];

  try {
    accounts = await prisma.marketplaceAccount.findMany({
      where: { isActive: true, platform },
      select: { id: true, displayName: true, platform: true, primaryInboxEmail: true, forwarderEmails: true },
    });
  } catch {
    // Backward-compatible: DB not migrated yet (missing primaryInboxEmail/forwarderEmails columns)
    const fallback = await prisma.marketplaceAccount.findMany({
      where: { isActive: true, platform },
      select: { id: true, displayName: true, platform: true },
    });
    accounts = fallback.map((a) => ({ ...a, primaryInboxEmail: null, forwarderEmails: [] }));
  }

  const byForwarder = (email: string) =>
    accounts.find((a) => (a.forwarderEmails ?? []).map((e) => normalizeKey(e)).includes(email)) ?? null;

  const byPrimary = accounts.find((a) => normalizeKey(a.primaryInboxEmail) === mailboxEmail) ?? null;
  if (forwardedFromEmail) {
    const match = byForwarder(forwardedFromEmail);
    if (match) return { id: match.id, displayName: match.displayName, platform: match.platform };
  }
  if (fromEmail) {
    const match = byForwarder(fromEmail);
    if (match) return { id: match.id, displayName: match.displayName, platform: match.platform };
  }
  if (shopLabel) {
    const match = accounts.find((a) => normalizeKey(a.displayName) === shopLabel) ?? null;
    if (match) return { id: match.id, displayName: match.displayName, platform: match.platform };
    const loose = accounts.find((a) => normalizeKey(a.displayName).includes(shopLabel) || shopLabel.includes(normalizeKey(a.displayName)));
    if (loose) return { id: loose.id, displayName: loose.displayName, platform: loose.platform };
  }
  if (byPrimary) return { id: byPrimary.id, displayName: byPrimary.displayName, platform: byPrimary.platform };
  return null;
}

function extractReceivedAt(headers: GmailHeader[] | undefined, internalDate: string | undefined): Date {
  const dateHeader = getHeader(headers, "Date");
  if (dateHeader) {
    const d = new Date(dateHeader);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const id = internalDate ? Number.parseInt(internalDate, 10) : NaN;
  if (Number.isFinite(id)) return new Date(id);
  return new Date();
}

async function upsertDailyDigestPreferLatest(opts: {
  accountId: string;
  platform: Platform;
  digestDate: Date;
  receivedAt: Date;
  sourceMessageId: string;
  values: {
    newOrders: number;
    pendingToday: number;
    readyToShip: number;
    returnedToday: number;
    cancelledToday: number;
    deliveredToday: number;
    deliveryFailed: number;
  };
}): Promise<{ wrote: boolean }> {
  const key = { accountId: opts.accountId, platform: opts.platform, digestDate: opts.digestDate };

  return prisma.$transaction(async (tx) => {
    const existing = await tx.marketplaceDailyOrderDigest.findUnique({
      where: { accountId_platform_digestDate: key },
      select: { id: true, lastReceivedAt: true },
    });

    const shouldWrite = !existing?.lastReceivedAt || existing.lastReceivedAt.getTime() <= opts.receivedAt.getTime();
    if (!existing) {
      try {
        await tx.marketplaceDailyOrderDigest.create({
          data: {
            ...key,
            ...opts.values,
            sourceMessageId: opts.sourceMessageId,
            lastReceivedAt: opts.receivedAt,
          },
          select: { id: true },
        });
        return { wrote: true };
      } catch (e: any) {
        // Race / already exists: re-check and apply update rules.
        const code = e?.code ?? e?.meta?.code;
        if (code !== "P2002") throw e;
      }
    }

    const existing2 = await tx.marketplaceDailyOrderDigest.findUnique({
      where: { accountId_platform_digestDate: key },
      select: { id: true, lastReceivedAt: true },
    });

    const shouldWrite2 = !existing2?.lastReceivedAt || existing2.lastReceivedAt.getTime() <= opts.receivedAt.getTime();
    if (!shouldWrite2 || !existing2) return { wrote: false };

    await tx.marketplaceDailyOrderDigest.update({
      where: { id: existing2.id },
      data: {
        ...opts.values,
        sourceMessageId: opts.sourceMessageId,
        lastReceivedAt: opts.receivedAt,
      },
      select: { id: true },
    });

    return { wrote: true };
  });
}

async function upsertDailyDigestSnapshotPreferLatest(opts: {
  accountId: string;
  platform: Platform;
  digestDate: Date;
  bucket: MarketplaceDigestBucket;
  receivedAt: Date;
  sourceMessageId: string;
  values: {
    newOrders: number;
    pendingToday: number;
    readyToShip: number;
    returnedToday: number;
    cancelledToday: number;
    deliveredToday: number;
    deliveryFailed: number;
  };
}): Promise<{ wrote: boolean }> {
  const key = { accountId: opts.accountId, platform: opts.platform, digestDate: opts.digestDate, bucket: opts.bucket };

  return prisma.$transaction(async (tx) => {
    const existing = await tx.marketplaceDailyOrderDigestSnapshot.findUnique({
      where: { accountId_platform_digestDate_bucket: key },
      select: { id: true, receivedAt: true },
    });

    if (!existing) {
      try {
        await tx.marketplaceDailyOrderDigestSnapshot.create({
          data: {
            ...key,
            ...opts.values,
            sourceMessageId: opts.sourceMessageId,
            receivedAt: opts.receivedAt,
          },
          select: { id: true },
        });
        return { wrote: true };
      } catch (e: any) {
        const code = e?.code ?? e?.meta?.code;
        if (code !== "P2002") throw e;
      }
    }

    const existing2 = await tx.marketplaceDailyOrderDigestSnapshot.findUnique({
      where: { accountId_platform_digestDate_bucket: key },
      select: { id: true, receivedAt: true },
    });

    const shouldWrite = !existing2?.receivedAt || existing2.receivedAt.getTime() <= opts.receivedAt.getTime();
    if (!shouldWrite || !existing2) return { wrote: false };

    await tx.marketplaceDailyOrderDigestSnapshot.update({
      where: { id: existing2.id },
      data: {
        ...opts.values,
        sourceMessageId: opts.sourceMessageId,
        receivedAt: opts.receivedAt,
      },
      select: { id: true },
    });

    return { wrote: true };
  });
}

export type OnlineEmailIngestMailboxResult = {
  mailboxId: string;
  email: string;
  scanned: number;
  fetched: number;
  skippedExisting: number;
  createdMessages: number;
  parsed: number;
  failed: number;
  errors: string[];
};

export async function ingestOnlineMarketplaceEmails(opts?: { lookbackDays?: number; maxMessages?: number }) {
  const lookbackDays = opts?.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
  const maxMessages = opts?.maxMessages ?? DEFAULT_MAX_MESSAGES;

  const mailboxes = await prisma.marketplaceMailbox.findMany({
    where: { isActive: true },
    include: { oauth: true },
    orderBy: { email: "asc" },
  });

  const overall: { ok: boolean; mailboxes: OnlineEmailIngestMailboxResult[] } = { ok: true, mailboxes: [] };

  for (const mailbox of mailboxes) {
    const result: OnlineEmailIngestMailboxResult = {
      mailboxId: mailbox.id,
      email: mailbox.email,
      scanned: 0,
      fetched: 0,
      skippedExisting: 0,
      createdMessages: 0,
      parsed: 0,
      failed: 0,
      errors: [],
    };
    overall.mailboxes.push(result);

    if (!mailbox.oauth?.refreshToken) {
      result.errors.push("MISSING_OAUTH_REFRESH_TOKEN");
      overall.ok = false;
      continue;
    }

    let accessToken: string;
    try {
      const refreshed = await refreshGmailAccessToken({ refreshToken: mailbox.oauth.refreshToken });
      accessToken = refreshed.accessToken;
    } catch (e) {
      result.errors.push(e instanceof Error ? e.message : String(e));
      overall.ok = false;
      continue;
    }

    const q = `newer_than:${lookbackDays}d (jumia OR kilimall OR ordersn OR "Daily Order Report" OR "Today's Order Summary" OR "ready for pickup" OR refund OR dispute)`;

    let pageToken: string | undefined;
    const messageIds: string[] = [];
    try {
      while (messageIds.length < maxMessages) {
        const list = await gmailListMessages({ accessToken, q, maxResults: Math.min(100, maxMessages - messageIds.length), pageToken });
        const ids = (list.messages ?? []).map((m) => m.id).filter(Boolean);
        messageIds.push(...ids);
        pageToken = list.nextPageToken;
        if (!pageToken || !ids.length) break;
      }
    } catch (e) {
      result.errors.push(e instanceof Error ? e.message : String(e));
      overall.ok = false;
      continue;
    }

    result.scanned = messageIds.length;

    for (const messageId of messageIds) {
      const exists =
        (await prisma.marketplaceEmailMessage.findUnique({
          where: { mailboxId_gmailMessageId: { mailboxId: mailbox.id, gmailMessageId: messageId } },
          select: { id: true },
        })) ??
        // Backward-compatible (older rows stored providerMsgId=gmailMessageId)
        (await prisma.marketplaceEmailMessage.findUnique({ where: { providerMsgId: messageId }, select: { id: true } }));
      if (exists) {
        result.skippedExisting += 1;
        continue;
      }

      let full: any;
      try {
        full = await gmailGetMessage({ accessToken, messageId });
        result.fetched += 1;
      } catch (e) {
        result.errors.push(`fetch:${messageId}:${e instanceof Error ? e.message : String(e)}`);
        overall.ok = false;
        continue;
      }

      const headers = full?.payload?.headers as GmailHeader[] | undefined;
      const fromRaw = getHeader(headers, "From");
      const subject = getHeader(headers, "Subject");
      const fromEmail = extractEmailAddress(fromRaw);
      const receivedAt = extractReceivedAt(headers, full?.internalDate);

      const { html, text } = extractBodyParts(full);
      const bodyTextRaw = (text && text.trim()) ? text : (html ? htmlToText(html) : "");
      const bodyText = normalizeBodyText(decodeMaybeQuotedPrintable(bodyTextRaw));

      const forwardedFromEmail = extractForwardedFromEmail(bodyText);

      const platform = inferPlatform(fromEmail, subject, bodyText);
      const parserType = inferParserType(subject, bodyText, platform);

      const parsedKilimall = parserType === MarketplaceEmailParserType.KILIMALL_NEW_ORDER ? parseKilimallNewOrder(bodyText) : null;

      // Persist raw email first (never lose the record)
      const emailRow = await prisma.marketplaceEmailMessage.create({
        data: {
          mailboxId: mailbox.id,
          providerMsgId: `${mailbox.id}:${messageId}`,
          gmailMessageId: messageId,
          threadId: full?.threadId ?? null,
          fromEmail,
          subject,
          receivedAt,
          snippet: full?.snippet ?? null,
          rawHeaders: headers ? headers : undefined,
          rawBodyHtml: html ?? null,
          rawBodyText: bodyText || null,
          parserType,
          parseStatus: MarketplaceEmailParseStatus.SKIPPED,
        },
        select: { id: true },
      });
      result.createdMessages += 1;

      if (!platform || parserType === MarketplaceEmailParserType.UNKNOWN) {
        continue;
      }

      let parseStatus: MarketplaceEmailParseStatus = MarketplaceEmailParseStatus.PARSED;
      let parseError: string | null = null;
      try {
        if (parserType === MarketplaceEmailParserType.JUMIA_DAILY_REPORT) {
          const digest = parseJumiaDailyDigest(bodyText, subject);
          if (!digest) throw new Error("JUMIA_DAILY_DIGEST_NOT_MATCHED");

          const shopLabel = extractJumiaShopLabel(subject, bodyText);
          const account = await mapAccountForEmail({
            platform,
            mailboxEmail: mailbox.email,
            fromEmail,
            forwardedFromEmail,
            shopLabel,
          });
          if (!account) throw new Error("ACCOUNT_MAPPING_FAILED");

          await upsertDailyDigestPreferLatest({
            accountId: account.id,
            platform,
            digestDate: digest.digestDate,
            receivedAt,
            sourceMessageId: emailRow.id,
            values: {
              newOrders: digest.newOrders,
              pendingToday: digest.pendingToday,
              readyToShip: digest.readyToShip,
              returnedToday: digest.returnedToday,
              cancelledToday: digest.cancelledToday,
              deliveredToday: digest.deliveredToday,
              deliveryFailed: digest.deliveryFailed,
            },
          });

          const bucket = getDigestBucket(receivedAt);
          await upsertDailyDigestSnapshotPreferLatest({
            accountId: account.id,
            platform,
            digestDate: digest.digestDate,
            bucket,
            receivedAt,
            sourceMessageId: emailRow.id,
            values: {
              newOrders: digest.newOrders,
              pendingToday: digest.pendingToday,
              readyToShip: digest.readyToShip,
              returnedToday: digest.returnedToday,
              cancelledToday: digest.cancelledToday,
              deliveredToday: digest.deliveredToday,
              deliveryFailed: digest.deliveryFailed,
            },
          });
        } else if (parserType === MarketplaceEmailParserType.JUMIA_RETURN_PICKUP) {
          const pickup = parseJumiaReturnPickup(bodyText);
          if (!pickup) throw new Error("JUMIA_RETURN_PICKUP_NOT_MATCHED");

          const shopLabel = extractJumiaReturnShopLabel(subject, bodyText);
          const account = await mapAccountForEmail({
            platform,
            mailboxEmail: mailbox.email,
            fromEmail,
            forwardedFromEmail,
            shopLabel,
          });
          if (!account) throw new Error("ACCOUNT_MAPPING_FAILED");

          for (const row of pickup.rows) {
            const dueAt = addDays(receivedAt, Math.max(0, row.remainingDays));
            const rawPayload = {
              stationName: pickup.stationName,
              totalItems: pickup.totalItems,
              totalPackages: pickup.totalPackages,
              trackingNumber: row.trackingNumber,
              orderNumber: row.orderNumber,
              itemDescription: row.itemDescription,
              remainingDays: row.remainingDays,
              gmailMessageId: messageId,
              mailbox: mailbox.email,
              receivedAt: receivedAt.toISOString(),
            };

            await prisma.marketplaceReturn.upsert({
              where: { platform_orderItemId: { platform: "JUMIA", orderItemId: row.trackingNumber } },
              create: {
                accountId: account.id,
                platform: "JUMIA",
                marketplaceOrderId: null,
                orderItemId: row.trackingNumber,
                expectedAmount: 0,
                dueAt,
                status: "WAITING_AT_HUB",
                notes: pickup.stationName ? `Pickup at ${pickup.stationName}` : null,
                rawPayload,
                sourceEmailMessageId: emailRow.id,
              },
              update: {
                accountId: account.id,
                dueAt,
                status: "WAITING_AT_HUB",
                notes: pickup.stationName ? `Pickup at ${pickup.stationName}` : null,
                rawPayload,
                sourceEmailMessageId: emailRow.id,
              },
            });
          }
        } else if (parserType === MarketplaceEmailParserType.KILIMALL_NEW_ORDER) {
          const parsed = parsedKilimall ?? parseKilimallNewOrder(bodyText);
          if (!parsed) throw new Error("KILIMALL_NEW_ORDER_NOT_MATCHED");

          const account = await mapAccountForEmail({
            platform,
            mailboxEmail: mailbox.email,
            fromEmail,
            forwardedFromEmail,
            shopLabel: parsed.shopLabel,
          });
          if (!account) throw new Error("ACCOUNT_MAPPING_FAILED");

          const order = await prisma.marketplaceOrder.upsert({
            where: { platform_orderItemId: { platform: "KILIMALL", orderItemId: parsed.orderNumber } },
            create: {
              accountId: account.id,
              platform: "KILIMALL",
              orderId: parsed.orderNumber,
              orderItemId: parsed.orderNumber,
              status: "PENDING",
              orderedAt: receivedAt,
              productName: parsed.itemTitle ?? `Order ${parsed.orderNumber}`,
              sellingPrice: 0,
              rawPayload: {
                kind: "KILIMALL_NEW_ORDER_EMAIL",
                shopLabel: parsed.shopLabel,
                orderNumber: parsed.orderNumber,
                itemTitle: parsed.itemTitle,
                gmailMessageId: messageId,
                mailbox: mailbox.email,
                receivedAt: receivedAt.toISOString(),
              },
            },
            update: {
              status: "PENDING",
              productName: parsed.itemTitle ?? undefined,
              rawPayload: {
                kind: "KILIMALL_NEW_ORDER_EMAIL",
                shopLabel: parsed.shopLabel,
                orderNumber: parsed.orderNumber,
                itemTitle: parsed.itemTitle,
                gmailMessageId: messageId,
                mailbox: mailbox.email,
                receivedAt: receivedAt.toISOString(),
              },
            },
            select: { id: true },
          });

          await prisma.marketplaceOrderEvent.upsert({
            where: { marketplaceOrderId_status: { marketplaceOrderId: order.id, status: "PENDING" } },
            create: {
              marketplaceOrderId: order.id,
              platform: "KILIMALL",
              status: "PENDING",
              occurredAt: receivedAt,
              sourceMessageId: emailRow.id,
              rawPayload: { gmailMessageId: messageId, mailbox: mailbox.email },
            },
            update: {
              occurredAt: receivedAt,
              sourceMessageId: emailRow.id,
              rawPayload: { gmailMessageId: messageId, mailbox: mailbox.email },
            },
          });
        } else if (parserType === MarketplaceEmailParserType.KILIMALL_AFTERSALES) {
          const keywordsFound = afterSalesKeywords.filter((k) => bodyText.toLowerCase().includes(k));

          const account = await mapAccountForEmail({
            platform,
            mailboxEmail: mailbox.email,
            fromEmail,
            forwardedFromEmail,
            shopLabel: null,
          });

          await prisma.marketplaceAfterSalesThread.create({
            data: {
              accountId: account?.id ?? null,
              platform: "KILIMALL",
              mailboxId: mailbox.id,
              sourceMessageId: emailRow.id,
              subject,
              fromEmail,
              receivedAt,
              status: "OPEN",
              keywords: keywordsFound,
            },
          });
        }
      } catch (e) {
        parseStatus = MarketplaceEmailParseStatus.FAILED;
        parseError = e instanceof Error ? e.message : String(e);
      }

      if (parseStatus === MarketplaceEmailParseStatus.PARSED) result.parsed += 1;
      if (parseStatus === MarketplaceEmailParseStatus.FAILED) result.failed += 1;

      await prisma.marketplaceEmailMessage.update({
        where: { id: emailRow.id },
        data: { parseStatus, parseError },
      });
    }
  }

  return overall;
}

function getStoredBodyText(message: { rawBodyText?: string | null; rawBodyHtml?: string | null }): string {
  const rawText = decodeMaybeQuotedPrintable((message.rawBodyText ?? "").trim());
  if (rawText) return normalizeBodyText(rawText);
  const rawHtml = decodeMaybeQuotedPrintable((message.rawBodyHtml ?? "").trim());
  if (rawHtml) return normalizeBodyText(htmlToText(rawHtml));
  return "";
}

function extractJumiaShopLabel(subject: string | null, bodyText: string): string | null {
  const s = (subject ?? "").toString();
  // e.g. "Jumia Kenya :: Daily Order Report - 2026-03-05 - Betech Store Today's Order Summary"
  const m = s.match(/Daily Order Report\s*-\s*\d{4}-\d{2}-\d{2}\s*-\s*([^–-]+?)\s*(?:Today|Today's|Todays|$)/i);
  if (m?.[1]) return m[1].trim();

  // Body may start with: "Sky Store Ke Today's Order Summary 2026-03-05"
  // (shop and summary on same line or same heading block).
  const inline = normalizeBodyText(bodyText).match(/^\s*([^\n]{2,80}?)\s+today'?s\s+order\s+summary\b/im);
  if (inline?.[1] && !/jumia/i.test(inline[1])) return inline[1].trim();

  // Sometimes the shop name appears near the top as a standalone heading.
  const lines = bodyText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const idx = lines.findIndex((l) => /today'?s order summary/i.test(l));
  if (idx >= 0) {
    // If the same line contains both shop + summary, extract from it.
    const sameLine = lines[idx].match(/^(.+?)\s+today'?s\s+order\s+summary/i);
    if (sameLine?.[1] && !/jumia/i.test(sameLine[1])) return sameLine[1].trim();
    const candidate = lines.slice(0, idx).reverse().find((l) => l.length <= 60 && !/jumia/i.test(l));
    if (candidate) return candidate;
  }
  return null;
}

function extractJumiaReturnShopLabel(subject: string | null, bodyText: string): string | null {
  const s = (subject ?? "").trim();
  // e.g. "08-03-2026: Sky Store Ke, your Jumia return item(s) are ready for pickup ..."
  const fromSubject = s.match(/^\d{2}-\d{2}-\d{4}:\s*([^,]+?),\s*your\s+jumia\s+return\s+item/i);
  if (fromSubject?.[1]) return fromSubject[1].trim();

  const t = normalizeBodyText(bodyText);
  // e.g. "Dear Betech Store,"
  const fromDear = t.match(/\bDear\s+([^,\n\r]{2,80})\s*,/i);
  if (fromDear?.[1] && !/vendor team|jumia/i.test(fromDear[1])) return fromDear[1].trim();

  return null;
}

async function applyParsedMarketplaceEmail(opts: {
  mailboxId: string;
  mailboxEmail: string;
  message: {
    id: string;
    providerMsgId: string;
    gmailMessageId: string;
    fromEmail: string | null;
    subject: string | null;
    receivedAt: Date;
    rawBodyText?: string | null;
    rawBodyHtml?: string | null;
  };
}): Promise<{
  reprocessed: number;
  parsed: number;
  failed: number;
  updatedDigests: number;
  updatedDigestSnapshots: number;
  updatedReturns: number;
  updatedOrders: number;
  updatedAfterSales: number;
  parserType: MarketplaceEmailParserType;
  parseStatus: MarketplaceEmailParseStatus;
  parseError: string | null;
}> {
  const bodyText = getStoredBodyText(opts.message);
  const forwardedFromEmail = extractForwardedFromEmail(bodyText);

  const platform = inferPlatform(opts.message.fromEmail, opts.message.subject, bodyText);
  const parserType = inferParserType(opts.message.subject, bodyText, platform);
  const parsedKilimall = parserType === MarketplaceEmailParserType.KILIMALL_NEW_ORDER ? parseKilimallNewOrder(bodyText) : null;

  let updatedDigests = 0;
  let updatedDigestSnapshots = 0;
  let updatedReturns = 0;
  let updatedOrders = 0;
  let updatedAfterSales = 0;

  if (!platform || parserType === MarketplaceEmailParserType.UNKNOWN) {
    const parseStatus = MarketplaceEmailParseStatus.SKIPPED;
    const parseError = null;
    await prisma.marketplaceEmailMessage.update({
      where: { id: opts.message.id },
      data: { parserType, parseStatus, parseError },
    });
    return {
      reprocessed: 1,
      parsed: 0,
      failed: 0,
      updatedDigests,
      updatedDigestSnapshots,
      updatedReturns,
      updatedOrders,
      updatedAfterSales,
      parserType,
      parseStatus,
      parseError,
    };
  }

  let parseStatus: MarketplaceEmailParseStatus = MarketplaceEmailParseStatus.PARSED;
  let parseError: string | null = null;

  try {
    if (parserType === MarketplaceEmailParserType.JUMIA_DAILY_REPORT) {
      const digest = parseJumiaDailyDigest(bodyText, opts.message.subject);
      if (!digest) throw new Error("JUMIA_DAILY_DIGEST_NOT_MATCHED");

      const shopLabel = extractJumiaShopLabel(opts.message.subject, bodyText);
      const account = await mapAccountForEmail({
        platform,
        mailboxEmail: opts.mailboxEmail,
        fromEmail: opts.message.fromEmail,
        forwardedFromEmail,
        shopLabel,
      });
      if (!account) throw new Error("ACCOUNT_MAPPING_FAILED");

      const wrote = await upsertDailyDigestPreferLatest({
        accountId: account.id,
        platform,
        digestDate: digest.digestDate,
        receivedAt: opts.message.receivedAt,
        sourceMessageId: opts.message.id,
        values: {
          newOrders: digest.newOrders,
          pendingToday: digest.pendingToday,
          readyToShip: digest.readyToShip,
          returnedToday: digest.returnedToday,
          cancelledToday: digest.cancelledToday,
          deliveredToday: digest.deliveredToday,
          deliveryFailed: digest.deliveryFailed,
        },
      });
      if (wrote.wrote) updatedDigests += 1;

      const bucket = getDigestBucket(opts.message.receivedAt);
      const wroteSnapshot = await upsertDailyDigestSnapshotPreferLatest({
        accountId: account.id,
        platform,
        digestDate: digest.digestDate,
        bucket,
        receivedAt: opts.message.receivedAt,
        sourceMessageId: opts.message.id,
        values: {
          newOrders: digest.newOrders,
          pendingToday: digest.pendingToday,
          readyToShip: digest.readyToShip,
          returnedToday: digest.returnedToday,
          cancelledToday: digest.cancelledToday,
          deliveredToday: digest.deliveredToday,
          deliveryFailed: digest.deliveryFailed,
        },
      });
      if (wroteSnapshot.wrote) updatedDigestSnapshots += 1;
    } else if (parserType === MarketplaceEmailParserType.JUMIA_RETURN_PICKUP) {
      const pickup = parseJumiaReturnPickup(bodyText);
      if (!pickup) throw new Error("JUMIA_RETURN_PICKUP_NOT_MATCHED");

      const shopLabel = extractJumiaReturnShopLabel(opts.message.subject, bodyText);
      const account = await mapAccountForEmail({
        platform,
        mailboxEmail: opts.mailboxEmail,
        fromEmail: opts.message.fromEmail,
        forwardedFromEmail,
        shopLabel,
      });
      if (!account) throw new Error("ACCOUNT_MAPPING_FAILED");

      for (const row of pickup.rows) {
        const dueAt = addDays(opts.message.receivedAt, Math.max(0, row.remainingDays));
        const rawPayload = {
          stationName: pickup.stationName,
          totalItems: pickup.totalItems,
          totalPackages: pickup.totalPackages,
          trackingNumber: row.trackingNumber,
          orderNumber: row.orderNumber,
          itemDescription: row.itemDescription,
          remainingDays: row.remainingDays,
          gmailMessageId: opts.message.gmailMessageId,
          mailbox: opts.mailboxEmail,
          receivedAt: opts.message.receivedAt.toISOString(),
        };

        await prisma.marketplaceReturn.upsert({
          where: { platform_orderItemId: { platform: "JUMIA", orderItemId: row.trackingNumber } },
          create: {
            accountId: account.id,
            platform: "JUMIA",
            marketplaceOrderId: null,
            orderItemId: row.trackingNumber,
            expectedAmount: 0,
            dueAt,
            status: "WAITING_AT_HUB",
            notes: pickup.stationName ? `Pickup at ${pickup.stationName}` : null,
            rawPayload,
            sourceEmailMessageId: opts.message.id,
          },
          update: {
            accountId: account.id,
            dueAt,
            status: "WAITING_AT_HUB",
            notes: pickup.stationName ? `Pickup at ${pickup.stationName}` : null,
            rawPayload,
            sourceEmailMessageId: opts.message.id,
          },
        });
        updatedReturns += 1;
      }
    } else if (parserType === MarketplaceEmailParserType.KILIMALL_NEW_ORDER) {
      const parsed = parsedKilimall ?? parseKilimallNewOrder(bodyText);
      if (!parsed) throw new Error("KILIMALL_NEW_ORDER_NOT_MATCHED");

      const account = await mapAccountForEmail({
        platform,
        mailboxEmail: opts.mailboxEmail,
        fromEmail: opts.message.fromEmail,
        forwardedFromEmail,
        shopLabel: parsed.shopLabel,
      });
      if (!account) throw new Error("ACCOUNT_MAPPING_FAILED");

      const order = await prisma.marketplaceOrder.upsert({
        where: { platform_orderItemId: { platform: "KILIMALL", orderItemId: parsed.orderNumber } },
        create: {
          accountId: account.id,
          platform: "KILIMALL",
          orderId: parsed.orderNumber,
          orderItemId: parsed.orderNumber,
          status: "PENDING",
          orderedAt: opts.message.receivedAt,
          productName: parsed.itemTitle ?? `Order ${parsed.orderNumber}`,
          sellingPrice: 0,
          rawPayload: {
            kind: "KILIMALL_NEW_ORDER_EMAIL",
            shopLabel: parsed.shopLabel,
            orderNumber: parsed.orderNumber,
            itemTitle: parsed.itemTitle,
            gmailMessageId: opts.message.gmailMessageId,
            mailbox: opts.mailboxEmail,
            receivedAt: opts.message.receivedAt.toISOString(),
          },
        },
        update: {
          status: "PENDING",
          productName: parsed.itemTitle ?? undefined,
          rawPayload: {
            kind: "KILIMALL_NEW_ORDER_EMAIL",
            shopLabel: parsed.shopLabel,
            orderNumber: parsed.orderNumber,
            itemTitle: parsed.itemTitle,
            gmailMessageId: opts.message.gmailMessageId,
            mailbox: opts.mailboxEmail,
            receivedAt: opts.message.receivedAt.toISOString(),
          },
        },
        select: { id: true },
      });

      await prisma.marketplaceOrderEvent.upsert({
        where: { marketplaceOrderId_status: { marketplaceOrderId: order.id, status: "PENDING" } },
        create: {
          marketplaceOrderId: order.id,
          platform: "KILIMALL",
          status: "PENDING",
          occurredAt: opts.message.receivedAt,
          sourceMessageId: opts.message.id,
          rawPayload: { gmailMessageId: opts.message.gmailMessageId, mailbox: opts.mailboxEmail },
        },
        update: {
          occurredAt: opts.message.receivedAt,
          sourceMessageId: opts.message.id,
          rawPayload: { gmailMessageId: opts.message.gmailMessageId, mailbox: opts.mailboxEmail },
        },
      });
      updatedOrders += 1;
    } else if (parserType === MarketplaceEmailParserType.KILIMALL_AFTERSALES) {
      const keywordsFound = afterSalesKeywords.filter((k) => bodyText.toLowerCase().includes(k));

      const account = await mapAccountForEmail({
        platform,
        mailboxEmail: opts.mailboxEmail,
        fromEmail: opts.message.fromEmail,
        forwardedFromEmail,
        shopLabel: null,
      });

      await prisma.marketplaceAfterSalesThread.upsert({
        where: { sourceMessageId: opts.message.id },
        create: {
          accountId: account?.id ?? null,
          platform: "KILIMALL",
          mailboxId: opts.mailboxId,
          sourceMessageId: opts.message.id,
          subject: opts.message.subject,
          fromEmail: opts.message.fromEmail,
          receivedAt: opts.message.receivedAt,
          status: "OPEN",
          keywords: keywordsFound,
        },
        update: {
          accountId: account?.id ?? null,
          subject: opts.message.subject,
          fromEmail: opts.message.fromEmail,
          receivedAt: opts.message.receivedAt,
          keywords: keywordsFound,
        },
      });
      updatedAfterSales += 1;
    }
  } catch (e) {
    parseStatus = MarketplaceEmailParseStatus.FAILED;
    parseError = e instanceof Error ? e.message : String(e);
  }

  await prisma.marketplaceEmailMessage.update({
    where: { id: opts.message.id },
    data: { parserType, parseStatus, parseError },
  });

  return {
    reprocessed: 1,
    parsed: parseStatus === MarketplaceEmailParseStatus.PARSED ? 1 : 0,
    failed: parseStatus === MarketplaceEmailParseStatus.FAILED ? 1 : 0,
    updatedDigests,
    updatedDigestSnapshots,
    updatedReturns,
    updatedOrders,
    updatedAfterSales,
    parserType,
    parseStatus,
    parseError,
  };
}

export async function reprocessStoredMarketplaceEmailsForMailbox(opts: {
  mailboxId: string;
  mailboxEmail: string;
  take?: number;
}): Promise<{
  mailboxId: string;
  mailboxEmail: string;
  scanned: number;
  reprocessed: number;
  parsed: number;
  failed: number;
  updatedDigests: number;
  updatedDigestSnapshots: number;
  updatedReturns: number;
  updatedOrders: number;
  updatedAfterSales: number;
}> {
  const take = Math.min(2000, Math.max(1, opts.take ?? 500));
  const messages = await prisma.marketplaceEmailMessage.findMany({
    where: { mailboxId: opts.mailboxId },
    orderBy: { receivedAt: "desc" },
    take,
    select: {
      id: true,
      providerMsgId: true,
      gmailMessageId: true,
      fromEmail: true,
      subject: true,
      receivedAt: true,
      rawBodyText: true,
      rawBodyHtml: true,
    },
  });

  let reprocessed = 0;
  let parsed = 0;
  let failed = 0;
  let updatedDigests = 0;
  let updatedDigestSnapshots = 0;
  let updatedReturns = 0;
  let updatedOrders = 0;
  let updatedAfterSales = 0;

  // Keep concurrency low to avoid DB contention (Vercel/Neon pooler).
  const pLimit = (await import("p-limit")).default;
  const limit = pLimit(4);

  await Promise.all(
    messages.map((m) =>
      limit(async () => {
        const r = await applyParsedMarketplaceEmail({
          mailboxId: opts.mailboxId,
          mailboxEmail: opts.mailboxEmail,
          message: {
            id: m.id,
            providerMsgId: m.providerMsgId,
            gmailMessageId: m.gmailMessageId,
            fromEmail: m.fromEmail ?? null,
            subject: m.subject ?? null,
            receivedAt: m.receivedAt,
            rawBodyText: m.rawBodyText ?? null,
            rawBodyHtml: m.rawBodyHtml ?? null,
          },
        });
        reprocessed += r.reprocessed;
        parsed += r.parsed;
        failed += r.failed;
        updatedDigests += r.updatedDigests;
        updatedDigestSnapshots += r.updatedDigestSnapshots;
        updatedReturns += r.updatedReturns;
        updatedOrders += r.updatedOrders;
        updatedAfterSales += r.updatedAfterSales;
      }),
    ),
  );

  return {
    mailboxId: opts.mailboxId,
    mailboxEmail: opts.mailboxEmail,
    scanned: messages.length,
    reprocessed,
    parsed,
    failed,
    updatedDigests,
    updatedDigestSnapshots,
    updatedReturns,
    updatedOrders,
    updatedAfterSales,
  };
}
