"use client";

import { useEffect, useRef, useState } from "react";
import type { SerializedSiteVisit } from "@/lib/siteVisitShared";
import { analyseSiteAssessment } from "@/lib/siteAssessmentAnalysis";
import {
  formatSiteVisitProjectType,
  formatSiteVisitReason,
  getSiteVisitProjectProfile,
} from "@/lib/siteVisitProjectProfiles";

type UsageMode = "DAILY_HOURS" | "EVENTS_DAILY" | "EVENTS_WEEKLY" | "ALWAYS_ON";
type NumericField = number | "";
type LoadPreset = {
  key: string;
  name: string;
  watts: number;
  group: string;
  heavy?: boolean;
  alwaysOn?: boolean;
};
type Load = {
  id: number;
  kind: string;
  name: string;
  qty: NumericField;
  watts: NumericField | null;
  ratingKnown: boolean;
  usageMode: UsageMode;
  hours: NumericField;
  uses: NumericField;
  minutes: NumericField;
  period: string;
  simultaneous: NumericField;
  essential: boolean;
  design: string;
  photo: boolean;
  details: Record<string, string>;
};
type LoadProfile = Pick<
  Load,
  "usageMode" | "hours" | "uses" | "minutes" | "period" | "essential" | "design"
> & { details?: Record<string, string> };
type AssessmentAiReview = {
  summary: string;
  observations: string[];
  risks: string[];
  recommendations: string[];
  dataGaps: string[];
  kplc?: { meterId?: string; monthlyKwh?: string; monthlyBill?: string; tariff?: string; billDate?: string };
};
type CatalogProduct = {
  productName: string;
  price: number;
  productCategory: string;
  shortDescription: string | null;
  productUrl: string;
  availability: string;
};
type RecommendationType = "CATALOG_PRODUCT" | "CUSTOM_QUOTATION";

const presets: LoadPreset[] = [
  { key: "lights", name: "Lights", watts: 10, group: "Lighting" },
  { key: "tv", name: "TV", watts: 90, group: "Living and office" },
  {
    key: "fridge",
    name: "Fridge",
    watts: 150,
    group: "Kitchen",
    alwaysOn: true,
  },
  {
    key: "freezer",
    name: "Freezer",
    watts: 180,
    group: "Kitchen",
    alwaysOn: true,
  },
  { key: "microwave", name: "Microwave", watts: 1000, group: "Kitchen" },
  { key: "kettle", name: "Kettle", watts: 2000, group: "Kitchen", heavy: true },
  {
    key: "cooker",
    name: "Cooker / oven",
    watts: 3500,
    group: "Kitchen",
    heavy: true,
  },
  {
    key: "washing",
    name: "Washing machine",
    watts: 700,
    group: "Water and laundry",
  },
  {
    key: "iron",
    name: "Iron",
    watts: 1200,
    group: "Water and laundry",
    heavy: true,
  },
  {
    key: "shower",
    name: "Instant shower",
    watts: 3500,
    group: "Water and laundry",
    heavy: true,
  },
  {
    key: "water-pump",
    name: "Water pump",
    watts: 750,
    group: "Water and laundry",
  },
  {
    key: "borehole-pump",
    name: "Borehole pump",
    watts: 1500,
    group: "Water and laundry",
  },
  {
    key: "cctv",
    name: "CCTV system",
    watts: 60,
    group: "Security and connectivity",
    alwaysOn: true,
  },
  {
    key: "electric-fence",
    name: "Electric fence",
    watts: 25,
    group: "Security and connectivity",
    alwaysOn: true,
  },
  {
    key: "electric-gate",
    name: "Electric gate",
    watts: 300,
    group: "Security and connectivity",
  },
  {
    key: "wifi",
    name: "Wi-Fi / fibre ONT",
    watts: 20,
    group: "Security and connectivity",
    alwaysOn: true,
  },
  { key: "laptop", name: "Laptop", watts: 65, group: "Living and office" },
  {
    key: "desktop",
    name: "Desktop computer",
    watts: 200,
    group: "Living and office",
  },
  { key: "printer", name: "Printer", watts: 100, group: "Living and office" },
  {
    key: "ac",
    name: "Air conditioner",
    watts: 1200,
    group: "Living and office",
    heavy: true,
  },
];
const input =
  "mt-1 min-h-12 w-full rounded-xl border border-white/10 bg-slate-950 p-3 text-base text-white";
const readNumber = (value: NumericField | null) =>
  typeof value === "number" ? value : 0;
const numberOrBlank = (value: string): NumericField =>
  value === "" ? "" : Number(value);
const draftStorageKey = (visitId: string) =>
  `betech-site-assessment-draft-v3:${visitId}`;
const assessmentSteps = [
  "Project",
  "Loads",
  "Electrical",
  "Goal",
  "Roof",
  "Equipment",
  "Evidence",
  "Review",
  "Review & Complete",
] as const;
const evidenceCategories = [
  "Meter box",
  "Open main DB",
  "Earthing point",
  "Roof wide",
  "Roof material",
  "Roof horizons",
  "Inverter/battery wall",
  "Cable route",
  "KPLC bill / token",
  "Roof / installation area photos",
  "Equipment & cable route photos",
] as const;
const emptyHome = {
  bedrooms: "3",
  bedroomsOther: "",
  type: "Residential",
  units: "1",
  notes: "",
};
const emptyElectrical = {
  kplcAvailable: "Yes",
  billing: "Postpaid",
  grid: "Connected to grid",
  wiring: "Wiring complete",
  meterId: "",
  monthlyKwh: "",
  monthlyBill: "",
  tariff: "",
  billDate: "",
  billingDays: "",
  systemGoal: "Backup during outages",
  backupHours: "8",
  budget: "Not discussed",
  budgetSpecific: "",
  budgetFlexibility: "Not discussed",
};
const emptySiteDetails: Record<string, string> = {
  supplyType: "Single phase", mainBreakerRating: "63A", mainBreakerOther: "", solarBreakerSlots: "Not confirmed", earthingAvailable: "Yes", earthingCondition: "Good / visually confirmed", earthWireSize: "4mm²", earthWireOther: "", earthWireNotes: "", newEarthingRequired: "No",
  existingSystem: "No existing system",
  installationLocation: "Roof", roofType: "Corrugated iron / Mabati", roofTypeOther: "", roofCondition: "Good", roofWidth: "", roofLength: "", roofSlope: "Normal pitched roof", roofPitch: "", shading: "None", roofAccess: "Standard ladder", roofObstructions: "None", roofOrientation: "Not confirmed", panelSpace: "Yes", mountingMethod: "Direct roof mounting",
  inverterLocation: "Indoor", batteryArea: "Dry and ventilated", equipmentSpace: "Yes", mountingSurface: "Masonry/concrete wall", arrayToInverter: "0–10m", arrayToInverterExact: "", inverterToDb: "0–5m", inverterToDbExact: "", inverterToBattery: "Below 1m", inverterToBatteryExact: "", cableRoute: "Easy", cableRouteIssues: "", cableFloors: "1 / Same floor", equipmentCondition: "Suitable", equipmentConditionNote: "",
};
const defaultProjectDetails: Record<string, string> = {
  siteObjective: "New solar installation / load assessment",
  futureExpansion: "No",
  budgetFallback: "Provide multiple options",
  specialConcerns: "None",
};
const lightAreas = [
  "Living area",
  "Bedroom",
  "Kitchen",
  "Bathroom",
  "Balcony",
  "Outdoor",
  "Security",
  "Floodlight",
  "Other",
];
const lightProfiles: Record<
  string,
  { watts: number; hours: number; period: string }
> = {
  "Living area": { watts: 10, hours: 5, period: "Night" },
  Bedroom: { watts: 10, hours: 5, period: "Night" },
  Kitchen: { watts: 10, hours: 4, period: "Both" },
  Bathroom: { watts: 10, hours: 2, period: "Night" },
  Balcony: { watts: 10, hours: 6, period: "Night" },
  Outdoor: { watts: 20, hours: 10, period: "Night" },
  Security: { watts: 30, hours: 10, period: "Night" },
  Floodlight: { watts: 50, hours: 10, period: "Night" },
  Other: { watts: 10, hours: 5, period: "Night" },
};
const loadProfiles: Record<string, LoadProfile> = {
  lights: {
    usageMode: "DAILY_HOURS",
    hours: 6,
    uses: 1,
    minutes: 15,
    period: "Night",
    essential: true,
    design: "Yes",
    details: { area: "Living area", bulbType: "LED" },
  },
  tv: {
    usageMode: "DAILY_HOURS",
    hours: 5,
    uses: 1,
    minutes: 15,
    period: "Night",
    essential: true,
    design: "Yes",
  },
  fridge: {
    usageMode: "ALWAYS_ON",
    hours: 24,
    uses: 1,
    minutes: 15,
    period: "Both",
    essential: true,
    design: "Yes",
  },
  freezer: {
    usageMode: "ALWAYS_ON",
    hours: 24,
    uses: 1,
    minutes: 15,
    period: "Both",
    essential: true,
    design: "Yes",
  },
  microwave: {
    usageMode: "EVENTS_DAILY",
    hours: 0,
    uses: 3,
    minutes: 5,
    period: "Both",
    essential: false,
    design: "Daytime only",
    details: { routine: "Morning, lunch and evening" },
  },
  kettle: {
    usageMode: "EVENTS_DAILY",
    hours: 0,
    uses: 3,
    minutes: 5,
    period: "Both",
    essential: false,
    design: "Daytime only",
    details: { routine: "Morning, lunch and evening" },
  },
  cooker: {
    usageMode: "EVENTS_DAILY",
    hours: 0,
    uses: 2,
    minutes: 45,
    period: "Both",
    essential: false,
    design: "No - leave on grid",
  },
  washing: {
    usageMode: "EVENTS_WEEKLY",
    hours: 0,
    uses: 2,
    minutes: 120,
    period: "Day",
    essential: false,
    design: "Daytime only",
  },
  iron: {
    usageMode: "EVENTS_WEEKLY",
    hours: 0,
    uses: 2,
    minutes: 60,
    period: "Day",
    essential: false,
    design: "Daytime only",
  },
  shower: {
    usageMode: "EVENTS_DAILY",
    hours: 0,
    uses: 2,
    minutes: 10,
    period: "Both",
    essential: false,
    design: "No - leave on grid",
  },
  "water-pump": {
    usageMode: "DAILY_HOURS",
    hours: 1,
    uses: 1,
    minutes: 15,
    period: "Day",
    essential: true,
    design: "Yes",
  },
  "borehole-pump": {
    usageMode: "EVENTS_DAILY",
    hours: 0,
    uses: 2,
    minutes: 30,
    period: "Day",
    essential: true,
    design: "Yes",
  },
  cctv: {
    usageMode: "ALWAYS_ON",
    hours: 24,
    uses: 1,
    minutes: 15,
    period: "Both",
    essential: true,
    design: "Yes",
  },
  "electric-fence": {
    usageMode: "ALWAYS_ON",
    hours: 24,
    uses: 1,
    minutes: 15,
    period: "Both",
    essential: true,
    design: "Yes",
  },
  "electric-gate": {
    usageMode: "EVENTS_DAILY",
    hours: 0,
    uses: 10,
    minutes: 1,
    period: "Both",
    essential: true,
    design: "Backup only",
  },
  wifi: {
    usageMode: "ALWAYS_ON",
    hours: 24,
    uses: 1,
    minutes: 15,
    period: "Both",
    essential: true,
    design: "Yes",
  },
  laptop: {
    usageMode: "DAILY_HOURS",
    hours: 5,
    uses: 1,
    minutes: 15,
    period: "Day",
    essential: true,
    design: "Yes",
  },
  desktop: {
    usageMode: "DAILY_HOURS",
    hours: 6,
    uses: 1,
    minutes: 15,
    period: "Day",
    essential: true,
    design: "Yes",
  },
  printer: {
    usageMode: "EVENTS_WEEKLY",
    hours: 0,
    uses: 5,
    minutes: 5,
    period: "Day",
    essential: false,
    design: "Daytime only",
  },
  ac: {
    usageMode: "DAILY_HOURS",
    hours: 8,
    uses: 1,
    minutes: 15,
    period: "Night",
    essential: false,
    design: "No - leave on grid",
  },
};
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block min-w-0 text-sm font-semibold text-slate-200">
      {label}
      {children}
    </label>
  );
}

