// ── PagePaginator ──────────────────────────────────────────────────────────
// Splits overflowing .doc-page elements so that every page shows both its
// letterhead header and footer.  Used by PreviewManager for live preview
// pagination.
// ────────────────────────────────────────────────────────────────────────────

// ── Orphan letterhead-footer removal ───────────────────────────────────────
// Rule: the letterhead image and the letterhead footer belong on the SAME
// sheet. Sheet 2 onwards of a letter is a plain sheet — neither header nor
// footer — which is what every generated letter does. Two paths used to break
// it: the school review/audit engagement letters emitted a footer on their
// continuation sheets with no letterhead above it, and a business saved by an
// older build replays that markup verbatim through `savedPagesHtml`, so the
// stray footer comes back on load even after the generator is fixed. Strip any
// footer sitting on a page that has no letterhead image, so old statements are
// corrected when they are loaded rather than carrying it into the PDF.
// A footer the user placed by hand (edit mode → Insert Footer) is marked
// `data-manual-footer` and is never touched.
function stripOrphanLetterheadFooters(root) {
  if (!root || !root.querySelectorAll) return 0;
  let removed = 0;
  root.querySelectorAll('.doc-page, .cover-page').forEach(page => {
    if (page.querySelector('.letterhead-img')) return;
    page.querySelectorAll('.letterhead-footer').forEach(footer => {
      if (footer.hasAttribute('data-manual-footer')) return;
      footer.remove();
      removed++;
    });
  });
  return removed;
}

class PagePaginator {
  constructor(container) {
    this.container = container;
    // Keep a small safety gap above footers so text never appears to touch/overlap.
    this.footerClearancePx = 2;
  }

  // ── Measurement ──────────────────────────────────────────────────────────
  // The preview scales the whole document down with a CSS transform to fit the
  // panel. getBoundingClientRect() reports the scaled size; getComputedStyle()
  // padding reports the unscaled one. Mixing them silently corrupts every fit
  // calculation below, and the answer would drift as the user drags the split
  // divider. So: all box measurements stay in scaled (viewport) space as
  // before, and the few computed-style lengths are scaled to match via _px().
  // At scale 1 — printing, or a panel wide enough for a full sheet — this is
  // arithmetically identical to the original.
  _scaleOf(page) {
    const layoutH = page.offsetHeight; // immune to ancestor transforms
    if (!layoutH) return 1;
    const s = page.getBoundingClientRect().height / layoutH;
    return s > 0 ? s : 1;
  }

  // Convert an unscaled CSS length into the scaled space the rects live in.
  _px(len, scale) {
    return (parseFloat(len) || 0) * scale;
  }

