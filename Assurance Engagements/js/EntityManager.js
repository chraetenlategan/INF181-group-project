// EntityManager.js — Signatories, independence declarations and loan
// certificates for the Assurance Engagements app. Depends on: config.js, ../js/utils.js.
//
// The main app's EntityManager also drives entity-type switching across a large
// form, policy checklists, shareholders and index pages. None of that exists
// here, so this is only the two repeaters the letters read from.

class AEEntityManager {
  constructor(liveUpdate) {
    this.liveUpdate = liveUpdate || function () {};
    this.currentEntityType = 'company';
    this.signatoryCount = 0;
    this.indepPersonCount = 0;
    this.reviewIndepPersonCount = 0;
    this.loanCertCount = 0;
  }

  setEntityType(type) {
    this.currentEntityType = type;
    // The signatory cards name the role ("Director 1", "Trustee 1"), so they are
    // relabelled the moment the entity type changes rather than on next add.
    this.relabelSignatories();
    this.liveUpdate();
  }

  terms() {
    const cfg = aeEntity(this.currentEntityType);
    // Singular or plural follows the actual count, the same rule the main app's
    // getTermsForCount() applies: one director is "the director", not
    // "the director(s)".
    const count = this.getSignatories().length;
    return {
      addressee: cfg.addressee,
      singular: cfg.singular,
      plural: count === 1 ? cfg.singular : cfg.plural,
      body: cfg.body
    };
  }

  // ── Signatories ───────────────────────────────────────────────────────────
  // These are the people who accept the engagement at the foot of the letter.

  addSignatory() {
    this.signatoryCount++;
    const idx = this.signatoryCount;
    const container = document.getElementById('signatory-list');
    const card = document.createElement('div');
    card.id = `sig-card-${idx}`;
    card.className = 'ae-card';
    card.innerHTML = `
    <button type="button" onclick="removeSignatory(${idx})" title="Remove" class="ae-card-remove">\u2715</button>
    <div class="ae-card-title" id="sig-card-label-${idx}">${aeEntity(this.currentEntityType).singular} ${idx}</div>

    <div class="ae-row">
      <div class="field-group" style="margin-bottom:0;">
        <label>Initials</label>
        <input type="text" id="sig-init-${idx}" placeholder="e.g. JP" oninput="liveUpdate()">
      </div>
      <div class="field-group" style="margin-bottom:0;">
        <label>Surname</label>
        <input type="text" id="sig-sur-${idx}" placeholder="e.g. Visser" oninput="liveUpdate()">
      </div>
    </div>

    <label class="option-pill" style="margin-top:10px;">
      <input type="checkbox" id="sig-board-${idx}" onchange="liveUpdate()">
      <span id="sig-board-label-${idx}">Signs on behalf of the ${aeEntity(this.currentEntityType).body}</span>
    </label>
  `;
    container.appendChild(card);
  }

  removeSignatory(idx) {
    document.getElementById(`sig-card-${idx}`)?.remove();
    this.liveUpdate();
  }

  relabelSignatories() {
    const cfg = aeEntity(this.currentEntityType);
    let n = 0;
    for (let i = 1; i <= this.signatoryCount; i++) {
      if (!document.getElementById(`sig-card-${i}`)) continue;
      n++;
      const label = document.getElementById(`sig-card-label-${i}`);
      if (label) label.textContent = `${cfg.singular} ${n}`;
      const boardLabel = document.getElementById(`sig-board-label-${i}`);
      if (boardLabel) boardLabel.textContent = `Signs on behalf of the ${cfg.body}`;
    }
  }

  // Names print exactly as the main app prints them: initials upper case, the
  // surname title-cased with particles left lower ("JP Visser").
  getSignatories() {
    const out = [];
    for (let i = 1; i <= this.signatoryCount; i++) {
      if (!document.getElementById(`sig-card-${i}`)) continue;
      const init = formatInitials((document.getElementById(`sig-init-${i}`)?.value || '').trim());
      const sur = formatName((document.getElementById(`sig-sur-${i}`)?.value || '').trim());
      const full = init && sur ? `${init} ${sur}` : (init || sur || '');
      if (!full) continue;
      out.push({ init, sur, full, signsForBoard: !!document.getElementById(`sig-board-${i}`)?.checked });
    }
    return out;
  }

