// ── PreviewManager ─────────────────────────────────────────────────────────
// Handles preview toggling (split-view / form-only), printing, and live
// update orchestration.  Works directly with DOM — no imports required.
// ────────────────────────────────────────────────────────────────────────────

class PreviewManager {
  /**
   * @param {Object}          els
   * @param {HTMLElement}      els.appContainer      – #app-container
   * @param {HTMLElement}      els.toggleBar         – #mode-toggle-bar
   * @param {HTMLElement}      els.toggleLabel       – #toggle-label
   * @param {HTMLElement}      els.modeLabel         – #mode-label
   * @param {HTMLElement}      els.documentOutput    – #document-output
   * @param {HTMLElement|null} els.previewPanel      – .preview-panel
   * @param {Function}         generateDocFn         – reference to generateDoc()
   */
  constructor(els, generateDocFn) {
    this.app = els.appContainer;
    this.toggleBar = els.toggleBar;
    this.toggleLabel = els.toggleLabel;
    this.modeLabel = els.modeLabel;
    this.documentOutput = els.documentOutput;
    this.previewPanel = els.previewPanel;
    this.documentScaler = document.getElementById('document-scaler');
    this.generateDocFn = generateDocFn;

    this.previewVisible = true;
    this._pageScale = null;
    this._scaleFrame = 0;

    this._applyPreviewLayout();
    window.addEventListener('resize', () => this._applyPreviewLayout());
    this._watchPageScale();
  }

  _applyPreviewLayout() {
    const usedHeight = this.toggleBar ? this.toggleBar.offsetHeight : 44;
    const avail = window.innerHeight - usedHeight;
    this.app.style.height = avail + 'px';
  }

  // ── Preview page scale ───────────────────────────────────────────────────
  // Pages are laid out at true A4 — the same box, margins and point sizes the
  // PDF uses — and the whole output is then scaled down to fit the panel. This
  // is what makes the preview a faithful scale model of the export: previously
  // the preview page was a 740px box holding 9.5pt text while the PDF was a
  // 794px box holding the same 9.5pt text, so everything re-flowed on export.
  // Recomputed whenever the panel is resized (the split divider is draggable)
  // or the document's page count changes.
  _watchPageScale() {
    if (!this.documentScaler || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => this._schedulePageScale());
    if (this.previewPanel) ro.observe(this.previewPanel);
    ro.observe(this.documentOutput);
    this._updatePageScale();
  }

  // Writing layout from inside a ResizeObserver callback is what makes the
  // browser fire "ResizeObserver loop completed with undelivered notifications"
  // — resizing the scaler flips the panel's scrollbar, which resizes the panel,
  // which calls back before the browser has finished delivering. Loading a
  // business changes the page count and the panel size at once, so several
  // callbacks land in the same frame and the ping-pong is guaranteed.
  // Coalescing them into one animation frame means the observer callback itself
  // touches nothing, and the panel gets a single write per frame.
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
    if (!scaler || !output) return;

    const panel = this.previewPanel;
    if (!panel) return;
    const cs = window.getComputedStyle(panel);
    const avail = panel.clientWidth -
      (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);

    // offsetWidth ignores ancestor transforms, so this is the sheet's true
    // layout width (210mm in px) regardless of the scale already applied.
    const pageW = output.offsetWidth;
    if (!pageW || avail <= 0) return;

    // Never magnify: a sheet larger than A4 on screen would just be blurry.
    const scale = Math.min(1, avail / pageW);
    const height = output.offsetHeight * scale;

    // The ResizeObserver watches the panel, and resizing the scaler can flip
    // the panel's scrollbar — bail out when nothing meaningful moved so the
    // two can't drive each other in a loop.
    if (this._pageScale !== null &&
        Math.abs(scale - this._pageScale) < 0.001 &&
        Math.abs(height - (parseFloat(scaler.style.height) || 0)) < 0.5) return;
    this._pageScale = scale;

