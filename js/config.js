// config.js — Pure data constants (ENTITY_CONFIG, accountingPolicies, letterheads)
// Depends on: (none)

// ── Letterhead images (base64) ──
const CA_LETTERHEAD = "images/letterhead-header.png";
const AUDIT_LETTERHEAD = "images/Audit-letterhead-header.png";
const LETTERHEAD_FOOTER_IMG = "images/letterhead-footer.png";
const AUDIT_FOOTER_IMG = "images/Audit-letterhead-footer.png";

// ── School education department ──
// Schools report to a provincial education department, named in the school
// policies and in the school engagement letters. It is Mpumalanga for almost
// every client, so that stays the default, but the field is editable — a school
// in another province (or one that should carry a postal address instead) types
// its own wording and every [EDU_DEPT] placeholder follows.
const DEFAULT_EDU_DEPT = 'Mpumalanga Department of Education';

// ── NPC organisation wording ──
// The NPC-only policies name the entity in general terms rather than by its
// registered name — "the centre", "the organisation", "the association", and so
// on. There is no sensible fixed wording, so the field is free text: whatever
// the user types replaces every [NPC_ORG] placeholder, and an empty field falls
// back to the default below.
const DEFAULT_NPC_ORG = 'centre/organisation';

// ── NPO organisation wording ──
// The NPO-only policies call the entity "the organisation", "the club" or "the
// centre" — a dropdown shown in the policy text where [NPO_ORG] sits, and again
// in Step 4 above the governing body. Every [NPO_ORG] in the NPO policies,
// engagement letters and auditor's report follows it.
const NPO_ORG_OPTIONS = ['organisation', 'club', 'centre'];
const DEFAULT_NPO_ORG = 'organisation';

// ── NPO department wording ──
// The NPO Capital Expenditure policy names the department that owns the
// assets: "the [NPO_DEPT] of [NPO_DEPT_OF]". [NPO_DEPT] is free text (the
// province's department, Mpumalanga by default); [NPO_DEPT_OF] is a fixed
// choice. Both are picked in the policy text itself, where the token sits.
const DEFAULT_NPO_DEPT = 'Mpumalanga Department';
const NPO_DEPT_OF_OPTIONS = ['Social Development', 'Education'];
const DEFAULT_NPO_DEPT_OF = 'Social Development';

// ── PPE write-off statement wording ──
// The school and NPO "No Asset Register" and "Transitional Write-off" PPE
// policies name the statement assets are written off in — "Financial
// Performance" or "Surplus or Deficit", picked from a dropdown in the policy
// text where the token sits. One field, shared by all four policies.
const PPE_STMT_OPTIONS = ['Financial Performance', 'Surplus or Deficit'];
const DEFAULT_PPE_STMT = 'Financial Performance';



// ── ACCOUNTING POLICY GROUPS ──
// Logical sections for the policy checklist. `accountingPolicies` below is kept
// in this same order, so the numbering the auditor sees in the checklist and the
// order the notes print in the document both follow the statement's own logic:
// basis of preparation → assets → liabilities → income and expenses → other.
// A policy without a `group` (e.g. one added through the admin panel) falls into
// the last group.
const POLICY_GROUPS = [
  { id: 'basis', label: 'Basis of Preparation', hint: 'The reporting framework the statements are prepared under.' },
  { id: 'assets_nc', label: 'Non-Current Assets', hint: 'Property, plant and equipment, investments, intangibles, biological assets and leases.' },
  { id: 'assets_c', label: 'Current Assets', hint: 'Inventory, receivables and cash.' },
  { id: 'liabilities_nc', label: 'Non-Current Liabilities', hint: 'Long-term loans and deferred taxation.' },
  { id: 'liabilities_c', label: 'Current Liabilities', hint: 'Provisions and trade and other payables.' },
  { id: 'income', label: 'Income and Expenses', hint: 'How revenue, other income and expenses are recognised.' },
  { id: 'other', label: 'Other Notes', hint: 'Notes that follow the accounting policies and keep their own number.' },
];
const POLICY_GROUP_FALLBACK = 'other';

