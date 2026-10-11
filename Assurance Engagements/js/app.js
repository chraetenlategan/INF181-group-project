// app.js — Bootstrapper for the Assurance Engagements app.
// Creates the instances, wires the globals the inline handlers in index.html
// call, and owns the live-update loop.
//
// Loop, same shape as the main app:
//   form edit → liveUpdate() → debounced generateDoc()
//            → AEDocumentGenerator.generate() → PagePaginator.paginate()

let _liveUpdateTimer = null;

// Set by liveUpdate() and consumed once the rebuilt pages have been paginated:
// a live update follows the form, so the preview jumps to the section being
// typed in. A generate from a load or an import is not a live update and must
// not move the panel, which is why this is a flag rather than a call in
// generateDoc() itself.
let _aeScrollPending = false;

function liveUpdate() {
  // Every path that changes the form comes through here — the calendar pickers
  // and a ClientReg import write their values without firing an `input` event, so
  // this is where the draft cache is told the form moved.
  if (typeof AEDraftCache !== 'undefined') AEDraftCache.touch();
  // While the user is editing the document by hand, the form must not pull the
  // rug out from under them. Their edited pages are pinned and would survive a
  // regeneration, but every unpinned page around them would rebuild mid-edit.
  if (typeof AEEditMode !== 'undefined' && AEEditMode.isEditing()) return;
  // A protected variable is being typed on the preview itself (LiveSync). The
  // form field it writes to fires 'input', which lands here — and regenerating
  // now would delete the span the caret is sitting in. LiveSync calls
  // liveUpdate() again on commit, so the document catches up then.
  if (typeof LiveSync !== 'undefined' && LiveSync.isEditing()) return;
  clearTimeout(_liveUpdateTimer);
  _liveUpdateTimer = setTimeout(() => {
    if (typeof LiveSync !== 'undefined' && LiveSync.isEditing()) return;
    _aeScrollPending = true;
    generateDoc();
  }, 300);
}

const entityManager = new AEEntityManager(liveUpdate);
const documentGenerator = new AEDocumentGenerator(entityManager);
let preview = null;

// ── Calendar pickers ────────────────────────────────────────────────────────
// The main app's CalendarPicker, driven by this app's own field map. Every date
// here is free text and the generator parses long prose, slashes and dots
// alike, so the picker writes the long form and nothing downstream changes.
const AE_CAL_CONFIG = {
  'cal-yearEnd':    { inputId: 'yearEnd',    format: 'long', onpick: () => liveUpdate() },
  'cal-dateSigned': { inputId: 'dateSigned', format: 'long', onpick: () => liveUpdate() },
};
const calendarPicker = new CalendarPicker(AE_CAL_CONFIG);

function toggleCal(calId) { calendarPicker.toggleCal(calId); }

// A loan certificate is signed at a place: "DUMMYVILLE, 14 MARCH 2025". The
// calendar only knows the date half, so it keeps whatever prefix was typed
// before the comma and upper-cases the line the way the certificate prints it.
function aeRegisterLoanCertCal(idx) {
  AE_CAL_CONFIG[`cal-lc-date-${idx}`] = {
    inputId: `lc-date-${idx}`,
    format: 'long',
    transform: (formatted, previous) => {
      const place = (previous || '').split(',').length > 1
        ? (previous || '').split(',')[0].trim() : '';
      const date = formatted.toUpperCase();
      return place ? `${place.toUpperCase()}, ${date}` : date;
    },
    onpick: () => liveUpdate(),
  };
}

function aeUnregisterLoanCertCal(idx) {
  delete AE_CAL_CONFIG[`cal-lc-date-${idx}`];
}

// The two dates on an audit independence declaration - the team member's
// signature and the engagement partner's review - print as the document's long
// form, so the picker writes the same shape the rest of the page uses.
function aeRegisterIndepCal(idx) {
  AE_CAL_CONFIG[`cal-ind-date-${idx}`] =
    { inputId: `ind-date-${idx}`, format: 'long', onpick: () => liveUpdate() };
  AE_CAL_CONFIG[`cal-ind-rev-date-${idx}`] =
    { inputId: `ind-rev-date-${idx}`, format: 'long', onpick: () => liveUpdate() };
}

function aeUnregisterIndepCal(idx) {
  delete AE_CAL_CONFIG[`cal-ind-date-${idx}`];
  delete AE_CAL_CONFIG[`cal-ind-rev-date-${idx}`];
}

// The review declaration carries three dates - the information grid's date and
// the two signatures at its foot - and they print in the document's long form
// the same way the audit one's do.
function aeRegisterReviewIndepCal(idx) {
  AE_CAL_CONFIG[`cal-rind-date-${idx}`] =
    { inputId: `rind-date-${idx}`, format: 'long', onpick: () => liveUpdate() };
  AE_CAL_CONFIG[`cal-rind-sig-date-${idx}`] =
    { inputId: `rind-sig-date-${idx}`, format: 'long', onpick: () => liveUpdate() };
  AE_CAL_CONFIG[`cal-rind-pnr-date-${idx}`] =
    { inputId: `rind-pnr-date-${idx}`, format: 'long', onpick: () => liveUpdate() };
}

