# Recon map: PrivateParse (Android)

Scope: Clean-room reconstruction of the useful mobile workflows found in PDF editors and document-data extraction tools: local PDF viewing, OCR, table/key-value extraction, correction, export, annotation, form filling, signing, and page organization. No incumbent code, assets, copy, or private APIs.

For: Students, freelancers, field staff, bookkeepers, researchers, and privacy-sensitive small businesses that receive invoices, statements, reports, and forms on Android.

Date: 2026-10-18

## Product decision

The product is not a general-purpose Acrobat clone. Its wedge is the shortest reliable path from a PDF or camera scan to editable structured data, with every document operation performed on-device. The editor is the paid retention feature; table extraction is the acquisition feature.

Working codename: **PrivateParse**. Treat this as a codename until trademark, Play Store, domain, and handle checks are complete.

## Sources

| # | source | URL | finding |
| --- | --- | --- | --- |
| 1 | ML Kit Text Recognition v2 | https://developers.google.com/ml-kit/vision/text-recognition/v2/android | On-device OCR returns blocks, lines, elements, and bounding geometry; bundled and dynamically downloaded models are available. |
| 2 | ML Kit document scanner | https://developers.google.com/ml-kit/vision/doc-scanner/android | On-device scan, crop, rotation, cleanup, JPEG/PDF output, and no app camera permission are possible through Google Play services. |
| 3 | Gemini Nano / AICore | https://developer.android.com/ai/gemini-nano | Local generative inference can preserve privacy and work offline, but availability and performance depend on the device. |
| 4 | ML Kit Prompt API | https://developer.android.com/agents/skills/device-ai/ml-kit-genai-prompt-api/references/get-started | API 26+, beta API, device availability checks, model download state, input limits, and per-app quotas make it an optional enhancement rather than the extraction foundation. |
| 5 | Android PDF viewer | https://developer.android.com/develop/ui/views/layout/pdf/pdf-viewer | Android offers framework and Jetpack PDF viewing, selection, search, annotations, and stylus support. |
| 6 | AndroidX PDF release notes | https://developer.android.com/jetpack/androidx/releases/pdf | The current beta adds editable viewing, ink annotations, undo/redo, and form filling; it does not promise desktop-grade text reflow editing. |
| 7 | Google Play subscriptions | https://developer.android.com/google/play/billing/subscriptions | Three-month auto-renewing or prepaid plans are supported; subscription management must be accessible. |
| 8 | Play Billing security | https://developer.android.com/google/play/billing/security | Google recommends backend purchase verification and acknowledgment; client-only billing is possible but weaker against tampering. |
| 9 | Google Play Payments policy | https://support.google.com/googleplay/android-developer/answer/9858738 | A Play-distributed app selling editor functionality must normally use Play Billing. |
| 10 | Google Play service fees | https://support.google.com/googleplay/android-developer/answer/112622 | Local inference removes compute bills, not store fees; subscription transactions are still subject to Play fees. |
| 11 | Google Play Data safety | https://support.google.com/googleplay/android-developer/answer/10787469 | Data processed only on-device is not considered collected, but the form and privacy policy remain mandatory. |
| 12 | Adobe Acrobat mobile subscriptions | https://helpx.adobe.com/acrobat/mobile/subscription-refunds/about-subscriptions.html | Viewing, comments, fill/sign are free; editing, export, organize, compress, and protection are paid. |
| 13 | Foxit pricing | https://www.foxit.com/pdf-editor/pricing/ | Mobile access is bundled in a high-priced editor tier, leaving room for a narrow mobile-only offer. |
| 14 | Xodo Play listing | https://play.google.com/store/apps/details?id=com.xodo.pdf.reader&hl=en_US | The category expectation is an all-in-one reader/editor/scanner; its listing also reports multiple data categories collected/shared. |
| 15 | Adobe Play listing and reviews | https://play.google.com/store/apps/details?id=com.adobe.reader&hl=en-GB | Public reviews expose price, cancellation, speed, destructive-save, undo, and text-layout complaints. |

## Core loop

Open or scan a PDF -> detect tables and fields locally -> review confidence-marked cells -> correct any mistakes -> export CSV/XLSX or copy structured data.