// ── ACCOUNTING POLICIES ──
const accountingPolicies = [
  // ── Basis of preparation ──
  {
    id: 'pol_framework',
    label: '1. Accounting Policy',
    originalNum: '1',
    group: 'basis',
    // For schools this policy is listed in the School-Only block (with the FRFFS
    // wording below) rather than in Basis of Preparation.
    schoolListed: true,
    schoolLabel: '1. Accounting Policy — School (FRFFS)',
    // Non-profit companies use the same IFRS for SMEs basis, plus the donation
    // cash-collection limitation. [NPC_ORG] is the free-text name the user types
    // for the entity ("the centre", "the organisation", …).
    npcListed: true,
    npcLabel: '1. Accounting Policy — NPC',
    // Non-profit organisations: same wording, with the entity called "the
    // organisation" or "the centre" ([NPO_ORG], chosen in the NPO block).
    npoListed: true,
    npoLabel: '1. Accounting Policy — NPO',
    npoText: 'The annual financial statements are presented in accordance with International Financial Reporting Standards for Small and Medium-sized Entities and are prepared on the historical cost basis. The principal policies are consistent with those applied in the previous year, except where indicated otherwise.<br><br>It is not feasible for the [NPO_ORG] to institute accounting controls over cash collections from donations prior to initial entry of the collections in the accounting records.',
    npcText: 'The annual financial statements are presented in accordance with International Financial Reporting Standards for Small and Medium-sized Entities and are prepared on the historical cost basis. The principal policies are consistent with those applied in the previous year, except where indicated otherwise.<br><br>It is not feasible for the [NPC_ORG] to institute accounting controls over cash collections from donations prior to initial entry of the collections in the accounting records.',
    text: 'The annual financial statements are presented in accordance with International Financial Reporting Standards for Small and Medium-sized Entities and are prepared on the historical cost basis. The principal policies are consistent with those applied in the previous year, except where indicated otherwise.',
    schoolText: 'The annual financial statements are presented in accordance with the Financial Reporting Framework for Schools (FRFFS) and are prepared on the historical cost basis. The principal policies are consistent with those applied in the previous year, except where indicated otherwise.<br><br>It is not feasible for the school to institute accounting controls over cash collections from donations prior to initial entry of the collections in the accounting records.'
  },
  // ── Non-current assets ──
  {
    id: 'pol_ppe',
    label: '1.1 Property, Plant and Equipment',
    originalNum: '1.1',
    group: 'assets_nc',
    // Schools with an asset register use this policy; it is listed in the
    // School-Only block alongside the no-register and transitional variants.
    schoolListed: true,
    schoolLabel: '1.1 Property, Plant and Equipment — Asset Register',
    // NPOs get the same three school PPE variants: this one (with the school
    // wording and depreciation rates) plus the two npoOnly copies below.
    npoListed: true,
    npoLabel: '1.1 Property, Plant and Equipment — Asset Register',
    npoText: 'Property, plant and equipment are stated at cost less accumulated depreciation.<br>Property, plant and equipment are depreciated in equal annual amounts to write off each asset over its estimated useful economic life. Assets are depreciated at the following rates:',
    text: 'Property, plant and equipment are stated at cost, including the cost to prepare the assets for their intended use, less accumulated depreciation. Property, plant and equipment, with the exception of land and buildings and personal assets, are depreciated in equal annual amounts to write off each asset over its estimated useful economic life. Investment properties are not depreciated.',
    depreciationRatesIntro: 'Other assets are depreciated at the following rates:',
    ppeDepreciationToggleEntities: ['bc', 'cc', 'company', 'trust'],
    schoolText: 'Property, plant and equipment are stated at cost less accumulated depreciation.<br>Property, plant and equipment are depreciated in equal annual amounts to write off each asset over its estimated useful economic life. Assets are depreciated at the following rates:',
    subItems: [
      { id: 'pol_ppe_farming', label: 'Farming Equipment', rateOptions: ['50% / 30% / 20%', '20%', '33%', '10%', 'Other'] },
      { id: 'pol_ppe_implements', label: 'Implements', rateOptions: ['10%', '50% / 30% / 20%', '20%', '33%', 'Other'] },
      { id: 'pol_ppe_vehicles', label: 'Vehicles', rateOptions: ['50% / 30% / 20%', '20%', '33%', '10%', 'Other'] },
      { id: 'pol_ppe_medical', label: 'Medical Equipment', rateOptions: ['50% / 30% / 20%', '20%', '33%', '10%', 'Other'] },
      { id: 'pol_ppe_furniture', label: 'Furniture and Fittings', rateOptions: ['50% / 30% / 20%', '20%', '16.66%', '33%', '10%', 'Other'] },
      { id: 'pol_ppe_furniture_equipment', label: 'Furniture and Equipment', rateOptions: ['16.66%', '50% / 30% / 20%', '20%', '33%', '10%', 'Other'] },
      { id: 'pol_ppe_office', label: 'Office Equipment', rateOptions: ['50% / 30% / 20%', '20%', '33%', '33.33%', '10%', 'Other'] },
      { id: 'pol_ppe_computer', label: 'Computer Equipment', rateOptions: ['50% / 30% / 20%', '20%', '33%', '33.33%', '10%', 'Other'] },
      { id: 'pol_ppe_equipment', label: 'Equipment', rateOptions: ['16.66%', '50% / 30% / 20%', '20%', '33%', '33.33%', '10%', 'Other'] },
      { id: 'pol_ppe_land', label: 'Land and Buildings', isLandAndBuildings: true },
    ],
    textSuffix: 'Land and buildings are valuated from time to time to ensure that the net realisable value of these assets still exceeds the original cost of the property. Should the realisable value be less than the original cost the assets will be revalued to the realisable value.'
  },
  {
    id: 'pol_ppe_no_register',
    label: '1.1 Property, Plant and Equipment — No Asset Register',
    // The "— …" half of the label only exists to tell the two school PPE
    // variants apart in the checkbox list. `heading` is what the note prints.
    heading: 'Property, Plant and Equipment',
    originalNum: '1.1',
    group: 'assets_nc',
    schoolOnly: true,
    text: 'Property, plant and equipment is not capitalised in the statement of financial position, due to the fact that it is seen as departmental assets. Thus property, plant and equipment is written off immediately as capital expenses in the statement of [PPE_STMT] income.'
  },
  {
    id: 'pol_ppe_transitional',
    label: '1.1 Property, Plant and Equipment — Transitional Write-off',
    heading: 'Property, Plant and Equipment',
    originalNum: '1.1',
    group: 'assets_nc',
    schoolOnly: true,
    text: 'In previous years assets were capitalised and disclosed in a Register of Property, Plant and Equipment. Property, plant and equipment was written-off in full during this financial year. Future purchases of assets will be written-off as capital expenditure in the Statement of [PPE_STMT] for the year.'
  },
  {
    // NPO copies of the two school-only PPE variants above, listed in the
    // NPO-Only block next to the asset-register one (pol_ppe, npoListed).
    id: 'pol_ppe_no_register_npo',
    label: '1.1 Property, Plant and Equipment — No Asset Register',
    heading: 'Property, Plant and Equipment',
    originalNum: '1.1',
    group: 'assets_nc',
    npoOnly: true,
    text: 'Property, plant and equipment is not capitalised in the statement of financial position, due to the fact that it is seen as departmental assets. Thus property, plant and equipment is written off immediately as capital expenses in the statement of [PPE_STMT] income.'
  },
  {
    id: 'pol_ppe_transitional_npo',
    label: '1.1 Property, Plant and Equipment — Transitional Write-off',
    heading: 'Property, Plant and Equipment',
    originalNum: '1.1',
    group: 'assets_nc',
    npoOnly: true,
    text: 'In previous years assets were capitalised and disclosed in a Register of Property, Plant and Equipment. Property, plant and equipment was written-off in full during this financial year. Future purchases of assets will be written-off as capital expenditure in the Statement of [PPE_STMT] for the year.'
  },
  {
    id: 'pol_capex',
    label: '1.8 Capital Expenditure',
    originalNum: '1.8',
    group: 'assets_nc',
    schoolOnly: true,
    text: 'Movable fixed assets are not capitalised as all these assets are regarded as property of the [EDU_DEPT] / Social Development. Assets purchased during any year under review are written-off as an expense under Capital Expenditure in the Statement of Financial Performance for the year.'
  },
  {
    // NPO counterpart of the school policy above, listed in the NPO-Only block.
    id: 'pol_capex_npo',
    label: '1.8 Capital Expenditure',
    originalNum: '1.8',
    group: 'assets_nc',
    npoOnly: true,
    text: 'Moveable fixed assets are not capitalised as all these assets are regarded as property of the [NPO_DEPT] of [NPO_DEPT_OF]. Assets purchased during any year under review are written off as expense under capital expenditure in the statement of surplus or deficit for the year.'
  },
  {
    id: 'pol_investments',
    label: '1.2 Unlisted Investments (at Cost)',
    originalNum: '1.2',
    group: 'assets_nc',
    text: 'Unlisted investments are stated at cost to the entity, less amounts written off as permanent diminution in the value of investments.'
  },
  {
    id: 'pol_investments_other_cost',
    label: '1.2 Other Investments (at Cost)',
    originalNum: '1.2',
    group: 'assets_nc',
    text: 'Other investments are stated at cost to the entity, less amounts written off as permanent diminution in the value of investments.'
  },
  {
    id: 'pol_investments_market',
    label: '1.2 Other Investments (at Market Value)',
    originalNum: '1.2',
    group: 'assets_nc',
    guide: 'Use this instead of an "at Cost" investments policy above when the Investments note shows the investments at market value and not at cost.',
    text: 'Other investments are accounted for at market value. The market value of managed fund investments are calculated by reference to the quoted market price at the close of business on the reporting date. The gain or loss on remeasurement to market value are recognised in profit or loss within the statement of comprehensive income in the period in which they arise.'
  },
  {
    id: 'pol_crypto',
    label: '1.3 Intangible Assets (Crypto Assets)',
    originalNum: '1.3',
    group: 'assets_nc',
    text: 'A crypto asset is a digital representation of value that is not issued by a central bank, but is traded, transferred and stored electronically by natural and legal persons for the purpose of payment, investment and other forms of utility, and applies cryptography techniques in the underlying technology. The crypto assets are measured at cost on initial recognition and are subsequently measured at cost less accumulated amortisation and impairment losses.'
  },
  {
    id: 'pol_goodwill',
    label: '1.3 Goodwill',
    originalNum: '1.3',
    group: 'assets_nc',
    text: 'Goodwill is carried at cost to the entity, less amounts written off as permanent diminution in the value of Goodwill.'
  },
  {
    id: 'pol_subsidiaries',
    label: '1.4 Associated Companies and Subsidiaries',
    originalNum: '1.4',
    group: 'assets_nc',
    text: 'Investments in subsidiaries and associated companies are carried at cost, less amounts written off as permanent diminution in the value of these investments. The results of the Subsidiaries are not consolidated in the financial statements of the holding company as per the decision of the directors.',
    // An NPO's governing body is members or directors (Step 4).
    npoText: 'Investments in subsidiaries and associated companies are carried at cost, less amounts written off as permanent diminution in the value of these investments. The results of the Subsidiaries are not consolidated in the financial statements of the holding company as per the decision of the [NPO_BODY].'
  },
  {
    id: 'pol_ltloans_granted',
    label: '1.5 Long-Term Loans Granted',
    originalNum: '1.5',
    group: 'assets_nc',
    text: 'Long-term loans are carried at nominal value. Loans to related parties are carried at nominal value and no short-term portion is recognised as there is no fixed repayment schedule determined on these loans.'
  },
  {
    id: 'pol_biological',
    label: '1.6 Biological Assets',
    originalNum: '1.6',
    group: 'assets_c',
    text: 'Biological assets which consists of different components are accounted for as follows:',
    subItems: [
      { id: 'pol_bio_harvest', label: '1.6.1 Harvest on Land', bodyTextOptions: [
        "Harvest on land is shown at director's/trustee's/member's valuation.",
        "No harvest on land is shown in the financial statements due to the uncertainty of supplying it."
      ] },
      { id: 'pol_bio_livestock', label: '1.6.2 Livestock on Hand', bodyText: 'Livestock on hand is shown at the net realisable value at year end, which is determined by the owners/directors/trustees/members.' },
    ],
    isBio: true
  },
  {
    id: 'pol_leases',
    label: '1.18 Leased Assets',
    originalNum: '1.18',
    group: 'assets_nc',
    text: 'Leases are classified as finance leases where substantially all risks and rewards associated with ownership of an asset are transferred from the lessor to the entity as lessee. Assets classified as finance leases are capitalised at their cash cost equivalent, with the related lease obligation recognised at the same value. Capitalised leased assets are depreciated over their estimated useful lives, limited to the duration of the lease agreement. Finance lease payments are allocated, using the effective interest rate method, between finance costs and the capital repayment which reduces the liability to the lessor.<br><br>Operating leases are all leases not classified as finance leases. Operating lease rentals are charged against operating profits as they become due.'
  },
  {
    id: 'pol_impairment',
    label: '1.4 Impairment',
    originalNum: '1.4',
    group: 'assets_nc',
    text: "The carrying amount of the entity's assets are reviewed at each balance sheet date to determine whether there is any indication of impairment. If there is any indication that an asset may be impaired, its recoverable amount is estimated. The recoverable amount is the higher of its net selling price and its value in use."
  },

  // ── Current assets ──
  {
    id: 'pol_inventory',
    label: '1.7 Inventory',
    originalNum: '1.7',
    group: 'assets_c',
    text: 'Inventory is stated at the lower of cost or net realisable value. The cost of inventory is generally determined by means of the first-in-first-out method, with production costs, which includes direct labour, an appropriate portion of overheads and other direct costs, but excludes interest. Net realisable value is the estimate of the selling price, less the costs of completion and selling expenses. Write-offs are made in the valuation for obsolete, unusable and unsalable inventory and for latent damage first revealed when stock items are taken into use or offered for sale.',
    schoolText: 'No inventory is shown, as consumables is expensed in the Statement of Financial Performance on date of invoice.'
  },
  {
    id: 'pol_clothing_inventory',
    label: '1.3 Clothing Inventory',
    originalNum: '1.3',
    group: 'assets_c',
    schoolOnly: true,
    text: 'No Inventory is shown except for clothing inventory.'
  },
  {
    id: 'pol_receivables',
    label: '1.8 Trade and Other Receivables',
    originalNum: '1.8',
    group: 'assets_c',
    schoolListed: true,
    text: 'Trade and other receivables are carried at nominal value. An estimate is made for doubtful receivables based on a review of all outstanding amounts at the year-end. Bad debts are written off during the year in which they are identified.',
    schoolText: 'Trade and other receivables are stated at nominal value. School fees outstanding at year-end are written off as a result of the uncertainty of its collection, as well as a method to display the correct cash income for the school for a specific year. All debtors recovered after the financial year end are shown as bad debts recovered in the subsequent financial year.'
  },
  {
    id: 'pol_cash',
    label: '1.9 Cash and Cash Equivalents',
    originalNum: '1.9',
    group: 'assets_c',
    text: 'For purposes of the statement of cash flow, cash and cash equivalents comprise cash on hand, deposits held at call with banks and investments in money market instruments, and net of bank overdrafts.',
    schoolText: 'Cash and cash equivalents are shown on the statement of financial position at nominal value. Cash and cash equivalents consists of cash on hand, short-term deposits at banks and a cheque account.',
    // For NPOs this policy is listed in the NPO-Only block with its own wording.
    npoListed: true,
    npoText: 'Cash and cash equivalents are shown on the statement of financial position at nominal value. Cash and cash equivalents consist of cash on hand, a short-term deposit at a bank, and a check account.'
  },

  // ── Liabilities ──
  {
    id: 'pol_provisions',
    label: '1.10 Provisions',
    originalNum: '1.10',
    group: 'liabilities_c',
    text: 'Provisions are recognised when the entity has a present legal or constructive obligation as a result of past events, it is probable that an outflow of resources embodying economic benefits will be required to settle the obligation and a reliable estimate of the amount of the obligation can be made.'
  },
  {
    id: 'pol_ltloans',
    label: '1.11 Long-Term Loans',
    originalNum: '1.11',
    group: 'liabilities_nc',
    text: 'Long-term loans are carried at nominal value less the short-term portion of the loan. Loans from related parties are carried at nominal value and no short-term portion is recognised as there is no fixed repayment schedule determined on these loans.'
  },
  {
    id: 'pol_tax_npc',
    label: '1.6 Taxation — Section 21 Company',
    // The "— …" half of the label only tells this variant apart in the checkbox
    // list; `heading` is what the note prints.
    heading: 'Taxation',
    originalNum: '1.6',
    group: 'liabilities_c',
    npcOnly: true,
    text: 'No provision has been made for income taxation, as the [NPC_ORG] is a section 21 company.'
  },
  {
    id: 'pol_tax_hoa',
    label: '1.6 Taxation — Section 10(1)(e)',
    // Home owners associations only. The "— …" half of the label tells this
    // variant apart in the checkbox list; `heading` is what the note prints.
    hoaLabel: '1.6 Taxation',
    heading: 'Taxation',
    originalNum: '1.6',
    group: 'liabilities_c',
    hoaOnly: true,
    text: 'No provision has been made for income tax, as the entity qualifies for exemption under Section 10(1)(e).'
  },
  {
    id: 'pol_deftax',
    label: '1.12 Deferred Taxation',
    originalNum: '1.12',
    group: 'liabilities_nc',
    text: 'Deferred taxation is provided, using the liability method, for all temporary differences arising between the tax basis of assets and liabilities and their carrying values for financial reporting purposes. Currently enacted tax rates are used to determine deferred taxation.',
    deferredAssetSentence: 'No deferred taxation asset is recognised.'
  },
  {
    id: 'pol_payables',
    label: '1.13 Trade and Other Payables',
    originalNum: '1.13',
    group: 'liabilities_c',
    text: 'Trade and other payables are carried at nominal value.'
  },

  // ── Income and expenses ──
  {
    id: 'pol_dividends_received',
    label: '1.14 Dividends Received',
    originalNum: '1.14',
    group: 'income',
    text: 'Dividends are recognised when the right to receive payment is established.'
  },
  {
    id: 'pol_interest',
    label: '1.15 Interest Received',
    originalNum: '1.15',
    group: 'income',
    text: 'Interest is accrued on a time-proportion basis, recognising the effective yield on the underlying assets.'
  },
  {
    id: 'pol_product_sales',
    label: '1.16 Product Sales',
    originalNum: '1.16',
    group: 'income',
    text: 'Sales are recognized upon delivery of products and customer acceptance and stated as net income after value added tax and discount.'
  },
  {
    id: 'pol_revenue',
    label: '1.17 Revenue Recognition',
    originalNum: '1.17',
    group: 'income',
    text: 'Revenue is recognized upon delivery and represents amounts received or receivable for operations in the normal course of business and is stated as net income after value added tax and discount.'
  },
  {
    id: 'pol_revenue_bc',
    label: '1.17 Revenue Recognition (Body Corporate)',
    // Listed in the Body-Corporate-Only block; the checklist shows `bcLabel`
    // there, while `label` still supplies the printed note heading.
    bcLabel: '1.17 Revenue Recognition',
    originalNum: '1.17',
    group: 'income',
    bcOnly: true,
    text: 'The ordinary levies are accounted for on a straight-line basis over the financial year and decided amongst the section owners on a participation quota basis. The annual ordinary levies are agreed and approved by the members, directors, trustees of the body corporate\'s, close corporation\'s, company\'s annual general meeting.'
  },
  {
    id: 'pol_income',
    label: '1.7 Income',
    originalNum: '1.7',
    group: 'income',
    schoolOnly: true,
    text: 'The financial statements are compiled on the basis that income is only recognized when it was actually received.'
  },
  {
    // Same policy as the school one above, listed in the NPO-Only block.
    id: 'pol_income_npo',
    label: '1.7 Income',
    originalNum: '1.7',
    group: 'income',
    npoOnly: true,
    text: 'The financial statements are compiled on the basis that income is only recognized when it was actually received.'
  },
  {
    id: 'pol_expenses_bc',
    label: '1.18 Expenses (Body Corporate)',
    bcLabel: '1.18 Expenses',
    originalNum: '1.18',
    group: 'income',
    bcOnly: true,
    text: 'Expenses are acknowledged on the accrual basis as they occur.'
  },

  // ── Other notes ──
  {
    id: 'pol_no_statements',
    label: '2. Statement of Profit or Loss and Other Comprehensive Income and Statement of Cash Flows',
    originalNum: '2',
    group: 'other',
    fixedNumber: true,
    text: 'No Statement of Profit or Loss and Other Comprehensive Income and Statement of Cash Flows had been drawn up as the entity did not trade.',
    // Each variant carries its own heading: the note may not announce a
    // statement the sentence below it says was never drawn up.
    textOptions: [
      { label: 'No Profit or Loss statement and no Cash Flow statement', heading: '2. Statement of Profit or Loss and Other Comprehensive Income and Statement of Cash Flows', text: 'No Statement of Profit or Loss and Other Comprehensive Income and Statement of Cash Flows had been drawn up as the entity did not trade.' },
      { label: 'No Profit or Loss statement', heading: '2. Statement of Profit or Loss and Other Comprehensive Income', text: 'No Statement of Profit or Loss and Other Comprehensive Income had been drawn up as the entity did not trade.' },
      { label: 'No Cash Flow statement', heading: '2. Statement of Cash Flows', text: 'No Statement of Cash Flows had been drawn up as the entity did not trade.' },
    ]
  },
  {
    id: 'pol_comparative',
    label: '10. Comparative Figures',
    originalNum: '10',
    group: 'other',
    text: 'No comparative figures are available as the company only started trading in the current year.'
  }
];

