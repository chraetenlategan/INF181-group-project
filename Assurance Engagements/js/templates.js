// templates.js — Engagement-letter body text for the Assurance Engagements app.
//
// These are the SAME default paragraphs the main Policy Generator ships in
// AdminPanel.js (categories "Audit Engagement Letter" and "Review Engagement
// Letter"), copied here verbatim so this app stands on its own: it has no admin
// panel, no folders and no overrides — the text below is the text it prints.
//
// Placeholders ([COMPANY], [YEAR_END], [ROLE], …) are substituted by
// DocumentGenerator.js -> _tpl().
//
// If a paragraph is changed in the main app's Admin Panel defaults, change it
// here too — there is no shared store between the two engines.

const AE_TEMPLATES = [
    {
      id: 'eng_audit_scope',
      category: 'Audit Engagement Letter',
      label: 'Objective & scope of audit',
      defaultText: 'You have asked us to audit the financial statements of [COMPANY] for the year ended [YEAR_END]. The statements comprise the statement of financial position, statement of comprehensive income, statement of changes in equity, statement of cash flows and the accounting policies. This engagement does not relieve the [ROLE_POSSESSIVE] of their own responsibilities.'
    },
    {
      id: 'eng_audit_responsibilities',
      category: 'Audit Engagement Letter',
      label: 'Responsibilities of directors',
      defaultText: 'The [ROLE] are responsible for deciding whether an audit is appropriate for the [ENTITY_TYPE] and for meeting any related legal requirements.'
    },
    {
      id: 'eng_audit_disclosure',
      category: 'Audit Engagement Letter',
      label: 'Disclosure of information & authority',
      defaultText: 'You agree that we may share information with third parties where this is needed to carry out the services in this letter.\n\nSuch information will be limited to what is necessary for that purpose.'
    },
    {
      id: 'eng_audit_popia',
      category: 'Audit Engagement Letter',
      label: 'POPIA clause',
      defaultText: 'We handle personal information in line with the applicable privacy legislation. Information is used only for the services in this letter and is kept confidential and secure.'
    },
    {
      id: 'eng_audit_fees',
      category: 'Audit Engagement Letter',
      label: 'Fees',
      defaultText: 'Our fees are based on the time spent on the engagement and the staff involved. Invoices are issued as work progresses and are payable within 30 days.'
    },
    {
      id: 'eng_audit_agreement',
      category: 'Audit Engagement Letter',
      label: 'Agreement of terms',
      defaultText: 'We look forward to your full cooperation during the engagement. Please contact us at any time if you wish to discuss this letter. Once agreed, it remains in force for future years unless it is changed or cancelled.'
    },
    {
      id: 'eng_audit_reportable',
      category: 'Audit Engagement Letter',
      label: 'Reportable irregularities',
      defaultText: 'If we become aware of a reportable irregularity, we are required by law to report it to the relevant regulator.'
    },
    {
      id: 'eng_audit_conduct_basis',
      category: 'Audit Engagement Letter',
      label: 'Conduct basis & access requirements',
      defaultText: 'Our audit is carried out on the basis that you accept the following responsibilities:\n• Preparing and fairly presenting the financial statements in line with the applicable reporting framework;\n• Maintaining the internal control needed to prepare statements free from material misstatement; and\n• Giving us access to all records and information relevant to the engagement.\nWe may ask you for written confirmation of these responsibilities at the end of the audit.'
    },
    {
      id: 'eng_audit_reporting',
      category: 'Audit Engagement Letter',
      label: 'Reporting & expected opinion',
      defaultText: 'Our audit aims to express an opinion on the financial statements as a whole.\n\nWe will issue a written report to you for the year ended [YEAR_END].\n\nThe report will be addressed to the [ENTITY_TYPE] and may only be used for its stated purpose.'
    },
    {
      id: 'eng_audit_reportable_detail',
      category: 'Audit Engagement Letter',
      label: 'Reportable irregularities detail',
      defaultText: 'A reportable irregularity is an unlawful act or omission by a person responsible for management that causes material financial loss or is fraudulent.\n\nIf we identify one, we will notify the [ROLE] and the regulator as required by law.'
    },
    {
      id: 'eng_audit_signing',
      category: 'Audit Engagement Letter',
      label: 'Signing instruction',
      defaultText: 'Please sign and return a copy of this letter to confirm that you agree to its terms. This letter stays in force for future years unless it is changed or cancelled in writing.'
    },

    // ── Review Engagement Letter ──
    {
      id: 'eng_review_intro',
      category: 'Review Engagement Letter',
      label: 'Introduction paragraph',
      defaultText: 'Thank you for appointing us. This letter sets out the terms of our review engagement.'
    },
    {
      id: 'eng_review_scope',
      category: 'Review Engagement Letter',
      label: 'Scope of review',
      defaultText: 'We will review the annual financial statements of [COMPANY] for the year ended [YEAR_END], including the accounting policies and the [ROLE_POSSESSIVE] report.'
    },
    {
      id: 'eng_review_disclosure',
      category: 'Review Engagement Letter',
      label: 'Disclosure of information & authority',
      defaultText: 'You agree that we may share information with third parties where this is needed to carry out the services in this letter.\n\nSuch information will be limited to what is necessary for that purpose.'
    },
    {
      id: 'eng_review_popia',
      category: 'Review Engagement Letter',
      label: 'POPIA clause',
      defaultText: 'We handle personal information in line with the applicable privacy legislation. Information is used only for the services in this letter and is kept confidential and secure.'
    },
    {
      id: 'eng_review_fees',
      category: 'Review Engagement Letter',
      label: 'Fees',
      defaultText: 'Our fees are based on the time spent on the engagement and the staff involved. Invoices are issued as work progresses and are payable within 30 days.'
    },
    {
      id: 'eng_review_scope_detail',
      category: 'Review Engagement Letter',
      label: 'Scope & responsibilities detail',
      defaultText: 'You have asked us to review the financial statements of [COMPANY] for the year ended [YEAR_END]. The statements comprise the statement of financial position, statement of comprehensive income, statement of changes in equity, statement of cash flows and the accounting policies. This engagement does not relieve the [ROLE_POSSESSIVE] of their own responsibilities.'
    },
    {
      id: 'eng_review_higher_risk',
      category: 'Review Engagement Letter',
      label: 'Higher risk notice',
      defaultText: '• A review provides less assurance than an audit, so some misstatements may not be found.\n• Our report will state that an audit has not been performed and that we do not express an audit opinion.'
    },
    {
      id: 'eng_review_responsibilities',
      category: 'Review Engagement Letter',
      label: 'Responsibilities of directors',
      defaultText: 'The [ROLE] [IS_ARE] responsible for deciding whether a review is appropriate for the [ENTITY_TYPE] and for meeting any related legal requirements.'
    },
    {
      id: 'eng_review_conduct_basis',
      category: 'Review Engagement Letter',
      label: 'Conduct basis & access requirements',
      defaultText: 'Our review is carried out on the basis that you accept the following responsibilities:\n• Preparing and fairly presenting the financial statements in line with the applicable reporting framework;\n• Maintaining the internal control needed to prepare statements free from material misstatement; and\n• Giving us access to all records and information relevant to the engagement.'
    },
    {
      id: 'eng_review_reporting',
      category: 'Review Engagement Letter',
      label: 'Reporting & expected conclusion',
      defaultText: 'Our review aims to express a conclusion on the financial statements as a whole.\n\nWe will issue a written report to you for the year ended [YEAR_END].\n\nThe report will be addressed to the [ENTITY_TYPE] and may only be used for its stated purpose.'
    },
    {
      id: 'eng_review_reportable',
      category: 'Review Engagement Letter',
      label: 'Reportable irregularities',
      defaultText: 'If we become aware of a reportable irregularity, we are required by law to report it to the relevant regulator.\n\nThis duty applies to the [ENTITY_TYPE] even though the engagement is a review.'
    },
    {
      id: 'eng_review_agreement',
      category: 'Review Engagement Letter',
      label: 'Agreement of terms',
      defaultText: 'We look forward to your full cooperation during the engagement. Please contact us at any time if you wish to discuss this letter. Once agreed, it remains in force for future years unless it is changed or cancelled.'
    },
    {
      id: 'eng_review_signing',
      category: 'Review Engagement Letter',
      label: 'Signing instruction',
      defaultText: 'Please sign and return a copy of this letter to confirm that you agree to its terms. This letter stays in force for future years unless it is changed or cancelled in writing.'
    },
];

// Raw default text for a template id ('' when unknown, so a missing id prints
// nothing rather than throwing mid-page).
function aeTemplateText(id) {
  const t = AE_TEMPLATES.find(t => t.id === id);
  return t ? t.defaultText : '';
}
