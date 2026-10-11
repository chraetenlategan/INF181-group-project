/* ==========================================================================
   validate.js — validation at the point of capture
   --------------------------------------------------------------------------
   The argument this file exists to make: it is far cheaper to refuse a bad
   value at the counter than to find it in a report three months later.

   Two severities, and the difference matters to a small business:
     error   — the record cannot be saved. Reserved for things that are
               definitely wrong (a sale pointing at a product that does not
               exist, a selling price below cost).
     warning — the record can be saved, but the person capturing it has to
               acknowledge the warning, and the acknowledgement is stored in
               the record's metadata. Shops have exceptions; a system that
               refuses every exception gets worked around, and a system that
               gets worked around holds worse data than no system at all.
   ========================================================================== */

window.Validate = (function () {
  'use strict';

  var RX = {
    sku:    /^[A-Z]{3}-[0-9]{4}$/,
    saMobile: /^0[6-8][0-9]{8}$/,
    saPhone:  /^0[1-8][0-9]{8}$/,
    vat:    /^4[0-9]{9}$/,
    email:  /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/
  };

  function err(field, msg)  { return { field: field, severity: 'error',   message: msg }; }
  function warn(field, msg) { return { field: field, severity: 'warning', message: msg }; }

  function isBlank(v) {
    return v === undefined || v === null || v === '' ||
           (Array.isArray(v) && v.length === 0);
  }

  function num(v) { var n = parseFloat(v); return isNaN(n) ? null : n; }

  /* ---- Generic field checks driven by the schema ------------------------ */
  function checkField(name, def, value, all) {
    var out = [];
    if (def.required && isBlank(value)) {
      out.push(err(name, def.label + ' is required.'));
      return out;                       /* no point checking the rest */
    }
    if (isBlank(value)) return out;

    switch (def.type) {
      case 'string':
        if (def.minLength && String(value).trim().length < def.minLength)
          out.push(err(name, def.label + ' must be at least ' + def.minLength + ' characters.'));
        if (def.pattern && !new RegExp(def.pattern).test(String(value).trim()))
          out.push(err(name, def.label + ' is not in the expected format. ' + (def.hint || '')));
        break;

      case 'number':
      case 'money': {
        var n = num(value);
        if (n === null) { out.push(err(name, def.label + ' must be a number.')); break; }
        if (def.min !== undefined && n < def.min)
          out.push(err(name, def.label + ' cannot be less than ' + def.min + '.'));
        if (def.max !== undefined && n > def.max)
          out.push(err(name, def.label + ' cannot be more than ' + def.max + '.'));
        if (def.type === 'money' && Math.round(n * 100) !== n * 100)
          out.push(warn(name, def.label + ' has more than two decimals and will be rounded to the cent.'));
        break;
      }

      case 'phone':
        if (!RX.saPhone.test(String(value).replace(/\s/g, '')))
          out.push(err(name, def.label + ' must be a 10-digit South African number. ' + (def.hint || '')));
        break;

      case 'email':
        if (!RX.email.test(String(value).trim()))
          out.push(err(name, 'That does not look like a valid email address.'));
        break;

      case 'date': {
        if (isNaN(Date.parse(value)))
          out.push(err(name, def.label + ' is not a valid date.'));
        else if (def.noFuture && new Date(value) > new Date())
          out.push(err(name, def.label + ' cannot be in the future.'));
        break;
      }

      case 'enum':
        if (def.values && def.values.indexOf(value) === -1)
          out.push(err(name, '"' + value + '" is not one of the allowed options for ' + def.label + '.'));
        break;

      case 'multi':
        if (def.values && [].concat(value).some(function (v) { return def.values.indexOf(v) === -1; }))
          out.push(err(name, 'Unrecognised option selected for ' + def.label + '.'));
        break;

      case 'ref': {
        /* The check a spreadsheet structurally cannot do: does the thing this
           record points at actually exist? */
        if (!window.Store.get(def.refs, value))
          out.push(err(name, 'The selected ' + def.refs.replace(/s$/, '') + ' does not exist in the system.'));
        break;
      }
    }

    if (def.unique && !isBlank(value)) {
      var coll = all && all.__collection;
      if (coll) {
        var clash = window.Store.all(coll).find(function (r) {
          return r[name] === value && r.id !== (all.id || null);
        });
        if (clash) out.push(err(name, def.label + ' "' + value + '" is already used by ' + (clash.name || clash.id) + '.'));
      }
    }
    return out;
  }

  /* ---- Collection-specific business rules ------------------------------- */
  var businessRules = {

    products: function (rec) {
      var out = [];
      var cost = num(rec.costPrice), sell = num(rec.sellPrice);
      if (cost !== null && sell !== null) {
        if (sell < cost) {
          out.push(err('sellPrice', 'Selling price (R' + sell.toFixed(2) + ') is below cost price (R' + cost.toFixed(2) + '). Every sale of this item loses money.'));
        } else if (cost > 0) {
          var margin = (sell - cost) / cost;
          if (margin < 0.10)
            out.push(warn('sellPrice', 'Margin is only ' + (margin * 100).toFixed(1) + '%. The shop normally works on 10% or better — is this deliberate?'));
          if (margin > 2.5)
            out.push(warn('sellPrice', 'Margin is ' + (margin * 100).toFixed(0) + '%. That is unusually high — check the cost price was entered correctly.'));
        }
      }
      var stock = num(rec.stockOnHand), reorder = num(rec.reorderLevel);
      if (stock !== null && reorder !== null && stock <= reorder)
        out.push(warn('stockOnHand', 'Stock on hand is already at or below the reorder level. This item needs ordering.'));
      if (!rec.barcode)
        out.push(warn('barcode', 'Without a barcode this item has to be found by hand at the till, which is slower and more error-prone.'));
      return out;
    },

    customers: function (rec) {
      var out = [];

      /* POPIA s.13 — purpose specification. */
      if (!(rec.popiaPurpose || []).length)
        out.push(err('popiaPurpose', 'POPIA requires a recorded reason for holding somebody\'s personal information. Tick at least one.'));

      /* POPIA s.69 — direct marketing. Consent must be demonstrable. */
      if (rec.popiaConsentMarketing) {
        if (!rec.popiaConsentDate)
          out.push(err('popiaConsentDate', 'If the customer consented to marketing, record the date. Without it the shop cannot prove consent was ever given.'));
        if (!rec.phone && !rec.email)
          out.push(err('popiaConsentMarketing', 'Marketing consent has been ticked but there is no phone number or email address to send anything to.'));
        if ((rec.popiaPurpose || []).indexOf('Marketing (SMS/email)') === -1)
          out.push(err('popiaPurpose', 'Marketing consent is ticked, so "Marketing (SMS/email)" must also be listed as a purpose.'));
      }

      /* POPIA s.14 — retention limitation. */
      if (!rec.popiaRetentionUntil)
        out.push(warn('popiaRetentionUntil', 'No deletion date set. POPIA says personal information may not be kept longer than it is needed for.'));

      /* Credit control. */
      var limit = num(rec.creditLimit) || 0;
      if (limit > 0 && rec.creditTerms === 'Cash only')
        out.push(err('creditTerms', 'A credit limit of R' + limit.toFixed(2) + ' cannot sit on a cash-only account. Choose payment terms.'));
      if (rec.creditTerms !== 'Cash only' && limit <= 0)
        out.push(warn('creditLimit', 'Payment terms are set but the credit limit is zero, so no credit sale will be allowed.'));
      if (limit > 20000 && !rec.vatNumber && rec.type !== 'Business')
        out.push(warn('creditLimit', 'A credit limit over R20 000 on a personal account is a large exposure for a shop this size.'));

      /* Duplicate detection on mobile number — the check that would have
         caught Sarah Nel being captured twice. */
      if (rec.phone && rec.phone !== '0000000000') {
        var dup = window.Store.all('customers').find(function (c) {
          return c.phone === rec.phone && c.id !== rec.id;
        });
        if (dup) out.push(warn('phone', 'This mobile number is already on file for "' + dup.name + '" (' + dup.id + '). Is this the same person?'));
      }

      if (rec.vatNumber && !RX.vat.test(rec.vatNumber))
        out.push(err('vatNumber', 'A South African VAT number is ten digits starting with 4.'));

      if (rec.notes && rec.notes.length > 200)
        out.push(warn('notes', 'Long free-text notes about a person are themselves personal information, and the customer may ask to see them. Keep notes factual and short.'));

      return out;
    },

    sales: function (rec) {
      var out = [];
      var lines = rec.lines || [];
      if (!lines.length) { out.push(err('lines', 'A sale needs at least one item on it.')); return out; }

      lines.forEach(function (l, i) {
        var p = window.Store.get('products', l.productId);
        if (!p) {
          out.push(err('lines', 'Line ' + (i + 1) + ' points at a product that does not exist.'));
          return;
        }
        var qty = num(l.qty);
        if (qty === null || qty <= 0) out.push(err('lines', 'Line ' + (i + 1) + ' (' + p.name + '): quantity must be more than zero.'));
        var price = num(l.unitPrice);
        if (price === null || price < 0) out.push(err('lines', 'Line ' + (i + 1) + ' (' + p.name + '): price is not valid.'));
        else if (price < p.costPrice) out.push(warn('lines', 'Line ' + (i + 1) + ' (' + p.name + '): selling at R' + price.toFixed(2) + ', below the cost of R' + p.costPrice.toFixed(2) + '.'));

        var available = window.Store.stockFor(l.productId);
        if (qty > available)
          out.push(warn('lines', 'Line ' + (i + 1) + ' (' + p.name + '): selling ' + qty + ' but only ' + available + ' are recorded in stock. Either the stock figure is wrong or this will go negative.'));
      });

      var cust = window.Store.get('customers', rec.customerId);
      if (!cust) out.push(err('customerId', 'This sale is not linked to a customer record.'));
      else if (rec.paymentMethod === 'On account') {
        if (cust.creditTerms === 'Cash only')
          out.push(err('paymentMethod', cust.name + ' is a cash-only customer and cannot buy on account.'));
        else {
          /* Outstanding balance check — a real credit control rule. */
          var owing = window.Store.all('sales')
            .filter(function (s) { return s.customerId === cust.id && s.status === 'Unpaid'; })
            .reduce(function (t, s) { return t + (s.total || 0); }, 0);
          var thisTotal = lines.reduce(function (t, l) { return t + (num(l.qty) || 0) * (num(l.unitPrice) || 0); }, 0) * 1.15;
          if (owing + thisTotal > (cust.creditLimit || 0))
            out.push(warn('paymentMethod', cust.name + ' already owes R' + owing.toFixed(2) + '. This sale would take them to R' + (owing + thisTotal).toFixed(2) + ', over their R' + (cust.creditLimit || 0).toFixed(2) + ' limit.'));
        }
      }

      if (rec.date && new Date(rec.date) > new Date())
        out.push(err('date', 'A sale cannot be dated in the future.'));

      return out;
    },

    suppliers: function (rec) {
      var out = [];
      var lt = num(rec.leadTimeDays);
      if (lt !== null && lt > 30)
        out.push(warn('leadTimeDays', 'A lead time over 30 days makes automatic reordering unreliable. Confirm it with the supplier.'));
      return out;
    },

    stockMovements: function (rec) {
      var out = [];
      if (!window.Store.get('products', rec.productId))
        out.push(err('productId', 'This movement points at a product that does not exist.'));
      if (num(rec.qty) === 0)
        out.push(err('qty', 'A movement of zero does not record anything.'));
      if (rec.reason === 'Damage / write-off' && !rec.reference)
        out.push(warn('reference', 'A write-off with no explanation cannot be checked later. Write what happened.'));
      if (rec.reason === 'Stock take adjustment' && Math.abs(num(rec.qty) || 0) > 50)
        out.push(warn('qty', 'That is a large adjustment. Large unexplained adjustments are usually either a counting error or shrinkage — both worth investigating.'));
      return out;
    }
  };

  /* ---- Public API -------------------------------------------------------- */
  return {

    /* Validate one whole record against the schema plus the business rules. */
    record: function (collection, rec, schema) {
      schema = schema || window.LHH_SCHEMA;
      var def = schema && schema.collections && schema.collections[collection];
      var issues = [];
      var tagged = Object.assign({}, rec, { __collection: collection });

      if (def) {
        Object.keys(def.fields).forEach(function (name) {
          issues = issues.concat(checkField(name, def.fields[name], rec[name], tagged));
        });
      }
      if (businessRules[collection]) {
        issues = issues.concat(businessRules[collection](rec));
      }

      var errors   = issues.filter(function (i) { return i.severity === 'error'; });
      var warnings = issues.filter(function (i) { return i.severity === 'warning'; });

      return {
        ok: errors.length === 0,
        canSave: errors.length === 0,
        needsAcknowledgement: errors.length === 0 && warnings.length > 0,
        status: errors.length ? 'invalid' : (warnings.length ? 'warning' : 'valid'),
        issues: issues,
        errors: errors,
        warnings: warnings,
        byField: issues.reduce(function (m, i) {
          (m[i.field] = m[i.field] || []).push(i);
          return m;
        }, {})
      };
    },

    /* Validate a single field as the user leaves it — the live feedback that
       makes the adaptive form feel helpful instead of punitive. */
    field: function (collection, fieldName, value, rec, schema) {
      schema = schema || window.LHH_SCHEMA;
      var def = schema && schema.collections[collection] && schema.collections[collection].fields[fieldName];
      if (!def) return { ok: true, issues: [] };
      var issues = checkField(fieldName, def, value, Object.assign({}, rec || {}, { __collection: collection }));
      return { ok: !issues.some(function (i) { return i.severity === 'error'; }), issues: issues };
    },

    patterns: RX
  };
}());
