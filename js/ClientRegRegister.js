// ClientRegRegister.js — the Registry ClientReg register itself: loading it,
// searching it, and reading a record's shape.
//
// Depends on: utils.js (toTitleCase, parseName, isRegNumber).
//
// WHY THIS FILE EXISTS
// Two apps import from ClientReg — the main Policy Generator (`web/index.html`,
// through ClientRegSearch.js's dialog) and the Assurance Engagements app
// (`web/Assurance Engagements/index.html`, through its type-ahead). They must
// read the *same* register from the *same* place: a client found in one and
// missing in the other is the kind of difference nobody can explain at a desk.
// So the source list, the index, the search ranking and the record-shape
// readers live here, once, and each app keeps only the part that puts a record
// onto its own form.
//
// WHERE THE REGISTER COMES FROM
// One generated file, `clientreg-data.js`, which assigns the whole register to
// `window.__CLIENTREG__`. It is NOT a .json and it is not fetched: the apps run
// from a file:// page (the share copy opened directly), where Chromium blocks
// fetch/XHR against local files. A <script> tag is exempt — the same reason
// SavedBusinesses.js exists.
//
// The master copy lives in the IT share alongside the other Registry exports,
// NOT beside the app, so refreshing the register does not mean touching the
// deployed app folder. That absolute UNC path is tried first; a copy sitting in
// `web/data/` next to the app is still honoured as a fallback, which is what a
// dev checkout and any machine off the office LAN will find.
//
// It is injected lazily, the first time somebody searches, so machines that
// never search never pay for parsing a few thousand client records. Producing
// and deploying the file is documented in web/data/README.md.

