# PrivateParse Android roadmap

## Outcome

Launch an Android app whose core value is trustworthy, on-device PDF table extraction, then monetize practical PDF editing and batch export through a low-cost three-month Pro plan.

## Phase 0 — Evidence before code (weeks 1-2)

- Assemble a legally usable 250-page benchmark corpus: synthetic tables, public-domain documents, and documents the team owns.
- Label cells and bounding boxes; include native PDFs, 300-DPI scans, borderless tables, rotations, multi-line cells, invoices, statements, and multi-page tables.
- Prototype native text extraction and ML Kit OCR on low-, mid-, and high-tier physical Android devices.
- Prove the critical metric: corrected CSV from one native table in under 30 seconds of user time.
- Create Play Console app, reserve package ID, complete developer verification, and create internal-test track.
- Run a precision-edit engine spike on 100 text objects: embedded and subset fonts, missing glyphs, mixed sizes, kerning, rotations, right/center alignment, multi-line blocks, and scanned text. Record which attributes can be read and which files can be safely written on each supported Android version.

**Exit gate:** >=95% exact-cell score on clean native tables or a clearly usable correction experience; no document network traffic; and a proven engine path that preserves fonts and unaffected page pixels. If the edit spike fails, do not advertise existing-text editing.

## Phase 1 — Extraction vertical slice (weeks 3-6)

- S01-S08: onboarding, file open, viewer, page/region selection, processing, correction grid, CSV export.
- Room schema and process-without-history mode.
- Native-text path first; scanned-page OCR second.
- Bounding-box source link for every cell.
- Cancellation, page/DPI/memory limits, malformed/password errors.
- Unit tests for coordinate normalization, row/column clustering, spans, types, and CSV escaping.

**Exit gate:** 50-page PDF does not ANR on the minimum test device; extraction works in airplane mode.

## Phase 2 — Useful data product (weeks 7-10)

- Multi-page tables, repeated headers, field pairs, table selection, split/merge rows and columns.
- XLSX and JSON export, destination picker, share sheet.
- OCR language packs for the first validated launch markets.
- Benchmark dashboard by document type and device tier.
- Free limits enforced only at extraction/export boundaries, never at file viewing.

**Exit gate:** >=90% exact-cell score on clean scans and 100% visibility of cells below the chosen confidence threshold.

## Phase 3 — Precision editor and signatures (weeks 11-16)

- Selection inspector reads font resource/family, size, weight, italic, color, spacing, baseline, transform, and alignment before editing.
- Exact embedded-font path, metric-compatible substitution with explicit warning, and OCR-backed scan overlay as three visibly different modes.
- Vector-preserving object edits; no whole-page rasterization or recompression of unrelated images.
- Before/after diff outside the edited region, post-save text extraction, reopen validation, and print-resolution preview.
- Annotation, highlighter, undo/redo, form filling, and text/image overlays.
- Signature sources: draw vector strokes; import PNG/JPEG through Photo Picker or installed document providers; scan a paper signature; choose use-once or save in the local vault.
- Page reorder, rotate, delete, duplicate, merge, split, and compress.
- Verified destructive redaction, or omit redaction from launch if verification fails.
- Save-copy default, conflict handling, low-storage recovery, compatibility report.
- Clearly label unsupported fonts, XFA, signed-document, encryption, scan-overlay, and reflow operations.

**Exit gate:** 99% of supported text-object edits stay within the visual-diff tolerance outside the selected region; 100% of unsafe matches warn/refuse rather than silently substitute; round-trip corpus opens correctly in at least four independent viewers; originals remain unchanged in failure tests.

## Phase 4 — Monetization without coercion (weeks 17-18)

- Google Play Billing quarterly auto-renew plan; optional quarterly prepaid plan.
- Initial experiment at US-equivalent $5.99/three months, localized by Play.
- Entitlement states: purchased, pending, grace, hold, canceled, expired, restored.
- Manage-subscription link and renewal terms adjacent to the buy button.
- License-tester matrix using Play Billing Lab.
- Client acknowledgment for alpha; minimal backend verification before meaningful paid scale.
- Ship visible free counters: 10 extraction pages/30 days, 5 precision text-object edits/30 days across two documents, one XLSX export/month, and one page-tool document/week up to 20 pages.
- Keep viewing, search, basic annotations, fill/sign, one saved signature, CSV export within allowance, and save-copy free with no watermark.
- Mark Pro tools before entry and ask for payment only before a new action exceeds the stated allowance—not after processing or at save.
- Once work starts within the allowance, guarantee the user can finish and export it even if the counter reaches zero.
- After the first successful free workflow, show only a dismissible Pro explanation. Avoid an auto-renewing free trial at launch; the recurring free allowance is the trial.

