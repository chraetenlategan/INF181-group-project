/* SuperRed.js — the red checker (always on)
   ---------------------------------------------------------------------------
   The generator wraps the values it knows about in <span class="hl-kw">. That
   only covers what the generator itself substituted: a free-typed "Other"
   description, a pasted sentence, a manually entered figure or anything else
   that reaches the page through a template rather than a named substitution
   stays black, and the reviewer has no way to tell it apart from boilerplate.

   The red checker closes that gap from every direction at once:

   1. Form values. Every value typed or chosen on the left-hand side is painted
      wherever it lands on the right — and so are the shapes the generator turns
      it into (a name collapsed to initials, a number given thousand spaces, an
      ID number grouped, "CC" spelled out as Close Corporation).
   2. Shapes, whatever their source. Every date, year, amount, percentage,
      registration/ID number and titled person ("Mr J Smith") on the page is
      painted, including the ones the generator *derives* — the comparative
      year end, the engagement date 14 days before signing — which no form
      field holds verbatim.
   3. Blanks. An unfilled "[PLACEHOLDER]" gets a heavy red box, because a blank
      that reaches a signed statement is the worst thing a review can miss.
   4. Selections. Ticked radios, checkboxes, chosen dropdowns and the selected
      entity card turn red on the form itself.

   It is a preview-only review aid, and it is not optional — every statement is
   reviewed by whoever is free, so there is nothing to switch on. `body.super-red`
   is set in index.html and this module simply paints:
   - the wrappers use the same `.hl-kw` class and the same red (utils.js
     HL_KW_RGB), so the existing print rules, `stripHighlightColour()` and the
     PDF path neutralise them with no extra work;
   - the extra emphasis is drawn with box-shadow and outline only. Those are not
     editing styles, so contenteditable never bakes them into retyped text, and
     they take no layout space — pagination is identical with the mode on or off;
   - hand-edited pages are left alone — their HTML is the auditor's own and is
     persisted on save, so nothing is injected into it. The protected variables
     already inside them are kept current by DocVars.patch() instead.

   Depends on utils.js helpers when present (formatName, abbreviateGivenNames,
   parseName, formatNumber, formatIdString, expandCloseCorporation). Consumed by
   app.js (`generateDoc`, startup).
*/