function aeUnregisterReviewIndepCal(idx) {
  delete AE_CAL_CONFIG[`cal-rind-date-${idx}`];
  delete AE_CAL_CONFIG[`cal-rind-sig-date-${idx}`];
  delete AE_CAL_CONFIG[`cal-rind-pnr-date-${idx}`];
}

function generateDoc() {
  const output = document.getElementById('document-output');
  const placeholder = document.getElementById('placeholder');
  if (!output) return;

  // Detach the pages the user edited by hand before the rebuild wipes them;
  // they are swapped back in below, in place of their regenerated counterparts.
  const preserved = (typeof AEEditMode !== 'undefined')
    ? AEEditMode.collectPinned(output) : null;

  const html = documentGenerator.generate();
  output.innerHTML = html;

  if (typeof AEEditMode !== 'undefined') {
    AEEditMode.assignPageUids(output);
    AEEditMode.restorePinned(output, preserved);
  }
  // The red checker repaints before pagination, so its wrappers are part of the
  // page the reviewer measures and reads.
  if (typeof SuperRed !== 'undefined') SuperRed.apply(output);
  // SuperRed can only stamp a value it can find on the page, so a field nobody
  // has filled in yet has nothing to click. This wires the generator's
  // placeholders to the fields they stand for, so a letter can be filled in
  // from the page as well as from the form. Before pagination, like SuperRed,
  // so a split page carries the stamps rather than needing them again.
  if (typeof AEPlaceholders !== 'undefined') AEPlaceholders.stamp(output);

  const hasPages = !!output.children.length;
  output.classList.toggle('visible', hasPages);
  if (placeholder) placeholder.style.display = hasPages ? 'none' : '';
  document.getElementById('btn-print')?.classList.toggle('visible', hasPages);
  // Nothing to edit until something is generated, and an edit mode left open
  // over an empty preview would keep liveUpdate() switched off for good.
  const editBtn = document.getElementById('btn-edit-preview');
  if (editBtn) editBtn.style.display = hasPages ? '' : 'none';
  if (!hasPages) {
    _aeScrollPending = false;
    if (typeof AEEditMode !== 'undefined' && AEEditMode.isEditing()) AEEditMode.toggleEditPreview();
    return;
  }
  if (typeof AEEditMode !== 'undefined' && AEEditMode.isEditing()) {
    output.querySelectorAll('.doc-page, .cover-page')
      .forEach(p => p.setAttribute('contenteditable', 'true'));
  }

  // Paginate only once the letterhead images have loaded, or the sheets are
  // measured without them and every page splits in the wrong place.
  const imgs = Array.from(output.querySelectorAll('img'));
  const pending = imgs.filter(img => !img.complete);
  let paginated = false;
  const run = () => {
    if (paginated) return;
    paginated = true;
    requestAnimationFrame(() => {
      preview && preview.paginatePreview();
      // Baseline for the out-of-date check: what the generator produced for
      // each page, captured once the page is in its final paginated shape.
      // Pinned pages keep the baseline they were pinned with.
      if (typeof AEEditMode !== 'undefined') AEEditMode.setBaselines(output);
      // Pages created by a split inherit their uid but not the edit-mode
      // attribute, so re-arm them while editing is on.
      if (typeof AEEditMode !== 'undefined' && AEEditMode.isEditing()) {
        output.querySelectorAll('.doc-page, .cover-page')
          .forEach(p => p.setAttribute('contenteditable', 'true'));
      }
      // Only now are the sheets in their final places, so this is the first
      // moment a scroll target means anything.
      if (_aeScrollPending) {
        _aeScrollPending = false;
        if (typeof aeScrollPreviewToActiveSection === 'function') aeScrollPreviewToActiveSection();
      }
      // A restored draft puts the panels back where they were left, which is
      // only meaningful once the sheets are in their final paginated places.
      if (typeof AEDraftCache !== 'undefined') AEDraftCache.applyPendingScroll();
    });
  };
  if (!pending.length) {
    run();
  } else {
    let remaining = pending.length;
    const done = () => { if (--remaining <= 0) run(); };
    pending.forEach(img => {
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
    });
    setTimeout(run, 2000);
  }
}

// ── Form wiring ─────────────────────────────────────────────────────────────

// The audit/review choice is the top of the form, and everything below it
// follows: which engagement letter is built, which independence declaration,
// and which partners may sign. Nothing is shown until one is picked, because
// "Engagement Letter" means two different documents until it is.
function aeEngagementType() {
  return document.querySelector('input[name="engagementType"]:checked')?.value || '';
}

