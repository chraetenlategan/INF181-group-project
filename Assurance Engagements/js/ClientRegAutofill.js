// ClientRegAutofill.js — ClientReg import for the Assurance Engagements app.
//
// Depends on: ../js/ClientRegRegister.js (the register), ../js/utils.js
// (mapSigner, toTitleCase, expandCloseCorporation), config.js (AE_ENTITIES), and the
// AEEntityManager instance in app.js.
//
// WHAT THIS IS
// The main app imports a client through a modal: search, pick, confirm the
// year, press Import. This app has one screen and four steps, and the staff
// using it are producing two letters — a modal in the middle of that is more
// ceremony than the job needs. So the import lives on the Company Name box
// itself: type a name, the matching clients appear above the box like an
// editor's completion list, pick one, and the form fills.
//
// It reads the SAME register as the main app, through the shared
// ClientRegRegister module — the same file, the same source list, the same search
// ranking. A client found in one app is found in the other.
//
// WHAT IT FILLS, AND WHAT IT DELIBERATELY DOES NOT
// Entity type, company name, postal address, financial year end, the INF181
// partner who signs, and the acceptance signatories (the directors, trustees or
// members the register holds). Everything else on this form is either this
// engagement's own (the engagement type, the documents, the date signed) or has
// no counterpart in the register (trading name, loan certificate balances), and
// a blank field the user fills is better than a confident wrong one.
//
// THE YEAR IS A GUESS, AND IT SAYS SO
// Registry keeps a year-end date but its *year* is stale on most records; only
// the month and day are reliable. The main app's modal asks the user to confirm
// the year. There is no modal here, so the most recent year end that has passed
// is filled in and the toast says to check it.

