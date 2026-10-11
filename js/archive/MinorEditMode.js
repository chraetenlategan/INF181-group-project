// MinorEditMode.js — "minor edit" view that hides constant fields and shows
// only the values that change from one year's statement to the next.
// Activated from the Business Information box after a statement is loaded.

// Fields that genuinely change between yearly statements. Every other
// (constant) field is hidden so the accountant only sees these, pre-filled
// with the previously loaded values.
const MINOR_EDIT_FIELD_IDS = [
  // Dates
  'yearEnd', 'prevYearEnd', 'dateApproved', 'dateSigned', 'dateOfIssue',
  // Financial figures
  'profitLoss', 'prevProfitLoss', 'dividendAmount',
  'insolventAccLoss', 'insolventExcessLiab',
  'reviewAccLoss', 'reviewExcessLiab',
  'bcContribAmount', 'bcPrevContribAmount', 'bcPrevYear',
  // Page numbers
  'pageStart', 'pageEnd', 'trustPageStart', 'trustPageEnd',
  // Meeting & AGM venues + dates
  'minutes-venue', 'minutes-date',
  'cc-minutes-venue', 'cc-minutes-date',
  'bcAGMVenue', 'bcAGMDate',
  'trustAGMVenue', 'trustAGMDate',
];

class MinorEditMode {
  constructor() {
    this.active = false;
  }

  // Show the toggle button — called once a statement has been loaded.
  revealButton() {
    const btn = document.getElementById('btn-minor-edit');
    if (btn) btn.style.display = 'inline-flex';
  }

  toggle() {
    if (this.active) this.exit();
    else this.enter();
  }

  enter() {
    const panel = document.querySelector('.form-panel');
    if (!panel) return;

    // Clear any stale marks, then flag the field-group of each variable field.
    panel.querySelectorAll('.me-keep, .me-path').forEach(el => el.classList.remove('me-keep', 'me-path'));

    const markKeep = (el) => {
      if (!el) return;
      const group = el.closest('.field-group') || el.parentElement;
      // Skip fields that are currently hidden (e.g. inactive conditional
      // sections) — offsetParent is null when the element or an ancestor is
      // display:none. This is read before .minor-edit is applied, so it
      // reflects the real conditional state of the loaded statement.
      if (!group || group.offsetParent === null) return;
      group.classList.add('me-keep');
      // Reveal the ancestor chain so a kept field nested inside a block
      // (e.g. #step6-block, a loan-cert card) isn't hidden by its parent.
      let p = group.parentElement;
      while (p && !p.classList.contains('form-panel')) {
        p.classList.add('me-path');
        p = p.parentElement;
      }
    };

    MINOR_EDIT_FIELD_IDS.forEach(id => markKeep(document.getElementById(id)));
    // Loan certificate amounts & dates are dynamic — match by id prefix.
    panel.querySelectorAll('[id^="lc-amount-"], [id^="lc-date-"]').forEach(markKeep);

    panel.classList.add('minor-edit');
    this.active = true;

    const label = document.getElementById('minor-edit-label');
    if (label) label.textContent = 'Back to Full Form';
    const btn = document.getElementById('btn-minor-edit');
    if (btn) {
      btn.classList.add('active');
      btn.title = 'Minor edit is ON — only the fields that change year to year are shown. Click to go back to the full form.';
    }

    // Regenerate so the accountant sees the previously generated statement.
    if (typeof generateAndPreview === 'function') generateAndPreview();
  }

  exit() {
    const panel = document.querySelector('.form-panel');
    if (panel) {
      panel.classList.remove('minor-edit');
      panel.querySelectorAll('.me-keep, .me-path').forEach(el => el.classList.remove('me-keep', 'me-path'));
    }
    this.active = false;

    const label = document.getElementById('minor-edit-label');
    if (label) label.textContent = 'Switch to Minor';
    const btn = document.getElementById('btn-minor-edit');
    if (btn) {
      btn.classList.remove('active');
      btn.title = 'Minor edit is OFF — the full form is shown. Click to show only the fields that change year to year.';
    }
  }
}
