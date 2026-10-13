/* ==========================================================================
   app.js — the demonstration shell
   --------------------------------------------------------------------------
   Wires the modules together into something a shop owner can click through.
   Each view answers one question the owner actually asks:

     Today        what is happening in my shop right now?
     Till         what does capturing a sale look like?
     Customers    what does capturing a person look like, and what does
                  POPIA make me record?
     Products     same, for stock.
     Records      what is actually stored, in full?
     Documents    what do I get out of it without retyping anything?
     Analytics    what is the data telling me?
     Data quality how much of what I hold can I trust?
     POPIA        can I answer the Information Regulator?
     Audit trail  who changed what?
     Your data    can I get my data out again?
     Training     how do my staff learn this?
   ========================================================================== */

(function () {
  'use strict';

  var A = window.Analytics, S = window.Store, G = window.Generate;
  var esc = G.helpers.esc, rand = A.rand, dateZA = G.helpers.dateZA;

  var mount, navEl;
  var state = { view: 'overview', selected: {}, tillLines: [], lastSale: null, docHtml: '', docTitle: '' };

  /* ---- Toasts ----------------------------------------------------------- */
  function toast(msg, kind) {
    var area = document.querySelector('.toast-area');
    if (!area) { area = document.createElement('div'); area.className = 'toast-area'; document.body.appendChild(area); }
    var t = document.createElement('div');
    t.className = 'toast toast--' + (kind || 'info');
    t.setAttribute('role', 'status');
    t.textContent = msg;
    area.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; }, 3200);
    setTimeout(function () { t.remove(); }, 3600);
  }

  /* ---- JSON pretty printer with the _meta keys highlighted -------------- */
  function jsonHtml(obj) {
    var json = JSON.stringify(obj, null, 2);
    return esc(json)
      .replace(/&quot;(_meta|id|type|schemaVersion|createdAt|createdBy|modifiedAt|modifiedBy|version|source|validationStatus|validationNotes|links)&quot;(\s*:)/g,
               '<span class="meta-k">&quot;$1&quot;</span>$2')
      .replace(/&quot;([a-zA-Z_][a-zA-Z0-9_]*)&quot;(\s*:)/g, '<span class="k">&quot;$1&quot;</span>$2')
      .replace(/:\s&quot;([^&]*)&quot;/g, ': <span class="s">&quot;$1&quot;</span>')
      .replace(/:\s(-?\d+\.?\d*)/g, ': <span class="n">$1</span>')
      .replace(/:\s(true|false|null)/g, ': <span class="b">$1</span>');
  }

  function statTile(value, label, sub, tone) {
    return '<div class="fig">' +
      '<div class="fig__val" style="' + (tone ? 'color:' + tone : '') + '">' + value + '</div>' +
      '<p class="fig__label">' + label + (sub ? '<br><span style="font-size:.78rem;color:#97a9ba">' + sub + '</span>' : '') + '</p>' +
      '</div>';
  }

  /* ======================================================================
     VIEW: Today
     ====================================================================== */
  function viewOverview() {
    var s = A.summary();
    var q = S.quality();
    var months = s.months.slice(-12);
    var changeTone = s.revenueChange >= 0 ? '#1d6b3f' : '#9b2423';
    var changeArrow = s.revenueChange >= 0 ? '▲' : '▼';

    var alerts = [];
    if (s.outOfStock) alerts.push({ sev:'bad',  text: s.outOfStock + ' product' + (s.outOfStock === 1 ? ' is' : 's are') + ' completely out of stock.', go:'analytics' });
    if (s.needsOrdering) alerts.push({ sev:'warn', text: s.needsOrdering + ' line' + (s.needsOrdering === 1 ? '' : 's') + ' at or below reorder level.', go:'analytics' });
    if (s.outstanding > 0) alerts.push({ sev:'warn', text: rand(s.outstanding) + ' is owed by ' + s.debtorCount + ' customer' + (s.debtorCount === 1 ? '' : 's') + ' on account.', go:'analytics' });
    if (q.errors) alerts.push({ sev:'bad', text: q.errors + ' record' + (q.errors === 1 ? ' has' : 's have') + ' a problem that must be fixed.', go:'quality' });
    if (s.concentration.top3Share > 0.4) alerts.push({ sev:'warn', text: 'The three biggest trade accounts are ' +
      A.pct(s.concentration.top3Share) + ' of turnover between them. Losing one would hurt.', go:'analytics' });
    if (s.deadStockValue > 0) alerts.push({ sev:'warn', text: rand(s.deadStockValue) + ' is tied up in ' + s.deadStockCount + ' line' + (s.deadStockCount === 1 ? '' : 's') + ' that have not sold at all this year.', go:'analytics' });
    if (s.shrinkageValue > 0) alerts.push({ sev:'warn', text: rand(s.shrinkageValue) + ' written off or lost to stock-take differences.', go:'analytics' });

    return '<div class="panel">' +
      '<div class="panel__head"><div><h2>Today at the shop</h2>' +
        '<p>Every figure here is calculated from records captured during ordinary trading. Nobody compiled this.</p></div>' +
        '<span class="badge badge--info">As at ' + dateZA(window.LHH_SEED.meta.asOfDate) + '</span></div>' +

      '<div class="figs">' +
        statTile(A.randShort(s.monthToDate.current.revenue),
          'Revenue, first ' + s.monthToDate.days + ' days of this month',
          changeArrow + ' ' + A.pct(Math.abs(s.revenueChange), 0) + ' vs the same ' + s.monthToDate.days + ' days last month', changeTone) +
        statTile(A.pct(s.year.marginPct, 1), 'Gross margin, last 12 months', 'on ' + A.randShort(s.year.revenue) + ' of sales') +
        statTile(rand(s.avgBasket, 0), 'Average sale', s.year.transactions.toLocaleString('en-ZA') + ' transactions') +
        statTile(A.randShort(s.stockValue), 'Stock at cost', 'money sitting on the shelves') +
        statTile(A.randShort(s.outstanding), 'Owed to you', s.debtorCount + ' accounts', s.outstanding > 20000 ? '#9b2423' : '') +
        statTile(q.score + '%', 'Information quality', q.errors + ' errors, ' + q.warnings + ' warnings',
          q.score >= 85 ? '#1d6b3f' : (q.score >= 65 ? '#b06a00' : '#9b2423')) +
      '</div>' +

      (alerts.length
        ? '<h3>Needs your attention</h3><div class="stack">' + alerts.map(function (a) {
            return '<div class="callout callout--' + (a.sev === 'bad' ? 'risk' : 'warn') + '" style="margin-top:.6rem">' +
              '<div class="cluster" style="justify-content:space-between;gap:1rem">' +
              '<span>' + esc(a.text) + '</span>' +
              '<button class="btn btn--sm btn--ghost" data-go="' + a.go + '">Look at this</button></div></div>';
          }).join('') + '</div>'
        : '<div class="callout callout--win"><div class="callout__title">Nothing needs attention</div></div>') +

      '<h3>Revenue and margin, month by month</h3>' +
      '<div class="chart" style="margin-top:.75rem">' +
        '<p class="chart__sub">Columns are revenue excluding VAT. The purple line is gross margin as a percentage — ' +
        'the two do not always move together, which is the point of putting them on one chart.</p>' +
        A.charts.barLine(months, { alt:'Monthly revenue with gross margin overlaid' }) +
        '<div class="chart__legend"><span><span class="chart__swatch" style="background:#128079"></span>Revenue (excl. VAT)</span>' +
        '<span><span class="chart__swatch" style="background:#5a4b9c"></span>Gross margin %</span></div>' +
      '</div>' +

      '<div class="grid grid--2" style="margin-top:1.5rem">' +
        '<div class="chart"><h3>Where the money comes from</h3>' +
          '<p class="chart__sub">Share of revenue by category.</p>' +
          A.charts.donut(A.categoryMix().slice(0, 6), { value:'revenue', label:'category',
            centreLabel:A.randShort(s.year.revenue), centreSub:'12 months' }) +
          A.charts.legend(A.categoryMix().slice(0, 6), 'category', A.randShort, 'revenue') +
        '</div>' +
        '<div class="chart"><h3>How customers pay</h3>' +
          '<p class="chart__sub">Worth watching: card and instant-EFT fees are a real cost, and "on account" is money you have not got yet.</p>' +
          A.charts.donut(A.paymentMix(), { value:'revenue', label:'method' }) +
          A.charts.legend(A.paymentMix(), 'method', A.randShort, 'revenue') +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ======================================================================
     VIEW: Till (capture a sale)
     ====================================================================== */
  function viewTill() {
    var products = S.all('products').filter(function (p) { return p.active !== false; });
    var customers = S.all('customers');

    return '<div class="panel">' +
      '<div class="panel__head"><div><h2>Capture a sale</h2>' +
        '<p>Notice what is not being typed: no customer name, no product description, no price. Those already exist as records, so the sale points at them.</p></div></div>' +

      '<div class="split split--sidebar">' +
        '<div>' +
          '<div class="form-row form-row--2">' +
            '<div class="field"><label for="till-cust">Customer</label>' +
              '<select id="till-cust">' + customers.map(function (c) {
                return '<option value="' + esc(c.id) + '">' + esc(c.name) + ' — ' + esc(c.creditTerms) + '</option>';
              }).join('') + '</select>' +
              '<div class="field__hint" id="till-cust-note"></div></div>' +
            '<div class="field"><label for="till-pay">Payment method</label>' +
              '<select id="till-pay"><option>Cash</option><option>Card (Yoco)</option><option>SnapScan</option><option>EFT</option><option>On account</option></select></div>' +
          '</div>' +

          '<fieldset><legend>Add an item</legend>' +
            '<div class="form-row form-row--3">' +
              '<div class="field" style="margin-top:0"><label for="till-prod">Product</label>' +
                '<select id="till-prod">' + products.map(function (p) {
                  return '<option value="' + esc(p.id) + '">' + esc(p.sku) + ' — ' + esc(p.name) + '</option>';
                }).join('') + '</select></div>' +
              '<div class="field" style="margin-top:0"><label for="till-qty">Quantity</label>' +
                '<input type="number" id="till-qty" value="1" min="1" step="1" inputmode="numeric"></div>' +
              '<div class="field" style="margin-top:0"><label for="till-price">Unit price (excl. VAT)</label>' +
                '<input type="number" id="till-price" step="0.01" min="0" inputmode="decimal">' +
                '<span class="field__hint" id="till-price-hint"></span></div>' +
            '</div>' +
            '<div class="cluster" style="margin-top:1rem"><button class="btn btn--ghost btn--sm" id="till-add">Add to sale</button>' +
              '<span class="muted" style="font-size:.86rem" id="till-stock-note"></span></div>' +
          '</fieldset>' +

          '<div id="till-done"></div>' +
          '<div id="till-lines"></div>' +
          '<div id="till-issues"></div>' +

          '<div class="cluster" style="margin-top:1.25rem;justify-content:space-between">' +
            '<div id="till-status"></div>' +
            '<div class="cluster">' +
              '<button class="btn btn--ghost" id="till-clear">Clear sale</button>' +
              '<button class="btn btn--primary" id="till-save" disabled>Complete sale</button>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<aside>' +
          '<div class="card"><h4 style="margin-top:0">What gets stored</h4>' +
            '<p style="font-size:.88rem;color:#4d6479">The sale record keeps the links, not copies. If this customer\'s phone number changes tomorrow, every document built from this sale is correct automatically.</p>' +
            '<div class="meta-strip" id="till-meta" style="flex-direction:column"></div>' +
          '</div>' +
          '<div class="callout callout--note" style="margin-top:1rem"><div class="callout__title">Try breaking it</div>' +
            '<ul style="font-size:.87rem;margin-top:.5rem">' +
            '<li>Sell more than there is in stock.</li>' +
            '<li>Drop the price below cost.</li>' +
            '<li>Choose "On account" for a cash-only customer.</li>' +
            '<li>Push an account customer past their credit limit.</li>' +
            '</ul><p style="font-size:.87rem">A spreadsheet accepts all four without a word.</p></div>' +
        '</aside>' +
      '</div>' +
    '</div>';
  }

  function wireTill() {
    var prodSel = document.getElementById('till-prod');
    var qtyIn = document.getElementById('till-qty');
    var priceIn = document.getElementById('till-price');
    var custSel = document.getElementById('till-cust');

    function syncProduct() {
      var p = S.get('products', prodSel.value);
      if (!p) return;
      priceIn.value = p.sellPrice.toFixed(2);
      document.getElementById('till-price-hint').textContent =
        'List price ' + rand(p.sellPrice) + ' · cost ' + rand(p.costPrice);
      var onHand = S.stockFor(p.id);
      document.getElementById('till-stock-note').textContent =
        onHand + ' ' + p.unit + (onHand === 1 ? '' : 's') + ' in stock' + (onHand <= p.reorderLevel ? ' — at or below reorder level' : '');
    }
    function syncCustomer() {
      var c = S.get('customers', custSel.value);
      if (!c) return;
      var owing = S.all('sales').filter(function (s) { return s.customerId === c.id && s.status === 'Unpaid'; })
        .reduce(function (t, s) { return t + s.total; }, 0);
      document.getElementById('till-cust-note').textContent =
        c.creditTerms === 'Cash only'
          ? 'Cash only — cannot buy on account.'
          : c.creditTerms + ' · limit ' + rand(c.creditLimit || 0) + ' · currently owes ' + rand(owing);
      renderTill();
    }
    prodSel.addEventListener('change', syncProduct);
    custSel.addEventListener('change', syncCustomer);
    document.getElementById('till-pay').addEventListener('change', renderTill);

    document.getElementById('till-add').addEventListener('click', function () {
      var p = S.get('products', prodSel.value);
      if (!p) return;
      var qty = parseInt(qtyIn.value, 10) || 0;
      if (qty <= 0) { toast('Quantity must be more than zero.', 'bad'); return; }
      var price = parseFloat(priceIn.value);
      if (isNaN(price)) { toast('Enter a price.', 'bad'); return; }
      var existing = state.tillLines.find(function (l) { return l.productId === p.id && l.unitPrice === price; });
      if (existing) existing.qty += qty;
      else state.tillLines.push({
        productId: p.id, sku: p.sku, description: p.name,
        qty: qty, unitPrice: price, unitCost: p.costPrice
      });
      qtyIn.value = 1;
      renderTill();
    });

    document.getElementById('till-clear').addEventListener('click', function () {
      state.tillLines = []; state.lastSale = null; renderTill();
    });

    document.getElementById('till-save').addEventListener('click', function () {
      var rec = buildTillRecord();
      var result = window.Validate.record('sales', rec);
      if (!result.canSave) { toast('Fix the problems first.', 'bad'); return; }

      var saved = S.insert('sales', rec, {
        source: 'counter-capture',
        validationStatus: result.status,
        validationNotes: result.warnings.map(function (w) { return w.message; }),
        links: { customer: rec.customerId, products: rec.lines.map(function (l) { return l.productId; }) },
        label: rec.docNumber
      });
      /* A sale is not just a sale — it moves stock. One capture, two
         consequences, automatically. This is what integration means at the
         smallest possible scale. */
      rec.lines.forEach(function (l) {
        S.insert('stockMovements', {
          date: rec.date, productId: l.productId, qty: -l.qty,
          reason: 'Sale', reference: rec.docNumber, by: S.user().name
        }, { source:'system', links:{ product:l.productId, sale:saved.id } });
      });
      state.tillLines = [];
      state.lastSale = saved;
      toast('Sale ' + saved.docNumber + ' saved, stock adjusted.', 'ok');
      /* Stay on the till. Jumping the user somewhere else the moment they
         finish a sale is disorienting at a counter, and the next thing they
         want is usually the next customer — not a document. The confirmation
         offers the invoice without insisting on it. */
      render('till');
    });

    syncProduct(); syncCustomer(); renderTill();
  }

  function buildTillRecord() {
    var nextNum = 20000 + S.count('sales');
    return {
      docNumber: 'INV-' + nextNum,
      date: new Date().toISOString().slice(0, 10),
      customerId: document.getElementById('till-cust').value,
      lines: state.tillLines,
      paymentMethod: document.getElementById('till-pay').value,
      status: document.getElementById('till-pay').value === 'On account' ? 'Unpaid' : 'Paid',
      servedBy: S.user().name,
      subtotal: 0, vat: 0, total: 0
    };
  }

  function renderTill() {
    var box = document.getElementById('till-lines');
    if (!box) return;

    /* Confirmation of the sale just completed, with what it set in motion. */
    var done = document.getElementById('till-done');
    if (done) {
      if (state.lastSale) {
        var sl = state.lastSale;
        var cu = S.get('customers', sl.customerId);
        done.innerHTML = '<div class="callout callout--win">' +
          '<div class="callout__title">' + esc(sl.docNumber) + ' captured</div>' +
          '<p>' + rand(sl.lines.reduce(function (t, l) { return t + l.qty * l.unitPrice; }, 0) * 1.15) +
          ' to ' + esc(cu ? cu.name : '?') + ', paid by ' + esc(sl.paymentMethod) + '. ' +
          'Stock was adjusted on ' + sl.lines.length + ' line' + (sl.lines.length === 1 ? '' : 's') +
          ' without anybody being asked to remember.</p>' +
          '<div class="cluster" style="margin-top:.75rem">' +
            '<button class="btn btn--sm btn--primary" data-doc="invoice" data-id="' + esc(sl.id) + '">Generate the tax invoice</button>' +
            '<button class="btn btn--sm btn--ghost" data-open-rec="sales:' + esc(sl.id) + '">See what was stored</button>' +
            '<button class="btn btn--sm btn--ghost" data-go="audit">See the audit entry</button>' +
          '</div></div>';
      } else { done.innerHTML = ''; }
    }

    if (!state.tillLines.length) {
      box.innerHTML = '<p class="muted" style="margin-top:1.25rem">No items on this sale yet.</p>';
      document.getElementById('till-issues').innerHTML = '';
      document.getElementById('till-status').innerHTML = '';
      document.getElementById('till-save').disabled = true;
      wireCommon();   /* re-wire the confirmation block this redraw may have created */
    document.getElementById('till-meta').innerHTML = '';
      return;
    }
    var subtotal = state.tillLines.reduce(function (t, l) { return t + l.qty * l.unitPrice; }, 0);
    box.innerHTML = '<div class="table-wrap"><table><thead><tr>' +
      '<th>Code</th><th>Description</th><th class="num">Qty</th><th class="num">Unit</th><th class="num">Total</th><th></th>' +
      '</tr></thead><tbody>' +
      state.tillLines.map(function (l, i) {
        return '<tr><td><code>' + esc(l.sku) + '</code></td><td>' + esc(l.description) + '</td>' +
          '<td class="num">' + l.qty + '</td><td class="num">' + rand(l.unitPrice) + '</td>' +
          '<td class="num">' + rand(l.qty * l.unitPrice) + '</td>' +
          '<td><button class="btn btn--sm btn--ghost" data-rm="' + i + '" aria-label="Remove line">Remove</button></td></tr>';
      }).join('') +
      '</tbody></table></div>' +
      '<div class="doc-total"><table>' +
        '<tr><td>Subtotal</td><td class="num">' + rand(subtotal) + '</td></tr>' +
        '<tr><td>VAT @ 15%</td><td class="num">' + rand(subtotal * 0.15) + '</td></tr>' +
        '<tr class="grand"><td>Total</td><td class="num">' + rand(subtotal * 1.15) + '</td></tr>' +
      '</table></div><div style="clear:both"></div>';

    box.querySelectorAll('[data-rm]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.tillLines.splice(parseInt(b.getAttribute('data-rm'), 10), 1);
        renderTill();
      });
    });

    var rec = buildTillRecord();
    var result = window.Validate.record('sales', rec);
    document.getElementById('till-issues').innerHTML = result.issues.length
      ? '<div class="callout callout--' + (result.errors.length ? 'risk' : 'warn') + '">' +
        '<div class="callout__title">' + (result.errors.length ? 'Cannot complete this sale' : 'Warnings — the sale can still go through') + '</div><ul>' +
        result.issues.map(function (i) { return '<li>' + esc(i.message) + '</li>'; }).join('') + '</ul></div>'
      : '';
    document.getElementById('till-status').innerHTML = result.errors.length
      ? '<span class="badge badge--bad">' + result.errors.length + ' problem' + (result.errors.length === 1 ? '' : 's') + '</span>'
      : (result.warnings.length ? '<span class="badge badge--warn">' + result.warnings.length + ' warning' + (result.warnings.length === 1 ? '' : 's') + '</span>'
                                : '<span class="badge badge--ok">Valid</span>');
    document.getElementById('till-save').disabled = !result.canSave;

    var cust = S.get('customers', rec.customerId);
    wireCommon();   /* re-wire the confirmation block this redraw may have created */
    document.getElementById('till-meta').innerHTML =
      '<div><span class="mk">Links to customer</span><span class="mv">' + esc(rec.customerId) + ' (' + esc(cust ? cust.name : '?') + ')</span></div>' +
      '<div><span class="mk">Links to products</span><span class="mv">' + state.tillLines.map(function (l) { return l.productId; }).join(', ') + '</span></div>' +
      '<div><span class="mk">Captured by</span><span class="mv">' + esc(S.user().name) + '</span></div>' +
      '<div><span class="mk">Will also create</span><span class="mv">' + state.tillLines.length + ' stock movement' + (state.tillLines.length === 1 ? '' : 's') + '</span></div>';
  }

  /* ======================================================================
     VIEW: Capture a customer / product
     ====================================================================== */
  function viewForm(collection, intro, tips) {
    return '<div class="panel">' +
      '<div class="panel__head"><div><h2>' + esc(window.LHH_SCHEMA.collections[collection].label) + ' — capture</h2>' +
      '<p>' + intro + '</p></div></div>' +
      '<div class="split split--sidebar">' +
        '<div id="form-host"></div>' +
        '<aside>' + tips +
          '<div class="card" style="margin-top:1rem"><h4 style="margin-top:0">Rules applied here</h4><ul style="font-size:.86rem">' +
          (window.LHH_SCHEMA.collections[collection].rules || []).map(function (r) {
            return '<li><span class="badge badge--' + (r.severity === 'error' ? 'bad' : 'warn') + '">' + r.severity + '</span> ' + esc(r.desc) + '</li>';
          }).join('') + '</ul></div>' +
        '</aside>' +
      '</div>' +
      '<div id="form-result"></div>' +
    '</div>';
  }

  function wireForm(collection) {
    window.Capture.build(document.getElementById('form-host'), collection, {
      onSave: function (rec, result) {
        toast('Saved ' + rec.id + (result.warnings.length ? ' with ' + result.warnings.length + ' warning(s)' : ''), 'ok');
        document.getElementById('form-result').innerHTML =
          '<h3>What was stored</h3>' +
          '<p class="muted" style="font-size:.9rem">Everything in pink is the metadata envelope — the part a spreadsheet row has no room for.</p>' +
          '<div class="json-view">' + jsonHtml(rec) + '</div>' +
          '<div class="cluster" style="margin-top:1rem">' +
            '<button class="btn btn--ghost btn--sm" data-go="records">See it in the records</button>' +
            (collection === 'customers' ? '<button class="btn btn--ghost btn--sm" data-doc="popia" data-id="' + esc(rec.id) + '">Generate their POPIA report</button>' : '') +
          '</div>';
        document.getElementById('form-result').scrollIntoView({ behavior:'smooth', block:'nearest' });
      }
    });
  }

  /* ======================================================================
     VIEW: Records browser
     ====================================================================== */
  function viewRecords() {
    var coll = state.selected.collection || 'customers';
    var records = S.all(coll);
    var sel = state.selected[coll] || (records[0] && records[0].id);
    var rec = S.get(coll, sel);
    var def = window.LHH_SCHEMA.collections[coll];
    var display = coll === 'sales' ? 'docNumber' : (coll === 'stockMovements' ? 'id' : 'name');

    var list = records.slice(0, 300).map(function (r) {
      var status = r._meta ? r._meta.validationStatus : 'unverified';
      var dot = status === 'valid' ? 'ok' : (status === 'warning' ? 'warn' : 'neutral');
      return '<tr' + (r.id === sel ? ' style="background:#eef8f7"' : '') + '>' +
        '<td><code>' + esc(r.id) + '</code></td>' +
        '<td>' + esc(r[display] || r.id) + '</td>' +
        '<td><span class="badge badge--' + dot + '">' + esc(status) + '</span></td>' +
        '<td class="num">v' + (r._meta ? r._meta.version : '?') + '</td>' +
        '<td><button class="btn btn--sm btn--ghost" data-rec="' + esc(r.id) + '">Open</button></td></tr>';
    }).join('');

    var detail = '';
    if (rec) {
      var deps = S.dependents(coll, rec.id);
      detail =
        '<h3 style="margin-top:0">' + esc(rec[display] || rec.id) + '</h3>' +
        '<div class="meta-strip">' +
          '<div><span class="mk">ID</span><span class="mv">' + esc(rec.id) + '</span></div>' +
          '<div><span class="mk">Version</span><span class="mv">' + rec._meta.version + '</span></div>' +
          '<div><span class="mk">Captured</span><span class="mv">' + dateZA(rec._meta.createdAt) + ' by ' + esc(rec._meta.createdBy) + '</span></div>' +
          '<div><span class="mk">Changed</span><span class="mv">' + dateZA(rec._meta.modifiedAt) + ' by ' + esc(rec._meta.modifiedBy) + '</span></div>' +
          '<div><span class="mk">Source</span><span class="mv">' + esc(rec._meta.source) + '</span></div>' +
          '<div><span class="mk">Status</span><span class="mv">' + esc(rec._meta.validationStatus) + '</span></div>' +
        '</div>' +
        (rec._meta.validationNotes && rec._meta.validationNotes.length
          ? '<div class="callout callout--warn"><div class="callout__title">Warnings stored with this record</div><ul>' +
            rec._meta.validationNotes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul></div>'
          : '') +
        '<h4>What points at this record</h4>' +
        (deps.length
          ? '<p class="muted" style="font-size:.9rem">' + deps.length + ' other record' + (deps.length === 1 ? '' : 's') +
            ' depend on this one. Deleting it would break them — which is exactly what happens, silently, when a row is deleted from a spreadsheet.</p>' +
            '<div class="tag-row">' + deps.slice(0, 25).map(function (d) {
              return '<span class="badge badge--neutral">' + esc(d.label) + '</span>';
            }).join('') + (deps.length > 25 ? '<span class="badge badge--neutral">+' + (deps.length - 25) + ' more</span>' : '') + '</div>'
          : '<p class="muted" style="font-size:.9rem">Nothing else refers to this record.</p>') +
        '<h4>The record in full</h4>' +
        '<div class="json-view">' + jsonHtml(rec) + '</div>';
    }

    return '<div class="panel">' +
      '<div class="panel__head"><div><h2>What is actually stored</h2>' +
        '<p>Open any record and look at the <code>_meta</code> block. That is the difference between a row and a record.</p></div>' +
        '<div class="cluster">' + S.COLLECTIONS.map(function (c) {
          return '<button class="btn btn--sm ' + (c === coll ? 'btn--primary' : 'btn--ghost') + '" data-coll="' + c + '">' +
            esc(window.LHH_SCHEMA.collections[c].label) + ' <span style="opacity:.7">' + S.count(c) + '</span></button>';
        }).join('') + '</div></div>' +

      '<div class="split split--records">' +
        '<div><div class="table-wrap" style="max-height:34rem;overflow-y:auto;margin-top:0">' +
          '<table><thead><tr><th>ID</th><th>' + esc(def.label.replace(/s$/, '')) + '</th><th>Status</th><th class="num">Ver</th><th></th></tr></thead>' +
          '<tbody>' + list + '</tbody></table>' +
          (records.length > 300 ? '<caption>Showing the first 300 of ' + records.length + '.</caption>' : '') +
        '</div></div>' +
        '<div>' + detail + '</div>' +
      '</div></div>';
  }

  /* ======================================================================
     VIEW: Documents
     ====================================================================== */
  function viewDocuments() {
    var sales = S.all('sales').slice(-60).reverse();
    var customers = S.all('customers');
    var suppliers = S.all('suppliers');
    var categories = Object.keys(S.all('products').reduce(function (m, p) { m[p.category] = 1; return m; }, {}));

    return '<div class="panel">' +
      '<div class="panel__head"><div><h2>Generate a document</h2>' +
        '<p>Six different documents, one set of records, nothing retyped. Each one prints to PDF straight from the browser.</p></div></div>' +

      '<div class="grid grid--3">' +
        docCard('invoice', 'Tax invoice', 'Pulls the customer, the items, the prices and the VAT from the sale record.',
          '<select id="doc-sale">' + sales.map(function (s) {
            var c = S.get('customers', s.customerId);
            return '<option value="' + esc(s.id) + '">' + esc(s.docNumber) + ' — ' + esc(c ? c.name : '?') + ' — ' + rand(s.total) + '</option>';
          }).join('') + '</select>') +

        docCard('quote', 'Quotation', 'Same records, different document. A quote and an invoice cannot disagree if they come from the same place.',
          '<select id="doc-quote-cust">' + customers.map(function (c) {
            return '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>';
          }).join('') + '</select>' +
          '<p class="field__hint" style="margin-top:.5rem">Uses whatever is on the till screen, or a sample basket if the till is empty.</p>') +

        docCard('po', 'Purchase order', 'Quantities calculated from how fast each line actually sells and how long the supplier takes.',
          '<select id="doc-supplier">' + suppliers.map(function (s) {
            return '<option value="' + esc(s.id) + '">' + esc(s.name) + ' — ' + s.leadTimeDays + ' day lead time</option>';
          }).join('') + '</select>') +

        docCard('statement', 'Customer statement', 'Every transaction linked to one customer, aged into 30/60/90 day buckets.',
          '<select id="doc-stmt-cust">' + customers.filter(function (c) { return c.creditTerms !== 'Cash only'; }).map(function (c) {
            return '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>';
          }).join('') + '</select>') +

        docCard('stocktake', 'Stock take sheet', 'A counting sheet with the system\'s own figure deliberately left off it.',
          '<select id="doc-cat"><option value="">All categories</option>' + categories.map(function (c) {
            return '<option value="' + esc(c) + '">' + esc(c) + '</option>';
          }).join('') + '</select>') +

        docCard('popia', 'POPIA access report', 'Everything held about one person, why it is held, and when it will be deleted. Section 23 answered in one click.',
          '<select id="doc-popia-cust">' + customers.map(function (c) {
            return '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>';
          }).join('') + '</select>') +
      '</div>' +

      '<div id="doc-output" class="mt-6"></div>' +
    '</div>';
  }

  function docCard(key, title, blurb, control) {
    return '<div class="card"><h4 style="margin-top:0">' + esc(title) + '</h4>' +
      '<p style="font-size:.88rem;color:#4d6479">' + esc(blurb) + '</p>' +
      '<div class="field">' + control + '</div>' +
      '<button class="btn btn--primary btn--sm" style="margin-top:.85rem" data-doc="' + key + '">Generate</button></div>';
  }

  function makeDoc(key, idOverride) {
    var html = '', title = '';
    switch (key) {
      case 'invoice': {
        var id = idOverride || document.getElementById('doc-sale').value;
        html = G.invoice(id); title = 'Tax Invoice';
        break;
      }
      case 'quote': {
        var cid = idOverride || document.getElementById('doc-quote-cust').value;
        var lines = state.tillLines.length ? state.tillLines : S.all('products').slice(0, 4).map(function (p) {
          return { productId:p.id, sku:p.sku, description:p.name, qty:5, unitPrice:p.sellPrice, unitCost:p.costPrice };
        });
        html = G.quote(cid, lines); title = 'Quotation';
        break;
      }
      case 'po':       html = G.purchaseOrder(idOverride || document.getElementById('doc-supplier').value); title = 'Purchase Order'; break;
      case 'statement':html = G.statement(idOverride || document.getElementById('doc-stmt-cust').value); title = 'Customer Statement'; break;
      case 'stocktake':html = G.stockTakeSheet(idOverride !== undefined ? idOverride : document.getElementById('doc-cat').value); title = 'Stock Take Sheet'; break;
      case 'popia':    html = G.popiaReport(idOverride || document.getElementById('doc-popia-cust').value); title = 'POPIA Access Report'; break;
    }
    state.docHtml = html; state.docTitle = title;
    var out = document.getElementById('doc-output');
    out.innerHTML =
      '<div class="cluster no-print" style="justify-content:space-between;margin-bottom:1rem">' +
        '<h3 style="margin:0">Preview</h3>' +
        '<div class="cluster">' +
          '<button class="btn btn--ghost btn--sm" id="doc-print">Print / save as PDF</button>' +
        '</div></div>' +
      '<div class="doc-preview">' + html + '</div>';
    document.getElementById('doc-print').addEventListener('click', function () { G.print(state.docHtml, state.docTitle); });
    out.scrollIntoView({ behavior:'smooth', block:'start' });
  }

  /* ======================================================================
     VIEW: Analytics
     ====================================================================== */
  function viewAnalytics() {
    var perf = A.productPerformance().slice(0, 12);
    var worst = A.productPerformance().slice(-6).reverse();
    var cust = A.customerValue().slice(0, 10);
    var reorder = A.reorderList().filter(function (r) { return r.urgency !== 'ok'; });
    var dead = A.deadStock();
    var shrink = A.shrinkage();
    var week = A.weekdayPattern();
    var owed = A.debtors();
    var conc = A.concentration();

    return '<div class="panel">' +
      '<div class="panel__head"><div><h2>What the data is telling you</h2>' +
        '<p>Six questions a shop owner asks that a spreadsheet makes expensive to answer.</p></div></div>' +

      '<h3 id="an-profit">1. Which products actually make the money?</h3>' +
      '<p class="muted" style="font-size:.9rem">Ranked by gross profit, not by units sold. The two lists are not the same, and acting on the wrong one is a common and costly mistake.</p>' +
      '<div class="chart">' + A.charts.hBar(perf, { value:'grossProfit', label:'name', labelWidth:260,
        alt:'Products ranked by gross profit', format:function (v) { return rand(v, 0); } }) + '</div>' +
      '<div class="table-wrap"><table><thead><tr><th>Product</th><th class="num">Units</th><th class="num">Revenue</th><th class="num">Gross profit</th><th class="num">Margin</th></tr></thead><tbody>' +
        perf.map(function (p) {
          return '<tr><td>' + esc(p.name) + '</td><td class="num">' + p.units.toLocaleString('en-ZA') + '</td>' +
            '<td class="num">' + rand(p.revenue, 0) + '</td><td class="num">' + rand(p.grossProfit, 0) + '</td>' +
            '<td class="num">' + A.pct(p.marginPct) + '</td></tr>';
        }).join('') + '</tbody></table></div>' +

      '<h3 id="an-reorder">2. What needs ordering, and how badly?</h3>' +
      '<p class="muted" style="font-size:.9rem">Calculated from actual sales rate against each supplier\'s lead time. "Days cover" is how long the shelf lasts if trading continues as it has.</p>' +
      (reorder.length
        ? '<div class="table-wrap"><table><thead><tr><th>Product</th><th>Supplier</th><th class="num">On hand</th><th class="num">Sold/day</th><th class="num">Days cover</th><th class="num">Order</th><th>Status</th></tr></thead><tbody>' +
          reorder.map(function (r) {
            var badge = r.urgency === 'out' ? 'bad' : (r.urgency === 'critical' ? 'bad' : 'warn');
            var word = r.urgency === 'out' ? 'Out of stock' : (r.urgency === 'critical' ? 'Will run out' : 'Below reorder');
            return '<tr><td>' + esc(r.name) + '</td><td>' + esc(r.supplier) + '</td>' +
              '<td class="num">' + r.onHand + '</td><td class="num">' + r.soldPerDay.toFixed(2) + '</td>' +
              '<td class="num">' + (r.daysCover > 900 ? '—' : r.daysCover.toFixed(0)) + '</td>' +
              '<td class="num"><strong>' + r.suggestedOrder + '</strong></td>' +
              '<td><span class="badge badge--' + badge + '">' + word + '</span></td></tr>';
          }).join('') + '</tbody></table></div>' +
          '<p class="mt-5"><button class="btn btn--ghost btn--sm" data-go="documents">Turn this into a purchase order</button></p>'
        : '<div class="callout callout--win">Everything is above its reorder level.</div>') +

      '<h3 id="an-dead">3. Where is money sitting still?</h3>' +
      (dead.length
        ? '<p class="muted" style="font-size:.9rem">These lines have not sold a single unit in twelve months. Together they tie up <strong>' +
          rand(dead.reduce(function (t, d) { return t + d.tiedUp; }, 0)) + '</strong> of the owner\'s money.</p>' +
          '<div class="table-wrap"><table><thead><tr><th>Product</th><th>Category</th><th class="num">On hand</th><th class="num">Tied up</th></tr></thead><tbody>' +
          dead.map(function (d) {
            return '<tr><td>' + esc(d.name) + '</td><td>' + esc(d.category) + '</td><td class="num">' + d.onHand + '</td><td class="num">' + rand(d.tiedUp) + '</td></tr>';
          }).join('') + '</tbody></table></div>'
        : '<div class="callout callout--win">Every line has sold at least once this year.</div>') +

      '<h3 id="an-shrink">4. What is disappearing?</h3>' +
      '<p class="muted" style="font-size:.9rem">Write-offs and stock-take differences, valued at cost. On paper this is invisible; here it is a number.</p>' +
      '<div class="figs" style="margin-bottom:1rem">' +
        statTile(rand(shrink.total), 'Lost in twelve months', shrink.rows.length + ' events', '#9b2423') +
        statTile(rand(shrink.byReason['Stock take adjustment'] || 0), 'Stock-take differences', 'counted vs book') +
        statTile(rand(shrink.byReason['Damage / write-off'] || 0), 'Damage and write-offs', 'recorded with a reason') +
      '</div>' +
      '<div class="table-wrap"><table><thead><tr><th>Date</th><th>Product</th><th class="num">Qty</th><th>Reason</th><th>Explanation</th><th class="num">Value</th></tr></thead><tbody>' +
        shrink.rows.slice(0, 12).map(function (r) {
          return '<tr><td>' + dateZA(r.date) + '</td><td>' + esc(r.product) + '</td><td class="num">' + r.qty + '</td>' +
            '<td>' + esc(r.reason) + '</td><td class="muted">' + esc(r.reference) + '</td><td class="num">' + rand(r.value) + '</td></tr>';
        }).join('') + '</tbody></table></div>' +

      '<h3 id="an-cust">5. How exposed are you to one customer?</h3>' +
      '<p class="muted" style="font-size:.9rem"><strong>' + esc(conc.top ? conc.top.name : '—') + '</strong> is the largest single buyer at ' +
      A.pct(conc.topShare) + ' of turnover, and the three biggest trade accounts together are <strong>' + A.pct(conc.top3Share) +
      '</strong>. That is a risk question, not an accounting one: what happens to this shop if one of them stops buying?</p>' +
      '<p class="muted" style="font-size:.9rem">Trade accounts as a whole are ' + A.pct(conc.tradeShare) + ' of turnover. ' +
      'The remaining ' + A.pct(conc.walkInShare) + ' is anonymous walk-in trade — recorded against the generic ' +
      '"Walk-in customer" record, which is a bucket rather than a person and so is left out of the concentration figures above.</p>' +
      '<div class="chart">' + A.charts.hBar(cust, { value:'revenue', label:'name', labelWidth:230,
        alt:'Customers ranked by revenue', format:function (v) { return rand(v, 0); } }) + '</div>' +
      '<div class="table-wrap"><table><thead><tr><th>Customer</th><th>Type</th><th class="num">Visits</th><th class="num">Revenue</th><th class="num">Share</th><th class="num">Avg sale</th><th class="num">Owes</th></tr></thead><tbody>' +
        cust.map(function (c) {
          return '<tr><td>' + esc(c.name) + (c.anonymous ? ' <span class="badge badge--neutral">not one customer</span>' : '') +
            '</td><td>' + esc(c.type) + '</td><td class="num">' + c.visits + '</td>' +
            '<td class="num">' + rand(c.revenue, 0) + '</td><td class="num">' + A.pct(c.share) + '</td>' +
            '<td class="num">' + rand(c.avgBasket, 0) + '</td>' +
            '<td class="num">' + (c.outstanding ? '<strong style="color:#9b2423">' + rand(c.outstanding) + '</strong>' : '—') + '</td></tr>';
        }).join('') + '</tbody></table></div>' +

      '<h3 id="an-week">6. When should staff be on the floor?</h3>' +
      '<p class="muted" style="font-size:.9rem">The cheapest decision on this page to act on, and the one a paper till roll can never answer.</p>' +
      '<div class="chart">' + A.charts.hBar(week.filter(function (w) { return w.transactions; }), {
        value:'revenue', label:'day', labelWidth:120, alt:'Revenue by day of week',
        format:function (v) { return rand(v, 0); } }) + '</div>' +

      (owed.length ? '<h3 id="an-debt">Money owed to you</h3>' +
        '<div class="table-wrap"><table><thead><tr><th>Customer</th><th>Terms</th><th class="num">Current</th><th class="num">30 days</th><th class="num">60 days</th><th class="num">90+ days</th><th class="num">Total</th></tr></thead><tbody>' +
        owed.map(function (d) {
          return '<tr><td>' + esc(d.name) + (d.overLimit ? ' <span class="badge badge--bad">over limit</span>' : '') + '</td>' +
            '<td>' + esc(d.terms) + '</td>' +
            '<td class="num">' + rand(d.buckets.current) + '</td><td class="num">' + rand(d.buckets.d30) + '</td>' +
            '<td class="num">' + rand(d.buckets.d60) + '</td>' +
            '<td class="num">' + (d.buckets.d90 ? '<strong style="color:#9b2423">' + rand(d.buckets.d90) + '</strong>' : '—') + '</td>' +
            '<td class="num"><strong>' + rand(d.outstanding) + '</strong></td></tr>';
        }).join('') + '</tbody></table></div>' : '') +
    '</div>';
  }

  /* ======================================================================
     VIEW: Data quality
     ====================================================================== */
  function viewQuality() {
    var q = S.quality();
    var dims = [
      { name:'Accuracy',   q:'Does the value match reality?',                      ex:'A selling price below cost is not a price, it is a typing error nobody caught.' },
      { name:'Completeness',q:'Is anything missing that you need?',                ex:'A customer with no recorded purpose for holding their details.' },
      { name:'Consistency',q:'Does the same thing appear the same way everywhere?',ex:'"Sarah Nel" and "Sara Nel" with one phone number between them.' },
      { name:'Timeliness', q:'Is it current enough to decide on?',                 ex:'A stock figure last counted in June is not a stock figure in October.' },
      { name:'Validity',   q:'Does it fit the rules?',                             ex:'A VAT number that is five digits long cannot be a VAT number.' },
      { name:'Uniqueness', q:'Is each real thing stored once?',                    ex:'One customer captured twice means their credit limit is effectively doubled.' }
    ];

    return '<div class="panel">' +
      '<div class="panel__head"><div><h2>How much of this can you trust?</h2>' +
        '<p>Every rule below runs against the stored records right now. The score is not a judgement — it is a to-do list.</p></div>' +
        '<span class="badge badge--' + (q.score >= 85 ? 'ok' : q.score >= 65 ? 'warn' : 'bad') + '">' + q.score + '% of checks passing</span></div>' +

      '<div class="figs">' +
        statTile(q.score + '%', 'Checks passing', q.passed + ' of ' + q.checks,
          q.score >= 85 ? '#1d6b3f' : q.score >= 65 ? '#b06a00' : '#9b2423') +
        statTile(q.errors, 'Must be fixed', 'these are definitely wrong', '#9b2423') +
        statTile(q.warnings, 'Worth checking', 'might be deliberate', '#b06a00') +
        statTile(q.unverified, 'Never validated', 'came straight from the old spreadsheet') +
      '</div>' +

      '<div class="callout callout--note"><div class="callout__title">How the score is worked out</div>' +
      '<p>' + q.passed + ' of ' + q.checks + ' checks on the ' + S.count('products') + ' products and ' + S.count('customers') +
      ' customer records are passing. Sales are checked too — ' + q.salesChecked.toLocaleString('en-ZA') + ' of them, with ' +
      q.salesBroken + ' broken — but they are deliberately kept out of the headline percentage. ' +
      'If thousands of routine transactions counted as passing checks, a handful of genuinely broken records would round away ' +
      'to nothing and the score would read 100% while the shop was still extending R12 000 of credit to a customer nobody can identify. ' +
      'A quality score that cannot go down is worse than no score at all.</p></div>' +

      '<div class="callout callout--note"><div class="callout__title">Why so many records are "unverified"</div>' +
      '<p>Everything imported from the old spreadsheet is marked <code>unverified</code> on purpose. It was never checked by any rule, because no rule existed. Pretending migrated data is as trustworthy as freshly validated data is how a new system inherits an old system\'s problems.</p></div>' +

      '<h3>The six questions behind the score</h3>' +
      '<div class="grid grid--3">' + dims.map(function (d) {
        return '<div class="card"><h4 style="margin-top:0">' + esc(d.name) + '</h4>' +
          '<p style="font-size:.88rem;font-weight:600;color:#35495a">' + esc(d.q) + '</p>' +
          '<p style="font-size:.86rem;color:#6b8299">' + esc(d.ex) + '</p></div>';
      }).join('') + '</div>' +

      '<h3>Everything currently failing</h3>' +
      (q.issues.length
        ? '<div class="table-wrap"><table><thead><tr><th>Severity</th><th>Where</th><th>Record</th><th>Problem</th><th></th></tr></thead><tbody>' +
          q.issues.map(function (i) {
            return '<tr><td><span class="badge badge--' + (i.sev === 'error' ? 'bad' : 'warn') + '">' + i.sev + '</span></td>' +
              '<td>' + esc(window.LHH_SCHEMA.collections[i.collection].label) + '</td>' +
              '<td>' + esc(i.label) + ' <code style="font-size:.78rem">' + esc(i.id) + '</code></td>' +
              '<td>' + esc(i.msg) + '</td>' +
              '<td><button class="btn btn--sm btn--ghost" data-open-rec="' + esc(i.collection) + ':' + esc(i.id) + '">Open</button></td></tr>';
          }).join('') + '</tbody></table></div>'
        : '<div class="callout callout--win">Nothing is failing.</div>') +
    '</div>';
  }

  /* ======================================================================
     VIEW: POPIA centre
     ====================================================================== */
  function viewPopia() {
    var customers = S.all('customers');
    var withConsent = customers.filter(function (c) { return c.popiaConsentMarketing; });
    var noConsentDate = withConsent.filter(function (c) { return !c.popiaConsentDate; });
    var noPurpose = customers.filter(function (c) { return !(c.popiaPurpose || []).length; });
    var noRetention = customers.filter(function (c) { return !c.popiaRetentionUntil && c.id !== 'CUS-001'; });
    var today = window.LHH_SEED.meta.asOfDate;
    var dueDeletion = customers.filter(function (c) { return c.popiaRetentionUntil && c.popiaRetentionUntil <= today; });

    var purposeCount = {};
    customers.forEach(function (c) {
      (c.popiaPurpose || []).forEach(function (p) { purposeCount[p] = (purposeCount[p] || 0) + 1; });
    });
    var purposeRows = Object.keys(purposeCount).map(function (k) { return { label:k, value:purposeCount[k] }; })
      .sort(function (a, b) { return b.value - a.value; });

    return '<div class="panel">' +
      '<div class="panel__head"><div><h2>POPIA — can you answer the questions?</h2>' +
        '<p>The Protection of Personal Information Act applies to this shop whether or not anyone at the shop has read it. These are the four questions that actually get asked.</p></div>' +
        '<span class="badge badge--popia">' + customers.length + ' people on file</span></div>' +

      '<div class="figs">' +
        statTile(customers.length, 'Personal records held', 'each one is a responsibility') +
        statTile(withConsent.length, 'Consented to marketing', 'the only ones you may message') +
        statTile(noConsentDate.length, 'Consent you cannot prove', 'ticked, but no date recorded', noConsentDate.length ? '#9b2423' : '') +
        statTile(noRetention.length, 'No deletion date', 'section 14 says you need one', noRetention.length ? '#b06a00' : '') +
      '</div>' +

      '<h3>1. "What do you hold about me?" — section 23</h3>' +
      '<p>Any person may ask, and the shop must answer. On spreadsheets the honest answer is "we are not sure" — their details are in a till book, a WhatsApp group, an exercise book and three versions of a file. Here the answer is one click, because every record about a person is linked to that person.</p>' +
      '<div class="cluster" style="margin-top:1rem">' +
        '<select id="popia-subject" style="max-width:20rem;padding:.55rem .7rem;border:1px solid #c3cfda;border-radius:6px">' +
          customers.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>'; }).join('') +
        '</select>' +
        '<button class="btn btn--primary btn--sm" id="popia-generate">Produce the report</button>' +
      '</div>' +
      '<div id="popia-out"></div>' +

      '<h3>2. "Why do you have it?" — section 13</h3>' +
      '<p>Personal information may only be collected for a specific, lawful, stated purpose. The capture form will not save a customer without one, which turns a legal requirement into a field somebody fills in rather than a policy nobody reads.</p>' +
      '<div class="chart" style="margin-top:1rem"><h3>Recorded purposes</h3>' +
        '<p class="chart__sub">Across ' + customers.length + ' customer records.</p>' +
        A.charts.hBar(purposeRows, { value:'value', label:'label', labelWidth:240, alt:'Purposes recorded',
          format:function (v) { return v + ' records'; } }) + '</div>' +
      (noPurpose.length
        ? '<div class="callout callout--risk"><div class="callout__title">' + noPurpose.length + ' record' + (noPurpose.length === 1 ? '' : 's') + ' with no stated purpose</div><ul>' +
          noPurpose.map(function (c) { return '<li>' + esc(c.name) + ' (' + esc(c.id) + ')</li>'; }).join('') +
          '</ul><p>These came out of the old spreadsheet, where there was nowhere to record a purpose. Each one is a section 13 problem until somebody either records why it is held or deletes it.</p></div>'
        : '') +

      '<h3>3. "Stop messaging me." — section 69</h3>' +
      '<p>Direct marketing by SMS or email needs consent, and the shop must be able to show it was given. A tick with no date is not evidence.</p>' +
      '<div class="table-wrap"><table><thead><tr><th>Customer</th><th>Marketing</th><th>Consent date</th><th>Channel</th><th>Status</th></tr></thead><tbody>' +
        customers.filter(function (c) { return c.popiaConsentMarketing || c.email; }).map(function (c) {
          var ok = !c.popiaConsentMarketing || !!c.popiaConsentDate;
          return '<tr><td>' + esc(c.name) + '</td>' +
            '<td>' + (c.popiaConsentMarketing ? '<span class="badge badge--popia">consented</span>' : '<span class="badge badge--neutral">no</span>') + '</td>' +
            '<td>' + (c.popiaConsentDate ? dateZA(c.popiaConsentDate) : '<span style="color:#9b2423">not recorded</span>') + '</td>' +
            '<td>' + esc(c.email || c.phone || '—') + '</td>' +
            '<td>' + (ok ? '<span class="badge badge--ok">defensible</span>' : '<span class="badge badge--bad">cannot prove consent</span>') + '</td></tr>';
        }).join('') + '</tbody></table></div>' +

      '<h3>4. "Why have you still got it?" — section 14</h3>' +
      '<p>Personal information may not be kept for longer than it is needed. A retention date on every record turns that from a principle into a diary entry.</p>' +
      (dueDeletion.length
        ? '<div class="callout callout--warn"><div class="callout__title">' + dueDeletion.length + ' record(s) past their retention date</div><ul>' +
          dueDeletion.map(function (c) { return '<li>' + esc(c.name) + ' — due ' + dateZA(c.popiaRetentionUntil) + '</li>'; }).join('') + '</ul></div>'
        : '<div class="callout callout--win">No record is past its retention date today.</div>') +
      (noRetention.length
        ? '<div class="callout callout--warn"><div class="callout__title">' + noRetention.length + ' record(s) with no retention date at all</div>' +
          '<div class="tag-row">' + noRetention.map(function (c) { return '<span class="badge badge--warn">' + esc(c.name) + '</span>'; }).join('') + '</div></div>'
        : '') +

      '<div class="callout callout--popia" style="margin-top:2rem"><div class="callout__title">A caution worth saying out loud</div>' +
      '<p>Nothing on this screen makes a business POPIA-compliant. Compliance is an organisational matter — an appointed Information Officer registered with the Information Regulator, a written policy, staff who know not to discuss customers in a WhatsApp group, a plan for when something goes wrong. What a system can do is make the record-keeping half of it automatic instead of impossible. The team should verify the current registration requirements and penalties against the Information Regulator\'s own guidance and cite it.</p></div>' +
    '</div>';
  }

  /* ======================================================================
     VIEW: Audit trail
     ====================================================================== */
  function viewAudit() {
    var log = S.auditLog(120);
    return '<div class="panel">' +
      '<div class="panel__head"><div><h2>Who changed what</h2>' +
        '<p>Every create, change, delete, import and export, with the old value and the new one. Try changing a price and watch the entry appear.</p></div>' +
        '<span class="badge badge--info">' + log.length + ' entries</span></div>' +
      (log.length
        ? '<div class="table-wrap"><table><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Record</th><th>What changed</th></tr></thead><tbody>' +
          log.map(function (e) {
            return '<tr><td class="nowrap">' + new Date(e.at).toLocaleString('en-ZA') + '</td>' +
              '<td>' + esc(e.by) + '</td>' +
              '<td><span class="badge badge--' + (e.action === 'deleted' ? 'bad' : e.action === 'created' ? 'ok' : 'info') + '">' + esc(e.action) + '</span></td>' +
              '<td><code>' + esc(e.recordId || '—') + '</code></td>' +
              '<td style="font-size:.85rem">' + esc(e.detail) + '</td></tr>';
          }).join('') + '</tbody></table></div>'
        : '<div class="callout callout--note">Nothing has been changed yet in this session. Capture a sale or edit a record and come back.</div>') +
      '<div class="callout callout--note"><div class="callout__title">Why this matters more than it sounds</div>' +
      '<p>"Who changed this price?" is unanswerable in a shared spreadsheet. The question comes up at exactly the worst moments — a disputed invoice, a stock loss, an argument between staff. An audit trail does not prevent any of those; it ends the argument about what happened.</p></div>' +
    '</div>';
  }

  /* ======================================================================
     VIEW: Your data (import / export)
     ====================================================================== */
  function viewData() {
    return '<div class="panel">' +
      '<div class="panel__head"><div><h2>Your data stays yours</h2>' +
        '<p>Export everything, inspect it, move it somewhere else. A small business that cannot get its data out of a system is trapped in it.</p></div></div>' +

      '<div class="grid grid--2">' +
        '<div class="card"><h4 style="margin-top:0">Export</h4>' +
          '<p style="font-size:.9rem;color:#4d6479">Downloads a single JSON file containing every record, with its metadata envelope intact. Open it in any text editor — it is readable, and it is yours.</p>' +
          '<div class="field"><label class="field__label">What to include</label>' +
            S.COLLECTIONS.map(function (c) {
              return '<label style="display:flex;gap:.5rem;align-items:center;font-weight:500;font-size:.9rem;margin-top:.3rem">' +
                '<input type="checkbox" class="exp-coll" value="' + c + '" checked> ' +
                esc(window.LHH_SCHEMA.collections[c].label) + ' <span class="muted">(' + S.count(c) + ')</span></label>';
            }).join('') +
          '</div>' +
          '<div class="cluster" style="margin-top:1rem">' +
            '<button class="btn btn--primary btn--sm" id="exp-download">Download JSON</button>' +
            '<button class="btn btn--ghost btn--sm" id="exp-preview">Show me what it looks like</button>' +
          '</div>' +
        '</div>' +

        '<div class="card"><h4 style="margin-top:0">Import</h4>' +
          '<p style="font-size:.9rem;color:#4d6479">Reads a file back in. The file is checked before anything is touched — an import that half-succeeds is worse than one that refuses.</p>' +
          '<div class="field"><label class="field__label" for="imp-file">Choose a file</label>' +
            '<input type="file" id="imp-file" accept="application/json,.json"></div>' +
          '<div class="field"><label class="field__label" for="imp-mode">If a record already exists</label>' +
            '<select id="imp-mode">' +
              '<option value="merge">Keep whichever was changed most recently</option>' +
              '<option value="replace">Wipe the collection and use the file</option>' +
            '</select></div>' +
          '<button class="btn btn--primary btn--sm" style="margin-top:1rem" id="imp-run">Import</button>' +
          '<div id="imp-report"></div>' +
        '</div>' +
      '</div>' +

      '<div id="exp-out"></div>' +

      '<h3>Why JSON and not another spreadsheet?</h3>' +
      '<div class="table-wrap"><table class="compare"><thead><tr><th>Question</th><th>Spreadsheet cell</th><th>Record in this system</th></tr></thead><tbody>' +
        [['What is the value?','R29.90','R29.90'],
         ['Who put it there?','<span class="no">Unknown</span>','<span class="yes">Sipho Dlamini</span>'],
         ['When?','<span class="no">Unknown</span>','<span class="yes">2026-10-11 14:22</span>'],
         ['Where did it come from?','<span class="no">Unknown</span>','<span class="yes">counter-capture</span>'],
         ['Was it checked?','<span class="no">No rule existed</span>','<span class="yes">Passed 7 rules</span>'],
         ['Has it changed before?','<span class="no">Overwritten, gone</span>','<span class="yes">Version 3, history kept</span>'],
         ['What else depends on it?','<span class="no">Nothing links to it</span>','<span class="yes">14 invoices, 31 movements</span>'],
         ['Can a program read it reliably?','<span class="no">Only if the layout never changes</span>','<span class="yes">Yes, the shape is declared</span>']
        ].map(function (r) {
          return '<tr><td><strong>' + r[0] + '</strong></td><td>' + r[1] + '</td><td>' + r[2] + '</td></tr>';
        }).join('') + '</tbody></table></div>' +

      '<h3>Start again</h3>' +
      '<p>Everything in this demonstration lives in this browser only. Nothing is sent anywhere, and nothing here is real personal information.</p>' +
      '<button class="btn btn--danger btn--sm" id="data-reset">Restore the demonstration data</button>' +
    '</div>';
  }

  /* ======================================================================
     VIEW: Training
     ====================================================================== */
  function viewTraining() {
    var lessons = [
      { t:'Capture once, use everywhere', m:'till',
        task:'Ring up a sale on the till screen, then go to Documents and produce the tax invoice for it.',
        point:'You typed a quantity. Everything else on that invoice — the customer, their VAT number, the description, the price, the VAT calculation — came from records that already existed.' },
      { t:'Let the system catch mistakes', m:'till',
        task:'Try to sell 500 bags of cement, or drop a price below cost, or put a cash-only customer on account.',
        point:'The rule fires at the counter, where it is cheap to fix, instead of at month-end, where it is expensive.' },
      { t:'See what a record really holds', m:'records',
        task:'Open any customer and read the _meta block at the bottom.',
        point:'Who captured it, when, from where, which version, whether it passed validation, and what links to it. None of that fits in a spreadsheet cell.' },
      { t:'Fix something and watch the trail', m:'records',
        task:'Change a product price, then open the Audit trail.',
        point:'The old value and the new one, with your name and the time. "Who changed this?" becomes answerable.' },
      { t:'Answer a POPIA request', m:'popia',
        task:'Pick a customer and produce their access report.',
        point:'Section 23 gives every person the right to ask. On spreadsheets this takes a day and is probably incomplete. Here it is one click and it is provably complete.' },
      { t:'Find the money standing still', m:'analytics',
        task:'Look at section 3 — dead stock — and section 4 — shrinkage.',
        point:'Two numbers no paper system produces, both of which are the owner\'s own money.' },
      { t:'Order from evidence, not memory', m:'analytics',
        task:'Read the reorder table, then generate the purchase order for that supplier.',
        point:'The quantities come from actual sales rate against the supplier\'s lead time, not from walking the aisle with a clipboard.' },
      { t:'Take your data with you', m:'data',
        task:'Export the records and open the file.',
        point:'It is readable, it is complete, and it is yours. Check this before signing up for any system.' }
    ];

    return '<div class="panel">' +
      '<div class="panel__head"><div><h2>Learning it by using it</h2>' +
        '<p>Eight short exercises. Each one takes a minute and makes one point. Staff training that happens inside the system beats a training session three weeks before go-live.</p></div></div>' +

      '<div class="grid grid--2">' + lessons.map(function (l, i) {
        return '<div class="card"><div class="card__num">EXERCISE ' + (i + 1) + '</div>' +
          '<h4 style="margin-top:.35rem">' + esc(l.t) + '</h4>' +
          '<p style="font-size:.9rem"><strong>Do this:</strong> ' + esc(l.task) + '</p>' +
          '<p style="font-size:.9rem;color:#4d6479"><strong>The point:</strong> ' + esc(l.point) + '</p>' +
          '<button class="btn btn--ghost btn--sm" style="margin-top:.6rem" data-go="' + l.m + '">Take me there</button></div>';
      }).join('') + '</div>' +

      '<h3>Who can do what</h3>' +
      '<p class="muted" style="font-size:.9rem">Switch user to see the same system from a different chair. Permissions are not about distrust — they are about not asking somebody to be careful with a screen they never needed to see.</p>' +
      '<div class="grid grid--4">' + window.LHH_SCHEMA.users.map(function (u) {
        var active = S.user().id === u.id;
        return '<div class="card" style="' + (active ? 'border-color:#128079;box-shadow:0 0 0 2px #d8efed' : '') + '">' +
          '<h4 style="margin-top:0">' + esc(u.name) + '</h4>' +
          '<p style="font-size:.85rem;color:#6b8299;margin-top:.2rem">' + esc(u.role) + '</p>' +
          '<div class="tag-row">' + u.permissions.map(function (p) { return '<span class="badge badge--neutral">' + esc(p) + '</span>'; }).join('') + '</div>' +
          '<button class="btn btn--sm ' + (active ? 'btn--primary' : 'btn--ghost') + '" style="margin-top:.75rem" data-user="' + esc(u.id) + '"' + (active ? ' disabled' : '') + '>' +
          (active ? 'Signed in' : 'Sign in as ' + esc(u.name.split(' ')[0])) + '</button></div>';
      }).join('') + '</div>' +
    '</div>';
  }

  /* ======================================================================
     Router
     ====================================================================== */
  var VIEWS = {
    overview:  { label:'Today',          group:'Running the shop', render: viewOverview },
    till:      { label:'Till',           group:'Running the shop', render: viewTill, wire: wireTill },
    customers: { label:'New customer',   group:'Running the shop',
                 render: function () { return viewForm('customers',
                   'Watch the form change as you fill it in. Fields appear only when they become relevant, and the POPIA fields are not optional extras — the record will not save without a reason for holding the person\'s information.',
                   '<div class="callout callout--popia"><div class="callout__title">Try this</div><ul style="font-size:.87rem"><li>Choose "Business" and watch the VAT number appear.</li><li>Tick marketing consent and watch the date field appear.</li><li>Type 0834412096 as the phone number.</li></ul></div>'); },
                 wire: function () { wireForm('customers'); } },
    products:  { label:'New product',    group:'Running the shop',
                 render: function () { return viewForm('products',
                   'The margin is worked out and shown while you type, so a pricing mistake is visible before it is saved rather than three months later in a report.',
                   '<div class="callout callout--note"><div class="callout__title">Try this</div><ul style="font-size:.87rem"><li>Set a selling price below the cost price.</li><li>Set one only 5% above cost.</li><li>Use a SKU that already exists.</li></ul></div>'); },
                 wire: function () { wireForm('products'); } },

    records:   { label:'Records',        group:'What is stored',  render: viewRecords },
    documents: { label:'Documents',      group:'What is stored',  render: viewDocuments },
    data:      { label:'Your data',      group:'What is stored',  render: viewData },

    analytics: { label:'Analytics',      group:'Making decisions', render: viewAnalytics },
    quality:   { label:'Data quality',   group:'Making decisions', render: viewQuality },
    popia:     { label:'POPIA',          group:'Making decisions', render: viewPopia },
    audit:     { label:'Audit trail',    group:'Making decisions', render: viewAudit },
    training:  { label:'Training',       group:'Making decisions', render: viewTraining }
  };

  var ICONS = {
    overview:'▦', till:'▤', customers:'☻', products:'▣', records:'❑',
    documents:'▥', data:'⇄', analytics:'◧', quality:'✓', popia:'⚖', audit:'≡', training:'◎'
  };

  function renderNav() {
    var groups = [];
    Object.keys(VIEWS).forEach(function (k) {
      var g = VIEWS[k].group;
      var found = groups.find(function (x) { return x.name === g; });
      if (!found) groups.push({ name:g, items:[k] }); else found.items.push(k);
    });
    navEl.innerHTML = '<ul>' + groups.map(function (g) {
      return '<li class="demo-nav__sep">' + esc(g.name) + '</li>' + g.items.map(function (k) {
        return '<li><button data-view="' + k + '"' + (state.view === k ? ' aria-current="true"' : '') + '>' +
          '<span class="demo-nav__icon" aria-hidden="true">' + ICONS[k] + '</span>' + esc(VIEWS[k].label) + '</button></li>';
      }).join('');
    }).join('') + '</ul>' +
    '<div style="border-top:1px solid #e0e7ed;margin-top:.75rem;padding:.75rem .7rem 0">' +
      '<p style="font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:#97a9ba;font-weight:700;margin:0">Signed in as</p>' +
      '<p style="font-size:.88rem;font-weight:600;margin:.2rem 0 0">' + esc(S.user().name) + '</p>' +
      '<p style="font-size:.78rem;color:#6b8299;margin:0">' + esc(S.user().role) + '</p>' +
    '</div>';
  }

  function render(view) {
    if (view) state.view = view;
    var v = VIEWS[state.view] || VIEWS.overview;
    mount.innerHTML = v.render();
    renderNav();
    if (v.wire) v.wire();
    wireCommon();
    try { history.replaceState(null, '', '#' + state.view); } catch (e) {}
    mount.focus({ preventScroll:true });
    window.scrollTo({ top:0, behavior:'smooth' });
  }

  function wireCommon() {
    /* Idempotent on purpose. Views that redraw a fragment after mounting (the
       till does) call this again; without the guard the second call would bind
       a second handler to every button that was already wired. */
    function each(selector, handler) {
      document.querySelectorAll(selector).forEach(function (el) {
        if (el.dataset.wired === '1') return;
        el.dataset.wired = '1';
        handler(el);
      });
    }

    each('[data-go]', function (b) {
      b.addEventListener('click', function () { render(b.getAttribute('data-go')); });
    });
    each('[data-coll]', function (b) {
      b.addEventListener('click', function () {
        state.selected.collection = b.getAttribute('data-coll');
        render('records');
      });
    });
    each('[data-rec]', function (b) {
      b.addEventListener('click', function () {
        var coll = state.selected.collection || 'customers';
        state.selected[coll] = b.getAttribute('data-rec');
        render('records');
      });
    });
    each('[data-open-rec]', function (b) {
      b.addEventListener('click', function () {
        var parts = b.getAttribute('data-open-rec').split(':');
        state.selected.collection = parts[0];
        state.selected[parts[0]] = parts[1];
        render('records');
      });
    });
    each('[data-doc]', function (b) {
      b.addEventListener('click', function () {
        var key = b.getAttribute('data-doc');
        var id = b.getAttribute('data-id');
        if (state.view !== 'documents' && !id) { render('documents'); return; }
        if (id && state.view !== 'documents') {
          state.selected.pendingDoc = { key:key, id:id };
          render('documents');
          makeDoc(key, id);
          return;
        }
        makeDoc(key, id || undefined);
      });
    });
    each('[data-user]', function (b) {
      b.addEventListener('click', function () {
        var u = window.LHH_SCHEMA.users.find(function (x) { return x.id === b.getAttribute('data-user'); });
        if (u) { S.user(u); toast('Signed in as ' + u.name + ' (' + u.role + ')', 'ok'); render(); }
      });
    });

    /* POPIA report button */
    var pg = document.getElementById('popia-generate');
    if (pg) pg.addEventListener('click', function () {
      var id = document.getElementById('popia-subject').value;
      var html = G.popiaReport(id);
      document.getElementById('popia-out').innerHTML =
        '<div class="cluster no-print" style="justify-content:flex-end;margin:1rem 0">' +
          '<button class="btn btn--ghost btn--sm" id="popia-print">Print / save as PDF</button></div>' +
        '<div class="doc-preview">' + html + '</div>';
      document.getElementById('popia-print').addEventListener('click', function () { G.print(html, 'POPIA Access Report'); });
    });

    /* Export / import */
    var dl = document.getElementById('exp-download');
    if (dl) dl.addEventListener('click', function () {
      var picked = Array.prototype.filter.call(document.querySelectorAll('.exp-coll'), function (c) { return c.checked; })
                                         .map(function (c) { return c.value; });
      var data = S.exportJSON(picked);
      var blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'lerato-hardware-records-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      toast('Exported ' + picked.length + ' collections.', 'ok');
    });

    var pv = document.getElementById('exp-preview');
    if (pv) pv.addEventListener('click', function () {
      var sample = {
        _format:'lhh-record-store',
        _schemaVersion: S.SCHEMA_VERSION,
        _exportedAt: new Date().toISOString(),
        customers: [S.all('customers')[1]],
        sales: [S.all('sales')[0]]
      };
      document.getElementById('exp-out').innerHTML =
        '<h3>A sample of the export file</h3>' +
        '<p class="muted" style="font-size:.9rem">Two records out of ' + (S.count('customers') + S.count('sales')) + '. Readable by a person, readable by a program, and complete.</p>' +
        '<div class="json-view">' + jsonHtml(sample) + '</div>';
    });

    var imp = document.getElementById('imp-run');
    if (imp) imp.addEventListener('click', function () {
      var f = document.getElementById('imp-file').files[0];
      if (!f) { toast('Choose a file first.', 'bad'); return; }
      var reader = new FileReader();
      reader.onload = function () {
        var parsed;
        try { parsed = JSON.parse(reader.result); }
        catch (e) {
          document.getElementById('imp-report').innerHTML =
            '<div class="callout callout--risk"><div class="callout__title">Not valid JSON</div><p>' + esc(e.message) + '</p></div>';
          return;
        }
        var r = S.importJSON(parsed, document.getElementById('imp-mode').value);
        document.getElementById('imp-report').innerHTML =
          '<div class="callout callout--' + (r.ok ? (r.warnings.length ? 'warn' : 'win') : 'risk') + '">' +
          '<div class="callout__title">' + (r.ok ? 'Import finished' : 'Import refused') + '</div>' +
          (r.ok ? '<p>' + r.added + ' added, ' + r.updated + ' updated, ' + r.skipped + ' skipped.</p>' : '') +
          (r.errors.length ? '<ul>' + r.errors.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') +
          (r.warnings.length ? '<p style="font-size:.88rem;margin-top:.5rem"><strong>Warnings:</strong></p><ul style="font-size:.87rem">' +
            r.warnings.slice(0, 8).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') +
          '</div>';
        if (r.ok) toast('Imported.', 'ok');
      };
      reader.readAsText(f);
    });

    var rs = document.getElementById('data-reset');
    if (rs) rs.addEventListener('click', function () {
      if (!confirm('This clears anything you captured and puts the demonstration back to its starting state. Continue?')) return;
      S.reset(); state.tillLines = []; toast('Demonstration data restored.', 'ok'); render('overview');
    });
  }

  /* ---- Boot -------------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', function () {
    mount = document.getElementById('demo-main');
    navEl = document.getElementById('demo-nav');
    if (!mount) return;

    S.init();
    var start = (location.hash || '').replace('#', '');
    if (VIEWS[start]) state.view = start;

    navEl.addEventListener('click', function (e) {
      var b = e.target.closest('[data-view]');
      if (b) render(b.getAttribute('data-view'));
    });

    render();
  });
}());
