// config.js — Pure data for the Assurance Engagements app. No dependencies.
//
// Deliberately small: this app only has to know how to address an entity, which
// partner may sign which letter, and where the letterheads live. Everything the
// main Policy Generator's config.js carries about policies, index pages and
// importers has no counterpart here.

// Letterheads are shared with the main app — one copy on the share, so an
// updated letterhead reaches both without a second upload.
const AE_CA_LETTERHEAD     = '../images/letterhead-header.png';
const AE_AUDIT_LETTERHEAD  = '../images/Audit-letterhead-header.png';
const AE_CA_FOOTER         = '../images/letterhead-footer.png';
const AE_AUDIT_FOOTER      = '../images/Audit-letterhead-footer.png';

// Per entity type: how the letter addresses the governing body, what one/many
// of its people are called, and the caption under a signature given on the
// body's behalf. Mirrors ENTITY_CONFIG + boardRepCaption() in the main app,
// trimmed to the fields an engagement letter actually reads.
const AE_ENTITIES = {
  company:    { label: 'Company',           addressee: 'The Directors',      singular: 'Director', plural: 'Directors', body: 'Board of Directors' },
  cc:         { label: 'Close Corporation', addressee: 'The Members',        singular: 'Member',   plural: 'Members',   body: 'Members' },
  trust:      { label: 'Trust',             addressee: 'The Trustees',       singular: 'Trustee',  plural: 'Trustees',  body: 'Trustees' },
  bc:         { label: 'Body Corporate',    addressee: 'The Trustees',       singular: 'Trustee',  plural: 'Trustees',  body: 'Trustees' },
  npo:        { label: 'NPO',               addressee: 'The Committee',      singular: 'Committee Member', plural: 'Committee Members', body: 'Committee' },
  npc:        { label: 'NPC',               addressee: 'The Directors',      singular: 'Director', plural: 'Directors', body: 'Board of Directors' },
  church:     { label: 'Church',            addressee: 'The Church Council', singular: 'Council Member',   plural: 'Council Members',   body: 'Church Council' },
  club:       { label: 'Club',              addressee: 'The Committee',      singular: 'Committee Member', plural: 'Committee Members', body: 'Committee' },
  individual: { label: 'Individual',        addressee: '',                   singular: 'Individual', plural: 'Individuals', body: 'Individual' }
};

// How the entity is described inside a sentence ("…the financial statements of
// the company…"). [ENTITY_TYPE] in the templates.
const AE_ENTITY_LABELS = {
  company: 'company', cc: 'close corporation', trust: 'trust', bc: 'body corporate',
  npo: 'non-profit organisation', npc: 'non-profit company', church: 'church',
  club: 'club', individual: 'individual'
};

// The management representation letter names the entity in its own words
// ("…on any assets of the close corporation…"), and they are not always the
// words a sentence in an engagement letter uses — the main app's rep letter
// calls an NPO "the organisation". Kept beside AE_ENTITY_LABELS rather than
// merged into it so a change to one letter never silently moves the other.
const AE_REPR_ENTITY_LABELS = {
  company: 'company', cc: 'close corporation', trust: 'trust', bc: 'body corporate',
  npo: 'organisation', npc: 'non-profit company', church: 'church',
  club: 'club', individual: 'individual'
};

// Who may sign. An audit engagement letter may only be signed by Alice Anderson or Rita Clarke — the same restriction the main app enforces.
// 'BLANK' is not a person: it prints a ruled line where the name would go, for
// a letter that goes out before the responsible practitioner is decided.
const AE_SIGNERS_REVIEW = [
  { value: 'A ANDERSON',  label: 'A Anderson' },
  { value: 'H BROOKS', label: 'H Brooks' },
  { value: 'R CLARKE',        label: 'R Clarke' },
  { value: 'R DANIELS',      label: 'R Daniels' },
  { value: 'BLANK',            label: 'Blank — ruled line, no name' }
];
const AE_SIGNERS_AUDIT = [
  { value: 'A ANDERSON', label: 'A Anderson' },
  { value: 'R CLARKE',       label: 'R Clarke' },
  { value: 'BLANK',           label: 'Blank — ruled line, no name' }
];

// The roles a member of the audit engagement team holds on the engagement, as
// the firm's declaration names them. The empty first entry is "not stated" —
// it prints the ruled blank the declaration has always carried.
const AE_INDEP_ROLES = [
  '',
  'Engagement Partner',
  'Engagement Quality Control Reviewer (EQCR)',
  'Manager',
  'Team Member'
];

// The engagement letter is dated 14 days before the statements are signed.
const AE_ENGAGEMENT_LEAD_DAYS = 14;

function aeEntity(type) {
  return AE_ENTITIES[type] || AE_ENTITIES.company;
}

// "(On Behalf of the Board of Directors)" — the caption printed under a
// signatory who signs for the governing body.
function aeBoardRepCaption(type) {
  return `(On Behalf of the ${aeEntity(type).body})`;
}
