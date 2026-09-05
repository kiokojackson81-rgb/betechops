import type { Metadata } from "next";
import { AlertTriangle, ClipboardCheck, FileCheck2, PackageCheck, ShieldCheck, Wrench } from "lucide-react";
import ShopInformationPage, { type ShopInformationSection } from "@/app/shop/_components/ShopInformationPage";

export const metadata: Metadata = {
  title: "Warranty Support | Betech Solar Solutions",
  description: "Find out how your product or solar system warranty works, what may be covered, and how to get help if something goes wrong.",
  alternates: { canonical: "https://www.betech.co.ke/warranty-support" },
};

const sections: ShopInformationSection[] = [
  {
    id: "how-warranties-work",
    title: "How Your Warranty Works",
    icon: ShieldCheck,
    paragraphs: [
      "Warranty periods and coverage vary depending on the product, brand and installation package.",
      "Your specific warranty is shown on the relevant product information, quotation, invoice, receipt, warranty card or manufacturer documentation provided with your purchase.",
      "Some products have manufacturer warranties that Betech can assist you with, while installed solar systems may also have separate workmanship coverage.",
      "Keep your purchase and warranty documents so we can identify your product and assist you more quickly.",
    ],
  },
  {
    id: "what-is-covered",
    title: "What May Be Covered",
    icon: PackageCheck,
    paragraphs: ["Depending on the warranty provided with your product or project, coverage may include:"],
    bullets: [
      "Manufacturing defects in materials or workmanship.",
      "Covered components that fail during normal use.",
      "Repair or replacement of an eligible defective component.",
      "Installation workmanship issues where workmanship coverage was included with the project.",
    ],
    note: "The product or system may need to be inspected or tested before we can confirm whether the reported problem is covered by warranty.",
  },
  {
    id: "what-is-not-covered",
    title: "What May Not Be Covered",
    icon: AlertTriangle,
    paragraphs: ["Coverage depends on the warranty provided with your specific product. Common exclusions may include:"],
    bullets: [
      "Damage caused by misuse, neglect, accidents, fire, water or improper storage.",
      "Damage caused by incorrect wiring, overloading, incorrect voltage, power surges or lightning where these are not covered.",
      "Opening, modification, installation or repair by an unauthorized person.",
      "Normal wear and tear, consumable items or cosmetic damage.",
      "Removed or altered serial numbers, labels, seals or warranty information.",
      "Transport or handling damage that occurs after collection or accepted delivery, subject to the applicable terms.",
    ],
  },
  {
    id: "request-support",
    title: "How to Get Warranty Support",
    icon: ClipboardCheck,
    paragraphs: [
      "If your product or solar installation develops a problem, submit a report through our support page before opening, repairing or returning the product.",
      "To help us assist you, provide where available:",
    ],
    bullets: [
      "Your name and phone number.",
      "Receipt, order or project number.",
      "Product model and serial number.",
      "A description of the problem.",
      "Photos or a short video showing the issue.",
    ],
  },
  {
    id: "assessment-resolution",
    title: "What Happens After You Report an Issue",
    icon: Wrench,
    paragraphs: [
      "Our support team will review the information you provide and advise you on the next step. Depending on the issue, we may provide troubleshooting guidance, request additional information, arrange an inspection, request that the product be brought in, arrange a site visit, or refer the matter to the manufacturer.",
      "If the problem is covered by warranty, the available solution will depend on the warranty terms and the findings after inspection or testing. This may include repair, replacement of an eligible component, product replacement or manufacturer support.",
      "Some issues may take longer to resolve where testing, spare parts, a site visit or manufacturer assistance is required. We will keep you updated through the support process.",
    ],
  },
  {
    id: "documents",
    title: "Documents to Keep",
    icon: FileCheck2,
    bullets: [
      "Receipt, invoice or order confirmation.",
      "Quotation and project agreement for installed systems.",
      "Warranty card or manufacturer documentation.",
      "Product model and serial number.",
      "Installation, commissioning and service records.",
    ],
  },
];

export default function WarrantySupportPage() {
  return (
    <ShopInformationPage
      eyebrow="Customer Care"
      title="Warranty Support"
      introduction="Find out how your product or solar system warranty works, what may be covered, and how to get help if something goes wrong."
      heroIcon={ShieldCheck}
      highlights={[
        { title: "Keep Your Proof of Purchase", copy: "Keep your receipt, order number, warranty documents and product serial number where available. We may need these details when assisting you." },
        { title: "Report Problems Early", copy: "If you notice a problem, report it as soon as possible. Please contact us before opening, modifying or attempting to repair the product." },
        { title: "We’ll Check the Problem First", copy: "Our team will first assess the reported problem and advise you on the next step." },
      ]}
      sections={sections}
      supportTitle="Need to report an issue?"
      supportCopy="Report the issue through our support page and provide as much information as possible. This helps our team review the problem and advise you on the next step."
      whatsappMessage="Hello Betech Solar, I need warranty support for a product or solar installation."
      showWhatsAppSupport={false}
      primaryAction={{ label: "Report an Issue", href: "/support/report-issue" }}
    />
  );
}