function onEngagementTypeChange() {
  const type = aeEngagementType();
  const engLabel = document.getElementById('label-engagement-letter');
  if (engLabel) {
    engLabel.textContent = type === 'audit' ? 'Audit Engagement Letter'
      : type === 'review' ? 'Review Engagement Letter'
        : 'Engagement Letter';
  }
  const panel = document.getElementById('documents-panel');
  if (panel) panel.style.display = type ? '' : 'none';
  onDocumentTypesChange();
  liveUpdate();
}

// Which signer dropdown is shown follows the engagement type, and it only
// appears once the letter itself is ticked: a form that asks who signs a letter
// nobody is producing is noise.
function onDocumentTypesChange() {
  const show = (id, on) => {
    const el = document.getElementById(id);
    if (el) el.style.display = on ? '' : 'none';
  };
  const type = aeEngagementType();
  const letter = !!document.getElementById('docEngagementLetter')?.checked;
  show('signer-audit-box', letter && type === 'audit');
  show('signer-review-box', letter && type === 'review');
  show('signers-panel', letter && !!type);
  // Only the audit declaration carries an engagement reference and a
  // public-interest-entity row, so the box that fills them follows both the
  // tick and the audit choice.
  const indep = !!document.getElementById('docIndependence')?.checked;
  show('indep-fields-panel', indep && type === 'audit');
  // One declaration per team member is the audit form only: the review template
  // is a single document whose cells are ruled blanks, and its wording is the
  // firm's to change, not this app's.
  // Both templates are one declaration per team member, but they ask for
  // different fields, so each engagement type has its own list of cards and
  // only the one for the chosen type is on screen.
  const indepPeople = indep && type === 'audit';
  const reviewIndepPeople = indep && type === 'review';
  show('indep-section', indepPeople);
  show('review-indep-section', reviewIndepPeople);
  // Loan Certificates is Step 4 on its own and Step 5 behind the declarations.
  const lcStep = document.getElementById('loan-cert-step-label');
  if (lcStep) lcStep.textContent = (indepPeople || reviewIndepPeople) ? 'Step 5' : 'Step 4';
  show('loan-cert-section', !!document.getElementById('docLoanCerts')?.checked);
  // The representation letter is signed by the same people who accept the
  // engagement, so it wants Step 3 on screen even with no engagement letter
  // ticked.
  const repLetter = !!document.getElementById('docRepLetter')?.checked;
  show('acceptance-section', letter || repLetter);
}

function onEntityTypeChange(select) {
  entityManager.setEntityType(select.value);
}

function addSignatory() { entityManager.addSignatory(); }
function removeSignatory(idx) { entityManager.removeSignatory(idx); }
function addIndepPerson() { entityManager.addIndepPerson(); entityManager.liveUpdate(); }
function removeIndepPerson(idx) { entityManager.removeIndepPerson(idx); }
function addReviewIndepPerson() { entityManager.addReviewIndepPerson(); entityManager.liveUpdate(); }
function removeReviewIndepPerson(idx) { entityManager.removeReviewIndepPerson(idx); }
function addLoanCert() { entityManager.addLoanCert(); }
function removeLoanCert(idx) { entityManager.removeLoanCert(idx); }
function printDocument() { preview && preview.printDocument(); }

// ── Startup ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  preview = new AEPreview({
    documentOutput: document.getElementById('document-output'),
    documentScaler: document.getElementById('document-scaler'),
    previewPanel: document.querySelector('.preview-panel')
  });

  calendarPicker.init();

  // One signatory row up front — every letter has an acceptance block, so an
  // empty list is never the state the user wants to start from.
  entityManager.addSignatory();

  // One declaration card up front. Empty, it prints exactly the blank
  // declaration this document was before the fields existed - so the default
  // state is unchanged and the fields are there to be found.
  entityManager.addIndepPerson();
  entityManager.addReviewIndepPerson();

  // The Company Name box doubles as the ClientReg search: type a name, pick a
  // client, and the entity, address, year end, partner and signatories fill in.
  // The register is loaded lazily on first use, so this costs nothing here.
  if (typeof AEClientReg !== 'undefined') AEClientReg.init();

  onEngagementTypeChange();
  // Bring back the form this browser was last working on. There is no database
  // here, so the cached draft is the only copy of unfinished work — see
  // js/DraftCache.js. It generates the document itself when it restores
  // something, so the blank first generate only runs when it does not.
  const restored = typeof AEDraftCache !== 'undefined' && AEDraftCache.restore();
  if (!restored) generateDoc();
  // The red checker is always on — every letter is reviewed by whoever is free,
  // so there is nothing to switch on.
  if (typeof SuperRed !== 'undefined') SuperRed.start();
});
