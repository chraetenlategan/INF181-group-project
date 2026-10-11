# Design Rationale — working draft

> **This is the skeleton of the PDF that gets submitted on BC Connect.**
> The brief asks for: (1) the main headings of the website with the thinking
> behind choosing them, (2) each heading's content plus the reasoning for
> including it, (3) a logical structure, (4) each member's tasks and
> contributions, and (5) an AI Disclaimer.
>
> Everything below marked **[WRITE]** is for the team. The structure, the
> heading list and the AI disclaimer facts are scaffolding.

---

## 1. The client and the brief

**[WRITE]** Half a page. Who the client is, what the scenario asked for, and
how the team interpreted it. State the audience explicitly — a non-technical
owner and four staff — because every design decision that follows is justified
against that audience.

## 2. Why these headings

The site has six content pages plus a working demonstration. For each, the
rationale below is a starting point — **[WRITE]** your own reasoning, and be
ready to defend the ordering in Q&A.

| Heading | Why it exists | Why it is in this position |
|---|---|---|
| **Home** | States the problem before offering a solution. Opens with four rand figures the owner cannot currently see. | A client who does not recognise the problem will not read the rest. |
| **Data & information management** | The depth topic. Everything else assumes the capture-once idea. | First, because the other five pages reference it. |
| **Data ethics, privacy & POPIA** | Legal obligation that applies regardless of size, and the one spreadsheets genuinely cannot satisfy. | Immediately after data, because holding records about people is the direct consequence of the previous page. |
| **AI & decision support** | Named in the brief; also where a small business is most likely to be oversold to. | After the foundations, so the honest "you are not ready for this yet" argument has something to stand on. |
| **Enterprise systems & integration** | Explains what the software categories actually are and why they stop talking. | Once the reader understands records, islands of data makes sense. |
| **Making it fit** | Adapting and customising — the brief's fifth topic. | Late, because it is a decision about trade-offs that only makes sense after the options are understood. |
| **Roadmap** | Turns the resource into advice. The client asked what to do. | Last. It is the conclusion. |
| **Live demonstration** | Proves the claims rather than asserting them. | Linked from every page, always one click away. |

**[WRITE]** Add a paragraph on the navigation decision: why the five brief
topics were given one page each rather than being merged, and why a glossary
and a sources page were added.

## 3. Content, section by section

**[WRITE]** For each page, list its sections and give the reasoning for
including each. Work from the actual headings in the HTML — the on-page
contents list on each page gives you them in order.

Keep the reasoning specific. "We included a section on information quality
because the rubric mentions it" is a weak answer. "We included it because the
client's own migrated data contains a customer with R12 000 of credit and an
incomplete phone number, and that single record demonstrates accuracy,
completeness and validity failing at once" is a strong one.

## 4. The depth topic

**[WRITE]** State explicitly which topic was taken to depth (**Data and
information management**) and justify the choice. The argument available to
you: it is the only one of the five that can be *demonstrated* rather than
described, and all four other topics depend on it.

Then show the depth concretely — the row-versus-record comparison, the metadata
envelope, the six quality dimensions tested against the shop's own records, the
two-severity validation design, the dashboard anatomy, and the six measures.

## 5. The demonstration

**[WRITE]** Explain what was built and why it was worth building rather than
describing. Cover:

- The capture → validate → store → reuse → analyse flow.
- Why records are wrapped in a `_meta` envelope, and what each field answers.
- Why validation has two severities and what happens when a system refuses
  every exception.
- Why documents are generated from records rather than typed, and what the
  provenance line at the bottom of each one is for.
- Why the data is a seeded generator — the same figures appear in the rehearsal
  and in the real pitch.
- Why only the user's changes are persisted rather than the whole data set.
- Why migrated records are deliberately marked `unverified`.

## 6. Design and accessibility decisions

**[WRITE]** Cover: one shared stylesheet, consistent page skeleton, the on-page
contents lists, reading-width limits, the plain-language glossary, heading
hierarchy, alt text and ARIA on the diagrams, keyboard navigation, mobile
layout, and the decision to use no external libraries so the site works offline
on any machine.

## 7. Team contributions

See `contributions.md` — bring it into this document before exporting the PDF.

## 8. AI Disclaimer

**[WRITE — but these are the facts, state them accurately]**

Artificial intelligence (Claude, used through Claude Code) was used as a
productivity tool for the **technical construction** of the website, which the
brief expressly permits. Specifically, AI assistance was used for:

- the HTML page structure and the shared CSS stylesheet;
- the JavaScript of the live demonstration — the record store, the validation
  engine, the schema-driven capture form, the document generator and the
  analytics and charting code;
- the invented demonstration data set and the seeded generator that produces
  twelve months of trading figures;
- the inline SVG diagrams;
- debugging, layout and accessibility fixes;
- the structure and headings of this rationale document.

The scaffolding AI produced also included **draft on-page text**: table
contents, diagram labels, callout boxes, card summaries, worked examples drawn
from the demonstration data, and short connective sentences between sections.

**This is the part the team must deal with honestly.** The brief permits AI for
technical construction but not for generating the website's written content, and
that draft text crosses the line. Before submission the team must go through
every page and rewrite that prose in their own words, verifying each factual
claim as they go. The structure, the code, the diagrams and the data set can
stay; the words a visitor reads must be the team's.

The 36 drafting placeholders marked "Team writes this" are the sections where no
draft text was produced at all — they contain only a brief setting out what to
cover and where to look it up.

**[WRITE]** State plainly in the final version which of these two categories
each part of the site fell into, and confirm that all AI-drafted prose was
rewritten. An accurate, specific disclaimer is far more convincing than a vague
one, and the lecturer is likely to ask about it directly in Q&A.

**[WRITE]** Add: who in the team operated the AI tooling, roughly how much of
the session time it accounted for, and one honest sentence about what the team
learned from the process. A disclaimer that reads as defensive is less
convincing than one that reads as matter-of-fact.

---

### Before exporting to PDF

- [ ] Every **[WRITE]** replaced
- [ ] Contributions section brought in from `contributions.md`
- [ ] AI disclaimer checked against what actually happened — do not overstate
      or understate it
- [ ] Reference list included and consistent in style
- [ ] Proofread by someone who did not write it
