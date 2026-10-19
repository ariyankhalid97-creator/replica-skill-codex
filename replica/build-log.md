# PrivateParse build log

## 2026-10-18 — desktop validation build

The desktop build is a thin validation slice, not a claim that the Android
launch scope is complete. It was built clean-room from `replica/recon.md`,
`architecture.md`, `product-roadmap.md`, and the design tokens.

### Implemented

- Electron/React local PDF workspace in `desktop-app/` with original branding.
- Native file open, built-in sample, page navigation, and zoom.
- Native-text object hitboxes and font/style/position inspector.
- Compatible overlay editing with optional local TTF/OTF embedding.
- Embedded font capture where the PDF exposes reusable bytes, safe refusal for
  unavailable fonts, and an app-private persistent Font Vault.
- Outside-selection pixel-diff safety check before accepting an edit.
- Simple native-text table reconstruction, editable grid, and CSV export.
- Draw/import/use-once/opt-in-saved signature flows and placement preview.
- Save-copy behavior with creator access fully unlocked and no demo controls.
- Update-capable NSIS packaging with approved download and restart-to-install UI.
- Integrated native Windows caption controls into the 72px white product header
  with hidden menu chrome, native resizing, double-click maximize, and snap support.
- Unit tests for quota behavior and CSV escaping.
- Live page-thumbnail filmstrip plus rotate, reorder, duplicate, delete, and
  single-page export operations.
- Ten-step in-memory undo history and an app-private crash-recovery copy that is
  offered on restart and cleared after a successful Save copy.
- Bundled English OCR that runs locally, displays confidence and recognized
  text for review, and can add an invisible searchable text layer without
  changing the visible scan.
- Existing AcroForm text, checkbox, dropdown, and radio fields can be filled.
- Multi-file first-page table extraction into one editable CSV review.
- OCR language controls with automatic text-language detection, manual override,
  installed-pack indicators, bounded HTTPS downloads from pinned Tesseract.js
  packages, gzip validation, and app-private offline reuse.

### Deliberately incomplete

- Difficult-table correction, XLSX, annotations, cryptographically verified
  redaction, protected signature storage, billing, certificate signatures, and
  Android-specific implementation.
- Text editing is compatible-overlay mode and visibly warns when an exact font
  cannot be guaranteed. It is not paragraph reflow.

### Verification record

- `npm test`: 8 tests passed, including unsafe font substitution refusal,
  non-rasterizing page operations, and ambiguous language-detection fallback.
- `npm run build`: passed.
- Design token contrast checker: passed 12 pairs with zero failures.
- Production dependency audit: zero known vulnerabilities.
- Packaged Windows NSIS build and update metadata generated in
  `desktop-app/release/`; unpacked application smoke-launched and remained
  responsive. The installer is not yet production signed.