Target happy path: **five taps after file selection**: Extract -> pages -> table -> review -> export.

## Screens

| ID | screen | route / how to reach | purpose | key components | states |
| --- | --- | --- | --- | --- | --- |
| S01 | Privacy onboarding | first launch | Explain local-only promise and permissions | privacy diagram, continue, sample PDF | first run, returning |
| S02 | Home / recent files | app launch | Resume files or start work | recent list, open, scan, sample | empty, populated, permission lost |
| S03 | Import / scan | open or scan | Choose SAF file or scan paper | file picker, scanner, page limit | picking, scanning, unsupported, password-protected |
| S04 | PDF viewer | open document | Read, search, select, and launch tools | page canvas, thumbnails, search, toolbar | loading, ready, large file, malformed |
| S05 | Extract setup | Extract | Choose pages, regions, and result type | page chips, auto-detect, region crop, table/fields/text | no table, one table, multiple tables |
| S06 | Local processing | confirm extract | Show deterministic progress without upload | page progress, cancel, keep-awake option | running, canceled, low memory, model unavailable |
| S07 | Table repair grid | extraction complete | Inspect and correct structure and values | editable grid, confidence colors, merge/split, source highlight | clean, low confidence, OCR mismatch |
| S08 | Export | review complete | Save/share data | CSV, XLSX, JSON, copy, destination picker | preview, overwrite, success, failure |
| S09 | Field results | fields extraction | Review key-value results | key-value rows, source boxes, add/delete field | detected, partial, none |
| S10 | Precision editor | viewer edit button or long-press text | Select and edit a text/image object without changing surrounding appearance | object inspector, font/size/color/alignment controls, match score, before/after preview | exact match, substitute available, scan overlay, unsupported |
| S11 | Page organizer | organize | Reorder, rotate, delete, duplicate, import pages | thumbnail grid, undo, save copy | normal, very large file, save conflict |
| S12 | Fill and sign | editor | Fill a form and place a new, imported, or saved signature | form controls, draw signature, Photo Picker/SAF import, scan paper signature, saved signature vault, use-once option | form, flattened scan, no saved signature, import cleanup, locked vault |
| S13 | Local summary | tools, supported device | Summarize selected pages locally | availability check, download status, result | unavailable, downloadable, ready, quota reached |
| S14 | Pro paywall | paid action | Explain quarterly entitlement | feature list, localized price, restore, manage | eligible, subscribed, pending, grace, expired |
| S15 | Settings and privacy | home menu | Control local data and prove privacy | network status, cache, OCR languages, diagnostics opt-in | default, storage cleanup, model download |
| S16 | Purchase management | settings / paywall | Restore and manage subscription | restore, Play management deep link, status | active, prepaid, pending, canceled, expired |

## Flows

```text
F01 Extract a table from a native PDF
    S02 -> S03 -> S04 -> S05 -> S06 -> S07 -> S08
    happy path: 5 taps after file selection
    edge: password, rotated page, merged cells, multiple tables, malformed text order

F02 Extract a table from a scan
    S02 -> S03 -> S05 -> S06 -> S07 -> S08
    edge: blur, skew, handwriting, low contrast, unsupported script, multi-page table

F03 Correct uncertain extraction
    S07 -> source-linked cell edit -> S08
    edge: row/column split, decimal/date ambiguity, repeated header, OCR confidence unavailable

F04 Perform a basic edit
    S04 -> select object -> S10 inspect style -> edit -> fidelity preview -> save a copy -> S04
    edge: subset font lacks new glyph, unlicensed embedded font, scanned page, text expansion, rotated/sheared text, low match confidence, low storage

F05 Fill and sign
    S04 -> S12 -> choose saved/import/create -> clean and preview -> place -> save a copy -> share
    edge: XFA form, flattened scan, transparent-background cleanup, signature placement across rotation, user chooses use-once

F06 Organize pages
    S04 -> S11 -> save a copy -> S04
    edge: undo delete, imported page size mismatch, large document

F07 Upgrade for Pro operation
    paid action -> S14 -> Play purchase -> entitlement -> original action
    edge: pending purchase, offline purchase check, cancel, grace, restore on new device

F08 Generate a local summary
    S04 -> S13 -> result
    edge: Gemini Nano unavailable, model not downloaded, quota, long document
```

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| Document card | recent, sample, processing | normal, missing permission, failed | S02 |
| PDF canvas | page, continuous | loading, ready, selected, error | S04-S07, S10-S12 |
| Tool chip | free, Pro, device-limited | enabled, disabled, locked | S04, S10 |
| Extraction region | table, field, ignore | selected, resizing, invalid | S05 |
| Confidence cell | high, medium, low | normal, editing, confirmed | S07 |
| Object inspector | exact, compatible substitute, overlay-only | inspecting, editing, overflow, unsupported | S10 |
| Fidelity preview | blink, split, difference heatmap | pass, warning, fail | S10-S12 |
| Signature source sheet | draw, import, scan, saved | empty, cleaning, preview, locked | S12 |
| Source-link highlight | cell, row, field | hidden, visible | S07, S09 |
| Progress row | render, OCR, structure, export | queued, running, done, failed | S06 |
| Paywall sheet | quarterly, prepaid | loading, eligible, pending, owned, error | S14 |
| Privacy badge | fully local, model download required | verified, explanatory | S01, S06, S15 |

