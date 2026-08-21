import type { Metadata } from "next";
import { Banknote, CheckCircle2, MapPin, PackageCheck, Route, Truck, Wrench } from "lucide-react";
import ShopInformationPage, { type ShopInformationSection } from "@/app/shop/_components/ShopInformationPage";

export const metadata: Metadata = {
  title: "Delivery, Installation & Payment | Betech Solar Solutions",
  description: "Betech Solar delivery, countrywide solar installation, transport fees and flexible payment arrangements across Kenya.",
  alternates: { canonical: "https://www.betech.co.ke/delivery-installation-payment" },
};

const sections: ShopInformationSection[] = [
  {
    id: "delivery",
    title: "Delivery",
    icon: Truck,
    paragraphs: [
      "For customers within Nairobi, we can deliver using our rider or company van depending on the order size and quantity. Delivery can usually be arranged the same day or next day, subject to product availability, location and order requirements.",
      "For customers outside Nairobi, we deliver countrywide. Small and medium parcels can be sent through your preferred courier, including G4S, Wells Fargo or another courier serving your location.",
      "Large or heavy orders may require a lorry or other commercial transport. For larger projects and consignments, we may use our company van depending on the location, equipment, project size and installation requirements.",
    ],
  },
  {
    id: "transport-fees",
    title: "Transport and delivery fees",
    icon: Route,
    paragraphs: [
      "Where a rider, van, lorry or other dedicated transport is arranged, we may ask for the transport or delivery fee to be paid before dispatch. This confirms the delivery commitment and helps avoid failed deliveries after dedicated transport has been booked.",
      "Paying the transport fee does not necessarily mean the full product or project amount must be paid before delivery. Where applicable, the remaining amount can still follow the payment terms agreed for that order or project.",
    ],
    note: "Delivery cost and timing are confirmed before dispatch because they depend on location, parcel size, weight, urgency and transport method.",
  },
  {
    id: "installation",
    title: "Solar installation",
    icon: Wrench,
    paragraphs: [
      "Betech Solar delivers and installs solar systems countrywide. Once a project is confirmed, our team coordinates equipment, transportation and installation to complete the work within the shortest practical time.",
      "Timelines depend on location, project size, system complexity, product availability, site readiness and transportation requirements.",
      "Some advertised products and packages include installation, while others are supplied at the listed price without installation. Contact Customer Service before ordering to confirm what is included and the installation charge applicable to your location and system.",
    ],
  },
  {
    id: "payment",
    title: "Payment arrangements",
    icon: Banknote,
    paragraphs: ["Payment arrangements depend on the product, project, delivery location and terms confirmed before dispatch or installation."],
    bullets: [
      "Pay the full amount before delivery and installation.",
      "Pay an agreed deposit and clear the balance after installation.",
      "Pay the full amount after successful installation where approved and agreed in advance.",
      "Use an approved pre-delivery or after-delivery payment arrangement for eligible product orders.",
      "Use Lipa Pole Pole for eligible products, paying gradually and collecting or arranging delivery after full payment.",
    ],
    note: "Even where payment after delivery or installation is agreed, an advance transport fee may still be required for dedicated transport or certain locations.",
  },
  {
    id: "process",
    title: "From order to completion",
    icon: CheckCircle2,
    bullets: [
      "Choose a product or request a system quotation.",
      "Confirm stock, scope, installation inclusion and delivery location.",
      "Agree on payment and transport arrangements.",
      "Coordinate dispatch, delivery and site access.",
      "Complete installation, testing and commissioning where applicable.",
      "Receive your transaction records and after-sales guidance.",
    ],
  },
  {
    id: "confirmation",
    title: "What to confirm before paying",
    icon: PackageCheck,
    bullets: [
      "Product availability and the exact items included.",
      "Whether installation is included in the advertised price.",
      "Delivery charge, courier or dedicated transport method.",
      "Deposit, balance and payment due points.",
      "Expected delivery or installation timeline.",
      "Warranty and after-sales support applicable to the order.",
    ],
  },
  {
    id: "coverage",
    title: "Countrywide service",
    icon: MapPin,
    paragraphs: ["We coordinate product delivery and solar installations across Kenya for homes, businesses, farms and institutions. Remote or complex locations may require additional transport planning, site information or a preliminary site visit."],
  },
];

export default function DeliveryInstallationPaymentPage() {
  return (
    <ShopInformationPage
      eyebrow="Customer guide"
      title="Delivery, Installation & Payment"
      introduction="Betech Solar delivers products and installs solar systems countrywide across Kenya. We aim to make the process convenient and flexible, whether you are buying one product or commissioning a complete solar project."
      heroIcon={Truck}
      highlights={[
        { title: "Nairobi delivery", copy: "Rider or company van depending on product quantity and order size." },
        { title: "Countrywide coverage", copy: "Courier, commercial transport or project delivery arranged for your location." },
        { title: "Flexible terms", copy: "Payment timing is confirmed according to the product, project and agreed terms." },
      ]}
      sections={sections}
      supportTitle="Confirm your delivery, installation and payment terms"
      supportCopy="Contact Customer Service for delivery charges, installation costs, availability, payment arrangements or confirmation that installation is included in a package."
      whatsappMessage="Hello Betech Solar, I want to confirm delivery, installation and payment arrangements for an order."
    />
  );
}
