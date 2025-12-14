import { NextResponse } from "next/server";

export async function GET() {
  const receipts = [
    {
      id: "betech-20251213-41624",
      orderRef: "Betech-20251213-41624",
      docType: "Receipt",
      customerName: "Customer A",
      attendantName: "Brendah",
      total: 25800,
      createdAt: new Date("2025-12-13T15:17:00+03:00").toISOString(),
    },
    {
      id: "betech-20251213-10561",
      orderRef: "Betech-20251213-10561",
      docType: "Receipt",
      customerName: "Customer B",
      attendantName: "Brendah",
      total: 15000,
      createdAt: new Date("2025-12-13T11:20:00+03:00").toISOString(),
    },
    {
      id: "betech-20251214-30001",
      orderRef: "Betech-20251214-30001",
      docType: "Receipt",
      customerName: "Customer C",
      attendantName: "Brendah",
      total: 25000,
      createdAt: new Date("2025-12-14T09:45:00+03:00").toISOString(),
    },
    {
      id: "betech-20251214-30002",
      orderRef: "Betech-20251214-30002",
      docType: "Receipt",
      customerName: "Customer D",
      attendantName: "Brendah",
      total: 23248,
      createdAt: new Date("2025-12-14T12:30:00+03:00").toISOString(),
    },
  ];

  return NextResponse.json({ receipts });
}