// ── IMPORTER CONFIGS ──
// Entity-type-specific settings for the label-scanning importer.
// Cell positions are discovered dynamically; only patterns and metadata here.

const IMPORTER_CONFIGS = {
  trust: {
    ecId: 'ec-trust',
    headerPattern: /^TRUSTEES$/i,
    stopPattern: /^BENEFICIARIES$/i,
    labels: { name: 'trust name', reg: 'trust number', people: 'trustee(s)' },
  },
  company: {
    ecId: 'ec-company',
    headerPattern: /^DIRECTORS$/i,
    stopPattern: /^SHAREHOLDERS$/i,
    importShareholders: true,
    labels: { name: 'company name', reg: 'reg number', people: 'director(s)' },
  },
  cc: {
    ecId: 'ec-cc',
    headerPattern: /^MEMBERS$/i,
    labels: { name: 'CC name', reg: 'CK number', people: 'member(s)' },
  },
  npo: {
    ecId: 'ec-npo',
    headerPattern: /^DIRECTORS$/i,
    labels: { name: 'organisation name', reg: 'NPO number', people: 'director(s)' },
  },
  // A non-profit company registers under the Companies Act like any other
  // company, but its governing body may be styled either directors or members —
  // Registry lists whichever the register carries, so both headers are matched.
  npc: {
    ecId: 'ec-npc',
    headerPattern: /^(DIRECTORS|MEMBERS)$/i,
    labels: { name: 'company name', reg: 'reg number', people: 'director(s)/member(s)' },
  },
  // A home owners association is registered as a non-profit company, so the
  // register carries it exactly as it carries an NPC.
  hoa: {
    ecId: 'ec-hoa',
    headerPattern: /^(DIRECTORS|MEMBERS|TRUSTEES)$/i,
    labels: { name: 'association name', reg: 'reg number', people: 'director(s)/member(s)' },
  },
  attorneys: {
    ecId: 'ec-attorneys',
    headerPattern: /^(DIRECTORS|PARTNERS)$/i,
    labels: { name: 'firm name', reg: 'reg number', people: 'director(s)/partner(s)' },
  },
  school: {
    ecId: 'ec-school',
    headerPattern: /^(SGB|GOVERNING\s*BODY|DIRECTORS)$/i,
    labels: { name: 'school name', reg: 'EMIS number', people: 'SGB member(s)' },
  },
  church: {
    ecId: 'ec-church',
    headerPattern: /^(COUNCIL\s*MEMBERS?|DIRECTORS|TRUSTEES|KERKRAAD)$/i,
    regOptional: true,
    labels: { name: 'church name', reg: 'reg number', people: 'council member(s)' },
  },
  club: {
    ecId: 'ec-club',
    headerPattern: /^(COMMITTEE\s*MEMBERS?|DIRECTORS|TRUSTEES)$/i,
    regOptional: true,
    labels: { name: 'club name', reg: 'reg number', people: 'committee member(s)' },
  },
  bc: {
    ecId: 'ec-bc',
    headerPattern: /^TRUSTEES$/i,
    labels: { name: 'body corporate name', reg: 'scheme number', people: 'trustee(s)' },
  },
  // An individual (Registry TypeCode IN, and EL for a deceased estate) has no
  // governing body and no shareholders, so there is no people section to scan —
  // `noPeople` tells the importers to skip it, and there is deliberately no
  // headerPattern. The registration field holds an ID number, which is absent on
  // plenty of records, hence regOptional.
  //
  // Only the register-search path (ClientRegSearch) reaches this config. The .xlsx
  // path decides the entity type from the entity name alone, and a person's name
  // carries nothing to detect on, so it never resolves to `individual`.
  individual: {
    ecId: 'ec-individual',
    noPeople: true,
    regOptional: true,
    labels: { name: 'full name', reg: 'ID number', people: '' },
  },
};

