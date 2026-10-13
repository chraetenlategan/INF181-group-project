# INF1781 Group Project — IS Consultant Digital Resource

## What this project is

A **professional website** that acts as a digital Information Systems resource for a
non-technical audience, produced by our team acting as IS consultants.

- **Subject:** INF1781 (Information Systems 1781), Belgium Campus iTversity
- **Scenario chosen:** Scenario 2 — SME Digital Transformation, Retail & Small Business
- **Client (fictional):** a small South African retail business currently run on
  spreadsheets, paper records and manual processes. The owner wants to grow but
  knows the current approach will not scale.
- **Audience:** the business owner and their staff. Busy, non-technical, must be able
  to navigate the site independently and come away actually understanding the concepts.
- **Due:** 2026-10-13 (design rationale PDF on BC Connect)
- **Presentation:** 14–15 October 2026, pitched live to the lecturer playing the client,
  followed by Q&A where any member may be asked anything.
- **Total:** 100 marks

## HARD RULE — AI usage boundary

The brief states explicitly:

> AI tools may assist with the **technical construction** of the website (layout
> suggestions, writing or debugging code, visual elements, troubleshooting design).
> **You may not use AI to generate the written content of your website.**

Therefore, in this repo:

- **Claude builds:** HTML/CSS/JS structure, styling, navigation, the interactive demo
  app, diagrams/SVGs, charts, responsive layout, accessibility fixes, bug fixes.
- **Claude does NOT write:** any educational prose the visitor reads — explanations,
  definitions, examples, case studies, trade-off discussions, POPIA commentary,
  recommendations. Team members write these.
- When scaffolding a page, Claude inserts a visible placeholder, e.g.
  `<!-- TEAM: written content goes here — author: ____ -->` with a short note on what
  the section needs to cover. Never fill it in with generated prose.
- Lorem ipsum or sample text used purely to test layout must be clearly marked
  `data-placeholder="true"` and removed before submission.
- The design rationale PDF must contain an **AI Disclaimer** stating exactly this split.

## Required content topics (all five must appear)

1. Data and information management in retail — including data visualisation,
   dashboards, and information quality
2. Data ethics, privacy, and POPIA compliance for a small retailer
3. AI and decision support systems relevant to retail
4. Enterprise systems and IS integration challenges for an SME
5. Adapting and customising information systems to fit the business's specific needs

**One topic must go into significant depth** (worth 5% on its own, plus it carries the
Content Quality mark). Our depth topic is **Topic 1 — Data and Information Management**,
because it is the one we can *demonstrate* rather than only describe, via the interactive
demo below.

## The core idea we are demonstrating

The spreadsheet problem, stated plainly for the owner:

> A spreadsheet stores a *value*. It does not store what that value means, where it came
> from, when it was checked, whether it is valid, or what else it relates to. So every
> time you need a quote, an invoice, a stock take or a supplier order, somebody retypes
> the same facts — and every retype is a new chance to be wrong.

Our answer, shown as a working flow:

**Capture → Validate → Store (structured, with metadata) → Reuse → Analyse**

- **Capture:** an adaptive form. The interface asks only for what is relevant, guides
  input, and prevents bad data at the point of entry rather than cleaning it later.
- **Validate:** required fields, types, ranges, duplicate detection, referential checks
  (e.g. a sale must point to a product that exists).
- **Store:** structured JSON records. Each record carries **metadata** a spreadsheet cell
  cannot: unique ID, created/modified timestamps, who captured it, source, version,
  validation status, and links to related records.
- **Reuse:** generate a document (invoice, quote, stock report, customer statement) by
  *extracting* stored records — captured once, used many times, never retyped.
- **Analyse:** because the data is structured and consistent, it can be aggregated into
  dashboards — turning raw data into information the owner can actually decide on.

This single flow lets us hit Data Management, Information Quality, Enterprise Systems
(one source of truth), Integration (shared data between functions), Analytics, and
Adaptation/Customisation — all with one artefact.

## Tech stack

Deliberately simple. We are not assessed on web programming skill; we are assessed on
whether a non-technical person can use the site. Priority is that it runs anywhere,
including the lecturer's PC, with no setup.

- **Plain HTML5 + CSS3 + vanilla JavaScript.** No framework, no build step, no npm.
- **No CDN dependencies.** Everything local so the site works offline and on a strange
  machine. (If a font is wanted, embed or fall back to a system stack.)