const AEClientReg = (() => {
  const SUGGEST_MAX = 7;

  let lastImport = null; // the record most recently applied, for the toast

  /* ── helpers ──────────────────────────────────────────────────────────── */

  function setField(id, val) {
    const node = document.getElementById(id);
    if (node) node.value = val == null ? '' : val;
  }

  function toast(msg, type, ms) {
    if (typeof AEEditMode !== 'undefined' && AEEditMode.toast) AEEditMode.toast(msg, type, ms);
  }

  /** This app's entity list is shorter than the main app's — see resolveType. */
  function supported(type) { return !!AE_ENTITIES[type]; }

  /* ── applying a record to the form ────────────────────────────────────── */

  /**
   * @param {object} record a raw register record
   * @param {number} [year] the year to build the year end from; defaults to the
   *        most recent year end that has already passed.
   */
  function apply(record, year) {
    const em = typeof entityManager !== 'undefined' ? entityManager : null;
    if (!em) throw new Error('The form is not ready yet.');

    const type = ClientRegRegister.resolveType(record, supported);

    // ── Entity type ── the select and the manager move together: the signatory
    // cards are labelled from the manager's type ("Trustee 1"), so setting one
    // without the other relabels nothing.
    const typeSelect = document.getElementById('entityType');
    if (typeSelect) typeSelect.value = type;
    em.setEntityType(type);

    // ── Name ── a close corporation is stored as "[NAME] CC" and an individual
    // is stored surname-first with a title on the end; both are cleaned up the
    // same way the main app cleans them.
    const rawName = (record.name || {}).display || (record.name || {}).raw || '';
    const name = type === 'individual'
      ? ClientRegRegister.personalName((record.name || {}).raw || rawName)
      : expandCloseCorporation(rawName);
    setField('companyName', name);

    // ── Registration number ── the representation letter prints it under the
    // entity's name. Only written when the register holds one: an empty field
    // omits the line, and blanking a value the user typed would be worse than
    // leaving it.
    const regNo = (record.registration || {}).number || '';
    if (regNo) setField('regNumber', regNo);

    // ── Postal address ── the letters are addressed to it. The register has no
    // reliable business address, and the main app leaves that blank too.
    const addr = record.addresses || {};
    setField('postalAddress', ClientRegRegister.joinAddress(addr.postal));

    // ── Year end ── rebuilt from month/day plus the year (see the header).
    const ye = record.yearEnd || {};
    const useYear = year || ClientRegRegister.defaultYear(ye.month, ye.day);
    const yearEndStr = ClientRegRegister.yearEndText(record, useYear);
    if (yearEndStr) setField('yearEnd', yearEndStr);

    // ── Partner → INF181 signatory ── only if that partner may sign the letter
    // that is on screen: an audit engagement letter takes A Anderson or
    // R Clarke and nobody else, so a partner who is not on the list leaves the
    // dropdown where the user left it rather than silently choosing for them.
    const signer = mapSigner((record.partner || {}).name || '');
    if (signer) {
      ['engSignerAudit', 'engSignerReview'].forEach(id => {
        const sel = document.getElementById(id);
        if (sel && Array.from(sel.options).some(o => o.value === signer)) sel.value = signer;
      });
    }

    // ── Acceptance signatories ── the governing body the register holds.
    // The list is rebuilt from scratch: a leftover row from the previous client
    // would print a stranger's name under "Accepted on behalf of".
    const people = type === 'individual' ? [] : ClientRegRegister.peopleFor(record, type);
    const list = document.getElementById('signatory-list');
    if (list) {
      list.innerHTML = '';
      em.signatoryCount = 0;
      people.forEach(person => {
        em.addSignatory();
        const idx = em.signatoryCount;
        if (ClientRegRegister.isBusiness(person)) {
          // A business trustee or member: the entity itself holds the office,
          // and whoever signs for it has to be typed in. Its name goes in the
          // surname box so it is at least on screen to be corrected.
          const n = person.name || {};
          setField(`sig-sur-${idx}`, toTitleCase(n.full || n.surname || ''));
        } else {
          const parts = ClientRegRegister.nameParts(person);
          setField(`sig-init-${idx}`, parts.initials);
          setField(`sig-sur-${idx}`, parts.surname);
        }
      });
      // Every letter has an acceptance block, so an empty list is never the
      // state to leave the form in.
      if (!em.signatoryCount) em.addSignatory();
      em.relabelSignatories();
    }

    lastImport = { name: name, type: type, people: people.length, yearEnd: yearEndStr, record: record };

    // Nothing above fired an oninput handler — the fields were written straight
    // to .value — so the document is asked for explicitly.
    if (typeof liveUpdate === 'function') liveUpdate();

    announce();
  }

  /** One toast: what came in, and the two things worth checking. */
  function announce() {
    if (!lastImport) return;
    const bits = [];
    if (lastImport.people) {
      bits.push(lastImport.people + ' signator' + (lastImport.people === 1 ? 'y' : 'ies'));
    }
    if (lastImport.yearEnd) bits.push('year end ' + lastImport.yearEnd);

    let msg = 'Imported <strong>' + lastImport.name + '</strong> from ClientReg' +
      (bits.length ? ' — ' + bits.join(', ') + '.' : '.');
    if (lastImport.yearEnd) {
      msg += ' Registry only keeps the month and day of a year end reliably — check the year.';
    }
    msg += ' The register is often out of date; check the details before generating.';
    toast(msg, 'info', 9000);
  }

  /* ── the type-ahead on the Company Name box ───────────────────────────── */

  /**
   * @param {HTMLInputElement} input the Company Name box
   * @param {HTMLElement} listEl the (hidden) container the suggestions render into
   */
  function attachTypeahead(input, listEl) {
    if (!input || !listEl || input.dataset.aeSecinfo) return;
    input.dataset.aeSecinfo = '1';

    let timer = null;
    let items = [];        // the summarised records currently on screen
    let activeIdx = -1;
    let requested = false; // has the register load been kicked off yet?
    let failed = false;
    let seq = 0;           // guards against a slow load answering a stale query

    function hide() {
      listEl.hidden = true;
      listEl.innerHTML = '';
      items = [];
      activeIdx = -1;
      input.setAttribute('aria-expanded', 'false');
    }

    function note(text) {
      listEl.innerHTML = '';
      const div = document.createElement('div');
      div.className = 'start-suggest-note';
      div.textContent = text;
      listEl.appendChild(div);
      listEl.hidden = false;
      items = [];
      activeIdx = -1;
      input.setAttribute('aria-expanded', 'true');
    }

    function setActive(i) {
      const rows = listEl.querySelectorAll('.start-suggest-item');
      rows.forEach(r => r.classList.remove('active'));
      activeIdx = i;
      if (i >= 0 && rows[i]) {
        rows[i].classList.add('active');
        rows[i].scrollIntoView({ block: 'nearest' });
      }
    }

    function render(q) {
      const found = ClientRegRegister.search(q);
      if (!found.results.length) { hide(); return; }

      items = found.results.slice(0, SUGGEST_MAX);
      activeIdx = -1;
      listEl.innerHTML = '';

      items.forEach((r, i) => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'start-suggest-item';
        row.setAttribute('role', 'option');

        const meta = [];
        if (r.entityDesc || r.entityType) meta.push(r.entityDesc || r.entityType);
        if (r.clientCode) meta.push(r.clientCode);
        if (r.regNumber) meta.push(r.regNumber);
        if (r.yearEndMonth) {
          meta.push('year end ' + (r.yearEndDay || '') + ' ' +
            ClientRegRegister.MONTHS[r.yearEndMonth - 1]);
        }

        const name = document.createElement('span');
        name.className = 'start-suggest-name';
        name.textContent = r.name || r.clientCode || '(no name)';
        const sub = document.createElement('span');
        sub.className = 'start-suggest-meta';
        sub.textContent = meta.join(' · ');
        row.appendChild(name);
        row.appendChild(sub);

        // mousedown, not click: the input's blur would otherwise tear the list
        // down before the click landed.
        row.addEventListener('mousedown', (e) => {
          e.preventDefault();
          choose(i);
        });
        row.addEventListener('mouseenter', () => setActive(i));
        listEl.appendChild(row);
      });

      if (found.total > items.length) {
        const more = document.createElement('div');
        more.className = 'start-suggest-note';
        more.textContent = (found.total - items.length) + ' more — keep typing to narrow it down.';
        listEl.appendChild(more);
      }

      listEl.hidden = false;
      input.setAttribute('aria-expanded', 'true');
    }

    function choose(i) {
      const r = items[i];
      if (!r) return;
      hide();
      input.blur();
      try {
        apply(r.record);
      } catch (err) {
        console.error('ClientReg import error:', err);
        toast('Import failed: ' + (err.message || err), 'error');
      }
    }

    function warm() {
      if (ClientRegRegister.isLoaded() || requested || failed) return;
      requested = true;
      return ClientRegRegister.load().catch(() => { failed = true; requested = false; });
    }

    function update() {
      const q = input.value.trim();
      const mine = ++seq;

      // No register on this machine — the box is still an ordinary text field,
      // and typing a name by hand has always been the way. Don't nag.
      if (q.length < 2 || failed) { hide(); return; }
      if (ClientRegRegister.isLoaded()) { render(q); return; }

      const pending = warm();
      if (pending) {
        pending.then(() => {
          const still = input.value.trim();
          if (mine === seq && ClientRegRegister.isLoaded() && still.length >= 2) render(still);
          else if (mine === seq) hide();
        });
        note('Loading the ClientReg register…');
      }
    }

    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(update, 120);
    });

    // Warm the register up on focus so the first keystroke already has it.
    input.addEventListener('focus', () => {
      warm();
      if (input.value.trim().length >= 2) update();
    });

    input.addEventListener('keydown', (e) => {
      const isOpen = !listEl.hidden && items.length > 0;
      if (e.key === 'ArrowDown' && isOpen) {
        e.preventDefault();
        setActive(activeIdx + 1 >= items.length ? 0 : activeIdx + 1);
      } else if (e.key === 'ArrowUp' && isOpen) {
        e.preventDefault();
        setActive(activeIdx - 1 < 0 ? items.length - 1 : activeIdx - 1);
      } else if (e.key === 'Enter' && isOpen && activeIdx >= 0) {
        // Only an explicitly highlighted row imports. Enter on a typed name
        // that happens to match must not replace what the user wrote.
        e.preventDefault();
        choose(activeIdx);
      } else if (e.key === 'Escape') {
        if (!listEl.hidden) { e.stopPropagation(); hide(); }
      }
    });

    input.addEventListener('blur', () => setTimeout(hide, 120));
  }

  /** Wire the Company Name box up. Called once, at startup. */
  function init() {
    attachTypeahead(
      document.getElementById('companyName'),
      document.getElementById('ae-clientreg-suggest')
    );
  }

  return { init, attachTypeahead, _apply: apply };
})();