// ── ENTITY CONFIG ──
const ENTITY_CONFIG = {
  attorneys: {
    nameLabel: 'Firm Name (as it appears on documents)',
    regLabel: 'Registration Number',
    namePlaceholder: 'e.g. Smith, Jones - Example Incorporated',
    regPlaceholder: 'e.g. 2005/012345/21',
    bodyTitle: 'Directors / Partners',
    pluralTerm: 'Directors',
    singularTerm: 'Director',
    reportTo: 'Directors',
    addBtnLabel: '+ Add Director / Partner',
    allowedReports: ['audit']
  },
  company: {
    nameLabel: 'Company Name (as it appears on documents)',
    regLabel: 'Registration Number',
    namePlaceholder: 'e.g. Example 33 (Proprietary) Limited',
    regPlaceholder: 'e.g. 2000/000001/07',
    bodyTitle: 'Directors',
    pluralTerm: 'Directors',
    singularTerm: 'Director',
    reportTo: 'Shareholders',
    addBtnLabel: '+ Add Director',
    allowedReports: ['compilation', 'review', 'audit']
  },
  cc: {
    nameLabel: 'CC Name (as it appears on documents)',
    regLabel: 'CK Number',
    namePlaceholder: 'e.g. Example Trading 99 CC',
    regPlaceholder: 'e.g. CK1999/012345/23',
    bodyTitle: 'Members',
    pluralTerm: 'Members',
    singularTerm: 'Member',
    reportTo: 'Members',
    addBtnLabel: '+ Add Member',
    allowedReports: ['compilation', 'review', 'audit']
  },
  npo: {
    nameLabel: 'Organisation Name (as it appears on documents)',
    regLabel: 'NPO Number',
    namePlaceholder: '',
    regPlaceholder: 'e.g. 123-456 NPO',
    // Overlaid at run time from the Step 4 governing-body choice — see
    // NPO_DIRECTOR_TERMS / getEntityConfig() below.
    bodyTitle: 'Members',
    pluralTerm: 'Members',
    singularTerm: 'Member',
    reportTo: 'Members',
    addBtnLabel: '+ Add Member',
    allowedReports: ['review', 'audit']
  },
  // Non-profit company. Incorporated under the Companies Act, so it carries the
  // full company page set (responsibilities + report), but its governing body is
  // the user's choice — see NPC_MEMBER_TERMS / getEntityConfig() below, which
  // overlay the members wording when that option is picked.
  npc: {
    nameLabel: 'Company Name (as it appears on documents)',
    regLabel: 'Registration Number',
    namePlaceholder: '',
    regPlaceholder: 'e.g. 2015/123456/08',
    bodyTitle: 'Directors',
    pluralTerm: 'Directors',
    singularTerm: 'Director',
    reportTo: 'Members',
    addBtnLabel: '+ Add Director',
    allowedReports: ['compilation', 'review', 'audit']
  },
  // Home owners association. Incorporated as a non-profit company, so it is an
  // NPC in every respect for now — only the form's own labels differ. See
  // NPC_LIKE_TYPES below: everything else routes through `isNpcType()` /
  // `baseEntityType()`, which is what makes this a copy of `npc` rather than a
  // second set of wording to keep in step.
  hoa: {
    nameLabel: 'Association Name (as it appears on documents)',
    regLabel: 'Registration Number',
    namePlaceholder: 'e.g. Riverside Home Owners Association NPC',
    regPlaceholder: 'e.g. 2015/123456/08',
    bodyTitle: 'Directors',
    pluralTerm: 'Directors',
    singularTerm: 'Director',
    reportTo: 'Members',
    addBtnLabel: '+ Add Director',
    allowedReports: ['compilation', 'review', 'audit']
  },
  trust: {
    nameLabel: 'Trust Name (as it appears on documents)',
    regLabel: 'Trust Number',
    namePlaceholder: 'e.g. The Smith Family Trust',
    regPlaceholder: 'e.g. IT1234/2010',
    bodyTitle: 'Trustees',
    pluralTerm: 'Trustees',
    singularTerm: 'Trustee',
    reportTo: 'Trustees',
    addBtnLabel: '+ Add Trustee',
    allowedReports: ['compilation']
  },
  church: {
    nameLabel: 'Church Name (as it appears on documents)',
    regLabel: 'Registration Number',
    namePlaceholder: 'e.g. Grace Community Church',
    regPlaceholder: 'e.g. 2005/008765/08',
    bodyTitle: 'Church Council Members',
    pluralTerm: 'Church Council Members',
    singularTerm: 'Member',
    reportTo: 'Members',
    addBtnLabel: '+ Add Council Member',
    allowedReports: ['audit']
  },
  school: {
    nameLabel: 'School Name (as it appears on documents)',
    regLabel: 'EMIS Number',
    namePlaceholder: 'e.g. Dummyville Primary School',
    regPlaceholder: 'e.g. 700112345',
    bodyTitle: 'Principal',
    pluralTerm: 'Principal',
    singularTerm: 'Principal',
    reportTo: 'Parents and Community',
    addBtnLabel: '+ Add Principal',
    allowedReports: ['audit']
  },
  club: {
    nameLabel: 'Club Name (as it appears on documents)',
    regLabel: 'Registration Number',
    namePlaceholder: 'e.g. Dummyville Sports Club',
    regPlaceholder: 'e.g. 1985/003456/08',
    bodyTitle: 'Committee Members',
    pluralTerm: 'Committee Members',
    singularTerm: 'Member',
    reportTo: 'Members',
    addBtnLabel: '+ Add Committee Member',
    allowedReports: ['audit']
  },
  bc: {
    nameLabel: 'Body Corporate Name (as it appears on documents)',
    regLabel: 'Scheme Number',
    namePlaceholder: 'e.g. Sectional Title Scheme No. 123',
    regPlaceholder: 'e.g. SS123/2005',
    bodyTitle: 'Trustees',
    pluralTerm: 'Trustees',
    singularTerm: 'Trustee',
    reportTo: 'Owners',
    addBtnLabel: '+ Add Trustee',
    allowedReports: ['audit']
  },
  individual: {
    nameLabel: 'Full Name (as it appears on documents)',
    regLabel: 'ID Number',
    namePlaceholder: 'e.g. Johan Peter Visser',
    regPlaceholder: 'e.g. 800101 5012 08 6',
    bodyTitle: '',
    pluralTerm: '',
    singularTerm: '',
    reportTo: '',
    addBtnLabel: '',
    allowedReports: []
  }
};

