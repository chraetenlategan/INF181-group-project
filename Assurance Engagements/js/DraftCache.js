// DraftCache.js — keep this browser's work in progress, so closing the tab (or
// the thin client going down) does not lose it.
//
// This app has no database and no Save: whatever is on the form is the only copy
// of it. Closing the tab used to throw a half-finished engagement letter away,
// which is what this fixes — reopening the page brings the form back exactly as
// it was, the documents it was producing with it, and the two panels scrolled
// where they were left.
//
// What is kept is the form (the left-hand side) only, the same rule the main
// app's DraftCache lives by: a restored draft rebuilds its pages from the form.
// Manual preview edits and pinned pages are NOT kept — see the main CLAUDE.md,
// "Reopening a statement". Nothing here reaches a server; the draft lives in
// this browser's localStorage, per PC and per user profile.
//
// Depends on: app.js (liveUpdate, generateDoc, onEngagementTypeChange,
// onDocumentTypesChange, the `entityManager` instance), EntityManager.js.

const AEDraftCache = (() => {
  const STORAGE_KEY = 'assurance-draft-v1';
  const VERSION = 1;
  const DEBOUNCE_MS = 800;

  let _timer = null;
  let _dirty = false;      // nothing is written until the form actually changes
  let _suspended = false;  // true while restoring, and for good once "New" starts
  let _pendingScroll = null;

  // ── The repeaters ─────────────────────────────────────────────────────────
  // Each card's fields are indexed by the card's own number, and a removed card
  // leaves a gap in that numbering, so the cards cannot be read back by index
  // alone. They are collected in screen order and restored into a fresh, gapless
  // set of cards — the index is a handle, never an identity, and nothing in the
  // document keys off it across a reload.
  const REPEATERS = [
    {
      key: 'signatories',
      card: i => `sig-card-${i}`,
      count: () => entityManager.signatoryCount,
      setCount: n => { entityManager.signatoryCount = n; },
      add: () => entityManager.addSignatory(),
      fields: ['sig-init-', 'sig-sur-', 'sig-board-'],
      radios: [],
      after: () => entityManager.relabelSignatories(),
    },
    {
      key: 'indepPersons',
      card: i => `indep-card-${i}`,
      count: () => entityManager.indepPersonCount,
      setCount: n => { entityManager.indepPersonCount = n; },
      add: () => entityManager.addIndepPerson(),
      unregister: i => { if (typeof aeUnregisterIndepCal === 'function') aeUnregisterIndepCal(i); },
      fields: ['ind-name-', 'ind-role-', 'ind-date-',
        'ind-rev-name-', 'ind-rev-concl-', 'ind-rev-date-'],
      radios: [],
      after: () => entityManager.relabelIndepPersons(),
    },
    {
      key: 'reviewIndepPersons',
      card: i => `rindep-card-${i}`,
      count: () => entityManager.reviewIndepPersonCount,
      setCount: n => { entityManager.reviewIndepPersonCount = n; },
      add: () => entityManager.addReviewIndepPerson(),
      unregister: i => { if (typeof aeUnregisterReviewIndepCal === 'function') aeUnregisterReviewIndepCal(i); },
      fields: ['rind-name-', 'rind-role-', 'rind-date-', 'rind-details-',
        'rind-sig-name-', 'rind-sig-date-', 'rind-pnr-name-', 'rind-pnr-date-'],
      radios: [],
      after: () => entityManager.relabelReviewIndepPersons(),
    },
    {
      key: 'loanCerts',
      card: i => `loan-cert-card-${i}`,
      count: () => entityManager.loanCertCount,
      setCount: n => { entityManager.loanCertCount = n; },
      add: () => entityManager.addLoanCert(),
      unregister: i => { if (typeof aeUnregisterLoanCertCal === 'function') aeUnregisterLoanCertCal(i); },
      fields: ['lc-name-', 'lc-amount-', 'lc-date-'],
      radios: ['lc-balance-'],
    },
  ];

  const _form = () => document.querySelector('.form-panel');
  const _previewPanel = () => document.querySelector('.preview-panel');

  function _readEl(el) {
    if (!el) return null;
    if (el.type === 'checkbox') return !!el.checked;
    return el.value;
  }

  function _writeEl(el, v) {
    if (!el || v == null) return;
    if (el.type === 'checkbox') el.checked = !!v;
    else el.value = v;
  }

  // ── Collect ───────────────────────────────────────────────────────────────

  function collect() {
    const form = _form();
    if (!form || typeof entityManager === 'undefined') return null;

    const fields = {};
    form.querySelectorAll('input[id], select[id], textarea[id]').forEach(el => {
      if (el.type === 'radio') return;          // radios are read by group, below
      if (el.closest('.ae-card')) return;       // a repeater card's own fields
      const v = _readEl(el);
      if (v != null) fields[el.id] = v;
    });

    const radios = {};
    form.querySelectorAll('input[type="radio"][name]').forEach(el => {
      if (el.closest('.ae-card')) return;
      if (el.checked) radios[el.name] = el.value;
      else if (!(el.name in radios)) radios[el.name] = radios[el.name] || null;
    });

    const cards = {};
    REPEATERS.forEach(spec => {
      const rows = [];
      for (let i = 1; i <= spec.count(); i++) {
        if (!document.getElementById(spec.card(i))) continue;
        const row = { fields: {}, radios: {} };
        spec.fields.forEach(p => {
          const v = _readEl(document.getElementById(p + i));
          if (v != null) row.fields[p] = v;
        });
        spec.radios.forEach(p => {
          const picked = document.querySelector(`input[name="${p}${i}"]:checked`);
          if (picked) row.radios[p] = picked.value;
        });
        rows.push(row);
      }
      cards[spec.key] = rows;
    });

    return {
      _version: VERSION,
      entityType: entityManager.currentEntityType,
      fields, radios, cards,
      scroll: {
        form: form.scrollTop || 0,
        preview: _previewPanel()?.scrollTop || 0,
      },
    };
  }

  // ── Write / read ──────────────────────────────────────────────────────────

  function _read() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  function _write() {
    if (_suspended || !_dirty) return;
    try {
      const state = collect();
      if (!state) return;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        savedAt: new Date().toISOString(),
        state,
      }));
    } catch (_) { /* storage full or blocked — the draft is a convenience, never fatal */ }
  }

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

  // ── Restore ───────────────────────────────────────────────────────────────

  function _resetRepeater(spec) {
    for (let i = 1; i <= spec.count(); i++) {
      document.getElementById(spec.card(i))?.remove();
      if (spec.unregister) spec.unregister(i);
    }
    spec.setCount(0);
  }

  // Called once at startup, before the first generateDoc(). Returns true when a
  // draft was restored (and generated), false when there was nothing to restore.
  function restore() {
    const draft = _read();
    const state = draft && draft.state;
    if (!state || state._version !== VERSION) { _blankKey = _stateKey(); updateNewButton(); return false; }

    _suspended = true;
    try {
      // The entity type first: the signatory cards are labelled from it, and
      // setEntityType relabels the ones already on screen.
      if (state.entityType) {
        const sel = document.getElementById('entityType');
        if (sel) sel.value = state.entityType;
        entityManager.currentEntityType = state.entityType;
      }

      Object.entries(state.fields || {}).forEach(([id, v]) => {
        const el = document.getElementById(id);
        if (el && !el.closest('.ae-card')) _writeEl(el, v);
      });

      Object.entries(state.radios || {}).forEach(([name, v]) => {
        if (v == null) return;
        const el = document.querySelector(`.form-panel input[type="radio"][name="${name}"][value="${v}"]`);
        if (el) el.checked = true;
      });

      REPEATERS.forEach(spec => {
        const rows = (state.cards && state.cards[spec.key]) || null;
        if (!rows) return;
        _resetRepeater(spec);
        rows.forEach((row, n) => {
          spec.add();
          const i = n + 1;
          Object.entries(row.fields || {}).forEach(([p, v]) => _writeEl(document.getElementById(p + i), v));
          Object.entries(row.radios || {}).forEach(([p, v]) => {
            const el = document.querySelector(`input[name="${p}${i}"][value="${v}"]`);
            if (el) el.checked = true;
          });
        });
        if (spec.after) spec.after();
      });

      // The form's own shape follows the engagement type and the ticked
      // documents, so the panels are re-opened from the restored values rather
      // than left in their startup state.
      if (typeof onEngagementTypeChange === 'function') onEngagementTypeChange();
      if (typeof onDocumentTypesChange === 'function') onDocumentTypesChange();

      _pendingScroll = state.scroll || null;
      if (typeof generateDoc === 'function') generateDoc();
    } catch (err) {
      console.error('Draft restore failed', err);
      _suspended = false;
      _blankKey = _stateKey();
      updateNewButton();
      return false;
    }
    _suspended = false;
    _blankKey = null;   // a restored draft has content by definition
    updateNewButton();

    const company = (state.fields && state.fields.companyName) || '';
    if (company && typeof AEEditMode !== 'undefined') {
      const when = draft.savedAt
        ? ' (' + new Date(draft.savedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) + ')'
        : '';
      AEEditMode.toast(
        `Picked up where you left off — “${company}”${when}. Press New in the toolbar to start blank.`,
        'info', 7000);
    }
    return true;
  }

  // The panels can only be scrolled once the sheets are in their final,
  // paginated places, so generateDoc() calls this at the end of its run.
  function applyPendingScroll() {
    if (!_pendingScroll) return;
    const { form, preview } = _pendingScroll;
    _pendingScroll = null;
    const f = _form();
    const p = _previewPanel();
    if (f && form) f.scrollTop = form;
    if (p && preview) p.scrollTop = preview;
  }

  // ── "New" button visibility ───────────────────────────────────────────────
  // On a brand-new form there is nothing to clear, so the button stays hidden
  // until the form differs from how it looked at startup.
  let _blankKey = null;
  let _btnTimer = null;

  function _stateKey() {
    try {
      const s = collect();
      if (!s) return null;
      delete s.scroll;
      return JSON.stringify(s);
    } catch (_) { return null; }
  }

  function updateNewButton() {
    const btn = document.getElementById('btn-bar-new');
    if (!btn) return;
    const key = _stateKey();
    btn.style.display = (_blankKey == null || key == null || key !== _blankKey) ? '' : 'none';
  }

  function _scheduleNewButton() {
    clearTimeout(_btnTimer);
    _btnTimer = setTimeout(updateNewButton, 150);
  }

  // Toolbar "New": throw the form and the cached draft away, start blank.
  function startBlank() {
    if (!confirm('Start a new blank set of documents?\n\nThe form will be cleared. This app keeps no other copy of it.')) return;
    _suspended = true;
    clear();
    location.reload();
  }

  // ── When to save ──────────────────────────────────────────────────────────
  // Typing, selects, checkboxes, and the card buttons (add/remove) — a click is
  // deferred by the debounce, so the DOM change the button makes has already
  // happened by the time the state is collected.
  function _isForm(target) {
    const form = _form();
    return !!(form && target && form.contains(target));
  }
  //
  // `input` is taken from anywhere on the page, not only the form panel: a value
  // typed over on the preview (LiveSync) and a ClientReg import both write to form
  // fields without a keystroke ever landing inside the panel.
  document.addEventListener('input', () => touch(), true);
  document.addEventListener('change', e => { if (_isForm(e.target)) touch(); }, true);
  document.addEventListener('click', e => { if (_isForm(e.target)) touch(); }, true);

  // Scrolling is part of "where I was", but it is not a form change: it is
  // written on the way out with everything else rather than debounced.
  window.addEventListener('scroll', () => { if (!_suspended) _dirty = true; }, true);

  // Closing the tab, switching away, or the thin client going down.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('pagehide', flush);
  window.addEventListener('beforeunload', flush);

  return { touch, flush, clear, collect, restore, applyPendingScroll, startBlank, updateNewButton };
})();

function aeStartBlank() { AEDraftCache.startBlank(); }