- **Data layer:** JSON files for seed data, `localStorage` for records created during the
  demo, plus import/export of `.json` so the data is portable and inspectable.
- **Document generation:** build an HTML document from stored records and use the
  browser's print-to-PDF. No external library.
- **Charts:** hand-drawn inline SVG, or `<canvas>`. Keep them simple and labelled.
- **Hosting:** GitHub Pages or Netlify (free). Must also work by opening `index.html`
  directly from a folder as a fallback.

## Structure as built

```
INF181/
├── index.html                  Landing — the problem, the idea, the six topics
├── login.html                  Role switcher + how access is really controlled
├── pages/
│   ├── data-management.html    DEPTH TOPIC — 11 sections, 3 diagrams, 5 tables
│   ├── ethics-privacy.html     POPIA: 8 conditions, 4 questions, ethics
│   ├── ai-decision-support.html Analytics maturity, decision types, honest limits
│   ├── enterprise-systems.html POS/CRM/ERP, islands of data, 4 ways to integrate
│   ├── adapting-is.html        Buy/configure/customise/build, adoption, SA conditions
│   ├── roadmap.html            Stages 0–4, costs, risks, decision points
│   ├── glossary.html           46 terms, awaiting definitions
│   └── references.html         Sourcing checklist — 17 claims needing citations
├── demo/
│   ├── index.html              Shell — 12 views
│   ├── store.js                Records, _meta envelopes, audit log, delta persistence
│   ├── validate.js             Schema checks + business rules, two severities
│   ├── capture.js              Schema-driven adaptive form
│   ├── generate.js             6 documents built from stored records
│   ├── analytics.js            Aggregations + hand-drawn SVG charts
│   └── app.js                  Views and routing
├── data/
│   ├── schema.js               Field definitions, rules, hints, users
│   └── seed.js                 Invented data + seeded 12-month trading generator
├── assets/css/main.css         One stylesheet, 25 sections
├── assets/js/site.js           Nav, contents lists, placeholder toggle
├── docs/
│   ├── design-rationale.md     Skeleton of the BC Connect PDF
│   ├── contributions.md        Who did what + Q&A checklist
│   └── deployment.md           Cloudflare Pages, Access, offline fallback
├── _headers                    Security headers (CSP blocks all external requests)
└── .nojekyll                   So GitHub Pages serves _headers
```

## The demonstration data

Invented, and deterministic. `data/seed.js` holds master data written out record
by record, plus a seeded generator (mulberry32) that produces twelve months of
trading. The same seed always produces the same figures, so the dashboards are
identical in rehearsal and in the real pitch.

Headline figures the content refers to:

| Figure | Value | Where it is used |
|---|---|---|
| Annual revenue (excl. VAT) | R4 461 352 | Home, data page |
| Gross margin | 38.3% | Measurement table |
| Average sale | R438 | Measurement table |
| Transactions | 10 195 (~33/day) | Overview |
| Stock at cost | R449 351 (6.1× turn) | Overview |
| Dead stock | R23 798 across 4 lines | Home hero, analytics |
| Owed on account | R99 962 across 10 customers | Home hero, roadmap |
| Shrinkage | R3 616 | Home hero, analytics |
| Top named customer share | 16.0% (Mogale Construction CC) | Analytics |
| Top three trade accounts | 43.4% of turnover | Home hero, analytics |
| Walk-in (unidentified) share | 20.9% | Excluded from concentration — it is a bucket, not a buyer |
| Information quality | 92% (6 errors, 8 warnings) | Quality screen |

The catalogue is 35 lines — a representative sample, not a real shop's full
range. That is stated in `seed.js` and on the references page, because the
stock-turn figure invites the question.

Three products and three customers carry deliberate flaws (below-cost pricing,
a duplicate customer, missing POPIA consent dates, an unverifiable credit
account). Every one of them is referenced by name in the written content as a
worked example.

## Running and verifying

```bash
python3 -m http.server 4173
```

Checks already passing: no broken internal links, no HTML nesting errors, no
console errors, no horizontal overflow on any page or demo view at 375px or
desktop, all 12 demo views render, all 6 documents generate, export/import
round-trips, and persistence stays under 2KB.

## IMPORTANT — two kinds of text on these pages

There are **two** categories, and the team has to handle both:

