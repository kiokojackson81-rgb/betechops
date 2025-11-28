import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const fromStr = url.searchParams.get("from");
    const toStr = url.searchParams.get("to");
    const day = url.searchParams.get("day");

    const where: any = {};
    if (fromStr) where.date = { gte: new Date(fromStr) };
    if (toStr) where.date = where.date ? { ...where.date, lte: new Date(toStr) } : { lte: new Date(toStr) };
    if (day) where.day = day;

    const pageSize = 1000;

    const encoder = new TextEncoder();

    const marketplaceShops = [
      "Betech Store",
      "JM Collection",
      "Hitech Power",
      "Maxton",
      "Sky Store",
      "Betech Solar",
      "Kilimall",
    ];

    const stream = new ReadableStream({
      async start(controller) {
        // header (match fields emitted below)
        const shopCols: string[] = [];
        for (const shop of marketplaceShops) {
          const safe = shop.replace(/\s+/g, '_');
          shopCols.push(`${safe}_stockChecked`);
          shopCols.push(`${safe}_pricingConfirmed`);
          shopCols.push(`${safe}_competitorsReviewed`);
          shopCols.push(`${safe}_oosReviewed`);
          shopCols.push(`${safe}_notes`);
        }

        const header = [
          'Date',
          'Day',
          'AttendantName',
          'AttendantEmail',
          'SubmittedBy',
          // keep raw marketplace JSON for compatibility
          'MarketplaceReview',
          'ProductsCount',
          'TotalSales',
          'NewUploads',
          'CopiesUploaded',
          'ProductsEdited',
          'Attended Marketing Meeting',
          'Participated In Video Shoot',
          'Marketing Videos Posted',
          'WalkInCustomers',
          'CustomersPurchased',
          'LiveViewers',
          'LivePurchases',
          'OfficeCleaned',
          'OfficeNotes',
          'SalesDetails',
          // flattened marketplace columns
          ...shopCols,
          // flattened customerComms columns
          'walkInServed',
          'onlineServed',
          'callsHandled',
          'whatsappSmsReplied',
          'fbCommentsReplied',
          'fbDmsReplied',
          'igCommentsReplied',
          'igDmsReplied',
          'fbAllCleared',
          'igAllCleared',
          'competitorNotes',
          'improvementSuggestions',
          // keep customerComms as JSON
          'CustomerComms',
          // full tasks JSON for completeness
          'Tasks',
        ];

        controller.enqueue(encoder.encode(header.map((s) => `"${String(s).replace(/"/g, '""')}"`).join(',') + '\n'));
        let page = 0;
        while (true) {
          const rows = await prisma.dailyReport.findMany({
            where,
            include: { user: { select: { name: true } }, sales: true },
            orderBy: { date: 'asc' },
            skip: page * pageSize,
            take: pageSize,
          });
          if (!rows || rows.length === 0) break;
          for (const r of rows) {
            const dateStr = r.date.toISOString().split('T')[0];
            const attendant = r.user?.name ?? '';
            const attendantEmail = (r.user as any)?.email ?? '';
            // prefer tasks.submittedBy (recent client wiring) but fallback to linked user name/email
            const tasks = r.tasks ?? {};
            const submittedBy = (tasks as any).submittedBy ?? '';
            const categories = (tasks as any).categories ?? {};
            const marketing = (tasks as any).marketing ?? {};
            const customerOps = (tasks as any).customerOperations ?? {};
            const office = (tasks as any).officeMaintenance ?? {};
            const salesDetails = Array.isArray(r.sales) ? JSON.stringify(r.sales) : "[]";

            // flattened marketplace values
            const mr = (tasks as any).marketplaceReview || {};
            const shopValues: string[] = [];
            for (const shop of marketplaceShops) {
              const state = mr[shop] || {};
              shopValues.push(String(state.stockChecked ? 'Yes' : ''));
              shopValues.push(String(state.pricingConfirmed ? 'Yes' : ''));
              shopValues.push(String(state.competitorsReviewed ? 'Yes' : ''));
              shopValues.push(String(state.oosReviewed ? 'Yes' : ''));
              shopValues.push(String(state.notes ?? ''));
            }

            const fields = [
              dateStr,
              r.day ?? '',
              attendant,
              attendantEmail,
              submittedBy,
              String(r.productsCount),
              String(r.totalSales),
              String(categories.newUploads ?? ''),
              String(categories.copiesUploaded ?? ''),
              String(categories.productsEdited ?? ''),
              String(marketing.attendedMarketingMeeting ? 'Yes' : 'No'),
              String(marketing.participatedVideoShoot ? 'Yes' : 'No'),
              String(marketing.marketingVideosShot ?? ''),
              String(customerOps.walkInCustomers ?? ''),
              String(customerOps.customersPurchased ?? ''),
              String(customerOps.liveViewers ?? ''),
              String(customerOps.livePurchases ?? ''),
              String(office.officeCleaned ? 'Yes' : 'No'),
              String(office.officeNotes ?? ''),
              salesDetails,
              // raw marketplace JSON (compat)
              JSON.stringify((tasks as any).marketplaceReview ?? {}),
              // per-shop flattened fields
              ...shopValues,
              // flattened customerComms values
              (() => {
                const cc = (tasks as any).customerComms || {};
                return [
                  String(cc.walkInServed ?? ''),
                  String(cc.onlineServed ?? ''),
                  String(cc.callsHandled ?? ''),
                  String(cc.whatsappSmsReplied ?? ''),
                  String(cc.fbCommentsReplied ?? ''),
                  String(cc.fbDmsReplied ?? ''),
                  String(cc.igCommentsReplied ?? ''),
                  String(cc.igDmsReplied ?? ''),
                  String(cc.fbAllCleared ? 'Yes' : ''),
                  String(cc.igAllCleared ? 'Yes' : ''),
                  String(cc.competitorNotes ?? ''),
                  String(cc.improvementSuggestions ?? ''),
                ];
              })(),
              // customerComms as JSON
              JSON.stringify((tasks as any).customerComms ?? {}),
              // full tasks JSON
              JSON.stringify(tasks as any),
            ];

            const line = fields.map((s) => `"${String(s).replace(/"/g, '""')}"`).join(',') + '\n';
            controller.enqueue(encoder.encode(line));
          }
          page++;
        }
        controller.close();
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="daily_reports.csv"',
      }
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(msg, { status: 500 });
  }
}
