# Statement PDF Editor — development build

A standalone page (`web/pdf-editor/index.html`) for re-opening a PDF that this
app produced and correcting it, without re-importing the whole statement and
re-checking every field.

In the main app it is under **Settings → PDF Editor** (4.22.0), shown only to
the names in `app.js` → `PDF_EDITOR_USERS`. It can also be opened directly:

```
web/pdf-editor/index.html
```

It shares `../vendor/pdf.min.js`, `../vendor/pdf.worker.min.js` and
`../vendor/pdf-lib.min.js` with the main app, so it must stay inside `web/`.

---

## What makes it "smart" rather than just another PDF editor

A generic PDF editor sees glyphs on a canvas and guesses. This one starts from
the fact that it already knows what it is looking at:

| It knows | Where that comes from |
|---|---|
| The page catalogue — Directors' Report, CA Declaration, Index, Cash Flows, … | `js/templates.js` → `TYPES`, fingerprinted from the real generator wording and `config.js` → `INDEX_CONFIGS` |
| The sheet — A4, padding 15/18/19mm, or 12/18/14mm on a compact page | `web/css/styles.css` `:root` → `--pg-*` |
| The type — Poppins 9.5pt, ink `#111`, line-height 1.33 / 1.30 / 1.32 | `--doc-body-*`, `--doc-lh-*` |
| The text column — 18mm to 192mm | derived from the padding |

Because of that, corrected text is not "pasted over" the page. It is
re-typeset onto the same baseline grid the generator used, in the same font at
the same size, so a fixed line is indistinguishable from an untouched one.

---

## The two PDFs this app makes, and why OCR is needed for one of them

| How the user saved it | What is in the file | How the editor reads it |
|---|---|---|
| **Print → Save as PDF** (`PreviewManager.buildPrintHTML`) | A real text layer | pdf.js text layer — exact fonts, sizes and positions, instant |
| **Export / Edit with I Love INF181** (`PreviewManager._renderDocumentToPdf`) | Page **images** — html2canvas at scale 2, embedded as PNG. No text whatsoever | OCR (tesseract.js), a few seconds per page |

`PdfLoader.js` always tries the text layer first and only OCRs the pages that
come back empty, so a mixed file works page by page. Where a set can be saved
either way, the print path is worth preferring — it is faster and exact.

OCR runs at 288dpi (`OCR_SCALE = 4`), which is what 9.5pt body text needs;
below ~300dpi the accuracy drop is steep. That raster is rendered per page and
thrown away immediately — a full-page 288dpi canvas is ~64MB of pixels.

**tesseract.js is not vendored** (the language data alone is several MB); it
loads from a CDN on first use, the same way the Poppins webfont already does.
If there is no route to it the editor says so plainly and points at the print
path, rather than silently producing an empty document.

---

## The screen is only the pages

No page list, no info panel, no page-type badges. The page is identified
internally (that is how the editor knows the geometry and type to re-typeset
with), but none of that is shown — the user sees the document and **clicks any
text to edit it**. Clicking away commits; Esc cancels. Clicking from one block
straight onto another commits the first and opens the second in one click.

While a block is open, a small **B / U** bar sits above it: select words and
press it (or Ctrl+B / Ctrl+U) to bold or underline them. The styling is kept
per character (`block.marks`), so a bolded word inside a paragraph stays bold
when the paragraph re-wraps. A block with no marks takes exactly the old
single-style path. Italic is not offered.

The bar's third button is a **Format Painter** (🖌, 4.55.0). Select styled
words (or just put the caret in them), press it, then select the words to copy
the bold / underline onto — in the same block, or click another block first and
select there; the brush survives the commit. Shift-click keeps it on for
several selections; Esc puts it down. Ctrl+Shift+C / Ctrl+Shift+V do the same
from the keyboard, as in Word. Bold and underline are the only styles a block
carries, so they are all it copies.

Pages are kept in the order they are in the PDF. Deleting and reordering pages
were removed in 4.20.0 — that is what I Love INF181 is for.

---

## What gets repainted — the part that matters on an OCR'd page

On an OCR page the model's text is a *machine's reading* of the pixels. Good,
not perfect. If correcting one word re-rendered the whole paragraph, every OCR
mistake in the other lines would be baked into the output, replacing pixels
that were already correct.

So `PGText.layout()` works out the **first line that actually differs** and
only that line and everything below it is erased and repainted. Fix the last
line of an eight-line paragraph and seven lines of original pixels are left
completely untouched. Once the text reflows (a line-count change) everything
from the first difference down has to go — there is no way around that.

Blocks sitting in the letterhead or footer band (top 30mm, bottom 20mm) are
flagged as chrome (firm details, page numbers), but clicking one edits it
straight away — there is no confirmation prompt.

---

## Preview and export cannot disagree

Both the on-screen overlay (`EditorUI.buildBlock`) and the exporter
(`Exporter.paintBlocks`) call the same `PGText.layout()` and get the same line
positions, word spacing and erase rectangle. There is no second renderer that
could drift from the first — which is the whole failure mode this tool exists
to remove.

Export works page by page. A page nobody edited is **copied straight out of the
opened file** with pdf-lib — its image (or its text layer) byte for byte. An
edited page is re-rendered from the source at the export resolution (1588px
across, 192dpi — the size the main app's `_renderDocumentToPdf` writes), the
changed region whited out, the new text painted, and the result embedded as one
image. The 144dpi raster on screen is display only; building the export from it
used to soften every page on every round-trip. No font embedding is needed,
because the glyphs arrive as pixels.

---

## File map

| File | Purpose |
|---|---|
| `js/templates.js` | The only file that knows anything about INF181 statements: page catalogue, fingerprints, geometry, typography. No dependencies. |
| `js/TextModel.js` | Words → lines → blocks, and `layout()` — the single authority on where re-typeset text lands. |
| `js/PdfLoader.js` | pdf.js raster + text layer, OCR fallback, page classification. |
| `js/Exporter.js` | Canvas composite → pdf-lib → download. |
| `js/EditorUI.js` | The screen: click-to-edit overlay, zoom, export. |
| `css/editor.css` | Chrome only. Palette matches the main app. |

---

## Known limits — worth knowing before testing

- **Table rows and single lines are never re-wrapped.** They grow sideways, the
  way the generator would have laid them out. A paragraph wraps within the
  width it already had.
- **Block splitting is heuristic.** A paragraph break is a vertical gap over
  1.2× the line pitch, a size change over 12%, a boldness flip, or a table row
  next to a non-table row. Unusual spacing can merge two paragraphs or split
  one.
- **Alignment is inferred** from line edges (centre / right / justify / left).
  A short centred line over a wide column can read as left-aligned.
- **OCR sizes come from measuring each word in Poppins** (its own ink height
  and width against the box Tesseract returns), so a word with descenders or
  an underline is not mistaken for a bigger font.
- **OCR does not read weight or slant** — bold and italic come back as regular
  on an OCR'd page, so a corrected heading may render lighter than its
  neighbours. Text-layer PDFs carry this correctly.
- **An edited page comes out raster**, at ~192dpi. For a file that was already
  raster this loses nothing; on a text-layer PDF that page trades its text
  layer away (untouched pages keep theirs).
- Nothing is persisted. Closing the page loses the edits.

## Next, once it has been tested

- Fold it into the main UI (a toolbar button beside "Edit with I Love INF181").
- Feed the identified page types back to the form, so an uploaded PDF could
  repopulate the left-hand side rather than only being patched on the right.
- Vendor tesseract.js if the office machines turn out to be offline.
