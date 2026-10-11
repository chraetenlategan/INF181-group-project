/* ═══════════════════════════════════════════════════════════════════════════
   Exporter.js — put the edited pages back into a PDF.

   Method: composite, not surgery. For each page we draw the original raster
   onto a canvas, white out only the blocks the user actually changed, paint
   the re-typeset text over them, and embed the finished canvas as one image
   per A4 page.

   Why compositing rather than editing the PDF's own content streams:

     • The export path this tool is built for (_renderDocumentToPdf) already
       produces a page that IS one image. There is no text to edit — nothing
       is lost by staying raster.
     • Every pixel the user did not touch survives byte-for-byte. Letterheads,
       signatures, table rules, the lot. A content-stream rewrite risks all of
       it for no gain here.
     • Text is painted with canvas fillText in the same Poppins the generator
       uses, positioned by the same PGText.layout() the screen used. So the
       export is the preview — not a second renderer that can drift from it.

   This mirrors exactly what PreviewManager._renderDocumentToPdf does in the
   main app (html2canvas → embedPng → pdf-lib A4 page), which is also why no
   font embedding is needed: the glyphs arrive as pixels.
   ═══════════════════════════════════════════════════════════════════════════ */

window.PGExport = (function () {
  'use strict';

  const T = window.PGTPL;

  // Export raster width. 1588px across 210mm ≈ 192dpi — comfortably above the
  // 144dpi the source raster carries, so re-typeset text is crisper than the
  // pixels around it rather than softer.
  const EXPORT_W_PX = 1588;

  const A4_PT = { w: 595.28, h: 841.89 };

  /* Paint one page to a canvas: original raster, then patches, then text. */
  function renderPage(page, opts) {
    const o = opts || {};
    const pxPerMm = (o.widthPx || EXPORT_W_PX) / page.pageWMm;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(page.pageWMm * pxPerMm);
    canvas.height = Math.round(page.pageHMm * pxPerMm);

    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(o.raster || page.canvas, 0, 0, canvas.width, canvas.height);

    const dirty = page.blocks.filter(b => b.dirty);
    if (dirty.length) paintBlocks(ctx, page, dirty, pxPerMm);

    return canvas;
  }

  function paintBlocks(ctx, page, blocks, pxPerMm) {
    const metrics = page.metrics;

    // Pass one: white out every changed block first, then paint. Doing it in
    // two passes matters when two blocks sit close enough that one's patch
    // would otherwise erase the neighbour's freshly painted text.
    const laid = blocks
      .map(b => ({ block: b, lay: window.PGText.layout(b, metrics) }))
      // The layout can come out identical to the original — the user typed and
      // then undid it. Nothing to erase and nothing to repaint.
      .filter(({ lay }) => lay.changed);

    ctx.fillStyle = '#ffffff';
    for (const { lay } of laid) {
      const r = lay.boxMm;
      ctx.fillRect(r.x * pxPerMm, r.y * pxPerMm, r.w * pxPerMm, r.h * pxPerMm);
    }

    ctx.fillStyle = T.INK;
    ctx.textBaseline = 'alphabetic';
    for (const { block, lay } of laid) {
      ctx.font = window.PGText.fontSpec(block.sizePt, block.bold, block.italic, pxPerMm);
      // Only the lines inside the erased region get repainted; everything
      // above `lay.from` is still the original pixels and must stay that way.
      for (const line of lay.lines.slice(lay.from)) {
        if (!line.text) continue;
        const y = line.baseMm * pxPerMm;
        if (line.segs) {
          // Bold/underlined in part: every piece already placed by layout().
          for (const sg of line.segs) {
            ctx.font = window.PGText.fontSpec(block.sizePt, sg.bold, block.italic, pxPerMm);
            ctx.fillText(sg.text, sg.xMm * pxPerMm, y);
          }
          ctx.font = window.PGText.fontSpec(block.sizePt, block.bold, block.italic, pxPerMm);
          for (const u of line.unders) {
            ctx.fillRect(u.xMm * pxPerMm, (line.baseMm + lay.underOffsetMm) * pxPerMm,
                         u.wMm * pxPerMm, lay.underThickMm * pxPerMm);
          }
        } else if (line.wordSpaceMm > 0) {
          // Justified: place each word by hand so the extra gap matches what
          // the screen showed, word for word.
          let x = line.xMm;
          const parts = line.text.split(' ');
          for (let i = 0; i < parts.length; i++) {
            ctx.fillText(parts[i], x * pxPerMm, y);
            x += window.PGText.widthMm(parts[i] + ' ', block.sizePt, block.bold, block.italic)
               + line.wordSpaceMm;
          }
        } else {
          ctx.fillText(line.text, line.xMm * pxPerMm, y);
        }
      }
    }
  }

  // A page with nothing to repaint — no block edited, or every edit undone.
  function isUntouched(page) {
    return !page.blocks.some(b => b.dirty && window.PGText.layout(b, page.metrics).changed);
  }

  /* Build the PDF. `pages` is the live, ordered, non-deleted page list.
     `srcBytes` is the file that was opened. With it, an untouched page is
     copied across as-is (its image, or its text layer, byte for byte) and an
     edited page is re-rendered from the source at export resolution. Without
     it, every page is built from the 144dpi display raster, which blurs. */
  async function toPdf(pages, onProgress, srcBytes) {
    if (!window.PDFLib) throw new Error('pdf-lib is not loaded.');
    const { PDFDocument } = window.PDFLib;
    const doc = await PDFDocument.create();
    const report = (o) => { try { onProgress && onProgress(o); } catch (_) {} };

    const live = pages.filter(p => !p.deleted);
    if (!live.length) throw new Error('Every page has been deleted — nothing to export.');

    let srcPdf = null, srcRender = null;
    if (srcBytes) {
      try {
        srcPdf = await PDFDocument.load(srcBytes, { ignoreEncryption: true });
        srcRender = await window.PGLoader.openDoc(srcBytes);
      } catch (err) {
        console.warn('Source PDF not reusable, exporting from the display raster.', err);
        srcPdf = srcRender = null;
      }
    }

    for (let i = 0; i < live.length; i++) {
      const p = live[i];
      report({
        pct: Math.round((i / live.length) * 95),
        note: 'Rendering page ' + (i + 1) + ' of ' + live.length + '…'
      });
      if (srcPdf && isUntouched(p)) {
        const [copied] = await doc.copyPages(srcPdf, [p.srcIndex]);
        doc.addPage(copied);
        continue;
      }
      const raster = srcRender ? await window.PGLoader.renderRaster(srcRender, p.srcIndex, EXPORT_W_PX) : null;
      const canvas = renderPage(p, { raster });
      if (raster) raster.width = raster.height = 0;
      const png = await doc.embedPng(canvas.toDataURL('image/png'));
      // Keep the source sheet's own proportions. A4 for everything the
      // generator makes, but an imported Letter page stays Letter.
      const wPt = T.mmToPt(p.pageWMm) || A4_PT.w;
      const hPt = T.mmToPt(p.pageHMm) || A4_PT.h;
      const page = doc.addPage([wPt, hPt]);
      page.drawImage(png, { x: 0, y: 0, width: wPt, height: hPt });
      canvas.width = canvas.height = 0;   // release as we go
      // Yield so the progress bar can actually paint between pages.
      await new Promise(r => setTimeout(r, 0));
    }

    if (srcRender) srcRender.destroy();
    report({ pct: 97, note: 'Writing the PDF…' });
    const bytes = await doc.save();
    report({ pct: 100, note: 'Done.' });
    return bytes;
  }

  function download(bytes, filename) {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'edited.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  return { renderPage, toPdf, download, EXPORT_W_PX };
})();
