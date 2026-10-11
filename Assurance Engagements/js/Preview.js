// Preview.js — Preview scaling, pagination hand-off and print/PDF for the
// Assurance Engagements app.
// Depends on: ../js/PagePaginator.js (shared with the main app).
//
// This is the small counterpart to the main app's PreviewManager: no split-view
// toggle, no edit mode, no page pinning, no I Love INF181 hand-off. What it does
// keep is the invariant those all hang off —
//
//   there is exactly one set of page dimensions, and print re-uses the screen
//   rules verbatim.
//
// A page is a real A4 sheet (210mm × 297mm, mm padding) in the preview and in
// every export. The preview shows that same sheet scaled down to fit the panel;
// the print window links ../css/styles.css and restates NO geometry, so the two
// cannot drift apart.

class AEPreview {
  constructor(els) {
    this.documentOutput = els.documentOutput;
    this.documentScaler = els.documentScaler;
    this.previewPanel = els.previewPanel;
    this._pageScale = null;
    this._scaleFrame = 0;
    this._watchPageScale();
  }

  // ── Page scale ────────────────────────────────────────────────────────────

  _watchPageScale() {
    if (!this.documentScaler || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => this._schedulePageScale());
    if (this.previewPanel) ro.observe(this.previewPanel);
    ro.observe(this.documentOutput);
    this._updatePageScale();
  }

  // Writing layout from inside a ResizeObserver callback makes the browser fire
  // "ResizeObserver loop completed with undelivered notifications": resizing the
  // scaler flips the panel's scrollbar, which resizes the panel. Coalescing into
  // one animation frame gives the panel a single write per frame.
  _schedulePageScale() {
    if (this._scaleFrame) return;
    this._scaleFrame = requestAnimationFrame(() => {
      this._scaleFrame = 0;
      this._updatePageScale();
    });
  }

  _updatePageScale() {
    const scaler = this.documentScaler;
    const output = this.documentOutput;
    const panel = this.previewPanel;
    if (!scaler || !output || !panel) return;

    const cs = window.getComputedStyle(panel);
    const avail = panel.clientWidth -
      (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);

    // offsetWidth ignores ancestor transforms, so this is the sheet's true
    // layout width (210mm in px) whatever scale is already applied.
    const pageW = output.offsetWidth;
    if (!pageW || avail <= 0) return;

    // Never magnify — a sheet larger than A4 on screen would just be blurry.
    const scale = Math.min(1, avail / pageW);
    const height = output.offsetHeight * scale;

    if (this._pageScale !== null &&
        Math.abs(scale - this._pageScale) < 0.001 &&
        Math.abs(height - (parseFloat(scaler.style.height) || 0)) < 0.5) return;
    this._pageScale = scale;

    output.style.setProperty('--pg-scale', scale);
    // A transform doesn't affect layout, so the scaled footprint is reserved
    // here or the panel scrolls as though the sheets were still full size.
    scaler.style.width = (pageW * scale) + 'px';
    scaler.style.height = height + 'px';
  }

  // ── Pagination ────────────────────────────────────────────────────────────
  // Overflowing pages are split so every sheet carries its own letterhead
  // header and footer. The shared PagePaginator does the work — the same class
  // the main app uses, so a geometry fix lands in both apps at once.

  paginatePreview() {
    if (typeof PagePaginator === 'undefined') return;
    new PagePaginator(this.documentOutput).paginate();
    this._schedulePageScale();
  }

  // ── Print / PDF ───────────────────────────────────────────────────────────
  // A dedicated window so every page renders regardless of scroll position or
  // container overflow.

  printDocument() {
    const html = this.buildPrintHTML();
    if (!html) return;
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) {
      alert('Pop-up blocked — please allow pop-ups for this page and try again.');
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  buildPrintHTML() {
    const output = this.documentOutput;
    if (!output || !output.classList.contains('visible') || !output.children.length) {
      alert('Please tick a letter and fill in the form before printing.');
      return null;
    }

    const allLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .map(l => l.outerHTML).join('\n');
    const allStyles = Array.from(document.querySelectorAll('style'))
      .map(s => s.outerHTML).join('\n');

    // A window opened with window.open('') has about:blank as its base URL, so
    // relative image paths would not resolve. Clone the DOM (never mutate the
    // live preview) and rewrite each src to the absolute URL the browser has
    // already resolved.
    const cloned = output.cloneNode(true);
    // Edit-mode chrome is app furniture, not document content: a pin badge on
    // a printed letter would be a defect. contenteditable comes off with it, so
    // the print window can never be typed into.
    cloned.querySelectorAll('.page-pin-badge').forEach(el => el.remove());
    cloned.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
    // The protected-variable wiring is app furniture too: the printed sheet is
    // the value, not a handle onto the form field that produced it.
    if (typeof DocVars !== 'undefined') DocVars.strip(cloned);
    cloned.querySelectorAll('.sync-editing').forEach(el => el.classList.remove('sync-editing'));
    cloned.querySelectorAll('img').forEach(img => {
      const absolute = img.src;
      if (absolute) img.setAttribute('src', absolute);
    });

    const coName = getVal('companyName') || '[COMPANY]';
    const yearEnd = getVal('yearEnd') || '[YEAR END]';

    // The preview's squeeze results are carried into print deliberately: both
    // contexts lay out the same A4 sheet, so the squeeze the user already saw is
    // the correct one.
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <base href="${window.location.href}">
  <title>Assurance Engagements - ${coName} ${yearEnd}</title>
  ${allLinks}
  ${allStyles}
  <style>
    /* Print-window overrides.
       ../css/styles.css is linked above and already lays every page out as a
       real A4 sheet. This block deliberately restates NO geometry and NO
       typography — it only strips app chrome that has no meaning on paper. If a
       page needs different sizing, change it in styles.css so both paths move
       together. */
    body { margin: 0; padding: 0; background: white; }
    /* The red checker is a review aid on screen only — nothing it paints may
       reach paper. Its emphasis rules are all scoped to body.super-red, which
       this window never carries; the colour still needs neutralising. */
    .hl-kw, .hl-kw-super { color: inherit !important; }
    .pin-status-bar, .page-pin-badge { display: none !important; }
    .app, .preview-panel {
      display: block !important;
      max-height: none !important;
      overflow: visible !important;
    }
    /* Each .doc-page is its own fixed-size A4 box with its own padding, so the
       page margin stays 0 and the browser adds no header/footer space. */
    @page { margin: 0; size: A4; }
    .doc-page {
      box-shadow: none !important;
      margin: 0 !important;
      page-break-after: always;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .page-number { display: none !important; }
  </style>
</head>
<body>
  ${cloned.innerHTML}
  <scr` + `ipt>
    window.addEventListener('load', function () {
      setTimeout(function () { window.print(); }, 350);
    });
  </scr` + `ipt>
</body>
</html>`;
  }
}
