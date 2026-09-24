import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { submitCareerApplication } from "@/lib/careerApplications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_APPLICATIONS_PER_WINDOW = 3;
const attempts = new Map<string, number[]>();

function requestKey(request: NextRequest, email: string) {
  const forwarded = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
  return `${forwarded.split(",")[0].trim()}:${email.trim().toLowerCase()}`;
}

function consumeRateLimit(key: string) {
  const now = Date.now();
  const current = (attempts.get(key) || []).filter((timestamp) => timestamp > now - WINDOW_MS);
  if (current.length >= MAX_APPLICATIONS_PER_WINDOW) {
    attempts.set(key, current);
    return false;
  }
  current.push(now);
  attempts.set(key, current);
  return true;
}

function errorMessage(error: unknown) {
  if (error instanceof ZodError) return error.issues[0]?.message || "Please check the application form and try again.";
  if (error instanceof Error && /^(Please upload your CV|Upload your CV|Your CV|The uploaded PDF)/.test(error.message)) return error.message;
  return "We could not submit your application. Please try again.";
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    // Honeypot field: human applicants never see or fill it.
    if (String(form.get("website") || "").trim()) return NextResponse.json({ error: "Unable to submit this application." }, { status: 400 });

    const email = String(form.get("email") || "");
    if (!consumeRateLimit(requestKey(request, email))) {
      return NextResponse.json({ error: "Too many application attempts. Please wait and try again later." }, { status: 429 });
    }

    await submitCareerApplication(form);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("[career] application submission failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}
