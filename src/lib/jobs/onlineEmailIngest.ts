"use server";

import { prisma } from "@/lib/prisma";
import { MarketplaceEmailParseStatus, MarketplaceEmailParserType, Platform } from "@prisma/client";
import {
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

function normalizeKey(input: string | null | undefined): string {
  return (input ?? "").trim().toLowerCase().replace(/\s+/g, " ");
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
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
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
  const hay = `${fromEmail ?? ""}\n${subject ?? ""}\n${bodyText}`.toLowerCase();
  if (hay.includes("jumia")) return Platform.JUMIA;
  if (hay.includes("kilimall")) return Platform.KILIMALL;
  if (hay.includes("ordersn")) return Platform.KILIMALL;
  if (hay.includes("daily order report") || hay.includes("today's order summary")) return Platform.JUMIA;
  return null;
}

function inferParserType(subject: string | null, bodyText: string, platform: Platform | null): MarketplaceEmailParserType {
  const s = (subject ?? "").toLowerCase();
  const t = bodyText.toLowerCase();
  if (s.includes("daily order report") || t.includes("today's order summary")) return MarketplaceEmailParserType.JUMIA_DAILY_REPORT;
  if (t.includes("ready for pickup") && t.includes("package / tracking number")) return MarketplaceEmailParserType.JUMIA_RETURN_PICKUP;
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
  const s = `${subject ?? ""}\n${bodyText}`;
  const dateMatch =
    s.match(/Daily Order Report\s*-\s*(\d{4}-\d{2}-\d{2})/i) ??
    s.match(/Today's Order Summary\s*(\d{4}-\d{2}-\d{2})/i) ??
    s.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  const dateStr = dateMatch?.[1];
  const digestDate = dateStr ? parseDateOnlyUtc(dateStr) : null;
  if (!digestDate) return null;

  const getInt = (label: string) => {
    const re = new RegExp(String.raw`(\d+)\s+${label}`, "i");
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
  const t = bodyText;
  const totals = t.match(/total\s+of\s+(\d+)\s+item\(s\)\s+in\s+(\d+)\s+package\(s\)/i);
  const totalItems = totals?.[1] ? Number.parseInt(totals[1], 10) : null;
  const totalPackages = totals?.[2] ? Number.parseInt(totals[2], 10) : null;
  const station = t.match(/pick\s*up\s*in\s+([^\n\r]+)/i);
  const stationName = station?.[1]?.trim() ? station[1].trim() : null;

  const rows: { trackingNumber: string; orderNumber: string | null; itemDescription: string; remainingDays: number }[] = [];
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

  if (!rows.length && !stationName && totalItems == null && totalPackages == null) return null;
  return { stationName, totalItems, totalPackages, rows };
}

function parseKilimallNewOrder(bodyText: string): { shopLabel: string | null; orderNumber: string; itemTitle: string | null } | null {
  const orderMatch = bodyText.match(/ordersn\s+(\d+)/i);
  const orderNumber = orderMatch?.[1]?.trim();
  if (!orderNumber) return null;

  const shopMatch = bodyText.match(/Your store\s*【([^】]+)】/i);
  const shopLabel = shopMatch?.[1]?.trim() || null;

  let itemTitle: string | null = null;
  const productSection = bodyText.split(/\bProduct information\b/i);
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

  const accounts = await prisma.marketplaceAccount.findMany({
    where: { isActive: true, platform },
    select: { id: true, displayName: true, platform: true, primaryInboxEmail: true, forwarderEmails: true },
  });

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
      const exists = await prisma.marketplaceEmailMessage.findUnique({ where: { providerMsgId: messageId }, select: { id: true } });
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
      const bodyText = (text && text.trim()) ? text : (html ? htmlToText(html) : "");

      const forwardedFromEmail = extractForwardedFromEmail(bodyText);

      const platform = inferPlatform(fromEmail, subject, bodyText);
      const parserType = inferParserType(subject, bodyText, platform);

      const parsedKilimall = parserType === MarketplaceEmailParserType.KILIMALL_NEW_ORDER ? parseKilimallNewOrder(bodyText) : null;

      // Persist raw email first (never lose the record)
      const emailRow = await prisma.marketplaceEmailMessage.create({
        data: {
          mailboxId: mailbox.id,
          providerMsgId: messageId,
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

          const account = await mapAccountForEmail({
            platform,
            mailboxEmail: mailbox.email,
            fromEmail,
            forwardedFromEmail,
            shopLabel: null,
          });
          if (!account) throw new Error("ACCOUNT_MAPPING_FAILED");

          await prisma.marketplaceDailyOrderDigest.upsert({
            where: { accountId_platform_digestDate: { accountId: account.id, platform, digestDate: digest.digestDate } },
            create: {
              accountId: account.id,
              platform,
              digestDate: digest.digestDate,
              newOrders: digest.newOrders,
              pendingToday: digest.pendingToday,
              readyToShip: digest.readyToShip,
              returnedToday: digest.returnedToday,
              cancelledToday: digest.cancelledToday,
              deliveredToday: digest.deliveredToday,
              deliveryFailed: digest.deliveryFailed,
              sourceMessageId: emailRow.id,
              lastReceivedAt: receivedAt,
            },
            update: {
              newOrders: digest.newOrders,
              pendingToday: digest.pendingToday,
              readyToShip: digest.readyToShip,
              returnedToday: digest.returnedToday,
              cancelledToday: digest.cancelledToday,
              deliveredToday: digest.deliveredToday,
              deliveryFailed: digest.deliveryFailed,
              sourceMessageId: emailRow.id,
              lastReceivedAt: receivedAt,
            },
          });
        } else if (parserType === MarketplaceEmailParserType.JUMIA_RETURN_PICKUP) {
          const pickup = parseJumiaReturnPickup(bodyText);
          if (!pickup) throw new Error("JUMIA_RETURN_PICKUP_NOT_MATCHED");

          const account = await mapAccountForEmail({
            platform,
            mailboxEmail: mailbox.email,
            fromEmail,
            forwardedFromEmail,
            shopLabel: null,
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
