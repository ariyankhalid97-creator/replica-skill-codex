# Architecture: PrivateParse Android

## Architecture principles

1. Documents and extracted content never leave the device.
2. Deterministic parsing works on every supported device; local generative AI is optional.
3. Save a copy by default. The original is not mutated until the user deliberately replaces it.
4. Every extracted value can be traced back to a bounding box on the source page.
5. PDF, OCR, extraction, editing, and billing live behind interfaces so immature libraries can be replaced.
6. A failed font match is a visible compatibility state, never a silent formatting change.

## Stack

| layer | choice | why |
| --- | --- | --- |
| language/UI | Kotlin + Jetpack Compose, Material 3 | Native Android performance and first-class lifecycle/accessibility support |
| minimum Android | API 23; gate Gemini features at API 26+ and actual AICore availability | Broad OCR support without excluding devices from the deterministic core |
| PDF display | `PdfViewer` abstraction using Android framework `PdfRenderer`; evaluate AndroidX PDF beta behind a feature flag | Stable baseline plus a migration path to current viewer/editor APIs |
| PDF manipulation | `PdfMutator` abstraction; Android framework/AndroidX where capable, plus an Apache/BSD-compatible library after license and corpus testing | Avoid locking the product to a beta or AGPL dependency |
| scanning | ML Kit Document Scanner | On-device crop/cleanup and no app camera permission |
| OCR | Bundled ML Kit Text Recognition v2 Latin model | First extraction works without a model download or server |
| table parsing | Kotlin geometry engine; optional OpenCV/LiteRT module only if benchmarks justify it | Deterministic, testable, zero inference cost |
| local AI | ML Kit Prompt API / Gemini Nano capability adapter | Optional summaries and semantic column mapping on supported devices |
| metadata | Room SQLite | Local source of truth, migrations, observable queries |
| settings | DataStore | Small preferences and privacy controls |
| file access | Storage Access Framework and content URIs | User-controlled files and no broad storage permission |
| background work | Coroutines for foreground jobs; WorkManager only for resumable exports/model preparation | Cancellation and lifecycle correctness |
| payments | Google Play Billing, quarterly subscription and optional prepaid base plan | Required for paid in-app functionality on Play in most cases |
| backend | None for documents; minimal entitlement verifier recommended before scale | Keeps document compute local while securing revenue |
| telemetry | None by default; local counters; user-initiated sanitized diagnostic export | Makes the privacy promise auditable |

## Processing pipeline

```text
SAF URI
  -> validate MIME / size / seekability / password
  -> classify each page: native text, image scan, or mixed
  -> native path: extract glyph/text boxes
  -> scan path: render 200-300 DPI tiles -> deskew -> ML Kit OCR boxes
  -> normalize coordinates and reading order
  -> find table candidates using ruling lines + aligned text clusters + whitespace
  -> infer row/column boundaries and merged cells
  -> type cells (text, integer, decimal, currency, date)
  -> compute structural and cell confidence
  -> user repair grid linked to source boxes
  -> export CSV/XLSX/JSON to a user-selected destination
```

Gemini Nano may map headers to a requested schema or summarize selected text after deterministic extraction. It must never silently alter cell values and must never block export when unavailable.

## Table algorithm v1

- Normalize rotation and page coordinates.
- Group OCR/native words into lines with adaptive y-overlap.
- Detect explicit ruling lines where present; otherwise use repeated x-alignment and whitespace gutters.
- Score a candidate as a table only if at least two rows and two columns have consistent alignment.
- Assign tokens to cells by maximum bounding-box overlap.
- Detect spans where a token crosses a boundary or a ruling segment is absent.
- Infer repeated headers across pages, but show the decision in review.
- Confidence combines OCR certainty where available, geometry consistency, type consistency, and header repetition.
- Never invent a missing value. Empty and unreadable are separate states.

## Local schema

See `schema.sql`. Document bytes are not copied into Room. Only content URIs, non-sensitive metadata, job state, and user-approved extraction results are stored. A “process without history” toggle keeps results in memory and discards them after export.

## Module boundaries

| module | responsibility |
| --- | --- |
| `app` | navigation, DI, top-level composition |
| `core-pdf` | load, render, native text geometry, save-copy contract |
| `core-ocr` | OCR engines and language packs |
| `core-extract` | table/field detection, confidence, correction model |
| `core-export` | CSV, XLSX, JSON, clipboard |
| `feature-viewer` | S04 |
| `feature-extract` | S05-S09 |
| `feature-editor` | S10-S12 |
| `feature-local-ai` | S13, optional capability |
| `feature-billing` | S14-S16 and entitlement gate |
| `data-local` | Room, DataStore, cache lifecycle |
| `benchmark` | extraction corpus, macrobenchmarks, baseline profile |

