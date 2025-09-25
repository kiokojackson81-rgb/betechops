import { NextResponse } from "next/server";
import { getPendingPricingCount } from "@/lib/jumia";

export async function GET() {
	try {
		const { count } = await getPendingPricingCount();
		return NextResponse.json({ count });
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e);
			return NextResponse.json({ count: 0, error: msg }, { status: 200 });
		}
}