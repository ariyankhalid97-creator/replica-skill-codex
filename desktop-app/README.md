# PrivateParse Desktop

PrivateParse is a privacy-first Windows PDF workspace. PDF bytes stay inside
the Electron process; the app has no document upload, account, analytics, or
payment integration.

## Test it

For development:

```powershell
npm install
npm test
npm run dev
```

For the update-capable Windows installer:

```powershell
npm run dist
```

Send the resulting `release/PrivateParse-Setup-0.3.0-x64.exe` to a tester. It is
unsigned during development, so Windows SmartScreen may show an
unknown-publisher warning. Production releases should be code signed.

For an optional portable build:

```powershell
npm run dist:portable
```

Use **Explore sample** for a safe first run. For a real file, keep the original
and use **Save copy**.

## What works

- Local PDF open, page navigation, zoom, thumbnails, and native-text inspection.
- Page rotation, reordering, duplication, deletion, and single-page export.
- Undo/redo plus an app-private crash-recovery copy for unsaved work.
- Bundled English OCR with confidence review and searchable invisible layers;
  no cloud OCR endpoint is used.
- Fill existing AcroForm text, checkbox, dropdown, and radio fields.
- Object-level edits with font metadata, document-font capture when PDF.js can
  safely expose the embedded bytes, one-time local font selection, and a
  persistent private Font Vault.
- Unsafe silent substitution is blocked when the original font is unavailable.
- Pixel comparison outside the selected edit region before accepting an edit.
- Heuristic extraction of simple native-text tables, editable review, CSV, and
  multi-file first-page batch extraction.
- Drawn or imported PNG/JPEG signatures, including use-once and opt-in local
  storage.
- In-app update checks, approved downloads, and restart-to-install through
  `electron-updater` and GitHub Releases.

## Current limits

- OCR supports bundled English print recognition. Additional languages,
  handwriting, layout-aware scan editing, and automatic deskew remain future work.
- Table extraction is intended for simple rows and columns. Merged cells,
  multi-row headers, borderless tables, and multi-page stitching need the next
  extraction engine.
- Existing text is covered and redrawn as an overlay. It is not full paragraph
  reflow. Some subsetted or restricted PDF fonts expose metrics but not reusable
  bytes; those files require the user to select the licensed matching font.
- The background under edited text is currently assumed to be white.
- No verified destructive redaction, certificate signing, annotations, password
  protection, or billing yet. The app does not mislabel a white overlay as
  redaction or an image signature as cryptographic signing.

Do not use the current build for legal redaction or irreplaceable originals.

## Publishing updates

The installed NSIS build checks the GitHub release feed configured in
`package.json`. For every release:

1. Bump the application version and commit the tested source.
2. Set `GH_TOKEN` locally. Never commit it.
3. Run `npx electron-builder --win nsis --publish always`.
4. Review the generated draft release, installer, block map, and `latest.yml`.
5. Publish the release only after installing and smoke-testing the exact asset.

Existing customers can then open **Updates**, download the approved release,
and choose **Restart and install**. Keep the same signing identity after the
first signed public release; changing it breaks update trust.