## Precision editing engine

Selecting text must first create an immutable `StyleSnapshot` containing the PDF font resource/subset identifier, reported family, weight, italic state, font size, fill/stroke color, stroke width, text matrix, baseline, character and word spacing, horizontal scale, bounding box, rotation, and inferred paragraph alignment. The editor displays those values before the keyboard opens.

Use this ordered strategy:

1. **Exact object edit:** reuse the embedded font program when its embedding rights and glyph coverage permit it; preserve size, transform, spacing, colors, and baseline.
2. **Compatible object replacement:** choose a licensed local font only after comparing glyph widths, ascent/descent, x-height, weight, slant, and rendered bounds. Show the substitute name and match score before applying it.
3. **OCR-backed scan overlay:** for image-only pages, sample/reconstruct the local background and place vector text over it. Label this “scan overlay”; never pretend the scan contains editable native text.
4. **Refuse unsafe edit:** when the app cannot preserve appearance within tolerance, keep the original untouched and offer annotation or overlay mode.

Quality rules:

- Never rasterize an entire page to perform a text edit.
- Preserve untouched content streams and original image bytes where the PDF engine permits it; never recompress unrelated images.
- Reflow only within an explicitly selected text block. Show overflow and changed line breaks before save.
- Render before and after at display and print resolution. Mask the intended edit region and require no material pixel difference outside it.
- Re-extract text after save to confirm reading order and replacement content.
- Open the saved copy again before reporting success. If validation fails, discard the output and retain the draft.
- Save a new copy by default and keep one-tap undo until the edit session is closed.

Android's newer PDF page-object APIs expose text, font family/style, font size, color, matrix, and object modification on supported system versions. Older devices still require a separately evaluated PDF engine behind `PdfMutator`; therefore precision editing begins with a two-week engine spike and cannot be declared complete from UI work alone.

## Signature workflow

- **Create:** draw with finger or stylus and store normalized vector strokes for sharp output at any scale.
- **Import:** use Android Photo Picker for local images and Storage Access Framework for Drive, Dropbox, or another installed document provider. The app does not need broad media access.
- **Scan:** photograph a paper signature through the on-device scanner, then crop, remove the background, adjust contrast, and preview the transparent result locally.
- **Choose privacy:** every signature offers “Use once” (default) or “Save securely on this device.” Saved signatures live in app-private storage, can be renamed/deleted, and may optionally require device authentication before placement.
- **Place safely:** preserve aspect ratio, snap to a signature field when present, allow rotate/resize, preview at print resolution, and flatten only when the user explicitly requests it.
- An image of a signature is not a cryptographic digital signature. Label certificate signing separately and do not imply legal identity verification.

## Billing and entitlement

- Product: `privateparse_pro`; base plan: `quarterly_auto`; optional base plan: `quarterly_prepaid`.
- Recommended launch test: US-equivalent **$5.99 per three months**, localized by Play. Test `$4.99`, `$5.99`, and `$7.99`; choose from conversion, refund, and 90-day retention rather than intuition.
- Call paid access “included with Pro,” never “free after paying.”
- Query current purchases at launch and before a paid action; support restore, pending, grace, account hold, expiry, and cancel-at-period-end.
- Acknowledge only `PURCHASED` purchases. Link directly to Play subscription management.
- A client-only v1 can acknowledge purchases through `BillingClient`, but it is easier to tamper with and can miss lifecycle events. Before material revenue, add a minimal verifier using Play Developer API and RTDN. It receives purchase tokens only—never documents.
- Cache a signed entitlement locally for a short offline grace period so airplane-mode document work remains usable.

## Free versus Pro

| capability | Free—complete useful work | Pro quarterly |
| --- | --- | --- |
| View, search, select | unlimited | unlimited |
| Highlight, draw, fill forms | unlimited | unlimited |
| Create/import/place a signature | unlimited; one saved signature plus use-once | multiple saved signatures, initials, stamps |
| Precision existing-text edits | 5 object edits per rolling 30 days across up to 2 documents | unlimited subject to device capacity |
| Table extraction | 10 pages per rolling 30 days | unlimited subject to device capacity |
| CSV export | included, no watermark | batch and multi-table |
| XLSX/JSON and reusable schemas | one XLSX export per month | unlimited |
| Rotate/reorder pages | one document per week, up to 20 pages | unlimited |
| Merge/split/compress and verified redaction | one complete operation as a first-use sample | included |
| Local summary/schema mapping | one sample when supported | included within device quota |

