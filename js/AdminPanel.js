// AdminPanel.js — Admin panel for editing document templates and
//                 managing the accounting-policy list (add / edit / delete).
// Depends on: config.js (accountingPolicies), EntityManager (rebuildPolicyChecklist)
// Opened from Settings → Administration → Admin Panel (password-gated).

const AdminPanel = (function () {
  const FOLDERS_KEY = 'inf181-admin-template-folders';
  const OLD_KEY = 'inf181-admin-templates';
  const POLICY_KEY = 'inf181-admin-policies';
  const PASSWORD = 'admin';
  const VAR_RE = /\[([A-Z][A-Z_]*)\]/g;

  // Template definitions — each has an id, label, category, and default text.
  // Default text is the exact paragraph used in DocumentGenerator.js.
  const TEMPLATES = [
    // ── Accounting Engagement Letter ──
    {
      id: 'eng_accounting_intro',
      category: 'Accounting Engagement Letter',
      label: 'Introduction paragraph',
      defaultText: 'Thank you for appointing us. This letter, dated [DATE], sets out the accounting services we will provide and the responsibilities of each party.'
    },
    {
      id: 'eng_accounting_duties',
      category: 'Accounting Engagement Letter',
      label: 'Accounting records & services',
      defaultText: 'The [ROLE] of [COMPANY] remain responsible for the entity\'s records, controls and decisions.'
    },
    {
      id: 'eng_accounting_services_detail',
      category: 'Accounting Engagement Letter',
      label: 'Services detail',
      defaultText: 'We will prepare the accounting records and the annual financial statements from the information you provide.'
    },
    {
      id: 'eng_accounting_basis',
      category: 'Accounting Engagement Letter',
      label: 'Basis of services',
      defaultText: 'Our services rely on the information supplied to us. We do not verify that information.'
    },
    {
      id: 'eng_accounting_poca',
      category: 'Accounting Engagement Letter',
      label: 'POCA / FICA notice',
      defaultText: 'The law may require us to report certain matters to the relevant authority. We will do so where required.'
    },
    {
      id: 'eng_accounting_deadlines',
      category: 'Accounting Engagement Letter',
      label: 'Deadlines',
      defaultText: 'Please send us your information on time so that we can meet the applicable filing deadlines.'
    },
    {
      id: 'eng_accounting_excluded',
      category: 'Accounting Engagement Letter',
      label: 'Excluded services',
      defaultText: 'Services not described in this letter are excluded.'
    },
    {
      id: 'eng_accounting_disclosure',
      category: 'Accounting Engagement Letter',
      label: 'Disclosure of information & authority',
      defaultText: 'You agree that we may share information with third parties where this is needed to carry out the services in this letter.\n\nSuch information will be limited to what is necessary for that purpose.'
    },
    {
      id: 'eng_accounting_popia',
      category: 'Accounting Engagement Letter',
      label: 'POPIA clause',
      defaultText: 'We handle personal information in line with the applicable privacy legislation. Information is used only for the services in this letter and is kept confidential and secure.'
    },
    {
      id: 'eng_accounting_liability',
      category: 'Accounting Engagement Letter',
      label: 'Liability & limitations',
      defaultText: 'We will provide these services with reasonable care.\n\nThe [ROLE] agree that we are not responsible for losses caused by incorrect or incomplete information.'
    },
    {
      id: 'eng_accounting_fees',
      category: 'Accounting Engagement Letter',
      label: 'Fees',
      defaultText: 'Our fees are based on the time spent on the engagement and the staff involved. Invoices are issued as work progresses and are payable within 30 days. The [ROLE] are responsible for paying our invoices.'
    },
    {
      id: 'eng_accounting_closing',
      category: 'Accounting Engagement Letter',
      label: 'Closing paragraph',
      defaultText: 'Please sign and return a copy of this letter to confirm that you agree to its terms. This letter stays in force for future years unless it is changed or cancelled in writing.'
    },

    // ── Audit Engagement Letter ──
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

    // ── NPO Accounting Engagement Letter ──
    // From the 2026 NPO "Appointment to provide services" template (7 Oct 2026).
    // The paragraphs not listed here (POCA, excluded services, disclosure,
    // closing) are shared with the company letter above.
    {
      id: 'eng_npo_accounting_intro',
      category: 'NPO Accounting Engagement Letter',
      label: 'Introduction paragraph',
      defaultText: 'Thank you for appointing us. This letter, dated [DATE], sets out the accounting services we will provide and the responsibilities of each party.'
    },
    {
      id: 'eng_npo_accounting_duties',
      category: 'NPO Accounting Engagement Letter',
      label: 'Accounting records & services',
      defaultText: 'The [NPO_BODY] of [COMPANY] remain responsible for the organisation\'s records, controls and decisions.'
    },
    {
      id: 'eng_npo_accounting_services_detail',
      category: 'NPO Accounting Engagement Letter',
      label: 'Services detail',
      defaultText: 'We will prepare the accounting records and the annual financial statements from the information you provide.'
    },
    {
      id: 'eng_npo_accounting_basis',
      category: 'NPO Accounting Engagement Letter',
      label: 'Basis of services',
      defaultText: 'Our services rely on the information supplied to us. We do not verify that information.'
    },
    {
      id: 'eng_npo_accounting_deadlines',
      category: 'NPO Accounting Engagement Letter',
      label: 'Deadlines',
      defaultText: 'Please send us your information on time so that we can meet the applicable filing deadlines.'
    },
    {
      id: 'eng_npo_accounting_liability',
      category: 'NPO Accounting Engagement Letter',
      label: 'Liability & limitations',
      defaultText: 'We will provide these services with reasonable care.\n\nThe [NPO_BODY] agree that we are not responsible for losses caused by incorrect or incomplete information.'
    },
    {
      id: 'eng_npo_accounting_popia',
      category: 'NPO Accounting Engagement Letter',
      label: 'POPIA clause',
      defaultText: 'We handle personal information in line with the applicable privacy legislation. Information is used only for the services in this letter and is kept confidential and secure.'
    },
    {
      id: 'eng_npo_accounting_fees',
      category: 'NPO Accounting Engagement Letter',
      label: 'Fees',
      defaultText: 'Our fees are based on the time spent on the engagement and the staff involved. Invoices are issued as work progresses and are payable within 30 days. The [NPO_BODY] are responsible for paying our invoices.'
    },

    // ── NPO Review Engagement Letter ──
    // From the 2026 NPO review engagement letter template (7 Oct 2026). An NPO
    // is not under the Companies Act: no public-interest-score paragraph and no
    // Regulation 29 reportable irregularities. Everything else is shared with
    // the review letter above.
    {
      id: 'eng_npo_review_scope_detail',
      category: 'NPO Review Engagement Letter',
      label: 'Scope & responsibilities detail',
      defaultText: 'You have asked us to review the financial statements of [COMPANY] for the year ended [YEAR_END], including the accounting policies and explanatory notes.'
    },
    {
      id: 'eng_npo_review_conduct_basis',
      category: 'NPO Review Engagement Letter',
      label: 'Conduct basis & access requirements',
      defaultText: 'Our review is carried out on the basis that you accept the following responsibilities:\n• Preparing and fairly presenting the financial statements in line with the applicable reporting framework;\n• Maintaining the internal control needed to prepare statements free from material misstatement; and\n• Giving us access to all records and information relevant to the engagement.'
    },
    {
      id: 'eng_npo_review_reporting',
      category: 'NPO Review Engagement Letter',
      label: 'Reporting & expected conclusion',
      defaultText: 'Our review aims to express a conclusion on the financial statements as a whole.\n\nOur report will be addressed to the [NPO_ORG] and may only be used for its stated purpose.'
    },

    // ── NPO Audit Engagement Letter ──
    // From the 2026 NPO audit engagement letter template (8 Oct 2026). Same
    // reasoning as the NPO review letter: the members/directors ([NPO_BODY]) are responsible, the
    // framework is the NPO Act, no public-interest-score paragraph and no
    // Regulation 29 section. Disclosure, POPIA, fees, agreement and signing
    // are shared with the audit letter above.
    {
      id: 'eng_npo_audit_scope',
      category: 'NPO Audit Engagement Letter',
      label: 'Objective & scope of audit',
      defaultText: 'You have asked us to audit the financial statements of [COMPANY] for the year ended [YEAR_END]. The statements comprise the statement of financial position, statement of comprehensive income, statement of changes in equity, statement of cash flows and the accounting policies. This engagement does not relieve the [NPO_ORG]\'s governing body of their own responsibilities.'
    },
    {
      id: 'eng_npo_audit_responsibilities',
      category: 'NPO Audit Engagement Letter',
      label: 'Responsibilities of the members/directors',
      defaultText: 'The [NPO_BODY] decide whether an audit is appropriate for the [NPO_ORG] and meet any related legal requirements.'
    },
    {
      id: 'eng_npo_audit_conduct_basis',
      category: 'NPO Audit Engagement Letter',
      label: 'Conduct basis & access requirements',
      defaultText: 'Our audit is carried out on the basis that you accept the following responsibilities:\n• Preparing and fairly presenting the financial statements in line with the applicable reporting framework;\n• Maintaining the internal control needed to prepare statements free from material misstatement; and\n• Giving us access to all records and information relevant to the engagement.\nWe may ask you for written confirmation of these responsibilities at the end of the audit.'
    },
    {
      id: 'eng_npo_audit_reporting',
      category: 'NPO Audit Engagement Letter',
      label: 'Reporting & expected opinion',
      defaultText: 'Our audit aims to express an opinion on the financial statements as a whole.\n\nWe will issue a written report to the [NPO_ORG] for the year ended [YEAR_END]. It may only be used for its stated purpose.'
    },

    // ── Compilation Report ──
    {
      id: 'report_compilation_intro',
      category: 'Compilation Report',
      label: 'Report on Financial Statements',
      defaultText: 'We have compiled the annual financial statements of [COMPANY] based on information the entity provided. These financial statements are presented in accordance with the financial framework described in the accounting policy in these financial statements.'
    },
    {
      id: 'report_compilation_responsibility',
      category: 'Compilation Report',
      label: 'Directors\' responsibility',
      defaultText: 'The [ENTITY_TYPE]\'s [ROLE] [IS_ARE] responsible for the preparation and fair presentation of these financial statements in accordance with International Financial Reporting Standards for Small and Medium-sized Entities and the requirements of the Companies Act of South Africa, and for such internal control as the [ROLE] determine necessary to enable the preparation of financial statements that are free from material misstatement, whether due to fraud or error.'
    },
    {
      id: 'report_compilation_compiler',
      category: 'Compilation Report',
      label: 'Compiler\'s responsibility',
      defaultText: 'We performed this compilation engagement in accordance with International Standard on Related Services 4410 (Revised), Compilation Engagements. This Standard requires that we comply with quality control standards and relevant ethical requirements, including ethical principles of integrity, objectivity, professional competence and due care.\n\nA compilation engagement involves applying expertise in accounting and financial reporting to assist management in preparing and presenting financial information. A compilation engagement does not involve gathering evidence for the purpose of expressing an opinion or a review conclusion. Accordingly, we do not express an audit opinion or a review conclusion on these financial statements.'
    },
    {
      id: 'report_compilation_trust_compiler',
      category: 'Compilation Report',
      label: 'Trust compiler\'s responsibility',
      defaultText: 'We performed this compilation agreement in accordance with International Standard on Related Services 4410 (Revised), Compilation Agreements. This Standard requires that we comply with quality control standards and relevant ethical requirements, including ethical principles of integrity, objectivity, professional competence and due care.\n\nA compilation engagement involves applying expertise in accounting and financial reporting to assist the trustees in preparing and presenting financial information. A compilation engagement does not involve gathering evidence for the purpose of expressing an opinion or a review conclusion. Accordingly, we do not express an audit opinion or a review conclusion on these financial statements as it is not an assurance engagement.'
    },

    // ── Independent Reviewer's Report ──
    {
      id: 'report_review_intro',
      category: 'Independent Reviewer\'s Report',
      label: 'Introduction paragraph',
      defaultText: 'We have reviewed the financial statements of [COMPANY] set out on pages [START] to [END], which comprise the statement of financial position as at [YEAR_END] and the statement of profit or loss and other comprehensive income, statement of changes in equity and statement of cash flows for the year then ended, and notes to the financial statements, including a summary of significant accounting policies.'
    },
    {
      id: 'report_review_responsibility',
      category: 'Independent Reviewer\'s Report',
      label: 'Directors\' responsibility',
      defaultText: 'The [ROLE] [IS_ARE] responsible for the preparation and fair representation of these financial statements in accordance with the IFRS for SMEs Accounting Standard as issued by the International Accounting Standards Board and the requirements of the Companies Act of South Africa, for determining that the basis of preparation is acceptable in the circumstances and for such internal control as the [ROLE] determine [IS_ARE] necessary to enable the preparation of financial statements that are free from material misstatements, whether due to fraud or error.'
    },
    {
      id: 'report_review_reviewer',
      category: 'Independent Reviewer\'s Report',
      label: 'Reviewer\'s responsibility',
      defaultText: 'Our responsibility is to express a conclusion on these financial statements. We conducted our review in accordance with the \'International Standard on Review Engagements (ISRE) 2400 (Revised), Engagements to Review Historical Financial Statements (ISRE 2400 (Revised)). ISRE 2400 (Revised)\' requires us to conclude whether anything has come to our attention that causes us to believe that the financial statements, taken as a whole, are not prepared in all material respects in accordance with the applicable financial reporting framework. This Standard also requires us to comply with relevant ethical requirements.'
    },
    {
      id: 'report_review_limited_assurance',
      category: 'Independent Reviewer\'s Report',
      label: 'Limited assurance explanation',
      defaultText: 'A review of financial statements in accordance with ISRE 2400 (Revised) is a limited assurance engagement. The independent reviewer performs procedures, primarily consisting of making inquiries of management and others within the entity, as appropriate, and applying analytical procedures, and evaluates the evidence obtained.\n\nThe procedures performed in a review are substantially less than those performed in an audit conducted in accordance with International Standards on Auditing. Accordingly, we do not express an audit opinion on these financial statements.'
    },
    {
      id: 'report_review_other_reports',
      category: 'Independent Reviewer\'s Report',
      label: 'Other reports required',
      defaultText: 'The annual financial statements include the [ROLE_POSSESSIVE_TITLE] Report as required by the Companies Act of South Africa. The [ROLE] [IS_ARE] responsible for [ROLE_POSSESSIVE_TITLE] Report. Our conclusion on the financial statements does not cover the [ROLE_POSSESSIVE_TITLE] Report and we do not express any form of assurance conclusion thereon.\n\nIn connection with our independent review of the financial statements, we have read the [ROLE_POSSESSIVE_TITLE] Report and, in doing so, considered whether the [ROLE_POSSESSIVE_TITLE] Report is materially inconsistent with the financial statements or our knowledge obtained in the independent review, or otherwise appears to be materially misstated. If, based on the work we have performed, we conclude that there is a material misstatement of the [ROLE_POSSESSIVE_TITLE] Report, we will report that fact. We have nothing to report in this regard.'
    },
    // NPO reviewer's report (2026 NPO template, 7 Oct 2026): statement of
    // surplus or deficit / changes in funds, the [NPO_BODY], the NPO Act. The
    // "Other Reports Required by the Companies Act" section is left out.
    {
      id: 'report_npo_review_intro',
      category: 'Independent Reviewer\'s Report',
      label: 'NPO – Introduction paragraph',
      defaultText: 'We have reviewed the financial statements of [COMPANY] set out on pages [START] to [END], which comprise the statement of financial position as at [YEAR_END] and the statement of surplus or deficit, statement of changes in funds and statement of cash flows for the year then ended, and notes to the financial statements, including a summary of significant accounting policies.'
    },
    {
      id: 'report_npo_review_responsibility',
      category: 'Independent Reviewer\'s Report',
      label: 'NPO – Members\'/Directors\' responsibility',
      defaultText: 'The [NPO_BODY] are responsible for the preparation and fair representation of these financial statements in accordance with the IFRS for SMEs Accounting Standard as issued by the International Accounting Standards Board and the requirements of the NPO Act of South Africa, for determining that the basis of preparation is acceptable in the circumstances and for such internal control as the [NPO_BODY] determine is necessary to enable the preparation of financial statements that are free from material misstatements, whether due to fraud or error.'
    },
    {
      id: 'report_review_ppra_independence',
      category: 'Independent Reviewer\'s Report',
      label: 'PPRA – independence (IRBA) paragraph, qualified only',
      defaultText: 'We conducted our review in accordance with \'International Audit Standards\' (\'ISA\'). Our responsibilities in terms of those standards are further described in the Reviewer\'s Responsibilities for the Review of the Financial Statements-Section of our report. We are independent of the [ENTITY_TYPE] in accordance with the Independent Regulatory Board for Auditors\' (IRBA)\' Code of Professional Conduct for Registered Auditors (IRBA Code)\' and other independence requirements applicable to reviews of financial statements in South Africa. We have fulfilled our other ethical responsibilities in accordance with the \'IRBA Code\' and in accordance with other ethical requirements applicable to reviews in South Africa. The \'IRBA Code\' is consistent with the \'International Ethics Standards Board for Accountants Code of Ethics for Professional Accountants (Parts A and B)\'. We believe that the review evidence we have obtained is sufficient and appropriate to provide a basis for our qualified opinion.'
    },
    {
      id: 'report_review_conclusion_unqualified',
      category: 'Independent Reviewer\'s Report',
      label: 'Unqualified conclusion',
      defaultText: 'Based on our review, nothing has come to our attention that causes us to believe that these financial statements do not present fairly, in all material respects, (or do not give a true and fair view of) the financial position of [COMPANY] as at [YEAR_END], and (of) its financial performance and cash flows for the year then ended, in accordance with the IFRS for SMEs Accounting Standard as issued by the International Accounting Standards Board and the requirements of the Companies Act of South Africa.'
    },

    // ── Independent Auditor's Report ──
    {
      id: 'report_audit_opinion',
      category: 'Independent Auditor\'s Report',
      label: 'Opinion paragraph (unqualified)',
      defaultText: 'In our opinion, the financial statements present fairly, in all material respects, the financial position of [COMPANY] as at [YEAR_END], and its financial performance and cash flows for the year then ended in accordance with the IFRS for SMEs Accounting Standard as issued by the International Accounting Standards Board and the requirements of the Companies Act of South Africa.'
    },
    {
      id: 'report_audit_basis',
      category: 'Independent Auditor\'s Report',
      label: 'Basis for opinion (ISA paragraph)',
      defaultText: 'We conducted our audit in accordance with \'International Standards on Auditing (ISAs)\'. Our responsibilities under those standards are further described in the \'Auditor\'s Responsibilities for the Audit of the Financial Statements\' section of our report. We are independent of the company in accordance with the \'Independent Regulatory Board for Auditors Code of Professional Conduct for Registered Auditors (IRBA Code)\' and other independence requirements applicable to performing audits of financial statements in South Africa. We have fulfilled our other ethical responsibilities in accordance with the \'IRBA Code\' and in accordance with other ethical requirements applicable to performing audits in South Africa. The \'IRBA Code\' is consistent with the corresponding sections of \'International Ethics Standards Board for Accountants Code of Ethics for Professional Accountants\' (Including International Independence Standards).\n\nWe believe that the audit evidence we have obtained is sufficient and appropriate to provide a basis for our opinion.'
    },
    {
      id: 'report_audit_responsibilities',
      category: 'Independent Auditor\'s Report',
      label: 'Directors\' responsibilities',
      defaultText: 'The [ROLE] [IS_ARE] responsible for the preparation and fair presentation of the financial statements in accordance with the IFRS for SMEs Accounting Standard as issued by the International Accounting Standards Board and the requirements of the Companies Act of South Africa, and for such internal control as the [ROLE] determine is necessary to enable the preparation of financial statements that are free from material misstatement, whether due to fraud or error.\n\nIn preparing the financial statements, the [ROLE] [IS_ARE] responsible for assessing the company\'s ability to continue as a going concern, disclosing, as applicable, matters related to going concern and using the going concern basis of accounting unless the [ROLE] either intend to liquidate the company or to cease operations, or have no realistic alternative but to do so.'
    },
    {
      id: 'report_audit_auditor_responsibilities',
      category: 'Independent Auditor\'s Report',
      label: 'Auditor\'s responsibilities',
      defaultText: 'Our objectives are to obtain reasonable assurance about whether the financial statements as a whole are free from material misstatement, whether due to fraud or error, and to issue an auditor\'s report that includes our opinion. Reasonable assurance is a high level of assurance, but is not a guarantee that an audit conducted in accordance with ISAs will always detect a material misstatement when it exists. Misstatements can arise from fraud or error and are considered material if, individually or in the aggregate, they could reasonably be expected to influence the economic decisions of users taken on the basis of these financial statements.'
    },
    {
      id: 'report_audit_auditor_also',
      category: 'Independent Auditor\'s Report',
      label: 'Auditor also (bullet list)',
      defaultText: 'As part of an audit in accordance with ISAs, we exercise professional judgement and maintain professional scepticism throughout the audit. We also:\n• Identify and assess the risks of material misstatement of the financial statements, whether due to fraud or error, design and perform audit procedures responsive to those risks, and obtain audit evidence that is sufficient and appropriate to provide a basis for our opinion. The risk of not detecting a material misstatement resulting from fraud is higher than for one resulting from error, as fraud may involve collusion, forgery, intentional omissions, misrepresentations, or the override of internal control.\n• Obtain an understanding of internal control relevant to the audit in order to design audit procedures that are appropriate in the circumstances, but not for the purpose of expressing an opinion on the effectiveness of the company\'s internal control.\n• Evaluate the appropriateness of accounting policies used and the reasonableness of accounting estimates and related disclosures made by the directors.\n• Conclude on the appropriateness of the directors\' use of the going concern basis of accounting and based on the audit evidence obtained, whether a material uncertainty exists related to events or conditions that may cast significant doubt on the company\'s ability to continue as a going concern. If we conclude that a material uncertainty exists, we are required to draw attention in our auditor\'s report to the related disclosures in the financial statements or, if such disclosures are inadequate, to modify our opinion. Our conclusions are based on the audit evidence obtained up to the date of our auditor\'s report. However, future events or conditions may cause the company to cease to continue as a going concern.\n• Evaluate the overall presentation, structure and content of the financial statements, including the disclosures, and whether the financial statements represent the underlying transactions and events in a manner that achieves fair presentation.\n\nWe communicate with the directors regarding, among other matters, the planned scope and timing of the audit and significant audit findings, including any significant deficiencies in internal control that we identify during our audit.'
    },
    {
      id: 'report_audit_other_info',
      category: 'Independent Auditor\'s Report',
      label: 'Other information',
      defaultText: 'The [ROLE] [IS_ARE] responsible for the other information. The other information comprises the information included in the document titled \'[COMPANY] Annual Financial Statements for the year ended [YEAR_END]\', which includes the [ROLE_POSSESSIVE_TITLE] Report as required by the Companies Act of South Africa. The other information does not include the financial statements and our auditor\'s report thereon.\n\nOur opinion on the financial statements does not cover the other information and we do not express an audit opinion or any form of assurance conclusion thereon.'
    },
    {
      id: 'report_audit_other_info_read',
      category: 'Independent Auditor\'s Report',
      label: 'Other information — read & consider',
      defaultText: 'In connection with our audit of the financial statements, our responsibility is to read the other information and, in doing so, consider whether the other information is materially inconsistent with the financial statements or our knowledge obtained in the audit, or otherwise appears to be materially misstated. If, based on the work we have performed, we conclude that there is a material misstatement of this other information; we are required to report that fact. We have nothing to report in this regard.'
    },
    // NPO auditor's report (2026 NPO audit template, 9 Oct 2026): statement of
    // surplus or deficit / changes in funds, the NPO Act, no Other Information
    // section. The entity is "the [NPO_ORG]" and the governing body [NPO_BODY],
    // both chosen in Step 4. The auditor's responsibilities paragraph is shared.
    {
      id: 'report_npo_audit_intro',
      category: 'Independent Auditor\'s Report',
      label: 'NPO – Audit scope paragraph',
      defaultText: 'We have audited the financial statements of [COMPANY] set out on pages [START] to [END], which comprise the statement of financial position as at [YEAR_END], and the statement of surplus or deficit, statement of changes in funds and statement of cash flows for the year then ended, and notes to the financial statements, including material accounting policy information.'
    },
    {
      id: 'report_npo_audit_basis',
      category: 'Independent Auditor\'s Report',
      label: 'NPO – Basis for opinion (ISA paragraph)',
      defaultText: 'We conducted our audit in accordance with \'International Standards on Auditing (ISAs)\'. Our responsibilities under those standards are further described in the \'Auditor\'s Responsibilities for the Audit of the Financial Statements\' section of our report. We are independent of the [NPO_ORG] in accordance with the \'Independent Regulatory Board for Auditors Code of Professional Conduct for Registered Auditors (IRBA Code)\' and other independence requirements applicable to performing audits of financial statements in South Africa. We have fulfilled our other ethical responsibilities in accordance with the \'IRBA Code\' and in accordance with other ethical requirements applicable to performing audits in South Africa. The \'IRBA Code\' is consistent with the corresponding sections of \'International Ethics Standards Board for Accountants Code of Ethics for Professional Accountants\' (Including International Standards).\n\nWe believe that the audit evidence we have obtained is sufficient and appropriate to provide a basis for our opinion.'
    },
    {
      id: 'report_npo_audit_responsibilities',
      category: 'Independent Auditor\'s Report',
      label: 'NPO – Members\'/Directors\' responsibilities',
      defaultText: 'The [NPO_BODY] are responsible for the preparation and fair presentation of the financial statements in accordance with the IFRS for SMEs Accounting Standard as issued by the International Accounting Standards Board and the requirements of the NPO Act of South Africa, and for such internal control as the [NPO_BODY] determine is necessary to enable the preparation of financial statements that are free from material misstatement, whether due to fraud or error.\n\nIn preparing the financial statements, the [NPO_BODY] are responsible for assessing the [NPO_ORG]\'s ability to continue as a going concern, disclosing, as applicable, matters related to going concern and using the going concern basis of accounting unless the [NPO_BODY] either intend to liquidate the [NPO_ORG] or to cease operations, or have no realistic alternative but to do so.'
    },
    {
      id: 'report_npo_audit_auditor_also',
      category: 'Independent Auditor\'s Report',
      label: 'NPO – Auditor also (bullet list)',
      defaultText: 'As part of an audit in accordance with ISAs, we exercise professional judgement and maintain professional scepticism throughout the audit. We also:\n• Identify and assess the risks of material misstatement of the financial statements, whether due to fraud or error, design and perform audit procedures responsive to those risks, and obtain audit evidence that is sufficient and appropriate to provide a basis for our opinion. The risk of not detecting a material misstatement resulting from fraud is higher than for one resulting from error, as fraud may involve collusion, forgery, intentional omissions, misrepresentations, or the override of internal control.\n• Obtain an understanding of internal control relevant to the audit in order to design audit procedures that are appropriate in the circumstances, but not for the purpose of expressing an opinion on the effectiveness of the [NPO_ORG]\'s internal control.\n• Evaluate the appropriateness of accounting policies used and the reasonableness of accounting estimates and related disclosures made by the [NPO_BODY].\n• Conclude on the appropriateness of the [NPO_BODY]\' use of the going concern basis of accounting and based on the audit evidence obtained, whether a material uncertainty exists related to events or conditions that may cast significant doubt on the [NPO_ORG]\'s ability to continue as a going concern. If we conclude that a material uncertainty exists, we are required to draw attention in our auditor\'s report to the related disclosures in the financial statements or, if such disclosures are inadequate, to modify our opinion. Our conclusions are based on the audit evidence obtained up to the date of our auditor\'s report. However, future events or conditions may cause the [NPO_ORG] to cease to continue as a going concern.\n• Evaluate the overall presentation, structure and content of the financial statements, including the disclosures, and whether the financial statements represent the underlying transactions and events in a manner that achieves fair presentation.\n\nWe communicate with the [NPO_BODY] regarding, among other matters, the planned scope and timing of the audit and significant audit findings, including any significant deficiencies in internal control that we identify during our audit.'
    },
    {
      id: 'report_audit_intro',
      category: 'Independent Auditor\'s Report',
      label: 'Audit scope paragraph',
      defaultText: 'We have audited the financial statements of [COMPANY] set out on pages [START] to [END], which comprise the statement of financial position as at [YEAR_END], and the statement of profit or loss and other comprehensive income, statement of changes in equity and statement of cash flows for the year then ended, and notes to the financial statements, including material accounting policy information.'
    },

    // ── Independent Auditor's Report (Parent Company) ──
    // Used when the company is a parent. Two mutually exclusive shapes: group
    // statements NOT produced (adverse opinion), or consolidated and separate
    // statements presented ("the group" wording throughout).
    {
      id: 'report_audit_adverse_group_basis',
      category: 'Independent Auditor\'s Report (Parent Company)',
      label: 'Basis for adverse opinion — no consolidation',
      defaultText: 'As explained in the [ROLE_POSSESSIVE] report to the financial statements, the company has not consolidated the financial statements of its only subsidiary, [SUBSIDIARY]. This investment is accounted for at cost. Under \'International Financial Reporting Standard IFRS 10\', Consolidated Financial Statements, the subsidiary should have been consolidated because it is controlled by the company. Had [SUBSIDIARY] been consolidated, many elements in the accompanying financial statements would have been materially affected and therefore the departure from the requirements of \'IFRS 10\' are considered to be pervasive. The effects on the consolidated financial statements of this departure have not been determined.'
    },
    {
      id: 'report_audit_adverse_group_other_info',
      category: 'Independent Auditor\'s Report (Parent Company)',
      label: 'Other information — misstated for the same reason',
      defaultText: 'As described in the Basis for Adverse Opinion section above, the company should have consolidated the financial statements of its subsidiary, [SUBSIDIARY]. We have concluded that the other information is materially misstated for the same reason with respect to the amounts or other items in the [ROLE_POSSESSIVE_TITLE] Report affected by the failure to consolidate [SUBSIDIARY].'
    },
    {
      id: 'report_audit_group_intro',
      category: 'Independent Auditor\'s Report (Parent Company)',
      label: 'Consolidated — audit scope paragraph',
      defaultText: 'We have audited the consolidated and separate financial statements of [COMPANY] (the group) set out on pages [START] to [END], which comprise the statements of financial position as at [YEAR_END], and the statements of profit or loss and other comprehensive income, the statements of changes in equity and the statements of cash flows for the year then ended, and notes to the financial statements, including material accounting policy information.'
    },
    {
      id: 'report_audit_group_basis',
      category: 'Independent Auditor\'s Report (Parent Company)',
      label: 'Consolidated — basis for opinion (ISA paragraph)',
      defaultText: 'We conducted our audit in accordance with \'International Standards on Auditing (ISAs)\'. Our responsibilities under those standards are further described in the Auditor\'s Responsibilities for the Audit of the Consolidated and Separate Financial Statements section of our report. We are independent of the group in accordance with the \'Independent Regulatory Board for Auditors Code of Professional Conduct for Registered Auditors (IRBA Code)\' and other independence requirements applicable to performing audits of financial statements in South Africa. We have fulfilled our other ethical responsibilities in accordance with the IRBA Code and in accordance with other ethical requirements applicable to performing audits in South Africa. The IRBA Code is consistent with the corresponding sections of the International Ethics Standards Board for Accountants Code of Ethics for Professional Accountants (Including International Independence Standards).\n\nWe believe that the audit evidence we have obtained is sufficient and appropriate to provide a basis for our opinion.'
    },
    {
      id: 'report_audit_group_other_info',
      category: 'Independent Auditor\'s Report (Parent Company)',
      label: 'Consolidated — other information',
      defaultText: 'The [ROLE] [IS_ARE] responsible for the other information. The other information comprises the [ROLE_POSSESSIVE_TITLE] Report, as required by the Companies Act of South Africa, which we obtained prior to the date of this report. Other information does not include the consolidated and separate financial statements and our auditor\'s report thereon.\n\nOur opinion on the consolidated and separate financial statements does not cover the other information and we do not express an audit opinion or any form of assurance conclusion thereon.'
    },
    {
      id: 'report_audit_group_other_info_read',
      category: 'Independent Auditor\'s Report (Parent Company)',
      label: 'Consolidated — other information read & consider',
      defaultText: 'In connection with our audit of the consolidated and separate financial statements, our responsibility is to read the other information and, in doing so, consider whether the other information is materially inconsistent with the consolidated and separate financial statements or our knowledge obtained in the audit, or otherwise appears to be materially misstated. If, based on the work we have performed on the other information obtained prior to the date of this auditor\'s report, we conclude that there is a material misstatement of this other information, we are required to report that fact. We have nothing to report in this regard.'
    },
    {
      id: 'report_audit_group_responsibilities',
      category: 'Independent Auditor\'s Report (Parent Company)',
      label: 'Consolidated — directors\' responsibilities',
      defaultText: 'The [ROLE] [IS_ARE] responsible for the preparation and fair presentation of the consolidated and separate financial statements in accordance with \'International Financial Reporting Standards and the requirements of the Companies Act of South Africa\', and for such internal control as the [ROLE] determine is necessary to enable the preparation of consolidated and separate financial statements that are free from material misstatement, whether due to fraud or error.\n\nIn preparing the consolidated and separate financial statements, the [ROLE] [IS_ARE] responsible for assessing the group\'s and the company\'s ability to continue as a going concern, disclosing, as applicable, matters related to going concern and using the going concern basis of accounting unless the [ROLE] either intend to liquidate the group and / or the company or to cease operations, or have no realistic alternative but to do so.'
    },
    {
      id: 'report_audit_group_auditor_responsibilities',
      category: 'Independent Auditor\'s Report (Parent Company)',
      label: 'Consolidated — auditor\'s responsibilities',
      defaultText: 'Our objectives are to obtain reasonable assurance about whether the consolidated and separate financial statements as a whole are free from material misstatement, whether due to fraud or error, and to issue an auditor\'s report that includes our opinion. Reasonable assurance is a high level of assurance, but is not a guarantee that an audit conducted in accordance with ISAs will always detect a material misstatement when it exists. Misstatements can arise from fraud or error and are considered material if, individually or in the aggregate, they could reasonably be expected to influence the economic decisions of users taken on the basis of these consolidated and separate financial statements.'
    },
    {
      id: 'report_audit_group_auditor_also',
      category: 'Independent Auditor\'s Report (Parent Company)',
      label: 'Consolidated — auditor also (bullet list)',
      defaultText: 'As part of an audit in accordance with ISAs, we exercise professional judgement and maintain professional scepticism throughout the audit. We also:\n• Identify and assess the risks of material misstatement of the consolidated and separate financial statements, whether due to fraud or error, design and perform audit procedures responsive to those risks, and obtain audit evidence that is sufficient and appropriate to provide a basis for our opinion. The risk of not detecting a material misstatement resulting from fraud is higher than for one resulting from error, as fraud may involve collusion, forgery, intentional omissions, misrepresentations, or the override of internal control.\n• Obtain an understanding of internal control relevant to the audit in order to design audit procedures that are appropriate in the circumstances, but not for the purpose of expressing an opinion on the effectiveness of the group\'s and the company\'s internal control.\n• Evaluate the appropriateness of accounting policies used and the reasonableness of accounting estimates and related disclosures made by the [ROLE].\n• Conclude on the appropriateness of the [ROLE_POSSESSIVE] use of the going concern basis of accounting and based on the audit evidence obtained, whether a material uncertainty exists related to events or conditions that may cast significant doubt on the group\'s and the company\'s ability to continue as a going concern. If we conclude that a material uncertainty exists, we are required to draw attention in our auditor\'s report to the related disclosures in the consolidated and separate financial statements or, if such disclosures are inadequate, to modify our opinion. Our conclusions are based on the audit evidence obtained up to the date of our auditor\'s report. However, future events or conditions may cause the group and / or the company to cease to continue as a going concern.\n• Evaluate the overall presentation, structure and content of the consolidated and separate financial statements, including the disclosures, and whether the consolidated and separate financial statements represent the underlying transactions and events in a manner that achieves fair presentation.\n• Obtain sufficient appropriate audit evidence regarding the financial information of the entities or business activities within the group to express an opinion on the consolidated financial statements. We are responsible for the direction, supervision and performance of the group audit. We remain solely responsible for our audit opinion.\n\nWe communicate with the [ROLE] regarding, among other matters, the planned scope and timing of the audit and significant audit findings, including any significant deficiencies in internal control that we identify during our audit.\n\nWe also provide the [ROLE] with a statement that we have complied with relevant ethical requirements regarding independence, and to communicate with them all relationships and other matters that may reasonably be thought to bear on our independence, and where applicable, related safeguards.'
    },

    // ── Management Representation Letter ──
    {
      id: 'letter_mgmt_rep_intro',
      category: 'Management Representation Letter',
      label: 'Opening paragraph',
      defaultText: 'In connection with the preparation and presentation of the annual financial statements of [COMPANY] for the year ended [YEAR_END], we confirm to the best of our knowledge and belief, having made such inquiries as we considered necessary for the purpose of appropriately informing ourselves:'
    },

    // ── School Audit Engagement Letter ──
    {
      id: 'eng_school_audit_intro',
      category: 'School Audit Engagement Letter',
      label: 'Introduction',
      defaultText: 'Thank you for appointing us. This letter sets out the terms of our audit engagement.'
    },
    {
      id: 'eng_school_audit_purpose',
      category: 'School Audit Engagement Letter',
      label: 'Purpose paragraph',
      defaultText: 'The purpose of the audit is to express an opinion on the school\'s financial statements.'
    },
    {
      id: 'eng_school_audit_sgb_responsibilities',
      category: 'School Audit Engagement Letter',
      label: 'SGB responsibilities (Section 1)',
      defaultText: '1.1  You are responsible for keeping proper financial records and for preparing accounts that fairly present the position of the school.\n1.2  You are responsible for complying with the laws and regulations that apply to the school, including guidance issued by the [EDU_DEPT].\n1.3  You are responsible for giving us all the information we need for the engagement.'
    },
    {
      id: 'eng_school_audit_scope',
      category: 'School Audit Engagement Letter',
      label: 'Scope of audit (Section 2)',
      defaultText: '1.1  We will carry out the audit of the school\'s financial statements in line with the applicable standards.\n1.2  We will report to the [EDU_DEPT] where required.\n1.3  The engagement is limited to the financial statements and does not cover other matters.'
    },
    {
      id: 'eng_school_audit_disclosure',
      category: 'School Audit Engagement Letter',
      label: 'Disclosure (Section 3)',
      defaultText: 'You agree that we may share information with third parties where this is needed to carry out the services in this letter.\n\nSuch information will be limited to what is necessary for that purpose.'
    },
    {
      id: 'eng_school_audit_popia',
      category: 'School Audit Engagement Letter',
      label: 'POPIA (Section 4)',
      defaultText: 'We handle personal information in line with the applicable privacy legislation. Information is used only for the services in this letter and is kept confidential and secure.'
    },
    {
      id: 'eng_school_audit_fees',
      category: 'School Audit Engagement Letter',
      label: 'Fees (Section 5)',
      defaultText: 'Our fees are based on the time spent on the engagement and the staff involved. Invoices are issued as work progresses and are payable within 30 days.'
    },
    {
      id: 'eng_school_audit_agreement',
      category: 'School Audit Engagement Letter',
      label: 'Agreement (Section 6)',
      defaultText: 'Please sign and return a copy of this letter to confirm that you agree to its terms. This letter stays in force for future years unless it is changed or cancelled in writing.'
    },

    // ── School Review Engagement Letter ──
    {
      id: 'eng_school_review_intro',
      category: 'School Review Engagement Letter',
      label: 'Introduction',
      defaultText: 'Thank you for appointing us. This letter sets out the terms of our review engagement.'
    },
    {
      id: 'eng_school_review_sgb_purpose',
      category: 'School Review Engagement Letter',
      label: 'Purpose paragraph',
      defaultText: 'The purpose of the review is to express a conclusion on the school\'s financial statements.'
    },
    {
      id: 'eng_school_review_sgb_responsibilities',
      category: 'School Review Engagement Letter',
      label: 'SGB responsibilities (Section 1)',
      defaultText: '1.1  You are responsible for keeping proper financial records and for preparing accounts that fairly present the position of the school.\n1.2  You are responsible for complying with the laws and regulations that apply to the school, including guidance issued by the [EDU_DEPT].\n1.3  You are responsible for giving us all the information we need for the engagement.'
    },
    {
      id: 'eng_school_review_scope',
      category: 'School Review Engagement Letter',
      label: 'Scope of review (Section 2)',
      defaultText: '1.1  We will carry out the review of the school\'s financial statements in line with the applicable standards.\n1.2  We will report to the [EDU_DEPT] where required.\n1.3  The engagement is limited to the financial statements and does not cover other matters.'
    },
    {
      id: 'eng_school_review_disclosure',
      category: 'School Review Engagement Letter',
      label: 'Disclosure (Section 3)',
      defaultText: 'You agree that we may share information with third parties where this is needed to carry out the services in this letter.\n\nSuch information will be limited to what is necessary for that purpose.'
    },
    {
      id: 'eng_school_review_popia',
      category: 'School Review Engagement Letter',
      label: 'POPIA (Section 4)',
      defaultText: 'We handle personal information in line with the applicable privacy legislation. Information is used only for the services in this letter and is kept confidential and secure.'
    },
    {
      id: 'eng_school_review_fees',
      category: 'School Review Engagement Letter',
      label: 'Fees (Section 5)',
      defaultText: 'Our fees are based on the time spent on the engagement and the staff involved. Invoices are issued as work progresses and are payable within 30 days.'
    },
    {
      id: 'eng_school_review_agreement',
      category: 'School Review Engagement Letter',
      label: 'Agreement (Section 6)',
      defaultText: 'Please sign and return a copy of this letter to confirm that you agree to its terms. This letter stays in force for future years unless it is changed or cancelled in writing.'
    },

    // ── Club/Church Audit Engagement Letter ──
    {
      id: 'eng_club_church_intro',
      category: 'Club/Church Audit Engagement Letter',
      label: 'Introduction',
      defaultText: 'Thank you for appointing us. This letter sets out the terms of our audit engagement.'
    },
    {
      id: 'eng_club_church_scope',
      category: 'Club/Church Audit Engagement Letter',
      label: 'Scope of audit',
      defaultText: 'You have asked us to audit the financial statements of [COMPANY] for the year ended [YEAR_END]. The statements comprise the statement of financial position, statement of comprehensive income, statement of changes in equity, statement of cash flows and the accounting policies. This engagement does not relieve the governing body of its own responsibilities.'
    },
    {
      id: 'eng_club_church_responsibilities',
      category: 'Club/Church Audit Engagement Letter',
      label: 'Responsibilities',
      defaultText: 'The [BODY_LABEL] decide whether an audit is appropriate for the [ENTITY_LABEL] and meet any related legal requirements.'
    },
    {
      id: 'eng_club_church_conduct_basis',
      category: 'Club/Church Audit Engagement Letter',
      label: 'Conduct basis & access requirements',
      defaultText: 'Our audit is carried out on the basis that you accept the following responsibilities:\n• Preparing and fairly presenting the financial statements in line with the applicable reporting framework;\n• Maintaining the internal control needed to prepare statements free from material misstatement; and\n• Giving us access to all records and information relevant to the engagement.\nWe may ask you for written confirmation of these responsibilities at the end of the audit.'
    },
    {
      id: 'eng_club_church_reporting',
      category: 'Club/Church Audit Engagement Letter',
      label: 'Reporting & expected opinion',
      defaultText: 'Our audit aims to express an opinion on the financial statements of the [ENTITY_LABEL] as a whole.\n\nWe will issue a written report for the year ended [YEAR_END]. It may only be used for its stated purpose.'
    },
    {
      id: 'eng_club_church_disclosure',
      category: 'Club/Church Audit Engagement Letter',
      label: 'Disclosure of information & authority',
      defaultText: 'You agree that we may share information with third parties where this is needed to carry out the services in this letter.\n\nSuch information will be limited to what is necessary for that purpose.'
    },
    {
      id: 'eng_club_church_popia',
      category: 'Club/Church Audit Engagement Letter',
      label: 'POPIA clause',
      defaultText: 'We handle personal information in line with the applicable privacy legislation. Information is used only for the services in this letter and is kept confidential and secure.'
    },
    {
      id: 'eng_club_church_fees',
      category: 'Club/Church Audit Engagement Letter',
      label: 'Fees',
      defaultText: 'Our fees are based on the time spent on the engagement and the staff involved. Invoices are issued as work progresses and are payable within 30 days.'
    },
    {
      id: 'eng_club_church_agreement',
      category: 'Club/Church Audit Engagement Letter',
      label: 'Agreement of terms',
      defaultText: 'We look forward to your full cooperation during the engagement. Please contact us at any time if you wish to discuss this letter. Once agreed, it remains in force for future years unless it is changed or cancelled.'
    },
    {
      id: 'eng_club_church_signing',
      category: 'Club/Church Audit Engagement Letter',
      label: 'Signing instruction',
      defaultText: 'Please sign and return a copy of this letter to confirm that you agree to its terms. This letter stays in force for future years unless it is changed or cancelled in writing.'
    },

    // ── Attorneys Trust Account Engagement Letter ──
    {
      id: 'eng_attorneys_scope',
      category: 'Attorneys Trust Engagement Letter',
      label: 'Scope of engagement',
      defaultText: 'A reasonable assurance engagement on whether the trust accounts of [COMPANY] were maintained, in all material respects, in line with the applicable legislation and rules, for [PERIOD].'
    },
    {
      id: 'eng_attorneys_clarification',
      category: 'Attorneys Trust Engagement Letter',
      label: 'Clarification on scope',
      defaultText: 'This letter clarifies the scope of the engagement.'
    },
    {
      id: 'eng_attorneys_advisory_agree',
      category: 'Attorneys Trust Engagement Letter',
      label: 'Advisory — agree information',
      defaultText: 'We agree that the engagement covers the trust accounts for [PERIOD] only.'
    },
    {
      id: 'eng_attorneys_advisory_read',
      category: 'Attorneys Trust Engagement Letter',
      label: 'Advisory — read representations',
      defaultText: 'Please read this letter carefully and tell us if anything is unclear.'
    },
    {
      id: 'eng_attorneys_investment',
      category: 'Attorneys Trust Engagement Letter',
      label: 'Investment practice reporting',
      defaultText: 'The engagement also covers the investment accounts for [PERIOD].'
    },
    {
      id: 'eng_attorneys_directors_responsibility',
      category: 'Attorneys Trust Engagement Letter',
      label: 'Directors\' responsibility',
      defaultText: 'The practice is responsible for keeping proper trust accounting records and for complying with the applicable rules.\n\nIt must also give us access to all records we need.'
    },
    {
      id: 'eng_attorneys_independence',
      category: 'Attorneys Trust Engagement Letter',
      label: 'Independence & quality control',
      defaultText: 'We will comply with the independence and ethical requirements that apply to this engagement.'
    },
    {
      id: 'eng_attorneys_auditor_responsibility',
      category: 'Attorneys Trust Engagement Letter',
      label: 'Auditor\'s responsibility',
      defaultText: 'Our responsibility is to express a conclusion on compliance, based on the evidence we obtain.\n\nWe will plan and perform the engagement to obtain reasonable assurance.'
    },
    {
      id: 'eng_attorneys_procedures',
      category: 'Attorneys Trust Engagement Letter',
      label: 'Procedures',
      defaultText: 'Our procedures include:\n• Inspecting the trust accounting records;\n• Testing a sample of transactions; and\n• Confirming balances with third parties where appropriate.'
    },
    {
      id: 'eng_attorneys_limitations',
      category: 'Attorneys Trust Engagement Letter',
      label: 'Limitations & inherent risk',
      defaultText: 'Because of the inherent limitations of any engagement of this kind, some non-compliance may not be detected.\n\nThe conclusion is based on the sample we test.'
    },
    {
      id: 'eng_attorneys_report_compliance',
      category: 'Attorneys Trust Engagement Letter',
      label: 'Report on compliance',
      defaultText: 'We will report on whether the trust accounts of [COMPANY] complied with the applicable rules for [PERIOD].'
    },
    {
      id: 'eng_attorneys_report_annual',
      category: 'Attorneys Trust Engagement Letter',
      label: 'Report on Annual Statement',
      defaultText: 'We will also issue a report on the annual trust accounts for [PERIOD].\n\nThe reports may only be used for their stated purpose.'
    },
    {
      id: 'eng_attorneys_report_investment',
      category: 'Attorneys Trust Engagement Letter',
      label: 'Report on investment practice',
      defaultText: 'We will report separately on the investment accounts for [PERIOD].'
    },
    {
      id: 'eng_attorneys_reportable',
      category: 'Attorneys Trust Engagement Letter',
      label: 'Reportable irregularities',
      defaultText: 'If we become aware of a matter that must be reported, we will report it to the relevant body.\n\nWe will tell you first where the law allows.'
    },
    {
      id: 'eng_attorneys_ncwr',
      category: 'Attorneys Trust Engagement Letter',
      label: 'Non-compliance with laws',
      defaultText: 'We will report any material non-compliance that we find.'
    },
    {
      id: 'eng_attorneys_restriction',
      category: 'Attorneys Trust Engagement Letter',
      label: 'Restriction on use',
      defaultText: 'Our reports are restricted to the persons named in them.'
    },
    {
      id: 'eng_attorneys_signing',
      category: 'Attorneys Trust Engagement Letter',
      label: 'Signing instruction',
      defaultText: 'Please sign and return a copy of this letter to confirm that you agree to its terms. This letter stays in force for future years unless it is changed or cancelled in writing.'
    },
  ];

  const VARIABLES = [
    { name: '[COMPANY]', description: 'Company / entity name from the form — includes ", Trading as: …" when the form has a trading name' },
    { name: '[TRADING_AS]', description: 'Trading name on its own (empty when the form has none)' },
    { name: '[YEAR_END]', description: 'Financial year-end date' },
    { name: '[ROLE]', description: 'Directors / Members / Trustees (depends on entity type)' },
    { name: '[ROLE_POSSESSIVE]', description: "Directors' / Members' / Trustees' (possessive form)" },
    { name: '[ROLE_POSSESSIVE_TITLE]', description: "Directors' / Members' / Trustees' (title case, for headings)" },
    { name: '[IS_ARE]', description: '"is" or "are" (based on director count)' },
    { name: '[ENTITY_TYPE]', description: '"company" / "close corporation" / "trust" etc.' },
    { name: '[DATE]', description: 'Engagement letter date, long form e.g. "14 July 2026" (14 days before date signed)' },
    { name: '[START]', description: 'First page number of financial statements' },
    { name: '[END]', description: 'Last page number of financial statements' },
    { name: '[BODY_LABEL]', description: '"committee" / "church council" (for club/church entities)' },
    { name: '[ENTITY_LABEL]', description: '"club" / "church" (for club/church entities)' },
    { name: '[HAS_HAVE]', description: '"has" or "have" (based on director count)' },
    { name: '[PERIOD]', description: 'Attorneys trust account period (e.g. "the period from 1 March 2024 to the year ended ...")' },
    { name: '[EDU_DEPT]', description: 'School education department, e.g. "Mpumalanga Department of Education" (editable per school)' },
    { name: '[NPC_ORG]', description: 'How the NPC policies describe the entity, e.g. "centre/organisation" (free text, editable per NPC)' },
    { name: '[NPO_ORG]', description: 'How an NPO is described: "organisation", "club" or "centre" (chosen per NPO, Step 4)' },
    { name: '[NPO_BODY]', description: 'An NPO\'s governing body: "members" or "directors" (Step 4)' },
    { name: '[NPO_DEPT]', description: 'The department that owns the assets of an NPO, e.g. "Mpumalanga Department" (free text, editable per NPO)' },
    { name: '[NPO_DEPT_OF]', description: 'What that department is "of": "Social Development" or "Education" (chosen per NPO)' },
    { name: '[PPE_STMT]', description: 'Statement the "No Asset Register" / "Transitional Write-off" PPE policies write assets off in: "Financial Performance" or "Surplus or Deficit" (schools and NPOs)' },
  ];

  // ── State ──
  let _data = { folders: [], activeId: null };
  let _selectedFolderId = null;
  let _selectedCategory = null;
  let _expandedFolders = new Set();
  let _defaultUnlocked = false;
  let _view = 'templates';            // templates | policies | lineheights | geometry | typography | colours | brand
  let _policyData = { edits: {}, added: [], deleted: [] };
  let _policyDefaults = {};           // pristine clones of built-in policies, by id
  let _policyAddOpen = false;
  let _lineHeights = null;            // { base, compact, eng, decl } — only overridden keys present
  let _docVars = null;                // { <id>: value } geometry / typography / colour overrides
  let _brand = null;                  // { firmCA, firmAudit, locality } firm-identity overrides
  let _letterheads = null;            // { <id>: dataURI } letterhead header/footer image overrides

  // ── Document line-height buckets (mirror the --doc-lh-* vars in styles.css) ──
  const LH_KEY = 'inf181-admin-lineheights';
  const LINE_HEIGHTS = [
    { id: 'base',    cssVar: '--doc-lh-base',    def: 1.33, label: 'Standard pages',
      desc: 'Cover / general information, notes, auditor’s & reviewer’s reports, all minutes, loan certificate, index, attorneys’ trust.' },
    { id: 'compact', cssVar: '--doc-lh-compact', def: 1.3,  label: 'Compact pages',
      desc: 'Responsibilities & Approval, Independent Compiler’s Report, accounting engagement letters.' },
    { id: 'eng',     cssVar: '--doc-lh-eng',     def: 1.32, label: 'Audit / school engagement letters',
      desc: 'Audit, school audit and school review engagement letters.' },
    { id: 'decl',    cssVar: '--doc-lh-decl',    def: 1.33, label: 'Declaration & review letter',
      desc: 'CA(SA) Declaration and the review engagement letter.' },
  ];

  // ── Adjustable document variables (geometry / typography / colours) ──
  // Each writes one CSS custom property into a dedicated <style> element on
  // :root, so the override reaches the preview AND (via buildPrintHTML copying
  // every <style>) the exported PDF. Defaults mirror the values in styles.css.
  const DOCVAR_KEY = 'inf181-admin-docvars';

  const DOC_GEOMETRY = [
    { id: 'pgw',  cssVar: '--pg-w',      unit: 'mm', def: 210, min: 100, max: 420, step: 1,   label: 'Page width',     desc: 'Full sheet width (A4 = 210 mm).' },
    { id: 'pgh',  cssVar: '--pg-h',      unit: 'mm', def: 297, min: 100, max: 600, step: 1,   label: 'Page height',    desc: 'Full sheet height (A4 = 297 mm).' },
    { id: 'pgpt', cssVar: '--pg-pt',     unit: 'mm', def: 15,  min: 0,   max: 60,  step: 0.5, label: 'Top margin',     desc: 'Space above the content, below the letterhead.' },
    { id: 'pgpx', cssVar: '--pg-px',     unit: 'mm', def: 18,  min: 0,   max: 60,  step: 0.5, label: 'Side margins',   desc: 'Left and right margins.' },
    { id: 'pgpb', cssVar: '--pg-pb',     unit: 'mm', def: 19,  min: 0,   max: 60,  step: 0.5, label: 'Bottom margin',  desc: 'Space below the content, above the footer.' },
    { id: 'pglh', cssVar: '--pg-lh-gap', unit: 'mm', def: 8,   min: 0,   max: 40,  step: 0.5, label: 'Letterhead gap', desc: 'Gap between the letterhead header and the first line of content.' },
  ];

  const FONT_OPTIONS = [
    "'Poppins', sans-serif",
    "'Libre Baskerville', serif",
    "Georgia, 'Times New Roman', serif",
    "'Times New Roman', Times, serif",
    "Cambria, Georgia, serif",
    "Garamond, 'Times New Roman', serif",
    "Arial, Helvetica, sans-serif",
    "Calibri, 'Segoe UI', sans-serif",
    "'Segoe UI', Tahoma, sans-serif",
    "Verdana, Geneva, sans-serif",
    "'Courier New', Courier, monospace",
    "inherit",
  ];

  const DOC_TYPOGRAPHY = [
    { id: 'bodyfont', cssVar: '--doc-body-font',    type: 'font',            def: "'Poppins', sans-serif", label: 'Body font',      desc: 'Font for all document text.' },
    { id: 'headfont', cssVar: '--doc-heading-font', type: 'font',            def: 'inherit',               label: 'Heading font',   desc: 'Font for page and cover headings. "inherit" = same as body.' },
    { id: 'bodysize', cssVar: '--doc-body-size',    type: 'num', unit: 'pt', def: 9.5, min: 6, max: 16, step: 0.25, label: 'Body font size', desc: 'Base document text size (pt). Changing this reflows pagination.' },
  ];

  const DOC_COLOURS = [
    { id: 'ink',  cssVar: '--doc-ink',  type: 'colour', def: '#111111', label: 'Text colour',       desc: 'Colour of all document text.' },
    { id: 'rule', cssVar: '--doc-rule', type: 'colour', def: '#111111', label: 'Cover rule colour', desc: 'Colour of the cover-page title underline.' },
  ];

  function _docVarGroup(kind) {
    return kind === 'geometry' ? DOC_GEOMETRY : kind === 'typography' ? DOC_TYPOGRAPHY : DOC_COLOURS;
  }
  function _allDocVarDefs() {
    return DOC_GEOMETRY.concat(DOC_TYPOGRAPHY, DOC_COLOURS);
  }

  // ── Firm identity overrides (cover signatory line + page footer) ──
  const BRAND_KEY = 'inf181-admin-brand';
  const BRAND_FIELDS = [
    { id: 'firmCA',    def: 'INF181 Group Project', label: 'Firm name — accounting / compilation / review', desc: 'Shown on the cover signatory line and the page footer for every non-audit report.' },
    { id: 'firmAudit', def: 'INF181 Audit Group',            label: 'Firm name — audit reports',                     desc: 'Shown for the Independent Auditor’s Report and school audits.' },
    { id: 'locality',  def: 'Dummyville',               label: 'Footer locality',                               desc: 'Town shown after the firm name in the page footer of non-audit reports.' },
  ];

  // ── Letterhead image overrides (header / footer of each firm) ──
  // Stored as data-URIs in localStorage and read at generate time by
  // DocumentGenerator (via getLetterhead). Defaults are the bundled images in
  // config.js — shown as the preview whenever no override is set.
  const LETTERHEAD_KEY = 'inf181-admin-letterheads';
  const LETTERHEAD_FIELDS = [
    { id: 'caHeader',    firm: 'INF181 Group Project', slot: 'Header', def: (typeof CA_LETTERHEAD !== 'undefined' ? CA_LETTERHEAD : ''),         label: 'Header', desc: 'Top letterhead image on every non-audit (accounting / compilation / review) report page.' },
    { id: 'caFooter',    firm: 'INF181 Group Project', slot: 'Footer', def: (typeof LETTERHEAD_FOOTER_IMG !== 'undefined' ? LETTERHEAD_FOOTER_IMG : ''), label: 'Footer', desc: 'Bottom letterhead image on every non-audit report page.' },
    { id: 'auditHeader', firm: 'INF181 Audit Group',            slot: 'Header', def: (typeof AUDIT_LETTERHEAD !== 'undefined' ? AUDIT_LETTERHEAD : ''),      label: 'Header', desc: 'Top letterhead image on the Independent Auditor’s Report and school audit pages.' },
    { id: 'auditFooter', firm: 'INF181 Audit Group',            slot: 'Footer', def: (typeof AUDIT_FOOTER_IMG !== 'undefined' ? AUDIT_FOOTER_IMG : ''),       label: 'Footer', desc: 'Bottom letterhead image on the audit report pages.' },
  ];

  // ── Persistence ──
  function _load() {
    try {
      const raw = localStorage.getItem(FOLDERS_KEY);
      if (raw) {
        _data = JSON.parse(raw);
        if (!_data.folders.some(f => f.isDefault)) {
          _data.folders[0].isDefault = true;
          _save();
        }
        return;
      }
    } catch (_) {}

    let oldOverrides = {};
    try {
      const oldRaw = localStorage.getItem(OLD_KEY);
      if (oldRaw) oldOverrides = JSON.parse(oldRaw);
    } catch (_) {}

    const def = { id: _uid(), name: 'Default', isDefault: true, overrides: oldOverrides };
    _data = { folders: [def], activeId: def.id };
    _save();
    localStorage.removeItem(OLD_KEY);
  }

  function _getDefaultFolder() {
    return _data.folders.find(f => f.isDefault);
  }

  function _getDefaultText(id) {
    const def = _getDefaultFolder();
    if (def && def.overrides[id] !== undefined) return def.overrides[id];
    const tpl = TEMPLATES.find(t => t.id === id);
    return tpl ? tpl.defaultText : '';
  }

  function _save() {
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(_data));
  }

  function _uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // ── Accounting-policy persistence & overrides ──
  function _loadPolicyData() {
    try {
      const raw = localStorage.getItem(POLICY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        _policyData = {
          edits: parsed.edits || {},
          added: Array.isArray(parsed.added) ? parsed.added : [],
          deleted: Array.isArray(parsed.deleted) ? parsed.deleted : [],
        };
        return;
      }
    } catch (_) {}
    _policyData = { edits: {}, added: [], deleted: [] };
  }

  function _savePolicyData() {
    localStorage.setItem(POLICY_KEY, JSON.stringify(_policyData));
  }

  // ── Line-height persistence & overrides ──
  function _loadLineHeights() {
    if (_lineHeights) return _lineHeights;
    try {
      const raw = localStorage.getItem(LH_KEY);
      _lineHeights = raw ? (JSON.parse(raw) || {}) : {};
    } catch (_) {
      _lineHeights = {};
    }
    return _lineHeights;
  }

  function _saveLineHeights() {
    localStorage.setItem(LH_KEY, JSON.stringify(_lineHeights || {}));
  }

  // Write the stored overrides into a dedicated <style> element on :root.
  // A <style> element (unlike an inline style on documentElement) is copied
  // verbatim by PreviewManager.buildPrintHTML, so the same override reaches
  // the exported PDF — keeping preview and print in step.
  function _applyLineHeights() {
    const store = _loadLineHeights();
    let decls = '';
    LINE_HEIGHTS.forEach(lh => {
      const v = store[lh.id];
      if (v != null && v !== '' && !isNaN(Number(v))) decls += `${lh.cssVar}:${Number(v)};`;
    });
    let el = document.getElementById('admin-lineheight-overrides');
    if (!el) {
      el = document.createElement('style');
      el.id = 'admin-lineheight-overrides';
      document.head.appendChild(el);
    }
    el.textContent = decls ? `:root{${decls}}` : '';
  }

  // Set (or clear, when val is blank) one bucket and re-render the document so
  // pagination reflows for the new spacing. Skipped silently in edit mode by
  // generateDoc itself.
  function _setLineHeight(id, val) {
    _loadLineHeights();
    if (val === '' || val == null || isNaN(Number(val))) delete _lineHeights[id];
    else _lineHeights[id] = Number(val);
    _saveLineHeights();
    _applyLineHeights();
    _regenDocument();
  }

  function _regenDocument() {
    try { if (typeof generateDoc === 'function') generateDoc(); } catch (_) {}
  }

  // ── Document-variable persistence & overrides (geometry / typography / colours) ──
  function _loadDocVars() {
    if (_docVars) return _docVars;
    try {
      const raw = localStorage.getItem(DOCVAR_KEY);
      _docVars = raw ? (JSON.parse(raw) || {}) : {};
    } catch (_) {
      _docVars = {};
    }
    return _docVars;
  }

  function _saveDocVars() {
    localStorage.setItem(DOCVAR_KEY, JSON.stringify(_docVars || {}));
  }

  // Write every stored override into a dedicated <style> element on :root.
  // buildPrintHTML copies <style> elements verbatim, so the same override
  // reaches the exported PDF — keeping preview and print in step.
  function _applyDocVars() {
    const store = _loadDocVars();
    let decls = '';
    _allDocVarDefs().forEach(d => {
      let v = store[d.id];
      if (v == null || v === '') return;
      if (d.unit) {                                   // numeric length → append unit
        if (isNaN(Number(v))) return;
        v = Number(v) + d.unit;
      }
      decls += `${d.cssVar}:${v};`;
    });
    let el = document.getElementById('admin-docvar-overrides');
    if (!el) {
      el = document.createElement('style');
      el.id = 'admin-docvar-overrides';
      document.head.appendChild(el);
    }
    el.textContent = decls ? `:root{${decls}}` : '';
  }

  function _setDocVar(id, val) {
    _loadDocVars();
    if (val === '' || val == null) delete _docVars[id];
    else _docVars[id] = val;
    _saveDocVars();
    _applyDocVars();
    _regenDocument();
  }

  // ── Firm-identity persistence (read at generate time by DocumentGenerator) ──
  function _loadBrand() {
    if (_brand) return _brand;
    try {
      const raw = localStorage.getItem(BRAND_KEY);
      _brand = raw ? (JSON.parse(raw) || {}) : {};
    } catch (_) {
      _brand = {};
    }
    return _brand;
  }

  function _saveBrand() {
    localStorage.setItem(BRAND_KEY, JSON.stringify(_brand || {}));
  }

  function getBrand(id) {
    const b = _loadBrand();
    const v = b[id];
    return (v != null && v !== '') ? v : '';
  }

  function _setBrand(id, val) {
    _loadBrand();
    if (val == null || val === '') delete _brand[id];
    else _brand[id] = val;
    _saveBrand();
    _regenDocument();
  }

  // ── Letterhead-image persistence (read at generate time by DocumentGenerator) ──
  function _loadLetterheads() {
    if (_letterheads) return _letterheads;
    try {
      const raw = localStorage.getItem(LETTERHEAD_KEY);
      _letterheads = raw ? (JSON.parse(raw) || {}) : {};
    } catch (_) {
      _letterheads = {};
    }
    return _letterheads;
  }

  function _saveLetterheads() {
    localStorage.setItem(LETTERHEAD_KEY, JSON.stringify(_letterheads || {}));
  }

  // Returns the override (data-URI) for a letterhead slot, or '' when the
  // firm default should be used. DocumentGenerator falls back to the bundled
  // config image whenever this is empty.
  function getLetterhead(id) {
    const s = _loadLetterheads();
    const v = s[id];
    return (v != null && v !== '') ? v : '';
  }

  function _setLetterhead(id, dataUri) {
    _loadLetterheads();
    const prev = _letterheads[id];
    if (dataUri == null || dataUri === '') delete _letterheads[id];
    else _letterheads[id] = dataUri;
    try {
      _saveLetterheads();
    } catch (e) {
      // Roll back the in-memory change so state matches what's on disk.
      if (prev === undefined) delete _letterheads[id];
      else _letterheads[id] = prev;
      _showToast('Image too large to store — try a smaller file');
      return false;
    }
    _regenDocument();
    return true;
  }

  // Mutate the global accountingPolicies array to reflect stored admin changes.
  // Must run before EntityManager.buildPolicyChecklist() (i.e. before app.js),
  // which is guaranteed by AdminPanel.js loading ahead of app.js.
  function _applyPolicyOverrides() {
    if (typeof accountingPolicies === 'undefined') return;
    // Snapshot pristine built-in defaults once, in their original order.
    accountingPolicies.forEach(p => {
      if (!_policyDefaults[p.id]) _policyDefaults[p.id] = JSON.parse(JSON.stringify(p));
    });
    _loadPolicyData();
    _rebuildPolicyArrayFromState();
  }

  // Rebuild the global accountingPolicies array in place from the pristine
  // defaults plus the stored edits / deletions / additions. Keeps the original
  // built-in ordering and preserves complex fields (subItems, rate tables, etc.)
  // since only label / text / schoolText are ever overridden.
  function _rebuildPolicyArrayFromState() {
    accountingPolicies.length = 0;
    Object.keys(_policyDefaults).forEach(id => {
      if (_policyData.deleted.indexOf(id) !== -1) return;
      const p = JSON.parse(JSON.stringify(_policyDefaults[id]));
      const e = _policyData.edits[id];
      if (e) {
        if (typeof e.label === 'string') p.label = e.label;
        if (typeof e.text === 'string') p.text = e.text;
        if (typeof e.schoolText === 'string') {
          if (e.schoolText) p.schoolText = e.schoolText; else delete p.schoolText;
        }
      }
      accountingPolicies.push(p);
    });
    _policyData.added.forEach(a => {
      const obj = { id: a.id, label: a.label || '', originalNum: '', text: a.text || '' };
      if (a.schoolText) obj.schoolText = a.schoolText;
      accountingPolicies.push(obj);
    });
  }

  function _isCustomPolicy(id) {
    return _policyData.added.some(a => a.id === id);
  }

  function _refreshChecklist() {
    if (typeof entityManager !== 'undefined' && typeof entityManager.rebuildPolicyChecklist === 'function') {
      entityManager.rebuildPolicyChecklist();
      if (typeof liveUpdate === 'function') liveUpdate();
    }
  }

  // ── Category helpers ──
  function _getCategories() {
    const cats = [];
    const seen = {};
    TEMPLATES.forEach(t => {
      if (!seen[t.category]) { seen[t.category] = true; cats.push(t.category); }
    });
    return cats;
  }

  function _getTemplatesForCategory(cat) {
    return TEMPLATES.filter(t => t.category === cat);
  }

  function _getModCount(folder, cat) {
    return _getTemplatesForCategory(cat).filter(t => folder.overrides[t.id] !== undefined).length;
  }

  // ── Public: template access (uses ACTIVE folder) ──
  function getTemplate(id) {
    const tpl = TEMPLATES.find(t => t.id === id);
    if (!tpl) return '';
    const folder = _data.folders.find(f => f.id === _data.activeId);
    if (folder && folder.overrides[id] !== undefined) return folder.overrides[id];
    return _getDefaultText(id);
  }

  function setTemplate(id, text) {
    const folder = _data.folders.find(f => f.id === _data.activeId);
    if (!folder) return;
    const base = folder.isDefault
      ? TEMPLATES.find(t => t.id === id)?.defaultText
      : _getDefaultText(id);
    if (text === base) delete folder.overrides[id];
    else folder.overrides[id] = text;
    _save();
  }

  function resetTemplate(id) {
    const folder = _data.folders.find(f => f.id === _data.activeId);
    if (!folder) return;
    delete folder.overrides[id];
    _save();
  }

  function resetAll() {
    const folder = _data.folders.find(f => f.id === _data.activeId);
    if (!folder) return;
    folder.overrides = {};
    _save();
  }

  function isModified(id) {
    const folder = _data.folders.find(f => f.id === _data.activeId);
    return folder ? folder.overrides[id] !== undefined : false;
  }

  // ── Folder CRUD ──
  function _createFolder(name) {
    const folder = { id: _uid(), name: name || 'New Set', overrides: {} };
    _data.folders.push(folder);
    if (!_data.activeId) _data.activeId = folder.id;
    _save();
    return folder;
  }

  function _renameFolder(id, newName) {
    const f = _data.folders.find(f => f.id === id);
    if (f && !f.isDefault) { f.name = newName; _save(); }
  }

  function _deleteFolder(id) {
    const f = _data.folders.find(f => f.id === id);
    if (!f || f.isDefault || _data.folders.length <= 1) return;
    _data.folders = _data.folders.filter(f => f.id !== id);
    if (_data.activeId === id) _data.activeId = _data.folders[0].id;
    if (_selectedFolderId === id) { _selectedFolderId = _data.activeId; _selectedCategory = null; }
    _save();
  }

  function _duplicateFolder(id) {
    const src = _data.folders.find(f => f.id === id);
    if (!src) return null;
    const dup = { id: _uid(), name: src.name + ' (Copy)', overrides: JSON.parse(JSON.stringify(src.overrides)) };
    _data.folders.push(dup);
    _save();
    return dup;
  }

  function _setActive(id) {
    if (_data.folders.find(f => f.id === id)) {
      _data.activeId = id;
      _save();
    }
  }

  // ── Password prompt ──
  function _showPasswordPrompt() {
    return new Promise((resolve) => {
      const overlay = document.getElementById('admin-password-overlay');
      const modal = document.getElementById('admin-password-modal');
      const input = document.getElementById('admin-password-input');
      const errEl = document.getElementById('admin-password-error');
      if (!overlay || !modal || !input) { resolve(false); return; }

      errEl.textContent = '';
      input.value = '';
      overlay.classList.add('visible');
      modal.classList.add('visible');
      input.focus();

      function cleanup() {
        overlay.classList.remove('visible');
        modal.classList.remove('visible');
        input.removeEventListener('keydown', onKey);
        document.getElementById('admin-password-ok').removeEventListener('click', onOk);
        document.getElementById('admin-password-cancel').removeEventListener('click', onCancel);
      }

      function onOk() {
        if (input.value === PASSWORD) { cleanup(); resolve(true); }
        else { errEl.textContent = 'Incorrect password'; input.value = ''; input.focus(); }
      }

      function onCancel() { cleanup(); resolve(false); }

      function onKey(e) {
        if (e.key === 'Enter') onOk();
        if (e.key === 'Escape') onCancel();
      }

      input.addEventListener('keydown', onKey);
      document.getElementById('admin-password-ok').addEventListener('click', onOk);
      document.getElementById('admin-password-cancel').addEventListener('click', onCancel);
    });
  }

  // ── Panel open / close ──
  function _openPanel() {
    const overlay = document.getElementById('admin-panel-overlay');
    const modal = document.getElementById('admin-panel-modal');
    if (!overlay || !modal) return;

    _load();
    _loadPolicyData();
    _view = 'templates';
    _policyAddOpen = false;
    _selectedFolderId = _data.activeId;
    _expandedFolders = new Set([_selectedFolderId]);
    _selectedCategory = null;
    _defaultUnlocked = false;
    _renderSidebar();
    _renderEmptyBody();
    overlay.classList.add('visible');
    modal.classList.add('visible');
  }

  function _closePanel() {
    const overlay = document.getElementById('admin-panel-overlay');
    const modal = document.getElementById('admin-panel-modal');
    if (overlay) overlay.classList.remove('visible');
    if (modal) modal.classList.remove('visible');
  }

  // ── Sidebar rendering ──
  function _renderSidebar() {
    const nav = document.getElementById('admin-cat-nav');
    if (!nav) return;

    const cats = _getCategories();

    // ── View switcher (Templates vs Accounting Policies) ──
    let html = '<div class="admin-view-switch">';
    html += `<button class="admin-view-btn${_view === 'templates' ? ' active' : ''}" data-view="templates">` +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' +
      'Templates</button>';
    html += `<button class="admin-view-btn${_view === 'policies' ? ' active' : ''}" data-view="policies">` +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>' +
      'Policies</button>';
    html += `<button class="admin-view-btn${_view === 'lineheights' ? ' active' : ''}" data-view="lineheights">` +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>' +
      'Line Heights</button>';
    html += `<button class="admin-view-btn${_view === 'geometry' ? ' active' : ''}" data-view="geometry">` +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="3" width="16" height="18" rx="1"/><line x1="4" y1="8" x2="20" y2="8"/><line x1="4" y1="16" x2="20" y2="16"/></svg>' +
      'Geometry</button>';
    html += `<button class="admin-view-btn${_view === 'typography' ? ' active' : ''}" data-view="typography">` +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>' +
      'Typography</button>';
    html += `<button class="admin-view-btn${_view === 'colours' ? ' active' : ''}" data-view="colours">` +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="10.5" r="2.5"/><circle cx="8.5" cy="7.5" r="2.5"/><circle cx="6.5" cy="12.5" r="2.5"/><path d="M12 22a10 10 0 1 1 0-20 8 8 0 0 1 0 16h-1.5a1.5 1.5 0 0 0-1 2.6A1 1 0 0 1 12 22z"/></svg>' +
      'Colours</button>';
    html += `<button class="admin-view-btn${_view === 'brand' ? ' active' : ''}" data-view="brand">` +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h16"/><path d="M6 16l6-11 6 11"/><path d="M8.5 12h7"/></svg>' +
      'Firm</button>';
    html += `<button class="admin-view-btn${_view === 'letterheads' ? ' active' : ''}" data-view="letterheads">` +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="3" width="16" height="18" rx="1"/><line x1="7" y1="7" x2="17" y2="7"/><line x1="7" y1="17" x2="17" y2="17"/><rect x="8" y="10" width="8" height="4" rx="0.5"/></svg>' +
      'Letterheads</button>';
    html += '</div>';

    if (_view !== 'templates') {
      nav.innerHTML = html;
      nav.querySelectorAll('.admin-view-btn').forEach(btn => {
        btn.addEventListener('click', () => _switchView(btn.dataset.view));
      });
      return;
    }

    html += '<div class="admin-sidebar-hdr"><span>Template Sets</span><button class="admin-new-set-btn" title="New template set">+</button></div>';
    html += '<div class="admin-folder-tree">';

    _data.folders.forEach(f => {
      const isActive = f.id === _data.activeId;
      const isExpanded = _expandedFolders.has(f.id);
      const totalMods = Object.keys(f.overrides).length;

      html += `<div class="admin-folder${_selectedFolderId === f.id && !_selectedCategory ? ' selected' : ''}" data-id="${f.id}">`;
      html += `<div class="admin-folder-row${isActive ? ' is-active' : ''}${f.isDefault ? ' is-default' : ''}" data-id="${f.id}">`;
      html += `<span class="admin-folder-chevron">${isExpanded ? '▾' : '▸'}</span>`;
      if (f.isDefault) {
        html += '<svg class="admin-folder-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
      } else {
        html += '<svg class="admin-folder-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
      }
      html += `<span class="admin-folder-name" title="${_escHtml(f.name)}">${_escHtml(f.name)}</span>`;
      if (totalMods > 0) html += `<span class="admin-folder-mod-count">${totalMods}</span>`;
      if (isActive) html += '<span class="admin-folder-active-badge">Active</span>';
      html += '<div class="admin-folder-actions">';
      if (!isActive) html += `<button class="admin-folder-act-btn" data-action="activate" data-id="${f.id}" title="Set as active">✓</button>`;
      html += `<button class="admin-folder-act-btn" data-action="duplicate" data-id="${f.id}" title="Duplicate">⧉</button>`;
      if (!f.isDefault) html += `<button class="admin-folder-act-btn" data-action="rename" data-id="${f.id}" title="Rename">✎</button>`;
      if (!f.isDefault && _data.folders.length > 1) html += `<button class="admin-folder-act-btn" data-action="delete" data-id="${f.id}" title="Delete">✕</button>`;
      html += '</div></div>';

      if (isExpanded) {
        html += '<div class="admin-folder-children">';
        cats.forEach(cat => {
          const mc = _getModCount(f, cat);
          const isCatSel = _selectedFolderId === f.id && _selectedCategory === cat;
          html += `<button class="admin-cat-item${isCatSel ? ' active' : ''}" data-folder="${f.id}" data-cat="${_escAttr(cat)}">`;
          html += `<span class="admin-cat-item-name">${_escHtml(cat)}</span>`;
          if (mc > 0) html += `<span class="admin-cat-item-badge">${mc}</span>`;
          html += '</button>';
        });
        html += '</div>';
      }

      html += '</div>';
    });

    html += '</div>';
    nav.innerHTML = html;

    // ── Wire view switcher ──
    nav.querySelectorAll('.admin-view-btn').forEach(btn => {
      btn.addEventListener('click', () => _switchView(btn.dataset.view));
    });

    // ── Wire sidebar events ──
    nav.querySelector('.admin-new-set-btn').addEventListener('click', () => {
      const name = prompt('New template set name:');
      if (!name || !name.trim()) return;
      const f = _createFolder(name.trim());
      _selectedFolderId = f.id;
      _expandedFolders.add(f.id);
      _selectedCategory = null;
      _renderSidebar();
      _renderEmptyBody();
      _showToast('Template set created');
    });

    nav.querySelectorAll('.admin-folder-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.admin-folder-act-btn')) return;
        const fId = row.dataset.id;
        if (_expandedFolders.has(fId)) _expandedFolders.delete(fId);
        else _expandedFolders.add(fId);
        _selectedFolderId = fId;
        _selectedCategory = null;
        _renderSidebar();
        _renderEmptyBody();
      });
    });

    nav.querySelectorAll('.admin-cat-item').forEach(btn => {
      btn.addEventListener('click', () => {
        _selectedFolderId = btn.dataset.folder;
        _selectedCategory = btn.dataset.cat;
        _renderSidebar();
        _renderTemplates();
      });
    });

    nav.querySelectorAll('.admin-folder-act-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        switch (action) {
          case 'activate':
            _setActive(id);
            _renderSidebar();
            _showToast('Template set activated');
            break;
          case 'rename': {
            const f = _data.folders.find(fl => fl.id === id);
            if (!f) break;
            const name = prompt('Rename template set:', f.name);
            if (!name || !name.trim()) break;
            _renameFolder(id, name.trim());
            _renderSidebar();
            _showToast('Renamed');
            break;
          }
          case 'duplicate': {
            const dup = _duplicateFolder(id);
            if (dup) {
              _selectedFolderId = dup.id;
              _expandedFolders.add(dup.id);
              _selectedCategory = null;
              _renderSidebar();
              _renderEmptyBody();
              _showToast('Duplicated');
            }
            break;
          }
          case 'delete':
            if (!confirm('Delete this template set? This cannot be undone.')) break;
            _deleteFolder(id);
            _renderSidebar();
            if (_selectedCategory) _renderTemplates();
            else _renderEmptyBody();
            _showToast('Deleted');
            break;
        }
      });
    });
  }

  // ── View switching ──
  function _switchView(view) {
    if (view === _view) return;
    _view = view;
    if (_view === 'policies') {
      _renderSidebar();
      _renderPolicies();
    } else if (_view === 'lineheights') {
      _renderSidebar();
      _renderLineHeights();
    } else if (_view === 'geometry' || _view === 'typography' || _view === 'colours') {
      _renderSidebar();
      _renderDocVars(_view);
    } else if (_view === 'brand') {
      _renderSidebar();
      _renderBrand();
    } else if (_view === 'letterheads') {
      _renderSidebar();
      _renderLetterheads();
    } else {
      _selectedFolderId = _data.activeId;
      _selectedCategory = null;
      _renderSidebar();
      _renderEmptyBody();
    }
  }

  // ── Accounting-policy manager ──
  function _renderPolicies() {
    const body = document.getElementById('admin-tpl-body');
    if (!body) return;

    let html = '<h3 class="admin-tpl-cat-title">Accounting Policies</h3>';
    html += '<p class="admin-pol-hint">Add, edit or delete the accounting policies offered in the policy checklist. Changes apply to every business. Policies with special behaviour (depreciation rate tables, biological assets, deferred tax) keep that behaviour — only their heading and text can be edited here.</p>';

    // Add-new toggle + form
    html += '<button class="admin-pol-add-btn" id="admin-pol-add-toggle">+ Add New Policy</button>';
    html += '<div class="admin-pol-add-form" id="admin-pol-add-form" style="display:' + (_policyAddOpen ? 'block' : 'none') + ';">';
    html += '<div class="admin-pol-field"><label>Heading</label><input type="text" id="admin-pol-new-label" placeholder="e.g. 1.13 Investment Property" autocomplete="off" spellcheck="false"></div>';
    html += '<div class="admin-pol-field"><label>Policy text</label><textarea id="admin-pol-new-text" rows="4" spellcheck="false"></textarea></div>';
    html += '<div class="admin-pol-field"><label>School-specific text <span class="admin-pol-opt">(optional)</span></label><textarea id="admin-pol-new-school" rows="3" spellcheck="false"></textarea></div>';
    html += '<div class="admin-tpl-actions"><button class="admin-tpl-save-btn" id="admin-pol-new-create">Create Policy</button><button class="admin-tpl-reset-btn" id="admin-pol-new-cancel">Cancel</button></div>';
    html += '</div>';

    // Existing policy list
    html += '<div class="admin-pol-list">';
    accountingPolicies.forEach(p => {
      const isCustom = _isCustomPolicy(p.id);
      const isEdited = !!_policyData.edits[p.id];
      const isComplex = !!(p.subItems || p.isBio || p.deferredAssetSentence || p.textSuffix);
      const hasSchool = typeof p.schoolText === 'string';

      html += '<div class="admin-tpl-item admin-pol-item" data-id="' + p.id + '">';
      html += '<div class="admin-tpl-header">';
      html += '<span class="admin-tpl-label">' + _escHtml(p.label || '(untitled)') + '</span>';
      if (isCustom) html += '<span class="admin-pol-badge admin-pol-badge-custom">Custom</span>';
      else if (isEdited) html += '<span class="admin-tpl-modified">Modified</span>';
      if (isComplex) html += '<span class="admin-pol-badge admin-pol-badge-complex">Special</span>';
      html += '</div>';

      html += '<div class="admin-pol-field"><label>Heading</label>' +
        '<input type="text" class="admin-pol-label-input" data-id="' + p.id + '" value="' + _escAttr(p.label || '') + '" autocomplete="off" spellcheck="false"></div>';
      html += '<div class="admin-pol-field"><label>Policy text</label>' +
        '<textarea class="admin-pol-text-input" data-id="' + p.id + '" rows="4" spellcheck="false">' + _escHtml(p.text || '') + '</textarea></div>';
      html += '<div class="admin-pol-field"><label>School-specific text <span class="admin-pol-opt">(optional)</span></label>' +
        '<textarea class="admin-pol-school-input" data-id="' + p.id + '" rows="3" spellcheck="false">' + _escHtml(hasSchool ? p.schoolText : '') + '</textarea></div>';

      html += '<div class="admin-tpl-actions">';
      html += '<button class="admin-tpl-save-btn admin-pol-save" data-id="' + p.id + '">Save</button>';
      if (isEdited && !isCustom) html += '<button class="admin-tpl-reset-btn admin-pol-reset" data-id="' + p.id + '">Reset to built-in</button>';
      html += '<button class="admin-tpl-reset-btn admin-pol-delete" data-id="' + p.id + '">Delete</button>';
      html += '</div>';
      html += '</div>';
    });
    html += '</div>';

    // Deleted built-in policies — offer restore
    if (_policyData.deleted.length) {
      html += '<div class="admin-pol-deleted"><h4 class="admin-pol-deleted-title">Deleted built-in policies</h4>';
      _policyData.deleted.forEach(id => {
        const d = _policyDefaults[id];
        if (!d) return;
        html += '<div class="admin-pol-deleted-row">' +
          '<span class="admin-pol-deleted-name">' + _escHtml(d.label || id) + '</span>' +
          '<button class="admin-tpl-reset-btn admin-pol-restore" data-id="' + id + '">Restore</button>' +
          '</div>';
      });
      html += '</div>';
    }

    body.innerHTML = html;
    _wirePolicyEvents();
  }

  function _wirePolicyEvents() {
    const body = document.getElementById('admin-tpl-body');
    if (!body) return;

    // Add-new toggle
    const addToggle = document.getElementById('admin-pol-add-toggle');
    const addForm = document.getElementById('admin-pol-add-form');
    if (addToggle && addForm) {
      addToggle.addEventListener('click', () => {
        _policyAddOpen = !_policyAddOpen;
        addForm.style.display = _policyAddOpen ? 'block' : 'none';
        if (_policyAddOpen) {
          const li = document.getElementById('admin-pol-new-label');
          if (li) li.focus();
        }
      });
    }

    const cancelBtn = document.getElementById('admin-pol-new-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', () => { _policyAddOpen = false; _renderPolicies(); });

    const createBtn = document.getElementById('admin-pol-new-create');
    if (createBtn) {
      createBtn.addEventListener('click', () => {
        const label = (document.getElementById('admin-pol-new-label').value || '').trim();
        const text = (document.getElementById('admin-pol-new-text').value || '').trim();
        const school = (document.getElementById('admin-pol-new-school').value || '').trim();
        if (!label) { _showToast('Please enter a heading'); return; }
        const entry = { id: 'pol_custom_' + _uid(), label: label, text: text };
        if (school) entry.schoolText = school;
        _policyData.added.push(entry);
        _savePolicyData();
        _rebuildPolicyArrayFromState();
        _refreshChecklist();
        _policyAddOpen = false;
        _renderPolicies();
        _showToast('Policy added');
      });
    }

    // Save edits
    body.querySelectorAll('.admin-pol-save').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const label = (body.querySelector('.admin-pol-label-input[data-id="' + id + '"]').value || '').trim();
        const text = body.querySelector('.admin-pol-text-input[data-id="' + id + '"]').value;
        const school = body.querySelector('.admin-pol-school-input[data-id="' + id + '"]').value;
        if (!label) { _showToast('Heading cannot be empty'); return; }

        if (_isCustomPolicy(id)) {
          const a = _policyData.added.find(x => x.id === id);
          if (a) { a.label = label; a.text = text; if (school) a.schoolText = school; else delete a.schoolText; }
        } else {
          _policyData.edits[id] = { label: label, text: text, schoolText: school };
        }
        _savePolicyData();
        _rebuildPolicyArrayFromState();
        _refreshChecklist();
        _renderPolicies();
        _showToast('Policy saved');
      });
    });

    // Reset built-in to default
    body.querySelectorAll('.admin-pol-reset').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        if (!confirm('Reset this policy to its built-in heading and text?')) return;
        delete _policyData.edits[id];
        _savePolicyData();
        _rebuildPolicyArrayFromState();
        _refreshChecklist();
        _renderPolicies();
        _showToast('Reset to built-in');
      });
    });

    // Delete
    body.querySelectorAll('.admin-pol-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        if (!confirm('Delete this policy? It will be removed from the policy checklist for all businesses.')) return;
        if (_isCustomPolicy(id)) {
          _policyData.added = _policyData.added.filter(a => a.id !== id);
        } else {
          if (_policyData.deleted.indexOf(id) === -1) _policyData.deleted.push(id);
          delete _policyData.edits[id];
        }
        _savePolicyData();
        _rebuildPolicyArrayFromState();
        _refreshChecklist();
        _renderPolicies();
        _showToast('Policy deleted');
      });
    });

    // Restore a deleted built-in policy
    body.querySelectorAll('.admin-pol-restore').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        _policyData.deleted = _policyData.deleted.filter(x => x !== id);
        _savePolicyData();
        _rebuildPolicyArrayFromState();
        _refreshChecklist();
        _renderPolicies();
        _showToast('Policy restored');
      });
    });
  }

  // ── Line-height manager ──
  function _renderLineHeights() {
    const body = document.getElementById('admin-tpl-body');
    if (!body) return;
    const store = _loadLineHeights();

    let html = '<div class="admin-lh-wrap">';
    html += '<div class="admin-lh-head">';
    html += '<h2>Document Line Heights</h2>';
    html += '<p>Line spacing used across the generated documents. Changes apply live to the preview and carry through to the exported PDF. Leave a box blank (or press Reset) to use the default.</p>';
    html += '</div>';

    LINE_HEIGHTS.forEach(lh => {
      const raw = store[lh.id];
      const cur = (raw != null && raw !== '' && !isNaN(Number(raw))) ? Number(raw) : '';
      const isMod = cur !== '' && cur !== lh.def;
      html += '<div class="admin-lh-row">';
      html += '<div class="admin-lh-info">';
      html += `<div class="admin-lh-label">${_escHtml(lh.label)}${isMod ? ' <span class="admin-lh-mod">edited</span>' : ''}</div>`;
      html += `<div class="admin-lh-desc">${_escHtml(lh.desc)}</div>`;
      html += '</div>';
      html += '<div class="admin-lh-ctrl">';
      html += `<input type="number" class="admin-lh-input" data-id="${lh.id}" step="0.01" min="0.8" max="3" value="${cur}" placeholder="${lh.def}">`;
      html += `<button class="admin-lh-reset" data-id="${lh.id}" title="Reset to ${lh.def}">Reset</button>`;
      html += '</div>';
      html += '</div>';
    });

    html += '<div class="admin-lh-footer"><button class="admin-lh-resetall">Reset all to defaults</button></div>';
    html += '</div>';
    body.innerHTML = html;

    body.querySelectorAll('.admin-lh-input').forEach(inp => {
      inp.addEventListener('input', () => {
        _setLineHeight(inp.dataset.id, inp.value.trim());
        // Refresh the "edited" badge without stealing focus from the input.
        const lh = LINE_HEIGHTS.find(x => x.id === inp.dataset.id);
        const badgeHost = inp.closest('.admin-lh-row').querySelector('.admin-lh-label');
        const v = inp.value.trim();
        const mod = v !== '' && !isNaN(Number(v)) && Number(v) !== lh.def;
        badgeHost.innerHTML = `${_escHtml(lh.label)}${mod ? ' <span class="admin-lh-mod">edited</span>' : ''}`;
      });
    });

    body.querySelectorAll('.admin-lh-reset').forEach(btn => {
      btn.addEventListener('click', () => {
        _setLineHeight(btn.dataset.id, '');
        _renderLineHeights();
        _showToast('Reset to default');
      });
    });

    body.querySelector('.admin-lh-resetall').addEventListener('click', () => {
      _lineHeights = {};
      _saveLineHeights();
      _applyLineHeights();
      _regenDocument();
      _renderLineHeights();
      _showToast('All line heights reset');
    });
  }

  // ── Document-variable editor (geometry / typography / colours) ──
  function _fontLabel(f) {
    if (f === 'inherit') return 'Inherit (same as body)';
    return f.replace(/^['"]?([^'",]+)['"]?.*$/, '$1');
  }
  function _toHex(v) {
    return (typeof v === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim())) ? v.trim() : '#111111';
  }
  function _flagEdited(inp) {
    const row = inp.closest('.admin-lh-row');
    if (!row) return;
    const lbl = row.querySelector('.admin-lh-label');
    if (!lbl) return;
    const base = lbl.textContent.replace(/\s*edited\s*$/, '');
    const has = String(inp.value).trim() !== '';
    lbl.innerHTML = `${_escHtml(base)}${has ? ' <span class="admin-lh-mod">edited</span>' : ''}`;
  }

  const _DOCVAR_META = {
    geometry:   { title: 'Page Geometry', intro: 'Page size and margins for every generated sheet — applied live to the preview and carried into the exported PDF. Values are in millimetres. Leave a box blank (or press Reset) to use the default.' },
    typography: { title: 'Typography',    intro: 'Fonts and base text size for the generated document. Applied live to the preview and the PDF. Changing the size reflows pagination.' },
    colours:    { title: 'Document Colours', intro: 'Colours used inside the generated document. Applied live to the preview and the PDF.' },
  };

  function _renderDocVars(kind) {
    const body = document.getElementById('admin-tpl-body');
    if (!body) return;
    const defs = _docVarGroup(kind);
    const meta = _DOCVAR_META[kind];
    const store = _loadDocVars();

    let html = '<div class="admin-lh-wrap">';
    html += `<div class="admin-lh-head"><h2>${_escHtml(meta.title)}</h2><p>${_escHtml(meta.intro)}</p></div>`;

    defs.forEach(d => {
      const raw = store[d.id];
      const has = raw != null && raw !== '';
      html += '<div class="admin-lh-row"><div class="admin-lh-info">';
      html += `<div class="admin-lh-label">${_escHtml(d.label)}${has ? ' <span class="admin-lh-mod">edited</span>' : ''}</div>`;
      html += `<div class="admin-lh-desc">${_escHtml(d.desc)}</div></div>`;
      html += '<div class="admin-lh-ctrl">';
      if (d.type === 'font') {
        const cur = has ? raw : d.def;
        html += `<select class="admin-dv-select" data-id="${d.id}">`;
        FONT_OPTIONS.forEach(f => {
          html += `<option value="${_escAttr(f)}"${f === cur ? ' selected' : ''}>${_escHtml(_fontLabel(f))}</option>`;
        });
        html += '</select>';
      } else if (d.type === 'colour') {
        const cur = has ? raw : d.def;
        html += `<input type="color" class="admin-dv-colour" data-id="${d.id}" value="${_escAttr(_toHex(cur))}" title="Pick colour">`;
        html += `<input type="text" class="admin-dv-text" data-id="${d.id}" value="${_escAttr(has ? String(raw) : '')}" placeholder="${_escAttr(d.def)}">`;
      } else {
        const cur = (has && !isNaN(Number(raw))) ? Number(raw) : '';
        html += `<input type="number" class="admin-lh-input" data-id="${d.id}" step="${d.step}" min="${d.min}" max="${d.max}" value="${cur}" placeholder="${d.def}">`;
        if (d.unit) html += `<span class="admin-dv-unit">${_escHtml(d.unit)}</span>`;
      }
      html += `<button class="admin-lh-reset" data-id="${d.id}" title="Reset to ${_escAttr(String(d.def))}">Reset</button>`;
      html += '</div></div>';
    });

    html += `<div class="admin-lh-footer"><button class="admin-dv-resetall">Reset all to defaults</button></div>`;
    html += '</div>';
    body.innerHTML = html;

    body.querySelectorAll('.admin-lh-input').forEach(inp => {
      inp.addEventListener('input', () => { _setDocVar(inp.dataset.id, inp.value.trim()); _flagEdited(inp); });
    });
    body.querySelectorAll('.admin-dv-select').forEach(sel => {
      sel.addEventListener('change', () => {
        const def = defs.find(x => x.id === sel.dataset.id);
        // Selecting the default value clears the override so it stays "not edited".
        _setDocVar(sel.dataset.id, (def && sel.value === def.def) ? '' : sel.value);
        _renderDocVars(kind);
      });
    });
    body.querySelectorAll('.admin-dv-colour').forEach(c => {
      c.addEventListener('input', () => {
        _setDocVar(c.dataset.id, c.value);
        const t = body.querySelector(`.admin-dv-text[data-id="${c.dataset.id}"]`);
        if (t) t.value = c.value;
        _flagEdited(c);
      });
    });
    body.querySelectorAll('.admin-dv-text').forEach(t => {
      t.addEventListener('change', () => {
        const v = t.value.trim();
        _setDocVar(t.dataset.id, v);
        const c = body.querySelector(`.admin-dv-colour[data-id="${t.dataset.id}"]`);
        if (c && v) c.value = _toHex(v);
        _flagEdited(t);
      });
    });
    body.querySelectorAll('.admin-lh-reset').forEach(btn => {
      btn.addEventListener('click', () => { _setDocVar(btn.dataset.id, ''); _renderDocVars(kind); _showToast('Reset to default'); });
    });
    body.querySelector('.admin-dv-resetall').addEventListener('click', () => {
      _loadDocVars();
      defs.forEach(d => { delete _docVars[d.id]; });
      _saveDocVars();
      _applyDocVars();
      _regenDocument();
      _renderDocVars(kind);
      _showToast('Reset to defaults');
    });
  }

  // ── Firm-identity editor (cover signatory line + footer) ──
  function _renderBrand() {
    const body = document.getElementById('admin-tpl-body');
    if (!body) return;
    _loadBrand();

    let html = '<div class="admin-lh-wrap">';
    html += '<div class="admin-lh-head"><h2>Firm &amp; Signatures</h2><p>The firm name shown on the cover signatory line and in the page footer of the generated document. Applied live to the preview and the PDF. Leave a box blank (or press Reset) to use the default.</p></div>';

    BRAND_FIELDS.forEach(f => {
      const cur = _brand[f.id];
      const has = cur != null && cur !== '';
      html += '<div class="admin-lh-row" style="align-items:flex-start;"><div class="admin-lh-info">';
      html += `<div class="admin-lh-label">${_escHtml(f.label)}${has ? ' <span class="admin-lh-mod">edited</span>' : ''}</div>`;
      html += `<div class="admin-lh-desc">${_escHtml(f.desc)}</div>`;
      html += `<input type="text" class="admin-brand-input" data-id="${f.id}" value="${_escAttr(has ? String(cur) : '')}" placeholder="${_escAttr(f.def)}">`;
      html += '</div>';
      html += `<div class="admin-lh-ctrl"><button class="admin-lh-reset" data-id="${f.id}" title="Reset to ${_escAttr(f.def)}">Reset</button></div>`;
      html += '</div>';
    });

    html += '<div class="admin-lh-footer"><button class="admin-brand-resetall">Reset all to defaults</button></div>';
    html += '</div>';
    body.innerHTML = html;

    body.querySelectorAll('.admin-brand-input').forEach(inp => {
      inp.addEventListener('change', () => { _setBrand(inp.dataset.id, inp.value.trim()); _flagEdited(inp); });
    });
    body.querySelectorAll('.admin-lh-reset').forEach(btn => {
      btn.addEventListener('click', () => { _setBrand(btn.dataset.id, ''); _renderBrand(); _showToast('Reset to default'); });
    });
    body.querySelector('.admin-brand-resetall').addEventListener('click', () => {
      _loadBrand();
      BRAND_FIELDS.forEach(f => { delete _brand[f.id]; });
      _saveBrand();
      _regenDocument();
      _renderBrand();
      _showToast('Reset to defaults');
    });
  }

  // ── Letterhead-image editor (per-firm header + footer) ──
  function _renderLetterheads() {
    const body = document.getElementById('admin-tpl-body');
    if (!body) return;
    _loadLetterheads();

    let html = '<div class="admin-lh-wrap">';
    html += '<div class="admin-lh-head"><h2>Letterheads</h2><p>The header and footer images for each firm. Both firms’ defaults are the bundled INF181 letterheads shown below — upload a new image to replace one, or press Reset to return to the default. Applied live to the preview and the exported PDF.</p></div>';

    // Group by firm so both firms' header + footer sit together.
    const firms = [];
    LETTERHEAD_FIELDS.forEach(f => { if (firms.indexOf(f.firm) === -1) firms.push(f.firm); });

    firms.forEach(firm => {
      html += `<div class="admin-lh-firm"><h3 class="admin-lh-firm-title">${_escHtml(firm)}</h3>`;
      LETTERHEAD_FIELDS.filter(f => f.firm === firm).forEach(f => {
        const cur = _letterheads[f.id];
        const has = cur != null && cur !== '';
        const src = has ? cur : f.def;
        html += '<div class="admin-lh-row" style="align-items:flex-start;"><div class="admin-lh-info">';
        html += `<div class="admin-lh-label">${_escHtml(f.slot)}${has ? ' <span class="admin-lh-mod">custom</span>' : ' <span class="admin-lh-def-tag">default</span>'}</div>`;
        html += `<div class="admin-lh-desc">${_escHtml(f.desc)}</div>`;
        html += `<div class="admin-lh-preview"><img class="admin-lh-img" data-id="${f.id}" src="${_escAttr(src)}" alt="${_escAttr(f.firm + ' ' + f.slot)}"></div>`;
        html += '</div>';
        html += '<div class="admin-lh-ctrl" style="flex-direction:column;align-items:stretch;gap:8px;">';
        html += `<label class="admin-lh-upload" title="Replace this letterhead image">Replace<input type="file" accept="image/*" class="admin-lh-file" data-id="${f.id}" style="display:none;"></label>`;
        html += `<button class="admin-lh-reset" data-id="${f.id}" title="Reset to default"${has ? '' : ' disabled'}>Reset</button>`;
        html += '</div>';
        html += '</div>';
      });
      html += '</div>';
    });

    html += '<div class="admin-lh-footer"><button class="admin-lh-resetall">Reset all to defaults</button></div>';
    html += '</div>';
    body.innerHTML = html;

    body.querySelectorAll('.admin-lh-file').forEach(inp => {
      inp.addEventListener('change', () => {
        const file = inp.files && inp.files[0];
        if (!file) return;
        if (!/^image\//.test(file.type)) { _showToast('Please choose an image file'); inp.value = ''; return; }
        const reader = new FileReader();
        reader.onload = () => {
          if (_setLetterhead(inp.dataset.id, String(reader.result))) {
            _renderLetterheads();
            _showToast('Letterhead updated');
          }
        };
        reader.onerror = () => _showToast('Could not read that image');
        reader.readAsDataURL(file);
      });
    });
    body.querySelectorAll('.admin-lh-reset').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        _setLetterhead(btn.dataset.id, '');
        _renderLetterheads();
        _showToast('Reset to default');
      });
    });
    body.querySelector('.admin-lh-resetall').addEventListener('click', () => {
      _loadLetterheads();
      LETTERHEAD_FIELDS.forEach(f => { delete _letterheads[f.id]; });
      _saveLetterheads();
      _regenDocument();
      _renderLetterheads();
      _showToast('Reset to defaults');
    });
  }

  // ── Empty body placeholder ──
  function _renderEmptyBody() {
    const body = document.getElementById('admin-tpl-body');
    if (!body) return;
    body.innerHTML = '<div class="admin-tpl-empty"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg><span>Select a category to edit templates</span></div>';
  }

  // ── Template rendering with variable highlights ──
  function _renderTemplates() {
    const body = document.getElementById('admin-tpl-body');
    if (!body) return;
    const folder = _data.folders.find(f => f.id === _selectedFolderId);
    if (!folder || !_selectedCategory) { _renderEmptyBody(); return; }

    const templates = _getTemplatesForCategory(_selectedCategory);
    const isDefaultFolder = !!folder.isDefault;
    const isLocked = isDefaultFolder && !_defaultUnlocked;

    let headerHtml = '<h3 class="admin-tpl-cat-title">' + _escHtml(_selectedCategory) + '</h3>';
    if (isDefaultFolder) {
      headerHtml += '<div class="admin-default-lock-bar">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
          (isLocked
            ? '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'
            : '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 5-5 5 5 0 0 1 5 5"/>') +
        '</svg>' +
        '<span>' + (isLocked ? 'Default template is locked' : 'Default template is unlocked') + '</span>' +
        '<button class="admin-default-lock-btn" id="admin-toggle-default-lock">' +
          (isLocked ? 'Unlock to Edit' : 'Lock') +
        '</button>' +
      '</div>';
    }

    headerHtml += '<div class="admin-var-ref" id="admin-var-ref">';
    headerHtml += '<button class="admin-var-ref-toggle" id="admin-var-ref-toggle">';
    headerHtml += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h10"/></svg>';
    headerHtml += ' Variable Reference';
    headerHtml += '<span class="admin-var-ref-chevron">▸</span>';
    headerHtml += '</button>';
    headerHtml += '<div class="admin-var-ref-body" style="display:none;">';
    headerHtml += '<p class="admin-var-ref-hint">Click a variable to insert it at your cursor position.</p>';
    headerHtml += '<div class="admin-var-ref-grid">';
    VARIABLES.forEach(v => {
      headerHtml += '<button class="admin-var-ref-item" data-var="' + _escAttr(v.name) + '" title="Click to insert">';
      headerHtml += '<code class="admin-var-ref-name">' + _escHtml(v.name) + '</code>';
      headerHtml += '<span class="admin-var-ref-desc">' + _escHtml(v.description) + '</span>';
      headerHtml += '</button>';
    });
    headerHtml += '</div></div></div>';

    body.innerHTML = headerHtml +
      templates.map(t => {
        const baseText = isDefaultFolder ? t.defaultText : _getDefaultText(t.id);
        const text = folder.overrides[t.id] !== undefined ? folder.overrides[t.id] : baseText;
        const modified = folder.overrides[t.id] !== undefined;
        const resetLabel = isDefaultFolder ? 'Reset to Built-in' : 'Reset to Default';
        return '<div class="admin-tpl-item' + (isLocked ? ' is-locked' : '') + '" data-id="' + t.id + '">' +
          '<div class="admin-tpl-header">' +
            '<span class="admin-tpl-label">' + _escHtml(t.label) + '</span>' +
            (modified ? '<span class="admin-tpl-modified">Modified</span>' : '') +
          '</div>' +
          '<div class="admin-tpl-editor">' +
            '<div class="admin-tpl-highlights" data-id="' + t.id + '" aria-hidden="true">' + _highlightVars(text) + '</div>' +
            '<textarea class="admin-tpl-textarea" data-id="' + t.id + '" rows="6" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off"' + (isLocked ? ' disabled' : '') + '>' + _escHtml(text) + '</textarea>' +
          '</div>' +
          '<div class="admin-tpl-actions">' +
            '<button class="admin-tpl-save-btn" data-id="' + t.id + '"' + (isLocked ? ' disabled' : '') + '>Save</button>' +
            '<button class="admin-tpl-reset-btn" data-id="' + t.id + '"' + (!modified || isLocked ? ' disabled' : '') + '>' + resetLabel + '</button>' +
          '</div>' +
        '</div>';
      }).join('');

    // Lock toggle for Default folder
    const lockBtn = document.getElementById('admin-toggle-default-lock');
    if (lockBtn) {
      lockBtn.addEventListener('click', () => {
        _defaultUnlocked = !_defaultUnlocked;
        _renderTemplates();
      });
    }

    // Sync highlights with textareas
    body.querySelectorAll('.admin-tpl-textarea').forEach(ta => {
      const hl = body.querySelector('.admin-tpl-highlights[data-id="' + ta.dataset.id + '"]');
      if (!hl) return;
      ta.addEventListener('input', () => { hl.innerHTML = _highlightVars(ta.value); });
      ta.addEventListener('scroll', () => { hl.scrollTop = ta.scrollTop; hl.scrollLeft = ta.scrollLeft; });
    });

    // Save buttons
    body.querySelectorAll('.admin-tpl-save-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const ta = body.querySelector('textarea[data-id="' + id + '"]');
        if (!ta) return;
        const tpl = TEMPLATES.find(t => t.id === id);
        if (!tpl) return;
        const baseText = folder.isDefault ? tpl.defaultText : _getDefaultText(id);
        if (ta.value === baseText) delete folder.overrides[id];
        else folder.overrides[id] = ta.value;
        _save();
        _renderSidebar();
        _renderTemplates();
        _showToast('Template saved');
      });
    });

    // Reset buttons
    body.querySelectorAll('.admin-tpl-reset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const msg = folder.isDefault
          ? 'Reset this template to its built-in text?'
          : 'Reset this template to the Default template?';
        if (!confirm(msg)) return;
        delete folder.overrides[id];
        _save();
        _renderSidebar();
        _renderTemplates();
        _showToast(folder.isDefault ? 'Reset to built-in' : 'Reset to default');
      });
    });

    // Variable reference toggle
    const varRefToggle = document.getElementById('admin-var-ref-toggle');
    if (varRefToggle) {
      varRefToggle.addEventListener('click', () => {
        const refBody = document.querySelector('.admin-var-ref-body');
        const chevron = document.querySelector('.admin-var-ref-chevron');
        if (refBody) {
          const show = refBody.style.display === 'none';
          refBody.style.display = show ? 'block' : 'none';
          if (chevron) chevron.textContent = show ? '▾' : '▸';
        }
      });
    }

    // Click-to-insert variables
    body.querySelectorAll('.admin-var-ref-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const varName = btn.dataset.var;
        const activeTextarea = body.querySelector('.admin-tpl-textarea:focus');
        if (activeTextarea && !activeTextarea.disabled) {
          const start = activeTextarea.selectionStart;
          const end = activeTextarea.selectionEnd;
          const text = activeTextarea.value;
          activeTextarea.value = text.slice(0, start) + varName + text.slice(end);
          activeTextarea.selectionStart = activeTextarea.selectionEnd = start + varName.length;
          activeTextarea.focus();
          activeTextarea.dispatchEvent(new Event('input'));
        }
      });
    });
  }

  // ── Variable highlighting ──
  function _highlightVars(text) {
    return _escHtml(text).replace(/\[([A-Z][A-Z_]*)\]/g, '<span class="admin-var">[$1]</span>');
  }

  // ── Utility ──
  function _escHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _escAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function _showToast(msg) {
    let toast = document.getElementById('admin-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'admin-toast';
      toast.className = 'admin-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 2000);
  }

  // ── Init ──
  _load();
  _applyPolicyOverrides();
  _applyLineHeights();
  _applyDocVars();

  // ── Public API ──
  async function open() {
    const ok = await _showPasswordPrompt();
    if (ok) _openPanel();
  }

  function close() { _closePanel(); }

  return {
    open,
    close,
    getTemplate,
    setTemplate,
    resetTemplate,
    resetAll,
    isModified,
    getBrand,
    getLetterhead,
    TEMPLATES,
    VARIABLES
  };
})();
