import { z } from "zod";

export const TECHNICAL_TEAM_CATEGORY = "TECHNICAL_TEAM" as const;

export const TECHNICAL_TEAM_ROLE_OPTIONS = [
  "Technical Manager",
  "Senior Solar PV & Electrical Engineer",
  "Solar Projects Engineer",
  "Lead Solar Technician",
  "Solar Technician",
  "Electrical Technician",
  "Assistant Technician",
  "Installation Casual",
] as const;

export const TECHNICAL_PERMISSION_SCOPES = [
  "FULL_TECHNICAL_ACCESS",
  "LEAD_PROJECTS",
  "FIELD_EXECUTION",
  "REPORTING_ONLY",
] as const;

export const technicalProfileInputSchema = z.object({
  teamRole: z.string().trim().max(120).optional().nullable(),
  positionTitle: z.string().trim().max(120).optional().nullable(),
  employeeNumber: z.string().trim().max(60).optional().nullable(),
  phoneNumber: z.string().trim().max(40).optional().nullable(),
  epraLicenseNumber: z.string().trim().max(80).optional().nullable(),
  epraLicenseClass: z.string().trim().max(80).optional().nullable(),
  drivingLicenseDetails: z.string().trim().max(160).optional().nullable(),
  employmentDate: z.string().trim().optional().nullable(),
  activeAccount: z.boolean().optional(),
  permissionScope: z.string().trim().max(80).optional().nullable(),
});

export type TechnicalProfileInput = z.infer<typeof technicalProfileInputSchema>;

export function normalizeTechnicalProfileInput(input: unknown) {
  const parsed = technicalProfileInputSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten() };
  }

  const data = parsed.data;
  return {
    ok: true as const,
    data: {
      teamRole: data.teamRole || null,
      positionTitle: data.positionTitle || null,
      employeeNumber: data.employeeNumber || null,
      phoneNumber: data.phoneNumber || null,
      epraLicenseNumber: data.epraLicenseNumber || null,
      epraLicenseClass: data.epraLicenseClass || null,
      drivingLicenseDetails: data.drivingLicenseDetails || null,
      employmentDate: data.employmentDate ? new Date(data.employmentDate) : null,
      activeAccount: data.activeAccount ?? true,
      permissionScope: data.permissionScope || null,
    },
  };
}

export function isTechnicalTeamCategory(category: string | null | undefined) {
  return String(category ?? "").trim().toUpperCase() === TECHNICAL_TEAM_CATEGORY;
}

export function buildTechnicalPermissionHints(teamRole: string | null | undefined) {
  const role = String(teamRole ?? "").trim().toLowerCase();
  if (role.includes("manager")) {
    return [
      "View all technical operations",
      "Assign projects and site visits",
      "Review reports and approvals",
    ];
  }
  if (role.includes("senior") || role.includes("engineer")) {
    return [
      "Lead surveys and installations",
      "Prepare quotations and receipts",
      "Submit project completion updates",
    ];
  }
  if (role.includes("assistant") || role.includes("casual")) {
    return [
      "View assigned work",
      "Upload progress evidence",
      "Submit daily reports",
    ];
  }
  return [
    "Track assigned work",
    "Update field progress",
    "Submit operational reports",
  ];
}