export default function SiteAssessmentPublicClient({
  visit,
  assessmentToken,
}: {
  visit: SerializedSiteVisit;
  assessmentToken: string;
}) {
  const assessmentRootRef = useRef<HTMLElement | null>(null);
  const storageKey = draftStorageKey(visit.id);
  const initialHome = { ...emptyHome, type: visit.propertyType || emptyHome.type };
  const [loads, setLoads] = useState<Load[]>([]);
  const [home, setHome] = useState(initialHome);
  const [electrical, setElectrical] = useState(emptyElectrical);
  const [siteDetails, setSiteDetails] = useState(emptySiteDetails);
  const [projectDetails, setProjectDetails] = useState<Record<string, string>>(defaultProjectDetails);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [aiReview, setAiReview] = useState<AssessmentAiReview | null>(null);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [aiStatus, setAiStatus] = useState<"pending" | "analysing" | "updated" | "unavailable">("pending");
  const [analysisError, setAnalysisError] = useState("");
  const [activeStep, setActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});
  const [skippedSteps, setSkippedSteps] = useState<Record<number, boolean>>({});
  const [activeLoadId, setActiveLoadId] = useState<number | null>(null);
  const [loadEditorSnapshot, setLoadEditorSnapshot] = useState<Load | null>(null);
  const [expandedLoadKinds, setExpandedLoadKinds] = useState<Record<string, boolean>>({});
  const [evidenceNames, setEvidenceNames] = useState<Record<string, string>>({});
  const [recommendationType, setRecommendationType] = useState<RecommendationType>("CATALOG_PRODUCT");
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogResults, setCatalogResults] = useState<CatalogProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const catalogInputRef = useRef<HTMLInputElement>(null);
  const [recommendationNotes, setRecommendationNotes] = useState("");
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [customerSignatureName, setCustomerSignatureName] = useState(
    visit.customerName || "",
  );
  const [customerAcceptedReport, setCustomerAcceptedReport] = useState(true);
  const [technicianSignatureName, setTechnicianSignatureName] = useState(
    visit.assignedTechnicianName || "",
  );
  const [technicianAcceptedReport, setTechnicianAcceptedReport] = useState(true);
  const [isSearchingCatalog, setIsSearchingCatalog] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [reportShared, setReportShared] = useState(Boolean(visit.assessmentReport));
  const [isRevisingReport, setIsRevisingReport] = useState(false);
  const [isSendingReport, setIsSendingReport] = useState(false);
  const [deliveryMessage, setDeliveryMessage] = useState("");
  const [deliveryError, setDeliveryError] = useState("");
  const [publishMessage, setPublishMessage] = useState(() =>
    visit.assessmentReport
      ? "This site assessment report has already been published. Open the Site Visit workspace to review the final report."
      : "",
  );
  const [publishError, setPublishError] = useState("");
  useEffect(() => {
    try {
      // Never import legacy/unscoped browser drafts. Each saved assessment is
      // bound to one SiteVisit, so one customer's loads cannot appear on
      // another customer's assessment.
      const draft = localStorage.getItem(storageKey);
      if (draft) {
        const parsed = JSON.parse(draft) as Partial<{
          visitId: string;
          loads: Load[];
          home: typeof emptyHome;
          electrical: typeof emptyElectrical;
          siteDetails: typeof emptySiteDetails;
          projectDetails: Record<string, string>;
          aiReview: AssessmentAiReview;
          activeStep: number;
          completedSteps: Record<number, boolean>;
          skippedSteps: Record<number, boolean>;
          evidenceNames: Record<string, string>;
          expandedLoadKinds: Record<string, boolean>;
          recommendationType: RecommendationType;
          selectedProduct: CatalogProduct;
          recommendationNotes: string;
          tiktokUrl: string;
          customerSignatureName: string;
          customerAcceptedReport: boolean;
          technicianSignatureName: string;
          technicianAcceptedReport: boolean;
        }>;
        if (parsed.visitId === visit.id) {
          if (parsed.loads) setLoads(parsed.loads);
          if (parsed.home) setHome({ ...emptyHome, ...parsed.home });
          if (parsed.electrical)
            setElectrical({ ...emptyElectrical, ...parsed.electrical });
          if (parsed.siteDetails)
            setSiteDetails({ ...emptySiteDetails, ...parsed.siteDetails });
          if (parsed.projectDetails) setProjectDetails({ ...defaultProjectDetails, ...parsed.projectDetails });
          if (parsed.aiReview) setAiReview(parsed.aiReview);
          if (typeof parsed.activeStep === "number")
            setActiveStep(Math.min(assessmentSteps.length - 1, Math.max(0, parsed.activeStep)));
          if (parsed.completedSteps) setCompletedSteps(parsed.completedSteps);
          if (parsed.skippedSteps) setSkippedSteps(parsed.skippedSteps);
          if (parsed.evidenceNames) setEvidenceNames(parsed.evidenceNames);
          if (parsed.expandedLoadKinds)
            setExpandedLoadKinds(parsed.expandedLoadKinds);
          if (parsed.recommendationType) setRecommendationType(parsed.recommendationType);
          if (parsed.selectedProduct) setSelectedProduct(parsed.selectedProduct);
          if (parsed.recommendationNotes) setRecommendationNotes(parsed.recommendationNotes);
          if (parsed.tiktokUrl) setTiktokUrl(parsed.tiktokUrl);
          if (parsed.customerSignatureName)
            setCustomerSignatureName(parsed.customerSignatureName);
          if (typeof parsed.customerAcceptedReport === "boolean")
            setCustomerAcceptedReport(parsed.customerAcceptedReport);
          if (parsed.technicianSignatureName)
            setTechnicianSignatureName(parsed.technicianSignatureName);
          if (typeof parsed.technicianAcceptedReport === "boolean")
            setTechnicianAcceptedReport(parsed.technicianAcceptedReport);
        }
      }
    } catch {
      localStorage.removeItem(storageKey);
    } finally {
      setDraftLoaded(true);
    }
  }, [storageKey, visit.id]);
  useEffect(() => {
    if (draftLoaded)
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          visitId: visit.id,
          loads,
          home,
          electrical,
          siteDetails,
          projectDetails,
          aiReview,
          activeStep,
          completedSteps,
          skippedSteps,
          evidenceNames,
          expandedLoadKinds,
          recommendationType,
          selectedProduct,
          recommendationNotes,
          tiktokUrl,
          customerSignatureName,
          customerAcceptedReport,
          technicianSignatureName,
          technicianAcceptedReport,
        }),
      );
  }, [
    activeStep,
    aiReview,
    completedSteps,
    draftLoaded,
    electrical,
    home,
    loads,
    siteDetails,
    projectDetails,
    skippedSteps,
    evidenceNames,
    expandedLoadKinds,
    recommendationNotes,
    recommendationType,
    selectedProduct,
    storageKey,
    tiktokUrl,
    customerSignatureName,
    customerAcceptedReport,
    technicianSignatureName,
    technicianAcceptedReport,
    visit.id,
  ]);
  const clearDraft = () => {
    if (!window.confirm("Clear the saved site-assessment draft from this device? This cannot be undone.")) return;
    setLoads([]);
    setHome(initialHome);
    setElectrical(emptyElectrical);
    setSiteDetails(emptySiteDetails);
    setProjectDetails(defaultProjectDetails);
    setAiReview(null);
    setActiveStep(0);
    setCompletedSteps({});
    setSkippedSteps({});
    setActiveLoadId(null);
    setLoadEditorSnapshot(null);
    setExpandedLoadKinds({});
    setEvidenceNames({});
    setRecommendationType("CATALOG_PRODUCT");
    setCatalogQuery("");
    setCatalogResults([]);
    setSelectedProduct(null);
    setRecommendationNotes("");
    setTiktokUrl("");
    setCustomerSignatureName(visit.customerName || "");
    setCustomerAcceptedReport(true);
    setTechnicianSignatureName(visit.assignedTechnicianName || "");
    setTechnicianAcceptedReport(true);
    localStorage.removeItem(storageKey);
  };
  const openLoad = (load: Load) => {
    setLoadEditorSnapshot(structuredClone(load));
    setActiveLoadId(load.id);
    setActiveStep(1);
    setExpandedLoadKinds((current) => ({ ...current, [load.kind]: true }));
    window.setTimeout(() => {
      document.getElementById(`assessment-load-${load.id}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  };
  const finishLoad = () => {
    setActiveLoadId(null);
    setLoadEditorSnapshot(null);
  };
  const cancelLoad = () => {
    if (loadEditorSnapshot) {
      setLoads((current) =>
        current.map((load) =>
          load.id === loadEditorSnapshot.id ? loadEditorSnapshot : load,
        ),
      );
    } else if (activeLoadId !== null) {
      setLoads((current) => current.filter((load) => load.id !== activeLoadId));
    }
    finishLoad();
  };
  const add = (preset: LoadPreset) => {
    const id = Date.now();
    const profile = loadProfiles[preset.key];
    setLoads((current) => [
      ...current,
      {
        id,
        kind: preset.key,
        name: preset.name,
        qty: 1,
        watts: preset.watts,
        ratingKnown: true,
        usageMode: profile.usageMode,
        hours: profile.hours,
        uses: profile.uses,
        minutes: profile.minutes,
        period: profile.period,
        simultaneous: 1,
        essential: profile.essential,
        design: profile.design,
        photo: false,
        details: { ...(profile.details || {}), ratingSource: "Default appliance profile" },
      },
    ]);
    setLoadEditorSnapshot(null);
    setActiveLoadId(id);
    setExpandedLoadKinds((current) => ({ ...current, [preset.key]: true }));
    window.setTimeout(() => {
      document.getElementById(`assessment-load-${id}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  };
  const addUnknown = () => {
    const id = Date.now();
    setLoads((current) => [
      ...current,
      {
        id,
        kind: "unknown",
        name: "Unknown equipment",
        qty: 1,
        watts: null,
        ratingKnown: false,
        usageMode: "DAILY_HOURS",
        hours: 1,
        uses: 1,
        minutes: 15,
        period: "Both",
        simultaneous: 1,
        essential: false,
        design: "Yes",
        photo: false,
        details: { ratingSource: "Unknown / needs nameplate" },
      },
    ]);
    setLoadEditorSnapshot(null);
    setActiveLoadId(id);
    setExpandedLoadKinds((current) => ({ ...current, unknown: true }));
    window.setTimeout(() => {
      document.getElementById(`assessment-load-${id}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  };
  const addAnotherLoad = (kind: string) => {
    const preset = presets.find((item) => item.key === kind);
    if (preset) {
      add(preset);
      return;
    }
    addUnknown();
  };
  const edit = (id: number, patch: Partial<Load>) =>
    setLoads((current) =>
      current.map((load) => (load.id === id ? { ...load, ...patch } : load)),
    );
  const detail = (load: Load, key: string, value: string) =>
    edit(load.id, { details: { ...load.details, [key]: value } });
  const setSiteDetail = (key: string, value: string) =>
    setSiteDetails((current) => ({ ...current, [key]: value }));
  const setProjectDetail = (key: string, value: string) =>
    setProjectDetails((current) => ({ ...current, [key]: value }));
  const projectProfile = getSiteVisitProjectProfile(visit.projectType);
  const analysis = analyseSiteAssessment({
    loads,
    electrical,
    siteDetails,
    evidenceNames,
    selectedProduct: selectedProduct ? { ...selectedProduct, shortDescription: selectedProduct.shortDescription } : null,
  });
  const loadWh = (load: Load) =>
    (analysis.loads.find((item) => item.id === load.id)?.energyKwh || 0) * 1000;
  const connected = analysis.connectedKw * 1000;
  const daily = analysis.dailyKwh * 1000;
  const unknown = loads.filter((load) => !load.ratingKnown).length;
  const solarLoads = analysis.loads.filter(
    (load) => !String(load.design || "").toLowerCase().includes("leave on grid"),
  );
  const continuous = analysis.continuousKw * 1000;
  const simultaneousPeak = analysis.simultaneousPeakKw * 1000;
  const largestMotor = analysis.inverterRequiredKw > analysis.simultaneousPeakKw * 1.25;
  const systemEnergyWh = analysis.rawBackupEnergyKwh * 1000;
  const backupHours = Number(electrical.backupHours) || 8;
  const inverterKw = analysis.inverterKw;
  const recommendedBatteryKwh = analysis.batteryKwh;
  const batteryRecommendation = `${analysis.batteryKwh.toFixed(2)} kWh`;
  const pvKw = analysis.pvCalculatedKwp;
  const panelCount = analysis.panelCount;
  const assessmentPayload = () => ({
    loads,
    home,
    electrical,
    siteDetails,
    project: {
      projectType: visit.projectType,
      projectTypeLabel: formatSiteVisitProjectType(visit.projectType),
      visitReason: visit.visitReason,
      visitReasonLabel: formatSiteVisitReason(visit.visitReason),
      customerRequirements: visit.customerRequirements,
      propertyType: visit.propertyType,
      details: projectDetails,
    },
    evidenceNames,
    sizingAssumptions: analysis.assumptions,
    sizingValidation: {
      confidence: analysis.sizingConfidence,
      confidenceScore: analysis.confidenceScore,
      result: analysis.assessmentResult,
      criticalReadinessIssues: analysis.criticalReadinessIssues,
    },
    calculation: {
      connectedKw: connected / 1000,
      dailyKwh: daily / 1000,
      continuousKw: analysis.continuousKw,
      simultaneousPeakKw: analysis.simultaneousPeakKw,
      surgeRequirementKw: analysis.surgeRequirementKw,
      inverterKw,
      batteryRecommendation,
      batteryKwh: analysis.batteryKwh,
      pvKw,
      panelCount,
      panelWatts: analysis.panelWatts,
    },
  });
  const evidenceFiles = () =>
    Array.from(
      assessmentRootRef.current?.querySelectorAll<HTMLInputElement>(
        'input[type="file"]',
      ) || [],
    )
      .flatMap((element) => Array.from(element.files || []))
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, 8);
  const analyseAssessment = async () => {
    if (!loads.length || isAnalysing) return;
    setIsAnalysing(true);
    setAiStatus("analysing");
    setAnalysisError("");
    try {
      const form = new FormData();
      form.set("token", assessmentToken);
      form.set("assessment", JSON.stringify(assessmentPayload()));
      evidenceFiles().forEach((file) => form.append("photos", file));
      const response = await fetch("/api/site-assessment/analyze", {
        method: "POST",
        body: form,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.review)
        throw new Error(
          data?.error || "Assessment analysis could not be completed.",
        );
      const review = data.review as AssessmentAiReview;
      setAiReview(review);
      if (review.kplc) {
        setElectrical((current) => ({
          ...current,
          meterId: current.meterId || review.kplc?.meterId || "",
          monthlyKwh: current.monthlyKwh || review.kplc?.monthlyKwh || "",
          monthlyBill: current.monthlyBill || review.kplc?.monthlyBill || "",
          tariff: current.tariff || review.kplc?.tariff || "",
          billDate: current.billDate || review.kplc?.billDate || "",
        }));
      }
      setRecommendationNotes((current) => current || [review.summary, ...review.recommendations.slice(0, 2)].join(" "));
      setAiStatus("updated");
    } catch (error) {
      setAnalysisError(
        error instanceof Error
          ? error.message
          : "Assessment analysis could not be completed.",
      );
      setAiStatus("unavailable");
    } finally {
      setIsAnalysing(false);
    }
  };
  useEffect(() => {
    if (!draftLoaded || !loads.length || reportShared) return;
    setAiStatus("pending");
    const timeout = window.setTimeout(() => {
      void analyseAssessment();
    }, 1400);
    return () => window.clearTimeout(timeout);
    // Assessment changes are intentionally the trigger: save/edit freely while
    // a single debounced review is prepared in the background.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftLoaded, loads, home, electrical, siteDetails, projectDetails, evidenceNames, selectedProduct, reportShared]);
  useEffect(() => {
    if (activeStep === 8 && recommendationType === "CATALOG_PRODUCT" && !selectedProduct && !catalogQuery && projectProfile.usesLoadSizing) {
      setCatalogQuery(`SRNE ${inverterKw}kW lithium solar kit`);
    }
  }, [activeStep, catalogQuery, inverterKw, projectProfile.usesLoadSizing, recommendationType, selectedProduct]);
  useEffect(() => {
    const query = catalogQuery.trim();
    if (
      selectedProduct ||
      query.length < 2 ||
      recommendationType !== "CATALOG_PRODUCT"
    ) {
      setCatalogResults([]);
      setCatalogError("");
      setIsSearchingCatalog(false);
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsSearchingCatalog(true);
      setCatalogError("");
      try {
        const response = await fetch("/api/site-assessment/catalog-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: assessmentToken, query }),
          signal: controller.signal,
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || "Could not search the Betech catalog.");
        const products = (data?.products || []) as CatalogProduct[];
        setCatalogResults(products);
        if (!products.length) setCatalogError("No suitable live catalog product was found. Choose Custom quotation instead.");
      } catch (error) {
        if ((error as { name?: string })?.name !== "AbortError") {
          setCatalogError(error instanceof Error ? error.message : "Could not search the Betech catalog.");
        }
      } finally {
        if (!controller.signal.aborted) setIsSearchingCatalog(false);
      }
    }, 300);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [assessmentToken, catalogQuery, recommendationType, selectedProduct]);
  const selectCatalogProduct = (product: CatalogProduct) => {
    setSelectedProduct(product);
    setCatalogQuery("");
    setCatalogResults([]);
    setCatalogError("");
  };
  const changeCatalogProduct = () => {
    setSelectedProduct(null);
    setCatalogQuery("");
    setCatalogResults([]);
    setCatalogError("");
    window.requestAnimationFrame(() => catalogInputRef.current?.focus());
  };
  const signaturesComplete =
    customerSignatureName.trim().length >= 2 &&
    customerAcceptedReport &&
    technicianSignatureName.trim().length >= 2 &&
    technicianAcceptedReport;
  const beginReportRevision = () => {
    const published = visit.assessmentReport;
    if (!published || !window.confirm("Open this assessment for revision? The existing report will be replaced only when you generate the revised report.")) return;
    const saved = published.assessment as {
      loads?: Load[];
      home?: typeof emptyHome;
      electrical?: typeof emptyElectrical;
      siteDetails?: typeof emptySiteDetails;
      projectDetails?: Record<string, string>;
    };
    if (Array.isArray(saved.loads)) setLoads(saved.loads);
    if (saved.home) setHome({ ...emptyHome, ...saved.home });
    if (saved.electrical) setElectrical({ ...emptyElectrical, ...saved.electrical });
    if (saved.siteDetails) setSiteDetails({ ...emptySiteDetails, ...saved.siteDetails });
    if (saved.projectDetails) setProjectDetails({ ...defaultProjectDetails, ...saved.projectDetails });
    setRecommendationType(published.recommendation.type);
    setSelectedProduct(
      published.recommendation.type === "CATALOG_PRODUCT" &&
        published.recommendation.productName &&
        published.recommendation.productUrl
        ? {
            productName: published.recommendation.productName,
            productUrl: published.recommendation.productUrl,
            price: published.recommendation.productPrice || 0,
            productCategory: published.recommendation.productCategory || "Betech system",
            shortDescription: published.recommendation.productShortDescription || null,
            availability: "Previously selected Betech system",
          }
        : null,
    );
    setRecommendationNotes(published.recommendation.notes || "");
    setTiktokUrl(published.recommendation.tiktokUrl || "");
    setCustomerSignatureName(published.signatures?.customerName || visit.customerName || "");
    setCustomerAcceptedReport(Boolean(published.signatures?.customerAccepted));
    setTechnicianSignatureName(visit.assignedTechnicianName || published.signatures?.technicianName || "");
    setTechnicianAcceptedReport(Boolean(published.signatures?.technicianAccepted));
    setIsRevisingReport(true);
    setPublishMessage("");
    setPublishError("");
    setDeliveryMessage("");
    setDeliveryError("");
    setActiveStep(8);
    window.requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }));
  };
  const sendPublishedReport = async () => {
    if (isSendingReport || !reportShared || isRevisingReport) return;
    setIsSendingReport(true);
    setDeliveryError("");
    setDeliveryMessage("");
    try {
      const response = await fetch("/api/site-assessment/send-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: assessmentToken }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "The report could not be sent to the customer.");
      setDeliveryMessage("The current report has been sent to the customer by SMS and, where available, email.");
    } catch (error) {
      setDeliveryError(error instanceof Error ? error.message : "The report could not be sent to the customer.");
    } finally {
      setIsSendingReport(false);
    }
  };
  const publishReport = async () => {
    if (isPublishing || !loads.length) return;
    if (recommendationType === "CATALOG_PRODUCT" && !selectedProduct) {
      setPublishError("Search and select a Betech catalog product, or choose Custom quotation.");
      return;
    }
    if (recommendationType === "CATALOG_PRODUCT" && analysis.productMatch.status !== "PASS") {
      setPublishError("This catalog product cannot yet be validated against the recorded inverter, battery and PV requirements. Choose Custom quotation or select a fully suitable system.");
      return;
    }
    if (!signaturesComplete) {
      setPublishError(
        "The customer and technician must both complete the final electronic sign-off before the report can be shared.",
      );
      return;
    }
    setIsPublishing(true);
    setPublishError("");
    setPublishMessage("");
    try {
      const form = new FormData();
      form.set("token", assessmentToken);
      form.set("revision", String(isRevisingReport));
      form.set("report", JSON.stringify({
        assessment: assessmentPayload(),
        aiReview,
        recommendation: {
          type: recommendationType,
          ...(selectedProduct && recommendationType === "CATALOG_PRODUCT"
            ? {
                productName: selectedProduct.productName,
                productUrl: selectedProduct.productUrl,
                productPrice: selectedProduct.price,
                productCategory: selectedProduct.productCategory,
                productShortDescription: selectedProduct.shortDescription,
              }
            : {}),
          notes: recommendationNotes.trim() || undefined,
          tiktokUrl: tiktokUrl.trim() || undefined,
        },
        signatures: {
          customerName: customerSignatureName.trim(),
          customerAccepted: customerAcceptedReport,
          technicianName: technicianSignatureName.trim(),
          technicianAccepted: technicianAcceptedReport,
        },
        calculation: {
          connectedKw: connected / 1000,
          dailyKwh: daily / 1000,
          inverterKw,
          batteryKwh: recommendedBatteryKwh,
          pvKw,
          panelCount,
        },
      }));
      evidenceFiles().forEach((file) => form.append("photos", file));
      const response = await fetch("/api/site-assessment/submit", { method: "POST", body: form });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Could not publish the site assessment report.");
      localStorage.removeItem(storageKey);
      setReportShared(true);
      setIsRevisingReport(false);
      setPublishMessage("Report shared. The customer has been notified by SMS and, when an email address is available, by email with the PDF attached.");
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : "Could not publish the site assessment report.");
    } finally {
      setIsPublishing(false);
    }
  };
  const groups = Array.from(new Set(presets.map((preset) => preset.group))).map(
    (group) => ({
      group,
      items: presets.filter((preset) => preset.group === group),
    }),
  );
  const loadGroups = Array.from(new Set(loads.map((load) => load.kind))).map(
    (kind) => ({
      kind,
      name: presets.find((preset) => preset.key === kind)?.name ||
        loads.find((load) => load.kind === kind)?.name ||
        "Unknown equipment",
      loads: loads
        .map((load, index) => ({ load, index }))
        .filter(({ load }) => load.kind === kind),
    }),
  );
  const changeStep = (nextStep: number, state?: "complete" | "skip") => {
    if (state === "complete") {
      setCompletedSteps((current) => ({ ...current, [activeStep]: true }));
      setSkippedSteps((current) => {
        const next = { ...current };
        delete next[activeStep];
        return next;
      });
    }
    if (state === "skip") {
      setSkippedSteps((current) => ({ ...current, [activeStep]: true }));
      setCompletedSteps((current) => {
        const next = { ...current };
        delete next[activeStep];
        return next;
      });
    }
    setActiveLoadId(null);
    setActiveStep(Math.min(assessmentSteps.length - 1, Math.max(0, nextStep)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const stepStatus = (index: number) =>
    skippedSteps[index]
      ? "NOT ASSESSED"
      : completedSteps[index]
        ? "COMPLETE"
        : "IN PROGRESS";
  return (
    <main
      ref={assessmentRootRef}
      className="min-h-screen min-w-0 bg-slate-950 p-3 text-slate-100 sm:p-5"
    >
      <div className="mx-auto max-w-4xl space-y-4 sm:space-y-5">
        <header className="rounded-2xl bg-cyan-400 p-5 text-slate-950 sm:rounded-3xl sm:p-6">
          <b className="text-xs uppercase tracking-widest">
            Betech Solar Solutions
          </b>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">Field Site Assessment</h1>
          <p className="break-words text-sm sm:text-base">
            {visit.visitRef} · {visit.customerName}
          </p>
        </header>
        <WizardProgress
          activeStep={activeStep}
          completedSteps={completedSteps}
          skippedSteps={skippedSteps}
          onStepSelect={(index) => changeStep(index)}
        />
        <div className="flex flex-col items-stretch gap-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-3 text-sm text-cyan-100 sm:flex-row sm:items-center sm:justify-between">
          <span className="min-w-0 break-words">
            {draftLoaded
              ? "Assessment details save automatically on this device."
              : "Loading saved assessment..."}
          </span>
          <button
            type="button"
            onClick={clearDraft}
            className="min-h-11 w-full rounded-lg border border-rose-300/50 px-3 py-2 font-bold text-rose-200 touch-manipulation sm:w-auto"
          >
            Clear saved draft
          </button>
        </div>
        <div hidden={activeStep !== 0}>
        <section className="rounded-2xl bg-slate-900 p-4 sm:rounded-3xl sm:p-5">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">{formatSiteVisitProjectType(visit.projectType)} · {formatSiteVisitReason(visit.visitReason)}</p>
          <h2 className="mt-1 text-xl font-bold">{projectProfile.title}</h2>
          <p className="mt-1 text-sm text-slate-400">
            {projectProfile.introduction}
          </p>
          {visit.customerRequirements ? (
            <div className="mt-4 rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-3 text-sm leading-6 text-cyan-100">
              <b>Customer request:</b> {visit.customerRequirements}
            </div>
          ) : null}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {projectProfile.fields.map((field) => (
              <Field key={field.key} label={field.label}>
                {field.type === "textarea" ? (
                  <textarea
                    className={`${input} min-h-28`}
                    value={projectDetails[field.key] || ""}
                    onChange={(event) => setProjectDetail(field.key, event.target.value)}
                    placeholder={field.placeholder}
                  />
                ) : (
                  <input
                    className={input}
                    type={field.type || "text"}
                    min={field.type === "number" ? "0" : undefined}
                    value={projectDetails[field.key] || ""}
                    onChange={(event) => setProjectDetail(field.key, event.target.value)}
                    placeholder={field.placeholder}
                  />
                )}
              </Field>
            ))}
          </div>
          {projectProfile.usesLoadSizing ? <div className="mt-6 border-t border-white/10 pt-5">
            <h3 className="text-base font-bold">Site objective / technician observations</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Main site objective">
                <select className={input} value={projectDetails.siteObjective || "New solar installation / load assessment"} onChange={(event) => setProjectDetail("siteObjective", event.target.value)}>
                  <option>New solar installation / load assessment</option><option>Upgrade existing solar system</option><option>Increase battery backup</option><option>Increase solar generation / add panels</option><option>Replace inverter or battery</option><option>Convert to full off-grid</option><option>Hybrid solar + grid system</option><option>Reduce electricity bill / daytime solar</option><option>Backup for essential loads only</option><option>Investigate poor system performance</option><option>Fault diagnosis / repair</option><option>Relocate or modify existing system</option><option>Assess roof/ground space for panels</option><option>Other</option>
                </select>
              </Field>
              <Field label="Existing solar / backup system"><select className={input} value={siteDetails.existingSystem} onChange={(event) => setSiteDetail("existingSystem", event.target.value)}><option>No existing system</option><option>Yes</option><option>Partially installed</option><option>Unknown</option></select></Field>
              {projectDetails.siteObjective === "Other" ? <Field label="Other objective details"><input className={input} value={projectDetails.siteObjectiveOther || ""} onChange={(event) => setProjectDetail("siteObjectiveOther", event.target.value)} placeholder="Describe the objective" /></Field> : null}
              <Field label="Technician observations (optional)"><textarea className={`${input} min-h-24`} value={projectDetails.technicianObservations || ""} onChange={(event) => setProjectDetail("technicianObservations", event.target.value)} placeholder="Record only details that affect the recommendation." /></Field>
            </div>
          </div> : null}
          <div className="mt-6 border-t border-white/10 pt-5">
          <h3 className="text-base font-bold">Property and site context</h3>
          <p className="mt-1 text-sm text-slate-400">Record the building or site scale before inspecting equipment and access.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Property type">
              <select
                className={input}
                value={home.type}
                onChange={(event) =>
                  setHome({ ...home, type: event.target.value })
                }
              >
                <option>Residential</option>
                <option>Commercial</option>
                <option>Farm</option>
                <option>Institution</option>
                <option>Industrial</option>
                <option>Other</option>
              </select>
            </Field>
            <Field label={visit.projectType === "SOLAR_HOME_SYSTEM" ? "Number of bedrooms" : "Building units / floors / sections"}>
              {visit.projectType === "SOLAR_HOME_SYSTEM" ? <select className={input} value={home.bedrooms} onChange={(event) => setHome({ ...home, bedrooms: event.target.value })}><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option><option>6</option><option>10</option><option>Other</option></select> : <input className={input} type="number" min="0" value={home.bedrooms} onChange={(event) => setHome({ ...home, bedrooms: event.target.value })} />}
            </Field>
            {visit.projectType === "SOLAR_HOME_SYSTEM" && home.bedrooms === "Other" ? <Field label="Actual bedroom count"><input className={input} value={home.bedroomsOther || ""} onChange={(event) => setHome({ ...home, bedroomsOther: event.target.value })} /></Field> : null}
            <Field label="Consumer units / distribution boards">
              <input
                className={input}
                type="number"
                min="1"
                value={home.units}
                onChange={(event) =>
                  setHome({ ...home, units: event.target.value })
                }
              />
            </Field>
          </div>
          </div>
        </section>
        </div>
        <div hidden={activeStep !== 1}>
        <section className="rounded-2xl bg-slate-900 p-4 sm:rounded-3xl sm:p-5">
          <h2 className="text-xl font-bold">Add customer loads</h2>
          <p className="mt-1 text-sm text-slate-400">
            Add each appliance, then save its technical details into a compact
            load card. Only the load you are editing is expanded.
          </p>
          {groups.map(({ group, items }) => (
            <div key={group} className="mt-5">
              <h3 className="text-sm font-black uppercase tracking-wider text-cyan-300">
                {group}
              </h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {items.map((preset) => {
                  return (
                    <button
                      type="button"
                      key={preset.key}
                      onClick={() => add(preset)}
                      className="min-h-11 rounded-full border border-cyan-400/40 px-3 py-2 text-sm font-bold touch-manipulation"
                    >
                      + {preset.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addUnknown}
            className="mt-5 min-h-11 rounded-full bg-white/10 px-4 py-3 touch-manipulation"
          >
            + Unknown equipment
          </button>
          <div className="mt-5 grid gap-3">
            {loadGroups.map((group) => (
              <section key={group.kind} className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/45">
                <div className="flex flex-col items-stretch gap-2 p-2 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={() => setExpandedLoadKinds((current) => ({
                      ...current,
                      [group.kind]: !current[group.kind],
                    }))}
                    className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-3 rounded-xl p-2 text-left touch-manipulation hover:bg-white/5"
                    aria-expanded={Boolean(expandedLoadKinds[group.kind])}
                  >
                    <span className="min-w-0 break-words font-black text-cyan-100">
                      {expandedLoadKinds[group.kind] ? "⌄" : "›"} {group.name}{" "}
                      <span className="text-sm text-slate-400">({group.loads.length})</span>
                    </span>
                    <span className="text-xs font-bold text-slate-400">
                      {expandedLoadKinds[group.kind] ? "Hide" : "View loads"}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => addAnotherLoad(group.kind)}
                    className="min-h-11 w-full rounded-xl border border-cyan-400/30 px-3 py-2 text-sm font-bold text-cyan-100 touch-manipulation hover:bg-cyan-400/10 sm:w-auto"
                  >
                    + Add another {group.name}
                  </button>
                </div>
                <div hidden={!expandedLoadKinds[group.kind]} className="border-t border-white/10 p-3">
                  <div className="grid gap-3">
                    {group.loads.map(({ load, index }) => (
                      <div key={load.id}>
                        <LoadSummaryCard
                          load={load}
                          index={index}
                          dailyWh={loadWh(load)}
                          onEdit={() => openLoad(load)}
                          onRemove={() =>
                            setLoads((current) => current.filter((item) => item.id !== load.id))
                          }
                        />
                        <LoadCard
                          load={load}
                          index={index}
                          isOpen={activeLoadId === load.id}
                          edit={edit}
                          detail={detail}
                          onCancel={cancelLoad}
                          onSave={finishLoad}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            ))}
          </div>
          <div className="mt-5 rounded-2xl border border-cyan-400/30 bg-cyan-400/5 p-4">
            <b className="text-cyan-100">Load summary</b>
            <p className="mt-2 text-sm text-slate-200">
              {loads.length} loads | {(connected / 1000).toFixed(2)} kW connected | {(daily / 1000).toFixed(2)} kWh/day | {unknown} unknown ratings
            </p>
          </div>
        </section>
        </div>
        <div hidden={activeStep !== 2}>
        <Section title="KPLC supply / electricity bill and electrical safety">
          <Field label="KPLC supply available?">
            <select className={input} value={electrical.kplcAvailable} onChange={(event) => setElectrical({ ...electrical, kplcAvailable: event.target.value })}>
              <option>Yes</option><option>No</option>
            </select>
          </Field>
          <Field label="Meter and billing">
            <select
              className={input}
              value={electrical.billing}
              onChange={(event) =>
                setElectrical({ ...electrical, billing: event.target.value })
              }
            >
              <option>Postpaid</option>
              <option>Prepaid</option>
              <option>Not sure</option>
            </select>
          </Field>
          <Field label="Grid connection status">
            <select
              className={input}
              value={electrical.grid}
              onChange={(event) =>
                setElectrical({ ...electrical, grid: event.target.value })
              }
            >
              <option>Connected to grid</option>
              <option>Grid nearby, not connected</option>
              <option>No grid connection</option>
              <option>Grid status unknown</option>
            </select>
          </Field>
          <Field label="Existing house wiring">
            <select
              className={input}
              value={electrical.wiring}
              onChange={(event) =>
                setElectrical({ ...electrical, wiring: event.target.value })
              }
            >
              <option>Wiring complete</option>
              <option>Partially wired</option>
              <option>Not wired yet</option>
              <option>Wiring needs inspection</option>
            </select>
          </Field>
          <Field label="Supply type">
            <select className={input} value={siteDetails.supplyType} onChange={(event) => setSiteDetail("supplyType", event.target.value)}>
              <option>Single phase</option>
              <option>Three phase</option>
              <option>Not confirmed</option>
            </select>
          </Field>
          <Field label="Main breaker rating (A)">
            <select className={input} value={siteDetails.mainBreakerRating} onChange={(event) => setSiteDetail("mainBreakerRating", event.target.value)}>
              <option>20A</option><option>32A</option><option>40A</option><option>50A</option><option>63A</option><option>80A</option><option>100A</option><option>125A</option><option>Other</option>
            </select>
          </Field>
          {siteDetails.mainBreakerRating === "Other" ? <Field label="Actual main breaker rating"><input className={input} value={siteDetails.mainBreakerOther} onChange={(event) => setSiteDetail("mainBreakerOther", event.target.value)} /></Field> : null}
          <Field label="Available solar breaker slots">
            <select className={input} value={siteDetails.solarBreakerSlots} onChange={(event) => setSiteDetail("solarBreakerSlots", event.target.value)}><option>Not confirmed</option><option>None</option><option>1</option><option>2</option><option>3</option><option>4+</option></select>
          </Field>
          <Field label="Earthing available?"><select className={input} value={siteDetails.earthingAvailable} onChange={(event) => setSiteDetail("earthingAvailable", event.target.value)}><option>Yes</option><option>No</option><option>Not confirmed</option></select></Field>
          {siteDetails.earthingAvailable === "No" ? <Field label="New earthing required"><select className={input} value={siteDetails.newEarthingRequired} onChange={(event) => setSiteDetail("newEarthingRequired", event.target.value)}><option>Yes</option><option>No</option></select></Field> : null}
          <Field label="Earthing condition">
            <select className={input} value={siteDetails.earthingCondition} onChange={(event) => setSiteDetail("earthingCondition", event.target.value)}>
              <option>Good / visually confirmed</option><option>Needs improvement</option><option>Poor / damaged</option><option>New earthing required</option><option>Not confirmed</option>
            </select>
          </Field>
          <Field label="Earth wire size">
            <select className={input} value={siteDetails.earthWireSize} onChange={(event) => setSiteDetail("earthWireSize", event.target.value)}><option>2.5mm²</option><option>4mm²</option><option>6mm²</option><option>10mm²</option><option>16mm²</option><option>Other</option><option>Not confirmed</option></select>
          </Field>
          {siteDetails.earthWireSize === "Other" ? <Field label="Actual earth wire size"><input className={input} value={siteDetails.earthWireOther} onChange={(event) => setSiteDetail("earthWireOther", event.target.value)} /></Field> : null}
          <Field label="Earthing notes (optional)"><input className={input} value={siteDetails.earthWireNotes} onChange={(event) => setSiteDetail("earthWireNotes", event.target.value)} /></Field>
          {electrical.kplcAvailable === "Yes" && (
            <>
              <Field
                label={
                  electrical.billing === "Postpaid"
                    ? "KPLC account number or meter number"
                    : "KPLC meter number or account number"
                }
              >
                <input
                  className={input}
                  value={electrical.meterId}
                  onChange={(event) =>
                    setElectrical({
                      ...electrical,
                      meterId: event.target.value,
                    })
                  }
                  placeholder="Enter the identifier printed on the bill or meter"
                />
              </Field>
              <Field label="Tariff category (optional)">
                <input
                  className={input}
                  value={electrical.tariff}
                  onChange={(event) =>
                    setElectrical({ ...electrical, tariff: event.target.value })
                  }
                  placeholder="Example: Domestic Ordinary (DC3)"
                />
              </Field>
              <Field label="Bill date (optional)"><input className={input} type="date" value={electrical.billDate} onChange={(event) => setElectrical({ ...electrical, billDate: event.target.value })} /></Field>
              <Field label="Billing period days (optional)"><input className={input} type="number" min="1" max="90" value={electrical.billingDays || ""} onChange={(event) => setElectrical({ ...electrical, billingDays: event.target.value })} placeholder="Defaults to 30 days" /></Field>
              <Field label={`📷 Take photo / upload latest ${electrical.billing === "Prepaid" ? "token or SMS" : "KPLC bill"}`}>
                <input
                  className={input}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) setEvidenceNames((current) => ({ ...current, ["KPLC bill / token"]: file.name || "KPLC image captured" }));
                  }}
                />
              </Field>
              <Field label={electrical.billing === "Prepaid" ? "Typical monthly units purchased (kWh), if known" : "Latest monthly consumption (kWh)"}>
                <input
                  className={input}
                  type="number"
                  min="0"
                  value={electrical.monthlyKwh}
                  onChange={(event) =>
                    setElectrical({
                      ...electrical,
                      monthlyKwh: event.target.value,
                    })
                  }
                  placeholder="Example: 111"
                />
              </Field>
              <Field label={electrical.billing === "Prepaid" ? "Approx. monthly token spend (KES)" : "Approx. monthly electricity spend (KES)"}>
                <input
                  className={input}
                  type="number"
                  min="0"
                  value={electrical.monthlyBill}
                  onChange={(event) =>
                    setElectrical({
                      ...electrical,
                      monthlyBill: event.target.value,
                    })
                  }
                  placeholder="Example: 3141"
                />
              </Field>
              <div className="sm:col-span-2">
                <p className="text-sm font-semibold text-slate-200">Quick monthly spend</p>
                <div className="mt-2 flex flex-wrap gap-2">{[["KSh 1–3K", "2000"], ["KSh 3–5K", "4000"], ["KSh 5–10K", "7500"], ["KSh 10–20K", "15000"], ["KSh 20K+", "20000"]].map(([label, value]) => <button key={label} type="button" onClick={() => setElectrical({ ...electrical, monthlyBill: value })} className="rounded-full border border-cyan-400/40 px-3 py-2 text-sm font-bold text-cyan-100">{label}</button>)}</div>
              </div>
            </>
          )}
        </Section>
        </div>
        <div hidden={activeStep !== 3}>
        <Section title="Customer energy goal and budget">
          <Field label="What does the customer want the solar system to do?">
            <select
              className={input}
              value={electrical.systemGoal}
              onChange={(event) =>
                setElectrical({ ...electrical, systemGoal: event.target.value })
              }
            >
              <option>Backup during outages</option>
              <option>Reduce electricity bill</option>
              <option>Completely off-grid</option>
              <option>Solar daytime loads only</option>
              <option>Not decided yet</option>
            </select>
          </Field>
          <Field label="Required backup hours during outage">
            <input
              className={input}
              type="number"
              min="0"
              step="0.5"
              value={electrical.backupHours}
              onChange={(event) =>
                setElectrical({
                  ...electrical,
                  backupHours: event.target.value,
                })
              }
              placeholder="Example: 8"
            />
          </Field>
          <Field label="Customer budget">
            <select className={input} value={electrical.budget} onChange={(event) => setElectrical({ ...electrical, budget: event.target.value })}>
              <option>Not discussed</option><option>Below KSh 100,000</option><option>KSh 100,000 – 200,000</option><option>KSh 200,001 – 300,000</option><option>KSh 300,001 – 500,000</option><option>KSh 500,001 – 750,000</option><option>KSh 750,001 – 1,000,000</option><option>KSh 1,000,001 – 1,500,000</option><option>Above KSh 1,500,000</option><option>Enter specific budget</option>
            </select>
          </Field>
          {electrical.budget === "Enter specific budget" ? <Field label="Specific customer budget (KES)"><input className={input} type="number" min="0" value={electrical.budgetSpecific} onChange={(event) => setElectrical({ ...electrical, budgetSpecific: event.target.value })} placeholder="Example: 350,000" /></Field> : null}
          <Field label="Budget flexibility"><select className={input} value={electrical.budgetFlexibility} onChange={(event) => setElectrical({ ...electrical, budgetFlexibility: event.target.value })}><option>Not discussed</option><option>Strict budget</option><option>Can increase slightly</option><option>Flexible</option></select></Field>
        </Section>
        </div>
        <div hidden={activeStep !== 4}>
        <Section title="Roof, mounting and access">
          <Field label="Roof / installation location"><select className={input} value={siteDetails.installationLocation} onChange={(event) => setSiteDetail("installationLocation", event.target.value)}><option>Roof</option><option>Ground mount</option><option>Carport/Canopy</option><option>Fabricated structure</option><option>Other</option></select></Field>
          {siteDetails.installationLocation === "Roof" ? <>
          <Field label="Roof type">
            <select className={input} value={siteDetails.roofType} onChange={(event) => setSiteDetail("roofType", event.target.value)}>
              <option>Corrugated iron / Mabati</option><option>Tile</option><option>Concrete/Flat roof</option><option>Stone-coated steel</option><option>Other</option>
            </select>
          </Field>
          {siteDetails.roofType === "Other" ? <Field label="Other roof type"><input className={input} value={siteDetails.roofTypeOther} onChange={(event) => setSiteDetail("roofTypeOther", event.target.value)} /></Field> : null}
          <Field label="Roof condition">
            <select className={input} value={siteDetails.roofCondition} onChange={(event) => setSiteDetail("roofCondition", event.target.value)}>
              <option>Good</option>
              <option>Fair</option>
              <option>Poor / repair required</option><option>Not confirmed</option>
            </select>
          </Field>
          <Field label="Enough space for proposed panels?"><select className={input} value={siteDetails.panelSpace} onChange={(event) => setSiteDetail("panelSpace", event.target.value)}><option>Yes</option><option>No</option><option>Unsure — measurements required</option></select></Field>
          {siteDetails.panelSpace !== "Yes" ? <><Field label="Usable width (m)">
            <input className={input} type="number" value={siteDetails.roofWidth} onChange={(event) => setSiteDetail("roofWidth", event.target.value)} />
          </Field>
          <Field label="Usable length (m)">
            <input className={input} type="number" value={siteDetails.roofLength} onChange={(event) => setSiteDetail("roofLength", event.target.value)} />
          </Field></> : null}
          <Field label="Roof slope"><select className={input} value={siteDetails.roofSlope} onChange={(event) => setSiteDetail("roofSlope", event.target.value)}><option>Flat</option><option>Low slope</option><option>Normal pitched roof</option><option>Steep</option><option>Not confirmed</option></select></Field>
          <Field label="Exact roof angle (optional)"><input className={input} type="number" value={siteDetails.roofPitch} onChange={(event) => setSiteDetail("roofPitch", event.target.value)} /></Field>
          <Field label="Panel-facing direction"><select className={input} value={siteDetails.roofOrientation} onChange={(event) => setSiteDetail("roofOrientation", event.target.value)}><option>Not confirmed</option><option>North</option><option>North-East</option><option>East</option><option>South-East</option><option>South</option><option>South-West</option><option>West</option><option>North-West</option><option>Multiple roof faces</option></select></Field>
          <Field label="Panel mounting method"><select className={input} value={siteDetails.mountingMethod} onChange={(event) => setSiteDetail("mountingMethod", event.target.value)}><option>Direct roof mounting</option><option>Raised structure</option><option>Flat-roof structure</option><option>Ground structure</option><option>Special fabrication required</option><option>To be determined</option></select></Field>
          <Field label="Shading">
            <select className={input} value={siteDetails.shading} onChange={(event) => setSiteDetail("shading", event.target.value)}>
              <option>None</option>
              <option>Minor</option><option>Moderate</option><option>Heavy</option>
            </select>
          </Field>
          <Field label="Access method">
            <select className={input} value={siteDetails.roofAccess} onChange={(event) => setSiteDetail("roofAccess", event.target.value)}>
              <option>Standard ladder</option>
              <option>Long/extension ladder</option><option>Internal roof access</option><option>Scaffolding required</option><option>Difficult access</option><option>Special equipment required</option>
            </select>
          </Field>
          {siteDetails.shading !== "None" ? <Field label="Main shading / obstruction source"><select className={input} value={siteDetails.roofObstructions} onChange={(event) => setSiteDetail("roofObstructions", event.target.value)}><option>None</option><option>Trees</option><option>Nearby buildings</option><option>Water tank</option><option>Chimney/Vents</option><option>Antennas</option><option>Other</option></select></Field> : null}
          </> : null}
        </Section>
        </div>
        <div hidden={activeStep !== 5}>
        <Section title="Equipment room and cable route">
          <Field label="Inverter location">
            <select className={input} value={siteDetails.inverterLocation} onChange={(event) => setSiteDetail("inverterLocation", event.target.value)}>
              <option>Indoor</option>
              <option>Utility room</option>
              <option>Garage</option>
              <option>Outdoor sheltered</option>
              <option>Store</option><option>Dedicated equipment room</option><option>Other</option>
            </select>
          </Field>
          <Field label="Battery area">
            <select className={input} value={siteDetails.batteryArea} onChange={(event) => setSiteDetail("batteryArea", event.target.value)}>
              <option>Dry and ventilated</option>
              <option>Suitable indoor area</option><option>Outdoor protected enclosure</option><option>Dedicated battery room</option><option>Area needs preparation</option><option>No suitable location identified</option>
            </select>
          </Field>
          <Field label="Enough space for inverter & battery?"><select className={input} value={siteDetails.equipmentSpace} onChange={(event) => setSiteDetail("equipmentSpace", event.target.value)}><option>Yes</option><option>No</option><option>Requires modification</option></select></Field>
          <Field label="Mounting surface"><select className={input} value={siteDetails.mountingSurface} onChange={(event) => setSiteDetail("mountingSurface", event.target.value)}><option>Masonry/concrete wall</option><option>Stone wall</option><option>Timber</option><option>Metal structure</option><option>Dedicated stand/rack</option><option>Other</option></select></Field>
          <Field label="Solar array → inverter distance">
            <select className={input} value={siteDetails.arrayToInverter} onChange={(event) => setSiteDetail("arrayToInverter", event.target.value)}><option>0–10m</option><option>11–20m</option><option>21–30m</option><option>31–50m</option><option>Above 50m</option><option>Enter exact distance</option></select>
          </Field>
          {siteDetails.arrayToInverter === "Enter exact distance" ? <Field label="Exact solar array → inverter distance (m)"><input className={input} type="number" value={siteDetails.arrayToInverterExact} onChange={(event) => setSiteDetail("arrayToInverterExact", event.target.value)} /></Field> : null}
          <Field label="Inverter → main DB distance">
            <select className={input} value={siteDetails.inverterToDb} onChange={(event) => setSiteDetail("inverterToDb", event.target.value)}><option>0–5m</option><option>6–10m</option><option>11–20m</option><option>21–30m</option><option>Above 30m</option><option>Enter exact distance</option></select>
          </Field>
          {siteDetails.inverterToDb === "Enter exact distance" ? <Field label="Exact inverter → DB distance (m)"><input className={input} type="number" value={siteDetails.inverterToDbExact} onChange={(event) => setSiteDetail("inverterToDbExact", event.target.value)} /></Field> : null}
          <Field label="Inverter → battery distance">
            <select className={input} value={siteDetails.inverterToBattery} onChange={(event) => setSiteDetail("inverterToBattery", event.target.value)}><option>Below 1m</option><option>1–2m</option><option>2–3m</option><option>Above 3m</option><option>Enter exact distance</option></select>
          </Field>
          {siteDetails.inverterToBattery === "Enter exact distance" ? <Field label="Exact inverter → battery distance (m)"><input className={input} type="number" value={siteDetails.inverterToBatteryExact} onChange={(event) => setSiteDetail("inverterToBatteryExact", event.target.value)} /></Field> : null}
          <Field label="Cable route">
            <select className={input} value={siteDetails.cableRoute} onChange={(event) => setSiteDetail("cableRoute", event.target.value)}>
              <option>Easy</option>
              <option>Moderate</option><option>Difficult</option><option>Special work required</option>
            </select>
          </Field>
          {siteDetails.cableRoute !== "Easy" ? <><Field label="Cable route issues (comma-separated)"><input className={input} value={siteDetails.cableRouteIssues} onChange={(event) => setSiteDetail("cableRouteIssues", event.target.value)} placeholder="Long cable run, conduit, wall drilling…" /></Field><Field label="Number of floors cable will pass through"><select className={input} value={siteDetails.cableFloors} onChange={(event) => setSiteDetail("cableFloors", event.target.value)}><option>1 / Same floor</option><option>2</option><option>3</option><option>4+</option></select></Field></> : null}
          <Field label="Equipment location condition"><select className={input} value={siteDetails.equipmentCondition} onChange={(event) => setSiteDetail("equipmentCondition", event.target.value)}><option>Suitable</option><option>Heat concern</option><option>Moisture/water concern</option><option>Poor ventilation</option><option>Direct sunlight</option><option>Restricted access</option><option>Other</option></select></Field>
          {siteDetails.equipmentCondition !== "Suitable" ? <Field label="Equipment condition note"><input className={input} value={siteDetails.equipmentConditionNote} onChange={(event) => setSiteDetail("equipmentConditionNote", event.target.value)} placeholder="Describe the issue and capture a photo." /></Field> : null}
        </Section>
        </div>
        <div hidden={activeStep !== 6}>
        <section className="rounded-2xl bg-slate-900 p-4 sm:rounded-3xl sm:p-5">
          <h2 className="text-xl font-bold">Site photos & documents</h2>
          <p className="mt-1 text-sm text-slate-400">
            Take multiple photos quickly. Roof / installation area and equipment / cable route photos are included in the final assessment report.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {evidenceCategories.map((label) => {
              const fileName = evidenceNames[label];
              return (
                <label
                  key={label}
                  className="rounded-xl border border-white/10 p-4 font-bold"
                >
                  <span className="block">{label}</span>
                  <span className={`mt-2 block text-sm ${fileName ? "text-emerald-300" : "text-amber-200"}`}>
                    {fileName ? `✓ Photo captured — ${fileName}` : "⚠ Not captured"}
                  </span>
                  <span className="mt-3 inline-block rounded-lg border border-cyan-400/40 px-3 py-2 text-xs text-cyan-100">
                    {fileName ? "Replace photo" : "Take / upload photo"}
                  </span>
                  <input
                    className="sr-only"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file)
                        setEvidenceNames((current) => ({
                          ...current,
                          [label]: file.name || "Photo captured",
                        }));
                    }}
                  />
                </label>
              );
            })}
          </div>
        </section>
        </div>
        <div hidden={activeStep !== 7}>
        <section className="rounded-3xl bg-slate-900 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold">
              Customer priorities & special requirements
            </h2>
            <button
              type="button"
              onClick={() => setHome({ ...home, notes: "" })}
              disabled={!home.notes}
              className="rounded-lg border border-white/20 px-3 py-2 text-sm font-bold text-slate-300 disabled:opacity-40"
            >
              Clear comments
            </button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="What is most important to the customer? (comma-separated)"><input className={input} value={projectDetails.customerPriorities || ""} onChange={(event) => setProjectDetail("customerPriorities", event.target.value)} placeholder="Long backup time, lower electricity bill, future expansion…" /></Field>
            <Field label="Priority appliances during outage (comma-separated)"><input className={input} value={projectDetails.priorityAppliances || ""} onChange={(event) => setProjectDetail("priorityAppliances", event.target.value)} placeholder={loads.length ? loads.map((load) => load.name).join(", ") : "Lighting, fridge/freezer, Wi-Fi…"} /></Field>
            <Field label="Future expansion expected?"><select className={input} value={projectDetails.futureExpansion || "No"} onChange={(event) => setProjectDetail("futureExpansion", event.target.value)}><option>No</option><option>Yes</option><option>Not sure</option></select></Field>
            {projectDetails.futureExpansion === "Yes" ? <Field label="Expected future loads"><input className={input} value={projectDetails.futureLoads || ""} onChange={(event) => setProjectDetail("futureLoads", event.target.value)} placeholder="Additional rooms, water pump, AC…" /></Field> : null}
            <Field label="If budget cannot support all loads"><select className={input} value={projectDetails.budgetFallback || "Provide multiple options"} onChange={(event) => setProjectDetail("budgetFallback", event.target.value)}><option>Prioritize essential loads</option><option>Reduce backup hours</option><option>Start smaller and expand later</option><option>Customer can increase budget</option><option>Provide multiple options</option><option>Not discussed</option></select></Field>
            <Field label="Special concerns"><select className={input} value={projectDetails.specialConcerns || "None"} onChange={(event) => setProjectDetail("specialConcerns", event.target.value)}><option>None</option><option>Power outages</option><option>High electricity bills</option><option>Battery lifespan</option><option>Warranty</option><option>Roof space</option><option>Shading</option><option>Installation appearance</option><option>Noise</option><option>Security/theft</option><option>Future expansion</option><option>Existing solar problems</option><option>Other</option></select></Field>
          </div>
          <Field label="Additional technician comments / customer requests">
            <textarea className={`${input} min-h-28`} value={home.notes} onChange={(event) => setHome({ ...home, notes: event.target.value })} placeholder="Record only information not already captured above, including special customer requests or important site observations." />
          </Field>
        </section>
        <section className="mt-5 rounded-2xl border border-white/10 bg-slate-900 p-4 sm:rounded-3xl sm:p-5">
          <h2 className="text-xl font-bold">Assessment review</h2>
          <div className="mt-4 grid gap-3">
            {assessmentSteps.slice(0, 7).map((name, index) => (
              <button
                key={name}
                type="button"
                onClick={() => setActiveStep(index)}
                className="flex items-center justify-between rounded-xl border border-white/10 p-3 text-left hover:border-cyan-300/60"
              >
                <span className="font-bold">{stepStatus(index) === "COMPLETE" ? "✓" : stepStatus(index) === "NOT ASSESSED" ? "⚠" : "○"} {name}</span>
                <span className="text-xs text-slate-400">{stepStatus(index)} · Edit</span>
              </button>
            ))}
          </div>
          <p className="mt-4 rounded-xl bg-amber-400/10 p-3 text-sm text-amber-100">
            Incomplete electrical, roof, or evidence sections are not treated as satisfactory. Analysis may continue, but its warnings must be resolved before quotation.
          </p>
          <p className="mt-3 text-sm text-slate-300">
            Evidence: {Object.keys(evidenceNames).length}/{evidenceCategories.length} captured.
          </p>
        </section>
        </div>
        <div hidden={activeStep !== 8}>
        <section className="rounded-3xl bg-amber-400/10 p-5">
          <b>Review & complete</b>
          <p className="mt-2 text-sm">Field data saves immediately. AI analysis is prepared automatically in the background and never prevents you from completing the assessment.</p>
          <div className={`mt-4 rounded-xl border p-3 text-sm font-bold ${aiStatus === "updated" ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-100" : aiStatus === "unavailable" ? "border-amber-300/40 bg-amber-300/10 text-amber-100" : "border-cyan-300/40 bg-cyan-400/10 text-cyan-100"}`}>
            {aiStatus === "analysing" ? "AI analysing…" : aiStatus === "updated" ? "AI recommendation ready" : aiStatus === "unavailable" ? "AI recommendation temporarily unavailable — field assessment has been saved." : "AI analysis pending"}
            {aiStatus === "unavailable" ? <button type="button" onClick={() => void analyseAssessment()} className="ml-3 underline">Retry</button> : null}
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <ProposalMetric label="Sizing confidence" value={`${analysis.sizingConfidence} · ${analysis.confidenceScore}%`} detail="Deterministic score based on evidence, major-load confidence, KPLC alignment, roof and electrical checks." />
            <ProposalMetric label="Assessment result" value={analysis.assessmentResult} detail={analysis.recommendationOutcome} />
            <ProposalMetric label="Surge requirement" value={`${analysis.surgeRequirementKw.toFixed(2)} kW`} detail="Short-duration motor/compressor start requirement, separate from normal running load." />
          </div>
          {analysis.criticalReadinessIssues.length ? <div className="mt-4 rounded-xl border border-rose-300/35 bg-rose-400/10 p-4 text-sm text-rose-100"><b>Outstanding technical actions</b><ul className="mt-2 list-disc space-y-1 pl-5">{analysis.criticalReadinessIssues.map((issue) => <li key={issue}>🔴 Required before quotation — {issue}</li>)}</ul></div> : <p className="mt-4 rounded-xl border border-emerald-300/35 bg-emerald-400/10 p-4 text-sm font-bold text-emerald-100">✓ Sizing is ready for technical quotation, subject to the listed report confirmations.</p>}
          {analysisError ? (
            <p className="mt-3 text-sm font-semibold text-rose-200">
              {analysisError}
            </p>
          ) : null}
          {aiReview ? (
            <div className="mt-5 rounded-2xl border border-cyan-400/30 bg-slate-950/70 p-4">
              <h3 className="font-black text-cyan-200">AI assessment review</h3>
              <p className="mt-2 text-sm leading-6 text-slate-200">
                {aiReview.summary}
              </p>
              <AiReviewList
                title="Site observations"
                items={aiReview.observations}
              />
              <AiReviewList title="Risks or blockers" items={aiReview.risks} />
              <AiReviewList
                title="Recommended next actions"
                items={aiReview.recommendations}
              />
              <AiReviewList
                title="Information still needed"
                items={aiReview.dataGaps}
              />
            </div>
          ) : null}
          <div className="mt-5 rounded-2xl border border-emerald-400/30 bg-slate-950/70 p-4">
            <h3 className="font-black text-emerald-200">Customer recommendation & report delivery</h3>
            <p className="mt-1 text-sm text-slate-300">
              Select a live Betech website product, or clearly record that this project needs a custom quotation. The published report is saved to the customer account and sent by SMS; a PDF is attached to email when an address is available.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setRecommendationType("CATALOG_PRODUCT")}
                className={`rounded-xl border p-3 text-left font-bold ${recommendationType === "CATALOG_PRODUCT" ? "border-emerald-300 bg-emerald-400/15 text-emerald-100" : "border-white/10 text-slate-300"}`}
              >
                Recommend a Betech website system
              </button>
              <button
                type="button"
                onClick={() => setRecommendationType("CUSTOM_QUOTATION")}
                className={`rounded-xl border p-3 text-left font-bold ${recommendationType === "CUSTOM_QUOTATION" ? "border-emerald-300 bg-emerald-400/15 text-emerald-100" : "border-white/10 text-slate-300"}`}
              >
                Prepare a custom quotation
              </button>
            </div>
            {recommendationType === "CATALOG_PRODUCT" ? (
              <div className="mt-4">
                <label className="text-sm font-bold text-slate-200">
                  Search live Betech products
                  <div className="relative mt-1">
                    <input
                      ref={catalogInputRef}
                      className={input}
                      value={catalogQuery}
                      onChange={(event) => {
                        setCatalogQuery(event.target.value);
                        if (selectedProduct) setSelectedProduct(null);
                      }}
                      placeholder={
                        selectedProduct
                          ? "Search for a different Betech system"
                          : "Start typing, e.g. SRNE 5kW lithium solar kit"
                      }
                      autoComplete="off"
                    />
                    {isSearchingCatalog ? <span className="absolute right-4 top-4 text-xs font-bold text-cyan-200">Searching…</span> : null}
                  </div>
                </label>
                {selectedProduct ? (
                  <div className="mt-3 rounded-xl border border-emerald-300/50 bg-emerald-400/10 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <span className="text-xs font-black uppercase tracking-widest text-emerald-200">
                          Selected website system
                        </span>
                        <p className="mt-1 font-bold text-white">
                          {selectedProduct.productName}
                        </p>
                        <p className="mt-1 text-sm text-slate-300">
                          KES {selectedProduct.price.toLocaleString("en-KE")} · {selectedProduct.availability} · {selectedProduct.productCategory}
                        </p>
                        <p className={`mt-2 text-sm font-bold ${analysis.productMatch.status === "PASS" ? "text-emerald-200" : "text-amber-200"}`}>
                          Technical fit: {analysis.productMatch.status === "PASS" ? "PASS — meets the recorded requirement" : `${analysis.productMatch.status} — ${analysis.productMatch.reasons[0]}`}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <a
                          href={selectedProduct.productUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-white/20 px-3 py-2 text-sm font-bold text-cyan-100 hover:bg-white/5"
                        >
                          View product
                        </a>
                        <button
                          type="button"
                          onClick={changeCatalogProduct}
                          className="rounded-lg border border-emerald-300/60 px-3 py-2 text-sm font-bold text-emerald-100 hover:bg-emerald-400/10"
                        >
                          Change selection
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
                {catalogError ? <p className="mt-2 text-sm text-amber-200">{catalogError}</p> : null}
                {catalogResults.length && !selectedProduct ? (
                  <div className="mt-2 max-h-72 overflow-y-auto rounded-xl border border-cyan-400/30 bg-slate-950 p-2 shadow-2xl">
                    {catalogResults.map((product) => (
                      <button
                        type="button"
                        key={product.productUrl}
                        onClick={() => selectCatalogProduct(product)}
                        className="mb-2 w-full rounded-xl border border-white/10 p-3 text-left last:mb-0 hover:border-emerald-300/60 hover:bg-emerald-400/10"
                      >
                        <span className="block font-bold text-white">{product.productName}</span>
                        <span className="mt-1 block text-sm text-slate-300">KES {product.price.toLocaleString("en-KE")} · {product.availability} · {product.productCategory}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="mt-4 rounded-xl border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100">
                The report will state that Betech will prepare a tailored quotation after reviewing the field findings.
              </p>
            )}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Recommendation notes for the customer">
                <textarea className={`${input} min-h-28`} value={recommendationNotes} onChange={(event) => setRecommendationNotes(event.target.value)} placeholder="Explain the recommendation, scope or next steps..." />
              </Field>
              <Field label="Similar Betech TikTok project (optional)">
                <input className={input} type="url" value={tiktokUrl} onChange={(event) => setTiktokUrl(event.target.value)} placeholder="https://www.tiktok.com/..." />
              </Field>
            </div>
          </div>
        </section>
        {projectProfile.usesLoadSizing ? <>
        <section className="mt-5 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 p-4 sm:rounded-3xl sm:p-5">
          <h2 className="text-xl font-bold">Known-load summary</h2>
          <div className="mt-3 grid gap-3 text-lg font-bold sm:grid-cols-3">
            <span>{(connected / 1000).toFixed(2)} kW connected</span>
            <span>{(daily / 1000).toFixed(2)} kWh/day</span>
            <span>{unknown} unknown ratings</span>
          </div>
        </section>
        <section className="mt-5 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 sm:rounded-3xl sm:p-5">
          <h2 className="text-xl font-bold">Energy assessment</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <ProposalMetric label="Appliance estimate" value={`${(daily / 1000).toFixed(1)} kWh/day`} detail="From recorded appliance usage." />
            <ProposalMetric label="KPLC historical usage" value={Number(electrical.monthlyKwh) > 0 ? `${(Number(electrical.monthlyKwh) / 30).toFixed(1)} kWh/day` : "Not confirmed"} detail={Number(electrical.monthlyKwh) > 0 ? `${electrical.monthlyKwh} kWh from latest billing period.` : "Capture a bill or token screenshot when available."} />
            <ProposalMetric label="Assessment" value={Number(electrical.monthlyKwh) > 0 && daily > 0 && Math.abs(daily / 1000 - Number(electrical.monthlyKwh) / 30) / Math.max(daily / 1000, Number(electrical.monthlyKwh) / 30) < 0.35 ? "✓ Reasonably aligned" : "⚠ Review required"} detail="Large differences can indicate seasonal use, missed loads or unusual billing." />
          </div>
        </section>
        </> : (
          <section className="mt-5 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 p-4 sm:rounded-3xl sm:p-5">
            <h2 className="text-xl font-bold">Project assessment summary</h2>
            <p className="mt-2 text-sm leading-6 text-slate-200">This {formatSiteVisitProjectType(visit.projectType).toLowerCase()} visit is recorded for a tailored Betech technical recommendation. The customer request, project-specific observations, site evidence and final recommendation will be included in the downloadable report.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {projectProfile.fields.map((field) => projectDetails[field.key] ? (
                <ProposalMetric key={field.key} label={field.label} value={projectDetails[field.key]} detail="Recorded during this site assessment." />
              ) : null)}
            </div>
          </section>
        )}
        {projectProfile.usesLoadSizing ? <section className="mt-5 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 sm:rounded-3xl sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Preliminary system proposal</h2>
              <p className="mt-1 text-sm text-slate-300">
                Based on selected solar loads, recorded simultaneous operation,
                and {backupHours} backup hours.
              </p>
            </div>
            <span className="rounded-full bg-emerald-400/15 px-3 py-2 text-sm font-bold text-emerald-200">
              Live calculation
            </span>
          </div>
          {!solarLoads.length ? (
            <p className="mt-4 rounded-xl bg-slate-950/60 p-4 text-slate-300">
              Add loads and select those to include in the solar design to
              calculate a proposal.
            </p>
          ) : (
            <>
              <div className="mt-5 rounded-2xl border border-emerald-300/30 bg-slate-950/40 p-4"><h3 className="font-black text-emerald-100">Recommended solar system</h3><p className="mt-2 text-lg font-bold">{inverterKw.toFixed(1)} kW Hybrid Inverter · {recommendedBatteryKwh.toFixed(2)} kWh Lithium Battery · {panelCount} × {analysis.panelWatts} W Solar Panels</p><p className="mt-2 text-sm text-slate-300">Supports the selected essential appliances, targets {backupHours} hours of backup and can be expanded as future loads are added.</p></div>
              <details className="mt-5"><summary className="cursor-pointer font-bold text-cyan-100">View technical calculations</summary><div className="mt-3 grid gap-3 sm:grid-cols-2">
                <ProposalMetric
                  label="Continuous solar load"
                  value={`${(continuous / 1000).toFixed(2)} kW`}
                  detail="24-hour equipment such as CCTV, fridge, freezer, fence and Wi-Fi."
                />
                <ProposalMetric
                  label="Recorded simultaneous peak"
                  value={`${(simultaneousPeak / 1000).toFixed(2)} kW`}
                  detail="Uses the quantity that can run together on each load card."
                />
                <ProposalMetric
                  label="Recommended inverter"
                  value={`${inverterKw.toFixed(1)} kW`}
                  detail={
                    largestMotor
                      ? "Selected from our 1.5-20 kW range with 25% headroom and motor-start allowance."
                      : "Selected from our 1.5-20 kW range with 25% operating headroom."
                  }
                />
                <ProposalMetric
                  label="Recommended lithium storage"
                  value={`${recommendedBatteryKwh.toFixed(2)} kWh`}
                  detail={`Calculated from ${analysis.rawBackupEnergyKwh.toFixed(2)} kWh of recorded essential-load backup energy, then adjusted for 92% efficiency, 90% usable DoD and reserve.`}
                />
                <ProposalMetric
                  label="PV requirement / practical array"
                  value={`${pvKw.toFixed(2)} / ${analysis.pvPracticalKwp.toFixed(2)} kWp`}
                  detail={`Daily design energy ${analysis.pvDesignEnergyKwh.toFixed(2)} kWh ÷ (${analysis.assumptions.peakSunHours} PSH × ${(analysis.assumptions.pvPerformanceFactor * 100).toFixed(0)}%) then rounded up to ${panelCount} × ${analysis.panelWatts} W. Expected average production: ${analysis.expectedSolarProductionKwh.toFixed(2)} kWh/day.`}
                />
                <ProposalMetric
                  label="Essential backup energy"
                  value={`${(systemEnergyWh / 1000).toFixed(2)} kWh`}
                  detail={`Uses each essential appliance's expected runtime during the ${backupHours}h outage target; estimated delivery is ${analysis.expectedBackupHours.toFixed(1)}h at the recorded essential-load profile.`}
                />
              </div></details>
              <div className="mt-5 rounded-2xl border border-amber-300/30 bg-slate-950/60 p-4 text-sm text-amber-100">
                <b>Before quotation:</b> Confirm all unknown nameplates,
                appliance surge data, roof capacity, shading, wiring and actual
                KPLC usage. This is a field planning recommendation, not a final
                electrical design or installation approval.
              </div>
            </>
          )}
        </section> : null}
        <section className="mt-5 rounded-2xl border border-emerald-300/40 bg-emerald-400/10 p-4 sm:rounded-3xl sm:p-5">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-200">
            Final step
          </p>
          <h2 className="mt-1 text-xl font-black">Customer acknowledgement & completion</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-200">
            Review the assessment and recommendation together. The technician identity and completion time are recorded from this assigned link; the customer confirms the information with their name and acknowledgement.
          </p>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <Field label="Customer / authorised representative full name">
                <input
                  className={input}
                  value={customerSignatureName}
                  onChange={(event) => setCustomerSignatureName(event.target.value)}
                  placeholder="Type full name"
                  autoComplete="name"
                />
              </Field>
              <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm leading-6 text-slate-200">
                <input
                  type="checkbox"
                  checked={customerAcceptedReport}
                  onChange={(event) => setCustomerAcceptedReport(event.target.checked)}
                  className="mt-1 h-4 w-4 accent-emerald-400"
                />
                <span>I confirm that the information recorded during this site assessment has been reviewed with me. I understand that the recommended solar system is preliminary and subject to Betech Solar&apos;s final technical review and quotation. I agree to Betech Solar&apos;s Terms &amp; Conditions.</span>
              </label>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <Field label="Assessment completed by — Betech technician">
                <input
                  className={input}
                  value={technicianSignatureName}
                  readOnly
                  placeholder="Type full name"
                  autoComplete="name"
                />
              </Field>
              <p className="mt-2 text-xs leading-5 text-slate-400">
                The technician identity is verified from this assigned assessment link.
              </p>
              <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm leading-6 text-slate-200">
                <input
                  type="checkbox"
                  checked={technicianAcceptedReport}
                  onChange={(event) => setTechnicianAcceptedReport(event.target.checked)}
                  className="mt-1 h-4 w-4 accent-emerald-400"
                />
                <span>I confirm that this assessment represents my site observations and information provided by the customer.</span>
              </label>
            </div>
          </div>
          {isRevisingReport ? (
            <p className="mt-4 rounded-xl border border-amber-300/40 bg-amber-400/10 p-3 text-sm font-bold text-amber-100">
              OUTDATED — REGENERATE REQUIRED. The previous report is not available to send while this revised assessment is being prepared.
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void publishReport()}
            disabled={isPublishing || Boolean(publishMessage) || !signaturesComplete}
            className="mt-5 w-full rounded-xl bg-emerald-400 py-4 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPublishing
              ? isRevisingReport ? "Regenerating report..." : "Generating report..."
              : publishMessage
                ? "Report shared"
                : isRevisingReport
                  ? "Complete revised site assessment"
                  : "Complete Site Assessment →"}
          </button>
          {!signaturesComplete && !publishMessage ? (
            <p className="mt-3 text-sm text-amber-100">
              Both electronic signatures and acknowledgements are required before sharing.
            </p>
          ) : null}
          {publishError ? <p className="mt-3 text-sm font-semibold text-rose-200">{publishError}</p> : null}
          {publishMessage ? <p className="mt-3 text-sm font-semibold text-emerald-200">{publishMessage}</p> : null}
          {reportShared && !isRevisingReport ? (
            <div className="mt-5 rounded-2xl border border-cyan-300/30 bg-slate-950/60 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200">Published report actions</p>
              <p className="mt-1 text-sm text-slate-300">Download the professional customer PDF, send the current version again, or open a controlled revision. A revision replaces the earlier report only after it is regenerated.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <a
                  href={`/api/site-assessment/report/pdf?token=${encodeURIComponent(assessmentToken)}`}
                  className="rounded-xl bg-cyan-400 px-4 py-3 text-sm font-black text-slate-950"
                >
                  Download professional PDF
                </a>
                <button
                  type="button"
                  onClick={() => void sendPublishedReport()}
                  disabled={isSendingReport}
                  className="rounded-xl border border-emerald-300/50 px-4 py-3 text-sm font-black text-emerald-100 disabled:opacity-40"
                >
                  {isSendingReport ? "Sending report..." : "Send to customer"}
                </button>
                <button
                  type="button"
                  onClick={beginReportRevision}
                  className="rounded-xl border border-amber-300/50 px-4 py-3 text-sm font-black text-amber-100"
                >
                  Edit & regenerate report
                </button>
              </div>
              {deliveryMessage ? <p className="mt-3 text-sm font-semibold text-emerald-200">{deliveryMessage}</p> : null}
              {deliveryError ? <p className="mt-3 text-sm font-semibold text-rose-200">{deliveryError}</p> : null}
            </div>
          ) : null}
        </section>
        </div>
        <WizardNavigation
          activeStep={activeStep}
          onBack={() => changeStep(activeStep - 1)}
          onSkip={() => changeStep(activeStep + 1, "skip")}
          onContinue={() => changeStep(activeStep + 1, "complete")}
        />
      </div>
    </main>
  );
}

function WizardProgress({
  activeStep,
  completedSteps,
  skippedSteps,
  onStepSelect,
}: {
  activeStep: number;
  completedSteps: Record<number, boolean>;
  skippedSteps: Record<number, boolean>;
  onStepSelect: (index: number) => void;
}) {
  return (
    <section className="rounded-2xl border border-cyan-400/25 bg-slate-900/90 p-3 sm:p-4">
      <p className="text-sm font-black text-cyan-100">
        Step {activeStep + 1} of {assessmentSteps.length} — {assessmentSteps[activeStep]}
      </p>
      <div className="-mx-1 mt-3 overflow-x-auto pb-1">
        <div className="flex w-max min-w-full gap-1.5 px-1 text-xs font-bold">
        {assessmentSteps.map((step, index) => {
          const marker = completedSteps[index]
            ? "✓"
            : skippedSteps[index]
              ? "⚠"
              : index === activeStep
                ? "●"
                : "○";
          return (
            <button
              type="button"
              key={step}
              onClick={() => onStepSelect(index)}
              aria-current={index === activeStep ? "step" : undefined}
              className={`min-h-10 whitespace-nowrap rounded-lg px-2 py-1.5 text-left transition touch-manipulation hover:bg-white/10 hover:text-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${
                index === activeStep
                  ? "text-cyan-200"
                  : skippedSteps[index]
                    ? "text-amber-200"
                    : "text-slate-400"
              }`}
            >
              {marker} {step}
            </button>
          );
        })}
        </div>
      </div>
    </section>
  );
}

function WizardNavigation({
  activeStep,
  onBack,
  onSkip,
  onContinue,
}: {
  activeStep: number;
  onBack: () => void;
  onSkip: () => void;
  onContinue: () => void;
}) {
  if (activeStep === 8) {
    return (
      <nav className="flex justify-start">
        <button type="button" onClick={onBack} className="min-h-12 w-full rounded-xl border border-white/20 px-4 py-3 font-bold touch-manipulation sm:w-auto">
          ← Back to assessment
        </button>
      </nav>
    );
  }
  if (activeStep === 7) {
    return (
      <nav className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={onBack} className="min-h-12 rounded-xl border border-white/20 px-4 py-3 font-bold touch-manipulation">
          ← Back
        </button>
        <button type="button" onClick={onContinue} className="min-h-12 rounded-xl bg-cyan-400 px-5 py-3 font-black text-slate-950 touch-manipulation">
          Review & Complete →
        </button>
      </nav>
    );
  }
  return (
    <nav className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="grid grid-cols-2 gap-2 sm:flex">
        <button
          type="button"
          onClick={onBack}
          disabled={activeStep === 0}
          className="min-h-12 rounded-xl border border-white/20 px-4 py-3 font-bold touch-manipulation disabled:opacity-40"
        >
          ← Back
        </button>
        <button type="button" onClick={onSkip} className="min-h-12 rounded-xl border border-amber-300/40 px-4 py-3 font-bold text-amber-100 touch-manipulation">
          {activeStep === 4 ? "Skip — assess later" : "Skip section"}
        </button>
      </div>
      <button type="button" onClick={onContinue} className="min-h-12 w-full rounded-xl bg-cyan-400 px-5 py-3 font-black text-slate-950 touch-manipulation sm:w-auto">
        Save & Continue →
      </button>
    </nav>
  );
}

function LoadSummaryCard({
  load,
  index,
  dailyWh,
  onEdit,
  onRemove,
}: {
  load: Load;
  index: number;
  dailyWh: number;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const usage = load.usageMode === "ALWAYS_ON"
    ? "Continuous 24h"
    : `${(dailyWh / 1000).toFixed(2)} kWh/day`;
  const rating = load.ratingKnown
    ? `${readNumber(load.qty)} × ${readNumber(load.watts)}W`
    : "Rating unknown";
  return (
    <article className="rounded-2xl border border-white/10 bg-slate-950/60 p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <b>{load.name} {index + 1}</b>
          <p className="mt-1 break-words text-sm leading-6 text-slate-300">
            {rating} · {load.details.area || load.period} · {usage}{load.essential ? " · Essential" : ""}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm font-bold sm:flex sm:gap-3">
          <button type="button" onClick={onEdit} className="min-h-10 rounded-lg px-2 text-cyan-200 touch-manipulation hover:bg-cyan-400/10">Edit</button>
          <button type="button" onClick={onRemove} className="min-h-10 rounded-lg px-2 text-rose-300 touch-manipulation hover:bg-rose-400/10">Remove</button>
        </div>
      </div>
    </article>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-slate-900 p-4 sm:rounded-3xl sm:p-5">
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}
function ProposalMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-950/70 p-4">
      <p className="text-sm font-semibold text-slate-300">{label}</p>
      <p className="mt-2 text-2xl font-black text-emerald-300">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-400">{detail}</p>
    </div>
  );
}
function AiReviewList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-4">
      <h4 className="text-sm font-black text-slate-100">{title}</h4>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-300">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
function LoadCard({
  load,
  index,
  isOpen,
  edit,
  detail,
  onCancel,
  onSave,
}: {
  load: Load;
  index: number;
  isOpen: boolean;
  edit: (id: number, patch: Partial<Load>) => void;
  detail: (load: Load, key: string, value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const special = (key: string, label: string, children: React.ReactNode) => (
    <Field label={label} key={key}>
      {children}
    </Field>
  );
  const applyLightProfile = (area: string) => {
    const profile = lightProfiles[area] || lightProfiles.Other;
    edit(load.id, {
      watts: profile.watts,
      ratingKnown: true,
      usageMode: "DAILY_HOURS",
      hours: profile.hours,
      period: profile.period,
      simultaneous: load.qty,
      details: { ...load.details, area, bulbType: "LED" },
    });
  };
  return (
    <article
      id={`assessment-load-${load.id}`}
      hidden={!isOpen}
      className="mt-5 scroll-mt-5 rounded-2xl border border-cyan-400/30 bg-slate-950 p-3 sm:p-4"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <b className="break-words">
          {load.name} {index + 1}
        </b>
        <button type="button" onClick={onCancel} className="min-h-10 self-start rounded-lg px-2 text-slate-300 touch-manipulation hover:bg-white/10 sm:self-auto">
          Cancel
        </button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Load name / description">
          <input
            className={input}
            value={load.name}
            onChange={(event) => edit(load.id, { name: event.target.value })}
          />
        </Field>
        <Field label="Quantity">
          <input
            className={input}
            type="number"
            min="1"
            value={load.qty}
            onChange={(event) => {
              const qty = numberOrBlank(event.target.value);
              edit(
                load.id,
                load.kind === "lights" ? { qty, simultaneous: qty } : { qty },
              );
            }}
          />
        </Field>
        {load.kind === "lights" && (
          <>
            {special(
              "area",
              "Light area",
              <select
                className={input}
                value={load.details.area || "Living area"}
                onChange={(event) => applyLightProfile(event.target.value)}
              >
                {lightAreas.map((area) => (
                  <option key={area}>{area}</option>
                ))}
              </select>,
            )}
            {special(
              "bulbType",
              "Bulb / fitting type",
              <select
                className={input}
                value={load.details.bulbType || "LED"}
                onChange={(event) =>
                  detail(load, "bulbType", event.target.value)
                }
              >
                <option>LED</option>
                <option>Fluorescent</option>
                <option>Halogen</option>
                <option>Incandescent</option>
                <option>Unknown</option>
              </select>,
            )}
            <p className="sm:col-span-2 rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-3 text-sm text-cyan-100">
              Area selection applies an editable LED profile for rating,
              night/day use and simultaneous lights.
            </p>
          </>
        )}
        {load.kind === "tv" && (
          <>
            {special(
              "size",
              "TV screen size",
              <select
                className={input}
                value={load.details.size || "Unknown"}
                onChange={(event) => detail(load, "size", event.target.value)}
              >
                <option>Unknown</option>
                <option>24 inch or less</option>
                <option>32 inch</option>
                <option>43 inch</option>
                <option>50 inch</option>
                <option>55 inch</option>
                <option>65 inch or larger</option>
              </select>,
            )}
            {special(
              "display",
              "TV type",
              <select
                className={input}
                value={load.details.display || "LED / Smart"}
                onChange={(event) =>
                  detail(load, "display", event.target.value)
                }
              >
                <option>LED / Smart</option>
                <option>OLED</option>
                <option>Older LCD / plasma</option>
                <option>Unknown</option>
              </select>,
            )}
          </>
        )}
        {load.kind === "cctv" && (
          <>
            {special(
              "cameras",
              "Number of cameras",
              <input
                className={input}
                type="number"
                min="0"
                value={load.details.cameras || ""}
                onChange={(event) =>
                  detail(load, "cameras", event.target.value)
                }
              />,
            )}
            {special(
              "channels",
              "DVR / NVR channel count",
              <input
                className={input}
                type="number"
                min="0"
                value={load.details.channels || ""}
                onChange={(event) =>
                  detail(load, "channels", event.target.value)
                }
              />,
            )}
          </>
        )}
        {["microwave", "kettle"].includes(load.kind) && (
          <Field label="Typical use times">
            <select
              className={input}
              value={load.details.routine || "Morning, lunch and evening"}
              onChange={(event) => detail(load, "routine", event.target.value)}
            >
              <option>Morning, lunch and evening</option>
              <option>Morning and evening</option>
              <option>Mostly daytime</option>
              <option>Mostly evening</option>
            </select>
          </Field>
        )}
        {load.kind === "washing" && (
          <>
            {special(
              "heated",
              "Uses heated water",
              <select
                className={input}
                value={load.details.heated || "Unknown"}
                onChange={(event) => detail(load, "heated", event.target.value)}
              >
                <option>Unknown</option>
                <option>Yes</option>
                <option>No</option>
              </select>,
            )}
            {special(
              "loading",
              "Machine type",
              <select
                className={input}
                value={load.details.loading || "Top load"}
                onChange={(event) =>
                  detail(load, "loading", event.target.value)
                }
              >
                <option>Top load</option>
                <option>Front load</option>
                <option>Unknown</option>
              </select>,
            )}
          </>
        )}
        {["water-pump", "borehole-pump"].includes(load.kind) && (
          <>
            {special(
              "phase",
              "Motor phase",
              <select
                className={input}
                value={load.details.phase || "Unknown"}
                onChange={(event) => detail(load, "phase", event.target.value)}
              >
                <option>Unknown</option>
                <option>Single phase</option>
                <option>Three phase</option>
              </select>,
            )}
            {special(
              "starts",
              "Starts / runs per day",
              <input
                className={input}
                type="number"
                min="0"
                value={load.details.starts || ""}
                onChange={(event) => detail(load, "starts", event.target.value)}
              />,
            )}
          </>
        )}
        {load.kind === "electric-gate" && (
          <>
            {special(
              "motors",
              "Number of gate motors",
              <input
                className={input}
                type="number"
                min="1"
                value={load.details.motors || "1"}
                onChange={(event) => detail(load, "motors", event.target.value)}
              />,
            )}
            {special(
              "battery",
              "Gate backup battery present",
              <select
                className={input}
                value={load.details.battery || "Unknown"}
                onChange={(event) =>
                  detail(load, "battery", event.target.value)
                }
              >
                <option>Unknown</option>
                <option>Yes</option>
                <option>No</option>
              </select>,
            )}
          </>
        )}
        <Field label="Rating evidence">
          <select
            className={input}
            value={load.ratingKnown ? "KNOWN" : "UNKNOWN"}
            onChange={(event) =>
              edit(load.id, {
                ratingKnown: event.target.value === "KNOWN",
                watts: event.target.value === "KNOWN" ? load.watts || 0 : null,
              })
            }
          >
            <option value="KNOWN">Rating known</option>
            <option value="UNKNOWN">Unknown - take nameplate photo</option>
          </select>
        </Field>
        {load.ratingKnown ? (
          <Field label="Nameplate rating (W)">
            <input
              className={input}
              type="number"
              min="0"
              value={load.watts ?? ""}
              onChange={(event) =>
                edit(load.id, { watts: numberOrBlank(event.target.value) })
              }
            />
          </Field>
        ) : (
          <label className="text-sm font-semibold text-amber-200">
            Equipment / nameplate photo
            <input
              className="mt-1 block w-full rounded-xl border border-amber-400/30 p-3"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={() => edit(load.id, { photo: true })}
            />
            {load.photo && (
              <span className="mt-1 block text-xs">
                Photo captured. Do not guess the rating.
              </span>
            )}
          </label>
        )}
        <Field label="Rating source / confidence">
          <select className={input} value={load.details.ratingSource || (load.ratingKnown ? "Technician-entered rating" : "Unknown / needs nameplate")} onChange={(event) => detail(load, "ratingSource", event.target.value)}>
            <option>Default appliance profile</option><option>Technician-entered rating</option><option>Nameplate photo confirmed</option><option>Customer-provided estimate</option><option>Unknown / needs nameplate</option>
          </select>
        </Field>
        <Field label="Load type">
          <select className={input} value={load.details.loadType || (/[Pp]ump|[Ff]ridge|[Ff]reezer|[Aa]ir conditioner|[Gg]ate/.test(`${load.kind} ${load.name}`) ? "Motor/compressor" : "Electronic")} onChange={(event) => detail(load, "loadType", event.target.value)}>
            <option>Resistive</option><option>Electronic</option><option>Motor/compressor</option><option>Unknown</option>
          </select>
        </Field>
        {(load.details.loadType === "Motor/compressor" || /pump|fridge|freezer|air conditioner|\bac\b|gate/i.test(`${load.kind} ${load.name}`)) ? <>
          <Field label="Motor / compressor surge multiplier"><input className={input} type="number" min="1" step="0.1" value={load.details.surgeMultiplier || ""} onChange={(event) => detail(load, "surgeMultiplier", event.target.value)} placeholder="Defaults to 3× until confirmed" /></Field>
          <Field label="Rated HP (optional)"><input className={input} type="number" min="0" step="0.1" value={load.details.horsepower || ""} onChange={(event) => detail(load, "horsepower", event.target.value)} /></Field>
          <Field label="Duty cycle (%)"><input className={input} type="number" min="1" max="100" value={load.details.dutyCycle ? String(Number(load.details.dutyCycle) * 100) : ""} onChange={(event) => detail(load, "dutyCycle", event.target.value ? String(Number(event.target.value) / 100) : "")} placeholder="Use for fridge/freezer/AC if known" /></Field>
          <label className="rounded-xl border border-amber-300/30 p-3 text-sm font-semibold text-amber-100">📷 Nameplate photo {load.photo ? "✓ captured" : "recommended for this major load"}<input className="mt-2 block w-full text-xs" type="file" accept="image/*" capture="environment" onChange={() => { edit(load.id, { photo: true }); detail(load, "ratingSource", "Nameplate photo confirmed"); }} /></label>
        </> : null}
        <Field label="How is it used?">
          <select
            className={input}
            value={load.usageMode}
            onChange={(event) =>
              edit(load.id, { usageMode: event.target.value as UsageMode })
            }
          >
            <option value="DAILY_HOURS">Hours per day</option>
            <option value="EVENTS_DAILY">Uses per day x minutes</option>
            <option value="EVENTS_WEEKLY">Uses per week x minutes</option>
            <option value="ALWAYS_ON">24 hours / always connected</option>
          </select>
        </Field>
        {load.usageMode === "DAILY_HOURS" ? (
          <Field label="Average hours per day">
            <input
              className={input}
              type="number"
              min="0"
              step="0.25"
              value={load.hours}
              onChange={(event) =>
                edit(load.id, { hours: numberOrBlank(event.target.value) })
              }
            />
          </Field>
        ) : load.usageMode !== "ALWAYS_ON" ? (
          <>
            <Field
              label={
                load.usageMode === "EVENTS_WEEKLY"
                  ? "Uses per week"
                  : "Uses per day"
              }
            >
              <input
                className={input}
                type="number"
                min="0"
                value={load.uses}
                onChange={(event) =>
                  edit(load.id, { uses: numberOrBlank(event.target.value) })
                }
              />
            </Field>
            <Field label="Average minutes per use">
              <input
                className={input}
                type="number"
                min="0"
                value={load.minutes}
                onChange={(event) =>
                  edit(load.id, { minutes: numberOrBlank(event.target.value) })
                }
              />
            </Field>
          </>
        ) : (
          <div className="rounded-xl border border-cyan-400/20 p-3 text-sm text-cyan-100">
            Counted as a continuous 24-hour load.
          </div>
        )}
        <Field label="When is it normally used?">
          <select
            className={input}
            value={load.period}
            onChange={(event) => edit(load.id, { period: event.target.value })}
          >
            <option>Day</option>
            <option>Night</option>
            <option>Both</option>
          </select>
        </Field>
        <Field label="How many run at the same time?">
          <input
            className={input}
            type="number"
            min="0"
            value={load.simultaneous}
            onChange={(event) =>
              edit(load.id, { simultaneous: numberOrBlank(event.target.value) })
            }
          />
        </Field>
        <Field label="Essential during an outage?">
          <select
            className={input}
            value={load.essential ? "Yes" : "No"}
            onChange={(event) =>
              edit(load.id, { essential: event.target.value === "Yes" })
            }
          >
            <option>Yes</option>
            <option>No</option>
          </select>
        </Field>
        {load.essential ? <Field label="Expected runtime during outage (hours)"><input className={input} type="number" min="0" step="0.25" value={load.details.outageRuntimeHours || ""} onChange={(event) => detail(load, "outageRuntimeHours", event.target.value)} placeholder="Defaults to the relevant recorded usage / backup target" /></Field> : null}
        <Field label="Include in solar design?">
          <select
            className={input}
            value={load.design}
            onChange={(event) => edit(load.id, { design: event.target.value })}
          >
            <option>Yes</option>
            <option>No - leave on grid</option>
            <option>Backup only</option>
            <option>Daytime only</option>
          </select>
        </Field>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-4 sm:flex sm:justify-end">
        <button type="button" onClick={onCancel} className="min-h-12 rounded-xl border border-white/20 px-4 py-3 font-bold touch-manipulation">
          Cancel
        </button>
        <button type="button" onClick={onSave} className="min-h-12 rounded-xl bg-cyan-400 px-4 py-3 font-black text-slate-950 touch-manipulation">
          Save {load.name}
        </button>
      </div>
    </article>
  );
}
