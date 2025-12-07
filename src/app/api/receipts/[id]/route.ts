import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getActorId } from '@/lib/api';

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await auth();
  const role = (session as any)?.user?.role;
  if (role !== "ADMIN") {
    throw new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  try {
    const receipt = await prisma.receipt.findUnique({ where: { id }, include: { order: { include: { items: true } }, issuedBy: true } });
    if (!receipt) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ receipt });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }

  const { id } = params;
  const body = (await req.json()) as any;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const receipt = await tx.receipt.findUnique({ where: { id }, include: { order: true } });
      if (!receipt) throw new Error("Receipt not found");

      const orderId = receipt.orderId;

      // fetch existing items for diff/audit
      const oldItems = await tx.orderItem.findMany({ where: { orderId } });

      // handle item replacement if provided
      let newItems: any[] = [];
      if (Array.isArray(body.items)) {
        // delete existing
        await tx.orderItem.deleteMany({ where: { orderId } });
        for (const it of body.items) {
          const title = String(it.title || it.name || "Item").slice(0, 255);
          let product = await tx.product.findFirst({ where: { name: title } });
          if (!product) {
            product = await tx.product.create({ data: { sku: `manual-${Date.now()}`, name: title, category: "manual", sellingPrice: Number(it.unitPrice || it.sellingPrice || 0) || 0 } });
          }
          const created = await tx.orderItem.create({ data: { orderId, productId: product.id, quantity: Number(it.quantity || 1), sellingPrice: Number(it.unitPrice || it.sellingPrice || 0) || 0, serial: it.serial ?? null, warranty: it.warranty ?? null } });
          newItems.push({ ...created, title: product.name });
        }
      } else {
        newItems = oldItems;
      }

      // recalc totals from items
      const items = await tx.orderItem.findMany({ where: { orderId } });
      const subtotal = items.reduce((s, it) => s + Number(it.sellingPrice || 0) * (it.quantity || 1), 0);
      const taxRate = body.taxRate !== undefined ? Number(body.taxRate) : Number((receipt.taxRate as any) || 0);
      const tax = body.showTax || receipt.showTax ? (subtotal * (taxRate / 100)) : 0;
      const discount = body.discount !== undefined ? Number(body.discount) : Number((receipt.discount as any) || 0);
      const total = subtotal + tax - discount;

      // update order totals
      await tx.order.update({ where: { id: orderId }, data: { totalAmount: Number(total) } as any });

      // update receipt fields
      const updateData: any = {};
      const allowed = ['notes', 'taxRate', 'discount', 'showTax', 'showDiscount', 'paymentDetailsShown', 'warrantyText'];
      for (const k of allowed) if (body[k] !== undefined) updateData[k] = body[k];
      updateData.totals = { subtotal, tax, total };
      updateData.data = { ...(receipt.data as any), ...(body.data || {}) };

      const updated = await tx.receipt.update({ where: { id }, data: updateData });

      // compute item-level diffs for audit purposes
      const diffs: any = { added: [], removed: [], updated: [] };
      const mapOldBySerial: Record<string, any[]> = {};
      for (const oi of oldItems) {
        const key = (oi.serial || '') || `${oi.productId}`;
        (mapOldBySerial[key] = mapOldBySerial[key] || []).push(oi);
      }
      const mapNewBySerial: Record<string, any[]> = {};
      for (const ni of newItems) {
        const key = (ni.serial || '') || `${ni.productId}`;
        (mapNewBySerial[key] = mapNewBySerial[key] || []).push(ni);
      }
      // detect removed
      for (const key of Object.keys(mapOldBySerial)) {
        if (!mapNewBySerial[key]) diffs.removed.push(...mapOldBySerial[key]);
      }
      // detect added
      for (const key of Object.keys(mapNewBySerial)) {
        if (!mapOldBySerial[key]) diffs.added.push(...mapNewBySerial[key]);
      }
      // detect updates where present in both
      for (const key of Object.keys(mapNewBySerial)) {
        if (mapOldBySerial[key]) {
          const olds = mapOldBySerial[key];
          const news = mapNewBySerial[key];
          // compare lengths or fields
          for (let i = 0; i < Math.min(olds.length, news.length); i++) {
            const o = olds[i];
            const n = news[i];
            const changes: any = {};
            if (o.quantity !== n.quantity) changes.quantity = { before: o.quantity, after: n.quantity };
            if (String(o.sellingPrice) !== String(n.sellingPrice)) changes.sellingPrice = { before: o.sellingPrice, after: n.sellingPrice };
            if ((o.serial || '') !== (n.serial || '')) changes.serial = { before: o.serial, after: n.serial };
            if ((o.warranty || '') !== (n.warranty || '')) changes.warranty = { before: o.warranty, after: n.warranty };
            if (Object.keys(changes).length) diffs.updated.push({ before: o, after: n, changes });
          }
        }
      }

      // write action log with diff details
      try {
        const actorId = (await getActorId()) || (await auth())?.user?.id || 'system';
        await tx.actionLog.create({ data: { actorId, entity: 'Receipt', entityId: id, action: 'PATCH', before: { receipt, items: oldItems }, after: { updated, items }, } });
        // separate log entry for item diffs
        if (diffs.added.length || diffs.removed.length || diffs.updated.length) {
          await tx.actionLog.create({ data: { actorId, entity: 'OrderItem', entityId: orderId, action: 'PATCH_ITEMS', before: oldItems, after: items, } });
        }
      } catch (e) {
        // best-effort
        try { console.error('Failed to write audit logs', e); } catch {}
      }

      return updated;
    });

    return NextResponse.json({ ok: true, receipt: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
