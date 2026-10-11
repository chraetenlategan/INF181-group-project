// Cra01Register.js — individuals for the ClientReg dialog, read from the CRA01
// register instead of the ClientReg one.
//
// Depends on: utils.js (toTitleCase), ClientRegRegister.js (personalName, summarise).
//
// WHY A SECOND REGISTER
// The ClientReg register (`clientreg-data.js`) is built from Registry's company-
// secretarial `Register` table, and an individual almost never has a register
// row — about 26 of ~3000 individual clients make it into that file. The CRA01
// register (`cra01-data.js`, built for the SARS CRA01 app by
// Greatensoft/apps/cra01/build-cra01-data.js) is driven off the client list
// itself and carries every individual, with the surname and first names as
// separate fields. So the dialog's "Individual" mode searches this file.
//
// WHERE IT COMES FROM
// Same arrangement as ClientRegRegister.js: a generated .js that assigns
// `window.__CRA01_CLIENTS__`, injected by a <script> tag (file:// pages cannot
// fetch), tried first in the IT share's Data folder and then in `web/data/`.
// Loaded lazily, the first time somebody switches to Individual.
//
// WHAT COMES OUT
// Each CRA01 record is converted into the ClientReg record shape, so the dialog's
// detail pane and ClientRegSearch.apply() handle it exactly as they would an
// individual found in the ClientReg register. Only person records are kept —
// the file also holds every entity, and those belong to the normal search.

const Cra01Register = (() => {
  const localData = (() => {
    const self = (document.currentScript && document.currentScript.src) || '';
    return self ? self.replace(/js\/Cra01Register\.js.*$/, 'data/cra01-data.js')
                : 'data/cra01-data.js';
  })();

  const DATA_SRCS = [
    'file://192.0.2.10/share/Data/cra01-data.js',
    localData
  ];

  // The label build-cra01-data.js gives the physical address in `unmapped`.
  const PHYS_LABEL = 'Physical address, as stored';

  let loadPromise = null;
  let index = null;     // [{ hay, name, rec }] — rec already in ClientReg shape
  let meta = null;      // { recordCount, generatedAt } for the dialog footer

  /* ── loading ──────────────────────────────────────────────────────────── */

  function injectFrom(sources, i) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = sources[i];
      script.async = true;
      script.onload = () => {
        if (window.__CRA01_CLIENTS__) resolve(window.__CRA01_CLIENTS__);
        else reject(new Error('The CRA01 register file loaded but was empty.'));
      };
      script.onerror = () => {
        script.remove();
        if (i + 1 < sources.length) injectFrom(sources, i + 1).then(resolve, reject);
        else reject(new Error('NOT_INSTALLED'));
      };
      document.head.appendChild(script);
    });
  }

  /** Load the register once. Resolves to { recordCount, generatedAt }. */
  function load() {
    if (loadPromise) return loadPromise;

    loadPromise = (window.__CRA01_CLIENTS__
      ? Promise.resolve(window.__CRA01_CLIENTS__)
      : injectFrom(DATA_SRCS, 0)
    ).then(reg => {
      const people = (reg.records || []).filter(isPerson).map(toClientReg);
      index = people.map(rec => ({
        hay: norm([rec.name.display, rec.name.raw, rec.clientCode,
                   rec.registration.number, rec._taxRef].filter(Boolean).join(' ')),
        name: norm(rec.name.display),
        rec: rec
      }));
      meta = { recordCount: people.length, generatedAt: reg.generatedAt || null };
      return meta;
    }).catch(err => {
      loadPromise = null;
      throw err;
    });

    return loadPromise;
  }

  function isLoaded() { return !!index; }

  function norm(s) {
    return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  /* ── reading a CRA01 record ───────────────────────────────────────────── */

  /** A natural person (or a deceased estate, which is filed as one). */
  function isPerson(r) {
    const a = r.answers || {};
    if (a.tx_registered_name) return false;
    const code = String(r.typeCode || '').toUpperCase();
    return code === 'IN' || code === 'EL' ||
      !!(a.tx_surname || a.tx_first_names || a.tx_id || a.tx_passport_no);
  }

  /** The physical address on one line: the stored lines, then town and code. */
  function physicalLines(r) {
    const a = r.answers || {};
    const stored = ((r.unmapped || {})[PHYS_LABEL] || []).map(l => String(l).trim()).filter(Boolean);
    const lines = stored.slice();
    const has = v => lines.some(l => l.toLowerCase().indexOf(String(v).toLowerCase()) !== -1);
    if (a.addr_city && !has(a.addr_city)) lines.push(a.addr_city);
    if (a.addr_postal && !has(a.addr_postal)) lines.push(a.addr_postal);
    return lines;
  }

  /**
   * CRA01 record → ClientReg record shape (see ClientRegRegister.summarise and
   * ClientRegSearch.apply for what is read). The name is put together from the
   * separate first-name and surname fields, so unlike a ClientReg individual it
   * is already in reading order — `name.ordered` says so.
   */
  function toClientReg(r) {
    const a = r.answers || {};
    const first = String(a.tx_first_names || '').trim();
    const sur = String(a.tx_surname || '').trim();
    const ordered = first && sur ? toTitleCase(first + ' ' + sur) : '';
    const display = ordered || ClientRegRegister.personalName(r.raw || r.display) || r.display || '';
    const estate = String(r.typeCode || '').toUpperCase() === 'EL';

    return {
      clientCode: r.clientCode || '',
      name: { display: display, raw: r.raw || '', ordered: !!ordered },
      entityType: {
        app: 'individual',
        desc: estate ? 'Estate Late' : 'Individual',
        code: r.typeCode || 'IN',
        baseCode: 'IN'
      },
      registration: { number: a.tx_id || a.tx_passport_no || '' },
      // The CRA01 export carries no year end; the dialog asks for it.
      yearEnd: {},
      addresses: { registered: physicalLines(r), postal: [] },
      source: { registerUpdated: (r.source || {}).registerUpdated || null, register: 'cra01' },
      directors: [], trustees: [], members: [], shareholders: [],
      _taxRef: r.taxRef || ''
    };
  }

  /* ── search ───────────────────────────────────────────────────────────── */

  const MAX_RESULTS = 40;

  /** Same rules as ClientRegRegister.search: every term must match, name-first ranking. */
  function search(query) {
    const q = norm(query);
    if (!q || !index) return { total: 0, results: [] };

    const terms = q.split(' ');
    const hits = [];
    for (const entry of index) {
      if (!terms.every(t => entry.hay.indexOf(t) !== -1)) continue;
      let score = 2;
      if (entry.name.indexOf(q) === 0) score = 0;
      else if (entry.name.indexOf(q) !== -1) score = 1;
      hits.push({ score: score, name: entry.name, rec: entry.rec });
    }

    hits.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
    return {
      total: hits.length,
      results: hits.slice(0, MAX_RESULTS).map(h => ClientRegRegister.summarise(h.rec))
    };
  }

  function info() { return meta; }

  return { load, isLoaded, search, info, _toClientReg: toClientReg, _isPerson: isPerson };
})();
