/* DocVars.js — protected variables (the document values that stay wired to the form)
   ---------------------------------------------------------------------------
   The problem this replaces
   -------------------------
   Typing on the form regenerates the document, which threw away anything the
   user had changed by hand on the preview. The old answer was to *pin* an
   edited page: keep it verbatim and stop the form from reaching it. It worked,
   and nobody understood it — a pinned page silently stopped following the form,
   so a corrected name never arrived on the page that mattered.

   What replaces it
   ----------------
   The values are protected instead of the pages. Every value that came from a
   named form field is carried on the page inside its own span, tagged with the
   id of the field that produced it:

       Hello <span class="hl-kw" data-sync-field="clientName"
                   data-var-shape="raw">Admin</span>, how are you

   The user may rewrite the sentence around that span however they like. When
   the form changes, the page is not rebuilt — only the spans whose field moved
   are rewritten, in place. The wording the user typed survives; the values keep
   following the form. And when the span itself is typed over, the text goes the
   other way and lands in the form field, so the two sides never disagree.

   Who stamps the spans
   --------------------
   SuperRed.js, on every generation. It already recognises which form value
   produced which run of text on the page (that is how the red checker works)
   and already stamps `data-sync-field` for the click-to-edit feature; it now
   also records `data-var-shape` — *which rendering* of the field's value the
   page is showing, so this module can reproduce it.

   Shapes
   ------
   A field's value does not always reach the page verbatim: "1250000" renders
   "1 250 000", "cc" renders "Close Corporation". Only the renderings that
   survive a round trip are bound (see SuperRed's `_bindableShapes`), and each
   one is named here so `render()` can redo it against the field's new value.
   A derived value that no single field holds — a comparative year end, a name
   collapsed to initials — is deliberately *not* bound: it is still painted red,
   but it is not a protected variable and an edited page will not update it.

   Consumers: EditToolbar.js (`_restorePreservedPages`, edit-mode write-back),
   app.js (`liveUpdate` while editing), LiveSync.js (click-to-edit).
*/

