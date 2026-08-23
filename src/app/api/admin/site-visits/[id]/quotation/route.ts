import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canAccessSiteVisit, getSiteVisitAccessActor } from "@/lib/siteVisitAccess";
import { createQuotationDraftFromSiteVisit, getSiteVisitById } from "@/lib/siteVisits";
import { notifySiteVisitCustomer } from "@/lib/siteVisitNotifications";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth(); const actor = await getSiteVisitAccessActor(session?.user as never); if (!actor) return NextResponse.json({ ok:false,error:"Forbidden" },{status:403});
    const { id } = await context.params; const visit = await getSiteVisitById(id); if (!visit) return NextResponse.json({ok:false,error:"Not found"},{status:404});
    if (!canAccessSiteVisit(actor, visit)) return NextResponse.json({ok:false,error:"Forbidden"},{status:403});
    const quotation = await createQuotationDraftFromSiteVisit(visit, actor);
    void notifySiteVisitCustomer({ event: "QUOTATION_READY", customerName: visit.customerName, phone: visit.customerPhone, email: visit.customerEmail, visitRef: visit.visitRef, detail: `Quotation ${quotation?.quoteRef || "draft"} is ready for review.` });
    return NextResponse.json({ok:true,quotation});
  } catch (error) { return NextResponse.json({ok:false,error:error instanceof Error?error.message:"Unable to create quotation."},{status:400}); }
}