// ── NPC-LIKE ENTITY TYPES ──
// A home owners association is incorporated under the Companies Act as a
// non-profit company, so `hoa` is, for now, an NPC in every respect: same form
// questions, same policy texts, same page set, same index. It exists as its own
// entity type so its wording can diverge later without disturbing NPC sets.
//
// Two helpers carry that: `isNpcType()` for the behavioural branches ("does this
// entity behave like an NPC?"), and `baseEntityType()` for the keyed lookups
// (INDEX_CONFIGS and anything else keyed by entity type) that have no `hoa`
// entry of their own. When a HOA grows its own wording, give it real entries and
// drop it out of these two lists rather than special-casing at the call sites.
const NPC_LIKE_TYPES = ['npc', 'hoa'];
const ENTITY_TYPE_ALIASES = { hoa: 'npc' };

function isNpcType(type) {
  return NPC_LIKE_TYPES.indexOf(type) !== -1;
}

function baseEntityType(type) {
  return ENTITY_TYPE_ALIASES[type] || type;
}

// ── NPC GOVERNING BODY ──
// An NPC may be run by directors or by members. The choice is a form radio, so
// it is only knowable at run time — these two helpers are the single place the
// swap happens, and every consumer of the entity's wording goes through
// `getEntityConfig()` rather than indexing ENTITY_CONFIG directly.
const NPC_MEMBER_TERMS = {
  bodyTitle: 'Members',
  pluralTerm: 'Members',
  singularTerm: 'Member',
  reportTo: 'Members',
  addBtnLabel: '+ Add Member'
};

