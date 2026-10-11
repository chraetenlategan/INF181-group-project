// DocumentGenerator.js — Document generation and all page-building helpers
// Depends on: config.js (CA_LETTERHEAD, AUDIT_LETTERHEAD, ENTITY_CONFIG),
//             utils.js (getVal, getRadio, formatNumber, toTitleCase),
//             EntityManager instance (for getDirectors, etc.)

class DocumentGenerator {
  constructor(entityManager) {
    this.em = entityManager;
  }

  generate() {
    // Alias entityManager methods to local scope (as the original code expected)
    const em = this.em;
    const getDirectors = () => em.getDirectors();
    const formatDirectorList = (dirs) => em.formatDirectorList(dirs);
    const getPronoun = (dirs, terms) => em.getPronoun(dirs, terms);
    const getEntityTerms = () => em.getEntityTerms();
    const getTermsForCount = (base, count) => em.getTermsForCount(base, count);
    const getReportSubState = () => em.getReportSubState();
    const getLoanCerts = () => em.getLoanCerts();
    const getShareholders = () => em.getShareholders();
    const currentEntityType = em.currentEntityType;

  const hl = (v) => `<span class="hl-kw">${v}</span>`;
  // Red checker only: text that follows from the form (an address, a
  // chosen sentence, the reviewing firm) but is not a keyword. Unstyled unless
  // body.super-red is on, so every export ignores it.
  const sr = (v) => (v ? `<span class="sr-kw">${v}</span>` : v);

  // Education department named by the school policies and engagement letters.
  // Blank field falls back to the Mpumalanga default rather than printing an
  // empty authority.
  const eduDept = (getVal('schoolEduDept') || '').trim()
    || (typeof DEFAULT_EDU_DEPT !== 'undefined' ? DEFAULT_EDU_DEPT : 'Mpumalanga Department of Education');

  // How the NPC policies describe the entity ("centre", "organisation", …).
  // Free text; a blank field falls back to the default wording.
  const npcOrg = (getVal('npcOrgName') || '').trim()
    || (typeof DEFAULT_NPC_ORG !== 'undefined' ? DEFAULT_NPC_ORG : 'centre/organisation');

  // How an NPO is described: "organisation", "club" or "centre" (Step 4, or the
  // dropdown in the NPO policy text — one field). [NPO_ORG] in the NPO policies,
  // engagement letters and auditor's report.
  const npoOrg = (getVal('npoOrgName') || '').trim()
    || (typeof DEFAULT_NPO_ORG !== 'undefined' ? DEFAULT_NPO_ORG : 'organisation');
  // Which department owns an NPO's assets: "[NPO_DEPT] of [NPO_DEPT_OF]".
  const npoDept = (getVal('npoDeptName') || '').trim()
    || (typeof DEFAULT_NPO_DEPT !== 'undefined' ? DEFAULT_NPO_DEPT : 'Mpumalanga Department');
  const npoDeptOf = (getVal('npoDeptOf') || '').trim()
    || (typeof DEFAULT_NPO_DEPT_OF !== 'undefined' ? DEFAULT_NPO_DEPT_OF : 'Social Development');
  // Which statement the school/NPO "No Asset Register" PPE policy writes the
  // assets off in: "Financial Performance" or "Surplus or Deficit".
  const ppeStmt = (getVal('ppeStmtName') || '').trim()
    || (typeof DEFAULT_PPE_STMT !== 'undefined' ? DEFAULT_PPE_STMT : 'Financial Performance');
  // Whether an NPO is governed by "members" or "directors" (Step 4). The entity
  // terms (pluralTerm, possessiveTerm, report_to) follow it through
  // getEntityConfig(); [NPO_BODY] carries it into the NPO templates.
  const npoBody = typeof getNpoBody === 'function' ? getNpoBody()
    : (getRadio('npoGoverningBody') === 'directors' ? 'directors' : 'members');

  const coRaw = getVal('companyName') || '[COMPANY NAME]';
  const isIndependentTrust = currentEntityType === 'trust' && /\s*-\s*independent\s*$/i.test(coRaw);
  const trustCleanName = isIndependentTrust ? coRaw.replace(/\s*-\s*independent\s*$/i, '').trim() : coRaw;
  // A non-profit company is styled "<NAME> NPC" wherever it is named, and a home
  // owners association "<NAME> Home Owners NPC". The suffix is applied here
  // rather than typed into the name field, so it can never be forgotten — and a
  // name that already carries the whole thing, or already ends in "Home Owners"
  // and only wants the NPC, is not made to say it twice.
  const coTrimmed = coRaw.trim();
  const npcSuffix = currentEntityType === 'hoa' && !/\bhome\s*owners\b\.?$/i.test(coTrimmed)
    ? 'Home Owners NPC'
    : 'NPC';
  const npcNamed = isNpcType(currentEntityType) && !/\bNPC\.?$/i.test(coTrimmed)
    ? `${coTrimmed} ${npcSuffix}`
    : coRaw;
  const coDisplay = currentEntityType === 'trust' ? trustCleanName
    : isNpcType(currentEntityType) ? npcNamed
    : coRaw;

  // Additional individuals (individuals only — e.g. spouses on one set of statements).
  // Unlimited: wherever the individual is named or addressed, all names appear
  // ("A, B and C"); the page header shows "NAME - ID / AND / NAME - ID" per
  // individual (see regLine below).
  const additionalIndividuals = currentEntityType === 'individual' ? em.getAdditionalIndividuals() : [];
  const hasSecondIndividual = additionalIndividuals.length > 0;

  // Income tax number (individuals only)
  const taxNumberRaw = currentEntityType === 'individual' ? (getVal('taxNumber') || '').trim() : '';

  // "A and B" / "A, B and C" — natural-language list of highlighted names
  const joinNames = (names) => names.length <= 1 ? (names[0] || '')
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  const allIndivNames = [coDisplay, ...additionalIndividuals.map(a => a.name)];
  // Everyone on an individual's set, with the rare "deceased" exception (the
  // main individual's comes from the static indDeceased box, the others' from
  // their own cards). Feeds the signature lines and the cover.
  const _indDeceased = currentEntityType === 'individual' && !!document.getElementById('indDeceased')?.checked;
  const allIndivPeople = [
    { name: coDisplay, deceased: _indDeceased, deceasedDate: _indDeceased ? (getVal('indDeceasedDate') || '').trim() : '' },
    ...additionalIndividuals,
  ];
  const co = hasSecondIndividual ? joinNames(allIndivNames.map(n => hl(n))) : hl(coDisplay);
  const tradingAsRaw = getVal('tradingAsName') || '';
  const tradingAs = tradingAsRaw ? hl(tradingAsRaw) : '';
  const hasTradingAs = (getRadio('hasTradingAs') === 'yes') && !!tradingAsRaw;
  // Prose identification of the entity. Where a set names the entity inside a
  // sentence ("…the financial statements of X for the year ended…"), the
  // trading name is part of that identification and has to travel with it — the
  // cover page's separate "Trading as:" line never reaches the engagement
  // letters or the reviewer's/auditor's reports, so the auditors were typing it
  // in by hand every time.
  const coProse = hasTradingAs ? `${co}, Trading as: ${tradingAs}` : co;
  const yearEndRaw = getVal('yearEnd') || '[YEAR END]';
  const prevYearEndRaw = getVal('prevYearEnd') || '[PREVIOUS YEAR END]';
  // NOTE: the long-form display values (yearEnd, yearEndLong, prevYearEnd) are
  // derived further down, after the date-format helpers are defined.
  const natureRaw = getVal('natureBusiness');
  // A trust has no main source of income (the field is hidden for it), so a
  // value left over from another entity type is ignored.
  const incomeRaw = currentEntityType === 'trust' ? '' : getVal('mainIncome');
  const nature = natureRaw
    ? natureRaw.charAt(0).toUpperCase() + natureRaw.slice(1)
    : '[NATURE OF BUSINESS]';
  const income = incomeRaw
    ? incomeRaw.charAt(0).toUpperCase() + incomeRaw.slice(1)
    : '[MAIN INCOME SOURCE]';
  // Mid-sentence versions. The general-information table prints these as
  // standalone cell values, where a leading capital reads right; the members'/
  // directors' report runs them inside a sentence, where it does not — the
  // auditors kept striking the capital out of "…is generated mainly from
  // Farming income." Inside a sentence the value goes in exactly as typed, so a
  // proper noun the user capitalised stays capitalised and a plain phrase like
  // "farming income" stays lower case.
  const natureMid = natureRaw || '[NATURE OF BUSINESS]';
  const incomeMid = incomeRaw || '[MAIN INCOME SOURCE]';
  const postal = toProperCase(getVal('postalAddress')) || '[POSTAL ADDRESS]';
  const regAddr = toProperCase(getVal('regAddress')) || '[REGISTERED ADDRESS]';
  const physAddr = toProperCase(getVal('physAddress')) || '';
  const businessAddr = toProperCase(getVal('businessAddress')) || '';
  const bankName = getVal('bankName') || '[BANK]';
  // ── Address rendering (single source of truth) ──
  // Every address anywhere in the document — engagement-letter addressee blocks
  // and the general-information table alike — goes through these, so all of them
  // are spaced identically.
  //   • `.addr-line` is a marker the squeeze skips — the element *and* its
  //     descendants (see PagePaginator) — so an address on a squeezed page keeps
  //     the same 1.3 spacing as one on a `data-no-squeeze` page, and the <br>s
  //     below never get rewritten to font-size:1pt / line-height:0.5.
  //   • `text-align:left` keeps `.doc-page p`'s justify off these lines.
  //
  // A whole addressee block is ONE `.addr-line` element and its lines are line
  // boxes inside it — never one element per line. Siblings carrying the same
  // inline `line-height` *should* space identically, but each is laid out on
  // its own, so anything that reaches a single line (the bold company name's
  // weight, an inherited font-size, a stray margin, sub-pixel rounding in the
  // scaled preview) moves only that line's gap. That is the "first gap is wider
  // than the ones below it" complaint, which survived both 1.9.1 and 1.9.3
  // because both only evened out the per-element styles. Stacking the lines
  // inside one block removes the possibility: the browser spaces them from a
  // single line-height.
  const addrGroup = (...parts) => {
    const html = parts.flat()
      .map(l => (typeof l === 'string' ? { html: l } : l))
      .filter(l => l && l.html && String(l.html).trim())
      .map(l => (l.bold ? `<strong>${l.html}</strong>` : sr(l.html)))
      .join('<br>');
    return html
      ? `<div class="addr-line" style="margin:0;line-height:1.3;text-align:left;">${html}</div>`
      : '';
  };
  // Comma-separated address field → its lines.
  const addrLines = (value) => (value || '').split(',').map(s => s.trim()).filter(Boolean);
  const addrBlock = (value) => addrGroup(addrLines(value));
  // ── Date formatting ──
  // Two canonical formats used across the document:
  //   • Prose / general dates  → long form  "10 July 2026"   (fmtDateLong)
  //   • Signature dates        → dotted form "2026.07.16"     (fmtDateSig)
  // Both parsers accept either input format so a field's stored format never
  // dictates how it renders — the point of use decides.
  const _DG_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const _parseAnyDate = (raw) => {
    if (!raw) return null;
    const dot = raw.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})$/);
    if (dot) return new Date(+dot[1], +dot[2] - 1, +dot[3]);
    // South African day-first numeric format: DD/MM/YYYY or DD.MM.YYYY or DD-MM-YYYY.
    const dmy = raw.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
    if (dmy) return new Date(+dmy[3], +dmy[2] - 1, +dmy[1]);
    const long = raw.match(/^(\d{1,2})\s+(\w+)\s+(\d{4})$/);
    if (long) {
      const mi = _DG_MONTHS.indexOf(long[2]);
      if (mi >= 0) return new Date(+long[3], mi, +long[1]);
    }
    const d = new Date(raw);
    return isNaN(d) ? null : d;
  };
  const fmtDateLong = (raw) => {
    const d = _parseAnyDate(raw);
    return d ? `${d.getDate()} ${_DG_MONTHS[d.getMonth()]} ${d.getFullYear()}` : raw;
  };
  const fmtDateSig = (raw) => {
    const d = _parseAnyDate(raw);
    return d ? `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}` : raw;
  };

  // ── Deceased (rare exception, any entity type) ──
  // A person flagged deceased on the form (EntityManager → the person's
  // "Exceptions" panel) signs as their name with "(Deceased <date>)" on the
  // line below. No date typed → "(Deceased)". The date renders in long form.
  const deceasedDateLong = (p) => (p && p.deceasedDate ? hl(fmtDateLong(p.deceasedDate)) : '');
  const deceasedCaption = (p) => {
    const dt = deceasedDateLong(p);
    return `(Deceased${dt ? ' ' + dt : ''})`;
  };
  // Name + caption for the plain bordered signature lines (engagement letters).
  const sigLabelWithCaptions = (nameHtml, p, extraCaption) => nameHtml
    + (p && p.deceased ? `<br><span style="font-size:8.5pt;font-weight:400;">${deceasedCaption(p)}</span>` : '')
    + (extraCaption ? `<br><span style="font-size:8.5pt;font-weight:400;">${extraCaption}</span>` : '');
  // Individuals' signature labels: upper-cased name, deceased caption beneath.
  const allIndivNamesUpper = allIndivPeople.map(p => sigLabelWithCaptions(hl(p.name.toUpperCase()), p));

  // Year-end dates always render in long prose form ("28 February 2026"),
  // regardless of the format they were entered/stored in (e.g. "28/02/2026").
  // yearEndLong is the un-highlighted string used by the period-derivation
  // regexes below; yearEnd/prevYearEnd are the highlighted display values.
  const yearEndLong = getVal('yearEnd') ? fmtDateLong(yearEndRaw) : '[YEAR END]';
  const yearEnd = hl(yearEndLong);
  const prevYearEnd = hl(getVal('prevYearEnd') ? fmtDateLong(prevYearEndRaw) : '[PREVIOUS YEAR END]');

  const _rawDateApproved = getVal('dateApproved');
  const _rawDateSigned = getVal('dateSigned');
  // Prose spots (approval sentences etc.) → long form.
  const dateApproved = hl(_rawDateApproved ? fmtDateLong(_rawDateApproved) : '[DATE APPROVED]');
  const dateSignedLong = hl(_rawDateSigned ? fmtDateLong(_rawDateSigned) : '[DATE SIGNED]');
  // Signature spots (compiler/auditor blocks, .sig-date lines) → dotted form.
  const dateSigned = hl(_rawDateSigned ? fmtDateSig(_rawDateSigned) : '[DATE SIGNED]');
  const dateApprovedSig = hl(_rawDateApproved ? fmtDateSig(_rawDateApproved) : '[DATE APPROVED]');

  // Engagement letter signature date: 14 days before dateSigned, dotted form.
  const engDateSigned = (() => {
    const d = _parseAnyDate(_rawDateSigned);
    if (!d) return hl('[DATE SIGNED]');
    d.setDate(d.getDate() - 14);
    return hl(fmtDateSig(`${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`));
  })();
  // Same engagement date in long prose form ("14 July 2026"). Used for the
  // "This letter is effective as from …" sentence, where the dotted signature
  // form reads wrong — the auditor kept reformatting it by hand.
  const engDateLong = (() => {
    const d = _parseAnyDate(_rawDateSigned);
    if (!d) return hl('[DATE]');
    d.setDate(d.getDate() - 14);
    return hl(fmtDateLong(`${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`));
  })();

  const dateOfIssue = hl(getVal('dateOfIssue') ? fmtDateLong(getVal('dateOfIssue')) : '[DATE OF ISSUE]');
  const pageStart = (currentEntityType === 'trust' ? getVal('trustPageStart') : currentEntityType === 'school' ? getVal('schoolPageStart') : getVal('pageStart')) || '5';
  const pageEnd = (currentEntityType === 'trust' ? getVal('trustPageEnd') : currentEntityType === 'school' ? getVal('schoolPageEnd') : getVal('pageEnd')) || '12';
  const hlPageStart = hl(pageStart);
  const hlPageEnd = hl(pageEnd);
  // The page fields are free text. Arithmetic on one that isn't a number
  // printed "NaN" on the page; show what was typed instead.
  const pageOffset = (v, delta) => {
    const n = Number(String(v).trim());
    return String(v).trim() !== '' && Number.isFinite(n) ? String(n + delta) : v;
  };
  const parentName = hl(getVal('parentName') || '[PARENT COMPANY]');

  // Number formatting
  const profitLoss = hl(formatNumber(getVal('profitLoss')) || '[PROFIT/LOSS]');
  const prevProfitLossRaw = getVal('prevProfitLoss');
  const prevProfitLoss = hl(formatNumber(prevProfitLossRaw) || '[PREV PROFIT/LOSS]');
  const plType = getRadio('plType') || 'profit';
  const prevPlType = getRadio('prevPlType') || 'profit';
  // No prior-year figure entered -> omit the comparative clause entirely rather
  // than printing a placeholder amount.
  const prevPlComparison = prevProfitLossRaw
    ? ` (${prevYearEnd} — ${sr(prevPlType)} of ${sr(`R&nbsp;${prevProfitLoss}`)})`
    : '';
  const dividendAmount = hl(formatNumber(getVal('dividendAmount')) || '[AMOUNT]');

  // Compiler/signer — normalise from select value (already uppercase)
  const compilerSignerRaw = document.getElementById('compilerSigner').value || 'A ANDERSON';
  const compilerSigner = hl(compilerSignerRaw);

  const baseTerms = getEntityTerms();
  // An NPO names nobody: no directors on the cover, and every signature is by
  // office (npoSigners below). Directors left over on an older save are ignored.
  const dirs = currentEntityType === 'npo' ? [] : getDirectors();
  const dirCount = dirs.length;

  // Choose singular or plural terms based on actual director count
  const terms = getTermsForCount(baseTerms, dirCount);
  const dirList = hl(formatDirectorList(dirs));
  const pronoun = getPronoun(dirs, baseTerms);

  const coUpper = hl(coDisplay.toUpperCase());
  const shareCapital = getRadio('shareCapital');
  const dividends = getRadio('dividends');
  const fixedAssets = getRadio('fixedAssets');
  const outlook = getRadio('outlook');
  const parentCo = getRadio('parentCo');

  // Plural / singular helpers
  const pluralTerm = terms.plural;   // e.g. "Director" (1) or "Directors" (2+)
  // Possessive helper: "Director's" (singular) vs "Directors'" (plural)
  const possessiveTerm = dirCount === 1 ? pluralTerm + "'s" : pluralTerm + "'";
  const possessiveTermLower = possessiveTerm.toLowerCase();
  const bodyTerm = terms.body;     // e.g. "The director" (1) or "The directors" (2+)

  // For sentences that differ purely on count:
  const dirSingularPlural = dirCount === 1
    ? { isAre: 'is', hasHave: 'has', theirIts: 'their', directorS: pluralTerm }
    : { isAre: 'are', hasHave: 'have', theirIts: 'their', directorS: pluralTerm };

  const entityType = currentEntityType || 'company';
  const reportType = getRadio('reportType') || 'compilation';
  // PPRA company review (property practitioner): the reviewer's report and the
  // review engagement letter are issued by the registered auditor on the audit
  // letterhead. See isPpraCompany() in config.js.
  const isPpra = typeof isPpraReview === 'function' && isPpraReview(entityType);

  // An individual can be issued either the full annual financial statements or a
  // bare statement of assets and liabilities. The latter changes the title block
  // on the cover, drops every accounting-policy page, and drops the index page
  // entirely (`getIndexConfig()` returns null for it).
  const isAssetsLiab = typeof isAssetsLiabilitiesSet === 'function'
    ? isAssetsLiabilitiesSet(entityType)
    : false;
  const docTitle = isAssetsLiab
    ? 'STATEMENT OF ASSETS AND LIABILITIES'
    : 'ANNUAL FINANCIAL STATEMENTS';

  // Registration number — optional for attorneys and clubs
  const hasReg = entityType === 'attorneys' ? getRadio('attHasReg') === 'yes'
               : entityType === 'club' ? !!getVal('regNumber')
               : true;
  const reg = hasReg ? (getVal('regNumber') || '') : '';
  const hlReg = reg ? hl(reg) : '';
  const headerTradingAs = hasTradingAs
    ? `<div class="co-trading-as">Trading as: ${tradingAs}</div>`
    : '';
  // Optional line directly under an NPC's name and above the registration
  // number — some sets carry the Section 21 wording from the old Companies Act,
  // most do not, so it is a form question (on by default for a HOA). It is not
  // italicised: `co-sec21` says so outright, because the pages that print the
  // registration number in italics would otherwise take it with them. It
  // follows from a form radio, so the red checker paints it (`sr`).
  const npcSection21Line = (typeof npcIsSection21 === 'function' && npcIsSection21(currentEntityType))
    ? `<div class="co-reg co-sec21">${sr('Association incorporated under Section 21')}</div>`
    : '';
  const regIsId = isIdNumber(reg);
  const regLabel = regIsId ? 'Identity number' : 'Registration Number';
  // Multi-individual heading pairs each name with their INCOME TAX number —
  // ID numbers appear only in the Identity Numbers row of the General Information table.
  const regLine = hasSecondIndividual
    ? [{ nameUpper: coUpper, tax: taxNumberRaw }, ...additionalIndividuals.map(a => ({ nameUpper: hl(a.name.toUpperCase()), tax: a.taxNumber }))]
        .map(p => `<div class="co-name">${p.nameUpper}${p.tax ? ` - ${hl(p.tax)}` : ''}</div>`)
        .join('\n<div class="co-name">AND</div>\n') + headerTradingAs
    : currentEntityType === 'individual'
    ? `<div class="co-name">${coUpper}${taxNumberRaw ? ` - ${hl(taxNumberRaw)}` : ''}</div>${headerTradingAs}`
    : currentEntityType === 'trust' && reg
    ? `<div class="co-name">${coUpper} - ${hl(reg)}</div>${headerTradingAs}`
    : `<div class="co-name">${coUpper}</div>${npcSection21Line}${headerTradingAs}${reg ? `<div class="co-reg">${regIsId ? `Identity number: (${hlReg})` : `(Registration Number ${hlReg})`}</div>` : ''}`;
  const regLineItalic = reg ? (regIsId ? `<p><strong>Identity number: (${hlReg})</strong></p>` : `<p><strong>(Registration Number ${hlReg})</strong></p>`) : '';

  // Derived firm name — Audit reports use INF181 Audit Group, all others use INF181 Chartered
  // Accountants. Both firm names and the footer locality are overridable from the
  // admin panel (Settings → Admin → Firm); the literals here are the fallbacks.
  const _brand = (typeof AdminPanel !== 'undefined' && AdminPanel.getBrand) ? AdminPanel.getBrand : () => '';
  const firmCA = _brand('firmCA') || 'INF181 Group Project';
  const firmAudit = _brand('firmAudit') || 'INF181 Audit Group';
  const firmLocality = _brand('locality') || 'Dummyville';
  const isAuditReport = (reportType === 'audit');
  // A PPRA review is the registered auditor's report, so it names the audit firm too.
  const inf181FirmName = (isAuditReport || isPpra) ? firmAudit : firmCA;
  const inf181FirmFooter = isAuditReport ? firmAudit : `${firmCA} &nbsp;·&nbsp; ${firmLocality}`;

  // The Directors' Report "Specific Matters" sentences below are chosen on the
  // form. Under the red checker only the words that tell one choice from
  // another are wrapped in `sr()` — "no changes", "dividend" + its amount — not
  // the whole sentence, or the entire page reads red and nothing stands out.

  // Share capital sentence (not applicable for CC)
  // A non-profit company may not have a share capital and may not distribute to
  // its members, so both sentences are dropped from its report entirely.
  let shareCapitalSentence = '';
  if (entityType !== 'cc' && !isNpcType(entityType)) {
    if (shareCapital === 'nochange') shareCapitalSentence = `There were ${sr('no changes')} in the authorised or issued share capital of the company during the year under review.`;
    else if (shareCapital === 'issued') shareCapitalSentence = `Shares and share capital were ${sr('issued since the company was incorporated')} during the year under review.`;
    // Free-typed: every word of it is the client's own, so all of it is red.
    else if (shareCapital === 'other') shareCapitalSentence = sr(getVal('shareCapitalOther').trim());
    else shareCapitalSentence = `Shares were ${sr('authorised and issued for no consideration')} to the company during the year under review.`;
  }

  // Dividend sentence (CC uses "capital distribution")
  let dividendSentence = '';
  if (isNpcType(entityType)) {
    dividendSentence = '';
  } else if (entityType === 'cc') {
    if (dividends === 'none') dividendSentence = `${sr('No capital distribution')} was declared or paid during the year.`;
    else dividendSentence = `A ${sr('capital distribution')} of ${sr(`R&nbsp;${dividendAmount}`)} was declared/paid during the year.`;
  } else {
    if (dividends === 'none') dividendSentence = `${sr('No dividend')} was declared or paid during the year.`;
    else dividendSentence = `A ${sr('dividend')} of ${sr(`R&nbsp;${dividendAmount}`)} was declared/paid during the year.`;
  }

  // Fixed assets sentence
  let fixedAssetsSentence = '';
  if (fixedAssets === 'nochange') fixedAssetsSentence = `${sr('No major change')} in the nature of the company's fixed assets or in the policy relating to the use thereof, took place during the accounting period.`;
  else fixedAssetsSentence = `There was ${sr('a change')} to the accounting policy on fixed assets such as described in note 1.1 and 1.2 of the financial statements.`;


  // Parent sentence (not applicable for CC)
  let parentSentence = '';
  if (entityType !== 'cc') {
    if (parentCo === 'none') parentSentence = `The company has ${sr('no parent company')} in or outside the Republic.`;
    else parentSentence = `The company's parent company is ${parentName}.`;
  }

  // Group state — whether THIS company is a parent holding subsidiaries. Distinct
  // from `parentCo` above, which records a parent sitting *above* this company.
  // 'unconsolidated' = subsidiaries exist but no group statements were produced
  // (a departure from the framework that every report has to disclose);
  // 'consolidated' = consolidated and separate statements are presented.
  const groupCo = getRadio('groupCo') || 'no';
  const isGroupUnconsolidated = groupCo === 'unconsolidated';
  const isGroupConsolidated = groupCo === 'consolidated';
  const subsidiaryName = hl(getVal('subsidiaryName') || '[SUBSIDIARY]');

  // The departure paragraph shared by the compiler's and reviewer's reports.
  const groupDepartureAlert = `The <em>'International Financial Reporting Standard of Small and Medium-sized Entities'</em> states that a parent shall present consolidated financial statements in which it consolidates its investments in subsidiaries. In preparing consolidated financial statements, an entity combines the financial statements of the parent and its subsidiaries line by line by adding together like items of assets, liabilities, equity, income and expenses. The company did not produce group financial statements, which is not in accordance with the financial reporting framework. The particulars of the departure from the <em>'International Financial Reporting Standard of Small and Medium-sized Entities'</em> have been omitted from the financial statements. We draw your attention to the ${possessiveTermLower} report which provides the reason for departure from the <em>'International Financial Reporting Standard of Small and Medium-sized Entities'</em>.`;

  // Report section slot numbers, stamped into the `.page-number` marker on each
  // page. These are a PREVIEW-ONLY aid — `@media print` and the print window both
  // hide `.page-number`, and edit mode can toggle it off — so they are not the
  // numbers a reader of the finished document sees.
  const pg1 = 1, pg2 = 2, pg3 = 3, pg4 = 4;

  // The numbers that actually print are the index table's, and those come from the
  // `idx-<id>` form inputs, which default to the item's position in this entity+
  // report's INDEX_CONFIGS list. So a sentence that CITES another page has to read
  // the index, not a slot constant — the two do not line up, and no one constant
  // fits every layout. The CA(SA) declaration hard-coded 2 for the compiler's
  // report: right for a trust, where the declaration is index item 1 and the
  // compiler's report item 2, but wrong for a company or CC, where the
  // responsibilities page sits between them and the compiler's report is item 3.
  function indexPageNo(id, fallback) {
    const typed = getVal(`idx-${id}`);
    if (typed) return typed;
    const cfg = typeof getIndexConfig === 'function' ? getIndexConfig(entityType, reportType) : null;
    const at = cfg ? cfg.findIndex(item => item.id === id) : -1;
    return String(at >= 0 ? at + 1 : fallback);
  }

  // Where the compiler's report lands. The fallback covers a combo with no index
  // config at all, and mirrors the assembly: a trust runs page1 → page3 with
  // nothing between them, everything else runs page1 → page2 → page3.
  const compilerReportPage = indexPageNo('compilerReport', entityType === 'trust' ? 2 : 3);

  // Signature blocks for directors.
  // Takes the *signing* list, which for a trust excludes the independent
  // trustee — they attend and are named on the cover, but never sign. The
  // body used to iterate the outer `dirs` and ignore this parameter entirely,
  // so the independent trustee got a signature line on every page.
  // Directors / trustees / members may be flagged as signing for the whole
  // governing body (EntityManager → the "Signs on behalf of…" checkbox).
  // Whoever is flagged becomes the complete signing list — usually one person,
  // sometimes two — and each gets the caption under their name. None flagged
  // means everyone signs, the normal case. The caption names whichever body this
  // entity has (config.js → boardRepCaption): "the Board of Directors" for a
  // company, "the Trustees" for a trust, "the Members" for a CC.
  const BOARD_REP_CAPTION = (typeof boardRepCaption === 'function')
    ? boardRepCaption(entityType)
    : '(On Behalf of the Board of Directors)';
  function boardReps(signers) { return signers.filter(d => d.signsForBoard); }

  function sigBlock(signers) {
    const reps = boardReps(signers);
    if (reps.length) signers = reps;
    if (!signers.length) {
      return `<div class="sig-entry" contenteditable="false"><div class="sig-space" style="min-height:130px;"></div><div class="sig-line">&nbsp;</div><div class="sig-name">&nbsp;</div></div>`;
    }
    let html = '<div class="sig-flow-wrap" style="display:flex;flex-wrap:wrap;gap:56px 48px;margin-top:16px;">';
    signers.forEach(d => {
      html += `<div class="sig-entry" contenteditable="false" style="min-width:180px;margin-bottom:32px;">
    <div class="sig-space" style="min-height:130px;"></div>
    <div class="sig-line">&nbsp;</div>
    <div class="sig-name">${d.role ? d.full : hl(d.full)}</div>${d.deceased ? `
    <div class="sig-sub">${deceasedCaption(d)}</div>` : ''}${d.signsForBoard ? `
    <div class="sig-sub">${sr(BOARD_REP_CAPTION)}</div>` : ''}
  </div>`;
    });
    html += '</div>';
    return html;
  }

  // Letterhead helpers — the src is admin-overridable (Settings → Admin →
  // Letterheads); the config constants are the bundled defaults.
  const _lh = (typeof AdminPanel !== 'undefined' && AdminPanel.getLetterhead) ? AdminPanel.getLetterhead : () => '';
  function caLetterhead() { return `<img class="letterhead-img" src="${_lh('caHeader') || CA_LETTERHEAD}"    alt="INF181 Group Project">`; }
  function auditLetterhead() { return `<img class="letterhead-img" src="${_lh('auditHeader') || AUDIT_LETTERHEAD}" alt="INF181 Audit">`; }
  function letterheadFooter() { return `<div class="letterhead-footer">
    <img class="letterhead-footer-img" src="${_lh('caFooter') || LETTERHEAD_FOOTER_IMG}" alt="INF181 Footer">
  </div>`; }
  function auditFooter() { return `<div class="letterhead-footer">
    <img class="letterhead-footer-img" src="${_lh('auditFooter') || AUDIT_FOOTER_IMG}" alt="INF181 Audit Footer">
  </div>`; }

  // Compiler block helper
  function compilerBlock(signer, date) {
    return `<div class="compiler-block">
  <p>${signer}</p>
  <p>CHARTERED ACCOUNTANT (SA)</p>
  <p>${date}</p>
</div>`;
  }

  // Auditor block helper (for school and registered auditor reports)
  function auditorBlock(signer, date) {
    return `<div class="compiler-block">
  <p>${signer}</p>
  <p>REGISTERED AUDITOR (SA)</p>
  <p>${date}</p>
</div>`;
  }

  // ── School-specific auditor + preparer ──
  const schoolAuditorSigner = getRadio('schoolAuditor') || 'R CLARKE';
  const schoolPreparerName = getVal('schoolPreparerName') || '[PREPARER NAME]';
  const schoolCapRaw = document.getElementById('schoolPreparerCapacity')?.value || 'financial officer';
  const schoolCapOther = getVal('schoolPreparerCapacityOther');
  const schoolCapacity = schoolCapRaw === 'other' ? (schoolCapOther || '[CAPACITY]') : schoolCapRaw;
  const schoolPreparerSentence = `The financial statements were prepared under the supervision of ${schoolPreparerName} in their capacity as ${schoolCapacity}.`;

  // ── Preparer sentence ──
  // A preparer explicitly chosen on the form wins, whatever the report type.
  // When nothing has been chosen the sentence falls back to the INF181
  // signatory's own credentials — which is what a compilation always used, so
  // an untouched form still produces exactly the sentence it produced before.
  let preparerSentence = '';
  if (entityType === 'school') {
    // School uses its own preparer fields (handled separately via schoolPreparerSentence)
    preparerSentence = '';
  } else {
    const signerPreparerMap = {
      'A ANDERSON': 'The financial statements were prepared under the supervision of Alice Anderson BCom CA (SA) in his capacity as an independent professional accountant.',
      'H BROOKS': 'The financial statements were prepared under the supervision of Henry Brooks BAcc CA (SA) in his capacity as an independent professional accountant.',
      'R CLARKE': 'The financial statements were prepared under the supervision of Rita Clarke BCompt CA (SA) in her capacity as an independent professional accountant.',
      'R DANIELS': 'The financial statements were prepared under the supervision of Rosa Daniels BCompt CA (SA) in her capacity as an independent professional accountant.',
    };
    const quickSel = document.getElementById('preparerQuickSelect')?.value;
    if (quickSel && quickSel !== 'custom' && EntityManager.PREPARER_MAP[quickSel]) {
      preparerSentence = EntityManager.PREPARER_MAP[quickSel];
    } else {
      const pName = getVal('preparerName');
      const pCapRaw = document.getElementById('preparerCapacity')?.value || 'financial officer';
      const pCapOther = getVal('preparerCapacityOther');
      const pCap = pCapRaw === 'other' ? (pCapOther || '[capacity]') : pCapRaw;
      if (pName) {
        preparerSentence = `The financial statements were prepared under the supervision of ${pName} in their capacity as ${pCap}.`;
      }
    }
    if (!preparerSentence) {
      preparerSentence = signerPreparerMap[compilerSignerRaw] || '';
    }
    // Individuals name the preparer by initial and surname — "R Clarke", not
    // "Rita Clarke". Qualifications after the surname stay as they are.
    if (entityType === 'individual' && preparerSentence) {
      preparerSentence = preparerSentence.replace(
        /(under the supervision of\s+)(.+?)(\s+in (?:his|her|their) capacity)/i,
        (_m, lead, name, tail) => lead + abbreviateGivenNames(name) + tail
      );
    }
  }

  // ── Template substitution helpers ──
  // Pull text from AdminPanel templates, substitute [VARIABLE] placeholders
  const _entityTypeLabel = entityType === 'cc' ? 'close corporation'
    : entityType === 'trust' ? 'trust' : entityType === 'bc' ? 'body corporate'
    : entityType === 'npo' ? 'non-profit organisation' : isNpcType(entityType) ? 'non-profit company'
    : entityType === 'church' ? 'church'
    : entityType === 'club' ? 'club' : entityType === 'school' ? 'school'
    : entityType === 'individual' ? 'individual' : entityType === 'attorneys' ? 'firm'
    : 'company';

  function _tpl(id, extraVars) {
    if (typeof AdminPanel === 'undefined' || !AdminPanel.getTemplate) return '';
    const raw = AdminPanel.getTemplate(id);
    if (!raw) return '';
    let text = raw
      .replace(/\[COMPANY\]/g, coProse)
      .replace(/\[TRADING_AS\]/g, tradingAs)
      .replace(/\[YEAR_END\]/g, yearEnd)
      .replace(/\[ROLE\]/g, pluralTerm.toLowerCase())
      .replace(/\[ROLE_POSSESSIVE\]/g, possessiveTermLower)
      .replace(/\[ROLE_POSSESSIVE_TITLE\]/g, possessiveTerm)
      .replace(/\[IS_ARE\]/g, dirSingularPlural.isAre)
      .replace(/\[HAS_HAVE\]/g, dirSingularPlural.hasHave)
      .replace(/\[ENTITY_TYPE\]/g, _entityTypeLabel)
      .replace(/\[DATE\]/g, engDateLong)
      .replace(/\[START\]/g, hlPageStart)
      .replace(/\[END\]/g, hlPageEnd)
      .replace(/\[EDU_DEPT\]/g, eduDept)
      .replace(/\[NPC_ORG\]/g, npcOrg)
      .replace(/\[NPO_ORG\]/g, npoOrg)
      .replace(/\[NPO_BODY\]/g, npoBody)
      .replace(/\[NPO_DEPT_OF\]/g, npoDeptOf)
      .replace(/\[NPO_DEPT\]/g, npoDept)
      .replace(/\[PPE_STMT\]/g, ppeStmt);
    if (extraVars) {
      for (const k of Object.keys(extraVars)) {
        text = text.replace(new RegExp('\\[' + k + '\\]', 'g'), extraVars[k]);
      }
    }
    return text;
  }

  function _tplHtml(id, extraVars) {
    return _renderTplText(_tpl(id, extraVars));
  }

  // Same rendering as _tplHtml, but over a line slice of the template. Lets a
  // long template be split across two pages at a deliberate point instead of
  // wherever the paginator's overflow cut happens to land.
  function _tplHtmlLines(id, start, end, extraVars) {
    const text = _tpl(id, extraVars);
    if (!text) return '';
    return _renderTplText(text.split('\n').slice(start, end).join('\n').trim());
  }

  function _renderTplText(text) {
    if (!text) return '';
    const paragraphs = text.split('\n\n');
    let html = '';
    for (const para of paragraphs) {
      const lines = para.split('\n');
      const hasBullets = lines.some(l => l.startsWith('• '));
      if (hasBullets) {
        const intro = [];
        const bullets = [];
        for (const l of lines) {
          if (l.startsWith('• ')) bullets.push(l.slice(2));
          else if (l.trim()) intro.push(l);
        }
        if (intro.length) html += '<p>' + intro.join(' ') + '</p>';
        if (bullets.length) html += '<ul>' + bullets.map(b => '<li>' + b + '</li>').join('') + '</ul>';
      } else {
        html += '<p>' + para.replace(/\n/g, ' ') + '</p>';
      }
    }
    return html;
  }

  function _tplNumbered(id, extraVars) {
    const text = _tpl(id, extraVars);
    if (!text) return '';
    const lines = text.split('\n');
    let html = '';
    for (const line of lines) {
      if (!line.trim()) continue;
      const numMatch = line.match(/^(\d+\.\d+)\s{2,}(.+)$/);
      const subMatch = line.match(/^\(([a-z])\)\s*(.+)$/);
      if (numMatch) {
        html += `<p style="padding-left:28px;text-indent:-28px;"><span style="display:inline-block;width:28px;">${numMatch[1]}</span>${numMatch[2]}</p>\n`;
      } else if (subMatch) {
        html += `<p style="margin-left:40px;padding-left:28px;text-indent:-28px;margin-top:0;margin-bottom:0;"><span style="display:inline-block;width:28px;">(${subMatch[1]})</span>${subMatch[2]}</p>\n`;
      } else {
        html += `<p>${line}</p>\n`;
      }
    }
    return html;
  }

  // Director rows for cover page
  // Registration number (contains '/') = business entity, 13-digit number = person with initials
  // Independent trustee data — from the trustee marked as independent trustee
  const indDir = entityType === 'trust' ? dirs.find(d => d.isIndTrustee) : null;
  const hasIndTrustee = !!indDir;

  // Filter the independent trustee out of the normal trustees list
  const filteredDirs = hasIndTrustee
    ? dirs.filter(d => !d.isIndTrustee)
    : dirs;

  // By default an independent trustee signs the index only: they are not
  // counted among the trustees who attended a meeting or act as the trust's
  // representatives, and are disclosed separately on the cover and the index
  // approval block. Ticking "All documents" puts them back on every signature
  // block in their normal place in the trustee list.
  const indSignsAll = hasIndTrustee && indDir.indSignsAll;
  // NPO signs by office, never by name: the Chairperson (ticked by default) and
  // at most one of the Secretary, the Coordinator or the Treasurer — any of
  // them may be unticked ('none'). `role` keeps them out of the red checker —
  // they are fixed wording, not a typed value.
  const npoSecondChoice = getRadio('npoSecondSigner');
  const npoSecond = npoSecondChoice === 'none' ? null
    : ({ coordinator: 'COORDINATOR', treasurer: 'TREASURER' }[npoSecondChoice] || 'SECRETARY');
  const npoSigners = entityType === 'npo'
    ? [
        ...(document.getElementById('npoSignChair')?.checked ? [{ full: 'CHAIRPERSON', role: true }] : []),
        ...(npoSecond ? [{ full: npoSecond, role: true }] : [])
      ]
    : null;
  const sigDirs = npoSigners || (entityType === 'trust' && !indSignsAll ? filteredDirs : dirs);
  const sigDirList = hl(formatDirectorList(sigDirs));

  // Nested two-column table so the ID numbers all start at the same position.
  // Poppins digits are not tabular, so each digit gets a fixed-width box too.
  const digitCells = s => s.replace(/\d/g, d => `<span class="digit-cell">${d}</span>`);
  const idAlignRow = (name, idPart) => idPart
    ? `<tr><td>${name}</td><td>${digitCells(idPart)}</td></tr>`
    : `<tr><td colspan="2">${name}</td></tr>`;
  const idAlignTable = rows => `<table class="cover-id-align">${rows.join('')}</table>`;

  const dirCoverRow = d => {
    if (!d.idNo) return idAlignRow(d.full, '');
    if (d.isBusiness) return idAlignRow(d.full, `(Registration number: ${hl(d.idNo)})`);
    return idAlignRow(d.full, `–&nbsp;&nbsp;${hl(formatIdString(d.idNo))}`);
  };
  // A deceased director / trustee / member leaves the main row and gets a row
  // of their own beneath it: "Deceased Trustee as on 14 June 2025". People who
  // died on the same date share one row; no date typed → "Deceased Trustee".
  const livingCoverDirs = filteredDirs.filter(d => !d.deceased);
  const deceasedCoverDirs = filteredDirs.filter(d => d.deceased);
  const directorCoverRows = livingCoverDirs.length
    ? idAlignTable(livingCoverDirs.map(dirCoverRow))
    : deceasedCoverDirs.length ? ''
    : ((entityType === 'club' || entityType === 'church' || entityType === 'school' || entityType === 'npo') ? '' : '[DIRECTOR NAMES]');
  // The row label follows the living count, not the whole list's.
  const directorCoverLabel = livingCoverDirs.length === 1 ? baseTerms.singular : baseTerms.plural;
  const deceasedCoverLabel = (role, p) => {
    const dt = deceasedDateLong(p);
    return ['Deceased', role].filter(Boolean).join(' ') + (dt ? ' as on ' + dt : '');
  };
  const deceasedDirGroups = [];
  deceasedCoverDirs.forEach(d => {
    const key = (d.deceasedDate || '').trim();
    let g = deceasedDirGroups.find(x => x.key === key);
    if (!g) deceasedDirGroups.push(g = { key, dirs: [] });
    g.dirs.push(d);
  });
  const deceasedDirCoverRows = deceasedDirGroups.map(g => `<tr>
    <td>${deceasedCoverLabel(baseTerms.singular, g.dirs[0])}</td>
    <td>${idAlignTable(g.dirs.map(dirCoverRow))}</td>
  </tr>`).join('');

  // Independent trustee = business: show business name + reg, then representative (person) underneath
  // Independent trustee = person: show person name + ID directly
  let indTrusteeDisplay = '';
  let repPersonDisplay = '';
  if (hasIndTrustee) {
    if (indDir.indType === 'business' && indDir.indBizName) {
      indTrusteeDisplay = idAlignRow(indDir.indBizName, indDir.indBizReg ? `–&nbsp;&nbsp;${hl(indDir.indBizReg)}` : '');
      repPersonDisplay = indDir.full
        ? idAlignRow(indDir.full, indDir.idNo ? `–&nbsp;&nbsp;${hl(formatIdString(indDir.idNo))}` : '')
        : '';
    } else {
      indTrusteeDisplay = idAlignRow(indDir.full, indDir.idNo ? `–&nbsp;&nbsp;${hl(formatIdString(indDir.idNo))}` : '');
    }
  }

  // ── PAGE 0: COVER PAGE ──
  const coverPage = `
  <div class="cover-page">
<div class="cover-title-block">
  ${regLine}
  <div class="cover-year">${docTitle}</div>
  <div class="cover-subtitle">For the year ended ${yearEnd}</div>
</div>

<div class="cover-info-section">
<h2 class="cover-section-heading">General Information</h2>

<table class="cover-info-table">
  <tr>
    <td>${entityType === 'individual' ? 'Country of Domicile' : 'Country of Incorporation and Domicile'}</td>
    <td>South Africa</td>
  </tr>
  ${(reg || hasSecondIndividual || entityType === 'individual') ? `<tr>
    <td>${hasSecondIndividual ? 'Identity Numbers' : entityType === 'individual' ? 'Identity Number' : regIsId ? 'Identity Number' : 'Registration Number'}</td>
    <td>${hasSecondIndividual
      ? [{ nameUpper: coUpper, id: reg ? hlReg : '' }, ...additionalIndividuals.map(a => ({ nameUpper: hl(a.name.toUpperCase()), id: a.idNumber ? hl(a.idNumber) : '' }))]
          .map(p => `${p.nameUpper}${p.id ? ` - ${p.id}` : ''}`).join('<br>')
      : reg ? hlReg : ''}</td>
  </tr>` : ''}
  ${entityType === 'individual' && !hasSecondIndividual ? `<tr>
    <td>Income Tax Number</td>
    <td>${taxNumberRaw ? hl(taxNumberRaw) : ''}</td>
  </tr>` : ''}
  ${entityType === 'individual' ? allIndivPeople.filter(p => p.deceased).map(p => `<tr>
    <td>${deceasedCoverLabel('', p)}</td>
    <td>${hl(p.name)}</td>
  </tr>`).join('') : ''}
  ${entityType === 'individual' && !natureRaw ? '' : `<tr>
    <td>Nature of Business and Principal Activities</td>
    <td>${nature}</td>
  </tr>`}
  ${directorCoverRows && entityType !== 'individual' ? `<tr>
    <td>${directorCoverLabel}</td>
    <td>${directorCoverRows}</td>
  </tr>` : ''}
  ${entityType !== 'individual' ? deceasedDirCoverRows : ''}
  ${hasIndTrustee && indTrusteeDisplay ? `<tr>
    <td>${indDir.deceased ? deceasedCoverLabel('Independent Trustee', indDir) : 'Independent Trustee'}${repPersonDisplay ? '<br>Representative' : ''}</td>
    <td>${idAlignTable([indTrusteeDisplay, repPersonDisplay].filter(Boolean))}</td>
  </tr>` : ''}
  ${entityType !== 'individual' && regAddr && regAddr !== '[REGISTERED ADDRESS]' ? `<tr>
    <td>Registered Office</td>
    <td>${addrBlock(regAddr)}</td>
  </tr>` : ''}
  ${entityType === 'individual' && regAddr && regAddr !== '[REGISTERED ADDRESS]' ? `<tr>
    <td>Physical Address</td>
    <td>${addrBlock(regAddr)}</td>
  </tr>` : ''}
  ${physAddr && entityType !== 'individual' ? `<tr><td>Physical Address</td><td>${addrBlock(physAddr)}</td></tr>` : ''}
  ${businessAddr && entityType !== 'individual' ? `<tr><td>Business Address</td><td>${addrBlock(businessAddr)}</td></tr>` : ''}
  ${entityType !== 'individual' && postal && postal !== '[POSTAL ADDRESS]' ? `<tr>
    <td>Postal Address</td>
    <td>${addrBlock(postal)}</td>
  </tr>` : ''}
  ${entityType === 'individual' && postal && postal !== '[POSTAL ADDRESS]' ? `<tr>
    <td>Postal Address</td>
    <td>${addrBlock(postal)}</td>
  </tr>` : ''}
  ${bankName && bankName !== '[BANK]' ? `<tr>
    <td>Bank</td>
    <td>${bankName}</td>
  </tr>` : ''}
  <tr>
    <td>Reporting Currency</td>
    <td>South African Rand</td>
  </tr>
  ${(() => {
    // Individuals show no reviewer/auditor/signatory row on the general page.
    if (entityType === 'individual') {
      return '';
    }
    const roleLabel = entityType === 'school' || isAuditReport ? 'Auditor'
      : reportType === 'review' ? 'Reviewer' : 'Compiler';
    const firmLine = entityType === 'school' ? firmAudit : inf181FirmName;
    return `<tr>
    <td>${sr(roleLabel)}</td>
    <td>${sr(firmLine)}</td>
  </tr>`;
  })()}
  ${entityType !== 'individual' && entityType === 'school'
      ? `<tr><td>Preparer</td><td>${schoolPreparerSentence}</td></tr>`
      : entityType !== 'individual' && preparerSentence ? `<tr><td>Preparer</td><td>${preparerSentence}</td></tr>` : ''}
  ${entityType === 'individual' && preparerSentence ? `<tr>
    <td>Preparer</td>
    <td>${preparerSentence}</td>
  </tr>` : ''}
  <tr>
    <td>Issued</td>
    <td>${dateOfIssue}</td>
  </tr>
</table>
</div>
  </div>`;

  // ── PAGE 1: CA DECLARATION (text + signature on one page) ──
  const page1 = `
  <div class="doc-page ca-decl-page" style="font-size:9.5pt;line-height:var(--doc-lh-decl);">
${caLetterhead()}
<h2 class="center-heading" style="font-size:10pt;margin:4px 0 8px;">The Chartered Accountant's (South Africa) Declaration</h2>
<p style="margin-bottom:0;">The following annual financial statements of ${co}, as presented on pages ${hlPageStart} to ${hlPageEnd}, have been independently compiled by a Chartered Accountant (South Africa) [CA(SA)]. Refer to compilation report on page ${hl(compilerReportPage)}.</p>
<p style="margin-bottom:0;">Use of the CA(SA) designation is governed by the <em>Chartered Accountants Designation (Private) Act</em>, 1993 (Act 67 of 1993), which regulates and permits the use of the CA(SA) designation exclusively by members of The South African Institute of Chartered Accountants (SAICA). Use of the designation without SAICA membership is consequently a criminal offence, and misuse is subject to legal action.</p>
<p style="margin-bottom:0;">SAICA is the premier accountancy body in South Africa and one of the leading chartered accountancy institutes in the world and all members must comply with the Code of Professional Conduct which conforms to the code released by the International Ethics Standards Board for Accountants (IESBA). The SAICA code and definitions contained therein are consistent in all material aspects with the International Federation of Accountants' (IFAC) code as well as the Independent Regulatory Board for Auditors (IRBA) code.</p>
<p style="margin-bottom:0;">The following fundamental principles are embodied in the SAICA Code of Professional Conduct and are to be upheld by all CA's(SA) at all times.</p>
<ul style="margin:2px 0 4px 20px;">
  <li style="margin-bottom:0;"><strong>Integrity</strong> — a duty to be straightforward and honest in all professional and business relationships.</li>
  <li style="margin-bottom:0;"><strong>Objectivity</strong> — a duty to not allow bias, conflict of interest or undue influence of others to override professional or business judgments.</li>
  <li style="margin-bottom:0;"><strong>Professional competence and due care</strong> — a duty to maintain professional knowledge and skill at the level required to ensure that a client receives competent professional services based on current developments in practice, legislation and techniques and act diligently and in accordance with applicable technical and professional standards.</li>
  <li style="margin-bottom:0;"><strong>Confidentiality</strong> — a duty to respect the confidentiality of information acquired as a result of professional and business relationships and, therefore, not disclose any such information to third parties without proper and specific authority, unless there is a legal or professional right or duty to disclose, nor use the information for the personal advantage of the chartered accountant or third parties.</li>
  <li style="margin-bottom:0;"><strong>Professional behaviour</strong> — a duty to comply with relevant laws and regulations and avoid any action that discredits the accountancy profession.</li>
</ul>
<p style="margin-bottom:0;">A distinguishing characteristic of CA's(SA) are their responsibilities and duties which extend beyond the needs of individual clients and also includes the public as a whole.</p>
<p style="margin-bottom:0;">Accordingly, this declaration serves to confirm that the above mentioned financial statements have been prepared by a CA(SA) who has observed and complied with the SAICA Code.</p>
<div class="ca-decl-gap"></div>
<div style="font-size:9.5pt;line-height:1.3;margin-top:4px;">${compilerBlock(compilerSigner, dateSigned)}</div>
${letterheadFooter()}
<div class="page-number">${pg1}</div>
  </div>`;

  // ── PAGE 2: DIRECTORS' RESPONSIBILITIES ──
  const page2 = `
  <div class="doc-page compact-page">
<div class="page-header">
  ${regLine}
</div>
<h2>${possessiveTerm} Responsibilities and Approval</h2>
<br>
<p>${bodyTerm} ${dirSingularPlural.isAre} required in terms of the ${terms.act}, to maintain adequate accounting records and ${dirSingularPlural.isAre} responsible for the content and integrity of the financial statements and related financial information included in this report.</p>
<p>It is ${pronoun} responsibility to ensure that the financial statements fairly present the state of affairs of the entity as at the end of the financial year and the results of its operations and cash flows for the period then ended, in conformity with International Financial Reporting Standards for Small and Medium-sized Entities and the requirements of the Companies Act of South Africa.</p>
<p>The financial statements are prepared in accordance with International Financial Reporting Standards for Small and Medium-sized Entities and the requirements of the Companies Act of South Africa and are based upon appropriate accounting policies consistently applied and supported by reasonable and prudent judgments and estimates.</p>
<p>${bodyTerm} acknowledge that ${dirCount === 1 ? 'he/she is' : 'they are'} ultimately responsible for the system of internal financial control established by the entity and place considerable emphasis on maintaining a strong control environment.</p>
<p>To enable the ${pluralTerm.toLowerCase()} to meet these responsibilities, the board sets standards for internal control aimed at reducing the risk of error or loss in a cost-effective manner. The standards include the proper delegation of responsibilities within a clearly defined framework, effective accounting procedures and adequate segregation of duties to ensure an acceptable level of risk.</p>
<p>These controls are monitored throughout the entity and all employees are required to maintain the highest ethical standards in ensuring the entity's business is conducted in a manner that in all reasonable circumstances is above reproach.</p>
<p>The focus of risk management in the entity is on identifying, assessing, managing and monitoring all known forms of risk. While operating risk cannot be fully eliminated, the entity endeavours to minimise it by ensuring that appropriate infrastructure, controls, systems and ethical behaviour are applied and managed within predetermined procedures and constraints.</p>
<p>${bodyTerm} ${dirSingularPlural.isAre} of the opinion, based on the information and explanations given by management that the system of internal control provides reasonable assurance that the financial records may be relied on for the preparation of the financial statements. However, any system of internal financial control can provide only reasonable, and not absolute, assurance against material misstatement or loss.</p>
<p>${bodyTerm} ${dirSingularPlural.hasHave} reviewed the cash flow forecast for the year and, in the light of this review and the current financial position, ${dirCount === 1 ? 'is' : 'they are'} satisfied that the entity has access to adequate resources to continue in operational existence for the foreseeable future.</p>
<p>The financial statements set out on pages ${hlPageStart} to ${hlPageEnd}, which have been prepared on the going concern basis, were approved by the board on ${dateApproved} and are signed on its behalf:</p>
<div class="signature-block resp-sig">
  ${sigBlock(sigDirs)}
</div>
<div class="page-number">${pg2}</div>
  </div>`;

  // NPO governing body wording ("Members" / "Directors", Step 4) — used by the
  // NPO auditor's report. The NPO Responsibilities and Approval page that also
  // used it was archived in 4.90.0: web/js/archive/NpoResponsibilitiesPage.js.
  const npoBodyLower = npoBody === 'directors' ? 'directors' : 'members';
  const npoBodyCap = npoBodyLower.charAt(0).toUpperCase() + npoBodyLower.slice(1);

  // ── PAGE 3: COMPILATION REPORT ──
  const reportSubState = getReportSubState();

  // Build the Alert to Reader section. Three shapes: insolvent only, parent
  // company that did not consolidate only, or both (the departure paragraph
  // leads, the going-concern basis and the insolvency figures follow).
  let compilationAlertSection = '';
  const isCompilationInsolvent = reportSubState.reportType === 'compilation' && reportSubState.subType === 'insolvent';
  const compilationGroupAlert = reportSubState.reportType === 'compilation' && isGroupUnconsolidated;
  if (isCompilationInsolvent || compilationGroupAlert) {
    const accLoss = hl(formatNumber(getVal('insolventAccLoss')) || '[ACCUMULATED LOSS]');
    const excessLiab = hl(formatNumber(getVal('insolventExcessLiab')) || '[EXCESS LIABILITIES]');
    const additionalNote = isCompilationInsolvent ? (reportSubState.insolventText || '') : '';
    const alertOpening = 'We draw attention to the accounting policy in the financial statement that describes the financial reporting framework used in the preparation and presentation of these financial statements.';
    let alertBody = '';
    if (compilationGroupAlert) {
      alertBody += `<p>${alertOpening} ${groupDepartureAlert}</p>`;
      if (isCompilationInsolvent) {
        alertBody += `
<p>We further would like to confirm that the financial statements were compiled on an accounting basis with a policy applicable on the matter of going concern. It is based on the fact that funds will be available to finance future operations and that the realisation of assets and the settling of debts, unsecure responsibilities and secure responsibilities will take place in the normal circumstances of business.</p>`;
      }
    } else {
      alertBody += `<p>${alertOpening} The financial statements was compiled on an accounting basis with a policy applicable on the matter of going concern. It is based on the fact that funds will be available to finance future operations and that the realisation of assets and the settling of debts, unsecure responsibilities and secure responsibilities will take place in the normal circumstances of business.</p>`;
    }
    if (isCompilationInsolvent) {
      alertBody += `
<p>Please note that on ${yearEnd}, the  had an accumulated loss of R&nbsp;${accLoss} and that its total liabilities exceeded its assets with R&nbsp;${excessLiab}. Due to the accounting policy recorded in the financial statements, the entity will therefore be classified as factually insolvent.</p>`;
    }
    compilationAlertSection = `
<h3>Alert to Reader</h3>
${alertBody}
${additionalNote ? `<p>${additionalNote}</p>` : ''}`;
  }

  // Build the Other Matter section for compilation
  let compilationOtherSection = '';
  if (reportSubState.reportType === 'compilation' && reportSubState.subType === 'other') {
    const otherNote = reportSubState.otherText || '[Describe the other matter to include]';
    compilationOtherSection = `
<h3>Other Matter</h3>
<p>${otherNote}</p>`;
  }

  let page3 = `
  <div class="doc-page compact-page compiler-report-page">
${caLetterhead()}
<h2 class="center-heading">Independent Compiler's Report</h2>
<p><strong><em>To the ${terms.report_to} of ${co}</em></strong></p>
${regLineItalic}
<h3>Report on the Financial Statements</h3>
<p>${_tpl('report_compilation_intro')} The financial statements comprise of the statement of financial position as at ${yearEnd} and the statement of profit or loss and other comprehensive income, statement of changes in equity and statement of cash flows for the year then ended, and a summary of significant accounting policies and other explanatory information, and the ${possessiveTermLower} report, as set out on pages ${hl(pageOffset(pageStart, -1))} to ${hlPageEnd}.</p>
<h3>${possessiveTerm} Responsibility for the Financial Statements</h3>
<p>${_tpl('report_compilation_responsibility')}</p>
<h3>Independent Compiler's Responsibility</h3>
${_tplHtml('report_compilation_compiler')}
${compilationAlertSection}
${compilationOtherSection}
${compilerBlock(compilerSigner, dateSigned)}
${letterheadFooter()}
<div class="page-number">${pg3}</div>
  </div>`;

  // ── TRUST-SPECIFIC COMPILER'S REPORT ──
  if (entityType === 'trust') {
    const trustPage3 = `
  <div class="doc-page compact-page compiler-report-page">
${caLetterhead()}
<h2 class="center-heading">Independent Compiler's Report</h2>
<p><strong><em>To the ${terms.report_to} of ${co}</em></strong></p>
${regLineItalic}
<h3>Report on the Financial Statements</h3>
<p>${_tpl('report_compilation_intro')} The financial statements comprise of the statement of financial position as at ${yearEnd} and the statement of profit or loss and other comprehensive income, statement of changes in funds and statement of cash flows for the year then ended, and a summary of significant accounting policies and other explanatory information as set out on pages ${hl(pageOffset(pageStart, 0))} to ${hlPageEnd}.</p>
<h3>Trustees' Responsibility for the Financial Statements</h3>
<p>The trustees are responsible for the preparation and fair presentation of these financial statements in accordance with International Financial Reporting Standards for Small and Medium-sized Entities and the requirements of the Act of South Africa and the Deed of Trust, and for such internal control as the trustees determine necessary to enable the preparation of financial statements that are free from material misstatement, whether due to fraud or error.</p>
<h3>Independent Compiler's Responsibility</h3>
${_tplHtml('report_compilation_trust_compiler')}
${compilationAlertSection}
${compilationOtherSection}
${compilerBlock(compilerSigner, dateSigned)}
${letterheadFooter()}
<div class="page-number">${pg3}</div>
  </div>`;
    page3 = trustPage3;
  }

  // ── PAGE 4: DIRECTORS' / MEMBERS' REPORT ──
  const entityLabel = entityType === 'cc' ? 'close corporation' : 'company';

  // Business-activities sentence. The main-income half is optional: with the
  // field empty the generator used to print the literal "[MAIN INCOME SOURCE]"
  // placeholder onto a signed report, and the auditors struck the whole clause
  // out by hand every time. With no income source captured the sentence now
  // ends after the nature of business.
  const businessActivitiesSentence = incomeRaw
    ? `The main business of the ${entityLabel} is ${natureMid} and income of the ${entityLabel} is generated mainly from ${incomeMid}.`
    : `The main business of the ${entityLabel} is ${natureMid}.`;

  // Outlook sentence. Optional: with no radio selected, no going-concern
  // expectation is asserted at all, so the sentence is omitted entirely.
  let outlookSentence = '';
  if (outlook === 'continue' || outlook === 'future') {
    const outlookText = outlook === 'continue' ? 'continue to be profitable' : 'be profitable in future';
    outlookSentence = `${bodyTerm} expect that the ${entityLabel} will ${sr(outlookText)}. `;
  }

  // "Elected not to produce group financial statements" — normally driven by the
  // parent-company choice. A review qualified on the group basis predates that
  // choice and keeps its own checkbox as the switch.
  const isReviewGroupBasis = reportType === 'review'
    && getRadio('reviewType') === 'qualified'
    && getRadio('reviewQualifiedBasis') === 'group';
  const showGroupDirectorsNote = isReviewGroupBasis
    ? !!document.getElementById('reviewGroupDirectorsNote')?.checked
    : isGroupUnconsolidated;
  const groupDirectorsNote = showGroupDirectorsNote
    ? `${bodyTerm} ${dirSingularPlural.hasHave} ${sr('elected not to produce group financial statements')}. It is of opinion that the cost of presenting group financial statements outweighed the benefits of the users and was therefore omitted from these financial statements.`
    : '';
  const page4 = `
  <div class="doc-page tight-report-header">
<div class="page-header">
  ${regLine}
</div>
<h2>${possessiveTerm} Report</h2>
<p>${bodyTerm} ${dirCount === 1 ? 'has' : 'have'} pleasure in presenting ${pronoun} report for the year ended ${yearEnd}.</p>
<p class="underline-heading">Business Activities and General Review of Operations</p>
<p>${businessActivitiesSentence}</p>
<p>No material fact or circumstance has occurred since the financial position and the date of this report.</p>
<p class="underline-heading">Specific Matters</p>
<p>No major change in the nature of the ${entityLabel}'s business took place during the accounting period.</p>
${shareCapitalSentence ? `<p>${shareCapitalSentence}</p>` : ''}
${dividendSentence ? `<p>${dividendSentence}</p>` : ''}
<p>${fixedAssetsSentence}</p>
<p>The ${entityLabel} realised a ${sr(plType)} after tax of ${sr(`R&nbsp;${profitLoss}`)} for the year ended ${yearEnd}${prevPlComparison}. ${outlookSentence}Accordingly the annual financial statements of the ${entityLabel} are prepared on the basis of accounting policies applicable to a going concern.</p>
<p>&nbsp;</p>
<p>The ${pluralTerm.toLowerCase()} of the ${entityLabel} ${dirSingularPlural.isAre}: ${dirList}</p>
<p>The postal address is: ${postal}</p>
<p>The registered address is: ${regAddr}</p>
${parentSentence ? `<p>${parentSentence}</p>` : ''}
${groupDirectorsNote ? `<p>${groupDirectorsNote}</p>` : ''}
<p>The financial statements were approved and signed by the ${pluralTerm.toLowerCase()}.</p>
<p>&nbsp;</p>
<p class="underline-heading">${pluralTerm}:</p>
<p>&nbsp;</p>
<div class="sig-group">
  <div class="signature-block">
    ${sigBlock(sigDirs)}
  </div>
  <div class="sig-date">${dateApprovedSig}</div>
</div>
<div class="page-number">${pg4}</div>
  </div>`;

  // ── PAGE 5+: ACCOUNTING POLICIES ──
  // Collect selected policies
  const selectedPolicies = accountingPolicies.filter(p => {
    const cb = document.getElementById(p.id);
    return cb && cb.checked;
  });

  // Assign sequential display numbers to selected policies
  // Top-level numbers reset per section; sub-numbers increment within 1.x
  // Logic: walk selected list, assign 1, 1.1, 1.2 ... based on position
  let mainCounter = 0;
  let subCounter = 0;
  let lastWasMain = false;
  const numberedPolicies = selectedPolicies.map(p => {
    const origNum = p.originalNum || '';
    let displayNum = '';
    if (origNum === '1') {
      mainCounter = 1; subCounter = 0; lastWasMain = true;
      displayNum = '1';
    } else if (p.fixedNumber) {
      displayNum = origNum;
    } else {
      subCounter++;
      displayNum = `1.${subCounter}`;
    }
    return { ...p, displayNum };
  });

  // Page header helper for notes pages
  function notesPageHeader() {
    return `
<div class="page-header">
  ${regLine}
</div>
<h2>NOTES FOR THE YEAR ENDED ${yearEnd.toUpperCase()}</h2>`;
  }

  // Which text variant of a policy is selected (p.textOptions). The control is
  // a radio group named "textopt-<id>" — it is only saved under the key
  // "sel-<id>", there is no element with that id.
  function policyVariantIndex(id) {
    const checked = document.querySelector(`input[name="textopt-${id}"]:checked`);
    return checked ? (parseInt(checked.value, 10) || 0) : 0;
  }

  // Heading for a policy entry, honouring the selected text variant.
  function resolvePolicyHeading(p) {
    const opt = p.textOptions && p.textOptions[policyVariantIndex(p.id)];
    // `p.heading` wins over `p.label` for policies whose label carries a
    // form-only disambiguator ("— No Asset Register" / "— Transitional
    // Write-off"): the checkbox list needs it, the note must not print it.
    const explicit = (opt && opt.heading) || p.heading;
    if (explicit) return explicit.replace(/^[\d.]+\s*/, '');
    // A trailing bracket on a label is the same kind of form-only hint
    // ("Investments (at Cost)", "Intangible Assets (Crypto Assets)",
    // "Expenses (Body Corporate)") — it tells the accountant which policy to
    // tick and is never part of the printed heading.
    return p.label.replace(/^[\d.]+\s*/, '').replace(/(\s+\([^()]*\))+\s*$/, '');
  }

  // Resolve the base text for a policy, preferring school / NPC overrides when applicable
  function resolvePolicyText(p) {
    const edited = (typeof getPolicyText === 'function' && getPolicyText(p.id));
    const variant = entityType === 'school' ? p.schoolText
      : isNpcType(entityType) ? p.npcText
      : entityType === 'npo' ? p.npoText
      : null;
    const base = edited || variant || (p.text || '');
    // [EDU_DEPT] lets the school policies name whichever education department
    // (or address) the user typed on the form, defaulting to Mpumalanga;
    // [NPC_ORG] does the same for how the NPC policies describe the entity.
    return base
      .replace(/\[EDU_DEPT\]/g, eduDept)
      .replace(/\[NPC_ORG\]/g, npcOrg)
      .replace(/\[NPO_ORG\]/g, npoOrg)
      .replace(/\[NPO_BODY\]/g, npoBody)
      .replace(/\[NPO_DEPT_OF\]/g, npoDeptOf)
      .replace(/\[NPO_DEPT\]/g, npoDept)
      .replace(/\[PPE_STMT\]/g, ppeStmt);
  }

  // Build text for a policy entry; parentDisplayNum is the final sequential number (e.g. "1.3")
  function buildPolicyText(p, parentDisplayNum) {
    if (p.id === 'pol_ppe' && p.subItems) {
      const toggleEntities = p.ppeDepreciationToggleEntities || ['bc', 'cc', 'company', 'trust'];
      const showDepreciationRates = !toggleEntities.includes(entityType)
        || !!document.getElementById('ppe-depreciation-include')?.checked;
      const ratesIntro = p.depreciationRatesIntro || 'Other assets are depreciated at the following rates:';

      const includeResidual = getRadio('ppeResidualInclude') === 'yes';
      const globalResidualRaw = getVal('ppeResidualPercent');
      const globalResidualPct = includeResidual && globalResidualRaw
        ? (globalResidualRaw.trim().endsWith('%') ? globalResidualRaw.trim() : `${globalResidualRaw.trim()}%`)
        : '';

      let ppeText = resolvePolicyText(p);
      ppeText = ppeText.replace(/\s*Other assets are depreciated at the following rates:\s*/i, '').trim();

      const landCb = document.getElementById('pol_ppe_land');
      // Block-level so its own margin sets the gap (12px — the same distance
      // that separates one policy from the next). Stacked <br>s used to leave a
      // gap several lines deep after the depreciation rates.
      const landText = (landCb && landCb.checked && p.textSuffix)
        ? `<span class="ppe-land-note">${p.textSuffix}</span>` : '';

      if (!showDepreciationRates) {
        return ppeText + landText;
      }

      if (!/depreciated at the following rates/i.test(ppeText)) {
        ppeText = `${ppeText} ${ratesIntro}`;
      }

      const checkedSubs = p.subItems.filter(s => {
        const cb = document.getElementById(s.id);
        return cb && cb.checked && !s.isLandAndBuildings;
      });
      const customSubs = (typeof getCustomPpeSubItems === 'function') ? getCustomPpeSubItems() : [];
      let rateLines = '';
      if (checkedSubs.length > 0 || customSubs.length > 0) {
        // Inline grid (not a table — the policy body renders inside a <p>)
        // so all rates start at the same position, with fixed-width digit
        // boxes so the Poppins proportional digits align column for column
        const gridLines = checkedSubs.map(s => {
          const sel = document.getElementById('sel-' + s.id);
          const custom = document.getElementById('custom-' + s.id);
          let rate = sel ? sel.value : '';
          if (rate === 'Other') rate = (custom && custom.value.trim()) ? custom.value.trim() : 'Other';
          // Per-item residual value, falling back to global
          let resSuffix = '';
          if (includeResidual) {
            const itemResInp = document.getElementById('residual-' + s.id);
            const itemResRaw = itemResInp ? itemResInp.value.trim() : '';
            const itemResPct = itemResRaw ? (itemResRaw.endsWith('%') ? itemResRaw : `${itemResRaw}%`) : globalResidualPct;
            if (itemResPct) resSuffix = ` (Residual value ${itemResPct})`;
          }
          // The asset category is a form choice (the ticked sub-item), so it is
          // red under the checker like the rate beside it.
          return `<span>${sr(s.label)}</span><span>— ${digitCells(`${rate}${resSuffix}`)}</span>`;
        });
        customSubs.forEach(c => {
          let rate = (c.rate || '').trim();
          if (rate && !rate.endsWith('%')) rate = `${rate}%`;
          const resSuffix = (includeResidual && globalResidualPct) ? ` (Residual value ${globalResidualPct})` : '';
          gridLines.push(`<span>${sr(c.label)}</span><span>— ${digitCells(`${rate}${resSuffix}`)}</span>`);
        });
        rateLines = '<br><span class="ppe-rate-grid">' + gridLines.join('') + '</span>';
      } else {
        rateLines = '';
      }
      return ppeText + rateLines + landText;
    }
    if (p.id === 'pol_biological' && p.subItems) {
      const checkedBio = p.subItems.filter(s => {
        const cb = document.getElementById(s.id);
        return cb && cb.checked;
      });
      const bioText = resolvePolicyText(p);
      if (!checkedBio.length) return bioText;
      // Replace entity-specific terms in body text
      const bioTermMap = {
        'cc': { possessive: "member's", plural: 'members' },
        'trust': { possessive: "trustee's", plural: 'trustees' },
        'bc': { possessive: "trustee's", plural: 'trustees' },
        'npo': { possessive: `${npoBody}'`, plural: npoBody },
        'npc': terms.plural === 'Members' || terms.singular === 'Member'
          ? { possessive: "member's", plural: 'members' }
          : { possessive: "director's", plural: 'directors' },
        'church': { possessive: "church council's", plural: 'church council members' },
        'club': { possessive: "committee's", plural: 'committee members' },
      };
      const bioTerms = bioTermMap[baseEntityType(entityType)] || { possessive: "director's", plural: 'directors' };
      const replaceBioTerms = (txt) => txt
        .replace(/director's\/trustee's\/member's/gi, bioTerms.possessive)
        .replace(/owners\/directors\/trustees\/members/gi, bioTerms.plural);
      return bioText + '<br><br>' + checkedBio.map((s, i) => {
        let text = s.bodyText || '';
        if (s.bodyTextOptions && s.bodyTextOptions.length > 1) {
          const sel = document.getElementById(`sel-${s.id}`);
          const idx = sel ? parseInt(sel.value, 10) : 0;
          text = s.bodyTextOptions[idx] || s.bodyTextOptions[0];
        }
        const subLabel = s.label.replace(/^[\d.]+\s*/, '');
        const subNum = parentDisplayNum ? `${parentDisplayNum}.${i + 1}` : s.label;
        // A numbered sub-heading is a heading like any other policy's — underlined.
        return `<strong class="policy-subheading">${subNum} ${subLabel}</strong><br>${replaceBioTerms(text)}`;
      }).join('<br><br>');
    }
    let baseText = resolvePolicyText(p);
    // Deferred taxation: append or omit the "No deferred taxation asset" sentence
    if (p.id === 'pol_deftax' && p.deferredAssetSentence) {
      const cb = document.getElementById('deftax-no-asset');
      if (cb && cb.checked) {
        baseText = baseText.replace(/\s*No deferred taxation asset is recognised\.?\s*$/, '');
        baseText += ' ' + p.deferredAssetSentence;
      }
    }
    return baseText;
  }

  // Build all policies on a single page; PagePaginator splits at render time
  let policyPages = '';
  let pgNum = 5;

  // Merge standard + custom policies, then renumber sequentially
  const customPols = (typeof getCustomPolicies === 'function') ? getCustomPolicies() : [];

  // Build a unified list: each item is { type, label, html/content, origIndex }
  // Standard policies keep their original order; custom ones are inserted or appended
  const standardItems = numberedPolicies.map((p, i) => ({
    type: 'standard', policy: p, sortIndex: i + 1
  }));

  // Custom policies with a position get inserted; without position they append.
  //
  // The position box takes either a slot number ("3" = third entry) or the
  // display number the policy should end up with ("1.6"). The two are one
  // apart, because slot 1 is the "1" General Framework entry and every 1.x
  // note that follows it occupies slot x+1. Typing "1.6" used to be read as
  // the slot 1.6, which rounds down to "just after the framework" — the note
  // came out as 1.1 at the top of the page instead of 1.6 at the foot of it.
  const toSlot = (cp) => {
    const raw = String(cp.positionRaw != null && cp.positionRaw !== '' ? cp.positionRaw : cp.position).trim();
    const sub = /^1\.(\d+)$/.exec(raw);
    return sub ? parseInt(sub[1], 10) + 1 : Number(raw);
  };
  const positioned = [];
  const appended = [];
  customPols.forEach(cp => {
    const slotPos = toSlot(cp);
    if (cp.position != null && !isNaN(slotPos) && slotPos > 0) {
      positioned.push({ ...cp, position: slotPos });
    } else {
      appended.push(cp);
    }
  });

  // Sort positioned custom policies by their target position
  positioned.sort((a, b) => a.position - b.position);

  // Interleave: walk through positions 1..N, inserting custom policies at their spots
  const merged = [];
  let stdIdx = 0;
  let posIdx = 0;
  let slot = 1;

  while (stdIdx < standardItems.length || posIdx < positioned.length) {
    // Insert any custom policies targeting this slot
    while (posIdx < positioned.length && positioned[posIdx].position <= slot) {
      merged.push({ type: 'custom', custom: positioned[posIdx] });
      posIdx++;
      slot++;
    }
    // Insert next standard policy
    if (stdIdx < standardItems.length) {
      merged.push(standardItems[stdIdx]);
      stdIdx++;
      slot++;
    } else {
      break;
    }
  }
  // Remaining positioned customs beyond the end
  while (posIdx < positioned.length) {
    merged.push({ type: 'custom', custom: positioned[posIdx] });
    posIdx++;
  }
  // Append customs without a position
  appended.forEach(cp => merged.push({ type: 'custom', custom: cp }));

  if (merged.length > 0) {
    // Renumber everything sequentially: 1, 1.1, 1.2, ...
    // First item that was originally "1" (General Framework) stays as "1", rest become 1.x
    let seqMain = 0;
    let seqSub = 0;
    const finalEntries = merged.map(item => {
      let displayNum, heading, body;
      if (item.type === 'standard') {
        const p = item.policy;
        const origNum = p.originalNum || '';
        if (origNum === '1') {
          seqMain = 1; seqSub = 0;
          displayNum = '1';
        } else if (p.fixedNumber) {
          // Keeps its own top-level number (e.g. "2") — doesn't consume a 1.x slot
          displayNum = origNum;
        } else {
          seqSub++;
          displayNum = `1.${seqSub}`;
        }
        heading = resolvePolicyHeading(p);
        body = buildPolicyText(p, displayNum);
      } else {
        seqSub++;
        displayNum = `1.${seqSub}`;
        heading = item.custom.heading;
        body = item.custom.content;
      }
      const sentenceHeading = heading.charAt(0).toUpperCase() + heading.slice(1).toLowerCase();
      // data-policy-key and .policy-num let a hand-edited notes page follow the
      // policy list without being rebuilt: entries are added, removed and
      // renumbered one by one (EditToolbar.js, _reconcilePolicyEntries).
      const policyKey = item.type === 'standard' ? item.policy.id : `custom:${item.custom.id || ''}`;
      return `
  <div class="policy-entry" data-policy-key="${policyKey}">
    <p class="underline-heading"><span class="policy-num">${displayNum.includes('.') ? displayNum : displayNum + '.'}</span> ${sentenceHeading}</p>
    <p>${body}</p>
  </div>`;
    }).join('');

    policyPages = `
  <div class="doc-page" data-notes-page="true">
${notesPageHeader()}
${finalEntries}
<div class="page-number">${pgNum}</div>
  </div>`;
  }

  // ── PAGE 3a: INDEPENDENT REVIEWER'S REPORT ──
  const reviewSubState = getReportSubState();
  const isReviewQualified = reviewSubState.reportType === 'review' && reviewSubState.subType === 'qualified';

  // Build Basis for Qualified/Adverse Conclusion section
  let reviewBasisSection = '';
  // Adverse on the group basis: either the parent-company choice says subsidiaries
  // were not consolidated, or the older "qualified → group" review option is set.
  const isReviewGroup = reviewSubState.reportType === 'review'
    && (isGroupUnconsolidated || (isReviewQualified && reviewSubState.qualifiedBasis === 'group'));
  if (isReviewQualified || isReviewGroup) {
    if (isReviewGroup) {
      reviewBasisSection = `
<h3>Basis for Adverse Conclusion</h3>
<p>The <em>'International Financial Reporting Standard for Small and Medium Sized Entities'</em> states that a parent shall present consolidated financial statements in which it consolidates its investments in subsidiaries. In preparing consolidated financial statements, an entity combines the financial statements of the parent and its subsidiaries line by line by adding together like items of assets, liabilities, equity, income and expenses. The company did not produce group financial statements, which in our view, is not in accordance with the <em>'International Financial Reporting Standard for Small and Medium Sized Entities'</em>.</p>
<p>The particulars of the departure from the <em>'International Financial Reporting Standard for Small and Medium Sized Entities'</em> have been omitted from the financial statements. We draw your attention to the directors' report which provides the reason for departure from the <em>'International Financial Reporting Standard of Small and Medium-sized Entities'</em>.</p>`;
    } else if (isPpra && reviewSubState.qualifiedBasis === 'trustDeficit') {
      // PPRA trust deficit: the trust creditors (money held for clients) were
      // more than the funds in the trust account at year end. The deficit is
      // worked out from the two amounts; the cause is typed on the form.
      const tCause = sr(reviewSubState.trustCause || '[CAUSE]');
      const tCreditors = hl(formatNumber(reviewSubState.trustCreditors) || '[TRUST CREDITORS]');
      const tFunds = hl(formatNumber(reviewSubState.trustFunds) || '[TRUST FUNDS]');
      const tDeficitNum = ppraTrustDeficit(reviewSubState.trustCreditors, reviewSubState.trustFunds);
      const tDeficit = hl(tDeficitNum !== null && tDeficitNum > 0 ? formatNumber(String(tDeficitNum)) : '[TRUST DEFICIT]');
      const tRemedied = reviewSubState.trustRemedied
        ? ` and the trust deficit was remedied after year-end after the ${bodyTerm.replace(/^The /, '').toLowerCase()} ${dirCount === 1 ? 'was' : 'were'} made aware of it`
        : '';
      reviewBasisSection = `
<h3>Basis for Qualified Conclusion</h3>
<p>Please note that on ${yearEnd}, due to ${tCause}, the entity had trust creditors of R&nbsp;${tCreditors} but only had trust funds of R&nbsp;${tFunds}. This resulted in a trust deficit of R&nbsp;${tDeficit}${tRemedied}.</p>`;
    } else if (reviewSubState.qualifiedBasis === 'insolvent') {
      const rAccLoss = hl(formatNumber(reviewSubState.reviewAccLoss) || '[ACCUMULATED LOSS]');
      const rExcessLiab = hl(formatNumber(reviewSubState.reviewExcessLiab) || '[EXCESS LIABILITIES]');
      reviewBasisSection = `
<h3>Basis for Qualified Conclusion</h3>
<p>Please note that on ${yearEnd}, the ${entityLabel} had an accumulated loss of R&nbsp;${rAccLoss} and that its total liabilities exceeded its assets with R&nbsp;${rExcessLiab}. Due to the accounting policy recorded in the financial statements, the entity will therefore be classified as factually insolvent. The financial statements were compiled on an accounting basis with a policy applicable on the matter of going concern. It is based on the fact that funds will be available to finance future operations and that the realisation of assets and the settling of debts, unsecure responsibilities and secure responsibilities will take place in the normal circumstances of business.</p>`;
    } else {
      reviewBasisSection = `
<h3>Basis for Qualified Conclusion</h3>
<p>${reviewSubState.qualifiedText || '[Describe the basis for the qualified conclusion]'}</p>`;
    }
  }

  // A PPRA review is the registered auditor's: a qualified conclusion carries
  // the IRBA independence paragraph after its basis, whatever the basis is.
  if (isPpra && isReviewQualified && !isReviewGroup) {
    reviewBasisSection += `
${_tplHtml('report_review_ppra_independence')}`;
  }

  // An NPO is reported on against the NPO Act, by its members or directors, with no
  // Companies Act section (2026 NPO reviewer's report template).
  const reviewNpo = entityType === 'npo';
  const reviewAct = reviewNpo ? 'NPO Act' : 'Companies Act';

  // Build Conclusion section — different wording for qualified vs unqualified vs adverse (group)
  let reviewConclusionSection = '';
  if (isReviewGroup) {
    reviewConclusionSection = `
<h3>Adverse Conclusion</h3>
<p>Based on our review, due to the significance of the matter discussed in the Basis for Adverse Conclusion paragraph, we conclude that these financial statements do not present fairly the financial position of ${co} as at ${yearEnd}, and its financial performance and cash flows for the year then ended in accordance with the IFRS for SMEs Accounting Standard as issued by the International Accounting Standards Board and the requirements of the ${reviewAct} of South Africa.</p>`;
  } else if (isReviewQualified) {
    reviewConclusionSection = `
<h3>Qualified Conclusion</h3>
<p>Based on our review, except for the effect of the matter described in the Basis of the Qualified Conclusion paragraph nothing has come to our attention that causes us to believe that these financial statements of ${co} are not prepared, in all material respects, in accordance with IFRS for SMEs Accounting Standard as issued by the International Accounting Standards Board and the requirements of the ${reviewAct} of South Africa.</p>`;
  } else {
    reviewConclusionSection = `
<h3>Conclusion</h3>
<p>Based on our review, nothing has come to our attention that causes us to believe that these financial statements do not present fairly, in all material respects, (or do not give a true and fair view of) the financial position of ${co} as at ${yearEnd}, and (of) its financial performance and cash flows for the year then ended, in accordance with the IFRS for SMEs Accounting Standard as issued by the International Accounting Standards Board and the requirements of the ${reviewAct} of South Africa.</p>`;
  }

  // PPRA: audit letterhead and footer, signed as the registered auditor with
  // the firm's town — "A ANDERSON / REGISTERED AUDITOR (SA) / DUMMYVILLE".
  const reviewSignBlock = isPpra
    ? `<div class="compiler-block">
  <p>${compilerSigner}</p>
  <p>REGISTERED AUDITOR (SA)</p>
  <p>${firmLocality.toUpperCase()}</p>
  <p>${dateSigned}</p>
</div>`
    : compilerBlock(compilerSigner, dateSigned);

  const pageReview = `
  <div class="doc-page" data-no-squeeze>
${isPpra ? auditLetterhead() : caLetterhead()}
<h2>Independent Reviewer's Report</h2>
<br>
<p><strong><em>To the ${terms.report_to} of ${co}</em></strong></p>
${regLineItalic}
<p>${_tpl(reviewNpo ? 'report_npo_review_intro' : 'report_review_intro')}</p>
<h3>${possessiveTerm} Responsibility for the Financial Statements</h3>
<p>${_tpl(reviewNpo ? 'report_npo_review_responsibility' : 'report_review_responsibility')}</p>
<h3>Independent Reviewer's Responsibility</h3>
<p>${_tpl('report_review_reviewer')}</p>
${_tplHtml('report_review_limited_assurance')}
${reviewBasisSection}
<br>
${reviewConclusionSection}
${reviewNpo ? '' : `<h3>Other Reports Required by the Companies Act</h3>
${_tplHtml('report_review_other_reports')}`}
<br><br><br>
${reviewSignBlock}
${isPpra ? auditFooter() : letterheadFooter()}
<div class="page-number">${pg3}</div>
  </div>`;

  // ── PAGE 3b: INDEPENDENT AUDITOR'S REPORT ──
  const auditSubState = getReportSubState();
  const auditSub = (auditSubState.reportType === 'audit') ? (auditSubState.subType || 'unqualified') : 'unqualified';
  const isAuditQualified = auditSub === 'qualified';
  const isAuditEmphasis = auditSub === 'emphasis';
  const isAuditDisclaimer = auditSub === 'disclaimer';
  const isAuditOther = auditSub === 'other';

  // Parent-company variants. A parent that did not consolidate gets an adverse
  // opinion naming the subsidiary; a parent that did consolidate gets the
  // "consolidated and separate financial statements" / "the group" wording
  // throughout, from its own set of templates.
  const auditGroupAdverse = isGroupUnconsolidated;
  const auditGroupConsolidated = isGroupConsolidated;
  // An NPO has its own report (2026 NPO audit template): statement of surplus
  // or deficit / changes in funds, the NPO Act, addressed to and responsible
  // through its governing body (Step 4), the entity called "the organisation",
  // "the club" or "the centre" (Step 4), and no Other Information section.
  const auditNpo = entityType === 'npo';
  const auditAct = auditNpo ? 'NPO Act' : 'Companies Act';
  const auditTplIntro = auditNpo ? 'report_npo_audit_intro' : auditGroupConsolidated ? 'report_audit_group_intro' : 'report_audit_intro';
  const auditTplBasis = auditNpo ? 'report_npo_audit_basis' : auditGroupConsolidated ? 'report_audit_group_basis' : 'report_audit_basis';
  const auditTplOtherInfo = auditGroupConsolidated ? 'report_audit_group_other_info' : 'report_audit_other_info';
  const auditTplOtherInfoRead = auditGroupConsolidated ? 'report_audit_group_other_info_read' : 'report_audit_other_info_read';
  const auditTplResponsibilities = auditNpo ? 'report_npo_audit_responsibilities' : auditGroupConsolidated ? 'report_audit_group_responsibilities' : 'report_audit_responsibilities';
  const auditTplAuditorResp = auditGroupConsolidated ? 'report_audit_group_auditor_responsibilities' : 'report_audit_auditor_responsibilities';
  const auditTplAuditorAlso = auditNpo ? 'report_npo_audit_auditor_also' : auditGroupConsolidated ? 'report_audit_group_auditor_also' : 'report_audit_auditor_also';
  const auditRespHeading = `Responsibilities of the ${auditNpo ? npoBodyCap : pluralTerm} for the ${auditGroupConsolidated ? 'Consolidated and Separate Financial Statements' : 'Financial Statements'}`;
  const auditFsTerm = auditGroupConsolidated ? 'Consolidated and Separate Financial Statements' : 'Financial Statements';

  // Dynamic headings based on audit sub-type
  const auditOpinionHeading = auditGroupAdverse ? 'Adverse Opinion' : isAuditQualified ? 'Qualified Opinion' : isAuditDisclaimer ? 'Disclaimer of Opinion' : 'Opinion';
  const auditBasisHeading = auditGroupAdverse ? 'Basis for Adverse Opinion' : isAuditQualified ? 'Basis for Qualified Opinion' : isAuditDisclaimer ? 'Basis for Disclaimer of Opinion' : 'Basis for Opinion';

  // Qualified: user-entered basis paragraph placed after the standard ISA paragraph
  const auditQualifiedBasisExtra = isAuditQualified
    ? `<p>${auditSubState.qualifiedText || '[Describe the basis for the qualified opinion]'}</p>` : '';

  // Emphasis of Matter (placed AFTER basis for opinion, not between opinion and basis)
  const auditEmphasisSection = isAuditEmphasis
    ? `<h3>Emphasis of Matter</h3>
<p>${auditSubState.emphasisText || '[Describe the emphasis of matter]'}</p>` : '';

  // Other Matter (placed after opinion paragraphs)
  const auditOtherSection = isAuditOther
    ? `<h3>Other Matter</h3>
<p>${auditSubState.otherText || '[Describe the other matter]'}</p>` : '';

  // Split the "Auditor also" bullet list so the LAST bullet ("Evaluate the overall
  // presentation…") plus the closing "We communicate…" paragraph flow onto the
  // signature page, keeping the going-concern bullet as the last item on page 2.
  const _auditAlsoSplit = (() => {
    const raw = _tpl(auditTplAuditorAlso);
    if (!raw) return { partA: '', partB: '' };
    const blocks = raw.split('\n\n');
    const firstBlock = blocks[0] || '';
    const restBlocks = blocks.slice(1); // trailing "We communicate…" paragraph(s)
    const intro = [];
    const bullets = [];
    for (const l of firstBlock.split('\n')) {
      if (l.startsWith('• ')) bullets.push(l.slice(2));
      else if (l.trim()) intro.push(l);
    }
    // Last bullet goes to part B — except NPO, whose report ends on page 2, so
    // the list stays whole (two adjacent lists leave a gap between bullets).
    const splitAt = auditNpo ? bullets.length : Math.max(1, bullets.length - 1);
    let partA = '';
    if (intro.length) partA += '<p>' + intro.join(' ') + '</p>';
    if (bullets.length) partA += '<ul>' + bullets.slice(0, splitAt).map(b => '<li>' + b + '</li>').join('') + '</ul>';
    let partB = '';
    const bulletsB = bullets.slice(splitAt);
    if (bulletsB.length) partB += '<ul>' + bulletsB.map(b => '<li>' + b + '</li>').join('') + '</ul>';
    for (const blk of restBlocks) {
      if (blk.trim()) partB += '<p>' + blk.replace(/\n/g, ' ') + '</p>';
    }
    return { partA, partB };
  })();

  const pageAudit = `
  <div class="doc-page">
${auditLetterhead()}
<h2 class="center-heading audit-report-title">Independent Auditor's Report</h2>
<p><strong><em>To the ${auditNpo ? npoBodyCap : terms.report_to} of ${co}</em></strong></p>
${regLineItalic}
<h3>${auditOpinionHeading}</h3>
<p>${_tpl(auditTplIntro)}</p>
${auditGroupAdverse
  ? `<p>In our opinion, because of the significance of the matter discussed in the Basis for Adverse Opinion section of our report, the financial statements do not present fairly, in all material respects, the financial position of ${co} as at ${yearEnd}, and its financial performance and cash flows for the year then ended in accordance with the IFRS for SMEs Accounting Standard as issued by the International Accounting Standards Board and the requirements of the Companies Act of South Africa.</p>`
  : auditGroupConsolidated
  ? `<p>In our opinion, the consolidated and separate financial statements present fairly, in all material respects, the consolidated and separate financial position of the group as at ${yearEnd}, and its consolidated and separate financial performance and consolidated and separate cash flows for the year then ended in accordance with <em>'International Financial Reporting Standards'</em> and the requirements of the Companies Act of South Africa.</p>`
  : isAuditDisclaimer
  ? `<p>We do not express an opinion on the financial statements of ${co}. Because of the significance of the matter described in the Basis for Disclaimer of Opinion section of our report, we have not been able to obtain sufficient appropriate audit evidence to provide a basis for an audit opinion on these financial statements.</p>`
  : isAuditQualified
  ? `<p>In our opinion, except for the possible effect of the matter described in the Basis for Qualified Opinion section of our report, the financial statements present fairly, in all material respects, the financial position of ${co} as at ${yearEnd}, and its financial performance and cash flows for the year then ended in accordance with the IFRS for SMEs Accounting Standard as issued by the International Accounting Standards Board and the requirements of the ${auditAct} of South Africa.</p>`
  : `<p>In our opinion, the financial statements present fairly, in all material respects, the financial position of ${co} as at ${yearEnd}, and its financial performance and cash flows for the year then ended in accordance with the IFRS for SMEs Accounting Standard as issued by the International Accounting Standards Board and the requirements of the ${auditAct} of South Africa.</p>`}
${auditOtherSection}
<h3>${auditBasisHeading}</h3>
${isAuditDisclaimer
  ? `<p>${auditSubState.disclaimerText || '[Describe the basis for the disclaimer of opinion]'}</p>`
  : auditGroupAdverse
  ? `<p>${_tpl('report_audit_adverse_group_basis', { SUBSIDIARY: subsidiaryName })}</p>
${_tplHtml(auditTplBasis).replace(/basis for our opinion\./, 'basis for our adverse opinion.')}`
  : `${_tplHtml(auditTplBasis)}`}
${auditQualifiedBasisExtra}
${auditEmphasisSection}
${auditNpo
  ? `<h3>${auditRespHeading}</h3>
${_tplHtml(auditTplResponsibilities)}`
  : isAuditDisclaimer
  ? `<h3>Other Information</h3>
<p>The annual financial statements include the ${possessiveTerm} Report as required by the Companies Act of South Africa. The ${pluralTerm.toLowerCase()} ${dirSingularPlural.isAre} responsible for this other information.</p>
<p>We have read the other information and, in doing so, considered whether the other information is materially inconsistent with the financial statements or our knowledge obtained in the audit, or otherwise appears to be materially misstated. However, due to the disclaimer of opinion in terms of the International Standard on Auditing (ISA) 705 (Revised), Modifications to the Opinion in the Independent Auditor's Report, we are unable to report further on this other information.</p>`
  : `<h3>Other Information</h3>
${_tplHtml(auditTplOtherInfo)}`}
${auditFooter()}
<div class="page-number">${pg3}</div>
  </div>
  <div class="doc-page${auditNpo ? ' audit-sign-page' : ''}">
