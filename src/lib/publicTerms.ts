export type PublicTermsSection = {
  number: number | string;
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  steps?: string[];
  subsections?: Array<{
    title: string;
    paragraphs?: string[];
    bullets?: string[];
  }>;
};

export const TERMS_EFFECTIVE_DATE = "29 August 2026";
export const TERMS_VERSION = "1.3";

export const TERMS_TITLE =
  "Betech Solar Solutions Solar System Installation, Performance, Warranty & After-Sales Terms & Conditions";

export const TERMS_SHORT_NOTICE =
  "A Customer who does not agree with these Terms should not make payment, request dispatch, accept delivery or authorize Installation to commence. Subject to applicable Kenyan law, proceeding after reasonable access to these Terms constitutes acknowledgment and acceptance of the applicable Terms.";

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
      "Betech shall supply and perform only the Equipment, quantities, services and works identified in the Customer’s accepted quotation, invoice, receipt, System design or other applicable transaction record.",
      "Any item or work not expressly included in those records is outside the agreed scope unless Betech and the Customer subsequently agree to it in writing.",
      "Where included in the purchased scope, Installation may cover mounting structures, solar panels, inverter and battery Equipment, PV/DC and battery cabling, agreed AC/DC breakers, isolators and protection devices, and connection to the agreed distribution board or consumer unit. AVS, SPD and any other accessories or protection Equipment are included only where expressly stated in the applicable transaction record.",
    ],
    subsections: [
      {
        title: "Existing Property and Installation Boundary",
        paragraphs: [
          "Unless expressly included, Betech’s scope does not include repairing or certifying the Customer’s existing internal wiring, sockets, switches, consumer unit, earthing system, generator, KPLC supply, plumbing, building works, existing solar equipment or defective appliances.",
          "Betech’s responsibility ordinarily extends through the agreed Solar System and its agreed connection point. If an existing condition prevents safe Installation or Commissioning, Betech may pause work and separately quote corrective work before proceeding.",
          "Betech remains responsible for damage directly caused by its negligent Installation or workmanship to the extent required by applicable law.",
        ],
      },
      {
        title: "Site and Structural Conditions",
        paragraphs: [
          "The Customer should disclose known roof leaks, weak structures, asbestos, concealed pipes or cables, hazardous materials and other site conditions that may affect Installation.",
          "Betech is not responsible for a pre-existing defect or concealed condition that could not reasonably have been identified during the agreed assessment, except where responsibility arises under applicable law.",
        ],
      },
      {
        title: "Product Availability and Substitution",
        paragraphs: [
          "Betech shall endeavour to supply the agreed brand, model and specification. If an exact model becomes unavailable, Betech may propose an alternative with reasonably equivalent or better relevant specifications and applicable warranty.",
          "The Customer shall be informed before Installation of a material substitution, and approval shall be obtained where the change materially affects capacity, functionality, warranty or the agreed specification. Betech shall not knowingly substitute materially inferior Equipment without informing the Customer.",
        ],
      },
    ],
  },
  {
    number: 2,
    title: "Testing, Commissioning & Handover",
    paragraphs: [
      "Following Installation, Betech may test solar generation, inverter operation, battery charging and discharging, changeover, protection devices and representative Customer loads as appropriate to the agreed System.",
      "Betech may provide operating guidance and record Equipment, serial numbers, System settings, test results, outstanding items and other relevant Commissioning information.",
      "Once Installation, testing and Commissioning are complete and the Customer accepts or begins using the System, it is considered commissioned, handed over and accepted, subject to recorded outstanding items, latent defects, applicable Warranties and rights that cannot lawfully be excluded.",
      "A later concern shall be assessed through Betech’s after-sales, workmanship, complaint or Warranty procedures according to its actual cause.",
    ],
  },
  {
    number: "2A",
    title: "Customer Inspection and Acceptance of Materials",
    paragraphs: [
      "The Customer has the right and responsibility to inspect the equipment and materials supplied by Betech before and during installation, where reasonably practicable.",
      "If the Customer believes that any material, equipment, brand, model, capacity, quantity or other item being supplied is materially different from what was agreed, the Customer should raise the concern before that item is permanently installed or, where reasonably possible, before installation is completed.",
      "The Customer may request clarification and, where there is a genuine material discrepancy between the agreed order and the equipment presented for installation, may request that the affected installation work be paused while the matter is reviewed.",
    ],
    subsections: [
      {
        title: "Acceptance After Installation and Handover",
        paragraphs: [
          "Where the Customer or the Customer’s authorized representative is present during installation and allows the work to proceed, is given a reasonable opportunity to inspect the supplied equipment, allows the equipment and materials to be installed, accepts testing and commissioning, accepts handover, or subsequently takes possession of or uses the installed system, the equipment and materials installed shall, subject to applicable Kenyan law, generally be considered accepted as the equipment supplied for that installation.",
          "After installation, commissioning and handover, the Customer should not ordinarily claim that they simply preferred or expected a different brand, model, design, appearance, configuration or specification where the installed equipment was disclosed, reasonably available for inspection, and accepted during the installation process.",
          "For example, a later statement such as ‘I wanted a different model’, ‘I expected another type’ or ‘I would now prefer different equipment’ does not by itself establish that Betech supplied defective or incorrect equipment where the equipment installed formed part of the final agreed transaction and was accepted during installation and handover.",
        ],
      },
      {
        title: "This Does Not Remove Genuine Customer Rights",
        paragraphs: [
          "Acceptance of installed materials does not prevent the Customer from reporting the matters listed below. Such matters will be handled through Betech’s applicable technical support, workmanship, complaint-management and manufacturer warranty procedures.",
        ],
        bullets: [
          "A genuine product defect",
          "A qualifying manufacturer warranty issue",
          "Defective Betech workmanship",
          "Equipment materially different from the equipment actually agreed or represented",
          "Concealed damage or a material discrepancy that could not reasonably have been identified during installation",
          "A system-performance issue requiring technical investigation",
          "Any other right or remedy that cannot lawfully be excluded under applicable Kenyan law",
        ],
      },
      {
        title: "Changes Requested After Acceptance",
        paragraphs: [
          "Where the supplied equipment is operating correctly and corresponds with the final agreed transaction, but the Customer later requests a different brand, model, capacity, specification, appearance, configuration or equipment type, this will normally be treated as a customer-requested change or upgrade rather than a defect.",
          "Any removal, replacement, additional equipment, transportation, labour, reinstallation or modification required to accommodate such a change may therefore be chargeable, unless Betech expressly agrees otherwise or the matter qualifies for another remedy under applicable law.",
        ],
      },
      {
        title: "Transaction Records",
        paragraphs: [
          "Where there is disagreement regarding what was finally agreed or supplied, Betech may refer to relevant transaction records, including the quotation, invoice, receipt, WhatsApp or other written communication, payment description, equipment records, serial numbers, installation photographs or videos, commissioning records and the equipment actually delivered and installed, subject to applicable law.",
        ],
      },
    ],
  },
  {
    number: 3,
    title: "Betech After-Sales Support",
    paragraphs: [
      "Depending on the system size, package and installation type, Betech may provide a complimentary workmanship / after-sales support period, typically ranging from 6 months to 1 year. The applicable support period may depend on the specific transaction or installation scope.",
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
      "Where a site visit is arranged under the above support process, and the technician determines that Betech’s installation is operating correctly and that the reported problem relates to something outside Betech’s workmanship or original installation scope, reasonable charges may apply.",
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
      "Where Betech sizes or recommends a System, the recommendation is based on the appliances, consumption information, load analysis, operating pattern, site information and objectives supplied by or agreed with the Customer at that time.",
      "Any stated performance expectation is based on those declared loads and design assumptions. It should not be treated as applying to materially different loads, usage or site conditions unless Betech confirms the revised expectation in writing.",
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
      "The Customer must provide reasonably accurate information about appliances, simultaneous load, electricity consumption, intended use and expected backup requirements during System sizing.",
      "If relevant loads are omitted, inaccurately described or later added or increased, the original performance expectations may no longer apply and the System may require additional solar panels, batteries, inverter capacity, electrical protection or other upgrades.",
      "A later increase in consumption or addition of significant appliances does not by itself establish that the original System was defective, incorrectly sized or improperly installed where the System was designed from information supplied or approved by the Customer.",
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
      "Welding equipment",
      "Commercial equipment",
      "Other major loads",
    ],
    subsections: [
      {
        title: "High-Consumption Appliances",
        paragraphs: [
          "Electric showers, instant water heaters, cookers, ovens, kettles, heating elements, pumps, air conditioners, machinery and similar loads can consume substantial battery energy in a short period and may also exceed inverter operating limits when used simultaneously.",
          "Such appliances form part of the expected System performance only where they were specifically declared, assessed and included in the approved System design or other written technical commitment.",
        ],
      },
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
      "Inverter capacity is measured in watts or kilowatts (kW) and describes the maximum power the inverter can support subject to its technical specifications, surge capability, temperature, connected Equipment and operating conditions.",
      "For example, a 5kW inverter represents approximately 5,000W rated inverter capacity. It does not mean that operating continuously at 5kW is appropriate in every condition.",
      "Inverter rating does not represent stored battery energy, solar generation or guaranteed backup duration.",
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
      "Battery capacity is commonly measured in kilowatt-hours (kWh) and describes stored electrical energy. A nominal 10kWh battery represents approximately 10 units of nominal stored energy when fully charged.",
      "Battery capacity does not represent guaranteed backup hours. Actual usable energy and runtime depend on Customer load, simultaneous appliance use, battery state of charge, discharge limits, inverter efficiency, manufacturer limits, temperature, battery age and condition, Customer usage behaviour, solar availability and System settings.",
    ],
  },
  {
    number: 14,
    title: "Battery Backup Expectations",
    paragraphs: [
      "There is no guaranteed fixed backup duration simply based on battery size because runtime depends heavily on actual operating conditions and electrical load. The same battery may provide many hours under a light load but substantially shorter backup while high-power appliances operate.",
      "For illustration only, if approximately 10kWh of usable energy were available, a constant 1kW load would mathematically correspond to approximately 10 hours, a 2kW load to approximately 5 hours, and a 4kW load to approximately 2.5 hours before accounting for system losses, reserve limits and changing operating conditions.",
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
      "Solar PV capacity is expressed in kilowatt-peak (kWp) and represents the installed rated capacity under standardized test conditions, not constant real-world generation.",
      "For example, 8 panels x 600W = 4,800W = approximately 4.8kWp rated array.",
      "A 5kWp solar array does not mean that the System will continuously generate 5kW throughout the day.",
    ],
  },
  {
    number: 17,
    title: "Actual Solar Production",
    paragraphs: [
      "Actual solar production is variable. Betech does not guarantee continuous full panel rating or a fixed quantity of daily generation unless a specific performance guarantee is expressly provided in writing.",
    ],
    bullets: [
      "Sunlight intensity",
      "Time of day",
      "Cloud cover",
      "Rain",
      "Temperature",
      "Solar irradiation",
      "Panel orientation",
      "Panel inclination",
      "Shade",
      "Dust",
      "Dirt",
      "Bird droppings",
      "Seasonal changes",
      "Site conditions",
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
      "Solar PV generation and battery backup depend on operating and environmental conditions. Actual System performance may vary because of weather, cloud cover, rainfall, solar irradiation, season, time of day, shading, panel orientation and inclination, dust or dirt, panel temperature, site conditions, battery state of charge, Customer consumption and simultaneous appliance use.",
      "Betech guarantees that supplied Equipment and Installation will operate in accordance with the agreed System design, applicable Equipment specifications and applicable Warranties. Betech does not guarantee fixed solar-generation units, fixed battery-backup hours or complete independence from grid or generator power where actual performance is affected by conditions outside the agreed design assumptions, unless Betech expressly provides that specific guarantee in writing.",
      "Inverter rating, battery capacity and solar-panel capacity are Equipment and design ratings. None individually guarantees continuous operation at maximum inverter capacity, a fixed backup duration, a fixed amount of daily solar production, complete grid independence or permanent off-grid operation.",
    ],
    bullets: [
      "Reduced solar production during bad weather is normal and does not by itself mean that the solar system or panels are faulty.",
      "Solar panels may continue producing electricity during cloudy or rainy conditions, but production can be significantly lower than during clear, sunny conditions.",
      "Betech Solar cannot control weather, sunlight availability, cloud cover or other natural environmental conditions affecting solar generation.",
      "Any estimated daily solar generation or expected charging time is an estimate based on reasonable operating and weather conditions, unless a specific performance level has been expressly guaranteed in writing.",
      "A solar system should not be deemed defective or non-performing solely because generation is temporarily reduced due to poor weather conditions.",
      "Customers should regularly inspect and clean their solar panels. Dust, dirt, leaves, bird droppings and other debris can block sunlight and reduce panel performance.",
      "Panel cleaning should be carried out safely and at reasonable intervals depending on the environment. Locations with significant dust may require more frequent cleaning.",
    ],
    subsections: [
      {
        title: "Technical Faults and Normal Performance Variation",
        paragraphs: [
          "A faulty inverter, defective battery or panel, failed protection device, Installation defect or other covered Equipment failure shall be investigated through the applicable technical or Warranty process.",
          "Reduced generation or shorter backup caused by cloudy or rainy weather, seasonal changes, increased consumption, high simultaneous loads, added appliances, low solar availability, Customer-changed settings, inadequate panel cleaning or shading introduced after Installation does not automatically establish Equipment failure.",
          "Betech may reasonably assess the System design, declared loads, weather, available solar energy, battery state of charge, System settings and actual consumption before determining whether a defect exists.",
        ],
      },
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
      "Installation of a Solar System does not automatically mean the property will stop using KPLC/grid or generator power. Depending on solar availability, Customer consumption, battery state of charge, weather, System configuration and load requirements, the System may continue drawing from an available grid or generator source.",
      "Continued grid or generator use in those circumstances does not automatically indicate a System defect.",
    ],
  },
  {
    number: 24,
    title: "Standard Installation Boundary",
    paragraphs: [
      "Unless additional electrical work is expressly included, Betech’s standard Installation generally connects the supplied Solar System to the Customer’s appropriate distribution board, consumer unit or agreed main connection point.",
      "Betech does not automatically rewire the entire premises or assume responsibility for Customer-owned installations outside the boundary described in Section 1.",
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
      "If suitable earthing or required distribution infrastructure does not exist, Betech may advise the Customer to arrange corrective work through a qualified electrician or may offer the work separately.",
      "Where additional earthing or corrective infrastructure was not included in the original scope, Betech shall communicate any additional cost and obtain approval before undertaking that additional work.",
      "Proper earthing forms an important part of electrical safety but does not, by itself, guarantee protection against lightning or extreme electrical events.",
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
      "After handover, the Customer should operate the System according to the instructions provided and within its rated and recommended limits.",
    ],
    bullets: [
      "Operate system within rated limits",
      "Avoid intentional overloading",
      "Seek advice before adding major loads",
      "Provide accurate appliance and usage information during System sizing",
      "Notify Betech before material load changes where technical guidance is required",
      "Keep inverter appropriately ventilated",
      "Avoid blocking ventilation around batteries and inverters",
      "Keep battery dry/protected",
      "Keep equipment accessible",
      "Keep panels reasonably clean",
      "Report unusual faults",
      "Avoid unauthorized system modification",
      "Avoid unauthorized changes to inverter, battery, charging, discharge or grid settings",
      "Allow reasonable troubleshooting and diagnosis before treating normal variation as Equipment failure",
    ],
  },
  {
    number: 34,
    title: "Third-Party Modifications",
    paragraphs: [
      "The Customer should notify Betech before permitting another technician to materially modify Betech’s Installation during an applicable workmanship or Equipment Warranty period.",
      "Betech is not responsible for a fault or damage caused or materially contributed to by unauthorized third-party work. The involvement of another technician does not automatically cancel unrelated Warranty rights where that work did not cause or contribute to the reported issue.",
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
      "Betech’s workmanship obligations concern the quality of the Installation work performed by Betech. Manufacturer or distributor Warranties concern qualifying Equipment defects and are administered according to their applicable terms.",
      "Nothing in these Terms negates or varies an implied condition, statutory warranty or remedy that cannot lawfully be excluded under applicable Kenyan law.",
    ],
  },
  {
    number: 36,
    title: "Warranty Claim Process",
    paragraphs: [
      "For a warranty review, the customer may be required to provide relevant diagnostic and transaction information.",
      "The item may require remote testing, site testing, workshop testing, supplier testing or manufacturer testing before the cause is confirmed.",
      "The usual process is: report and reference creation, remote diagnosis, review of available evidence or logs, technical inspection where appropriate, manufacturer or distributor assessment where required, and the applicable repair, replacement or other remedy once the cause and coverage are established.",
      "The Customer shall provide reasonable access and cooperation needed for diagnosis. Betech shall keep the Customer reasonably informed where a third-party assessment is required but cannot guarantee that third party’s turnaround time.",
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
      "Unless expressly included in the applicable Warranty or separately agreed in writing, a temporary or loan inverter, battery or other replacement item is not automatically included while assessment or repair is underway.",
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
      "The item may then be delivered to Betech’s designated shop or service point, or referred or delivered to an authorized manufacturer or distributor service centre.",
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
      "An exclusion applies only where the excluded event or condition caused or materially contributed to the reported failure. Third-party work does not automatically remove unrelated Warranty rights where it did not cause or contribute to the problem.",
      "Nothing in this section excludes a statutory right, genuine latent defect, qualifying manufacturer defect or Betech workmanship obligation that cannot lawfully be excluded.",
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
      "A Customer-requested change to Equipment quantity, System capacity, Equipment location, cable route, distribution arrangement, delivery requirement or other agreed scope is a project variation where it changes the original work.",
      "Betech shall communicate material effects on price and completion time before undertaking material additional work. Where an amount was presented as an estimate, any amendment or additional work should be agreed in accordance with applicable law.",
      "The Customer shall provide reasonable site access and ensure required Customer works and infrastructure are ready. If work cannot proceed because of denied access, unfinished Customer works or another circumstance reasonably within the Customer’s control, Betech may reschedule and communicate any reasonable additional transport or remobilization cost before charging it.",
      "Installation dates may be reasonably adjusted for adverse weather, unsafe site conditions, Customer changes, access restrictions, utility conditions, supply disruption or comparable circumstances outside Betech’s reasonable control. Betech shall use reasonable efforts to communicate material delays.",
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
    number: "47A",
    title: "Payment Milestones and Delayed Payment",
    paragraphs: [
      "The Customer shall make payments according to the milestones stated in the applicable quotation, invoice, agreement or other transaction record.",
      "Where an amount becomes due after Installation, testing or Commissioning, the applicable transaction record should identify the relevant milestone. An agreed balance due after Commissioning becomes payable when that milestone is completed, subject to recorded outstanding items and applicable law.",
      "Failure to make an agreed payment when due may result in suspension of further non-emergency delivery, service or additional work, subject to applicable law and obligations already owed to the Customer.",
      "Any change to an agreed price, estimate or payment milestone must be communicated and agreed where required by applicable law.",
    ],
  },
  {
    number: "47B",
    title: "Delivery, Inspection and Storage",
    paragraphs: [
      "The Customer or authorized representative should inspect delivered Equipment for visible damage, quantity and model discrepancies and record any obvious concern on the delivery record or notify Betech promptly.",
      "Where the Customer asks Betech to leave Equipment at the site before Installation, the Customer shall provide a reasonably secure, dry and suitable storage location. This does not remove Betech’s responsibility for damage caused before delivery or any right that cannot lawfully be excluded.",
      "Responsibility for loss or damage after delivery shall be assessed according to the delivery arrangement, custody of the Equipment, applicable transaction records and applicable law.",
    ],
  },
  {
    number: 48,
    title: "Completed Installations",
    paragraphs: [
      "Solar installation includes more than the sale of unopened goods.",
      "It may include equipment allocation, transport, mounting, wiring, configuration, programming, labour, accessories, integration with the property and commissioning.",
      "Once supplied, installed, commissioned and handed over, the installation is generally considered completed.",
      "Customer acceptance of equipment and materials is further governed by Section 2A – Customer Inspection and Acceptance of Materials.",
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
      "Any cancellation deduction or charge should reflect legitimate, reasonably identifiable costs already incurred or commitments made for the Customer’s transaction and shall not remove a remedy available for defective goods, misrepresentation or another right that cannot lawfully be excluded.",
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
      "Complaints involving technical or system-performance concerns will generally follow the technical support process described in Section 4. Betech’s complaint-management approach focuses on obtaining relevant evidence, identifying the actual cause and determining the appropriate remedy.",
      "The appropriate outcome will then depend on the findings from that process and the actual cause identified.",
      "Betech may assign a complaint or support reference, request relevant transaction and technical information, conduct remote or on-site diagnosis where appropriate, communicate findings and escalate unresolved matters for management review.",
      "Where reasonably possible, the Customer should allow Betech an opportunity to inspect, diagnose and propose an appropriate remedy for an alleged technical or workmanship defect. This process does not prevent the Customer from exercising any statutory or legal remedy available under Kenyan law.",
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
    number: "59A",
    title: "Installation Photography, Video, Privacy & Marketing Content",
    subsections: [
      {
        title: "Installation Photography and Video",
        paragraphs: [
          "As part of Betech’s normal installation and service procedures, Betech technicians, employees or authorized representatives may take photographs or videos during and after installation.",
          "Installation photographs and videos may be taken for purposes including documenting work performed, installation verification, commissioning records, quality control, technical support, troubleshooting, warranty assistance, training, safety, dispute resolution and maintaining appropriate service or transaction records.",
          "Betech may retain such technical installation records where reasonably necessary for these purposes, subject to applicable data-protection requirements.",
        ],
        bullets: [
          "Solar panels and how they are mounted",
          "Roof or ground mounting structures",
          "Inverters",
          "Batteries",
          "Distribution boards",
          "Breakers and other protection equipment",
          "Electrical connections and cabling",
          "Equipment configuration",
          "System displays and operating readings",
          "Installation layout",
          "Testing and commissioning activities",
          "Completed solar installations",
          "Other relevant technical aspects of the installation",
        ],
      },
      {
        title: "Marketing and Social Media Use",
        paragraphs: [
          "Betech may also use photographs or videos of installations to showcase completed projects, demonstrate installation workmanship, educate customers, advertise Betech’s products and services, and create content for Betech’s website, social-media pages and other marketing channels.",
          "Photographs or videos of an installation may therefore be published on Betech’s social-media pages, website or other marketing platforms. If a customer does not wish photographs or videos of their installation to be publicly posted or used for marketing purposes, the customer should inform Betech before or during the installation.",
          "A customer’s request not to have their installation used for public marketing will not affect the installation service purchased from Betech.",
        ],
      },
      {
        title: "Protection of Personal Information",
        paragraphs: [
          "Where reasonably practical, Betech will avoid unnecessarily displaying information that directly identifies an individual customer.",
          "Where practical, photographs and videos intended primarily to showcase an installation should focus on the solar equipment and workmanship rather than the customer’s personal information.",
        ],
        bullets: [
          "Customer names",
          "Telephone numbers",
          "Personal documents",
          "Identification documents",
          "Invoices or receipts containing personal information",
          "Vehicle registration details",
          "House numbers",
          "Precise addresses or location details",
          "Computer, Wi-Fi or network credentials",
          "Other private information visible at the installation premises",
        ],
      },
      {
        title: "Identifiable Customers and Individuals",
        paragraphs: [
          "Betech will generally avoid deliberately featuring an identifiable customer or another individual as the subject of advertising or promotional content without appropriate consent.",
          "Where Betech specifically wishes to feature a customer, testimonial, interview or identifiable individual as part of promotional content, appropriate consent should be obtained where required.",
          "The incidental presence of another individual in the installation environment should be handled with reasonable regard for privacy and applicable data-protection requirements.",
        ],
      },
      {
        title: "Request Not to Publish",
        paragraphs: [
          "A customer who does not want photographs or videos of their installation used for Betech’s public marketing, website or social-media purposes should inform Betech before or during installation.",
          "Betech will take reasonable steps to record and respect such a request.",
        ],
      },
      {
        title: "Technical Records Are Separate From Marketing",
        paragraphs: [
          "A request not to publish an installation for marketing purposes does not necessarily prevent Betech from taking and retaining reasonable technical photographs or videos required for legitimate installation or service purposes.",
          "Technical records are not automatically intended for public marketing merely because photographs or videos were taken.",
        ],
        bullets: [
          "Installation records",
          "Proof of work performed",
          "Testing and commissioning",
          "Workmanship verification",
          "Equipment and serial-number records",
          "Quality control",
          "Technical support",
          "Troubleshooting",
          "Warranty administration",
          "Safety",
          "Internal technical review",
          "Handling customer complaints or disputes",
          "Other legitimate installation, service or record-keeping purposes",
        ],
      },
      {
        title: "Previously Published Content",
        paragraphs: [
          "If photographs or videos of an installation have already been published by Betech and the customer does not wish the content to remain publicly displayed, the customer may contact Betech and request review or removal.",
          "Betech will consider the request and, where appropriate and reasonably practicable, remove relevant content from websites, social-media accounts or other platforms under Betech’s direct control within a reasonable period.",
          "Removal from Betech-controlled platforms may not automatically remove copies previously downloaded, shared, reposted, cached, indexed, screenshotted or otherwise reproduced by third parties outside Betech’s reasonable control.",
        ],
      },
      {
        title: "Withdrawal of Specific Consent",
        paragraphs: [
          "Where specific consent was obtained from a customer or another individual for identifiable marketing content, that person may contact Betech to withdraw consent for future use, subject to applicable law.",
          "Withdrawal does not necessarily make processing or publication that lawfully occurred before the withdrawal unlawful.",
          "Where reasonably practicable, Betech will discontinue future promotional use of the affected identifiable content after receiving and processing a valid withdrawal request.",
        ],
      },
      {
        title: "Sensitive or Restricted Premises",
        paragraphs: [
          "Customers with particular privacy, confidentiality or security requirements relating to their premises should inform Betech before installation or before photography or recording takes place.",
          "This is particularly important for businesses, institutions, controlled-access premises or locations containing confidential information.",
          "Betech will take reasonable steps to accommodate privacy restrictions communicated before or during installation, subject to technical documentation reasonably required for installation, safety, warranty, service or applicable legal obligations.",
        ],
      },
      {
        title: "Data Protection",
        paragraphs: [
          "Photographs, videos and other installation records containing personal data will be handled subject to applicable data-protection requirements.",
          "Nothing in this section gives Betech an unlimited right to publish a customer’s personal information or use an identifiable individual for advertising where applicable law requires additional notice, consent or another lawful basis.",
          "Nothing in this section is intended to exclude or restrict any privacy, data-protection, consumer or other statutory right that cannot lawfully be excluded under applicable Kenyan law.",
        ],
      },
    ],
  },
  {
    number: 60,
    title: "Final System Specification",
    paragraphs: [
      "For the purpose of determining the final agreed transaction and System specification, the applicable System may be identified from the quotation, invoice, receipt, approved load assessment, System design, approved variation, WhatsApp or other written agreement, payment description, delivery and Installation records, Commissioning or completion documentation, Warranty documentation, delivered Equipment and installed Equipment.",
      "A formal quotation is not required in every case.",
      "Specific technical performance commitments should be recorded in the quotation, System design or another written confirmation issued or approved by Betech. General marketing information, advertisements, demonstrations and preliminary communications must comply with applicable law and must be read together with the final Customer-specific transaction records. They do not, by themselves, establish that Betech has accepted a particular Customer-specific Installation project; acceptance of proposed work is further governed by Section 63 – Order Acceptance and Right to Decline Proposed Work.",
      "Nothing in this section excludes liability for fraudulent or otherwise legally actionable misrepresentation.",
    ],
  },
  {
    number: 61,
    title: "Preliminary Recommendation vs Final Purchase",
    paragraphs: [
      "A preliminary discussion or recommendation does not necessarily mean the customer purchased that system.",
      "The relevant system is generally the equipment ultimately agreed, paid for, supplied and installed.",
      "However, if Betech recommended a larger system and the customer chose smaller capacity, that recommendation may still be relevant in understanding later capacity limitations.",
      "Preliminary discussions, estimates, quotations and recommendations remain subject to Betech accepting the proposed transaction in accordance with Section 63 – Order Acceptance and Right to Decline Proposed Work.",
    ],
  },
  {
    number: 62,
    title: "Matters Outside Betech’s Reasonable Control",
    paragraphs: [
      "Subject to applicable law, Betech cannot guarantee performance against external or changing factors beyond its reasonable control.",
      "Neither party shall be treated as failing to perform solely because performance was prevented or materially delayed by a circumstance reasonably outside that party’s control. This does not excuse an obligation that could reasonably have been performed despite the event and does not exclude liability that cannot lawfully be excluded.",
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
      "Government restrictions or civil disturbance",
      "Material import, logistics or supply-chain disruption",
    ],
  },
  {
    number: 63,
    title: "Order Acceptance and Right to Decline Proposed Work",
    paragraphs: [
      "An advertisement, product listing, preliminary recommendation, estimate, quotation, Customer enquiry, site discussion, negotiation or other pre-contract communication does not, by itself, require Betech Solar Solutions to accept an order, undertake an Installation or enter into a continuing commercial relationship with a prospective Customer. Any such communication and representation remains subject to applicable Kenyan consumer-protection and other laws.",
      "Unless otherwise required by applicable law or an existing binding agreement, Betech may decline a proposed order, Installation, site visit, supply arrangement or other proposed work before the transaction has been finally accepted.",
      "Betech may make that decision for a legitimate commercial, technical, safety, compliance or operational reason, including the matters listed below.",
    ],
    subsections: [
      {
        title: "Legitimate Reasons",
        bullets: [
          "Technical suitability of the proposed project",
          "Electrical or Installation safety concerns",
          "Project complexity or site conditions",
          "Equipment availability",
          "Installation capacity or technician availability",
          "Logistics or location constraints",
          "Inability to agree on the scope, specification, price or contractual terms",
          "Inability to obtain information reasonably necessary to design or safely undertake the project",
          "Material disagreement concerning the proposed Equipment or services",
          "Breakdown of the confidence or trust reasonably necessary for an Installation and continuing after-sales relationship",
          "Abusive, threatening or seriously disruptive conduct",
          "Credit or payment risk where legitimately applicable",
          "Regulatory or compliance considerations",
          "Another legitimate commercial, technical, safety or operational reason",
        ],
      },
      {
        title: "Lawful Exercise of Discretion",
        paragraphs: [
          "A decision not to accept a proposed transaction does not prevent a prospective Customer from exercising any consumer, statutory or legal right available under Kenyan law. Betech shall not base such a decision on unlawful discrimination or another prohibited ground.",
        ],
      },
      {
        title: "Existing Obligations Remain",
        paragraphs: [
          "Where Betech has already entered into a binding agreement, accepted payment, undertaken delivery, commenced Installation or otherwise incurred an enforceable obligation toward the Customer, this section does not permit Betech to disregard that obligation.",
          "This section does not remove liability for a fraudulent, misleading or otherwise legally actionable representation and does not permit Betech to avoid a remedy to which a Customer is entitled under applicable Kenyan law.",
        ],
      },
      {
        title: "Communication of a Decision",
        paragraphs: [
          "Where reasonably appropriate, Betech may communicate that it is unable or unwilling to proceed with a proposed transaction without being required to disclose confidential internal deliberations, commercially sensitive information or personal information concerning employees, except where disclosure is required by applicable law or a competent authority.",
        ],
      },
    ],
  },
  {
    number: 64,
    title: "Terms Version and Updates",
    paragraphs: [
      "The Effective Date and Version Number displayed on this page identify the current version of these Terms and Conditions.",
      "Betech may update these Terms from time to time to reflect changes in its services, procedures, products, legal requirements or business practices.",
      "Unless otherwise required by applicable law, an updated version will apply from its stated Effective Date. Updates to these Terms do not retrospectively remove or restrict rights or obligations that arose under applicable law or an earlier transaction.",
      "Where it is necessary to determine which Terms applied to a particular transaction, Betech may refer to the version in effect at the relevant time together with the applicable transaction and service records.",
    ],
  },
  {
    number: 65,
    title: "Customer Acceptance",
    paragraphs: [
      "The Customer should read these Terms together with the applicable quotation, invoice, receipt, load assessment, System design, approved variations, delivery and Installation records, Commissioning or completion documentation, Warranty documentation and other applicable transaction records.",
      "By engaging Betech Solar Solutions and proceeding with the transaction after these Terms have been made reasonably available, the Customer acknowledges and accepts the applicable Terms, subject to applicable Kenyan law.",
      "Acceptance may be evidenced by conduct including requesting a system, agreeing to the price, making a deposit or full/partial payment, requesting delivery, booking installation, providing access to the installation premises, allowing installation to commence or continue, accepting commissioning, accepting handover or using the installed system.",
      "Customer acceptance or willingness to proceed does not, by itself, constitute Betech’s acceptance of proposed work where Betech has expressly declined the order before accepting payment, dispatching Equipment, undertaking delivery or commencing Installation. Betech’s acceptance of a proposed transaction is governed by Section 63 – Order Acceptance and Right to Decline Proposed Work and the applicable transaction records.",
      "A physical site assessment, formal quotation or physical signature is not required in every transaction for these Terms to apply where the Customer has otherwise agreed to the system and transaction and proceeded with payment, delivery or installation.",
      "Where Betech has recommended a larger or different system and the Customer elects to purchase a smaller or alternative system because of budget, available installation space, preference or another reason, the Customer acknowledges that the selected system may have reduced generation, shorter backup, continued grid use or require future expansion.",
      "A Customer who does not agree with these Terms should not make payment, request dispatch, accept delivery or authorize Installation to commence.",
      "The Customer acknowledges that Solar PV generation and battery backup depend on environmental and operating conditions. The selected System may experience reduced generation, shorter backup, continued grid or generator use, or require expansion where actual consumption exceeds the agreed design assumptions.",
      "Where a System was designed from information supplied or approved by the Customer, later consumption increases or additional appliances may require System expansion and do not by themselves establish that the original System was defective, incorrectly sized or improperly installed.",
      "Nothing in these Terms is intended to exclude, limit or restrict any Customer right, statutory Warranty, remedy or Betech obligation that cannot lawfully be excluded under applicable Kenyan law. If a provision conflicts with a mandatory legal requirement, that requirement applies to the extent of the conflict without necessarily invalidating the remaining provisions.",
    ],
  },
];