Never lock users out of reading their own files, using signatures, or saving/exporting work already started within a free allowance or active entitlement. No watermark, deliberately damaged output, surprise save-time paywall, countdown timer, or fake “limited-time” price.

## Ethical paywall timing

1. Show small `Pro` labels and the exact remaining free allowance before an action starts.
2. Let the user finish one genuine end-to-end success—edit and save, or extract and export—without payment.
3. After that success, show a dismissible explanation of what Pro adds; do not interrupt the result screen.
4. Show the blocking paywall only when the user deliberately starts an action beyond the visible allowance, before processing begins.
5. If a quota is crossed during work, let the current document finish and save. Apply the limit to the next new action.
6. State the localized total quarterly price, renewal date, auto-renewal status, cancellation path, and restore option beside the purchase button.
7. Prefer the permanent free allowance over an auto-renewing “free trial.” Offer a non-renewing three-month prepaid option where Play supports it.
8. After cancellation or expiry, keep documents, signatures, and prior exports accessible. Only new Pro operations become locked.

## Privacy and security requirements

- Prefer no `INTERNET` permission in the document-processing build path; verify actual network behavior of Billing and any SDK before release.
- No ad SDK, cloud analytics SDK, account SDK, or remote feature-flag SDK.
- Run untrusted PDF parsing in an isolated process where platform support permits; enforce page, pixel, memory, and execution limits.
- Use app-private cache with automatic TTL; clear on user request and low storage.
- Prevent screenshots only on paywall-sensitive screens if needed; do not obstruct normal document work by default.
- Redaction must remove underlying text/image content, metadata, and incremental-history leakage. A black rectangle is not redaction.
- Add a reproducible network-boundary test: process the benchmark corpus in airplane mode and fail CI if document bytes reach a network client.
- Complete Data safety even if no data is collected; publish a plain-language privacy policy and SDK inventory.

## The parts that bite

- **PDF correctness:** malformed files, mixed rotations, incremental updates, fonts without Unicode maps, XFA forms, encryption, and digital signatures.
- **Memory:** never rasterize a full large document. Tile pages, cap DPI, stream work, and cancel immediately.
- **Table ambiguity:** borderless tables and multi-line cells require a correction UI, not an “AI magic” promise.
- **Editing:** font subsets may lack replacement glyphs; embedded fonts can have licensing restrictions; scanned pages have no real text objects; older Android versions need a proven mutation engine. Fidelity gates determine support per selection.
- **Offline billing:** document work is offline, but initial purchase, restore, and periodic entitlement refresh require Play connectivity.
- **Zero cost claim:** local compute can make document-processing infrastructure $0, but Play fees, developer registration, signing, support, and optional billing verification are real costs.

## Quality gates

- Golden corpus: at least 250 licensed/synthetic pages across invoices, statements, research tables, borderless layouts, scans, rotations, and five device performance tiers.
- Extraction target: >=95% cell exact match on clean native tables; >=90% on clean 300-DPI scans; every low-confidence cell visually surfaced.
- Crash-free sessions >=99.5% in closed beta; no ANR on 100-page/50 MB test files within documented limits.
- Save-copy round trip preserves readable content and expected annotations on Adobe, Chrome, Drive, and Android viewer checks.
- Billing matrix covers purchase, pending, renewal, cancel, grace, hold, expiry, restore, refund, and offline cache.
- Accessibility: TalkBack, 48dp targets, dynamic type, high contrast, keyboard/stylus on tablets.

## Build order

1. Vertical slice: S02-S08, one native table -> corrected CSV, fully offline.
2. Scanned PDF path and benchmark corpus.
3. Extraction repair, XLSX, multi-page tables, field pairs.
4. S04 and S10-S12 precision editor and signature workflows with fidelity validation and safe save-copy.
5. S14-S16 Play Billing and entitlement states.
6. Privacy audit, performance, accessibility, store readiness.
7. Optional Gemini Nano summary and schema mapping.
8. Only after retention evidence: investigate true existing-text editing or a commercial PDF SDK.

