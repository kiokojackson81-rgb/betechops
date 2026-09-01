import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { verifySiteAssessmentToken } from "@/lib/siteAssessmentLink";
import { getSiteVisitById } from "@/lib/siteVisits";

export const runtime = "nodejs";

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;
const MAX_PHOTOS = 8;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const assessmentReviewSchema = z.object({
  summary: z.string().trim().min(1).max(1200),
  observations: z.array(z.string().trim().min(1).max(500)).max(8).default([]),
  risks: z.array(z.string().trim().min(1).max(500)).max(8).default([]),
  recommendations: z
    .array(z.string().trim().min(1).max(500))
    .max(8)
    .default([]),
  dataGaps: z.array(z.string().trim().min(1).max(500)).max(8).default([]),
});

function getAnalysisErrorResponse(error: unknown) {
  const apiError = error as {
    status?: number;
    code?: string | null;
    message?: string;
  };
  const status = apiError?.status;
  const code = apiError?.code || "";

  console.error("[site-assessment/analyze] AI analysis failed", {
    status,
    code,
    message: apiError?.message,
  });

  if (status === 401 || code === "invalid_api_key") {
    return NextResponse.json(
      {
        error:
          "OpenAI rejected the server API key. Replace OPENAI_API_KEY in Vercel Production with an active project key, then redeploy.",
      },
      { status: 503 },
    );
  }

  if (status === 403 || code === "model_not_found") {
    return NextResponse.json(
      {
        error:
          "The OpenAI project cannot access the assessment model. Check the project's model permissions and billing.",
      },
      { status: 503 },
    );
  }

  if (status === 429) {
    return NextResponse.json(
      {
        error:
          "OpenAI has no available quota for assessment analysis. Check the OpenAI project's billing and usage limits.",
      },
      { status: 503 },
    );
  }

  return NextResponse.json(
    { error: "AI assessment analysis failed. Please try again." },
    { status: 500 },
  );
}

export async function POST(request: Request) {
  if (!client) {
    return NextResponse.json(
      { error: "AI assessment analysis is not configured." },
      { status: 503 },
    );
  }

  const form = await request.formData();
  const token = String(form.get("token") || "");
  const tokenPayload = verifySiteAssessmentToken(token);
  if (!tokenPayload)
    return NextResponse.json(
      { error: "This assessment link is invalid or has expired." },
      { status: 403 },
    );

  const visit = await getSiteVisitById(tokenPayload.visitId);
  if (!visit || visit.assignedTechnicianId !== tokenPayload.technicianId) {
    return NextResponse.json(
      { error: "This assessment is no longer assigned to this link." },
      { status: 403 },
    );
  }

  const rawAssessment = String(form.get("assessment") || "");
  if (!rawAssessment || rawAssessment.length > 80_000) {
    return NextResponse.json(
      { error: "Assessment details are missing or too large." },
      { status: 400 },
    );
  }

  let assessment: unknown;
  try {
    assessment = JSON.parse(rawAssessment);
  } catch {
    return NextResponse.json(
      { error: "Assessment details are invalid." },
      { status: 400 },
    );
  }

  const photos = form
    .getAll("photos")
    .filter((entry): entry is File => entry instanceof File)
    .slice(0, MAX_PHOTOS);
  if (
    photos.some(
      (photo) =>
        !photo.type.startsWith("image/") || photo.size > MAX_PHOTO_BYTES,
    )
  ) {
    return NextResponse.json(
      { error: "Photos must be images smaller than 5 MB each." },
      { status: 400 },
    );
  }

  try {
    const imageContent = await Promise.all(
      photos.map(async (photo) => ({
        type: "image_url" as const,
        image_url: {
          url: `data:${photo.type || "image/jpeg"};base64,${Buffer.from(await photo.arrayBuffer()).toString("base64")}`,
          detail: "high" as const,
        },
      })),
    );
    const completion = await client.chat.completions.create({
      model: "gpt-4.1",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a senior solar site-assessment reviewer for Kenya. Review entered appliance usage, electrical data, roof evidence and photos. Do not invent ratings, dimensions, phase, roof condition or KPLC consumption. Treat unknown nameplates as unresolved and list them in dataGaps. Do not override the deterministic inverter, battery and PV calculation: assess its reasonableness and identify practical risks, evidence to collect, and next actions. Return only JSON with summary, observations, risks, recommendations and dataGaps arrays.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Site visit ${visit.visitRef} for ${visit.customerName}. Assessment data:\n${JSON.stringify(assessment)}`,
            },
            ...imageContent,
          ],
        },
      ],
    });
    const rawReview = completion.choices[0]?.message?.content || "{}";
    const review = assessmentReviewSchema.parse(JSON.parse(rawReview));
    return NextResponse.json({ review });
  } catch (error) {
    return getAnalysisErrorResponse(error);
  }
}
