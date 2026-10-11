// SectionNav.js — When live preview is on, auto-scroll the preview panel to the
// section that corresponds to whichever form section the user is currently editing.

// Map a form section-title text to the matching doc page heading.
// Returns the first .doc-page / .cover-page whose h2 matches, or null.
function _matchDocPageForForm(formLabel, sourceEl) {
  const l = formLabel.toLowerCase();
  const output = document.getElementById('document-output');
  if (!output) return null;

  const pages = Array.from(output.querySelectorAll('.doc-page, .cover-page'))
    .filter(p => !p.hasAttribute('data-continuation-of'));

  const find = pred => pages.find(p => {
    const h2 = p.querySelector('h2');
    return h2 && pred(h2.textContent.toLowerCase());
  }) || null;

  if (l.includes('entity type'))                  return null;
  if (l.includes('general information'))           return find(h => h.includes('general information'));
  if (l.includes('accounting policies'))           return find(h => h.includes('notes for the year'));
  if (l.includes('loan cert'))                     return _loanCertPageFor(output, sourceEl) || find(h => h.includes('loan certificate'));
  // Engagement letter pages have no <h2> — DocumentGenerator tags the first one instead.
  if (l.includes('engagement'))
    return output.querySelector('[data-doc-section="engagement"]') || find(h => h.includes('engagement'));
  if (/(director|member|trustee|committee|council|governing)/.test(l) && !l.includes('report'))
    return find(h => h.includes('responsibilities and approval'));
  if (_isTrustResolutionField(sourceEl)) {
    const res = output.querySelector('[data-doc-section="resolution"]');
    if (res) return res;
  }
  if (l.includes('minutes'))                       return _shareholderPageFor(output, sourceEl) || find(h => h.includes('minutes') || h.includes('annual general meeting'));
  if (l.includes('report type'))                   return find(h => h.includes('independent') && h.includes('report'));
  if (l.includes('report') && !l.includes('type')) return find(h => h.includes('report') && !h.includes('independent'));
  if (l.includes('specific matters'))              return find(h => h.includes('report'));
  if (l.includes('addresses') || l.includes('dates')) return find(h => h.includes('general information'));
  return null;
}

// Loan certificates are one page per certificate, in form order (removed cards
// are skipped by getLoanCerts, so the ordinal among the cards still on the form
// is the ordinal among the pages). Editing certificate 3 lands on page 3, not 1.
function _loanCertPageFor(output, el) {
  const card = el && el.closest && el.closest('[id^="loan-cert-card-"]');
  if (!card || !card.parentElement) return null;
  const cards = Array.from(card.parentElement.children)
    .filter(c => /^loan-cert-card-\d+$/.test(c.id));
  const n = cards.indexOf(card);
  const pages = Array.from(output.querySelectorAll('[data-doc-section="loan-certificate"]'))
    .filter(p => !p.hasAttribute('data-continuation-of'));
  return n >= 0 ? (pages[n] || null) : null;
}

// The trust resolution question, date and representative sit under the
// "Trust — Minutes of Annual General Meeting" section title, so the label alone
// sent the preview to the minutes page. Recognise them by element instead.
function _isTrustResolutionField(el) {
  if (!el || !el.closest) return false;
  if (el.closest('#trust-resolution-box')) return true;
  const group = el.closest('.field-group');
  return !!(group && group.querySelector('input[name="trustResolutionLetter"]'));
}

// The shareholder cards sit under the "Minutes" section title, which otherwise
// matches the FIRST minutes page — the directors' meeting — so editing any
// shareholder jumped the preview away from the shareholders' AGM. Each signature
// entry carries the card's own number (data-sh-index), so shareholder 5 lands on
// the page that actually holds shareholder 5's signature block, continuation
// pages included. A card with no name yet has no entry: fall back to the AGM page.
function _shareholderPageFor(output, el) {
  const card = el && el.closest && el.closest('[id^="sh-card-"]');
  if (!card) return null;
  const idx = (card.id.match(/^sh-card-(\d+)$/) || [])[1];
  const entry = idx && output.querySelector('[data-sh-index="' + idx + '"]');
  const page = entry && entry.closest('.doc-page, .cover-page');
  return page || output.querySelector('[data-minutes-part="shareholders"]') || null;
}

// Find the section-title closest above the currently focused input.
function _activeFormSection() {
  const el = document.activeElement;
  if (!el) return null;
  const panel = document.querySelector('.form-panel');
  if (!panel || !panel.contains(el)) return null;

  let node = el;
  while (node && node !== panel) {
    const prev = node.previousElementSibling;
    if (prev && prev.classList.contains('section-title')) return prev.textContent.trim();
    const title = node.querySelector && node.querySelector('.section-title');
    if (title) return title.textContent.trim();
    // Walk up to the parent's section-title
    if (node.parentElement) {
      const siblings = Array.from(node.parentElement.children);
      const idx = siblings.indexOf(node);
      for (let i = idx - 1; i >= 0; i--) {
        if (siblings[i].classList.contains('section-title')) return siblings[i].textContent.trim();
      }
    }
    node = node.parentElement;
  }
  return null;
}

// Scroll the preview panel so the given doc page is visible.
function _scrollPreviewToPage(page) {
  const panel = document.querySelector('.preview-panel');
  if (!panel || !page) return;
  const delta = page.getBoundingClientRect().top - panel.getBoundingClientRect().top;
  panel.scrollTo({ top: panel.scrollTop + delta - 12, behavior: 'smooth' });
}

// Called after a live-update regeneration to scroll the preview to the section
// the user is currently editing in the form.
function scrollPreviewToActiveSection() {
  // The focused field is the most precise signal; fall back to the last element
  // clicked/changed for checkboxes, radios and buttons that don't keep focus.
  const panel = document.querySelector('.form-panel');
  const active = document.activeElement;
  const el = (panel && active && active !== panel && panel.contains(active)) ? active : _lastInteractedEl;
  const label = (el && _sectionLabelFromElement(el)) || _lastInteractedSection || _activeFormSection();
  if (!label) return;
  const page = _matchDocPageForForm(label, el);
  if (page) _scrollPreviewToPage(page);
}

// Track the last section the user interacted with (click, change, input) so
// auto-scroll works for checkboxes, selects, buttons — not just focused inputs.
let _lastInteractedSection = null;
let _lastInteractedEl = null;

function _sectionLabelFromElement(el) {
  const panel = document.querySelector('.form-panel');
  if (!panel || !panel.contains(el)) return null;
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

['click', 'change', 'input', 'focusin'].forEach(type => {
  document.addEventListener(type, (e) => {
    const label = _sectionLabelFromElement(e.target);
    if (label) { _lastInteractedSection = label; _lastInteractedEl = e.target; }
  }, true);
});