**Exit gate:** every billing transition passes and a paid user retains document access while temporarily offline.

## Phase 5 — Privacy and closed beta (weeks 19-20)

- SDK and permission audit; remove all nonessential networked SDKs.
- Data safety form, privacy policy, terms, support email, deletion/cache controls.
- Network-boundary and leak tests with representative documents.
- TalkBack, large text, dark theme, tablet and stylus checks.
- Baseline Profile and Macrobenchmark for launch, open, scroll, extract, repair, and save.
- Closed beta with 50-100 users from bookkeeping, research, field operations, and student cohorts.

**Exit gate:** crash-free sessions >=99.5%, no critical data-loss bug, and at least 40% of successful extractors export a result.

## Phase 6 — Production launch (weeks 21-22)

- Store listing focused on “PDF to clean table, privately, on your phone.”
- Screenshots show source-linked correction, airplane mode, and save-copy behavior.
- Staged rollout: 5% -> 20% -> 50% -> 100%, pausing on crash, ANR, billing, or data-loss regressions.
- Support playbook for incompatible PDFs and a one-tap sanitized diagnostics bundle that never includes document content.
- Measure locally where possible: import -> extraction -> correction -> export funnel, time-to-export, correction rate, paywall view, purchase result, refund.
- Measure whether users hit a paywall only after value: percent completing a free edit/extract before first paywall, dismiss rate, post-success upgrade rate, and complaints tagged “surprise paywall.”

## Phase 7 — Retention, only after evidence

- Optional Gemini Nano summary and schema mapping on supported devices.
- Saved extraction templates for recurring statements/invoices.
- Tablet two-pane review.
- Consider one-time lifetime unlock only if quarterly conversion is weak and support costs remain low.
- Expand from object-level editing to whole-paragraph reflow only after the font/layout corpus passes the same fidelity gates.

## Launch scope

### Must ship

- Local open/view/search, native and scanned table extraction, correction grid, CSV/XLSX export.
- Object-level precision editing with font/style inspection, fidelity preview, and safe refusal; basic annotation and page operations.
- Draw/import/scan/use-once/saved signature workflows and form filling.
- Quarterly Pro, restore/manage, offline grace.
- Privacy policy, Data safety, benchmarked device limits, accessibility, and recovery from failures.

### Defer

- Voice input, cloud sync, accounts, collaboration, remote signature requests, desktop app, and whole-paragraph desktop publishing reflow.

## Metrics

| metric | launch target |
| --- | --- |
| file-open success | >=98% for supported unencrypted PDFs |
| clean native table exact-cell | >=95% |
| clean scan exact-cell | >=90% |
| median import-to-export | <90 seconds for one-page table |
| crash-free sessions | >=99.5% |
| successful extraction -> export | >=40% in beta |
| paywall -> trial/purchase | establish baseline; do not optimize before task success |
| 90-day paid retention | >=45% initial signal for quarterly fit |
| document bytes sent off device | 0 |
| unsupported edit silently changes font | 0 |
| unexpected pixels changed outside edit region | 0 above defined tolerance |
| users completing value before first blocking paywall | >=80% |

## Exact paywall decision table

| user moment | app behavior | ask for money? |
| --- | --- | --- |
| Opens, reads, searches, highlights, fills, or signs | Complete normally | Never |
| Imports/creates a signature | Use once freely; allow one saved signature | Never for the basic flow |
| First table extraction and CSV export | Complete end to end with no watermark | No |
| First precision edit | Inspect, preview, save a copy | No |
| Free allowance remains | Show remaining amount unobtrusively | No |
| User taps a Pro-labeled action beyond allowance | Explain quarterly total, renewal, prepaid option, restore, and cancel path before work starts | Yes |
| Allowance reaches zero during an active job | Finish, save, and export current work | No |
| Subscription expires | Preserve all files, signatures, history, and prior exports; lock only new Pro actions | Only on the next new Pro action |
| User declines paywall | Return to document with work intact | No repeated modal in that session |

