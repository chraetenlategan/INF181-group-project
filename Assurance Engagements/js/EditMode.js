// EditMode.js — Edit the physical document, for the Assurance Engagements app.
// Loaded after Preview.js, before app.js. All entry points are global, so the
// toolbar markup in index.html can call them inline exactly as the main app's
// does.
//
// ── Why this exists ─────────────────────────────────────────────────────────
// Everything the form produces is generated. A letter that needs one sentence
// reworded for one client had no route other than "change the generator for
// everybody" or "print it and write on it". The main app solved that with
// contenteditable pages plus page pinning; this is the same idea at the size
// this app needs.
//
// ── What it is NOT ──────────────────────────────────────────────────────────
// This is deliberately a subset of the main app's EditToolbar.js /
// EditToolbarPages.js. There is no page management here — no Add Page, no Word
// or PDF import, no reorder, no letterhead insertion, no indent ruler, no
// format painter, no change reports. Those exist there because somebody asked
// for them there. Add one here the same way: when somebody asks.
//
// ── Page pinning, and why edits need it ─────────────────────────────────────
// Typing on a page only changes the DOM. The next liveUpdate() calls
// generateDoc(), which rebuilds every page from the form and would wipe the
// edit. So an edited page is *pinned*: kept verbatim across regenerations while
// every other page rebuilds normally, which is what keeps the form usable while
// an edit stands. app.js hands the pinned pages through generateDoc() via
// collectPinned() / restorePinned(), and liveUpdate() is skipped entirely while
// edit mode is on.
//
// ── Staleness ───────────────────────────────────────────────────────────────
// A pinned page keeps the values it was pinned with, so changing the form
// afterwards leaves it showing superseded text with nothing on screen to say
// so. Each generated page therefore carries a `data-ae-baseline` text key taken
// at generation time; restorePinned() compares the pinned page's frozen
// baseline against what the generator produces now, and a difference turns the
// badge into "⚠️ Out of date". Text only — styling and spacing are what a
// manual edit is supposed to change.
//
// Depends on: ../js/utils.js (stripHighlightColour), styles.css (.edit-toolbar,
// .tb-btn, .page-pin-badge, .pin-status-bar — all shared with the main app, so
// this toolbar looks and behaves like that one).

