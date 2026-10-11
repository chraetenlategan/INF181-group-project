// DraftCache.js — keep the work in progress in this browser, so closing the app
// (or the thin client crashing) does not lose it.
//
// What is kept is the same thing Open restores: the form state
// (collectFormState), the hand-edited preview pages (_serializePreviewEdits),
// and which database record it belongs to. A restored draft rebuilds its pages
// from the form with the edited ones put back, exactly like Open does. See
// CLAUDE.md → "Reopening a statement".
//
// The draft lives in localStorage, so it is per browser/PC and never reaches
// the server. It is written a moment after every form change, and flushed when
// the page is hidden or closed. The toolbar's "New" button (startBlank) is the
// one way to throw it away and start from an empty form.
//
// Depends on: BusinessInfoManager (instance `businessInfoManager`, created in
// app.js), generateAndPreview / clearUnsavedFlag (app.js).

const DraftCache = (() => {
  const STORAGE_KEY = 'policygen-draft-v1';
  const DEBOUNCE_MS = 800;

  let _timer = null;
  let _dirty = false;       // nothing is written until the user (or a load) changes the form
  let _suspended = false;   // true while restoring, and for good once "New" starts clearing

  function _read() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  function _write() {
    if (_suspended || !_dirty) return;
    if (typeof businessInfoManager === 'undefined') return;
    try {
      const draft = {
        savedAt: new Date().toISOString(),
        appVersion: typeof APP_VERSION !== 'undefined' ? APP_VERSION : '',
        businessId: businessInfoManager.currentBusinessId,
        unsaved: typeof _hasUnsavedChanges !== 'undefined' ? !!_hasUnsavedChanges : false,
        state: businessInfoManager.collectFormState(),
        previewEdits: typeof _serializePreviewEdits === 'function' ? _serializePreviewEdits() : null,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch (_) { /* storage full or blocked — the draft is a convenience, never fatal */ }
  }

  // ── "New" button visibility ──
  // On a brand-new form "New" has nothing to clear, so it stays hidden until the
  // form differs from how it looked at startup (or a saved statement is open).
  // The blank baseline is the form state captured before any draft is restored.
  let _blankKey = null;
  let _btnTimer = null;

  function _stateKey() {
    try {
      const s = businessInfoManager.collectFormState();
      delete s._exportedAt;
      return JSON.stringify(s);
    } catch (_) { return null; }
  }

  function updateNewButton() {
    const btn = document.getElementById('btn-bar-new');
    if (!btn || typeof businessInfoManager === 'undefined') return;
    const key = _stateKey();
    const hasContent = businessInfoManager.currentBusinessId != null
      || _blankKey == null || key == null || key !== _blankKey;
    btn.style.display = hasContent ? '' : 'none';
  }

  function _scheduleNewButton() {
    clearTimeout(_btnTimer);
    _btnTimer = setTimeout(updateNewButton, 150);
  }

  // Call after anything that changes the form. Debounced.
  function touch() {
    _scheduleNewButton();
    if (_suspended) return;
    _dirty = true;
    clearTimeout(_timer);
    _timer = setTimeout(_write, DEBOUNCE_MS);
  }

  function flush() {
    clearTimeout(_timer);
    _write();
  }

  function clear() {
    clearTimeout(_timer);
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
  }

  // Bring back the last session's form. Called once at startup.
  async function restore() {
    if (typeof businessInfoManager !== 'undefined') _blankKey = _stateKey();
    const draft = _read();
    if (!draft || !draft.state || draft.state._version !== 1) { updateNewButton(); return false; }

    _suspended = true;
    try {
      businessInfoManager.applyFormState(draft.state);
      if (typeof _loadPreviewEdits === 'function') _loadPreviewEdits(draft.previewEdits);

      // Re-attach to the database record it came from, so Save still updates
      // that statement. The lock was released when the app closed; take it again.
      // If someone else has it now, keep the form but detach, so Save makes a
      // new record instead of overwriting their work.
      businessInfoManager.currentBusinessId = null;
      if (draft.businessId != null) {
        const gotLock = await businessInfoManager._acquireLock(draft.businessId);
        if (gotLock) businessInfoManager.currentBusinessId = draft.businessId;
      }

      if (typeof updateBusinessHeader === 'function') updateBusinessHeader();
      if (typeof generateAndPreview === 'function') generateAndPreview();

      if (draft.unsaved) {
        _hasUnsavedChanges = true;
        BusinessInfoManager.markSaveButton(true);
      } else {
        if (typeof clearUnsavedFlag === 'function') clearUnsavedFlag();
        BusinessInfoManager.markSaveButton(false);
      }
    } catch (err) {
      console.error('Draft restore failed', err);
      _suspended = false;
      updateNewButton();
      return false;
    }
    _suspended = false;
    updateNewButton();

    const company = draft.state.textFields && draft.state.textFields.companyName;
    if (company) {
      const when = draft.savedAt
        ? ' (' + new Date(draft.savedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) + ')'
        : '';
      BusinessInfoManager.showToast(
        `Picked up where you left off — “${company}”${when}. Press New in the toolbar to start blank.`,
        'info', 7000);
    }
    return true;
  }

  // Toolbar "New": throw away the form and the cached draft, start from blank.
  function startBlank() {
    const hasUnsaved = typeof _hasUnsavedChanges !== 'undefined' && _hasUnsavedChanges;
    const msg = hasUnsaved
      ? 'Start a new blank statement?\n\nThis form has changes that have NOT been saved to the database. They will be lost.'
      : 'Start a new blank statement?\n\nThe form will be cleared. Anything saved to the database is not affected.';
    if (!confirm(msg)) return;

    _suspended = true;
    clear();
    if (typeof clearUnsavedFlag === 'function') clearUnsavedFlag();
    // beforeunload releases the database lock on the way out.
    location.reload();
  }

  // Form edits: typing, selects, checkboxes, and button clicks (entity cards,
  // add director, …) — the click is deferred by the debounce, so the DOM change
  // the button makes has already happened when the state is collected.
  function _isForm(target) {
    const form = document.querySelector('.form-panel');
    return !!(form && target && form.contains(target));
  }
  document.addEventListener('input',  e => { if (_isForm(e.target)) touch(); }, true);
  document.addEventListener('change', e => { if (_isForm(e.target)) touch(); }, true);
  document.addEventListener('click',  e => { if (_isForm(e.target)) touch(); }, true);

  // Closing the app, switching away, or the thin client going down.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('pagehide', flush);
  window.addEventListener('beforeunload', flush);

  return { touch, flush, clear, restore, startBlank, updateNewButton };
})();

function startBlankStatement() { DraftCache.startBlank(); }
