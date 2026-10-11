// SectionNav.js — Assurance Engagements
//
// The same behaviour as the main app's web/js/SectionNav.js: while the live
// preview is on, typing in a form section scrolls the preview to the page that
// section produces. The mechanics are lifted from there verbatim (section-title
// lookup, last-interacted tracking, smooth scroll inside .preview-panel); only
// the form-section → page mapping is this app's own, because these documents
// have no <h2> headings to match on. Every page the generator emits carries a
// `data-page-key` instead, so the mapping resolves to one of those.

// Which engagement is being produced — the page keys are prefixed with it.
function _aeEngPrefix() {
  return document.getElementById('engTypeAudit')?.checked ? 'audit' : 'review';
}

// First non-continuation page with the given data-page-key.
function _aePageByKey(output, key) {
  return Array.from(output.querySelectorAll(`[data-page-key="${key}"]`))
    .find(p => !p.hasAttribute('data-continuation-of')) || null;
}

// A key may not be on the page at all (that document isn't ticked). Try each in
// turn and take the first that exists, so "Acceptance" still lands somewhere
// sensible when the engagement letter is off.
// Both declarations are one document per person, and their page keys carry the
// copy's ordinal, so the first copy's first sheet is where a form field lands.
function _aeIndepKeys(eng) {
  return eng === 'audit' ? ['audit-indep-1-1'] : ['review-indep-1-1'];
}

function _aeIndepFirstPage(output, eng) {
  return _aeFirstPage(output, _aeIndepKeys(eng));
}

function _aeFirstPage(output, keys) {
  for (const k of keys) {
    const p = _aePageByKey(output, k);
    if (p) return p;
  }
  return null;
}

// An independence declaration is one document per person, numbered in form
// order, so the ordinal among the cards is the ordinal among the copies. The
// audit cards and the review cards are separate lists — only one of them is on
// screen at a time — and each maps onto its own template's pages.
function _aeIndepPageFor(output, el) {
  if (!el || !el.closest) return null;
  const audit = el.closest('[id^="indep-card-"]');
  const review = el.closest('[id^="rindep-card-"]');
  const card = audit || review;
  if (!card || !card.parentElement) return null;
  const re = review ? /^rindep-card-\d+$/ : /^indep-card-\d+$/;
  const key = review ? 'review-indep' : 'audit-indep';
  const cards = Array.from(card.parentElement.children).filter(c => re.test(c.id));
  const n = cards.indexOf(card);
  return n >= 0 ? _aePageByKey(output, `${key}-${n + 1}-1`) : null;
}

// Loan certificates are one page per certificate, numbered in form order. The
// cards still on the form are the certificates still in the document, so the
// ordinal among the cards is the ordinal among the pages — editing certificate
// 3 lands on certificate 3's page, not the first one.
function _aeLoanCertPageFor(output, el) {
  const card = el && el.closest && el.closest('[id^="loan-cert-card-"]');
  if (!card || !card.parentElement) return null;
  const cards = Array.from(card.parentElement.children)
    .filter(c => /^loan-cert-card-\d+$/.test(c.id));
  const n = cards.indexOf(card);
  return n >= 0 ? _aePageByKey(output, `loan-cert-${n + 1}`) : null;
}

