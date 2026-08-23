"use client";

import Link from "next/link";
import { type FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createQuoteRequest, type ShopApiError } from "@/app/shop/shopSubmitApi";
import { trackQuoteSubmitted } from "@/app/shop/shopAnalytics";
import { shopStyles } from "@/app/shop/_components/shopStyles";
import { getShopQuoteSuccessHref, SHOP_HOME_HREF } from "@/app/shop/storefrontPaths";
import { getServiceZone, getTownsForCounty, kenyaCountyOptions } from "@/lib/agents/kenyaMarkets";

type QuoteRequestClientProps = {
  preferredProduct?: string;
  initialProfile?: {
    name?: string;
    phone?: string;
    email?: string;
    county?: string;
    town?: string;
    exactLocation?: string;
  };
};

type ProjectType =
  | "SOLAR_HOME_SYSTEM"
  | "SOLAR_WATER_PUMP"
  | "SOLAR_WATER_HEATER"
  | "BOREHOLE_SOLAR_SYSTEM"
  | "COMMERCIAL_SOLAR_SYSTEM"
  | "CCTV_PLUS_SOLAR"
  | "STREET_LIGHTS"
  | "OTHER";

type ContactMethod = "PHONE_CALL" | "WHATSAPP" | "EMAIL";
type ContactTime = "ANYTIME" | "MORNING" | "AFTERNOON" | "EVENING";
type Urgency = "TODAY" | "THIS_WEEK" | "THIS_MONTH" | "JUST_RESEARCHING";
type InstallationStatus =
  | "NEW_INSTALLATION"
  | "UPGRADE_EXISTING_SYSTEM"
  | "REPAIR_OR_REPLACEMENT";

type Step = 1 | 2 | 3 | 4;

const PROJECT_TYPE_OPTIONS: Array<{ value: ProjectType; label: string; description: string }> = [
  { value: "SOLAR_HOME_SYSTEM", label: "Solar Home System", description: "Lights, TVs, fridge, freezer, WiFi, CCTV, and home backup." },
  { value: "SOLAR_WATER_PUMP", label: "Solar Water Pump", description: "Water pumping for boreholes, wells, rivers, tanks, and irrigation." },
  { value: "SOLAR_WATER_HEATER", label: "Solar Water Heater", description: "Hot water sizing for homes, schools, hotels, and institutions." },
  { value: "BOREHOLE_SOLAR_SYSTEM", label: "Borehole Solar System", description: "Full borehole and pumping system sizing with solar power." },
  { value: "COMMERCIAL_SOLAR_SYSTEM", label: "Commercial Solar System", description: "Business and institution systems with higher daytime and backup demand." },
  { value: "CCTV_PLUS_SOLAR", label: "CCTV + Solar", description: "Solar backup for cameras, recorder, router, and security loads." },
  { value: "STREET_LIGHTS", label: "Street Lights", description: "Compound, road, school, estate, and institution lighting projects." },
  { value: "OTHER", label: "Other", description: "Use this when your project does not fit the listed categories." },
];

const SOLAR_HOME_APPLIANCES = [
  "Lights",
  "TV",
  "Fridge",
  "Freezer",
  "WiFi",
  "CCTV",
  "Microwave",
  "Water Pump",
  "Washing Machine",
  "Computer",
  "Other",
] as const;

const BUDGET_OPTIONS = [
  "Under Ksh 50,000",
  "Ksh 50,000 - 100,000",
  "Ksh 100,000 - 250,000",
  "Ksh 250,000 - 500,000",
  "Ksh 500,000 - 1,000,000",
  "Above Ksh 1,000,000",
  "Not sure yet",
] as const;

const CONTACT_METHOD_OPTIONS: Array<{ value: ContactMethod; label: string }> = [
  { value: "PHONE_CALL", label: "Phone call" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "EMAIL", label: "Email" },
];

const CONTACT_TIME_OPTIONS: Array<{ value: ContactTime; label: string }> = [
  { value: "ANYTIME", label: "Anytime" },
  { value: "MORNING", label: "Morning" },
  { value: "AFTERNOON", label: "Afternoon" },
  { value: "EVENING", label: "Evening" },
];

