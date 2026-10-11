// BusinessInfoManager.js — Export / Import / Edit business information as JSON
// Depends on: config.js (accountingPolicies), utils.js (getVal, getRadio)

// Radio groups and checkboxes whose side effects applyFormState runs by hand
// (the entityManager toggles below). Anything else on the form is picked up by
// the catch-all in collectFormState and gets a 'change' event on load instead.
const BIM_RADIOS = [
  'hasTradingAs', 'hasSecondIndividual', 'individualStatementType', 'attHasReg', 'reportType',
  'auditType', 'schoolAuditType', 'attOpinionType', 'attGovType',
  'attInvestment', 'attOtherReport', 'attAuditor', 'attEngSigner',
  'reviewType', 'reviewQualifiedBasis',
  'compilationType',
  'shareCapital', 'dividends', 'fixedAssets',
  'plType', 'prevPlType', 'outlook', 'parentCo', 'groupCo',
  'schoolAuditor',
  'bcEvents', 'bcContribType', 'bcPrevContribType', 'bcMgmtRules', 'bcAGM',
  'trustBankAcct', 'trustTax', 'trustDistributions', 'trustDonations',
  'trustRemuneration', 'trustDeedChanges', 'trustResolutionLetter',
  'churchPolicies',
  'ppeResidualInclude',
  'npcBody', 'npcSection21',
];
const BIM_CHECKBOXES = ['engTypeAccounting', 'engTypeReview', 'engTypeAudit', 'engTypeAttorneys', 'reviewGroupDirectorsNote', 'indDeceased'];
// Meeting / AGM dates that auto-fill from the approval date or Date of Issue.
const BIM_AUTO_DATES = ['bcAGMDate', 'trustAGMDate', 'minutes-date', 'cc-minutes-date', 'trustResolutionDate'];
// The auto dates a save made before 4.26.0 knew about. A field outside the list
// a save carries (state.autoDateFields, or this one for older saves) was not an
// auto date when it was saved, so a blank one starts tracking on load.
const BIM_AUTO_DATES_LEGACY = ['bcAGMDate', 'trustAGMDate', 'minutes-date', 'cc-minutes-date'];

