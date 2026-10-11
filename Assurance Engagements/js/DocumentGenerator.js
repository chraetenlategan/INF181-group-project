// DocumentGenerator.js — Builds the assurance-engagement pages.
// Depends on: config.js, templates.js, ../js/utils.js, AEEntityManager instance.
//
// Same engine principles as the main app's DocumentGenerator:
//   • generate() returns one HTML string of `.doc-page` boxes; nothing is
//     appended to the DOM here.
//   • Every page is a real A4 sheet — the geometry lives in ../css/styles.css
//     (`--pg-*`), never in this file, so preview and PDF cannot drift.
//   • Paragraph text comes from templates.js through _tpl(), which substitutes
//     the [PLACEHOLDERS]; the layout around it lives here.
//   • Values that came off the form are wrapped in `.hl-kw`, the same review
//     aid the main app uses.

class AEDocumentGenerator {
  constructor(entityManager) {
    this.em = entityManager;
  }

  generate() {
    const em = this.em;
    const entityType = em.currentEntityType || 'company';
    const terms = em.terms();
    const pluralTerm = terms.plural;
    const possessiveTerm = terms.plural === terms.singular ? `${terms.plural}'s` : `${terms.plural}'`;
    const possessiveTermLower = possessiveTerm.toLowerCase();

    const hl = (v) => `<span class="hl-kw">${v}</span>`;

    // ── Form values ──
    const coRaw = getVal('companyName') || '[COMPANY NAME]';
    const co = hl(coRaw);
    const tradingAsRaw = getVal('tradingAsName');
    const tradingAs = tradingAsRaw ? hl(tradingAsRaw) : '';
    // Where a sentence identifies the entity, the trading name travels with it —
    // the same rule as the main app's coProse.
    const coProse = tradingAsRaw ? `${co}, Trading as: ${tradingAs}` : co;
    const coUpper = hl(coRaw.toUpperCase());
    const postal = toProperCase(getVal('postalAddress')) || '[POSTAL ADDRESS]';
    // Registration number — only the management representation letter prints
    // it, and an individual's 13-digit number is an identity number. Empty, the
    // line is omitted rather than ruled, which is what the main app does.
    const regRaw = getVal('regNumber') || '';
    const regIsId = typeof isIdNumber === 'function' ? isIdNumber(regRaw) : false;

    const signatories = em.getSignatories();
    const sigCount = signatories.length;
    const isAre = sigCount === 1 ? 'is' : 'are';
    const hasHave = sigCount === 1 ? 'has' : 'have';

    // ── Dates ──
    // Both canonical formats from the main app: long prose ("10 July 2026") for
    // sentences, dotted ("2026.07.16") for signature lines. Either input format
    // parses, so how a field was typed never decides how it prints.
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
      'August', 'September', 'October', 'November', 'December'];
    const parseAny = (raw) => {
      if (!raw) return null;
      const dot = raw.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})$/);
      if (dot) return new Date(+dot[1], +dot[2] - 1, +dot[3]);
      const dmy = raw.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
      if (dmy) return new Date(+dmy[3], +dmy[2] - 1, +dmy[1]);
      const long = raw.match(/^(\d{1,2})\s+(\w+)\s+(\d{4})$/);
      if (long) {
        const mi = MONTHS.indexOf(long[2]);
        if (mi >= 0) return new Date(+long[3], mi, +long[1]);
      }
      const d = new Date(raw);
      return isNaN(d) ? null : d;
    };
    const fmtLong = (raw) => {
      const d = parseAny(raw);
      return d ? `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : raw;
    };
    const fmtSig = (raw) => {
      const d = parseAny(raw);
      return d ? `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}` : raw;
    };

    const yearEndRaw = getVal('yearEnd');
    const yearEndLong = yearEndRaw ? fmtLong(yearEndRaw) : '[YEAR END]';
    const yearEnd = hl(yearEndLong);

    // The engagement letter is dated ahead of the statements it relates to: the
    // main app dates it 14 days before the signature date, and so does this one.
    const rawDateSigned = getVal('dateSigned');
    const engDate = (() => {
      const d = parseAny(rawDateSigned);
      if (!d) return null;
      d.setDate(d.getDate() - AE_ENGAGEMENT_LEAD_DAYS);
      return d;
    })();
    const engDateSigned = engDate
      ? hl(fmtSig(`${engDate.getFullYear()}.${engDate.getMonth() + 1}.${engDate.getDate()}`))
      : hl('[DATE SIGNED]');
    // The representation letter is dated when the statements are signed, not 14
    // days earlier: it is the client's letter to the firm, given at approval.
    const sigDateDotted = rawDateSigned ? hl(fmtSig(rawDateSigned)) : hl('[DATE SIGNED]');
    const engDateLong = engDate
      ? hl(fmtLong(`${engDate.getFullYear()}.${engDate.getMonth() + 1}.${engDate.getDate()}`))
      : hl('[DATE]');

    // ── Address rendering ──
    // One `.addr-line` element holding every line, so the browser spaces them
    // from a single line-height. See the main app's addrGroup() for why this
    // must never become one element per line.
    const addrGroup = (...parts) => {
      const html = parts.flat()
        .map(l => (typeof l === 'string' ? { html: l } : l))
        .filter(l => l && l.html && String(l.html).trim())
        .map(l => (l.bold ? `<strong>${l.html}</strong>` : l.html))
        .join('<br>');
      return html
        ? `<div class="addr-line" style="margin:0;line-height:1.3;text-align:left;">${html}</div>`
        : '';
    };
    const addrLines = (value) => (value || '').split(',').map(s => s.trim()).filter(Boolean);
    const postalParts = addrLines(postal);

    // ── Letterheads ──
    const caLetterhead = () => `<img class="letterhead-img" src="${AE_CA_LETTERHEAD}" alt="INF181 Group Project">`;
    const auditLetterhead = () => `<img class="letterhead-img" src="${AE_AUDIT_LETTERHEAD}" alt="INF181 Audit">`;
    const caFooter = () => `<div class="letterhead-footer"><img class="letterhead-footer-img" src="${AE_CA_FOOTER}" alt="INF181 Footer"></div>`;
    const auditFooter = () => `<div class="letterhead-footer"><img class="letterhead-footer-img" src="${AE_AUDIT_FOOTER}" alt="INF181 Audit Footer"></div>`;

    // ── Template text ──
    const _tpl = (id, extraVars) => {
      const raw = aeTemplateText(id);
      if (!raw) return '';
      let text = raw
        .replace(/\[COMPANY\]/g, coProse)
        .replace(/\[TRADING_AS\]/g, tradingAs)
        .replace(/\[YEAR_END\]/g, yearEnd)
        .replace(/\[ROLE\]/g, pluralTerm.toLowerCase())
        .replace(/\[ROLE_POSSESSIVE\]/g, possessiveTermLower)
        .replace(/\[ROLE_POSSESSIVE_TITLE\]/g, possessiveTerm)
        .replace(/\[IS_ARE\]/g, isAre)
        .replace(/\[HAS_HAVE\]/g, hasHave)
        .replace(/\[ENTITY_TYPE\]/g, AE_ENTITY_LABELS[entityType] || 'company')
        .replace(/\[DATE\]/g, engDateLong);
      if (extraVars) {
        for (const k of Object.keys(extraVars)) {
          text = text.replace(new RegExp('\\[' + k + '\\]', 'g'), extraVars[k]);
        }
      }
      return text;
    };

    // Blank line separates paragraphs; a "• " line starts a bullet list.
    const _render = (text) => {
      if (!text) return '';
      let html = '';
      for (const para of text.split('\n\n')) {
        const lines = para.split('\n');
        if (lines.some(l => l.startsWith('• '))) {
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
    };
    const _tplHtml = (id, extraVars) => _render(_tpl(id, extraVars));
    // A long template split at a deliberate line rather than wherever the
    // paginator's overflow cut happens to land.
    const _tplHtmlLines = (id, start, end, extraVars) => {
      const text = _tpl(id, extraVars);
      if (!text) return '';
      return _render(text.split('\n').slice(start, end).join('\n').trim());
    };

    // ── Acceptance block ──
    // Anyone flagged as signing for the governing body takes the block over and
    // carries the caption; none flagged means everybody signs. No signatories
    // captured yet leaves two blank ruled lines to sign on.
    const BOARD_REP_CAPTION = aeBoardRepCaption(entityType);
    const reps = signatories.filter(s => s.signsForBoard);
    const engSigners = reps.length ? reps : signatories;
    const engSigLabels = engSigners.map(s => s.signsForBoard
      ? `${hl(s.full)}<br><span style="font-size:8.5pt;font-weight:400;">${BOARD_REP_CAPTION}</span>`
      : hl(s.full));
    const engSigBlock = engSigLabels.length
      ? `<div style="display:grid;grid-template-columns:${
        engSigLabels.length >= 3 ? '1fr 1fr 1fr' : engSigLabels.length > 1 ? '1fr 1fr' : 'max-content'
      };gap:64px 16px;margin-top:24px;">
    ${engSigLabels.map(n => `<div><div style="border-top:1px solid #333;padding-top:6px;min-width:220px;font-weight:bold;">${n}</div></div>`).join('')}
   </div>`
      : `<div style="display:grid;grid-template-columns:1fr 1fr;gap:64px 16px;margin-top:24px;">
    <div><div style="border-top:1px solid #333;padding-top:6px;font-weight:bold;">&nbsp;</div></div>
    <div><div style="border-top:1px solid #333;padding-top:6px;font-weight:bold;">&nbsp;</div></div>
   </div>`;

    // ── Practitioner accountable for the engagement ──
    // The letter names the individual practitioner under "…is:". The signer
    // dropdown's "Blank" option is for a letter going out before that is
    // decided: the same position carries a ruled line with nothing typed under
    // it, for the name to be written in by hand. It is the practitioner's line
    // only — the client's acceptance block below is unaffected.
    const practitionerLine = (val) => val === 'BLANK'
      ? `<div style="border-bottom:1px solid #333;height:20px;width:220px;"></div>`
      : `<p><strong>${hl(val || '[SIGNER]')}</strong></p>`;

    // An individual has no governing body to address — the letter is addressed
    // to them by name instead.
    const engAddressee = entityType === 'individual' ? co : terms.addressee;

    // ── REVIEW ENGAGEMENT LETTER (CA letterhead) — 3 pages ──
    const buildReviewEngagementLetter = () => {
      // No signer chosen yet prints the placeholder rather than a default
      // partner — a name nobody picked must never reach a letter.
      const practitioner = practitionerLine(getVal('engSignerReview'));
      return `
  <div class="doc-page" data-page-key="review-eng-1" style="line-height:var(--doc-lh-decl);">