const URGENCY_OPTIONS: Array<{ value: Urgency; label: string }> = [
  { value: "TODAY", label: "Today" },
  { value: "THIS_WEEK", label: "This week" },
  { value: "THIS_MONTH", label: "This month" },
  { value: "JUST_RESEARCHING", label: "Just researching" },
];

const INSTALLATION_STATUS_OPTIONS: Array<{ value: InstallationStatus; label: string }> = [
  { value: "NEW_INSTALLATION", label: "New installation" },
  { value: "UPGRADE_EXISTING_SYSTEM", label: "Upgrade existing system" },
  { value: "REPAIR_OR_REPLACEMENT", label: "Repair or replacement" },
];

const HOME_BACKUP_OPTIONS = ["Daytime only", "6 Hours", "12 Hours", "24 Hours", "Not Sure"] as const;

function projectTypeLabel(value: ProjectType) {
  return PROJECT_TYPE_OPTIONS.find((option) => option.value === value)?.label || value;
}

export default function QuoteRequestClient({
  preferredProduct = "",
  initialProfile,
}: QuoteRequestClientProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    name: initialProfile?.name || "",
    phone: initialProfile?.phone || "",
    email: initialProfile?.email || "",
    county: initialProfile?.county || "",
    town: initialProfile?.town || "",
    exactLocation: initialProfile?.exactLocation || "",
    projectType: "SOLAR_HOME_SYSTEM" as ProjectType,
    preferredContactMethod: "PHONE_CALL" as ContactMethod,
    bestTimeToContact: "ANYTIME" as ContactTime,
    urgency: "THIS_WEEK" as Urgency,
    installationStatus: "NEW_INSTALLATION" as InstallationStatus,
    budgetRange: "",
    preferredProducts: preferredProduct,
    notes: "",
    solarHomeAppliances: [] as string[],
    solarHomeQuantities: {
      TV: "",
      Fridge: "",
      Freezer: "",
      WaterPump: "",
      Lights: "",
      Other: "",
    },
    solarHomeBackupDuration: "Not Sure",
    solarHomePowerUsePattern: "",
    solarHomeExistingPowerSource: "",
    pumpWaterSource: "",
    pumpBoreholeDepth: "",
    pumpWaterLevel: "",
    pumpTankSize: "",
    pumpTankHeight: "",
    pumpDistanceToTank: "",
    pumpDailyWaterRequirement: "",
    heaterNumberOfUsers: "",
    heaterUsageType: "",
    heaterExistingTankSize: "",
    heaterDailyHotWaterUsage: "",
    commercialBusinessType: "",
    commercialKeyEquipment: "",
    commercialMonthlyBill: "",
    commercialPhaseType: "",
    commercialUsagePattern: "",
    cctvCameraCount: "",
    cctvRecorderType: "",
    cctvRouterRequired: "",
    cctvBackupDuration: "",
    streetLightPoleCount: "",
    streetLightPoleHeight: "",
    streetLightCoverageArea: "",
    streetLightBrightnessNeed: "",
    otherProjectDetails: "",
  });

  const availableTowns = useMemo(() => getTownsForCounty(form.county), [form.county]);
  const serviceZone = getServiceZone(form.county, form.town);
  const inputBaseClass = "min-h-[3.4rem] rounded-2xl border bg-white px-4 outline-none transition";
  const resolveFieldClass = (fieldName: string) =>
    `${inputBaseClass} ${fieldErrors[fieldName] ? "border-red-300 ring-2 ring-red-100" : "border-[#7a0000]/10 focus:border-[#7a0000]/30"}`;

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    if (fieldErrors[key as string]) {
      setFieldErrors((current) => {
        const next = { ...current };
        delete next[key as string];
        return next;
      });
    }
  }

  function validateStep(step: Step) {
    const nextErrors: Record<string, string> = {};

    if (step === 1) {
      if (!form.name.trim()) nextErrors.name = "Please enter the customer name.";
      if (!form.phone.trim()) nextErrors.phone = "Please enter the customer phone number.";
      if (form.email.trim() && !/\S+@\S+\.\S+/.test(form.email.trim())) {
        nextErrors.email = "Enter a valid email address or leave it blank.";
      }
      if (!form.county.trim()) nextErrors.county = "Please select the county.";
      if (!form.town.trim()) nextErrors.town = "Please select the town or area.";
      if (!form.exactLocation.trim()) nextErrors.exactLocation = "Please add the exact location or landmark.";
    }

    if (step === 3) {
      if (form.projectType === "SOLAR_HOME_SYSTEM" && !form.solarHomeAppliances.length) {
        nextErrors.solarHomeAppliances = "Select at least one appliance.";
      }
      if (
        (form.projectType === "SOLAR_WATER_PUMP" || form.projectType === "BOREHOLE_SOLAR_SYSTEM") &&
        !form.pumpWaterSource.trim()
      ) {
        nextErrors.pumpWaterSource = "Please select the water source.";
      }
      if (form.projectType === "SOLAR_WATER_HEATER" && !form.heaterNumberOfUsers.trim()) {
        nextErrors.heaterNumberOfUsers = "Please enter the number of users.";
      }
      if (form.projectType === "COMMERCIAL_SOLAR_SYSTEM" && !form.commercialBusinessType.trim()) {
        nextErrors.commercialBusinessType = "Please enter the business type.";
      }
      if (form.projectType === "CCTV_PLUS_SOLAR" && !form.cctvCameraCount.trim()) {
        nextErrors.cctvCameraCount = "Please enter the number of cameras.";
      }
      if (form.projectType === "STREET_LIGHTS" && !form.streetLightPoleCount.trim()) {
        nextErrors.streetLightPoleCount = "Please enter the number of poles.";
      }
      if (form.projectType === "OTHER" && !form.otherProjectDetails.trim()) {
        nextErrors.otherProjectDetails = "Please describe the project you need quoted.";
      }
    }

    if (step === 4 && !form.budgetRange.trim()) {
      nextErrors.budgetRange = "Please select the budget range.";
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function nextStep() {
    if (!validateStep(currentStep)) return;
    setCurrentStep((current) => Math.min(4, current + 1) as Step);
  }

  function previousStep() {
    setCurrentStep((current) => Math.max(1, current - 1) as Step);
  }

  function buildAnswers() {
    return {
      solarHome:
        form.projectType === "SOLAR_HOME_SYSTEM"
          ? {
              appliances: form.solarHomeAppliances,
              quantities: form.solarHomeQuantities,
              backupDuration: form.solarHomeBackupDuration,
              powerUsePattern: form.solarHomePowerUsePattern,
              existingPowerSource: form.solarHomeExistingPowerSource,
            }
          : undefined,
      solarWaterPump:
        form.projectType === "SOLAR_WATER_PUMP" || form.projectType === "BOREHOLE_SOLAR_SYSTEM"
          ? {
              waterSource: form.pumpWaterSource,
              boreholeDepth: form.pumpBoreholeDepth,
              waterLevel: form.pumpWaterLevel,
              tankSize: form.pumpTankSize,
              tankHeight: form.pumpTankHeight,
              distanceToTank: form.pumpDistanceToTank,
              dailyWaterRequirement: form.pumpDailyWaterRequirement,
            }
          : undefined,
      solarWaterHeater:
        form.projectType === "SOLAR_WATER_HEATER"
          ? {
              numberOfUsers: form.heaterNumberOfUsers,
              usageType: form.heaterUsageType,
              existingTankSize: form.heaterExistingTankSize,
              dailyHotWaterUsage: form.heaterDailyHotWaterUsage,
            }
          : undefined,
      commercialSolar:
        form.projectType === "COMMERCIAL_SOLAR_SYSTEM"
          ? {
              businessType: form.commercialBusinessType,
              keyEquipment: form.commercialKeyEquipment,
              estimatedMonthlyBill: form.commercialMonthlyBill,
              phaseType: form.commercialPhaseType,
              usagePattern: form.commercialUsagePattern,
            }
          : undefined,
      cctvSolar:
        form.projectType === "CCTV_PLUS_SOLAR"
          ? {
              cameraCount: form.cctvCameraCount,
              recorderType: form.cctvRecorderType,
              routerRequired: form.cctvRouterRequired,
              backupDuration: form.cctvBackupDuration,
            }
          : undefined,
      streetLights:
        form.projectType === "STREET_LIGHTS"
          ? {
              poleCount: form.streetLightPoleCount,
              poleHeight: form.streetLightPoleHeight,
              coverageArea: form.streetLightCoverageArea,
              brightnessNeed: form.streetLightBrightnessNeed,
            }
          : undefined,
      general:
        form.projectType === "OTHER"
          ? {
              projectDetails: form.otherProjectDetails,
            }
          : undefined,
    };
  }

  const resolvedLocation = [form.town.trim(), form.county.trim(), form.exactLocation.trim()]
    .filter(Boolean)
    .join(" - ");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateStep(4)) return;

    setSubmitting(true);
    setError(null);

    try {
      const result = await createQuoteRequest({
        name: form.name,
        phone: form.phone,
        email: form.email,
        location: resolvedLocation,
        county: form.county,
        town: form.town,
        specificLocation: form.exactLocation,
        projectType: form.projectType,
        propertyType: "",
        preferredContactMethod: form.preferredContactMethod,
        bestTimeToContact: form.bestTimeToContact,
        urgency: form.urgency,
        installationStatus: form.installationStatus,
        load:
          form.projectType === "SOLAR_HOME_SYSTEM"
            ? `Appliances: ${form.solarHomeAppliances.join(", ") || "Not specified"}`
            : form.otherProjectDetails,
        budgetRange: form.budgetRange,
        preferredProducts: form.preferredProducts,
        notes: form.notes,
        answers: buildAnswers(),
      });

      trackQuoteSubmitted({
        quoteRef: result.quoteRef,
        propertyType: projectTypeLabel(form.projectType),
        location: resolvedLocation,
        preferredProducts: form.preferredProducts.trim(),
      });

      router.push(getShopQuoteSuccessHref(result.quoteRef));
    } catch (submissionError) {
      const apiError = submissionError as ShopApiError;
      if (apiError?.status === 401 && apiError.redirectTo) {
        router.push(apiError.redirectTo);
        return;
      }
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to send the quote request.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const stepTitle =
    currentStep === 1
      ? "Customer information"
      : currentStep === 2
        ? "What do you need?"
        : currentStep === 3
          ? "Project details"
          : "Budget and follow-up";

  return (
    <form className={`${shopStyles.lightCard} p-5 sm:p-6`} onSubmit={handleSubmit}>
      <div className={shopStyles.sectionEyebrow}>Request a Solar System Quote</div>
      <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950">
        Structured quotation intake for faster and more accurate Betech sizing.
      </h1>
      <p className="mt-3 text-base leading-7 text-slate-600">
        Share your project type, location, and technical needs so the Betech quotation desk can
        prepare most of the recommendation before calling you.
      </p>
      <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm leading-6 text-emerald-900">
        To help us prepare accurate quotations and avoid spam, please verify your phone or email
        before submitting a quote request.
      </div>

      <div className="mt-5">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[#7a0000]">
          <span>Step {currentStep} of 4</span>
          <span className="text-slate-400">•</span>
          <span>{stepTitle}</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#7a0000]/10">
          <div
            className="h-full rounded-full bg-[#7a0000] transition-all"
            style={{ width: `${currentStep * 25}%` }}
          />
        </div>
      </div>

      {currentStep === 1 ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Customer name
            <input
              value={form.name}
              onChange={(event) => setField("name", event.target.value)}
              className={resolveFieldClass("name")}
            />
            {fieldErrors.name ? <span className="text-xs font-semibold text-red-600">{fieldErrors.name}</span> : null}
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Phone number
            <input
              value={form.phone}
              onChange={(event) => setField("phone", event.target.value)}
              className={resolveFieldClass("phone")}
            />
            {fieldErrors.phone ? <span className="text-xs font-semibold text-red-600">{fieldErrors.phone}</span> : null}
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">
            Email address
            <input
              type="email"
              value={form.email}
              onChange={(event) => setField("email", event.target.value)}
              className={resolveFieldClass("email")}
              placeholder="Optional"
            />
            {fieldErrors.email ? <span className="text-xs font-semibold text-red-600">{fieldErrors.email}</span> : null}
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            County
            <select
              value={form.county}
              onChange={(event) => {
                const nextCounty = event.target.value;
                const nextTowns = getTownsForCounty(nextCounty) as string[];
                setForm((current) => ({
                  ...current,
                  county: nextCounty,
                  town: nextTowns.includes(current.town) ? current.town : "",
                }));
                if (fieldErrors.county || fieldErrors.town) {
                  setFieldErrors((current) => {
                    const next = { ...current };
                    delete next.county;
                    delete next.town;
                    return next;
                  });
                }
              }}
              className={resolveFieldClass("county")}
            >
              <option value="">Select county</option>
              {kenyaCountyOptions.map((county) => (
                <option key={county} value={county}>
                  {county}
                </option>
              ))}
            </select>
            {fieldErrors.county ? <span className="text-xs font-semibold text-red-600">{fieldErrors.county}</span> : null}
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Town / area
            <select
              value={form.town}
              onChange={(event) => setField("town", event.target.value)}
              disabled={!form.county}
              className={resolveFieldClass("town")}
            >
              <option value="">{form.county ? "Select town / area" : "Choose county first"}</option>
              {availableTowns.map((town) => (
                <option key={town} value={town}>
                  {town}
                </option>
              ))}
            </select>
            {fieldErrors.town ? <span className="text-xs font-semibold text-red-600">{fieldErrors.town}</span> : null}
          </label>
          {serviceZone ? <div className="rounded-2xl border border-amber-300/40 bg-amber-50 p-4 text-sm text-slate-700 sm:col-span-2"><b className="text-[#7a0000]">{serviceZone.name}</b><div className="mt-1">{form.town}, {form.county} County. This zone supports delivery, installation, and site-visit planning; final quotation charges remain itemized separately.</div></div> : null}
          <label className="grid gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">
            Exact location / landmark
            <input
              value={form.exactLocation}
              onChange={(event) => setField("exactLocation", event.target.value)}
              className={resolveFieldClass("exactLocation")}
              placeholder="Estate, stage, centre, road, school, church, or nearby landmark"
            />
            {fieldErrors.exactLocation ? (
              <span className="text-xs font-semibold text-red-600">{fieldErrors.exactLocation}</span>
            ) : null}
          </label>
        </div>
      ) : null}

      {currentStep === 2 ? (
        <div className="mt-6 grid gap-4">
          {PROJECT_TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setField("projectType", option.value)}
              className={`rounded-[24px] border p-4 text-left transition ${
                form.projectType === option.value
                  ? "border-[#7a0000] bg-[#fff7f5]"
                  : "border-[#7a0000]/10 bg-white hover:border-[#7a0000]/25"
              }`}
            >
              <div className="text-base font-black text-slate-950">{option.label}</div>
              <div className="mt-1 text-sm leading-6 text-slate-600">{option.description}</div>
            </button>
          ))}
        </div>
      ) : null}

      {currentStep === 3 ? (
        <div className="mt-6 grid gap-4">
          {form.projectType === "SOLAR_HOME_SYSTEM" ? (
            <>
              <div className="grid gap-3">
                <div className="text-sm font-semibold text-slate-700">What appliances will you run?</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {SOLAR_HOME_APPLIANCES.map((appliance) => {
                    const checked = form.solarHomeAppliances.includes(appliance);
                    return (
                      <label
                        key={appliance}
                        className="flex items-center gap-3 rounded-[18px] border border-[#7a0000]/10 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => {
                            const next = event.target.checked
                              ? [...form.solarHomeAppliances, appliance]
                              : form.solarHomeAppliances.filter((value) => value !== appliance);
                            setField("solarHomeAppliances", next);
                          }}
                        />
                        <span>{appliance}</span>
                      </label>
                    );
                  })}
                </div>
                {fieldErrors.solarHomeAppliances ? (
                  <span className="text-xs font-semibold text-red-600">{fieldErrors.solarHomeAppliances}</span>
                ) : null}
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  TVs
                  <input
                    value={form.solarHomeQuantities.TV}
                    onChange={(event) =>
                      setField("solarHomeQuantities", {
                        ...form.solarHomeQuantities,
                        TV: event.target.value,
                      })
                    }
                    className={resolveFieldClass("solarHomeTV")}
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  Fridges
                  <input
                    value={form.solarHomeQuantities.Fridge}
                    onChange={(event) =>
                      setField("solarHomeQuantities", {
                        ...form.solarHomeQuantities,
                        Fridge: event.target.value,
                      })
                    }
                    className={resolveFieldClass("solarHomeFridge")}
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  Freezers
                  <input
                    value={form.solarHomeQuantities.Freezer}
                    onChange={(event) =>
                      setField("solarHomeQuantities", {
                        ...form.solarHomeQuantities,
                        Freezer: event.target.value,
                      })
                    }
                    className={resolveFieldClass("solarHomeFreezer")}
                  />
                </label>
              </div>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                How many hours of backup do you need?
                <select
                  value={form.solarHomeBackupDuration}
                  onChange={(event) => setField("solarHomeBackupDuration", event.target.value)}
                  className={resolveFieldClass("solarHomeBackupDuration")}
                >
                  {HOME_BACKUP_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Existing power source
                <input
                  value={form.solarHomeExistingPowerSource}
                  onChange={(event) => setField("solarHomeExistingPowerSource", event.target.value)}
                  className={resolveFieldClass("solarHomeExistingPowerSource")}
                  placeholder="Grid, generator, no power, or not sure"
                />
              </label>
            </>
          ) : null}

          {(form.projectType === "SOLAR_WATER_PUMP" || form.projectType === "BOREHOLE_SOLAR_SYSTEM") ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Water source
                <select
                  value={form.pumpWaterSource}
                  onChange={(event) => setField("pumpWaterSource", event.target.value)}
                  className={resolveFieldClass("pumpWaterSource")}
                >
                  <option value="">Select water source</option>
                  <option value="Borehole">Borehole</option>
                  <option value="Well">Well</option>
                  <option value="River">River</option>
                  <option value="Dam">Dam</option>
                  <option value="Tank">Tank</option>
                  <option value="Not sure">Not sure</option>
                </select>
                {fieldErrors.pumpWaterSource ? <span className="text-xs font-semibold text-red-600">{fieldErrors.pumpWaterSource}</span> : null}
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Borehole depth
                <input value={form.pumpBoreholeDepth} onChange={(event) => setField("pumpBoreholeDepth", event.target.value)} className={resolveFieldClass("pumpBoreholeDepth")} placeholder="e.g. 120m or not sure" />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Water level
                <input value={form.pumpWaterLevel} onChange={(event) => setField("pumpWaterLevel", event.target.value)} className={resolveFieldClass("pumpWaterLevel")} placeholder="e.g. 60m or not sure" />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Tank size
                <input value={form.pumpTankSize} onChange={(event) => setField("pumpTankSize", event.target.value)} className={resolveFieldClass("pumpTankSize")} placeholder="e.g. 5,000 litres" />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Tank height
                <input value={form.pumpTankHeight} onChange={(event) => setField("pumpTankHeight", event.target.value)} className={resolveFieldClass("pumpTankHeight")} placeholder="Height above water source" />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Distance to tank
                <input value={form.pumpDistanceToTank} onChange={(event) => setField("pumpDistanceToTank", event.target.value)} className={resolveFieldClass("pumpDistanceToTank")} placeholder="e.g. 300m" />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">
                Daily water requirement
                <input value={form.pumpDailyWaterRequirement} onChange={(event) => setField("pumpDailyWaterRequirement", event.target.value)} className={resolveFieldClass("pumpDailyWaterRequirement")} placeholder="e.g. 10,000 litres per day" />
              </label>
            </div>
          ) : null}

          {form.projectType === "SOLAR_WATER_HEATER" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Number of users
                <input value={form.heaterNumberOfUsers} onChange={(event) => setField("heaterNumberOfUsers", event.target.value)} className={resolveFieldClass("heaterNumberOfUsers")} />
                {fieldErrors.heaterNumberOfUsers ? <span className="text-xs font-semibold text-red-600">{fieldErrors.heaterNumberOfUsers}</span> : null}
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Home / school / hotel
                <input value={form.heaterUsageType} onChange={(event) => setField("heaterUsageType", event.target.value)} className={resolveFieldClass("heaterUsageType")} />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Existing tank size
                <input value={form.heaterExistingTankSize} onChange={(event) => setField("heaterExistingTankSize", event.target.value)} className={resolveFieldClass("heaterExistingTankSize")} />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Daily hot water usage
                <input value={form.heaterDailyHotWaterUsage} onChange={(event) => setField("heaterDailyHotWaterUsage", event.target.value)} className={resolveFieldClass("heaterDailyHotWaterUsage")} />
              </label>
            </div>
          ) : null}

          {form.projectType === "COMMERCIAL_SOLAR_SYSTEM" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Business type
                <input value={form.commercialBusinessType} onChange={(event) => setField("commercialBusinessType", event.target.value)} className={resolveFieldClass("commercialBusinessType")} />
                {fieldErrors.commercialBusinessType ? <span className="text-xs font-semibold text-red-600">{fieldErrors.commercialBusinessType}</span> : null}
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Key equipment
                <input value={form.commercialKeyEquipment} onChange={(event) => setField("commercialKeyEquipment", event.target.value)} className={resolveFieldClass("commercialKeyEquipment")} />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Estimated monthly bill
                <input value={form.commercialMonthlyBill} onChange={(event) => setField("commercialMonthlyBill", event.target.value)} className={resolveFieldClass("commercialMonthlyBill")} />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Phase type
                <input value={form.commercialPhaseType} onChange={(event) => setField("commercialPhaseType", event.target.value)} className={resolveFieldClass("commercialPhaseType")} placeholder="Single phase, 3 phase, or not sure" />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">
                Usage pattern
                <input value={form.commercialUsagePattern} onChange={(event) => setField("commercialUsagePattern", event.target.value)} className={resolveFieldClass("commercialUsagePattern")} placeholder="Daytime-heavy, nighttime-heavy, mixed, or not sure" />
              </label>
            </div>
          ) : null}

          {form.projectType === "CCTV_PLUS_SOLAR" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Number of cameras
                <input value={form.cctvCameraCount} onChange={(event) => setField("cctvCameraCount", event.target.value)} className={resolveFieldClass("cctvCameraCount")} />
                {fieldErrors.cctvCameraCount ? <span className="text-xs font-semibold text-red-600">{fieldErrors.cctvCameraCount}</span> : null}
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Recorder type
                <input value={form.cctvRecorderType} onChange={(event) => setField("cctvRecorderType", event.target.value)} className={resolveFieldClass("cctvRecorderType")} placeholder="DVR, NVR, or not sure" />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Internet router required?
                <input value={form.cctvRouterRequired} onChange={(event) => setField("cctvRouterRequired", event.target.value)} className={resolveFieldClass("cctvRouterRequired")} placeholder="Yes, no, or not sure" />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Backup duration
                <input value={form.cctvBackupDuration} onChange={(event) => setField("cctvBackupDuration", event.target.value)} className={resolveFieldClass("cctvBackupDuration")} placeholder="e.g. 12 hours or 24/7" />
              </label>
            </div>
          ) : null}

          {form.projectType === "STREET_LIGHTS" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Number of poles
                <input value={form.streetLightPoleCount} onChange={(event) => setField("streetLightPoleCount", event.target.value)} className={resolveFieldClass("streetLightPoleCount")} />
                {fieldErrors.streetLightPoleCount ? <span className="text-xs font-semibold text-red-600">{fieldErrors.streetLightPoleCount}</span> : null}
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Pole height
                <input value={form.streetLightPoleHeight} onChange={(event) => setField("streetLightPoleHeight", event.target.value)} className={resolveFieldClass("streetLightPoleHeight")} />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Coverage area
                <input value={form.streetLightCoverageArea} onChange={(event) => setField("streetLightCoverageArea", event.target.value)} className={resolveFieldClass("streetLightCoverageArea")} />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Brightness need
                <input value={form.streetLightBrightnessNeed} onChange={(event) => setField("streetLightBrightnessNeed", event.target.value)} className={resolveFieldClass("streetLightBrightnessNeed")} />
              </label>
            </div>
          ) : null}

          {form.projectType === "OTHER" ? (
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Describe what you need
              <textarea
                rows={5}
                value={form.otherProjectDetails}
                onChange={(event) => setField("otherProjectDetails", event.target.value)}
                className="rounded-[24px] border border-[#7a0000]/10 bg-white px-4 py-3 outline-none"
              />
              {fieldErrors.otherProjectDetails ? (
                <span className="text-xs font-semibold text-red-600">{fieldErrors.otherProjectDetails}</span>
              ) : null}
            </label>
          ) : null}
        </div>
      ) : null}

      {currentStep === 4 ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Budget
            <select
              value={form.budgetRange}
              onChange={(event) => setField("budgetRange", event.target.value)}
              className={resolveFieldClass("budgetRange")}
            >
              <option value="">Select budget</option>
              {BUDGET_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {fieldErrors.budgetRange ? <span className="text-xs font-semibold text-red-600">{fieldErrors.budgetRange}</span> : null}
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Installation status
            <select
              value={form.installationStatus}
              onChange={(event) => setField("installationStatus", event.target.value as InstallationStatus)}
              className={resolveFieldClass("installationStatus")}
            >
              {INSTALLATION_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Preferred contact method
            <select
              value={form.preferredContactMethod}
              onChange={(event) => setField("preferredContactMethod", event.target.value as ContactMethod)}
              className={resolveFieldClass("preferredContactMethod")}
            >
              {CONTACT_METHOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Best time to contact
            <select
              value={form.bestTimeToContact}
              onChange={(event) => setField("bestTimeToContact", event.target.value as ContactTime)}
              className={resolveFieldClass("bestTimeToContact")}
            >
              {CONTACT_TIME_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Urgency
            <select
              value={form.urgency}
              onChange={(event) => setField("urgency", event.target.value as Urgency)}
              className={resolveFieldClass("urgency")}
            >
              {URGENCY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Preferred products
            <input
              value={form.preferredProducts}
              onChange={(event) => setField("preferredProducts", event.target.value)}
              className={resolveFieldClass("preferredProducts")}
              placeholder="Optional product names or links"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">
            Additional notes
            <textarea
              rows={5}
              value={form.notes}
              onChange={(event) => setField("notes", event.target.value)}
              className="rounded-[24px] border border-[#7a0000]/10 bg-white px-4 py-3 outline-none"
              placeholder="Add anything else the quotation team should know."
            />
          </label>
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        {currentStep > 1 ? (
          <button type="button" onClick={previousStep} className={shopStyles.secondaryButton}>
            Back
          </button>
        ) : (
          <Link href={SHOP_HOME_HREF} className={shopStyles.secondaryButton}>
            Back to Shop
          </Link>
        )}

        {currentStep < 4 ? (
          <button type="button" onClick={nextStep} className={shopStyles.primaryButton}>
            Continue
          </button>
        ) : (
          <button type="submit" disabled={submitting} className={shopStyles.primaryButton}>
            {submitting ? "Sending..." : "Submit Quote Request"}
          </button>
        )}
      </div>

      <p className="mt-4 text-sm leading-6 text-slate-500">
        Quote requests are assigned directly to the Betech Solar quotation desk for follow-up and
        recommendation building.
      </p>
    </form>
  );
}
