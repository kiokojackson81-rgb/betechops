import type { Metadata } from "next";
import {
  Activity,
  BadgeCheck,
  Banknote,
  CalendarCheck2,
  ClipboardCheck,
  MapPinned,
  Route,
} from "lucide-react";
import ShopInformationPage, {
  type ShopInformationSection,
} from "@/app/shop/_components/ShopInformationPage";
import { SHOP_SITE_VISIT_BOOKING_HREF } from "@/app/shop/storefrontPaths";

export const metadata: Metadata = {
  title: "Site Visits & Data Logger Assessments | Betech Solar Solutions",
  description:
    "Understand Betech Solar Site Visit fees, quotation credits, Data Logger assessments and how to book a technical site assessment anywhere in Kenya.",
  alternates: { canonical: "https://www.betech.co.ke/site-visit" },
};

const sections: ShopInformationSection[] = [
  {
    id: "what-is-a-site-visit",
    title: "What happens during a Site Visit",
    icon: ClipboardCheck,
    paragraphs: [
      "A Site Visit is a planned technical assessment before a solar installation or complex quotation. Our technician reviews the location, power requirements, roof or mounting area, cable routes, equipment position, access conditions and any risks that may affect the design or installation.",
      "The information collected helps Betech prepare a practical system recommendation and quotation based on the actual site instead of relying only on estimates provided by phone or WhatsApp.",
    ],
    bullets: [
      "Power-load and customer-requirement review.",
      "Roof, mounting area and available-space assessment.",
      "Cable routes, equipment location and installation-access review.",
      "Technical notes, measurements and supporting site evidence.",
    ],
  },
  {
    id: "site-visit-fees",
    title: "Site Visit fees",
    icon: Banknote,
    paragraphs: [
      "The standard fee is based on the service zone selected from your county and town. The exact amount is displayed in the booking form before you submit the request.",
    ],
    bullets: [
      "Zone 1 - Nairobi Metropolitan Area: KES 2,000.",
      "Zone 2 - Near-Nairobi Service Area: KES 5,000.",
      "Zone 3 - Long-Distance Service Area: KES 10,000.",
      "Special access, extended travel or unusual site requirements may require confirmation by Customer Service.",
    ],
    note: "The Site Visit fee must be verified before a technician and final appointment time are confirmed.",
  },
  {
    id: "why-we-charge",
    title: "Why Betech charges a Site Visit fee",
    icon: Route,
    paragraphs: [
      "Every visit uses skilled technical time and operational resources before any installation contract has been awarded. The fee contributes to technician preparation and assessment time, transport and fuel, field logistics, instruments and reporting. For distant work, it also helps cover reasonable accommodation, meals and other living expenses where these are required by the assignment.",
      "A paid booking also confirms that a proposed project is genuinely being planned. This allows us to prioritize committed customers and reduces speculative visits requested only to obtain a quotation without a planned project, while keeping technicians available for active customer work.",
    ],
  },
  {
    id: "quotation-credit",
    title: "Deduction from your final quotation",
    icon: BadgeCheck,
    paragraphs: [
      "If you proceed with Betech for the installation, the verified Site Visit fee is available as a one-time credit and is deducted from the final approved installation quotation. The quotation will show the Site Visit credit separately so the deduction is clear.",
      "The credit applies to the installation opportunity assessed during the visit and cannot be applied more than once. Data Logger charges are separate assessment charges and are not part of this quotation credit.",
    ],
    note: "Example: if your approved installation quotation is KES 250,000 and you paid a KES 5,000 Site Visit fee, the quotation can show a KES 5,000 Site Visit credit, leaving KES 245,000 subject to the agreed payment terms.",
  },
  {
    id: "data-logger",
    title: "Data Logger assessment",
    icon: Activity,
    paragraphs: [
      "A Data Logger records actual electricity use over time. It is useful where load patterns are not clear from appliance labels or where equipment starts, stops or changes demand during the day. Real usage data helps our engineers avoid under-sizing a system that cannot support the site or over-sizing one beyond the customer's needs.",
      "Data Logger monitoring is optional and is selected during booking when required. The charge is KES 5,000 per day for 1 to 3 days. The total is calculated automatically from the selected number of days and is paid separately from the standard Site Visit fee.",
    ],
    bullets: [
      "Measures actual load behaviour instead of relying only on estimates.",
      "Supports more accurate inverter, battery and solar-array sizing.",
      "Useful for businesses, machinery and sites with changing demand.",
      "KES 5,000 per day for a selectable 1 to 3 monitoring days.",
    ],
    note: "The Data Logger fee is a technical monitoring charge and is not deducted from the final installation quotation.",
  },
  {
    id: "booking-process",
    title: "How to book",
    icon: CalendarCheck2,
    bullets: [
      "Open the booking workspace and sign in securely using your phone OTP.",
      "Describe the project and provide the county, town, exact location and access details.",
      "Choose a preferred date and indicate whether Data Logger monitoring is required.",
      "Review the automatically calculated fees and submit the request.",
      "Complete payment and wait for Betech to verify it and confirm the technician and appointment time.",
      "Track the visit, payment and quotation progress from your customer account.",
    ],
  },
  {
    id: "prepare-for-visit",
    title: "Prepare for the technician",
    icon: MapPinned,
    paragraphs: [
      "To make the assessment productive, ensure the correct contact person is available and that the technician can access the relevant roof, electrical room, meter, distribution board, machinery or installation area safely.",
    ],
    bullets: [
      "Share an accurate Google Maps pin, landmark and access instructions.",
      "Have recent electricity bills or known appliance and equipment details available.",
      "Identify any future loads or planned expansion that should be included in the design.",
      "Inform us in advance about security clearance, working-hour or safety requirements.",
    ],
  },
];

export default function SiteVisitPage() {
  return (
    <ShopInformationPage
      eyebrow="Technical assessment"
      title="Book a professional solar Site Visit with clear fees and follow-up."
      introduction="A Site Visit gives our team the measurements, load information and site conditions needed to prepare a practical solar recommendation. Review the fees, quotation credit and optional Data Logger assessment before booking."
      heroIcon={MapPinned}
      highlights={[
        {
          title: "KES 2,000-10,000",
          copy: "Standard Site Visit fee based on your service zone.",
        },
        {
          title: "Credited to the job",
          copy: "The verified visit fee is deducted if you proceed with Betech for the installation.",
        },
        {
          title: "KES 5,000 per day",
          copy: "Optional Data Logger monitoring for 1 to 3 days.",
        },
      ]}
      sections={sections}
      primaryAction={{
        label: "Book a Site Visit",
        href: SHOP_SITE_VISIT_BOOKING_HREF,
      }}
      supportTitle="Not sure whether your project needs a Site Visit?"
      supportCopy="Contact Customer Service with your location, intended solar system and power requirements. We will help you decide whether a standard visit, Data Logger assessment or direct quotation is appropriate."
      whatsappMessage="Hello Betech Solar, I need guidance before booking a Site Visit."
    />
  );
}
