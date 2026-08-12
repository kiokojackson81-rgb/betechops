export type PublicTermsSection = {
  number: number;
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  steps?: string[];
};

export const TERMS_EFFECTIVE_DATE = "12 August 2026";
export const TERMS_VERSION = "1.0";

export const TERMS_TITLE =
  "Betech Solar Solutions Solar System Installation, Performance, Warranty & After-Sales Terms & Conditions";

export const TERMS_SHORT_NOTICE =
  "By engaging Betech Solar Solutions, making payment, requesting delivery or installation, or allowing our technicians to proceed with installation after these Terms have been made available to you, you confirm that you accept these Terms and Conditions, subject to applicable Kenyan law.";

export const TERMS_INTRODUCTION = [
  "Thank you for choosing Betech Solar Solutions.",
  "We understand that investing in solar power is an important decision for your home, business, institution, farm or project.",
  "Our objective is to provide professionally installed, safe and dependable solar solutions together with practical technical guidance and reliable after-sales support.",
  "These Terms and Conditions explain our installation standards, system performance expectations, workmanship support, manufacturer warranty procedures, customer responsibilities and the process we follow when technical assistance is required.",
  "Our aim is to identify the actual cause of any reported issue and provide the appropriate solution.",
];

export const PUBLIC_TERMS_SECTIONS: PublicTermsSection[] = [
  {
    number: 1,
    title: "Betech Installation Commitment",
    paragraphs: [
      "Depending on the purchased system, package or other agreed scope, Betech may provide professionally planned and executed solar installation works as part of the transaction.",
      "The exact items supplied and installed depend on what the customer actually purchased or otherwise agreed with Betech.",
    ],
    bullets: [
      "Solar panel installation",
      "Mounting structures",
      "PV/DC cabling",
      "Inverter installation",
      "Battery installation",
      "Battery cabling",
      "DC breakers / isolators",
      "AC breakers / isolators",
      "AVS where included",
      "SPD where included",
      "Appropriate system protection included in the purchased scope",
      "Connection to the agreed distribution board / consumer unit",
      "System configuration",
      "Testing",
      "Commissioning",
      "Basic operating guidance where appropriate",
    ],
  },
  {
    number: 2,
    title: "Testing, Commissioning & Handover",
    paragraphs: [
      "Betech normally tests the system after installation as part of installation completion and handover.",
      "Once the system has been installed, tested and found to be operating normally, it is considered commissioned and handed over.",
      "Any later concern is handled under Betech’s after-sales, workmanship and warranty procedures.",
    ],
    bullets: [
      "PV input",
      "Battery operation",
      "Inverter operation",
      "AC output",
      "Grid/KPLC input where applicable",
      "Charging/discharging",
      "Protection equipment",
      "Communication between compatible devices",
      "Basic system configuration",
    ],
  },
  {
    number: 3,
    title: "Betech After-Sales Support",
    paragraphs: [
      "Depending on system size, package and installation type, Betech may provide approximately 6 months to 1 year of complimentary workmanship / after-sales support.",
      "This complimentary workmanship support is separate from the manufacturer’s product warranty.",
      "Complimentary support may cover confirmed installation-related issues once the actual cause has been established.",
      "Complimentary support does not automatically mean that every electrical problem becomes Betech’s responsibility, that immediate or same-day technician dispatch will occur, that internal house wiring repairs are free, that product replacement is automatic, that upgrades are free, that transport is always free, or that a refund automatically applies.",
    ],
    bullets: [
      "Installation connection issue",
      "Incorrect Betech system-side wiring",
      "Installation-related configuration issue",
      "Loose connection attributable to Betech workmanship",
      "Installation-related communication issue between compatible components",
    ],
  },
  {
    number: 4,
    title: "After-Sales Technical Support Process",
    paragraphs: [
      "Betech follows a technical review process intended to identify the actual cause of a reported issue before the remedy is determined.",
      "Customers must not open dangerous electrical equipment or undertake unsafe electrical work during remote troubleshooting.",
      "If remote diagnosis cannot reasonably resolve the issue and a physical inspection of Betech’s installation appears necessary, Betech may arrange a technician site visit subject to practical scheduling and safety considerations.",
    ],
    steps: [
      "Step 1: Customer reports the issue.",
      "Step 2: Betech may request photos, video, inverter display, battery display, battery percentage / SOC, PV reading, load reading, grid reading, AVS reading, breaker position, fault/error code, warning messages and appliances currently operating.",
      "Step 3: Betech technical team reviews the information.",
      "Step 4: Betech may provide phone or video-call troubleshooting.",
      "Step 5: If Betech reasonably determines the issue appears related to internal wiring, a customer appliance or another matter outside Betech’s solar system, Betech may advise the customer to contact their own qualified electrician. Where practical, Betech may liaise with the customer’s electrician.",
      "Step 6: If physical inspection is needed, Betech may schedule a technician visit based on technician availability, customer location, travel distance, existing installation schedule, existing service schedule, access, safety, the nature of the fault and reasonable scheduling.",
    ],
  },
  {
    number: 5,
    title: "Chargeable Site Visits",
    paragraphs: [
      "If a technician visits and determines that Betech’s installation is operating correctly and the problem relates to something outside Betech workmanship, charges may apply.",
      "Where practical, significant chargeable work should be communicated before it is undertaken.",
    ],
    bullets: [
      "Internal house wiring",
      "Faulty customer appliance",
      "Customer overload",
      "Added electrical loads",
      "Third-party modifications",
      "Customer-changed inverter settings",
      "Grid/KPLC issue",
      "Lightning or severe electrical surge",
      "Physical damage",
      "Work outside the original installation scope",
      "Transport",
      "Call-out",
      "Diagnosis",
      "Labour",
      "Materials",
      "Repair",
    ],
  },
  {
    number: 6,
    title: "How Solar Systems May Be Selected",
    paragraphs: [
      "Betech does not always conduct a physical site assessment or issue a formal quotation before a customer purchases a solar system.",
      "A site assessment or formal quotation is therefore not required for these Terms to apply.",
    ],
    bullets: [
      "Physical site assessment",
      "Remote assessment",
      "Customer-selected system",
      "Budget-based system",
      "Space-limited system",
      "Future-upgrade system",
      "WhatsApp / phone / shop order",
      "Invoice or direct agreed price",
    ],
  },
  {
    number: 7,
    title: "Customer-Requested Systems",
    paragraphs: [
      "A customer may request a specific system, including a specific inverter, battery capacity and number of panels.",
      "Where the customer selects the system without Betech completing a detailed load assessment, Betech cannot guarantee that undisclosed energy requirements will be satisfied.",
      "Betech may still provide reasonable guidance where sufficient information is provided.",
    ],
  },
  {
    number: 8,
    title: "Betech System Recommendations",
    paragraphs: [
      "Where Betech makes a recommendation, it is based on information reasonably available at that time and is intended to guide the customer toward a practical system choice.",
    ],
    bullets: [
      "Appliance list",
      "Appliance wattage",
      "Simultaneous load",
      "Daily electricity use",
      "Previous KPLC usage",
      "Required backup duration",
      "Day consumption",
      "Night consumption",
      "Battery capacity",
      "Inverter size",
      "Solar array size",
      "Available installation space",
      "Roof/ground area",
      "Future expansion",
    ],
  },
  {
    number: 9,
    title: "Customer Information Responsibility",
    paragraphs: [
      "The customer should provide accurate information about electricity use, appliance load and expected backup requirements.",
      "If the customer does not disclose relevant loads or later significantly increases consumption, the original system may no longer be sufficient.",
    ],
    bullets: [
      "Appliances",
      "Electricity usage",
      "Expected backup requirements",
      "High-power appliances",
      "Future appliances",
      "Pumps",
      "Electric cookers",
      "Instant showers",
      "Water heaters",
      "Air conditioners",
      "Ovens",
      "Washing machines",
      "Machinery",
      "Other major loads",
    ],
  },
  {
    number: 10,
    title: "Recommended System vs Customer-Selected System",
    paragraphs: [
      "If Betech recommends a larger system but the customer chooses a smaller one because of budget, roof space, available installation space, preference, equipment availability, immediate needs or intention to upgrade later, the customer accepts that the selected system may have performance limitations.",
      "A system being smaller than the customer’s eventual requirements does not automatically make it defective.",
    ],
    bullets: [
      "Shorter battery backup",
      "Faster battery discharge",
      "Lower solar generation",
      "Slower battery recharge",
      "Continued KPLC usage",
      "Reduced ability to run multiple high-load appliances",
      "Need for future expansion",
    ],
  },
  {
    number: 11,
    title: "Inverter Capacity",
    paragraphs: [
      "Inverter capacity is commonly measured in watts or kilowatts.",
      "For example, a 5kW inverter represents approximately 5,000W rated inverter capacity, subject to manufacturer specifications.",
      "This rating relates mainly to the amount of electrical load the inverter can support. It does not represent battery capacity or guaranteed backup duration.",
    ],
  },
  {
    number: 12,
    title: "Inverter Surge and Overload",
    paragraphs: [
      "Some appliances require higher starting power than their normal running power.",
      "If the load exceeds inverter operating limits, the inverter may alarm, display overload, disconnect output, restart or enter protection mode.",
      "This does not automatically mean the inverter is defective.",
    ],
    bullets: [
      "Pumps",
      "Refrigerators",
      "Freezers",
      "Air conditioners",
      "Compressors",
      "Motors",
    ],
  },
  {
    number: 13,
    title: "Battery Capacity",
    paragraphs: [
      "Battery capacity is commonly measured in kWh.",
      "A nominal 10kWh battery represents approximately 10 units of nominal stored energy when fully charged.",
      "Actual usable capacity may be affected by battery management system behaviour, reserve settings, state of charge, inverter efficiency, manufacturer limits, temperature, battery condition and system settings.",
    ],
  },
  {
    number: 14,
    title: "Battery Backup Expectations",
    paragraphs: [
      "There is no guaranteed fixed backup duration simply based on battery size because backup depends heavily on the electrical load.",
      "If approximately 10kWh of usable energy is available, then at 1kW average load the theoretical runtime is approximately 10 hours, at 2kW it is approximately 5 hours, and at 4kW it is approximately 2.5 hours.",
      "Actual runtime may be lower due to inverter losses, battery operating limits, changing loads, temperature, battery state of charge and manufacturer settings.",
      "Betech cannot promise fixed backup hours unless the electrical load is also defined.",
    ],
  },
  {
    number: 15,
    title: "Battery Bars / SOC",
    paragraphs: [
      "Battery bars or percentage readings may depend on battery communication, voltage, battery chemistry, BMS calculations, load, state of charge and inverter settings.",
      "A sudden display change does not automatically establish battery failure.",
    ],
  },
  {
    number: 16,
    title: "Solar Panel Capacity",
    paragraphs: [
      "Solar array capacity is commonly calculated as the number of panels multiplied by the panel rated wattage.",
      "For example, 8 panels x 600W = 4,800W = approximately 4.8kWp rated array.",
      "Rated output is measured under standardized test conditions.",
    ],
  },
  {
    number: 17,
    title: "Actual Solar Production",
    paragraphs: [
      "Actual solar production varies and Betech does not guarantee continuous full panel rating.",
    ],
    bullets: [
      "Sunlight intensity",
      "Time of day",
      "Cloud cover",
      "Rain",
      "Temperature",
      "Panel orientation",
      "Panel angle",
      "Shade",
      "Dust",
      "Dirt",
      "Bird droppings",
      "Seasonal changes",
      "Cable and conversion losses",
    ],
  },
  {
    number: 18,
    title: "Solar Energy Flow",
    paragraphs: [
      "Depending on inverter settings, solar electricity may first supply the active house or business load, and only surplus solar energy may remain to charge the battery.",
      "For example, if solar generation is 4kW and customer load is 3kW, then approximately 1kW remains before losses and other system considerations for battery charging.",
      "If customer load rises close to 4kW, very little surplus solar energy may remain for charging. This is normal operation.",
    ],
  },
  {
    number: 19,
    title: "Solar Lower Than Load",
    paragraphs: [
      "If solar generation is lower than current load, the difference may be supplied by the battery, KPLC/grid or another configured source depending on the system settings.",
      "This does not automatically indicate a fault.",
    ],
  },
  {
    number: 20,
    title: "Larger Battery Requires Adequate Charging",
    paragraphs: [
      "Installing more battery storage does not automatically solve solar generation limitations.",
      "A larger battery requires enough solar or grid energy to recharge.",
      "Where the customer increases battery storage significantly, additional solar panels may also be recommended.",
    ],
  },
  {
    number: 21,
    title: "Solar Performance Expectations",
    paragraphs: [
      "Betech does not guarantee continuous maximum solar production because solar performance naturally varies.",
      "Any daily-generation estimate is an estimate unless specifically guaranteed in writing.",
    ],
  },
  {
    number: 22,
    title: "Electricity Savings",
    paragraphs: [
      "Betech does not guarantee a particular reduction in KPLC bills unless explicitly agreed in writing.",
      "Actual savings depend on consumption, solar generation, battery usage, weather, system size, customer behaviour and electricity tariffs.",
    ],
  },
  {
    number: 23,
    title: "KPLC / Grid Interaction",
    paragraphs: [
      "Hybrid systems may use solar, battery and KPLC/grid according to system settings and available energy.",
      "Solar installation does not automatically mean the customer will stop purchasing KPLC electricity.",
    ],
  },
  {
    number: 24,
    title: "Standard Installation Boundary",
    paragraphs: [
      "Unless additional electrical work is specifically included, Betech’s standard solar installation generally connects the supplied solar system to the customer’s appropriate distribution board, consumer unit or agreed main connection point.",
      "Betech does not automatically rewire the entire premises.",
    ],
  },
  {
    number: 25,
    title: "Internal House / Building Wiring",
    paragraphs: [
      "Pre-existing internal wiring remains the customer’s responsibility unless Betech has expressly agreed to repair or replace it.",
      "Betech connecting solar to the property does not amount to certification of the entire internal electrical installation.",
    ],
    bullets: [
      "Short circuits",
      "Damaged wires",
      "Faulty sockets",
      "Faulty switches",
      "Loose connections",
      "Earth leakage",
      "Overloaded circuits",
      "Incorrect wiring",
      "Poor circuit separation",
      "Existing DB issues",
      "Faulty appliances",
    ],
  },
  {
    number: 26,
    title: "Internal Wiring Can Trigger Inverter Errors",
    paragraphs: [
      "An internal short circuit may cause the inverter to detect an abnormal condition, activate protection, trip or show an error.",
      "This may mean the inverter is correctly protecting the system rather than being defective.",
    ],
  },
  {
    number: 27,
    title: "Customer Electrician",
    paragraphs: [
      "Where an internal wiring issue is identified or reasonably suspected, Betech may advise the customer to engage their qualified electrician.",
      "Betech recommends the customer’s electrician be available during installation where substantial internal electrical work is likely to be required.",
    ],
  },
  {
    number: 28,
    title: "Betech Working With Customer Electrician",
    paragraphs: [
      "Betech may, where practical, liaise with the customer’s electrician to explain the solar connection, inverter behaviour, relevant fault readings and system requirements.",
      "This does not transfer responsibility for internal wiring to Betech.",
    ],
  },
  {
    number: 29,
    title: "Protective Devices",
    paragraphs: [
      "Depending on system design and purchased scope, Betech may install relevant protective devices.",
      "Not every device is included in every installation.",
    ],
    bullets: [
      "DC breaker",
      "DC isolator",
      "AC breaker",
      "AC isolator",
      "SPD",
      "AVS",
      "Battery protection",
      "Combiner protection",
      "Other applicable protection",
    ],
  },
  {
    number: 30,
    title: "Protection Items Not Included",
    paragraphs: [
      "If an AVS, SPD, lightning arrestor, additional breaker, isolator, special earthing system or other protection device was not part of the agreed installation, the customer may request it later at an additional cost.",
    ],
  },
  {
    number: 31,
    title: "Earthing",
    paragraphs: [
      "Where an appropriate existing site earthing system exists, Betech may connect the solar installation to it.",
      "If suitable earthing does not exist, Betech may advise the customer to arrange proper earthing through a qualified electrician.",
      "Betech may provide additional earthing as separate chargeable work where agreed.",
    ],
  },
  {
    number: 32,
    title: "Lightning Protection",
    paragraphs: [
      "Betech recommends suitable lightning protection where appropriate.",
      "A dedicated lightning arrestor or lightning protection system may not be included in the standard solar package.",
      "Breakers, AVS and SPD cannot guarantee complete protection against direct lightning strikes or extreme electrical events.",
    ],
  },
  {
    number: 33,
    title: "Customer Responsibilities After Installation",
    paragraphs: [
      "After handover, the customer should operate the system responsibly and within rated limits.",
    ],
    bullets: [
      "Operate system within rated limits",
      "Avoid intentional overloading",
      "Seek advice before adding major loads",
      "Keep inverter appropriately ventilated",
      "Keep battery dry/protected",
      "Keep equipment accessible",
      "Keep panels reasonably clean",
      "Report unusual faults",
      "Avoid unauthorized system modification",
    ],
  },
  {
    number: 34,
    title: "Third-Party Modifications",
    paragraphs: [
      "Betech is not responsible for faults introduced by another electrician or technician after handover.",
      "Unauthorized modifications may affect complimentary support where the modification contributes to the issue.",
    ],
    bullets: [
      "Rewiring",
      "Changed inverter settings",
      "Bypassed protection",
      "Incompatible batteries",
      "Incompatible panels",
      "Equipment relocation",
      "Altered earthing",
    ],
  },
  {
    number: 35,
    title: "Manufacturer Warranty",
    paragraphs: [
      "Inverters, batteries, panels and other equipment may have separate manufacturer warranties.",
      "Warranty duration depends on the brand, model, product and manufacturer terms.",
      "Manufacturer warranty is separate from Betech’s complimentary workmanship support.",
    ],
  },
  {
    number: 36,
    title: "Warranty Claim Process",
    paragraphs: [
      "For a warranty review, the customer may be required to provide relevant diagnostic and transaction information.",
      "The item may require remote testing, site testing, workshop testing, supplier testing or manufacturer testing before the cause is confirmed.",
    ],
    bullets: [
      "Proof of purchase",
      "Serial number",
      "Photos",
      "Video",
      "Fault codes",
      "Readings",
      "System information",
      "Load information",
    ],
  },
  {
    number: 37,
    title: "No Automatic Product Replacement",
    paragraphs: [
      "A customer reporting an item as faulty does not automatically establish a defect or immediate entitlement to replacement.",
      "Diagnosis may first be required.",
    ],
  },
  {
    number: 38,
    title: "Diagnostic Substitution",
    paragraphs: [
      "Where appropriate, Betech may test or temporarily substitute compatible equipment to help identify whether the reported behaviour follows the equipment or remains with the installation or load.",
    ],
  },
  {
    number: 39,
    title: "Manufacturer Decision",
    paragraphs: [
      "Where warranty approval rests with the manufacturer or distributor, Betech cannot guarantee approval before their assessment is complete.",
    ],
    bullets: [
      "Repair",
      "Component replacement",
      "Product replacement",
      "Manufacturer service",
      "Supplier service",
      "Other applicable warranty remedy",
    ],
  },
  {
    number: 40,
    title: "After Betech Complimentary Support Period",
    paragraphs: [
      "Manufacturer warranty may continue after Betech’s complimentary support ends.",
      "Betech may still provide reasonable guidance, but free site visits, removal or reinstallation are not automatically included for the full manufacturer warranty period.",
    ],
  },
  {
    number: 41,
    title: "Customer Electrician Removing Product",
    paragraphs: [
      "After Betech’s complimentary support period, Betech may advise the customer to use their own qualified electrician to safely remove suspected faulty equipment.",
      "The item may then be delivered to Betech’s designated shop or service point, or taken to or referred to an authorized manufacturer or distributor service centre.",
    ],
  },
  {
    number: 42,
    title: "Costs After Complimentary Support",
    paragraphs: [
      "Unless covered by warranty or separately agreed, the customer may be responsible for equipment removal, reinstallation, electrician fees, technician travel, transport, courier and other service costs.",
    ],
  },
  {
    number: 43,
    title: "Warranty / Support Exclusions",
    paragraphs: [
      "Complimentary Betech workmanship support may not cover events or conditions outside Betech workmanship.",
      "Manufacturer warranties may have their own additional exclusions.",
    ],
    bullets: [
      "Internal wiring",
      "Misuse",
      "Overloading",
      "Third-party modifications",
      "Unauthorized repair",
      "Customer changed settings",
      "Fire",
      "Flood",
      "Water damage",
      "Physical damage",
      "Lightning",
      "Extreme electrical events",
      "Rodent/pest damage",
      "Faulty customer appliances",
    ],
  },
  {
    number: 44,
    title: "System Upgrades",
    paragraphs: [
      "Solar systems can often be expanded or upgraded depending on compatibility and site conditions.",
    ],
    bullets: [
      "Additional solar panels",
      "Additional battery",
      "Larger battery",
      "Larger inverter",
      "Additional inverter",
      "Additional protection",
      "Additional mounting",
      "Additional cabling",
    ],
  },
  {
    number: 45,
    title: "Capacity Limitation vs Defect",
    paragraphs: [
      "A solar system can be functioning correctly and still be smaller than the customer’s current energy requirements.",
      "Insufficient backup or generation caused by insufficient system size does not automatically mean equipment is defective.",
    ],
  },
  {
    number: 46,
    title: "Upgrades Are Chargeable",
    paragraphs: [
      "Additional capacity outside the original purchase is normally chargeable unless Betech has expressly agreed otherwise in writing.",
    ],
  },
  {
    number: 47,
    title: "Additional Work",
    paragraphs: [
      "Additional charges may apply for work outside the original installation scope unless specifically included.",
    ],
    bullets: [
      "Internal rewiring",
      "DB modifications",
      "Circuit separation",
      "Additional cable runs",
      "Equipment relocation",
      "Panel relocation",
      "Additional protection",
      "Additional accessories",
      "Additional mounting",
      "Construction-related work",
      "Additional earthing",
      "Expansion work",
    ],
  },
  {
    number: 48,
    title: "Completed Installations",
    paragraphs: [
      "Solar installation includes more than the sale of unopened goods.",
      "It may include equipment allocation, transport, mounting, wiring, configuration, programming, labour, accessories, integration with the property and commissioning.",
      "Once supplied, installed, commissioned and handed over, the installation is generally considered completed.",
    ],
  },
  {
    number: 49,
    title: "Refunds",
    paragraphs: [
      "Completed installations are generally non-refundable merely because the customer later wants longer battery backup, more solar production, a larger inverter, a different system size, more grid independence or additional appliances.",
      "Where the system is operating according to its purchased capacity, the normal solution may be a chargeable upgrade.",
      "Nothing in this clause is intended to remove any refund, repair, replacement or other remedy that the customer is entitled to under applicable Kenyan law.",
    ],
  },
  {
    number: 50,
    title: "Genuine Defects",
    paragraphs: [
      "Where a genuine qualifying workmanship or equipment defect exists, Betech will follow the appropriate workmanship support process, manufacturer warranty process or applicable legal remedy.",
    ],
  },
  {
    number: 51,
    title: "Cancellation Before Installation",
    paragraphs: [
      "Where cancellation occurs before installation, any refund may consider special-order equipment, equipment already allocated, non-returnable items, transport already incurred and other transaction-specific costs, subject to applicable law.",
    ],
  },
  {
    number: 52,
    title: "Monitoring Systems",
    paragraphs: [
      "Monitoring may depend on customer Wi‑Fi, internet, mobile network, manufacturer servers, cloud platform and mobile application availability.",
      "Loss of online monitoring does not automatically mean that the physical solar system has failed.",
    ],
  },
  {
    number: 53,
    title: "Safety",
    paragraphs: [
      "Customers should not open inverters, batteries, DBs, combiner boxes, electrical enclosures or high-voltage equipment unless appropriately qualified.",
      "For smoke, fire, electrical arcing, severe overheating or burning smell, safety takes priority.",
    ],
  },
  {
    number: 54,
    title: "Complaint Management",
    paragraphs: [
      "Betech follows a practical complaint-management path focused on evidence, technical review and remedy based on the actual cause.",
      "The normal path is: customer complaint, then evidence and readings, then technical review, then remote or video assistance, then customer electrician if internal issue is suspected, then Betech technician where necessary, then diagnosis, then the appropriate remedy.",
    ],
  },
  {
    number: 55,
    title: "Remedy Based on Cause",
    paragraphs: [
      "The remedy depends on the cause identified through the support and diagnostic process.",
    ],
    bullets: [
      "Betech workmanship issue → corrective workmanship support",
      "Internal wiring issue → customer electrician",
      "Faulty customer appliance → customer electrician / appliance technician",
      "Manufacturer product defect → manufacturer warranty process",
      "Insufficient system capacity → chargeable upgrade",
      "Third-party modification → chargeable correction where applicable",
      "Normal system behaviour → technical guidance / explanation",
    ],
  },
  {
    number: 56,
    title: "Good-Faith Dispute Resolution",
    paragraphs: [
      "Betech and the customer should first attempt to resolve disputes through reasonable communication and the technical support process.",
      "Where appropriate, the parties may consider mediation or another lawful alternative dispute resolution process.",
    ],
  },
  {
    number: 57,
    title: "Governing Law",
    paragraphs: [
      "These Terms and Conditions are governed by the laws of the Republic of Kenya.",
      "Nothing in these Terms is intended to exclude or restrict a statutory right that cannot lawfully be excluded.",
    ],
  },
  {
    number: 58,
    title: "Electronic Communication",
    paragraphs: [
      "Operational communication may occur through WhatsApp, SMS, telephone, email, website, social media or other agreed channels.",
      "Customer approvals and instructions provided electronically may form part of the transaction record.",
    ],
  },
  {
    number: 59,
    title: "Transaction and Service Records",
    paragraphs: [
      "Subject to applicable data protection requirements, Betech may retain transaction and service records relevant to the installation, support and warranty process.",
    ],
    bullets: [
      "Customer instructions",
      "Payments",
      "Invoice/receipt",
      "System ordered",
      "Equipment supplied",
      "Serial numbers",
      "Installation photos",
      "Commissioning records",
      "Customer videos/photos supplied for troubleshooting",
      "Service records",
      "Warranty correspondence",
      "WhatsApp/email communications relevant to installation/support",
    ],
  },
  {
    number: 60,
    title: "Final System Specification",
    paragraphs: [
      "Where available, final system specification may be determined from the invoice, receipt, quotation, WhatsApp agreement, written order, payment description, delivered equipment and installed equipment.",
      "A formal quotation is not required in every case.",
    ],
  },
  {
    number: 61,
    title: "Preliminary Recommendation vs Final Purchase",
    paragraphs: [
      "A preliminary discussion or recommendation does not necessarily mean the customer purchased that system.",
      "The relevant system is generally the equipment ultimately agreed, paid for, supplied and installed.",
      "However, if Betech recommended a larger system and the customer chose smaller capacity, that recommendation may still be relevant in understanding later capacity limitations.",
    ],
  },
  {
    number: 62,
    title: "Matters Outside Betech’s Reasonable Control",
    paragraphs: [
      "Subject to applicable law, Betech cannot guarantee performance against external or changing factors beyond its reasonable control.",
    ],
    bullets: [
      "Weather",
      "Reduced sunlight",
      "Shading",
      "Changes in customer load",
      "Internal wiring faults",
      "Grid abnormalities",
      "Faulty customer appliances",
      "Unauthorized modifications",
      "Severe lightning",
      "Fire",
      "Flooding",
      "Theft",
      "Vandalism",
      "Force majeure events",
    ],
  },
  {
    number: 63,
    title: "Terms Versioning",
    paragraphs: [
      "This page displays the Effective Date and Version Number for the current Terms.",
      "The current published version is Version 1.0.",
      "When these Terms change in future, the version number should be incremented to reflect the update, such as 1.1, 1.2 or 2.0.",
      "The version and effective date should not be silently overwritten without reflecting the change.",
    ],
  },
  {
    number: 64,
    title: "Customer Acceptance",
    paragraphs: [
      "By engaging Betech Solar Solutions and proceeding with the transaction after these Terms and Conditions have been made available, the Customer confirms acceptance of these Terms, subject to applicable Kenyan law.",
      "Acceptance may be evidenced by conduct including requesting a system, agreeing to the price, making a deposit or full/partial payment, requesting delivery, booking installation, providing access to the installation premises, allowing installation to commence or continue, accepting commissioning, accepting handover or using the installed system.",
      "A physical site assessment, formal quotation or physical signature is not required in every transaction for these Terms to apply where the Customer has otherwise agreed to the system and transaction and proceeded with payment, delivery or installation.",
      "Where Betech has recommended a larger or different system and the Customer elects to purchase a smaller or alternative system because of budget, available installation space, preference or another reason, the Customer acknowledges that the selected system may have reduced generation, shorter backup, continued grid use or require future expansion.",
      "A Customer who does not agree with these Terms should not make payment, request dispatch or authorize installation to commence.",
      "Nothing in these Terms is intended to exclude any rights or remedies that cannot legally be excluded under applicable Kenyan law.",
    ],
  },
];
