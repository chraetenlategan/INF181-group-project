/* ═══════════════════════════════════════════════════════════════════════════
   EditorUI.js — the screen.

   Draws the pages, puts a click-to-edit overlay on every paragraph, and keeps the
   overlay and the exporter agreeing by routing both through PGText.layout().

   The overlay is the honest bit. A block the user has not touched shows the
   original pixels with an invisible hit target over it. The moment a block
   changes, the pixels underneath are covered and replaced with text painted
   in the template's own font, size and baseline grid — which is exactly what
   the exported PDF will contain. There is no second rendering path that could
   disagree with what is on screen.
   ═══════════════════════════════════════════════════════════════════════════ */

window.PGEditor = (function () {
  'use strict';

  const T = window.PGTPL;
  const TX = window.PGText;

  const state = {
    pages: [],          // live, ordered
    fileName: 'statement.pdf',
    srcBytes: null,     // the opened file, for copying untouched pages on export
    zoom: 1.0,          // 1.0 == 3.6 px per mm (roughly A4 at 96dpi)
    editing: null,      // { page, block, el }
    painter: null,      // { bold, underline, sticky } while the Format Painter is armed
    busy: false
  };

  const BASE_PPMM = 3.6;
  const $ = id => document.getElementById(id);

  /* ── Boot ────────────────────────────────────────────────────────────── */
  function init() {
    $('file-input').addEventListener('change', e => {
      const f = e.target.files && e.target.files[0];
      if (f) openFile(f);
      e.target.value = '';
    });

    const drop = $('drop-zone');
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => {
      e.preventDefault(); drop.classList.add('over');
    }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => {
      e.preventDefault(); drop.classList.remove('over');
    }));
    drop.addEventListener('drop', e => {
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) openFile(f);
    });
    drop.addEventListener('click', () => $('file-input').click());

    $('btn-export').addEventListener('click', doExport);
    $('btn-reset').addEventListener('click', resetAll);
    $('btn-zoom-in').addEventListener('click', () => setZoom(state.zoom * 1.2));
    $('btn-zoom-out').addEventListener('click', () => setZoom(state.zoom / 1.2));
    $('btn-zoom-fit').addEventListener('click', () => setZoom(1));

    // Clicking off a block commits it. Clicking straight onto another block
    // commits and opens that one in the same click — the commit re-renders the
    // page, so the click event itself would never reach the new block.
    document.addEventListener('mousedown', e => {
      if (!state.editing || e.target.closest('.pg-editbox, .pg-fmtbar')) return;
      const hit = e.target.closest('.pg-block');
      const pgEl = hit && hit.closest('.pg-page');
      commitEdit();
      if (!hit || !pgEl) return;
      e.preventDefault();
      const page = state.pages.find(p => String(p.index) === pgEl.dataset.page);
      const block = page && page.blocks.find(b => String(b.id) === hit.dataset.block);
      if (block) startEdit(page, block, hit);
    }, true);

    // Keep the B / U buttons showing the style under the caret.
    document.addEventListener('selectionchange', refreshFormatBar);

    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      // Esc puts the brush down first; a second Esc cancels the edit.
      if (state.painter) { disarmPainter(); e.preventDefault(); return; }
      if (state.editing) { cancelEdit(); e.preventDefault(); }
    });

    // The overlay measures itself against Poppins; while the webfont is still
    // loading every measurement would be taken from the fallback face.
    if (document.fonts && document.fonts.load) {
      document.fonts.load('400 12px Poppins').then(() => {
        TX.resetMetrics();
        if (state.pages.length) renderPages();
      }).catch(() => {});
    }
  }

  /* ── Loading ─────────────────────────────────────────────────────────── */
  async function openFile(file) {
    if (state.busy) return;
    state.busy = true;
    state.fileName = file.name || 'statement.pdf';
    showProgress(true, 'Opening ' + state.fileName + '…');

    try {
      const buf = await file.arrayBuffer();
      const res = await window.PGLoader.load(buf, p => {
        setProgress(p.pct || 0, p.note);
      });
      state.pages = res.pages;
      state.srcBytes = res.srcBytes;
      state.pages.forEach((p, i) => { p.index = i; });
      $('app').classList.add('loaded');
      $('doc-name').textContent = state.fileName;
      renderAll();
    } catch (err) {
      console.error(err);
      alert('Could not read this PDF.\n\n' + (err && err.message ? err.message : err));
    } finally {
      state.busy = false;
      showProgress(false);
    }
  }

  function resetAll() {
    if (state.pages.length && !confirm('Discard this document and all edits?')) return;
    state.pages = [];
    state.srcBytes = null;
    state.editing = null;
    disarmPainter();
    $('app').classList.remove('loaded');
    $('pages').innerHTML = '';
  }

  /* ── Rendering ───────────────────────────────────────────────────────── */
  function renderAll() { renderPages(); updateCounts(); }

  function ppm() { return BASE_PPMM * state.zoom; }

  function renderPages() {
    const host = $('pages');
    host.innerHTML = '';
    state.pages.forEach(p => { if (!p.deleted) host.appendChild(buildPage(p)); });
  }

  function buildPage(page) {
    const k = ppm();
    const wrap = document.createElement('div');
    wrap.className = 'pg-page';
    wrap.dataset.page = page.index;
    wrap.style.width = (page.pageWMm * k) + 'px';
    wrap.style.height = (page.pageHMm * k) + 'px';

    const img = document.createElement('canvas');
    img.className = 'pg-raster';
    img.width = page.canvas.width;
    img.height = page.canvas.height;
    img.getContext('2d').drawImage(page.canvas, 0, 0);
    img.style.width = '100%';
    img.style.height = '100%';
    wrap.appendChild(img);

    page.blocks.forEach(b => wrap.appendChild(buildBlock(page, b, k)));
    return wrap;
  }

  function buildBlock(page, block, k) {
    const el = document.createElement('div');
    el.className = 'pg-block' +
      (block.dirty ? ' dirty' : '') +
      (block.chrome ? ' chrome' : '') +
      (block.table ? ' table' : '');
    el.dataset.block = block.id;

    const lay = block.dirty ? TX.layout(block, page.metrics) : null;
    const changed = !!(lay && lay.changed);
    // The block element is itself positioned on the page, so everything drawn
    // inside it is placed relative to its corner, not the page's.
    const o = positionHit(el, block, changed ? lay.boxMm : null, k);
    if (changed) {
      // White patch over exactly the region the exporter will erase.
      const r = lay.boxMm;
      const patch = document.createElement('div');
      patch.className = 'pg-patch';
      patch.style.cssText =
        'left:' + ((r.x - o.x) * k) + 'px;top:' + ((r.y - o.y) * k) + 'px;' +
        'width:' + (r.w * k) + 'px;height:' + (r.h * k) + 'px;';
      el.appendChild(patch);

      const baseEm = TX.baselineEm();
      lay.lines.slice(lay.from).forEach(line => {
        if (!line.text) return;
        const sizeMm = T.ptToMm(block.sizePt);
        if (line.segs) {
          // Part bold/underlined: place each piece where layout() put it, the
          // same positions the exporter paints.
          line.segs.forEach(sg => {
            const span = document.createElement('div');
            span.className = 'pg-line';
            span.textContent = sg.text;
            span.style.cssText =
              'left:' + ((sg.xMm - o.x) * k) + 'px;' +
              'top:' + ((line.baseMm - baseEm * sizeMm - o.y) * k) + 'px;' +
              'font-size:' + (sizeMm * k) + 'px;' +
              'font-weight:' + (sg.bold ? 600 : 400) + ';' +
              (block.italic ? 'font-style:italic;' : '');
            el.appendChild(span);
          });
          line.unders.forEach(u => {
            const ul = document.createElement('div');
            ul.className = 'pg-under';
            ul.style.cssText =
              'left:' + ((u.xMm - o.x) * k) + 'px;' +
              'top:' + ((line.baseMm + lay.underOffsetMm - o.y) * k) + 'px;' +
              'width:' + (u.wMm * k) + 'px;' +
              'height:' + (lay.underThickMm * k) + 'px;';
            el.appendChild(ul);
          });
          return;
        }
        const span = document.createElement('div');
        span.className = 'pg-line';
        span.textContent = line.text;
        span.style.cssText =
          'left:' + ((line.xMm - o.x) * k) + 'px;' +
          'top:' + ((line.baseMm - baseEm * sizeMm - o.y) * k) + 'px;' +
          'font-size:' + (sizeMm * k) + 'px;' +
          'font-weight:' + (block.bold ? 600 : 400) + ';' +
          (block.italic ? 'font-style:italic;' : '') +
          (line.wordSpaceMm ? 'word-spacing:' + (line.wordSpaceMm * k) + 'px;' : '');
        el.appendChild(span);
      });
    }

    // One click and you are typing — no selection step, no side panel.
    el.addEventListener('click', e => {
      e.stopPropagation();
      startEdit(page, block, el);
    });
    return el;
  }

  // The clickable rectangle for a block, in page coordinates. Covers whichever
  // is bigger, the old box or the re-typeset one. Returns its top-left in mm.
  function positionHit(el, block, extraMm, k) {
    let x = block.xMm, y = block.yMm, r = block.rightMm, b = block.bottomMm;
    if (extraMm) {
      x = Math.min(x, extraMm.x); y = Math.min(y, extraMm.y);
      r = Math.max(r, extraMm.x + extraMm.w); b = Math.max(b, extraMm.y + extraMm.h);
    }
    el.style.left = ((x - 0.8) * k) + 'px';
    el.style.top = ((y - 0.8) * k) + 'px';
    el.style.width = ((r - x + 1.6) * k) + 'px';
    el.style.height = ((b - y + 1.6) * k) + 'px';
    return { x: x - 0.8, y: y - 0.8 };
  }

  function rerenderPage(page) {
    const old = $('pages').querySelector('.pg-page[data-page="' + page.index + '"]');
    if (!old) return;
    const fresh = buildPage(page);
    old.replaceWith(fresh);
  }

  /* ── Editing ─────────────────────────────────────────────────────────── */
  function startEdit(page, block, blockEl) {
    block.chrome = false;
    if (state.editing) commitEdit();
    // Committing re-renders the page, which detaches the element we were
    // handed; pick up its replacement.
    if (!blockEl.isConnected) {
      blockEl = $('pages').querySelector(
        '.pg-page[data-page="' + page.index + '"] .pg-block[data-block="' + block.id + '"]');
      if (!blockEl) return;
    }

    const k = ppm();
    const m = page.metrics;
    const sizeMm = T.ptToMm(block.sizePt);

    const box = document.createElement('div');
    box.className = 'pg-editbox';
    box.contentEditable = 'true';
    box.spellcheck = true;
    box.innerHTML = marksToHtml(block);

    const wrapW = block.wrap
      ? Math.min(block.wrapWidthMm, m.colRight - block.xMm)
      : (m.colRight - block.xMm);

    box.style.cssText =
      'left:' + ((block.xMm - 1) * k) + 'px;' +
      'top:' + ((block.baseMm - TX.baselineEm() * sizeMm - 1) * k) + 'px;' +
      'width:' + ((wrapW + 2) * k) + 'px;' +
      'font-size:' + (sizeMm * k) + 'px;' +
      'line-height:' + (block.lhMm * k) + 'px;' +
      'font-weight:' + (block.bold ? 600 : 400) + ';' +
      (block.italic ? 'font-style:italic;' : '') +
      'text-align:' + (block.align === 'justify' ? 'justify' : block.align) + ';' +
      (block.wrap ? '' : 'white-space:pre;width:auto;min-width:' + (block.wMm * k) + 'px;');

    blockEl.parentNode.appendChild(box);

    // Bold / Underline for the selected words. Sits just above the edit box.
    const bar = document.createElement('div');
    bar.className = 'pg-fmtbar';
    bar.innerHTML =
      '<button type="button" data-cmd="bold" title="Bold (Ctrl+B)"><b>B</b></button>' +
      '<button type="button" data-cmd="underline" title="Underline (Ctrl+U)"><u>U</u></button>' +
      '<button type="button" data-cmd="painter" class="pg-brush' + (state.painter ? ' on' : '') + '" ' +
        'title="Format Painter — select styled words, click here, then select the words to copy the bold / underline onto. ' +
        'Works across paragraphs: click another one, then select. Shift-click to keep it on; Esc cancels. (Ctrl+Shift+C / Ctrl+Shift+V)">' +
        '&#128396;</button>';
    bar.style.left = box.style.left;
    bar.style.top = 'calc(' + box.style.top + ' - 30px)';
    bar.addEventListener('mousedown', e => {
      // Keep the caret and selection in the box.
      e.preventDefault();
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.dataset.cmd === 'painter') togglePainter(e.shiftKey);
      else applyFormat(btn.dataset.cmd);
    });
    blockEl.parentNode.appendChild(bar);

    box.addEventListener('keydown', e => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      // Word's own shortcuts for copying and pasting formatting.
      if (e.shiftKey && key === 'c') { e.preventDefault(); pickUpFormat(false); return; }
      if (e.shiftKey && key === 'v') {
        e.preventDefault();
        if (state.painter) paintSelection(true);
        return;
      }
      if (key === 'b') { e.preventDefault(); applyFormat('bold'); }
      else if (key === 'u') { e.preventDefault(); applyFormat('underline'); }
      else if (key === 'i') e.preventDefault();   // italic is not offered
    });

    // An armed painter drops its style onto whatever is selected next.
    box.addEventListener('mouseup', () => setTimeout(() => paintSelection(false), 0));
    box.addEventListener('keyup', e => {
      if (e.shiftKey && /^(Arrow|Home|End)/.test(e.key)) paintSelection(false);
    });

    state.editing = { page, block, el: box, bar, blockEl };

    box.focus();
    const range = document.createRange();
    range.selectNodeContents(box);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges(); sel.addRange(range);
    refreshFormatBar();

    $('hint').textContent = state.painter ? painterHint() :
      'Editing — select words, then B or U to bold or underline. Esc cancels, clicking away commits.';
  }

  /* ── Format Painter ──────────────────────────────────────────────────────
     The only styles this editor carries are bold and underline (block.marks),
     so that is what the brush copies. Pick up from the selection — or the
     caret — in the open block, then select words in this block or any other
     one: the painter survives commit, so clicking another paragraph and
     selecting in it paints there. One use unless Shift-clicked on. */
  function togglePainter(sticky) {
    if (state.painter) { disarmPainter(); return; }
    pickUpFormat(sticky);
  }

  function pickUpFormat(sticky) {
    const ed = state.editing;
    if (!ed) return;
    const q = cmd => { try { return document.queryCommandState(cmd); } catch (_) { return false; } };
    state.painter = { bold: q('bold'), underline: q('underline'), sticky: !!sticky };
    document.body.classList.add('pg-painting');
    if (ed.bar) ed.bar.querySelector('.pg-brush').classList.add('on');
    $('hint').textContent = painterHint();
  }

  function painterHint() {
    const p = state.painter;
    const what = [p.bold ? 'bold' : 'not bold', p.underline ? 'underlined' : 'not underlined'].join(', ');
    return 'Format Painter (' + what + ') — select the words to paint' +
      (p.sticky ? ', as often as you like' : '') +
      '. Click another paragraph first to paint there. Esc cancels.';
  }

  function disarmPainter() {
    if (!state.painter) return;
    state.painter = null;
    document.body.classList.remove('pg-painting');
    const ed = state.editing;
    if (ed && ed.bar) ed.bar.querySelector('.pg-brush').classList.remove('on');
    $('hint').textContent = ed
      ? 'Editing — select words, then B or U to bold or underline. Esc cancels, clicking away commits.'
      : '';
  }

  // Bring the selection to the painter's bold / underline. execCommand toggles,
  // and on a mixed selection it reports "off", so to clear a style it is first
  // made uniform (on) and then toggled off.
  function paintSelection(keep) {
    const ed = state.editing, p = state.painter;
    if (!ed || !p) return;
    const sel = window.getSelection();
    if (!sel.rangeCount || sel.isCollapsed) return;
    const r = sel.getRangeAt(0);
    if (!ed.el.contains(r.commonAncestorContainer)) return;
    try { document.execCommand('styleWithCSS', false, true); } catch (_) {}
    [['bold', p.bold], ['underline', p.underline]].forEach(([cmd, want]) => {
      let on = false;
      try { on = document.queryCommandState(cmd); } catch (_) {}
      if (want) { if (!on) document.execCommand(cmd, false, null); }
      else {
        if (!on) document.execCommand(cmd, false, null);
        document.execCommand(cmd, false, null);
      }
    });
    refreshFormatBar();
    if (!p.sticky && !keep) disarmPainter();
  }

  function applyFormat(cmd) {
    const ed = state.editing;
    if (!ed) return;
    ed.el.focus();
    try { document.execCommand('styleWithCSS', false, true); } catch (_) {}
    document.execCommand(cmd, false, null);
    refreshFormatBar();
  }

  function refreshFormatBar() {
    const ed = state.editing;
    if (!ed || !ed.bar) return;
    ed.bar.querySelectorAll('button:not(.pg-brush)').forEach(b => {
      let on = false;
      try { on = document.queryCommandState(b.dataset.cmd); } catch (_) {}
      b.classList.toggle('on', on);
    });
  }

  // The block's text as edit-box HTML, one span per styled run.
  function marksToHtml(block) {
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    if (!TX.hasMarks(block)) return esc(block.text);
    return TX.runsOf(block, 0, block.text.length).map(r =>
      '<span style="font-weight:' + (r.bold ? 600 : 400) +
      (r.underline ? ';text-decoration:underline' : '') + '">' + esc(r.text) + '</span>'
    ).join('');
  }

  /* Read the edit box back into text + per-character marks. Walks the DOM
     rather than using innerText so each character keeps the weight and
     underline it is shown with. Line breaks follow innerText's rules for what
     contentEditable produces: a <br> is a break, and a <div>/<p> starts on a
     new line. */
  function readEditBox(box, block) {
    const plain = block.bold ? TX.M_BOLD : 0;
    let text = '';
    const marks = [];
    const styleOf = textNode => {
      const el = textNode.parentElement;
      let k = parseInt(getComputedStyle(el).fontWeight, 10) >= 600 ? TX.M_BOLD : 0;
      for (let a = el; a; a = a.parentElement) {
        if (/underline/.test(getComputedStyle(a).textDecorationLine || '')) { k |= TX.M_UNDER; break; }
        if (a === box) break;
      }
      return k;
    };
    (function walk(n) {
      for (const c of n.childNodes) {
        if (c.nodeType === 3) {
          const s = c.nodeValue.replace(/ /g, ' ').replace(/\r/g, '');
          if (!s) continue;
          const k = styleOf(c);
          text += s;
          for (let i = 0; i < s.length; i++) marks.push(s[i] === '\n' ? plain : k);
        } else if (c.nodeName === 'BR') {
          text += '\n'; marks.push(plain);
        } else if (c.nodeType === 1) {
          if (/^(DIV|P|LI)$/.test(c.nodeName) && text && !text.endsWith('\n')) {
            text += '\n'; marks.push(plain);
          }
          walk(c);
        }
      }
    })(box);
    while (text.endsWith('\n')) { text = text.slice(0, -1); marks.pop(); }
    return { text, marks: marks.some(m => m !== plain) ? marks : null };
  }

  function sameMarks(a, b) {
    if (!a || !b) return a === b;
    return a.length === b.length && a.every((m, i) => m === b[i]);
  }

  function commitEdit() {
    const ed = state.editing;
    if (!ed) return;
    state.editing = null;
    // The layout engine treats each line break as a hard break and wraps within it.
    const { text, marks } = readEditBox(ed.el, ed.block);
    ed.el.remove();
    if (ed.bar) ed.bar.remove();
    const oldMarks = TX.hasMarks(ed.block) ? ed.block.marks : null;
    if (text !== ed.block.text || !sameMarks(marks, oldMarks)) {
      ed.block.text = text;
      ed.block.marks = marks;
      ed.block.dirty = text !== ed.block.origText || !!marks;
    }
    rerenderPage(ed.page);
    updateCounts();
    $('hint').textContent = state.painter ? painterHint() : '';
  }

  function cancelEdit() {
    const ed = state.editing;
    if (!ed) return;
    state.editing = null;
    ed.el.remove();
    if (ed.bar) ed.bar.remove();
    $('hint').textContent = state.painter ? painterHint() : '';
  }

  /* ── Export ──────────────────────────────────────────────────────────── */
  async function doExport() {
    if (!state.pages.length || state.busy) return;
    if (state.editing) commitEdit();
    state.busy = true;
    showProgress(true, 'Building the PDF…');
    try {
      const bytes = await window.PGExport.toPdf(state.pages, p => setProgress(p.pct, p.note), state.srcBytes);
      const base = state.fileName.replace(/\.pdf$/i, '');
      window.PGExport.download(bytes, base + ' (edited).pdf');
    } catch (err) {
      console.error(err);
      alert('Export failed.\n\n' + (err && err.message ? err.message : err));
    } finally {
      state.busy = false;
      showProgress(false);
    }
  }

  /* ── Chrome ──────────────────────────────────────────────────────────── */
  function setZoom(z) {
    state.zoom = Math.max(0.4, Math.min(3, z));
    if (state.editing) cancelEdit();
    $('zoom-label').textContent = Math.round(state.zoom * 100) + '%';
    renderPages();
  }

  function updateCounts() {
    const live = state.pages.filter(p => !p.deleted);
    const edits = state.pages.reduce(
      (a, p) => a + p.blocks.filter(b => b.dirty).length, 0);
    const ocr = live.filter(p => p.source === 'ocr').length;
    $('counts').textContent =
      live.length + ' page' + (live.length === 1 ? '' : 's') +
      (state.pages.length !== live.length ? ' (' + (state.pages.length - live.length) + ' deleted)' : '') +
      ' · ' + edits + ' edited block' + (edits === 1 ? '' : 's') +
      (ocr ? ' · ' + ocr + ' page' + (ocr === 1 ? '' : 's') + ' via OCR' : '');
    $('btn-export').disabled = !live.length;
  }

  function showProgress(on, note) {
    $('overlay').classList.toggle('on', !!on);
    if (on) setProgress(0, note || '');
  }
  function setProgress(pct, note) {
    $('bar').style.width = Math.max(0, Math.min(100, pct || 0)) + '%';
    if (note) $('progress-note').textContent = note;
  }


  return { init, state };
})();

document.addEventListener('DOMContentLoaded', () => window.PGEditor.init());