  // ── Independence declaration team members (audit only) ────────────────────
  // Every member of the engagement team completes and signs their own copy of
  // the audit declaration, so one card here is one complete declaration in the
  // document: the same three pages repeat, and only the sign-off block at the
  // foot changes. The reviewer fields are the engagement partner's sign-off
  // cell on that same copy. The review declaration is untouched — it is still
  // produced once, with its cells left as ruled blanks.

  addIndepPerson() {
    this.indepPersonCount++;
    const idx = this.indepPersonCount;
    const container = document.getElementById('indep-person-list');
    if (!container) return;
    const card = document.createElement('div');
    card.id = `indep-card-${idx}`;
    card.className = 'ae-card';
    card.innerHTML = `
    <button type="button" onclick="removeIndepPerson(${idx})" title="Remove" class="ae-card-remove">✕</button>
    <div class="ae-card-title" id="indep-card-label-${idx}">Declaration ${idx}</div>

    <div class="field-group" style="margin-bottom:10px;">
      <label>Name</label>
      <input type="text" id="ind-name-${idx}" oninput="liveUpdate()">
    </div>

    <div class="field-group" style="margin-bottom:10px;">
      <label>Role on Engagement</label>
      <select id="ind-role-${idx}" onchange="liveUpdate()">
        ${AE_INDEP_ROLES.map(r => `<option value="${r}">${r || '—'}</option>`).join('')}
      </select>
    </div>

    <div class="field-group" style="margin-bottom:10px;">
      <label>Date of Signature</label>
      <div class="date-input-wrap">
        <input type="text" id="ind-date-${idx}" oninput="liveUpdate()">
        <button type="button" class="btn-cal" onclick="toggleCal('cal-ind-date-${idx}')"
          title="Pick date">&#x1f4c5;</button>
        <div id="cal-ind-date-${idx}" class="cal-popup hidden"></div>
      </div>
    </div>

    <div class="ae-subhead">Reviewed by (Engagement Partner)</div>

    <div class="field-group" style="margin-bottom:10px;">
      <label>Name</label>
      <input type="text" id="ind-rev-name-${idx}" oninput="liveUpdate()">
    </div>

    <div class="field-group" style="margin-bottom:10px;">
      <label>Conclusion on Disclosed Matters (if any)</label>
      <input type="text" id="ind-rev-concl-${idx}" oninput="liveUpdate()">
    </div>

    <div class="field-group" style="margin-bottom:0;">
      <label>Date</label>
      <div class="date-input-wrap">
        <input type="text" id="ind-rev-date-${idx}" oninput="liveUpdate()">
        <button type="button" class="btn-cal" onclick="toggleCal('cal-ind-rev-date-${idx}')"
          title="Pick date">&#x1f4c5;</button>
        <div id="cal-ind-rev-date-${idx}" class="cal-popup hidden"></div>
      </div>
    </div>
  `;
    container.appendChild(card);
    if (typeof aeRegisterIndepCal === 'function') aeRegisterIndepCal(idx);
  }

  removeIndepPerson(idx) {
    document.getElementById(`indep-card-${idx}`)?.remove();
    if (typeof aeUnregisterIndepCal === 'function') aeUnregisterIndepCal(idx);
    this.relabelIndepPersons();
    this.liveUpdate();
  }

  relabelIndepPersons() {
    let n = 0;
    for (let i = 1; i <= this.indepPersonCount; i++) {
      if (!document.getElementById(`indep-card-${i}`)) continue;
      n++;
      const label = document.getElementById(`indep-card-label-${i}`);
      if (label) label.textContent = `Declaration ${n}`;
    }
  }

  // A card with nothing typed in it is still a declaration — a blank copy for
  // somebody to complete by hand is exactly what this document was before the
  // fields existed, so an empty card is not dropped.
  getIndepPersons() {
    const out = [];
    const val = (id) => (document.getElementById(id)?.value || '').trim();
    for (let i = 1; i <= this.indepPersonCount; i++) {
      if (!document.getElementById(`indep-card-${i}`)) continue;
      out.push({
        cardIdx: i,
        name: formatName(val(`ind-name-${i}`)),
        role: val(`ind-role-${i}`),
        date: val(`ind-date-${i}`),
        reviewerName: formatName(val(`ind-rev-name-${i}`)),
        reviewerConclusion: val(`ind-rev-concl-${i}`),
        reviewerDate: val(`ind-rev-date-${i}`)
      });
    }
    return out;
  }