  paginate() {
    if (!this.container) return;

    // A footer with no letterhead above it is never correct — clear those
    // before measuring, so the sheet is laid out at its real content height.
    stripOrphanLetterheadFooters(this.container);

    // Undo previous squeeze: strip all inline overrides from content.
    // Hand-edited pages hold the user's own markup — leave them as they are.
    this.container.querySelectorAll('.doc-page').forEach(page => {
      if (page.hasAttribute('data-edited')) return;
      // The CA(SA) declaration is a locked-height, single-sheet design: its
      // shrinkable .ca-decl-gap absorbs any overflow via the flex column, so it
      // must never be squeezed or split (see _splitPage skip below, and the
      // matching exclusion on the print path in PreviewManager). Leaving its
      // generator-emitted inline styles untouched is part of that.
      if (page.classList.contains('ca-decl-page')) return;
      Array.from(page.children).forEach(el => {
        if (this._isLeading(el) || this._isTrailing(el) || this._isOverlay(el)) return;
        // Address lines own their spacing (see DocumentGenerator's addrLine).
        // Stripping their inline line-height here would drop them onto whatever
        // the page inherits — 1.3 on a compact page, 1.32 or 1.55 elsewhere —
        // so the same address would be spaced differently page to page.
        if (el.classList.contains('addr-line')) return;
        el.style.removeProperty('font-size');
        el.style.removeProperty('line-height');
        el.style.removeProperty('font-family');
        el.style.removeProperty('margin-top');
        el.style.removeProperty('margin-bottom');
        el.querySelectorAll('p, li, td, th, span, br').forEach(child => {
          // …and neither are the lines inside one (the <br>s that separate an
          // address's lines): a squeezed <br> is font-size:1pt/line-height:0.5.
          if (child.closest('.addr-line')) return;
          child.style.removeProperty('font-size');
          child.style.removeProperty('line-height');
          child.style.removeProperty('font-family');
          child.style.removeProperty('margin-top');
          child.style.removeProperty('margin-bottom');
        });
        if (el.tagName === 'H2' || el.tagName === 'H3') {
          el.style.removeProperty('margin-top');
          el.style.removeProperty('margin-bottom');
        }
        // Reset signature block overrides
        const sigRoot = el.classList.contains('signature-block') ? el : el.querySelector('.signature-block');
        if (sigRoot) {
          sigRoot.style.removeProperty('margin-top');
          sigRoot.querySelectorAll('[style]').forEach(inner => {
            inner.style.removeProperty('margin-top');
            inner.style.removeProperty('margin-bottom');
            inner.style.removeProperty('min-height');
          });
        }
      });
    });

    // Undo previous pagination: move content from continuation pages back,
    // then remove the empty shells, so re-pagination starts fresh.
    this.container.querySelectorAll('.doc-page[data-continuation]').forEach(cont => {
      if (cont.hasAttribute('data-edited') && !cont.hasAttribute('data-reflow')) return;
      const prev = cont.previousElementSibling;
      if (prev && prev.classList.contains('doc-page')) {
        const footer = prev.querySelector('.letterhead-footer');
        Array.from(cont.children).forEach(child => {
          if (this._isLeading(child) || this._isTrailing(child) || this._isOverlay(child)) return;
          // The tail half of a list split across sheets folds back into the
          // list it came from, so re-pagination sees one list again rather
          // than two adjacent ones that can never re-merge.
          if (child.hasAttribute('data-list-continuation')) {
            const lists = prev.querySelectorAll('ul, ol');
            const host = lists[lists.length - 1];
            if (host && host.tagName === child.tagName) {
              Array.from(child.children).forEach(li => host.appendChild(li));
              child.remove();
              return;
            }
            child.removeAttribute('data-list-continuation');
          }
          if (footer) prev.insertBefore(child, footer);
          else prev.appendChild(child);
        });
      }
      cont.remove();
    });

    const pages = Array.from(this.container.querySelectorAll('.doc-page'));
    pages.forEach(page => {
      // CA(SA) declaration: never split. Its locked-height flex column shrinks
      // the .ca-decl-gap to keep the text and signature together on one sheet —
      // the same treatment the print/PDF path gives it. Splitting here is what
      // used to bump the signature onto a second page at 9.5pt.
      if (page.classList.contains('ca-decl-page')) return;
      if (!page.hasAttribute('data-edited') || page.hasAttribute('data-reflow')) this._splitPage(page, 0);
    });

    this._settleReflow();
    this._alignLetterSpacers();
  }

  // A hand-edited group flagged data-reflow (its accounting policies changed —
  // EditToolbar.js, _reconcilePolicyEntries) has just been merged and split like
  // a generated page. It goes back to being hand-edited, continuation sheets the
  // split created included. Its inline styles were never stripped above, and
  // notes pages are never squeezed, so the user's own markup is untouched.
  _settleReflow() {
    this.container.querySelectorAll('.doc-page[data-reflow]').forEach(page => {
      const uid = page.getAttribute('data-page-uid');
      const editable = page.getAttribute('contenteditable') === 'true';
      const group = uid
        ? this.container.querySelectorAll(`.doc-page[data-page-uid="${CSS.escape(uid)}"]`)
        : [page];
      group.forEach(p => {
        p.setAttribute('data-edited', 'true');
        p.removeAttribute('data-reflow');
        if (editable) p.setAttribute('contenteditable', 'true');
      });
    });
  }

