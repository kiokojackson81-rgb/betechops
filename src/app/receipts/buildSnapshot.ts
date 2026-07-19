export function buildReceiptSnapshot(receipt: any) {
  const order = receipt.order || {};
  const data = receipt.data;
  const dataIsObject = data !== null && typeof data === 'object' && !Array.isArray(data);
  const dataAny = dataIsObject ? (data as any) : undefined;
  const dataAttendantName =
    typeof dataAny?.attendantName === 'string' ? dataAny.attendantName.trim() : '';
  const orderAttendantName =
    typeof order?.attendant?.name === 'string' ? order.attendant.name.trim() : '';
  const issuedByName =
    typeof receipt.issuedBy?.name === 'string' ? receipt.issuedBy.name.trim() : '';

  // Prefer order.items (joined via Prisma). If not present, fall back to
  // items stored inside `receipt.data.items` (used by some flows).
  const rawItems: any[] = (order.items && (order.items as any[]).length)
    ? (order.items as any[])
    : Array.isArray(dataAny?.items)
    ? (dataAny?.items as any[])
    : [];

  const items = rawItems.map((it: any) => ({
    title: (it.product && it.product.name) || it.title || it.productName || it.name || '',
    quantity: it.quantity ?? 1,
    unitPrice: it.sellingPrice ?? it.unitPrice ?? it.price ?? 0,
    serial: it.serial ?? '',
    warranty: it.warranty ?? '',
  }));
  const dataHasNotes = dataAny !== undefined && typeof dataAny.notes === 'string';
  const notesFromData = dataHasNotes ? (dataAny?.notes as string | undefined) : undefined;
  const paymentBreakdown =
    (dataIsObject ? (dataAny?.paymentBreakdown as Record<string, unknown>) : undefined) || {};
  const paymentDetailsShown =
    typeof receipt.paymentDetailsShown === 'boolean'
      ? receipt.paymentDetailsShown
      : typeof dataAny?.paymentDetailsShown === 'boolean'
      ? dataAny?.paymentDetailsShown
      : false;
  const warrantyText =
    receipt.warrantyText ||
    (typeof (dataAny?.globalWarranty ?? dataAny?.warrantyText) === 'string'
      ? (dataAny?.globalWarranty ?? dataAny?.warrantyText)
      : '') ||
    '';
  const serialNumber =
    (receipt.order?.orderNumber as string | undefined) ||
    (order.orderNumber as string | undefined) ||
    (dataIsObject ? (dataAny?.orderRef as string | undefined) : undefined) ||
    '';
  const projectFlowRaw =
    dataIsObject && dataAny?.projectFlow && typeof dataAny.projectFlow === "object"
      ? (dataAny.projectFlow as Record<string, unknown>)
      : null;

  return {
    order,
    items,
    totals: receipt.totals ?? {},
    notes: receipt.notes ?? notesFromData ?? '',
    // include customer phone and discount for templates and downstream
    phone: order.customerPhone || (dataIsObject ? (dataAny?.customerPhone as string | undefined) : undefined) || '',
    customerEmail:
      order.customerEmail || (dataIsObject ? (dataAny?.customerEmail as string | undefined) : undefined) || '',
    discount: Number(receipt.discount ?? (dataIsObject ? (dataAny?.discount as number | undefined) : undefined) ?? 0),
    showDiscount: Boolean((receipt.showDiscount ?? (dataIsObject ? (dataAny?.showDiscount as boolean | undefined) : undefined)) || Number(receipt.discount ?? 0) > 0),
    generatedAt: receipt.generatedAt ? receipt.generatedAt.toISOString() : new Date().toISOString(),
    customerName: order.customerName || '',
    attendantName: orderAttendantName || dataAttendantName || issuedByName || '',
    issuedByName,
    paymentMethod:
      (dataIsObject ? (dataAny?.paymentMethod as string | undefined) : undefined) ||
      (receipt as any).paymentMethod ||
      '',
    deliveryAddress:
      ((order.metadata as any)?.deliveryAddress as string | undefined) ||
      (dataIsObject ? (dataAny?.deliveryAddress as string | undefined) : undefined) ||
      '',
    paymentBreakdown: {
      cash: typeof paymentBreakdown.cash === 'number' ? paymentBreakdown.cash : 0,
      mpesa: typeof paymentBreakdown.mpesa === 'number' ? paymentBreakdown.mpesa : 0,
      reference:
        typeof paymentBreakdown.reference === 'string'
          ? paymentBreakdown.reference
          : typeof paymentBreakdown.mpesaReference === 'string'
          ? paymentBreakdown.mpesaReference
          : '',
    },
    paymentDetailsShown,
    warrantyText,
    serialNumber,
    projectFlow: projectFlowRaw
      ? {
          isProject: projectFlowRaw.isProject === true,
          stage: typeof projectFlowRaw.stage === "string" ? projectFlowRaw.stage : null,
          paymentTerm:
            typeof projectFlowRaw.paymentTerm === "string" ? projectFlowRaw.paymentTerm : null,
          paymentStatus:
            typeof projectFlowRaw.paymentStatus === "string"
              ? projectFlowRaw.paymentStatus
              : null,
          depositType:
            typeof projectFlowRaw.depositType === "string" ? projectFlowRaw.depositType : null,
          depositPercent: Number(projectFlowRaw.depositPercent ?? 0) || 0,
          depositRequiredAmount: Number(projectFlowRaw.depositRequiredAmount ?? 0) || 0,
          depositPaidAmount: Number(projectFlowRaw.depositPaidAmount ?? 0) || 0,
          depositPendingAmount: Number(projectFlowRaw.depositPendingAmount ?? 0) || 0,
          depositPaymentMethod:
            typeof projectFlowRaw.depositPaymentMethod === "string"
              ? projectFlowRaw.depositPaymentMethod
              : null,
          balanceExpectedAmount: Number(projectFlowRaw.balanceExpectedAmount ?? 0) || 0,
          balancePaidAmount: Number(projectFlowRaw.balancePaidAmount ?? 0) || 0,
          balancePendingAmount: Number(projectFlowRaw.balancePendingAmount ?? 0) || 0,
          balancePaymentMethod:
            typeof projectFlowRaw.balancePaymentMethod === "string"
              ? projectFlowRaw.balancePaymentMethod
              : null,
          totalPaidAmount: Number(projectFlowRaw.totalPaidAmount ?? 0) || 0,
          remainingAmount: Number(projectFlowRaw.remainingAmount ?? 0) || 0,
        }
      : null,
  };
}