const SuperRed = (() => {
  const BODY_CLASS  = 'super-red';
  const WRAP_CLASS  = 'hl-kw hl-kw-super';

  // Chrome that is not part of the document — page furniture must never be
  // treated as a value.
  const SKIP_SELECTOR = '.page-split-chip, .letterhead-img, ' +
    '.letterhead-footer, .page-header, .page-number, script, style';

  // A word shorter than this matches far too much ordinary prose to be useful.
  const MIN_LEN = 3;
  // Guards the regex size on a form with hundreds of filled fields.
  const MAX_TERMS = 800;

  const MONTHS = 'January|February|March|April|May|June|July|August|September|October|November|December';

  // Shape patterns, applied after the form values. Case-sensitive on purpose:
  // "May" the month is capitalised, "may" the verb is not.
  // Order matters: registration and ID numbers go before dates, or the "2012"
  // at the front of "2012/123456/07" would be taken as a year.
  const PATTERNS = [
    { kind: 'number', re: new RegExp(
        `\\b\\d{4}\\/\\d{4,8}\\/\\d{2}\\b` +                           // 2012/123456/07
        `|\\bIT\\s?\\d{2,}(?:\\/\\d+)*` +                               // IT 1234/2010
        `|\\b\\d{6}\\s?\\d{4}\\s?\\d{2}\\s?\\d\\b`, 'g') },             // SA ID number
    { kind: 'date', re: new RegExp(
        `\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTHS})\\s+\\d{4}\\b` +   // 28 February 2026
        `|\\b(?:${MONTHS})\\s+\\d{1,2},?\\s+\\d{4}\\b` +                // February 28, 2026
        `|\\b(?:${MONTHS})\\s+\\d{4}\\b` +                              // February 2026
        `|\\b\\d{4}[./-]\\d{1,2}[./-]\\d{1,2}\\b` +                     // 2026.02.28
        `|\\b\\d{1,2}[./-]\\d{1,2}[./-]\\d{4}\\b` +                     // 28/02/2026
        `|\\b\\d{1,2}\\s+(?:${MONTHS})\\b` +                            // 28 February
        `|\\b(?:19|20)\\d{2}\\b`, 'g') },                               // 2026
    { kind: 'amount', re: new RegExp(
        `\\bR\\s?(?:\\(\\d[\\d\\s,]*(?:\\.\\d+)?\\)|-?\\d[\\d\\s,]*(?:\\.\\d+)?)` + // R 1 250 000.00, R (500)
        `|\\b\\d{1,3}(?:[ ,]\\d{3})+(?:\\.\\d+)?\\b` +                  // 1 250 000
        `|\\b\\d+(?:[.,]\\d+)?\\s?%` +                                  // 12.5%
        `|\\b\\d+[.,]\\d+\\b` +                                         // 12.50
        `|\\b\\d{3,}\\b`, 'g') },                                       // 500
    { kind: 'person', re: new RegExp(
        `\\b(?:Mr|Mrs|Ms|Miss|Dr|Prof|Adv|Ds|Rev|Mnr|Mev)\\.?\\s+` +
        `(?:[A-Z][A-Za-z'’-]*\\.?\\s+){0,4}` +
        `(?:(?:van|von|de|der|den|du|le|la|ter|ten)\\s+){0,3}[A-Z][A-Za-z'’-]+`, 'g') },
    // The statements a report or letter names. The generator keyword-highlights
    // most of them, but template text (the engagement letters) carries them as
    // plain prose. "Accounting policies" and "statement of financial position"
    // are left out on the reviewer's request — they are on nearly every page.
    { kind: 'phrase', re: new RegExp(
        `\\bstatements? of (?:comprehensive income|profit or loss and other comprehensive income|changes in (?:equity|funds)|cash flows)\\b` +
        `|\\b(?:directors|trustees|members)['’] report\\b`, 'gi') },
  ];

  // Headings: real <h1>–<h6> and `.underline-heading` are painted by CSS alone.
  // The letters build theirs as a paragraph that is nothing but bold text
  // ("<p><strong>APPOINTMENT TO PROVIDE SERVICES</strong></p>"), which has no
  // selector of its own, so those are found here and given `.sr-heading`.
  const HEADING_CANDIDATES = 'p, div';
  const HEADING_CLASS = 'sr-heading';

  // Unfilled generator placeholders: "[YEAR END]", "[COMPANY NAME]".
  const MISSING_RE = /\[[A-Z][A-Z0-9 &'’\/().,-]*\]/g;

  // References that are part of the boilerplate and never change from one
  // client to the next: statutes, professional standards, sections and rules,
  // and the "[CA(SA)]" designation (which is bracketed like a placeholder).
  // They carry years and 3–4 digit numbers, so without this the shape patterns
  // paint "2008" in "Companies Act 71 of 2008" and "4410" in "ISRS 4410".
  // Matched first and wrapped in an uncoloured `.sr-fixed` span, which every
  // later pass skips.
  const FIXED_RE = new RegExp(
    `\\[CA\\(SA\\)\\]|\\bCA\\(SA\\)` +                                        // [CA(SA)]
    `|\\b2011\\b` +                                                           // Companies Regulations, 2011; Sectional Titles Act, 2011
    `|\\b(?:19|20)\\d{2}\\s+\\(Act\\s+\\d+\\s+of\\s+(?:19|20)\\d{2}\\)` +      // 1993 (Act 67 of 1993)
    `|\\bAct,?\\s+(?:No\\.?\\s+)?\\d+(?:\\s+of\\s+(?:19|20)\\d{2})?` +         // Act 71 of 2008, Act, 2005
    `|\\b(?:ISRS|ISRE|ISAE|ISA|IAS|IFRS|IPSAS|ISQM|ISQC|GRAP)\\)?\\s+\\d+(?:\\s*\\(Revised\\))?` + // ISRE 2400, (ISRE) 2400
    `|\\b(?:Related\\s+)?Services\\s+\\d{4}(?:\\s*\\(Revised\\))?` +          // Related Services 4410 (Revised)
    `|\\bEngagements\\s+\\d{4}(?:\\s*\\(Revised\\))?` +                       // Review Engagements 2400
    `|\\b(?:Sections?|Regulations?|Rules?|Schedules?|Paragraphs?|Articles?)\\s+\\d+(?:\\.\\d+)*[A-Za-z]?(?:\\(\\d+\\))*` +
      `(?:\\s*(?:,|and|to|or|-|–)\\s*\\d+(?:\\.\\d+)*[A-Za-z]?(?:\\(\\d+\\))*)*`, // Sections 87 and 95, Rule 54.24.3
    'g');

  let _formListener = null;

  // term (normalised, exact case) -> { field, shape }: the one form field
  // holding exactly that value and the rendering it is shown in — or null when
  // two fields hold the same thing. Rebuilt by _collectTerms() on every
  // apply(), read by _paint() to stamp `data-sync-field` / `data-var-shape` on
  // the wrapper. Those two attributes are what make the wrapper a *protected
  // variable*: LiveSync.js edits against them and DocVars.js re-renders them in
  // place when the form moves, so a hand-edited page keeps following the form
  // without being rebuilt.
  //
  // Only a whole, single-line value of an editable text field is bound: a
  // derived shape (initials, a comparative year end) is still painted red, but
  // it could not be written back verbatim, so it stays read-only and is not a
  // protected variable.
  const _bindings = new Map();

  function _esc(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function _clean(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  function _visible(el) { return !el.disabled && el.offsetParent !== null; }

  // ── Collecting what the user put in ────────────────────────────────────────
  // Every typed value plus the shapes the generator is known to render it in.
  function _variants(v) {
    const out = [v];
    const tryAdd = (fn) => {
      try { const r = fn(); if (r && typeof r === 'string') out.push(r); } catch (_) {}
    };
    if (/^[\d\s,.]+$/.test(v)) {
      if (typeof formatNumber === 'function') tryAdd(() => formatNumber(v));
      tryAdd(() => v.replace(/\s/g, ''));
      if (typeof formatIdString === 'function') tryAdd(() => formatIdString(v));
    } else if (/[A-Za-z]/.test(v)) {
      if (typeof formatName === 'function') tryAdd(() => formatName(v));
      // "Rita Clarke" → "R Clarke". Only for things shaped like a
      // person's name; a company name collapsed to initials is noise.
      const words = v.split(/\s+/);
      const nameLike = /^[A-Za-z'’ .-]+$/.test(v) && words.length >= 2 && words.length <= 6 &&
        !/\b(pty|ltd|cc|inc|trust|npc|club|church|school|trading|holdings|investments|association)\b/i.test(v);
      if (nameLike && typeof abbreviateGivenNames === 'function') {
        tryAdd(() => abbreviateGivenNames(v));
        if (typeof toTitleCase === 'function') tryAdd(() => abbreviateGivenNames(toTitleCase(v)));
      }
      if (typeof expandCloseCorporation === 'function') tryAdd(() => expandCloseCorporation(v));
    }
    return out;
  }

  // The shapes of a value that can be typed over and written straight back to
  // the field: the raw text, and the renderings that survive the round trip
  // (thousand spaces, a grouped ID number, title case). Deliberately NOT the
  // name abbreviation — "Rita Clarke" renders "R Clarke", and writing an
  // edit of that back to the field would throw the given name away.
  //
  // Each shape is *named*, because the name is what turns the wrapper into a
  // protected variable: DocVars.render() redoes the same rendering against the
  // field's new value, so an edited page can be brought back in step with the
  // form without rebuilding the page. Keep these names in step with
  // DocVars.render()'s switch.
  function _bindableShapes(v) {
    const out = [{ shape: 'raw', value: v }];
    const tryAdd = (shape, fn) => {
      try { const r = fn(); if (r && typeof r === 'string') out.push({ shape, value: r }); } catch (_) {}
    };
    if (/^[\d\s,.]+$/.test(v)) {
      if (typeof formatNumber === 'function') tryAdd('number', () => formatNumber(v));
      if (typeof formatIdString === 'function') tryAdd('id', () => formatIdString(v));
      tryAdd('nospace', () => v.replace(/\s/g, ''));
    } else if (/[A-Za-z]/.test(v)) {
      if (typeof toTitleCase === 'function') tryAdd('title', () => toTitleCase(v));
      if (typeof expandCloseCorporation === 'function') tryAdd('cc', () => expandCloseCorporation(v));
    }
    return out;
  }

  // Record `value -> field id` for a field that may be edited from the preview.
  function _bind(el, raw) {
    if (!el.id || el.readOnly || el.disabled) return;
    if (/[\r\n]/.test(raw)) return;            // a multi-line textarea is not one value
    const base = _clean(raw);
    if (base.length < 2) return;
    _bindableShapes(base).forEach(({ shape, value }) => {
      // Keyed by the exact text, case included. The painter matches case-
      // insensitively (a red flag is cheap), but a binding re-renders the span
      // from the field — so "statement of financial position" in a sentence
      // bound to the "Statement of Financial Position" index label came back
      // capitalised on the next patch. Only text the page shows exactly as
      // this shape renders it is the field's value.
      const key = _clean(value);
      if (key.length < 2) return;
      // Two different fields holding the same text: there is no right answer to
      // "which one did I just edit?", so neither is bound.
      const prev = _bindings.get(key);
      if (prev !== undefined && (prev === null || prev.field !== el.id)) { _bindings.set(key, null); return; }
      // Same field, two shapes rendering identically: keep the first (raw).
      if (prev) return;
      _bindings.set(key, { field: el.id, shape });
    });
  }

  function _collectTerms() {
    const panel = document.querySelector('.form-panel');
    _bindings.clear();
    if (!panel) return [];

    const seen = new Set();
    const add = (raw) => {
      _variants(_clean(raw)).forEach(t => {
        const v = _clean(t);
        // Pure numbers may be short ("50" shares); words may not.
        const min = /^\d+$/.test(v) ? 2 : MIN_LEN;
        if (v.length >= min) seen.add(v);
      });
    };

    panel.querySelectorAll('input, textarea, select').forEach(el => {
      // Hidden sections belong to another entity type.
      // Their stale values are not on the page and would only produce false
      // positives, so only visible fields count.
      if (!_visible(el)) return;
      if (el.tagName === 'SELECT') {
        const opt = el.options[el.selectedIndex];
        if (opt && opt.value) add(opt.textContent);
        return;
      }
      const type = (el.type || 'text').toLowerCase();
      if (type === 'radio' || type === 'checkbox' || type === 'file' ||
          type === 'button' || type === 'submit' || type === 'hidden') return;
      // A textarea holds several independent lines; each is its own value.
      String(el.value || '').split(/\r?\n/).forEach(add);
      _bind(el, String(el.value || ''));
    });

    // Longest first, so "ABC Holdings (Pty) Ltd" wins over "ABC Holdings".
    return Array.from(seen)
      .sort((a, b) => b.length - a.length)
      .slice(0, MAX_TERMS);
  }

  function _escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function _buildTermPattern(terms) {
    if (!terms.length) return null;
    // Whole-word edges wherever the term itself starts/ends on a letter or
    // digit, so "ABC" never lights up inside "ABCD" and "12" not inside "2012".
    const parts = terms.map(t => {
      const body = _escapeRe(t).replace(/ /g, '\\s+');
      const pre  = /^[A-Za-z0-9]/.test(t) ? '(?<![A-Za-z0-9])' : '';
      const post = /[A-Za-z0-9]$/.test(t) ? '(?![A-Za-z0-9])' : '';
      return pre + body + post;
    });
    try {
      return new RegExp('(?:' + parts.join('|') + ')', 'gi');
    } catch (_) {
      return null;
    }
  }

  // ── Painting the preview ───────────────────────────────────────────────────
  function _paint(root, re, kind, skipInside) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const el = node.parentElement;
        if (!el) return NodeFilter.FILTER_REJECT;
        if (el.closest(skipInside)) return NodeFilter.FILTER_REJECT;
        if (el.closest(SKIP_SELECTOR)) return NodeFilter.FILTER_REJECT;   // app chrome
        if (el.closest('[data-edited]')) return NodeFilter.FILTER_REJECT; // auditor's own HTML
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    const targets = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) targets.push(n);

    let count = 0;
    targets.forEach(node => {
      const text = node.nodeValue;
      re.lastIndex = 0;
      if (!re.test(text)) return;
      re.lastIndex = 0;

      const frag = document.createDocumentFragment();
      let last = 0, m;
      while ((m = re.exec(text)) !== null) {
        if (m[0].length === 0) { re.lastIndex++; continue; } // never loop forever
        // Trim trailing separators the amount pattern can swallow ("R 500 ").
        const hit = m[0].replace(/[\s,]+$/, '');
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        const span = document.createElement('span');
        // A fixed reference is shielded, not highlighted: no `.hl-kw`, no red.
        span.className = kind === 'fixed' ? 'hl-kw-super sr-fixed' : WRAP_CLASS + ' sr-' + kind;
        span.textContent = hit;
        // A wrapper that is verbatim one form field's value becomes a
        // *protected variable*: LiveSync.js (and edit mode) write what is typed
        // in it back to that field, and DocVars.js re-renders it from the field
        // when the form moves — which is what lets a hand-edited page keep
        // following the left-hand side without being rebuilt.
        //
        // Only text the generator itself put there as a form value — inside
        // its own `hl()` span — is bound. Template prose that merely reads the
        // same is not: "the Statement of Profit or Loss and Other Comprehensive
        // Income" in the review engagement letter matched the index-page label
        // field word for word, so clicking it selected the whole phrase, one
        // keystroke deleted it from the letter and blanked the index line, and
        // an index-label edit rewrote the letter. It is still painted red.
        if (kind === 'value' && node.parentElement.closest('.hl-kw')) {
          const bound = _bindings.get(_clean(hit));
          if (bound) {
            span.dataset.syncField = bound.field;
            span.dataset.varShape = bound.shape;
          }
        }
        frag.appendChild(span);
        last = m.index + hit.length;
        count++;
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(frag, node);
    });
    return count;
  }

  // Remove only the wrappers this module added; the generator's own `.hl-kw`
  // spans are left exactly as they were.
  //
  // Hand-edited pages are skipped, for the same reason _paint() skips them:
  // their HTML is the user's own. Unwrapping there would also throw away the
  // `data-sync-field` / `data-var-shape` stamps those spans are carrying, and
  // those stamps are the only thing keeping an edited page's values wired to
  // the form — strip them and the page silently stops following the left-hand
  // side, which is the failure protected variables exist to remove.
  function clear(root) {
    const scope = root || document.getElementById('document-output');
    if (!scope) return;
    const kept = (el) => el.closest('[data-edited]');
    scope.querySelectorAll('.' + HEADING_CLASS).forEach(el => {
      if (kept(el)) return;
      el.classList.remove(HEADING_CLASS);
      if (!el.getAttribute('class')) el.removeAttribute('class');
    });
    // Innermost first, so a nested wrapper never outlives its parent's unwrap.
    Array.from(scope.querySelectorAll('.hl-kw-super')).reverse().forEach(span => {
      if (kept(span)) return;
      span.replaceWith(document.createTextNode(span.textContent));
    });
    scope.normalize();
  }

  /** Re-paint the preview. Called after every generateDoc() and at startup. */
  function apply(root) {
    const scope = root || document.getElementById('document-output');
    _markForm();
    if (!scope) return;
    clear(scope);

    // Fixed boilerplate references before anything else, so no later pass can
    // take their years and numbers for client values.
    _paint(scope, FIXED_RE, 'fixed', '.hl-kw-super');
    // Blanks next, and *inside* the generator's own spans — that is exactly
    // where "[YEAR END]" lives.
    _paint(scope, MISSING_RE, 'missing', '.hl-kw-super');
    const termRe = _buildTermPattern(_collectTerms());
    // Later passes still look inside the generator's own spans (so a generated
    // date is counted and boxed like any other) but never inside a wrapper this
    // module already added.
    if (termRe) _paint(scope, termRe, 'value', '.hl-kw-super');
    PATTERNS.forEach(p => _paint(scope, p.re, p.kind, '.hl-kw-super'));
    _markHeadings(scope);
  }

  // A block whose entire text is bold is a heading. Blocks holding other blocks
  // (a page, a table cell's address group) are never headings themselves.
  function _markHeadings(scope) {
    const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
    scope.querySelectorAll(HEADING_CANDIDATES).forEach(el => {
      if (el.closest(SKIP_SELECTOR) || el.closest('[data-edited]')) return;
      if (el.querySelector('p, div, table, ul, ol, img')) return;
      const text = norm(el.textContent);
      if (!text || !/[A-Za-z]/.test(text)) return;
      const bold = Array.from(el.querySelectorAll('strong, b'))
        .filter(b => !b.parentElement.closest('strong, b') || !el.contains(b.parentElement.closest('strong, b')))
        .map(b => b.textContent).join(' ');
      if (norm(bold).replace(/\s/g, '') === text.replace(/\s/g, '')) el.classList.add(HEADING_CLASS);
    });
  }

  // ── The form side: make every choice visibly red ──────────────────────────
  function _markForm() {
    const panel = document.querySelector('.form-panel');
    if (!panel) return;
    panel.querySelectorAll('.sr-picked, .sr-filled').forEach(el =>
      el.classList.remove('sr-picked', 'sr-filled'));
    panel.querySelectorAll('input[type="radio"]:checked, input[type="checkbox"]:checked').forEach(inp => {
      if (!_visible(inp) && !inp.closest('label')?.offsetParent) return;
      (inp.closest('label') || inp).classList.add('sr-picked');
    });
    panel.querySelectorAll('select').forEach(sel => {
      if (_visible(sel) && sel.value) sel.classList.add('sr-picked');
    });
    panel.querySelectorAll('.entity-card.selected').forEach(c => c.classList.add('sr-picked'));
    panel.querySelectorAll('input, textarea').forEach(el => {
      const type = (el.type || 'text').toLowerCase();
      if (['radio', 'checkbox', 'file', 'button', 'submit', 'hidden'].includes(type)) return;
      if (_visible(el) && _clean(el.value)) el.classList.add('sr-filled');
    });
  }

  /** Turn the checker on. There is no off — see the header. */
  function start() {
    document.body.classList.add(BODY_CLASS);

    // Ticks change without a regeneration whenever live preview is paused or
    // the preview is hidden, so the form marks follow the form directly.
    const panel = document.querySelector('.form-panel');
    if (!_formListener && panel) {
      _formListener = () => requestAnimationFrame(_markForm);
      panel.addEventListener('change', _formListener);
      panel.addEventListener('click', _formListener);
    }
    apply();
  }

  return { apply, clear, start };
})();
