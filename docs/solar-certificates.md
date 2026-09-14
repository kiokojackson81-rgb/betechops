# Solar completion and warranty certificates

The completion certificate uses the existing letterhead and company stamp, with a compact first page and the existing evidence appendix. Installer and professional sign-offs are separate unless the assigned technician is the configured professional account.

## Activation

Deploy the application with these pending Prisma migrations:

- `20260914103000_add_professional_commissioning_review`
- `20260914120000_warranty_history`

In **Admin → Settings → Company Documents**, select the licensed professional's active staff account, confirm their name, title, qualification and licence number, and upload their signature. Keep the existing company stamp configured. The default profile text alone does not authorize certification.

## Completion

Technicians select installation type, system configuration and premises, capture GPS when needed, and complete equipment identification, serials, evidence, tests, handover and signatures. Failed tests and missing required fields prevent sign-off. Technician profiles retain optional saved signature URLs alongside existing title, phone, licence and active-account fields.

Other installers submit to professional review. The assigned professional uses **Technical → Professional Review** to inspect the record and either certify or return it with a reason and correction step. The original secure technician link is retained. An administrator may review or return a record, but only the linked professional account can apply the professional certification.

Approval snapshots the professional identity, signature image and stamp image, and records the professional account ID and approval timestamp. Customer signature and terms acceptance timestamps are stored separately. Concurrent or repeated certification is rejected.

## Warranty

The warranty inherits finalized commissioning equipment and technical configuration. Battery serials are required; missing panel or inverter serials are highlighted for staff. Long panel serial lists stay in the commissioning record. Coverage uses 25 years for panels, 10 for lithium batteries and 5 for inverters, starting from commissioning completion.

Final PDFs use the existing stamp and are stored once with a SHA-256 digest. Download and delivery retrieve those stored bytes. Reissue requires a reason and preserves previous versions. Equipment replacements record original and replacement equipment, serials, date, claim reference, reason and authorizing staff account, without modifying the issued PDF. Replacement equipment retains the original warranty dates.

Live verification shows current equipment and coverage status, without phone numbers, emails, payment information or internal history. Historical certificates are marked replaced after reissue. Staff and customer document menus expose issued documents only.

## Validation

Focused tests cover commissioning requirements, professional account authorization, warranty classification, dates and status, replacement history, PDF integrity, and both completion signature layouts. Generated test PDFs are under `artifacts/certificate-review/`; these use test customer data and are not issued documents.

Local checks do not issue certificates, send customer messages, apply production migrations or deploy the application. Live database, storage and customer delivery verification must use the configured deployment after migration.

## Assignment SMS and project documents

Apply `20260914150000_project_document_sms` with the preceding migrations before enabling this release. Assignment to internal technicians or external agents creates a secure commissioning link and submits an automatic SMS to each assigned recipient. Resends keep the same link and progress; changing technician invalidates the previous link and clears the previous technician signature.

Professional certification marks the project completed and records its completion date without changing payment amounts. Completion and receipt PDFs are stored with integrity hashes, and the warranty is issued. The customer notification is submitted only after all three documents are ready. Partial generation is retained for retries.

The customer link lists Receipt, Certificate of Completion, then Warranty Certificate, with view and download actions. Admin project controls show recipient and message previews, explicit send/resend actions, document-generation retry, and SMS history. SENT records gateway acceptance; FAILED includes the error. SENDING requires checking gateway delivery before resending. Automatic attempts are deduplicated; manual resends are separately logged.

Technician SMS example:
BETECH SOLAR: Hi Samuel, you've been assigned project BETECH-123 for Thomas in Konza. Complete installation checks, upload photos and sign off here: [secure technician link] Support: 0722 151 083.

Customer SMS example:
BETECH SOLAR: Hi Thomas, your solar installation for project BETECH-123 is completed and certified. Your Receipt, Completion Certificate and Warranty Certificate are ready. View or download your documents here: [secure customer documents link] Support: 0722 151 083.


## Agents, multiple units and editable warranty periods

Apply `20260914210000_commissioning_assignment` before this release. Assigned external agents and internal technicians each receive the secure commissioning form link by SMS. Access requires possession of the token, with no staff login. A change to the assigned recipients rotates the shared link and clears the previous installer signature. Admins can also create a public form link without an internal technician, then copy/share it. SMS previews list each assigned recipient separately.

Public form submissions go to authenticated licensed professional review. The installer/agent name is captured in the form and frozen on certification; the token itself cannot apply the licensed professional approval.

The form supports additional batteries and inverters, each with its own serial, photos and warranty period. Duplicate or missing additional-unit serials and missing unit label photos prevent certification. Warranty periods default from project receipt items, linked quotation items or full-system coverage, with the existing panel/inverter/battery defaults as fallback. Periods can be edited before submission and are reviewed with the equipment. Extra units are included in PDF continuation pages and warranty history.

Admins can adjust each unit's warranty period when generating or reissuing warranty. Reissue requires a reason and stores a new PDF/version, retaining original coverage start dates and the previous issued document. This does not change project payments.


## Automatic supervisor certification

Completed technician/agent submissions now issue immediately after the existing equipment, evidence, testing, customer acceptance and signature checks pass. The server loads the active supervisor profile, freezes its configured signature and stamp, completes the project and prepares/delivers the customer document bundle. A linked supervisor user account and separate approval are not required for this automatic flow.

The certificate and audit distinguish automatic application of the supervisor signature from a personal manual review. The audit records the public-link or staff-action source and the actual administrative actor, when applicable. Existing waiting records can be finalized using **Generate certificates automatically** in the admin certificate controls or their original public link. Missing signature/stamp assets still prevent issuance. Concurrent and repeated issuance retain the existing transactional safeguards. No additional migration is required for automatic certification.


## Configured supervisor signature

The user-supplied Jonathan Mugiira JPEG (14 September 2026) is uploaded to the existing branding Blob store. Its URL and source SHA-256 are recorded in `src/lib/supervisorSignature.ts`. Certificate generation and Company Documents use this signature when Jonathan's saved signature is empty; a later uploaded replacement remains authoritative. The fallback does not apply to a different supervisor name. No database migration or additional signature upload is needed after deploying this change.
