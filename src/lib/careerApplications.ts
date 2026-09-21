import { del, put } from "@vercel/blob";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { describeEmailError, sendGeneralCustomerNotificationEmail } from "@/lib/email";

const MAX_CV_BYTES = 8 * 1024 * 1024;
const allowedExtensions = new Set(["pdf", "doc", "docx"]);
const allowedMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/octet-stream",
  "",
]);

const applicationSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(180),
  phone: z.string().trim().min(7).max(40),
  currentLocation: z.string().trim().min(2).max(120),
  educationLevel: z.string().trim().min(2).max(100),
  courseOfStudy: z.string().trim().min(2).max(180),
  graduationStatus: z.enum(["Graduated in 2025", "Graduated in 2026", "Final-year student awaiting graduation"]),
  coverLetter: z.string().trim().min(40, "Please add a short cover letter of at least 40 characters.").max(6000),
  tiktokWorkUrl: z.string().trim().url("Enter a valid link to previous TikTok content work.").max(2000),
  consent: z.literal("true"),
});

export type CareerApplicationInput = z.infer<typeof applicationSchema>;

type UploadedCv = {
  url: string;
  pathname: string;
  fileName: string;
  contentType: string;
  size: number;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function extensionFor(file: File) {
  return file.name.split(".").pop()?.toLowerCase().trim() || "";
}

export function parseCareerApplication(form: FormData) {
  return applicationSchema.parse({
    fullName: form.get("fullName"),
    email: form.get("email"),
    phone: form.get("phone"),
    currentLocation: form.get("currentLocation"),
    educationLevel: form.get("educationLevel"),
    courseOfStudy: form.get("courseOfStudy"),
    graduationStatus: form.get("graduationStatus"),
    coverLetter: form.get("coverLetter"),
    tiktokWorkUrl: form.get("tiktokWorkUrl"),
    consent: form.get("consent"),
  });
}

async function uploadCv(file: File): Promise<UploadedCv> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("Application file storage is not configured. Please try again later.");
  const extension = extensionFor(file);
  if (!allowedExtensions.has(extension) || !allowedMimeTypes.has(file.type)) {
    throw new Error("Upload your CV as a PDF, DOC, or DOCX file.");
  }
  if (file.size < 1 || file.size > MAX_CV_BYTES) {
    throw new Error("Your CV must be smaller than 8 MB.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (extension === "pdf" && !bytes.subarray(0, 5).toString("ascii").startsWith("%PDF-")) {
    throw new Error("The uploaded PDF could not be verified. Please choose a valid PDF, DOC, or DOCX file.");
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || `cv.${extension}`;
  const upload = await put(`career-applications/${crypto.randomUUID()}/${safeName}`, bytes, {
    access: "public",
    contentType: file.type || "application/octet-stream",
    token: process.env.BLOB_READ_WRITE_TOKEN,
    addRandomSuffix: true,
  });

  return { url: upload.url, pathname: upload.pathname, fileName: file.name.slice(0, 180), contentType: file.type || "application/octet-stream", size: file.size };
}

function applicantEmail(input: CareerApplicationInput) {
  return {
    to: input.email,
    subject: "We received your Betech Solar career application",
    title: "Your application has been received",
    intro: `Hello ${input.fullName},`,
    bodyHtml: "<p>Thank you for applying for the <strong>Customer Service &amp; Content Creation Graduate Trainee</strong> opportunity at Betech Solar Solutions.</p><p>Your application has been received. Only shortlisted candidates will be contacted.</p>",
    bodyText: "Thank you for applying for the Customer Service & Content Creation Graduate Trainee opportunity at Betech Solar Solutions. Your application has been received. Only shortlisted candidates will be contacted.",
    outro: "Betech Solar Solutions",
  };
}

function hrEmail(input: CareerApplicationInput, cv: UploadedCv) {
  const details = [
    ["Name", input.fullName],
    ["Email", input.email],
    ["Phone", input.phone],
    ["Location", input.currentLocation],
    ["Education", input.educationLevel],
    ["Course", input.courseOfStudy],
    ["Graduation", input.graduationStatus],
    ["TikTok work", input.tiktokWorkUrl],
  ];
  return {
    to: "hr@betech.co.ke",
    subject: `New career application — ${input.fullName}`,
    title: "New graduate trainee application",
    intro: `${input.fullName} has applied for Customer Service & Content Creation Graduate Trainee.`,
    bodyHtml: `<p><strong>CV:</strong> <a href="${escapeHtml(cv.url)}">${escapeHtml(cv.fileName)}</a></p><table role="presentation" style="border-collapse:collapse;width:100%">${details.map(([label, value]) => `<tr><td style="padding:7px 10px 7px 0;font-weight:700;color:#7a0000;vertical-align:top">${escapeHtml(label)}</td><td style="padding:7px 0;color:#334155;vertical-align:top">${escapeHtml(value)}</td></tr>`).join("")}</table><p><strong>Cover letter</strong></p><p>${escapeHtml(input.coverLetter).replace(/\n/g, "<br />")}</p>`,
    bodyText: `${details.map(([label, value]) => `${label}: ${value}`).join("\n")}\nCV: ${cv.url}\n\nCover letter:\n${input.coverLetter}`,
    ctaLabel: "Open CV",
    ctaUrl: cv.url,
  };
}

export async function submitCareerApplication(form: FormData) {
  const input = parseCareerApplication(form);
  const file = form.get("cv");
  if (!(file instanceof File)) throw new Error("Please upload your CV as a PDF, DOC, or DOCX file.");

  const cv = await uploadCv(file);
  let application: { id: string };
  try {
    application = await prisma.careerApplication.create({
      data: {
        fullName: input.fullName,
        email: input.email.toLowerCase(),
        phone: input.phone,
        currentLocation: input.currentLocation,
        educationLevel: input.educationLevel,
        courseOfStudy: input.courseOfStudy,
        graduationStatus: input.graduationStatus,
        cvFileUrl: cv.url,
        cvFileKey: cv.pathname,
        cvFileName: cv.fileName,
        cvContentType: cv.contentType,
        cvFileSize: cv.size,
        coverLetter: input.coverLetter,
        tiktokWorkUrl: input.tiktokWorkUrl,
        consentedAt: new Date(),
      },
      select: { id: true },
    });
  } catch (error) {
    try {
      await del(cv.pathname, { token: process.env.BLOB_READ_WRITE_TOKEN });
    } catch {
      // A failed clean-up must not hide the application error.
    }
    throw error;
  }

  const [applicantResult, hrResult] = await Promise.allSettled([
    sendGeneralCustomerNotificationEmail(applicantEmail(input)),
    sendGeneralCustomerNotificationEmail(hrEmail(input, cv)),
  ]);
  const emailError = [applicantResult, hrResult]
    .filter((result): result is PromiseRejectedResult => result.status === "rejected")
    .map((result) => describeEmailError(result.reason))
    .join(" | ")
    .slice(0, 4000) || null;

  await prisma.careerApplication.update({
    where: { id: application.id },
    data: {
      applicantEmailSentAt: applicantResult.status === "fulfilled" ? new Date() : null,
      hrEmailSentAt: hrResult.status === "fulfilled" ? new Date() : null,
      emailError,
    },
  });

  if (emailError) console.error("[career] application emails failed", { applicationId: application.id, emailError });
  return { id: application.id };
}