  // ── Independence declaration team members (review only) ───────────────────
  // The review declaration is completed and signed by each member of the
  // engagement team too, so it repeats the same way the audit one does — one
  // card is one complete two-page declaration. The fields differ because the
  // template does: the review form names the team member in its information
  // grid, gives the whole engagement a written conclusion box, and is signed
  // by the team member and the engagement partner separately at its foot.

  addReviewIndepPerson() {
    this.reviewIndepPersonCount++;
    const idx = this.reviewIndepPersonCount;
    const container = document.getElementById('review-indep-person-list');
    if (!container) return;
    const card = document.createElement('div');
    card.id = `rindep-card-${idx}`;
    card.className = 'ae-card';
    card.innerHTML = `
    <button type="button" onclick="removeReviewIndepPerson(${idx})" title="Remove" class="ae-card-remove">✕</button>
    <div class="ae-card-title" id="rindep-card-label-${idx}">Declaration ${idx}</div>

    <div class="field-group" style="margin-bottom:10px;">
      <label>Engagement Team Member</label>
      <input type="text" id="rind-name-${idx}" oninput="liveUpdate()">
    </div>

    <div class="field-group" style="margin-bottom:10px;">
      <label>Role on Engagement</label>
      <select id="rind-role-${idx}" onchange="liveUpdate()">
        ${AE_INDEP_ROLES.map(r => `<option value="${r}">${r || '—'}</option>`).join('')}
      </select>
    </div>

    <div class="field-group" style="margin-bottom:10px;">
      <label>Date</label>
      <div class="date-input-wrap">
        <input type="text" id="rind-date-${idx}" oninput="liveUpdate()">
        <button type="button" class="btn-cal" onclick="toggleCal('cal-rind-date-${idx}')"
          title="Pick date">&#x1f4c5;</button>
        <div id="cal-rind-date-${idx}" class="cal-popup hidden"></div>
      </div>
    </div>

    <div class="ae-subhead">Details of any “Yes” answers and safeguards applied / conclusion reached</div>

    <div class="field-group" style="margin-bottom:10px;">
      <textarea id="rind-details-${idx}" rows="4" oninput="liveUpdate()"
        placeholder="Leave blank to print the four ruled lines."></textarea>
    </div>

    <div class="ae-subhead">Signature — Engagement Team Member</div>

    <div class="field-group" style="margin-bottom:10px;">
      <label>Name</label>
      <input type="text" id="rind-sig-name-${idx}" oninput="liveUpdate()">
    </div>

    <div class="field-group" style="margin-bottom:10px;">
      <label>Date</label>
      <div class="date-input-wrap">
        <input type="text" id="rind-sig-date-${idx}" oninput="liveUpdate()">
        <button type="button" class="btn-cal" onclick="toggleCal('cal-rind-sig-date-${idx}')"
          title="Pick date">&#x1f4c5;</button>
        <div id="cal-rind-sig-date-${idx}" class="cal-popup hidden"></div>
      </div>
    </div>

    <div class="ae-subhead">Signature — Engagement Partner</div>

    <div class="field-group" style="margin-bottom:10px;">
      <label>Name</label>
      <input type="text" id="rind-pnr-name-${idx}" oninput="liveUpdate()">
    </div>

    <div class="field-group" style="margin-bottom:0;">
      <label>Date</label>
      <div class="date-input-wrap">
        <input type="text" id="rind-pnr-date-${idx}" oninput="liveUpdate()">
        <button type="button" class="btn-cal" onclick="toggleCal('cal-rind-pnr-date-${idx}')"
          title="Pick date">&#x1f4c5;</button>
        <div id="cal-rind-pnr-date-${idx}" class="cal-popup hidden"></div>
      </div>
    </div>
  `;
    container.appendChild(card);
    if (typeof aeRegisterReviewIndepCal === 'function') aeRegisterReviewIndepCal(idx);
  }