    output.style.setProperty('--pg-scale', scale);
    // transform doesn't affect layout, so reserve the scaled footprint here or
    // the panel scrolls as though the sheets were still full size.
    scaler.style.width = (pageW * scale) + 'px';
    scaler.style.height = height + 'px';
    // The indent ruler sits outside the scaled output and has to line up with
    // the sheet by hand.
    if (panel) panel.style.setProperty('--pg-render-w', (pageW * scale) + 'px');
  }

  // ── Print Document ───────────────────────────────────────────────────────
  // Opens a dedicated print window so ALL pages render regardless of scroll
  // position or container overflow — solves the "only current page prints" bug.

  printDocument() {
    const printHTML = this.buildPrintHTML({ autoPrint: true });
    if (!printHTML) return;

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      alert('Pop-up blocked — please allow pop-ups for this page and try again.');
      return;
    }
    printWindow.document.open();
    printWindow.document.write(printHTML);
    printWindow.document.close();
  }

  // Builds the standalone print-window HTML (all pages, print CSS, pagination).
  // Shared by printDocument() and the Electron "Edit with I Love INF181" hand-off,
  // which renders this HTML offscreen and captures it via printToPDF().
  // When autoPrint is false the document signals readiness via window.__printReady
  // instead of calling window.print(), so the bytes can be captured programmatically.
  buildPrintHTML({ autoPrint = true } = {}) {
    const output = this.documentOutput;
    if (!output || !output.classList.contains('visible')) {
      alert('Please generate a document first before printing.');
      return null;
    }

    // Collect all <style> elements from the main page
    const allStyles = Array.from(document.querySelectorAll('style'))
      .map(s => s.outerHTML)
      .join('\n');

    // Collect all <link rel="stylesheet"> (Google Fonts etc.)
    const allLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .map(l => l.outerHTML)
      .join('\n');

    // Resolve ALL relative <img src> to absolute URLs before writing to the
    // popup window. A popup opened with window.open('') has about:blank as its
    // base URL, so relative paths like "images/letterhead-header.png" fail to
    // resolve and the letterhead/footer images disappear. Clone the DOM first
    // so we don't mutate the live preview, then rewrite every img.src using
    // the browser's own URL resolution against the current document.
    const cloned = output.cloneNode(true);
    // Strip transient editor-only UI (e.g. "Insert page here" controls).
    cloned.querySelectorAll('.insert-page-zone, .page-split-chip').forEach(z => z.remove());
    // The protected-variable wiring is a live-preview affordance, never part of
    // the printed sheet. The spans themselves stay (they are `.hl-kw`, which the
    // print stylesheet already neutralises); only the data attributes go.
    if (typeof DocVars !== 'undefined') DocVars.strip(cloned);
    // Last line of defence for the header/footer pairing rule: a footer never
    // prints on a sheet that has no letterhead above it, whatever produced the
    // page (generator, saved HTML, in-page split).
    if (typeof stripOrphanLetterheadFooters === 'function') {
      stripOrphanLetterheadFooters(cloned);
    }
    // Same for the flag that makes a signer's name typeable in edit mode — it
    // has no business in a print/PDF copy.
    cloned.querySelectorAll('.sig-name[data-sig-editable]').forEach(n => {
      n.removeAttribute('contenteditable');
      n.removeAttribute('data-sig-editable');
    });
    // The keyword highlight is a preview-only review aid. `.hl-kw` is neutralised
    // by the print stylesheet below, but an edit made while the highlight was on
    // can leave the red baked into a plain inline colour that no `.hl-kw` rule
    // matches — that is how a corrected value reached a client's PDF in red. This
    // is the backstop for pages already carrying it (hand-edited pages and saved
    // page HTML persist verbatim); the edit-time strip in EditToolbar stops new ones.
    stripHighlightColour(cloned);
    cloned.querySelectorAll('img').forEach(img => {
      // Reading .src returns the already-resolved absolute URL
      const absolute = img.src;
      if (absolute) img.setAttribute('src', absolute);
    });

    // The preview's squeeze results are carried over deliberately. They used to
    // be stripped here so the print window could re-derive them, because the
    // two contexts had different page geometry and a preview squeeze was simply
    // wrong for print. Now that both lay out the same A4 sheet, the squeeze the
    // user already saw is the correct one, and re-deriving it in the print
    // window's simpler single-tier paginator would only reintroduce a
    // difference between preview and PDF.
    const docContent = cloned.innerHTML;

    const coName = document.getElementById('companyName') ? document.getElementById('companyName').value.trim() : '[COMPANY]';
    const yearEnd = document.getElementById('yearEnd') ? document.getElementById('yearEnd').value.trim() : '[YEAR END]';
    const dynamicTitle = `PG Reports - ${coName || '[COMPANY]'} ${yearEnd || '[YEAR END]'}`;

    const baseHref = window.location.href;
    const printHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <base href="${baseHref}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${dynamicTitle}</title>
  ${allLinks}
  ${allStyles}
  <style>
    /* Print-window overrides.
       styles.css is linked above, and it already lays every page out as a real
       A4 sheet — same box, margins and point sizes the preview shows. So this
       block deliberately restates NO geometry or typography. It only strips the
       app chrome that has no meaning on paper.
       This used to be a full second copy of the page rules, and every value
       that drifted from its styles.css counterpart became a preview-vs-PDF
       discrepancy. If a page needs different sizing, change it in styles.css so
       both paths move together. */
    body { margin: 0; padding: 0; background: white; }
    .hl-kw { color: inherit !important; }
    .app, .preview-panel {
      display: block !important;
      max-height: none !important;
      overflow: visible !important;
    }
    /* @page margin is 0 because each .doc-page/.cover-page is its own
       fixed-size A4 box with its own internal padding. Keeping @page
       margin at 0 avoids the browser adding its own header/footer space. */
    @page { margin: 0; size: A4; }

    .doc-page, .cover-page {
      box-shadow: none !important;
      margin: 0 !important;
      page-break-after: always;
      break-inside: avoid;
    }
    .doc-page { page-break-inside: avoid; }

    /* Preview-only marker. Hidden here rather than relying on styles.css's
       @media print, because the browser PDF path rasterises this document in a
       screen-media iframe where @media print never applies. */
    .page-number { display: none !important; }

    /* Free-floating elements: keep absolute position, strip editor chrome */
    .doc-page .free-floating {
      background: transparent !important;
      box-shadow: none !important;
      cursor: default !important;
      padding: 0 !important;
    }
    .doc-page .float-block {
      outline: none !important;
      background: transparent !important;
      cursor: default !important;
      padding: 0 !important;
    }
    .doc-page .float-placeholder {
      visibility: hidden !important;
    }
  </style>
</head>
<body>
  ${docContent}
  <scr` + `ipt>
    // ── PAGINATOR + PRINT ─────────────────────────────────────────────
    // For each .doc-page whose content exceeds the locked A4 height,
    // overflowing children are MOVED into a new continuation .doc-page
    // placed immediately after it. The continuation page receives a
    // CLONED letterhead at the top and a CLONED letterhead-footer at
    // the bottom (same images as the source) so every printed sheet
    // shows BOTH the header and the footer — never one without the
    // other. The section heading (h2) and any signature/compiler
    // blocks are NOT cloned: they appear only on their original page.
    //
    // Atomic blocks (.signature-block, .compiler-block, .policy-entry,
    // .page-header, tables) are kept whole — never split internally.
    // If a single child is taller than one full page on its own, the
    // page is left intact and a gentle CSS-zoom fallback shrinks it
    // enough to fit (last resort, only ~5 % cases).

    function isLeadingNode(el) {
      if (!el || !el.classList) return false;
      return el.classList.contains('letterhead-img') ||
             el.classList.contains('page-header');
    }
    function isTrailingNode(el) {
      if (!el || !el.classList) return false;
      return el.classList.contains('letterhead-footer') ||
             el.classList.contains('page-number');
    }
    function isPerPageOnly(el) {
      // Don't duplicate page numbers onto continuation sheets
      return el && el.classList && el.classList.contains('page-number');
    }

    function trySqueezePage(page, middle, trailing, naturalH, lockedH,
                           prevH, prevMn, prevMx, prevOv) {
      var styles = window.getComputedStyle(page);
      var pTop = parseFloat(styles.paddingTop) || 0;
      var pBot = parseFloat(styles.paddingBottom) || 0;
      var footerClearancePx = 2;

      var leadingH = 0;
      Array.prototype.slice.call(page.children).forEach(function(c) {
        if (isLeadingNode(c)) leadingH += c.getBoundingClientRect().height;
      });
      var trailingH = 0;
      trailing.forEach(function(t) { trailingH += t.getBoundingClientRect().height; });

      var availableH = lockedH - pTop - pBot - leadingH - trailingH - footerClearancePx;
      var contentH = naturalH - pTop - pBot - leadingH - trailingH;

      if (contentH <= 0 || availableH <= 0) return false;

      var ratio = availableH / contentH;
      if (ratio < 0.82 || ratio >= 1.0) return false;

      var baseFontSize = parseFloat(styles.fontSize) || 9.5;
      var newFontSize = Math.max(baseFontSize * ratio, baseFontSize * 0.82);

      middle.forEach(function(el) {
        el.style.fontSize = newFontSize.toFixed(2) + 'pt';
        el.style.fontFamily = "'Poppins', sans-serif";
        var inners = el.querySelectorAll('p, li, td, th, span');
        Array.prototype.forEach.call(inners, function(child) {
          child.style.fontSize = newFontSize.toFixed(2) + 'pt';
          child.style.fontFamily = "'Poppins', sans-serif";
        });
        if (el.tagName === 'H2' || el.tagName === 'H3') {
          var headSize = el.tagName === 'H2'
            ? Math.max(newFontSize + 0.5, baseFontSize * 0.85)
            : newFontSize;
          el.style.fontSize = headSize.toFixed(2) + 'pt';
          el.style.marginTop = Math.max(parseFloat(el.style.marginTop || 6) * ratio, 2).toFixed(1) + 'px';
          el.style.marginBottom = Math.max(parseFloat(el.style.marginBottom || 8) * ratio, 2).toFixed(1) + 'px';
        }
      });

      page.style.setProperty('height', 'auto', 'important');
      page.style.setProperty('min-height', '0', 'important');
      page.style.setProperty('max-height', 'none', 'important');
      page.style.setProperty('overflow', 'visible', 'important');
      var squeezedH = page.getBoundingClientRect().height;
      page.style.height = prevH;
      page.style.minHeight = prevMn;
      page.style.maxHeight = prevMx;
      page.style.overflow = prevOv;

      if (squeezedH <= lockedH + 1) return true;

      middle.forEach(function(el) {
        el.style.removeProperty('font-size');
        el.style.removeProperty('line-height');
        el.style.removeProperty('font-family');
        var inners = el.querySelectorAll('p, li, td, th, span');
        Array.prototype.forEach.call(inners, function(child) {
          child.style.removeProperty('font-size');
          child.style.removeProperty('line-height');
          child.style.removeProperty('font-family');
        });
        if (el.tagName === 'H2' || el.tagName === 'H3') {
          el.style.removeProperty('margin-top');
          el.style.removeProperty('margin-bottom');
        }
      });
      return false;
    }

    function splitOverflowingPage(page, depth) {
      if (depth > 25) return; // safety against infinite recursion

      var children = Array.prototype.slice.call(page.children);

      // Identify the leading run (letterhead/page-header) at the top
      var leadEnd = 0;
      while (leadEnd < children.length && isLeadingNode(children[leadEnd])) {
        leadEnd++;
      }
      // Identify the trailing run (letterhead-footer) at the bottom
      var trailStart = children.length;
      while (trailStart > leadEnd && isTrailingNode(children[trailStart - 1])) {
        trailStart--;
      }

      var leading  = children.slice(0, leadEnd);
      var middle   = children.slice(leadEnd, trailStart);
      var trailing = children.slice(trailStart);

      if (middle.length < 2) return; // nothing meaningful to split

      // Measure natural overflow with the page temporarily un-locked
      var prevH  = page.style.height;
      var prevMn = page.style.minHeight;
      var prevMx = page.style.maxHeight;
      var prevOv = page.style.overflow;
      page.style.setProperty('height', 'auto', 'important');
      page.style.setProperty('min-height', '0', 'important');
      page.style.setProperty('max-height', 'none', 'important');
      page.style.setProperty('overflow', 'visible', 'important');

      var naturalH = page.getBoundingClientRect().height;

      // Restore the A4 lock for child-position measurements
      page.style.height    = prevH;
      page.style.minHeight = prevMn;
      page.style.maxHeight = prevMx;
      page.style.overflow  = prevOv;

      var lockedH = page.getBoundingClientRect().height;
      if (naturalH <= lockedH + 1) return; // fits — nothing to do

      // ── Squeeze: shrink font-size if overflow is small ──
      // Accounting-policy (notes) pages are exempt: they must stay at a fixed
      // 9.5pt Poppins, so they only ever paginate — never get squeezed.
      if (page.dataset.notesPage !== 'true') {
        if (trySqueezePage(page, middle, trailing, naturalH, lockedH,
                           prevH, prevMn, prevMx, prevOv)) return;
      }

      // Compute the y-coordinate at which middle content must end:
      // bottom of the page minus padding minus footer height.
      var pageRect = page.getBoundingClientRect();
      var styles = window.getComputedStyle(page);
      var pBot = parseFloat(styles.paddingBottom) || 0;
      var trailingH = 0;
      trailing.forEach(function(t) {
        trailingH += t.getBoundingClientRect().height;
      });
      // Keep a safety gap above the footer to avoid text crowding it.
      var footerClearancePx = 2;
      var maxBottom = pageRect.top + lockedH - pBot - trailingH - footerClearancePx;

      // Find first middle child whose bottom edge crosses maxBottom
      var cutoff = -1;
      for (var i = 0; i < middle.length; i++) {
        var rect = middle[i].getBoundingClientRect();
        if (rect.bottom > maxBottom) { cutoff = i; break; }
      }

      // Need at least one middle element to remain on the source page.
      // If even the first middle child overflows, we can't split safely
      // (it would create an empty leading page). Leave for the zoom
      // fallback to handle.
      if (cutoff <= 0) return;

      // Build the continuation page — same tag/class/inline-style
      var newPage = document.createElement('div');
      newPage.className = page.className;
      var inlineStyle = page.getAttribute('style');
      if (inlineStyle) newPage.setAttribute('style', inlineStyle);
      // Preserve the notes-page flag so continuation sheets keep the
      // fixed-9.5pt / no-squeeze behaviour too.
      if (page.dataset.notesPage === 'true') newPage.dataset.notesPage = 'true';
      // A continuation is the same content as the page it overflowed from, so it
      // belongs to the same section and the same split. Without this the page
      // order below would classify it as unknown and drop it into the default
      // file — the exact failure the section tagging exists to prevent.
      if (page.dataset.docSection) newPage.dataset.docSection = page.dataset.docSection;
      if (page.dataset.split) newPage.dataset.split = page.dataset.split;
      newPage.dataset.continuation = 'true';

      // Move overflowing middle children into the continuation page.
      // Strip per-page-only nodes (e.g. .page-number) — they belong to
      // the original page only.
      for (var j = cutoff; j < middle.length; j++) {
        if (isPerPageOnly(middle[j])) {
          if (middle[j].parentNode) {
            middle[j].parentNode.removeChild(middle[j]);
          }
        } else {
          newPage.appendChild(middle[j]);
        }
      }

      // Insert the continuation page immediately after the source
      page.parentNode.insertBefore(newPage, page.nextSibling);

      // Recurse — the continuation may itself overflow
      splitOverflowingPage(newPage, (depth || 0) + 1);
    }

    function paginatePages() {
      // Cover pages are not paginated — they're designed as a single sheet.
      // CA declaration page is excluded — it's a dense single-sheet design;
      // any minor overflow is handled by autoFitResidual zoom instead.
      var pages = Array.prototype.slice.call(
        document.querySelectorAll('.doc-page')
      );
      pages.forEach(function(p) {
        if (p.classList.contains('ca-decl-page')) return;
        splitOverflowingPage(p, 0);
      });
    }

    // Last-resort fallback for any page that STILL overflows after
    // pagination (e.g. one giant atomic child taller than a page).
    function autoFitResidual() {
      var pages = document.querySelectorAll('.doc-page, .cover-page');
      Array.prototype.forEach.call(pages, function(page) {
        var isCover = page.classList.contains('cover-page');
        // Notes (accounting policy) pages stay at a fixed 9.5pt — never zoom-shrunk.
        if (page.dataset.notesPage === 'true') return;

        page.style.setProperty('height', 'auto', 'important');
        page.style.setProperty('min-height', '0', 'important');
        page.style.setProperty('max-height', 'none', 'important');
        page.style.setProperty('overflow', 'visible', 'important');
        var naturalH = page.getBoundingClientRect().height;

        page.style.setProperty('height', '297mm', 'important');
        page.style.setProperty('min-height', '297mm', 'important');
        page.style.removeProperty('max-height');
        page.style.setProperty('overflow', 'hidden', 'important');
        var targetH = page.getBoundingClientRect().height;

        if (naturalH > targetH * 1.005) {
          var ratio = targetH / naturalH;
          if (ratio < 0.80) return; // too extreme — let it clip

          var pTop = 15, pBot = 19, pH = 18;
          page.style.setProperty('width',  (210 / ratio).toFixed(4) + 'mm', 'important');
          page.style.setProperty('height', (297 / ratio).toFixed(4) + 'mm', 'important');
          page.style.setProperty('min-height', (297 / ratio).toFixed(4) + 'mm', 'important');
          page.style.setProperty('padding',
            (pTop / ratio).toFixed(4) + 'mm ' +
            (pH   / ratio).toFixed(4) + 'mm ' +
            (pBot / ratio).toFixed(4) + 'mm ' +
            (pH   / ratio).toFixed(4) + 'mm', 'important');
          page.style.zoom = ratio;
        }
      });
    }

    // Publishes one entry per finished page: which section it holds and which
    // of the two output files it belongs to. Read back by the Electron main
    // process (executeJavaScript) and by the browser render path (iframe), and
    // handed to I Love INF181 as the split plan.
    function buildPageOrder() {
      var pages = document.querySelectorAll('.doc-page, .cover-page');
      window.__pageOrder = Array.prototype.map.call(pages, function (p, i) {
        return {
          page: i + 1,
          section: p.getAttribute('data-doc-section') || 'unknown',
          split: p.getAttribute('data-split') || '2'
        };
      });
    }

    function applyIndents() {
      var pages = document.querySelectorAll('.doc-page, .cover-page');
      Array.prototype.forEach.call(pages, function(page) {
        var il = parseFloat(page.dataset.indentLeft) || 0;
        var ir = parseFloat(page.dataset.indentRight) || 0;
        if (il > 0 || ir > 0) {
          var padL = Math.max(il, 0);
          var padR = Math.max(ir, 0);
          page.style.setProperty('padding-left', padL + 'mm', 'important');
          page.style.setProperty('padding-right', padR + 'mm', 'important');
          var hdr = page.querySelector('.letterhead-img');
          if (hdr) {
            hdr.style.setProperty('margin-left', '-' + padL + 'mm', 'important');
            hdr.style.setProperty('margin-right', '-' + padR + 'mm', 'important');
            hdr.style.setProperty('width', 'calc(100% + ' + (padL + padR) + 'mm)', 'important');
          }
          var ftr = page.querySelector('.letterhead-footer-img');
          if (ftr) {
            ftr.style.setProperty('margin-left', '-' + padL + 'mm', 'important');
            ftr.style.setProperty('margin-right', '-' + padR + 'mm', 'important');
            ftr.style.setProperty('width', 'calc(100% + ' + (padL + padR) + 'mm)', 'important');
          }
        }
      });
    }

    window.onload = function() {
      var imgs = Array.prototype.slice.call(document.images || []);
      var pending = imgs.filter(function(img) { return !img.complete; });
      var fire = function() {
        setTimeout(function() {
          applyIndents();
          paginatePages();
          autoFitResidual();
          buildPageOrder();
          setTimeout(function() {
            ${autoPrint
              ? 'window.print(); setTimeout(function() { window.close(); }, 500);'
              : 'window.__printReady = true;'}
          }, 200);
        }, 250);
      };
      if (pending.length === 0) { fire(); return; }
      var remaining = pending.length;
      var done = function() {
        remaining--;
        if (remaining <= 0) fire();
      };
      pending.forEach(function(img) {
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
      });
      // Hard fallback in case some image hangs
      setTimeout(fire, 3000);
    };
  </scr` + `ipt>
</body>
</html>`;

    return printHTML;
  }

  // \u2500\u2500 Edit with I Love INF181 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  // Hands the freshly generated document to the bundled ILoveINF181 editor.
  //  \u2022 Desktop (Electron): captures the print-layout PDF bytes via the main
  //    process (printToPDF) and opens ILoveINF181 pre-loaded with them \u2014 no file
  //    picking, works offline.
  //  \u2022 Browser: opens ILoveINF181 in a new tab; the user drops in the PDF they
  //    just saved (browsers can't return print bytes programmatically).
  async editWithILoveINF181() {
    const output = this.documentOutput;
    if (!output || !output.classList.contains('visible')) {
      alert('Please generate a document first before editing it with I Love INF181.');
      return;
    }

    // Closed with X earlier? Offer to go back to that work before rendering anew.
    const choice = await this._resumeOrNew('ILoveINF181');
    if (choice === 'cancel') return;
    if (choice === 'resume') { this._showEditorOverlay(); return; }

    const btn = document.getElementById('btn-ILoveINF181');
    const prevLabel = btn ? btn.innerHTML : null;
    if (btn) { btn.disabled = true; btn.textContent = 'Preparing…'; }

    try {
      const printHTML = this.buildPrintHTML({ autoPrint: false });
      if (!printHTML) return;

      const desktop = window.policygenDesktop;
      let bytes;
      let pageOrder = null;
      if (desktop && desktop.isDesktop && typeof desktop.renderILoveINF181Pdf === 'function') {
        // Desktop (Electron): the main process renders the print HTML to a
        // high-fidelity PDF (printToPDF) and returns the bytes, which we then
        // load into the embedded editor — same single window, no popup.
        const result = await desktop.renderILoveINF181Pdf(printHTML);
        if (!result || !result.ok) throw new Error(result && result.error ? result.error : 'render failed');
        bytes = this._base64ToBytes(result.base64);
        pageOrder = result.pageOrder || null;
      } else {
        // Browser: render the document to PDF bytes locally (html2canvas +
        // pdf-lib, both vendored for offline use).
        const rendered = await this._renderDocumentToPdf(printHTML);
        bytes = rendered.bytes;
        pageOrder = rendered.pageOrder;
      }
      this._openILoveINF181Overlay(bytes, pageOrder);
    } catch (err) {
      console.error('Could not open I Love INF181:', err);
      alert('Could not prepare the document for I Love INF181. Please try again.');
    } finally {
      if (btn && prevLabel !== null) { btn.disabled = false; btn.innerHTML = prevLabel; }
    }
  }

  // ── Embedded I Love INF181 editor ──────────────────────────────────────────
  // Loads the bundled editor into the in-page overlay iframe (instead of a
  // popup window) and hands it the freshly rendered PDF bytes once it loads.
  _openILoveINF181Overlay(bytes, pageOrder) {
    const overlay = document.getElementById('ILoveINF181-overlay');
    const frame = document.getElementById('ILoveINF181-frame');
    if (!overlay || !frame) {
      console.error('I Love INF181 overlay markup is missing.');
      return;
    }
    const base64 = this._bytesToBase64(bytes);
    const editorUrl = new URL('ILoveINF181/index.html', window.location.href).href;

    // Deliver the bytes once the editor has finished loading. We use postMessage
    // rather than calling frame.contentWindow.ILoveINF181Receive() directly because
    // when the app is opened as a plain web file (file://), browsers give every
    // file:// document a separate "opaque" origin, so a direct cross-frame call
    // throws a SecurityError and the editor silently opens empty. postMessage
    // works in both that case and inside the Electron desktop app.
    const deliver = () => {
      try {
        const coName = document.getElementById('companyName') ? document.getElementById('companyName').value.trim() : '[COMPANY]';
        const yearEnd = document.getElementById('yearEnd') ? document.getElementById('yearEnd').value.trim() : '[YEAR END]';
        const filename = `PG Reports - ${coName || '[COMPANY]'} ${yearEnd || '[YEAR END]'}.pdf`;
        frame.contentWindow.postMessage({ type: 'ILoveINF181:handoff', base64, filename, pageOrder: pageOrder || null }, '*');
      } catch (err) {
        console.error('I Love INF181 hand-off failed:', err);
      }
    };
    frame.addEventListener('load', deliver, { once: true });

    // A new hand-off always gets a fresh editor; the user already chose "new".
    this._loadEditor('ILoveINF181', editorUrl);
  }

  // ── Keeping the editor's work across X ──────────────────────────────────
  // The overlay's X only hides the editor; the iframe (and everything the user
  // organised in it) stays loaded so they can pop back to the generator and
  // return. Opening again asks: return to that work, or start a new one.
  // `_editorKind` is what the frame holds: 'ILoveINF181', 'pdf-editor' or null.

  _loadEditor(kind, url) {
    const frame = document.getElementById('ILoveINF181-frame');
    if (!frame) return;
    this._listenForEditorClose(frame);
    frame.src = url;
    this._editorKind = kind;
    this._showEditorOverlay();
  }

  _showEditorOverlay() {
    const overlay = document.getElementById('ILoveINF181-overlay');
    if (overlay) overlay.classList.add('visible');
  }

  // The overlay has no title bar; each editor draws its own X (beside Save
  // PDF) and posts 'ILoveINF181:close' up to us.
  _listenForEditorClose(frame) {
    if (this._editorCloseWired) return;
    this._editorCloseWired = true;
    window.addEventListener('message', (e) => {
      if (e.source === frame.contentWindow && e.data && e.data.type === 'ILoveINF181:close') {
        this.closeILoveINF181();
      }
    });
  }

  // Asks the I Love INF181 frame how many pages it holds. Resolves null when it
  // does not answer (the PDF editor, or an editor still loading).
  _queryEditorPages() {
    const frame = document.getElementById('ILoveINF181-frame');
    const win = frame && frame.contentWindow;
    if (!win || this._editorKind !== 'ILoveINF181') return Promise.resolve(null);
    return new Promise(resolve => {
      const onMsg = (e) => {
        if (e.source !== win || !e.data || e.data.type !== 'ILoveINF181:status') return;
        done(typeof e.data.pages === 'number' ? e.data.pages : null);
      };
      const done = (v) => { clearTimeout(timer); window.removeEventListener('message', onMsg); resolve(v); };
      const timer = setTimeout(() => done(null), 400);
      window.addEventListener('message', onMsg);
      try { win.postMessage({ type: 'ILoveINF181:status-request' }, '*'); } catch (_) { done(null); }
    });
  }

  // Resolves 'new' when nothing is waiting in the editor, else asks the user
  // and resolves 'resume', 'new' or 'cancel'. `kind` is the editor being opened.
  async _resumeOrNew(kind) {
    if (!this._editorKind) return 'new';
    const pages = await this._queryEditorPages();
    if (pages === 0) return 'new';   // editor open but empty — nothing to lose

    const heldName = this._editorKind === 'pdf-editor' ? 'the PDF Editor' : 'I Love INF181';
    const sameKind = this._editorKind === kind;
    const what = pages ? `${pages} page${pages === 1 ? '' : 's'}` : 'work';
    const newLabel = kind === 'pdf-editor' ? 'Open the PDF Editor'
      : (sameKind ? 'Start a new one' : 'Open I Love INF181');

    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'ps-input-overlay';
      overlay.innerHTML = `
        <div class="ps-input-modal">
          <h3>Return to where you were?</h3>
          <p class="ps-input-hint">You still have ${what} open in ${heldName} from before you closed it.
            Starting a new one discards that work.</p>
          <div class="ps-actions">
            <button class="ps-btn ps-btn-cancel" data-act="cancel">Cancel</button>
            <button class="ps-btn ps-btn-secondary" data-act="new">${newLabel}</button>
            <button class="ps-btn ps-btn-apply" data-act="resume">Return to where I was</button>
          </div>
        </div>`;
      const finish = (act) => {
        overlay.remove();
        document.removeEventListener('keydown', onKey, true);
        // Returning to a different editor than the one asked for: show it as is.
        if (act === 'resume' && !sameKind) { this._showEditorOverlay(); act = 'cancel'; }
        resolve(act);
      };
      const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); finish('cancel'); } };
      overlay.querySelectorAll('[data-act]').forEach(b => { b.onclick = () => finish(b.dataset.act); });
      overlay.addEventListener('click', e => { if (e.target === overlay) finish('cancel'); });
      document.addEventListener('keydown', onKey, true);
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.querySelector('[data-act="resume"]').focus());
    });
  }

  // Opens an editor in the shared overlay, offering to return to earlier work.
  async openEditor(kind, url) {
    const choice = await this._resumeOrNew(kind);
    if (choice === 'cancel') return;
    if (choice === 'resume') { this._showEditorOverlay(); return; }
    this._loadEditor(kind, url);
  }

  closeILoveINF181() {
    const overlay = document.getElementById('ILoveINF181-overlay');
    // Hide only — the editor keeps its document so the user can come back to
    // it (see _resumeOrNew). Starting a new one is what replaces it.
    if (overlay) overlay.classList.remove('visible');
  }

  _base64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  // Render the print-layout HTML to PDF bytes entirely in the browser. Each
  // generated page is rasterised with html2canvas and placed on its own A4 page
  // via pdf-lib. Used by the browser hand-off so the editor opens pre-loaded
  // even with no internet connection.
  async _renderDocumentToPdf(printHTML) {
    if (typeof html2canvas === 'undefined' || typeof PDFLib === 'undefined') {
      throw new Error('PDF libraries (html2canvas / pdf-lib) are not loaded.');
    }

    // Render the print HTML in an offscreen iframe so pagination runs exactly as
    // it would for printing, without disturbing the live preview.
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed; left:-10000px; top:0; width:900px; height:1400px; border:0;';
    document.body.appendChild(iframe);

    try {
      const idoc = iframe.contentDocument;
      idoc.open();
      idoc.write(printHTML);
      idoc.close();

      // Wait until the iframe's pagination script signals it has finished.
      await this._waitFor(() => iframe.contentWindow && iframe.contentWindow.__printReady === true, 10000);

      // Swap bundled letterhead/logo images for inlined data URIs so html2canvas
      // can export the canvas — file:// images would otherwise taint it. User-
      // uploaded letterheads are already data URIs and are left untouched.
      const dataUris = window.POLICYGEN_IMAGE_DATA_URIS || {};
      idoc.querySelectorAll('img').forEach(img => {
        const src = img.getAttribute('src') || '';
        if (src.startsWith('data:')) return;
        const name = decodeURIComponent(src.split('/').pop().split('?')[0]);
        if (dataUris[name]) img.setAttribute('src', dataUris[name]);
      });

      const pageEls = Array.from(idoc.querySelectorAll('.doc-page, .cover-page'));
      if (!pageEls.length) throw new Error('No pages found to render.');

      const { PDFDocument } = PDFLib;
      const pdfDoc = await PDFDocument.create();
      const A4 = { w: 595.28, h: 841.89 }; // points

      for (const el of pageEls) {
        const canvas = await html2canvas(el, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
        });
        const png = await pdfDoc.embedPng(canvas.toDataURL('image/png'));
        const page = pdfDoc.addPage([A4.w, A4.h]);
        page.drawImage(png, { x: 0, y: 0, width: A4.w, height: A4.h });
      }

      const bytes = await pdfDoc.save();
      // Read the order out of the very DOM the pages were rasterised from, so a
      // plan entry and a PDF page can never disagree.
      const pageOrder = (iframe.contentWindow && iframe.contentWindow.__pageOrder) || null;
      return { bytes, pageOrder: pageOrder ? JSON.parse(JSON.stringify(pageOrder)) : null };
    } finally {
      iframe.remove();
    }
  }

  // Poll a predicate until it is true or the timeout elapses.
  _waitFor(predicate, timeoutMs = 8000, intervalMs = 100) {
    return new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        if (predicate() || Date.now() - start > timeoutMs) resolve();
        else setTimeout(tick, intervalMs);
      };
      tick();
    });
  }

  // Base64-encode bytes in chunks to avoid call-stack limits on large arrays.
  _bytesToBase64(bytes) {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  // ── Preview Pagination ───────────────────────────────────────────────────
  // Delegates to PagePaginator to split overflowing .doc-page elements.

  paginatePreview() {
    new PagePaginator(this.documentOutput).paginate();
  }

  // ── Live update (stub — generate on button) ─────────────────────────────

  liveUpdate() {
    this.generateDocFn();
  }
}