${caLetterhead()}
${addrGroup(engAddressee, { html: co, bold: true }, postalParts)}
<br><br>
<p style="margin:8px 0 0;"><strong>ENGAGEMENT LETTER TO REVIEW FINANCIAL STATEMENTS</strong></p>
<br>
<p><em><strong>The objective and scope of the review and our responsibilities</strong></em></p>
<p>${_tpl('eng_review_scope_detail')}</p>
${_tplHtml('eng_review_higher_risk')}
${caFooter()}
  </div>
  <div class="doc-page" data-page-key="review-eng-2" style="line-height:var(--doc-lh-decl);">
<br>
<p><em><strong>Responsibilities of the ${pluralTerm.toLowerCase()}</strong></em></p>
<p>${_tpl('eng_review_responsibilities')}</p>
${_tplHtml('eng_review_conduct_basis')}
<br>
<p><em><strong>Reporting</strong></em></p>
${_tplHtml('eng_review_reporting')}
<br>
<p><em><strong>Reportable irregularities in terms of Regulation 29 of the Companies Regulations, 2011</strong></em></p>
${_tplHtml('eng_review_reportable')}
<br>
<p><em><strong>Disclosure of information and authority</strong></em></p>
${_tplHtml('eng_review_disclosure')}
<br>
<p><em><strong>Protection of Personal Information</strong></em></p>
<p>${_tpl('eng_review_popia')}</p>
<br>
<p><em><strong>Fees</strong></em></p>
<p>${_tpl('eng_review_fees')}</p>
  </div>
  <div class="doc-page" data-page-key="review-eng-3" style="line-height:var(--doc-lh-decl);">
