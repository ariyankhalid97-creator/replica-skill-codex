# Market findings and fix plan

Date: 2026-10-18

Sample: 12 verbatim public comments across Google Play and Reddit, supplemented by official product, pricing, platform, and policy documentation. This is a **directional sample**, not a statistically representative 100-review study. Non-English comments are retained verbatim in `reviews.csv` and paraphrased here.

## What users hate

1. **Subscription prices feel disproportionate to occasional mobile edits.** Four comments across Google Play and Reddit explicitly object to recurring prices or basic tools moving behind subscriptions.
2. **Editing can be slow or unreliable.** Adobe reviewers report slow editing, text overlap, and a failure to edit at all.
3. **Unsafe save behavior destroys trust.** Reviewers mention automatic saving without a backup/undo path and unwanted file copies.
4. **Font substitution and broken text layout make “editing” unusable.** The user specifically requires selected text to retain its font, size, alignment, and surrounding quality; public reviews also report overlapping text after adding a line.
5. **“Free” products use hostile tradeoffs.** Users describe watermarks, full-screen ads, cloud upload, and formerly free basic functions becoming paid.
6. **Privacy claims are hard to verify.** The category commonly promotes cloud features, while users explicitly ask for tools that do not upload private files.

## What is missing

1. A clear, narrow, on-device PDF-to-table workflow with a visible correction step.
2. A “save a copy” default with undo and explicit replacement of the original.
3. A low-cost, short commitment option instead of annual contracts.
4. Proof of local processing: offline mode, no account, no ads, no document telemetry, and a visible network status.
5. Honest capability labels: distinguish annotation/overlay editing from true existing-text reflow.
6. A signature flow that accepts an existing local/cloud-provider image, a scanned paper signature, or a newly drawn signature without requiring upload.

## What remains unsolved

- Mobile workers who need structured data, not another general-purpose document viewer.
- Privacy-sensitive users who cannot upload invoices, statements, medical paperwork, or client records.
- Occasional users who will pay a small amount for a complete task but reject expensive annual subscriptions.
- Users on mid-range devices who need deterministic extraction even when Gemini Nano is unavailable.

## Fix plan

| rank | build/change | size | evidence | owner |
| --- | --- | --- | --- | --- |
| 1 | Source-linked correction grid with confidence colors | M | extraction tools rarely make mobile correction the core loop | replica-build |
| 2 | Save-copy default, undo, and explicit replace-original action | S | Play reviews report destructive or confusing saves | replica-build |
| 3 | $5.99/three-month Pro with clear renewal, restore, and manage links | M | repeated subscription-price and cancellation complaints | replica-launch / backend |
| 4 | Local-only architecture and no-account onboarding | M | multiple Reddit comments explicitly seek offline/no-cloud tools | replica-architect |
| 5 | Free reader/basic annotation and a useful extraction allowance | S | backlash when highlighting/basic tools move behind a paywall | replica-launch |
| 6 | Deterministic extraction on all devices; Gemini Nano only as enhancement | M | official device availability, quota, and input constraints | replica-architect |
| 7 | Honest “mobile editor” scope and compatibility report before save | M | text layout/reflow complaints | replica-test |
| 8 | Small, modular download with optional OCR language packs | M | users complain about bloated tools; bundled Latin OCR is about 4 MB | replica-build |
| 9 | Object-level font/style inspector and before/after fidelity gate | L | user requirement plus public text-overlap complaints | replica-build / replica-test |
| 10 | Draw/import/scan/use-once signature flow | M | user requirement and privacy positioning | replica-build |
| 11 | Transparent free allowances and pre-action paywall | S | recurring backlash against surprise paywalls and subscription pressure | replica-launch |

## Positioning options

1. **Recommended:** For people who handle sensitive invoices, statements, and reports on Android, PrivateParse turns PDFs into clean tables without uploading the document.
2. For occasional PDF users tired of annual plans, PrivateParse bundles extraction and practical editing in one low-cost three-month pass.
3. For field teams working without dependable connectivity, PrivateParse scans, extracts, corrects, and exports entirely on the phone.

The strongest launch angle is option 1. Privacy is credible because of the architecture, while the extraction result is an immediately demonstrable benefit. “Offline editor” alone is already becoming crowded.

## Product promises to avoid

- “100% accurate OCR” or “perfect table extraction.”
- “Full PDF editing” until arbitrary existing-text editing is actually supported and validated.
- “Exactly $0 cost.” On-device inference removes document compute cost, but Play fees and business operations remain.
- “Works on every Android device” for Gemini Nano features.