class BusinessInfoManager {
  constructor(entityManager) {
    this.entityManager = entityManager;
    // The database id of the business currently loaded from the server, or null when the
    // form holds a brand-new / imported-from-file business. Save uses this to decide
    // between updating the existing record and creating a new one.
    this.currentBusinessId = null;

    // Release any held lock when the tab closes or navigates away.
    // Uses sendBeacon so the request survives page teardown.
    window.addEventListener('beforeunload', () => this._releaseLockQuietly(true));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // LOCKING — prevent two users from editing the same business simultaneously
  // ════════════════════════════════════════════════════════════════════════════

  _deviceLabel() {
    if (typeof getUserName === 'function') {
      var name = getUserName();
      if (name) return name;
    }
    if (typeof window !== 'undefined' && window.POLICYGEN_CONFIG && window.POLICYGEN_CONFIG.deviceLabel) {
      return window.POLICYGEN_CONFIG.deviceLabel;
    }
    try {
      var saved = localStorage.getItem('policygenDeviceLabel');
      if (saved) return saved;
    } catch (_) {}
    if (typeof location !== 'undefined' && location.hostname) return location.hostname;
    return 'Unknown PC';
  }

  async _acquireLock(bizId) {
    if (DataStore.isOffline() || bizId == null) return true;
    try {
      var result = await DataStore.acquireLock(bizId, this._deviceLabel());
      if (result.locked === false) {
        this._showLockWarning(result.holder, result.lockedAt);
        return false;
      }
      return true;
    } catch (_) {
      return true;
    }
  }

  _releaseLockQuietly(useBeacon) {
    if (this.currentBusinessId != null && !DataStore.isOffline()) {
      if (useBeacon && navigator.sendBeacon) {
        navigator.sendBeacon(
          DataStore.baseUrl() + '/api/locks/' + this.currentBusinessId + '/release',
          new Blob([JSON.stringify({ clientId: DataStore.clientId() })],
            { type: 'application/json' })
        );
      } else {
        try { DataStore.releaseLock(this.currentBusinessId); } catch (_) {}
      }
    }
  }

  _showLockWarning(holder, lockedAt) {
    var since = '';
    if (lockedAt) {
      var d = new Date(lockedAt);
      since = ' since ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    var msg = (holder || 'Another user') + ' is currently editing this business' + since + '.\n\n' +
      'To avoid overwriting each other\'s work, only one person can edit a business at a time.\n\n' +
      'Please wait until they are done, or ask them to close the business first.';
    BusinessInfoManager.showToast((holder || 'Another user') + ' is editing this business — it\'s locked.', 'error', 8000);
    alert(msg);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // COLLECT — read every form field into a plain object
  // ════════════════════════════════════════════════════════════════════════════

  collectFormState() {
    const state = { _version: 1, _exportedAt: new Date().toISOString() };

    // Entity type
    state.entityType = this.entityManager.currentEntityType || '';

    // Simple text inputs
    const textFields = [
      'companyName', 'tradingAsName', 'regNumber', 'taxNumber', 'indDeceasedDate',
      'yearEnd', 'prevYearEnd',
      'natureBusiness', 'mainIncome', 'postalAddress', 'regAddress',
      'physAddress', 'businessAddress', 'dateApproved', 'dateSigned', 'dateOfIssue',
      'profitLoss', 'prevProfitLoss', 'shareCapitalOther', 'dividendAmount', 'parentName', 'subsidiaryName',
      'pageStart', 'pageEnd',
      'insolventAccLoss', 'insolventExcessLiab', 'compilationInsolventText',
      'compilationOtherText',
      'reviewAccLoss', 'reviewExcessLiab', 'reviewQualifiedText',
      'auditQualifiedText', 'auditEmphasisText', 'auditDisclaimerText', 'auditOtherText',
      'schoolPageStart', 'schoolPageEnd',
      'schoolPreparerName', 'schoolPreparerCapacityOther', 'schoolEduDept',
      'npcOrgName', 'npoOrgName', 'npoDeptName', 'npoDeptOf', 'ppeStmtName',
      'schoolAuditQualifiedText', 'schoolAuditOtherText', 'schoolAuditDisclaimerText',
      'preparerName', 'preparerCapacityOther',
      'attModifiedText', 'attDisclaimerText', 'attOtherReportText',
      'bcSchemeAddress', 'bcEventsText', 'bcContribAmount', 'bcPrevYear',
      'bcPrevContribAmount', 'bcMgmtRulesText', 'bcAGMVenue', 'bcAGMDate',
      'trustPageStart', 'trustPageEnd',
      'trustAGMVenue', 'trustAGMDate', 'trustDeedText', 'trustLoaText',
      'minutes-venue', 'minutes-date',
      'cc-minutes-venue', 'cc-minutes-date',
      'ppeResidualPercent',
    ];
    state.textFields = {};
    textFields.forEach(id => {
      const el = document.getElementById(id);
      if (el) state.textFields[id] = el.value;
    });
    // Meeting dates still on auto (the user never typed into them). A blank one
    // saved like this keeps tracking its source date when reopened, instead of
    // being locked blank — a new year leaves them blank on purpose.
    state.autoDates = BIM_AUTO_DATES.filter(id => document.getElementById(id)?.dataset.auto === '1');
    state.autoDateFields = BIM_AUTO_DATES.slice();
    document.querySelectorAll('#index-page-inputs input[id^="idx-"]').forEach(el => {
      state.textFields[el.id] = el.value;
    });

    // Select dropdowns
    const selects = [
      'bankSelect', 'compilerSigner', 'schoolPreparerCapacity',
      'preparerCapacity', 'preparerQuickSelect',
      'engSignerAccounting', 'engSignerReview', 'engSignerAudit',
    ];
    state.selects = {};
    selects.forEach(id => {
      const el = document.getElementById(id);
      if (el) state.selects[id] = el.value;
    });

    // Bank. bankName is a hidden field derived from the dropdown (or the "Other"
    // box), so it is recomputed here rather than read back — the hidden input
    // can fall out of step with the dropdown, and a save would then record no
    // bank while the dropdown the auditor saw showed one.
    const bankSel = document.getElementById('bankSelect')?.value || '';
    const bankOther = document.getElementById('bankOther')?.value || '';
    state.textFields['bankOther'] = bankOther;
    state.textFields['bankName'] = bankSel === 'other' ? bankOther : bankSel;

    // Radio buttons
    state.radios = {};
    BIM_RADIOS.forEach(name => {
      const checked = document.querySelector(`input[name="${name}"]:checked`);
      if (checked) state.radios[name] = checked.value;
    });

    // Checkboxes (engagement types)
    state.checkboxes = {};
    BIM_CHECKBOXES.forEach(id => {
      const el = document.getElementById(id);
      if (el) state.checkboxes[id] = el.checked;
    });

    // Directors
    state.directors = [];
    this.entityManager.directors.forEach(d => {
      const init = document.getElementById(`dir-init-${d.id}`)?.value || '';
      const sur = document.getElementById(`dir-sur-${d.id}`)?.value || '';
      const idNo = document.getElementById(`dir-id-${d.id}`)?.value || '';
      const isIndTrustee = !!document.getElementById(`dir-ind-${d.id}`)?.checked;
      const indType = document.querySelector(`input[name="dir-ind-type-${d.id}"]:checked`)?.value || 'business';
      const indBizName = document.getElementById(`dir-ind-biz-${d.id}`)?.value || '';
      const indBizReg = document.getElementById(`dir-ind-reg-${d.id}`)?.value || '';
      const signsForBoard = !!document.getElementById(`dir-board-rep-${d.id}`)?.checked;
      const entry = { initials: init, surname: sur, idNumber: idNo };
      if (signsForBoard) entry.signsForBoard = true;
      if (document.getElementById(`dir-deceased-${d.id}`)?.checked) {
        entry.deceased = true;
        entry.deceasedDate = document.getElementById(`dir-deceased-date-${d.id}`)?.value || '';
      }
      if (isIndTrustee) {
        entry.isIndependentTrustee = true;
        entry.indTrusteeType = indType;
        if (document.querySelector(`input[name="dir-ind-sign-${d.id}"]:checked`)?.value === 'all') entry.indSignsAll = true;
        if (indType === 'business') {
          entry.indBusinessName = indBizName;
          entry.indBusinessReg = indBizReg;
        }
      }
      state.directors.push(entry);
    });

    // Additional individuals (individual entity — unlimited)
    state.additionalIndividuals = [];
    for (let i = 1; i <= this.entityManager.additionalIndividualCount; i++) {
      const nameEl = document.getElementById(`addi-name-${i}`);
      if (!nameEl) continue;
      const entry = {
        name: nameEl.value || '',
        idNumber: document.getElementById(`addi-id-${i}`)?.value || '',
        taxNumber: document.getElementById(`addi-tax-${i}`)?.value || '',
      };
      if (document.getElementById(`addi-deceased-${i}`)?.checked) {
        entry.deceased = true;
        entry.deceasedDate = document.getElementById(`addi-deceased-date-${i}`)?.value || '';
      }
      state.additionalIndividuals.push(entry);
    }

    // Shareholders
    state.shareholders = [];
    for (let i = 1; i <= this.entityManager.shareholderCount; i++) {
      if (!document.getElementById(`sh-card-${i}`)) continue;
      const name = document.getElementById(`sh-name-${i}`)?.value || '';
      const type = document.querySelector(`input[name="sh-type-${i}"]:checked`)?.value || 'individual';
      const proxy = document.getElementById(`sh-proxy-${i}`)?.value || '';
      state.shareholders.push({ name, type, proxy });
    }

    // Loan certificates
    state.loanCerts = [];
    for (let i = 1; i <= this.entityManager.loanCertCount; i++) {
      if (!document.getElementById(`loan-cert-card-${i}`)) continue;
      const name = document.getElementById(`lc-name-${i}`)?.value || '';
      const balance = document.querySelector(`input[name="lc-balance-${i}"]:checked`)?.value || 'credit';
      const amount = document.getElementById(`lc-amount-${i}`)?.value || '';
      const dateEl = document.getElementById(`lc-date-${i}`);
      const date = dateEl?.value || '';
      const entry = { name, balance, amount, date };
      // Still tracking the Date of Issue (never typed into) — see applyFormState.
      if (dateEl && dateEl.dataset.auto === '1') entry.auto = true;
      state.loanCerts.push(entry);
    }

    // Accounting policies
    state.policies = {};
    state.policyEdits = {};
    accountingPolicies.forEach(p => {
      const cb = document.getElementById(p.id);
      if (cb) state.policies[p.id] = cb.checked;

      // Save inline text edits. An edit is the wording now in force — the open
      // editor, else the display (which a closed editor wrote back to) — when it
      // differs from the policy's unedited wording. Comparing against the display
      // instead lost every edit whose editor had been closed, and every edit on a
      // reopened statement (the load writes it into both), on the next save.
      const editArea = document.getElementById(`policy-edit-${p.id}`);
      if (editArea) {
        const displayEl = document.getElementById(`policy-text-${p.id}`);
        const editing = editArea.style.display !== 'none';
        const current = editing || !displayEl ? editArea.value : policyHtmlToText(displayEl.innerHTML);
        const unedited = policyHtmlToText(this.entityManager.defaultPolicyText(p));
        const norm = t => String(t || '').replace(/\r\n?/g, '\n').trim();
        if (norm(current) !== norm(unedited)) {
          state.policyEdits[p.id] = current;
        }
      }

      // Deferred tax asset checkbox
      if (p.deferredAssetSentence) {
        const deftaxCb = document.getElementById('deftax-no-asset');
        if (deftaxCb) state.policies['deftax-no-asset'] = deftaxCb.checked;
      }

      // Policy-level text variant radio pills
      if (p.textOptions) {
        const checked = document.querySelector(`input[name="textopt-${p.id}"]:checked`);
        if (checked) state.policies[`sel-${p.id}`] = checked.value;
      }

      if (p.subItems) {
        p.subItems.forEach(s => {
          const scb = document.getElementById(s.id);
          if (scb) state.policies[s.id] = scb.checked;
          const sel = document.getElementById(`sel-${s.id}`);
          if (sel) state.policies[`sel-${s.id}`] = sel.value;
          const custom = document.getElementById(`custom-${s.id}`);
          if (custom) state.policies[`custom-${s.id}`] = custom.value;
          const residual = document.getElementById(`residual-${s.id}`);
          if (residual) state.policies[`residual-${s.id}`] = residual.value;
        });
      }

      if (p.id === 'pol_ppe') {
        const depCb = document.getElementById('ppe-depreciation-include');
        if (depCb) state.policies['ppe-depreciation-include'] = depCb.checked;
      }
    });

    // Custom PPE sub-items
    if (typeof getCustomPpeSubItems === 'function') {
      state.customPpeSubItems = getCustomPpeSubItems();
    }

    // Custom accounting policies
    if (typeof getCustomPolicies === 'function') {
      state.customPolicies = getCustomPolicies();
    }

    // Catch-all: every other field on the form. The lists above were written
    // by hand and a field added later could be missed (trustResolutionDate was),
    // so anything with an id / radio name that nothing above captured is saved
    // here too. applyFormState's generic loops restore it without changes.
    this._formControls().forEach(el => {
      const type = (el.type || '').toLowerCase();
      if (type === 'radio') {
        if (el.checked && el.name && !(el.name in state.radios)) state.radios[el.name] = el.value;
      } else if (type === 'checkbox') {
        if (!(el.id in state.checkboxes) && !(el.id in state.policies)) state.checkboxes[el.id] = el.checked;
      } else if (!(el.id in state.textFields) && !(el.id in state.selects)) {
        (el.tagName === 'SELECT' ? state.selects : state.textFields)[el.id] = el.value;
      }
    });

    return state;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // FORM CONTROLS — the generic view of the left-hand side
  // ════════════════════════════════════════════════════════════════════════════

  // Fields saved in their own structure (director / shareholder / loan-cert /
  // individual rows, index pages, policies) rather than by plain id. The
  // catch-all and the load-time reset leave these to their dedicated code.
  _isStructuredField(key) {
    if (/^(dir-|sh-|lc-|addi-|p1-|idx-|policy-edit-|sel-|custom-|residual-|textopt-)/.test(key)) return true;
    if (key === 'deftax-no-asset' || key === 'ppe-depreciation-include') return true;
    return accountingPolicies.some(p => p.id === key || (p.subItems || []).some(s => s.id === key));
  }

  // Every saveable control on the form panel: has an id (or a name, for radios)
  // and is not part of a structured row.
  _formControls() {
    const panel = document.querySelector('.form-panel');
    if (!panel) return [];
    return Array.from(panel.querySelectorAll('input, select, textarea')).filter(el => {
      const type = (el.type || '').toLowerCase();
      if (type === 'button' || type === 'submit' || type === 'file') return false;
      const key = type === 'radio' ? el.name : el.id;
      return !!key && !this._isStructuredField(key);
    });
  }

  // Saves from before 3.10.0 carry the "Do you require an engagement letter?"
  // Yes/No radio, which no longer exists: the ticked letter types alone decide.
  // No -> no letter, whatever boxes the save still has ticked. Yes on an
  // attorneys statement -> its one letter, which is now a checkbox of its own.
  _migrateEngagementLetter(state) {
    const answer = state.radios?.engagementLetter;
    if (answer !== 'yes' && answer !== 'no') return state;
    const radios = { ...state.radios };
    delete radios.engagementLetter;
    const checkboxes = { ...(state.checkboxes || {}) };
    if (answer === 'no') {
      ['engTypeAccounting', 'engTypeReview', 'engTypeAudit', 'engTypeAttorneys'].forEach(id => { checkboxes[id] = false; });
    } else if (!('engTypeAttorneys' in checkboxes)) {
      checkboxes.engTypeAttorneys = state.entityType === 'attorneys';
    }
    return { ...state, radios, checkboxes };
  }

  // A field the saved statement does not mention (it was saved before the field
  // existed) goes back to its blank form default. Without this it would keep
  // whatever the previously open business had typed there.
  _resetFieldsMissingFrom(state) {
    const tf = state.textFields || {}, sel = state.selects || {};
    const radios = state.radios || {}, cbs = state.checkboxes || {};
    this._formControls().forEach(el => {
      const type = (el.type || '').toLowerCase();
      if (type === 'radio') {
        if (!(el.name in radios)) el.checked = el.defaultChecked;
      } else if (type === 'checkbox') {
        if (!(el.id in cbs)) el.checked = el.defaultChecked;
      } else if (el.tagName === 'SELECT') {
        if (!(el.id in sel)) {
          const def = Array.from(el.options).findIndex(o => o.defaultSelected);
          el.selectedIndex = def >= 0 ? def : 0;
        }
      } else if (!(el.id in tf)) {
        el.value = el.defaultValue;
      }
    });
  }

  // Put the bank back the way the saved statement showed it. The dropdown is
  // what the auditor saw; the hidden bankName is only a fallback for a save
  // whose dropdown is blank (or holds a bank no longer in the list).
  _restoreBank(state) {
    const sel = document.getElementById('bankSelect');
    const other = document.getElementById('bankOther');
    if (!sel || !other) return;
    const tf = state.textFields || {};
    const savedSel = (state.selects && state.selects.bankSelect) || '';
    const name = ((savedSel === 'other' ? (tf.bankOther || tf.bankName) : (savedSel || tf.bankName)) || '').trim();

    const match = name && Array.from(sel.options).find(o =>
      o.value && o.value !== 'other' && o.value.toLowerCase() === name.toLowerCase());
    if (match) {
      sel.value = match.value;
    } else if (name) {
      sel.value = 'other';
      other.value = name;
    } else {
      sel.value = '';
    }
    this.entityManager.updateBank();
  }

  // ════════════════════════════════════════════════════════════════════════════
  // COLLECT (with pages) — form state plus the generated document HTML
  // ════════════════════════════════════════════════════════════════════════════

  // Shared by both the database save and the JSON backup download.
  collectFullState() {
    const state = this.collectFormState();
    const output = document.getElementById('document-output');
    if (output && output.innerHTML.trim()) {
      // Drop transient editor-only UI (e.g. "Insert page here" controls) so the
      // saved document HTML stays clean.
      const clone = output.cloneNode(true);
      clone.querySelectorAll('.insert-page-zone').forEach(z => z.remove());
      // Saving from inside edit mode would otherwise bake in the flag that makes
      // a signer's name typeable. contenteditable="true" is honoured whatever
      // its ancestors say, so on reload the name would be editable in the plain
      // preview, with nothing marking the page as edited. Edit mode re-applies it.
      clone.querySelectorAll('.sig-name[data-sig-editable]').forEach(n => {
        n.removeAttribute('contenteditable');
        n.removeAttribute('data-sig-editable');
      });
      state.savedPagesHtml = clone.innerHTML;
    }
    // The hand-edited pages on their own — this is what Open restores (see
    // _previewEditsOf). savedPagesHtml above is still written but never replayed.
    const edits = typeof _serializePreviewEdits === 'function' ? _serializePreviewEdits() : null;
    if (edits) state.previewEdits = edits;
    return state;
  }

  // Business (folder) + year-label (file) derived from the form, mirroring the old
  // "<Company> Financial statements <year>" filename convention so records line up with
  // the migrated data.
  _labelsFor(state) {
    const folder = (state.textFields.companyName || 'business-info')
      .replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim() || 'business-info';
    const year = (state.textFields.yearEnd || '').match(/(?:19|20)\d{2}/)?.[0] || '';
    const file = year ? `${folder} Financial statements ${year}` : folder;
    return { folder, file };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SAVE — write the business to the shared database (create or update)
  // ════════════════════════════════════════════════════════════════════════════

  // folderOverride lets the File Explorer drop the current work into a chosen folder
  // instead of the default company-name folder.
  async saveToDatabase(folderOverride) {
    const state = this.collectFullState();
    const labels = this._labelsFor(state);
    const folder = folderOverride || labels.folder;
    const file = labels.file;
    const record = { data: state, folder, file };

    try {
      let saved;
      if (this.currentBusinessId != null) {
        const choice = await this._askOverwriteOrCopy(file);
        if (choice === 'cancel') return;
        if (choice === 'copy') {
          saved = await DataStore.create(record);
        } else {
          saved = await DataStore.update(this.currentBusinessId, record);
        }
      } else {
        saved = await DataStore.create(record);
      }
      this.currentBusinessId = saved.id;
      this.offline = false;
      BusinessInfoManager.markSaveButton(false);
      if (typeof clearUnsavedFlag === 'function') clearUnsavedFlag();
      if (typeof DraftCache !== 'undefined') DraftCache.touch();
      BusinessInfoManager.showToast(`Saved “${saved.file || saved.company_name}” to the shared database.`, 'success', 5000);
    } catch (err) {
      if (err.isConnectionError) {
        this.offline = true;
        const detail = err.networkDetail ? '\n\nTechnical detail: ' + err.networkDetail : '';
        const msg = 'Could not save — the shared database at ' + DataStore.baseUrl() + ' can\'t be reached.\n\n' +
          'Possible causes:\n' +
          '• The database service is not running on the office server.\n' +
          '• A firewall is blocking the connection.\n' +
          '• This PC is not on the same network as the office server.\n\n' +
          'Your work is kept on this PC. Once the database is back online, click Save again ' +
          'to store it on the server.' + detail;
        BusinessInfoManager.showToast('Could not reach the database — see details in the alert.', 'error', 10000);
        alert(msg);
        return;
      }
      // The server returns 423 when another client holds the lock.
      if (err.message && err.message.includes('currently editing')) {
        BusinessInfoManager.showToast(err.message, 'error', 10000);
        alert(err.message + '\n\nYour work is NOT lost — wait until the other user is done and try again.');
        return;
      }
      BusinessInfoManager.showToast(err.message, 'error', 8000);
      alert(err.message);
    }
  }

  async silentSave() {
    if (DataStore.isOffline()) return;
    const state = this.collectFullState();
    const labels = this._labelsFor(state);
    const folder = labels.folder === 'business-info' ? 'Temp' : labels.folder;
    const file = labels.file === labels.folder ? folder : labels.file;
    const record = { data: state, folder, file };

    try {
      if (this.currentBusinessId != null) {
        await DataStore.update(this.currentBusinessId, record);
      } else {
        const saved = await DataStore.create(record);
        this.currentBusinessId = saved.id;
      }
      _hasUnsavedChanges = false;
      BusinessInfoManager.markSaveButton(false);
      if (typeof DraftCache !== 'undefined') DraftCache.touch();
    } catch (err) {
      if (err.message && err.message.includes('currently editing')) {
        BusinessInfoManager.showToast('Auto-save blocked — ' + err.message, 'error', 8000);
      }
    }
  }

  _askOverwriteOrCopy(fileName) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'page-selector-overlay';
      overlay.onclick = (e) => { if (e.target === overlay) { overlay.remove(); resolve('cancel'); } };

      const modal = document.createElement('div');
      modal.className = 'page-selector-modal';
      modal.style.maxWidth = '420px';
      modal.innerHTML = `
        <h3 style="margin:0 0 10px;">Save to Database</h3>
        <p style="margin:0 0 16px;font-size:9.5pt;color:var(--muted);">
          "<strong>${fileName || 'This business'}</strong>" already exists in the database. What would you like to do?
        </p>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button id="save-dlg-copy" class="btn btn-secondary" style="min-width:110px;">Create a Copy</button>
          <button id="save-dlg-overwrite" class="btn btn-primary" style="min-width:110px;">Overwrite</button>
        </div>
      `;

      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      modal.querySelector('#save-dlg-copy').onclick = () => { overlay.remove(); resolve('copy'); };
      modal.querySelector('#save-dlg-overwrite').onclick = () => { overlay.remove(); resolve('overwrite'); };
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // APPLY — restore form state from a parsed JSON object
  // ════════════════════════════════════════════════════════════════════════════

  applyFormState(state) {
    if (!state || state._version !== 1) {
      alert('Invalid or unrecognised business info file.');
      return;
    }

    // Loading/importing replaces the whole document — hand-edited preview pages
    // belong to the previous business and must not carry over.
    if (typeof _clearPageEdits === 'function') _clearPageEdits();
    // Index labels/page numbers remembered across entity switches belong to the
    // previous business too.
    if (this.entityManager.forgetIndexInputs) this.entityManager.forgetIndexInputs();

    state = this._migrateEngagementLetter(state);

    // Fields an older save doesn't carry start blank, not as the last business left them.
    this._resetFieldsMissingFrom(state);

    // 1. Select entity type (this configures visible sections)
    if (state.entityType) {
      const card = document.getElementById(`ec-${state.entityType}`);
      if (card) this.entityManager.selectEntity(card, state.entityType);
    }

    // 2. Clear existing directors and rebuild
    const dirList = document.getElementById('directors-list');
    if (dirList) dirList.innerHTML = '';
    this.entityManager.directors = [];
    this.entityManager.directorCount = 0;

    if (state.directors && state.directors.length > 0) {
      state.directors.forEach(d => {
        this.entityManager.addDirector();
        const id = this.entityManager.directorCount;
        const initEl = document.getElementById(`dir-init-${id}`);
        const surEl = document.getElementById(`dir-sur-${id}`);
        const idEl = document.getElementById(`dir-id-${id}`);
        if (initEl) initEl.value = d.initials || '';
        if (surEl) surEl.value = d.surname || '';
        if (idEl) idEl.value = d.idNumber || '';
        if (d.signsForBoard) {
          const repCb = document.getElementById(`dir-board-rep-${id}`);
          if (repCb) repCb.checked = true;
        }
        if (d.deceased) {
          const decCb = document.getElementById(`dir-deceased-${id}`);
          const decDate = document.getElementById(`dir-deceased-date-${id}`);
          if (decDate) decDate.value = d.deceasedDate || '';
          if (decCb) { decCb.checked = true; this.entityManager.toggleDeceased(decCb, true); }
        }
        if (d.isIndependentTrustee) {
          const indCb = document.getElementById(`dir-ind-${id}`);
          if (indCb) { indCb.checked = true; this.entityManager.toggleIndependentTrustee(id); }
          const typeRadio = document.querySelector(`input[name="dir-ind-type-${id}"][value="${d.indTrusteeType || 'business'}"]`);
          if (typeRadio) { typeRadio.checked = true; this.entityManager.toggleIndTrusteeType(id); }
          const signRadio = document.querySelector(`input[name="dir-ind-sign-${id}"][value="${d.indSignsAll ? 'all' : 'index'}"]`);
          if (signRadio) signRadio.checked = true;
          if (d.indTrusteeType === 'business') {
            const bizEl = document.getElementById(`dir-ind-biz-${id}`);
            const regEl = document.getElementById(`dir-ind-reg-${id}`);
            if (bizEl) bizEl.value = d.indBusinessName || '';
            if (regEl) regEl.value = d.indBusinessReg || '';
          }
        }
      });
    }

    // 3. Radio buttons (set before text fields so conditional sections are visible)
    // Unlisted radios keep their previous DOM state — reset the additional-individuals
    // toggle first so a spouse from the previous business can't leak into a save
    // made before the field existed.
    document.querySelectorAll('input[name="hasSecondIndividual"]').forEach(r => { r.checked = false; });
    this.entityManager.clearAdditionalIndividuals();
    // The letter-of-resolution toggle starts with nothing picked (4.47.0), so
    // the previous business's answer must not carry over. A save that holds an
    // answer puts it back below; one that does not stays unanswered.
    document.querySelectorAll('input[name="trustResolutionLetter"]').forEach(r => { r.checked = false; });
    // Same for the individual's statement type: a business saved before this
    // field existed is an annual-financial-statements set, and a previous
    // business's "assets and liabilities" must not carry over into it.
    const indStmtDefault = document.querySelector('input[name="individualStatementType"][value="afs"]');
    if (indStmtDefault) indStmtDefault.checked = true;
    // Same for the school's education department: a business saved before this
    // field existed carries the Mpumalanga default, and the previous school's
    // department must not leak into it.
    const eduDeptEl = document.getElementById('schoolEduDept');
    if (eduDeptEl) eduDeptEl.value = (typeof DEFAULT_EDU_DEPT !== 'undefined') ? DEFAULT_EDU_DEPT : eduDeptEl.value;
    // Same for how the NPC policies describe the entity.
    const npcOrgEl = document.getElementById('npcOrgName');
    if (npcOrgEl) npcOrgEl.value = (typeof DEFAULT_NPC_ORG !== 'undefined') ? DEFAULT_NPC_ORG : npcOrgEl.value;
    const npoOrgEl = document.getElementById('npoOrgName');
    if (npoOrgEl) npoOrgEl.value = (typeof DEFAULT_NPO_ORG !== 'undefined') ? DEFAULT_NPO_ORG : npoOrgEl.value;
    const npoDeptEl = document.getElementById('npoDeptName');
    if (npoDeptEl) npoDeptEl.value = (typeof DEFAULT_NPO_DEPT !== 'undefined') ? DEFAULT_NPO_DEPT : npoDeptEl.value;
    const npoDeptOfEl = document.getElementById('npoDeptOf');
    if (npoDeptOfEl) npoDeptOfEl.value = (typeof DEFAULT_NPO_DEPT_OF !== 'undefined') ? DEFAULT_NPO_DEPT_OF : npoDeptOfEl.value;
    const ppeStmtEl = document.getElementById('ppeStmtName');
    if (ppeStmtEl) ppeStmtEl.value = (typeof DEFAULT_PPE_STMT !== 'undefined') ? DEFAULT_PPE_STMT : ppeStmtEl.value;
    if (state.radios) {
      Object.entries(state.radios).forEach(([name, value]) => {
        const radio = document.querySelector(`input[name="${name}"][value="${value}"]`);
        if (!radio) return;
        radio.checked = true;
        // Groups without a hand-written toggle below run their own onchange,
        // so whatever section they show or hide follows the loaded value.
        if (!BIM_RADIOS.includes(name)) radio.dispatchEvent(new Event('change'));
      });
    }

    // Rebuild additional individuals before the toggle below runs (the toggle only
    // adds a blank starter row when the list is empty). Older saves stored a single
    // spouse in textFields.secondName / secondIdNumber — migrate those to one row.
    const savedIndivs = (state.additionalIndividuals && state.additionalIndividuals.length)
      ? state.additionalIndividuals
      : (state.radios?.hasSecondIndividual === 'yes' && state.textFields?.secondName)
        ? [{ name: state.textFields.secondName, idNumber: state.textFields.secondIdNumber || '', taxNumber: '' }]
        : [];
    savedIndivs.forEach(a => {
      this.entityManager.addAdditionalIndividual();
      const idx = this.entityManager.additionalIndividualCount;
      const nameEl = document.getElementById(`addi-name-${idx}`);
      const idEl = document.getElementById(`addi-id-${idx}`);
      const taxEl = document.getElementById(`addi-tax-${idx}`);
      if (nameEl) nameEl.value = a.name || '';
      if (idEl) idEl.value = a.idNumber || '';
      if (taxEl) taxEl.value = a.taxNumber || '';
      if (a.deceased) {
        const decCb = document.getElementById(`addi-deceased-${idx}`);
        const decDate = document.getElementById(`addi-deceased-date-${idx}`);
        if (decDate) decDate.value = a.deceasedDate || '';
        if (decCb) { decCb.checked = true; this.entityManager.toggleDeceased(decCb, true); }
      }
    });

    // Trigger report type change to show/hide correct sub-panels
    this.entityManager.onReportTypeChange();

    // Trigger other conditional toggles
    this.entityManager.onTradingAsToggle();
    this.entityManager.onSecondIndividualToggle();
    // The statement type is only known now that the radios are restored, and it
    // decides both Step 7's visibility and which index list is built — so the
    // index inputs have to be rebuilt again here, before the text fields (which
    // carry the saved idx- values) are applied.
    this.entityManager.onIndividualStatementTypeChange();
    if (state.entityType === 'attorneys') this.entityManager.toggleAttReg();
    this.entityManager.updateShareCapital();
    this.entityManager.updateDividend();
    this.entityManager.updateParent();
    this.entityManager.updateGroupCo();

    // Read back from the form: onReportTypeChange() above may have replaced a
    // report type the entity no longer allows (a trust saved as review/audit).
    const reportType = getRadio('reportType');
    if (reportType === 'audit') {
      if (state.entityType === 'school') this.entityManager.onSchoolAuditTypeChange();
      else if (state.entityType === 'attorneys') this.entityManager.onAttOpinionTypeChange();
      else this.entityManager.onAuditTypeChange();
    } else if (reportType === 'review') {
      this.entityManager.onReviewTypeChange();
      this.entityManager.onReviewQualifiedBasisChange();
    } else if (reportType === 'compilation') {
      this.entityManager.onCompilationTypeChange();
    }

    if (state.entityType === 'bc') {
      this.entityManager.onBcEventsChange();
      this.entityManager.onBcMgmtRulesChange();
    }
    if (state.entityType === 'trust') {
      this.entityManager.onTrustDeedChange();
      this.entityManager.onTrustResolutionLetterChange();
    }
    // The NPC governing body decides the index labels, so it has to be applied
    // before the text fields below restore the saved idx- values on top.
    if (isNpcType(state.entityType)) {
      this.entityManager.onNpcBodyChange();
    }
    if (state.entityType === 'church') {
      if (typeof toggleChurchStep7 === 'function') toggleChurchStep7();
    }

    // PPE residual toggle
    if (state.radios?.ppeResidualInclude) {
      this.entityManager.onPpeResidualToggle();
    }

    // 4. Select dropdowns
    if (state.selects) {
      Object.entries(state.selects).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) {
          el.value = value;
          el.dispatchEvent(new Event('change'));
        }
      });
    }

    // 5. Text fields
    if (state.textFields) {
      Object.entries(state.textFields).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.value = value;
      });
      // After the text fields, so the hidden bankName they just wrote is
      // re-derived from the dropdown instead of trusted.
      this._restoreBank(state);
      // A saved page-start is the auditor's own choice — keep report-type
      // switches from overwriting it with the default.
      const pageStartEl = document.getElementById('pageStart');
      if (pageStartEl && state.textFields.pageStart) pageStartEl.dataset.userSet = '1';
      const pageEndEl = document.getElementById('pageEnd');
      if (pageEndEl && state.textFields.pageEnd) pageEndEl.dataset.userSet = '1';

      // A loaded business's meeting/AGM dates are authoritative — drop the
      // auto flag so a later Date of Issue change never overwrites them
      // (mirrors the loan-cert behaviour below). The one exception is a date
      // saved blank while still on auto (a new year blanks them): that one
      // keeps tracking, so entering this year's approval date fills it in.
      const autoDates = state.autoDates || [];
      const knownAuto = state.autoDateFields || BIM_AUTO_DATES_LEGACY;
      BIM_AUTO_DATES.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        if (!el.value.trim() && (autoDates.includes(id) || !knownAuto.includes(id))) el.dataset.auto = '1';
        else el.removeAttribute('data-auto');
      });

