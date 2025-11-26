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
        // header
        controller.enqueue(encoder.encode('"Date","Day","Attendant","Products","Sales","Tasks"\n'));
        let page = 0;
        while (true) {
          const rows = await prisma.dailyReport.findMany({
            where,
            include: { user: { select: { name: true } } },
            orderBy: { date: 'asc' },
            skip: page * pageSize,
            take: pageSize,
          });
          if (!rows || rows.length === 0) break;
          for (const r of rows) {
            const dateStr = r.date.toISOString().split('T')[0];
            const attendant = r.user?.name ?? '';
            const tasks = JSON.stringify(r.tasks ?? {});
            const fields = [dateStr, r.day ?? '', attendant, String(r.productsCount), String(r.totalSales), tasks];
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
