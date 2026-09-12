"use client";

import { useEffect, useRef, useState } from "react";
import type { SerializedSiteVisit } from "@/lib/siteVisitShared";
import { analyseSiteAssessment } from "@/lib/siteAssessmentAnalysis";

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
  "mt-1 w-full rounded-xl border border-white/10 bg-slate-950 p-3 text-white";
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
  "Analysis",
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
] as const;
const emptyHome = {
  bedrooms: "",
  type: "House",
  units: "1",
  notes: "",
};
const emptyElectrical = {
  billing: "Prepaid meter",
  grid: "Connected to grid",
  wiring: "Wiring complete",
  meterId: "",
  monthlyKwh: "",
  monthlyBill: "",
  tariff: "",
  systemGoal: "Backup during outages",
  backupHours: "8",
  budget: "",
};
const emptySiteDetails: Record<string, string> = {
  supplyType: "Single phase", mainBreakerRating: "", solarBreakerSlots: "", earthingCondition: "Visually confirmed", earthWireNotes: "",
  roofType: "Corrugated iron", roofCondition: "Good", roofWidth: "", roofLength: "", roofPitch: "", shading: "None", roofAccess: "Standard ladder", roofObstructions: "",
  inverterLocation: "Indoor", batteryArea: "Dry and ventilated", arrayToInverter: "", inverterToDb: "", inverterToBattery: "", cableRoute: "Easy",
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
    <label className="text-sm font-semibold text-slate-200">
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
  const [loads, setLoads] = useState<Load[]>([]);
  const [home, setHome] = useState(emptyHome);
  const [electrical, setElectrical] = useState(emptyElectrical);
  const [siteDetails, setSiteDetails] = useState(emptySiteDetails);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [aiReview, setAiReview] = useState<AssessmentAiReview | null>(null);
  const [isAnalysing, setIsAnalysing] = useState(false);
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
  const [customerAcceptedReport, setCustomerAcceptedReport] = useState(false);
  const [technicianSignatureName, setTechnicianSignatureName] = useState(
    visit.assignedTechnicianName || "",
  );
  const [technicianAcceptedReport, setTechnicianAcceptedReport] = useState(false);
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
    setHome(emptyHome);
    setElectrical(emptyElectrical);
    setSiteDetails(emptySiteDetails);
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
    setCustomerAcceptedReport(false);
    setTechnicianSignatureName(visit.assignedTechnicianName || "");
    setTechnicianAcceptedReport(false);
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
        details: profile.details || {},
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
        details: {},
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
    evidenceNames,
    calculation: {
      connectedKw: connected / 1000,
      dailyKwh: daily / 1000,
      continuousKw: analysis.continuousKw,
      simultaneousPeakKw: analysis.simultaneousPeakKw,
      inverterKw,
      batteryRecommendation,
      batteryKwh: analysis.batteryKwh,
      pvKw,
      panelCount,
      panelWatts: 600,
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
      setAiReview(data.review as AssessmentAiReview);
    } catch (error) {
      setAnalysisError(
        error instanceof Error
          ? error.message
          : "Assessment analysis could not be completed.",
      );
    } finally {
      setIsAnalysing(false);
    }
  };
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
    };
    if (Array.isArray(saved.loads)) setLoads(saved.loads);
    if (saved.home) setHome({ ...emptyHome, ...saved.home });
    if (saved.electrical) setElectrical({ ...emptyElectrical, ...saved.electrical });
    if (saved.siteDetails) setSiteDetails({ ...emptySiteDetails, ...saved.siteDetails });
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
      className="min-h-screen bg-slate-950 p-3 text-slate-100"
    >
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="rounded-3xl bg-cyan-400 p-6 text-slate-950">
          <b className="text-xs uppercase tracking-widest">
            Betech Solar Solutions
          </b>
          <h1 className="mt-2 text-3xl font-black">Field Site Assessment</h1>
          <p>
            {visit.visitRef} · {visit.customerName}
          </p>
        </header>
        <WizardProgress
          activeStep={activeStep}
          completedSteps={completedSteps}
          skippedSteps={skippedSteps}
          onStepSelect={(index) => changeStep(index)}
        />
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-3 text-sm text-cyan-100">
          <span>
            {draftLoaded
              ? "Assessment details save automatically on this device."
              : "Loading saved assessment..."}
          </span>
          <button
            type="button"
            onClick={clearDraft}
            className="rounded-lg border border-rose-300/50 px-3 py-2 font-bold text-rose-200"
          >
            Clear saved draft
          </button>
        </div>
        <div hidden={activeStep !== 0}>
        <section className="rounded-3xl bg-slate-900 p-5">
          <h2 className="text-xl font-bold">Home and project details</h2>
          <p className="mt-1 text-sm text-slate-400">
            Capture the household scale and customer requirements before
            inspecting loads.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Property type">
              <select
                className={input}
                value={home.type}
                onChange={(event) =>
                  setHome({ ...home, type: event.target.value })
                }
              >
                <option>House</option>
                <option>Apartment</option>
                <option>Maisonette</option>
                <option>Rental units</option>
                <option>Small business at home</option>
              </select>
            </Field>
            <Field label="Number of bedrooms">
              <input
                className={input}
                type="number"
                min="0"
                value={home.bedrooms}
                onChange={(event) =>
                  setHome({ ...home, bedrooms: event.target.value })
                }
              />
            </Field>
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
        </section>
        </div>
        <div hidden={activeStep !== 1}>
        <section className="rounded-3xl bg-slate-900 p-5">
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
                      className="rounded-full border border-cyan-400/40 px-3 py-2 text-sm font-bold"
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
            className="mt-5 rounded-full bg-white/10 px-4 py-3"
          >
            + Unknown equipment
          </button>
          <div className="mt-5 grid gap-3">
            {loadGroups.map((group) => (
              <section key={group.kind} className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/45">
                <div className="flex flex-wrap items-center justify-between gap-2 p-2">
                  <button
                    type="button"
                    onClick={() => setExpandedLoadKinds((current) => ({
                      ...current,
                      [group.kind]: !current[group.kind],
                    }))}
                    className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-xl p-2 text-left hover:bg-white/5"
                    aria-expanded={Boolean(expandedLoadKinds[group.kind])}
                  >
                    <span className="font-black text-cyan-100">
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
                    className="rounded-xl border border-cyan-400/30 px-3 py-2 text-sm font-bold text-cyan-100 hover:bg-cyan-400/10"
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
        <Section title="Electrical supply and safety">
          <Field label="Meter and billing">
            <select
              className={input}
              value={electrical.billing}
              onChange={(event) =>
                setElectrical({ ...electrical, billing: event.target.value })
              }
            >
              <option>Prepaid meter</option>
              <option>Postpaid meter</option>
              <option>Unknown</option>
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
              <option>Unknown</option>
            </select>
          </Field>
          <Field label="Main breaker rating (A)">
            <input className={input} type="number" value={siteDetails.mainBreakerRating} onChange={(event) => setSiteDetail("mainBreakerRating", event.target.value)} />
          </Field>
          <Field label="Available solar breaker slots">
            <input className={input} type="number" value={siteDetails.solarBreakerSlots} onChange={(event) => setSiteDetail("solarBreakerSlots", event.target.value)} />
          </Field>
          <Field label="Earthing condition">
            <select className={input} value={siteDetails.earthingCondition} onChange={(event) => setSiteDetail("earthingCondition", event.target.value)}>
              <option>Visually confirmed</option>
              <option>Needs verification</option>
              <option>Not visible</option>
            </select>
          </Field>
          <Field label="Earth wire gauge / notes">
            <input className={input} value={siteDetails.earthWireNotes} onChange={(event) => setSiteDetail("earthWireNotes", event.target.value)} />
          </Field>
          {electrical.grid === "Connected to grid" && (
            <>
              <Field
                label={
                  electrical.billing === "Postpaid meter"
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
              <Field label="Tariff category (if shown on bill)">
                <input
                  className={input}
                  value={electrical.tariff}
                  onChange={(event) =>
                    setElectrical({ ...electrical, tariff: event.target.value })
                  }
                  placeholder="Example: Domestic Ordinary (DC3)"
                />
              </Field>
              <Field label="Latest bill / token statement photo">
                <input
                  className={input}
                  type="file"
                  accept="image/*,application/pdf"
                  capture="environment"
                />
              </Field>
              <Field label="Last bill consumption (kWh)">
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
              <Field label="Last bill or monthly token amount (KES)">
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
          <Field label="Customer budget (KES), if shared">
            <input
              className={input}
              type="number"
              min="0"
              value={electrical.budget}
              onChange={(event) =>
                setElectrical({ ...electrical, budget: event.target.value })
              }
              placeholder="Leave blank if not discussed"
            />
          </Field>
        </Section>
        </div>
        <div hidden={activeStep !== 4}>
        <Section title="Roof, mounting and access">
          <Field label="Roof type">
            <select className={input} value={siteDetails.roofType} onChange={(event) => setSiteDetail("roofType", event.target.value)}>
              <option>Corrugated iron</option>
              <option>Decra</option>
              <option>Tile</option>
              <option>Concrete flat</option>
              <option>Ground mount</option>
            </select>
          </Field>
          <Field label="Roof condition">
            <select className={input} value={siteDetails.roofCondition} onChange={(event) => setSiteDetail("roofCondition", event.target.value)}>
              <option>Good</option>
              <option>Fair</option>
              <option>Rust, leaks or sagging</option>
            </select>
          </Field>
          <Field label="Usable width (m)">
            <input className={input} type="number" value={siteDetails.roofWidth} onChange={(event) => setSiteDetail("roofWidth", event.target.value)} />
          </Field>
          <Field label="Usable length (m)">
            <input className={input} type="number" value={siteDetails.roofLength} onChange={(event) => setSiteDetail("roofLength", event.target.value)} />
          </Field>
          <Field label="Roof pitch (degrees)">
            <input className={input} type="number" value={siteDetails.roofPitch} onChange={(event) => setSiteDetail("roofPitch", event.target.value)} />
          </Field>
          <Field label="Shading">
            <select className={input} value={siteDetails.shading} onChange={(event) => setSiteDetail("shading", event.target.value)}>
              <option>None</option>
              <option>Morning shade</option>
              <option>Afternoon shade</option>
              <option>Heavy shade</option>
            </select>
          </Field>
          <Field label="Access method">
            <select className={input} value={siteDetails.roofAccess} onChange={(event) => setSiteDetail("roofAccess", event.target.value)}>
              <option>Standard ladder</option>
              <option>Scaffolding needed</option>
              <option>Harness / high-risk access</option>
            </select>
          </Field>
          <Field label="Obstructions">
            <input className={input} placeholder="Trees, vents, HVAC" value={siteDetails.roofObstructions} onChange={(event) => setSiteDetail("roofObstructions", event.target.value)} />
          </Field>
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
            </select>
          </Field>
          <Field label="Battery area">
            <select className={input} value={siteDetails.batteryArea} onChange={(event) => setSiteDetail("batteryArea", event.target.value)}>
              <option>Dry and ventilated</option>
              <option>Ventilation needed</option>
              <option>Unsuitable location</option>
            </select>
          </Field>
          <Field label="Array to inverter (m)">
            <input className={input} type="number" value={siteDetails.arrayToInverter} onChange={(event) => setSiteDetail("arrayToInverter", event.target.value)} />
          </Field>
          <Field label="Inverter to main DB (m)">
            <input className={input} type="number" value={siteDetails.inverterToDb} onChange={(event) => setSiteDetail("inverterToDb", event.target.value)} />
          </Field>
          <Field label="Inverter to battery (m)">
            <input className={input} type="number" value={siteDetails.inverterToBattery} onChange={(event) => setSiteDetail("inverterToBattery", event.target.value)} />
          </Field>
          <Field label="Cable route">
            <select className={input} value={siteDetails.cableRoute} onChange={(event) => setSiteDetail("cableRoute", event.target.value)}>
              <option>Easy</option>
              <option>Conduit / trunking</option>
              <option>Underground / multi-storey</option>
            </select>
          </Field>
        </Section>
        </div>
        <div hidden={activeStep !== 6}>
        <section className="rounded-3xl bg-slate-900 p-5">
          <h2 className="text-xl font-bold">Required evidence</h2>
          <p className="mt-1 text-sm text-slate-400">
            Capture objective evidence before analysis.
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
              Project comments and customer priorities
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
          <textarea
            className={`${input} min-h-28`}
            value={home.notes}
            onChange={(event) =>
              setHome({ ...home, notes: event.target.value })
            }
            placeholder="What must work during an outage? Budget, expansion, concerns, or special requests."
          />
        </section>
        <section className="mt-5 rounded-3xl border border-white/10 bg-slate-900 p-5">
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
          <b>Analyse Assessment with AI</b>
          <p className="mt-2 text-sm">
            Save the assessment inputs and submit all usage patterns, known
            values and uploaded evidence for review. The live sizing proposal
            below stays available and updates as staff correct readings.
          </p>
          <button
            type="button"
            onClick={analyseAssessment}
            disabled={!loads.length || isAnalysing}
            className="mt-4 w-full rounded-xl bg-cyan-400 py-4 font-black text-slate-950 disabled:opacity-50"
          >
            {isAnalysing
              ? "Analysing assessment..."
              : aiReview
                ? "Re-analyse assessment"
                : "Analyse assessment with AI"}
          </button>
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
        <section className="mt-5 rounded-3xl border border-cyan-400/30 bg-cyan-400/10 p-5">
          <h2 className="text-xl font-bold">Known-load summary</h2>
          <div className="mt-3 grid gap-3 text-lg font-bold sm:grid-cols-3">
            <span>{(connected / 1000).toFixed(2)} kW connected</span>
            <span>{(daily / 1000).toFixed(2)} kWh/day</span>
            <span>{unknown} unknown ratings</span>
          </div>
        </section>
        <section className="mt-5 rounded-3xl border border-emerald-400/30 bg-emerald-400/10 p-5">
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
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
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
                  detail={`Calculated PV requirement, then rounded up to ${panelCount} x 600 W panels. Expected average production: ${analysis.expectedSolarProductionKwh.toFixed(2)} kWh/day.`}
                />
                <ProposalMetric
                  label="Essential backup energy"
                  value={`${(systemEnergyWh / 1000).toFixed(2)} kWh`}
                  detail={`Uses each essential appliance's expected runtime during the ${backupHours}h outage target; estimated delivery is ${analysis.expectedBackupHours.toFixed(1)}h at the recorded essential-load profile.`}
                />
              </div>
              <div className="mt-5 rounded-2xl border border-amber-300/30 bg-slate-950/60 p-4 text-sm text-amber-100">
                <b>Before quotation:</b> Confirm all unknown nameplates,
                appliance surge data, roof capacity, shading, wiring and actual
                KPLC usage. This is a field planning recommendation, not a final
                electrical design or installation approval.
              </div>
            </>
          )}
        </section>
        <section className="mt-5 rounded-3xl border border-emerald-300/40 bg-emerald-400/10 p-5">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-200">
            Final step
          </p>
          <h2 className="mt-1 text-xl font-black">Customer & technician sign-off</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-200">
            Review the assessment, preliminary proposal and recommendation above together. Each person types their full name as an electronic signature before Betech generates the final report and shares the proposal.
          </p>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <Field label="Customer or authorised representative — electronic signature">
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
                <span>I have reviewed this assessment and understand that the recommendation is preliminary and subject to Betech&apos;s final quotation.</span>
              </label>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <Field label="Betech technician — verified electronic signature">
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
                <span>I confirm that these field inputs and the preliminary proposal were recorded during this site assessment.</span>
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
                  ? "Regenerate report & share proposal"
                  : "Generate report & share proposal"}
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
          onAnalyse={() => {
            changeStep(8, "complete");
            void analyseAssessment();
          }}
          canAnalyse={loads.length > 0}
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
    <section className="rounded-2xl border border-cyan-400/25 bg-slate-900/90 p-4">
      <p className="text-sm font-black text-cyan-100">
        Step {activeStep + 1} of {assessmentSteps.length} — {assessmentSteps[activeStep]}
      </p>
      <div className="mt-3 flex flex-wrap gap-x-2 gap-y-2 text-xs font-bold">
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
              className={`rounded px-1 py-0.5 text-left transition hover:bg-white/10 hover:text-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${
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
    </section>
  );
}

function WizardNavigation({
  activeStep,
  onBack,
  onSkip,
  onContinue,
  onAnalyse,
  canAnalyse,
}: {
  activeStep: number;
  onBack: () => void;
  onSkip: () => void;
  onContinue: () => void;
  onAnalyse: () => void;
  canAnalyse: boolean;
}) {
  if (activeStep === 8) {
    return (
      <nav className="flex justify-start">
        <button type="button" onClick={onBack} className="rounded-xl border border-white/20 px-4 py-3 font-bold">
          ← Back to assessment
        </button>
      </nav>
    );
  }
  if (activeStep === 7) {
    return (
      <nav className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="rounded-xl border border-white/20 px-4 py-3 font-bold">
          ← Back
        </button>
        <button type="button" onClick={onAnalyse} disabled={!canAnalyse} className="rounded-xl bg-cyan-400 px-5 py-3 font-black text-slate-950 disabled:opacity-40">
          Analyse Assessment with AI →
        </button>
      </nav>
    );
  }
  return (
    <nav className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onBack}
          disabled={activeStep === 0}
          className="rounded-xl border border-white/20 px-4 py-3 font-bold disabled:opacity-40"
        >
          ← Back
        </button>
        <button type="button" onClick={onSkip} className="rounded-xl border border-amber-300/40 px-4 py-3 font-bold text-amber-100">
          {activeStep === 4 ? "Skip — assess later" : "Skip section"}
        </button>
      </div>
      <button type="button" onClick={onContinue} className="rounded-xl bg-cyan-400 px-5 py-3 font-black text-slate-950">
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
    <article className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <b>{load.name} {index + 1}</b>
          <p className="mt-1 text-sm text-slate-300">
            {rating} · {load.details.area || load.period} · {usage}{load.essential ? " · Essential" : ""}
          </p>
        </div>
        <div className="flex gap-3 text-sm font-bold">
          <button type="button" onClick={onEdit} className="text-cyan-200">Edit</button>
          <button type="button" onClick={onRemove} className="text-rose-300">Remove</button>
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
    <section className="rounded-3xl bg-slate-900 p-5">
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
      className="mt-5 scroll-mt-5 rounded-2xl border border-cyan-400/30 bg-slate-950 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <b>
          {load.name} {index + 1}
        </b>
        <button type="button" onClick={onCancel} className="text-slate-300">
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
      <div className="mt-5 flex justify-end gap-3 border-t border-white/10 pt-4">
        <button type="button" onClick={onCancel} className="rounded-xl border border-white/20 px-4 py-3 font-bold">
          Cancel
        </button>
        <button type="button" onClick={onSave} className="rounded-xl bg-cyan-400 px-4 py-3 font-black text-slate-950">
          Save {load.name}
        </button>
      </div>
    </article>
  );
}