  // Letter continuation sheets (no letterhead) open with an .lh-line-spacer.
  // data-lh-align="centre" sizes it so the sheet's content sits in the middle:
  // the gap from the sheet's top edge to the first line equals the gap from
  // the last line to the sheet's bottom edge. data-lh-align="follow" copies the
  // most recent centred spacer, so the sheets after it start at the same height
  // whatever their own fill. Runs after splitting, on the final content; the
  // spacer is 0 by default, so pagination measured the page without it, and the
  // clamp below keeps the bottom gap from ever eating into the bottom padding.
  // The height is written in mm (unscaled), so print/PDF carry it verbatim.
  _alignLetterSpacers() {
    const PX_PER_MM = 96 / 25.4;
    let centred = null;
    this.container.querySelectorAll('.lh-line-spacer[data-lh-align]').forEach(spacer => {
      const page = spacer.closest('.doc-page');
      if (!page) return;
      if (spacer.getAttribute('data-lh-align') === 'follow') {
        if (centred !== null) spacer.style.height = centred.toFixed(2) + 'mm';
        return;
      }
      spacer.style.height = '0';
      const scale = this._scaleOf(page);
      const content = Array.from(page.children).filter(c =>
        c !== spacer && !this._isTrailing(c) && !this._isOverlay(c));
      if (!content.length) return;
      const top = content[0].getBoundingClientRect().top;
      const bottom = Math.max(...content.map(c => c.getBoundingClientRect().bottom));
      const contentH = (bottom - top) / scale;
      const sheetH = page.offsetHeight;
      const styles = window.getComputedStyle(page);
      const pTop = parseFloat(styles.paddingTop) || 0;
      const pBot = parseFloat(styles.paddingBottom) || 0;
      const gap = (sheetH - contentH) / 2;
      const h = Math.max(0, Math.min(gap - pTop, sheetH - pBot - contentH - pTop));
      centred = h / PX_PER_MM;
      spacer.style.height = centred.toFixed(2) + 'mm';
    });
  }

  // Preview-only chrome sitting inside a page (the organise split chip). Absolutely
  // positioned, contributes no height, and must never be measured, squeezed or
  // moved onto a continuation sheet.
  _isOverlay(el) {
    return !!el && !!el.classList && el.classList.contains('page-split-chip');
  }

  _isLeading(el) {
    if (!el || !el.classList) return false;
    if (el.classList.contains('letterhead-img') || el.classList.contains('page-header')) return true;
    if (el.tagName === 'H2' && el.parentElement &&
        el.parentElement.hasAttribute('data-continuation-of')) return true;
    return false;
  }

  // Blocks that must not be the last thing on a sheet. Real headings, plus any
  // block the generator marked `.keep-next` — a lead-in sentence that only
  // makes sense immediately above the text it introduces ("These amendments
  // were made to the Letter of Authority:").
  _isHeading(el) {
    if (!el || !el.tagName) return false;
    if (el.tagName === 'H1' || el.tagName === 'H2' || el.tagName === 'H3') return true;
    if (!el.classList) return false;
    return el.classList.contains('underline-heading') || el.classList.contains('keep-next');
  }

  // A list is the one block-level child that can be cut open, between its
  // items, rather than moved to the next sheet whole.
  _isList(el) {
    return !!el && (el.tagName === 'UL' || el.tagName === 'OL') &&
      Array.from(el.children).filter(c => c.tagName === 'LI').length > 1;
  }

  _isTrailing(el) {
    return el && el.classList &&
      (el.classList.contains('letterhead-footer') || el.classList.contains('page-number'));
  }