${auditNpo ? '' : `<p>${_tpl(auditTplOtherInfoRead)}</p>
${auditGroupAdverse ? `<p>${_tpl('report_audit_adverse_group_other_info', { SUBSIDIARY: subsidiaryName })}</p>` : ''}
<h3>${auditRespHeading}</h3>
${_tplHtml(auditTplResponsibilities)}`}
<h3>Auditor's Responsibilities for the Audit of the ${auditFsTerm}</h3>
<p>${_tpl(auditTplAuditorResp)}</p>
${_auditAlsoSplit.partA}
${auditNpo
  // NPO: page 1 already carries the governing body's responsibilities, so the
  // rest of the report and the signature fit on page 2 — no third sheet.
  ? `${_auditAlsoSplit.partB}
<div class="audit-sign-spacer"></div>
<div class="compiler-block">
  <p>${compilerSigner}</p>
  <p>REGISTERED AUDITOR (SA)</p>
  <p>${firmLocality.toUpperCase()}</p>
  <p>${dateSigned}</p>
</div>
<div class="page-number">${pg3}</div>
  </div>`
  : `<div class="page-number">${pg3}</div>
  </div>
  <div class="doc-page audit-sign-page">
${_auditAlsoSplit.partB}
<div class="audit-sign-spacer"></div>
${auditorBlock(compilerSigner, dateSigned)}
<div class="page-number">${pg3}</div>
  </div>`}`;

  // ── PAGE: CHURCH INDEPENDENT AUDITOR'S REPORT ──
  const pageAuditChurch = `
  <div class="doc-page">
