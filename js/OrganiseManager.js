// ── OrganiseManager ────────────────────────────────────────────────────────
// Decides which of the two output PDFs each generated page belongs to, so the
// split the user used to do by hand in I Love INF181 happens on generation.
//
// The firm always ends up with two files:
//   Split 1 — COMPL DOCS  (compliance paperwork: engagement/representation
//                          letters, minutes, resolutions, loan certificates)
//   Split 2 — FS          (the financial statements themselves)
// A page can also go to BOTH, in which case it is duplicated into each file —
// the cover is the usual case.
//
// Every page carries data-doc-section (stamped at assembly by DocumentGenerator),
// which gives each page a stable identity that survives regeneration. Assignments
// are therefore keyed by section + occurrence, never by page number: page numbers
// move whenever content reflows, section identity does not.
//
// Consumed by PreviewManager, which carries data-split through to the print DOM
// and hands the resulting plan to I Love INF181.
// ───────────────────────────────────────────────────────────────────────────

const OrganiseManager = (() => {

  // ── Section registry ─────────────────────────────────────────────────────
  // label  — how the section is named in the order report
  // split  — which file it lands in by default: 1 = COMPL DOCS, 2 = FS, 'both'
  // These are the starting rules. Anything the user changes with the per-page
  // chips overrides them and is remembered; the order report is what tells us
  // whether a default itself should change.
  const SECTIONS = {
    'cover':                  { label: 'Cover Page',                      split: 'both' },
    'index':                  { label: 'Index & Approval',                split: 2 },
    'ca-declaration':         { label: "Chartered Accountant's Declaration", split: 2 },
    'responsibilities':       { label: 'Responsibilities and Approval',   split: 2 },
    'compiler-report':        { label: "Independent Compiler's Report",   split: 2 },
    'auditor-report':         { label: "Independent Auditor's Report",    split: 2 },
    'reviewer-report':        { label: "Independent Reviewer's Report",   split: 2 },
    'entity-report':          { label: "Directors' / Trustees' Report",   split: 2 },
    'policies':               { label: 'Accounting Policies',             split: 2 },
    'loan-certificate':       { label: 'Loan Certificate',                split: 1 },
    'minutes':                { label: 'Minutes',                         split: 1 },
    'agm-minutes':            { label: 'AGM Minutes',                     split: 1 },
    'resolution':             { label: 'Resolution',                      split: 1 },
    'engagement':             { label: 'Engagement Letter',               split: 1 },
    'representation-letter':  { label: 'Representation Letter',           split: 1 },
  };

  const UNKNOWN = { label: 'Unclassified page', split: 2 };
  const STORE_KEY = 'policygen:splitOverrides';
  const SPLIT_NAMES = { 1: 'COMPL DOCS', 2: 'FS', both: 'BOTH' };
  const CYCLE = [1, 2, 'both'];

  let active = false;
  let overrides = load();

  function load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
    catch { return {}; }
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(overrides)); }
    catch { /* private mode — assignments just won't survive a reload */ }
  }

  function meta(section) {
    return SECTIONS[section] || UNKNOWN;
  }

  // ── Page walking ─────────────────────────────────────────────────────────
  // Continuation sheets are not separate content — they're the overflow of the
  // page above — so they never get their own chip and always follow their
  // parent. Only "lead" pages are assignable.
  function isContinuation(page) {
    return page.hasAttribute('data-continuation') ||
           page.hasAttribute('data-continuation-of');
  }

  // Walks a container in document order, handing back one entry per page with
  // the lead page it belongs to and a per-section occurrence number. This is the
  // single source of truth for both the chips and the exported plan.
  function walk(root) {
    const pages = Array.from(root.querySelectorAll('.doc-page, .cover-page'));
    const counts = {};
    const out = [];
    let lead = null;

    pages.forEach(page => {
      const section = page.getAttribute('data-doc-section') || 'unknown';
      if (isContinuation(page) && lead) {
        out.push({ page, section: lead.section, occurrence: lead.occurrence, lead: false });
        return;
      }
      counts[section] = (counts[section] || 0) + 1;
      lead = { section, occurrence: counts[section] };
      out.push({ page, section, occurrence: counts[section], lead: true });
    });

    return out;
  }

  const keyOf = (entry) => `${entry.section}#${entry.occurrence}`;

  function splitFor(entry) {
    const override = overrides[keyOf(entry)];
    return override !== undefined ? override : meta(entry.section).split;
  }

  // ── Applying assignments ─────────────────────────────────────────────────
  // Stamps data-split on every page (continuations included, so the attribute
  // still reads correctly if a page is inspected on its own) and refreshes the
  // chips when organise mode is on. Safe to call after every regeneration.
  function apply() {
    const output = document.getElementById('document-output');
    if (!output) return;

    walk(output).forEach(entry => {
      const split = splitFor(entry);
      entry.page.setAttribute('data-split', split);
      const existing = entry.page.querySelector(':scope > .page-split-chip');
      if (existing) existing.remove();
      if (active && entry.lead) entry.page.appendChild(buildChip(entry, split));
    });
  }

  function buildChip(entry, split) {
    const chip = document.createElement('div');
    chip.className = 'page-split-chip';
    chip.dataset.split = split;
    chip.contentEditable = 'false';
    chip.title = `${meta(entry.section).label} → ${SPLIT_NAMES[split]}\nClick to send this page to the other split.`;
    chip.innerHTML = `
      <span class="psc-label">${meta(entry.section).label}</span>
      <span class="psc-value">${SPLIT_NAMES[split]}</span>`;

    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const next = CYCLE[(CYCLE.indexOf(split) + 1) % CYCLE.length];
      overrides[keyOf(entry)] = next;
      save();
      apply();
    });

    return chip;
  }

  // ── Order report ─────────────────────────────────────────────────────────
  // Contiguous pages of the same section and split collapse into one row, which
  // is how the split is actually reasoned about ("policies, pages 6–9, FS").
  function buildRows(root) {
    const rows = [];
    walk(root).forEach((entry, i) => {
      const split = entry.page.getAttribute('data-split') || String(splitFor(entry));
      const last = rows[rows.length - 1];
      if (last && last.section === entry.section &&
          last.occurrence === entry.occurrence && last.split === split) {
        last.endPage = i + 1;
        return;
      }
      rows.push({
        section: entry.section,
        label: meta(entry.section).label,
        occurrence: entry.occurrence,
        split,
        startPage: i + 1,
        endPage: i + 1,
      });
    });
    return rows;
  }

  function report() {
    const output = document.getElementById('document-output');
    if (!output || !output.classList.contains('visible')) return null;

    const rows = buildRows(output);
    const company = (document.getElementById('companyName') || {}).value || '';
    const yearEnd = (document.getElementById('yearEnd') || {}).value || '';

    return {
      generated: new Date().toISOString(),
      company: company.trim(),
      yearEnd: yearEnd.trim(),
      splits: { 1: SPLIT_NAMES[1], 2: SPLIT_NAMES[2] },
      totalPreviewPages: output.querySelectorAll('.doc-page, .cover-page').length,
      rows,
    };
  }

  function toCsv(data) {
    const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [
      ['Section', 'Pages', 'Split', 'Split name'].map(esc).join(','),
    ];
    data.rows.forEach(r => {
      const pages = r.startPage === r.endPage ? `${r.startPage}` : `${r.startPage}-${r.endPage}`;
      lines.push([r.label, pages, r.split, SPLIT_NAMES[r.split]].map(esc).join(','));
    });
    return lines.join('\r\n');
  }

  function download(name, text, mime) {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  function downloadOrderReport() {
    const data = report();
    if (!data) {
      alert('Please generate a document first — there is nothing to report on yet.');
      return;
    }
    const stem = `Order report - ${data.company || 'document'}${data.yearEnd ? ' ' + data.yearEnd : ''}`
      .replace(/[\\/:*?"<>|]/g, '-');
    download(`${stem}.csv`, toCsv(data), 'text/csv;charset=utf-8');
    // The JSON carries the same rows in the shape the rules table uses, so a
    // corrected report can be fed straight back as new defaults.
    setTimeout(() => download(`${stem}.json`, JSON.stringify(data, null, 2), 'application/json'), 500);
  }

  // ── Plan for I Love INF181 ──────────────────────────────────────────────────
  // Reads the *print* DOM (passed in by PreviewManager), not the preview, because
  // the print path re-paginates independently — its page count is the PDF's page
  // count. Returns one entry per PDF page, in order.
  function planFrom(root) {
    return walk(root).map((entry, i) => {
      const raw = entry.page.getAttribute('data-split');
      const split = raw === 'both' ? 'both' : Number(raw) || meta(entry.section).split;
      return {
        page: i + 1,
        section: entry.section,
        label: meta(entry.section).label,
        split,
      };
    });
  }

  function toggle() {
    const output = document.getElementById('document-output');
    if (!output || !output.classList.contains('visible')) {
      alert('Please generate a document first before organising it.');
      return;
    }
    active = !active;
    document.body.classList.toggle('organise-mode', active);
    const btn = document.getElementById('btn-organise');
    if (btn) btn.classList.toggle('active', active);
    apply();
  }

  function resetOverrides() {
    overrides = {};
    save();
    apply();
  }

  return {
    apply,
    toggle,
    report,
    planFrom,
    downloadOrderReport,
    resetOverrides,
    get isActive() { return active; },
    SECTIONS,
    SPLIT_NAMES,
  };
})();
