/* Placeholders.js — click-to-edit for a value that has not been typed yet
   ---------------------------------------------------------------------------
   Click-to-edit (`../js/LiveSync.js`) works off the stamps `SuperRed.js` puts
   on the page, and SuperRed can only stamp a value it can *find*: it matches
   what the form holds against what the page shows. So an empty field has
   nothing on the page to click — the letter shows `[COMPANY NAME]`, which is
   the generator's placeholder and not a form value at all.

   That is the case the user meets first: a blank form, a letter full of
   placeholders, and no way to fill one in from the page. This module closes it.
   After every generation it finds the generator's placeholders and stamps them
   with the same `data-sync-field` / `data-var-shape` pair SuperRed uses, so they
   become protected variables like any other: click one, type, and the form field
   on the left fills as you go. On commit the document regenerates and the
   placeholder is replaced by the real value, stamped by SuperRed this time.

   Nothing shared changes. LiveSync and DocVars only ever ask for
   `data-sync-field`, and they do not care who wrote it — which is why this
   lives here, in the app that asked for it, rather than in the shared module.

   Which placeholders are wired, and which deliberately are not
   -----------------------------------------------------------
   A placeholder is only wired where what the user types is what the field
   holds. The two rules the shared modules already live by apply unchanged:

   - `[SIGNER]` is a `<select>` of the firm's partners. There is no text to
     type into it, and a name typed onto the letter that is not one of the
     options would be silently dropped. Pick the partner on the form.
   - `[DATE]` and `[DATE SIGNED]` are *derived*: the engagement letter is dated
     `AE_ENGAGEMENT_LEAD_DAYS` before the signature date, so what the page shows
     is never what the field holds. Writing the typed date back to `dateSigned`
     would print a date two weeks off what was typed. A value that does not
     round-trip is not a protected variable — same limit as a name collapsed to
     initials in the main app.

   Depends on: DocVars.js / LiveSync.js (the machinery), app.js (calls `stamp()`
   inside `generateDoc()`, right after `SuperRed.apply()` and before pagination).
*/

const AEPlaceholders = (() => {
  // The loan certificate pages carry the form index of the certificate they
  // were built from (`data-lc-idx`), because a removed card leaves a gap: the
  // third certificate page is not necessarily `lc-name-3`.
  function _lcField(node, prefix) {
    const page = node.parentElement?.closest?.('[data-lc-idx]');
    const idx = page?.getAttribute('data-lc-idx');
    return idx ? `${prefix}-${idx}` : null;
  }

  // token -> the field it stands for, and the shape the page shows it in
  // (DocVars.render()'s names — `raw` is verbatim).
  const TOKENS = {
    '[COMPANY NAME]':      { field: () => 'companyName',   shape: 'raw' },
    '[POSTAL ADDRESS]':    { field: () => 'postalAddress', shape: 'raw' },
    '[YEAR END]':          { field: () => 'yearEnd',       shape: 'raw' },
    '[BORROWER / LENDER]': { field: (n) => _lcField(n, 'lc-name'),   shape: 'raw' },
    '[AMOUNT]':            { field: (n) => _lcField(n, 'lc-amount'), shape: 'number' },
  };

  const _RE = new RegExp(
    Object.keys(TOKENS).map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
    'g'
  );

  /** Stamp every placeholder in `root` that stands for one form field. */
  function stamp(root) {
    const scope = root || document.getElementById('document-output');
    if (!scope) return 0;

    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || node.nodeValue.indexOf('[') === -1) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        // Already a protected variable, or inside one.
        if (parent.closest('[data-sync-field]')) return NodeFilter.FILTER_REJECT;
        // A hand-edited page's markup is the user's own — the same pages
        // SuperRed and PagePaginator leave alone.
        if (parent.closest('[data-edited], [data-pinned]')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    const targets = [];
    let node;
    while ((node = walker.nextNode())) targets.push(node);

    let count = 0;
    targets.forEach(text => {
      const value = text.nodeValue;
      _RE.lastIndex = 0;
      if (!_RE.test(value)) return;
      _RE.lastIndex = 0;

      // The common case: the generator already wrapped the placeholder in its
      // own `.hl-kw` span and there is nothing else in it. Stamp that span
      // rather than nesting a second one inside it — two full-bleed red fills
      // on the same words read as a different colour.
      const parent = text.parentElement;
      const whole = value.trim();
      if (TOKENS[whole] && parent.childNodes.length === 1 && parent.classList.contains('hl-kw')) {
        const field = TOKENS[whole].field(text);
        if (field && document.getElementById(field)) {
          parent.dataset.syncField = field;
          parent.dataset.varShape = TOKENS[whole].shape;
          parent.classList.add('ae-placeholder');
          count++;
        }
        return;
      }

      const frag = document.createDocumentFragment();
      let made = 0, last = 0, m;
      while ((m = _RE.exec(value)) !== null) {
        const spec = TOKENS[m[0]];
        const field = spec && spec.field(text);
        // No field to write to (a loan certificate page with no index on it):
        // leave the placeholder as the plain text it has always been.
        if (!field || !document.getElementById(field)) continue;
        if (m.index > last) frag.appendChild(document.createTextNode(value.slice(last, m.index)));
        const span = document.createElement('span');
        // The same classes SuperRed gives a value wrapper, so a placeholder
        // looks and behaves like one rather than like a look-alike.
        span.className = 'hl-kw hl-kw-super sr-value ae-placeholder';
        span.textContent = m[0];
        span.dataset.syncField = field;
        span.dataset.varShape = spec.shape;
        frag.appendChild(span);
        last = m.index + m[0].length;
        made++;
      }
      // Nothing in this text node turned out to be wirable: leave it exactly as
      // it is rather than rebuilding it into an identical set of nodes.
      if (!made) return;
      if (last < value.length) frag.appendChild(document.createTextNode(value.slice(last)));
      text.parentNode.replaceChild(frag, text);
      count += made;
    });
    return count;
  }

  return { stamp };
})();
