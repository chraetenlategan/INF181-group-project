// EntityManager.js — Manages directors, shareholders, loan certs, entity switching
// Depends on: config.js (ENTITY_CONFIG, accountingPolicies), utils.js (getVal, getRadio, toggleVisible, toTitleCase)

class EntityManager {
  constructor(liveUpdate) {
    this.liveUpdate = liveUpdate;

    // ── State ──
    this.directors = [];
    this.directorCount = 0;
    this.currentEntityType = '';
    this.loanCertCount = 0;
    this.shareholderCount = 0;
    this.additionalIndividualCount = 0;
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // DIRECTOR FUNCTIONS
  // ══════════════════════════════════════════════════════════════════════════════

  addDirector() {
    this.directorCount++;
    const id = this.directorCount;
    this.directors.push({ id, initials: '', surname: '' });

    const isTrust = this.currentEntityType === 'trust';
    // The "signs on behalf of" wording follows the entity's governing body, and
    // the whole block is hidden for entities where it makes no sense (school,
    // individual). Both are refreshed by _refreshBoardRepLabels() when the
    // entity type or the NPC governing body changes.
    const repApplies = (typeof boardRepApplies === 'function') ? boardRepApplies(this.currentEntityType) : true;
    const repLabel = (typeof boardRepLabel === 'function')
      ? boardRepLabel(this.currentEntityType)
      : 'Signs on behalf of the Board of Directors';
    const list = document.getElementById('directors-list');
    const entry = document.createElement('div');
    entry.className = 'director-entry';
    entry.id = `dir-entry-${id}`;
    entry.innerHTML = `
    <div class="field-group" style="margin-bottom:0">
      <label style="margin-bottom:4px">Initials</label>
      <input type="text" id="dir-init-${id}" placeholder="e.g. LJ" oninput="liveUpdate()" style="margin-bottom:0" autocomplete="off">
    </div>
    <div class="field-group" style="margin-bottom:0">
      <label style="margin-bottom:4px">Surname</label>
      <input type="text" id="dir-sur-${id}" placeholder="e.g. Nkosi" oninput="liveUpdate()" style="margin-bottom:0" autocomplete="off">
    </div>
    <div class="dir-actions">
      <button class="btn-move" onclick="moveDirector(${id},'up')" title="Move up">\u25b2</button>
      <button class="btn-move" onclick="moveDirector(${id},'down')" title="Move down">\u25bc</button>
      <button class="btn-remove" onclick="removeDirector(${id})" title="Remove">\u00d7</button>
    </div>
    <div class="field-group" style="margin-bottom:0; grid-column:1/-1;">
      <label style="margin-bottom:4px">ID Number</label>
      <input type="text" id="dir-id-${id}" placeholder="e.g. 600124 5672 08 6" oninput="formatIdNumber(this); liveUpdate()" style="margin-bottom:0" autocomplete="off" maxlength="20">
    </div>
    <div class="dir-ind-block" id="dir-ind-block-${id}" style="display:${isTrust ? 'block' : 'none'}; grid-column:1/-1; margin-top:4px;">
      <label class="option-pill" style="display:inline-flex; margin-bottom:6px;">
        <input type="checkbox" id="dir-ind-${id}" onchange="toggleIndependentTrustee(${id})" /> Independent Trustee
      </label>
      <div id="dir-ind-fields-${id}" style="display:none; grid-column:1/-1; margin-top:4px;">
        <div class="options-group" style="margin-bottom:8px;">
          <label class="option-pill">
            <input type="radio" name="dir-ind-type-${id}" value="business" onchange="toggleIndTrusteeType(${id})"> Business
          </label>
          <label class="option-pill">
            <input type="radio" name="dir-ind-type-${id}" value="person" onchange="toggleIndTrusteeType(${id})"> Person
          </label>
        </div>
        <label style="margin-bottom:4px; display:block;">Signs on</label>
        <div class="options-group" style="margin-bottom:8px;">
          <label class="option-pill">
            <input type="radio" name="dir-ind-sign-${id}" value="index" checked onchange="liveUpdate()"> Index only
          </label>
          <label class="option-pill">
            <input type="radio" name="dir-ind-sign-${id}" value="all" onchange="liveUpdate()"> All documents
          </label>
        </div>
        <div id="dir-ind-biz-fields-${id}" style="display:grid; gap:8px; grid-template-columns:1fr 1fr;">
          <div class="field-group" style="margin-bottom:0">
            <label style="margin-bottom:4px">Business Name</label>
            <input type="text" id="dir-ind-biz-${id}" placeholder="e.g. INF181 Trust Services (Pty) Ltd" oninput="liveUpdate()" style="margin-bottom:0" autocomplete="off">
          </div>
          <div class="field-group" style="margin-bottom:0">
            <label style="margin-bottom:4px">Business Registration Number</label>
            <input type="text" id="dir-ind-reg-${id}" placeholder="e.g. 2005/012345/07" oninput="liveUpdate()" style="margin-bottom:0" autocomplete="off">
          </div>
        </div>
      </div>
    </div>
    <div class="person-exceptions" id="dir-exc-${id}">
      <div class="person-exceptions-title">Exceptions</div>
      <div class="dir-board-rep-block" id="dir-board-rep-block-${id}" style="display:${repApplies ? 'block' : 'none'};">
        <label class="option-pill" style="display:inline-flex;">
          <input type="checkbox" id="dir-board-rep-${id}" onchange="toggleDirBoardRep(${id})" /> <span id="dir-board-rep-label-${id}">${repLabel}</span>
        </label>
      </div>
      ${this._deceasedBlockHtml(`dir-deceased-${id}`, `dir-deceased-date-${id}`)}
    </div>
  `;
    list.appendChild(entry);
  }

  moveDirector(id, direction) {
    const idx = this.directors.findIndex(d => d.id === id);
    if (idx === -1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= this.directors.length) return;

    [this.directors[idx], this.directors[swapIdx]] = [this.directors[swapIdx], this.directors[idx]];

    const list = document.getElementById('directors-list');
    const entry = document.getElementById(`dir-entry-${id}`);
    const swapEntry = document.getElementById(`dir-entry-${this.directors[idx].id}`);
    if (!entry || !swapEntry || !list) return;

    if (direction === 'up') {
      list.insertBefore(entry, swapEntry);
    } else {
      list.insertBefore(swapEntry, entry);
    }
    this.liveUpdate();
  }

  removeDirector(id) {
    this.directors = this.directors.filter(d => d.id !== id);
    document.getElementById(`dir-entry-${id}`)?.remove();
    this.onCompilerSignerChange();
    this.onCompilerSignerChange();
    this.liveUpdate();
  }

  toggleIndependentTrustee(id) {
    const cb = document.getElementById(`dir-ind-${id}`);
    const fields = document.getElementById(`dir-ind-fields-${id}`);
    if (cb && cb.checked) {
      this.directors.forEach(d => {
        if (d.id !== id) {
          const otherCb = document.getElementById(`dir-ind-${d.id}`);
          const otherFields = document.getElementById(`dir-ind-fields-${d.id}`);
          if (otherCb) otherCb.checked = false;
          if (otherFields) otherFields.style.display = 'none';
        }
      });
      if (fields) fields.style.display = 'block';
    } else {
      if (fields) fields.style.display = 'none';
    }
    this.liveUpdate();
  }

  // ── Deceased (rare exception, any entity type) ──
  // A person on the statements may have died during the year. Their signature
  // line then reads the name with "(Deceased <date>)" on the line below, and the
  // cover's General Information lists them on their own row. The option lives
  // in the person's collapsed "Exceptions" panel next to "Signs on behalf of…",
  // since both are rare. The same markup serves director/trustee/member cards,
  // the main individual and each additional individual.
  _deceasedBlockHtml(cbId, dateId) {
    return `<div class="person-deceased-block">
        <label class="option-pill" style="display:inline-flex;">
          <input type="checkbox" id="${cbId}" onchange="entityManager.toggleDeceased(this)" /> Deceased
        </label>
        <div class="field-group deceased-date-group" style="display:none; margin:6px 0 0;">
          <label style="margin-bottom:4px">Date of death</label>
          <input type="text" id="${dateId}" placeholder="e.g. 14 June 2025" oninput="liveUpdate()" style="margin-bottom:0" autocomplete="off">
        </div>
      </div>`;
  }

  // Shows the date beside a ticked Deceased box. `silent` skips the live update
  // (used while a saved statement is being restored).
  toggleDeceased(cb, silent) {
    if (!cb) return;
    const block = cb.closest('.person-deceased-block');
    const group = block?.querySelector('.deceased-date-group');
    if (group) group.style.display = cb.checked ? 'block' : 'none';
    if (!silent) this.liveUpdate();
  }

  // Reads a person's deceased flag and date (raw, as typed) by element id.
  _readDeceased(cbId, dateId) {
    const deceased = !!document.getElementById(cbId)?.checked;
    const deceasedDate = deceased ? (document.getElementById(dateId)?.value || '').trim() : '';
    return { deceased, deceasedDate };
  }

  // Any number of directors can be marked as signing for the board - one is the
  // common case, two happens. Whoever is ticked is the complete signing list;
  // with none ticked every director signs as usual.
  toggleDirBoardRep(id) {
    this.liveUpdate();
  }

  // Re-labels every existing person card after an entity switch (or an NPC
  // governing-body switch). Cards are built once, at add time, so the wording
  // baked in then would otherwise stay behind on the old entity's terms. When
  // the block no longer applies its checkbox is cleared as well as hidden, so a
  // stale flag can't survive into the generated document.
  // NPO swaps the director list for its two signing offices. Directors already
  // on the list (an older save) stay in the DOM but are hidden, and
  // DocumentGenerator ignores them for an NPO.
  _refreshNpoSignatories(type) {
    const isNpo = type === 'npo';
    const group = document.getElementById('npo-signatories-group');
    if (group) group.style.display = isNpo ? '' : 'none';
    const list = document.getElementById('directors-list');
    if (list) list.style.display = isNpo ? 'none' : '';
    const addBtn = document.querySelector('#step4-block .btn-add');
    if (addBtn) addBtn.style.display = isNpo ? 'none' : '';
    if (isNpo) document.getElementById('directors-section-title').textContent = 'Signatories';
  }

  _refreshBoardRepLabels() {
    const type = this.currentEntityType;
    const applies = (typeof boardRepApplies === 'function') ? boardRepApplies(type) : true;
    const label = (typeof boardRepLabel === 'function')
      ? boardRepLabel(type)
      : 'Signs on behalf of the Board of Directors';
    this.directors.forEach(d => {
      const block = document.getElementById(`dir-board-rep-block-${d.id}`);
      if (block) block.style.display = applies ? 'block' : 'none';
      const span = document.getElementById(`dir-board-rep-label-${d.id}`);
      if (span) span.textContent = label;
      if (!applies) {
        const cb = document.getElementById(`dir-board-rep-${d.id}`);
        if (cb) cb.checked = false;
      }
    });
  }

  toggleIndTrusteeType(id) {
    const type = document.querySelector(`input[name="dir-ind-type-${id}"]:checked`)?.value || 'business';
    const bizFields = document.getElementById(`dir-ind-biz-fields-${id}`);
    const bizHint = document.getElementById(`dir-ind-biz-hint-${id}`);
    const personHint = document.getElementById(`dir-ind-person-hint-${id}`);
    if (bizFields) bizFields.style.display = type === 'business' ? 'grid' : 'none';
    if (bizHint) bizHint.style.display = type === 'business' ? 'block' : 'none';
    if (personHint) personHint.style.display = type === 'person' ? 'block' : 'none';
    this.liveUpdate();
  }

  getDirectors() {
    return this.directors.map(d => {
      const rawInit = (document.getElementById(`dir-init-${d.id}`)?.value || '').trim();
      const rawSur = (document.getElementById(`dir-sur-${d.id}`)?.value || '').trim();
      const idNo = (document.getElementById(`dir-id-${d.id}`)?.value || '').trim();
      const isBusiness = isRegNumber(idNo);
      const init = isBusiness ? rawInit : formatInitials(rawInit);
      const sur = isBusiness ? rawSur : formatName(rawSur);
      const full = init && sur ? `${init} ${sur}` : (init || sur || '');
      const isIndTrustee = !!document.getElementById(`dir-ind-${d.id}`)?.checked;
      const indType = isIndTrustee ? (document.querySelector(`input[name="dir-ind-type-${d.id}"]:checked`)?.value || 'business') : '';
      const indBizName = isIndTrustee && indType === 'business' ? (document.getElementById(`dir-ind-biz-${d.id}`)?.value || '').trim() : '';
      const indBizReg = isIndTrustee && indType === 'business' ? (document.getElementById(`dir-ind-reg-${d.id}`)?.value || '').trim() : '';
      // Independent trustee signs the index only (default) or every document.
      const indSignsAll = isIndTrustee && document.querySelector(`input[name="dir-ind-sign-${d.id}"]:checked`)?.value === 'all';
      const signsForBoard = !!document.getElementById(`dir-board-rep-${d.id}`)?.checked;
      const { deceased, deceasedDate } = this._readDeceased(`dir-deceased-${d.id}`, `dir-deceased-date-${d.id}`);
      return { init, sur, full, idNo, isBusiness, isIndTrustee, indType, indBizName, indBizReg, indSignsAll, signsForBoard, deceased, deceasedDate };
    }).filter(d => d.full);
  }

  formatDirectorList(dirs) {
    if (!dirs.length) return '[DIRECTOR NAMES]';
    if (dirs.length === 1) return dirs[0].full;
    if (dirs.length === 2) return `${dirs[0].full} and ${dirs[1].full}`;
    return dirs.slice(0, -1).map(d => d.full).join(', ') + ', and ' + dirs[dirs.length - 1].full;
  }

  getPronoun(dirs, terms) {
    // For a single director use "his/her" if the entity type doesn't mandate "their"
    if (dirs.length === 1) return 'their';
    return 'their';
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // ENTITY TERMS
  // ══════════════════════════════════════════════════════════════════════════════

  getEntityTerms() {
    const type = this.currentEntityType || 'company';
    const cfg = typeof getEntityConfig === 'function'
      ? getEntityConfig(type)
      : (ENTITY_CONFIG[type] || ENTITY_CONFIG.company);
    const acts = {
      company: 'Companies Act 71 of 2008',
      cc: 'Close Corporations Act 69 of 1984',
      npo: 'Non-Profit Organisations Act 71 of 1997',
      npc: 'Companies Act 71 of 2008',
      hoa: 'Companies Act 71 of 2008',
      trust: 'Trust Property Control Act 57 of 1988',
      church: '',
      school: 'South African Schools Act 84 of 1996',
      club: '',
      bc: 'Sectional Titles Schemes Management Act 8 of 2011',
      individual: ''
    };
    return {
      plural: cfg.pluralTerm,
      singular: cfg.singularTerm,
      pronoun: 'their',
      body: 'The ' + cfg.pluralTerm.toLowerCase(),
      report_to: cfg.reportTo,
      act: acts[type] || 'Companies Act 71 of 2008',
      role: cfg.singularTerm.toLowerCase()
    };
  }

  // Returns singular or plural terms depending on director count
  getTermsForCount(baseTerms, count) {
    if (count === 1) {
      // Singular overrides
      const singularBody = {
        'The directors': 'The director',
        'The members': 'The member',
        'The trustees': 'The trustee',
      };
      return {
        ...baseTerms,
        plural: baseTerms.singular,
        body: singularBody[baseTerms.body] || baseTerms.body,
        bodyPlain: baseTerms.singular,
      };
    }
    return baseTerms;
  }

  updateEntityType() {
    const terms = this.getEntityTerms();
    document.getElementById('directors-section-title').textContent = terms.plural;
    this.liveUpdate();
  }

  updateShareCapital() {
    const val = getRadio('shareCapital');
    const group = document.getElementById('share-capital-other-group');
    if (group) group.classList.toggle('visible', val === 'other');
    this.liveUpdate();
  }

  updateDividend() {
    const val = getRadio('dividends');
    const group = document.getElementById('dividend-amount-group');
    group.classList.toggle('visible', val === 'declared');
    this.liveUpdate();
  }

  updateParent() {
    const val = getRadio('parentCo');
    document.getElementById('parent-group').classList.toggle('visible', val === 'has');
    this.liveUpdate();
  }

  updateGroupCo() {
    const val = getRadio('groupCo');
    document.getElementById('subsidiary-group')
      .classList.toggle('visible', val === 'unconsolidated');
    this.liveUpdate();
  }

  updateBank() {
    const sel = document.getElementById('bankSelect').value;
    const otherInput = document.getElementById('bankOther');
    const hidden = document.getElementById('bankName');
    if (sel === 'other') {
      otherInput.style.display = 'block';
      hidden.value = otherInput.value;
    } else {
      otherInput.style.display = 'none';
      hidden.value = sel;
    }
    this.liveUpdate();
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // ENTITY SWITCHING
  // ══════════════════════════════════════════════════════════════════════════════

  selectEntity(el, type) {
    // Deselect all cards
    document.querySelectorAll('.entity-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    const grid = el.closest('.entity-grid');
    if (grid) grid.classList.add('collapsed');
    this.currentEntityType = type;

    const cfg = typeof getEntityConfig === 'function' ? getEntityConfig(type) : ENTITY_CONFIG[type];

    // Update labels and placeholders
    document.getElementById('label-entityName').textContent = cfg.nameLabel;
    document.getElementById('companyName').placeholder = cfg.namePlaceholder;
    document.getElementById('label-regNumber').textContent = cfg.regLabel;
    document.getElementById('regNumber').placeholder = cfg.regPlaceholder;

    // Attorneys: show reg number toggle, reset if switching away
    const isAttorneys = (type === 'attorneys');
    document.getElementById('att-reg-toggle-group').style.display = isAttorneys ? 'block' : 'none';
    if (!isAttorneys) {
      document.getElementById('reg-number-group').style.display = '';
    } else {
      this.toggleAttReg();
    }

    // Update governing body section title
    document.getElementById('directors-section-title').textContent = cfg.bodyTitle;

    // Update add button label
    const addBtn = document.querySelector('.btn-add');
    if (addBtn) addBtn.textContent = cfg.addBtnLabel;

    // NPO: nobody is named. Step 4 becomes the two signing offices
    // (Chairperson + Secretary/Coordinator) instead of a list of directors.
    this._refreshNpoSignatories(type);

    // "Signs on behalf of the Trustees / Members / Board of Directors"
    this._refreshBoardRepLabels();

    // Show/hide report type options based on entity
    const allowed = cfg.allowedReports || ['compilation', 'review', 'audit'];
    const reportLabels = { compilation: "Independent Compiler's Report", review: "Independent Reviewer's Report", audit: "Independent Auditor's Report" };
    const reportRadios = document.querySelectorAll('input[name="reportType"]');
    reportRadios.forEach(r => {
      const pill = r.closest('.option-pill');
      if (pill) pill.style.display = allowed.includes(r.value) ? 'flex' : 'none';
    });
    // A trust has exactly one report and one engagement letter, so picking the
    // entity ticks both. On load the saved radios/checkboxes are restored after
    // this and win.
    if (type === 'trust') {
      const compRadio = document.querySelector('input[name="reportType"][value="compilation"]');
      if (compRadio) compRadio.checked = true;
      const accEl = document.getElementById('engTypeAccounting');
      if (accEl) accEl.checked = true;
    }
    this._enforceAllowedReport();
    // NPC-only questions: which governing body it has, and whether the
    // Section 21 line appears under the name on the cover.
    const isNpc = isNpcType(type);
    const npcGroup = document.getElementById('npc-options-group');
    if (npcGroup) npcGroup.style.display = isNpc ? '' : 'none';
    // Company-only PPRA question (property practitioner). The radio keeps its
    // answer while another entity is picked; isPpraCompany() ignores it there.
    const ppraGroup = document.getElementById('ppra-options-group');
    if (ppraGroup) ppraGroup.style.display = type === 'company' ? '' : 'none';
    this._refreshPpra();
    // A home owners association always carries the Section 21 line, so picking
    // the entity ticks it — an NPC still defaults to no. It stays a question
    // rather than a fixed line so a set that should not carry it can say so,
    // and, like the trust defaults above, a saved statement's own radios are
    // restored after this and win.
    if (type === 'hoa') {
      const sec21Yes = document.querySelector('input[name="npcSection21"][value="yes"]');
      if (sec21Yes) sec21Yes.checked = true;
    }

    // Show/hide CC-specific form sections. A non-profit company may not have a
    // share capital and may not distribute to its members, so it loses the same
    // three questions a CC does, plus the dividend question.
    const isCC = (type === 'cc');
    const noShares = isCC || isNpc;
    document.getElementById('share-capital-group').style.display = noShares ? 'none' : '';
    document.getElementById('parent-co-group').style.display = noShares ? 'none' : '';
    document.getElementById('parent-group').style.display = noShares ? 'none' : '';
    const dividendGroup = document.getElementById('dividends-group');
    if (dividendGroup) dividendGroup.style.display = isNpc ? 'none' : '';
    // Update dividend labels for CC (capital distribution)
    document.getElementById('dividends-label').textContent = isCC ? 'Capital Distribution' : 'Dividends';
    document.getElementById('dividend-pill-none').querySelector('input').nextSibling.textContent = isCC ? ' No capital distribution declared or paid' : ' No dividend declared or paid';
    document.getElementById('dividend-pill-declared').querySelector('input').nextSibling.textContent = isCC ? ' Capital distribution declared/paid' : ' Dividend declared/paid';

    // Individual: hide Steps 3 (Report), 4 (Directors) — show Step 5 with relevant fields only
    const isIndividual = (type === 'individual');
    // Step 3 stays visible for individuals because the engagement letters live
    // in it; only the report-type parts are hidden.
    document.querySelectorAll('#step3-block .step3-report-only')
      .forEach(el => { el.style.display = isIndividual ? 'none' : ''; });
    document.getElementById('step4-divider').style.display = isIndividual ? 'none' : '';
    document.getElementById('step4-block').style.display = isIndividual ? 'none' : '';

    // Individual: show Step 5 but hide Physical / Business Address and Date
    // Approved (an individual's one street address is the regAddress box,
    // relabelled "Physical Address" below).
    document.getElementById('field-physAddress').style.display = isIndividual ? 'none' : '';
    document.getElementById('field-businessAddress').style.display = isIndividual ? 'none' : '';
    document.getElementById('field-dateApproved').style.display = isIndividual ? 'none' : '';

    // Second-individual toggle (e.g. spouses on one set of statements) — individuals only
    const secondIndGroup = document.getElementById('second-individual-group');
    if (secondIndGroup) secondIndGroup.style.display = isIndividual ? '' : 'none';

    // Tax number field — individuals only
    const indTaxGroup = document.getElementById('individual-tax-group');
    if (indTaxGroup) indTaxGroup.style.display = isIndividual ? '' : 'none';
    const indDeceasedGroup = document.getElementById('individual-deceased-group');
    if (indDeceasedGroup) indDeceasedGroup.style.display = isIndividual ? '' : 'none';

    // Individual: pull ID Number + Income Tax Number (and the additional-people
    // question that belongs with them) up so they sit directly under Full Name,
    // ahead of the trading-as question and the rest of the entity fields. The
    // .form-grid is a CSS grid, so grid `order` reflows them without moving the
    // DOM. Every other entity keeps the natural source order (order cleared).
    const nameGrp = document.getElementById('entity-name-group');
    const regGrp  = document.getElementById('reg-number-group');
    const secondIndGrp = document.getElementById('second-individual-group');
    if (nameGrp)      nameGrp.style.order      = isIndividual ? '-4' : '';
    if (regGrp)       regGrp.style.order       = isIndividual ? '-3' : '';
    if (indTaxGroup)  indTaxGroup.style.order  = isIndividual ? '-2' : '';
    if (secondIndGrp) secondIndGrp.style.order = isIndividual ? '-1' : '';

    // Statement type (annual financial statements vs statement of assets and
    // liabilities) — individuals only
    const indStmtGroup = document.getElementById('individual-statement-type-group');
    if (indStmtGroup) indStmtGroup.style.display = isIndividual ? '' : 'none';

    // A trust has no main source of income — the field is not asked for there.
    const mainIncomeGroup = document.getElementById('main-income-group');
    if (mainIncomeGroup) mainIncomeGroup.style.display = type === 'trust' ? 'none' : '';

    // Fold the Person 1 card in or out for the new entity (removes it and
    // restores the stand-alone fields for every non-individual).
    this._syncPrimaryIndividualCard();

    if (!isIndividual) this.onReportTypeChange();

    // Hide the Specific Matters (Directors' Report) half of Step 6 for School,
    // NPO, BC, Club, Church, Trust, Attorneys, Individual — not applicable.
    const hideStep6 = (type === 'school' || type === 'npo' || type === 'bc' || type === 'church' || type === 'club' || type === 'trust' || type === 'attorneys' || type === 'individual');
    document.getElementById('step6-matters').style.display = hideStep6 ? 'none' : '';

    // Page references sit directly after the Index for every entity type. Trust
    // and School keep their own trustPageStart / schoolPageStart fields (saved
    // under those ids), shown in the same place instead of pageStart / pageEnd.
    const hidePageRefs = (type === 'trust' || type === 'school');
    document.getElementById('page-ref-fields').style.display = hidePageRefs ? 'none' : '';
    document.getElementById('trust-page-ref-fields').style.display = type === 'trust' ? '' : 'none';
    document.getElementById('school-page-ref-fields').style.display = type === 'school' ? '' : 'none';

    document.getElementById('step6-block').style.display = hideStep6 ? 'none' : '';
    document.getElementById('step6-divider').style.display = hideStep6 ? 'none' : '';

    // Hide Step 7 (Accounting Policies) for Attorneys, for Church when
    // policies=no, and for an individual issued a statement of assets and
    // liabilities — that set carries no policies at all.
    const hideStep7 = (type === 'attorneys')
      || (type === 'church' && document.querySelector('input[name="churchPolicies"]:checked')?.value === 'no')
      || isAssetsLiabilitiesSet(type);
    document.getElementById('step7-block').style.display = hideStep7 ? 'none' : '';
    document.getElementById('step7-divider').style.display = hideStep7 ? 'none' : '';

    // Show BC-specific Step 6 only for Body Corporate
    const isBc = (type === 'bc');
    document.getElementById('step6-bc-block').style.display = isBc ? 'block' : 'none';
    document.getElementById('step6-bc-divider').style.display = isBc ? 'block' : 'none';

    // Show/hide independent trustee checkboxes on trustee entries
    const isTrust = (type === 'trust');
    document.querySelectorAll('.dir-ind-block').forEach(el => {
      el.style.display = isTrust ? 'block' : 'none';
    });

    // Show Trust-specific Step 6 (Minutes) only for Trust
    document.getElementById('step6-trust-block').style.display = isTrust ? 'block' : 'none';
    document.getElementById('step6-trust-divider').style.display = isTrust ? 'block' : 'none';

    // Show church policies toggle only for Church
    const isChurch = (type === 'church');
    document.getElementById('church-policies-block').style.display = isChurch ? 'block' : 'none';
    document.getElementById('church-policies-divider').style.display = isChurch ? 'block' : 'none';

    // Entity-specific accounting policies (school, NPC): show/hide the entity's
    // own policy block and swap the reworded policy texts.
    this.updatePolicyTextsForEntity(type);
    this.updatePpeDepreciationVisibility();

    // Loan Certificates — Company, CC and Trust only
    const showLoanCert = (type === 'company' || type === 'cc' || type === 'trust');
    document.getElementById('loan-cert-block').style.display = showLoanCert ? 'block' : 'none';
    document.getElementById('loan-cert-divider').style.display = showLoanCert ? 'block' : 'none';

    // Minutes — Company only (2 pages: directors + shareholders)
    const showMinutes = (type === 'company');
    document.getElementById('minutes-block').style.display = showMinutes ? 'block' : 'none';
    document.getElementById('minutes-divider').style.display = showMinutes ? 'block' : 'none';

    // CC Minutes — CC only (1 page: members AGM)
    const showCCMinutes = (type === 'cc');
    document.getElementById('cc-minutes-block').style.display = showCCMinutes ? 'block' : 'none';
    document.getElementById('cc-minutes-divider').style.display = showCCMinutes ? 'block' : 'none';

    // Individual: show engagement block directly with only accounting option
    if (isIndividual) {
      const engBlock = document.getElementById('engagement-block');
      if (engBlock) engBlock.style.display = 'block';
      this.toggleEngagementTypes();
      // Show preparer block for individual
      const preparerBlock = document.getElementById('preparer-block');
      if (preparerBlock) preparerBlock.style.display = 'block';
      const schoolPreparerBlock = document.getElementById('school-preparer-block');
      if (schoolPreparerBlock) schoolPreparerBlock.style.display = 'none';
      // No reviewer/auditor for individuals — plain signatory label
      // (onReportTypeChange is skipped for individuals, so reset it here)
      const signerLabel = document.getElementById('label-signer');
      if (signerLabel) signerLabel.textContent = 'INF181 Signatory';

      // onReportTypeChange is what normally rebuilds the index inputs and fills
      // the page-reference defaults, and it is skipped for an individual — so do
      // both here. An individual's index is keyed on the entity alone (there is
      // no report type), and its set carries no front pages, so the statements
      // start on page 1 rather than the compilation default of 5.
      const psEl = document.getElementById('pageStart');
      if (psEl && psEl.dataset.userSet !== '1') psEl.value = '1';
      const peEl = document.getElementById('pageEnd');
      if (peEl && peEl.dataset.userSet !== '1') peEl.value = '5';
      this.rebuildIndexInputs();
    }

    // Update address label for individual
    const regAddrField = document.getElementById('regAddress');
    if (regAddrField) {
      const regAddrLabel = regAddrField.closest('.field-group')?.querySelector('label');
      if (regAddrLabel) regAddrLabel.textContent = isIndividual ? 'Physical Address' : 'Registered Address';
    }

    this.liveUpdate();
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // LOAN CERTIFICATE FUNCTIONS
  // ══════════════════════════════════════════════════════════════════════════════

  addLoanCert() {
    this.loanCertCount++;
    const idx = this.loanCertCount;
    const container = document.getElementById('loan-cert-list');
    const card = document.createElement('div');
    card.id = `loan-cert-card-${idx}`;
    card.style.cssText = 'background:var(--panel);border:1.5px solid var(--border);border-radius:8px;padding:14px 16px;margin-bottom:12px;position:relative;';
    card.innerHTML = `
    <button type="button" onclick="removeLoanCert(${idx})" title="Remove" style="position:absolute;top:10px;right:12px;background:none;border:none;cursor:pointer;font-size:16px;color:var(--ink-light);line-height:1;">\u2715</button>
    <div class="lc-card-title" style="font-size:11px;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;color:var(--ink-light);margin-bottom:10px;">Certificate ${idx}</div>

    <div class="field-group" style="margin-bottom:10px;">
      <label>Loan Account Holder</label>
      <input type="text" id="lc-name-${idx}" placeholder="e.g. Jane Doe" oninput="liveUpdate()">
    </div>

    <div class="field-group" style="margin-bottom:10px;">
      <label>Balance Type</label>
      <div class="options-group">
        <label class="option-pill">
          <input type="radio" name="lc-balance-${idx}" value="debit" onchange="liveUpdate()"> Debit Balance
        </label>
        <label class="option-pill">
          <input type="radio" name="lc-balance-${idx}" value="credit" onchange="liveUpdate()"> Credit Balance
        </label>
      </div>
    </div>

    <div class="field-group" style="margin-bottom:10px;">
      <label>Amount (R)</label>
      <input type="text" id="lc-amount-${idx}" placeholder="e.g. 73 660.05" oninput="liveUpdate()">
    </div>

    <div class="field-group" style="margin-bottom:0;">
      <label>Date Signed</label>
      <input type="text" id="lc-date-${idx}" data-auto="1" placeholder="e.g. DUMMYVILLE, 14 MARCH 2025" oninput="onLoanCertDateInput(${idx})">
    </div>
  `;
    container.appendChild(card);
    this._renumberLoanCerts();

    // Default the date to the current Date of Issue. Stays flagged data-auto="1"
    // so it keeps tracking the Date of Issue until the user edits it themselves.
    const dateField = document.getElementById(`lc-date-${idx}`);
    if (dateField && typeof loanCertAutoDateValue === 'function') {
      const v = loanCertAutoDateValue();
      if (v) dateField.value = v;
    }
  }

  // Removing a certificate takes its page off the document straight away, and
  // the cards left on the form are renumbered 1..n, so a new one is never
  // "Certificate 3" after two were deleted. Card ids stay unique: the counter
  // only steps back over removed cards at the end of the list.
  removeLoanCert(idx) {
    const card = document.getElementById(`loan-cert-card-${idx}`);
    if (card) card.remove();
    while (this.loanCertCount > 0 && !document.getElementById(`loan-cert-card-${this.loanCertCount}`)) {
      this.loanCertCount--;
    }
    this._renumberLoanCerts();
    this.liveUpdate();
  }

  // Card titles show the position on the form, which is also the page order.
  _renumberLoanCerts() {
    document.querySelectorAll('#loan-cert-list [id^="loan-cert-card-"] .lc-card-title')
      .forEach((t, i) => { t.textContent = `Certificate ${i + 1}`; });
  }

  getLoanCerts() {
    const certs = [];
    for (let i = 1; i <= this.loanCertCount; i++) {
      if (!document.getElementById(`loan-cert-card-${i}`)) continue; // removed
      const name = formatName((document.getElementById(`lc-name-${i}`)?.value || '').trim());
      const balance = document.querySelector(`input[name="lc-balance-${i}"]:checked`)?.value || 'credit';
      const amount = (document.getElementById(`lc-amount-${i}`)?.value || '').trim();
      const date = (document.getElementById(`lc-date-${i}`)?.value || '').trim().toUpperCase();
      certs.push({ name, balance, amount, date });
    }
    return certs;
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // SHAREHOLDER FUNCTIONS
  // ══════════════════════════════════════════════════════════════════════════════

  addShareholder() {
    this.shareholderCount++;
    const idx = this.shareholderCount;
    const container = document.getElementById('shareholder-list');
    const card = document.createElement('div');
    card.id = `sh-card-${idx}`;
    card.style.cssText = 'background:var(--panel);border:1.5px solid var(--border);border-radius:8px;padding:14px 16px;margin-bottom:12px;position:relative;';
    card.innerHTML = `
    <button type="button" onclick="removeShareholder(${idx})" title="Remove" style="position:absolute;top:10px;right:12px;background:none;border:none;cursor:pointer;font-size:16px;color:var(--ink-light);line-height:1;">\u2715</button>
    <div style="font-size:11px;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;color:var(--ink-light);margin-bottom:10px;">Shareholder ${idx}</div>

    <div class="field-group" style="margin-bottom:10px;">
      <label>Shareholder Name</label>
      <input type="text" id="sh-name-${idx}" placeholder="e.g. Pat Example or Acme (Pty) Ltd" oninput="liveUpdate()">
    </div>

    <div class="field-group" style="margin-bottom:10px;">
      <label>Type</label>
      <div class="options-group">
        <label class="option-pill">
          <input type="radio" name="sh-type-${idx}" value="individual" onchange="onShareholderTypeChange(${idx})"> Individual (signs personally)
        </label>
        <label class="option-pill">
          <input type="radio" name="sh-type-${idx}" value="entity" onchange="onShareholderTypeChange(${idx})"> Entity (company / trust / CC)
        </label>
      </div>
    </div>

    <div id="sh-proxy-box-${idx}" style="display:none;">
      <div class="field-group" style="margin-bottom:0;">
        <label>Proxy Representative <span style="font-weight:400;color:#9090b0;font-size:11px;">(signs on behalf of the entity)</span></label>
        <input type="text" id="sh-proxy-${idx}" placeholder="e.g. Pieter Visser" oninput="liveUpdate()">
      </div>
    </div>
  `;
    container.appendChild(card);
  }

  removeShareholder(idx) {
    const card = document.getElementById(`sh-card-${idx}`);
    if (card) card.remove();
  }

  onShareholderTypeChange(idx) {
    const type = document.querySelector(`input[name="sh-type-${idx}"]:checked`)?.value;
    const box = document.getElementById(`sh-proxy-box-${idx}`);
    if (box) box.style.display = (type === 'entity') ? 'block' : 'none';
  }

  getShareholders() {
    const list = [];
    for (let i = 1; i <= this.shareholderCount; i++) {
      if (!document.getElementById(`sh-card-${i}`)) continue;
      const rawName = (document.getElementById(`sh-name-${i}`)?.value || '').trim();
      const type = document.querySelector(`input[name="sh-type-${i}"]:checked`)?.value || 'individual';
      const name = type === 'entity' ? rawName : formatName(rawName);
      const proxy = formatName((document.getElementById(`sh-proxy-${i}`)?.value || '').trim());
      // idx = the card's own number, so SectionNav can scroll the preview to
      // this shareholder's signature entry even when earlier cards are blank.
      if (name) list.push({ name, type, proxy, idx: i });
    }
    return list;
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // POLICY FUNCTIONS
  // ══════════════════════════════════════════════════════════════════════════════

  // A policy may declare `entityTypes: [...]` to limit itself to certain entity
  // types (e.g. a market-value Investments variant that only schools and
  // companies use). No list means the policy applies everywhere.
  policyAppliesToEntity(p, entityType = this.currentEntityType) {
    return !Array.isArray(p.entityTypes) || p.entityTypes.includes(entityType);
  }

  buildPolicyChecklist() {
    const container = document.getElementById('policy-checklist');
    accountingPolicies.forEach(p => {
      const div = document.createElement('div');
      div.className = 'policy-item';
      div.id = 'pi-' + p.id;
      if (p.schoolOnly || p.npcOnly || p.npoOnly || p.bcOnly || p.hoaOnly || !this.policyAppliesToEntity(p)) div.style.display = 'none';

      let subHtml = '';
      if (p.subItems && !p.isBio) {
        if (p.id === 'pol_ppe') {
          subHtml = `
          <div id="ppe-depreciation-toggle" class="policy-subitems" style="display:none;margin-top:10px;padding-top:10px;border-top:1px dashed var(--border);">
            <label class="policy-subitem-check">
              <input type="checkbox" id="ppe-depreciation-include" onchange="onPpeDepreciationToggle(); liveUpdate()">
              <span>Depreciation</span>
            </label>
          </div>
          <div id="ppe-depreciation-options">`;
        }
        // PPE-style: checkbox + label + rate dropdown + optional custom input
        const ppeRateItems = p.id === 'pol_ppe'
          ? p.subItems.filter(s => !s.isLandAndBuildings)
          : p.subItems;
        const ppeLandItems = p.id === 'pol_ppe'
          ? p.subItems.filter(s => s.isLandAndBuildings)
          : [];

        subHtml += `<div class="policy-subitems">` +
          ppeRateItems.map(s => {
            const opts = s.rateOptions.map(r =>
              `<option value="${r}">${r}</option>`
            ).join('');
            return `
          <div class="policy-subitem-row" id="row-${s.id}">
            <label class="policy-subitem-check">
              <input type="checkbox" id="${s.id}" onchange="onSubItemChange('${s.id}'); liveUpdate()">
              <span>${s.label}</span>
            </label>
            <div class="policy-subitem-rate" id="rate-wrap-${s.id}" style="display:none;">
              <select id="sel-${s.id}" onchange="onRateSelect('${s.id}'); liveUpdate()">
                ${opts}
              </select>
              <input type="text" id="custom-${s.id}" placeholder="Enter %" style="display:none;width:80px;margin-left:6px;" oninput="liveUpdate()">
              <input type="text" id="residual-${s.id}" class="ppe-residual-input" placeholder="Residual %" style="display:none;width:90px;margin-left:6px;" oninput="liveUpdate()">
            </div>
          </div>`;
          }).join('') +
          `</div>`;

        if (p.id === 'pol_ppe') {
          subHtml += `
          <div class="policy-subitems" style="margin-top:10px;padding-top:10px;border-top:1px dashed var(--border);">
            <div class="field-group" style="margin-bottom:0;">
              <label style="font-size:12px;font-weight:600;color:var(--ink);">Include Residual Values?</label>
              <div class="options-group" style="margin-top:4px;flex-direction:row;flex-wrap:wrap;">
                <label class="option-pill">
                  <input type="radio" name="ppeResidualInclude" value="no" onchange="onPpeResidualToggle(); liveUpdate()">
                  No
                </label>
                <label class="option-pill">
                  <input type="radio" name="ppeResidualInclude" value="yes" onchange="onPpeResidualToggle(); liveUpdate()">
                  Yes
                </label>
              </div>
              <div id="ppe-residual-box" class="conditional" style="margin-top:10px;">
                <label>Residual Value Percentage</label>
                <input type="text" id="ppeResidualPercent" placeholder="e.g. 20%" oninput="liveUpdate()" style="width:120px;">
              </div>
            </div>
          </div>`;

          subHtml += `
          <div class="policy-subitems" style="margin-top:10px;padding-top:10px;border-top:1px dashed var(--border);">
            <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--gold);margin-bottom:8px;">
              Add Another Asset Type</div>
            <div id="ppe-custom-subitems-list"></div>
            <button type="button" class="btn-add" onclick="addPpeSubItem()" style="margin-top:4px;">+ Add Asset Type</button>
          </div>
          </div>`;

          if (ppeLandItems.length) {
            subHtml += `<div class="policy-subitems" style="margin-top:10px;padding-top:10px;border-top:1px dashed var(--border);">` +
              ppeLandItems.map(s => `
          <div class="policy-subitem-row" id="row-${s.id}">
            <label class="policy-subitem-check">
              <input type="checkbox" id="${s.id}" onchange="liveUpdate()">
              <span>${s.label}</span>
            </label>
          </div>`).join('') +
              `</div>`;
          }
        }
      } else if (p.subItems && p.isBio) {
        // Biological assets: checkboxes with labels, optional body text dropdown
        subHtml = `<div class="policy-subitems">` +
          p.subItems.map(s => {
            let optionsHtml = '';
            if (s.bodyTextOptions && s.bodyTextOptions.length > 1) {
              optionsHtml = `
              <select id="sel-${s.id}" class="rate-select" onchange="liveUpdate()" style="margin-left:18px;margin-top:4px;display:block;max-width:100%;">
                ${s.bodyTextOptions.map((opt, i) => `<option value="${i}">${opt}</option>`).join('')}
              </select>`;
            }
            return `
          <label class="policy-subitem-check">
            <input type="checkbox" id="${s.id}" onchange="liveUpdate()">
            <span>${s.label}</span>
          </label>${optionsHtml}`;
          }).join('') +
          `</div>`;
      }

      let extraOptions = '';
      if (p.textOptions && p.textOptions.length > 1) {
        extraOptions += `
        <div class="policy-subitems" style="margin-top:10px;padding-top:8px;border-top:1px dashed var(--border);">
          <div class="options-group" style="flex-direction:column;gap:6px;">
            ${p.textOptions.map((opt, i) => `<label class="option-pill"><input type="radio" name="textopt-${p.id}" value="${i}" ${i === 0 ? 'checked' : ''} onchange="onPolicyTextOption('${p.id}'); liveUpdate()">${opt.label}</label>`).join('')}
          </div>
        </div>`;
      }
      if (p.deferredAssetSentence) {
        extraOptions += `
        <div class="policy-deftax-toggle" style="margin-top:10px;padding-top:8px;border-top:1px dashed var(--border);">
          <label class="option-pill" style="font-size:12px;padding:7px 10px;">
            <input type="checkbox" id="deftax-no-asset" checked onchange="liveUpdate()">
            Include: "${p.deferredAssetSentence}"
          </label>
        </div>`;
      }

      div.innerHTML = `
      <label class="policy-header">
        <input type="checkbox" id="${p.id}" onchange="togglePolicy('${p.id}')">
        <span class="policy-label" id="policy-label-${p.id}">${this._policyLabelHtml(p)}</span>
        <button type="button" class="btn-policy-edit" onclick="event.preventDefault(); event.stopPropagation(); togglePolicyEdit('${p.id}')" title="Quick edit">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
        </button>
      </label>
      ${p.guide ? `<p class="policy-guide">${p.guide}</p>` : ''}
      <div class="policy-body">
        <div class="policy-text-display" id="policy-text-${p.id}">${p.text || ''}</div>
        <textarea class="policy-text-edit" id="policy-edit-${p.id}" style="display:none;" oninput="liveUpdate()">${p.text || ''}</textarea>
        ${extraOptions}${subHtml}
      </div>
    `;
      container.appendChild(div);
      if ((p.npoText || p.npoOnly || p.schoolOnly) && typeof watchNpoOrgSlots === 'function') {
        watchNpoOrgSlots(div.querySelector('.policy-text-display'));
      }
    });

    this._buildPolicyGroups(container);
    // NPC block is inserted after the school block, so both lead the checklist
    // (only one of them is ever visible at a time).
    this._buildSpecialPolicyGroup(container, 'school');
    this._buildSpecialPolicyGroup(container, 'npc');
    this._buildSpecialPolicyGroup(container, 'npo');
    this._buildSpecialPolicyGroup(container, 'bc');
    this._buildSpecialPolicyGroup(container, 'hoa');
    // The real [PPE_STMT] field, kept hidden: shared by the school and NPO
    // "No Asset Register" PPE policies, picked from the mirror in their text
    // (app.js → watchNpoOrgSlots). Save/load and the generator read this one.
    const ppeStmtOpts = typeof PPE_STMT_OPTIONS !== 'undefined' ? PPE_STMT_OPTIONS : ['Financial Performance', 'Surplus or Deficit'];
    const ppeStmtDefault = typeof DEFAULT_PPE_STMT !== 'undefined' ? DEFAULT_PPE_STMT : 'Financial Performance';
    const ppeStmt = document.createElement('select');
    ppeStmt.id = 'ppeStmtName';
    ppeStmt.hidden = true;
    ppeStmt.setAttribute('onchange', 'liveUpdate()');
    ppeStmt.innerHTML = ppeStmtOpts
      .map(o => `<option value="${o}"${o === ppeStmtDefault ? ' selected' : ''}>${o}</option>`).join('');
    container.appendChild(ppeStmt);
    this._placePolicyItems(this.currentEntityType);
  }

  // Which entity-specific block a policy belongs in for a given entity type,
  // or null for the normal grouped checklist. A policy is in a block either
  // permanently (`schoolOnly` / `npcOnly` / `bcOnly` / `hoaOnly`) or only for
  // that entity type (`schoolListed` / `npcListed`, where the general policy is
  // reworded). HOA is tested before NPC: an HOA is an NPC type, so its own
  // block has to win for the policies that are HOA-only.
  _policyBlockKind(p, entityType = this.currentEntityType) {
    if (p.schoolOnly || (p.schoolListed && entityType === 'school')) return 'school';
    if (p.hoaOnly || (p.hoaListed && entityType === 'hoa')) return 'hoa';
    if (p.npcOnly || (p.npcListed && isNpcType(entityType))) return 'npc';
    if (p.npoOnly || (p.npoListed && entityType === 'npo')) return 'npo';
    if (p.bcOnly || (p.bcListed && entityType === 'bc')) return 'bc';
    return null;
  }

  // Label shown in the checklist. A policy that sits in an entity-specific block
  // is tagged as such, and may carry a `schoolLabel` / `npcLabel` naming the
  // variant for what it is (e.g. PPE "— Asset Register").
  _policyLabelHtml(p, entityType = this.currentEntityType) {
    const kind = this._policyBlockKind(p, entityType);
    const variantLabel = kind === 'school' ? p.schoolLabel
      : kind === 'npc' ? p.npcLabel
      : kind === 'npo' ? p.npoLabel
      : kind === 'bc' ? p.bcLabel
      : kind === 'hoa' ? p.hoaLabel
      : null;
    const label = variantLabel || p.label;
    if (!kind) return label;
    const tag = kind === 'school' ? '(school)' : kind === 'npc' ? '(NPC)' : kind === 'npo' ? '(NPO)'
      : kind === 'hoa' ? '(HOA)' : '(Body Corporate)';
    return label + ' <span class="policy-school-tag">' + tag + '</span>';
  }

  // Sort the flat checklist into the labelled blocks declared by POLICY_GROUPS
  // (basis of preparation, assets, liabilities, income, other notes). Only the
  // DOM is reorganised — numbering and document generation iterate
  // accountingPolicies, which is already kept in this same group order.
  // Entity-block policies are skipped here; _buildSpecialPolicyGroup collects
  // them into their own block afterwards.
  _buildPolicyGroups(container) {
    if (typeof POLICY_GROUPS === 'undefined') return;
    const fallback = typeof POLICY_GROUP_FALLBACK === 'string'
      ? POLICY_GROUP_FALLBACK
      : POLICY_GROUPS[POLICY_GROUPS.length - 1].id;

    const bodies = {};
    POLICY_GROUPS.forEach(g => {
      const block = document.createElement('div');
      block.className = 'policy-group';
      block.id = 'policy-group-' + g.id;
      block.innerHTML = `
        <div class="policy-group-header">${g.label}</div>
        <div class="policy-group-body"></div>`;
      bodies[g.id] = block.querySelector('.policy-group-body');
      container.appendChild(block);
    });

    accountingPolicies.forEach(p => {
      if (p.schoolOnly || p.npcOnly || p.npoOnly || p.bcOnly || p.hoaOnly) return;
      const item = document.getElementById('pi-' + p.id);
      if (!item) return;
      const body = bodies[p.group] || bodies[fallback];
      if (body) body.appendChild(item);
    });

    this._refreshEmptyPolicyGroups();
  }

  // A group can end up empty (e.g. every policy in it deleted from the admin
  // panel, or every policy in it moved to the School-Only block for a school) —
  // an empty labelled box is just noise.
  _refreshEmptyPolicyGroups() {
    if (typeof POLICY_GROUPS === 'undefined') return;
    POLICY_GROUPS.forEach(g => {
      const block = document.getElementById('policy-group-' + g.id);
      if (!block) return;
      const body = block.querySelector('.policy-group-body');
      block.style.display = (body && body.children.length) ? '' : 'none';
    });
  }

  // Put every checklist item in the block it belongs to for the current entity
  // type, in accountingPolicies order, and refresh its label. `schoolOnly` /
  // `npcOnly` policies always live in their entity block; `schoolListed` /
  // `npcListed` policies move there for that entity type and return to their
  // normal group otherwise.
  _placePolicyItems(entityType = this.currentEntityType) {
    const blockBodies = {
      school: document.querySelector('#school-policy-group .school-policy-group-body'),
      npc: document.querySelector('#npc-policy-group .school-policy-group-body'),
      npo: document.querySelector('#npo-policy-group .school-policy-group-body'),
      bc: document.querySelector('#bc-policy-group .school-policy-group-body'),
      hoa: document.querySelector('#hoa-policy-group .school-policy-group-body'),
    };
    const fallback = typeof POLICY_GROUP_FALLBACK === 'string' ? POLICY_GROUP_FALLBACK : null;
    accountingPolicies.forEach(p => {
      const item = document.getElementById('pi-' + p.id);
      if (!item) return;
      const labelEl = document.getElementById('policy-label-' + p.id);
      if (labelEl) labelEl.innerHTML = this._policyLabelHtml(p, entityType);

      const kind = this._policyBlockKind(p, entityType);
      let body = null;
      if (kind) {
        body = blockBodies[kind];
      } else {
        const block = document.getElementById('policy-group-' + (p.group || fallback));
        body = block ? block.querySelector('.policy-group-body') : null;
      }
      if (body) body.appendChild(item);
    });
    this._refreshEmptyPolicyGroups();
  }

  // Collect the policies that belong to an entity-specific block (school, NPC)
  // into one labelled block at the top of the checklist. They are defined at
  // scattered points in accountingPolicies (their numbers interleave with the
  // general policies), which made them hard to find. Only the checklist DOM is
  // reordered — numbering and document generation both iterate
  // accountingPolicies, so output order is unchanged.
  _buildSpecialPolicyGroup(container, kind) {
    const specs = {
      school: {
        id: 'school-policy-group',
        header: 'School-Only Policies',
        hint: 'These policies apply to schools only and replace their general equivalents.',
        match: p => p.schoolOnly,
        field: `
      <div class="school-edu-dept">
        <label for="schoolEduDept">Education department</label>
        <input type="text" id="schoolEduDept" value="${typeof DEFAULT_EDU_DEPT !== 'undefined' ? DEFAULT_EDU_DEPT : ''}"
               placeholder="${typeof DEFAULT_EDU_DEPT !== 'undefined' ? DEFAULT_EDU_DEPT : ''}" oninput="liveUpdate()">
      </div>`,
      },
      bc: {
        id: 'bc-policy-group',
        header: 'Body Corporate-Only Policies',
        hint: 'These policies apply to body corporates only and replace their general equivalents.',
        match: p => p.bcOnly,
        field: '',
      },
      hoa: {
        id: 'hoa-policy-group',
        header: 'HOA-Only Policies',
        hint: 'These policies apply to home owners associations only and replace their general equivalents.',
        match: p => p.hoaOnly,
        field: '',
      },
      npc: {
        id: 'npc-policy-group',
        header: 'NPC-Only Policies',
        hint: 'These policies apply to non-profit companies only and replace their general equivalents.',
        match: p => p.npcOnly,
        field: `
      <div class="school-edu-dept">
        <label for="npcOrgName">How the entity is described</label>
        <input type="text" id="npcOrgName" value="${typeof DEFAULT_NPC_ORG !== 'undefined' ? DEFAULT_NPC_ORG : ''}"
               placeholder="${typeof DEFAULT_NPC_ORG !== 'undefined' ? DEFAULT_NPC_ORG : ''}" oninput="liveUpdate()">
      </div>`,
      },
      npo: {
        id: 'npo-policy-group',
        header: 'NPO-Only Policies',
        hint: 'These policies apply to non-profit organisations only and replace their general equivalents.',
        match: p => p.npoOnly,
        // The real fields, kept hidden: the user picks from mirrors that sit in
        // the policy text exactly where [NPO_ORG] / [NPO_DEPT] / [NPO_DEPT_OF]
        // are (app.js → watchNpoOrgSlots). Save/load and the generator read
        // these ones.
        field: `
      <div class="school-edu-dept" hidden>
        <label for="npoOrgName">How the entity is described</label>
        <select id="npoOrgName" onchange="liveUpdate()">
          ${(typeof NPO_ORG_OPTIONS !== 'undefined' ? NPO_ORG_OPTIONS : ['organisation', 'club', 'centre'])
            .map(o => `<option value="${o}"${o === (typeof DEFAULT_NPO_ORG !== 'undefined' ? DEFAULT_NPO_ORG : 'organisation') ? ' selected' : ''}>${o.charAt(0).toUpperCase() + o.slice(1)}</option>`).join('')}
        </select>
        <input type="text" id="npoDeptName" value="${typeof DEFAULT_NPO_DEPT !== 'undefined' ? DEFAULT_NPO_DEPT : ''}" oninput="liveUpdate()">
        <select id="npoDeptOf" onchange="liveUpdate()">
          ${(typeof NPO_DEPT_OF_OPTIONS !== 'undefined' ? NPO_DEPT_OF_OPTIONS : ['Social Development', 'Education'])
            .map(o => `<option value="${o}"${o === (typeof DEFAULT_NPO_DEPT_OF !== 'undefined' ? DEFAULT_NPO_DEPT_OF : 'Social Development') ? ' selected' : ''}>${o}</option>`).join('')}
        </select>
      </div>`,
      },
    };
    const spec = specs[kind];
    if (!spec) return;

    const items = accountingPolicies
      .filter(spec.match)
      .map(p => document.getElementById('pi-' + p.id))
      .filter(Boolean);
    if (!items.length) return;

    const group = document.createElement('div');
    group.className = 'school-policy-group';
    group.id = spec.id;
    group.style.display = 'none';
    group.innerHTML = `
      <div class="school-policy-group-header">${spec.header}</div>
      ${spec.field}
      <div class="school-policy-group-body"></div>`;
    const body = group.querySelector('.school-policy-group-body');
    items.forEach(item => {
      // The group container carries the entity-type visibility now.
      item.style.display = '';
      body.appendChild(item);
    });
    // These entities reach for their own policies first, so the block leads the
    // checklist.
    container.insertBefore(group, container.firstChild);
  }

  // Rebuild the policy checklist after the global accountingPolicies array has
  // changed (e.g. admin added / edited / deleted a policy). Preserves the user's
  // current checkbox selections and any in-progress quick-edit text.
  rebuildPolicyChecklist() {
    const container = document.getElementById('policy-checklist');
    if (!container) return;

    // Snapshot current state by policy id
    const checkedState = {};
    const editText = {};
    accountingPolicies.forEach(p => {
      const cb = document.getElementById(p.id);
      if (cb) checkedState[p.id] = cb.checked;
      const ed = document.getElementById('policy-edit-' + p.id);
      if (ed) editText[p.id] = ed.value;
    });

    // The education-department field lives inside the school block, which this
    // rebuild throws away — carry the typed value across.
    const eduDeptEl = document.getElementById('schoolEduDept');
    const eduDeptValue = eduDeptEl ? eduDeptEl.value : null;
    const npcOrgEl = document.getElementById('npcOrgName');
    const npcOrgValue = npcOrgEl ? npcOrgEl.value : null;
    const npoOrgEl = document.getElementById('npoOrgName');
    const npoOrgValue = npoOrgEl ? npoOrgEl.value : null;
    const npoDeptValues = ['npoDeptName', 'npoDeptOf', 'ppeStmtName'].map(id => {
      const el = document.getElementById(id);
      return el ? el.value : null;
    });

    container.innerHTML = '';
    this.buildPolicyChecklist();

    if (eduDeptValue !== null) {
      const restored = document.getElementById('schoolEduDept');
      if (restored) restored.value = eduDeptValue;
    }
    if (npcOrgValue !== null) {
      const restoredOrg = document.getElementById('npcOrgName');
      if (restoredOrg) restoredOrg.value = npcOrgValue;
    }
    if (npoOrgValue !== null) {
      const restoredNpo = document.getElementById('npoOrgName');
      if (restoredNpo) restoredNpo.value = npoOrgValue;
    }
    ['npoDeptName', 'npoDeptOf', 'ppeStmtName'].forEach((id, i) => {
      const el = document.getElementById(id);
      if (el && npoDeptValues[i] !== null) el.value = npoDeptValues[i];
    });

    // Restore checkbox selections
    Object.keys(checkedState).forEach(id => {
      const cb = document.getElementById(id);
      if (!cb) return;
      cb.checked = checkedState[id];
      const item = document.getElementById('pi-' + id);
      if (item) item.classList.toggle('checked', checkedState[id]);
    });

    // Apply entity-specific text swaps, then restore any custom quick-edits on top
    this.updatePolicyTextsForEntity(this.currentEntityType);
    this.updatePpeDepreciationVisibility();
    Object.keys(editText).forEach(id => {
      const ed = document.getElementById('policy-edit-' + id);
      if (ed) ed.value = editText[id];
    });
    this.updatePolicyNumbers();
  }

  // Base text for a policy under a given entity type: schools and NPCs may
  // reword the general policy (`schoolText` / `npcText`).
  policyTextForEntity(p, entityType = this.currentEntityType) {
    if (entityType === 'school' && p.schoolText) return p.schoolText;
    if (isNpcType(entityType) && p.npcText) return p.npcText;
    if (entityType === 'npo' && p.npoText) return p.npoText;
    return p.text || '';
  }

  updatePolicyTextsForEntity(entityType = this.currentEntityType) {
    const isSchool = entityType === 'school';
    const isNpc = isNpcType(entityType);
    const isBc = entityType === 'bc';
    const isHoa = entityType === 'hoa';

    // Entity-only policies live in one block each; the block carries their
    // visibility.
    const group = document.getElementById('school-policy-group');
    if (group) group.style.display = isSchool ? '' : 'none';
    const npcGroup = document.getElementById('npc-policy-group');
    if (npcGroup) npcGroup.style.display = isNpc ? '' : 'none';
    const isNpo = entityType === 'npo';
    const npoGroup = document.getElementById('npo-policy-group');
    if (npoGroup) npoGroup.style.display = isNpo ? '' : 'none';
    const bcGroup = document.getElementById('bc-policy-group');
    if (bcGroup) bcGroup.style.display = isBc ? '' : 'none';
    const hoaGroup = document.getElementById('hoa-policy-group');
    if (hoaGroup) hoaGroup.style.display = isHoa ? '' : 'none';
    this._placePolicyItems(entityType);

    accountingPolicies.forEach(p => {
      const item = document.getElementById('pi-' + p.id);
      if (!item) return;

      // Show/hide school-only policies
      if (p.schoolOnly) {
        item.style.display = group ? '' : (isSchool ? '' : 'none');
        if (!isSchool) {
          const cb = document.getElementById(p.id);
          if (cb) cb.checked = false;
        }
        return;
      }

      // Show/hide NPC-only policies
      if (p.npcOnly) {
        item.style.display = npcGroup ? '' : (isNpc ? '' : 'none');
        if (!isNpc) {
          const cb = document.getElementById(p.id);
          if (cb) cb.checked = false;
        }
        return;
      }

      // Show/hide NPO-only policies
      if (p.npoOnly) {
        item.style.display = npoGroup ? '' : (isNpo ? '' : 'none');
        if (!isNpo) {
          const cb = document.getElementById(p.id);
          if (cb) cb.checked = false;
        }
        return;
      }

      // Show/hide body-corporate-only policies
      if (p.bcOnly) {
        item.style.display = bcGroup ? '' : (isBc ? '' : 'none');
        if (!isBc) {
          const cb = document.getElementById(p.id);
          if (cb) cb.checked = false;
        }
        return;
      }

      // Show/hide HOA-only policies
      if (p.hoaOnly) {
        item.style.display = hoaGroup ? '' : (isHoa ? '' : 'none');
        if (!isHoa) {
          const cb = document.getElementById(p.id);
          if (cb) cb.checked = false;
        }
        return;
      }

      // Policies restricted to specific entity types: hide (and clear) elsewhere
      if (!this.policyAppliesToEntity(p)) {
        item.style.display = 'none';
        const cb = document.getElementById(p.id);
        if (cb && cb.checked) {
          cb.checked = false;
          item.classList.remove('checked');
        }
        return;
      }
      item.style.display = '';

      // Swap displayed text for policies with a schoolText / npcText variant
      if (p.schoolText || p.npcText || p.npoText) {
        const displayText = this.policyTextForEntity(p, entityType);
        const displayEl = document.getElementById('policy-text-' + p.id);
        const editEl = document.getElementById('policy-edit-' + p.id);
        if (displayEl) displayEl.innerHTML = displayText;
        if (editEl && editEl.style.display === 'none') editEl.value = policyHtmlToText(displayText);
      }
    });
  }

  usesPpeDepreciationToggle() {
    const ppe = accountingPolicies.find(p => p.id === 'pol_ppe');
    return ppe?.ppeDepreciationToggleEntities?.includes(this.currentEntityType) || false;
  }

  updatePpeDepreciationVisibility() {
    const toggle = document.getElementById('ppe-depreciation-toggle');
    const options = document.getElementById('ppe-depreciation-options');
    if (!toggle || !options) return;

    const usesToggle = this.usesPpeDepreciationToggle();
    toggle.style.display = usesToggle ? '' : 'none';

    if (!usesToggle) {
      options.style.display = '';
      return;
    }

    const checked = !!document.getElementById('ppe-depreciation-include')?.checked;
    options.style.display = checked ? '' : 'none';
    this.updatePpePolicyDisplay();
  }

  updatePpePolicyDisplay() {
    const p = accountingPolicies.find(pol => pol.id === 'pol_ppe');
    if (!p) return;
    const displayEl = document.getElementById('policy-text-pol_ppe');
    const editEl = document.getElementById('policy-edit-pol_ppe');
    if (!displayEl) return;
    if (editEl && editEl.style.display !== 'none') return;

    const text = this.ppePolicyText(p);
    displayEl.innerHTML = text;
    if (editEl) editEl.value = policyHtmlToText(text);
  }

  // PPE's unedited wording: the entity's text, with or without the
  // "depreciated at the following rates" sentence the toggle controls.
  ppePolicyText(p) {
    let text = this.policyTextForEntity(p);
    if (this.usesPpeDepreciationToggle() && !document.getElementById('ppe-depreciation-include')?.checked) {
      text = text.replace(/\s*Other assets are depreciated at the following rates:\s*/i, '').trim();
    } else if (!this.usesPpeDepreciationToggle() || document.getElementById('ppe-depreciation-include')?.checked) {
      const intro = p.depreciationRatesIntro || 'Other assets are depreciated at the following rates:';
      if (!/depreciated at the following rates/i.test(text)) {
        text = `${text} ${intro}`;
      }
    }
    return text;
  }

  // The wording a policy shows when nobody has edited it: the selected text
  // variant, else the entity's school / NPC rewording (and PPE's rates
  // sentence). Saving compares against this to decide what counts as an edit.
  defaultPolicyText(p) {
    if (p.textOptions) {
      const checked = document.querySelector(`input[name="textopt-${p.id}"]:checked`);
      const opt = p.textOptions[checked ? parseInt(checked.value, 10) : 0] || p.textOptions[0];
      return opt.text || '';
    }
    if (p.id === 'pol_ppe') return this.ppePolicyText(p);
    return this.policyTextForEntity(p);
  }

  onPpeDepreciationToggle() {
    this.updatePpeDepreciationVisibility();
    this.liveUpdate();
  }

  onPpeResidualToggle() {
    const show = getRadio('ppeResidualInclude') === 'yes';
    const box = document.getElementById('ppe-residual-box');
    if (box) box.classList.toggle('visible', show);
    if (!show) {
      const inp = document.getElementById('ppeResidualPercent');
      if (inp) inp.value = '';
    }
    // Show/hide per-item residual inputs
    document.querySelectorAll('.ppe-residual-input').forEach(inp => {
      inp.style.display = show ? 'inline-block' : 'none';
      if (!show) inp.value = '';
    });
    this.liveUpdate();
  }

  // Policy-level text variant dropdown (p.textOptions): swap the displayed
  // policy text for the selected variant. The document generator reads the
  // display div via getPolicyText(), so the variant flows through automatically.
  onPolicyTextOption(id) {
    const p = accountingPolicies.find(pol => pol.id === id);
    if (!p || !p.textOptions) return;
    const checked = document.querySelector(`input[name="textopt-${id}"]:checked`);
    const idx = checked ? parseInt(checked.value, 10) : 0;
    const opt = p.textOptions[idx] || p.textOptions[0];
    const displayEl = document.getElementById('policy-text-' + id);
    const editEl = document.getElementById('policy-edit-' + id);
    if (displayEl) displayEl.innerHTML = opt.text;
    if (editEl) editEl.value = policyHtmlToText(opt.text);
  }

  onSubItemChange(sid) {
    const cb = document.getElementById(sid);
    const rateWrap = document.getElementById('rate-wrap-' + sid);
    if (rateWrap) rateWrap.style.display = cb.checked ? 'flex' : 'none';
  }

  onRateSelect(sid) {
    const sel = document.getElementById('sel-' + sid);
    const custom = document.getElementById('custom-' + sid);
    if (!custom) return;
    if (sel.value === 'Other') {
      custom.style.display = 'inline-block';
    } else {
      custom.style.display = 'none';
    }
  }

  togglePolicy(id) {
    const cb = document.getElementById(id);
    const item = document.getElementById('pi-' + id);
    item.classList.toggle('checked', cb.checked);
    this.updatePolicyNumbers();
    this.liveUpdate();
  }

  selectAllPolicies(checked) {
    const isSchool = this.currentEntityType === 'school';
    const isNpc = isNpcType(this.currentEntityType);
    const isBc = this.currentEntityType === 'bc';
    const isHoa = this.currentEntityType === 'hoa';
    const isNpo = this.currentEntityType === 'npo';
    accountingPolicies.forEach(p => {
      if (p.schoolOnly && !isSchool) return;
      if (p.npcOnly && !isNpc) return;
      if (p.npoOnly && !isNpo) return;
      if (p.bcOnly && !isBc) return;
      if (p.hoaOnly && !isHoa) return;
      if (!this.policyAppliesToEntity(p)) return;
      const cb = document.getElementById(p.id);
      if (cb) {
        cb.checked = checked;
        const item = document.getElementById('pi-' + p.id);
        if (item) item.classList.toggle('checked', checked);
      }
      if (p.subItems && !p.isBio) {
        p.subItems.forEach(s => {
          const scb = document.getElementById(s.id);
          if (scb) {
            scb.checked = checked;
            if (!s.isLandAndBuildings) {
              const rw = document.getElementById('rate-wrap-' + s.id);
              if (rw) rw.style.display = checked ? 'flex' : 'none';
            }
          }
        });
      }
    });
    this.updatePolicyNumbers();
    this.liveUpdate();
  }

  updatePolicyNumbers() {
    let subCounter = 0;
    accountingPolicies.forEach(p => {
      const cb = document.getElementById(p.id);
      const item = document.getElementById('pi-' + p.id);
      if (!item) return;
      let badge = item.querySelector('.policy-num-badge');
      if (!cb || !cb.checked) {
        if (badge) badge.remove();
        return;
      }
      const origNum = p.originalNum || '';
      let displayNum;
      if (origNum === '1') {
        subCounter = 0;
        displayNum = '1';
      } else if (p.fixedNumber) {
        // Keeps its own top-level number (e.g. "2") — doesn't consume a 1.x slot
        displayNum = origNum;
      } else {
        subCounter++;
        displayNum = '1.' + subCounter;
      }
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'policy-num-badge';
        const header = item.querySelector('.policy-header');
        header.insertBefore(badge, header.querySelector('.policy-label'));
      }
      badge.textContent = displayNum;
    });
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // REPORT TYPE FUNCTIONS
  // ══════════════════════════════════════════════════════════════════════════════

  // Called only from the Step 3 radios' onchange — i.e. a user click. Loading a
  // statement (Open / Open in New Year) calls onReportTypeChange() directly and
  // never comes through here, so the saved engagement-letter ticks survive untouched.
  // The ticks are a starting point: the user may change them freely afterwards.
  onReportTypePicked() {
    const letters = REPORT_TYPE_ENGAGEMENT_LETTERS[getRadio('reportType')];
    if (letters && this.currentEntityType !== 'attorneys') {
      ['engTypeAccounting', 'engTypeReview', 'engTypeAudit'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = letters.includes(id);
      });
    }
    // Runs toggleEngagementTypes, which drops letters the entity can't have
    // (no review/audit for an individual, no accounting letter for a school).
    this.onReportTypeChange();
  }

  onReportTypeChange() {
    this._enforceAllowedReport();
    const type = getRadio('reportType');
    const isSchool = this.currentEntityType === 'school';
    const isAttorneys = this.currentEntityType === 'attorneys';
    // The preparer block is shown for every report type. It used to appear only
    // for a review or an audit, which made it look as though it had vanished
    // whenever a compilation or an attorneys audit was selected — the generator
    // silently fell back to the signatory's own credentials instead. It now
    // feeds the preparer sentence in all of those cases, and leaving it
    // untouched still produces that same fallback sentence.
    //
    // A school is the one exception: it has its own Preparer Full Name and
    // Preparer Capacity fields inside the school audit panel, and the generator
    // reads only those. Showing this block as well would give two contradicting
    // preparer inputs on one form.
    const needsPreparer = !isSchool;

    document.getElementById('report-sub-audit').style.display = (type === 'audit' && !isSchool && !isAttorneys) ? 'block' : 'none';
    document.getElementById('report-sub-audit-school').style.display = (type === 'audit' && isSchool) ? 'block' : 'none';
    document.getElementById('report-sub-audit-attorneys').style.display = (type === 'audit' && isAttorneys) ? 'block' : 'none';
    document.getElementById('report-sub-review').style.display = (type === 'review') ? 'block' : 'none';
    document.getElementById('report-sub-compilation').style.display = (type === 'compilation') ? 'block' : 'none';

    // Show/hide preparer block and update signer label
    const preparerBlock = document.getElementById('preparer-block');
    const signerLabel = document.getElementById('label-signer');
    if (preparerBlock) preparerBlock.style.display = needsPreparer ? 'block' : 'none';
    const schoolPreparerBlock = document.getElementById('school-preparer-block');
    if (schoolPreparerBlock) schoolPreparerBlock.style.display = isSchool ? 'block' : 'none';
    if (signerLabel) {
      signerLabel.textContent = type === 'compilation'
        ? 'Compiler / Signatory'
        : 'INF181 Signatory (Reviewer / Auditor)';
    }

    // Show engagement letter question for all report types and all entities
    const engBlock = document.getElementById('engagement-block');
    if (engBlock) engBlock.style.display = 'block';
    this._refreshPpra();
    this.toggleEngagementTypes();

    this.applyPageStartDefault();
    this.rebuildIndexInputs();
    this.updatePreparerPreview();
    this.liveUpdate();
  }

  // Drops a report type the entity no longer allows. Runs on every report-type
  // refresh, including after a load restores the saved radios, so an old save
  // (e.g. a trust saved as a review or audit) can't bring back a hidden option.
  // A trust is left on its only report, the compilation.
  _enforceAllowedReport() {
    const type = this.currentEntityType;
    const cfg = typeof getEntityConfig === 'function' ? getEntityConfig(type) : ENTITY_CONFIG[type];
    const allowed = (cfg && cfg.allowedReports) || ['compilation', 'review', 'audit'];
    const sel = document.querySelector('input[name="reportType"]:checked');
    if (sel && !allowed.includes(sel.value)) sel.checked = false;
    if (type === 'trust' && !getRadio('reportType')) {
      const comp = document.querySelector('input[name="reportType"][value="compilation"]');
      if (comp) comp.checked = true;
    }
  }

  // Fill "financial statements start on page" with the default for the chosen
  // report type. Skipped once the field carries a value the user (or a loaded
  // business) put there, so switching report type never discards it.
  // (Trust and school use their own start-page fields — trustPageStart /
  // schoolPageStart — whose defaults live in index.html.)
  applyPageStartDefault() {
    // An individual carries its own start/end pair (set in setEntityType, since
    // an individual has no report type to key on); switching back to any other
    // entity has to put the standard defaults back, or the individual's 1–5
    // range stays behind on a company.
    const endEl = document.getElementById('pageEnd');
    if (endEl && endEl.dataset.userSet !== '1') endEl.value = '12';
    const el = document.getElementById('pageStart');
    if (!el || el.dataset.userSet === '1') return;
    const def = PAGE_START_DEFAULTS[getRadio('reportType')];
    if (def) el.value = def;
  }

  toggleEngagementTypes() {
    const isAtt = this.currentEntityType === 'attorneys';
    const isIndiv = this.currentEntityType === 'individual';
    const isSchool = this.currentEntityType === 'school';
    const isTrust = this.currentEntityType === 'trust';
    document.getElementById('engagement-types-standard').style.display = isAtt ? 'none' : 'block';
    document.getElementById('engagement-types-attorneys').style.display = isAtt ? 'block' : 'none';
    // Individual and trust: only the accounting engagement letter (Appointment
    // to Provide Services). Unticking here also clears review/audit ticks an
    // older saved trust carried, since a load calls this after restoring them.
    const accountingOnly = isIndiv || isTrust;
    const engAccountingPill = document.getElementById('engTypeAccounting')?.closest('.option-pill');
    const engReviewPill = document.getElementById('engTypeReview')?.closest('.option-pill');
    const engAuditPill = document.getElementById('engTypeAudit')?.closest('.option-pill');
    if (engReviewPill) engReviewPill.style.display = accountingOnly ? 'none' : '';
    if (engAuditPill) engAuditPill.style.display = accountingOnly ? 'none' : '';
    if (accountingOnly) {
      document.getElementById('engTypeReview').checked = false;
      document.getElementById('engTypeAudit').checked = false;
    }
    // School: no accounting engagement letter
    if (engAccountingPill) engAccountingPill.style.display = isSchool ? 'none' : '';
    if (isSchool) document.getElementById('engTypeAccounting').checked = false;
    this.updateEngagementSignerUI();
  }

  onEngagementTypesChange() {
    this.updateEngagementSignerUI();
    this.liveUpdate();
  }

  onEngagementSignerChange(selectId) {
    // Mark this specific signer dropdown as manually changed by the user
    if (selectId) {
      const el = document.getElementById(selectId);
      if (el) el.dataset.userChanged = 'true';
    }
    this.updateEngagementSignerUI();
    this.liveUpdate();
  }

  onCompilerSignerChange() {
    // Sync engagement signer defaults to the main INF181 Signatory,
    // but only for signer dropdowns the user hasn't manually changed.
    const compiler = document.getElementById('compilerSigner')?.value || '';
    if (!compiler) return;

    ['engSignerAccounting', 'engSignerReview', 'engSignerAudit'].forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      if (sel.dataset.userChanged === 'true') return;
      const hasOption = Array.from(sel.options || []).some(o => o.value === compiler);
      if (hasOption) sel.value = compiler;
    });

    this.updateEngagementSignerUI();
    this.liveUpdate();
  }

  updateEngagementSignerUI() {
    const isAtt = this.currentEntityType === 'attorneys';
    const panel = document.getElementById('engagement-signers-panel');
    if (!panel) return;

    const attBox = document.getElementById('eng-signer-attorneys-box');
    if (attBox) attBox.style.display = (isAtt && document.getElementById('engTypeAttorneys')?.checked) ? 'block' : 'none';

    if (isAtt) {
      panel.style.display = 'none';
      const genBtn = document.getElementById('btn-generate');
      if (genBtn) genBtn.disabled = false;
      return;
    }

    // The Appointment to Provide Services letter is always signed
    // "INF181 GROUP PROJECT" — never an individual partner — so it takes no
    // part in the signer panel, the uniqueness rules or the required-signer check.
    const acc = false;
    const rev = !!document.getElementById('engTypeReview')?.checked;
    const aud = !!document.getElementById('engTypeAudit')?.checked;

    const any = rev || aud;
    panel.style.display = any ? 'block' : 'none';
    const accBox = document.getElementById('eng-signer-accounting-box');
    const revBox = document.getElementById('eng-signer-review-box');
    const audBox = document.getElementById('eng-signer-audit-box');
    if (accBox) accBox.style.display = acc ? 'block' : 'none';
    if (revBox) revBox.style.display = rev ? 'block' : 'none';
    if (audBox) audBox.style.display = aud ? 'block' : 'none';

    // Enforce unique signers across selected letters by warning + disabling duplicates.
    const accSel = document.getElementById('engSignerAccounting');
    const revSel = document.getElementById('engSignerReview');
    const audSel = document.getElementById('engSignerAudit');
    const warn = document.getElementById('engagement-signer-warning');

    // Default signer dropdowns to match compilerSigner unless the user has overridden them.
    const compiler = document.getElementById('compilerSigner')?.value || '';
    const setIfDefault = (el) => {
      if (!el) return;
      if (el.dataset.userChanged === 'true') return;
      if (!compiler) return;
      const hasOption = Array.from(el.options || []).some(o => o.value === compiler);
      if (hasOption) el.value = compiler;
    };
    setIfDefault(accSel);
    setIfDefault(revSel);
    setIfDefault(audSel);

    // If duplicates exist, auto-correct by picking the first available non-conflicting option,
    // resolving the restricted list first (Audit may only be signed by
    // A Anderson or R Clarke) so the wider lists — Review and Accounting —
    // absorb whoever is left.
    const pickFirstAvailable = (el, disallow) => {
      if (!el) return;
      const opt = Array.from(el.options).find(o => !disallow.has(o.value));
      if (opt) el.value = opt.value;
    };

    const used = new Set();
    if (aud && audSel) used.add(audSel.value);
    if (rev && revSel) {
      if (used.has(revSel.value)) pickFirstAvailable(revSel, used);
      used.add(revSel.value);
    }
    if (acc && accSel) {
      if (used.has(accSel.value)) pickFirstAvailable(accSel, used);
      used.add(accSel.value);
    }

    const chosen = [];
    if (acc && accSel) chosen.push(accSel.value);
    if (rev && revSel) chosen.push(revSel.value);
    if (aud && audSel) chosen.push(audSel.value);
    const hasDup = (new Set(chosen)).size !== chosen.length;
    if (warn) warn.style.display = hasDup ? 'block' : 'none';

    // Require explicit signer selection for each selected engagement letter type
    const missingAcc = acc && (!accSel || !accSel.value);
    const missingRev = rev && (!revSel || !revSel.value);
    const missingAud = aud && (!audSel || !audSel.value);
    const hasMissing = missingAcc || missingRev || missingAud;

    // Disable generate button if required signers missing or duplicate signers still present
    const genBtn = document.getElementById('btn-generate');
    if (genBtn) genBtn.disabled = (any && (hasMissing || hasDup));

    // Disable options already chosen by other selected letters
    const updateDisabled = (enabled, el, others) => {
      if (!el) return;
      Array.from(el.options).forEach(opt => {
        if (!enabled) { opt.disabled = false; return; }
        const usedElsewhere = others.includes(opt.value);
        opt.disabled = usedElsewhere && opt.value !== el.value;
      });
    };
    const accOthers = [];
    const revOthers = [];
    const audOthers = [];
    if (rev && revSel) { accOthers.push(revSel.value); audOthers.push(revSel.value); }
    if (aud && audSel) { accOthers.push(audSel.value); revOthers.push(audSel.value); }
    if (acc && accSel) { revOthers.push(accSel.value); audOthers.push(accSel.value); }

    updateDisabled(acc, accSel, accOthers);
    updateDisabled(rev, revSel, revOthers);
    updateDisabled(aud, audSel, audOthers);
  }

  onTradingAsToggle() {
    const show = getRadio('hasTradingAs') === 'yes';
    const box = document.getElementById('trading-as-box');
    if (box) box.classList.toggle('visible', show);
    if (!show) {
      const inp = document.getElementById('tradingAsName');
      if (inp) inp.value = '';
    }
    this.liveUpdate();
  }

  // Individual only: switch between the full annual financial statements and a
  // statement of assets and liabilities. The latter has no accounting policies,
  // so Step 7 goes away and the index collapses to its single line. Guarded on
  // the entity, so it can never hide Step 7 for an attorneys/church set.
  onIndividualStatementTypeChange() {
    if (this.currentEntityType !== 'individual') return;
    const hide = isAssetsLiabilitiesSet(this.currentEntityType);
    document.getElementById('step7-block').style.display = hide ? 'none' : '';
    document.getElementById('step7-divider').style.display = hide ? 'none' : '';
    this.rebuildIndexInputs();
    this.liveUpdate();
  }

  onSecondIndividualToggle(scrollIntoView) {
    const show = getRadio('hasSecondIndividual') === 'yes';
    const box = document.getElementById('second-individual-box');
    if (box) box.classList.toggle('visible', show);
    if (show) {
      // Start with one blank row so the fields are immediately visible.
      const list = document.getElementById('additional-individuals-list');
      if (list && !list.children.length) this.addAdditionalIndividual();
    } else {
      this.clearAdditionalIndividuals();
    }
    // Person 1's stand-alone fields fold into a card at the top of the list (or
    // fold back out) so every person on the documents is entered the same way.
    this._syncPrimaryIndividualCard();
    if (show && scrollIntoView) {
      document.getElementById('primary-individual-card')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    this.liveUpdate();
  }

  // Mirror the main Full Name / ID Number / Income Tax Number fields into a
  // "Person 1" card that matches the Person 2, 3, … cards — but only while the
  // "additional individuals" question is on Yes for an individual. The card's
  // inputs write straight back to the real fields (which stay the single source
  // of truth for the generator and the save file); the real fields are just
  // hidden while the card is up. Off Yes, the card is removed and the fields
  // come back exactly as they were.
  _syncPrimaryIndividualCard() {
    const holder = document.getElementById('primary-individual-card');
    if (!holder) return;

    const on = this.currentEntityType === 'individual'
            && getRadio('hasSecondIndividual') === 'yes';

    const nameGroup = document.getElementById('entity-name-group');
    const regGroup  = document.getElementById('reg-number-group');
    const taxGroup  = document.getElementById('individual-tax-group');
    // Person 1's Exceptions panel travels with the rest of Person 1's details.
    const decGroup  = document.getElementById('individual-deceased-group');
    const indExc    = document.getElementById('ind-exc');

    if (!on) {
      if (decGroup) {
        if (indExc && indExc.parentElement !== decGroup) decGroup.appendChild(indExc);
        decGroup.style.display = (this.currentEntityType === 'individual') ? '' : 'none';
      }
      if (nameGroup) nameGroup.style.display = '';
      if (regGroup) {
        regGroup.style.display =
          (this.currentEntityType === 'attorneys' && getRadio('attHasReg') === 'no') ? 'none' : '';
      }
      if (taxGroup) {
        taxGroup.style.display = (this.currentEntityType === 'individual') ? '' : 'none';
      }
      holder.innerHTML = '';
      return;
    }

    if (nameGroup) nameGroup.style.display = 'none';
    if (regGroup)  regGroup.style.display  = 'none';
    if (taxGroup)  taxGroup.style.display  = 'none';

    if (!holder.firstElementChild) {
      holder.innerHTML = `
      <div style="background:var(--panel);border:1.5px solid var(--border);border-radius:8px;padding:12px 14px;margin-bottom:10px;position:relative;">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;color:var(--ink-light);margin-bottom:10px;">Person 1</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;">
          <div class="field-group" style="margin-bottom:0;">
            <label>Full Name</label>
            <input type="text" id="p1-name" placeholder="e.g. Johan Peter Visser"
              oninput="entityManager.onPrimaryIndividualInput('companyName', this.value)">
          </div>
          <div class="field-group" style="margin-bottom:0;">
            <label>ID Number</label>
            <input type="text" id="p1-id" placeholder="e.g. 800101 5012 08 6"
              oninput="entityManager.onPrimaryIndividualInput('regNumber', this.value)">
          </div>
          <div class="field-group" style="margin-bottom:0;">
            <label>Income Tax Number</label>
            <input type="text" id="p1-tax" placeholder="e.g. 1234567890"
              oninput="entityManager.onPrimaryIndividualInput('taxNumber', this.value)">
          </div>
        </div>
      </div>`;
    }

    if (decGroup) decGroup.style.display = 'none';
    const p1Card = holder.firstElementChild;
    if (indExc && p1Card && indExc.parentElement !== p1Card) p1Card.appendChild(indExc);

    const mirror = (cardId, fieldId) => {
      const c = document.getElementById(cardId);
      const f = document.getElementById(fieldId);
      if (c && f) c.value = f.value;
    };
    mirror('p1-name', 'companyName');
    mirror('p1-id', 'regNumber');
    mirror('p1-tax', 'taxNumber');
  }

  onPrimaryIndividualInput(fieldId, value) {
    const el = document.getElementById(fieldId);
    if (el) el.value = value;
    this.liveUpdate();
  }

  // ── Additional individuals (individual entity — unlimited, e.g. spouses) ──

  addAdditionalIndividual() {
    this.additionalIndividualCount++;
    const idx = this.additionalIndividualCount;
    const list = document.getElementById('additional-individuals-list');
    if (!list) return;
    const card = document.createElement('div');
    card.id = `addi-card-${idx}`;
    card.style.cssText = 'background:var(--panel);border:1.5px solid var(--border);border-radius:8px;padding:12px 14px;margin-bottom:10px;position:relative;';
    card.innerHTML = `
    <button type="button" onclick="removeAdditionalIndividual(${idx})" title="Remove this person" style="position:absolute;top:8px;right:10px;background:none;border:none;cursor:pointer;font-size:15px;color:var(--ink-light);line-height:1;">✕</button>
    <div class="addi-card-title" style="font-size:11px;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;color:var(--ink-light);margin-bottom:10px;">Person ${idx + 1}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;">
      <div class="field-group" style="margin-bottom:0;">
        <label>Full Name</label>
        <input type="text" id="addi-name-${idx}" placeholder="e.g. John Citizen" oninput="liveUpdate()">
      </div>
      <div class="field-group" style="margin-bottom:0;">
        <label>ID Number</label>
        <input type="text" id="addi-id-${idx}" placeholder="e.g. 0000/000/00/0" oninput="liveUpdate()">
      </div>
      <div class="field-group" style="margin-bottom:0;">
        <label>Income Tax Number</label>
        <input type="text" id="addi-tax-${idx}" placeholder="e.g. 1234567890" oninput="liveUpdate()">
      </div>
    </div>
    <div class="person-exceptions" id="addi-exc-${idx}">
      <div class="person-exceptions-title">Exceptions</div>
      ${this._deceasedBlockHtml(`addi-deceased-${idx}`, `addi-deceased-date-${idx}`)}
    </div>`;
    list.appendChild(card);
    this._renumberAdditionalIndividuals();
  }

  removeAdditionalIndividual(idx) {
    const card = document.getElementById(`addi-card-${idx}`);
    if (card) card.remove();
    this._renumberAdditionalIndividuals();
    this.liveUpdate();
  }

  // Card titles count the main individual as Person 1, so cards run Person 2, 3, …
  // regardless of insertions and removals.
  _renumberAdditionalIndividuals() {
    const list = document.getElementById('additional-individuals-list');
    if (!list) return;
    Array.from(list.children).forEach((card, i) => {
      const title = card.querySelector('.addi-card-title');
      if (title) title.textContent = `Person ${i + 2}`;
    });
  }

  clearAdditionalIndividuals() {
    const list = document.getElementById('additional-individuals-list');
    if (list) list.innerHTML = '';
    this.additionalIndividualCount = 0;
  }

  // Every filled-in additional individual, in form order: { name, idNumber, taxNumber }.
  getAdditionalIndividuals() {
    if (getRadio('hasSecondIndividual') !== 'yes') return [];
    const out = [];
    for (let i = 1; i <= this.additionalIndividualCount; i++) {
      const nameEl = document.getElementById(`addi-name-${i}`);
      if (!nameEl) continue;
      const name = nameEl.value.trim();
      if (!name) continue;
      out.push({
        name,
        idNumber: (document.getElementById(`addi-id-${i}`)?.value || '').trim(),
        taxNumber: (document.getElementById(`addi-tax-${i}`)?.value || '').trim(),
        ...this._readDeceased(`addi-deceased-${i}`, `addi-deceased-date-${i}`),
      });
    }
    return out;
  }

  onAttOpinionTypeChange() {
    const t = getRadio('attOpinionType');
    toggleVisible('att-modified-box', t === 'modified');
    toggleVisible('att-disclaimer-box', t === 'disclaimer');
    this.liveUpdate();
  }

  toggleAttReg() {
    const show = getRadio('attHasReg') === 'yes';
    document.getElementById('reg-number-group').style.display = show ? '' : 'none';
    if (!show) document.getElementById('regNumber').value = '';
    this.liveUpdate();
  }

  onAuditTypeChange() {
    const t = getRadio('auditType');
    toggleVisible('audit-qualified-box', t === 'qualified');
    toggleVisible('audit-emphasis-box', t === 'emphasis');
    toggleVisible('audit-disclaimer-box', t === 'disclaimer');
    toggleVisible('audit-other-box', t === 'other');
    this.liveUpdate();
  }

  onSchoolAuditTypeChange() {
    const t = getRadio('schoolAuditType');
    toggleVisible('school-audit-qualified-box', t === 'qualified');
    const otherBox = document.getElementById('school-audit-other-box');
    if (otherBox) otherBox.classList.toggle('visible', t === 'unqualified' || t === 'qualified');
    toggleVisible('school-audit-disclaimer-box', t === 'disclaimer');
    this.liveUpdate();
  }

  onSchoolPreparerCapacityChange() {
    const v = document.getElementById('schoolPreparerCapacity')?.value;
    const otherInput = document.getElementById('schoolPreparerCapacityOther');
    if (otherInput) otherInput.style.display = (v === 'other') ? 'block' : 'none';
    this.updateSchoolPreparerPreview();
  }

  updateSchoolPreparerPreview() {
    const name = (document.getElementById('schoolPreparerName')?.value || '').trim();
    const capEl = document.getElementById('schoolPreparerCapacity');
    const capRaw = capEl?.value || 'financial officer';
    const capOther = (document.getElementById('schoolPreparerCapacityOther')?.value || '').trim();
    const cap = capRaw === 'other' ? (capOther || '\u2026') : capRaw;
    const preview = document.getElementById('school-preparer-preview');
    if (preview) {
      preview.textContent = name
        ? `The financial statements were prepared under the supervision of ${name} in their capacity as ${cap}.`
        : '';
    }
  }

  onPreparerCapacityChange() {
    const v = document.getElementById('preparerCapacity')?.value;
    const otherInput = document.getElementById('preparerCapacityOther');
    if (otherInput) otherInput.style.display = (v === 'other') ? 'block' : 'none';
    this.updatePreparerPreview();
  }

  onBcEventsChange() {
    const v = getRadio('bcEvents');
    toggleVisible('bc-events-box', v === 'custom');
    this.liveUpdate();
  }

  onBcMgmtRulesChange() {
    const v = getRadio('bcMgmtRules');
    toggleVisible('bc-mgmt-rules-box', v === 'custom');
    this.liveUpdate();
  }

  onTrustDeedChange() {
    const v = getRadio('trustDeedChanges');
    toggleVisible('trust-deed-box', v === 'custom');
    this.liveUpdate();
  }

  // The resolution date and representative only matter when the resolution
  // page is generated, i.e. once "Yes" is picked (nothing is pre-selected).
  onTrustResolutionLetterChange() {
    // An answer picked by hand (or restored from a save) is the user's own, so
    // the bank-account default below no longer takes it back.
    delete document.getElementById('trust-resolution-box').dataset.autoYes;
    toggleVisible('trust-resolution-box', getRadio('trustResolutionLetter') === 'yes');
    this.liveUpdate();
  }

  // "No bank account" defaults the letter of resolution to Yes — the resolution
  // records the decision to close the account. It only fills an unanswered
  // question, never overrides an answer, and takes back only its own Yes if the
  // bank answer is switched back to "has".
  onTrustBankAcctChange() {
    const box = document.getElementById('trust-resolution-box');
    const answer = getRadio('trustResolutionLetter');
    const bank = getRadio('trustBankAcct');
    if (bank === 'none' && !answer) {
      const yes = document.querySelector('input[name="trustResolutionLetter"][value="yes"]');
      if (yes) {
        yes.checked = true;
        box.dataset.autoYes = '1';
      }
    } else if (bank === 'has' && answer === 'yes' && box.dataset.autoYes) {
      document.querySelectorAll('input[name="trustResolutionLetter"]').forEach(r => { r.checked = false; });
      delete box.dataset.autoYes;
    }
    toggleVisible('trust-resolution-box', getRadio('trustResolutionLetter') === 'yes');
    this.liveUpdate();
  }


  static PREPARER_MAP = {
    fiona:    'The financial statements were prepared under the supervision of Fiona Evans B Compt. Professional Accountant (SA) in her capacity as an independent accounting professional.',
    alice:     'The financial statements were prepared under the supervision of Alice Anderson BCom CA (SA) in his capacity as an independent professional accountant.',
    hl:       'The financial statements were prepared under the supervision of Henry Brooks BAcc CA (SA) in his capacity as an independent professional accountant.',
    rita: 'The financial statements were prepared under the supervision of Rita Clarke BCompt CA (SA) in her capacity as an independent professional accountant.',
    rosa:   'The financial statements were prepared under the supervision of Rosa Daniels BCompt CA (SA) in her capacity as an independent professional accountant.',
  };

  selectPreparerQuick() {
    const choice = document.getElementById('preparerQuickSelect')?.value;
    const nameInput = document.getElementById('preparerName');
    const capacityGroup = document.getElementById('preparerCapacityGroup');
    const isCustom = (choice === 'custom');
    if (nameInput) { nameInput.style.display = isCustom ? '' : 'none'; if (!isCustom) nameInput.value = ''; }
    if (capacityGroup) { capacityGroup.style.display = isCustom ? '' : 'none'; }
    this.updatePreparerPreview();
    this.liveUpdate();
  }

  updatePreparerPreview() {
    const quickSelect = document.getElementById('preparerQuickSelect')?.value;
    const preview = document.getElementById('preparer-preview');
    if (quickSelect && quickSelect !== 'custom' && EntityManager.PREPARER_MAP[quickSelect]) {
      if (preview) preview.textContent = EntityManager.PREPARER_MAP[quickSelect];
      return;
    }
    const name = (document.getElementById('preparerName')?.value || '').trim();
    const capEl = document.getElementById('preparerCapacity');
    const capRaw = capEl?.value || 'financial officer';
    const capOther = (document.getElementById('preparerCapacityOther')?.value || '').trim();
    const cap = capRaw === 'other' ? (capOther || '\u2026') : capRaw;
    if (preview) {
      preview.textContent = name
        ? `The financial statements were prepared under the supervision of ${name} in their capacity as ${cap}.`
        : '';
    }
  }

  onReviewTypeChange() {
    const t = getRadio('reviewType');
    toggleVisible('review-qualified-box', t === 'qualified');
    if (t === 'qualified') this.onReviewQualifiedBasisChange();
    this.liveUpdate();
  }

  onReviewQualifiedBasisChange() {
    const b = getRadio('reviewQualifiedBasis');
    toggleVisible('review-qualified-insolvent-box', b === 'insolvent');
    toggleVisible('review-qualified-custom-box', b === 'custom');
    toggleVisible('review-qualified-trust-box', b === 'trustDeficit');
    if (b === 'trustDeficit') this.onReviewTrustAmountsInput(true);
    const groupNoteLabel = document.getElementById('review-group-note-label');
    if (groupNoteLabel) groupNoteLabel.style.display = (b === 'group') ? 'flex' : 'none';
    this.liveUpdate();
  }

  // ── PPRA (property practitioner) company ──
  // The company-only radio in Step 2. Shows its hint, offers the trust-deficit
  // basis on the review panel, and holds the review signers to the registered
  // auditors. Safe to run any number of times (selectEntity, every report-type
  // change, and the radio's own change event on load all call it).
  onPpraChange() {
    this._refreshPpra();
    this.liveUpdate();
  }

  _refreshPpra() {
    const type = this.currentEntityType;
    const ppra = typeof isPpraCompany === 'function' && isPpraCompany(type);
    const hint = document.getElementById('ppra-hint');
    if (hint) hint.style.display = ppra ? '' : 'none';

    // The trust-deficit basis exists only for a PPRA company. Turning PPRA off
    // while it is picked drops the pick rather than leaving a hidden choice.
    const pill = document.getElementById('review-basis-trust-pill');
    if (pill) pill.style.display = ppra ? '' : 'none';
    if (!ppra && getRadio('reviewQualifiedBasis') === 'trustDeficit') {
      const r = document.querySelector('input[name="reviewQualifiedBasis"][value="trustDeficit"]');
      if (r) r.checked = false;
      toggleVisible('review-qualified-trust-box', false);
    }

    // A PPRA review is signed by a registered auditor. The other partners stay
    // in the lists but cannot be picked while it applies; a pick of one of them
    // moves to the first registered auditor.
    const restrict = ppra && getRadio('reportType') === 'review';
    const allowed = (typeof PPRA_SIGNERS !== 'undefined') ? PPRA_SIGNERS : ['A ANDERSON', 'R CLARKE'];
    let moved = false;
    ['compilerSigner', 'engSignerReview'].forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      Array.from(sel.options).forEach(o => {
        if (!o.value) return;
        o.disabled = restrict && !allowed.includes(o.value);
      });
      if (restrict && sel.value && !allowed.includes(sel.value)) {
        sel.value = allowed[0];
        moved = true;
      }
    });
    if (moved) this.updateEngagementSignerUI();
  }

  // Shows the worked-out trust deficit under the two amounts.
  onReviewTrustAmountsInput(skipUpdate) {
    const out = document.getElementById('review-trust-deficit-preview');
    if (out) {
      const d = ppraTrustDeficit(document.getElementById('reviewTrustCreditors')?.value,
        document.getElementById('reviewTrustFunds')?.value);
      out.textContent = d === null ? 'Trust deficit: enter both amounts.'
        : d > 0 ? `Trust deficit: R ${formatNumber(String(d))}`
        : 'Trust funds cover the trust creditors — there is no deficit.';
    }
    if (skipUpdate !== true) this.liveUpdate();
  }

  onCompilationTypeChange() {
    const t = getRadio('compilationType');
    toggleVisible('compilation-insolvent-box', t === 'insolvent');
    toggleVisible('compilation-other-box', t === 'other');
    this.liveUpdate();
  }

  getReportSubState() {
    const type = getRadio('reportType');
    if (type === 'audit') {
      if (this.currentEntityType === 'school') {
        const sub = getRadio('schoolAuditType');
        return {
          reportType: 'audit',
          entityType: 'school',
          subType: sub,
          qualifiedText: document.getElementById('schoolAuditQualifiedText')?.value.trim() || '',
          otherText: document.getElementById('schoolAuditOtherText')?.value.trim() || '',
          disclaimerText: document.getElementById('schoolAuditDisclaimerText')?.value.trim() || '',
        };
      }
      const sub = getRadio('auditType');
      return {
        reportType: 'audit',
        subType: sub,
        qualifiedText: document.getElementById('auditQualifiedText')?.value.trim() || '',
        emphasisText: document.getElementById('auditEmphasisText')?.value.trim() || '',
        disclaimerText: document.getElementById('auditDisclaimerText')?.value.trim() || '',
        otherText: document.getElementById('auditOtherText')?.value.trim() || '',
      };
    }
    if (type === 'review') {
      const sub = getRadio('reviewType');
      const qualifiedBasis = getRadio('reviewQualifiedBasis');
      return {
        reportType: 'review',
        subType: sub,
        qualifiedBasis: qualifiedBasis,
        qualifiedText: document.getElementById('reviewQualifiedText')?.value.trim() || '',
        reviewAccLoss: document.getElementById('reviewAccLoss')?.value.trim() || '',
        reviewExcessLiab: document.getElementById('reviewExcessLiab')?.value.trim() || '',
        trustCause: document.getElementById('reviewTrustCause')?.value.trim() || '',
        trustCreditors: document.getElementById('reviewTrustCreditors')?.value.trim() || '',
        trustFunds: document.getElementById('reviewTrustFunds')?.value.trim() || '',
        trustRemedied: !!document.getElementById('reviewTrustRemedied')?.checked,
      };
    }
    // compilation
    const sub = getRadio('compilationType');
    return {
      reportType: 'compilation',
      subType: sub,
      insolventText: document.getElementById('compilationInsolventText')?.value.trim() || '',
      otherText: document.getElementById('compilationOtherText')?.value.trim() || '',
    };
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // AUTO-FILL PREVIOUS YEAR
  // ══════════════════════════════════════════════════════════════════════════════

  autoFillPrevYear() {
    const raw = document.getElementById('yearEnd').value.trim();
    if (!raw) return;
    const months = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
    const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    let day = null, month = null, year = null;
    const named = raw.match(/^(\d{1,2}\s+)?([A-Za-z]+)\s+(\d{4})$/);
    if (named) {
      day = named[1] ? named[1].trim() : null;
      month = months[named[2].toLowerCase()];
      year = parseInt(named[3]);
    }
    if (!month) {
      const slashed = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/) || raw.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
      if (slashed) {
        const a = parseInt(slashed[1]), b = parseInt(slashed[2]), c = parseInt(slashed[3]);
        if (a > 31) { year = a; month = b; day = c; }
        else { day = a; month = b; year = c; }
      }
    }
    if (!month || !year) return;
    const prevField = document.getElementById('prevYearEnd');
    prevField.value = day ? `${day} ${monthNames[month]} ${year - 1}` : `${monthNames[month]} ${year - 1}`;
  }

  // The NPC governing-body radio changes every piece of wording derived from
  // ENTITY_CONFIG — the section title, the add button, and the index labels — so
  // it re-runs the same updates selectEntity does for those three.
  onNpcBodyChange() {
    if (!isNpcType(this.currentEntityType)) return;
    const cfg = getEntityConfig(this.currentEntityType);
    const title = document.getElementById('directors-section-title');
    if (title) title.textContent = cfg.bodyTitle;
    const addBtn = document.querySelector('.btn-add');
    if (addBtn) addBtn.textContent = cfg.addBtnLabel;
    this._refreshBoardRepLabels();
    this.rebuildIndexInputs();
    this.liveUpdate();
  }

  // An NPO's governing body (members / directors) words the NPO auditor's
  // report. It no longer touches the index (the Responsibilities and Approval
  // row went with the page in 4.90.0).
  onNpoBodyChange() {
    if (this.currentEntityType !== 'npo') return;
    this.liveUpdate();
  }

  // Index rows are rebuilt from the config whenever the entity type, report
  // type or NPC body changes. What was typed into them is remembered per
  // entity/report combination, so visiting another type and coming back does
  // not throw away the labels and page numbers the user set.
  _rememberIndexInputs(container) {
    if (!this._indexKey) return;
    const typed = {};
    container.querySelectorAll('input').forEach(el => {
      if (el.id && el.value !== el.defaultValue) typed[el.id] = el.value;
    });
    this._indexMemo = this._indexMemo || {};
    this._indexMemo[this._indexKey] = typed;
  }

  // A load or a new statement: remembered index values belong to the last one.
  forgetIndexInputs() {
    this._indexMemo = {};
    this._indexKey = null;
  }

  rebuildIndexInputs() {
    const group = document.getElementById('index-page-group');
    const container = document.getElementById('index-page-inputs');
    if (!group || !container) return;

    const reportType = getRadio('reportType');
    const cfg = typeof getIndexConfig === 'function'
      ? getIndexConfig(this.currentEntityType, reportType)
      : null;

    this._rememberIndexInputs(container);
    const key = `${this.currentEntityType}-${reportType}`;
    this._indexKey = cfg ? key : null;

    if (!cfg) {
      group.style.display = 'none';
      container.innerHTML = '';
      return;
    }

    group.style.display = 'block';
    container.innerHTML = cfg.map((item, i) => {
      const pageId = `idx-${item.id}`;
      const labelId = `idx-label-${item.id}`;
      const label = item.label.replace(/\n/g, ' ');
      return `<div class="field-group index-field-row">
        <input type="text" class="idx-label-input" id="${labelId}" value="${label}" oninput="liveUpdate()">
        <input type="text" class="idx-page-input" id="${pageId}" placeholder="${i + 1}" oninput="liveUpdate()" value="${i + 1}">
      </div>`;
    }).join('');

    const typed = this._indexMemo && this._indexMemo[key];
    if (typed) {
      Object.keys(typed).forEach(id => {
        const el = document.getElementById(id);
        if (el && container.contains(el)) el.value = typed[id];
      });
    }
  }
}
