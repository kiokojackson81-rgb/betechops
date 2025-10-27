import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const text = await req.text();
    JSON.parse(text || "{}");
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Invalid JSON" }, { status: 400 });
  }
}
