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
    title: "What We Assess During the Site Visit",
    icon: ClipboardCheck,
    paragraphs: [
      "A Site Visit is a technical assessment carried out before a solar installation or complex quotation. Our technician assesses your power requirements, installation location, roof or mounting area, cable routes, proposed equipment locations, access conditions and other factors that may affect the system design or installation.",
      "The information collected allows Betech to prepare a practical solar recommendation and quotation based on the actual conditions at your site.",
    ],
    bullets: [
      "Assessment of your electrical loads and power requirements.",
      "Roof, mounting area and available-space assessment.",
      "Cable routes, equipment locations and installation-access assessment.",
      "Site measurements, photos and technical information required for system design.",
    ],
  },
  {
    id: "site-visit-fees",
    title: "Site Visit Fees",
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
    note: "Payment must be confirmed before the Site Visit appointment and technician assignment are finalized.",
  },
  {
    id: "why-we-charge",
    title: "Why We Charge a Site Assessment Fee",
    icon: Route,
    paragraphs: [
      "Every Site Visit requires technician time, transport, technical assessment and preparation before an installation begins. The Site Visit fee helps cover the resources required to carry out a proper assessment and prepare an informed solar recommendation based on the actual conditions at your property.",
      "For long-distance assessments, the fee also contributes towards the additional transport, travel and field logistics required to deploy our technical team.",
      "The Site Visit fee also helps us prioritize customers who are actively planning a solar installation and ensures our technicians have adequate time to carry out each assessment professionally.",
    ],
  },
  {
    id: "quotation-credit",
    title: "Site Visit Fee Credit",
    icon: BadgeCheck,
    paragraphs: [
      "If you proceed with Betech for the installation, the Site Visit fee you paid will be deducted from your final installation cost. The deduction will be shown separately on your quotation so that the credit is clear.",
      "The credit applies only to the project assessed during the Site Visit and can only be applied once. Data Logger charges are separate and are not deducted from the installation cost.",
    ],
    note: "Example: If your installation quotation is KES 250,000 and you paid a KES 5,000 Site Visit fee, a KES 5,000 Site Visit credit will be applied, leaving a balance of KES 245,000, subject to the agreed payment terms.",
  },
  {
    id: "data-logger",
    title: "Data Logger Assessment",
    icon: Activity,
    paragraphs: [
      "A Data Logger measures your site's actual electricity consumption over a selected period. It is particularly useful where power requirements cannot be accurately determined from appliance ratings alone or where equipment starts, stops or operates at different loads throughout the day.",
      "The recorded consumption data helps our technical team recommend appropriate inverter capacity, battery storage and solar-panel capacity while reducing the risk of under-sizing or unnecessarily over-sizing the system.",
      "Data Logger monitoring is optional and can be selected during booking when required. Charge: KES 5,000 per day for 1 to 3 days.",
    ],
    bullets: [
      "Measures actual power consumption rather than relying only on estimates.",
      "Helps determine appropriate inverter, battery and solar-array capacity.",
      "Recommended for businesses, machinery and sites with varying power requirements.",
      "Monitoring period can be selected from 1 to 3 days.",
      "KES 5,000 per monitoring day.",
    ],
    note: "The Data Logger fee is a separate technical monitoring charge and is not deducted from the final installation cost.",
  },
  {
    id: "booking-process",
    title: "How to Book",
    icon: CalendarCheck2,
    bullets: [
      "Open the Site Visit booking form and sign in using the verification code sent to your phone.",
      "Tell us about your project and provide your county, town, exact location and access details.",
      "Select your preferred Site Visit date.",
      "Choose whether you require optional Data Logger monitoring.",
      "Review the automatically calculated Site Visit and Data Logger fees.",
      "Submit your request and complete payment.",
      "Once payment is confirmed, Betech will assign a technician and confirm your appointment.",
      "Track your Site Visit, payment status and quotation from your customer account.",
    ],
  },
  {
    id: "prepare-for-visit",
    title: "How to Prepare for Your Site Visit",
    icon: MapPinned,
    paragraphs: [
      "To help our technician complete the assessment efficiently, please ensure the appropriate contact person is available and that safe access can be provided to the areas relevant to the proposed installation.",
    ],
    bullets: [
      "Share an accurate Google Maps pin, landmark and access instructions.",
      "Have recent electricity bills available where possible.",
      "Provide appliance, machinery or equipment details where available.",
      "Ensure access to the meter, distribution board, roof, electrical room and proposed installation areas where applicable.",
      "Tell the technician about any future electrical loads or planned expansion.",
      "Inform Betech in advance about security clearance, restricted working hours or special safety requirements.",
    ],
  },
];

export default function SiteVisitPage() {
  return (
    <ShopInformationPage
      eyebrow="SOLAR SITE ASSESSMENT"
      title="Book a Professional Solar Site Visit"
      introduction="Our technical team will assess your electrical loads, site conditions, installation requirements and available space to recommend a solar system that is properly sized for your needs. Site Visit fees are based on your location and are deducted from your installation cost when you proceed with Betech."
      heroIcon={MapPinned}
      highlights={[
        {
          title: "KES 2,000-10,000",
          copy: "Site Visit fee based on your service zone.",
        },
        {
          title: "Deducted from Installation Cost",
          copy: "Your Site Visit fee is deducted from the final installation cost when you proceed with Betech.",
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
      supportCopy="Contact Betech Customer Service with your location, solar requirements and information about the equipment or property you want to power. Our team will advise whether you need a standard Site Visit, a Data Logger assessment or whether we can prepare an initial quotation without a Site Visit."
      whatsappMessage="Hello Betech Solar, I need guidance before booking a Site Visit."
    />
  );
}
