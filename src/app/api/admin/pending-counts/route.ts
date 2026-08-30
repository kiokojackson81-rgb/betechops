import { NextResponse } from "next/server";
import { WebsiteOrderStatus } from "@prisma/client";
import { requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { getUnpricedDailySalesForRange } from "@/lib/marketingUnpricedSales";
import { groupMarketingUnpricedSales } from "@/lib/unpricedReceiptGrouping";
import { getReviewsReferralsAdminSummary } from "@/lib/reviewsReferrals";
import { ensureQuoteRequestsSchema, listAllQuoteRequests } from "@/lib/quoteRequests";
import { isPendingQuotationStatus } from "@/lib/operationsWorkQueue";
import { ensureSiteVisitsSchema, listAdminSiteVisits } from "@/lib/siteVisits";
import { ensureWebsiteOrdersSchema } from "@/lib/websiteOrders";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const period = getTradingPeriodFor(new Date());
  const prismaWithAdjustments = prisma as typeof prisma & {
    payrollAdjustmentRequest?: {
      count: (args: { where: { status: string } }) => Promise<number>;
    };
  };

  await Promise.all([
    ensureQuoteRequestsSchema(),
    ensureSiteVisitsSchema(),
    ensureWebsiteOrdersSchema(),
  ]);

  const [
    pendingOrders,
    openProjects,
    reviewSummary,
    siteVisits,
    quoteRequests,
    pendingLeaveCount,
    pendingCashAdvanceCount,
    pendingAdjustmentRequestCount,
    pendingWebsiteOrders,
    unpricedSales,
  ] = await Promise.all([
    prisma.jumiaOrder.count({ where: { status: "PENDING" } }).catch(() => 0),
    prisma.receipt.count({
      where: {
        data: { path: ["projectFlow", "isProject"], equals: true },
        OR: [
          { data: { path: ["projectFlow", "stage"], equals: "RECEIPT_CREATED" } },
          { data: { path: ["projectFlow", "stage"], equals: "PROJECT_SCHEDULED" } },
          { data: { path: ["projectFlow", "stage"], equals: "PROJECT_IN_PROGRESS" } },
          { data: { path: ["projectFlow", "stage"], equals: "PROJECT_INSTALLED" } },
        ],
      },
    }),
    getReviewsReferralsAdminSummary(),
    listAdminSiteVisits(),
    listAllQuoteRequests({ status: "ALL" }),
    prisma.leaveRequest.count({ where: { status: "PENDING" } }),
    prisma.cashAdvance.count({ where: { status: "PENDING" } }),
    prismaWithAdjustments.payrollAdjustmentRequest?.count({ where: { status: "PENDING" } }).catch(() => 0) ?? 0,
    prisma.websiteOrder.count({
      where: {
        source: "WEBSITE",
        status: {
          in: [
            WebsiteOrderStatus.PENDING,
            WebsiteOrderStatus.CONFIRMED,
            WebsiteOrderStatus.PROCESSING,
            WebsiteOrderStatus.RECEIPT_ISSUED,
            WebsiteOrderStatus.DISPATCHED,
            WebsiteOrderStatus.PAYMENT_CONFIRMED,
          ],
        },
      },
    }),
    getUnpricedDailySalesForRange({
      startDate: period.start,
      endDate: period.end,
    }),
  ]);

  const pendingPricing = groupMarketingUnpricedSales(unpricedSales).length;
  const pendingSiteVisits = siteVisits.filter(
    (visit) => visit.status === "PENDING" || visit.status === "SCHEDULED",
  ).length;
  const pendingCustomerReviews = Number(reviewSummary.reviews.submittedReviews ?? 0);
  const pendingQuotations = quoteRequests.filter((request) =>
    isPendingQuotationStatus(request.status),
  ).length;
  const pendingWellness =
    Number(pendingLeaveCount ?? 0) +
    Number(pendingCashAdvanceCount ?? 0) +
    Number(pendingAdjustmentRequestCount ?? 0);

  return NextResponse.json({
    ok: true,
    counts: {
      orders: Number(pendingOrders ?? 0),
      pendingPricing,
      projects: Number(openProjects ?? 0),
      wellness: pendingWellness,
      siteVisits: pendingSiteVisits,
      customerReviews: pendingCustomerReviews,
      quotationCenter: pendingQuotations,
      websiteOrders: Number(pendingWebsiteOrders ?? 0),
    },
  });
}