${auditLetterhead()}
<h2 class="center-heading">Independent Auditor's Report</h2>
<p><strong><em>To the Church Council of ${co}</em></strong></p>
${regLineItalic}
<h3>${auditOpinionHeading}</h3>
<p>We have audited the financial statements of ${co} set out on pages ${hlPageStart} to ${hlPageEnd}, which comprise the statement of financial position as at ${yearEnd}, and the statement of profit or loss and other comprehensive income, statement of changes in equity and statement of cash flows for the year then ended, and notes to the financial statements, including material accounting policy information.</p>
${isAuditDisclaimer
  ? `<p>We do not express an opinion on the financial statements of ${co}. Because of the significance of the matter described in the Basis for Disclaimer of Opinion section of our report, we have not been able to obtain sufficient appropriate audit evidence to provide a basis for an audit opinion on these financial statements.</p>`
  : isAuditQualified
  ? `<p>In our opinion, except for the possible effect of the matter described in the Basis for Qualified Opinion section of our report, the financial statements present fairly, in all material respects, the financial position of ${co} as at ${yearEnd}, and its financial performance and cash flows for the year then ended in accordance with the IFRS for SMEs Accounting Standard as issued by the International Accounting Standards Board.</p>`
  : `<p>In our opinion, the financial statements present fairly, in all material respects, the financial position of ${co} as at ${yearEnd}, and its financial performance and cash flows for the year then ended in accordance with the IFRS for SMEs Accounting Standard as issued by the International Accounting Standards Board.</p>`}
