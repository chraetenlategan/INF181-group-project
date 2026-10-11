/* ═══════════════════════════════════════════════════════════════════════════
   PdfLoader.js — get a PDF onto the screen and its words into the model.

   The PolicyGenerator produces two different kinds of PDF and this tool has
   to swallow both:

     • Print → Save as PDF (the browser's own print path, buildPrintHTML)
       carries a real text layer. Words, sizes and font names come straight
       out of pdf.js — exact, instant, no OCR.

     • Export / "Edit with I Love INF181" (PreviewManager._renderDocumentToPdf)
       rasterises every page with html2canvas at scale 2 and drops the PNG on
       an A4 page. There is no text in that file at all, only pixels. Those
       need OCR.

   So: always try the text layer first, and only fall back to OCR for pages
   that come back empty. Most sets will be one or the other throughout, but a
   mixed file (someone stapled a scanned signature page onto an exported set)
   works too, page by page.
   ═══════════════════════════════════════════════════════════════════════════ */

window.PGLoader = (function () {
  'use strict';

  const T = window.PGTPL;

  // Display raster: 2× the PDF's own 72dpi, i.e. 144dpi. Screen only — the
  // generator exports at 192dpi (1588px across), so the exporter never builds
  // from this copy; it re-renders edited pages at full resolution and copies
  // untouched ones straight from the source file.
  const DISPLAY_SCALE = 2;
  // OCR raster: 4× = 288dpi. Tesseract wants ~300dpi for 9.5pt body text;
  // below that the accuracy drop is steep. Rendered per page and thrown away.
  const OCR_SCALE = 4;

  // A page with this little text on its layer is treated as "no text layer".
  // A rasterised page usually yields exactly zero, but a stray invisible
  // artefact or a page number should not defeat the check.
  const TEXT_LAYER_MIN_CHARS = 25;

  let _tesseractPromise = null;

  function ensurePdfJs() {
    if (!window.pdfjsLib) throw new Error('pdf.js is not loaded.');
    if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = '../vendor/pdf.worker.min.js';
    }
    return window.pdfjsLib;
  }

  /* Tesseract is loaded lazily and only if a page actually needs it — a
     text-layer PDF never pays for it. It is not vendored into the repo (the
     language data alone is several MB), so it comes from the CDN, same as the
     Poppins webfont the app already relies on. If there is no route to the
     CDN we say so plainly rather than silently producing an empty document. */
  function ensureTesseract() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (_tesseractPromise) return _tesseractPromise;

    const sources = [
      'vendor/tesseract.min.js',                                     // if ever vendored
      'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
      'https://unpkg.com/tesseract.js@5.1.1/dist/tesseract.min.js'
    ];

    _tesseractPromise = sources.reduce(
      (chain, src) => chain.catch(() => loadScript(src)),
      Promise.reject()
    ).then(() => {
      if (!window.Tesseract) throw new Error('Tesseract loaded but did not register.');
      return window.Tesseract;
    }).catch(() => {
      _tesseractPromise = null;
      throw new Error(
        'This PDF has no text layer, so it needs OCR — and the OCR engine ' +
        '(tesseract.js) could not be loaded. Check the internet connection, ' +
        'or re-save the statement with Print → Save as PDF, which produces a ' +
        'PDF this editor can read without OCR.'
      );
    });

    return _tesseractPromise;
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('failed: ' + src));
      document.head.appendChild(s);
    });
  }

  /* ── Public: load ────────────────────────────────────────────────────────
     onProgress({ phase, page, pages, pct, note }) is called throughout so the
     UI can show something honest while OCR grinds.                          */
  async function load(arrayBuffer, onProgress) {
    const pdfjsLib = ensurePdfJs();
    const report = (o) => { try { onProgress && onProgress(o); } catch (_) {} };

    report({ phase: 'open', pct: 0, note: 'Opening the PDF…' });
    // pdf.js hands its buffer to the worker, which detaches it. Keep our own
    // copy: the exporter copies untouched pages straight out of the source.
    const srcBytes = new Uint8Array(arrayBuffer.slice(0));
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
    // OCR words are sized by measuring them in Poppins; the fallback face
    // would give wrong extents.
    try { if (document.fonts && document.fonts.load) await document.fonts.load('400 12px Poppins'); } catch (_) {}
    const pages = [];
    const n = doc.numPages;

    // Pass 1 — raster + text layer for every page. Cheap, always runs.
    for (let i = 1; i <= n; i++) {
      report({
        phase: 'render', page: i, pages: n,
        pct: Math.round(((i - 1) / n) * 45),
        note: 'Rendering page ' + i + ' of ' + n + '…'
      });
      const page = await doc.getPage(i);
      pages.push(await readPage(page, i - 1));
      page.cleanup();
    }

    // Pass 2 — OCR only the pages that came back without usable text.
    const needOcr = pages.filter(p => p.source === 'none');
    if (needOcr.length) {
      report({
        phase: 'ocr-init', pct: 46,
        note: 'No text layer on ' + needOcr.length + ' page' +
              (needOcr.length === 1 ? '' : 's') + ' — starting OCR…'
      });
      const Tesseract = await ensureTesseract();
      let ocrDone = 0;   // pages finished, so the bar moves forward across pages
      const worker = await Tesseract.createWorker('eng', 1, {
        logger: m => {
          if (m.status === 'recognizing text') {
            report({
              phase: 'ocr', note: null, sub: m.progress,
              pct: 50 + Math.round(((ocrDone + m.progress) / needOcr.length) * 45)
            });
          }
        }
      });
      // The statements are body text in a single column. Telling Tesseract
      // that (rather than letting it hunt for columns) is both faster and
      // noticeably more accurate on the signature and table pages.
      await worker.setParameters({ preserve_interword_spaces: '1' });

      try {
        for (let k = 0; k < needOcr.length; k++) {
          const p = needOcr[k];
          report({
            phase: 'ocr', page: p.index + 1, pages: n,
            pct: 50 + Math.round((k / needOcr.length) * 45),
            note: 'Reading page ' + (p.index + 1) + ' with OCR (' +
                  (k + 1) + ' of ' + needOcr.length + ')…'
          });
          const pageObj = await doc.getPage(p.index + 1);
          await ocrPage(pageObj, p, worker);
          pageObj.cleanup();
          ocrDone = k + 1;
        }
      } finally {
        await worker.terminate();
      }
    }

    report({ phase: 'model', pct: 96, note: 'Recognising the pages…' });
    pages.forEach(buildModel);

    report({ phase: 'done', pct: 100, note: 'Ready.' });
    return { pages, numPages: n, srcBytes };
  }

  /* A page rendered at exactly `widthPx` across — used by the exporter to get
     the source raster back at its own resolution rather than upscaling the
     144dpi display copy. */
  async function renderRaster(pdfDoc, index, widthPx) {
    const page = await pdfDoc.getPage(index + 1);
    const vp1 = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: widthPx / vp1.width });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(vp.width);
    canvas.height = Math.round(vp.height);
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    page.cleanup();
    return canvas;
  }

  function openDoc(bytes) {
    return ensurePdfJs().getDocument({ data: bytes.slice() }).promise;
  }

  /* One page: raster for display, plus whatever the text layer offers. */
  async function readPage(page, index) {
    const vp1 = page.getViewport({ scale: 1 });        // 1 unit == 1 pt
    const canvas = document.createElement('canvas');
    const vp = page.getViewport({ scale: DISPLAY_SCALE });
    canvas.width = Math.round(vp.width);
    canvas.height = Math.round(vp.height);
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;

    const out = {
      index,
      srcIndex: index,
      canvas,
      // The sheet's real size in mm. Anything that is not A4 (a Letter-sized
      // import, a rotated page) still maps correctly because every conversion
      // goes through these two numbers rather than assuming 210×297.
      pageWMm: T.ptToMm(vp1.width),
      pageHMm: T.ptToMm(vp1.height),
      words: [],
      source: 'none',
      deleted: false
    };

    const content = await page.getTextContent();
    const words = textLayerWords(content, vp1);
    const chars = words.reduce((a, w) => a + w.text.length, 0);
    if (chars >= TEXT_LAYER_MIN_CHARS) {
      out.words = words;
      out.source = 'text';
    }
    return out;
  }

  /* pdf.js text items → word boxes in mm.

     An item is a run of text with a transform matrix. Its vertical scale is
     the font size in points; `width` is the run's advance in the same units.
     We split runs on whitespace and apportion the advance by measured width,
     which is what gives per-word boxes precise enough to group into lines.  */
  function textLayerWords(content, viewport) {
    const out = [];
    const styles = content.styles || {};

    for (const item of content.items) {
      if (!item.str || !item.str.trim()) continue;
      const tr = item.transform;                    // [a,b,c,d,e,f]
      const sizePt = Math.hypot(tr[2], tr[3]) || Math.abs(tr[3]) || T.BODY_PT;
      const xPt = tr[4];
      const yPt = tr[5];                            // baseline, PDF origin = bottom-left
      const advPt = item.width || 0;

      const style = styles[item.fontName] || {};
      const fam = String(style.fontFamily || item.fontName || '');
      const bold = /bold|black|heavy|semib|600|700|800|900/i.test(fam);
      const italic = /italic|oblique/i.test(fam);

      const baseMm = T.ptToMm(viewport.height - yPt);
      const ascMm = T.ptToMm(sizePt) * 0.82;
      const hMm = T.ptToMm(sizePt) * 1.12;

      // Split the run into words, giving each its share of the advance.
      const parts = item.str.split(/(\s+)/).filter(s => s.length);
      const totalMeasured = parts.reduce(
        (a, p) => a + window.PGText.widthMm(p, sizePt, bold, italic), 0) || 1;
      const advMm = T.ptToMm(advPt);
      let cursor = T.ptToMm(xPt);

      for (const part of parts) {
        const wMm = (window.PGText.widthMm(part, sizePt, bold, italic) / totalMeasured) * advMm;
        if (part.trim()) {
          out.push({
            text: part,
            xMm: cursor,
            yMm: baseMm - ascMm,
            wMm,
            hMm,
            baseMm,
            sizePt,
            bold,
            italic
          });
        }
        cursor += wMm;
      }
    }
    return out;
  }

  /* OCR one page. Rendered fresh at OCR_SCALE and discarded straight after —
     a 288dpi A4 canvas is ~64MB of pixels and keeping one per page would run
     a long statement out of memory. */
  async function ocrPage(page, model, worker) {
    const vp = page.getViewport({ scale: OCR_SCALE });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(vp.width);
    canvas.height = Math.round(vp.height);
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;

    const res = await worker.recognize(canvas, {}, { blocks: true, text: true });
    const data = res.data || {};

    // px → mm. OCR_SCALE px == 1pt, so one mm is OCR_SCALE * PT_PER_MM px.
    const pxPerMm = OCR_SCALE * T.PT_PER_MM;
    const words = [];

    for (const w of collectOcrWords(data)) {
      const t = (w.text || '').trim();
      if (!t) continue;
      // Tesseract's confidence is a good junk filter: letterhead logos and
      // scanner speckle come back as 1-2 character words at low confidence.
      if (w.confidence != null && w.confidence < 45 && t.length < 3) continue;
      const b = w.bbox;
      if (!b) continue;
      const xMm = b.x0 / pxPerMm;
      const yMm = b.y0 / pxPerMm;
      const hMm = (b.y1 - b.y0) / pxPerMm;
      const wMm = (b.x1 - b.x0) / pxPerMm;
      // OCR gives a glyph box, not a font size. What that box means depends
      // on the letters in it, so measure this word's own ink in Poppins and
      // size it from both dimensions. Height is thrown by an underline (the
      // box grows downward), width by bold (~5% wider) — each only ever
      // overstates, so the smaller reading is the honest one. A word too
      // small to judge ("—", "-", ".") is taken to be body size.
      const ext = window.PGText.glyphExtentEm(t);
      const extEm = ext.ascEm + ext.descEm;
      const byH = extEm > 0.35 ? T.mmToPt(hMm / extEm) : 0;
      const byW = t.length >= 3 && ext.inkWEm > 0 ? T.mmToPt(wMm / ext.inkWEm) : 0;
      const raw = byH && byW ? Math.min(byH, byW) : (byH || byW);
      const sizePt = raw ? snapSize(raw) : T.BODY_PT;
      // The box starts at the ink; a text-layer word (and fillText) starts at
      // the pen origin, one side bearing further left. Store the origin, or a
      // re-typeset line lands a fraction of a mm right of its neighbours.
      const originMm = xMm + ext.inkLeftEm * T.ptToMm(sizePt);
      words.push({
        text: t,
        xMm: originMm,
        yMm,
        wMm: wMm + (xMm - originMm),
        hMm,
        // Baseline from the box top: the top is the word's own ascent above
        // the baseline, and unlike the bottom it is not moved by an underline.
        baseMm: yMm + ext.ascEm * T.ptToMm(sizePt),
        sizePt,
        bold: false,
        italic: false,
        confidence: w.confidence
      });
    }

    model.words = words;
    model.source = 'ocr';
    model.ocrText = data.text || '';
    // Release the big canvas.
    canvas.width = canvas.height = 0;
  }

  /* OCR measures glyph boxes, so the size it implies wobbles by a few tenths
     of a point from word to word. The generator only ever uses a handful of
     sizes, so snapping to the nearest one removes that wobble entirely — and
     a snapped size is what makes re-typeset text sit back on the original
     baseline grid instead of drifting a little on every line. */
  const KNOWN_SIZES = [7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 12, 13, 14, 16, 18, 20, 24, 28];
  function snapSize(pt) {
    let best = KNOWN_SIZES[0], bestD = Infinity;
    for (const s of KNOWN_SIZES) {
      const d = Math.abs(s - pt);
      if (d < bestD) { bestD = d; best = s; }
    }
    // Anything wildly off the scale is left alone rather than forced to 28pt.
    return bestD <= Math.max(1.2, pt * 0.18) ? best : Math.round(pt * 2) / 2;
  }

  // Tesseract v5 returns a block/paragraph/line/word tree when asked for
  // `blocks`; older shapes expose data.words directly. Handle both.
  function collectOcrWords(data) {
    if (Array.isArray(data.words) && data.words.length) return data.words;
    const out = [];
    for (const b of data.blocks || []) {
      for (const p of b.paragraphs || []) {
        for (const l of p.lines || []) {
          for (const w of l.words || []) out.push(w);
        }
      }
    }
    return out;
  }

  /* Words → lines → blocks → a page type. Run after both passes so a page is
     classified from whatever text we ended up with, text layer or OCR. */
  function buildModel(p) {
    // First pass with the default metrics, only to read the page's identity.
    let metrics = T.metricsFor('base');
    let lines = window.PGText.groupLines(p.words);
    let blocks = window.PGText.groupBlocks(lines, metrics);

    const fullText = blocks.map(b => b.text).join('\n');
    const id = T.classify(fullText);
    p.type = id.type;
    p.confidence = id.confidence;
    p.matched = id.matched;
    p.runnerUp = id.runnerUp;

    // Second pass with the metrics that page type actually uses. The padding
    // and line-height buckets differ (a compact page is 12mm/14mm at lh 1.30),
    // and those feed both the block grouping and every later re-typeset.
    if (p.type.bucket !== 'base') {
      metrics = T.metricsFor(p.type.bucket);
      blocks = window.PGText.groupBlocks(lines, metrics);
    }

    p.metrics = metrics;
    p.lines = lines;
    p.blocks = blocks;
    p.continuation = T.looksLikeContinuation(blocks, p.type.bucket);
    p.textPreview = fullText.slice(0, 400);
  }

  return { load, renderRaster, openDoc, DISPLAY_SCALE, OCR_SCALE };
})();