## Inferred local data model

```text
Document  id, content_uri, display_name, fingerprint, page_count, mime_type,
          password_required, last_opened_at
          evidence: S02-S04
          confidence: high

ExtractionJob  id, document_id, kind, page_range, state, started_at, completed_at,
               engine_version, error_code
               evidence: S05-S06
               confidence: high

TableResult  id, job_id, page_index, region, row_count, column_count, confidence
             evidence: S07
             confidence: high

Cell  id, table_id, row_index, column_index, row_span, column_span, raw_text,
      corrected_text, bounds, confidence, confirmed
      evidence: S07-S08
      confidence: high

FieldResult  id, job_id, label, value, label_bounds, value_bounds, confidence
             evidence: S09
             confidence: medium

EditSession  id, document_id, output_uri, operation_log, state, created_at
             evidence: S10-S12
             confidence: medium

SignatureAsset  id, kind (vector_strokes | transparent_bitmap), local_uri,
                display_name, bounds, protected, created_at
                evidence: S12
                confidence: high

Entitlement  product_id, purchase_token_hash, state, expiry_at, last_checked_at
             evidence: S14-S16 and Play Billing
             confidence: high
```

Relationships: Document 1-n ExtractionJob; ExtractionJob 1-n TableResult and FieldResult; TableResult 1-n Cell; Document 1-n EditSession. SignatureAsset is device-local and user-owned. All metadata is local. Documents remain at user-selected Storage Access Framework URIs unless the user explicitly saves a copy.

## Feature matrix

See `features.csv`. The launch editor includes precise existing-text object editing only when the app can read and preserve the source object's typography and geometry. A selected section must expose its font family/program, size, weight, italic state, fill/stroke, character spacing, baseline, transform, and inferred alignment. If the exact embedded font cannot legally or technically render the replacement glyphs, the app must show a compatibility warning and an explicit substitute/overlay choice. It must never silently change the font, flatten an untouched page, or reduce image quality.

## What not to build

- Cloud upload, sync, collaboration, accounts, ads, or behavioral tracking in v1.
- Voice recognition: it does not help the core PDF-to-data loop and creates unnecessary microphone/privacy surface.
- Dependence on Gemini Nano for OCR or table parsing; unsupported devices must retain the full core workflow.
- DRM bypass, password cracking, certificate forgery, or editing signed PDFs without visibly invalidating the signature.
- Cloud e-sign request workflows, enterprise admin, and desktop publishing fidelity.
- Any incumbent branding, screenshots, copy, assets, or private endpoints.

## Size

16 screens, 8 flows, 8 local entities. Hard parts: reliable table geometry across diverse PDFs, memory-safe processing of large files, and font-faithful object editing across Android versions. Size: **XL** for extraction plus precision editing—roughly 5-6 months for one experienced Android engineer, with launch contingent on the editing-engine spike.