  removeReviewIndepPerson(idx) {
    document.getElementById(`rindep-card-${idx}`)?.remove();
    if (typeof aeUnregisterReviewIndepCal === 'function') aeUnregisterReviewIndepCal(idx);
    this.relabelReviewIndepPersons();
    this.liveUpdate();
  }

  relabelReviewIndepPersons() {
    let n = 0;
    for (let i = 1; i <= this.reviewIndepPersonCount; i++) {
      if (!document.getElementById(`rindep-card-${i}`)) continue;
      n++;
      const label = document.getElementById(`rindep-card-label-${i}`);
      if (label) label.textContent = `Declaration ${n}`;
    }
  }

  // An empty card is still a declaration — a blank copy to complete by hand is
  // what this document was before the fields existed, so it is not dropped.
  getReviewIndepPersons() {
    const out = [];
    const val = (id) => (document.getElementById(id)?.value || '').trim();
    for (let i = 1; i <= this.reviewIndepPersonCount; i++) {
      if (!document.getElementById(`rindep-card-${i}`)) continue;
      out.push({
        cardIdx: i,
        name: formatName(val(`rind-name-${i}`)),
        role: val(`rind-role-${i}`),
        date: val(`rind-date-${i}`),
        details: val(`rind-details-${i}`),
        signName: formatName(val(`rind-sig-name-${i}`)),
        signDate: val(`rind-sig-date-${i}`),
        partnerName: formatName(val(`rind-pnr-name-${i}`)),
        partnerDate: val(`rind-pnr-date-${i}`)
      });
    }
    return out;
  }

  // ── Loan certificates ─────────────────────────────────────────────────────

  addLoanCert() {
    this.loanCertCount++;
    const idx = this.loanCertCount;
    const container = document.getElementById('loan-cert-list');
    const card = document.createElement('div');
    card.id = `loan-cert-card-${idx}`;
    card.className = 'ae-card';
    card.innerHTML = `
    <button type="button" onclick="removeLoanCert(${idx})" title="Remove" class="ae-card-remove">\u2715</button>
    <div class="ae-card-title">Certificate ${idx}</div>

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
          <input type="radio" name="lc-balance-${idx}" value="credit" checked onchange="liveUpdate()"> Credit Balance
        </label>
      </div>
    </div>

    <div class="field-group" style="margin-bottom:10px;">
      <label>Amount (R)</label>
      <input type="text" id="lc-amount-${idx}" placeholder="e.g. 73 660.05" oninput="liveUpdate()">
    </div>

    <div class="field-group" style="margin-bottom:0;">
      <label>Date Signed</label>
      <div class="date-input-wrap">
        <input type="text" id="lc-date-${idx}" placeholder="e.g. DUMMYVILLE, 14 MARCH 2025" oninput="liveUpdate()">
        <button type="button" class="btn-cal" onclick="toggleCal('cal-lc-date-${idx}')"
          title="Pick date">&#x1f4c5;</button>
        <div id="cal-lc-date-${idx}" class="cal-popup hidden"></div>
      </div>
    </div>
  `;
    container.appendChild(card);
    // The certificate rows are built after the calendar map, so each new row
    // registers its own popup as it appears.
    if (typeof aeRegisterLoanCertCal === 'function') aeRegisterLoanCertCal(idx);
  }

  removeLoanCert(idx) {
    document.getElementById(`loan-cert-card-${idx}`)?.remove();
    if (typeof aeUnregisterLoanCertCal === 'function') aeUnregisterLoanCertCal(idx);
    this.liveUpdate();
  }

  getLoanCerts() {
    const certs = [];
    for (let i = 1; i <= this.loanCertCount; i++) {
      if (!document.getElementById(`loan-cert-card-${i}`)) continue;
      certs.push({
        // The card's own index, which is not the position in this array: a
        // removed card leaves a gap. The generator stamps it on the page so a
        // placeholder clicked there writes to the right card's fields.
        idx: i,
        name: formatName((document.getElementById(`lc-name-${i}`)?.value || '').trim()),
        balance: document.querySelector(`input[name="lc-balance-${i}"]:checked`)?.value || 'credit',
        amount: (document.getElementById(`lc-amount-${i}`)?.value || '').trim(),
        date: (document.getElementById(`lc-date-${i}`)?.value || '').trim().toUpperCase()
      });
    }
    return certs;
  }
}