<h3>${auditBasisHeading}</h3>
${isAuditDisclaimer
  ? `<p>${auditSubState.disclaimerText || '[Describe the basis for the disclaimer of opinion]'}</p>`
  : `<p>We conducted our audit in accordance with <em>'International Standards on Auditing (ISAs)'</em>. Our responsibilities under those standards are further described in the <em>'Auditor's Responsibilities for the Audit of the Financial Statements'</em> section of our report. We are independent of the church in accordance with the <em>'Independent Regulatory Board for Auditors Code of Professional Conduct for Registered Auditors (IRBA Code)'</em> and other independence requirements applicable to performing audits of financial statements in South Africa. We have fulfilled our other ethical responsibilities in accordance with the <em>'IRBA Code'</em> and in accordance with other ethical requirements applicable to performing audits in South Africa. The <em>'IRBA Code'</em> is consistent with the corresponding sections of <em>'International Ethics Standards Board for Accountants Code of Ethics for Professional Accountants'</em> (Including International Independence Standards).</p>
<p>We believe that the audit evidence we have obtained is sufficient and appropriate to provide a basis for our opinion.</p>`}
${auditQualifiedBasisExtra}
${auditOtherSection}
${auditEmphasisSection}
<h3>Responsibilities of the Church Council for the Financial Statements</h3>
<p>The council is responsible for the preparation and fair presentation of the financial statements in accordance with the IFRS for SMEs Accounting Standard as issued by the International Accounting Standards Board, and for such internal control as the council determines is necessary to enable the preparation of financial statements that are free from material misstatement, whether due to fraud or error.</p>
<p>In preparing the financial statements, the council is responsible for assessing the church's ability to continue as a going concern, disclosing, as applicable, matters related to going concern and using the going concern basis of accounting unless the council either intends to liquidate the church or to cease operations, or has no realistic alternative but to do so.</p>
<h3>Auditor's Responsibilities for the Audit of the Financial Statements</h3>
<p>Our objectives are to obtain reasonable assurance about whether the financial statements as a whole are free from material misstatement, whether due to fraud or error, and to issue an auditor's report that includes our opinion. Reasonable assurance is a high level of assurance, but is not a guarantee that an audit conducted in accordance with ISAs will always detect a material misstatement when it exists. Misstatements can arise from fraud or error and are considered material if, individually or in the aggregate, they could reasonably be expected to influence the economic decisions of users taken on the basis of these financial statements.</p>
<p>As part of an audit in accordance with ISAs, we exercise professional judgement and maintain professional scepticism throughout the audit. We also:</p>
<ul>
  <li>Identify and assess the risks of material misstatement of the financial statements, whether due to fraud or error, design and perform audit procedures responsive to those risks, and obtain audit evidence that is sufficient and appropriate to provide a basis for our opinion. The risk of not detecting a material misstatement resulting from fraud is higher than for one resulting from error, as fraud may involve collusion, forgery, intentional omissions, misrepresentations, or the override of internal control.</li>
  <li>Obtain an understanding of internal control relevant to the audit in order to design audit procedures that are appropriate in the circumstances, but not for the purpose of expressing an opinion on the effectiveness of the company's internal control.</li>
  <li>Evaluate the appropriateness of accounting policies used and the reasonableness of accounting estimates and related disclosures made by the directors.</li>
  <li>Conclude on the appropriateness of the directors' use of the going concern basis of accounting and based on the audit evidence obtained, whether a material uncertainty exists related to events or conditions that may cast significant doubt on the company's ability to continue as a going concern. If we conclude that a material uncertainty exists, we are required to draw attention in our auditor's report to the related disclosures in the financial statements or, if such disclosures are inadequate, to modify our opinion. Our conclusions are based on the audit evidence obtained up to the date of our auditor's report. However, future events or conditions may cause the company to cease to continue as a going concern.</li>
  <li>Evaluate the overall presentation, structure and content of the financial statements, including the disclosures, and whether the financial statements represent the underlying transactions and events in a manner that achieves fair presentation.</li>
</ul>
<p>We communicate with the directors regarding, among other matters, the planned scope and timing of the audit and significant audit findings, including any significant deficiencies in internal control that we identify during our audit.</p>
${auditorBlock(compilerSigner, dateSigned)}
${auditFooter()}
<div class="page-number">${pg3}</div>
  </div>`;

  // ── PAGE: CLUB INDEPENDENT AUDITOR'S REPORT ──
  const pageAuditClub = `
  <div class="doc-page">
${auditLetterhead()}
<h2 class="center-heading">Independent Auditor's Report</h2>
<p><strong><em>To the Committee of ${co}</em></strong></p>
${regLineItalic}
<h3>${auditOpinionHeading}</h3>
<p>We have audited the financial statements of ${co} set out on pages ${hlPageStart} to ${hlPageEnd}, which comprise the statement of financial position as at ${yearEnd}, and the statement of profit or loss and other comprehensive income, statement of changes in equity and statement of cash flows for the year then ended, and notes to the financial statements, including material accounting policy information.</p>
${isAuditDisclaimer
  ? `<p>We do not express an opinion on the financial statements of ${co}. Because of the significance of the matter described in the Basis for Disclaimer of Opinion section of our report, we have not been able to obtain sufficient appropriate audit evidence to provide a basis for an audit opinion on these financial statements.</p>`
  : isAuditQualified
  ? `<p>In our opinion, except for the possible effect of the matter described in the Basis for Qualified Opinion section of our report, the financial statements present fairly, in all material respects, the financial position of ${co} as at ${yearEnd}, and its financial performance and cash flows for the year then ended in accordance with the IFRS for SMEs Accounting Standard as issued by the International Accounting Standards Board.</p>`
  : `<p>In our opinion, the financial statements present fairly, in all material respects, the financial position of ${co} as at ${yearEnd}, and its financial performance and cash flows for the year then ended in accordance with the IFRS for SMEs Accounting Standard as issued by the International Accounting Standards Board.</p>`}