// 'directors' (default) or 'members'. Anything other than an NPC reads as
// 'directors', which is inert because the overlay is only applied for `npc`.
function getNpcBody() {
  if (typeof getRadio !== 'function') return 'directors';
  return getRadio('npcBody') === 'members' ? 'members' : 'directors';
}

// ── PPRA (PROPERTY PRACTITIONER) COMPANY ──
// A company that is a property practitioner (estate agency) regulated by the
// Property Practitioners Regulatory Authority. It holds trust money for clients,
// so its review is done by a registered auditor: the Independent Reviewer's
// Report and the review engagement letter go on the audit letterhead and sign
// off as REGISTERED AUDITOR (SA), and a qualified conclusion can be the PPRA
// trust-deficit wording (trust creditors exceeding trust funds). Everything else
// in the set is the ordinary company review. A company-only form radio; any
// other entity reads as not PPRA.
function isPpraCompany(entityType) {
  if (entityType !== 'company' || typeof getRadio !== 'function') return false;
  return getRadio('ppraCompany') === 'yes';
}

// True when the set being built is a PPRA company's review — the one combination
// the PPRA wording applies to. The single test every caller uses.
function isPpraReview(entityType) {
  return isPpraCompany(entityType) && typeof getRadio === 'function' && getRadio('reportType') === 'review';
}

// Only these partners are registered auditors, so only they may sign a PPRA review.
const PPRA_SIGNERS = ['A ANDERSON', 'R CLARKE'];

// Trust deficit = trust creditors less trust funds, from the two typed amounts
// (commas and spaces allowed). null while either is blank or not a number.
function ppraTrustDeficit(creditorsRaw, fundsRaw) {
  const num = v => {
    const s = String(v || '').replace(/[,\s]/g, '');
    if (!s) return NaN;
    return parseFloat(s);
  };
  const c = num(creditorsRaw), f = num(fundsRaw);
  if (isNaN(c) || isNaN(f)) return null;
  return Math.round((c - f) * 100) / 100;
}

// ── NPO GOVERNING BODY ──
// An NPO is governed by members (default) or directors — the Step 4
// "Governing body" radio. Every generated document words itself through
// getEntityConfig(), so "the members"/"the directors", "Members'"/"Directors'"
// and "is/are" all follow the one choice.
const NPO_DIRECTOR_TERMS = {
  bodyTitle: 'Directors',
  pluralTerm: 'Directors',
  singularTerm: 'Director',
  reportTo: 'Directors',
  addBtnLabel: '+ Add Director'
};

// 'members' (default) or 'directors'.
function getNpoBody() {
  if (typeof getRadio !== 'function') return 'members';
  return getRadio('npoGoverningBody') === 'directors' ? 'directors' : 'members';
}

// Entity config with any run-time overlay applied. Use this instead of
// ENTITY_CONFIG[type] wherever the governing-body wording matters.
function getEntityConfig(type) {
  const base = ENTITY_CONFIG[type] || ENTITY_CONFIG.company;
  if (isNpcType(type) && getNpcBody() === 'members') {
    return { ...base, ...NPC_MEMBER_TERMS };
  }
  if (type === 'npo') {
    return { ...base, ...(getNpoBody() === 'directors' ? NPO_DIRECTOR_TERMS : NPC_MEMBER_TERMS) };
  }
  return base;
}

// ── "SIGNS ON BEHALF OF" WORDING ──
// One or more of the governing body may sign the financial statements for the
// body as a whole (EntityManager → the per-person "Signs on behalf of…"
// checkbox). The caption printed under that signature names the body being
// signed for, which is not the same phrase for every entity: a company signs as
// "the Board of Directors", a trust as "the Trustees", a CC as "the Members".
//
// PLACEHOLDER WORDING. Only the company phrasing is confirmed; the rest are
// sensible stand-ins until the accountants supply their own. Changing them is a
// one-line edit here — nothing else hard-codes the words.
const BOARD_REP_BODY_NAMES = {
  attorneys: 'Board of Directors',
  company:   'Board of Directors',
  npo:       'Board of Directors',
  npc:       'Board of Directors',
  hoa:       'Board of Directors',
  cc:        'Members',
  trust:     'Trustees',
  bc:        'Trustees',
  church:    'Church Council',
  club:      'Committee'
};

// Entity types where one person signing "on behalf of" the body is meaningless,
// so the checkbox is hidden: a school has a single principal, an individual has
// no governing body at all.
const BOARD_REP_EXCLUDED = ['school', 'individual'];

function boardRepApplies(type) {
  return !BOARD_REP_EXCLUDED.includes(type);
}

// The body a flagged person signs for, e.g. "Board of Directors" / "Trustees".
// Falls back to the entity's own plural term for anything not listed above.
function boardRepBody(type) {
  if (isNpcType(type) && getNpcBody() === 'members') return 'Members';
  if (BOARD_REP_BODY_NAMES[type]) return BOARD_REP_BODY_NAMES[type];
  const cfg = ENTITY_CONFIG[type] || ENTITY_CONFIG.company;
  return cfg.pluralTerm || 'Board of Directors';
}

// Caption under the signature on the generated page.
function boardRepCaption(type) {
  return `(On Behalf of the ${boardRepBody(type)})`;
}

// Label on the form checkbox.
function boardRepLabel(type) {
  return `Signs on behalf of the ${boardRepBody(type)}`;
}

// True when the NPC's optional "Association incorporated under Section 21" line
// should appear under the entity name on the cover.
function npcIsSection21(entityType) {
  if (!isNpcType(entityType)) return false;
  if (typeof getRadio !== 'function') return false;
  return getRadio('npcSection21') === 'yes';
}

// ── PAGE REFERENCE DEFAULTS ──
// Page the financial statements start on, per report type. A compilation carries
// one extra page ahead of the statements, so it starts a page later.
const PAGE_START_DEFAULTS = {
  compilation: '5',
  review: '4',
  audit: '4'
};

// Engagement letters (beside the report type) ticked when the user picks a Step 3 report type.
const REPORT_TYPE_ENGAGEMENT_LETTERS = {
  compilation: ['engTypeAccounting'],
  review: ['engTypeAccounting', 'engTypeReview'],
  audit: ['engTypeAccounting', 'engTypeAudit']
};