## Necessary non-code work

- Brand clearance for the final name and icon.
- Google Play developer account and identity verification.
- Privacy policy, terms, support channel, refund/support process, and localized pricing.
- Licensed/synthetic test corpus and device lab with at least one low-memory phone and one tablet.
- Tax and business setup appropriate to the publisher's jurisdiction.
- A PDF-library license review before committing to any third-party engine.
- Budget for Play fees and support even though document-processing servers cost nothing.

## What people need next — ranked backlog

This order favors repeated real work over feature count. Evidence from current
table-extraction issues and PDF-editor support threads points to structure loss,
font fallback, scan quality, and repetitive cleanup as the expensive failures.

### P0 — earn trust on every document

1. **Explainable confidence and source linking.** Every extracted cell links to
   its page region; low-confidence values are queued for review instead of
   silently exported.
2. **Hard-document correction tools.** Let users draw/drag column boundaries,
   merge or split cells, define multi-row headers, repeat a header across pages,
   and mark totals. These directly address borderless, dense, irregular, and
   merged-cell tables.
3. **Edit compatibility report.** Before changing text, show whether the font is
   embedded, locally available, subsetted, or substituted. Preview exact glyph
   fit and refuse edits that would move or degrade unrelated content.
4. **Undo, versions, and recovery.** Keep a local operation log, auto-recovery
   copy, before/after comparison, and one-tap restore. Never overwrite the
   original by default.
5. **Searchable scan without image degradation.** Deskew/denoise for OCR, but
   retain the original image stream unless the user explicitly chooses a new
   compression level. The text layer must not blur the visible page.

### P1 — make it worth paying for

6. **Reusable local templates.** A user corrects one monthly bank statement,
   invoice, laboratory report, or purchase order and saves its regions, column
   names, types, and cleanup rules locally for the next file.
7. **Batch and watch-folder processing.** Apply a template to a folder, pause on
   uncertain cells, and export one workbook or separate CSVs. This is the
   strongest fair Pro boundary because it sells saved time, not document access.
8. **Typed exports and validation.** Detect dates, currency, IDs, negatives in
   parentheses, and totals; let users set required columns and warn when sums do
   not reconcile. Export CSV, XLSX, JSON, TSV, and clipboard tables.
9. **Find-and-replace with accept/skip.** Search by exact text, pattern, or style;
   preview each replacement and accept or skip it. Add document-wide style
   changes only where the same font resource and metrics are safe.
10. **Form profiles and signature vault.** Locally save opt-in name/address fields
    and multiple signatures/initials; support use-once, rename, delete, export,
    and biometric/device-lock protection where available.

### P2 — broaden only after accuracy is proven

11. Document presets for invoices, statements, receipts, academic tables, tax
    forms, and field reports, each with its own benchmark score.
12. Language packs, right-to-left review, handwriting experiments, and local
    schema mapping. Never label handwriting or unsupported scripts as reliable
    until they pass a separate corpus.
13. Desktop keyboard shortcuts, tablet two-pane review, stylus annotation, and
    an optional local CLI for privacy-sensitive offices.
14. Verifiable destructive redaction with a post-save recovery test; ship later
    than visual blackout, because an incorrect redaction is worse than no tool.
15. Optional on-device summarization only after extraction/editing reliability.
    It is an enhancement, not the core product or the first reason to subscribe.

### What not to build yet

- Cloud document chat, mandatory accounts, collaboration, remote signature
  requests, or cloud history; each weakens the offline/privacy promise.
- Voice control before keyboard, accessibility, and batch workflows are solid.
- Whole-paragraph desktop-publishing reflow until the font/layout benchmark can
  guarantee safe refusal on unsupported documents.

### Recommended Pro boundary

Keep trust and rescue features free: viewing, search, compatibility reports,
preview, undo, recovery, use-once signature, basic fill/sign, a complete first
extract/edit workflow, and export of work already started. Charge for repetition
and scale: saved templates beyond one, batch/watch-folder jobs, advanced typed
exports, document-wide reviewed replacement, multiple protected profiles, and
higher monthly extraction/edit allowances. This gives users a reason to upgrade
after success rather than forcing payment to recover their own work.

