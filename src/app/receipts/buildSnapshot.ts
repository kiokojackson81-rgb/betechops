export function buildReceiptSnapshot(receipt: any) {
  const order = receipt.order || {};
  const items = (order.items || []).map((it: any) => ({
    title: it.product?.name || it.title || it.productName || '',
    quantity: it.quantity ?? 1,
    unitPrice: it.sellingPrice ?? it.unitPrice ?? 0,
    serial: it.serial ?? '',
    warranty: it.warranty ?? '',
  }));

  const data = receipt.data;
  const dataIsObject = data !== null && typeof data === 'object' && !Array.isArray(data);
  const dataAny = dataIsObject ? (data as any) : undefined;
  const dataHasNotes = dataAny !== undefined && typeof dataAny.notes === 'string';
  const notesFromData = dataHasNotes ? (dataAny?.notes as string | undefined) : undefined;

  return {
    order,
    items,
    totals: receipt.totals ?? {},
    notes: receipt.notes ?? notesFromData ?? '',
    // include customer phone and discount for templates and downstream
    phone: order.customerPhone || (dataIsObject ? (dataAny?.customerPhone as string | undefined) : undefined) || '',
    discount: Number(receipt.discount ?? (dataIsObject ? (dataAny?.discount as number | undefined) : undefined) ?? 0),
    showDiscount: Boolean((receipt.showDiscount ?? (dataIsObject ? (dataAny?.showDiscount as boolean | undefined) : undefined)) || Number(receipt.discount ?? 0) > 0),
    generatedAt: receipt.generatedAt ? receipt.generatedAt.toISOString() : new Date().toISOString(),
    customerName: order.customerName || '',
    attendantName: receipt.issuedBy?.name || order?.attendant?.name || '',
    paymentMethod:
      (dataIsObject ? (dataAny?.paymentMethod as string | undefined) : undefined) ||
      (receipt as any).paymentMethod ||
      '',
    deliveryAddress:
      ((order.metadata as any)?.deliveryAddress as string | undefined) ||
      (dataIsObject ? (dataAny?.deliveryAddress as string | undefined) : undefined) ||
      '',
  };
}