// ── INDEX PAGE CONFIGS ──
// Each key is "{entityType}-{reportType}". Items are displayed in order.
// `label` = the line shown on the index page.
// `id` = form input id suffix (prefixed with "idx-" in the DOM).
const INDEX_CONFIGS = {
  'company-compilation': [
    { label: "The Chartered Accountant's (SA) Declaration", id: 'caDeclaration' },
    { label: "Directors' Responsibilities and Approval", id: 'dirResponsibilities' },
    { label: "Independent Compiler's Report", id: 'compilerReport' },
    { label: "Directors' Report", id: 'directorsReport' },
    { label: 'Statement of Financial Position', id: 'financialPosition' },
    { label: 'Statement of Profit or Loss and\nOther Comprehensive Income', id: 'profitOrLoss' },
    { label: 'Statement of Changes in Equity', id: 'changesInEquity' },
    { label: 'Statement of Cash Flows', id: 'cashFlows' },
    { label: 'Notes to the Financial Statements', id: 'notes' }
  ],
  'company-review': [
    { label: "Directors' Responsibilities and Approval", id: 'dirResponsibilities' },
    { label: "Independent Reviewer's Report", id: 'reviewerReport' },
    { label: "Directors' Report", id: 'directorsReport' },
    { label: 'Statement of Financial Position', id: 'financialPosition' },
    { label: 'Statement of Profit or Loss and\nOther Comprehensive Income', id: 'profitOrLoss' },
    { label: 'Statement of Changes in Equity', id: 'changesInEquity' },
    { label: 'Statement of Cash Flows', id: 'cashFlows' },
    { label: 'Notes to the Financial Statements', id: 'notes' }
  ],
  'company-audit': [
    { label: "Directors' Responsibilities and Approval", id: 'dirResponsibilities' },
    { label: "Independent Auditor's Report", id: 'auditorReport' },
    { label: "Directors' Report", id: 'directorsReport' },
    { label: 'Statement of Financial Position', id: 'financialPosition' },
    { label: 'Statement of Profit or Loss and\nOther Comprehensive Income', id: 'profitOrLoss' },
    { label: 'Statement of Changes in Equity', id: 'changesInEquity' },
    { label: 'Statement of Cash Flows', id: 'cashFlows' },
    { label: 'Notes to the Financial Statements', id: 'notes' }
  ],
  'trust-compilation': [
    { label: "The Chartered Accountant's (SA) Declaration", id: 'caDeclaration' },
    { label: "Independent Compiler's Report", id: 'compilerReport' },
    { label: 'Statement of Financial Position', id: 'financialPosition' },
    { label: 'Statement of Profit or Loss and\nOther Comprehensive Income', id: 'profitOrLoss' },
    { label: 'Statement of Changes in Funds', id: 'changesInFunds' },
    { label: 'Statement of Cash Flows', id: 'cashFlows' },
    { label: 'Notes to the Financial Statements', id: 'notes' }
  ],
  // No Responsibilities and Approval page (archived 4.90.0), no compiler's
  // report, no CA declaration and no Members'/Directors' Report for an NPO.
  'npo-audit': [
    { label: "Independent Auditor's Report", id: 'auditorReport' },
    { label: 'Statement of Financial Position', id: 'financialPosition' },
    { label: 'Statement of Surplus or Deficit', id: 'surplusOrDeficit' },
    { label: 'Statement of Changes in Funds', id: 'changesInFunds' },
    { label: 'Statement of Cash Flows', id: 'cashFlows' },
    { label: 'Notes to Financial Statements', id: 'notes' }
  ],
  // Non-profit company — confirmed against a signed NPC set. The page structure
  // is the company one (Responsibilities + Report pages are both assembled), but
  // the statement names are the non-profit ones: surplus and deficit rather than
  // profit or loss, funds rather than equity. When the governing body is set to
  // members, `getIndexConfig()` rewrites the two "Directors'" lines to
  // "Members'" — the ids stay put so typed page numbers survive the switch.
  'npc-audit': [
    { label: "Directors' Responsibilities and Approval", id: 'dirResponsibilities' },
    { label: "Independent Auditor's Report", id: 'auditorReport' },
    { label: "Directors' Report", id: 'directorsReport' },
    { label: 'Statement of Financial Position', id: 'financialPosition' },
    { label: 'Statement of Surplus and Deficit', id: 'surplusOrDeficit' },
    { label: 'Statement of Changes in Funds', id: 'changesInFunds' },
    { label: 'Statement of Cash Flows', id: 'cashFlows' },
    { label: 'Notes to the Financial Statements', id: 'notes' }
  ],
  'npc-review': [
    { label: "Directors' Responsibilities and Approval", id: 'dirResponsibilities' },
    { label: "Independent Reviewer's Report", id: 'reviewerReport' },
    { label: "Directors' Report", id: 'directorsReport' },
    { label: 'Statement of Financial Position', id: 'financialPosition' },
    { label: 'Statement of Surplus and Deficit', id: 'surplusOrDeficit' },
    { label: 'Statement of Changes in Funds', id: 'changesInFunds' },
    { label: 'Statement of Cash Flows', id: 'cashFlows' },
    { label: 'Notes to the Financial Statements', id: 'notes' }
  ],
  'npc-compilation': [
    { label: "The Chartered Accountant's (SA) Declaration", id: 'caDeclaration' },
    { label: "Directors' Responsibilities and Approval", id: 'dirResponsibilities' },
    { label: "Independent Compiler's Report", id: 'compilerReport' },
    { label: "Directors' Report", id: 'directorsReport' },
    { label: 'Statement of Financial Position', id: 'financialPosition' },
    { label: 'Statement of Surplus and Deficit', id: 'surplusOrDeficit' },
    { label: 'Statement of Changes in Funds', id: 'changesInFunds' },
    { label: 'Statement of Cash Flows', id: 'cashFlows' },
    { label: 'Notes to the Financial Statements', id: 'notes' }
  ],
  'school-audit': [
    { label: "Independent Auditor's Report", id: 'auditorReport' },
    { label: 'Statement of Financial Position', id: 'financialPosition' },
    { label: 'Statement of Financial Performance', id: 'financialPerformance' },
    { label: 'Statement of Changes in Surplus and Reserves', id: 'changesInSurplus' },
    { label: 'Statement of Cash Flows', id: 'cashFlows' },
    { label: 'Notes to the Financial Statements', id: 'notes' }
  ],

  // ────────────────────────────────────────────────────────────────────
  // PREDICTED INDEXES — the entries below were generated for the entity+
  // report combos that previously had no index. They follow each entity's
  // page structure in DocumentGenerator (which pages are actually assembled)
  // and reuse the wording pattern of the confirmed indexes above, swapping
  // in the correct governing-body term (Members' / Trustees') and the
  // non-profit statement names. THEY ARE PREDICTIONS — double-check the
  // wording (especially the equity/funds statement names) against a real
  // signed set for each entity type before relying on them.
  // ────────────────────────────────────────────────────────────────────

  // Close Corporation — same page structure as a company (else-branch in
  // DocumentGenerator), but the governing body is "Members", so the
  // Responsibilities and Report pages read "Members'". The equity
  // statement is still titled "Statement of Changes in Equity".
  'cc-compilation': [
    { label: "The Chartered Accountant's (SA) Declaration", id: 'caDeclaration' },
    { label: "Members' Responsibilities and Approval", id: 'memberResponsibilities' },
    { label: "Independent Compiler's Report", id: 'compilerReport' },
    { label: "Members' Report", id: 'membersReport' },
    { label: 'Statement of Financial Position', id: 'financialPosition' },
    { label: 'Statement of Profit or Loss and\nOther Comprehensive Income', id: 'profitOrLoss' },
    { label: "Statement of Changes in Equity", id: 'changesInEquity' },
    { label: 'Statement of Cash Flows', id: 'cashFlows' },
    { label: 'Notes to the Financial Statements', id: 'notes' }
  ],
  'cc-review': [
    { label: "Members' Responsibilities and Approval", id: 'memberResponsibilities' },
    { label: "Independent Reviewer's Report", id: 'reviewerReport' },
    { label: "Members' Report", id: 'membersReport' },
    { label: 'Statement of Financial Position', id: 'financialPosition' },
    { label: 'Statement of Profit or Loss and\nOther Comprehensive Income', id: 'profitOrLoss' },
    { label: "Statement of Changes in Equity", id: 'changesInEquity' },
    { label: 'Statement of Cash Flows', id: 'cashFlows' },
    { label: 'Notes to the Financial Statements', id: 'notes' }
  ],
  'cc-audit': [
    { label: "Members' Responsibilities and Approval", id: 'memberResponsibilities' },
    { label: "Independent Auditor's Report", id: 'auditorReport' },
    { label: "Members' Report", id: 'membersReport' },
    { label: 'Statement of Financial Position', id: 'financialPosition' },
    { label: 'Statement of Profit or Loss and\nOther Comprehensive Income', id: 'profitOrLoss' },
    { label: "Statement of Changes in Equity", id: 'changesInEquity' },
    { label: 'Statement of Cash Flows', id: 'cashFlows' },
    { label: 'Notes to the Financial Statements', id: 'notes' }
  ],

  // NPO review — mirrors the npo-audit index, swapping the Auditor's Report
  // line for the Reviewer's Report.
  'npo-review': [
    { label: "Independent Reviewer's Report", id: 'reviewerReport' },
    { label: 'Statement of Financial Position', id: 'financialPosition' },
    { label: 'Statement of Surplus or Deficit', id: 'surplusOrDeficit' },
    { label: 'Statement of Changes in Funds', id: 'changesInFunds' },
    { label: 'Statement of Cash Flows', id: 'cashFlows' },
    { label: 'Notes to Financial Statements', id: 'notes' }
  ],

  // Church — audit only. DocumentGenerator assembles just the Auditor's
  // Report ahead of the statements (no Responsibilities/Report pages).
  // Treated as a non-profit body: income & expenditure + changes in funds.
  'church-audit': [
    { label: "Independent Auditor's Report", id: 'auditorReport' },
    { label: 'Statement of Financial Position', id: 'financialPosition' },
    { label: 'Statement of Income and Expenditure', id: 'surplusOrDeficit' },
    { label: 'Statement of Changes in Funds', id: 'changesInFunds' },
    { label: 'Statement of Cash Flows', id: 'cashFlows' },
    { label: 'Notes to the Financial Statements', id: 'notes' }
  ],

  // Club — audit only. Same non-profit page structure as a church
  // (Auditor's Report then statements).
  'club-audit': [
    { label: "Independent Auditor's Report", id: 'auditorReport' },
    { label: 'Statement of Financial Position', id: 'financialPosition' },
    { label: 'Statement of Income and Expenditure', id: 'surplusOrDeficit' },
    { label: 'Statement of Changes in Funds', id: 'changesInFunds' },
    { label: 'Statement of Cash Flows', id: 'cashFlows' },
    { label: 'Notes to the Financial Statements', id: 'notes' }
  ],

  // Body Corporate — audit only. DocumentGenerator assembles Trustees'
  // Responsibilities + Auditor's Report + Trustees' Report ahead of the
  // statements. Levy-funded body: income & expenditure + changes in funds.
  'bc-audit': [
    { label: "Trustees' Responsibilities and Approval", id: 'trusteeResponsibilities' },
    { label: "Independent Auditor's Report", id: 'auditorReport' },
    { label: "Trustees' Report", id: 'trusteesReport' },
    { label: 'Statement of Financial Position', id: 'financialPosition' },
    { label: 'Statement of Income and Expenditure', id: 'surplusOrDeficit' },
    { label: 'Statement of Changes in Funds', id: 'changesInFunds' },
    { label: 'Statement of Cash Flows', id: 'cashFlows' },
    { label: 'Notes to the Financial Statements', id: 'notes' }
  ],

  // Individual — entity-only key (no report type). An individual has no report
  // type at all: Step 3 is hidden and `allowedReports` is empty, so there is no
  // "{entity}-{report}" key to hang this on. `getIndexConfig()` falls back to
  // the bare entity name for exactly this case.
  //
  // The set an individual receives carries no governing-body pages and no
  // compiler's/auditor's report — DocumentGenerator assembles cover + index +
  // policies for an individual and nothing else — so the index lists the
  // statements only. PREDICTION: check the statement wording (in particular
  // whether the owner's capital movement is titled "Changes in Equity") against
  // a real signed set before relying on it. Every label is editable on the form.
  'individual': [
    { label: 'Statement of Financial Position', id: 'financialPosition' },
    { label: 'Statement of Profit or Loss and\nOther Comprehensive Income', id: 'profitOrLoss' },
    { label: 'Statement of Changes in Equity', id: 'changesInEquity' },
    { label: 'Statement of Cash Flows', id: 'cashFlows' },
    { label: 'Notes to the Financial Statements', id: 'notes' }
  ]

  // Individual — statement of assets and liabilities has NO index page at all.
  // There is deliberately no entry here: the set is cover + the one statement,
  // and a one-line index in front of a single statement is noise. See
  // `getIndexConfig()`, which returns null for that combination.
};