  _trySqueeze(page, middle, trailing, naturalH, lockedH, saved) {
    const styles = window.getComputedStyle(page);
    const scale = this._scaleOf(page);
    const pTop = this._px(styles.paddingTop, scale);
    const pBot = this._px(styles.paddingBottom, scale);

    let leadingH = 0;
    Array.from(page.children).forEach(c => {
      if (this._isLeading(c)) leadingH += c.getBoundingClientRect().height;
    });
    let trailingH = 0;
    trailing.forEach(t => {
      const pos = window.getComputedStyle(t).position;
      if (pos !== 'absolute' && pos !== 'fixed') {
        trailingH += t.getBoundingClientRect().height;
      }
    });

    const availableH = lockedH - pTop - pBot - leadingH - trailingH - this.footerClearancePx * scale;
    const contentH = naturalH - pTop - pBot - leadingH - trailingH;

    if (contentH <= 0 || availableH <= 0) return false;

    const ratio = availableH / contentH;
    if (ratio < 0.82 || ratio >= 1.0) return false;

    const baseFontSize = parseFloat(styles.fontSize) || 9.5;

    // Progressive tiers — start gentle, escalate until content fits
    const tiers = [
      { lh: 0.92, fs: baseFontSize,                    mg: 0.9  },
      { lh: 0.85, fs: baseFontSize,                    mg: 0.8  },
      { lh: 0.82, fs: baseFontSize * 0.96,             mg: 0.75 },
      { lh: 0.80, fs: baseFontSize * 0.93,             mg: 0.65 },
      { lh: 0.78, fs: Math.max(baseFontSize * 0.82, baseFontSize * ratio), mg: 0.55 },
    ];

    // Start from the gentlest tier that MIGHT work based on ratio
    let startTier = 0;
    if (ratio < 0.85) startTier = 3;
    else if (ratio < 0.90) startTier = 2;
    else if (ratio < 0.95) startTier = 1;

    for (let t = startTier; t < tiers.length; t++) {
      const tier = tiers[t];
      if (this._applySqueezeTier(page, middle, baseFontSize, tier, saved, lockedH)) return true;
    }
    return false;
  }