const DocVars = (() => {
  // A push is in flight: the field is being written from the preview, so the
  // 'input' event it fires must not come straight back as a patch and move the
  // caret out from under the user.
  let _pushing = false;

  // field id -> the value it held before the preview first wrote to it. Lets
  // Rebuild PDF put back every value that was typed over on the preview. A
  // field the user then edits on the form itself drops out: the form has
  // taken it over, and its value is no longer a preview edit.
  const _rhsOriginals = new Map();
  document.addEventListener('input', (e) => {
    if (!_pushing && e.target?.id) _rhsOriginals.delete(e.target.id);
  }, true);

  function _clean(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }

  function _field(span) {
    const id = span?.dataset?.syncField;
    return id ? document.getElementById(id) : null;
  }

  /** Re-render one field's current value in the shape the page is showing it in.
   *  Returns null when there is nothing to show (no field, or it is now empty —
   *  in which case the span is left exactly as it is rather than blanked). */
  function render(fieldId, shape) {
    const el = document.getElementById(fieldId);
    if (!el) return null;
    const raw = _clean(el.value);
    if (!raw) return null;
    const via = (fn) => { try { const r = fn(); return (r && typeof r === 'string') ? r : raw; } catch (_) { return raw; } };
    switch (shape) {
      case 'number':  return typeof formatNumber === 'function' ? via(() => formatNumber(raw)) : raw;
      case 'id':      return typeof formatIdString === 'function' ? via(() => formatIdString(raw)) : raw;
      case 'nospace': return raw.replace(/\s/g, '');
      case 'title':   return typeof toTitleCase === 'function' ? via(() => toTitleCase(raw)) : raw;
      case 'cc':      return typeof expandCloseCorporation === 'function' ? via(() => expandCloseCorporation(raw)) : raw;
      default:        return raw;
    }
  }

  // The span the caret is sitting in, if any. Never patched — rewriting the text
  // node under the caret collapses the selection to the start of the line.
  function _caretSpan() {
    const sel = window.getSelection();
    const node = sel && sel.anchorNode;
    const el = node?.nodeType === 1 ? node : node?.parentElement;
    return el?.closest?.('[data-sync-field]') || null;
  }

  /**
   * Bring every protected variable inside `root` back in step with the form.
   * This is what makes a hand-edited page keep following the left-hand side:
   * the page's own markup is untouched, only the values inside the spans move.
   *
   * `root` may be an element or an array of elements. Returns how many spans
   * were rewritten.
   */
  function patch(root) {
    if (!root) return 0;
    const roots = Array.isArray(root) ? root : [root];
    const skip = _caretSpan();
    let changed = 0;
    roots.forEach(scope => {
      if (!scope || !scope.querySelectorAll) return;
      const spans = Array.from(scope.querySelectorAll('[data-sync-field]'));
      if (scope.matches?.('[data-sync-field]')) spans.push(scope);
      spans.forEach(span => {
        if (span === skip) return;
        // An empty span is not a value the page is showing. It is either a copy
        // the browser carried into a new line (see unbindEmptyAtCaret) or one the
        // user emptied by hand — filling it would put text there nobody typed.
        if (!_clean(span.textContent)) return;
        const next = render(span.dataset.syncField, span.dataset.varShape);
        if (next == null) return;
        if (_clean(span.textContent) === _clean(next)) return;
        span.textContent = next;
        changed++;
      });
    });
    return changed;
  }

  /**
   * The other direction: what is now in the span becomes the field's value.
   * Used by click-to-edit and by typing inside a variable in ✏️ Edit mode.
   *
   * Only the bound (round-trippable) shapes ever carry `data-sync-field`, so
   * the text can go back verbatim. Guarded against the two ways a
   * contenteditable edit produces something that is not a value: an emptied
   * span (the user is mid-delete) and a span that has swallowed a whole
   * paragraph (the user selected across it and retyped).
   */
  function pull(span, opts) {
    const field = _field(span);
    if (!field || field.readOnly || field.disabled) return false;
    const value = _clean(span.textContent);
    if (!value || value.length > 300) return false;
    if (_clean(field.value) === value) return false;
    write(field, value, !!(opts && opts.change));
    return true;
  }

  /** Write a value typed on the preview into its form field, the way every
   *  preview → form write goes (pull() here, click-to-edit in LiveSync). */
  function write(field, value, withChange) {
    if (!field) return;
    if (field.id && !_rhsOriginals.has(field.id)) _rhsOriginals.set(field.id, field.value);
    _pushing = true;
    try {
      field.value = value;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      if (withChange) field.dispatchEvent(new Event('change', { bubbles: true }));
    } finally {
      _pushing = false;
    }
  }

  /** Put every field the preview wrote back to its value from before. Returns
   *  how many fields changed. */
  function revertRhsWrites() {
    let n = 0;
    _rhsOriginals.forEach((before, id) => {
      const field = document.getElementById(id);
      if (!field || field.value === before) return;
      _pushing = true;
      try {
        field.value = before;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
      } finally {
        _pushing = false;
      }
      n++;
    });
    _rhsOriginals.clear();
    return n;
  }

  /** Forget the preview's writes without reverting them (a load, a discard). */
  function forgetRhsWrites() { _rhsOriginals.clear(); }

  /** The variable the caret is in, pushed to its field. Returns true if it moved. */
  function pullAtCaret() {
    const span = _caretSpan();
    return span ? pull(span) : false;
  }

  /**
   * Enter at the end of a variable makes Chrome copy the span the caret was in
   * — attributes and all — into the new line, empty, so typing keeps its style.
   * That copy is not a value: left bound, a later patch fills it with the
   * field's text (a heading like "Independent Compiler's Report" came out
   * twice), and anything typed in it would be written back to the field. Call
   * on `insertParagraph`; drops the binding from empty spans in the caret's
   * block. Returns how many were unbound.
   */
  function unbindEmptyAtCaret() {
    const sel = window.getSelection();
    const node = sel && sel.anchorNode;
    const el = node?.nodeType === 1 ? node : node?.parentElement;
    const block = el?.closest?.('p, div, li, td, th, h1, h2, h3, h4, h5, h6');
    if (!block || block.matches('.doc-page, .cover-page')) return 0;
    let n = 0;
    block.querySelectorAll('[data-sync-field]').forEach(span => {
      if (_clean(span.textContent)) return;
      span.removeAttribute('data-sync-field');
      span.removeAttribute('data-var-shape');
      n++;
    });
    return n;
  }

  /**
   * Typing with the caret at the very start or end of a variable makes the
   * browser put the new characters *inside* the span, so `pullAtCaret` wrote
   * them into the form field: "…of ABC Ltd| and its subsidiaries" turned the
   * company name into "ABC Ltd and its subsidiaries" on every page. At an edge
   * the user is writing prose next to the value, not changing it, so the text
   * is inserted outside the variable (and outside the generator's highlight
   * span that wraps it). Typing strictly inside a value still edits the value.
   * Call from `beforeinput`; returns true when it handled the insertion.
   */
  function insertBesideAtCaret(e) {
    if (!e || e.inputType !== 'insertText' || !e.data) return false;
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !sel.isCollapsed) return false;
    const span = _caretSpan();
    if (!span) return false;
    const r = sel.getRangeAt(0);
    const before = document.createRange();
    before.selectNodeContents(span);
    before.setEnd(r.startContainer, r.startOffset);
    const at = before.toString().length;
    const len = span.textContent.length;
    if (at !== 0 && at !== len) return false;
    const atEnd = at === len;

    // Step out of the highlight wrappers that share this edge, so the prose is
    // not painted as a value either.
    let edge = span;
    while (edge.parentElement && edge.parentElement.matches('span.hl-kw') &&
           (atEnd ? edge.parentElement.lastChild === edge : edge.parentElement.firstChild === edge)) {
      edge = edge.parentElement;
    }
    e.preventDefault();
    const sib = atEnd ? edge.nextSibling : edge.previousSibling;
    let node, offset;
    if (sib && sib.nodeType === 3) {
      node = sib;
      if (atEnd) { node.insertData(0, e.data); offset = e.data.length; }
      else { node.appendData(e.data); offset = node.length; }
    } else {
      node = document.createTextNode(e.data);
      edge.parentNode.insertBefore(node, atEnd ? edge.nextSibling : edge);
      offset = node.length;
    }
    const caret = document.createRange();
    caret.setStart(node, offset);
    caret.collapse(true);
    sel.removeAllRanges();
    sel.addRange(caret);
    return true;
  }

  /** True while `pull()` is writing a field — a patch must stand down. */
  function isPushing() { return _pushing; }

  /** Drop the wiring from a clone that is about to be printed or exported. */
  function strip(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll('[data-sync-field]').forEach(span => {
      span.removeAttribute('data-sync-field');
      span.removeAttribute('data-var-shape');
    });
  }

  return { render, patch, pull, write, revertRhsWrites, forgetRhsWrites, pullAtCaret, unbindEmptyAtCaret, insertBesideAtCaret, isPushing, strip };
})();