// Which of the two statement types an individual is being issued:
// 'afs' = annual financial statements (the default, with accounting policies),
// 'assetsliab' = a statement of assets and liabilities (no policies).
// The radio exists only while the Individual entity is selected; anything else
// reads as 'afs'. `getRadio` lives in utils.js, which loads after this file —
// safe, because these are only ever called at run time.
function getIndividualStatementType() {
  if (typeof getRadio !== 'function') return 'afs';
  return getRadio('individualStatementType') === 'assetsliab' ? 'assetsliab' : 'afs';
}

// True when the document being built is an individual's statement of assets and
// liabilities. The single test every caller uses, so the cover title, the index
// list and the page assembly can never disagree about which set is in play.
function isAssetsLiabilitiesSet(entityType) {
  return entityType === 'individual' && getIndividualStatementType() === 'assetsliab';
}

// Resolve the index config for an entity + report type. Tries the usual
// "{entityType}-{reportType}" key first, then the bare "{entityType}" key —
// which is how an entity with no report type (individual) gets an index at all.
// Every caller must go through this so the form inputs, the generated index page
// and the page-number citations all agree on which list is in play.
//
// null means "this combination has no index page": the form's index-page group
// hides itself, no index page is generated, and page citations fall back to
// their slot constants.
function getIndexConfig(entityType, reportType) {
  if (typeof INDEX_CONFIGS === 'undefined') return null;
  // An individual's statement of assets and liabilities gets no index at all.
  if (isAssetsLiabilitiesSet(entityType)) return null;
  const key = baseEntityType(entityType);
  const cfg = INDEX_CONFIGS[`${key}-${reportType}`] || INDEX_CONFIGS[key] || null;
  // An NPC run by members carries the same index, worded for members. Only the
  // labels change — the ids are what the page-number inputs hang off, so they
  // stay identical and a switch between the two keeps the typed numbers.
  if (cfg && isNpcType(entityType) && getNpcBody() === 'members') {
    return cfg.map(item => ({ ...item, label: item.label.replace(/Directors'/g, "Members'") }));
  }
  return cfg;
}