      // Same for the meeting venues, but only where the saved business actually
      // carries one — a business saved before a venue was typed should still
      // pick one up from the Registered Address.
      ['bcAGMVenue', 'trustAGMVenue', 'minutes-venue', 'cc-minutes-venue'].forEach(id => {
        const el = document.getElementById(id);
        if (el && el.value.trim()) el.removeAttribute('data-auto');
      });

      // Same again for the two dates that track the approval date: a saved
      // business that already carries one is authoritative, but one saved
      // before they were entered should still pick the approval date up. Blank
      // re-arms the flag, since the business open before this one may have
      // dropped it (same rule as clearing the field by hand).
      ['dateSigned', 'dateOfIssue'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.value.trim()) el.removeAttribute('data-auto');
        else el.dataset.auto = '1';
      });
    }

    // 6. Checkboxes (engagement types)
    if (state.checkboxes) {
      Object.entries(state.checkboxes).forEach(([id, checked]) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.checked = checked;
        if (!BIM_CHECKBOXES.includes(id)) el.dispatchEvent(new Event('change'));
      });
    }
    this.entityManager.toggleEngagementTypes();
    this.entityManager.onEngagementTypesChange();
    // The main individual's Deceased box is restored silently above (it is in
    // BIM_CHECKBOXES); show or hide its date to match.
    const indDecCb = document.getElementById('indDeceased');
    if (indDecCb) {
      this.entityManager.toggleDeceased(indDecCb, true);
      if (!indDecCb.checked) {
        const g = indDecCb.closest('.person-deceased-block')?.querySelector('.deceased-date-group');
        if (g) g.style.display = 'none';
      }
    }

    // 7. Shareholders (clear and rebuild)
    const shList = document.getElementById('shareholder-list');
    if (shList) shList.innerHTML = '';
    this.entityManager.shareholderCount = 0;

    if (state.shareholders && state.shareholders.length > 0) {
      state.shareholders.forEach(s => {
        this.entityManager.addShareholder();
        const idx = this.entityManager.shareholderCount;
        const nameEl = document.getElementById(`sh-name-${idx}`);
        if (nameEl) nameEl.value = s.name || '';
        const typeRadio = document.querySelector(`input[name="sh-type-${idx}"][value="${s.type || 'individual'}"]`);
        if (typeRadio) typeRadio.checked = true;
        this.entityManager.onShareholderTypeChange(idx);
        const proxyEl = document.getElementById(`sh-proxy-${idx}`);
        if (proxyEl) proxyEl.value = s.proxy || '';
      });
    }

    // 8. Loan certificates (clear and rebuild)
    const lcList = document.getElementById('loan-cert-list');
    if (lcList) lcList.innerHTML = '';
    this.entityManager.loanCertCount = 0;

    if (state.loanCerts && state.loanCerts.length > 0) {
      state.loanCerts.forEach(lc => {
        this.entityManager.addLoanCert();
        const idx = this.entityManager.loanCertCount;
        const nameEl = document.getElementById(`lc-name-${idx}`);
        if (nameEl) nameEl.value = lc.name || '';
        const balRadio = document.querySelector(`input[name="lc-balance-${idx}"][value="${lc.balance || 'credit'}"]`);
        if (balRadio) balRadio.checked = true;
        const amtEl = document.getElementById(`lc-amount-${idx}`);
        if (amtEl) amtEl.value = lc.amount || '';
        const dateEl = document.getElementById(`lc-date-${idx}`);
        if (dateEl) {
          // Restore exactly what was saved and lock it in: a loaded business's
          // date is authoritative, so drop the auto flag and never let a later
          // Date of Issue change overwrite it (even a deliberate blank). A blank
          // saved while still on auto (a new year) keeps tracking instead.
          dateEl.value = lc.date || '';
          if (!dateEl.value.trim() && lc.auto) dateEl.dataset.auto = '1';
          else dateEl.removeAttribute('data-auto');
        }
      });
    }

    // 9. Accounting policies
    if (state.policies) {
      accountingPolicies.forEach(p => {
        const cb = document.getElementById(p.id);
        if (cb && state.policies[p.id] !== undefined) {
          cb.checked = state.policies[p.id];
          this.entityManager.togglePolicy(p.id);
        }

        // Restore policy-level text variant radio pills (before policyEdits below,
        // so a saved manual edit still overrides the variant's default text)
        if (p.textOptions) {
          const savedVal = state.policies[`sel-${p.id}`];
          if (savedVal !== undefined) {
            const radio = document.querySelector(`input[name="textopt-${p.id}"][value="${savedVal}"]`);
            if (radio) {
              radio.checked = true;
              this.entityManager.onPolicyTextOption(p.id);
            }
          }
        }

        // Restore inline text edits
        // An edit holding the NPO dropdown's own markup is the 4.75.0 – 4.77.0
        // swap loop, not wording anybody typed: drop it, and the policy's own
        // text (with its dropdowns) comes back.
        if (state.policyEdits && state.policyEdits[p.id]
            && !/onNpoOrgInline|data-npo-(?:field|token)/.test(state.policyEdits[p.id])) {
          // Older exports may have saved edits containing literal <br> tags
          const editedText = state.policyEdits[p.id].replace(/<br\s*\/?>/gi, '\n');
          const editArea = document.getElementById(`policy-edit-${p.id}`);
          const displayEl = document.getElementById(`policy-text-${p.id}`);
          if (editArea) editArea.value = editedText;
          if (displayEl) displayEl.innerHTML = policyTextToHtml(editedText);
        }

        // Restore deferred tax asset checkbox
        if (p.deferredAssetSentence && state.policies['deftax-no-asset'] !== undefined) {
          const deftaxCb = document.getElementById('deftax-no-asset');
          if (deftaxCb) deftaxCb.checked = state.policies['deftax-no-asset'];
        }

        if (p.subItems) {
          p.subItems.forEach(s => {
            const scb = document.getElementById(s.id);
            if (scb && state.policies[s.id] !== undefined) {
              scb.checked = state.policies[s.id];
              if (!s.isLandAndBuildings) {
                this.entityManager.onSubItemChange(s.id);
              }
            }
            const sel = document.getElementById(`sel-${s.id}`);
            if (sel && state.policies[`sel-${s.id}`] !== undefined) {
              sel.value = state.policies[`sel-${s.id}`];
              this.entityManager.onRateSelect(s.id);
            }
            const custom = document.getElementById(`custom-${s.id}`);
            if (custom && state.policies[`custom-${s.id}`] !== undefined) {
              custom.value = state.policies[`custom-${s.id}`];
            }
            const residual = document.getElementById(`residual-${s.id}`);
            if (residual && state.policies[`residual-${s.id}`] !== undefined) {
              residual.value = state.policies[`residual-${s.id}`];
            }
          });
        }

        if (p.id === 'pol_ppe') {
          let depChecked = state.policies['ppe-depreciation-include'];
          if (depChecked === undefined) {
            depChecked = p.subItems.some(s => state.policies[s.id])
              || (state.customPpeSubItems && state.customPpeSubItems.length > 0);
          }
          const depCb = document.getElementById('ppe-depreciation-include');
          if (depCb) depCb.checked = !!depChecked;
          this.entityManager.updatePpeDepreciationVisibility();
        }
      });
    }

    // 10. Custom PPE sub-items (clear and rebuild)
    const ppeCustomList = document.getElementById('ppe-custom-subitems-list');
    if (ppeCustomList) ppeCustomList.innerHTML = '';
    if (state.customPpeSubItems && state.customPpeSubItems.length > 0 && typeof addPpeSubItem === 'function') {
      state.customPpeSubItems.forEach(item => {
        addPpeSubItem();
        const entries = document.querySelectorAll('.ppe-custom-sub-entry');
        const last = entries[entries.length - 1];
        if (last) {
          const labelEl = last.querySelector('.ppe-csub-label');
          const rateEl = last.querySelector('.ppe-csub-rate');
          if (labelEl) labelEl.value = item.label || '';
          if (rateEl) rateEl.value = item.rate || '';
        }
      });
    }

    // 11. Custom accounting policies (clear and rebuild)
    const customPolList = document.getElementById('custom-policies-list');
    if (customPolList) customPolList.innerHTML = '';
    if (state.customPolicies && state.customPolicies.length > 0 && typeof addCustomPolicy === 'function') {
      state.customPolicies.forEach(pol => {
        addCustomPolicy();
        const entries = document.querySelectorAll('.custom-policy-entry');
        const last = entries[entries.length - 1];
        if (last) {
          const headingEl = last.querySelector('.cp-heading');
          const posEl = last.querySelector('.cp-position');
          const contentEl = last.querySelector('.cp-content');
          if (headingEl) headingEl.value = pol.heading || '';
          // What was typed, not the parsed float: "1.10" and "1.1" are the
          // same number but different slots (see getCustomPolicies). Saves
          // from before positionRaw existed only have the float.
          if (posEl) {
            posEl.value = pol.positionRaw != null && pol.positionRaw !== '' ? pol.positionRaw
              : pol.position != null ? pol.position : '';
          }
          if (contentEl) contentEl.value = pol.content || '';
        }
      });
    }

    // 12. Preparer previews
    this.entityManager.selectPreparerQuick();
    this.entityManager.updatePreparerPreview();
    this.entityManager.updateSchoolPreparerPreview();
    this.entityManager.onCompilerSignerChange();

    // The Person 1 card mirrors companyName / regNumber / taxNumber, which are
    // only restored now (step 5) — refresh it so a loaded multi-individual set
    // shows Person 1's details in the card, not blank.
    this.entityManager._syncPrimaryIndividualCard();

    // A business saved before it carried a Date Signed / Date of Issue (or saved
    // with one of them blank) loads with that field still on auto — nothing had
    // ever pushed the approval date into it, and syncAutoSigningDates only ran
    // when the user re-touched the approval date. Run it once here so a loaded
    // business shows the pre-filled value its hint promises.
    if (typeof syncAutoSigningDates === 'function') syncAutoSigningDates();

    // Refresh the "current business" banner now the form holds the loaded values.
    if (typeof updateBusinessHeader === 'function') updateBusinessHeader();
  }

  // ════════════════════════════════════════════════════════════════════════════
  // LOAD FROM DATABASE — used by the File Explorer's Open / Open in New Year
  // ════════════════════════════════════════════════════════════════════════════

  _businessOf(entry) {
    return entry.folder || entry.name || 'Untitled';
  }

  // The financial year of an entry — the server already computes this, but fall back to
  // parsing the filename / year-end for older entries or file-imported records.
  _yearOf(entry) {
    if (entry.year) return entry.year;
    const fromFile = (entry.file || '').match(/(?:19|20)\d{2}/);
    if (fromFile) return parseInt(fromFile[0], 10);
    const ye = entry.data?.textFields?.yearEnd || '';
    const m = ye.match(/(?:19|20)\d{2}/);
    return m ? parseInt(m[0], 10) : 0;
  }

  // Open a saved statement: restore the form (the left-hand side), then rebuild
  // the document from those values with the statement's hand-edited preview
  // pages put back in. Those pages go through the same preserve-and-patch as
  // any regeneration, so their protected variables follow the restored form.
  // The full saved page HTML is still never replayed — only the edited pages.
  // Open in New Year does not bring the edits across (see _formOnly).
  //
  // `opts.lhsOnly` (File Explorer → Open LHS only) restores the form alone and
  // leaves the saved preview edits behind: the document is built fresh from the
  // form. It is still the same record, so saving afterwards stores it without
  // those edits.
  async _loadEntry(entry, overlay, opts = {}) {
    const record = await this._fetchRecord(entry);
    if (!record) return;

    // Try to acquire the lock before loading. If another user holds it, abort.
    if (record.id != null) {
      const gotLock = await this._acquireLock(record.id);
      if (!gotLock) return;
    }

    if (overlay) overlay.remove();
    // Release any previous lock before switching to the new business — but not
    // when reopening the record already open: the lock just taken is that same
    // lock, and releasing it would leave the statement unguarded.
    if (this.currentBusinessId !== record.id) this._releaseLockQuietly();
    // Track the loaded record so a later Save updates this same business/year.
    // An inline record has no database id, so Save will create a new DB row.
    this.currentBusinessId = record.id;

    this.applyFormState(this._formOnly(record.data));
    const hadEdits = !opts.lhsOnly && typeof _loadPreviewEdits === 'function'
      && _loadPreviewEdits(BusinessInfoManager._previewEditsOf(record.data));
    if (typeof generateAndPreview === 'function') generateAndPreview();
    BusinessInfoManager.markSaveButton(false);
    if (typeof clearUnsavedFlag === 'function') clearUnsavedFlag();
    if (typeof DraftCache !== 'undefined') DraftCache.touch();
    BusinessInfoManager.showToast(
      opts.lhsOnly
        ? 'Statement opened (LHS only) — the document was built fresh from the form; saved preview edits were left out.'
        : hadEdits
          ? 'Statement opened — your changes to the document were restored.'
          : 'Statement opened — the document was rebuilt from the form values.',
      'success', 5000);
  }

  // Open a saved statement as a brand-new year: copy the record into a new
  // database row named for the chosen year, then load that copy.
  //
  // Everything on the left-hand side comes across — the accountants asked for
  // the full previous year in front of them so they can change what moved and
  // confirm what didn't. Only the fields that are *by definition* different in
  // a new year are touched, by _rollForward below.
  async openInNewYear(entry, overlay, year) {
    const record = await this._fetchRecord(entry);
    if (!record) return;

    const data = this._formOnly(record.data, true);
    BusinessInfoManager._rollForward(data, parseInt(year, 10));
    const company = (record.company_name || entry.company_name ||
      data.textFields?.companyName || 'business-info')
      .replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim() || 'business-info';
    const folder = entry.folder || record.folder || company;
    const file = `${company} Financial statements ${year}`;

    // Release the previous lock — the copy is a different record.
    this._releaseLockQuietly();

    let created = null;
    if (!DataStore.isOffline()) {
      try {
        created = await DataStore.create({ data, folder, file });
      } catch (err) {
        BusinessInfoManager.showToast('Could not create the new year: ' + err.message, 'error', 9000);
        return;
      }
    }

    if (overlay) overlay.remove();
    this.currentBusinessId = created ? created.id : null;
    if (this.currentBusinessId != null) await this._acquireLock(this.currentBusinessId);

    this.applyFormState(data);
    if (typeof updateBusinessHeader === 'function') updateBusinessHeader();
    if (typeof generateAndPreview === 'function') generateAndPreview();
    BusinessInfoManager.markSaveButton(created ? false : true);
    if (typeof clearUnsavedFlag === 'function' && created) clearUnsavedFlag();
    if (typeof DraftCache !== 'undefined') DraftCache.touch();
    BusinessInfoManager.showToast(
      created
        ? `New year created — "${file}". Year ends rolled forward; approval, issue, meeting and loan-certificate dates, loan amounts and this year's result are blank for you to fill in. Everything else came across as it was.`
        : `Copied for ${year} — the database is offline, so nothing was created there yet. Save when you reconnect.`,
      'success', 8000);
  }

  // Turn last year's form state into this year's, in place.
  //
  //  - Financial Year End moves to the new year; Previous Year End becomes last
  //    year's Financial Year End (last year's "current" is this year's "previous").
  //  - Approval / compiler-signed / issue dates arrive blank. They have not
  //    happened yet, and a copied one would look confirmed.
  //  - Meeting / AGM and loan-certificate dates arrive blank but still on auto,
  //    so they fill themselves in once this year's approval date / Date of
  //    Issue is entered — exactly as on a fresh statement.
  //  - Loan certificates keep lender, balance side and place; the amount is blank.
  //  - Profit/loss and levy results: previous year <- last year's current year,
  //    current year blank. The body-corporate "previous year" label follows.
  //
  // When the chosen year is not the one straight after last year's year end,
  // last year's figures are not this year's comparatives, so both sides blank.
  static _rollForward(data, year) {
    const tf = data.textFields = data.textFields || {};
    const radios = data.radios = data.radios || {};

    const oldYearEnd = (tf.yearEnd || '').trim();
    const oldYear = BusinessInfoManager._yearIn(oldYearEnd);
    const consecutive = oldYear != null && oldYear + 1 === year;

    if (oldYear != null) {
      tf.yearEnd = BusinessInfoManager._dateInYear(oldYearEnd, year);
      tf.prevYearEnd = consecutive ? oldYearEnd : BusinessInfoManager._dateInYear(oldYearEnd, year - 1);
    }

    ['dateApproved', 'dateSigned', 'dateOfIssue'].forEach(id => { if (id in tf) tf[id] = ''; });
    BIM_AUTO_DATES.forEach(id => { if (id in tf) tf[id] = ''; });
    data.autoDates = BIM_AUTO_DATES.slice();
    data.autoDateFields = BIM_AUTO_DATES.slice();

    (data.loanCerts || []).forEach(lc => {
      lc.amount = '';
      lc.date = '';
      lc.auto = true;
    });

    // current -> previous, for one amount field and its profit/loss-style radio
    const roll = (curId, prevId, curRadio, prevRadio) => {
      if (consecutive && (tf[curId] || '').trim()) tf[prevId] = tf[curId];
      else if (prevId in tf) tf[prevId] = '';
      if (curId in tf) tf[curId] = '';
      if (consecutive && radios[curRadio]) radios[prevRadio] = radios[curRadio];
      else delete radios[prevRadio];
      delete radios[curRadio];
    };
    roll('profitLoss', 'prevProfitLoss', 'plType', 'prevPlType');
    roll('bcContribAmount', 'bcPrevContribAmount', 'bcContribType', 'bcPrevContribType');
    if ((tf.bcPrevYear || '').trim() || data.entityType === 'bc') tf.bcPrevYear = String(year - 1);
  }

  // The single four-digit year in a date string, or null.
  static _yearIn(str) {
    const m = String(str || '').match(/(?:19|20)\d{2}/g);
    return m && m.length === 1 ? parseInt(m[0], 10) : null;
  }

  // The same date, written the same way, in another year. A last-day-of-February
  // year end stays the last day of February (28 <-> 29 across leap years).
  static _dateInYear(str, year) {
    const oldYear = BusinessInfoManager._yearIn(str);
    if (oldYear == null) return str;
    const leap = y => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    const febEnd = y => (leap(y) ? 29 : 28);
    const fixDay = day => (parseInt(day, 10) >= febEnd(oldYear) ? String(febEnd(year)) : day);
    let out = str.replace(/(?:19|20)\d{2}/, String(year));
    out = out
      .replace(/^(\d{1,2})(\s+feb(?:ruary)?\b)/i, (_, d, rest) => fixDay(d) + rest)
      .replace(/^(\d{1,2})([\/\-.]0?2[\/\-.]\d{4})$/, (_, d, rest) => fixDay(d) + rest)
      .replace(/^(\d{4}[\/\-.]0?2[\/\-.])(\d{1,2})$/, (_, pre, d) => pre + fixDay(d).padStart(d.length, '0'));
    return out;
  }

  // Fetch the full record behind a File Explorer row. Synthetic entries carry
  // their data inline; database entries are fetched by id.
  async _fetchRecord(entry) {
    if (!entry || (entry.id == null && !entry.data)) {
      alert('That saved business has no data. Try refreshing the list.');
      return null;
    }
    if (entry.data) return { id: null, data: entry.data, folder: entry.folder, company_name: entry.company_name };
    let record;
    try {
      record = await DataStore.get(entry.id);
    } catch (err) {
      BusinessInfoManager.showToast(err.message, 'error', 8000);
      alert(err.message);
      return null;
    }
    if (!record || !record.data) {
      alert('That saved business could not be loaded. Try refreshing the list.');
      return null;
    }
    return record;
  }

  // The form half of a saved record: everything except the stored document HTML
  // and the hand-edited pages. Open puts the edits back separately; Open in New
  // Year deliberately does not, so a new year's record never carries them.
  // `deep` gives a detached copy, for when the caller goes on to mutate it.
  _formOnly(data, deep) {
    const copy = deep ? JSON.parse(JSON.stringify(data)) : Object.assign({}, data);
    delete copy.savedPagesHtml;
    delete copy.previewEdits;
    return copy;
  }

  // A saved record's hand-edited pages. Records saved before previewEdits
  // existed fall back to the edited pages inside their savedPagesHtml.
  static _previewEditsOf(data) {
    if (!data) return null;
    if (data.previewEdits) return data.previewEdits;
    return typeof _previewEditsFromHtml === 'function' ? _previewEditsFromHtml(data.savedPagesHtml) : null;
  }

  _showStatus(msg, duration) {
    const el = document.getElementById('biz-info-status');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, duration || 6000);
  }

  static showToast(message, type = 'info', duration = 5000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-out');
      toast.addEventListener('animationend', () => toast.remove());
    }, duration);
  }

  static markSaveButton(dirty) {
    const btn = document.querySelector('.btn-bar-save');
    if (btn) btn.classList.toggle('unsaved', dirty);
  }
}
