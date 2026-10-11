/* ==========================================================================
   analytics.js — turning the records into information
   --------------------------------------------------------------------------
   Nothing in this file collects new data. Every figure on the dashboard is
   derived from records that were already captured for an ordinary operational
   reason — ringing up a sale, booking in a delivery. That is the whole
   argument for structured capture: analysis becomes a by-product of trading
   rather than a separate job somebody has to find time for.

   Charts are drawn as inline SVG by hand. No charting library, so the resource
   has no dependencies and works offline on any machine.
   ========================================================================== */

window.Analytics = (function () {
  'use strict';

  var VAT = 0.15;
  var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  /* ---- Formatting ------------------------------------------------------- */
  function rand(n, dp) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    return 'R' + Number(n).toLocaleString('en-ZA', {
      minimumFractionDigits: dp === undefined ? 2 : dp,
      maximumFractionDigits: dp === undefined ? 2 : dp
    });
  }
  function randShort(n) {
    if (Math.abs(n) >= 1e6) return 'R' + (n / 1e6).toFixed(1) + 'm';
    if (Math.abs(n) >= 1e3) return 'R' + Math.round(n / 1e3) + 'k';
    return 'R' + Math.round(n);
  }
  function pct(n, dp) { return (n * 100).toFixed(dp === undefined ? 1 : dp) + '%'; }
  function monthLabel(key) {
    var p = key.split('-');
    return MONTHS[parseInt(p[1], 10) - 1] + " '" + p[0].slice(2);
  }

  /* ---- Core aggregations ------------------------------------------------ */

  function lineRevenue(l) { return (l.qty || 0) * (l.unitPrice || 0); }
  function lineCost(l)    { return (l.qty || 0) * (l.unitCost  || 0); }

  function salesInRange(from, to) {
    return window.Store.all('sales').filter(function (s) {
      if (s.status === 'Credited') return false;
      if (from && s.date < from) return false;
      if (to && s.date > to) return false;
      return true;
    });
  }

  /* Revenue, cost of sales and gross profit, per calendar month. */
  function monthly(from, to) {
    var map = {};
    salesInRange(from, to).forEach(function (s) {
      var k = s.date.slice(0, 7);
      if (!map[k]) map[k] = { key:k, label:monthLabel(k), revenue:0, cost:0, transactions:0, units:0 };
      map[k].transactions++;
      s.lines.forEach(function (l) {
        map[k].revenue += lineRevenue(l);
        map[k].cost    += lineCost(l);
        map[k].units   += l.qty || 0;
      });
    });
    return Object.keys(map).sort().map(function (k) {
      var m = map[k];
      m.grossProfit = m.revenue - m.cost;
      m.marginPct = m.revenue ? m.grossProfit / m.revenue : 0;
      m.avgBasket = m.transactions ? m.revenue / m.transactions : 0;
      return m;
    });
  }

  /* Which products actually make the money — not which ones sell the most
     units. A small shop that only looks at unit volume ends up protecting its
     cheapest lines and neglecting the ones carrying the business. */
  function productPerformance(from, to) {
    var map = {};
    salesInRange(from, to).forEach(function (s) {
      s.lines.forEach(function (l) {
        var p = window.Store.get('products', l.productId);
        if (!map[l.productId]) map[l.productId] = {
          productId: l.productId,
          sku: l.sku,
          name: l.description,
          category: p ? p.category : 'Unknown',
          units: 0, revenue: 0, cost: 0, transactions: 0
        };
        var m = map[l.productId];
        m.units += l.qty || 0;
        m.revenue += lineRevenue(l);
        m.cost += lineCost(l);
        m.transactions++;
      });
    });
    return Object.keys(map).map(function (k) {
      var m = map[k];
      m.grossProfit = m.revenue - m.cost;
      m.marginPct = m.revenue ? m.grossProfit / m.revenue : 0;
      return m;
    }).sort(function (a, b) { return b.grossProfit - a.grossProfit; });
  }

  function categoryMix(from, to) {
    var map = {};
    productPerformance(from, to).forEach(function (p) {
      if (!map[p.category]) map[p.category] = { category:p.category, revenue:0, grossProfit:0, units:0 };
      map[p.category].revenue += p.revenue;
      map[p.category].grossProfit += p.grossProfit;
      map[p.category].units += p.units;
    });
    var total = Object.keys(map).reduce(function (t, k) { return t + map[k].revenue; }, 0);
    return Object.keys(map).map(function (k) {
      map[k].share = total ? map[k].revenue / total : 0;
      return map[k];
    }).sort(function (a, b) { return b.revenue - a.revenue; });
  }

  /* Customer concentration. The question behind it is a risk question: how
     much of this shop's turnover walks out of the door if one contractor
     stops buying? */
  function customerValue(from, to) {
    var map = {};
    salesInRange(from, to).forEach(function (s) {
      var c = window.Store.get('customers', s.customerId);
      if (!map[s.customerId]) map[s.customerId] = {
        customerId: s.customerId,
        name: c ? c.name : '(deleted customer)',
        type: c ? c.type : '—',
        revenue: 0, cost: 0, visits: 0, lastVisit: '', outstanding: 0
      };
      var m = map[s.customerId];
      m.visits++;
      if (s.date > m.lastVisit) m.lastVisit = s.date;
      if (s.status === 'Unpaid') m.outstanding += s.total || 0;
      s.lines.forEach(function (l) { m.revenue += lineRevenue(l); m.cost += lineCost(l); });
    });
    var rows = Object.keys(map).map(function (k) {
      var m = map[k];
      m.grossProfit = m.revenue - m.cost;
      m.avgBasket = m.visits ? m.revenue / m.visits : 0;
      return m;
    }).sort(function (a, b) { return b.revenue - a.revenue; });

    var total = rows.reduce(function (t, r) { return t + r.revenue; }, 0);
    rows.forEach(function (r) { r.share = total ? r.revenue / total : 0; });
    return rows;
  }

  function paymentMix(from, to) {
    var map = {};
    salesInRange(from, to).forEach(function (s) {
      var total = s.lines.reduce(function (t, l) { return t + lineRevenue(l); }, 0);
      if (!map[s.paymentMethod]) map[s.paymentMethod] = { method:s.paymentMethod, revenue:0, count:0 };
      map[s.paymentMethod].revenue += total;
      map[s.paymentMethod].count++;
    });
    var total = Object.keys(map).reduce(function (t, k) { return t + map[k].revenue; }, 0);
    return Object.keys(map).map(function (k) {
      map[k].share = total ? map[k].revenue / total : 0;
      return map[k];
    }).sort(function (a, b) { return b.revenue - a.revenue; });
  }

  /* Day-of-week and hour patterns answer a staffing question, which is one of
     the few decisions a small shop can act on immediately and cheaply. */
  function weekdayPattern(from, to) {
    var names = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    var buckets = names.map(function (n) { return { day:n, revenue:0, transactions:0 }; });
    salesInRange(from, to).forEach(function (s) {
      var d = new Date(s.date + 'T00:00:00').getDay();
      var total = s.lines.reduce(function (t, l) { return t + lineRevenue(l); }, 0);
      buckets[d].revenue += total;
      buckets[d].transactions++;
    });
    buckets.forEach(function (b) { b.avgBasket = b.transactions ? b.revenue / b.transactions : 0; });
    return buckets;
  }

  /* ---- Stock intelligence ----------------------------------------------- */

  /* What needs ordering, and how urgently, based on how fast it actually
     sells rather than on a guess. */
  function reorderList() {
    var perf = productPerformance();
    var byId = {};
    perf.forEach(function (p) { byId[p.productId] = p; });

    var dates = window.Store.all('sales').map(function (s) { return s.date; }).sort();
    var days = dates.length ? Math.max(1, (new Date(dates[dates.length - 1]) - new Date(dates[0])) / 86400000) : 1;

    return window.Store.all('products').map(function (p) {
      var sold = byId[p.id] ? byId[p.id].units : 0;
      var perDay = sold / days;
      var onHand = window.Store.stockFor(p.id);
      var supplier = window.Store.get('suppliers', p.supplierId);
      var lead = supplier ? supplier.leadTimeDays : 7;
      var daysCover = perDay > 0 ? onHand / perDay : (onHand > 0 ? 999 : 0);
      var suggested = Math.max(0, Math.ceil((perDay * (lead + 21)) - onHand));

      var urgency = 'ok';
      if (onHand <= 0) urgency = 'out';
      else if (daysCover <= lead) urgency = 'critical';
      else if (onHand <= p.reorderLevel) urgency = 'low';

      return {
        productId: p.id, sku: p.sku, name: p.name, category: p.category,
        onHand: onHand, reorderLevel: p.reorderLevel,
        soldPerDay: perDay, daysCover: daysCover,
        supplier: supplier ? supplier.name : '—', leadTimeDays: lead,
        suggestedOrder: suggested,
        orderValue: suggested * p.costPrice,
        urgency: urgency
      };
    }).sort(function (a, b) {
      var rank = { out:0, critical:1, low:2, ok:3 };
      if (rank[a.urgency] !== rank[b.urgency]) return rank[a.urgency] - rank[b.urgency];
      return a.daysCover - b.daysCover;
    });
  }

  /* Money sitting on the shelf doing nothing. The figure that usually gets a
     small-business owner's attention faster than any other. */
  function deadStock(dayThreshold) {
    dayThreshold = dayThreshold || 120;
    var perf = {};
    productPerformance().forEach(function (p) { perf[p.productId] = p; });
    return window.Store.all('products').map(function (p) {
      var m = perf[p.id];
      var onHand = window.Store.stockFor(p.id);
      return {
        productId: p.id, sku: p.sku, name: p.name, category: p.category,
        onHand: onHand,
        tiedUp: onHand * p.costPrice,
        unitsSold: m ? m.units : 0,
        lastSold: m ? 'in period' : 'not in the last year'
      };
    }).filter(function (r) { return r.unitsSold === 0 && r.onHand > 0; })
      .sort(function (a, b) { return b.tiedUp - a.tiedUp; });
  }

  function shrinkage() {
    var out = { total: 0, byReason: {}, rows: [] };
    window.Store.all('stockMovements').forEach(function (m) {
      if (m.reason !== 'Damage / write-off' && m.reason !== 'Stock take adjustment') return;
      var p = window.Store.get('products', m.productId);
      if (!p) return;
      var value = Math.abs(m.qty) * p.costPrice;
      if (m.qty >= 0) return;
      out.total += value;
      out.byReason[m.reason] = (out.byReason[m.reason] || 0) + value;
      out.rows.push({
        id: m.id, date: m.date, product: p.name, qty: m.qty,
        reason: m.reason, reference: m.reference || '(no explanation recorded)',
        value: value, by: m.by
      });
    });
    out.rows.sort(function (a, b) { return b.value - a.value; });
    return out;
  }

  function stockValuation() {
    var total = 0, byCategory = {};
    window.Store.all('products').forEach(function (p) {
      var v = window.Store.stockFor(p.id) * p.costPrice;
      total += v;
      byCategory[p.category] = (byCategory[p.category] || 0) + v;
    });
    return { total: total, byCategory: byCategory };
  }

  /* ---- Credit control --------------------------------------------------- */
  function debtors() {
    var map = {};
    window.Store.all('sales').forEach(function (s) {
      if (s.status !== 'Unpaid') return;
      var c = window.Store.get('customers', s.customerId);
      if (!map[s.customerId]) map[s.customerId] = {
        customerId: s.customerId,
        name: c ? c.name : '(unknown)',
        terms: c ? c.creditTerms : '—',
        limit: c ? (c.creditLimit || 0) : 0,
        outstanding: 0, invoices: 0, oldest: '', buckets: { current:0, d30:0, d60:0, d90:0 }
      };
      var m = map[s.customerId];
      var total = s.total || 0;
      m.outstanding += total;
      m.invoices++;
      if (!m.oldest || s.date < m.oldest) m.oldest = s.date;
      var age = Math.round((new Date(window.LHH_SEED.meta.asOfDate) - new Date(s.date)) / 86400000);
      if (age <= 30) m.buckets.current += total;
      else if (age <= 60) m.buckets.d30 += total;
      else if (age <= 90) m.buckets.d60 += total;
      else m.buckets.d90 += total;
    });
    return Object.keys(map).map(function (k) {
      var m = map[k];
      m.overLimit = m.limit > 0 && m.outstanding > m.limit;
      return m;
    }).sort(function (a, b) { return b.outstanding - a.outstanding; });
  }

  /* ---- Headline figures ------------------------------------------------- */
  /* Comparing a part-finished month against a finished one always reads as a
     collapse in trade. Eleven days of October are not a bad October. This
     compares the same number of days in each month, which is the comparison
     the owner actually meant to make. */
  function monthToDate(asOf) {
    var day = parseInt(asOf.slice(8, 10), 10);
    var thisMonth = asOf.slice(0, 7);
    var d = new Date(asOf + 'T00:00:00');
    d.setMonth(d.getMonth() - 1);
    var prevMonth = d.toISOString().slice(0, 7);

    function sum(monthKey) {
      var rev = 0, cost = 0, tx = 0;
      salesInRange().forEach(function (s) {
        if (s.date.slice(0, 7) !== monthKey) return;
        if (parseInt(s.date.slice(8, 10), 10) > day) return;
        tx++;
        s.lines.forEach(function (l) { rev += lineRevenue(l); cost += lineCost(l); });
      });
      return { revenue: rev, cost: cost, transactions: tx };
    }

    var a = sum(thisMonth), b = sum(prevMonth);
    return {
      days: day,
      current: a,
      previous: b,
      change: b.revenue ? (a.revenue - b.revenue) / b.revenue : 0
    };
  }

  function summary() {
    var months = monthly();
    var last = months[months.length - 1] || { revenue:0, grossProfit:0, transactions:0, marginPct:0 };
    var prev = months[months.length - 2] || { revenue:0, grossProfit:0, transactions:0 };
    var mtd = monthToDate(window.LHH_SEED.meta.asOfDate);
    var year = months.reduce(function (acc, m) {
      acc.revenue += m.revenue; acc.cost += m.cost; acc.transactions += m.transactions;
      return acc;
    }, { revenue:0, cost:0, transactions:0 });
    year.grossProfit = year.revenue - year.cost;
    year.marginPct = year.revenue ? year.grossProfit / year.revenue : 0;

    var reorder = reorderList();
    var dead = deadStock();
    var owed = debtors();

    return {
      months: months,
      currentMonth: last,
      previousMonth: prev,
      monthToDate: mtd,
      revenueChange: mtd.change,
      year: year,
      avgBasket: year.transactions ? year.revenue / year.transactions : 0,
      stockValue: stockValuation().total,
      needsOrdering: reorder.filter(function (r) { return r.urgency !== 'ok'; }).length,
      outOfStock: reorder.filter(function (r) { return r.urgency === 'out'; }).length,
      deadStockValue: dead.reduce(function (t, d) { return t + d.tiedUp; }, 0),
      deadStockCount: dead.length,
      outstanding: owed.reduce(function (t, d) { return t + d.outstanding; }, 0),
      debtorCount: owed.length,
      shrinkageValue: shrinkage().total,
      topCustomerShare: (customerValue()[0] || { share: 0 }).share
    };
  }

  /* ======================================================================
     Chart drawing — hand-built inline SVG
     ====================================================================== */

  var PALETTE = ['#128079', '#5a4b9c', '#d98500', '#2a8a52', '#c0342f', '#4d6479', '#7fc9c4', '#b06a00'];

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[c];
    });
  }

  /* Combined column + line: revenue per month with gross margin over it.
     Two series on one chart because the question a shop owner asks is not
     "what did we sell" but "did selling more actually leave us better off". */
  function barLineChart(data, opts) {
    opts = opts || {};
    var W = 760, H = 300, pad = { t:16, r:52, b:38, l:62 };
    var iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    if (!data.length) return '<p class="muted">No data for this period.</p>';

    var maxBar = Math.max.apply(null, data.map(function (d) { return d.revenue; })) * 1.12 || 1;
    var bw = iw / data.length;
    var barW = Math.min(44, bw * 0.6);

    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opts.alt || 'Monthly revenue and gross margin') + '">';

    /* Gridlines and left axis (rands). */
    for (var g = 0; g <= 4; g++) {
      var y = pad.t + ih - (ih * g / 4);
      var v = maxBar * g / 4;
      s += '<line x1="' + pad.l + '" y1="' + y.toFixed(1) + '" x2="' + (pad.l + iw) + '" y2="' + y.toFixed(1) + '" stroke="#e0e7ed" stroke-width="1"/>';
      s += '<text x="' + (pad.l - 8) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end" font-size="10" fill="#6b8299">' + randShort(v) + '</text>';
    }

    /* Right axis (margin %). */
    for (var g2 = 0; g2 <= 4; g2++) {
      var y2 = pad.t + ih - (ih * g2 / 4);
      s += '<text x="' + (pad.l + iw + 8) + '" y="' + (y2 + 4).toFixed(1) + '" text-anchor="start" font-size="10" fill="#5a4b9c">' + (g2 * 12.5).toFixed(0) + '%</text>';
    }

    /* Columns. */
    data.forEach(function (d, i) {
      var x = pad.l + i * bw + (bw - barW) / 2;
      var h = (d.revenue / maxBar) * ih;
      var y = pad.t + ih - h;
      s += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + barW.toFixed(1) + '" height="' + Math.max(0, h).toFixed(1) + '" rx="3" fill="#128079" opacity="0.88">';
      s += '<title>' + esc(d.label) + ': ' + rand(d.revenue, 0) + ' revenue, ' + rand(d.grossProfit, 0) + ' gross profit (' + pct(d.marginPct) + ')</title></rect>';
      s += '<text x="' + (pad.l + i * bw + bw / 2).toFixed(1) + '" y="' + (H - 14) + '" text-anchor="middle" font-size="10" fill="#6b8299">' + esc(d.label) + '</text>';
    });

    /* Margin line, scaled 0–50%. */
    var pts = data.map(function (d, i) {
      var x = pad.l + i * bw + bw / 2;
      var y = pad.t + ih - (Math.min(d.marginPct, 0.5) / 0.5) * ih;
      return x.toFixed(1) + ',' + y.toFixed(1);
    });
    s += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="#5a4b9c" stroke-width="2.5" stroke-linejoin="round"/>';
    data.forEach(function (d, i) {
      var p = pts[i].split(',');
      s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3.5" fill="#fff" stroke="#5a4b9c" stroke-width="2"><title>' + esc(d.label) + ' margin: ' + pct(d.marginPct) + '</title></circle>';
    });

    s += '<line x1="' + pad.l + '" y1="' + (pad.t + ih) + '" x2="' + (pad.l + iw) + '" y2="' + (pad.t + ih) + '" stroke="#c3cfda"/>';
    s += '</svg>';
    return s;
  }

  /* Horizontal bars. Used wherever the labels are words rather than dates,
     which for a product list is almost always easier to read than columns. */
  function hBarChart(rows, opts) {
    opts = opts || {};
    var valueKey = opts.value || 'value';
    var labelKey = opts.label || 'label';
    if (!rows.length) return '<p class="muted">Nothing to show.</p>';
    var max = Math.max.apply(null, rows.map(function (r) { return r[valueKey]; })) || 1;
    var rowH = 30, labelW = opts.labelWidth || 220, W = 760;
    var H = rows.length * rowH + 10;
    var barArea = W - labelW - 90;

    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opts.alt || 'Chart') + '">';
    rows.forEach(function (r, i) {
      var y = i * rowH + 6;
      var w = (r[valueKey] / max) * barArea;
      var colour = opts.colourBy ? opts.colourBy(r, i) : PALETTE[i % PALETTE.length];
      var label = String(r[labelKey]);
      if (label.length > 34) label = label.slice(0, 32) + '…';
      s += '<text x="0" y="' + (y + 15) + '" font-size="11.5" fill="#35495a">' + esc(label) + '</text>';
      s += '<rect x="' + labelW + '" y="' + (y + 4) + '" width="' + barArea + '" height="16" rx="3" fill="#eef2f6"/>';
      s += '<rect x="' + labelW + '" y="' + (y + 4) + '" width="' + Math.max(1, w).toFixed(1) + '" height="16" rx="3" fill="' + colour + '"><title>' + esc(label) + ': ' + (opts.format ? opts.format(r[valueKey]) : rand(r[valueKey], 0)) + '</title></rect>';
      s += '<text x="' + (labelW + barArea + 8) + '" y="' + (y + 16) + '" font-size="11" fill="#4d6479" font-family="monospace">' + esc(opts.format ? opts.format(r[valueKey]) : rand(r[valueKey], 0)) + '</text>';
    });
    s += '</svg>';
    return s;
  }

  /* Donut. Used only for share-of-whole, and only with few slices — a pie with
     fifteen categories communicates nothing. */
  function donutChart(rows, opts) {
    opts = opts || {};
    var valueKey = opts.value || 'value';
    var labelKey = opts.label || 'label';
    var total = rows.reduce(function (t, r) { return t + r[valueKey]; }, 0);
    if (!total) return '<p class="muted">Nothing to show.</p>';

    var size = 230, cx = size / 2, cy = size / 2, rOut = 100, rIn = 62;
    var s = '<svg viewBox="0 0 ' + size + ' ' + size + '" style="max-width:230px;margin-inline:auto" role="img" aria-label="' + esc(opts.alt || 'Share chart') + '">';
    var angle = -Math.PI / 2;

    rows.forEach(function (r, i) {
      var frac = r[valueKey] / total;
      var sweep = frac * Math.PI * 2;
      var end = angle + sweep;
      var large = sweep > Math.PI ? 1 : 0;
      var x1 = cx + rOut * Math.cos(angle), y1 = cy + rOut * Math.sin(angle);
      var x2 = cx + rOut * Math.cos(end),   y2 = cy + rOut * Math.sin(end);
      var x3 = cx + rIn  * Math.cos(end),   y3 = cy + rIn  * Math.sin(end);
      var x4 = cx + rIn  * Math.cos(angle), y4 = cy + rIn  * Math.sin(angle);
      var d = 'M' + x1.toFixed(2) + ',' + y1.toFixed(2) +
              'A' + rOut + ',' + rOut + ' 0 ' + large + ' 1 ' + x2.toFixed(2) + ',' + y2.toFixed(2) +
              'L' + x3.toFixed(2) + ',' + y3.toFixed(2) +
              'A' + rIn + ',' + rIn + ' 0 ' + large + ' 0 ' + x4.toFixed(2) + ',' + y4.toFixed(2) + 'Z';
      s += '<path d="' + d + '" fill="' + PALETTE[i % PALETTE.length] + '" stroke="#fff" stroke-width="1.5">';
      s += '<title>' + esc(r[labelKey]) + ': ' + (opts.format ? opts.format(r[valueKey]) : rand(r[valueKey], 0)) + ' (' + pct(frac, 0) + ')</title></path>';
      angle = end;
    });

    if (opts.centreLabel) {
      s += '<text x="' + cx + '" y="' + (cy - 2) + '" text-anchor="middle" font-size="19" font-weight="700" fill="#16222b">' + esc(opts.centreLabel) + '</text>';
      s += '<text x="' + cx + '" y="' + (cy + 16) + '" text-anchor="middle" font-size="10" fill="#6b8299">' + esc(opts.centreSub || '') + '</text>';
    }
    s += '</svg>';
    return s;
  }

  function legend(rows, labelKey, formatFn, valueKey) {
    return '<div class="chart__legend">' + rows.map(function (r, i) {
      return '<span><span class="chart__swatch" style="background:' + PALETTE[i % PALETTE.length] + '"></span>' +
             esc(r[labelKey]) + (formatFn ? ' · ' + formatFn(r[valueKey || 'value']) : '') + '</span>';
    }).join('') + '</div>';
  }

  /* Sparkline for the stat tiles. */
  function sparkline(values, colour) {
    if (!values.length) return '';
    var W = 110, H = 28;
    var max = Math.max.apply(null, values), min = Math.min.apply(null, values);
    var range = (max - min) || 1;
    var pts = values.map(function (v, i) {
      return (i / (values.length - 1) * W).toFixed(1) + ',' + (H - ((v - min) / range) * (H - 4) - 2).toFixed(1);
    });
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:110px;height:28px" aria-hidden="true">' +
           '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + (colour || '#128079') + '" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></svg>';
  }

  return {
    rand: rand, randShort: randShort, pct: pct, monthLabel: monthLabel,
    VAT: VAT, PALETTE: PALETTE,
    monthly: monthly,
    monthToDate: monthToDate,
    productPerformance: productPerformance,
    categoryMix: categoryMix,
    customerValue: customerValue,
    paymentMix: paymentMix,
    weekdayPattern: weekdayPattern,
    reorderList: reorderList,
    deadStock: deadStock,
    shrinkage: shrinkage,
    stockValuation: stockValuation,
    debtors: debtors,
    summary: summary,
    charts: { barLine: barLineChart, hBar: hBarChart, donut: donutChart, legend: legend, sparkline: sparkline }
  };
}());