${auditOtherSection}
<h3>${auditBasisHeading}</h3>
${isAuditDisclaimer
  ? `<p>${auditSubState.disclaimerText || '[Describe the basis for the disclaimer of opinion]'}</p>`
  : `<p>We conducted our audit in accordance with <em>'International Standards on Auditing (ISAs)'</em>. Our responsibilities under those standards are further described in the <em>'Auditor's Responsibilities for the Audit of the Financial Statements'</em> section of our report. We are independent of the club in accordance with the <em>'Independent Regulatory Board for Auditors Code of Professional Conduct for Registered Auditors (IRBA Code)'</em> and other independence requirements applicable to performing audits of financial statements in South Africa. We have fulfilled our other ethical responsibilities in accordance with the <em>'IRBA Code'</em> and in accordance with other ethical requirements applicable to performing audits in South Africa. The <em>'IRBA Code'</em> is consistent with the corresponding sections of <em>'International Ethics Standards Board for Accountants Code of Ethics for Professional Accountants'</em> (Including International Independence Standards).</p>
<p>We believe that the audit evidence we have obtained is sufficient and appropriate to provide a basis for our opinion.</p>`}
${auditQualifiedBasisExtra}
${auditEmphasisSection}
<h3>Responsibilities of the Committee for the Financial Statements</h3>
<p>The club's committee is responsible for the preparation and fair presentation of the financial statements in accordance with the IFRS for SMEs Accounting Standard as issued by the International Accounting Standards Board, and for such internal control as the club's committee determines is necessary to enable the preparation of financial statements that are free from material misstatement, whether due to fraud or error.</p>
<p>In preparing the financial statements, the club's committee is responsible for assessing the club's ability to continue as a going concern, disclosing, as applicable, matters related to going concern and using the going concern basis of accounting unless the club's committee either intends to liquidate the club or to cease operations, or has no realistic alternative but to do so.</p>
<h3>Auditor's Responsibilities for the Audit of the Financial Statements</h3>
<p>Our objectives are to obtain reasonable assurance about whether the financial statements as a whole are free from material misstatement, whether due to fraud or error, and to issue an auditor's report that includes our opinion. Reasonable assurance is a high level of assurance, but is not a guarantee that an audit conducted in accordance with ISAs will always detect a material misstatement when it exists. Misstatements can arise from fraud or error and are considered material if, individually or in the aggregate, they could reasonably be expected to influence the economic decisions of users taken on the basis of these financial statements.</p>
<p>As part of an audit in accordance with ISAs, we exercise professional judgement and maintain professional scepticism throughout the audit. We also:</p>
<ul>
  <li>Identify and assess the risks of material misstatement of the financial statements, whether due to fraud or error, design and perform audit procedures responsive to those risks, and obtain audit evidence that is sufficient and appropriate to provide a basis for our opinion. The risk of not detecting a material misstatement resulting from fraud is higher than for one resulting from error, as fraud may involve collusion, forgery, intentional omissions, misrepresentations, or the override of internal control.</li>
  <li>Obtain an understanding of internal control relevant to the audit in order to design audit procedures that are appropriate in the circumstances, but not for the purpose of expressing an opinion on the effectiveness of the company's internal control.</li>
  <li>Evaluate the appropriateness of accounting policies used and the reasonableness of accounting estimates and related disclosures made by the directors.</li>
  <li>Conclude on the appropriateness of the directors' use of the going concern basis of accounting and based on the audit evidence obtained, whether a material uncertainty exists related to events or conditions that may cast significant doubt on the company's ability to continue as a going concern. If we conclude that a material uncertainty exists, we are required to draw attention in our auditor's report to the related disclosures in the financial statements or, if such disclosures are inadequate, to modify our opinion. Our conclusions are based on the audit evidence obtained up to the date of our auditor's report. However, future events or conditions may cause the company to cease to continue as a going concern.</li>
  <li>Evaluate the overall presentation, structure and content of the financial statements, including the disclosures, and whether the financial statements represent the underlying transactions and events in a manner that achieves fair presentation.</li>
</ul>
<p>We communicate with the directors regarding, among other matters, the planned scope and timing of the audit and significant audit findings, including any significant deficiencies in internal control that we identify during our audit.</p>
${auditorBlock(compilerSigner, dateSigned)}
${auditFooter()}
<div class="page-number">${pg3}</div>
  </div>`;


  // ── PAGE: TRUSTEES' RESPONSIBILITIES AND APPROVAL (Body Corporate) ──
  const schoolSubState = (entityType === 'school') ? getReportSubState() : {};
  const schoolSub = schoolSubState.subType || 'unqualified';

  const schoolGBResponsibilities = `
