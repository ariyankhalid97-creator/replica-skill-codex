# Desktop component specifications

## App shell

Three columns: 248px tool rail, flexible document stage, 328px inspector. At widths below 980px the inspector becomes a modal sheet. Header is 64px. Keyboard shortcuts are listed in tooltips and the Help panel.

## Button

- Variants: primary, secondary, ghost, danger.
- Sizes: small 32px, medium 40px, large 48px.
- States: default, hover, active, `focus-visible` 2px accent ring, disabled, loading.
- Accessibility: native button, name includes the action and target when ambiguous; loading preserves its accessible label.

## Tool rail item

- Variants: navigation, document tool, Pro-labelled.
- States: default, selected, hover, disabled-with-reason, quota-exhausted.
- Pro label is visible before selection. Selecting an exhausted tool opens the paywall without mutating the document.

## PDF canvas

- States: empty, loading skeleton, ready, password-required, malformed, file-permission-lost.
- Text objects expose keyboard-focusable selection rectangles when the precision editor is active.
- Zoom, page navigation and selection remain available without payment.

## Object inspector

- Shows source text, font/program label, size, weight, italic, color, position, rotation and match confidence.
- States: exact, compatible substitute, overlay-only, unsupported.
- A warning must be acknowledged before compatible substitution or scan overlay.

## Fidelity preview

- Variants: split, blink, difference overlay.
- States: pass, warning, fail. Fail disables export while preserving the draft.
- Explains differences outside the intended edit region in plain language.

## Signature source sheet

- Actions: draw, import image, scan paper, choose saved.
- “Use once” is selected by default; saving requires explicit opt-in.
- Preview shows transparent background, print size and aspect ratio before placement.

## Extraction grid

- Editable cells use confidence states: high, review, low.
- Selecting a cell highlights its source region on the PDF.
- Keyboard: arrow navigation, Enter edit, Escape cancel, Ctrl/Cmd+C copy selection.

## Quota meter

- Shows actual remaining free pages/edits without urgency language.
- Never blocks reading or an already-started operation.

## Paywall

- Shows quarterly total, period, renewal behavior, free capabilities, restore, manage/cancel path and dismiss.
- No countdown, preselected consent, fake discount, or save-time interception.

## Toast and status banner

- Toasts confirm reversible actions; persistent banners explain compatibility, validation, or permission failures.
- Status is never conveyed by color alone.
