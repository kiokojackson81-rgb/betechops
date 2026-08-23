import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSiteVisitAccessActor } from "@/lib/siteVisitAccess";
import { applySiteVisitCredit, getSiteVisitById } from "@/lib/siteVisits";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth(); const actor = await getSiteVisitAccessActor(session?.user as never); if (!actor?.canManageCommercials) return NextResponse.json({ok:false,error:"Forbidden"},{status:403});
    const {id}=await context.params; const visit=await getSiteVisitById(id); if(!visit)return NextResponse.json({ok:false,error:"Not found"},{status:404});
    const updated=await applySiteVisitCredit(visit,actor); return NextResponse.json({ok:true,visit:updated});
  } catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:"Unable to apply credit."},{status:400});}
}
