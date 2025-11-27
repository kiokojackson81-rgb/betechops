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

    const stream = new ReadableStream({
      async start(controller) {
        // header (match fields emitted below)
        controller.enqueue(encoder.encode('"Date","Day","Attendant","ProductsCount","TotalSales","NewUploads","CopiesUploaded","ProductsEdited","ParticipatedVideoShoot","AttendedMarketingMeeting","MarketingVideosShot","WalkInCustomers","CustomersPurchased","LiveViewers","LivePurchases","OfficeCleaned","OfficeNotes","SalesDetails","Tasks"\n'));
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
            const tasks = r.tasks ?? {};
            const categories = (tasks as any).categories ?? {};
            const marketing = (tasks as any).marketing ?? {};
            const customerOps = (tasks as any).customerOperations ?? {};
            const office = (tasks as any).officeMaintenance ?? {};
            const salesDetails = Array.isArray(r.sales) ? JSON.stringify(r.sales) : "[]";
            const fields = [
              dateStr,
              r.day ?? '',
              attendant,
              String(r.productsCount),
              String(r.totalSales),
              String(categories.newUploads ?? ''),
              String(categories.copiesUploaded ?? ''),
              String(categories.productsEdited ?? ''),
              String(marketing.participatedVideoShoot ? 'Yes' : 'No'),
              String(marketing.attendedMarketingMeeting ? 'Yes' : 'No'),
              String(marketing.marketingVideosShot ?? ''),
              String(customerOps.walkInCustomers ?? ''),
              String(customerOps.customersPurchased ?? ''),
              String(customerOps.liveViewers ?? ''),
              String(customerOps.livePurchases ?? ''),
              String(office.officeCleaned ? 'Yes' : 'No'),
              String(office.officeNotes ?? ''),
              salesDetails,
              JSON.stringify(tasks),
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
