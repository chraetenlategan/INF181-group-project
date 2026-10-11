/* ═══════════════════════════════════════════════════════════════════════════
   templates.js — what makes this PDF editor "smart".

   This is the only file that knows anything about INF181 financial statements.
   Everything else in the tool is generic PDF machinery; the intelligence —
   "this sheet is the Directors' Report", "body text on this page is Poppins
   9.5pt at line-height 1.30, in a column from 18mm to 192mm" — lives here.

   Geometry is copied from web/css/styles.css :root (--pg-*) and the document
   typography vars. If those change, change them here too: the whole point is
   that re-typeset text lands on the same grid the generator used.

   COORDINATE SYSTEM
   -----------------
   Every measurement in this tool is in **millimetres on the A4 sheet**, origin
   top-left. PDF points and OCR pixels are both converted into mm the moment
   they are read, so a text-layer PDF and an OCR'd raster PDF produce the same
   model and the rest of the code never has to care which it is looking at.
   ═══════════════════════════════════════════════════════════════════════════ */

window.PGTPL = (function () {
  'use strict';

  const MM_PER_PT = 25.4 / 72;
  const PT_PER_MM = 72 / 25.4;

  // ── Page geometry (mirrors --pg-* in styles.css) ─────────────────────────
  const PAGE = { w: 210, h: 297 };

  // Two padding buckets. `.doc-page` uses `normal`; `.doc-page.compact-page`
  // (Responsibilities & Approval, Compiler's Report, engagement letters)
  // redefines --pg-pt/--pg-pb, which is `compact`.
  const PAD = {
    normal:  { top: 15, side: 18, bottom: 19 },
    compact: { top: 12, side: 18, bottom: 14 }
  };

  // Document line-height buckets (--doc-lh-*). Multipliers on the font size.
  const LH = { base: 1.33, compact: 1.30, eng: 1.32, decl: 1.33 };

  // --doc-body-size / --doc-body-font / --doc-ink
  const BODY_PT = 9.5;
  const BODY_FONT = 'Poppins';
  const INK = '#111111';

  // A letterhead image bleeds to the sheet edge across the top padding, and a
  // footer image across the bottom. Text found inside these bands is page
  // chrome (firm name, address, page number), not document content — it is
  // locked for editing by default.
  const CHROME = { top: 30, bottom: 20 };

  // ── Helpers ──────────────────────────────────────────────────────────────
  const ptToMm = pt => pt * MM_PER_PT;
  const mmToPt = mm => mm * PT_PER_MM;

  // Fold text down to something an OCR pass and a text layer can agree on:
  // lowercase, curly quotes flattened, every run of non-alphanumerics becomes
  // a single space. Fingerprints below are written against this shape.
  function normalise(s) {
    return String(s || '')
      .replace(/[‘’ʼ]/g, "'")
      .replace(/[“”]/g, '"')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  // Build a "word boundary" regex from a plain phrase, tolerating the single
  // space normalise() leaves between tokens.
  function phrase(p) {
    return new RegExp('\\b' + normalise(p).replace(/ /g, '\\s+') + '\\b');
  }

  /* ── The page catalogue ────────────────────────────────────────────────────
     `order` is the canonical position in a generated set, used to propose a
     running order for a PDF whose pages were split/reshuffled on the way out.
     Gaps in the numbering are deliberate — they leave room for page types we
     have not catalogued yet without renumbering everything.

     `bucket` selects the padding + line-height the generator used, so re-
     typeset text sits on the same baseline grid.

     `kw` is a weighted fingerprint. A page's score is the sum of the weights
     of the phrases present. `must` (optional) is a phrase that has to be
     present at all for the type to be considered.                          */
  const TYPES = [
    {
      id: 'cover', label: 'Cover page', order: 0, bucket: 'base',
      kw: [
        ['annual financial statements', 3],
        ['financial statements', 1],
        ['for the year ended', 2],
        ['statement of assets and liabilities', 3],
        ['registration number', 1],
        ['these financial statements have been audited', 1],
        ['prepared by', 1]
      ],
      // A cover is mostly whitespace. Anything long is a different page that
      // merely mentions the title.
      maxChars: 700
    },
    {
      id: 'index', label: 'Index', order: 1, bucket: 'base',
      must: 'index',
      kw: [
        ['index', 3],
        ['page', 1],
        ['statement of financial position', 2],
        ['statement of cash flows', 2],
        ['notes to the financial statements', 2],
        ['independent auditor s report', 1],
        ['independent reviewer s report', 1],
        ['independent compiler s report', 1],
        ['the reports and statements set out below', 3]
      ],
      maxChars: 1600
    },
    {
      id: 'generalInfo', label: 'General Information', order: 2, bucket: 'base',
      kw: [
        ['general information', 4],
        ['country of incorporation and domicile', 3],
        ['registered office', 2],
        ['business address', 2],
        ['postal address', 1],
        ['bankers', 2],
        ['nature of business and principal activities', 3],
        ['level of assurance', 2],
        ['preparer', 1]
      ]
    },
    {
      id: 'caDeclaration', label: "Chartered Accountant's (SA) Declaration",
      order: 3, bucket: 'decl',
      kw: [
        ['chartered accountant s south africa declaration', 5],
        ['chartered accountant', 2],
        ['declaration', 2],
        ['saica', 2],
        ['i declare that', 2],
        ['in terms of the companies act', 1]
      ]
    },
    {
      id: 'responsibilities', label: 'Responsibilities and Approval',
      order: 4, bucket: 'compact',
      kw: [
        ['responsibilities and approval', 5],
        ['are required by the companies act', 2],
        ['responsible for the preparation', 3],
        ['maintain adequate accounting records', 2],
        ['going concern', 2],
        ['internal financial controls', 2],
        ['approved the annual financial statements', 3],
        ['the annual financial statements set out on', 2]
      ]
    },
    {
      id: 'compilerReport', label: "Independent Compiler's Report",
      order: 5, bucket: 'compact',
      kw: [
        ['independent compiler s report', 5],
        ['compilation engagement', 3],
        ['isrs 4410', 3],
        ['independent compiler s responsibility', 3],
        ['alert to reader', 2],
        ['we have compiled', 3],
        ['we have not audited or reviewed', 2]
      ]
    },
    {
      id: 'reviewerReport', label: "Independent Reviewer's Report",
      order: 5, bucket: 'decl',
      kw: [
        ['independent reviewer s report', 5],
        ['independent reviewer s responsibility', 3],
        ['isre 2400', 3],
        ['review engagement', 2],
        ['qualified conclusion', 2],
        ['adverse conclusion', 2],
        ['based on our review', 3],
        ['nothing has come to our attention', 3]
      ]
    },
    {
      id: 'auditorReport', label: "Independent Auditor's Report",
      order: 5, bucket: 'base',
      kw: [
        ['independent auditor s report', 5],
        ['basis for opinion', 3],
        ['basis for qualified opinion', 3],
        ['disclaimer of opinion', 3],
        ['auditor s responsibilities for the audit of the financial statements', 4],
        ['international standards on auditing', 3],
        ['key audit matters', 2],
        ['reasonable assurance', 2],
        ['we conducted our audit', 3],
        ['emphasis of matter', 1],
        ['other information', 1],
        ['independent regulatory board for auditors', 2]
      ]
    },
    {
      id: 'governingReport', label: "Directors' / Members' / Trustees' Report",
      order: 6, bucket: 'base',
      kw: [
        ['directors report', 4],
        ['members report', 4],
        ['trustees report', 4],
        ['review of activities', 3],
        ['main business and operations', 3],
        ['directorate', 3],
        ['events after the reporting period', 2],
        ['holding company', 1],
        ['auditors', 1],
        ['secretary', 1],
        ['the directors have pleasure in submitting', 4],
        ['their report on the annual financial statements', 3]
      ]
    },
    {
      id: 'financialPosition', label: 'Statement of Financial Position',
      order: 7, bucket: 'base',
      kw: [
        ['statement of financial position', 5],
        ['non current assets', 3],
        ['current assets', 2],
        ['total assets', 3],
        ['equity and liabilities', 3],
        ['total equity and liabilities', 3],
        ['trade and other receivables', 1],
        ['trade and other payables', 1]
      ]
    },
    {
      id: 'incomeStatement', label: 'Statement of Profit or Loss / Surplus',
      order: 8, bucket: 'base',
      kw: [
        ['statement of profit or loss and other comprehensive income', 5],
        ['statement of surplus or deficit', 5],
        ['statement of surplus and deficit', 5],
        ['statement of income and expenditure', 5],
        ['statement of financial performance', 5],
        ['gross profit', 2],
        ['operating expenses', 2],
        ['operating profit', 2],
        ['total comprehensive income', 3],
        ['finance costs', 1],
        ['revenue', 1],
        ['taxation', 1]
      ]
    },
    {
      id: 'changesInEquity', label: 'Statement of Changes in Equity / Funds',
      order: 9, bucket: 'base',
      kw: [
        ['statement of changes in equity', 5],
        ['statement of changes in funds', 5],
        ['statement of changes in surplus and reserves', 5],
        ['balance at', 2],
        ['retained income', 3],
        ['accumulated surplus', 3],
        ['share capital', 2],
        ['total equity', 2]
      ]
    },
    {
      id: 'cashFlows', label: 'Statement of Cash Flows', order: 10, bucket: 'base',
      kw: [
        ['statement of cash flows', 5],
        ['cash flows from operating activities', 4],
        ['cash flows from investing activities', 4],
        ['cash flows from financing activities', 4],
        ['cash generated from operations', 3],
        ['total cash movement for the year', 3],
        ['cash at the end of the year', 2]
      ]
    },
    {
      id: 'accountingPolicies', label: 'Accounting Policies', order: 11, bucket: 'base',
      kw: [
        ['accounting policies', 5],
        ['basis of preparation', 3],
        ['presentation currency', 3],
        ['significant judgements and sources of estimation uncertainty', 3],
        ['going concern', 1],
        ['property plant and equipment', 1],
        ['financial instruments', 1],
        ['ifrs for smes', 3],
        ['historical cost convention', 2]
      ]
    },
    {
      id: 'notes', label: 'Notes to the Financial Statements', order: 12, bucket: 'base',
      kw: [
        ['notes to the financial statements', 5],
        ['notes to financial statements', 5],
        ['figures in rand', 2],
        ['carrying value', 1],
        ['accumulated depreciation', 1],
        ['reconciliation of', 1],
        ['related parties', 1]
      ]
    },
    {
      id: 'detailedIncome', label: 'Detailed Income Statement', order: 13, bucket: 'base',
      kw: [
        ['detailed income statement', 5],
        ['the supplementary information presented does not form part of the annual financial statements', 5],
        ['is unaudited', 2],
        ['operating expenses', 2],
        ['gross profit', 1]
      ]
    },
    {
      id: 'minutes', label: 'Minutes of the Annual General Meeting',
      order: 20, bucket: 'base',
      kw: [
        ['minutes of the annual general meeting', 5],
        ['apologies', 2],
        ['quorum', 2],
        ['resolved that', 3],
        ['welcome', 1],
        ['chairperson', 2],
        ['there being no further business', 3]
      ]
    },
    {
      id: 'loanCert', label: 'Loan Certificate', order: 21, bucket: 'base',
      kw: [
        ['loan certificate', 5],
        ['we hereby certify', 3],
        ['loan account', 3],
        ['is not repayable within', 2],
        ['subordinat', 2]
      ]
    },
    {
      id: 'engagementLetter', label: 'Engagement Letter', order: 22, bucket: 'eng',
      kw: [
        ['terms of engagement', 4],
        ['engagement letter', 4],
        ['we are pleased to confirm', 4],
        ['yours faithfully', 2],
        ['our fees', 2],
        ['this letter will remain effective', 3],
        ['please sign and return', 3]
      ]
    }
  ];

  // Pre-compile every fingerprint once.
  TYPES.forEach(t => {
    t._kw = t.kw.map(([p, w]) => [phrase(p), w, p]);
    t._must = t.must ? phrase(t.must) : null;
    t._maxScore = t.kw.reduce((a, [, w]) => a + w, 0);
  });

  const BY_ID = {};
  TYPES.forEach(t => { BY_ID[t.id] = t; });

  const UNKNOWN = {
    id: 'unknown', label: 'Unrecognised page', order: 99, bucket: 'base',
    _kw: [], _must: null, _maxScore: 1
  };

  /* Identify a page from its full text.
     Returns { type, confidence (0..1), score, matched:[phrases], runnerUp }.

     Confidence is score / (a modest fraction of the type's own maximum), so a
     page does not have to hit every phrase to be certain — the Statement of
     Cash Flows only needs its title plus one section heading. It is clamped to
     1 and then knocked down when a second type scored nearly as well, which is
     what actually distinguishes "definitely the auditor's report" from "could
     be either report page". */
  function classify(rawText) {
    const text = normalise(rawText);
    const len = text.length;
    const scored = [];

    for (const t of TYPES) {
      if (t._must && !t._must.test(text)) continue;
      if (t.maxChars && len > t.maxChars) continue;
      let score = 0;
      const matched = [];
      for (const [re, w, p] of t._kw) {
        if (re.test(text)) { score += w; matched.push(p); }
      }
      if (score > 0) scored.push({ type: t, score, matched });
    }

    if (!scored.length) {
      return { type: UNKNOWN, confidence: 0, score: 0, matched: [], runnerUp: null };
    }

    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];
    const second = scored[1] || null;

    // "Enough" is 45% of the fingerprint — see the comment above.
    let conf = Math.min(1, best.score / Math.max(1, best.type._maxScore * 0.45));
    if (second) {
      const margin = (best.score - second.score) / best.score; // 0..1
      conf *= 0.55 + 0.45 * Math.min(1, margin * 2);
    }

    return {
      type: best.type,
      confidence: Math.round(conf * 100) / 100,
      score: best.score,
      matched: best.matched,
      runnerUp: second ? { id: second.type.id, label: second.type.label, score: second.score } : null
    };
  }

  /* Does this page look like the *first* sheet of its section, or a spill-over
     continuation? A generated first page opens with a heading: large, bold,
     sitting in the top third under the letterhead. A continuation opens with
     body text. Used when proposing a running order so a two-page auditor's
     report does not get split apart. */
  function looksLikeContinuation(blocks, bucket) {
    const pad = PAD[bucket] || PAD.normal;
    const head = blocks
      .filter(b => b.yMm < pad.top + 45 && b.text.trim())
      .sort((a, b) => a.yMm - b.yMm)[0];
    if (!head) return true;
    const big = head.sizePt >= BODY_PT * 1.12;
    return !(big || head.bold);
  }

  // Padding + column for a bucket.
  function metricsFor(bucket) {
    const pad = PAD[bucket] || PAD.normal;
    return {
      pad,
      colLeft: pad.side,
      colRight: PAGE.w - pad.side,
      colWidth: PAGE.w - 2 * pad.side,
      lh: LH[bucket] || LH.base,
      bodyPt: BODY_PT,
      font: BODY_FONT,
      ink: INK
    };
  }

  return {
    MM_PER_PT, PT_PER_MM, ptToMm, mmToPt,
    PAGE, PAD, LH, BODY_PT, BODY_FONT, INK, CHROME,
    TYPES, BY_ID, UNKNOWN,
    normalise, classify, looksLikeContinuation, metricsFor
  };
})();
