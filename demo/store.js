/* ==========================================================================
   store.js — the record store
   --------------------------------------------------------------------------
   This is the part of the demonstration that answers the question "what is
   actually different about storing a record instead of a row?"

   A spreadsheet row is a list of values. A record here is a list of values
   PLUS a _meta envelope: who captured it, when, from what source, which
   version this is, whether it passed validation, and what else it is linked
   to. Nothing in the rest of the system has to guess.

   Storage is the browser's localStorage, so nothing leaves the machine and
   the demonstration works offline. In a real deployment this module would be
   swapped for one that talks to a hosted database — every other file in the
   demo calls Store and would not need to change. That separation is itself
   one of the points the resource makes about adapting systems.
   ========================================================================== */

window.Store = (function () {
  'use strict';

  var KEY = 'lhh.overlay.v1';
  var SCHEMA_VERSION = '1.3.0';
  var COLLECTIONS = ['products', 'customers', 'suppliers', 'sales', 'stockMovements'];
  var OVERLAY_LIMIT = 3 * 1024 * 1024;   /* refuse to persist more than ~3MB */

  /* Only what the user actually changes is written to the browser.
     ------------------------------------------------------------------
     The twelve months of trading in seed.js is produced by a seeded
     generator, so it is byte-for-byte identical every time the page loads.
     Storing a copy of it would be storing something we can always rebuild —
     and at roughly 18MB it would blow the browser's storage quota on most
     machines, which is exactly the kind of thing that works on the developer's
     laptop and fails on the client's.

     So the browser holds a small overlay instead: the records the user
     created, the ones they changed, and the ones they deleted. On load the
     seed is rebuilt and the overlay is applied on top. Same visible result,
     a few kilobytes instead of eighteen megabytes. */
  var db = null;
  var overlay = null;
  var listeners = [];
  var currentUser = { id: 'u-sipho', name: 'Sipho Dlamini', role: 'Counter staff' };

  /* ---- Helpers ---------------------------------------------------------- */
  function now() { return new Date().toISOString(); }
  function pad(n, w) { var s = String(n); while (s.length < w) s = '0' + s; return s; }

  function nextId(collection, prefix) {
    var max = 0;
    (db[collection] || []).forEach(function (r) {
      var m = /(\d+)$/.exec(r.id || '');
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return prefix + '-' + pad(max + 1, 3);
  }

  function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ---- The metadata envelope -------------------------------------------- */
  /* Everything the shop currently loses the moment a number is typed into a
     cell. Written once at capture, updated on every save.                   */
  function makeMeta(type, opts) {
    opts = opts || {};
    return {
      id: opts.id,
      type: type,
      schemaVersion: SCHEMA_VERSION,
      createdAt: opts.createdAt || now(),
      createdBy: opts.createdBy || currentUser.name,
      modifiedAt: now(),
      modifiedBy: currentUser.name,
      version: opts.version || 1,
      source: opts.source || 'counter-capture',
      validationStatus: opts.validationStatus || 'valid',
      validationNotes: opts.validationNotes || [],
      links: opts.links || {}
    };
  }

  /* ---- Seeding ---------------------------------------------------------- */
  /* Seed records are marked source:"migration" on purpose. That is honest:
     they came out of the old spreadsheet, they were not captured through the
     validated form, and the system should say so rather than pretend every
     record is equally trustworthy. */
  function wrapSeed(type, rows, source) {
    return rows.map(function (row, i) {
      var r = deepClone(row);
      var flaw = r._flaw;
      delete r._flaw;
      delete r.weight;
      delete r.popularity;
      var createdAt = new Date(Date.now() - (rows.length - i) * 36e5).toISOString();
      r._meta = makeMeta(type, {
        id: r.id,
        createdAt: createdAt,
        createdBy: 'Spreadsheet migration',
        source: source || 'migration',
        validationStatus: flaw ? 'warning' : 'unverified',
        validationNotes: flaw ? [flaw] : []
      });
      r._meta.modifiedAt = createdAt;
      r._meta.modifiedBy = 'Spreadsheet migration';
      return r;
    });
  }

  function buildFromSeed() {
    var S = window.LHH_SEED;
    var fresh = {
      _format: 'lhh-record-store',
      _schemaVersion: SCHEMA_VERSION,
      _exportedAt: null,
      business: null,
      suppliers:      wrapSeed('suppliers', S.suppliers),
      products:       wrapSeed('products', S.products),
      customers:      wrapSeed('customers', S.customers),
      sales:          wrapSeed('sales', S.sales, 'migration'),
      stockMovements: wrapSeed('stockMovements', S.stockMovements, 'migration'),
      auditLog: []
    };
    /* Link each sale back to its customer. A spreadsheet writes the customer's
       name into the row; here the sale points at the customer record, so if
       the customer is corrected once, every document that uses them is right. */
    fresh.sales.forEach(function (s) {
      s._meta.links = { customer: s.customerId, products: s.lines.map(function (l) { return l.productId; }) };
    });
    fresh.stockMovements.forEach(function (m) { m._meta.links = { product: m.productId }; });
    fresh.products.forEach(function (p) { p._meta.links = { supplier: p.supplierId }; });
    return fresh;
  }

  /* ---- Persistence ------------------------------------------------------ */
  function emptyOverlay() {
    return { _schemaVersion: SCHEMA_VERSION, created: {}, updated: {}, deleted: {}, auditLog: [] };
  }

  function persist() {
    try {
      var payload = JSON.stringify(overlay);
      if (payload.length > OVERLAY_LIMIT) {
        /* Surfaced rather than swallowed. A system that silently stops saving
           is worse than one that refuses loudly. */
        console.warn('Overlay is ' + Math.round(payload.length / 1024) + 'KB and was not saved.');
        notify('error', 'Too much unsaved data to keep in the browser. Export it to a file instead.');
        return;
      }
      localStorage.setItem(KEY, payload);
    } catch (e) {
      console.warn('Could not save to local storage:', e);
      notify('error', 'Could not save — browser storage is full or blocked.');
    }
  }

  function applyOverlay() {
    COLLECTIONS.forEach(function (c) {
      (overlay.deleted[c] || []).forEach(function (id) {
        var i = (db[c] || []).findIndex(function (r) { return r.id === id; });
        if (i >= 0) db[c].splice(i, 1);
      });
      (overlay.created[c] || []).forEach(function (rec) {
        if (!api.get(c, rec.id)) db[c].push(rec);
      });
      Object.keys(overlay.updated[c] || {}).forEach(function (id) {
        var i = (db[c] || []).findIndex(function (r) { return r.id === id; });
        if (i >= 0) db[c][i] = overlay.updated[c][id];
        else db[c].push(overlay.updated[c][id]);
      });
    });
    db.auditLog = (overlay.auditLog || []).slice();
  }

  function load() {
    db = buildFromSeed();

    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { raw = null; }
    if (raw) {
      try {
        overlay = JSON.parse(raw);
        if (!overlay || !overlay.created) overlay = emptyOverlay();
        if (overlay._schemaVersion !== SCHEMA_VERSION) overlay = migrateOverlay(overlay);
      } catch (e) {
        console.warn('Saved changes could not be read; starting from the seed.');
        overlay = emptyOverlay();
      }
    } else {
      overlay = emptyOverlay();
    }
    applyOverlay();
  }

  /* Record the change in the overlay as well as in the live set. */
  function trackCreate(collection, rec) {
    (overlay.created[collection] = overlay.created[collection] || []).push(rec);
  }
  function trackUpdate(collection, rec) {
    var created = overlay.created[collection] || [];
    var i = created.findIndex(function (r) { return r.id === rec.id; });
    if (i >= 0) { created[i] = rec; return; }          /* created this session */
    (overlay.updated[collection] = overlay.updated[collection] || {})[rec.id] = rec;
  }
  function trackDelete(collection, id) {
    var created = overlay.created[collection] || [];
    var i = created.findIndex(function (r) { return r.id === id; });
    if (i >= 0) created.splice(i, 1);
    if (overlay.updated[collection]) delete overlay.updated[collection][id];
    (overlay.deleted[collection] = overlay.deleted[collection] || []).push(id);
  }

  /* ---- Schema migration -------------------------------------------------
     Deliberately present even though it does almost nothing today. The point
     being made is that records carry the version of the shape they were
     written in, so a system can be changed without throwing away history —
     something that cannot be done to a spreadsheet that five people have
     already saved their own copy of.                                        */
  function migrateOverlay(old) {
    var out = old || emptyOverlay();
    out.created = out.created || {};
    out.updated = out.updated || {};
    out.deleted = out.deleted || {};
    out.auditLog = out.auditLog || [];
    COLLECTIONS.forEach(function (c) {
      (out.created[c] || []).forEach(function (r) {
        if (!r._meta) r._meta = makeMeta(c, { id: r.id, source: 'migration', validationStatus: 'unverified' });
        r._meta.schemaVersion = SCHEMA_VERSION;
      });
      Object.keys(out.updated[c] || {}).forEach(function (id) {
        var r = out.updated[c][id];
        if (!r._meta) r._meta = makeMeta(c, { id: id, source: 'migration', validationStatus: 'unverified' });
        r._meta.schemaVersion = SCHEMA_VERSION;
      });
    });
    out._schemaVersion = SCHEMA_VERSION;
    out.auditLog.unshift({ at: now(), by: 'system', collection: 'system', action: 'schema-migrated',
      recordId: null, detail: 'Saved changes upgraded to schema ' + SCHEMA_VERSION });
    return out;
  }

  /* ---- Audit log -------------------------------------------------------- */
  function audit(collection, action, detail, recordId) {
    overlay.auditLog = overlay.auditLog || [];
    db.auditLog = overlay.auditLog;
    overlay.auditLog.unshift({
      at: now(),
      by: currentUser.name,
      collection: collection,
      action: action,
      recordId: recordId || null,
      detail: detail
    });
    if (overlay.auditLog.length > 400) overlay.auditLog.length = 400;
  }

  /* ---- Change notification ---------------------------------------------- */
  function notify(kind, message, payload) {
    listeners.forEach(function (fn) {
      try { fn({ kind: kind, message: message, payload: payload }); } catch (e) { console.error(e); }
    });
  }

  /* ---- Public API ------------------------------------------------------- */
  var api = {
    SCHEMA_VERSION: SCHEMA_VERSION,
    COLLECTIONS: COLLECTIONS,

    init: function () {
      if (!db) {
        /* The sign-in page writes the chosen role here. It is a role, not a
           credential — see login.html, which says so plainly. */
        try {
          var saved = localStorage.getItem('lhh.user');
          if (saved) currentUser = JSON.parse(saved);
        } catch (e) {}
        load();
      }
      return api;
    },

    onChange: function (fn) { listeners.push(fn); return api; },

    user: function (u) {
      if (u) {
        currentUser = u;
        try { localStorage.setItem('lhh.user', JSON.stringify(u)); } catch (e) {}
        notify('user', 'Signed in as ' + u.name);
      }
      return currentUser;
    },

    all: function (collection) {
      api.init();
      return (db[collection] || []).slice();
    },

    get: function (collection, id) {
      api.init();
      return (db[collection] || []).find(function (r) { return r.id === id; }) || null;
    },

    /* Resolve a reference. This single function is the practical difference
       between "the customer's name is typed on the invoice" and "the invoice
       points at the customer". */
    resolve: function (collection, id, field) {
      var r = api.get(collection, id);
      if (!r) return null;
      return field ? r[field] : r;
    },

    count: function (collection) { api.init(); return (db[collection] || []).length; },

    insert: function (collection, data, opts) {
      api.init();
      opts = opts || {};
      var prefix = ({ products:'PRD', customers:'CUS', suppliers:'SUP', sales:'SAL', stockMovements:'MOV' })[collection] || 'REC';
      var rec = deepClone(data);
      rec.id = rec.id || nextId(collection, prefix);
      rec._meta = makeMeta(collection, {
        id: rec.id,
        source: opts.source || 'counter-capture',
        validationStatus: opts.validationStatus || 'valid',
        validationNotes: opts.validationNotes || [],
        links: opts.links || {}
      });
      db[collection] = db[collection] || [];
      db[collection].push(rec);
      trackCreate(collection, rec);
      audit(collection, 'created', (opts.label || rec.id) + ' captured', rec.id);
      persist();
      notify('insert', 'Saved ' + rec.id, { collection: collection, record: rec });
      return rec;
    },

    /* Updates bump the version and keep the original capture details. The old
       values are written to the audit log, so "who changed this price?" is an
       answerable question for the first time. */
    update: function (collection, id, changes, opts) {
      api.init();
      opts = opts || {};
      var rec = api.get(collection, id);
      if (!rec) return null;
      var changed = [];
      Object.keys(changes).forEach(function (k) {
        if (k === '_meta' || k === 'id') return;
        if (JSON.stringify(rec[k]) !== JSON.stringify(changes[k])) {
          changed.push(k + ': ' + JSON.stringify(rec[k]) + ' → ' + JSON.stringify(changes[k]));
          rec[k] = changes[k];
        }
      });
      if (!changed.length) return rec;
      rec._meta.version += 1;
      rec._meta.modifiedAt = now();
      rec._meta.modifiedBy = currentUser.name;
      if (opts.validationStatus) rec._meta.validationStatus = opts.validationStatus;
      if (opts.validationNotes) rec._meta.validationNotes = opts.validationNotes;
      trackUpdate(collection, rec);
      audit(collection, 'updated', changed.join('; '), id);
      persist();
      notify('update', 'Updated ' + id, { collection: collection, record: rec, changed: changed });
      return rec;
    },

    /* POPIA s.14 and s.24: a data subject may ask for their information to be
       deleted, and you must be able to do it. Note what is kept — the audit
       entry records that a deletion happened and who did it, without keeping
       the personal information itself. */
    remove: function (collection, id, reason) {
      api.init();
      var i = (db[collection] || []).findIndex(function (r) { return r.id === id; });
      if (i < 0) return false;
      db[collection].splice(i, 1);
      trackDelete(collection, id);
      audit(collection, 'deleted', reason || 'Record deleted', id);
      persist();
      notify('delete', 'Deleted ' + id, { collection: collection, id: id });
      return true;
    },

    /* ---- Referential integrity ----------------------------------------- */
    /* Which records point at this one? Asked before deleting anything, and
       used by the Integration page to show what "one source of truth" means
       in practice. */
    dependents: function (collection, id) {
      api.init();
      var out = [];
      if (collection === 'customers') {
        db.sales.forEach(function (s) { if (s.customerId === id) out.push({ collection:'sales', id:s.id, label:s.docNumber }); });
      }
      if (collection === 'products') {
        db.sales.forEach(function (s) {
          if (s.lines.some(function (l) { return l.productId === id; })) out.push({ collection:'sales', id:s.id, label:s.docNumber });
        });
        db.stockMovements.forEach(function (m) { if (m.productId === id) out.push({ collection:'stockMovements', id:m.id, label:m.id }); });
      }
      if (collection === 'suppliers') {
        db.products.forEach(function (p) { if (p.supplierId === id) out.push({ collection:'products', id:p.id, label:p.name }); });
      }
      return out;
    },

    /* ---- Derived values ------------------------------------------------ */
    /* Stock on hand is not a number somebody types. It is the opening figure
       plus every movement since. Calculated, not remembered — so it cannot
       drift out of agreement with the movements that produced it. */
    stockFor: function (productId) {
      api.init();
      var p = api.get('products', productId);
      if (!p) return 0;
      var moved = db.stockMovements.reduce(function (t, m) {
        return m.productId === productId ? t + m.qty : t;
      }, 0);
      return p.stockOnHand + moved;
    },

    /* ---- Export / import ------------------------------------------------ */
    /* Portability is a deliberate feature, not a convenience. A small business
       that cannot get its own data out of a system is locked in, and lock-in is
       one of the real trade-offs this resource is honest about. */
    exportJSON: function (collections) {
      api.init();
      var out = {
        _format: 'lhh-record-store',
        _schemaVersion: SCHEMA_VERSION,
        _exportedAt: now(),
        _exportedBy: currentUser.name,
        _note: 'Portable export. Every record keeps its _meta envelope, so nothing is lost by moving it.',
        business: (window.LHH_SCHEMA && window.LHH_SCHEMA.business) || null
      };
      (collections && collections.length ? collections : COLLECTIONS).forEach(function (c) {
        out[c] = deepClone(db[c] || []);
      });
      out.auditLog = deepClone(db.auditLog || []).slice(0, 100);
      audit('system', 'exported', 'Exported ' + (collections || COLLECTIONS).join(', '));
      persist();
      return out;
    },

    /* Import validates the shape of the file before touching anything. An
       import that half-succeeds is worse than one that refuses. */
    importJSON: function (obj, mode) {
      api.init();
      mode = mode || 'merge';
      var report = { ok:false, added:0, updated:0, skipped:0, errors:[], warnings:[] };

      if (!obj || typeof obj !== 'object') { report.errors.push('That file is not valid JSON.'); return report; }
      if (obj._format !== 'lhh-record-store') {
        report.errors.push('This file was not produced by this system (missing _format marker). Importing it could corrupt the records.');
        return report;
      }
      if (obj._schemaVersion !== SCHEMA_VERSION) {
        report.warnings.push('File was written against schema ' + obj._schemaVersion + ', current is ' + SCHEMA_VERSION + '. Records will be migrated on load.');
      }

      var found = COLLECTIONS.filter(function (c) { return Array.isArray(obj[c]); });
      if (!found.length) { report.errors.push('No recognised collections found in the file.'); return report; }

      if (mode === 'replace') {
        found.forEach(function (c) {
          (db[c] || []).forEach(function (r) { trackDelete(c, r.id); });
          db[c] = [];
        });
      }

      found.forEach(function (c) {
        obj[c].forEach(function (rec) {
          if (!rec || !rec.id) { report.skipped++; report.warnings.push('A record in "' + c + '" had no id and was skipped.'); return; }
          if (!rec._meta) {
            rec._meta = makeMeta(c, { id: rec.id, source: 'import', validationStatus: 'unverified' });
            report.warnings.push(rec.id + ' arrived without metadata and was marked unverified.');
          }
          var existing = api.get(c, rec.id);
          if (existing) {
            if (mode === 'merge') {
              /* Last write wins, but only if the incoming record is genuinely
                 newer. Comparing modifiedAt is the simplest honest rule. */
              if (new Date(rec._meta.modifiedAt) > new Date(existing._meta.modifiedAt)) {
                var i = db[c].indexOf(existing);
                db[c][i] = rec;
                trackUpdate(c, rec);
                report.updated++;
              } else { report.skipped++; }
            } else { db[c].push(rec); trackCreate(c, rec); report.added++; }
          } else {
            db[c] = db[c] || [];
            db[c].push(rec);
            trackCreate(c, rec);
            report.added++;
          }
        });
      });

      audit('system', 'imported', 'Imported ' + report.added + ' new, ' + report.updated + ' updated, ' + report.skipped + ' skipped');
      persist();
      report.ok = true;
      notify('import', 'Import finished', report);
      return report;
    },

    auditLog: function (limit) {
      api.init();
      return (db.auditLog || []).slice(0, limit || 50);
    },

    /* ---- Health check ---------------------------------------------------
       The information-quality score shown on the dashboard. Deliberately
       simple and explainable: a business owner must be able to see why the
       number is what it is, otherwise it is just another number to distrust. */
    quality: function () {
      api.init();
      var issues = [];
      var checks = 0, passed = 0;

      /* The score is calculated over master data only — the products and the
         customers. That is deliberate. If every one of several thousand sales
         counted as a passing check, a handful of genuinely broken records
         would round away to nothing and the score would read 100% while the
         shop was still extending credit to a customer nobody can identify.
         A quality score that cannot go down is worse than no score at all.
         Transaction integrity is counted and reported separately below. */

      db.products.forEach(function (p) {
        checks += 3;
        if (p.sellPrice > p.costPrice) passed++; else issues.push({ sev:'error', collection:'products', id:p.id, label:p.name, msg:'Sold below cost price (R' + p.sellPrice.toFixed(2) + ' vs R' + p.costPrice.toFixed(2) + ').' });
        var margin = p.costPrice ? (p.sellPrice - p.costPrice) / p.costPrice : 0;
        if (margin >= 0.10) passed++; else issues.push({ sev:'warning', collection:'products', id:p.id, label:p.name, msg:'Margin is ' + (margin * 100).toFixed(1) + '% — under the 10% the shop works on.' });
        if (p.barcode) passed++; else issues.push({ sev:'warning', collection:'products', id:p.id, label:p.name, msg:'No barcode, so it cannot be scanned at the counter.' });
      });

      var seenPhones = {};
      db.customers.forEach(function (c) {
        checks += 4;
        if ((c.popiaPurpose || []).length) passed++; else issues.push({ sev:'error', collection:'customers', id:c.id, label:c.name, msg:'No lawful purpose recorded for holding this person\'s information (POPIA s.13).' });
        if (!c.popiaConsentMarketing || c.popiaConsentDate) passed++; else issues.push({ sev:'error', collection:'customers', id:c.id, label:c.name, msg:'Marketing consent ticked but no date recorded — the shop cannot prove consent was given.' });
        if (c.popiaRetentionUntil || c.id === 'CUS-001') passed++; else issues.push({ sev:'warning', collection:'customers', id:c.id, label:c.name, msg:'No retention date — POPIA s.14 expects you to know when this record should be deleted.' });
        if (/^0[6-8][0-9]{8}$/.test(c.phone) || c.id === 'CUS-001') passed++; else issues.push({ sev:'error', collection:'customers', id:c.id, label:c.name, msg:'Phone number "' + c.phone + '" is not a valid South African mobile number.' });
        if (c.phone && c.phone !== '0000000000') {
          if (seenPhones[c.phone]) issues.push({ sev:'warning', collection:'customers', id:c.id, label:c.name, msg:'Same mobile number as ' + seenPhones[c.phone] + ' — likely the same person captured twice.' });
          else seenPhones[c.phone] = c.name;
        }
      });

      /* Transactions: counted, but kept out of the headline score. */
      var brokenSales = 0;
      db.sales.forEach(function (s) {
        var allExist = s.lines.every(function (l) { return !!api.get('products', l.productId); });
        if (!allExist) {
          brokenSales++;
          issues.push({ sev:'error', collection:'sales', id:s.id, label:s.docNumber, msg:'Contains a line for a product that no longer exists.' });
        }
      });

      var unverified = 0;
      COLLECTIONS.forEach(function (c) {
        (db[c] || []).forEach(function (r) { if (r._meta && r._meta.validationStatus === 'unverified') unverified++; });
      });

      return {
        /* Rounded DOWN: 99.6% of checks passing is not 100%. */
        score: checks ? Math.floor((passed / checks) * 100) : 100,
        checks: checks,
        passed: passed,
        salesChecked: db.sales.length,
        salesBroken: brokenSales,
        issues: issues.sort(function (a, b) { return a.sev === b.sev ? 0 : (a.sev === 'error' ? -1 : 1); }),
        errors: issues.filter(function (i) { return i.sev === 'error'; }).length,
        warnings: issues.filter(function (i) { return i.sev === 'warning'; }).length,
        unverified: unverified
      };
    },

    /* ---- Reset ---------------------------------------------------------- */
    reset: function () {
      try { localStorage.removeItem(KEY); } catch (e) {}
      db = null; overlay = null;
      load();
      notify('reset', 'Demonstration data restored to its starting state.');
      return api;
    },

    /* Used by the "Your data" screen to show, honestly, how little is being
       kept in the browser compared with how much is on screen. */
    storageInfo: function () {
      api.init();
      var stored = 0;
      try { stored = (localStorage.getItem(KEY) || '').length; } catch (e) {}
      var changes = 0;
      COLLECTIONS.forEach(function (c) {
        changes += (overlay.created[c] || []).length +
                   Object.keys(overlay.updated[c] || {}).length +
                   (overlay.deleted[c] || []).length;
      });
      return {
        storedBytes: stored,
        liveBytes: JSON.stringify(db).length,
        changes: changes,
        auditEntries: (overlay.auditLog || []).length
      };
    },

    raw: function () { api.init(); return db; }
  };

  return api;
}());