  _applySqueezeTier(page, middle, baseFontSize, tier, saved, lockedH) {
    const { lh: newLineHeight, fs: newFontSize, mg: marginScale } = tier;

    const applyEl = (el) => {
      const computed = window.getComputedStyle(el);
      const currentLH = parseFloat(computed.lineHeight);
      const currentFS = parseFloat(computed.fontSize);
      if (currentLH && currentFS) {
        const lhRatio = currentLH / currentFS;
        const squeezedLH = Math.max(lhRatio * newLineHeight, 1.05);
        el.style.lineHeight = squeezedLH.toFixed(3);
      }
      if (newFontSize !== baseFontSize && !(el.classList && el.classList.contains('minutes-title'))) {
        el.style.fontSize = newFontSize.toFixed(2) + 'pt';
      }
      el.style.fontFamily = "'Poppins', sans-serif";
    };

    middle.forEach(el => {
      // Address lines are exempt from the squeeze entirely: an address must
      // read the same on every page, squeezed or not (see the undo pass above).
      if (el.classList && el.classList.contains('addr-line')) return;

      if (el.tagName === 'BR') {
        el.style.fontSize = '1pt';
        el.style.lineHeight = '0.5';
        return;
      }

      applyEl(el);
      el.querySelectorAll('p, li, td, th, span').forEach(child => {
        if (child.closest('.addr-line')) return;
        applyEl(child);
      });

      el.querySelectorAll('br').forEach(br => {
        // An address's line breaks are its line spacing — shrinking them to
        // 1pt/0.5 is exactly what made addresses uneven before 1.9.1.
        if (br.closest('.addr-line')) return;
        br.style.fontSize = '1pt';
        br.style.lineHeight = '0.5';
      });

      el.querySelectorAll('p, li').forEach(child => {
        const cm = window.getComputedStyle(child);
        const mt = parseFloat(cm.marginTop) || 0;
        const mb = parseFloat(cm.marginBottom) || 0;
        if (mt > 2) child.style.marginTop = (mt * marginScale).toFixed(1) + 'px';
        if (mb > 2) child.style.marginBottom = (mb * marginScale).toFixed(1) + 'px';
      });

      if (el.tagName === 'P' || el.tagName === 'DIV') {
        const cm = window.getComputedStyle(el);
        const mt = parseFloat(cm.marginTop) || 0;
        const mb = parseFloat(cm.marginBottom) || 0;
        if (mt > 2) el.style.marginTop = (mt * marginScale).toFixed(1) + 'px';
        if (mb > 2) el.style.marginBottom = (mb * marginScale).toFixed(1) + 'px';
      }

      if (el.classList.contains('signature-block') || el.querySelector('.signature-block')) {
        const sigRoot = el.classList.contains('signature-block') ? el : el.querySelector('.signature-block');
        const srCm = window.getComputedStyle(sigRoot);
        const srMt = parseFloat(srCm.marginTop) || 0;
        if (srMt > 4) sigRoot.style.marginTop = Math.max(srMt * marginScale, 4).toFixed(1) + 'px';

        sigRoot.querySelectorAll('[style*="margin-top"]').forEach(inner => {
          const imt = parseFloat(inner.style.marginTop) || 0;
          if (imt > 4) inner.style.marginTop = Math.max(imt * marginScale, 4).toFixed(1) + 'px';
        });
        sigRoot.querySelectorAll('[style*="min-height"]').forEach(spacer => {
          const mh = parseFloat(spacer.style.minHeight) || 0;
          if (mh >= 40) spacer.style.minHeight = Math.max(mh * marginScale, 25).toFixed(0) + 'px';
        });
        sigRoot.querySelectorAll('[style*="margin-bottom"]').forEach(item => {
          const imb = parseFloat(item.style.marginBottom) || 0;
          if (imb > 6) item.style.marginBottom = Math.max(imb * marginScale, 6).toFixed(1) + 'px';
        });
      }

      if (el.tagName === 'H2' || el.tagName === 'H3') {
        // Minutes headings keep their fixed 9.5pt so the directors' meeting and
        // the AGM read identically even when only one of the two is squeezed.
        if (!el.classList.contains('minutes-title')) {
          const headSize = el.tagName === 'H2'
            ? Math.max(newFontSize + 0.5, baseFontSize * 0.85)
            : newFontSize;
          el.style.fontSize = headSize.toFixed(2) + 'pt';
        }
        const cm = window.getComputedStyle(el);
        const mt = parseFloat(cm.marginTop) || 6;
        const mb = parseFloat(cm.marginBottom) || 8;
        el.style.marginTop = Math.max(mt * marginScale, 2).toFixed(1) + 'px';
        el.style.marginBottom = Math.max(mb * marginScale, 2).toFixed(1) + 'px';
      }
    });

    // Verify fit
    page.style.setProperty('height', 'auto', 'important');
    page.style.setProperty('min-height', '0', 'important');
    page.style.setProperty('max-height', 'none', 'important');
    page.style.setProperty('overflow', 'visible', 'important');
    const squeezedH = page.getBoundingClientRect().height;
    page.style.height = saved.h;
    page.style.minHeight = saved.mn;
    page.style.maxHeight = saved.mx;
    page.style.overflow = saved.ov;

    if (squeezedH <= lockedH + 1) return true;

    // This tier wasn't enough — revert for next attempt
    this._revertSqueeze(middle);
    return false;
  }

  _revertSqueeze(middle) {
    middle.forEach(el => {
      // Never squeezed, so never reverted — see the exemption in the tier pass.
      if (el.classList && el.classList.contains('addr-line')) return;
      el.style.removeProperty('font-size');
      el.style.removeProperty('line-height');
      el.style.removeProperty('font-family');
      el.style.removeProperty('margin-top');
      el.style.removeProperty('margin-bottom');
      el.querySelectorAll('p, li, td, th, span, br').forEach(child => {
        if (child.closest('.addr-line')) return;
        child.style.removeProperty('font-size');
        child.style.removeProperty('line-height');
        child.style.removeProperty('font-family');
        child.style.removeProperty('margin-top');
        child.style.removeProperty('margin-bottom');
      });
      if (el.tagName === 'H2' || el.tagName === 'H3') {
        el.style.removeProperty('margin-top');
        el.style.removeProperty('margin-bottom');
      }
      const sigRoot = el.classList.contains('signature-block') ? el : el.querySelector('.signature-block');
      if (sigRoot) {
        sigRoot.style.removeProperty('margin-top');
        sigRoot.querySelectorAll('[style]').forEach(inner => {
          inner.style.removeProperty('margin-top');
          inner.style.removeProperty('margin-bottom');
          inner.style.removeProperty('min-height');
        });
      }
    });
  }

