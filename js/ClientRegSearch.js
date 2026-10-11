// ClientRegSearch.js — search the Registry ClientReg register and prefill the form
// from a chosen client, without an .xlsx file.
//
// Depends on: config.js (IMPORTER_CONFIGS), utils.js (mapSigner, parseName,
// calcPrevYearEnd, toTitleCase, isRegNumber, formatIdString), EntityManager instance.
//
// The ClientReg button opens this dialog. It offers the two paths side by side:
// search the register, or the .xlsx import that has always existed. With no
// register present the dialog says so and the .xlsx path still works.
//
// WHERE THE REGISTER COMES FROM
// ClientRegRegister.js — the register file, the source list it is loaded from,
// the search index and the readers for a record's shape all live there, shared
// with the Assurance Engagements app so both read the same register from the
// same place. This file is only the dialog and what it puts on the main app's
// form; the thin wrappers below keep the names it always used.
//
// WHY THE YEAR IS ASKED FOR
// Registry stores a year-end *date*, but the stored year is stale on most
// records; only the month and day are reliable (measured during the export
// work). So the dialog rebuilds the year end from month + day and a year the
// user confirms, defaulting to the most recent year end that has passed.

const ClientRegSearch = (() => {
  const MONTHS = ClientRegRegister.MONTHS;

  let el = null;          // { overlay, modal, input, status, list, detail, ... }
  let debounceTimer = null;
  let current = null;     // the summary currently shown in the detail pane
  let mode = 'entity';    // 'entity' → ClientReg register, 'individual' → CRA01 register
  let availSeq = 0;       // guards refreshAvailability against a mode switch mid-load

  /* ── the register ─────────────────────────────────────────────────────────
     Thin wrappers over ClientRegRegister, so everything below reads the way it
     did when this file owned the loading and the searching itself. */

  function loadRegister() { return ClientRegRegister.load(); }
  function isLoaded()     { return ClientRegRegister.isLoaded(); }
  function search(query)  { return ClientRegRegister.search(query); }
  function summarise(rec) { return ClientRegRegister.summarise(rec); }

  /* The dialog's own register, which follows the Entity / Individual switch.
     The wrappers above stay on ClientReg: the start panel's type-ahead uses them
     and has no switch. Individuals come from the CRA01 register because the
     ClientReg export only holds clients with a secretarial register, and almost
     no individual has one (see Cra01Register.js). */
  function dialogRegister() {
    return mode === 'individual' && typeof Cra01Register !== 'undefined'
      ? Cra01Register : ClientRegRegister;
  }

  const PLACEHOLDER = {
    entity: 'Search by company name, client code or registration number…',
    individual: 'Search by name, client code, ID number or tax number…'
  };

  /* ── DOM ──────────────────────────────────────────────────────────────── */

  function build() {
    if (el) return el;

    const overlay = document.createElement('div');
    overlay.className = 'clientreg-overlay';
    overlay.id = 'clientreg-overlay';
    overlay.addEventListener('click', close);

    const modal = document.createElement('div');
    modal.className = 'clientreg-modal';
    modal.id = 'clientreg-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Import from ClientReg');
    modal.innerHTML = `
      <div class="clientreg-header">
        <div class="clientreg-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/>
          </svg>
          Import from ClientReg
        </div>
        <button class="clientreg-close" type="button" title="Close">&times;</button>
      </div>

      <div class="clientreg-mode" role="tablist" aria-label="What to import">
        <button type="button" class="clientreg-mode-btn active" data-mode="entity" role="tab">Entity</button>
        <button type="button" class="clientreg-mode-btn" data-mode="individual" role="tab">Individual</button>
      </div>

      <div class="clientreg-search-row">
        <input type="text" class="clientreg-input" id="clientreg-input" autocomplete="off" spellcheck="false"
               placeholder="${PLACEHOLDER.entity}">
      </div>

      <div class="clientreg-status" id="clientreg-status"></div>
      <div class="clientreg-list" id="clientreg-list"></div>
      <div class="clientreg-detail" id="clientreg-detail"></div>

      <div class="clientreg-footer">
        <div class="clientreg-source" id="clientreg-source"></div>
        <button class="clientreg-btn clientreg-btn-file" type="button" id="clientreg-file-btn">
          Import a ClientReg .xlsx file instead
        </button>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(modal);

    el = {
      overlay: overlay,
      modal: modal,
      input: modal.querySelector('#clientreg-input'),
      status: modal.querySelector('#clientreg-status'),
      list: modal.querySelector('#clientreg-list'),
      detail: modal.querySelector('#clientreg-detail'),
      source: modal.querySelector('#clientreg-source')
    };

    modal.querySelector('.clientreg-close').addEventListener('click', close);
    modal.querySelectorAll('.clientreg-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => setMode(btn.dataset.mode, el.input.value.trim()));
    });
    modal.querySelector('#clientreg-file-btn').addEventListener('click', () => {
      close();
      const input = document.getElementById('xlsx-import');
      if (input) input.click();
    });

    el.input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(runSearch, 180);
    });
    el.input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('visible')) close();
    });

    return el;
  }

  /**
   * @param {string} [prefill] a query to search for as soon as the register is
   *        in memory — the start panel on the empty preview side passes what
   *        the user typed there, so they do not type the name twice.
   */
  function open(prefill) {
    build();
    el.overlay.classList.add('visible');
    el.modal.classList.add('visible');
    setMode('entity', typeof prefill === 'string' ? prefill.trim() : '');
  }

  /**
   * Switch between the ClientReg register (entities) and the CRA01 register
   * (individuals), keeping whatever was typed and re-running it.
   */
  function setMode(next, query) {
    mode = next === 'individual' ? 'individual' : 'entity';
    el.modal.querySelectorAll('.clientreg-mode-btn').forEach(btn => {
      const on = btn.dataset.mode === mode;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    el.input.placeholder = PLACEHOLDER[mode];
    closeDetail();
    el.list.innerHTML = '';
    el.input.value = '';
    // Kept disabled until the register is in memory — a search against a
    // half-loaded index would just say "no matches" and look like a wrong answer.
    el.input.disabled = true;
    setStatus(dialogRegister().isLoaded()
      ? 'Type at least two characters to search.'
      : (mode === 'individual' ? 'Loading the individuals register…' : 'Loading the ClientReg register…'));
    refreshAvailability(query || '');
  }

  /**
   * Jump straight to one record's confirm panel, skipping the result list —
   * the start panel's type-ahead has already made the choice for the user.
   * @param {object} r a summarise() result
   */
  function openWith(r) {
    build();
    el.overlay.classList.add('visible');
    el.modal.classList.add('visible');
    el.list.innerHTML = '';
    // The type-ahead only searches ClientReg, so "Back to results" belongs there.
    mode = 'entity';
    el.input.placeholder = PLACEHOLDER.entity;
    el.modal.querySelectorAll('.clientreg-mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === 'entity');
      btn.setAttribute('aria-selected', btn.dataset.mode === 'entity' ? 'true' : 'false');
    });
    el.input.disabled = false;
    el.input.value = r.name || r.clientCode || '';
    setStatus('');
    // Purely the footer's "N clients / exported ..." line; the record itself is
    // already in hand, so nothing here gates the detail below.
    loadRegister().then(reg => {
      el.source.textContent = (reg.recordCount || (reg.records || []).length) + ' clients' +
        (reg.generatedAt ? ' \u00b7 exported ' + String(reg.generatedAt).slice(0, 10) : '');
    }).catch(() => {});
    showDetail(r);
  }

  function close() {
    if (!el) return;
    el.overlay.classList.remove('visible');
    el.modal.classList.remove('visible');
  }

  function setStatus(text, tone) {
    el.status.textContent = text || '';
    el.status.style.color = tone === 'error' ? '#c0392b' : 'var(--ink-light)';
  }

  async function refreshAvailability(prefill) {
    el.source.textContent = '';
    const mine = ++availSeq;
    const individual = mode === 'individual';
    try {
      const reg = await dialogRegister().load();
      if (mine !== availSeq) return; // the user switched mode while this loaded
      el.source.textContent = (reg.recordCount || (reg.records || []).length) +
        (individual ? ' individuals' : ' clients') +
        (reg.generatedAt ? ' · exported ' + String(reg.generatedAt).slice(0, 10) : '');
      el.input.disabled = false;
      setStatus('Type at least two characters to search.');
      if (prefill) {
        el.input.value = prefill;
        runSearch();
      }
      el.input.focus();
    } catch (err) {
      if (mine !== availSeq) return;
      el.input.disabled = true;
      if (individual) {
        setStatus(err.message === 'NOT_INSTALLED'
          ? 'The individuals register (cra01-data.js) could not be found in the server\'s Data folder.'
          : 'Individual search unavailable: ' + (err.message || err), 'error');
      } else {
        setStatus(err.message === 'NOT_INSTALLED'
          ? 'The ClientReg register has not been copied to this machine. Use the .xlsx import below.'
          : 'ClientReg search unavailable: ' + (err.message || err), 'error');
      }
    }
  }

  /**
   * Leave the detail pane and put the result list back.
   *
   * The detail pane takes the modal over while it is open (see `showDetail`),
   * so hiding it is never just a `display: none` on one element.
   */
  function closeDetail() {
    el.detail.style.display = 'none';
    el.detail.innerHTML = '';
    el.modal.classList.remove('detail-open');
    current = null;
  }

  function runSearch() {
    const q = el.input.value.trim();
    closeDetail();

    if (q.length < 2) {
      el.list.innerHTML = '';
      setStatus('Type at least two characters to search.');
      return;
    }

    const { total, results } = dialogRegister().search(q);

    if (!results.length) {
      el.list.innerHTML = '';
      setStatus((mode === 'individual' ? 'No individual matches “' : 'No client matches “') + q + '”.');
      return;
    }

    setStatus(total > results.length
      ? 'Showing ' + results.length + ' of ' + total + ' matches — keep typing to narrow it down.'
      : results.length + (results.length === 1 ? ' match' : ' matches'));

    el.list.innerHTML = '';
    results.forEach(r => el.list.appendChild(resultRow(r)));
  }

  function resultRow(r) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'clientreg-result';

    const meta = [];
    if (r.entityDesc || r.entityType) meta.push(r.entityDesc || r.entityType);
    if (r.regNumber) meta.push(r.regNumber);
    if (r.yearEndMonth) meta.push('year end ' + (r.yearEndDay || '') + ' ' + MONTHS[r.yearEndMonth - 1]);
    if (r.people) meta.push(r.people + ' role player(s)');

    row.innerHTML = `
      <span class="clientreg-result-name"></span>
      <span class="clientreg-result-meta"></span>
    `;
    row.querySelector('.clientreg-result-name').textContent = r.name || r.clientCode || '(no name)';
    row.querySelector('.clientreg-result-meta').textContent = meta.join(' · ');

    row.addEventListener('click', () => showDetail(r));
    return row;
  }

  /* ── detail / confirm ─────────────────────────────────────────────────── */

  /** Most recent year end that has already passed, for month/day. */
  function defaultYear(month, day) { return ClientRegRegister.defaultYear(month, day); }

  /** Years since a date string, or null when unknown. */
  function yearsSince(dateStr) {
    if (!dateStr) return null;
    const t = Date.parse(dateStr);
    if (isNaN(t)) return null;
    return (Date.now() - t) / (365.25 * 24 * 3600 * 1000);
  }

  /**
   * The shareholders an import would create, in register order.
   *
   * Registry keeps every shareholder it has ever recorded, so a long-standing
   * client can carry people who sold out years ago. The detail pane lists them
   * with a tick box each so the user drops the ones that no longer hold shares;
   * `index` is the position in `record.shareholders`, which is what `apply`
   * filters on.
   */
  function shareholderChoices(record) {
    const type = resolveType(record);
    const cfg = IMPORTER_CONFIGS[type];
    if (!cfg || !cfg.importShareholders) return [];

    const out = [];
    const seen = new Set();
    (record.shareholders || []).forEach((sh, i) => {
      const n = sh.name || {};
      const full = n.full || [n.first, n.surname].filter(Boolean).join(' ');
      if (!full) return;
      const key = shareholderKey(full);
      if (seen.has(key)) return; // one row per holder, not per share transaction
      seen.add(key);
      out.push({ index: i, name: toTitleCase(full) });
    });
    return out;
  }

  /** Paint the shareholder tick list into the detail pane. */
  function renderShareholderPicker(choices) {
    const listEl = el.detail.querySelector('#clientreg-sh-list');
    if (!listEl) return;

    choices.forEach(c => {
      const row = document.createElement('label');
      row.className = 'clientreg-sh-row';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'clientreg-sh-check';
      cb.checked = true;
      cb.value = String(c.index);

      const name = document.createElement('span');
      name.className = 'clientreg-sh-name';
      name.textContent = c.name;

      row.appendChild(cb);
      row.appendChild(name);
      listEl.appendChild(row);
    });

    const toggle = el.detail.querySelector('#clientreg-sh-toggle');
    if (toggle) {
      toggle.addEventListener('click', () => {
        const boxes = listEl.querySelectorAll('.clientreg-sh-check');
        const next = toggle.dataset.state !== 'none';
        boxes.forEach(b => { b.checked = !next; });
        toggle.dataset.state = next ? 'none' : 'all';
        toggle.textContent = next ? 'Select all' : 'Clear all';
      });
    }
  }

  /** Indices the user left ticked, or null when there is nothing to pick from. */
  function selectedShareholders() {
    const listEl = el.detail.querySelector('#clientreg-sh-list');
    if (!listEl) return null;
    const picked = [];
    listEl.querySelectorAll('.clientreg-sh-check').forEach(b => {
      if (b.checked) picked.push(parseInt(b.value, 10));
    });
    return picked;
  }

  function showDetail(r) {
    current = r;
    const year = defaultYear(r.yearEndMonth, r.yearEndDay);
    const age = yearsSince(r.registerUpdated);

    const isIndividual = r.entityType === 'individual';
    const rec = r.record || {};
    const fromCra01 = (rec.source || {}).register === 'cra01';

    const stale = age !== null && age >= 1
      ? `<div class="clientreg-warn">This client's ${fromCra01 ? 'Registry record' : 'secretarial register'} was last updated on
         ${r.registerUpdated}. Check the ${isIndividual ? 'ID number and addresses' : 'directors, shareholders and addresses'} after importing.</div>`
      : '';

    const noYearEnd = !r.yearEndMonth
      ? `<div class="clientreg-warn">No year end is recorded for this client — you will need to type it in.</div>`
      : '';

    // Registry files a person under their surname, and the register has no
    // separate first-name field for a client, so the imported name keeps the
    // order it was stored in. On an individual's statements the name is the
    // heading of every page, so it is worth a look before generating.
    // The CRA01 register keeps first names and surname apart, so a name from
    // there is already in reading order and needs no warning.
    const nameOrder = isIndividual && !(rec.name || {}).ordered
      ? `<div class="clientreg-warn">Registry stores an individual surname first. Check the full
         name reads the way it should appear on the statements after importing.</div>`
      : '';

    const shChoices = shareholderChoices(r.record);
    const shBlock = shChoices.length
      ? `<div class="clientreg-sh">
           <div class="clientreg-sh-head">
             <span class="clientreg-sh-title">Shareholders to import (${shChoices.length})</span>
             <button type="button" class="clientreg-sh-toggle" id="clientreg-sh-toggle" data-state="all">Clear all</button>
           </div>
           <div class="clientreg-sh-note">Please verify these shareholders are still valid.</div>
           <div class="clientreg-sh-list" id="clientreg-sh-list"></div>
         </div>`
      : '';

    el.detail.innerHTML = `
      <div class="clientreg-detail-name"></div>
      <div class="clientreg-detail-meta"></div>
      ${stale}
      ${noYearEnd}
      ${nameOrder}
      <div class="clientreg-year-row" ${r.yearEndMonth ? '' : 'style="display:none"'}>
        <label for="clientreg-year">Financial year end</label>
        <span class="clientreg-year-fixed">${r.yearEndDay || ''} ${r.yearEndMonth ? MONTHS[r.yearEndMonth - 1] : ''}</span>
        <input type="number" id="clientreg-year" class="clientreg-year-input" value="${year}" min="1900" max="2999" step="1">
        <span class="clientreg-year-hint">Registry only keeps the month and day reliably — confirm the year.</span>
      </div>
      ${shBlock}
      <div class="clientreg-detail-status" id="clientreg-detail-status"></div>
      <div class="clientreg-detail-actions">
        <button class="clientreg-btn clientreg-btn-ghost" type="button" id="clientreg-back">Back to results</button>
        <button class="clientreg-btn clientreg-btn-primary" type="button" id="clientreg-import">Import this client</button>
      </div>
    `;

    el.detail.querySelector('.clientreg-detail-name').textContent = r.name || r.clientCode;
    const meta = [];
    if (r.entityDesc || r.entityType) meta.push(r.entityDesc || r.entityType);
    if (r.regNumber) meta.push(r.regNumber);
    if (r.former) meta.push('formerly ' + r.former);
    el.detail.querySelector('.clientreg-detail-meta').textContent = meta.join(' · ');

    el.detail.querySelector('#clientreg-back').addEventListener('click', closeDetail);
    el.detail.querySelector('#clientreg-import').addEventListener('click', doImport);
    renderShareholderPicker(shChoices);

    // The detail pane takes over the modal body rather than sitting in a short
    // scroller underneath the results: the list a user has already chosen from
    // is not worth the space, and it used to push "Import this client" below
    // the fold on any client with warnings or a long shareholder list.
    el.detail.style.display = 'block';
    el.modal.classList.add('detail-open');
    el.detail.scrollTop = 0;
  }

  function doImport() {
    if (!current) return;
    const statusEl = el.detail.querySelector('#clientreg-detail-status');
    const yearInput = el.detail.querySelector('#clientreg-year');
    const year = yearInput ? parseInt(yearInput.value, 10) : null;

    try {
      apply(current.record, year, selectedShareholders());
    } catch (err) {
      statusEl.style.color = '#c0392b';
      statusEl.textContent = 'Import failed: ' + (err.message || err);
      console.error('ClientReg import error:', err);
      return;
    }
    close();
  }

  /* ── applying a record to the form ────────────────────────────────────── */

  function setField(id, val) {
    const node = document.getElementById(id);
    if (node && val) node.value = val;
  }

  /** The app's entity type for a record, falling back to a name-based guess. */
  function resolveType(record) {
    return ClientRegRegister.resolveType(record, t => !!IMPORTER_CONFIGS[t]);
  }

  /** An individual's name as it should read on a document. */
  function personalName(raw) { return ClientRegRegister.personalName(raw); }

  /** Which list of role players the form's "directors" section shows. */
  function peopleFor(record, type) { return ClientRegRegister.peopleFor(record, type); }

  /** Address lines → the single-line, comma-separated form the app stores. */
  function joinAddress(lines) { return ClientRegRegister.joinAddress(lines); }

  /** Initials + surname for a role player, however the export named them. */
  function nameParts(person) { return ClientRegRegister.nameParts(person); }

  /** A role player that is a business, not a natural person. */
  function isBusiness(person) { return ClientRegRegister.isBusiness(person); }

  /**
   * @param {Array<number>|null} shPick indices of `record.shareholders` to
   *        import. `null`/undefined imports them all, so callers that predate
   *        the picker keep working.
   */
  function apply(record, year, shPick) {
    const type = resolveType(record);
    const cfg = IMPORTER_CONFIGS[type];
    if (!cfg) throw new Error('Unknown entity type: ' + type);

    // app.js declares these with top-level `const`, so they live in the global
    // declarative scope rather than on `window` — reference them by name.
    const em = typeof entityManager !== 'undefined' ? entityManager : null;
    if (!em) throw new Error('The form is not ready yet.');

    // ── Name ──
    const rawName = (record.name || {}).display || (record.name || {}).raw || '';
    // An individual from the CRA01 register is already "First Names Surname".
    const name = type === 'individual'
      ? ((record.name || {}).ordered ? rawName : personalName((record.name || {}).raw || rawName))
      : expandCloseCorporation(rawName);
    setField('companyName', name);

    // ── Registration number ── an individual's is an ID number, and the field it
    // lands in is the same one, so it gets the same spacing as a typed ID.
    let regNo = (record.registration || {}).number || '';
    if (type === 'individual') regNo = formatIdString(regNo);
    if (!cfg.regOptional || regNo) setField('regNumber', regNo);

    // ── Year end ── rebuilt from month/day plus the confirmed year (see header).
    const ye = record.yearEnd || {};
    if (ye.month && year) {
      const yearEndStr = (ye.day || 1) + ' ' + MONTHS[ye.month - 1] + ' ' + year;
      setField('yearEnd', yearEndStr);
      const prev = calcPrevYearEnd(yearEndStr);
      if (prev) setField('prevYearEnd', prev);
    }

    // Nature of business is never imported — the register's "main object" is not
    // what the accountants want on the statement; the user types it in.

    // ── Addresses ── business address is deliberately left blank, exactly as the
    // .xlsx path does: the export has no reliable source for it.
    const addr = record.addresses || {};
    setField('postalAddress', joinAddress(addr.postal));
    setField('regAddress', joinAddress(addr.registered));
    setField('physAddress', '');
    setField('businessAddress', '');

    // ── Partner → INF181 signatory ──
    const signer = mapSigner((record.partner || {}).name || '');
    if (signer) {
      const node = document.getElementById('compilerSigner');
      if (node) node.value = signer;
    }

    // ── Entity type ──
    const ecCard = document.getElementById(cfg.ecId);
    if (ecCard) em.selectEntity(ecCard, type);

    // ── Directors / trustees / members ──
    document.getElementById('directors-list').innerHTML = '';
    em.directors = [];
    em.directorCount = 0;

    const withoutRep = [];
    // An individual has no governing body — the list above is still cleared, so
    // role players from a previous import cannot linger, but there is nothing to
    // put in it and the form hides the section entirely.
    const people = cfg.noPeople ? [] : peopleFor(record, type);

    people.forEach(person => {
      const parts = nameParts(person);
      const business = isBusiness(person);

      em.addDirector();
      const idx = em.directorCount;

      if (type === 'trust' && business) {
        // A business independent trustee — the entity itself is the trustee, and
        // whoever represents it has to be typed in by the user.
        const cb = document.getElementById(`dir-ind-${idx}`);
        if (cb) { cb.checked = true; em.toggleIndependentTrustee(idx); }
        setField(`dir-ind-biz-${idx}`, (person.name || {}).full || parts.surname);
        setField(`dir-ind-reg-${idx}`, person.idNumber || '');
        withoutRep.push(idx);
      } else {
        setField(`dir-init-${idx}`, parts.initials);
        setField(`dir-sur-${idx}`, parts.surname);
        setField(`dir-id-${idx}`, formatIdString(person.idNumber || person.passportNum || ''));
      }
    });

    // ── Shareholders (company only) ──
    if (cfg.importShareholders) {
      document.getElementById('shareholder-list').innerHTML = '';
      em.shareholderCount = 0;

      const shWanted = Array.isArray(shPick) ? shPick : null;
      const shSeen = new Set();

      (record.shareholders || []).forEach((sh, i) => {
        if (shWanted && shWanted.indexOf(i) === -1) return;
        const shName = (sh.name || {}).full || [(sh.name || {}).first, (sh.name || {}).surname].filter(Boolean).join(' ');
        if (!shName) return;
        const key = shareholderKey(shName);
        if (shSeen.has(key)) return; // register repeats a holder per share transaction
        shSeen.add(key);
        em.addShareholder();
        const idx = em.shareholderCount;
        setField(`sh-name-${idx}`, toTitleCase(shName));
        if (sh.isEntity || /\bPTY\b|\bLTD\b|\bCC\b|\bTRUST\b|\bINC\b/i.test(shName)) {
          const radio = document.querySelector(`input[name="sh-type-${idx}"][value="entity"]`);
          if (radio) { radio.checked = true; em.onShareholderTypeChange(idx); }
        }
      });
    }

    // Every field above was written straight to .value, so no oninput handler
    // fired. Push the imported address/dates into the fields still on auto.
    if (typeof syncAutoMeetingVenues === 'function') syncAutoMeetingVenues();
    if (typeof syncAutoSigningDates === 'function') syncAutoSigningDates();
    if (typeof syncAutoMeetingDates === 'function') syncAutoMeetingDates();
    if (typeof syncAutoLoanCertDates === 'function') syncAutoLoanCertDates();

    // Same caution the .xlsx path shows: the register is often out of date, and
    // a business trustee's representative is never in the export.
    if (type === 'trust' && typeof excelImporter !== 'undefined' && typeof excelImporter._showTrustWarning === 'function') {
      excelImporter._showTrustWarning();
      if (withoutRep.length && typeof excelImporter._highlightTrusteeInputs === 'function') {
        excelImporter._highlightTrusteeInputs(withoutRep);
      }
    }

    // An import fills the whole form in one go. Nothing on screen yet means
    // liveUpdate() would return without doing anything, so ask for the document
    // itself — the user expects the statement to appear when the import lands.
    if (typeof ensureDocumentGenerated === 'function') ensureDocumentGenerated();
    else em.liveUpdate();
  }


  /* -- start-panel type-ahead ---------------------------------------------
     The start panel's search box used to be a plain text field: type a name,
     press the button, then pick from the modal. The register is already in
     memory once loaded, so the matches can be offered while the user is still
     typing. The button stays -- it opens the full modal, which is still the way
     to see more than the few suggestions that fit under the box. */

  const SUGGEST_MAX = 7;

  /**
   * @param {HTMLInputElement} input the box the user types in
   * @param {HTMLElement} listEl the (hidden) container the suggestions render into
   */
  function attachTypeahead(input, listEl) {
    if (!input || !listEl || input.dataset.clientregTypeahead) return;
    input.dataset.clientregTypeahead = '1';

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
      const found = search(q);
      if (!found.results.length) {
        note('No client matches \u201c' + q + '\u201d.');
        return;
      }

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
        if (r.yearEndMonth) meta.push('year end ' + (r.yearEndDay || '') + ' ' + MONTHS[r.yearEndMonth - 1]);

        const name = document.createElement('span');
        name.className = 'start-suggest-name';
        name.textContent = r.name || r.clientCode || '(no name)';
        const sub = document.createElement('span');
        sub.className = 'start-suggest-meta';
        sub.textContent = meta.join(' \u00b7 ');
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
        more.textContent = (found.total - items.length) +
          ' more \u2014 keep typing, or press Search ClientReg.';
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
      openWith(r);
    }

    function warm() {
      if (isLoaded() || requested || failed) return;
      requested = true;
      return loadRegister().catch(() => { failed = true; requested = false; });
    }

    function update() {
      const q = input.value.trim();
      const mine = ++seq;

      // No register on this machine -- the modal explains why; don't nag here.
      if (q.length < 2 || failed) { hide(); return; }
      if (isLoaded()) { render(q); return; }

      const pending = warm();
      if (pending) {
        pending.then(() => {
          if (mine === seq && isLoaded() && input.value.trim().length >= 2) render(input.value.trim());
          else if (mine === seq && !isLoaded()) hide();
        });
      }
      note('Loading the ClientReg register\u2026');
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
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (isOpen && activeIdx >= 0) choose(activeIdx);
        else { hide(); open(input.value.trim()); } // fall back to the full modal
      } else if (e.key === 'Escape') {
        if (!listEl.hidden) { e.stopPropagation(); hide(); }
      }
    });

    input.addEventListener('blur', () => setTimeout(hide, 120));
  }

  return { open, close, openWith, attachTypeahead, _apply: apply, _search: search };
})();
