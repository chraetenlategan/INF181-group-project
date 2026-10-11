/* ==========================================================================
   seed.js — the demonstration data set
   --------------------------------------------------------------------------
   This file plays the part of the shop's database. In a real deployment these
   records would live in a hosted database; here they live in one JavaScript
   file so that the whole resource runs from a folder, on any machine, with no
   installation and no internet connection.

   Master data (suppliers, products, customers, users) is written out record by
   record so you can read it. Transaction data (a year of sales and stock
   movements) is produced by a seeded generator at the bottom of the file: the
   same seed always produces the same transactions, so the dashboards show the
   same numbers every time the resource is demonstrated.

   Every record is wrapped by store.js in a _meta envelope. See data/schema.json.
   ========================================================================== */

window.LHH_SEED = (function () {
  'use strict';

  var VAT = 0.15;

  /* ---- Suppliers ------------------------------------------------------- */
  var suppliers = [
    { id:'SUP-001', name:'Mabopane Builders Supply', contact:'Johan Pretorius', phone:'0125550911', email:'orders@mabopanebuild.co.za', leadTimeDays:3,  minOrder:2500, accountNo:'MBS-4471' },
    { id:'SUP-002', name:'Tshwane Electrical Wholesale', contact:'Fatima Patel', phone:'0123457780', email:'sales@tewholesale.co.za', leadTimeDays:5,  minOrder:1500, accountNo:'TEW-0099' },
    { id:'SUP-003', name:'PaintPro Distributors',     contact:'Riaan Botha',    phone:'0119940120', email:'riaan@paintpro.co.za',     leadTimeDays:7,  minOrder:3000, accountNo:'PP-2210'  },
    { id:'SUP-004', name:'Gauteng Plumbing Direct',   contact:'Nomsa Khumalo',  phone:'0118820034', email:'nomsa@gpdirect.co.za',     leadTimeDays:4,  minOrder:1200, accountNo:'GPD-7781' },
    { id:'SUP-005', name:'Toolmart SA',               contact:'Deon Smit',      phone:'0124551290', email:'deon@toolmartsa.co.za',    leadTimeDays:10, minOrder:5000, accountNo:'TMS-3318' },
    { id:'SUP-006', name:'Soshanguve Garden & Home',  contact:'Precious Mahlangu', phone:'0125558842', email:'sgh.orders@gmail.com',  leadTimeDays:2,  minOrder:0,    accountNo:''         }
  ];

  /* ---- Products -------------------------------------------------------- */
  /* popularity: relative weight used by the transaction generator.          */
  var products = [
    { id:'PRD-001', sku:'PLB-0142', name:'Polycop pipe 20mm (per metre)',      category:'Plumbing',            unit:'metre', costPrice: 18.40, sellPrice: 29.90, stockOnHand:1800, reorderLevel:400, supplierId:'SUP-004', barcode:'6001234000142', location:'A1-03', popularity: 9 },
    { id:'PRD-002', sku:'PLB-0198', name:'Tap washer assorted (pack of 10)',   category:'Plumbing',            unit:'box',   costPrice: 11.20, sellPrice: 24.90, stockOnHand:  96, reorderLevel: 40, supplierId:'SUP-004', barcode:'6001234000198', location:'A1-07', popularity: 8 },
    { id:'PRD-003', sku:'PLB-0231', name:'Geyser element 3kW',                 category:'Plumbing',            unit:'each',  costPrice:218.00, sellPrice:379.00, stockOnHand:   8, reorderLevel: 10, supplierId:'SUP-004', barcode:'6001234000231', location:'A2-01', popularity: 4 },
    { id:'PRD-004', sku:'PLB-0276', name:'Toilet cistern mechanism',           category:'Plumbing',            unit:'each',  costPrice:142.50, sellPrice:239.00, stockOnHand:  22, reorderLevel: 12, supplierId:'SUP-004', barcode:'6001234000276', location:'A2-04', popularity: 5 },
    { id:'PRD-005', sku:'ELC-0310', name:'Surfix cable 2.5mm (per metre)',     category:'Electrical',          unit:'metre', costPrice: 23.80, sellPrice: 38.50, stockOnHand:2200, reorderLevel:600, supplierId:'SUP-002', barcode:'6001234000310', location:'B1-02', popularity:10 },
    { id:'PRD-006', sku:'ELC-0345', name:'Wall socket double 16A',             category:'Electrical',          unit:'each',  costPrice: 64.00, sellPrice:109.00, stockOnHand:  58, reorderLevel: 25, supplierId:'SUP-002', barcode:'6001234000345', location:'B1-05', popularity: 7 },
    { id:'PRD-007', sku:'ELC-0388', name:'Circuit breaker 20A single pole',    category:'Electrical',          unit:'each',  costPrice: 78.50, sellPrice:135.00, stockOnHand:  41, reorderLevel: 20, supplierId:'SUP-002', barcode:'6001234000388', location:'B1-09', popularity: 6 },
    { id:'PRD-008', sku:'ELC-0402', name:'LED globe 9W B22 (warm white)',      category:'Electrical',          unit:'each',  costPrice: 21.00, sellPrice: 44.90, stockOnHand: 900, reorderLevel:240, supplierId:'SUP-002', barcode:'6001234000402', location:'B2-01', popularity: 9 },
    { id:'PRD-009', sku:'ELC-0455', name:'Extension lead 10m heavy duty',      category:'Electrical',          unit:'each',  costPrice:168.00, sellPrice:279.00, stockOnHand:   9, reorderLevel: 10, supplierId:'SUP-002', barcode:'6001234000455', location:'B2-06', popularity: 5 },
    { id:'PRD-010', sku:'PNT-0501', name:'PVA interior white 20L',             category:'Paint & Finishes',    unit:'each',  costPrice:486.00, sellPrice:749.00, stockOnHand: 120, reorderLevel: 40, supplierId:'SUP-003', barcode:'6001234000501', location:'C1-01', popularity: 7 },
    { id:'PRD-011', sku:'PNT-0514', name:'Roof paint charcoal 5L',             category:'Paint & Finishes',    unit:'each',  costPrice:312.00, sellPrice:489.00, stockOnHand:   6, reorderLevel:  8, supplierId:'SUP-003', barcode:'6001234000514', location:'C1-04', popularity: 4 },
    { id:'PRD-012', sku:'PNT-0530', name:'Paint brush 75mm',                   category:'Paint & Finishes',    unit:'each',  costPrice: 29.90, sellPrice: 59.90, stockOnHand: 112, reorderLevel: 40, supplierId:'SUP-003', barcode:'6001234000530', location:'C1-08', popularity: 8 },
    { id:'PRD-013', sku:'PNT-0548', name:'Masking tape 48mm x 40m',            category:'Paint & Finishes',    unit:'roll',  costPrice: 18.60, sellPrice: 36.90, stockOnHand:  88, reorderLevel: 30, supplierId:'SUP-003', barcode:'6001234000548', location:'C1-09', popularity: 7 },
    { id:'PRD-014', sku:'TLS-0601', name:'Claw hammer 450g',                   category:'Tools',               unit:'each',  costPrice: 89.00, sellPrice:159.00, stockOnHand:  34, reorderLevel: 15, supplierId:'SUP-005', barcode:'6001234000601', location:'D1-02', popularity: 6 },
    { id:'PRD-015', sku:'TLS-0634', name:'Angle grinder 115mm 750W',           category:'Tools',               unit:'each',  costPrice:742.00, sellPrice:1149.00,stockOnHand:   4, reorderLevel:  5, supplierId:'SUP-005', barcode:'6001234000634', location:'D1-06', popularity: 3 },
    { id:'PRD-016', sku:'TLS-0659', name:'Tape measure 5m',                    category:'Tools',               unit:'each',  costPrice: 42.00, sellPrice: 84.90, stockOnHand:  67, reorderLevel: 25, supplierId:'SUP-005', barcode:'6001234000659', location:'D1-09', popularity: 8 },
    { id:'PRD-017', sku:'TLS-0677', name:'Drill bit set 13 piece HSS',         category:'Tools',               unit:'box',   costPrice:134.00, sellPrice:229.00, stockOnHand:  21, reorderLevel: 10, supplierId:'SUP-005', barcode:'6001234000677', location:'D2-01', popularity: 5 },
    { id:'PRD-018', sku:'BLD-0702', name:'Cement 50kg (PPC)',                  category:'Building Materials',  unit:'bag',   costPrice:108.00, sellPrice:149.00, stockOnHand: 900, reorderLevel:260, supplierId:'SUP-001', barcode:'6001234000702', location:'Yard-1', popularity:10 },
    { id:'PRD-019', sku:'BLD-0718', name:'Building sand (per bag)',            category:'Building Materials',  unit:'bag',   costPrice: 38.00, sellPrice: 65.00, stockOnHand:1200, reorderLevel:340, supplierId:'SUP-001', barcode:'6001234000718', location:'Yard-2', popularity: 9 },
    { id:'PRD-020', sku:'BLD-0744', name:'Face brick standard (each)',         category:'Building Materials',  unit:'each',  costPrice:  4.20, sellPrice:  7.50, stockOnHand:12000,reorderLevel:3200,supplierId:'SUP-001', barcode:'6001234000744', location:'Yard-3', popularity: 6 },
    { id:'PRD-021', sku:'BLD-0761', name:'Roof sheeting IBR 3m',               category:'Building Materials',  unit:'each',  costPrice:289.00, sellPrice:449.00, stockOnHand:  16, reorderLevel: 20, supplierId:'SUP-001', barcode:'6001234000761', location:'Yard-4', popularity: 4 },
    { id:'PRD-022', sku:'HWF-0801', name:'Wood screws 4x40mm (box of 200)',    category:'Hardware & Fasteners',unit:'box',   costPrice: 54.00, sellPrice: 99.90, stockOnHand: 300, reorderLevel:100, supplierId:'SUP-001', barcode:'6001234000801', location:'E1-01', popularity: 8 },
    { id:'PRD-023', sku:'HWF-0829', name:'Padlock 50mm brass',                 category:'Hardware & Fasteners',unit:'each',  costPrice: 68.00, sellPrice:124.00, stockOnHand:  43, reorderLevel: 20, supplierId:'SUP-001', barcode:'6001234000829', location:'E1-05', popularity: 6 },
    { id:'PRD-024', sku:'HWF-0855', name:'Door hinge 100mm (pair)',            category:'Hardware & Fasteners',unit:'box',   costPrice: 46.50, sellPrice: 89.00, stockOnHand:  52, reorderLevel: 20, supplierId:'SUP-001', barcode:'6001234000855', location:'E1-07', popularity: 5 },
    { id:'PRD-025', sku:'GDN-0901', name:'Garden hose 20m',                    category:'Garden',              unit:'each',  costPrice:198.00, sellPrice:329.00, stockOnHand:   7, reorderLevel:  8, supplierId:'SUP-006', barcode:'6001234000901', location:'F1-01', popularity: 4 },
    { id:'PRD-026', sku:'GDN-0922', name:'Potting soil 30dm3',                 category:'Garden',              unit:'bag',   costPrice: 42.00, sellPrice: 79.90, stockOnHand:  64, reorderLevel: 25, supplierId:'SUP-006', barcode:'6001234000922', location:'F1-03', popularity: 5 },
    { id:'PRD-027', sku:'GDN-0948', name:'Garden spade',                       category:'Garden',              unit:'each',  costPrice:118.00, sellPrice:199.00, stockOnHand:  23, reorderLevel: 10, supplierId:'SUP-006', barcode:'6001234000948', location:'F1-06', popularity: 3 },
    { id:'PRD-028', sku:'HOM-1001', name:'Handy Andy all-purpose 750ml',       category:'Home & Cleaning',     unit:'each',  costPrice: 24.50, sellPrice: 42.90, stockOnHand:  91, reorderLevel: 35, supplierId:'SUP-006', barcode:'6001234001001', location:'G1-02', popularity: 7 },
    { id:'PRD-029', sku:'HOM-1024', name:'Mop and bucket set',                 category:'Home & Cleaning',     unit:'each',  costPrice: 86.00, sellPrice:149.00, stockOnHand:  28, reorderLevel: 12, supplierId:'SUP-006', barcode:'6001234001024', location:'G1-05', popularity: 4 },
    { id:'PRD-030', sku:'HOM-1047', name:'Refuse bags 50 micron (roll of 20)', category:'Home & Cleaning',     unit:'roll',  costPrice: 38.90, sellPrice: 69.90, stockOnHand: 103, reorderLevel: 40, supplierId:'SUP-006', barcode:'6001234001047', location:'G1-07', popularity: 8 },

    /* -- Deliberately imperfect records. These are used on the Information --
       -- Quality page to show what bad data actually looks like in a real  --
       -- shop, and what the validation rules catch.                        -- */
    { id:'PRD-031', sku:'TLS-0690', name:'Screwdriver set 6 piece',            category:'Tools',               unit:'each',  costPrice:112.00, sellPrice:109.00, stockOnHand:  12, reorderLevel:  6, supplierId:'SUP-005', barcode:'', location:'D2-04', popularity: 0.0001,
      _flaw:'Selling price is below cost price. Nobody noticed because the spreadsheet had no rule to check it.' },
    { id:'PRD-032', sku:'PNT-0577', name:'Varnish clear 1L',                   category:'Paint & Finishes',    unit:'each',  costPrice:186.00, sellPrice:199.00, stockOnHand:   4, reorderLevel: 10, supplierId:'SUP-003', barcode:'6001234000577', location:'C2-02', popularity: 0.0001,
      _flaw:'Margin of 7%. Below the 10% threshold the shop says it works on, and already below reorder level.' },
    { id:'PRD-034', sku:'GDN-0975', name:'Pool chlorine granules 5kg',          category:'Garden',              unit:'each',  costPrice:289.00, sellPrice:449.00, stockOnHand:  40, reorderLevel: 10, supplierId:'SUP-006', barcode:'6001234000975', location:'F2-04', popularity: 0.0001,
      _flaw:'Forty units bought on a rep\'s special two years ago. Not one has sold — very few households in this area have a pool. R11 560 of the owner\'s money has been sitting on that shelf ever since, and no spreadsheet has ever mentioned it.' },
    { id:'PRD-035', sku:'TLS-0712', name:'Cordless drill 18V combo kit',         category:'Tools',               unit:'each',  costPrice:1450.00,sellPrice:2199.00,stockOnHand:   7, reorderLevel:  3, supplierId:'SUP-005', barcode:'6001234000712', location:'D2-08', popularity: 0.0001,
      _flaw:'Priced above what walk-in customers in this market will pay, and the contractors already own one. Seven units, R10 150 tied up, nothing sold in twelve months.' },

    { id:'PRD-033', sku:'GDN-0960', name:'Lawn fertiliser 5kg',                category:'Garden',              unit:'bag',   costPrice: 94.00, sellPrice:169.00, stockOnHand:   0, reorderLevel: 15, supplierId:'SUP-006', barcode:'6001234000960', location:'F2-01', popularity: 0.0001,
      _flaw:'Out of stock and under reorder level. In the spreadsheet world this is only discovered when a customer asks for it.' }
  ];

  /* ---- Customers ------------------------------------------------------- */
  /* POPIA note: these are invented people. The consent, purpose and          */
  /* retention fields are the point — see pages/ethics-privacy.html.          */
  var customers = [
    { id:'CUS-001', name:'Walk-in customer', type:'Walk-in', phone:'0000000000', email:'', vatNumber:'', creditTerms:'Cash only', creditLimit:0,
      popiaPurpose:['Fulfil the sale'], popiaConsentMarketing:false, popiaConsentDate:'', popiaRetentionUntil:'',
      notes:'Generic record used when the customer does not want to give details. Holding no personal information at all is always POPIA-compliant.', weight:40 },
    { id:'CUS-002', name:'Thandi Mabaso',        type:'Account',    phone:'0824471092', email:'thandi.mabaso@gmail.com', vatNumber:'', creditTerms:'30 days', creditLimit:8000,
      popiaPurpose:['Fulfil the sale','Account & credit control','Marketing (SMS/email)'], popiaConsentMarketing:true, popiaConsentDate:'2025-02-14', popiaRetentionUntil:'2031-02-14', notes:'', weight:7 },
    { id:'CUS-003', name:'Mogale Construction CC',type:'Contractor',phone:'0836612280', email:'admin@mogaleconstruction.co.za', vatNumber:'4710228841', creditTerms:'30 days', creditLimit:45000,
      popiaPurpose:['Fulfil the sale','Account & credit control'], popiaConsentMarketing:false, popiaConsentDate:'', popiaRetentionUntil:'2032-03-01', notes:'Site deliveries to Soshanguve Block L.', weight:9 },
    { id:'CUS-004', name:'Pieter Grobler',       type:'Account',    phone:'0712239087', email:'pgrobler@webmail.co.za', vatNumber:'', creditTerms:'7 days', creditLimit:3000,
      popiaPurpose:['Fulfil the sale','Warranty & returns','Account & credit control'], popiaConsentMarketing:false, popiaConsentDate:'', popiaRetentionUntil:'2030-06-30', notes:'', weight:5 },
    { id:'CUS-005', name:'Soshanguve Primary School',type:'Business',phone:'0125557741', email:'bursar@soshprimary.edu.za', vatNumber:'', creditTerms:'30 days', creditLimit:20000,
      popiaPurpose:['Fulfil the sale','Account & credit control'], popiaConsentMarketing:false, popiaConsentDate:'', popiaRetentionUntil:'2033-01-01', notes:'Orders signed off by the bursar only.', weight:3 },
    { id:'CUS-006', name:'Naledi Sithole',       type:'Walk-in',    phone:'0749980123', email:'', vatNumber:'', creditTerms:'Cash only', creditLimit:0,
      popiaPurpose:['Fulfil the sale','Warranty & returns'], popiaConsentMarketing:false, popiaConsentDate:'', popiaRetentionUntil:'2028-11-30', notes:'', weight:6 },
    { id:'CUS-007', name:'BuildRight Plumbing',  type:'Contractor', phone:'0828817340', email:'quotes@buildrightplumbing.co.za', vatNumber:'4880032219', creditTerms:'30 days', creditLimit:30000,
      popiaPurpose:['Fulfil the sale','Account & credit control'], popiaConsentMarketing:true, popiaConsentDate:'2024-08-02', popiaRetentionUntil:'2031-08-02', notes:'', weight:8 },
    { id:'CUS-008', name:'Johanna Mthembu',      type:'Account',    phone:'0607712094', email:'', vatNumber:'', creditTerms:'7 days', creditLimit:1500,
      popiaPurpose:['Fulfil the sale','Account & credit control'], popiaConsentMarketing:false, popiaConsentDate:'', popiaRetentionUntil:'2029-04-15', notes:'', weight:4 },
    { id:'CUS-009', name:'Kagiso Electrical Services',type:'Contractor',phone:'0719984410',email:'kagiso.electrical@gmail.com', vatNumber:'', creditTerms:'30 days', creditLimit:15000,
      popiaPurpose:['Fulfil the sale','Account & credit control'], popiaConsentMarketing:false, popiaConsentDate:'', popiaRetentionUntil:'2031-01-01', notes:'', weight:7 },
    { id:'CUS-010', name:'Elsie du Plessis',     type:'Walk-in',    phone:'0823340781', email:'elsiedp@telkomsa.net', vatNumber:'', creditTerms:'Cash only', creditLimit:0,
      popiaPurpose:['Fulfil the sale'], popiaConsentMarketing:false, popiaConsentDate:'', popiaRetentionUntil:'2028-09-01', notes:'', weight:4 },
    { id:'CUS-011', name:'Lehlohonolo Radebe',   type:'Walk-in',    phone:'0786620119', email:'', vatNumber:'', creditTerms:'Cash only', creditLimit:0,
      popiaPurpose:['Fulfil the sale','Warranty & returns'], popiaConsentMarketing:false, popiaConsentDate:'', popiaRetentionUntil:'', notes:'', weight:5 },
    { id:'CUS-012', name:'Tshwane Home Renovators',type:'Business', phone:'0124478812', email:'info@tshwanereno.co.za', vatNumber:'4620118873', creditTerms:'30 days', creditLimit:25000,
      popiaPurpose:['Fulfil the sale','Account & credit control','Marketing (SMS/email)'], popiaConsentMarketing:true, popiaConsentDate:'2025-06-20', popiaRetentionUntil:'2032-06-20', notes:'', weight:6 },

    /* -- Deliberately imperfect customer records -------------------------- */
    { id:'CUS-013', name:'Sarah Nel', type:'Account', phone:'0834412096', email:'sarah.nel@gmail.com', vatNumber:'', creditTerms:'30 days', creditLimit:5000,
      popiaPurpose:['Fulfil the sale','Account & credit control','Marketing (SMS/email)'], popiaConsentMarketing:true, popiaConsentDate:'', popiaRetentionUntil:'', notes:'Gets the monthly SMS specials.', weight:4,
      _flaw:'Marketing consent is ticked but no consent date was ever recorded, and no retention date is set. If this customer complained to the Information Regulator, the shop could not prove when or how consent was obtained.' },
    { id:'CUS-014', name:'Sara Nel', type:'Walk-in', phone:'0834412096', email:'', vatNumber:'', creditTerms:'Cash only', creditLimit:0,
      popiaPurpose:['Fulfil the sale'], popiaConsentMarketing:false, popiaConsentDate:'', popiaRetentionUntil:'', notes:'', weight:2,
      _flaw:'Almost certainly the same person as CUS-013 — same mobile number, name spelled differently. This is a duplicate. In a spreadsheet nobody catches it; a validation rule on phone number does.' },
    { id:'CUS-015', name:'J. Botha', type:'Account', phone:'0821119', email:'', vatNumber:'47712', creditTerms:'30 days', creditLimit:12000,
      popiaPurpose:[], popiaConsentMarketing:false, popiaConsentDate:'', popiaRetentionUntil:'', notes:'Ask Sipho, he knows who this is', weight:2,
      _flaw:'Incomplete phone number, invalid VAT number, no recorded purpose for holding the data, and a note that makes the record depend on one employee\'s memory. R12 000 of credit is extended to a record nobody can verify.' }
  ];

  var users = [
    { id:'u-lerato', name:'Lerato Mokoena', role:'Owner',         weight:3 },
    { id:'u-sipho',  name:'Sipho Dlamini',  role:'Counter staff', weight:6 },
    { id:'u-anja',   name:'Anja van Wyk',   role:'Bookkeeper',    weight:1 },
    { id:'u-thabo',  name:'Thabo Nkosi',    role:'Storeman',      weight:2 }
  ];

  var paymentMethods = [
    { v:'Cash',        weight:30 },
    { v:'Card (Yoco)', weight:34 },
    { v:'SnapScan',    weight: 8 },
    { v:'EFT',         weight:10 },
    { v:'On account',  weight:18 }
  ];

  /* ======================================================================
     Transaction generator
     ----------------------------------------------------------------------
     A seeded pseudo-random number generator (mulberry32). Deterministic:
     the same seed gives the same twelve months of trade every single time,
     so the dashboards never change between a rehearsal and the real pitch.
     ====================================================================== */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function weightedPick(rnd, items, weightKey) {
    var total = 0, i;
    for (i = 0; i < items.length; i++) total += items[i][weightKey] || 1;
    var r = rnd() * total;
    for (i = 0; i < items.length; i++) {
      r -= (items[i][weightKey] || 1);
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  function pad(n, w) { var s = String(n); while (s.length < w) s = '0' + s; return s; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1, 2) + '-' + pad(d.getDate(), 2); }
  function round2(n) { return Math.round(n * 100) / 100; }

  /* Seasonality: index 0 = January. South African retail hardware reality —
     December/January are quiet (builders' holiday, school holidays, money is
     tight after Christmas), and the pre-winter months pick up as people fix
     roofs and geysers before the cold. These weights are illustrative, chosen
     to give the dashboards a recognisable shape to discuss. */
  var monthFactor = [0.72, 0.88, 1.08, 1.14, 1.22, 1.10, 0.98, 1.04, 1.16, 1.20, 1.06, 0.80];

  function generateSales(seed, monthsBack, endDate) {
    var rnd = mulberry32(seed);
    var sales = [];
    var movements = [];
    var docSeq = 10234;
    var movSeq = 1;

    var sellable = products.filter(function (p) { return p.stockOnHand >= 0; });

    var cursor = new Date(endDate.getTime());
    cursor.setDate(cursor.getDate() - (monthsBack * 30));

    while (cursor <= endDate) {
      var dow = cursor.getDay();                       // 0 Sun ... 6 Sat
      if (dow !== 0) {                                 // closed Sundays
        var base = (dow === 6) ? 46 : 27;              // Saturdays are busy
        var factor = monthFactor[cursor.getMonth()];
        var count = Math.max(1, Math.round(base * factor * (0.7 + rnd() * 0.6)));

        /* Month-end spike: contractors draw stock when they get paid. */
        var dayOfMonth = cursor.getDate();
        if (dayOfMonth >= 25 || dayOfMonth <= 3) count = Math.round(count * 1.25);

        for (var s = 0; s < count; s++) {
          var cust = weightedPick(rnd, customers, 'weight');
          var user = weightedPick(rnd, users, 'weight');

          /* Contractors and businesses buy more lines and bigger quantities. */
          var isTrade = (cust.type === 'Contractor' || cust.type === 'Business');
          var lineCount = isTrade
            ? 2 + Math.floor(rnd() * 3)
            : 1 + Math.floor(rnd() * 2);

          var lines = [];
          var usedIds = {};
          for (var l = 0; l < lineCount; l++) {
            var prod = weightedPick(rnd, sellable, 'popularity');
            if (usedIds[prod.id]) continue;
            usedIds[prod.id] = true;

            var qty;
            if (prod.sku === 'BLD-0744')    qty = isTrade ? 25 + Math.floor(rnd() * 70) : 5 + Math.floor(rnd() * 12);
            else if (prod.unit === 'metre') qty = isTrade ?  3 + Math.floor(rnd() *  8) : 1 + Math.floor(rnd() *  4);
            else if (prod.unit === 'bag')   qty = isTrade ?  2 + Math.floor(rnd() *  5) : 1 + Math.floor(rnd() *  2);
            else                            qty = isTrade ?  1 + Math.floor(rnd() *  2) : 1;

            /* Occasional negotiated discount for trade accounts. */
            var unitPrice = prod.sellPrice;
            if (isTrade && rnd() < 0.3) unitPrice = round2(prod.sellPrice * (0.90 + rnd() * 0.07));

            lines.push({
              productId: prod.id,
              sku: prod.sku,
              description: prod.name,
              qty: qty,
              unitPrice: unitPrice,
              unitCost: prod.costPrice,
              lineTotal: round2(qty * unitPrice)
            });

            movements.push({
              id: 'MOV-' + pad(movSeq++, 5),
              date: iso(cursor),
              productId: prod.id,
              qty: -qty,
              reason: 'Sale',
              reference: 'INV-' + docSeq,
              by: user.name
            });
          }
          if (!lines.length) continue;

          var pm;
          if (cust.creditTerms === 'Cash only') {
            do { pm = weightedPick(rnd, paymentMethods, 'weight').v; } while (pm === 'On account');
          } else {
            pm = weightedPick(rnd, paymentMethods, 'weight').v;
          }

          var subtotal = round2(lines.reduce(function (t, x) { return t + x.lineTotal; }, 0));
          var status = 'Paid';
          if (pm === 'On account') {
            var age = Math.round((endDate - cursor) / 86400000);
            status = age < 30 ? 'Unpaid' : (rnd() < 0.08 ? 'Unpaid' : 'Paid');
          }

          sales.push({
            id: 'SAL-' + pad(docSeq - 10233, 5),
            docNumber: 'INV-' + docSeq,
            date: iso(cursor),
            customerId: cust.id,
            lines: lines,
            subtotal: subtotal,
            vat: round2(subtotal * VAT),
            total: round2(subtotal * (1 + VAT)),
            paymentMethod: pm,
            status: status,
            servedBy: user.name
          });
          docSeq++;
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return { sales: sales, movements: movements };
  }

  /* Deliveries in, so stock movements are not only outward. */
  function generateDeliveries(seed, sales) {
    var rnd = mulberry32(seed + 7);
    var out = [];
    var seq = 90000;
    var byMonth = {};
    sales.forEach(function (s) {
      var m = s.date.slice(0, 7);
      if (!byMonth[m]) byMonth[m] = {};
      s.lines.forEach(function (l) {
        byMonth[m][l.productId] = (byMonth[m][l.productId] || 0) + l.qty;
      });
    });
    Object.keys(byMonth).sort().forEach(function (m) {
      Object.keys(byMonth[m]).forEach(function (pid) {
        var sold = byMonth[m][pid];
        if (sold < 3) return;
        /* Replenishment is modelled as matching consumption: over a month the
           shop buys in roughly what it sold. Only the timing varies, which is
           what actually varies in a real shop.

           This is deliberate rather than lazy. It means the stockOnHand figures
           written against each product above ARE the shop's position today,
           rather than something that emerges from a year of compounding random
           numbers. Where a line is short, it is short because we wrote it that
           way to make a point — not because the generator drifted. */
        var qty = sold;
        out.push({
          id: 'MOV-D' + (seq++),
          date: m + '-' + pad(2 + Math.floor(rnd() * 24), 2),
          productId: pid,
          qty: qty,
          reason: 'Delivery',
          reference: 'GRN-' + (4100 + Math.floor(rnd() * 900)),
          by: 'Thabo Nkosi'
        });
      });
    });
    return out;
  }

  var TODAY = new Date('2026-10-11T00:00:00');
  var generated = generateSales(20261011, 12, TODAY);
  var deliveries = generateDeliveries(20261011, generated.sales);

  /* A handful of hand-written movements that tell a story the generator
     cannot: shrinkage, damage and a stock-take correction. These are what
     the owner currently has no way of seeing at all. */
  var manualMovements = [
    { id:'MOV-M001', date:'2026-04-18', productId:'PRD-018', qty:-14, reason:'Damage / write-off', reference:'Cement bags burst in the rain, back yard',  by:'Thabo Nkosi' },
    { id:'MOV-M002', date:'2026-06-02', productId:'PRD-008', qty:-23, reason:'Stock take adjustment', reference:'',                                       by:'Lerato Mokoena' },
    { id:'MOV-M003', date:'2026-06-02', productId:'PRD-002', qty:-11, reason:'Stock take adjustment', reference:'',                                       by:'Lerato Mokoena' },
    { id:'MOV-M004', date:'2026-07-21', productId:'PRD-015', qty: -1, reason:'Damage / write-off', reference:'Dropped on display floor',                   by:'Sipho Dlamini' },
    { id:'MOV-M005', date:'2026-08-09', productId:'PRD-010', qty: -2, reason:'Return',             reference:'INV-11204 — wrong colour',                   by:'Anja van Wyk' },
    { id:'MOV-M006', date:'2026-09-15', productId:'PRD-020', qty:-180,reason:'Stock take adjustment', reference:'Yard count vs book — unexplained',        by:'Lerato Mokoena' },
    { id:'MOV-M007', date:'2026-09-30', productId:'PRD-030', qty: -6, reason:'Internal use',       reference:'Shop cleaning',                              by:'Sipho Dlamini' }
  ];

  return {
    meta: {
      generatedFor: 'INF1781 Group Project — Scenario 2, SME Digital Transformation',
      note: 'All people, businesses and transactions in this file are invented for teaching purposes. No real personal information is used anywhere in this resource.',
      scopeNote: 'The catalogue is a representative sample of 35 lines. A hardware shop of this size really carries a few thousand, so the stock figures cover the sampled lines only. Revenue, margin, basket size and trading patterns are modelled at full shop scale.',
      asOfDate: '2026-10-11',
      vatRate: VAT,
      seed: 20261011
    },
    suppliers: suppliers,
    products: products,
    customers: customers,
    users: users,
    sales: generated.sales,
    stockMovements: generated.movements.concat(deliveries, manualMovements)
      .sort(function (a, b) { return a.date < b.date ? -1 : 1; })
  };
}());