<h3>Responsibilities of the Governing Body for the Financial Statements</h3>
<p>The school's governing body is responsible for the preparation and fair presentation of the financial statements in accordance with the <em>'Financial Reporting Guidelines for Schools'</em> and the requirements of the South African Schools Act, and for such internal control as the governing body determines is necessary to enable the preparation of financial statements that are free from material misstatement, whether due to fraud or error.</p>`;

  const schoolAuditorResponsibilities = `
<h3>Auditor's Responsibilities for the Audit of the Financial Statements</h3>
<p>Our objectives are to obtain reasonable assurance about whether the financial statements as a whole are free from material misstatement, whether due to fraud or error, and to issue an auditor's report that includes our opinion. Reasonable assurance is a high level of assurance, but is not a guarantee that an audit conducted in accordance with ISAs will always detect a material misstatement when it exists. Misstatements can arise from fraud or error and are considered material if, individually or in the aggregate, they could reasonably be expected to influence the economic decisions of users taken on the basis of these financial statements.</p>
<p>As part of an audit in accordance with ISAs, we exercise professional judgement and maintain professional scepticism throughout the audit. We also:</p>
<ul>
  <li>Identify and assess the risks of material misstatement of the financial statements, whether due to fraud or error, design and perform audit procedures responsive to those risks, and obtain audit evidence that is sufficient and appropriate to provide a basis for our opinion. The risk of not detecting a material misstatement resulting from fraud is higher than for one resulting from error, as fraud may involve collusion, forgery, intentional omissions, misrepresentations, or the override of internal control.</li>
  <li>Obtain an understanding of internal control relevant to the audit in order to design audit procedures that are appropriate in the circumstances, but not for the purpose of expressing an opinion on the effectiveness of the school's internal control.</li>
  <li>Evaluate the appropriateness of accounting policies used and the reasonableness of accounting estimates and related disclosures made by the governing body.</li>
  <li>Evaluate the overall presentation, structure and content of the financial statements, including the disclosures, and whether the financial statements represent the underlying transactions and events in a manner that achieves fair presentation.</li>
</ul>
<p>We communicate with the governing body regarding, among other matters, the planned scope and timing of the audit and significant audit findings, including any significant deficiencies in internal control that we identify during our audit.</p>`;

  const schoolBasisForOpinionParagraph =
    `<p>We conducted our audit in accordance with <em>'International Standards on Auditing (ISAs)'</em>. Our responsibilities under those standards are further described in the <em>'Auditor's Responsibilities for the Audit of the Financial Statements'</em> section of our report. We are independent of the school in accordance with the <em>'Independent Regulatory Board for Auditors Code of Professional Conduct for Registered Auditors (IRBA Code)'</em> and other independence requirements applicable to performing audits of financial statements in South Africa. We have fulfilled our other ethical responsibilities in accordance with the <em>'IRBA Code'</em> and in accordance with other ethical requirements applicable to performing audits in South Africa. The <em>'IRBA Code'</em> is consistent with the corresponding sections of <em>'International Ethics Standards Board for Accountants Code of Ethics for Professional Accountants'</em> (Including International Independence Standards).</p>
<p>We believe that the audit evidence we have obtained is sufficient and appropriate to provide a basis for our opinion.</p>`;

  const schoolBasisForOpinion = `
<h3>Basis for Opinion</h3>
${schoolBasisForOpinionParagraph}`;

  let pageSchoolAudit = '';
  if (schoolSub === 'unqualified') {
    const otherMatter = schoolSubState.otherText
      ? `<h3>Other Matter</h3><p>${schoolSubState.otherText}</p>` : '';
    pageSchoolAudit = `
  <div class="doc-page">
${auditLetterhead()}
<div class="page-header"></div>
<h2 class="center-heading">Independent Auditor's Report</h2>
<p><strong><em>To the Governing Body of ${co}</em></strong></p>
<h3>Opinion</h3>
<p>We have audited the financial statements of ${co}, which comprise the statement of financial position as at ${yearEnd}, and the statement of financial performance, including material accounting policy information and other explanatory notes, as set out on pages ${hlPageStart} to ${hlPageEnd}.</p>
<p>In our opinion, the financial statements present fairly, in all material respects, the financial position of ${co} as at ${yearEnd}, and its financial performance and cash flows for the year then ended in accordance with the <em>'Financial Reporting Frameworks for Schools (FRFFS)'</em> and the requirements of the South African Schools Act.</p>
${otherMatter}
${schoolBasisForOpinion}
${schoolGBResponsibilities}
${schoolAuditorResponsibilities}
${auditorBlock(schoolAuditorSigner, dateSigned)}
${auditFooter()}
<div class="page-number">${pg2}</div>
  </div>`;
  } else if (schoolSub === 'qualified') {
    const qualBasis = schoolSubState.qualifiedText || '[Describe the basis for the qualified opinion]';
    const otherMatter = schoolSubState.otherText
      ? `<h3>Other Matter</h3><p>${schoolSubState.otherText}</p>` : '';
    pageSchoolAudit = `
  <div class="doc-page">
${auditLetterhead()}
<div class="page-header"></div>
<h2 class="center-heading">Independent Auditor's Report</h2>
<p><strong><em>To the Governing Body of ${co}</em></strong></p>
<h3>Qualified Opinion</h3>
<p>We have audited the financial statements of ${co}, which comprise the statement of financial position as at ${yearEnd}, and the statement of financial performance, including material accounting policy information and other explanatory notes, as set out on pages ${hlPageStart} to ${hlPageEnd}.</p>
<h3>Basis for Qualified Opinion</h3>
${schoolBasisForOpinionParagraph}
<p>Please note that for the year ending ${yearEnd}, the following came to our attention:</p>
<p style="white-space:pre-line;">${qualBasis}</p>
<p>In our opinion, except for the possible effect of the matter described in the Basis for Qualified Opinion section of our report, the financial statements present fairly, in all material respects, the financial position of ${co} as at ${yearEnd}, and its financial performance and cash flows for the year then ended in accordance with the <em>'Financial Reporting Frameworks for Schools (FRFFS)'</em> and the requirements of the South African Schools Act.</p>
${otherMatter}
${schoolGBResponsibilities}
${schoolAuditorResponsibilities}
${auditorBlock(schoolAuditorSigner, dateSigned)}
${auditFooter()}
<div class="page-number">${pg2}</div>
  </div>`;
  } else if (schoolSub === 'disclaimer') {
    const disBasis = schoolSubState.disclaimerText || '[Describe the basis for the disclaimer of opinion]';
    pageSchoolAudit = `
  <div class="doc-page">
${auditLetterhead()}
<div class="page-header"></div>
<h2 class="center-heading">Independent Auditor's Report</h2>
<p><strong><em>To the Governing Body of ${co}</em></strong></p>
<h3>Disclaimer of Opinion</h3>
<p>We have audited the financial statements of ${co}, which comprise the statement of financial position as at ${yearEnd}, and the statement of financial performance, including material accounting policy information and other explanatory notes, as set out on pages ${hlPageStart} to ${hlPageEnd}.</p>
<p>We do not express an opinion on the financial statements of ${co}. Because of the significance of the matter described in the Basis for Disclaimer of Opinion section of our report, we have not been able to obtain sufficient appropriate audit evidence to provide a basis for an audit opinion on these financial statements.</p>
<h3>Basis for Disclaimer of Opinion</h3>
<p>We conducted our audit in accordance with <em>'International Standards on Auditing (ISAs)'</em>. Our responsibilities under those standards are further described in the <em>'Auditor's Responsibilities for the Audit of the Financial Statements'</em> section of our report. We are independent of the school in accordance with the <em>'Independent Regulatory Board for Auditors Code of Professional Conduct for Registered Auditors (IRBA Code)'</em> and other independence requirements applicable to performing audits of financial statements in South Africa. We have fulfilled our other ethical responsibilities in accordance with the <em>'IRBA Code'</em> and in accordance with other ethical requirements applicable to performing audits in South Africa. The <em>'IRBA Code'</em> is consistent with the corresponding sections of <em>'International Ethics Standards Board for Accountants Code of Ethics for Professional Accountants'</em> (Including International Independence Standards).</p>
<p>Please note that for the year ending ${yearEnd}, the following came to our attention:</p>
<p style="white-space:pre-line;">${disBasis}</p>
${schoolGBResponsibilities}
${schoolAuditorResponsibilities}
${auditorBlock(schoolAuditorSigner, dateSigned)}
${auditFooter()}
<div class="page-number">${pg2}</div>
  </div>`;
  }

  // ── PAGE: ATTORNEYS TRUST ACCOUNT ASSURANCE REPORT ──
  let pageAttorneysAudit = '';
  if (entityType === 'attorneys') {
    const attGov = getRadio('attGovType') || 'directors';
    const govLabel = attGov === 'partners' ? 'Partner(s)' : 'Director(s)';
    const govLabelLC = attGov === 'partners' ? 'partner(s)' : 'director(s)';
    const govIsAre = attGov === 'partners' ? 'are' : 'are';
    const govDetermines = attGov === 'partners' ? 'determine' : 'determine';

    const attOpinion = getRadio('attOpinionType') || 'unmodified';
    const attInvestment = getRadio('attInvestment') || 'no';
    const attOtherReport = getRadio('attOtherReport') || 'none';
    const attOtherText = getVal('attOtherReportText') || '';
    const attModText = getVal('attModifiedText') || '[BASIS FOR MODIFIED OPINION]';
    const attDisText = getVal('attDisclaimerText') || '[BASIS FOR DISCLAIMER OF OPINION]';

    const attAuditorVal = getRadio('attAuditor') || 'rdb';
    const attAuditorMap = {
      rdb: { name: 'Rita Clarke', irba: '100001' },
      lvm: { name: 'Alice Anderson', irba: '100002' }
    };
    const attAud = attAuditorMap[attAuditorVal];

    // Period
    const yeParts2 = yearEndLong.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
    let attPeriodStart = '1 March [YEAR]';
    if (yeParts2) attPeriodStart = `1 March ${parseInt(yeParts2[3]) - 1}`;
    const attPeriod = `the period from ${attPeriodStart} to the year ended ${yearEnd}`;

    // Investment practice paragraph
    const attInvestPara = attInvestment === 'yes'
      ? `In accordance with our responsibilities in terms of Rule 54.24.3, we report that to the best of our knowledge, the legal practitioner has for ${attPeriod} carried on the business of an investment practice and has complied with the relevant Rules.`
      : `In accordance with our responsibilities in terms of Rule 54.24.3, we report that to the best of our knowledge, the legal practitioner has not for ${attPeriod} carried on the business of an investment practice.`;

    // Other reporting responsibilities
    const attOtherReportPara = attOtherReport === 'custom' && attOtherText
      ? `<p><strong><em>Other Reporting Responsibilities</em></strong></p><p><em>${attOtherText}</em></p>`
      : '';

    // Shared sections used across all opinion types
    const attResponsibilitySection = `
<p><strong><em>${govLabel} responsibility for the trust accounts</em></strong></p>
<p>The ${govLabelLC} ${govIsAre} responsible for ensuring that legal practitioners' trust accounts are maintained in compliance with the Act and the Rules, and for such internal control as the ${govLabelLC} ${govDetermines} is necessary to maintain the integrity of the trust accounts in accordance with the relevant client mandates, including such controls as the ${govLabelLC} ${govDetermines} are also necessary to prevent and detect fraud and theft. The ${govLabelLC} ${govIsAre} also responsible for preparing the attached Legal Practitioner's Annual Statement on Trust Accounts and for the financial information and declarations contained therein.</p>`;

    const attIndependenceSection = `
<p><strong><em>Auditor's Independence and Quality Control</em></strong></p>
<p><em>INF181 Audit applies the International Standard on Quality Control 1, Quality Control for Firms that Perform Audits and Reviews of Financial Statements and Other Assurance and Related Services Engagements and accordingly maintains a comprehensive system of quality control, including documented policies and procedures regarding compliance with ethical requirements, professional standards and applicable legal and regulatory requirements.</em></p>`;

    const attAuditorResponsibilitySection = `
<p><strong><em>Auditor's Responsibility</em></strong></p>
<p>Our responsibility is to express a reasonable assurance opinion on whether the legal practitioners' trust accounts were maintained in compliance with the Act and the Rules, based on our assurance procedures performed; and to report, as required, on the accompanying Legal Practitioner's Annual Statement on Trust Accounts and investment practice.</p>
<p><em>We conducted our reasonable assurance engagement in accordance with the International Standard on Assurance Engagements 3000 (Revised), Assurance Engagements Other than Audits or Reviews of Historical Financial Information (ISAE 3000 (Revised)), issued by the International Auditing and Assurance Standards Board. That standard requires that we plan and perform the engagement to obtain reasonable assurance about whether the legal practitioners' trust accounts were maintained, in all material respects, in compliance with the Act and the Rules.</em></p>
<p>A reasonable assurance engagement in accordance with ISAE 3000 (Revised) involves performing procedures to obtain evidence about whether the legal practitioners' trust accounts were maintained in compliance with the Act and the Rules. The nature, timing and extent of procedures selected depend on the auditor's professional judgement, including the assessment of the risks of non-compliance with the Act and the Rules, whether due to fraud, theft and error. In making those risk assessments, we considered internal control that is relevant to the engagement in order to design procedures that are appropriate in the circumstances, but not for the purpose of expressing an opinion on the effectiveness of internal control.</p>
<p>Our reasonable assurance engagement included the following summary of procedures performed:</p>
<ul>
  <li><em>Considering, and applying when considered applicable in the engagement circumstances, the guidance in the Guide for Registered Auditors: Engagements on Legal Practitioners' Trust Accounts (Revised March 2020) issued by the IRBA.</em></li>
  <li>Making inquiries of the legal practitioner and persons within the practice.</li>
  <li>Testing transactions for all significant service activities, with the objective of evaluating whether:
    <ul>
      <li>Transactions were appropriately identified as trust account transactions;</li>
      <li>Trust account transactions were made in accordance with mandates and supported by adequate documentation and narrative to identify from whom funds were received, and for whose credit;</li>
      <li>Deposits and withdrawals from the trust bank accounts were to, or for, a trust creditor; and</li>
      <li>Transfers to the legal practitioner's business bank accounts were only in respect of monies to be due to the legal practitioner.</li>
    </ul>
  </li>
  <li>Testing and/or scrutinising bank reconciliations, as considered appropriate in the engagement circumstances, and evaluating the records made available to us against the external confirmations from financial institutions.</li>
  <li>Obtaining written representations from management regarding matters that are relevant to this engagement.</li>
</ul>
<p>We believe that the evidence we have obtained is sufficient and appropriate to provide a basis for our opinion.</p>`;

    const attLPCReportSection = `
<p><strong><em>Report on Other Legal and Regulatory Requirements</em></strong></p>
<p><strong><em>Report on the Legal Practitioner's Annual Statement on Trust Accounts</em></strong></p>
<p>In accordance with our responsibilities in terms of the Advisory issued by the Legal Practice Council dated 17 April 2020, we report that we have agreed the information extracted from the trust accounting records included in the accompanying Legal Practitioner's Annual Statement on Trust Accounts for ${attPeriod} to the underlying records that were the subject of our engagement. We have also read the Legal Practitioner's Annual Statement on Trust Accounts for the purpose of identifying whether the information contained therein is inconsistent with our knowledge obtained in the course of our engagement. The Legal Practitioner's Annual Statement on Trust Accounts is the responsibility of the legal practitioner.</p>
<p>Based on our reading of the legal practitioner's representations, the disclosures and other information contained in the Legal Practitioner's Annual Statement on Trust Accounts, we have not identified any information that is inconsistent with our knowledge obtained in the course of our engagement. Our opinion on the legal practitioner's trust accounts does not cover the Legal Practitioner's Annual Statement on Trust Accounts and, accordingly, we do not express an opinion thereon.</p>
<p><strong><em>Report on the Legal Practitioner's Investment Practice</em></strong></p>
<p><strong>${attInvestPara}</strong></p>
${attOtherReportPara}`;

    const attRestrictionSection = `
<p><strong><em>Restriction on distribution and use</em></strong></p>
<p><em>This report is for the purpose of meeting the auditor reporting requirements of the Act and the Rules and, regarding the accompanying Legal Practitioner's Annual Statement on Trust Accounts, the additional auditor reporting requirements of the Legal Practice Council and the Legal Practitioners Fidelity Fund. Consequently, it is not suitable for any other purpose. It is intended solely for the use of the ${govLabelLC} of the firm, the Legal Practice Council and the Legal Practitioners Fidelity Fund, and should not be distributed to other parties.</em></p>`;

    const attSignatureSection = `
<br>
<p><strong><em>Auditor's Signature</em></strong></p>
<br><br>
<p>_____________________________</p>
<p>${attAud.name}</p>
<p>IRBA Registration Number ${attAud.irba}</p>
<p>INF181 Audit</p>
<p>${dateSigned}</p>`;

    // ── Page 1 (shared): Title, intro, Directors' responsibility, Independence ──
    const attPage1Header = `
  <div class="doc-page" style="font-size:9.5pt;">
${auditLetterhead()}
<div class="page-header">
  <p style="text-align:center;font-weight:bold;margin:0;">Independent Auditor's Reasonable Assurance Report on Legal Practitioners'</p>
  <p style="text-align:center;font-weight:bold;margin:0 0 8px;">Trust Accounts</p>
</div>
<p><strong><em>To the ${govLabel} of ${co}</em></strong></p>
<p><strong><em>Report on Compliance of the Legal Practitioners' Trust Accounts with the Act and the Rules</em></strong></p>`;

    const attPage1Unmod = `${attPage1Header}
<p>We have undertaken a reasonable assurance engagement on whether the legal practitioners' trust accounts of ${co} were maintained, in all material respects, in compliance with Section 86, read with Section 63(1)(g), and Sections 87(1), 87(3) and 87(4) of the Legal Practice Act, No. 28 of 2014 (the Act), and Rules 54.6–54.13, 54.14.1–54.14.6, 54.14.7.2, 54.14.7.3, 54.14.8–54.14.16, 54.15, 54.16, 54.17, 54.18, 54.19, 54.31, 54.32, 54.33, 54.34, 54.35 and 55.1–55.11 of the South African Legal Practice Council Rules (the Rules), made under the authority of Sections 95(1), 95(3) and 109(2) of the Act, for ${attPeriod}.</p>
<p>We clarify that we are not required to perform any procedures on records or documents relating to accounting for deceased estates, insolvent estates and trusts other than those dealt with via the legal practitioner's trust banking account(s).</p>
${attResponsibilitySection}
${attIndependenceSection}
${auditFooter()}
  </div>`;

    const attPage1Disclaimer = `${attPage1Header}
<p>We were engaged to undertake a reasonable assurance engagement on whether the legal practitioners' trust accounts of ${co} were maintained, in all material respects, in compliance with Section 86, read with Section 63(1)(g), and Sections 87(1), 87(3) and 87(4) of the Legal Practice Act, No. 28 of 2014 (the Act), and Rules 54.6–54.13, 54.14.1–54.14.6, 54.14.7.2, 54.14.7.3, 54.14.8–54.14.16, 54.15, 54.16, 54.17, 54.18, 54.19, 54.31, 54.32, 54.33, 54.34, 54.35 and 55.1–55.11 of the South African Legal Practice Council Rules (the Rules), made under the authority of Sections 95(1), 95(3) and 109(2) of the Act, for ${attPeriod}.</p>
<p>We clarify that we are not required to perform any procedures on records or documents relating to accounting for deceased estates, insolvent estates and trusts other than those dealt with via the legal practitioner's trust banking account(s).</p>
${attResponsibilitySection}
${attIndependenceSection}
${auditFooter()}
  </div>`;

    // ── Page 2 (shared): Auditor's Responsibility ──
    const attPage2 = `
  <div class="doc-page" style="font-size:9.5pt;">
${attAuditorResponsibilitySection}
  </div>`;

    // ── Page 3: Opinion + LPC Report + Restriction + Signature ──
    if (attOpinion === 'unmodified') {
      pageAttorneysAudit = attPage1Unmod + attPage2 + `
  <div class="doc-page" style="font-size:9.5pt;">
<p><strong><em>Opinion</em></strong></p>
<p>In our opinion, the legal practitioners' trust accounts of ${co} for ${attPeriod} were maintained, in all material respects, in compliance with the Act and the Rules.</p>
${attLPCReportSection}
${attRestrictionSection}
${attSignatureSection}
  </div>`;
    } else if (attOpinion === 'modified') {
      pageAttorneysAudit = attPage1Unmod + attPage2 + `
  <div class="doc-page" style="font-size:9.5pt;">
<p><strong><em>Basis for Modified Opinion</em></strong></p>
<p>${attModText}</p>
<p><strong><em>Modified Opinion</em></strong></p>
<p>In our opinion, except for the effects of the matter described in the Basis for Modified Opinion paragraph, the legal practitioners' trust accounts of ${co} for ${attPeriod} were maintained, in all material respects, in compliance with the Act and the Rules.</p>
${attLPCReportSection}
${attRestrictionSection}
${attSignatureSection}
  </div>`;
    } else {
      // Disclaimer
      pageAttorneysAudit = attPage1Disclaimer + attPage2 + `
  <div class="doc-page" style="font-size:9.5pt;">
<p><strong><em>Basis for Disclaimer of Opinion</em></strong></p>
<p>${attDisText}</p>
<p><strong><em>Disclaimer of Opinion</em></strong></p>
<p>Because of the significance of the matter described in the Basis for Disclaimer of Opinion paragraph, we have not been able to obtain sufficient appropriate evidence to provide a basis for an opinion. Accordingly, we do not express an opinion on the compliance of the legal practitioners' trust accounts of ${co} with the Act and the Rules.</p>
${attLPCReportSection}
${attRestrictionSection}
${attSignatureSection}
  </div>`;
    }
  }

  // ── PAGE: TRUSTEES' RESPONSIBILITIES AND APPROVAL (Body Corporate) ──
  const pageTrusteesResponsibilities = `
  <div class="doc-page">
${auditLetterhead()}
<div class="page-header">
  ${reg ? `<div class="co-reg">(Sectional Title Scheme Number — ${hlReg})</div>` : ''}
</div>
<h2>Trustees' Responsibilities and Approval</h2>
<p>The trustees are required in terms of the <em>Sectional Titles Schemes Management Act, 2011</em>, <em>the Sectional Titles Schemes Management Regulations, 2016 and the Management Rules of the body corporate</em> established in terms thereof, to maintain adequate accounting records and are responsible for the content and integrity of the financial statements and related financial information included in this report. It is their responsibility to ensure that the financial statements fairly present the state of affairs of the entity as at the end of the financial year and the results of its operations and cash flows for the period then ended, in conformity with International Financial Reporting Standards for Small and Medium-sized Entities and the requirements of the <em>Sectional Titles Schemes Management Act, 2011</em>, <em>the Sectional Titles Schemes Management Regulations, 2016 and the Management Rules of the body corporate</em> established in terms thereof.</p>
<p>The financial statements are prepared in accordance with International Financial Reporting Standards for Small and Medium-sized Entities and the requirements of the <em>Sectional Titles Schemes Management Act, 2011</em>, <em>the Sectional Titles Schemes Management Regulations, 2016 and the Management Rules of the body corporate</em> established in terms thereof and are based upon appropriate accounting policies consistently applied and supported by reasonable and prudent judgments and estimates.</p>
<p>The trustees acknowledge that they are ultimately responsible for the system of internal financial control established by the entity and place considerable emphasis on maintaining a strong control environment. To enable the trustees to meet these responsibilities, the board sets standards for internal control aimed at reducing the risk of error or loss in a cost-effective manner. The standards include the proper delegation of responsibilities within a clearly defined framework, effective accounting procedures and adequate segregation of duties to ensure an acceptable level of risk. These controls are monitored throughout the entity and all employees are required to maintain the highest ethical standards in ensuring the body corporate's business is conducted in a manner that in all reasonable circumstances is above reproach. The focus of risk management in the body corporate is on identifying, assessing, managing and monitoring all known forms of risk across the body corporate. While operating risk cannot be fully eliminated, the entity endeavours to minimise it by ensuring that appropriate infrastructure, controls, systems and ethical behaviour are applied and managed within predetermined procedures and constraints.</p>
<p>The trustees are of the opinion, based on the information and explanations given by management that the system of internal control provides reasonable assurance that the financial records may be relied on for the preparation of the financial statements. However, any system of internal financial control can provide only reasonable, and not absolute, assurance against material misstatement or loss.</p>
<p>The trustees have reviewed the cash flow forecast for the year and, in the light of this review and the current financial position, they are satisfied that the body corporate has access to adequate resources to continue in operational existence for the foreseeable future.</p>
<p>The external auditors are responsible for independently auditing and reporting on the body corporate's financial statements. The financial statements have been examined by the body corporate's external auditors and their report is presented on page ${hl(indexPageNo('auditorReport', 2))}.</p>
<p>The financial statements set out on pages ${hlPageStart} to ${hlPageEnd}, which have been prepared on the going concern basis, were approved by the board on ${dateApproved} and are signed on its behalf:</p>
<div class="signature-block">
  ${sigBlock(sigDirs)}
</div>
${auditFooter()}
<div class="page-number">${pg1}</div>
  </div>`;

  // ── PAGE: TRUSTEES' REPORT (Body Corporate) ──
  const bcSchemeAddress = getVal('bcSchemeAddress') || '[SCHEME NAME AND ADDRESS]';
  const bcContribType = getRadio('bcContribType') || 'surplus';
  const bcContribAmt = hl(formatNumber(getVal('bcContribAmount')) || '[AMOUNT]');
  const bcPrevYear = hl(getVal('bcPrevYear') || '[PREV YEAR]');
  const bcPrevContribType = getRadio('bcPrevContribType') || 'surplus';
  const bcPrevContribAmt = hl(formatNumber(getVal('bcPrevContribAmount')) || '[AMOUNT]');
  const bcMgmtRules = getRadio('bcMgmtRules') || 'nochange';
  const bcMgmtRulesText = getVal('bcMgmtRulesText') || '';
  const bcEvents = getRadio('bcEvents') || 'none';
  const bcEventsText = getVal('bcEventsText') || '';

  const bcContribWord = bcContribType === 'surplus' ? 'surplus' : 'deficit';
  const bcPrevContribWord = bcPrevContribType === 'surplus' ? 'surplus' : 'deficit';

  const bcEventsParagraph = bcEvents === 'custom' && bcEventsText
    ? `<p>${bcEventsText}</p>`
    : `<p>The trustees are not aware of any matter or circumstance that has occurred between the accounting date and the date of this report that has a material impact on the annual financial statements.</p>`;

  const bcMgmtRulesParagraph = bcMgmtRules === 'custom' && bcMgmtRulesText
    ? `<p>${bcMgmtRulesText}</p>`
    : `<p>There were no amendments or additions to the management and conduct rules.</p>`;

  // Derive next financial year from yearEnd
  const bcNextYear = (() => {
    const m = yearEndLong.match(/\d{4}/);
    return m ? String(parseInt(m[0]) + 1) : '[NEXT YEAR]';
  })();

  const pageTrusteesReport = `
  <div class="doc-page">
<div class="page-header">
  ${reg ? `<div class="co-reg">(Sectional Title Scheme Number — ${hlReg})</div>` : ''}
</div>
<h2>Trustees' Report</h2>
<p>The trustees have pleasure in presenting their report for the year ended ${yearEnd}.</p>
<p class="underline-heading">Business Activities and General Review of Operations</p>
<p>The body corporate is engaged in governing the property and operates principally in South Africa.</p>
<p>The controlling body was established to administer the common property of the Sectional Title Scheme known as ${bcSchemeAddress}, for which a Sectional Title Register was opened.</p>
<p>All expenses applicable to the common property and administration are recovered from the various section owners by means of a monthly levy in terms of the rules of the body corporate and are in accordance with the participation quota applicable to each section.</p>
<p>The operating results and state of affairs of the body corporate are fully set out in the attached annual financial statements and do not in our opinion require any further comment.</p>
<p class="underline-heading">Events After the Reporting Period</p>
${bcEventsParagraph}
<p class="underline-heading">Contributions</p>
<p>Contributions paid by section owners and interest earned during the year were ${bcContribType === 'surplus' ? 'sufficient' : 'insufficient'} to meet expenditure, resulting in a levy ${bcContribWord} of R&nbsp;${bcContribAmt} (${bcPrevYear}: R&nbsp;${bcPrevContribAmt}).</p>
<p class="underline-heading">Trustees</p>
<p>The trustees of the body corporate are: ${dirList}</p>
<p class="underline-heading">Management and Conduct Rules</p>
${bcMgmtRulesParagraph}
<p class="underline-heading">Estimates of Income and Expenditure for the ${bcNextYear} Financial Year</p>
<p>A budget for the next year will be presented for approval at the forthcoming annual general meeting.</p>
<p class="underline-heading">Insured Replacement Values</p>
<p>A schedule of the present replacement values of all the units will be tabled for approval at the forthcoming annual general meeting.</p>
<p class="underline-heading">Auditors</p>
<p>INF181 Auditors was the auditor for the year under review and their re-appointment is dependent on a resolution taken to that effect by the section owners at the forthcoming annual general meeting.</p>
<p>The financial statements were approved and signed by the trustees.</p>
<p class="underline-heading">Trustees:</p>
<div class="sig-group">
  <div class="signature-block">
    ${sigBlock(sigDirs)}
  </div>
  <div class="sig-date">${dateApprovedSig}</div>
</div>
<div class="page-number">${pg3}</div>
  </div>`;

  // ── ENGAGEMENT LETTER BUILDERS ──
  // Accounting & Review use CA letterhead; Audit uses Audit letterhead.
  // Entity-aware addressing: directors/members/trustees/committee etc.

  // Engagement-letter signers print exactly as the select holds them — in
  // capitals (A ANDERSON), which is how the auditors sign these letters.
  const postalParts = addrLines(postal);

  // Addressee label based on entity type
  const engAddressee = entityType === 'cc' ? 'The Members'
    : entityType === 'trust' ? 'The Trustees'
      : entityType === 'bc' ? 'The Trustees'
        : (entityType === 'npo' || isNpcType(entityType)) ? `The ${terms.plural}`
          : entityType === 'church' ? 'The Church Council'
            : entityType === 'club' ? 'The Committee'
              : entityType === 'individual' ? co
                : 'The Directors';

  // Director labels for signature block.
  // The acceptance block at the foot of an engagement letter (and the
  // "Appointment to provide services" letter, which shares this markup) follows
  // the same rule as the financial statements' signature blocks: anyone flagged
  // as signing for the governing body takes it over, so only the flagged people
  // get a line and each carries the caption underneath. None flagged means every
  // director / trustee / member gets a line, as before.
  // Built from `sigDirs`, not `dirs`: an independent trustee left on "Index
  // only" (the default) does not sign these letters either.
  // The school and club/church letters are not affected - their acceptance rows
  // are fixed roles (PRINCIPAL, CHAIRMAN, TREASURER), not a list of people.
  const engReps = sigDirs.filter(d => d.signsForBoard);
  const engSigners = engReps.length ? engReps : sigDirs;
  const engSigLabels = engSigners.map(d =>
    sigLabelWithCaptions(d.full, d, d.signsForBoard ? BOARD_REP_CAPTION : ''));
  const engSigBlock = engSigLabels.length > 0
    ? `<div style="display:grid;grid-template-columns:${
        engSigLabels.length >= 3 ? '1fr 1fr 1fr' : engSigLabels.length > 1 ? '1fr 1fr' : 'max-content'
      };gap:64px 16px;margin-top:24px;">
    ${engSigLabels.map(n => `<div><div style="border-top:1px solid #333;padding-top:6px;min-width:220px;font-weight:bold;">${n}</div></div>`).join('')}
   </div>`
    : entityType === 'individual' && hasSecondIndividual
    ? `<div style="display:grid;grid-template-columns:${
        allIndivNamesUpper.length >= 3 ? '1fr 1fr 1fr' : '1fr 1fr'
      };gap:64px 16px;margin-top:24px;">
    ${allIndivNamesUpper.map(n => `<div><div style="border-top:1px solid #333;padding-top:6px;min-width:220px;font-weight:bold;">${n}</div></div>`).join('\n    ')}
   </div>`
    : entityType === 'individual'
    ? `<div style="margin-top:24px;">
    <div><div style="border-top:1px solid #333;padding-top:6px;font-weight:bold;width:280px;">&nbsp;</div></div>
   </div>`
    : `<div style="display:grid;grid-template-columns:1fr 1fr;gap:64px 16px;margin-top:24px;">
    <div><div style="border-top:1px solid #333;padding-top:6px;font-weight:bold;">&nbsp;</div></div>
    <div><div style="border-top:1px solid #333;padding-top:6px;font-weight:bold;">&nbsp;</div></div>
   </div>`;

  // ── ACCOUNTING ENGAGEMENT LETTER (CA Letterhead) — 3 pages ──
  function buildAccountingEngagementLetter() {
    // Signed by the firm, never by an individual partner: an Appointment to
    // Provide Services letter carries "INF181 GROUP PROJECT" for every
    // entity type (matching the individual version of this letter).
    // An NPO has its own wording (the members, the NPO Act — see the "NPO
    // Accounting Engagement Letter" templates) and, like the individual letter,
    // puts Liability straight after Excluded services.
    const npo = entityType === 'npo';
    const acc = key => npo ? `eng_npo_accounting_${key}` : `eng_accounting_${key}`;
    const disclosurePopia = `<p><em><strong>Disclosure of information and authority</strong></em></p>
${_tplHtml('eng_accounting_disclosure')}
<br>
<p><em><strong>Protection of Personal Information</strong></em></p>
<p>${_tpl(acc('popia'))}</p>`;
    const liability = `<p><em><strong>Liability and limitations:</strong></em></p>
${_tplHtml(acc('liability'))}`;
    return `
  <div class="doc-page compact-page">
${caLetterhead()}
${addrGroup(entityType === 'individual' ? [] : engAddressee, { html: co, bold: true }, postalParts)}
<br>
<br>
<p style="margin:24px 0 0;"><strong>APPOINTMENT TO PROVIDE SERVICES</strong></p>
<p>${_tpl(acc('intro'))}</p>
<br>
<p><em><strong>Accounting records; preparing ${npo ? '' : 'of '}financial statements; taxation and secretarial services:</strong></em></p>
<p>${_tpl(acc('duties'))}</p>
<p>${_tpl(acc('services_detail'))}</p>
<p>${_tpl(acc('basis'))}</p>
<p>${_tpl('eng_accounting_poca')}</p>
<br>
<p><em><strong>Deadlines:</strong></em></p>
<p>${_tpl(acc('deadlines'))}</p>
${letterheadFooter()}
  </div>
  <div class="doc-page compact-page">
<div class="lh-line-spacer" data-lh-align="centre"></div>
<p><em><strong>Excluded services:</strong></em></p>
<p>${_tpl('eng_accounting_excluded')}</p>
<br>
${npo ? liability : disclosurePopia}
<br>
${npo ? disclosurePopia : liability}
<br>
<p><em><strong>Fees:</strong></em></p>
<p>${_tpl(acc('fees'))}</p>
  </div>
  <div class="doc-page compact-page">
<div class="lh-line-spacer" data-lh-align="follow"></div>
${_tplHtml('eng_accounting_closing')}
<br>
<p class="eng-signoff">Yours Faithfully</p>
<p><strong>INF181 GROUP PROJECT</strong></p>
<br><br>
<p>We, the undersigned, agree to the terms of this letter.</p>
<br><br><br>
${engSigBlock}
<p style="margin-top:18px;">${engDateSigned}</p>
  </div>`;
  }

  // ── INDIVIDUAL ACCOUNTING ENGAGEMENT LETTER (CA Letterhead) — "Appointment to provide services" ──
  function buildIndividualAccountingEngagementLetter() {
    // Effective date, in long form (e.g. "27 January 2026"): 14 days before the
    // dateSigned field, matching every other engagement letter's date.
    const effectiveDate = engDateLong;

    // Signature lines with the individual's name(s) beneath.
    const indivSigBlock = hasSecondIndividual
      ? `<div style="display:grid;grid-template-columns:${
          allIndivNamesUpper.length >= 3 ? '1fr 1fr 1fr' : '1fr 1fr'
        };gap:64px 24px;margin-top:8px;">
    ${allIndivNamesUpper.map(n => `<div><div style="border-top:1px solid #333;padding-top:6px;font-weight:bold;">${n}</div></div>`).join('\n    ')}
   </div>`
      : `<div style="margin-top:8px;max-width:320px;">
    <div style="border-top:1px solid #333;padding-top:6px;font-weight:bold;">${allIndivNamesUpper[0]}</div>
   </div>`;

    return `
  <div class="doc-page compact-page">
${caLetterhead()}
${addrGroup({ html: co, bold: true }, postalParts)}
<br>
<br>
<p style="margin:24px 0 0;"><strong>APPOINTMENT TO PROVIDE SERVICES</strong></p>
<p>Thank you for appointing us. This letter sets out the accounting, tax and secretarial services we will provide to you and the terms of our engagement.</p>
<br>
<p><em><strong>Accounting records; preparing financial statements; taxation and secretarial services:</strong></em></p>
<p>All of the above duties remain your responsibility under the applicable legislation. We will assist you in meeting them.</p>
<p>We will prepare accounting records, financial statements and the returns you ask us to submit on your behalf.</p>
<p>These services rely on the information you supply. Any enquiries we make are only to help us provide the services, and we do not verify that information.</p>
<p>We may be required by law to report certain matters to the relevant authority. We will do so where required.</p>
${letterheadFooter()}
  </div>
  <div class="doc-page compact-page">
<p><em><strong>Deadlines:</strong></em></p>
<p>Please send us your information early so that we can meet the applicable deadlines. We will try to send reminders, but the deadlines remain your responsibility.</p>
<br>
<p><em><strong>Excluded services:</strong></em></p>
<p>This letter only relates to services as described and does not extend to services such as audits and reviews of financial statements.</p>
<br>
<p><em><strong>Liability and limitations:</strong></em></p>
<p>We will provide these services with reasonable care and skill. Our advice is based on our reading of the law and the information you give us.</p>
<p>Our liability for any claim is limited to the fees charged in the preceding 12 months.</p>
<br>
<p><em><strong>Disclosure of information and authority</strong></em></p>
<p>You agree that we may share information with third parties where this is needed to carry out the services in this letter.</p>
<p>This authority shall apply notwithstanding any duty of confidentiality otherwise owed by us, provided that such disclosure is made in good faith and for purposes related to the services rendered.</p>
<br>
<p><em><strong>Protection of Personal Information</strong></em></p>
<p>We handle personal information in line with the applicable privacy legislation. Information is used only for the services in this letter and is kept confidential and secure.</p>
  </div>
  <div class="doc-page compact-page">
<p><em><strong>Fees:</strong></em></p>
<p>Our fees are based on the time spent on your affairs. Invoices are sent at regular intervals and are payable within 30 days.</p>
<p>This letter will be effective for future years unless it is terminated or suspended.</p>
<p>Kindly acknowledge receipt of this letter. Should the content not correspond with your view of our terms of engagement, we will gladly discuss this matter further with you.</p>
<br>
<p class="eng-signoff">Yours Faithfully</p>
<p><strong>INF181 GROUP PROJECT</strong></p>
<br>
<p>We, the undersigned, agree to the terms of this letter.</p>
<br><br><br>
${indivSigBlock}
  </div>`;
  }

  // ── REVIEW ENGAGEMENT LETTER (CA Letterhead; Audit Letterhead for PPRA) ──
  // A PPRA company's review letter is the registered auditor's: audit letterhead
  // and footer, signed off REGISTERED AUDITOR (SA). The wording is the same.
  function buildReviewEngagementLetter() {
    const practitioner = document.getElementById('engSignerReview')?.value || compilerSigner;
    // An NPO is not under the Companies Act: the members are responsible, the
    // framework is the NPO Act, and there is no public-interest-score paragraph
    // and no Regulation 29 section (2026 NPO review template).
    const npo = entityType === 'npo';
    const rev = key => npo ? `eng_npo_review_${key}` : `eng_review_${key}`;
    return `
  <div class="doc-page" style="line-height:var(--doc-lh-decl);">
${isPpra ? auditLetterhead() : caLetterhead()}
${addrGroup(engAddressee, { html: co, bold: true }, postalParts)}
<br><br>
<p style="margin:8px 0 0;"><strong>ENGAGEMENT LETTER TO REVIEW FINANCIAL STATEMENTS</strong></p>
<br>
<p><em><strong>The objective and scope of the review and our responsibilities</strong></em></p>
<p>${_tpl(rev('scope_detail'))}</p>
${_tplHtml('eng_review_higher_risk')}
${isPpra ? auditFooter() : letterheadFooter()}
  </div>
  <div class="doc-page" style="line-height:var(--doc-lh-decl);">
<br>
<p><em><strong>Responsibilities of the ${pluralTerm.toLowerCase()}</strong></em></p>
${npo ? '' : `<p>${_tpl('eng_review_responsibilities')}</p>`}
${_tplHtml(rev('conduct_basis'))}
<br>
<p><em><strong>Reporting</strong></em></p>
${_tplHtml(rev('reporting'))}
<br>
${npo ? '' : `<p><em><strong>Reportable irregularities in terms of Regulation 29 of the Companies Regulations, 2011</strong></em></p>
${_tplHtml('eng_review_reportable')}
<br>`}
<p><em><strong>Disclosure of information and authority</strong></em></p>
${_tplHtml('eng_review_disclosure')}
<br>
<p><em><strong>Protection of Personal Information</strong></em></p>
<p>${_tpl('eng_review_popia')}</p>
<br>
<p><em><strong>Fees</strong></em></p>
<p>${_tpl('eng_review_fees')}</p>
  </div>
  <div class="doc-page" style="line-height:var(--doc-lh-decl);">
<p><em><strong>Agreement of terms</strong></em></p>
<p>${_tpl('eng_review_agreement')} The individual practitioner responsible and accountable for the review engagement is:</p>
<br><br>
<p><strong>${practitioner}</strong></p>
<br><br><br>
<p>${_tpl('eng_review_signing')}</p>
<br>
<p>Yours faithfully</p>
<br><br><br>
<p><strong>${isPpra ? 'REGISTERED AUDITOR (SA)' : 'INF181 GROUP PROJECT (SA)'}</strong></p>
<br>
<p>We, the undersigned, being duly authorized to sign for or on behalf of the entity, herewith accept the above terms of the engagement.</p>
<br><br><br><br>
${engSigBlock}
<p style="margin-top:18px;">${engDateSigned}</p>
  </div>`;
  }

  // ── CLUB / CHURCH AUDIT ENGAGEMENT LETTER (Audit Letterhead) ──
  function buildClubChurchAuditEngagementLetter() {
    const practitioner = document.getElementById('engSignerAudit')?.value || compilerSigner;
    const bodyLabel = entityType === 'church' ? 'church council' : 'committee';
    const entityLabel = entityType === 'church' ? 'church' : 'club';
    const ccExtra = { BODY_LABEL: bodyLabel, ENTITY_LABEL: entityLabel };
    return `
  <div class="doc-page">
${auditLetterhead()}
${addrGroup(engAddressee, { html: co, bold: true }, postalParts)}
<p style="margin:8px 0 0;"><strong>ENGAGEMENT LETTER TO AUDIT FINANCIAL STATEMENTS</strong></p>
<p><em><strong>The objective and scope of the audit and our responsibilities</strong></em></p>
<p>${_tpl('eng_club_church_scope', ccExtra)}</p>
<p><em><strong>Responsibilities of the ${bodyLabel}</strong></em></p>
<p>${_tpl('eng_club_church_responsibilities', ccExtra)}</p>
${_tplHtml('eng_club_church_conduct_basis', ccExtra)}
<p><em><strong>Reporting</strong></em></p>
${_tplHtml('eng_club_church_reporting', ccExtra)}
<p><em><strong>Disclosure of information and authority</strong></em></p>
${_tplHtml('eng_club_church_disclosure', ccExtra)}
<p><em><strong>Protection of Personal Information</strong></em></p>
<p>${_tpl('eng_club_church_popia', ccExtra)}</p>
<p><em><strong>Fees</strong></em></p>
<p>${_tpl('eng_club_church_fees', ccExtra)}</p>
<p><em><strong>Agreement of terms</strong></em></p>
<p>${_tpl('eng_club_church_agreement', ccExtra)} The individual practitioner responsible and accountable for the audit engagement is:</p>
<p><strong>${practitioner}</strong></p>
<p>${_tpl('eng_club_church_signing', ccExtra)}</p>
<p>Yours faithfully</p>
<br>
<p><strong>REGISTERED AUDITOR (SA)</strong></p>
<br>
<p>We, the undersigned, being duly authorized to sign for or on behalf of the entity, herewith accept the above terms of the engagement.</p>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:64px 32px;margin-top:24px;">
  <div><div style="border-top:1px solid #333;padding-top:6px;font-weight:bold;">CHAIRMAN</div></div>
  <div><div style="border-top:1px solid #333;padding-top:6px;font-weight:bold;">TREASURER</div></div>
</div>
<p style="margin-top:18px;">${engDateSigned}</p>
${auditFooter()}
  </div>`;
  }

  // ── SCHOOL REVIEW ENGAGEMENT LETTER (CA Letterhead) ──
  function buildSchoolReviewEngagementLetter() {
    return `
  <div class="doc-page" style="line-height:var(--doc-lh-eng);font-size:9.5pt;">
${caLetterhead()}
<p style="margin:8px 0 0;"><strong>REVIEW ENGAGEMENT LETTER</strong></p>
<p style="margin:0;line-height:1.3;">The School Governing Body of ${co}</p>
<p>${_tpl('eng_school_review_sgb_purpose')}</p>
<br>
<p><strong>RESPONSIBILITIES OF THE SCHOOL GOVERNING BODY AND REVIEWERS</strong></p>
${_tplNumbered('eng_school_review_sgb_responsibilities')}
${letterheadFooter()}
  </div>
  <div class="doc-page" style="line-height:var(--doc-lh-eng);font-size:9.5pt;">
<p><strong>SCOPE OF REVIEW</strong></p>
${_tplNumbered('eng_school_review_scope')}
<br><br><br><br>
<p><strong>DISCLOSURE OF INFORMATION AND AUTHORITY</strong></p>
<p style="padding-left:28px;text-indent:-28px;"><span style="display:inline-block;width:28px;">3.</span>${_tpl('eng_school_review_disclosure').split('\n\n')[0]}</p>
<p style="padding-left:28px;">${_tpl('eng_school_review_disclosure').split('\n\n')[1] || ''}</p>
  </div>
  <div class="doc-page" style="line-height:var(--doc-lh-eng);font-size:9.5pt;">
<p><strong>PROTECTION OF PERSONAL INFORMATION</strong></p>
<p style="padding-left:28px;text-indent:-28px;"><span style="display:inline-block;width:28px;">4.</span>${_tpl('eng_school_review_popia')}</p>
<p><strong>FEES</strong></p>
<p style="padding-left:28px;text-indent:-28px;"><span style="display:inline-block;width:28px;">5.</span>${_tpl('eng_school_review_fees')}</p>
<p><strong>AGREEMENT OF TERMS</strong></p>
<p style="padding-left:28px;text-indent:-28px;"><span style="display:inline-block;width:28px;">6.</span>${_tpl('eng_school_review_agreement')}</p>
<p>Yours faithfully,</p>
<br><br><br><br>
<p><br><strong>${compilerSigner}</strong></p>
<br>
<p>We agree to the terms of this letter.</p>
<br><br><br>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:64px 32px;margin-top:12px;">
  <div><div style="border-top:1px solid #333;padding-top:6px;font-weight:bold;">PRINCIPAL</div></div>
  <div><div style="border-top:1px solid #333;padding-top:6px;font-weight:bold;">CHAIRPERSON OF SGB</div></div>
</div>
<p style="margin-top:18px;">${engDateSigned}</p>
  </div>`;
  }

  // ── SCHOOL AUDIT ENGAGEMENT LETTER (Audit Letterhead) ──
  function buildSchoolAuditEngagementLetter() {
    return `
  <div class="doc-page" style="line-height:var(--doc-lh-eng);font-size:9.5pt;">
${auditLetterhead()}
<p style="margin:8px 0 0;"><strong>AUDIT ENGAGEMENT LETTER</strong></p>
<p style="margin:0;line-height:1.3;">The School Governing Body of ${co}</p>
<p>${_tpl('eng_school_audit_purpose')}</p>
<br>
<p><strong>RESPONSIBILITIES OF THE SCHOOL GOVERNING BODY AND AUDITORS</strong></p>
${_tplNumbered('eng_school_audit_sgb_responsibilities')}
${auditFooter()}
  </div>
  <div class="doc-page" style="line-height:var(--doc-lh-eng);font-size:9.5pt;">
<p><strong>SCOPE OF AUDIT</strong></p>
${_tplNumbered('eng_school_audit_scope')}
<br><br><br>
<p><strong>DISCLOSURE OF INFORMATION AND AUTHORITY</strong></p>
<p style="padding-left:28px;text-indent:-28px;"><span style="display:inline-block;width:28px;">3.</span>${_tpl('eng_school_audit_disclosure').split('\n\n')[0]}</p>
<p style="padding-left:28px;">${_tpl('eng_school_audit_disclosure').split('\n\n')[1] || ''}</p>
  </div>
  <div class="doc-page" style="line-height:var(--doc-lh-eng);font-size:9.5pt;">
<p><strong>PROTECTION OF PERSONAL INFORMATION</strong></p>
<p style="padding-left:28px;text-indent:-28px;"><span style="display:inline-block;width:28px;">4.</span>${_tpl('eng_school_audit_popia')}</p>
<br><br><br><br><br><br>
<p><strong>FEES</strong></p>
<p style="padding-left:28px;text-indent:-28px;"><span style="display:inline-block;width:28px;">5.</span>${_tpl('eng_school_audit_fees')}</p>
<p><strong>AGREEMENT OF TERMS</strong></p>
<p style="padding-left:28px;text-indent:-28px;"><span style="display:inline-block;width:28px;">6.</span>${_tpl('eng_school_audit_agreement')}</p>
<p>Yours faithfully,</p>
<br><br><br><br>
<p><strong>${schoolAuditorSigner}</strong></p>
<br>
<p>We agree to the terms of this letter.</p>
<br>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:64px 32px;margin-top:12px;">
  <div><div style="border-top:1px solid #333;padding-top:6px;font-weight:bold;">PRINCIPAL</div></div>
  <div><div style="border-top:1px solid #333;padding-top:6px;font-weight:bold;">CHAIRPERSON OF SGB</div></div>
</div>
<p style="margin-top:18px;">${engDateSigned}</p>
  </div>`;
  }

  // ── AUDIT ENGAGEMENT LETTER (Audit Letterhead) ──
  function buildAuditEngagementLetter() {
    const practitioner = document.getElementById('engSignerAudit')?.value || compilerSigner;
    // An NPO has its own audit letter (2026 NPO audit template): the members,
    // the NPO Act, no public-interest-score paragraph and no Regulation 29
    // section. Three sheets laid out like the company letter — scope to the
    // first two conduct bullets; the rest of the conduct basis to fees; then
    // agreement of terms through the sign-off, so the signatures never stand
    // alone.
    if (entityType === 'npo') return buildNpoAuditEngagementLetter(practitioner);
    return `
  <div class="doc-page" data-no-squeeze style="line-height:var(--doc-lh-eng);font-size:9.5pt;">
${auditLetterhead()}
${addrGroup(engAddressee, { html: co, bold: true }, postalParts)}
<p class="eng-title"><strong>ENGAGEMENT LETTER TO AUDIT FINANCIAL STATEMENTS</strong></p>
<p><em><strong>The objective and scope of the audit and our responsibilities</strong></em></p>
<p>${_tpl('eng_audit_scope')}</p>
<br>
<p><em><strong>Responsibilities of the ${pluralTerm.toLowerCase()}</strong></em></p>
<p>${_tpl('eng_audit_responsibilities')}</p>
${_tplHtmlLines('eng_audit_conduct_basis', 0, 3)}
${auditFooter()}
  </div>
  <div class="doc-page" style="line-height:var(--doc-lh-eng);font-size:9.5pt;">
${_tplHtmlLines('eng_audit_conduct_basis', 3)}
<br><br>
<p><em><strong>Reporting</strong></em></p>
${_tplHtml('eng_audit_reporting')}
<br>
<p><em><strong>Reportable irregularities in terms of Regulation 29 of the Companies Regulations, 2011</strong></em></p>
<p>${_tpl('eng_audit_reportable')}</p>
${_tplHtml('eng_audit_reportable_detail')}
  </div>
  <div class="doc-page" style="line-height:var(--doc-lh-eng);font-size:9.5pt;">
<p><em><strong>Disclosure of information and authority</strong></em></p>
${_tplHtml('eng_audit_disclosure')}
<br>
<p><em><strong>Protection of Personal Information</strong></em></p>
<p>${_tpl('eng_audit_popia')}</p>
<br>
<p><em><strong>Fees</strong></em></p>
<p>${_tpl('eng_audit_fees')}</p>
<br>
<p><em><strong>Agreement of terms</strong></em></p>
<p>${_tpl('eng_audit_agreement')} The individual practitioner responsible and accountable for the audit engagement is:</p>
<br>
<p><strong>${practitioner}</strong></p>
<p>${_tpl('eng_audit_signing')}</p>
<br>
<p>Yours faithfully</p>
<br><br><br>
<p><strong>REGISTERED AUDITOR (SA)</strong></p>
<br>
<p>We, the undersigned, being duly authorized to sign for or on behalf of the entity, herewith accept the above terms of the engagement.</p>
<br><br><br>
${engSigBlock}
<p style="margin-top:18px;">${engDateSigned}</p>
  </div>`;
  }

  // ── NPO AUDIT ENGAGEMENT LETTER (Audit Letterhead) ──
  function buildNpoAuditEngagementLetter(practitioner) {
    return `
  <div class="doc-page" data-no-squeeze style="line-height:var(--doc-lh-eng);font-size:9.5pt;">
${auditLetterhead()}
${addrGroup(engAddressee, { html: co, bold: true }, postalParts)}
<p class="eng-title"><strong>ENGAGEMENT LETTER TO AUDIT FINANCIAL STATEMENTS</strong></p>
<p><em><strong>The objective and scope of the audit and our responsibilities</strong></em></p>
<p>${_tpl('eng_npo_audit_scope')}</p>
<br>
<p><em><strong>Responsibilities of the ${npoBody}</strong></em></p>
<p>${_tpl('eng_npo_audit_responsibilities')}</p>
${_tplHtmlLines('eng_npo_audit_conduct_basis', 0, 3)}
${auditFooter()}
  </div>
  <div class="doc-page" style="line-height:var(--doc-lh-eng);font-size:9.5pt;">
${_tplHtmlLines('eng_npo_audit_conduct_basis', 3)}
<br>
<p><em><strong>Reporting</strong></em></p>
${_tplHtml('eng_npo_audit_reporting')}
<br>
<p><em><strong>Disclosure of information and authority</strong></em></p>
${_tplHtml('eng_audit_disclosure')}
<br>
<p><em><strong>Protection of Personal Information</strong></em></p>
<p>${_tpl('eng_audit_popia')}</p>
<br>
<p><em><strong>Fees</strong></em></p>
<p>${_tpl('eng_audit_fees')}</p>
  </div>
  <div class="doc-page" style="line-height:var(--doc-lh-eng);font-size:9.5pt;">
<p><em><strong>Agreement of terms</strong></em></p>
<p>${_tpl('eng_audit_agreement')} The individual practitioner responsible and accountable for the audit engagement is:</p>
<br>
<p><strong>${practitioner}</strong></p>
<br>
<p>${_tpl('eng_audit_signing')}</p>
<br>
<p>Yours faithfully</p>
<br><br><br>
<p><strong>REGISTERED AUDITOR (SA)</strong></p>
<br>
<p>We, the undersigned, being duly authorized to sign for or on behalf of the entity, herewith accept the above terms of the engagement.</p>
<br><br><br>
${engSigBlock}
<p style="margin-top:18px;">${engDateSigned}</p>
  </div>`;
  }

  // ── ATTORNEYS TRUST ACCOUNT ENGAGEMENT LETTER (Audit Letterhead) ──
  function buildAttorneysEngagementLetter() {
    const attSignerMap = {
      'R CLARKE': { name: 'RITA CLARKE', irba: '100001' },
      'A ANDERSON': { name: 'A ANDERSON', irba: '______' }
    };
    const attSignerVal = getRadio('attEngSigner') || 'R CLARKE';
    const attSigner = attSignerMap[attSignerVal] || attSignerMap['R CLARKE'];

    const yeParts = yearEndLong.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
    let periodStart = '1 March [YEAR]';
    if (yeParts) {
      const yeYear = parseInt(yeParts[3]);
      periodStart = `1 March ${yeYear - 1}`;
    }
    const periodStr = `the period from ${periodStart} to the year ended ${yearEnd}`;
    const attExtra = { PERIOD: periodStr };

    return `
  <div class="doc-page" style="font-size:9.5pt;">
${auditLetterhead()}
${addrGroup('To the Directors', { html: co, bold: true }, engDateSigned || '[DATE]')}
<p style="margin:8px 0 0;">Dear Directors</p>
<p><strong>Engagement Letter</strong></p>
<p><strong>Independent Auditor's Reasonable Assurance Engagement on Legal Practitioners' Trust Accounts</strong></p>
<p>You have requested that we undertake:</p>
<p><em>${_tpl('eng_attorneys_scope', attExtra)}</em></p>
<p>${_tpl('eng_attorneys_clarification', attExtra)}</p>
<p>${_tpl('eng_attorneys_advisory_agree', attExtra)}</p>
<p>${_tpl('eng_attorneys_advisory_read', attExtra)}</p>
<p>${_tpl('eng_attorneys_investment', attExtra)}</p>
<p><strong><em>Directors' responsibility for the trust accounts</em></strong></p>
${_tplHtml('eng_attorneys_directors_responsibility', attExtra)}
<p><strong><em>Auditor's independence and quality control</em></strong></p>
<p>${_tpl('eng_attorneys_independence', attExtra)}</p>
<p><strong><em>Auditor's responsibility</em></strong></p>
${_tplHtml('eng_attorneys_auditor_responsibility', attExtra)}
${_tplHtml('eng_attorneys_procedures', attExtra)}
${_tplHtml('eng_attorneys_limitations', attExtra)}
<p><strong><em>Other matters</em></strong></p>
<p>None</p>
<p><strong><em>Our Report on the Compliance of the Legal Practitioner's Trust Accounts with the Act and the Rules</em></strong></p>
<p><em>${_tpl('eng_attorneys_report_compliance', attExtra)}</em></p>
<p><strong><em>Report on Other Legal and Regulatory Requirements</em></strong></p>
<p><strong><em>Our Report on the Legal Practitioner's Annual Statement on Trust Accounts</em></strong></p>
${_tplHtml('eng_attorneys_report_annual', attExtra)}
<p><strong><em>Our report on the Legal Practitioner's Investment Practice</em></strong></p>
<p>${_tpl('eng_attorneys_report_investment', attExtra)}</p>
<p><strong><em>Reportable irregularities</em></strong></p>
${_tplHtml('eng_attorneys_reportable', attExtra)}
<p><strong><em>Non-compliance with Laws and Regulations</em></strong></p>
<p>${_tpl('eng_attorneys_ncwr', attExtra)}</p>
<p><strong><em>Restriction on the use and distribution of our report</em></strong></p>
<p>${_tpl('eng_attorneys_restriction', attExtra)}</p>
<p>${_tpl('eng_attorneys_signing', attExtra)}</p>
<br>
<p><strong><em>Registered Auditor's Signature</em></strong></p>
<br><br>
<p>________________________</p>
<p><strong>${attSigner.name}</strong></p>
<p>IRBA Registration Number ${attSigner.irba}</p>
<p>INF181 Audit</p>
<br>
<p>Acknowledged and agreed by the directors</p>
<p>Yours faithfully</p>
<br>
${engSigBlock}
${auditFooter()}
  </div>`;
  }

  // ── CONDITIONAL ENGAGEMENT LETTER ASSEMBLY ──
  // Nothing ticked = no engagement letter (the old Yes/No question is gone).
  let engagementLetterPages = '';
  if (entityType === 'attorneys') {
    if (document.getElementById('engTypeAttorneys').checked) engagementLetterPages = buildAttorneysEngagementLetter();
  } else if (entityType === 'school') {
    if (document.getElementById('engTypeReview').checked) engagementLetterPages += buildSchoolReviewEngagementLetter();
    if (document.getElementById('engTypeAudit').checked) engagementLetterPages += buildSchoolAuditEngagementLetter();
  } else {
    if (document.getElementById('engTypeAccounting').checked) engagementLetterPages += (entityType === 'individual' ? buildIndividualAccountingEngagementLetter() : buildAccountingEngagementLetter());
    if (document.getElementById('engTypeReview').checked) engagementLetterPages += buildReviewEngagementLetter();
    if (document.getElementById('engTypeAudit').checked) {
      if (entityType === 'club' || entityType === 'church') {
        engagementLetterPages += buildClubChurchAuditEngagementLetter();
      } else {
        engagementLetterPages += buildAuditEngagementLetter();
      }
    }
  }

  // ── TRUST MINUTES PAGE ──
  let pageTrustMinutes = '';
  if (entityType === 'trust') {
    const agmVenue = getVal('trustAGMVenue') || '[VENUE]';
    const agmDate = hl(getVal('trustAGMDate') || '[DATE]');
    const bankAcct = getRadio('trustBankAcct');
    const taxReg = getRadio('trustTax');
    const distrib = getRadio('trustDistributions');
    const donations = getRadio('trustDonations');
    const remun = getRadio('trustRemuneration');
    const deedChg = getRadio('trustDeedChanges');
    const deedText = getVal('trustDeedText');
    const loaText = getVal('trustLoaText');

    const bankPara = bankAcct === 'none'
      ? `<p class="underline-heading">BANK ACCOUNT</p>
     <p>A Bank account was opened at the establishment of the trust. The trustees, on behalf of the trust, decided that the bank account was unnecessary and stated that there is no bank account at this moment, due to the unnecessary costs.</p>`
      : '';

    const taxPara = taxReg === 'none'
      ? `<p>The trust had no taxable income after distributions to beneficiaries and was therefore never registered for tax.</p>`
      : '';

    const distribPara = distrib === 'yes'
      ? `<p>All income and/or capital distributions made to beneficiaries during the financial year were approved by the trustees. It is explicitly confirmed that the distributions to beneficiaries will not be compensated for by the physical cash flow, but rather by way of their loan accounts.</p>`
      : '';

    const donationsPara = donations === 'yes'
      ? `<p class="underline-heading">DONATIONS RECEIVED</p>
     <p>The trustees are grateful to all the donors for donations that were received during the financial year.</p>`
      : '';

    const remunPara = remun === 'approved'
      ? `<p>All trustees' remuneration, as shown in the Statement of Profit or Loss and Other Comprehensive Income, were approved.</p>`
      : `<p>It was decided that there will be no trustees' remuneration for this financial year.</p>`;

    // "Changes were made — describe" covers two halves that move independently:
    // the deed itself and the Letter of Authority. Leaving one box blank means
    // that half did not change, so state it — the old code printed the "The
    // following changes were made…:" lead-in followed by a bare
    // "[DESCRIBE CHANGES]" placeholder, which auditors rewrote by hand every
    // time only the LOA was amended.
    const deedSection = deedText
      ? `<p class="keep-next">The following changes were made in the structure of the Trust Deed:</p>
     <p>${deedText}</p>`
      : `<p>No changes were made in the structure of the Trust Deed.</p>`;
    const loaSection = loaText
      ? `<p class="keep-next">These amendments were made to the Letter of Authority:</p>
     <p>${loaText}</p>`
      : `<p>No amendments were made to the Letter of Authority.</p>`;

    const deedPara = deedChg === 'none'
      ? `<p>No major changes were made in the structure of the Trust Deed. No amendments were made to the Letter of Authority.</p>`
      : `${deedSection}
     ${loaSection}`;

    pageTrustMinutes = `
  <div class="doc-page">
<div class="page-header">
  <div class="co-name">${coUpper}</div>
  ${reg ? `<div class="co-reg">(Registration Number ${hlReg})</div>` : ''}
</div>
<h2 style="text-align:center;">Minutes of the Annual General Meeting of Trustees of<br>${co}</h2>
<p style="text-align:center;font-style:italic;text-transform:uppercase;">held at ${agmVenue} on ${agmDate}.</p>
<br>
<p class="underline-heading">PRESENT</p>
<p>${sigDirList}</p>
<p class="underline-heading">NOTICE</p>
<p>The notice of the meeting was hereby regarded as read and, as a quorum, is present, the chairman declared the meeting as properly constituted.</p>
<p class="underline-heading">PREVIOUS MEETING</p>
<p>The minutes of the last meeting of the trustees were read, approved and signed.</p>
${bankPara}
<p class="underline-heading">FINANCIAL STATEMENTS</p>
<p>The annual financial statements for the year ended ${yearEnd}, together with the accounting officer's report, was presented. The trustees hereby condone all the transactions and consolidation of loan accounts reflected on the financial statements for the past year.</p>
${taxPara}
${distribPara}
<p class="underline-heading">ACCOUNTANTS</p>
<p>The accountant's remuneration for the past financial year, if applicable was determined as the amount set out in the financial statements. It was resolved that the present accountants of the trust, are hereby re-appointed as accountants for the ensuing year.</p>
${donationsPara}
<p class="underline-heading">TRUSTEES' REMUNERATION</p>
${remunPara}
<p class="underline-heading">SPECIFIC MATTERS</p>
${deedPara}
<p>It was hereby resolved that the present trustees of the trust are hereby re-appointed as trustees for the ensuing year.</p>
<p>We, the undersigned trustees, attended the above meeting and confirm that the minutes, as stated above, is a correct version of the proceedings.</p>
<div class="signature-block minutes-sig">
  ${sigBlock(sigDirs)}
</div>
  </div>`;
  }

  // ── CC MINUTES PAGE (CC only — single page: Members AGM) ──
  let ccMinutesPages = '';
  if (entityType === 'cc') {
    const ccVenue = (getVal('cc-minutes-venue') || '[VENUE]').toUpperCase();
    const ccDate = hl((getVal('cc-minutes-date') || '[DATE]').toUpperCase());
    const auditSentenceCC = (reportType === 'audit')
      ? `<p class="underline-heading">AUDITOR</p>
     <p>The auditor's remuneration for the past financial year is determined as the amount set out in the financial statements. It is resolved that the present auditors of the entity be hereby re-appointed as auditors for the ensuing year.</p>`
      : '';

    ccMinutesPages = `
  <div class="doc-page">
<div class="page-header">
  ${regLine}
</div>
<h2 class="minutes-title" style="letter-spacing:0.06em;">MINUTES OF THE ANNUAL GENERAL MEETING OF MEMBERS OF THE ENTITY<br>HELD AT ${ccVenue} ON ${ccDate}.</h2>
<br>
<p class="minutes-present"><strong>PRESENT:</strong><span>${dirs.map(d => d.full).join(', ') || '[MEMBER NAMES]'}</span></p>
<p class="underline-heading">QUORUM AND NOTICE</p>
<p>As the necessary quorum was present, the chairman declared the meeting properly constituted and the notice convening the meeting was with the consent of the members, taken as read.</p>
<p class="underline-heading">MINUTES</p>
<p>The minutes of the previous annual general meeting were taken as read and signed by the chairman as a correct record of the proceedings.</p>
<p class="underline-heading">ADOPTION OF REPORT AND FINANCIAL STATEMENTS</p>
<p>The chairman stated that he had nothing further to add to the report of the members for the year ended ${yearEnd} and moved that the members' report and financial statements for the year ended ${yearEnd} be and they are hereby approved and adopted, and that all matters and business undertaken and discharged by the members on behalf of the entity be and they are hereby confirmed. The chairman's motion was seconded, put to the meeting and carried unanimously. It was resolved that any two of the members of the entity are hereby authorized to sign the aforesaid annual financial statements and members' report, and copies thereof.</p>
<p>It was then recorded that, to the best knowledge of the members, all assets and liabilities and contingent liabilities have been recorded in the financial statements. The members are of the opinion that none of the assets had (at date of the balance sheet and on realization in the ordinary course of the entity's business), a value less than the amounts at which they are stated in the balance sheet.</p>
${auditSentenceCC}
<p class="underline-heading">MEMBERS</p>
<p>The members' remuneration as set out in the financial statements is approved.</p>
<p class="underline-heading">GENERAL</p>
<p>It was resolved that the forthcoming annual general meeting of the entity be held on&nbsp;<span style="display:inline-block;min-width:200px;border-bottom:1px solid #333;">&nbsp;</span>.</p>
<p>Since all business is concluded, the meeting is adjourned.</p>
<p>We, the undersigned members, attended the above meeting and confirm that the minutes, as stated above, is a correct version of the proceedings.</p>
<div class="signature-block minutes-sig">${sigBlock(sigDirs)}</div>
  </div>`;
  }

  // ── MINUTES PAGES (Company only) ──
  let minutesPages = '';
  if (entityType === 'company') {
    const mVenue = (getVal('minutes-venue') || '[VENUE]').toUpperCase();
    const mDate = hl((getVal('minutes-date') || '[DATE]').toUpperCase());


    // ── Directors Meeting ──
    const pageDirMinutes = `
  <div class="doc-page">
<div class="page-header">
  ${regLine}
</div>
<h2 class="minutes-title" style="letter-spacing:0.06em;">MINUTES OF THE DIRECTORS' MEETING OF THE COMPANY<br>HELD AT ${mVenue} ON ${mDate}.</h2>
<br>
<p class="minutes-present"><strong>PRESENT:</strong><span>${dirs.map(d => d.full).join(', ') || '[DIRECTOR NAMES]'}</span></p>
<p>The directors hereby decide unanimously that:</p>
<p>It was resolved that the annual financial statements for the year ended ${yearEnd} (to be laid before the company at the forthcoming annual general meeting) and as now submitted for approval by the board of directors, be hereby approved both as to contents and as to form.</p>
<p>It was resolved that the form and content of the report by the directors, pursuant to the Companies Act and as now submitted for the approval of the board of directors, be hereby approved and adopted for the said purpose.</p>
<p>It was resolved that any two of the directors of the company are hereby authorized to sign the aforesaid annual financial statements and directors' report, and copies thereof, for and on behalf of the board.</p>
<p>It was then recorded that, to the best knowledge of the directors, all assets and liabilities and contingent liabilities have been recorded in the financial statements. The directors are of the opinion that none of the assets had (at date of the balance sheet and on realization in the ordinary course of the company's business), a value less than the amounts at which they are stated in the balance sheet.</p>
<p>It was resolved that the forthcoming annual general meeting of the company be held on&nbsp;<span style="display:inline-block;min-width:200px;border-bottom:1px solid #333;">&nbsp;</span>.</p>
<p>Since all business is concluded, the meeting is adjourned.</p>
<p>We, the undersigned directors, attended the above meeting and confirm that the minutes, as stated above, is a correct version of the proceedings.</p>
<div class="signature-block minutes-sig">${sigBlock(sigDirs)}</div>
  </div>`;

    // ── Shareholders AGM ──
    const shareholders = getShareholders();
    // Each shareholder on its own line. Entity-proxy labels ("Name (on behalf of
    // Entity)") are long, so comma-joining them wrapped badly and the auditor kept
    // splitting the second onto its own line — stack them instead.
    const shPresentList = shareholders.length
      ? shareholders.map(sh => sh.type === 'entity' && sh.proxy ? sh.proxy + ' (on behalf of ' + sh.name + ')' : sh.name).join('<br>')
      : '[SHAREHOLDER NAMES]';

    function shSigBlock() {
      const list = shareholders.length ? shareholders : [{ name: '[SHAREHOLDER]', type: 'individual', proxy: '' }];
      let html = '<div style="display:flex;flex-wrap:wrap;gap:8px 48px;margin-top:20px;">';
      list.forEach(sh => {
        const label = (sh.type === 'entity' && sh.proxy)
          ? hl(sh.proxy) + '<br><span style="font-size:9pt;font-weight:400;">(on behalf of ' + hl(sh.name) + ')</span>'
          : hl(sh.name);
        const shAttr = sh.idx ? ' data-sh-index="' + sh.idx + '"' : '';
        html += '<div class="sig-entry"' + shAttr + ' contenteditable="false" style="min-width:190px;margin-bottom:28px;">'
          + '<div class="sig-space" style="min-height:50px;"></div>'
          + '<div class="sig-line">&nbsp;</div>'
          + '<div class="sig-name">' + label + '</div>'
          + '</div>';
      });
      html += '</div>';
      return html;
    }

    const auditSentence = (reportType === 'audit')
      ? `<p>The auditor's remuneration for the past financial year is determined as the amount set out in the financial statements. It is resolved that the present auditors of the company be hereby re-appointed as auditors for the ensuing year.</p>`
      : '';

    const pageShAGM = `
  <div class="doc-page" data-minutes-part="shareholders">
<div class="page-header">
  ${regLine}
</div>
<h2 class="minutes-title" style="letter-spacing:0.06em;">MINUTES OF THE ANNUAL GENERAL MEETING OF SHAREHOLDERS OF THE COMPANY<br>HELD AT ${mVenue} ON ${mDate}.</h2>
<br>
<p class="minutes-present"><strong>PRESENT:</strong><span>${shPresentList}</span></p>
<p class="underline-heading">Quorum and Notice</p>
<p>As the necessary quorum was present, the chairman declared the meeting properly constituted and the notice convening the meeting was with the consent of the shareholders, taken as read.</p>
<p>The minutes of the previous annual general meeting were taken as read and signed by the chairman as a correct record of the proceedings.</p>
<p class="underline-heading">Adoption of Report and Financial Statements</p>
<p>The chairman stated that he had nothing further to add to the report of the directors for the year ended ${yearEnd} and moved that the directors' report and financial statements for the year ended ${yearEnd} be and they are hereby approved and adopted, and that all matters and business undertaken and discharged by the directors on behalf of the company be and they are hereby confirmed. The chairman's motion was seconded, put to the meeting and carried unanimously.</p>
${auditSentence}
<p class="underline-heading">Directors</p>
<p>It was resolved that the present directors of the company are hereby re-appointed for the ensuing year. The directors' remuneration as set out in the financial statements is approved.</p>
<p>Since all business is concluded, the meeting is adjourned.</p>
<p>We, the undersigned shareholders, attended the above meeting and confirm that the minutes, as stated above, is a correct version of the proceedings.</p>
${shSigBlock()}
  </div>`;

    minutesPages = pageDirMinutes + pageShAGM;
  }

  // ── MANAGEMENT REPRESENTATION LETTER (all except school and attorneys) ──
  // An NPO gets the company letter word for word for now ("company", "the
  // directors", paragraph 15) — the organisation/club/centre choice and the
  // governing body (Step 4) do not touch it. Signed by office (npoSigners).
  let reprLetter = '';
  if (entityType !== 'school' && entityType !== 'attorneys') {
    // Adapt terminology per entity type
    const reprEntityLabel = entityType === 'cc' ? 'close corporation'
      : entityType === 'trust' ? 'trust'
        : isNpcType(entityType) ? 'non-profit company'
          : entityType === 'bc' ? 'body corporate'
            : entityType === 'church' ? 'church'
              : entityType === 'club' ? 'club'
                : 'company';
    // NPO terms follow the governing body (getEntityConfig), but this letter
    // keeps the company's "the directors" — see above.
    const reprBodyTerm = entityType === 'npo' ? 'Directors'
      : dirCount === 1 ? terms.singular : terms.plural;
    const reprSignatories = dirCount === 1
      ? `the ${reprBodyTerm.toLowerCase()}`
      : `the ${reprBodyTerm.toLowerCase()}`;
    const reprAssets = entityType === 'trust'
      ? 'the trust'
      : `the ${reprEntityLabel}`;
    const reprShares = (entityType === 'company' || entityType === 'npo')
      ? `<p>15. All material share or other options granted by the ${reprEntityLabel} and material bonus or other profit sharing arrangements, have been adequately disclosed or provided for.</p>`
      : '';

    reprLetter = `
  <div class="doc-page">
<div>
<div style="margin-bottom:6px;">
  <p style="font-size:9.5pt;font-weight:700;margin:0;line-height:1.3;">INF181 Group Project</p>
  <p style="font-size:9pt;margin:0;line-height:1.3;">PO Box 123<br>Dummyville<br>0001</p>
</div>
<div style="height:36px;"></div>
<p style="font-size:9pt;margin:0 0 4px;">Dear Sir</p>
<p style="font-size:9pt;margin:0;"><strong>${coUpper}</strong></p>
${reg ? `<p style="font-size:9pt;margin:0;"><strong>${regIsId ? `Identity number: (${hlReg})` : `(Registration Number ${hlReg})`}</strong></p>` : ''}
<p style="font-size:9pt;margin-top:6px;">In connection with your examination of the financial statements for the year ended on ${yearEnd ? yearEnd.toUpperCase() : '[YEAR END]'} we confirm to the best of our knowledge and belief that:</p>
</div>
<ol style="font-size:9pt;line-height:1.4;padding-left:22px;margin-top:6px;">
  <li>The financial statements fairly present the financial position and results of operations in conformity with International Financial Reporting Standards for Small and Medium-sized Entities.</li>
  <li>All minutes of the meetings of ${reprSignatories} and committees (or summaries of actions of recent meetings for which minutes have not yet been prepared) and all financial and accounting records and related data have been made available to you.</li>
  <li>We are not aware of any material accounts, transactions or agreement which are not fairly described and properly recorded in the accounting records, which could have any material effect on the financial statements.</li>
  <li>We are not aware of:
    <ul style="margin-top:2px;">
      <li>any irregularities involving management or employees who have significant roles in the system of internal accounting control or any irregularities involving other employees which could have a material effect on the financial statements; or</li>
      <li>any violations or possible violations of laws or regulations whose effect should be considered for disclosure in the financial statements or as a basis for recording a contingent loss.</li>
    </ul>
  </li>
  <li>Adequate provision not considered to be excessive, has been made for:
    <ul style="margin-top:2px;">
      <li>All known material liabilities, other than contingent liabilities in respect of which no actual liability is expected to arise, which existed at the balance sheet date;</li>
      <li>all material losses expected to arise from events which had occurred by the statement of financial position date.</li>
    </ul>
  </li>
  <li>At the statement of financial position date, except as provided for or as noted in the financial statements, there were no material contingent liabilities.</li>
  <li>Except as indicated in the financial statements:
    <ul style="margin-top:2px;">
      <li>none of the liabilities was secured, otherwise than by the operation of law, on any assets of ${reprAssets}</li>
      <li>the assets reflected in the statement of financial position were owned by ${reprAssets} at the statement of financial position date, free of any charges in favour of third parties.</li>
    </ul>
  </li>
  <li>At the statement of financial position date: there were no commitments under contracts placed for capital expenditure or capital expenditure authorised by ${reprSignatories} which had not been contracted for which were not disclosed in the financial statements.</li>
  <li>The method by which management proposes to finance commitments for any capital expenditure either contracted for or authorised is adequately disclosed in the financial statements.</li>
  <li>The net book amounts at which the premises, plant and equipment are stated in the statement of financial position were arrived at after:
    <ul style="margin-top:2px;">
      <li>taking into account as additions all expenditure during the year which represented capital outlay on these assets but no expenditure of a revenue nature;</li>
      <li>writing off all amounts relating to items which had been sold or scrapped by the statement of financial position date;</li>
      <li>providing for depreciation on a scale sufficient to cover obsolescence as well as wear and tear and thus to reduce the net book amounts of the assets to their residual value by the time they become no longer economically useful to ${reprAssets}.</li>
    </ul>
  </li>
</ol>
  </div>
  <div class="doc-page">
<ol start="11" style="font-size:9pt;line-height:1.4;padding-left:22px;margin-top:6px;">
  <li>Any decline in the value of long-term investments not provided for is considered to be of a temporary nature.</li>
  <li>Current assets shown in the balance sheet are all expected to produce at least the amounts at which they are stated on realisation in the ordinary course of the business.</li>
  <li>Except as disclosed in the financial statements, the results of operations for the year were not materially affected by transactions of an extraordinary or abnormal nature, or items relative to a prior year.</li>
  <li>Material commitments for future purchases are for quantities not in excess of anticipated requirements, and are at prices which should not result in loss. Material losses are not expected to be sustained in the fulfilment of, or the inability to fulfil, any sales commitments.</li>
  ${reprShares}
  <li>The ${reprEntityLabel} has complied with all aspects of contractual agreements that could have a material effect on the financial statements in the event of non-compliance, except as disclosed in the financial statements.</li>
  <li>Known events subsequent to the statement of financial position date have been accounted for or appropriately disclosed in so far as they materially affect fair presentation in the financial statements.</li>
  <li>Stocks is valued at the lower of cost or net realisable value and represent the total value of all stock on hand at year end.</li>
  <li>The amount shown as trade debtors reflect the total debts owed to ${reprAssets} as per the books of account, after writing off bad debts. To the best of our knowledge all debtors at year end have been taken into account, as well as all other accounts receivable.</li>
  <li>All trade creditors and other liabilities have been brought to account and the figure shown in the statement of financial position represents to the best of our knowledge the total amount due for trade and other creditors.</li>
</ol>
<p class="letter-close"><strong>Yours Faithfully</strong></p>
<br>
<!-- This letter's body text runs at 9pt (see the <ol>/<p> rules above), so the
     signature group carries that size too — .sig-name / .sig-date inherit it. -->
<div class="sig-group" style="font-size:9pt;">
  <div class="signature-block">
    ${sigBlock(sigDirs)}
  </div>
  <div class="sig-date">${dateApprovedSig}</div>
</div>
  </div>`;
  }

  // ── LOAN CERTIFICATE PAGES (Company, CC, Trust) ──
  // Built inline so caLetterhead() (a nested fn) is in scope
  let loanCertPages = '';
  if (entityType === 'company' || entityType === 'cc' || entityType === 'trust') {
    const certs = getLoanCerts();
    loanCertPages = certs.map(cert => {
      const lcRawName = (cert.name || '[BORROWER / LENDER]')
        .replace(/\(\s*pty\s*\)\s*ltd\.?/gi, '(Pty) Ltd');
      const lcName = hl(lcRawName);
      const lcAmtFmt = hl(cert.amount ? formatNumber(cert.amount) : '[AMOUNT]');
      const lcDebitAmt = cert.balance === 'debit' ? lcAmtFmt : '';
      const lcCreditAmt = cert.balance === 'credit' ? lcAmtFmt : '';
      const lcSigned = cert.date
        ? `<p style="margin-top:36px;font-size:10pt;">SIGNED AT ${hl(cert.date)}.</p>`
        : `<p style="margin-top:36px;font-size:10pt;">SIGNED AT <span style="display:inline-block;min-width:200px;border-bottom:1px solid #333;">&nbsp;</span> ON <span style="display:inline-block;min-width:40px;border-bottom:1px solid #333;">&nbsp;</span> DAY OF <span style="display:inline-block;min-width:120px;border-bottom:1px solid #333;">&nbsp;</span> ${new Date().getFullYear()}.</p>`;
      return `
  <div class="doc-page">
<div style="text-align:center;margin:28px 0 32px;">
  <h2 style="font-size:13pt;letter-spacing:0.08em;text-transform:uppercase;margin:0 0 20px;">LOAN CERTIFICATE</h2>
  <p style="font-size:11pt;font-weight:700;margin:0 0 8px;">${coUpper}</p>
  <p style="font-size:10.5pt;margin:0 0 8px;">LOAN AS AT ${yearEnd ? yearEnd.toUpperCase() : '[YEAR END]'}</p>
  <p style="font-size:10.5pt;margin:0 0 28px;">LOAN ACCOUNT HOLDER:&nbsp;&nbsp;<strong>${lcName}</strong></p>
</div>
<table style="width:100%;border-collapse:collapse;font-family:'Poppins',sans-serif;font-size:10pt;margin-bottom:36px;">
  <thead>
    <tr>
      <td style="width:60%;padding:4px 0;"></td>
      <td style="width:20%;text-align:right;font-weight:700;padding:4px 8px;border-bottom:1.5px solid #333;">DEBIT</td>
      <td style="width:20%;text-align:right;font-weight:700;padding:4px 8px;border-bottom:1.5px solid #333;">CREDIT</td>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding:8px 0 4px;vertical-align:top;">Loan account balance at end of year</td>
      <td style="text-align:right;padding:8px 8px 4px;vertical-align:top;">${lcDebitAmt}</td>
      <td style="text-align:right;padding:8px 8px 4px;vertical-align:top;">${lcCreditAmt}</td>
    </tr>
    <tr><td colspan="3" style="border-top:1px solid #ccc;padding-top:2px;"></td></tr>
  </tbody>
</table>
<div style="height:36px;"></div>
<div style="font-size:10pt;line-height:1.7;margin-bottom:16px;">
  <p>I, the undersigned, hereby certify that I have scrutinised the entries in my loan account in the records of the entity and that I agree with the balance as set out above. The loan is unsecured.</p>
</div>
${lcSigned}
<br><br>
<div>
  <div style="border-bottom:1px solid #333;width:280px;margin-bottom:6px;">&nbsp;</div>
  <p style="font-size:10pt;font-weight:700;margin:0;">LENDER/(BORROWER)</p>
</div>
  </div>`;
    }).join('');
  }

  // ── TRUST RESOLUTION PAGE (Trust only) ──
  let pageTrustResolution = '';
  if (entityType === 'trust' && getRadio('trustResolutionLetter') === 'yes') {
    const resDate = hl(getVal('trustResolutionDate') || '[DATE]');
    const resVenue = getVal('trustAGMVenue') || '[VENUE]';
    // Attendance and the representative designation cover the signing trustees
    // only — an independent trustee neither attends nor represents the trust.
    const resDirs = sigDirs;
    const attendeeList = resDirs.map(d => d.full).join(', ') || '[TRUSTEE NAMES]';

    // Item 3 names one representative, picked in Step 6 (#trustResolutionRep,
    // by name). With a single signing trustee there is nothing to pick. With
    // several and none picked the placeholder stays, so the page shows red
    // until the user chooses; "__all__" names every signing trustee.
    const repPick = getVal('trustResolutionRep');
    const repDirs = resDirs.length === 1 ? resDirs
      : repPick === '__all__' ? resDirs
      : resDirs.filter(d => d.full === repPick).slice(0, 1);

    const trusteeDesignation = repDirs.length > 0
      ? repDirs.map(d => {
          const idDisplay = d.idNo ? `(ID: ${hl(formatIdString(d.idNo))})` : '(ID: [ID NUMBER])';
          return `${hl(d.full)} ${idDisplay} (trustee of the above mentioned trust)`;
        }).join('; and ') + (repDirs.length === 1 ? ' is' : ' are') + ' designated as representative' + (repDirs.length === 1 ? '' : 's') + ' of the trust to represent related parties as director' + (repDirs.length === 1 ? '' : 's')
      : '[TRUSTEE NAME] (ID: [ID NUMBER]) (trustee of the above mentioned trust) is designated as representative of the trust to represent related parties as director';

    // Items 6 and 7 hold only while the trust is not registered for tax. A
    // trust marked registered (Step 6, Tax Registration) drops both; an
    // unanswered question keeps them, as before.
    const taxItems = getRadio('trustTax') === 'registered' ? '' : `
  <li>Currently not registered for tax; (as the trust is not trading)</li>
  <li>To register for tax as soon as any benefit from the investment arises and whether other activities would take place in the trust.</li>`;

    pageTrustResolution = `
  <div class="doc-page">
<div style="text-align:center;margin:28px 0 18px;">
  <h2 style="font-size:13pt;letter-spacing:0.04em;margin:0 0 16px;">${coUpper} – ${hlReg}</h2>
  <p style="font-size:11pt;font-weight:700;margin:0 0 28px;">RESOLUTION OF A TRUSTEES MEETING HELD AT ${resVenue.toUpperCase()} ON ${resDate.toUpperCase()}</p>
</div>
<p><strong>ATTENDED:</strong>&nbsp;&nbsp;&nbsp;${attendeeList}</p>
<br>
<br>
<p>We acknowledge herewith that the trust received a donation from the settlor and opened a bank account therewith.</p>
<p>As a cost saving measure and to avoid administrative costs (preparing financial statements, submitting of income tax returns etc.) the following decisions were taken:</p>
<ol style="margin-top:8px;padding-left:24px;">
  <li>To close the bank account of the trust;</li>
  <li>To use the funds for investment purposes;</li>
  <li>${trusteeDesignation};</li>
  <li>That the trust restricts its investments currently to its shares held in related companies</li>
  <li>To only schedule meetings if there would occur any change in the activity of the trust;</li>
${taxItems}
</ol>
<div class="signature-block">
  ${sigBlock(sigDirs)}
</div>
<p>${resDate}</p>
  </div>`;
  }

  // ── INDEX PAGE ──
  const indexCfg = typeof getIndexConfig === 'function' ? getIndexConfig(entityType, reportType) : null;
  let indexPage = '';
  if (indexCfg) {
    // A statement the "entity did not trade" policy says was never drawn up
    // must not be listed in the index either. The policy's variant selector
    // decides which: 0 = both, 1 = profit or loss only, 2 = cash flows only.
    const noStatementsIds = new Set();
    const noStatementsCb = document.getElementById('pol_no_statements');
    if (noStatementsCb && noStatementsCb.checked) {
      const variant = policyVariantIndex('pol_no_statements');
      // The profit-or-loss line is named differently per entity type.
      if (variant === 0 || variant === 1) {
        ['profitOrLoss', 'surplusOrDeficit', 'financialPerformance'].forEach(id => noStatementsIds.add(id));
      }
      if (variant === 0 || variant === 2) noStatementsIds.add('cashFlows');
    }

    const indexRows = indexCfg.filter(item => !noStatementsIds.has(item.id)).map(item => {
      let val = hl(getVal(`idx-${item.id}`) || '');
      // Notes run to the end of the statements: show "8 - 12" using the
      // "financial statements end on page" field.
      if (item.id === 'notes' && val) val += ` - ${hlPageEnd}`;
      const labelEl = document.getElementById(`idx-label-${item.id}`);
      const labelText = labelEl ? labelEl.value : item.label.replace(/\n/g, ' ');
      const labelHtml = hl(labelText).replace(/\n/g, '<br>');
      return `<tr><td class="idx-label">${labelHtml}</td><td class="idx-page">${val}</td></tr>`;
    }).join('');

    // Approval + signature block at the bottom of the index page.
    // Page range = Statement of Financial Position through the last notes page
    // (the existing pageStart/pageEnd fields).
    // Names sign in capitals, but a bracketed suffix keeps the user's casing:
    // "Test User (Jnr)" → "TEST USER (Jnr)".
    const idxUpper = (name) => formatInitials(name);
    // Name, then "(Deceased …)" for a deceased signatory, then any other caption.
    const idxSigLabel = (nameHtml, p, caption) => nameHtml
      + (p && p.deceased ? `<br><span class="idx-sig-sub">${deceasedCaption(p)}</span>` : '')
      + (caption ? `<br><span class="idx-sig-sub">${caption}</span>` : '');
    const idxSigRow = (nameHtml) => `<div class="idx-sig-row">
  <div class="idx-sig-name"><strong>${nameHtml}</strong></div>
  <div class="idx-sig-line"></div>
</div>`;

    let idxApprovalHeading = 'APPROVAL';
    let idxApprovalSentence = '';
    // The approval date sits on its own line beneath the sentence, so the
    // sentence never ends mid-line with a dangling date.
    let idxApprovalDate = '';
    let idxApprovalDateClass = '';
    let idxApprovalSigs = '';

    if (entityType === 'school') {
      // Two signatories make this sentence long enough to wrap, which left the
      // date alone on the line below it. The break goes before "and
      // Chairperson…" instead, so the second line carries the whole
      // co-signatory clause and the date with it.
      idxApprovalSentence = `The financial statements, as set out on pages ${hlPageStart} to ${hlPageEnd}, were approved and signed by the Principal`;
      idxApprovalDate = `and Chairperson of the SGB on ${dateApproved}.`;
      idxApprovalDateClass = ' index-approval-cont';
      idxApprovalSigs = idxSigRow('PRINCIPAL') + idxSigRow('CHAIRPERSON SGB');
    } else if (entityType === 'npo') {
      // Signed by office, not by name — see npoSigners.
      const offices = npoSigners.map(d => d.full.charAt(0) + d.full.slice(1).toLowerCase());
      // The date runs on in the sentence itself rather than on a line of its own.
      idxApprovalSentence = `The financial statements, as set out on pages ${hlPageStart} to ${hlPageEnd}, were approved and signed by the ${offices.join(' and the ')} on ${dateApproved}.`;
      idxApprovalSigs = npoSigners.map(d => idxSigRow(d.full)).join('');
    } else if (entityType === 'individual') {
      // Trading individual: heading reads APPROVED, names appear in the sentence.
      // The dateApproved field is hidden for individuals, so use dateSigned.
      idxApprovalHeading = 'APPROVED';
      // The set names itself in its own approval sentence — a page titled
      // "Statement of Assets and Liabilities" must not approve "the financial
      // statements".
      idxApprovalSentence = isAssetsLiab
        ? `The statement of assets and liabilities, as set out on pages ${hlPageStart} to ${hlPageEnd}, was approved and signed by ${co} on`
        : `The financial statements, as set out on pages ${hlPageStart} to ${hlPageEnd}, were approved and signed by ${co} on`;
      idxApprovalDate = `${dateSignedLong}.`;
      idxApprovalSigs = allIndivPeople.filter(p => p.name).map(p => idxSigRow(idxSigLabel(hl(idxUpper(p.name)), p))).join('');
    } else {
      // Company / CC / trust / NPO etc. — "the director(s)" / "the member(s)" / "the trustee(s)"
      idxApprovalSentence = `The financial statements, as set out on pages ${hlPageStart} to ${hlPageEnd}, were approved and signed by the ${pluralTerm.toLowerCase()} on`;
      idxApprovalDate = `${dateApproved}.`;
      // The independent trustee always gets its own captioned row below, so it
      // is left out of the ordinary rows even when it signs everything else.
      const idxDirs = entityType === 'trust' ? filteredDirs : sigDirs;
      const idxReps = boardReps(idxDirs);
      idxApprovalSigs = idxReps.length
        ? idxReps.map(d => idxSigRow(idxSigLabel(hl(idxUpper(d.full)), d, BOARD_REP_CAPTION))).join('')
        : idxDirs.map(d => idxSigRow(idxSigLabel(hl(idxUpper(d.full)), d))).join('');
      if (entityType === 'trust' && hasIndTrustee) {
        // Corporate independent trustee signs via its representative. Without a
        // business name there is nothing to sign "on behalf of", so the row is
        // labelled for what it is — otherwise this name reads as just another
        // trustee and auditors have to hand-write the label underneath it.
        const onBehalf = indDir.indType === 'business' && indDir.indBizName
          ? idxSigLabel(hl(idxUpper(indDir.full)), indDir, `(On behalf of ${hl(indDir.indBizName)})`)
          : idxSigLabel(hl(idxUpper(indDir.full)), indDir, '(Independent Trustee)');
        idxApprovalSigs += idxSigRow(onBehalf);
      }
    }
    if (!idxApprovalSigs) idxApprovalSigs = idxSigRow('&nbsp;');

    const indexApproval = `
<div class="index-approval">
  <p class="index-approval-heading">${idxApprovalHeading}</p>
  <p class="index-approval-text">${idxApprovalSentence}</p>
  ${idxApprovalDate ? `<p class="index-approval-text index-approval-date${idxApprovalDateClass}">${idxApprovalDate}</p>` : ''}
  <div class="idx-sig-group">
    ${idxApprovalSigs}
  </div>
</div>`;

    indexPage = `
  <div class="doc-page index-page">
<div class="cover-title-block">
  ${regLine}
  <div class="cover-year">${docTitle}</div>
  <div class="cover-subtitle">For the year ended ${yearEnd}</div>
</div>

<div class="index-section">
<h2 class="cover-section-heading index-heading-row">Index<span class="index-page-heading">Page</span></h2>
<table class="index-table">
  <tbody>
    ${indexRows}
  </tbody>
</table>
${indexApproval}
</div>
  </div>`;
  }

  // ── Section tagging ───────────────────────────────────────────────
  // Stamps every page of a chunk with the section it belongs to, so downstream
  // consumers can name it without re-deriving meaning from headings:
  //   • SectionNav scrolls the preview to the matching form section;
  //   • OrganiseManager labels pages in the order report and picks each one's
  //     default split (compliance docs vs financial statements).
  // Applied once, at assembly, because that is the only place where each chunk's
  // identity is still known — by the time the pages are one HTML string they are
  // indistinguishable.
  const tag = (html, section) => {
    if (!html) return '';
    return html.replace(/<div class="(doc-page|cover-page)/g,
      `<div data-doc-section="${section}" class="$1`);
  };

  let assembledPages = '';

  if (entityType === 'individual') {
    // A statement of assets and liabilities carries no accounting policies.
    assembledPages = tag(coverPage, 'cover') + tag(indexPage, 'index') + (isAssetsLiab ? '' : tag(policyPages, 'policies')) + tag(engagementLetterPages, 'engagement');
  } else if (entityType === 'attorneys') {
    assembledPages = tag(coverPage, 'cover') + tag(indexPage, 'index') + tag(pageAttorneysAudit, 'auditor-report') + tag(engagementLetterPages, 'engagement');
  } else if (entityType === 'trust') {
    assembledPages = tag(coverPage, 'cover') + tag(indexPage, 'index') + tag(page1, 'ca-declaration') + tag(page3, 'compiler-report') + tag(pageTrustMinutes, 'minutes') + tag(pageTrustResolution, 'resolution') + tag(policyPages, 'policies') + tag(loanCertPages, 'loan-certificate') + tag(engagementLetterPages, 'engagement') + tag(reprLetter, 'representation-letter');
  } else if (entityType === 'npo') {
    if (reportType === 'review') {
      assembledPages = tag(coverPage, 'cover') + tag(indexPage, 'index') + tag(pageReview, 'reviewer-report') + tag(policyPages, 'policies') + tag(engagementLetterPages, 'engagement') + tag(reprLetter, 'representation-letter');
    } else {
      assembledPages = tag(coverPage, 'cover') + tag(indexPage, 'index') + tag(pageAudit, 'auditor-report') + tag(policyPages, 'policies') + tag(engagementLetterPages, 'engagement') + tag(reprLetter, 'representation-letter');
    }
  } else if (entityType === 'school') {
    assembledPages = tag(coverPage, 'cover') + tag(indexPage, 'index') + tag(pageSchoolAudit, 'auditor-report') + tag(policyPages, 'policies') + tag(engagementLetterPages, 'engagement');
  } else if (entityType === 'church') {
    const includeChurchPolicies = getRadio('churchPolicies') !== 'no';
    assembledPages = tag(coverPage, 'cover') + tag(indexPage, 'index') + tag(pageAuditChurch, 'auditor-report') + (includeChurchPolicies ? tag(policyPages, 'policies') : '') + tag(engagementLetterPages, 'engagement') + tag(reprLetter, 'representation-letter');
  } else if (entityType === 'club') {
    assembledPages = tag(coverPage, 'cover') + tag(indexPage, 'index') + tag(pageAuditClub, 'auditor-report') + tag(policyPages, 'policies') + tag(engagementLetterPages, 'engagement') + tag(reprLetter, 'representation-letter');
  } else if (entityType === 'bc') {
    // Body Corporate: Cover + Trustees' Responsibilities (pg1) + Audit Report (pg2) + Trustees' Report (pg3) + Policies + (optional) AGM Minutes
    const pageBcAudit = pageAudit.replace(`<div class="page-number">${pg3}</div>`, `<div class="page-number">${pg2}</div>`);

    // ── AGM MINUTES PAGE ──
    let pageBcAGM = '';
    if (getRadio('bcAGM') === 'yes') {
      const agmVenue = getVal('bcAGMVenue') || '[VENUE]';
      const agmDate = hl(getVal('bcAGMDate') || '[DATE]');
      pageBcAGM = `
  <div class="doc-page">
${auditLetterhead()}
<div class="page-header">
  <div class="co-name">${coUpper}</div>
  ${reg ? `<div class="co-reg">(Sectional Title Scheme Number — ${hlReg})</div>` : ''}
</div>
<h2 style="margin-top:8px;">Minutes of the Annual General Meeting of Trustees of the Body Corporate</h2>
<p style="text-align:center;font-style:italic;">held at ${agmVenue} on ${agmDate}.</p>
<br>
<p class="underline-heading">Present</p>
<p>${dirList}</p>
<p class="underline-heading">Quorum and Notice</p>
<p>As the necessary quorum was present, the chairman declared the meeting properly constituted and the notice convening it was, with the consent of the trustees, taken as read.</p>
<p class="underline-heading">Minutes</p>
<p>The minutes of the previous annual general meeting were taken as read and signed by the chairman as a correct record of the proceedings.</p>
<p class="underline-heading">Adoption of Report and Financial Statements</p>
<p>It was resolved that the annual financial statements for the year ending ${yearEnd} and as now submitted for approval by the board of trustees, be hereby approved both as to contents and as to form.</p>
<p>It was resolved that the form and content of the report by the trustees, pursuant to the Sectional Titles Act 2011 and as now submitted for the approval of the board of trustees, be hereby approved and adopted for the said purpose.</p>
<p>It was resolved that any two of the trustees of the body corporate are hereby authorized to sign the aforesaid annual financial statements and trustees' report, and copies thereof, for and on behalf of the board.</p>
<p>It was then recorded that, to the best knowledge of the trustees, all assets and liabilities and contingent liabilities have been recorded in the financial statements. The trustees are of the opinion that none of the assets had (at date of the balance sheet and on realization in the ordinary course of the body corporate's business), a value less than the amounts at which they are stated in the balance sheet.</p>
<p>The chairman stated that he had nothing further to add to the report of the trustees for the year ending ${yearEnd} and moved that the trustees' report and financial statements for the year ending ${yearEnd} be and they are hereby approved and adopted, and that all matters and business undertaken and discharged by the trustees on behalf of the body corporate be and they are hereby confirmed. The chairman's motion was seconded, put to the meeting and carried unanimously.</p>
<p class="underline-heading">Auditor</p>
<p>The chairman stated that as no proposals were received regarding the appointment of auditors, the present auditors are hereby re-appointed for the ensuing year.</p>
<p class="underline-heading">Trustees</p>
<p>It was resolved that the present trustees of the body corporate be and they are hereby re-appointed for the ensuing year. The trustees' remuneration as set out in the financial statements is approved.</p>
<p>There being no further business, the meeting terminated.</p>
<p>We, the undersigned trustees, were present and confirm the minutes to be correctly set out the proceedings of the meeting.</p>
<div class="signature-block">
  ${sigBlock(sigDirs)}
</div>
<p>${agmDate}</p>
${auditFooter()}
  </div>`;
    }

    assembledPages = tag(coverPage, 'cover') + tag(indexPage, 'index') + tag(pageTrusteesResponsibilities, 'responsibilities') + tag(pageBcAudit, 'auditor-report') + tag(pageTrusteesReport, 'entity-report') + tag(policyPages, 'policies') + tag(pageBcAGM, 'agm-minutes') + tag(engagementLetterPages, 'engagement') + tag(reprLetter, 'representation-letter');
  } else {
    if (reportType === 'compilation') {
      assembledPages = tag(coverPage, 'cover') + tag(indexPage, 'index') + tag(page1, 'ca-declaration') + tag(page2, 'responsibilities') + tag(page3, 'compiler-report') + tag(page4, 'entity-report') + tag(policyPages, 'policies') + tag(engagementLetterPages, 'engagement') + tag(loanCertPages, 'loan-certificate') + tag(entityType === 'cc' ? ccMinutesPages : minutesPages, 'minutes') + tag(reprLetter, 'representation-letter');
    } else if (reportType === 'review') {
      assembledPages = tag(coverPage, 'cover') + tag(indexPage, 'index') + tag(page2, 'responsibilities') + tag(pageReview, 'reviewer-report') + tag(page4, 'entity-report') + tag(policyPages, 'policies') + tag(engagementLetterPages, 'engagement') + tag(loanCertPages, 'loan-certificate') + tag(entityType === 'cc' ? ccMinutesPages : minutesPages, 'minutes') + tag(reprLetter, 'representation-letter');
    } else {
      assembledPages = tag(coverPage, 'cover') + tag(indexPage, 'index') + tag(page2, 'responsibilities') + tag(pageAudit, 'auditor-report') + tag(page4, 'entity-report') + tag(policyPages, 'policies') + tag(engagementLetterPages, 'engagement') + tag(loanCertPages, 'loan-certificate') + tag(entityType === 'cc' ? ccMinutesPages : minutesPages, 'minutes') + tag(reprLetter, 'representation-letter');
    }
  }

  return assembledPages;

  }
}
