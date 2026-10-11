/* ==========================================================================
   capture.js — the adaptive capture form
   --------------------------------------------------------------------------
   The form is not written out field by field in HTML. It is generated from
   data/schema.json at the moment it is needed.

   Two reasons, both of which matter to the argument this resource is making:

   1. Adaptive. The form changes as it is filled in. Ask a cash-only customer
      for a credit limit and you are inviting a wrong answer; tick marketing
      consent and the date field appears because POPIA now requires it. The
      person at the counter is shown the smallest form that is correct for the
      situation in front of them.

   2. Changeable. When the shop decides it needs to record something new, the
      change is made in one schema file and the form, the validation and the
      stored records all follow. That is the difference between a system the
      business can adapt and one it has to live with.
   ========================================================================== */

window.Capture = (function () {
  'use strict';

  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"]/g, function (c) {
      return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[c];
    });
  }

  /* ---- Adaptive rules ---------------------------------------------------
     Returns false when a field should not be shown for the current state of
     the record. Kept in one place so the behaviour can be explained in the
     pitch without hunting through the code. */
  var visibility = {
    customers: {
      creditLimit:          function (r) { return r.creditTerms && r.creditTerms !== 'Cash only'; },
      popiaConsentDate:     function (r) { return !!r.popiaConsentMarketing; },
      popiaConsentMarketing:function (r) { return !!(r.phone || r.email); },
      vatNumber:            function (r) { return r.type === 'Business' || r.type === 'Contractor'; },
      popiaRetentionUntil:  function (r) { return (r.popiaPurpose || []).length > 0; }
    },
    products: {
      barcode:  function (r) { return !!r.sku; },
      location: function (r) { return !!r.category; }
    },
    suppliers: {
      minOrder:  function (r) { return !!r.name; },
      accountNo: function (r) { return !!r.name; }
    }
  };

  /* Contextual guidance that appears only when it is actually relevant.
     Training delivered at the moment of the decision beats training delivered
     in a session three weeks earlier. */
  var guidance = {
    customers: {
      popiaConsentMarketing: function (r) {
        return r.popiaConsentMarketing
          ? { kind:'popia', text:'POPIA s.69: you must be able to show that this person agreed. The date below is your evidence. If they later ask to be taken off the list, untick this — do not just stop sending.' }
          : null;
      },
      creditTerms: function (r) {
        return (r.creditTerms && r.creditTerms !== 'Cash only')
          ? { kind:'warn', text:'Giving credit to a new customer is the most common way a small shop loses money. Set a limit you could afford to write off.' }
          : null;
      },
      notes: function () {
        return { kind:'popia', text:'Anything typed here is personal information. The customer is entitled to ask to see it. Keep it factual.' };
      },
      type: function (r) {
        return r.type === 'Walk-in'
          ? { kind:'note', text:'If the customer does not want to give their details, use the generic "Walk-in customer" record instead of inventing something. Holding no personal information is always compliant.' }
          : null;
      }
    },
    products: {
      sellPrice: function (r) {
        var c = parseFloat(r.costPrice), s = parseFloat(r.sellPrice);
        if (!c || !s) return null;
        var m = (s - c) / c;
        return { kind: m < 0.1 ? 'warn' : 'note',
                 text: 'Margin: ' + (m * 100).toFixed(1) + '% — ' + (s - c).toFixed(2) + ' rand per ' + (r.unit || 'unit') + ' before overheads.' };
      },
      reorderLevel: function (r) {
        return { kind:'note', text:'Set this to roughly what you sell during the supplier\'s lead time, plus a little. Too low and you run out; too high and your money sits on the shelf.' };
      }
    }
  };

  /* ---- Field rendering --------------------------------------------------- */
  function renderField(collection, name, def, value, rec) {
    var id = 'f_' + collection + '_' + name;
    var required = def.required ? ' <span aria-hidden="true" style="color:#c0342f">*</span>' : '';
    var hint = def.hint ? '<span class="field__hint">' + esc(def.hint) + '</span>' : '';
    var html = '';

    if (def.type === 'boolean') {
      html = '<div class="field field--check" data-field="' + name + '">' +
        '<input type="checkbox" id="' + id + '" name="' + name + '"' + (value ? ' checked' : '') + '>' +
        '<label for="' + id + '">' + esc(def.label) + hint + '</label>' +
        '</div><div class="field__error" data-error="' + name + '"></div>';
      return html;
    }

    html += '<div class="field" data-field="' + name + '">';
    html += '<label for="' + id + '">' + esc(def.label) + required + hint + '</label>';

    switch (def.type) {
      case 'enum':
        html += '<select id="' + id + '" name="' + name + '">';
        html += '<option value="">— choose —</option>';
        def.values.forEach(function (v) {
          html += '<option value="' + esc(v) + '"' + (value === v ? ' selected' : '') + '>' + esc(v) + '</option>';
        });
        html += '</select>';
        break;

      case 'ref': {
        var opts = window.Store.all(def.refs);
        var display = def.refs === 'suppliers' || def.refs === 'customers' ? 'name' : 'name';
        html += '<select id="' + id + '" name="' + name + '">';
        html += '<option value="">— choose —</option>';
        opts.forEach(function (o) {
          html += '<option value="' + esc(o.id) + '"' + (value === o.id ? ' selected' : '') + '>' +
                  esc(o[display] || o.id) + ' (' + esc(o.id) + ')</option>';
        });
        html += '</select>';
        break;
      }

      case 'multi':
        html += '<div style="display:grid;gap:.35rem;margin-top:.25rem">';
        def.values.forEach(function (v, i) {
          var checked = (value || []).indexOf(v) !== -1;
          html += '<label style="display:flex;gap:.55rem;align-items:flex-start;font-weight:500;font-size:.9rem;margin:0">' +
            '<input type="checkbox" name="' + name + '" value="' + esc(v) + '"' + (checked ? ' checked' : '') + ' style="margin-top:.25rem">' +
            esc(v) + '</label>';
        });
        html += '</div>';
        break;

      case 'text':
        html += '<textarea id="' + id + '" name="' + name + '" rows="3">' + esc(value || '') + '</textarea>';
        break;

      case 'money':
        html += '<input type="number" step="0.01" min="' + (def.min !== undefined ? def.min : 0) + '" id="' + id + '" name="' + name + '" value="' + esc(value === undefined ? '' : value) + '" inputmode="decimal">';
        break;

      case 'number':
        html += '<input type="number" step="1" id="' + id + '" name="' + name + '" value="' + esc(value === undefined ? '' : value) + '" inputmode="numeric">';
        break;

      case 'date':
        html += '<input type="date" id="' + id + '" name="' + name + '" value="' + esc(value || '') + '">';
        break;

      case 'email':
        html += '<input type="email" id="' + id + '" name="' + name + '" value="' + esc(value || '') + '" autocomplete="off">';
        break;

      case 'phone':
        html += '<input type="tel" id="' + id + '" name="' + name + '" value="' + esc(value || '') + '" inputmode="numeric" maxlength="10" autocomplete="off">';
        break;

      default:
        html += '<input type="text" id="' + id + '" name="' + name + '" value="' + esc(value || '') + '"' +
                (def.pattern ? ' data-pattern="' + esc(def.pattern) + '"' : '') + ' autocomplete="off">';
    }

    html += '<div class="field__error" data-error="' + name + '"></div>';
    html += '<div data-guidance="' + name + '"></div>';
    html += '</div>';
    return html;
  }

  /* ---- Form controller --------------------------------------------------- */
  function build(container, collection, opts) {
    opts = opts || {};
    var schema = window.LHH_SCHEMA.collections[collection];
    if (!schema) { container.innerHTML = '<p>Unknown collection.</p>'; return null; }

    var rec = Object.assign({}, opts.initial || {});
    var acknowledged = false;

    function readForm() {
      var out = {};
      Object.keys(schema.fields).forEach(function (name) {
        var def = schema.fields[name];
        var nodes = container.querySelectorAll('[name="' + name + '"]');
        if (!nodes.length) { if (rec[name] !== undefined) out[name] = rec[name]; return; }
        if (def.type === 'multi') {
          out[name] = Array.prototype.filter.call(nodes, function (n) { return n.checked; })
                                           .map(function (n) { return n.value; });
        } else if (def.type === 'boolean') {
          out[name] = nodes[0].checked;
        } else if (def.type === 'money' || def.type === 'number') {
          out[name] = nodes[0].value === '' ? '' : parseFloat(nodes[0].value);
        } else {
          out[name] = nodes[0].value;
        }
      });
      if (opts.initial && opts.initial.id) out.id = opts.initial.id;
      return out;
    }

    function applyAdaptive(current) {
      var rules = visibility[collection] || {};
      Object.keys(schema.fields).forEach(function (name) {
        var wrap = container.querySelector('[data-field="' + name + '"]');
        if (!wrap) return;
        var show = rules[name] ? rules[name](current) : true;
        wrap.hidden = !show;
        var errNode = container.querySelector('[data-error="' + name + '"]');
        if (errNode) errNode.hidden = !show;
        if (!show) {
          /* A hidden field must not keep a stale value, or the record ends up
             holding something the capturer never agreed to. */
          var nodes = wrap.querySelectorAll('[name="' + name + '"]');
          Array.prototype.forEach.call(nodes, function (n) {
            if (n.type === 'checkbox') n.checked = false; else n.value = '';
          });
        }
      });
    }

    function applyGuidance(current) {
      var rules = guidance[collection] || {};
      Object.keys(schema.fields).forEach(function (name) {
        var slot = container.querySelector('[data-guidance="' + name + '"]');
        if (!slot) return;
        var g = rules[name] ? rules[name](current) : null;
        slot.innerHTML = g
          ? '<div class="callout callout--' + g.kind + '" style="margin-top:.5rem;padding:.6rem .85rem;font-size:.86rem">' + esc(g.text) + '</div>'
          : '';
      });
    }

    function paintValidation(result) {
      Object.keys(schema.fields).forEach(function (name) {
        var wrap = container.querySelector('[data-field="' + name + '"]');
        var slot = container.querySelector('[data-error="' + name + '"]');
        if (!slot) return;
        var issues = result.byField[name] || [];
        wrap && wrap.classList.toggle('field--invalid', issues.some(function (i) { return i.severity === 'error'; }));
        slot.innerHTML = issues.map(function (i) {
          var colour = i.severity === 'error' ? '#9b2423' : '#b06a00';
          return '<div style="color:' + colour + '">' + (i.severity === 'error' ? '✕ ' : '⚠ ') + esc(i.message) + '</div>';
        }).join('');
      });

      /* Issues that belong to the record rather than to one field. */
      var general = result.issues.filter(function (i) { return !schema.fields[i.field]; });
      var gslot = container.querySelector('[data-general-errors]');
      if (gslot) {
        gslot.innerHTML = general.length
          ? '<div class="callout callout--risk"><div class="callout__title">Check these before saving</div><ul>' +
            general.map(function (i) { return '<li>' + esc(i.message) + '</li>'; }).join('') + '</ul></div>'
          : '';
      }
      return result;
    }

    function refresh() {
      var current = readForm();
      applyAdaptive(current);
      current = readForm();
      applyGuidance(current);
      var result = window.Validate.record(collection, current);
      paintValidation(result);
      renderStatus(result, current);
      return { current: current, result: result };
    }

    function renderStatus(result, current) {
      var bar = container.querySelector('[data-status]');
      if (!bar) return;
      var saveBtn = container.querySelector('[data-save]');
      var ackWrap = container.querySelector('[data-ack]');

      if (result.errors.length) {
        bar.innerHTML = '<span class="badge badge--bad">' + result.errors.length + ' problem' + (result.errors.length === 1 ? '' : 's') + '</span> ' +
          '<span class="muted" style="font-size:.88rem">This record cannot be saved yet. In a spreadsheet it would have saved without complaint.</span>';
        if (ackWrap) ackWrap.hidden = true;
        if (saveBtn) saveBtn.disabled = true;
      } else if (result.warnings.length) {
        bar.innerHTML = '<span class="badge badge--warn">' + result.warnings.length + ' warning' + (result.warnings.length === 1 ? '' : 's') + '</span> ' +
          '<span class="muted" style="font-size:.88rem">This can be saved, but the warnings will be stored with the record.</span>';
        if (ackWrap) ackWrap.hidden = false;
        if (saveBtn) saveBtn.disabled = !acknowledged;
      } else {
        bar.innerHTML = '<span class="badge badge--ok">Valid</span> ' +
          '<span class="muted" style="font-size:.88rem">Every rule passed. Ready to save.</span>';
        if (ackWrap) ackWrap.hidden = true;
        if (saveBtn) saveBtn.disabled = false;
      }

      /* Live preview of the metadata envelope that will be written. This is the
         single most useful thing to point at during the pitch: here is what a
         spreadsheet cell does not keep. */
      var prev = container.querySelector('[data-meta-preview]');
      if (prev) {
        var u = window.Store.user();
        prev.innerHTML =
          '<div><span class="mk">Record ID</span><span class="mv">' + (current.id || 'assigned on save') + '</span></div>' +
          '<div><span class="mk">Captured by</span><span class="mv">' + esc(u.name) + '</span></div>' +
          '<div><span class="mk">Captured at</span><span class="mv">' + new Date().toLocaleString('en-ZA') + '</span></div>' +
          '<div><span class="mk">Source</span><span class="mv">counter-capture</span></div>' +
          '<div><span class="mk">Version</span><span class="mv">' + (opts.initial && opts.initial._meta ? opts.initial._meta.version + 1 : 1) + '</span></div>' +
          '<div><span class="mk">Schema</span><span class="mv">' + window.Store.SCHEMA_VERSION + '</span></div>' +
          '<div><span class="mk">Validation</span><span class="mv">' + result.status + '</span></div>';
      }
    }

    /* ---- Paint the form ------------------------------------------------- */
    var fieldHtml = Object.keys(schema.fields).map(function (name) {
      return renderField(collection, name, schema.fields[name], rec[name], rec);
    }).join('');

    container.innerHTML =
      '<form novalidate>' +
        fieldHtml +
        '<div data-general-errors></div>' +
        '<div class="meta-strip" data-meta-preview></div>' +
        '<div data-ack hidden class="field field--check" style="margin-top:1rem">' +
          '<input type="checkbox" id="ack_' + collection + '">' +
          '<label for="ack_' + collection + '">I have read the warnings above and want to save anyway. My acknowledgement will be stored with the record.</label>' +
        '</div>' +
        '<div class="cluster" style="margin-top:1.25rem;justify-content:space-between">' +
          '<div data-status></div>' +
          '<div class="cluster">' +
            '<button type="button" class="btn btn--ghost" data-cancel>Clear</button>' +
            '<button type="submit" class="btn btn--primary" data-save disabled>' + esc(opts.saveLabel || 'Save record') + '</button>' +
          '</div>' +
        '</div>' +
      '</form>';

    var form = container.querySelector('form');

    form.addEventListener('input', refresh);
    form.addEventListener('change', refresh);

    var ack = container.querySelector('[data-ack] input');
    if (ack) ack.addEventListener('change', function () { acknowledged = ack.checked; refresh(); });

    container.querySelector('[data-cancel]').addEventListener('click', function () {
      form.reset();
      acknowledged = false;
      if (ack) ack.checked = false;
      refresh();
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var state = refresh();
      if (!state.result.canSave) return;
      if (state.result.warnings.length && !acknowledged) return;

      var notes = state.result.warnings.map(function (w) { return w.message; });
      var saved;
      if (opts.initial && opts.initial.id && window.Store.get(collection, opts.initial.id)) {
        saved = window.Store.update(collection, opts.initial.id, state.current, {
          validationStatus: state.result.status,
          validationNotes: notes
        });
      } else {
        saved = window.Store.insert(collection, state.current, {
          source: 'counter-capture',
          validationStatus: state.result.status,
          validationNotes: notes,
          label: state.current.name || state.current.docNumber
        });
      }
      if (opts.onSave) opts.onSave(saved, state.result);
      form.reset();
      acknowledged = false;
      if (ack) ack.checked = false;
      refresh();
    });

    refresh();

    return {
      refresh: refresh,
      read: readForm,
      element: form
    };
  }

  return { build: build, visibility: visibility, guidance: guidance };
}());