1. **The `.todo` placeholders.** No draft text at all — just a brief saying
   what to cover, which demo screen proves it, and where to look the facts up.
   Written from scratch by the team. **34 of the 35 writing tasks are now on the
   site**, applied from `Submission.docx` on 2026-10-13. Two placeholders remain,
   both named in `docs/contributions.md`:
   - `pages/references.html` — RF-01, the reference list (Oratile Nare)
   - `pages/glossary.html` — 8 of the 46 definitions (Chraeten Lategan):
     Knowledge, Metadata, Record versus row, Schema, Master data, Transaction
     data, Information quality, Validation

2. **The prose that is already on the pages** — table contents, callouts, card
   summaries, diagram labels, worked examples, the sentences between sections.
   This was AI-drafted as scaffolding. **It must be rewritten in the team's own
   words before submission**, and every factual claim in it verified. The brief
   permits AI for technical construction but not for generating the website's
   written content, and this text falls on the wrong side of that line.

Keep: the structure, the CSS, all the JavaScript, the diagrams, the data set.
Rewrite: anything a visitor reads.

Everything a visitor reads inside a section body is now team-written. The
scaffolding prose that still needs rewriting is what sits *around* it: the
tables, callouts, card summaries, ledes and diagram labels.

## Applying a filled-in allocation pack

`tools/build-allocation-pack.py` produces the Word pack the team writes into;
`tools/apply-submission.py` puts a filled-in copy back onto the site:

```bash
python3 tools/apply-submission.py Submission.docx
```

It matches each answer box to its task ID, replaces that task's `.todo` block
with the writing as paragraphs (numbered and bulleted runs become lists),
fills glossary rows by term, and leaves any box that is still blank as a
placeholder. Stdlib only — it does not need python-docx. It is safe to re-run
only against the original placeholders, so restore the page from git before
re-applying.

## Drafting placeholders

Orange `.todo` blocks mark where the team's writing still goes.
Each is a brief: what to cover, which demonstration screen proves it, and where
to look the facts up. **Ctrl+Shift+D** hides them for previewing; the footer
counts what is left.

**Every one must be deleted from the HTML before submission.** Two are left.

## Design and content standards

- **Write for the owner, not the lecturer.** Short sentences, no unexplained jargon.
  First use of a term gets a plain-language definition.
- **Every claim needs a source.** The rubric awards "all claims supported with
  appropriate sources" at Excellent. Keep a references list and cite inline.
- **South African context throughout.** Rands, VAT at the current SA rate, POPIA (not
  GDPR), local realities — load shedding, intermittent connectivity, cash-heavy trade,
  SnapScan/Yoco/Zapper, Pastel/Sage/Xero, SARS requirements.
- **Be honest about trade-offs.** The brief asks for it: cost, staff training time,
  migration pain, vendor lock-in, what to do when the internet is down, what *not* to
  digitise yet. A resource that only sells the upside will score badly.
- **Consistency.** One stylesheet, one nav, same page skeleton everywhere. The Website
  Design mark (15%) is about a non-technical user navigating without confusion.
- **Accessibility:** real heading hierarchy, alt text, sufficient contrast, keyboard
  navigable, readable on a phone.

## Grading weights (keep these in view)

| Criterion | Weight |
|---|---|
| Content Quality, Accuracy, Relevance | 20% |
| Website Design and Usability | 15% |
| Scenario Application and Contextualisation | 15% |
| Client Pitch and Q&A | 15% |
| Teamwork and Collaboration | 10% |
| IS Concepts: Data and Information Management | 5% |
| IS Concepts: Ethics, Privacy, Security | 5% |
| IS Concepts: Enterprise Systems and Integration | 5% |
| IS Concepts: Analytics and Decision Support | 5% |
| Depth in One IS Area | 5% |

Note that 55% of the mark is content, context and pitch — not the build. The demo exists
to make the content land, not to be impressive on its own.

## Submission checklist

- [ ] Website live on a hosted URL, and working from a local folder as backup
- [ ] All five required topics covered; depth topic clearly deeper
- [ ] All placeholder prose replaced with team-written content
- [ ] Sources cited; references page present
- [ ] Design rationale PDF: headings + reasoning for each, content + reasoning for each,
      logical structure, per-member contributions section, **AI Disclaimer**
- [ ] Every member can answer any question about any part of the site
