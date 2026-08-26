import { noStoreJson, requireRoleOrBrendah } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

const settingsSchema = z.object({
  installationBand1Max: z.coerce.number().min(0),
  installationBand1Fee: z.coerce.number().min(0),
  installationBand2Max: z.coerce.number().min(0),
  installationBand2Fee: z.coerce.number().min(0),
  installationBand3Max: z.coerce.number().min(0),
  installationBand3Fee: z.coerce.number().min(0),
  installationBand4Max: z.coerce.number().min(0),
  installationBand4Fee: z.coerce.number().min(0),
  zone1TransportFee: z.coerce.number().min(0),
  zone2TransportFee: z.coerce.number().min(0),
  zone3TransportFee: z.coerce.number().min(0),
}).refine((value) => value.installationBand1Max < value.installationBand2Max && value.installationBand2Max < value.installationBand3Max && value.installationBand3Max < value.installationBand4Max, {
  message: "Installation price bands must increase in order",
});

const defaults = {
  installationBand1Max: 50000,
  installationBand1Fee: 8000,
  installationBand2Max: 100000,
  installationBand2Fee: 15000,
  installationBand3Max: 350000,
  installationBand3Fee: 25000,
  installationBand4Max: 800000,
  installationBand4Fee: 35000,
  zone1TransportFee: 3000,
  zone2TransportFee: 7500,
  zone3TransportFee: 15000,
};

export async function GET() {
  const auth = await requireRoleOrBrendah(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;
  const settings = await prisma.productCatalogueSettings.upsert({ where: { id: "default" }, create: { id: "default", ...defaults }, update: {} });
  return noStoreJson({ settings });
}

export async function PUT(req: Request) {
  const auth = await requireRoleOrBrendah(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;
  if (auth.isBrendah) return noStoreJson({ error: "Only an administrator can change global pricing rules" }, { status: 403 });
  const parsed = settingsSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return noStoreJson({ error: parsed.error.flatten() }, { status: 400 });
  const settings = await prisma.productCatalogueSettings.upsert({ where: { id: "default" }, create: { id: "default", ...parsed.data }, update: parsed.data });
  return noStoreJson({ ok: true, settings });
}
