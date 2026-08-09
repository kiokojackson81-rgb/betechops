import { prisma } from "@/lib/prisma";
import { sendTransactionalSms } from "@/lib/africasTalking";
import { sendGeneralCustomerNotificationEmail, describeEmailError } from "@/lib/email";
import { normalizeKenyanPhone } from "@/lib/phone";
import { getAgentsBaseUrl } from "@/lib/runtimeUrls";

type AgentProfileWithUser = {
  id: string;
  userId: string;
  status: string;
  referralCode: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  county: string | null;
  city: string | null;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
  };
};

type AgentNotificationResult = {
  channel: "SMS" | "EMAIL";
  status: "sent" | "skipped" | "failed";
  detail: string;
};

type NotificationContent = {
  sms?: string | null;
  emailSubject?: string | null;
  emailTitle?: string | null;
  emailIntro?: string | null;
  emailHtml?: string | null;
  emailText?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
};

function formatKes(amount: number | null | undefined) {
  return `KSh ${new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 }).format(Number(amount ?? 0))}`;
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "Not specified";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Not specified";
  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeZone: "Africa/Nairobi",
  }).format(date);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isValidEmailAddress(value: string | null | undefined) {
  const email = String(value || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getAgentDisplayName(profile: AgentProfileWithUser | null) {
  if (!profile) return "Agent";
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();
  return fullName || profile.user.name || profile.email || profile.user.email || "Agent";
}

function getAgentPhone(profile: AgentProfileWithUser | null) {
  return normalizeKenyanPhone(profile?.phone || profile?.user.phone || "");
}

function getAgentEmail(profile: AgentProfileWithUser | null) {
  const email = String(profile?.email || profile?.user.email || "").trim().toLowerCase();
  return email || null;
}

function getPortalLink(path = "/dashboard") {
  return `${getAgentsBaseUrl().replace(/\/$/, "")}${path}`;
}

async function recordNotificationActivity(
  agentId: string,
  action: string,
  description: string,
) {
  try {
    await prisma.agentActivityLog.create({
      data: {
        agentId,
        action,
        description,
      },
    });
  } catch {
    // notification logging should never block the main workflow
  }
}

async function dispatchAgentNotifications(
  agent: AgentProfileWithUser,
  eventKey: string,
  content: NotificationContent,
) {
  const agentName = getAgentDisplayName(agent);
  const phone = getAgentPhone(agent);
  const email = getAgentEmail(agent);
  const results: AgentNotificationResult[] = [];

  if (content.sms) {
    if (!phone) {
      results.push({ channel: "SMS", status: "skipped", detail: "Missing agent phone number" });
    } else {
      try {
        const response = await sendTransactionalSms(phone, content.sms);
      results.push({
          channel: "SMS",
          status: "sent",
          detail: `SMS accepted for ${phone}`,
        });
      } catch (error) {
        results.push({
          channel: "SMS",
          status: "failed",
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  if (content.emailSubject && content.emailTitle && content.emailHtml) {
    if (!isValidEmailAddress(email)) {
      results.push({ channel: "EMAIL", status: "skipped", detail: "Missing or invalid agent email" });
    } else {
      try {
        const response = await sendGeneralCustomerNotificationEmail({
          to: email as string,
          subject: content.emailSubject,
          title: content.emailTitle,
          intro: content.emailIntro || `Hello ${agentName},`,
          bodyHtml: content.emailHtml,
          bodyText: content.emailText || undefined,
          ctaLabel: content.ctaLabel || undefined,
          ctaUrl: content.ctaUrl || undefined,
          outro: "Betech Solar Solutions",
        });
        results.push({
          channel: "EMAIL",
          status: "sent",
          detail: `Email accepted for ${email}${response?.messageId ? ` (${response.messageId})` : ""}`,
        });
      } catch (error) {
        results.push({
          channel: "EMAIL",
          status: "failed",
          detail: describeEmailError(error),
        });
      }
    }
  }

  await Promise.all(
    results.map((result) =>
      recordNotificationActivity(
        agent.userId,
        `notification_${eventKey}_${result.channel.toLowerCase()}_${result.status}`,
        `${eventKey} ${result.channel} ${result.status}: ${result.detail}`,
      ),
    ),
  );

  console.info("[AGENT_NOTIFY]", {
    eventKey,
    agentId: agent.userId,
    agentName,
    results,
  });

  return results;
}

async function loadAgentProfileByUserId(userId: string) {
  return prisma.agentProfile.findUnique({
    where: { userId },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
    },
  }) as Promise<AgentProfileWithUser | null>;
}

async function loadAgentProfileByProfileId(profileId: string) {
  return prisma.agentProfile.findUnique({
    where: { id: profileId },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
    },
  }) as Promise<AgentProfileWithUser | null>;
}

export async function notifyAgentRegistrationPending(userId: string) {
  const agent = await loadAgentProfileByUserId(userId);
  if (!agent) return [];
  const agentName = getAgentDisplayName(agent);
  return dispatchAgentNotifications(agent, "registered", {
    sms: `Hello ${agentName}, your Betech agent registration has been received successfully. Status: Pending approval. We will notify you once your account is approved. Betech Solar Solutions`,
    emailSubject: "Your Betech agent registration has been received",
    emailTitle: "Agent registration received",
    emailIntro: `Hello ${agentName},`,
    emailHtml: `<p>We have received your Betech agent registration successfully.</p><p><strong>Status:</strong> Pending approval</p><p>Our team will review your details and notify you once your account is approved.</p>`,
    emailText: `We have received your Betech agent registration successfully. Status: Pending approval. Our team will review your details and notify you once your account is approved.`,
    ctaLabel: "Open agent portal",
    ctaUrl: getPortalLink("/login"),
  });
}

export async function notifyAgentStatusChanged(profileId: string, status: string) {
  const agent = await loadAgentProfileByProfileId(profileId);
  if (!agent) return [];
  const agentName = getAgentDisplayName(agent);
  const normalizedStatus = String(status || "").trim().toLowerCase();

  if (normalizedStatus === "approved") {
    return dispatchAgentNotifications(agent, "approved", {
      sms: `Hello ${agentName}, your Betech agent account has been approved. You can now log in, submit customer sales, track commissions, and request payouts. ${getPortalLink("/login")}`,
      emailSubject: "Your Betech agent account is approved",
      emailTitle: "Agent account approved",
      emailIntro: `Hello ${agentName},`,
      emailHtml: `<p>Your Betech agent account has been approved.</p><p>You can now submit customer sales, track commissions, and request payouts.</p>`,
      emailText: `Your Betech agent account has been approved. You can now submit customer sales, track commissions, and request payouts.`,
      ctaLabel: "Log in",
      ctaUrl: getPortalLink("/login"),
    });
  }

  if (normalizedStatus === "rejected") {
    return dispatchAgentNotifications(agent, "rejected", {
      sms: `Hello ${agentName}, your Betech agent registration was not approved at this time. Please contact support for clarification. Betech Solar Solutions`,
      emailSubject: "Your Betech agent registration was not approved",
      emailTitle: "Agent registration not approved",
      emailIntro: `Hello ${agentName},`,
      emailHtml: `<p>Your Betech agent registration was not approved at this time.</p><p>If you need help or would like to correct your details, please contact support.</p>`,
      emailText: `Your Betech agent registration was not approved at this time. Please contact support if you need help or want to correct your details.`,
    });
  }

  if (normalizedStatus === "suspended") {
    return dispatchAgentNotifications(agent, "suspended", {
      sms: `Hello ${agentName}, your Betech agent account has been temporarily suspended. Please contact support for clarification and next steps.`,
      emailSubject: "Your Betech agent account has been suspended",
      emailTitle: "Agent account suspended",
      emailIntro: `Hello ${agentName},`,
      emailHtml: `<p>Your Betech agent account has been temporarily suspended.</p><p>Please contact Betech support for clarification and next steps.</p>`,
      emailText: `Your Betech agent account has been temporarily suspended. Please contact Betech support for clarification and next steps.`,
    });
  }

  return [];
}

async function loadAgentSaleNotificationContext(saleId: string) {
  return prisma.agentSale.findUnique({
    where: { id: saleId },
    include: {
      agent: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          agentProfile: {
            select: {
              id: true,
              userId: true,
              status: true,
              referralCode: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              county: true,
              city: true,
            },
          },
        },
      },
      receipt: { select: { id: true, receiptNumber: true, order: { select: { orderNumber: true } } } },
    },
  });
}

function requireSaleAgentProfile(
  sale: Awaited<ReturnType<typeof loadAgentSaleNotificationContext>>,
) {
  const profile = sale?.agent.agentProfile;
  if (!sale || !profile) return null;
  return {
    ...profile,
    user: {
      id: sale.agent.id,
      name: sale.agent.name,
      email: sale.agent.email,
      phone: sale.agent.phone,
    },
  } satisfies AgentProfileWithUser;
}

function getSaleReceiptReference(sale: NonNullable<Awaited<ReturnType<typeof loadAgentSaleNotificationContext>>>) {
  return sale.receiptNumber || sale.receipt?.receiptNumber || sale.receipt?.order?.orderNumber || sale.id;
}

export async function notifyAgentSaleSubmitted(saleId: string) {
  const sale = await loadAgentSaleNotificationContext(saleId);
  const agent = requireSaleAgentProfile(sale);
  if (!sale || !agent) return [];
  const agentName = getAgentDisplayName(agent);
  return dispatchAgentNotifications(agent, "sale_submitted", {
    sms: `Hello ${agentName}, your customer sale has been received successfully. Customer: ${sale.customerName}. Product: ${sale.productName}. Sale Ref: ${getSaleReceiptReference(sale)}. Amount: ${formatKes(sale.totalAmount)}. Betech Solar Solutions`,
    emailSubject: "Your agent sale has been received",
    emailTitle: "Agent sale received",
    emailIntro: `Hello ${agentName},`,
    emailHtml: `<p>Your customer sale has been received successfully.</p><p><strong>Customer:</strong> ${escapeHtml(sale.customerName)}<br /><strong>Phone:</strong> ${escapeHtml(sale.customerPhone)}<br /><strong>Product:</strong> ${escapeHtml(sale.productName)}<br /><strong>Sale Ref:</strong> ${escapeHtml(getSaleReceiptReference(sale))}<br /><strong>Amount:</strong> ${escapeHtml(formatKes(sale.totalAmount))}</p><p>We will review it and update you on the next step.</p>`,
    emailText: `Your customer sale has been received successfully. Customer: ${sale.customerName}. Phone: ${sale.customerPhone}. Product: ${sale.productName}. Sale Ref: ${getSaleReceiptReference(sale)}. Amount: ${formatKes(sale.totalAmount)}.`,
    ctaLabel: "View your sales",
    ctaUrl: getPortalLink("/sales"),
  });
}

export async function notifyAgentSaleStatusChanged(saleId: string, status: string) {
  const sale = await loadAgentSaleNotificationContext(saleId);
  const agent = requireSaleAgentProfile(sale);
  if (!sale || !agent) return [];
  const agentName = getAgentDisplayName(agent);
  const reference = getSaleReceiptReference(sale);
  const normalizedStatus = String(status || "").trim().toLowerCase();

  if (normalizedStatus === "processing") {
    return dispatchAgentNotifications(agent, "sale_approved", {
      sms: `Hello ${agentName}, your sale has been approved. Customer: ${sale.customerName}. Sale Ref: ${reference}. Product: ${sale.productName}. Amount: ${formatKes(sale.totalAmount)}. The order is now moving to fulfilment.`,
      emailSubject: "Your agent sale has been approved",
      emailTitle: "Agent sale approved",
      emailIntro: `Hello ${agentName},`,
      emailHtml: `<p>Your sale has been approved.</p><p><strong>Customer:</strong> ${escapeHtml(sale.customerName)}<br /><strong>Sale Ref:</strong> ${escapeHtml(reference)}<br /><strong>Product:</strong> ${escapeHtml(sale.productName)}<br /><strong>Amount:</strong> ${escapeHtml(formatKes(sale.totalAmount))}</p><p>The order is now moving to fulfilment.</p>`,
      emailText: `Your sale has been approved. Customer: ${sale.customerName}. Sale Ref: ${reference}. Product: ${sale.productName}. Amount: ${formatKes(sale.totalAmount)}. The order is now moving to fulfilment.`,
      ctaLabel: "View sale status",
      ctaUrl: getPortalLink(`/sales/${sale.id}`),
    });
  }

  if (normalizedStatus === "rejected" || normalizedStatus === "cancelled") {
    const label = normalizedStatus === "rejected" ? "rejected" : "cancelled";
    return dispatchAgentNotifications(agent, `sale_${label}`, {
      sms: `Hello ${agentName}, your submitted sale was ${label}. Sale Ref: ${reference}. Customer: ${sale.customerName}. Please contact support if you need clarification.`,
      emailSubject: `Your agent sale was ${label}`,
      emailTitle: `Agent sale ${label}`,
      emailIntro: `Hello ${agentName},`,
      emailHtml: `<p>Your submitted sale was ${escapeHtml(label)}.</p><p><strong>Sale Ref:</strong> ${escapeHtml(reference)}<br /><strong>Customer:</strong> ${escapeHtml(sale.customerName)}</p><p>Please contact support if you need clarification.</p>`,
      emailText: `Your submitted sale was ${label}. Sale Ref: ${reference}. Customer: ${sale.customerName}. Please contact support if you need clarification.`,
      ctaLabel: "View your sales",
      ctaUrl: getPortalLink("/sales"),
    });
  }

  return [];
}

export async function notifyAgentSaleCompleted(saleId: string) {
  const sale = await loadAgentSaleNotificationContext(saleId);
  const agent = requireSaleAgentProfile(sale);
  if (!sale || !agent) return [];
  const agentName = getAgentDisplayName(agent);
  const reference = getSaleReceiptReference(sale);
  const commissionAmount = Math.round(Number(sale.potentialCommission ?? 0));
  return dispatchAgentNotifications(agent, "sale_completed", {
    sms: `Hello ${agentName}, your customer order has been completed successfully. Customer: ${sale.customerName}. Sale Ref: ${reference}. Commission unlocked: ${formatKes(commissionAmount)}. Betech Solar Solutions`,
    emailSubject: "Your customer order has been completed",
    emailTitle: "Agent sale completed",
    emailIntro: `Hello ${agentName},`,
    emailHtml: `<p>Your customer order has been completed successfully.</p><p><strong>Customer:</strong> ${escapeHtml(sale.customerName)}<br /><strong>Sale Ref:</strong> ${escapeHtml(reference)}<br /><strong>Completed on:</strong> ${escapeHtml(formatDate(sale.completedAt || new Date()))}<br /><strong>Commission unlocked:</strong> ${escapeHtml(formatKes(commissionAmount))}</p><p>This commission is now available in your agent account, subject to payout workflow.</p>`,
    emailText: `Your customer order has been completed successfully. Customer: ${sale.customerName}. Sale Ref: ${reference}. Completed on: ${formatDate(sale.completedAt || new Date())}. Commission unlocked: ${formatKes(commissionAmount)}.`,
    ctaLabel: "View completed sale",
    ctaUrl: getPortalLink(`/sales/${sale.id}`),
  });
}

async function loadAgentPayoutNotificationContext(payoutId: string) {
  return prisma.agentPayout.findUnique({
    where: { id: payoutId },
    include: {
      agent: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          agentProfile: {
            select: {
              id: true,
              userId: true,
              status: true,
              referralCode: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              county: true,
              city: true,
            },
          },
        },
      },
    },
  });
}

function requirePayoutAgentProfile(
  payout: Awaited<ReturnType<typeof loadAgentPayoutNotificationContext>>,
) {
  const profile = payout?.agent.agentProfile;
  if (!payout || !profile) return null;
  return {
    ...profile,
    user: {
      id: payout.agent.id,
      name: payout.agent.name,
      email: payout.agent.email,
      phone: payout.agent.phone,
    },
  } satisfies AgentProfileWithUser;
}

export async function notifyAgentPayoutRequested(payoutId: string) {
  const payout = await loadAgentPayoutNotificationContext(payoutId);
  const agent = requirePayoutAgentProfile(payout);
  if (!payout || !agent) return [];
  const agentName = getAgentDisplayName(agent);
  return dispatchAgentNotifications(agent, "payout_requested", {
    sms: `Hello ${agentName}, your payout request has been received. Request Ref: ${payout.id}. Amount: ${formatKes(payout.amount)}. We will notify you once it is reviewed.`,
    emailSubject: "Your payout request has been received",
    emailTitle: "Payout request received",
    emailIntro: `Hello ${agentName},`,
    emailHtml: `<p>Your payout request has been received.</p><p><strong>Request Ref:</strong> ${escapeHtml(payout.id)}<br /><strong>Amount:</strong> ${escapeHtml(formatKes(payout.amount))}<br /><strong>Requested on:</strong> ${escapeHtml(formatDate(payout.createdAt))}</p><p>We will notify you once it is reviewed.</p>`,
    emailText: `Your payout request has been received. Request Ref: ${payout.id}. Amount: ${formatKes(payout.amount)}. Requested on: ${formatDate(payout.createdAt)}.`,
    ctaLabel: "View withdrawals",
    ctaUrl: getPortalLink("/withdrawals"),
  });
}

export async function notifyAgentPayoutStatusChanged(
  payoutId: string,
  status: string,
  options?: { reason?: string | null; reference?: string | null },
) {
  const payout = await loadAgentPayoutNotificationContext(payoutId);
  const agent = requirePayoutAgentProfile(payout);
  if (!payout || !agent) return [];
  const agentName = getAgentDisplayName(agent);
  const normalizedStatus = String(status || "").trim().toLowerCase();
  const reason = String(options?.reason || "").trim();
  const reference = String(options?.reference || payout.reference || "").trim();

  if (normalizedStatus === "approved") {
    return dispatchAgentNotifications(agent, "payout_approved", {
      sms: `Hello ${agentName}, your payout request has been approved. Request Ref: ${payout.id}. Amount: ${formatKes(payout.amount)}. Method: ${payout.method || "MPESA"}.`,
      emailSubject: "Your payout request has been approved",
      emailTitle: "Payout approved",
      emailIntro: `Hello ${agentName},`,
      emailHtml: `<p>Your payout request has been approved.</p><p><strong>Request Ref:</strong> ${escapeHtml(payout.id)}<br /><strong>Amount:</strong> ${escapeHtml(formatKes(payout.amount))}<br /><strong>Method:</strong> ${escapeHtml(payout.method || "MPESA")}</p><p>Payment will be processed shortly.</p>`,
      emailText: `Your payout request has been approved. Request Ref: ${payout.id}. Amount: ${formatKes(payout.amount)}. Method: ${payout.method || "MPESA"}. Payment will be processed shortly.`,
      ctaLabel: "View withdrawals",
      ctaUrl: getPortalLink("/withdrawals"),
    });
  }

  if (normalizedStatus === "paid") {
    return dispatchAgentNotifications(agent, "payout_paid", {
      sms: `Hello ${agentName}, your payout has been sent successfully. Request Ref: ${payout.id}. Amount paid: ${formatKes(payout.amount)}. Ref: ${reference || "N/A"}.`,
      emailSubject: "Your payout has been sent",
      emailTitle: "Payout sent",
      emailIntro: `Hello ${agentName},`,
      emailHtml: `<p>Your payout has been sent successfully.</p><p><strong>Request Ref:</strong> ${escapeHtml(payout.id)}<br /><strong>Amount paid:</strong> ${escapeHtml(formatKes(payout.amount))}<br /><strong>Method:</strong> ${escapeHtml(payout.method || "MPESA")}<br /><strong>Transaction Ref:</strong> ${escapeHtml(reference || "N/A")}</p>`,
      emailText: `Your payout has been sent successfully. Request Ref: ${payout.id}. Amount paid: ${formatKes(payout.amount)}. Method: ${payout.method || "MPESA"}. Transaction Ref: ${reference || "N/A"}.`,
      ctaLabel: "View withdrawals",
      ctaUrl: getPortalLink("/withdrawals"),
    });
  }

  if (normalizedStatus === "rejected") {
    return dispatchAgentNotifications(agent, "payout_rejected", {
      sms: `Hello ${agentName}, your payout request was not approved. Request Ref: ${payout.id}. Amount: ${formatKes(payout.amount)}.${reason ? ` Reason: ${reason}.` : ""}`,
      emailSubject: "Your payout request was not approved",
      emailTitle: "Payout request not approved",
      emailIntro: `Hello ${agentName},`,
      emailHtml: `<p>Your payout request was not approved.</p><p><strong>Request Ref:</strong> ${escapeHtml(payout.id)}<br /><strong>Amount:</strong> ${escapeHtml(formatKes(payout.amount))}${reason ? `<br /><strong>Reason:</strong> ${escapeHtml(reason)}` : ""}</p><p>Please review your payout details or contact support if you need help.</p>`,
      emailText: `Your payout request was not approved. Request Ref: ${payout.id}. Amount: ${formatKes(payout.amount)}.${reason ? ` Reason: ${reason}.` : ""}`,
      ctaLabel: "Update payout details",
      ctaUrl: getPortalLink("/profile/payment-method"),
    });
  }

  if (normalizedStatus === "held") {
    return dispatchAgentNotifications(agent, "payout_held", {
      sms: `Hello ${agentName}, your payout request is currently on hold. Request Ref: ${payout.id}. Amount: ${formatKes(payout.amount)}. We will share the next update soon.`,
      emailSubject: "Your payout request is on hold",
      emailTitle: "Payout request on hold",
      emailIntro: `Hello ${agentName},`,
      emailHtml: `<p>Your payout request is currently on hold.</p><p><strong>Request Ref:</strong> ${escapeHtml(payout.id)}<br /><strong>Amount:</strong> ${escapeHtml(formatKes(payout.amount))}</p><p>We will share the next update soon.</p>`,
      emailText: `Your payout request is currently on hold. Request Ref: ${payout.id}. Amount: ${formatKes(payout.amount)}.`,
      ctaLabel: "View withdrawals",
      ctaUrl: getPortalLink("/withdrawals"),
    });
  }

  return [];
}