// Map a form section title (plus the element actually being edited, which is
// what tells Step 1's several boxes apart) to the page it produces.
function _aeMatchDocPageForForm(formLabel, sourceEl) {
  const l = (formLabel || '').toLowerCase();
  const output = document.getElementById('document-output');
  if (!output) return null;
  const eng = _aeEngPrefix();
  const id = (sourceEl && sourceEl.id) || '';

  // One audit declaration per person, in form order - editing the third card
  // lands on the third declaration, the same rule the loan certificates follow.
  if (l.includes('independence'))
    return _aeIndepPageFor(output, sourceEl) || _aeIndepFirstPage(output, eng);

  if (l.includes('loan certificate'))
    return _aeLoanCertPageFor(output, sourceEl) || _aePageByKey(output, 'loan-cert-1');

  // The acceptance block prints at the foot of the engagement letter - or, with
  // no engagement letter on, at the foot of the representation letter, which the
  // same people sign.
  if (l.includes('acceptance'))
    return _aeFirstPage(output, [`${eng}-eng-3`, `${eng}-eng-1`, 'repr-letter-2', 'repr-letter-1']);

  if (l.includes('engagement')) {
    // Step 1 is four boxes under one section title, so the control decides.
    if (id === 'docLoanCerts')  return _aePageByKey(output, 'loan-cert-1');
    if (id === 'docRepLetter')  return _aePageByKey(output, 'repr-letter-1');
    if (id === 'docIndependence' || id === 'engFileRef' || id === 'publicInterestEntity')
      return _aeIndepFirstPage(output, eng);
    // The signer prints on the letter's last sheet.
    if (id === 'engSignerAudit' || id === 'engSignerReview')
      return _aeFirstPage(output, [`${eng}-eng-3`, `${eng}-eng-1`]);
    if (id === 'docEngagementLetter') return _aePageByKey(output, `${eng}-eng-1`);
    // Engagement type itself rebuilds everything — go back to the top.
    return output.querySelector('.doc-page, .cover-page') || null;
  }

  // Entity name, year end and the dates print on the first sheet of whichever
  // document is on, so the first page is the right landing spot.
  if (l.includes('entity')) {
    // The registration number prints on the representation letter and nowhere
    // else, so it lands there rather than on whatever sheet is first.
    if (id === 'regNumber') {
      const reg = _aePageByKey(output, 'repr-letter-1');
      if (reg) return reg;
    }
    return _aeFirstPage(output, [`${eng}-eng-1`, ..._aeIndepKeys(eng), 'repr-letter-1', 'loan-cert-1'])
        || output.querySelector('.doc-page, .cover-page') || null;
  }

  return null;
}

// Scroll the preview panel so the given page is visible.
function _aeScrollPreviewToPage(page) {
  const panel = document.querySelector('.preview-panel');
  if (!panel || !page) return;
  const delta = page.getBoundingClientRect().top - panel.getBoundingClientRect().top;
  panel.scrollTo({ top: panel.scrollTop + delta - 12, behavior: 'smooth' });
}

// Find the section-title closest above the given element.
function _aeSectionLabelFromElement(el) {
  const panel = document.querySelector('.form-panel');
  if (!panel || !el || !panel.contains(el)) return null;
  let node = el;
  while (node && node !== panel) {
    const siblings = node.parentElement ? Array.from(node.parentElement.children) : [];
    const idx = siblings.indexOf(node);
    for (let i = idx - 1; i >= 0; i--) {
      if (siblings[i].classList.contains('section-title')) return siblings[i].textContent.trim();
    }
    node = node.parentElement;
  }
  return null;
}

// Track the last section the user interacted with (click, change, input) so
// auto-scroll works for checkboxes, selects and buttons — not just focused
// inputs, which lose focus the moment a pill is clicked.
let _aeLastInteractedSection = null;
let _aeLastInteractedEl = null;

['click', 'change', 'input', 'focusin'].forEach(type => {
  document.addEventListener(type, (e) => {
    const label = _aeSectionLabelFromElement(e.target);
    if (label) { _aeLastInteractedSection = label; _aeLastInteractedEl = e.target; }
  }, true);
});

// Called after a live-update regeneration: scroll the preview to the section
// the user is currently editing in the form.
function aeScrollPreviewToActiveSection() {
  const panel = document.querySelector('.form-panel');
  const active = document.activeElement;
  const el = (panel && active && active !== panel && panel.contains(active))
    ? active : _aeLastInteractedEl;
  const label = (el && _aeSectionLabelFromElement(el)) || _aeLastInteractedSection;
  if (!label) return;
  const page = _aeMatchDocPageForForm(label, el);
  if (page) _aeScrollPreviewToPage(page);
}
