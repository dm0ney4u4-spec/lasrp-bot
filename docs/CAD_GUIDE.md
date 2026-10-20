# CAD operations and current validation

Start the configured local system with `npm start`, then open `http://localhost:3000` and use **Continue with Discord**. Non-demo startup does not offer demo owner access. Public access still requires hosting and the exact OAuth callback; see PRODUCTION_DEPLOYMENT.md.

## Dashboard

Drag a widget's Move handle onto another widget, or use Move earlier/later. Choose one/two columns and drag the lower resize corner to adjust height. **Save dashboard layout** persists order and sizes to your account. Preferences controls which widgets are visible and the theme. Mobile layouts use a single column. Concurrent edits are rejected rather than silently replacing newer preferences.

## Dispatch, radio and mutual aid

Duty records must match the agency used for transmissions. Priority radio broadcasts require dispatcher/supervisor authority. Acknowledge a radio message once; acknowledgments survive a restart and repeated clicks do not increase the count.

Open **Mutual Aid** to request another agency on an existing incident. Only the deliberately entered aid summary and source location/priority are shared. Receiving dispatch/supervisors accept or decline. Acceptance creates a separate incident for their agency, linked back to the request. Close that response incident before marking aid completed. The source agency's private notes and patient records are not copied. Pending requests can be cancelled by the source agency; history remains audited.

## Reports and lookups

Reports includes ordinary incident/citation/arrest/evidence records plus structured crashes, use-of-force, witness statements, search/seizure inventories and DOT highway assistance. The latter types require their matching fields; law-enforcement and DOT restrictions are checked by the API. Fictional convictions are recorded through court verdicts, not by relabeling an allegation in an ordinary report.

Person/plate searches connect fictional characters and vehicle registrations to agency-visible reports, traffic stops and active warrants/BOLOs. Unsealed court findings are shown as separate verdict/appeal summaries. No private character owner Discord IDs are returned. An accusation or arrest is not presented as a conviction.

## Evidence and handoffs

Evidence files remain encrypted at rest and fingerprinted. **Physical handoff** is separate from digital report access. The recorded custodian offers a handoff to a signed-in, on-duty recipient in the same agency. That recipient must accept or reject it; offering alone does not change custody. Handoffs include reason/location and append immutable custody/audit events. This documents fictional roleplay custody, not real-world evidence handling.

Uploads support PNG/JPEG/PDF/UTF-8 TXT, maximum 8 MiB, with at most four concurrent upload requests. When `EVIDENCE_SCAN_MODE=required`, uploads stream to configured ClamAV using INSTREAM before storage. Infection, malformed replies, timeouts and unavailable scanners reject the upload. Production requires this mode and cannot silently disable it. The production Compose file supplies an isolated ClamAV service with signature storage. It may take time to fetch signatures before accepting scans; size the deployment using ClamAV's documented resource requirements.

**Local development defaults to scanning off** unless a ClamAV instance is configured. The UI and upload custody entry label this explicitly as unscanned. No local antivirus engine has been installed or verified in this session. Protocol tests use a real local TCP server with simulated clean/infected/error responses. Live engine/signature validation remains a deployment check.

## PDF and ZIP export

**Open record → Download PDF** generates a branded PDF after the same agency/sealed-record checks used for evidence. **Reports → Bulk export** is restricted to supervisors/management and accepts up to 20 record IDs. Its ZIP contains complete JSON records, PDF copies, up to 1,000 audit rows per record, optional evidence originals and up to 1,000 custody rows per file, plus a SHA-256 manifest and evidence metadata. It enforces 100 evidence files, 32 MiB of evidence and 64 MiB of total input; choose smaller batches when limits are reached. Exports log evidence access and reject changed report versions. Two exports run concurrently at most.

PDFs use a standard Latin font; unsupported characters are replaced with `?` and large structured-detail sections are limited to 50,000 characters. The full Unicode data is preserved in JSON. These limits are stated in the PDF. Exported files contain private roleplay records and should be handled accordingly.

## Sealed court cases

Courts remain optional. Specialized judge/prosecutor/defense/clerk authority is configurable. Judges/management can seal a case and assign already-signed-in parties. Sealed cases are restricted to judges/clerks, management, the submitting member and assigned parties who retain DOJ access. List, history, evidence and PDF routes enforce that policy. A different person must record the submitter's verdict; appeals preserve the prior decision history.

## Validation status

TypeScript/browser build and 61 automated tests pass. Coverage includes real database/API workflows, DOM widget persistence and map placement, readable PDFs, ZIP contents, custody acknowledgment, mutual-aid privacy/completion, sealed-court access and scanner protocol errors. Dependency audits report no known vulnerabilities at the latest check.

Remaining external checks: real browser OAuth completion, live department role/channel mappings, measured map calibration, graphical desktop/mobile review, production ClamAV/signatures and public hosting. The complete bot command catalog is a separate unfinished scope; it is not a CAD launch claim.
