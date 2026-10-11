# Lerato's Hardware & Home — an information systems resource

INF1781 Group Project · Belgium Campus iTversity · Scenario 2 (SME Digital
Transformation — Retail and Small Business)

A digital resource that teaches a non-technical small-business owner how
information systems would change their operations, with a working demonstration
rather than screenshots.

**Live site:** https://chraetenlategan.github.io/INF181-group-project/

All people, businesses, suppliers, customers and transactions in this repository
are **invented**. No real personal information is used anywhere, and nothing
here is drawn from a real business's records.

## Running it

Open `index.html`. That is all — no build step, no server, no dependencies.

For a local server (useful while editing):

```bash
python3 -m http.server 4173
```

Then visit <http://localhost:4173>.

## What is here

```
index.html              Landing page — the problem, the idea, the topics
login.html              Role switcher, and how access is actually controlled
pages/
  data-management.html  DEPTH TOPIC — records, metadata, quality, dashboards
  ethics-privacy.html   POPIA and data ethics
  ai-decision-support.html
  enterprise-systems.html
  adapting-is.html      Buy / configure / customise / build
  roadmap.html          Staged plan, costs, risks
  glossary.html         46 terms in plain language
  references.html       Sourcing checklist and reference list
demo/
  index.html            The live demonstration
  store.js              Record store — _meta envelopes, audit log, import/export
  validate.js           Validation rules, two severities
  capture.js            Schema-driven adaptive form
  generate.js           Six documents built from stored records
  analytics.js          Aggregations and hand-drawn SVG charts
  app.js                Demonstration shell and views
data/
  schema.js             The shape of every record — drives form, checks, storage
  seed.js               Invented data set + seeded 12-month trading generator
assets/css/main.css     One stylesheet for the whole site
assets/js/site.js       Navigation, contents lists, placeholder toggle
docs/
  design-rationale.md   Skeleton of the BC Connect submission
  contributions.md      Who did what, and Q&A preparation
  deployment.md         Cloudflare Pages, GitHub Pages, offline fallback
_headers                Security headers for Cloudflare Pages
CLAUDE.md               Project brief and working rules
```

## Who writes what

Every outstanding task is allocated across four people in
**`INF1781-work-allocation.docx`**, with a typing box under each brief. Fill in
your part, save, and send it back — each task has a unique ID, so the answers
map straight onto the right place on the site.

`tools/` holds the scripts that build that pack and read a filled-in copy back.

## Writing the content

> **Two kinds of text are on these pages.** The 36 orange boxes have no draft at
> all. Everything else — tables, callouts, card summaries, examples, the
> sentences between sections — is AI-drafted scaffolding and **must be rewritten
> in your own words before submission**, with every factual claim verified. The
> brief allows AI for building the site, not for writing what a visitor reads.
> Keep the structure, the code, the diagrams and the data. Rewrite the prose.


Orange dashed boxes marked **"Team writes this"** are drafting placeholders.
Each one is a brief: what to cover, what evidence in the demonstration to point
at, and where to look the facts up. Replace them with your own writing.

Press **Ctrl+Shift+D** on any page to hide them, so the site can be previewed as
the client will see it. The footer shows how many are left.

**All of them must be gone from the HTML before submission.**

## The demonstration

Everything is stored in the visitor's own browser. Nothing is sent anywhere.
Every person, supplier and transaction is invented.

Worth trying: capture a sale, try to sell stock that does not exist, generate
the invoice, open the record and read its `_meta` block, then produce a POPIA
access report for a customer.

**Your data → Restore** puts everything back.

## Earlier work in this repository

This repository previously held the group's first direction — a policy and
engagement document generator. That work is not lost: it is preserved on the
tag `archive/policy-generator` and in the commit history.

```bash
git checkout archive/policy-generator
```
