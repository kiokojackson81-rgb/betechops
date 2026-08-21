import type { Metadata } from "next";
import { AlertTriangle, ClipboardCheck, FileCheck2, PackageCheck, ShieldCheck, Wrench } from "lucide-react";
import ShopInformationPage, { type ShopInformationSection } from "@/app/shop/_components/ShopInformationPage";

export const metadata: Metadata = {
  title: "Warranty Support | Betech Solar Solutions",
  description: "Understand Betech Solar product and installation warranties, what they cover, exclusions, and how to request warranty assessment and support.",
  alternates: { canonical: "https://www.betech.co.ke/warranty-support" },
};

const sections: ShopInformationSection[] = [
  {
    id: "how-warranties-work",
    title: "How our warranties work",
    icon: ShieldCheck,
    paragraphs: [
      "Warranty periods and terms differ by product, brand and installation package. The applicable warranty is the one shown on the product listing, quotation, invoice, receipt, warranty card or manufacturer documentation supplied with your order.",
      "Some products carry a manufacturer warranty administered with our assistance, while installation workmanship may have separate cover. Keep your receipt and any serial-number or warranty documentation because these help us verify the purchase and assess a claim quickly.",
    ],
  },
  {
    id: "what-is-covered",
    title: "What a general warranty may cover",
    icon: PackageCheck,
    paragraphs: ["Subject to the specific product terms, a valid warranty generally addresses confirmed faults that arise during normal use within the stated warranty period."],
    bullets: [
      "Manufacturing defects in materials or workmanship.",
      "A covered component that fails under normal operating conditions.",
      "Repair or replacement of an eligible defective part after technical assessment.",
      "Installation workmanship issues where a Betech workmanship warranty was included in the project agreement.",
    ],
    note: "A warranty does not automatically guarantee an immediate replacement. The product or system must first be inspected and the fault confirmed under the applicable terms.",
  },
  {
    id: "what-is-not-covered",
    title: "What is generally not covered",
    icon: AlertTriangle,
    paragraphs: ["The exact exclusions depend on the brand and product, but warranties normally do not cover damage or failure caused by circumstances outside a manufacturing or covered workmanship defect."],
    bullets: [
      "Misuse, neglect, accidental damage, impact, fire, water ingress or improper storage.",
      "Incorrect wiring, overloading, wrong voltage, power surges, lightning or unstable supply unless specifically covered.",
      "Installation, opening, modification or repair by an unauthorized person.",
      "Normal wear, consumables, cosmetic damage or expected reduction in performance over time.",
      "Removed or altered serial numbers, seals, labels, receipts or warranty records.",
      "Transport damage after collection or delivery acceptance unless reported promptly and verified.",
    ],
  },
  {
    id: "request-support",
    title: "How to request warranty support",
    icon: ClipboardCheck,
    paragraphs: ["Contact Betech Customer Service before sending, opening or repairing the item. Clear information helps our team identify the product and organize the right assessment."],
    bullets: [
      "Share your name, phone number, receipt or order number and purchase date.",
      "Provide the product model, serial number and a clear description of the fault.",
      "Send clear photos or a short video showing the product and the reported problem where possible.",
      "Follow the return, site-visit or diagnostic instructions provided by our support team.",
    ],
  },
  {
    id: "assessment-resolution",
    title: "Assessment and resolution",
    icon: Wrench,
    paragraphs: [
      "Our team or the relevant manufacturer will inspect or test the item. Depending on the confirmed fault and applicable terms, the resolution may be repair, replacement of a covered component, product replacement, further manufacturer review or a quotation for a non-warranty repair.",
      "Assessment time depends on the product, fault, spare-parts availability, location and whether manufacturer approval is required. Delivery, collection, site-visit or transport costs are handled according to the applicable warranty and the outcome of the assessment.",
    ],
  },
  {
    id: "documents",
    title: "Documents to keep",
    icon: FileCheck2,
    bullets: [
      "Original receipt, invoice or order confirmation.",
      "Quotation and project agreement for installed systems.",
      "Warranty card and manufacturer documentation.",
      "Product model and serial-number records.",
      "Installation, commissioning and service records where applicable.",
    ],
  },
];

export default function WarrantySupportPage() {
  return (
    <ShopInformationPage
      eyebrow="Customer care"
      title="Warranty support that starts with clear information."
      introduction="Understand the warranty attached to your product or solar project, what is normally covered, common exclusions and the steps to request a fair technical assessment."
      heroIcon={ShieldCheck}
      highlights={[
        { title: "Keep proof of purchase", copy: "Your receipt, order reference and serial number help us verify cover." },
        { title: "Report the fault early", copy: "Contact us before opening, modifying or sending the product for repair." },
        { title: "Assessment first", copy: "Repair or replacement follows technical confirmation and the applicable warranty." },
      ]}
      sections={sections}
      supportTitle="Need to report a product or installation fault?"
      supportCopy="Send our Customer Service Team your receipt or order number, product details, serial number and a clear description of the issue."
      whatsappMessage="Hello Betech Solar, I need warranty support for a product or solar installation."
    />
  );
}
