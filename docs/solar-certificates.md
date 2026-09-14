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
