/* ==========================================================================
   generate.js — documents built from stored records
   --------------------------------------------------------------------------
   This is the payoff of everything the other files do. No document in here
   asks anybody to type a customer's name, a VAT number, an address or a
   price. Every field is pulled from the record it belongs to, through the
   links stored in the _meta envelope.

   Captured once, used many times. The practical consequences:
     - the same customer cannot be spelled three different ways on three
       different invoices;
     - correcting a price in one place corrects every future document;
     - each document can say exactly which records it was built from, so an
       argument about an invoice is settled by looking, not by remembering.

   Output is plain HTML, printed to PDF by the browser. A small business does
   not need a document engine to get this benefit.
   ========================================================================== */

window.Generate = (function () {
  'use strict';

  var VAT_RATE = 0.15;

  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"]/g, function (c) {
      return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[c];
    });
  }
  function rand(n) {
    return 'R' + Number(n || 0).toLocaleString('en-ZA', { minimumFractionDigits:2, maximumFractionDigits:2 });
  }
  function dateZA(d) {
    if (!d) return '—';
    var dt = new Date(d.length === 10 ? d + 'T00:00:00' : d);
    return dt.toLocaleDateString('en-ZA', { day:'2-digit', month:'short', year:'numeric' });
  }
  function biz() {
    return (window.LHH_SCHEMA && window.LHH_SCHEMA.business) || { name:'Lerato\'s Hardware & Home', address:[], vatRate:VAT_RATE };
  }
  function addDays(iso, n) {
    var d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }

  /* The letterhead. Pulled from the business record, so changing the shop's
     phone number changes it on every document ever generated afterwards. */
  function letterhead(title, subtitle) {
    var b = biz();
    return '<div class="doc-head">' +
      '<div><h2>' + esc(title) + '</h2>' +
      (subtitle ? '<p class="muted" style="margin:.25rem 0 0;font-size:.9rem">' + esc(subtitle) + '</p>' : '') +
      '</div>' +
      '<div class="doc-biz"><strong>' + esc(b.name) + '</strong>' +
      (b.address || []).map(function (l) { return esc(l); }).join('<br>') +
      '<br>Tel ' + esc(b.phone || '') +
      '<br>VAT no. ' + esc(b.vatNumber || '') +
      '<br>Reg. ' + esc(b.regNumber || '') +
      '</div></div>';
  }

  /* Every generated document carries a provenance footer listing the record
     IDs it was built from. This is deliberately visible: it is the clearest
     way to show a non-technical audience that the document is a *view* of
     stored data, not a separately typed thing that can drift away from it. */
  function provenance(ids, extra) {
    return '<div class="doc-foot">' +
      (extra ? '<p>' + extra + '</p>' : '') +
      '<p class="prov">Generated ' + dateZA(new Date().toISOString()) +
      ' from stored records: ' + esc(ids.join(', ')) +
      ' · schema ' + esc(window.Store.SCHEMA_VERSION) +
      ' · no value on this document was retyped.</p></div>';
  }

  function lineTable(lines, opts) {
    opts = opts || {};
    var rows = lines.map(function (l) {
      var p = window.Store.get('products', l.productId);
      return '<tr>' +
        '<td><code>' + esc(l.sku || (p && p.sku) || '') + '</code></td>' +
        '<td>' + esc(l.description || (p && p.name) || '') + '</td>' +
        '<td class="num">' + esc(l.qty) + '</td>' +
        '<td class="num">' + rand(l.unitPrice) + '</td>' +
        '<td class="num">' + rand((l.qty || 0) * (l.unitPrice || 0)) + '</td>' +
        '</tr>';
    }).join('');
    return '<div class="table-wrap" style="margin-top:1.5rem"><table>' +
      '<thead><tr><th>Code</th><th>Description</th><th class="num">Qty</th>' +
      '<th class="num">Unit (excl.)</th><th class="num">Line total</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>';
  }

  function totalsBlock(subtotal, opts) {
    opts = opts || {};
    var vat = subtotal * VAT_RATE;
    return '<div class="doc-total"><table>' +
      '<tr><td>Subtotal (excl. VAT)</td><td class="num">' + rand(subtotal) + '</td></tr>' +
      '<tr><td>VAT @ ' + (VAT_RATE * 100).toFixed(0) + '%</td><td class="num">' + rand(vat) + '</td></tr>' +
      (opts.extraRows || '') +
      '<tr class="grand"><td>' + (opts.grandLabel || 'Total due') + '</td><td class="num">' + rand(subtotal + vat) + '</td></tr>' +
      '</table></div>';
  }

  /* ---- Tax invoice ------------------------------------------------------
     The field list below is not arbitrary. A document only qualifies as a tax
     invoice under the Value-Added Tax Act if it carries certain particulars —
     the words "Tax Invoice", both parties' details, the supplier's VAT number,
     a serial number, the date, a description of the goods, and the amount of
     VAT. Getting these onto every invoice automatically is a compliance
     benefit the owner can feel immediately, because it is the thing SARS asks
     about and the thing a VAT-registered customer phones back about. The team
     should verify the current required particulars against the SARS guidance
     and cite it on the Enterprise Systems page. */
  function invoice(saleId) {
    var sale = window.Store.get('sales', saleId);
    if (!sale) return '<p>That sale could not be found.</p>';
    var cust = window.Store.get('customers', sale.customerId);
    var subtotal = sale.lines.reduce(function (t, l) { return t + (l.qty || 0) * (l.unitPrice || 0); }, 0);
    var terms = cust ? cust.creditTerms : 'Cash only';
    var dueDate = terms === '30 days' ? addDays(sale.date, 30) : (terms === '7 days' ? addDays(sale.date, 7) : sale.date);

    var ids = [sale.id, sale.customerId].concat(sale.lines.map(function (l) { return l.productId; }));

    return letterhead('Tax Invoice', sale.docNumber) +
      '<div class="doc-meta">' +
        '<div><h4>Invoice to</h4><p><strong>' + esc(cust ? cust.name : 'Unknown customer') + '</strong><br>' +
          (cust && cust.phone && cust.phone !== '0000000000' ? esc(cust.phone) + '<br>' : '') +
          (cust && cust.email ? esc(cust.email) + '<br>' : '') +
          (cust && cust.vatNumber ? 'VAT no. ' + esc(cust.vatNumber) : '') +
        '</p></div>' +
        '<div><h4>Details</h4><p>' +
          'Invoice number: <strong>' + esc(sale.docNumber) + '</strong><br>' +
          'Date: ' + dateZA(sale.date) + '<br>' +
          'Payment terms: ' + esc(terms) + '<br>' +
          'Due: ' + dateZA(dueDate) + '<br>' +
          'Served by: ' + esc(sale.servedBy) +
        '</p></div>' +
      '</div>' +
      lineTable(sale.lines) +
      totalsBlock(subtotal) +
      '<div style="clear:both"></div>' +
      provenance(ids,
        'Paid by ' + esc(sale.paymentMethod) + '. Status: ' + esc(sale.status) + '. ' +
        'Banking details: ' + esc(biz().name) + ', please use <strong>' + esc(sale.docNumber) + '</strong> as your reference. ' +
        'Goods remain the property of ' + esc(biz().name) + ' until paid for in full.');
  }

  /* ---- Quotation --------------------------------------------------------
     Same data, different document. Worth pointing out in the pitch: the quote
     and the invoice are not two systems and not two spreadsheets. They are two
     views of the same records, which is exactly why they cannot disagree. */
  function quote(customerId, lines, opts) {
    opts = opts || {};
    var cust = window.Store.get('customers', customerId);
    var subtotal = lines.reduce(function (t, l) { return t + (l.qty || 0) * (l.unitPrice || 0); }, 0);
    var today = new Date().toISOString().slice(0, 10);
    var validUntil = addDays(today, opts.validDays || 14);
    var ref = opts.ref || ('QUO-' + Math.floor(Date.now() / 1000).toString().slice(-5));
    var ids = [customerId].concat(lines.map(function (l) { return l.productId; }));

    return letterhead('Quotation', ref) +
      '<div class="doc-meta">' +
        '<div><h4>Prepared for</h4><p><strong>' + esc(cust ? cust.name : '—') + '</strong><br>' +
          (cust && cust.phone && cust.phone !== '0000000000' ? esc(cust.phone) + '<br>' : '') +
          (cust && cust.email ? esc(cust.email) : '') + '</p></div>' +
        '<div><h4>Details</h4><p>Quote number: <strong>' + esc(ref) + '</strong><br>' +
          'Date: ' + dateZA(today) + '<br>' +
          'Valid until: <strong>' + dateZA(validUntil) + '</strong><br>' +
          'Prepared by: ' + esc(window.Store.user().name) + '</p></div>' +
      '</div>' +
      lineTable(lines) +
      totalsBlock(subtotal, { grandLabel: 'Total (incl. VAT)' }) +
      '<div style="clear:both"></div>' +
      provenance(ids,
        'Prices are valid until ' + dateZA(validUntil) + ' and are subject to stock availability at the time of ordering. ' +
        'This quotation is not a tax invoice.');
  }

  /* ---- Purchase order ---------------------------------------------------
     Built from the reorder analysis rather than from somebody walking the
     aisles with a clipboard. The quantities come from how fast each line
     actually sells and how long the supplier takes to deliver. */
  function purchaseOrder(supplierId) {
    var sup = window.Store.get('suppliers', supplierId);
    if (!sup) return '<p>Supplier not found.</p>';
    var rows = window.Analytics.reorderList().filter(function (r) {
      var p = window.Store.get('products', r.productId);
      return p && p.supplierId === supplierId && r.suggestedOrder > 0;
    });
    if (!rows.length) return letterhead('Purchase Order', sup.name) +
      '<p style="margin-top:2rem">Nothing from this supplier needs ordering at the moment. Every line is above its reorder level with enough cover for the ' + sup.leadTimeDays + '-day lead time.</p>';

    var today = new Date().toISOString().slice(0, 10);
    var ref = 'PO-' + today.replace(/-/g, '') + '-' + supplierId.slice(-3);
    var subtotal = rows.reduce(function (t, r) { return t + r.orderValue; }, 0);

    var body = rows.map(function (r) {
      var p = window.Store.get('products', r.productId);
      return '<tr>' +
        '<td><code>' + esc(r.sku) + '</code></td>' +
        '<td>' + esc(r.name) + '</td>' +
        '<td class="num">' + r.onHand + '</td>' +
        '<td class="num">' + r.soldPerDay.toFixed(2) + '</td>' +
        '<td class="num"><strong>' + r.suggestedOrder + '</strong></td>' +
        '<td class="num">' + rand(p.costPrice) + '</td>' +
        '<td class="num">' + rand(r.orderValue) + '</td></tr>';
    }).join('');

    return letterhead('Purchase Order', ref) +
      '<div class="doc-meta">' +
        '<div><h4>Supplier</h4><p><strong>' + esc(sup.name) + '</strong><br>' +
          (sup.contact ? esc(sup.contact) + '<br>' : '') + esc(sup.phone) +
          (sup.email ? '<br>' + esc(sup.email) : '') +
          (sup.accountNo ? '<br>Our account: ' + esc(sup.accountNo) : '') + '</p></div>' +
        '<div><h4>Details</h4><p>Order number: <strong>' + esc(ref) + '</strong><br>' +
          'Date: ' + dateZA(today) + '<br>' +
          'Lead time: ' + sup.leadTimeDays + ' days<br>' +
          'Expected: ' + dateZA(addDays(today, sup.leadTimeDays)) + '<br>' +
          'Raised by: ' + esc(window.Store.user().name) + '</p></div>' +
      '</div>' +
      '<div class="table-wrap" style="margin-top:1.5rem"><table><thead><tr>' +
        '<th>Code</th><th>Description</th><th class="num">On hand</th>' +
        '<th class="num">Sold/day</th><th class="num">Order</th>' +
        '<th class="num">Cost</th><th class="num">Value</th>' +
      '</tr></thead><tbody>' + body + '</tbody></table>' +
      '<caption>Order quantities cover the supplier\'s ' + sup.leadTimeDays + '-day lead time plus three weeks of trading, based on the last twelve months of actual sales.</caption></div>' +
      totalsBlock(subtotal, { grandLabel: 'Order total (incl. VAT)' }) +
      '<div style="clear:both"></div>' +
      (sup.minOrder && subtotal < sup.minOrder
        ? '<p style="color:#b06a00;font-weight:600;margin-top:1rem">Note: this order is below the supplier\'s minimum of ' + rand(sup.minOrder) + '.</p>' : '') +
      provenance([supplierId].concat(rows.map(function (r) { return r.productId; })));
  }

  /* ---- Customer statement ----------------------------------------------- */
  function statement(customerId) {
    var cust = window.Store.get('customers', customerId);
    if (!cust) return '<p>Customer not found.</p>';
    var sales = window.Store.all('sales')
      .filter(function (s) { return s.customerId === customerId; })
      .sort(function (a, b) { return a.date < b.date ? 1 : -1; })
      .slice(0, 40);

    var outstanding = sales.filter(function (s) { return s.status === 'Unpaid'; })
      .reduce(function (t, s) { return t + (s.total || 0); }, 0);

    var asOf = window.LHH_SEED.meta.asOfDate;
    var buckets = { current:0, d30:0, d60:0, d90:0 };
    sales.forEach(function (s) {
      if (s.status !== 'Unpaid') return;
      var age = Math.round((new Date(asOf) - new Date(s.date)) / 86400000);
      if (age <= 30) buckets.current += s.total;
      else if (age <= 60) buckets.d30 += s.total;
      else if (age <= 90) buckets.d60 += s.total;
      else buckets.d90 += s.total;
    });

    var body = sales.map(function (s) {
      return '<tr>' +
        '<td>' + dateZA(s.date) + '</td>' +
        '<td><code>' + esc(s.docNumber) + '</code></td>' +
        '<td>' + esc(s.paymentMethod) + '</td>' +
        '<td>' + (s.status === 'Unpaid'
            ? '<span class="badge badge--bad">Unpaid</span>'
            : '<span class="badge badge--ok">Paid</span>') + '</td>' +
        '<td class="num">' + rand(s.total) + '</td></tr>';
    }).join('');

    return letterhead('Customer Statement', 'As at ' + dateZA(asOf)) +
      '<div class="doc-meta">' +
        '<div><h4>Account</h4><p><strong>' + esc(cust.name) + '</strong><br>' +
          esc(cust.id) + '<br>' +
          'Terms: ' + esc(cust.creditTerms) + '<br>' +
          'Credit limit: ' + rand(cust.creditLimit || 0) + '</p></div>' +
        '<div><h4>Ageing</h4><p>' +
          'Current: ' + rand(buckets.current) + '<br>' +
          '30 days: ' + rand(buckets.d30) + '<br>' +
          '60 days: ' + rand(buckets.d60) + '<br>' +
          '90+ days: <strong style="color:#9b2423">' + rand(buckets.d90) + '</strong></p></div>' +
      '</div>' +
      '<div class="table-wrap" style="margin-top:1.5rem"><table>' +
        '<thead><tr><th>Date</th><th>Document</th><th>Method</th><th>Status</th><th class="num">Amount</th></tr></thead>' +
        '<tbody>' + body + '</tbody></table>' +
        '<caption>Most recent ' + sales.length + ' transactions.</caption></div>' +
      '<div class="doc-total"><table>' +
        '<tr class="grand"><td>Total outstanding</td><td class="num">' + rand(outstanding) + '</td></tr>' +
      '</table></div><div style="clear:both"></div>' +
      provenance([customerId].concat(sales.map(function (s) { return s.id; })).slice(0, 12).concat(sales.length > 11 ? ['…'] : []));
  }

  /* ---- Stock take sheet -------------------------------------------------
     A counting sheet, printed from the system, with the book figure
     deliberately LEFT OFF. If the counter can see what the system thinks the
     number is, the count tends to agree with it — which defeats the purpose
     of counting. Small design decisions like this are what "adapting the
     system to the business" actually means in practice. */
  function stockTakeSheet(category) {
    var products = window.Store.all('products')
      .filter(function (p) { return !category || p.category === category; })
      .sort(function (a, b) { return (a.location || '') < (b.location || '') ? -1 : 1; });

    var body = products.map(function (p) {
      return '<tr>' +
        '<td>' + esc(p.location || '—') + '</td>' +
        '<td><code>' + esc(p.sku) + '</code></td>' +
        '<td>' + esc(p.name) + '</td>' +
        '<td>' + esc(p.unit) + '</td>' +
        '<td style="width:5.5rem;border-left:1px solid #c3cfda">&nbsp;</td>' +
        '<td style="width:7rem;border-left:1px solid #c3cfda">&nbsp;</td></tr>';
    }).join('');

    return letterhead('Stock Take Sheet', category ? category : 'All categories') +
      '<div class="doc-meta">' +
        '<div><h4>Instructions</h4><p>Count what is physically on the shelf. ' +
          'Write the number in the Counted column. If anything looks damaged or ' +
          'mispriced, note it. Do not guess — leave it blank and flag it.</p></div>' +
        '<div><h4>Details</h4><p>Date: ' + dateZA(new Date().toISOString()) + '<br>' +
          'Counted by: ______________________<br>' +
          'Checked by: ______________________<br>' +
          'Lines: ' + products.length + '</p></div>' +
      '</div>' +
      '<div class="table-wrap" style="margin-top:1.5rem"><table>' +
        '<thead><tr><th>Location</th><th>Code</th><th>Description</th><th>Unit</th>' +
        '<th>Counted</th><th>Notes</th></tr></thead><tbody>' + body + '</tbody></table>' +
        '<caption>The system\'s figure is deliberately not printed on this sheet. If the counter can see the expected number, the count tends to agree with it, and a stock take that always agrees tells you nothing.</caption></div>' +
      provenance(products.slice(0, 8).map(function (p) { return p.id; }).concat(products.length > 8 ? ['…'] : []));
  }

  /* ---- POPIA data subject access report ---------------------------------
     POPIA s.23 gives a person the right to ask what personal information an
     organisation holds about them. A shop running on spreadsheets genuinely
     cannot answer that question — the information is spread across a till
     book, a WhatsApp group, an exercise book and three versions of a file.
     Because every record here is linked, the answer is one function call.
     This document is the clearest single demonstration of why structure and
     privacy compliance are the same problem. */
  function popiaReport(customerId) {
    var cust = window.Store.get('customers', customerId);
    if (!cust) return '<p>Customer not found.</p>';
    var sales = window.Store.all('sales').filter(function (s) { return s.customerId === customerId; });
    var b = biz();

    var fieldRows = Object.keys(cust).filter(function (k) { return k !== '_meta' && k !== 'weight'; })
      .map(function (k) {
        var v = cust[k];
        if (Array.isArray(v)) v = v.join(', ');
        if (v === '' || v === null || v === undefined) v = '—';
        return '<tr><td>' + esc(k) + '</td><td>' + esc(v) + '</td></tr>';
      }).join('');

    return letterhead('Record of Personal Information Held', 'POPIA section 23 — data subject access')
      + '<div class="doc-meta">' +
        '<div><h4>Data subject</h4><p><strong>' + esc(cust.name) + '</strong><br>Record ' + esc(cust.id) + '</p></div>' +
        '<div><h4>Responsible party</h4><p><strong>' + esc(b.name) + '</strong><br>' +
          'Information Officer: ' + esc(b.informationOfficer || '—') + '<br>' +
          'Reg. ' + esc(b.regNumber || '') + '</p></div>' +
      '</div>' +

      '<h3 style="margin-top:2rem;font-size:1.1rem">1. Information we hold about you</h3>' +
      '<div class="table-wrap"><table><thead><tr><th>Field</th><th>Value held</th></tr></thead><tbody>' + fieldRows + '</tbody></table></div>' +

      '<h3 style="margin-top:1.75rem;font-size:1.1rem">2. Why we hold it</h3>' +
      '<ul>' + ((cust.popiaPurpose || []).length
        ? cust.popiaPurpose.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('')
        : '<li style="color:#9b2423"><strong>No purpose was recorded. This is itself a failure to comply with section 13.</strong></li>') + '</ul>' +

      '<h3 style="margin-top:1.75rem;font-size:1.1rem">3. Marketing</h3>' +
      '<p>' + (cust.popiaConsentMarketing
        ? 'You consented to receive marketing' + (cust.popiaConsentDate ? ' on ' + dateZA(cust.popiaConsentDate) : ', but <strong style="color:#9b2423">no date of consent was recorded</strong>') + '. You may withdraw this consent at any time.'
        : 'You have not consented to marketing, and we do not send you any.') + '</p>' +

      '<h3 style="margin-top:1.75rem;font-size:1.1rem">4. How long we keep it</h3>' +
      '<p>' + (cust.popiaRetentionUntil
        ? 'This record is scheduled for deletion on ' + dateZA(cust.popiaRetentionUntil) + '.'
        : '<strong style="color:#9b2423">No retention date is set.</strong> Section 14 requires that personal information not be kept longer than necessary.') + '</p>' +

      '<h3 style="margin-top:1.75rem;font-size:1.1rem">5. Transaction history linked to this record</h3>' +
      '<p>' + sales.length + ' transaction' + (sales.length === 1 ? '' : 's') + ' are linked to your record' +
      (sales.length ? ', between ' + dateZA(sales[0].date) + ' and ' + dateZA(sales[sales.length - 1].date) : '') + '. ' +
      'These are kept as business records for tax purposes.</p>' +

      '<h3 style="margin-top:1.75rem;font-size:1.1rem">6. Your rights</h3>' +
      '<ul>' +
        '<li>To ask us to correct anything above that is wrong (section 24).</li>' +
        '<li>To ask us to delete information we no longer have a reason to hold (section 24).</li>' +
        '<li>To object to how we use your information (section 11(3)).</li>' +
        '<li>To complain to the Information Regulator of South Africa.</li>' +
      '</ul>' +

      provenance([cust.id].concat(sales.slice(0, 6).map(function (s) { return s.id; })),
        'This report was produced automatically from the shop\'s records. ' +
        'Record version ' + cust._meta.version + ', last changed ' + dateZA(cust._meta.modifiedAt) + ' by ' + esc(cust._meta.modifiedBy) + '.');
  }

  /* ---- Printing / download ---------------------------------------------- */
  function printNode(html, title) {
    var w = window.open('', '_blank');
    if (!w) { alert('Your browser blocked the print window. Allow pop-ups for this page and try again.'); return; }

    /* The new window starts at about:blank, so a relative stylesheet path has
       nothing to resolve against — which breaks the printed layout when the
       site is opened straight from a folder rather than served. Take the
       absolute URL from the stylesheet this page already loaded. */
    var cssHref = '';
    var link = document.querySelector('link[rel="stylesheet"]');
    if (link) cssHref = link.href;

    w.document.write(
      '<!doctype html><html lang="en-ZA"><head><meta charset="utf-8">' +
      '<title>' + esc(title || 'Document') + '</title>' +
      (cssHref ? '<link rel="stylesheet" href="' + esc(cssHref) + '">' : '') +
      '</head><body style="padding:2rem;background:#fff">' +
      '<div class="doc-preview" style="box-shadow:none;border:0;padding:0">' + html + '</div>' +
      '<script>window.onload=function(){setTimeout(function(){window.print();},350);};<\/script>' +
      '</body></html>');
    w.document.close();
  }

  return {
    invoice: invoice,
    quote: quote,
    purchaseOrder: purchaseOrder,
    statement: statement,
    stockTakeSheet: stockTakeSheet,
    popiaReport: popiaReport,
    print: printNode,
    helpers: { esc: esc, rand: rand, dateZA: dateZA, letterhead: letterhead, provenance: provenance }
  };
}());