<p><em><strong>Agreement of terms</strong></em></p>
<p>${_tpl('eng_review_agreement')} The individual practitioner responsible and accountable for the review engagement is:</p>
<br><br>
${practitioner}
<br><br><br>
<p>${_tpl('eng_review_signing')}</p>
<br>
<p>Yours faithfully</p>
<br><br><br>
<p><strong>INF181 GROUP PROJECT (SA)</strong></p>
<br>
<p>We, the undersigned, being duly authorized to sign for or on behalf of the entity, herewith accept the above terms of the engagement.</p>
<br><br><br><br>
${engSigBlock}
<p style="margin-top:18px;">${engDateSigned}</p>
  </div>`;
    };

    // ── AUDIT ENGAGEMENT LETTER (Audit letterhead) — 3 pages ──
    const buildAuditEngagementLetter = () => {
      const practitioner = practitionerLine(getVal('engSignerAudit'));
      return `
  <div class="doc-page" data-page-key="audit-eng-1" data-no-squeeze style="line-height:var(--doc-lh-eng);font-size:9.5pt;">
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
  <div class="doc-page" data-page-key="audit-eng-2" style="line-height:var(--doc-lh-eng);font-size:9.5pt;">
${_tplHtmlLines('eng_audit_conduct_basis', 3)}
<br><br>
<p><em><strong>Reporting</strong></em></p>
${_tplHtml('eng_audit_reporting')}
<br>
<p><em><strong>Reportable irregularities in terms of Regulation 29 of the Companies Regulations, 2011</strong></em></p>
<p>${_tpl('eng_audit_reportable')}</p>
${_tplHtml('eng_audit_reportable_detail')}
  </div>
  <div class="doc-page" data-page-key="audit-eng-3" style="line-height:var(--doc-lh-eng);font-size:9.5pt;">
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
${practitioner}
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
    };

    // ── INDEPENDENCE DECLARATIONS ──
    // An audit and a review declare independence in different words, so there
    // are two of these, not one. The wording is verbatim from the firm's Word
    // templates in `Templates/` — see this app's CLAUDE.md. Only the entity,
    // the year end and the engagement type come off the form; every field a
    // team member fills in by hand is left as a ruled blank or a ☐, because
    // this is a document each person signs for themselves.
    //
    // Pages are split at deliberate places rather than wherever the paginator's
    // overflow cut lands, so a table never breaks across a sheet mid-row. Every
    // page carries a `data-page-key`, or a pin re-matches onto the wrong sheet.

    // Both declarations are laid out to their Word original's own
    // measurements — paragraph spacing, heading spacing, cell padding, font
    // sizes, column shares and single line spacing, all converted out of
    // Word's twips and half-points. Those that a page's children cannot carry
    // inline (font-size, line-height, margins are stripped off them by
    // PagePaginator's squeeze-undo pass on every run) live in ../css/styles.css
    // under `.indep-decl`, which also records the conversions and the two
    // measurements that deliberately did not come across. What is left inline
    // here is the table chrome — padding, widths, borders, alignment — which
    // the paginator does not touch.

    const decRule = 'border:0.5pt solid #333;';                         // w:tblBorders single sz="4"
    const decTable = 'width:100%;border-collapse:collapse;table-layout:fixed;';
    // Cell padding is w:tcMar: top/bottom first, then left/right.
    const decCell = (tb, lr) => `${decRule}padding:${tb}pt ${lr}pt;vertical-align:top;`;
    const decHeadCell = (tb, lr) => `${decCell(tb, lr)}font-weight:700;background:#f2f2f2;vertical-align:middle;`;
    const blankRule = (w) => `<span style="display:inline-block;min-width:${w};border-bottom:1px solid #333;">&nbsp;</span>`;
    const decBullet = (text) =>
      `<div class="indep-bullet"><span class="indep-mark">•</span><span class="indep-text">${text}</span></div>`;
    // `lines` is 2 where the Word paragraph holds a w:br — a break inside an
    // otherwise empty paragraph is a second line, not a taller one.
    const decBlank = (cls, lines) =>
      `<p class="indep-blank${cls ? ' ' + cls : ''}">${Array(lines || 1).fill('&nbsp;').join('<br>')}</p>`;

    // A value the form carries, or the ruled blank the declaration has always
    // printed in its place. Nothing is invented: an empty field is a line for
    // somebody to write on, exactly as before these fields existed.
    const decField = (value, width) => (value ? hl(value) : blankRule(width));

    // ── AUDIT INDEPENDENCE DECLARATION (Audit letterhead) — 3 pages ──
    // One complete declaration per team member: `person` is that member's card
    // (or null for a blank copy) and `n` is their ordinal, which is what keeps
    // every copy's page keys — and so every pinned page's identity — distinct.
    const buildAuditIndependenceDeclaration = (person, n) => {
      // Numbered considerations, each answered Yes/No with details where Yes.
      const items = [
        'I (or my immediate/close family) hold a direct or indirect financial interest (shares, loans, options, etc.) in the client or an affiliate of the client.',
        'I have a close business relationship with the client, its directors, officers, or employees in a position to influence the subject matter of the engagement (e.g. joint venture, distribution arrangement).',
        'I, or an immediate/close family member, am employed by the client, or have been employed by the client in a position to exert direct and significant influence over the engagement, within the applicable cooling-off period.',
        'I, or an immediate/close family member, have served as a director or officer of the client.',
        'I have a personal or family relationship with a director, officer, or employee of the client who is in a position to influence the subject matter of the engagement.',
        'I, or the firm, have provided non-assurance/non-audit services to the client during the period that could create a self-review, advocacy, or management-participation threat.',
        'The total fees from this client (recurring and non-recurring) represent a significant proportion of the firm’s or my individual portfolio’s total fee income, giving rise to a self-interest or intimidation threat.',
        'Fees due from the client for previous professional services remain unpaid and overdue, giving rise to a self-interest threat.',
        'I have accepted gifts or hospitality from the client (beyond what is clearly trivial and inconsequential) during the period.',
        'I am aware of any actual, threatened, or pending litigation between the firm and the client.',
        'I have served in a key engagement role (e.g. engagement partner, EQCR) on this client for a period that raises a familiarity threat requiring rotation or other safeguards under the firm’s policies.',
        'I am otherwise aware of any other relationship, interest, or circumstance not listed above that a reasonable and informed third party would likely conclude compromises, or could be perceived to compromise, my independence or objectivity in respect of this engagement.'
      ];

      // Information grid — w:tblGrid 3000/7080 of 10080, w:tcMar 100/120.
      const infoTable = (rows) => `
<table class="indep-grid" style="${decTable}">
  ${rows.map(([k, v]) => `<tr>
    <td style="${decHeadCell(5, 6)}width:29.76%;">${k}</td>
    <td style="${decCell(5, 6)}">${v}</td>
  </tr>`).join('')}
</table>`;

      // Considerations table — w:tblGrid 620/6100/1400/1960 of 10080.
      const headRow = `<tr>
    <td style="${decHeadCell(5, 6)}width:6.15%;text-align:center;">#</td>
    <td style="${decHeadCell(5, 6)}width:60.52%;">Consideration</td>
    <td style="${decHeadCell(5, 6)}width:13.89%;text-align:center;">Yes / No</td>
    <td style="${decHeadCell(5, 6)}width:19.44%;">Details / safeguards applied (if Yes)</td>
  </tr>`;
      const itemRows = (from, to) => items.slice(from, to).map((t, i) => `<tr>
    <td style="${decCell(5, 6)}text-align:center;">${from + i + 1}</td>
    <td style="${decCell(5, 6)}">${t}</td>
    <td style="${decCell(5, 6)}"></td>
    <td style="${decCell(5, 6)}"></td>
  </tr>`).join('');
      const itemTable = (from, to) => `<table class="indep-items" style="${decTable}">${headRow}${itemRows(from, to)}</table>`;

      // Sign-off grid — w:tblGrid 5040/5040, and the only asymmetric w:tcMar
      // in either template: no inner margin on the outer edges.
      const sigCell = (left, right) =>
        `${decRule}padding:5pt ${right}pt 5pt ${left}pt;vertical-align:top;width:50%;`;

      // Two engagement-level facts the firm now records on the form rather than
      // by hand. They belong to the engagement, not to the individual signing
      // this copy, so filling them breaks none of the "never pre-fill a name
      // nobody typed" rule the rest of this declaration keeps. Left empty they
      // are the ruled blank they always were.
      const fileRefRaw = getVal('engFileRef');
      const fileRef = fileRefRaw ? hl(fileRefRaw) : blankRule('60%');
      const pieRaw = getVal('publicInterestEntity');
      const publicInterest = pieRaw ? hl(pieRaw) : blankRule('60%');

      // This copy's signatory and their reviewer. Dates print in the document's
      // long form however they were typed, the same rule every other date here
      // follows. No card, or an empty one, leaves every cell the ruled blank.
      const src = person || {};
      const p = {
        name: src.name || '',
        role: src.role || '',
        date: src.date ? fmtLong(src.date) : '',
        reviewerName: src.reviewerName || '',
        reviewerConclusion: src.reviewerConclusion || '',
        reviewerDate: src.reviewerDate ? fmtLong(src.reviewerDate) : ''
      };

      return `
  <div class="doc-page indep-decl indep-audit" data-page-key="audit-indep-${n}-1">
${auditLetterhead()}
<p class="indep-title" style="text-align:center;"><strong>ENGAGEMENT-SPECIFIC INDEPENDENCE AND OBJECTIVITY DECLARATION</strong></p>
${infoTable([
        ['Client name', coProse],
        ['Engagement type', 'Audit of annual financial statements'],
        ['Financial year end', yearEnd],
        ['Engagement / file reference', fileRef],
        ['Public interest entity (Y/N)', publicInterest]
      ])}
${decBlank()}
<p class="indep-h"><strong>Purpose</strong></p>
<p>This declaration is to be completed by every member of the engagement team (including the engagement partner, engagement quality control reviewer, managers, and other professional staff assigned to the engagement) before commencing work, and updated immediately if circumstances change during the engagement. It supplements, and does not replace, the firm’s annual independence confirmation and the firm’s independence monitoring and consultation procedures.</p>
<p class="indep-h"><strong>Basis of declaration</strong></p>
<p>I confirm that I have read and considered the independence and objectivity requirements applicable to this engagement, being:</p>
${decBullet('Part 4A (Independence for Audit and Review Engagements) of the IESBA International Code of Ethics for Professional Accountants (including International Independence Standards);')}
${decBullet('The IRBA Code of Professional Conduct for Registered Auditors, including any South African-specific amendments to Part 4A;')}
${decBullet('Sections 90–92 of the Companies Act 71 of 2008 (auditor independence and tenure requirements), where applicable; and')}
${decBullet('The firm’s independence policies and procedures issued under its system of quality management (ISQM 1).')}
${auditFooter()}
  </div>
  <div class="doc-page indep-decl indep-audit" data-page-key="audit-indep-${n}-2">
<p class="indep-h"><strong>Specific matters considered</strong></p>
<p>For each item below, I confirm my response by marking Yes or No. Where the answer is “Yes,” I have provided details below (or on a separate attached memo) of the relationship, interest, or circumstance identified, together with any threat evaluation and safeguards applied or recommended, for review and sign-off by the engagement partner / ethics partner before I commence or continue work on this engagement.</p>
${itemTable(0, 8)}
  </div>
  <div class="doc-page indep-decl indep-audit" data-page-key="audit-indep-${n}-3">
${itemTable(8, 12)}
${decBlank()}
<p class="indep-h"><strong>Ongoing obligation</strong></p>
<p>I undertake to report promptly to the engagement partner (or, where the engagement partner is the subject of the matter, to the ethics partner / risk management partner) any relationship, interest, or circumstance arising during the course of this engagement that could reasonably be thought to bear on my independence or objectivity, and to take no further action on the engagement pending its evaluation, where required.</p>
<p class="indep-h"><strong>Declaration</strong></p>
<p>I confirm, to the best of my knowledge and belief after due and careful enquiry, that other than as disclosed above:</p>
${decBullet(`I am independent of ${coProse} and its related entities, in fact and appearance, in accordance with the requirements identified above;`)}
${decBullet('I am not aware of any threat to my independence or objectivity that has not been appropriately evaluated and safeguarded; and')}
${decBullet('I am in compliance with the firm’s independence policies and procedures in respect of this engagement.')}
${decBlank('indep-blank-tight', 2)}
<table style="${decTable}">
  <tr>
    <td style="${sigCell(0, 10)}">
      <p>Name: ${decField(p.name, '55%')}</p>
      <p>Role on engagement (e.g. Engagement Partner, EQCR, Manager, Team Member): ${decField(p.role, '40%')}</p>
      <p>Signature: ${blankRule('55%')}</p>
      <p>Date: ${decField(p.date, '55%')}</p>
    </td>
    <td style="${sigCell(10, 0)}">
      <p>Reviewed by (Engagement Partner):</p>
      <p>Name: ${decField(p.reviewerName, '55%')}</p>
      <p>Conclusion on disclosed matters (if any): ${decField(p.reviewerConclusion, '40%')}</p>
      <p>Signature: ${blankRule('55%')}</p>
      <p>Date: ${decField(p.reviewerDate, '55%')}</p>
    </td>
  </tr>
</table>
<p class="indep-note">This declaration forms part of the engagement file and should be retained in accordance with the firm’s file retention policy.</p>
  </div>`;
    };

    // ── REVIEW INDEPENDENCE DECLARATION (CA letterhead) — 2 pages ──
    // One complete declaration per team member, the same way the audit one
    // repeats: `person` is that member's card (or null for a blank copy) and
    // `n` is their ordinal, which keeps every copy's page keys distinct.
    const buildReviewIndependenceDeclaration = (person, n) => {
      // Each statement is phrased as the independent position, ticked Yes or
      // No — the mirror image of the audit form's "Yes means a problem".
      const items = [
        'I (and my immediate family) do not hold any direct or indirect financial interest (e.g. shares, options, loans) in the client or its related entities.',
        'I have no loans to or from, or guarantees involving, the client, its directors, officers or controlling shareholders (other than normal banking arrangements on normal commercial terms).',
        'I have no close business relationship with the client, its directors, officers or controlling shareholders (e.g. joint ventures, distribution or franchise arrangements).',
        'I have no family or close personal relationship with a director, officer or employee of the client who is in a position to influence the preparation of the financial statements.',
        'I was not, within the period covered by the financial statements, an employee, director or officer of the client, and no immediate family member is currently employed by the client in a position to exert direct and significant influence over the financial statements.',
        'There are no contingent or success-based fee arrangements relating to this engagement, and there are no significant overdue fees owed by the client to the firm.',
        'I have not accepted gifts or hospitality from the client, its directors or officers, beyond what is trivial and inconsequential.',
        'My continuing association with this client (including the number of years served on the engagement) does not, in my view, create a familiarity threat that cannot be safeguarded.',
        'I am not aware of any non-review services provided to the client by the any review engagement team members that would create a self-review, advocacy or management-participation threat. Any services provided by the firm are done by separate departments and employees.',
        'I am not aware of any actual, threatened or pending litigation between the firm and the client.',
        'I am not aware of any other circumstance or relationship that might reasonably be thought to bear on my independence or objectivity in relation to this engagement.'
      ];

      // Information grid — w:tblGrid 3200/6300 of 9500, w:tcMar 80/120,
      // w:vAlign center.
      const infoTable = (rows) => `
<table class="indep-grid" style="${decTable}">
  ${rows.map(([k, v]) => `<tr>
    <td style="${decHeadCell(4, 6)}width:33.68%;">${k}</td>
    <td style="${decCell(4, 6)}vertical-align:middle;">${v}</td>
  </tr>`).join('')}
</table>`;

      // Statements table — w:tblGrid 600/6900/1000/1000 of 9500. The header
      // row's w:tcMar is 80 all round; the body rows' is 100 top and bottom.
      const headRow = `<tr>
    <td style="${decHeadCell(4, 4)}width:6.32%;text-align:center;">No.</td>
    <td style="${decHeadCell(4, 6)}width:72.63%;">Statement</td>
    <td style="${decHeadCell(4, 4)}width:10.53%;text-align:center;">Yes</td>
    <td style="${decHeadCell(4, 4)}width:10.53%;text-align:center;">No</td>
  </tr>`;
      const itemRows = (from, to) => items.slice(from, to).map((t, i) => `<tr>
    <td style="${decCell(5, 4)}text-align:center;">${from + i + 1}</td>
    <td style="${decCell(5, 6)}">${t}</td>
    <td class="indep-tick" style="${decCell(5, 4)}text-align:center;">☐</td>
    <td class="indep-tick" style="${decCell(5, 4)}text-align:center;">☐</td>
  </tr>`).join('');
      const itemTable = (from, to) => `<table class="indep-items" style="${decTable}">${headRow}${itemRows(from, to)}</table>`;

      // Signature grid — w:tblGrid 4750/4750, w:tcMar top 200 / bottom 40 and
      // no inner margin on the outer edge.
      // The signature cell is a ruled line to sign on with its caption under it,
      // and the typed name under that — the line stays free for the wet
      // signature the sheet is printed for. `.indep-sign-block` shrinks to its
      // widest child, so the rule is exactly as long as the caption beneath it
      // rather than running the width of the cell.
      // Nobody signs a date, so the date cell carries no rule at all: it is one
      // line, "Date: <date>", set level with the caption opposite.
      const sigTable = (leftCaption, leftName, rightCaption, rightDate) => {
        const signCell = (caption, underCaption) => `<td style="${decRule}padding:10pt 10pt 2pt 0;vertical-align:top;width:50%;">
      <div class="indep-sign-block">
      <p class="indep-sign-line">&nbsp;</p>
      <p class="indep-sign-cap">${caption}</p>${underCaption ? `
      <p class="indep-sign-name">${hl(underCaption)}</p>` : ''}
      </div>
    </td>`;
        const dateCell = (caption, date) => `<td style="${decRule}padding:10pt 10pt 2pt 0;vertical-align:top;width:50%;">
      <p class="indep-sign-date">${caption}: ${date ? hl(date) : ''}</p>
    </td>`;
        return `
<table style="${decTable}">
  <tr>
    ${signCell(leftCaption, leftName)}
    ${dateCell(rightCaption, rightDate)}
  </tr>
</table>`;
      };

      // This copy's team member and the two sign-offs at its foot. Dates print
      // in the document's long form however they were typed. No card, or an
      // empty one, leaves every cell the ruled blank it has always been.
      const src = person || {};
      const p = {
        name: src.name || '',
        role: src.role || '',
        date: src.date ? fmtLong(src.date) : '',
        details: src.details || '',
        signName: src.signName || '',
        signDate: src.signDate ? fmtLong(src.signDate) : '',
        partnerName: src.partnerName || '',
        partnerDate: src.partnerDate ? fmtLong(src.partnerDate) : ''
      };

      // The four ruled lines are there to be written on. Where the conclusion
      // has been typed it takes their place, line for line as it was typed.
      const decEscape = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const writingLines = p.details
        ? `<p class="indep-details">${hl(decEscape(p.details).replace(/\r?\n/g, '<br>'))}</p>`
        : [1, 2, 3, 4].map(() => '<div class="indep-rule"></div>').join('');

      return `
  <div class="doc-page indep-decl indep-review" data-page-key="review-indep-${n}-1">
${caLetterhead()}
<p class="indep-title" style="text-align:center;"><strong>INDEPENDENT REVIEW PROGRAMME</strong></p>
<p class="indep-subtitle" style="text-align:center;">Independence Declaration</p>
<p class="indep-lede">To be completed and signed by each member of the engagement team prior to commencing the engagement, and updated promptly if circumstances change.</p>
${infoTable([
        ['Entity', coProse],
        ['Year end', yearEnd],
        ['Engagement team member', decField(p.name, '60%')],
        ['Role on engagement', decField(p.role, '60%')],
        ['Signature', blankRule('60%')],
        ['Date', decField(p.date, '60%')]
      ])}
<p class="indep-h"><strong>Declaration</strong></p>
${itemTable(0, 5)}
${caFooter()}
  </div>
  <div class="doc-page indep-decl indep-review" data-page-key="review-indep-${n}-2">
${itemTable(5, 11)}
<p class="indep-h-plain"><strong>Details of any “Yes” answers and safeguards applied / conclusion reached:</strong></p>
${writingLines}
<p class="indep-lead-in">Based on the above, I confirm that, to the best of my knowledge and belief, I am independent of the client and am not aware of any threat to my objectivity in relation to this engagement that has not been appropriately safeguarded, disclosed above and resolved. I undertake to notify the engagement partner promptly should my circumstances change during the course of the engagement.</p>
${sigTable('Signature — Engagement Team Member', p.signName, 'Date', p.signDate)}
<p class="indep-h-partner"><strong>Engagement Partner Review</strong></p>
<p>I have reviewed the above declaration(s) for all engagement team members and confirm that any identified threats to independence have been appropriately evaluated and safeguarded, or that the relevant individual(s) have been excluded from the engagement team where safeguards were not sufficient.</p>
${sigTable('Signature — Engagement Partner', p.partnerName, 'Date', p.partnerDate)}
  </div>`;
    };

    // ── LOAN CERTIFICATES ──
    const buildLoanCerts = () => em.getLoanCerts().map((cert, ci) => {
      const lcName = hl((cert.name || '[BORROWER / LENDER]').replace(/\(\s*pty\s*\)\s*ltd\.?/gi, '(Pty) Ltd'));
      const lcAmtFmt = hl(cert.amount ? formatNumber(cert.amount) : '[AMOUNT]');
      const lcDebitAmt = cert.balance === 'debit' ? lcAmtFmt : '';
      const lcCreditAmt = cert.balance === 'credit' ? lcAmtFmt : '';
      const lcSigned = cert.date
        ? `<p style="margin-top:36px;font-size:10pt;">SIGNED AT ${hl(cert.date)}.</p>`
        : `<p style="margin-top:36px;font-size:10pt;">SIGNED AT <span style="display:inline-block;min-width:200px;border-bottom:1px solid #333;">&nbsp;</span> ON <span style="display:inline-block;min-width:40px;border-bottom:1px solid #333;">&nbsp;</span> DAY OF <span style="display:inline-block;min-width:120px;border-bottom:1px solid #333;">&nbsp;</span> ${new Date().getFullYear()}.</p>`;
      return `
  <div class="doc-page" data-page-key="loan-cert-${ci + 1}" data-lc-idx="${cert.idx}">
<div style="text-align:center;margin:28px 0 32px;">
  <h2 style="font-size:13pt;letter-spacing:0.08em;text-transform:uppercase;margin:0 0 20px;">LOAN CERTIFICATE</h2>
  <p style="font-size:11pt;font-weight:700;margin:0 0 8px;">${coUpper}</p>
  <p style="font-size:10.5pt;margin:0 0 8px;">LOAN AS AT ${hl(yearEndLong.toUpperCase())}</p>
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

    // ── MANAGEMENT REPRESENTATION LETTER ──
    // The client's letter to the firm, confirming what the firm is entitled to
    // rely on. It is the same document for an audit and a review, so it is
    // built once and ticked on either engagement.
    //
    // The wording is the main app's `reprLetter` in `web/js/DocumentGenerator.js`
    // verbatim, including its per-entity terminology. If one changes, change the
    // other — the two apps must not send out different letters, the same rule
    // `templates.js` lives by.
    const buildRepresentationLetter = () => {
      const reprEntityLabel = AE_REPR_ENTITY_LABELS[entityType] || 'company';
      // "the members" / "the trustees": terms.plural already collapses to the
      // singular when only one person is captured.
      const reprSignatories = `the ${pluralTerm.toLowerCase()}`;
      const reprAssets = `the ${reprEntityLabel}`;
      // Share options and profit-sharing arrangements are a company's item only.
      const reprShares = (entityType === 'company')
        ? `<p>15. All material share or other options granted by the ${reprEntityLabel} and material bonus or other profit sharing arrangements, have been adequately disclosed or provided for.</p>`
        : '';

      // Whoever signs for the governing body takes the block over; nobody
      // captured leaves a single ruled line to sign on, the same fallback the
      // acceptance block uses.
      const reprSigners = reps.length ? reps : signatories;
      const reprSigBlock = reprSigners.length
        ? '<div class="sig-flow-wrap" style="display:flex;flex-wrap:wrap;gap:56px 48px;margin-top:16px;">'
          + reprSigners.map(s => `<div class="sig-entry" contenteditable="false" style="min-width:180px;margin-bottom:32px;">
    <div class="sig-space" style="min-height:130px;"></div>
    <div class="sig-line">&nbsp;</div>
    <div class="sig-name">${hl(s.full)}</div>${s.signsForBoard ? `
    <div class="sig-sub">${BOARD_REP_CAPTION}</div>` : ''}
  </div>`).join('')
          + '</div>'
        : `<div class="sig-entry" contenteditable="false"><div class="sig-space" style="min-height:130px;"></div><div class="sig-line">&nbsp;</div><div class="sig-name">&nbsp;</div></div>`;

      return `
  <div class="doc-page" data-page-key="repr-letter-1">
<div>
<div style="margin-bottom:6px;">
  <p style="font-size:9.5pt;font-weight:700;margin:0;line-height:1.3;">INF181 Group Project</p>
  <p style="font-size:9pt;margin:0;line-height:1.3;">PO Box 123<br>Dummyville<br>0001</p>
</div>
<div style="height:36px;"></div>
<p style="font-size:9pt;margin:0 0 4px;">Dear Sir</p>
<p style="font-size:9pt;margin:0;"><strong>${coUpper}</strong></p>
${regRaw ? `<p style="font-size:9pt;margin:0;"><strong>${regIsId ? `Identity number: (${hl(regRaw)})` : `(Registration Number ${hl(regRaw)})`}</strong></p>` : ''}
<p style="font-size:9pt;margin-top:6px;">In connection with your examination of the financial statements for the year ended on ${hl(yearEndLong.toUpperCase())} we confirm to the best of our knowledge and belief that:</p>
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
</ol>
  </div>
  <div class="doc-page" data-page-key="repr-letter-2">
<ol start="10" style="font-size:9pt;line-height:1.4;padding-left:22px;margin-top:6px;">
  <li>The net book amounts at which the premises, plant and equipment are stated in the statement of financial position were arrived at after:
    <ul style="margin-top:2px;">
      <li>taking into account as additions all expenditure during the year which represented capital outlay on these assets but no expenditure of a revenue nature;</li>
      <li>writing off all amounts relating to items which had been sold or scrapped by the statement of financial position date;</li>
      <li>providing for depreciation on a scale sufficient to cover obsolescence as well as wear and tear and thus to reduce the net book amounts of the assets to their residual value by the time they become no longer economically useful to ${reprAssets}.</li>
    </ul>
  </li>
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
    ${reprSigBlock}
  </div>
  <div class="sig-date">${sigDateDotted}</div>
</div>
  </div>`;
    };

    // ── Assemble ──
    // The engagement type decides which engagement letter and which
    // independence declaration are built; the loan certificates are the same
    // paperwork either way. Order follows the order on the form.
    const want = (id) => !!document.getElementById(id)?.checked;
    const engType = document.querySelector('input[name="engagementType"]:checked')?.value || '';
    let pages = '';
    if (want('docEngagementLetter')) {
      if (engType === 'audit') pages += buildAuditEngagementLetter();
      else if (engType === 'review') pages += buildReviewEngagementLetter();
    }
    if (want('docIndependence')) {
      // Each team member completes and signs their own copy of the audit
      // declaration, so it repeats once per person captured on the form. With
      // nobody captured one blank copy is produced — the declaration as it was
      // before the form carried these fields. The review declaration is
      // produced once, exactly as before.
      if (engType === 'audit') {
        const people = em.getIndepPersons();
        const copies = people.length ? people : [null];
        copies.forEach((person, i) => {
          pages += buildAuditIndependenceDeclaration(person, i + 1);
        });
      } else if (engType === 'review') {
        const people = em.getReviewIndepPersons();
        const copies = people.length ? people : [null];
        copies.forEach((person, i) => {
          pages += buildReviewIndependenceDeclaration(person, i + 1);
        });
      }
    }
    if (want('docLoanCerts')) pages += buildLoanCerts();
    // The representation letter comes last of all: it is the client's letter
    // back to the firm, and the pack reads better with it behind the firm's own
    // paperwork.
    if (want('docRepLetter')) pages += buildRepresentationLetter();
    return pages;
  }
}