const AEEditMode = (() => {

  const PAGE_SEL = '.doc-page, .cover-page';
  // Page furniture that is not document text. Mirrors SuperRed's SKIP_SELECTOR —
  // a letterhead image or a pin badge must never count towards the text key.
  const CHROME_SEL = '.page-pin-badge, .letterhead-img, .letterhead-footer, ' +
    '.page-header, .page-number, script, style';

  let _editing = false;
  let _inputListener = null;
  let _selectionListener = null;
  let _undoStack = [];
  let _redoStack = [];

  const output = () => document.getElementById('document-output');
  const pages = (root) => Array.from((root || output() || document).querySelectorAll(PAGE_SEL));

  // ── Toasts ────────────────────────────────────────────────────────────────
  // The main app's BusinessInfoManager.showToast, reduced to the one thing this
  // app needs. The CSS is shared, so they look identical.
  function toast(message, type = 'info', duration = 5000) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span>${message}</span>`;
    container.appendChild(el);
    setTimeout(() => {
      el.classList.add('toast-out');
      el.addEventListener('animationend', () => el.remove());
    }, duration);
  }

  // ── Page identity ─────────────────────────────────────────────────────────
  // The generator stamps each page with a `data-page-key` naming what the page
  // is ("audit-eng-2", "loan-cert-1"). That is what makes a pinned page
  // matchable to its regenerated counterpart. Heading text is the fallback, and
  // the page's position the last resort — these letters are mostly body prose
  // with no heading of their own, so position alone would re-match the wrong
  // page the moment a document is ticked on or off.
  function assignPageUids(root) {
    const counts = {};
    pages(root).forEach((page, i) => {
      let base = page.getAttribute('data-page-key') || '';
      if (!base) {
        const h = page.querySelector('h1, h2, h3');
        base = (h?.textContent || '').trim().toLowerCase()
          .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 60);
      }
      if (!base) base = 'page-' + i;
      const n = counts[base] = (counts[base] || 0) + 1;
      page.setAttribute('data-page-uid', base + '@' + n);
    });
  }

  function _uidOf(page) { return page?.getAttribute?.('data-page-uid') || ''; }

  function _group(uid) {
    const out = output();
    if (!uid || !out) return [];
    return Array.from(out.querySelectorAll(`[data-page-uid="${CSS.escape(uid)}"]`))
      .filter(p => p.matches(PAGE_SEL));
  }

  // ── Baselines ─────────────────────────────────────────────────────────────
  // "What the generator produced for this page." Taken after pagination, and
  // never on a pinned page — a pin's baseline is frozen at the moment it was
  // pinned, which is the whole point of the comparison.
  function _textKey(nodes) {
    return nodes.map(n => {
      const clone = n.cloneNode(true);
      clone.querySelectorAll(CHROME_SEL).forEach(el => el.remove());
      return (clone.textContent || '').replace(/\s+/g, ' ').trim();
    }).join(String.fromCharCode(1));
  }

  function setBaselines(root) {
    const byUid = {};
    pages(root).forEach(p => {
      if (p.hasAttribute('data-pinned')) return;
      const uid = _uidOf(p);
      (byUid[uid] = byUid[uid] || []).push(p);
    });
    Object.values(byUid).forEach(nodes => {
      const key = _textKey(nodes);
      nodes.forEach(n => n.setAttribute('data-ae-baseline', key));
    });
  }

  // ── Pinning ───────────────────────────────────────────────────────────────
  function pinPage(page) {
    if (!page) return;
    const group = _group(_uidOf(page));
    if (!group.includes(page)) group.push(page);
    group.forEach(p => {
      if (p.hasAttribute('data-pinned')) return;
      p.setAttribute('data-pinned', 'true');
      // The shared modules (PagePaginator, SuperRed) stopped reading
      // `data-pinned` when the main app replaced pinning with protected
      // variables; `data-edited` is the attribute they leave alone now. This
      // app still runs its own pinning, so it flies both flags until it is
      // moved over too.
      p.setAttribute('data-edited', 'true');
      _addBadge(p);
    });
    _updateStatusBar();
  }

  function _pinPageOf(node) {
    const el = node?.nodeType === 1 ? node : node?.parentElement;
    const page = el?.closest?.(PAGE_SEL);
    if (page) pinPage(page);
  }

  function _addBadge(page) {
    if (!page.querySelector('.page-pin-badge')) {
      const badge = document.createElement('div');
      badge.className = 'page-pin-badge';
      badge.setAttribute('contenteditable', 'false');
      page.appendChild(badge);
    }
    _refreshBadge(page);
  }

  function _refreshBadge(page) {
    const badge = page.querySelector('.page-pin-badge');
    if (!badge) return;
    const stale = page.hasAttribute('data-pin-stale');
    badge.classList.toggle('stale', stale);
    badge.innerHTML = stale
      ? `<span class="pin-badge-label" title="The form has changed since this page was pinned, so this page still shows the old values. Unpin it to rebuild it from the form — your manual edits on this page are discarded.">⚠️ Out of date</span>
      <button type="button" onclick="unpinPage(this)" title="Rebuild this page from the current form (discards this page's manual edits)">Unpin</button>`
      : `<span class="pin-badge-label">📌 Pinned</span>
      <button type="button" onclick="unpinPage(this)" title="Discard this page's manual edits and rebuild it from the form">Unpin</button>`;
  }

  function unpinPage(btn) {
    const page = btn.closest(PAGE_SEL);
    if (!page) return;
    if (!confirm('Unpin this page? Its manual edits will be discarded and the page will be rebuilt from the form.')) return;
    const group = _group(_uidOf(page));
    (group.length ? group : [page]).forEach(p => {
      p.removeAttribute('data-pinned');
      p.removeAttribute('data-edited');
      p.removeAttribute('data-pin-stale');
      p.querySelector('.page-pin-badge')?.remove();
    });
    if (typeof generateDoc === 'function') generateDoc();
  }

  function clearAllPins() {
    pages().forEach(p => {
      p.removeAttribute('data-pinned');
      p.removeAttribute('data-edited');
      p.removeAttribute('data-pin-stale');
      p.querySelector('.page-pin-badge')?.remove();
    });
    _updateStatusBar();
  }

  function discardRhsChanges() {
    if (!confirm('Discard every manual edit on the preview and rebuild the whole document from the form?')) return;
    clearAllPins();
    if (_editing) toggleEditPreview();
    if (typeof generateDoc === 'function') generateDoc();
  }

  function hasEdits() { return !!document.querySelector('#document-output [data-pinned]'); }

  // Slim bar at the top of the preview panel while any pin exists — the pins
  // themselves scroll away with their pages, so the count needs somewhere fixed.
  function _updateStatusBar() {
    const panel = document.querySelector('.preview-panel');
    if (!panel) return;
    let bar = panel.querySelector('.pin-status-bar');
    const count = document.querySelectorAll('#document-output [data-pinned]').length;
    if (!count) { bar?.remove(); return; }
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'pin-status-bar';
      bar.innerHTML = `<span class="pin-status-text"></span>
        <button type="button" class="btn-discard-rhs" onclick="discardRhsChanges()">Discard All Preview Edits</button>`;
      panel.prepend(bar);
    }
    const staleCount = document.querySelectorAll('#document-output [data-pin-stale]').length;
    const bits = [`<strong>${count}</strong> pinned page${count === 1 ? '' : 's'} kept on regenerate`];
    if (staleCount) bits.push(`<strong class="pin-status-stale">⚠️ ${staleCount} out of date</strong> — showing values the form has since changed`);
    bar.querySelector('.pin-status-text').innerHTML = '📌 ' + bits.join(' · ');
    bar.classList.toggle('has-stale', staleCount > 0);
  }

  // ── Surviving a regeneration ──────────────────────────────────────────────
  // Called by app.js around the rebuild: collectPinned() detaches the pinned
  // groups before the output is wiped, restorePinned() swaps each one back in
  // for its regenerated counterpart.
  function collectPinned(root) {
    const groups = [];
    const byUid = {};
    let lastUnpinnedUid = null;
    pages(root).forEach(page => {
      const uid = _uidOf(page);
      if (!page.hasAttribute('data-pinned')) {
        if (uid) lastUnpinnedUid = uid;
        return;
      }
      let g = uid ? byUid[uid] : null;
      if (!g) {
        g = { uid, nodes: [], anchorUid: lastUnpinnedUid };
        if (uid) byUid[uid] = g;
        groups.push(g);
      }
      g.nodes.push(page);
    });
    return groups.length ? { groups } : null;
  }

  function restorePinned(root, preserved) {
    const out = root || output();
    if (!out || !preserved) { _updateStatusBar(); return; }
    let newlyStale = 0;

    preserved.groups.forEach(g => {
      g.nodes.forEach(n => n.removeAttribute('contenteditable'));
      const matches = g.uid
        ? Array.from(out.querySelectorAll(`[data-page-uid="${CSS.escape(g.uid)}"]`))
          .filter(p => p.matches(PAGE_SEL))
        : [];
      if (matches.length) {
        // The only moment where the pin's frozen text and the form's current
        // text both exist — so staleness has to be decided right here.
        if (_markStaleness(g.nodes, matches)) newlyStale += g.nodes.length;
        const at = matches[0];
        g.nodes.forEach(n => out.insertBefore(n, at));
        matches.forEach(m => m.remove());
      } else {
        // The section this page belonged to is gone from the new document
        // (its letter was unticked). Keep it where it stood rather than
        // dropping the user's edit on the floor.
        let ref = null;
        if (g.anchorUid) {
          const anchors = out.querySelectorAll(`[data-page-uid="${CSS.escape(g.anchorUid)}"]`);
          ref = anchors.length ? anchors[anchors.length - 1] : null;
        }
        g.nodes.forEach(n => {
          if (ref) ref.after(n); else out.insertBefore(n, out.firstElementChild);
          ref = n;
        });
      }
    });

    _updateStatusBar();
    if (newlyStale) {
      toast(`${newlyStale} pinned page${newlyStale === 1 ? '' : 's'} now out of date — the form changed, but a pinned page keeps its old values. Unpin it to rebuild from the form.`,
        'warning', 8000);
    }
  }

  // Returns true only when the group has just BECOME stale, so the warning is
  // said once rather than on every keystroke in the form.
  function _markStaleness(pinned, regenerated) {
    const base = pinned[0]?.getAttribute('data-ae-baseline');
    if (base == null) return false;   // unknowable — never cry wolf
    const stale = _textKey(regenerated) !== base;
    const was = pinned.some(p => p.hasAttribute('data-pin-stale'));
    pinned.forEach(p => {
      if (stale) p.setAttribute('data-pin-stale', 'true');
      else p.removeAttribute('data-pin-stale');
      _refreshBadge(p);
    });
    return stale && !was;
  }

  // ── Edit mode ─────────────────────────────────────────────────────────────
  function toggleEditPreview() {
    const out = output();
    if (!out) return;
    const btn = document.getElementById('btn-edit-preview');
    const toolbar = document.getElementById('edit-toolbar');
    const bar = document.getElementById('mode-toggle-bar');

    if (_editing) {
      _editing = false;
      out.removeEventListener('input', _inputListener);
      _inputListener = null;
      document.removeEventListener('selectionchange', _selectionListener);
      _selectionListener = null;
      _resetReadouts();
      pages(out).forEach(p => p.removeAttribute('contenteditable'));
      btn?.classList.remove('active');
      if (btn) btn.textContent = '✏️ Edit';
      toolbar?.classList.remove('visible');
      bar?.classList.remove('editing');
      if (hasEdits()) {
        const n = document.querySelectorAll('#document-output [data-pinned]').length;
        toast(`${n} page${n === 1 ? '' : 's'} pinned 📌 — they keep your edits when the document regenerates. Unpin a page to rebuild it from the form.`,
          'info', 6000);
      }
    } else {
      _editing = true;
      pages(out).forEach(p => p.setAttribute('contenteditable', 'true'));
      btn?.classList.add('active');
      if (btn) btn.textContent = '✏️ Stop Editing';
      toolbar?.classList.add('visible');
      bar?.classList.add('editing');
      _inputListener = _onInput;
      out.addEventListener('input', _inputListener);
      _selectionListener = _updateReadouts;
      document.addEventListener('selectionchange', _selectionListener);
      toast('Pages you edit get pinned 📌. Pinned pages keep your changes; the rest of the document still updates from the form.',
        'info', 6000);
    }
  }

  function _onInput(e) {
    _pinPageOf(e.target);
    // A protected variable typed over inside ✏️ Edit goes back to its form
    // field, exactly as it does when it is clicked on the preview with edit
    // mode off. LiveSync stands down while the page is contenteditable, so this
    // is the only write-back path here — without it the two ways of typing on
    // the same value would disagree about which side wins.
    if (typeof DocVars !== 'undefined') {
      if (e.inputType === 'insertParagraph') DocVars.unbindEmptyAtCaret();
      DocVars.pullAtCaret();
    }
    // The red checker paints values red. Retyping one makes the browser carry
    // that computed colour onto the new text as an inline style, and a pinned
    // page is preserved verbatim all the way to the PDF — so strip it as the
    // edit happens rather than discovering it on paper.
    const el = e.target?.nodeType === 1 ? e.target : e.target?.parentElement;
    const page = el?.closest?.(PAGE_SEL);
    if (page && typeof stripHighlightColour === 'function') stripHighlightColour(page);
  }

  function isEditing() { return _editing; }

  // ── Selection helpers ─────────────────────────────────────────────────────
  // The exact-line-height box takes keyboard focus, which drops the document
  // selection, so the last real selection inside the preview is remembered.
  let _lastRange = null;

  // `restore` is for the toolbar's <select>s and the exact-line-height box,
  // which take focus and drop the selection before their handler runs. The
  // plain buttons pass false: they never steal focus, so a caret sitting in the
  // page with nothing selected must stay exactly where the user put it rather
  // than jumping back to whatever was selected a minute ago.
  function _currentRange(restore = true) {
    const sel = window.getSelection();
    if (sel && sel.rangeCount && output()?.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      if (!sel.isCollapsed) _lastRange = sel.getRangeAt(0).cloneRange();
      if (!sel.isCollapsed || !restore) return sel.getRangeAt(0);
    }
    if (restore && _lastRange && output()?.contains(_lastRange.commonAncestorContainer)) {
      const s = window.getSelection();
      s.removeAllRanges();
      s.addRange(_lastRange);
      return _lastRange;
    }
    return null;
  }

  function _pageOfRange(range) {
    const c = range.commonAncestorContainer;
    return c.nodeType === 1
      ? c.closest(PAGE_SEL)
      : c.parentElement?.closest(PAGE_SEL);
  }

  // ── Undo / redo ───────────────────────────────────────────────────────────
  // The browser's own undo covers typing; these snapshots cover the toolbar
  // commands, which execCommand does not always put on the native stack.
  function saveSnapshot() {
    const out = output();
    if (!out) return;
    _undoStack.push(out.innerHTML);
    if (_undoStack.length > 30) _undoStack.shift();
    _redoStack = [];
  }

  function _restore(from, to) {
    const out = output();
    if (!out || !from.length) return;
    to.push(out.innerHTML);
    out.innerHTML = from.pop();
    if (_editing) pages(out).forEach(p => p.setAttribute('contenteditable', 'true'));
    _updateStatusBar();
  }

  function toolbarUndo() {
    if (document.queryCommandEnabled('undo')) document.execCommand('undo', false, null);
    _restore(_undoStack, _redoStack);
  }

  function toolbarRedo() {
    if (document.queryCommandEnabled('redo')) document.execCommand('redo', false, null);
    _restore(_redoStack, _undoStack);
  }

  // ── Formatting commands ───────────────────────────────────────────────────
  function execFmt(command) {
    const range = _currentRange(false);
    if (range) { saveSnapshot(); pinPage(_pageOfRange(range)); }
    document.execCommand(command, false, null);
  }

  function applyFontSize(value) {
    if (!value) return;
    if (value === 'custom') return setCustomFontSize();
    const range = _currentRange();
    if (!range) return alert('Select some text first to change its size.');
    saveSnapshot();
    pinPage(_pageOfRange(range));
    document.execCommand('fontSize', false, value);
  }

  // Exact point sizes: apply the legacy sentinel size 7, then rewrite the
  // <font> elements the browser produced into the precise pt value. That is
  // what makes it work across a selection spanning several nodes.
  function setCustomFontSize() {
    const range = _currentRange();
    if (!range) return alert('Select some text first to set a custom font size.');
    const sizes = _rangeFontSizes(range);
    const current = sizes.size === 1 ? _pxToPt([...sizes][0]) : null;
    const input = prompt('Enter font size in points (e.g. 11, 12.5):', current || '12');
    if (input === null) return;
    const pt = parseFloat(input);
    if (!isFinite(pt) || pt <= 0 || pt > 200) return alert('Please enter a valid font size between 1 and 200 points.');
    const out = output();
    if (!out) return;
    saveSnapshot();
    pinPage(_pageOfRange(range));
    document.execCommand('fontSize', false, '7');
    out.querySelectorAll('font[size="7"]').forEach(f => {
      f.removeAttribute('size');
      f.style.fontSize = pt + 'pt';
    });
  }

  function setParaSpacing(pt) {
    const range = _currentRange();
    if (!range) return alert('Select some text first to change paragraph spacing.');
    const page = _pageOfRange(range);
    if (!page) return;
    saveSnapshot();
    pinPage(page);
    page.querySelectorAll('p, li, h2, h3').forEach(p => {
      if (range.intersectsNode(p)) p.style.marginBottom = pt + 'pt';
    });
  }

  // Unitless line-height, so it scales with each block's own font size — which
  // is how the ↕ readout reports it, and how the --doc-lh-* buckets in
  // styles.css are expressed.
  function setLineHeight(value) {
    if (value === 'custom') return setCustomLineHeight();
    const ratio = parseFloat(value);
    if (isFinite(ratio) && ratio > 0) _applyLineHeight(ratio);
  }

  function setCustomLineHeight() {
    const range = _currentRange();
    if (!range) return alert('Select some text first to change line height.');
    const heights = _rangeLineHeights(range);
    const current = heights.size === 1 ? [...heights][0] : '';
    const input = prompt('Enter line height (e.g. 1.5, 1.7):', current || '1.15');
    if (input === null) return;
    const ratio = parseFloat(input);
    if (!isFinite(ratio) || ratio <= 0 || ratio > 10) return alert('Please enter a valid line height between 0.1 and 10.');
    _applyLineHeight(ratio);
  }

  function applyLineHeightInput() {
    const box = document.getElementById('input-line-height');
    if (!box) return;
    const raw = box.value.trim();
    if (!raw) return;
    const ratio = parseFloat(raw);
    if (!isFinite(ratio) || ratio < 0.1 || ratio > 10) {
      return alert('Please enter a line height between 0.1 and 10 — for example 1.2 or 1.4.');
    }
    _applyLineHeight(ratio);
    box.blur();
  }

  function _applyLineHeight(ratio) {
    const range = _currentRange();
    if (!range) return alert('Select some text first to change line height.');
    const page = _pageOfRange(range);
    if (!page) return;
    saveSnapshot();
    pinPage(page);
    page.querySelectorAll('p, li, h2, h3').forEach(p => {
      if (range.intersectsNode(p)) p.style.lineHeight = String(ratio);
    });
    _updateReadouts();
  }

  // ── Readouts ──────────────────────────────────────────────────────────────
  // While editing, the two dropdown placeholders report the current selection's
  // size and line height instead of their icons, so an exact value can be read
  // off the page before it is changed.
  function _blockAncestors(range) {
    const out = [];
    const root = range.commonAncestorContainer;
    const scope = root.nodeType === 1 ? root : root.parentElement;
    if (!scope) return out;
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (range.intersectsNode(n) && n.parentElement) out.push(n.parentElement);
    }
    if (!out.length && scope) out.push(scope);
    return out;
  }

  function _rangeFontSizes(range) {
    const sizes = new Set();
    _blockAncestors(range).forEach(el => sizes.add(getComputedStyle(el).fontSize));
    return sizes;
  }

  function _rangeLineHeights(range) {
    const out = new Set();
    _blockAncestors(range).forEach(el => {
      const cs = getComputedStyle(el);
      const lh = parseFloat(cs.lineHeight), fs = parseFloat(cs.fontSize);
      if (isFinite(lh) && isFinite(fs) && fs > 0) out.add((Math.round((lh / fs) * 100) / 100).toFixed(2).replace(/\.?0+$/, ''));
    });
    return out;
  }

  function _pxToPt(px) {
    const v = parseFloat(px);
    if (!isFinite(v)) return null;
    return String(Math.round(v * 0.75 * 10) / 10);
  }

  function _resetReadouts() {
    const f = document.getElementById('opt-font-size-label');
    if (f) f.textContent = 'Aa';
    const l = document.getElementById('opt-line-height-label');
    if (l) l.textContent = '↕';
  }

  function _updateReadouts() {
    if (!_editing) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !output()?.contains(sel.getRangeAt(0).commonAncestorContainer)) return;
    const range = sel.getRangeAt(0);
    _lastRange = range.cloneRange();
    const sizes = _rangeFontSizes(range);
    const f = document.getElementById('opt-font-size-label');
    if (f) f.textContent = sizes.size === 1 ? _pxToPt([...sizes][0]) + 'pt' : 'Aa';
    const heights = _rangeLineHeights(range);
    const l = document.getElementById('opt-line-height-label');
    if (l) l.textContent = heights.size === 1 ? [...heights][0] : '↕';
  }

  return {
    assignPageUids, setBaselines, collectPinned, restorePinned,
    pinPage, unpinPage, clearAllPins, discardRhsChanges, hasEdits,
    toggleEditPreview, isEditing, toast,
    toolbarUndo, toolbarRedo, execFmt, applyFontSize, setCustomFontSize,
    setParaSpacing, setLineHeight, setCustomLineHeight, applyLineHeightInput
  };
})();

// Globals for the inline handlers in index.html, named exactly as the main
// app's so the toolbar markup is the same markup.
function toggleEditPreview() { AEEditMode.toggleEditPreview(); }
function unpinPage(btn) { AEEditMode.unpinPage(btn); }
function discardRhsChanges() { AEEditMode.discardRhsChanges(); }
function toolbarUndo() { AEEditMode.toolbarUndo(); }
function toolbarRedo() { AEEditMode.toolbarRedo(); }
function execFmt(cmd) { AEEditMode.execFmt(cmd); }
function applyFontSize(v) { AEEditMode.applyFontSize(v); }
function setParaSpacing(pt) { AEEditMode.setParaSpacing(pt); }
function setLineHeight(v) { AEEditMode.setLineHeight(v); }
function applyLineHeightInput() { AEEditMode.applyLineHeightInput(); }