  _splitPage(page, depth) {
    if (depth > 25) return;

    const children = Array.from(page.children).filter(c => !this._isOverlay(c));

    let leadEnd = 0;
    while (leadEnd < children.length && this._isLeading(children[leadEnd])) leadEnd++;

    let trailStart = children.length;
    while (trailStart > leadEnd && this._isTrailing(children[trailStart - 1])) trailStart--;

    const leading  = children.slice(0, leadEnd);
    const middle   = children.slice(leadEnd, trailStart);
    const trailing = children.slice(trailStart);

    // Two blocks are needed for a cut to fall between them — except when the
    // single block is a list, which can now be cut between its own items.
    if (middle.length < 2 && !(middle.length === 1 && this._isList(middle[0]))) return;

    const saved = {
      h: page.style.height, mn: page.style.minHeight,
      mx: page.style.maxHeight, ov: page.style.overflow
    };
    page.style.setProperty('height', 'auto', 'important');
    page.style.setProperty('min-height', '0', 'important');
    page.style.setProperty('max-height', 'none', 'important');
    page.style.setProperty('overflow', 'visible', 'important');

    const naturalH = page.getBoundingClientRect().height;

    page.style.height    = saved.h;
    page.style.minHeight = saved.mn;
    page.style.maxHeight = saved.mx;
    page.style.overflow  = saved.ov;

    const lockedH = page.getBoundingClientRect().height;
    if (naturalH <= lockedH + 1) return;

    // ── Squeeze: if overflow is small, compress to fit on one page ──
    // Notes (accounting-policy) pages stay at fixed 9.5pt — never squeezed.
    if (!page.hasAttribute('data-no-squeeze') &&
        page.getAttribute('data-notes-page') !== 'true' &&
        this._trySqueeze(page, middle, trailing, naturalH, lockedH, saved)) return;

    const pageRect = page.getBoundingClientRect();
    const styles   = window.getComputedStyle(page);
    const scale    = this._scaleOf(page);
    const pBot     = this._px(styles.paddingBottom, scale);
    let trailingH  = 0;
    trailing.forEach(t => {
      const pos = window.getComputedStyle(t).position;
      if (pos !== 'absolute' && pos !== 'fixed') {
        trailingH += t.getBoundingClientRect().height;
      }
    });
    const maxBottom = pageRect.top + lockedH - pBot - trailingH -
                      this.footerClearancePx * scale;

    let cutoff = -1;
    for (let i = 0; i < middle.length; i++) {
      if (middle[i].getBoundingClientRect().bottom > maxBottom) { cutoff = i; break; }
    }

    if (cutoff < 0) return;

    // A <ul>/<ol> is one child of the page, so a list that did not fit moved to
    // the next sheet whole and left everything above it stranded — the audit
    // engagement letter broke with 63.6mm still free on sheet 1, and the
    // auditor dragged the first two items back by hand. Cut the list between
    // its own <li>s instead: the items that fit stay, the rest travel in a
    // clone on the continuation sheet.
    let listSplit = null;
    const cand = middle[cutoff];
    if (this._isList(cand)) {
      const items = Array.from(cand.children).filter(c => c.tagName === 'LI');
      let liCut = -1;
      for (let i = 0; i < items.length; i++) {
        if (items[i].getBoundingClientRect().bottom > maxBottom) { liCut = i; break; }
      }
      // liCut === 0 means not even the first item fits — nothing gained by
      // splitting, let the whole list move as before.
      if (liCut > 0) listSplit = { list: cand, items, liCut };
    }

    if (!listSplit && cutoff <= 0) return;

    // Keep-with-next: a heading must never be the last thing on a sheet. The
    // natural cut lands right after one whenever the heading fits but the
    // paragraph it introduces does not, which strands it at the foot of the
    // page — auditors then cut it and paste it onto the next sheet by hand
    // (reported as "content moved onto sheet N"). Walk the cut back over any
    // run of headings so they travel with their body text. Only applied if a
    // real cut remains: a heading at index 0 must stay put or nothing splits.
    // Not applied to a list split: the cut is inside the list, so the blocks
    // before it are staying put and nothing can be stranded at the foot.
    if (!listSplit) {
      let keep = cutoff;
      while (keep > 0 && this._isHeading(middle[keep - 1])) keep--;
      if (keep > 0) cutoff = keep;
    }

    const newPage = document.createElement('div');
    newPage.className = page.className;
    newPage.setAttribute('data-continuation', 'true');
    // Continuations share the source page's uid so the preserve system treats the
    // whole run as one unit when preserving/replacing pages.
    const pageUid = page.getAttribute('data-page-uid');
    if (pageUid) newPage.setAttribute('data-page-uid', pageUid);
    const inlineStyle = page.getAttribute('style');
    if (inlineStyle) newPage.setAttribute('style', inlineStyle);
    // Continuations belong to the section they overflowed from — OrganiseManager
    // groups them with it, and SectionNav can still find the section's start.
    const docSection = page.getAttribute('data-doc-section');
    if (docSection) newPage.setAttribute('data-doc-section', docSection);

    const isNotesPage = page.hasAttribute('data-notes-page') ||
                        page.getAttribute('data-continuation-of') === 'notes';
    if (isNotesPage) {
      newPage.setAttribute('data-notes-page', 'true');
      newPage.setAttribute('data-continuation-of', 'notes');
      const srcHeader = page.querySelector('.page-header');
      if (srcHeader) newPage.appendChild(srcHeader.cloneNode(true));
      const h2 = page.querySelector('h2');
      if (h2) {
        const contH2 = document.createElement('h2');
        // Continuation pages repeat the heading with a "(continued)" marker.
        // Strip any existing marker first so re-pagination never doubles it.
        const baseTitle = h2.textContent
          .replace(/\s*—\s*CONTINUED\s*$/i, '')
          .replace(/\s*\(continued\)\s*$/i, '')
          .trim();
        contH2.textContent = `${baseTitle} (continued)`;
        newPage.appendChild(contH2);
      }
    }

    // The tail of a split list leads the continuation sheet, carrying the
    // original list's tag, classes and inline style so it reads as one list
    // running on; an <ol> resumes at the right number.
    let firstMoved = cutoff;
    if (listSplit) {
      const tail = document.createElement(listSplit.list.tagName);
      tail.setAttribute('data-list-continuation', 'true');
      if (listSplit.list.className) tail.className = listSplit.list.className;
      const listStyle = listSplit.list.getAttribute('style');
      if (listStyle) tail.setAttribute('style', listStyle);
      if (listSplit.list.tagName === 'OL') {
        const start = parseInt(listSplit.list.getAttribute('start'), 10) || 1;
        tail.setAttribute('start', String(start + listSplit.liCut));
      }
      for (let i = listSplit.liCut; i < listSplit.items.length; i++) {
        tail.appendChild(listSplit.items[i]);
      }
      newPage.appendChild(tail);
      firstMoved = cutoff + 1;
    }

    for (let j = firstMoved; j < middle.length; j++) {
      if (middle[j].classList && middle[j].classList.contains('page-number')) {
        middle[j].parentNode.removeChild(middle[j]);
      } else {
        newPage.appendChild(middle[j]);
      }
    }

    page.parentNode.insertBefore(newPage, page.nextSibling);

    this._splitPage(newPage, depth + 1);
  }
}