const ClientRegRegister = (() => {
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'];

  // The fallback copy is resolved against *this* file rather than against the
  // page, so the Assurance Engagements app — one folder deeper — finds the same
  // `web/data/clientreg-data.js` the main app does instead of looking for a
  // second copy beside itself.
  const localData = (() => {
    const self = (document.currentScript && document.currentScript.src) || '';
    return self ? self.replace(/js\/ClientRegRegister\.js.*$/, 'data/clientreg-data.js')
                : 'data/clientreg-data.js';
  })();

  // Sources tried in order, first one that loads wins. Spaces and parentheses
  // are percent-encoded because this is a URL, not a Windows path.
  const DATA_SRCS = [
    'file://192.0.2.10/share/Data/clientreg-data.js',
    localData
  ];

  let loadPromise = null; // in-flight or finished register load
  let index = null;       // [{ hay, name, rec }] — built once, after loading

  /* ── loading ──────────────────────────────────────────────────────────── */

  /** Inject clientreg-data.js from the first source that has it. */
  function injectFrom(sources, i) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = sources[i];
      script.async = true;
      script.onload = () => {
        if (window.__CLIENTREG__) resolve(window.__CLIENTREG__);
        else reject(new Error('The ClientReg register file loaded but was empty.'));
      };
      // A missing file is the normal case on a machine that has not had the
      // register copied in, so it is reported as a state, not a crash.
      script.onerror = () => {
        script.remove();
        if (i + 1 < sources.length) injectFrom(sources, i + 1).then(resolve, reject);
        else reject(new Error('NOT_INSTALLED'));
      };
      document.head.appendChild(script);
    });
  }

  /** Load the register once. Resolves to the register, or rejects. */
  function load() {
    if (loadPromise) return loadPromise;

    loadPromise = (window.__CLIENTREG__
      ? Promise.resolve(window.__CLIENTREG__)
      : injectFrom(DATA_SRCS, 0)
    ).then(reg => {
      index = buildIndex(reg.records || []);
      return reg;
    }).catch(err => {
      loadPromise = null; // let a later search retry, in case the file arrives
      throw err;
    });

    return loadPromise;
  }

  /** Is the register in memory and indexed? */
  function isLoaded() { return !!index; }

  /** Fold to a plain lowercase alphanumeric-and-space form for matching. */
  function norm(s) {
    return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function buildIndex(records) {
    return records.map(rec => {
      const n = rec.name || {};
      return {
        hay: norm([n.display, n.raw, n.former, rec.clientCode, (rec.registration || {}).number]
          .filter(Boolean).join(' ')),
        name: norm(n.display || n.raw),
        rec: rec
      };
    });
  }

  /* ── search ───────────────────────────────────────────────────────────── */

  const MAX_RESULTS = 40;

  /**
   * Every whitespace-separated term must appear, so typing more words narrows
   * instead of widening. Ranking favours a name that starts with the query, then
   * one that contains it — a user typing the first word of a client's name
   * expects that client at the top.
   */
  function search(query) {
    // The register can already be present without this module having loaded it —
    // a page that ships it as a plain <script> tag, say. Index it either way.
    if (!index && typeof window !== 'undefined' && window.__CLIENTREG__) {
      index = buildIndex(window.__CLIENTREG__.records || []);
    }
    const q = norm(query);
    if (!q || !index) return { total: 0, results: [] };

    const terms = q.split(' ');
    const hits = [];

    for (const entry of index) {
      let ok = true;
      for (const t of terms) {
        if (entry.hay.indexOf(t) === -1) { ok = false; break; }
      }
      if (!ok) continue;

      let score = 2;
      if (entry.name.indexOf(q) === 0) score = 0;
      else if (entry.name.indexOf(q) !== -1) score = 1;

      hits.push({ score: score, name: entry.name, rec: entry.rec });
    }

    hits.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
    return { total: hits.length, results: hits.slice(0, MAX_RESULTS).map(h => summarise(h.rec)) };
  }

  /** The thin shape a result row renders. */
  function summarise(rec) {
    const n = rec.name || {};
    const y = rec.yearEnd || {};
    return {
      clientCode: rec.clientCode,
      name: n.display || n.raw || null,
      former: n.former || null,
      entityType: (rec.entityType || {}).app || null,
      entityDesc: (rec.entityType || {}).desc || null,
      regNumber: (rec.registration || {}).number || null,
      yearEndMonth: y.month || null,
      yearEndDay: y.day || null,
      registerUpdated: (rec.source || {}).registerUpdated || null,
      people: (rec.directors || []).length + (rec.trustees || []).length +
              (rec.members || []).length + (rec.shareholders || []).length,
      record: rec
    };
  }

  /* ── reading a record ─────────────────────────────────────────────────── */

  /**
   * The app's entity type for a record, falling back to a name-based guess.
   *
   * @param {function(string):boolean} [isSupported] which types the calling app
   *        can actually show. The main app knows attorneys and schools; the
   *        Assurance Engagements app does not, and anything it cannot show
   *        comes back as `company` rather than as a type its form has no entry
   *        for.
   */
  function resolveType(record, isSupported) {
    const ok = typeof isSupported === 'function' ? isSupported : () => true;
    const fall = t => (ok(t) ? t : 'company');

    const et = record.entityType || {};
    if (et.app && ok(et.app)) return et.app;

    // A person, whatever Registry calls the type. BaseTypeCode collapses every
    // person-shaped TypeCode (IN, EL) onto IN, so this catches a type the export
    // could not map. It has to come before the name guesses below: a person's
    // name has nothing to detect on and would fall through to `company`.
    if (et.baseCode === 'IN' || et.code === 'IN' || et.code === 'EL') return fall('individual');

    const upper = String((record.name || {}).raw || (record.name || {}).display || '').toUpperCase();
    if (/\bTRUST\b/.test(upper)) return fall('trust');
    if (/\bCC\b|\bBK\b/.test(upper)) return fall('cc');
    if (/\bNPC\b/.test(upper)) return fall('npc');
    if (/\bNPO\b/.test(upper)) return fall('npo');
    if (/\bINC\b|\bINCORPORATED\b/.test(upper)) return fall('attorneys');
    if (/\bSCHOOL\b|\bSKOOL\b/.test(upper)) return fall('school');
    if (/\bBODY\s*CORPORATE\b/.test(upper)) return fall('bc');
    if (/\bCHURCH\b|\bKERK\b|\bGEMEENTE\b/.test(upper)) return fall('church');
    if (/\bCLUB\b/.test(upper)) return fall('club');
    return 'company';
  }

  const HONORIFIC = /^(mr|mrs|ms|miss|dr|prof|adv|me|mnr|mev|rev|ds)\.?$/i;

  /**
   * An individual's name as it should read on a document.
   *
   * Registry stores a person the way a filing clerk types them — surname
   * first, often with a title tacked on the end ("KAPP JOHAN MORNE MR") — and
   * the entity export carries no separate surname field for the *client*
   * itself (only for role players), so the parts cannot be recombined. The
   * honorific is dropped, the casing is fixed, and the word order is left
   * exactly as stored rather than guessed at: a multi-word surname is
   * indistinguishable from multiple first names. The caller tells the user to
   * check it.
   */
  function personalName(raw) {
    const words = String(raw || '').trim().split(/\s+/).filter(w => w && !HONORIFIC.test(w));
    return words.length ? toTitleCase(words.join(' ')) : '';
  }

  /** Which list of role players the form's governing-body section shows. */
  function peopleFor(record, type) {
    if (type === 'trust' || type === 'bc') return record.trustees && record.trustees.length ? record.trustees : (record.directors || []);
    if (type === 'cc') return record.members && record.members.length ? record.members : (record.directors || []);
    return record.directors || [];
  }

  /** Address lines → the single-line, comma-separated form the apps store. */
  function joinAddress(lines) {
    if (!lines || !lines.length) return '';
    return lines.map(l => String(l).trim()).filter(Boolean).join(', ');
  }

  /** Initials + surname for a role player, however the export named them. */
  function nameParts(person) {
    const n = person.name || {};
    if (n.initials && n.surname) {
      return { initials: n.initials, surname: n.surname };
    }
    const source = n.full || [n.first, n.surname].filter(Boolean).join(' ');
    if (!source) return { initials: '', surname: n.surname || '' };
    const parsed = parseName(source);
    return { initials: n.initials || parsed.initials, surname: n.surname || parsed.surname };
  }

  /** A role player that is a business, not a natural person. */
  function isBusiness(person) {
    return person.isEntity === true ||
      (!person.idNumber && isRegNumber(person.roleDetail || '')) ||
      isRegNumber(person.idNumber || '');
  }

  /**
   * Most recent year end that has already passed, for month/day.
   *
   * Registry stores a year-end *date*, but the stored year is stale on most
   * records; only the month and day are reliable (measured during the export
   * work). So the year end is rebuilt from month + day and a year the caller
   * either asks the user to confirm or defaults from here.
   */
  function defaultYear(month, day) {
    const now = new Date();
    const thisYear = now.getFullYear();
    if (!month) return thisYear;
    const candidate = new Date(thisYear, month - 1, day || 1);
    return candidate <= now ? thisYear : thisYear - 1;
  }

  /** "28 February 2026", or '' when the register has no month for the client. */
  function yearEndText(record, year) {
    const ye = record.yearEnd || {};
    if (!ye.month || !year) return '';
    return (ye.day || 1) + ' ' + MONTHS[ye.month - 1] + ' ' + year;
  }

  return {
    MONTHS,
    load, isLoaded, search, summarise,
    resolveType, personalName, peopleFor, joinAddress, nameParts, isBusiness,
    defaultYear, yearEndText
  };
})();
