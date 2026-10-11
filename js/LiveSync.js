/* LiveSync.js — type on the preview, the form follows
   ---------------------------------------------------------------------------
   The form on the left and the document on the right hold the same values, but
   until now the traffic only ran one way: type on the left, watch the right
   redraw. Finding the field that produced a wrong word on page 9 meant hunting
   for it back on the form.

   This closes the loop for the simplest and by far the commonest case — a value
   that appears on the page exactly as it was typed. The red checker already
   finds those: SuperRed wraps every form value it recognises, and for a value
   that is the *whole* contents of one editable text field it also stamps the
   wrapper with `data-sync-field="<that field's id>"`. This module makes those
   wrappers, and only those, clickable:

     click a red value → it becomes editable in place and is highlighted
     type              → the form field on the left updates with every keystroke
     Enter / click away → the document regenerates from the form, as normal
     Escape            → the value goes back to what it was

   Deliberately narrow, so nothing else in the app has to change:

   - **Only bound wrappers.** Boilerplate, headings and derived shapes (a name
     collapsed to initials, a comparative year end) carry no `data-sync-field`,
     so they cannot be typed on. There is no way to edit the document's own
     wording here — that is still ✏️ Edit's job.
   - **Nothing is generated differently.** The editable wrapper is the red
     checker's existing `.hl-kw-super` span; it is unwrapped by `SuperRed.clear()`
     on every regeneration like any other. The generator, the save payload and
     the import/export of form data are untouched — the value only ever reaches
     the document by the usual route, through the form field.
   - **No regeneration mid-word.** While a value is being typed, `liveUpdate()`
     stands down (it asks `LiveSync.isEditing()`), or the rebuild would delete
     the span under the caret. The document catches up on commit.
   - **Edit mode has its own path.** With ✏️ Edit active the page is already
     contenteditable, so clicks are ignored here; EditToolbar's `_onRhsInput`
     calls `DocVars.pullAtCaret()` instead and the write-back is identical.

   Depends on: SuperRed.js (stamps `data-sync-field` / `data-var-shape`),
   DocVars.js (the write-back itself), app.js (`liveUpdate`).
*/

const LiveSync = (() => {
  const EDITING_CLASS = 'sync-editing';

  // { span, field, original } while a value is being typed on the preview.
  let active = null;

  function _clean(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }

  function _output() { return document.getElementById('document-output'); }

  function _inEditMode() {
    return !!document.getElementById('btn-edit-preview')?.classList.contains('active');
  }

  /** True while a preview value is being typed. `liveUpdate()` uses this to
   *  hold off regenerating the document out from under the caret. */
  function isEditing() { return !!active; }

  // Push the current span text onto the form field and let the rest of the app
  // hear about it the way it hears about any typed change. Routed through
  // DocVars so this path and the edit-mode one write a field the same way.
  function _push(value, withChange) {
    if (!active) return;
    if (typeof DocVars !== 'undefined' && DocVars.write) {
      DocVars.write(active.field, value, withChange);
      return;
    }
    active.field.value = value;
    active.field.dispatchEvent(new Event('input', { bubbles: true }));
    if (withChange) active.field.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function _start(span) {
    if (active && active.span === span) return;
    if (active) _commit();
    const field = document.getElementById(span.dataset.syncField);
    if (!field) return;

    active = { span, field, original: field.value };
    span.setAttribute('contenteditable', 'true');
    span.setAttribute('spellcheck', 'false');
    span.classList.add(EDITING_CLASS);
    span.focus();

    // Select the whole value, so retyping it is one action.
    try {
      const range = document.createRange();
      range.selectNodeContents(span);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (_) {}
  }

  function _stop() {
    if (!active) return null;
    const { span } = active;
    span.removeAttribute('contenteditable');
    span.removeAttribute('spellcheck');
    span.classList.remove(EDITING_CLASS);
    const done = active;
    active = null;
    return done;
  }

  /** Accept what was typed: write it to the form and rebuild the document. */
  function _commit() {
    if (!active) return;
    const value = _clean(active.span.textContent);
    // Clicking a value selects all of it, so one stray keystroke empties it.
    // Committing that blanked the form field, and on a hand-edited page the
    // emptied span is never refilled (DocVars.patch leaves empty spans alone),
    // so the value vanished from that page for good. Nothing typed = nothing
    // changed — the same rule DocVars.pull() keeps. Clear a field on the form.
    if (!value) { _cancel(); return; }
    _push(value, true);
    _stop();
    if (typeof liveUpdate === 'function') liveUpdate();
  }

  /** Abandon the edit and put the field back as it was. */
  function _cancel() {
    if (!active) return;
    _push(active.original, true);
    const done = _stop();
    if (done) done.span.textContent = done.original;
    if (typeof liveUpdate === 'function') liveUpdate();
  }

  function _onClick(e) {
    if (_inEditMode()) return;
    const span = e.target.closest && e.target.closest('[data-sync-field]');
    if (span) {
      if (!active || active.span !== span) { e.preventDefault(); _start(span); }
      return;
    }
    if (active && !active.span.contains(e.target)) _commit();
  }

  function _onInput(e) {
    if (!active || !active.span.contains(e.target)) return;
    // Live, on every keystroke — this is the whole point of the feature. The
    // document itself waits for the commit.
    _push(_clean(active.span.textContent), false);
  }

  function _onKeyDown(e) {
    if (!active) return;
    if (e.key === 'Enter') { e.preventDefault(); _commit(); }
    else if (e.key === 'Escape') { e.preventDefault(); _cancel(); }
  }

  function _onFocusOut(e) {
    if (!active || !active.span.contains(e.target)) return;
    // Clicking another bound value moves focus before the click lands; let that
    // click run first so it opens the next value rather than being swallowed.
    setTimeout(() => {
      if (active && !active.span.contains(document.activeElement)) _commit();
    }, 0);
  }

  // A pasted value is a value, never formatting.
  function _onPaste(e) {
    if (!active || !active.span.contains(e.target)) return;
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData)?.getData('text') || '';
    document.execCommand('insertText', false, _clean(text));
  }

  function start() {
    const output = _output();
    if (!output || output.dataset.liveSync === 'on') return;
    output.dataset.liveSync = 'on';
    output.addEventListener('click', _onClick);
    output.addEventListener('input', _onInput);
    output.addEventListener('keydown', _onKeyDown);
    output.addEventListener('focusout', _onFocusOut);
    output.addEventListener('paste', _onPaste);
    // A click anywhere else on the page (the form, the toolbar) ends the edit.
    document.addEventListener('mousedown', (e) => {
      if (!active) return;
      if (!output.contains(e.target)) _commit();
    });
  }

  return { start, isEditing };
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => LiveSync.start(), { once: true });
} else {
  LiveSync.start();
}
