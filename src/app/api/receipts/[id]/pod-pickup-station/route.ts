import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAttendant } from "@/lib/auth";
import { getSpeedafPickupStation, speedafPickupStations } from "@/lib/speedafPickupStations";

type ParamsContext = { params: { id: string } } | { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: ParamsContext) {
  const params = "params" in context && typeof (context as { params?: Promise<{ id: string }> }).params?.then === "function"
    ? await (context as { params: Promise<{ id: string }> }).params
    : (context as { params: { id: string } }).params;
  const receiptId = String(params.id || "").trim();

  let guard;
  try {
    guard = await requireAttendant(req as unknown as Request);
  } catch (response) {
    return response instanceof NextResponse ? response : NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const requested = String(body.stationId || body.stationName || "").trim();
  const normalizedName = requested.toLowerCase();
  const station = getSpeedafPickupStation(requested) || speedafPickupStations.find((item) => item.name.toLowerCase() === normalizedName);
  if (!station) return NextResponse.json({ error: "Choose a valid Speedaf station." }, { status: 400 });

  const receipt = await prisma.receipt.findUnique({ where: { id: receiptId }, include: { order: true } });
  if (!receipt) return NextResponse.json({ error: "Receipt not found." }, { status: 404 });
  const data = receipt.data && typeof receipt.data === "object" ? { ...(receipt.data as Record<string, unknown>) } : {};
  const podDelivery = data.podDelivery && typeof data.podDelivery === "object" ? { ...(data.podDelivery as Record<string, unknown>) } : null;
  if (!podDelivery) return NextResponse.json({ error: "Receipt is not a POD order." }, { status: 400 });

  const actorId = String(guard.user?.id || "").trim();
  const role = String(guard.user?.role || "").toUpperCase();
  const canManageAny = role === "ADMIN" || role === "SUPERVISOR";
  const creatorIds = [receipt.issuedById, receipt.order.attendantId, data.attendantId].map((value) => String(value || "").trim());
  if (!canManageAny && (!actorId || !creatorIds.includes(actorId))) return NextResponse.json({ error: "Only the receipt owner, an admin, or a supervisor can update the pickup station." }, { status: 403 });

  const pickup = { stationId: station.id, county: station.county, area: station.area, stationName: station.name, address: station.address, phone: station.phone };
  const nextPodDelivery = { ...podDelivery, pickupStationId: station.id, pickup, pickupUpdatedAt: new Date().toISOString(), pickupUpdatedById: actorId || null };
  await prisma.receipt.update({ where: { id: receiptId }, data: { data: { ...data, podDelivery: nextPodDelivery } as Prisma.InputJsonValue } });
  if (actorId) await prisma.actionLog.create({ data: { actorId, entity: "Receipt", entityId: receiptId, action: "POD_PICKUP_STATION_UPDATED", before: { pickup: podDelivery.pickup ?? null } as Prisma.InputJsonValue, after: { pickup } as Prisma.InputJsonValue } }).catch(() => undefined);
  return NextResponse.json({ ok: true, pickup });
}
