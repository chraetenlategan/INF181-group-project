# -*- coding: utf-8 -*-
"""Work allocation pack for the INF1781 group project.

Assigns every outstanding task to one of four students and gives each task a
shaded typing box, so a filled-in copy maps straight back onto the website.
"""
import json, copy
from docx import Document
from docx.shared import Pt, RGBColor, Inches, Emu
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

todos = json.load(open('todos.json'))

PREFIX = {'index.html':'HM','pages/data-management.html':'DM','pages/ethics-privacy.html':'EP',
          'pages/ai-decision-support.html':'AI','pages/enterprise-systems.html':'ES',
          'pages/adapting-is.html':'MF','pages/roadmap.html':'RM','pages/glossary.html':'GL',
          'pages/references.html':'RF','login.html':'LG'}
counters = {}
for t in todos:
    pfx = PREFIX[t['page']]
    counters[pfx] = counters.get(pfx, 0) + 1
    t['id'] = '%s-%02d' % (pfx, counters[pfx])
byid = {t['id']: t for t in todos}

PAGE_TITLE = {'index.html':'Home','pages/data-management.html':'Data & information management',
  'pages/ethics-privacy.html':'POPIA & data ethics','pages/ai-decision-support.html':'AI & decision support',
  'pages/enterprise-systems.html':'Enterprise systems & integration','pages/adapting-is.html':'Making it fit',
  'pages/roadmap.html':'Roadmap','pages/glossary.html':'Glossary','pages/references.html':'Sources',
  'login.html':'Staff sign-in'}

GLOSSARY = {
 1:['Data','Information','Knowledge','Metadata','Record versus row','Schema','Master data',
    'Transaction data','Information quality','Validation'],
 2:['POPIA','Processing (POPIA)','Data subject','Responsible party','Information Officer',
    'Consent (POPIA)','Retention','Audit trail','Backup','Provenance','Referential integrity'],
 3:['API','Batch versus real-time','CRM','Data migration','Data silo / islands of data','ERP',
    'Integration','Point of sale (POS)','Single source of truth','Vendor lock-in',
    'Descriptive analytics','Diagnostic analytics','Predictive analytics','Prescriptive analytics',
    'Structured decision','Unstructured decision'],
 4:['Dead stock','Gross margin','Lead time','Shrinkage','Stock turn','Tax invoice',
    'Fit-gap analysis','Progressive disclosure','Total cost of ownership'],
}

PEOPLE = [
 dict(n=1, role='Depth topic owner',
   owns=['Data & information management (the depth topic)'],
   tasks=['DM-01','DM-02','DM-03','DM-04','DM-05','DM-06','DM-07','DM-08','DM-09','DM-10'],
   extra=['Rewrite the draft prose on the data page in your own words — the tables, callouts, card summaries and the sentences between sections.',
          'Write the design-rationale section covering the depth topic, and be ready to defend why it was chosen.',
          'Final proofread of the whole site once everyone else has finished.'],
   note='Yours is the biggest writing load, roughly 3 000 words, because the depth topic carries its own 5% plus most of the 20% content mark. The other three pages lean on yours, so finishing early helps everybody.'),
 dict(n=2, role='Compliance & evidence owner',
   owns=['POPIA & data ethics','Sources','Staff sign-in'],
   tasks=['EP-01','EP-02','EP-03','EP-04','RF-01','LG-01'],
   extra=['Verify every POPIA section number used anywhere on the site against the Act itself. They are deliberately marked "verify before relying on this" at the moment.',
          'Work down all 17 rows of the sourcing checklist on the Sources page and find a real source for each.',
          'Assemble the final reference list in the required citation style.',
          'Rewrite the draft prose on your three pages in your own words.'],
   note='Fewer writing tasks than the others, but by far the heaviest research load. Ethics, privacy and security is a marked sub-topic worth 5% on its own, and "all claims supported with appropriate sources" is what separates Excellent from Good on the 20% content mark.'),
 dict(n=3, role='Systems owner · presentation lead',
   owns=['AI & decision support','Enterprise systems & integration'],
   tasks=['AI-01','AI-02','AI-03','AI-04','ES-01','ES-02','ES-03','ES-04','ES-05'],
   extra=['Rewrite the draft prose on both your pages in your own words.',
          'Research and name actual South African software options you have verified, for the vendor section.',
          'Own the presentation: structure it, set the running order, book the rehearsals and run them.'],
   note='Two marked sub-topics sit on your pages — Enterprise Systems and Integration (5%) and Analytics and Decision Support (5%). The honest "you are not ready for AI yet" argument is the one most likely to be challenged in Q&A, so make sure you can defend it.'),
 dict(n=4, role='Client narrative owner · project lead',
   owns=['Home','Making it fit','Roadmap'],
   tasks=['HM-01','HM-02','MF-01','MF-02','MF-03','MF-04','MF-05','RM-01','RM-02','RM-03'],
   extra=['Research real vendor pricing and fill in every "R ____" on the roadmap cost table, with the date you checked each one.',
          'Rewrite the draft prose on your three pages in your own words.',
          'Project lead: track milestones and deadlines, chase what is outstanding, and assemble the final design-rationale PDF.',
          'Deploy and test on the actual presentation machine before the day.'],
   note='You own the first page the client reads and the last — the problem statement and the recommendation. Those two have to agree with each other. The closing recommendation on the roadmap is the paragraph the lecturer is most likely to push on in Q&A.'),
]

TEAL  = RGBColor(0x0E,0x6B,0x66)
SLATE = RGBColor(0x35,0x49,0x5A)
FAINT = RGBColor(0x6B,0x82,0x99)
AMBER = RGBColor(0xB0,0x6A,0x00)
FONT  = 'Aptos'
W_TOTAL = 9360   # usable width in DXA, A4 with 0.75" margins

doc = Document()
# --- base styles ---
st = doc.styles['Normal']
st.font.name = FONT; st.font.size = Pt(10.5); st.font.color.rgb = SLATE
st.element.rPr.rFonts.set(qn('w:eastAsia'), FONT)
st.paragraph_format.space_after = Pt(6)
st.paragraph_format.line_spacing = 1.08

for name, size, colour, before, after in [
        ('Heading 1', 15, TEAL,  14, 7),
        ('Heading 2', 12, SLATE, 11, 5),
        ('Heading 3', 10.5, TEAL, 9, 4)]:
    s = doc.styles[name]
    s.font.name = FONT; s.font.size = Pt(size); s.font.color.rgb = colour; s.font.bold = True
    s.paragraph_format.space_before = Pt(before); s.paragraph_format.space_after = Pt(after)
    s.font.element.rPr.rFonts.set(qn('w:eastAsia'), FONT)

sec = doc.sections[0]
for attr in ('top_margin','bottom_margin','left_margin','right_margin'):
    setattr(sec, attr, Inches(0.75))

# --- helpers ---
def para(text='', size=10.5, bold=False, italic=False, colour=None, after=6, before=0, style=None):
    pg = doc.add_paragraph(style=style)
    pg.paragraph_format.space_after = Pt(after)
    pg.paragraph_format.space_before = Pt(before)
    if text:
        r = pg.add_run(text)
        r.font.name = FONT; r.font.size = Pt(size); r.bold = bold; r.italic = italic
        r.font.color.rgb = colour or SLATE
    return pg

def rich(parts, after=6, before=0, style=None):
    pg = doc.add_paragraph(style=style)
    pg.paragraph_format.space_after = Pt(after)
    pg.paragraph_format.space_before = Pt(before)
    for txt, bold, colour, size in parts:
        r = pg.add_run(txt)
        r.font.name = FONT; r.font.size = Pt(size); r.bold = bold
        r.font.color.rgb = colour or SLATE
    return pg

def bullet(text, size=10):
    pg = doc.add_paragraph(style='List Bullet')
    pg.paragraph_format.space_after = Pt(3)
    r = pg.add_run(text)
    r.font.name = FONT; r.font.size = Pt(size); r.font.color.rgb = SLATE
    return pg

def heading(text, level, keep=True):
    pg = doc.add_paragraph(text, style='Heading %d' % level)
    pg.paragraph_format.keep_with_next = keep
    return pg

def keep(pg):
    """Bind a paragraph to the one after it, so headings do not orphan."""
    pg.paragraph_format.keep_with_next = True
    return pg

def page_break():
    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

def shade(cell, hexfill):
    sh = OxmlElement('w:shd')
    sh.set(qn('w:val'), 'clear'); sh.set(qn('w:color'), 'auto'); sh.set(qn('w:fill'), hexfill)
    cell._tc.get_or_add_tcPr().append(sh)

def set_borders(table, colour='C3CFDA', size=4, box_only=False, box_colour=None, box_size=None):
    tblPr = table._tbl.tblPr
    for old in tblPr.findall(qn('w:tblBorders')):
        tblPr.remove(old)
    b = OxmlElement('w:tblBorders')
    edges = ['top','left','bottom','right'] + ([] if box_only else ['insideH','insideV'])
    for e in edges:
        el = OxmlElement('w:' + e)
        is_box = e in ('top','left','bottom','right')
        el.set(qn('w:val'), 'single')
        el.set(qn('w:sz'), str(box_size if (is_box and box_size) else size))
        el.set(qn('w:color'), (box_colour if (is_box and box_colour) else colour))
        b.append(el)
    if box_only:
        for e in ('insideH','insideV'):
            el = OxmlElement('w:' + e); el.set(qn('w:val'), 'none'); b.append(el)
    tblPr.append(b)

def set_widths(table, widths):
    table.autofit = False
    for row in table.rows:
        for i, c in enumerate(row.cells):
            c.width = Emu(widths[i] * 635)      # DXA -> EMU
    return table

def cell_text(cell, text, size=9.5, bold=False, colour=None, after=0):
    cell.text = ''
    pg = cell.paragraphs[0]
    pg.paragraph_format.space_after = Pt(after)
    pg.paragraph_format.space_before = Pt(1)
    r = pg.add_run(text)
    r.font.name = FONT; r.font.size = Pt(size); r.bold = bold
    r.font.color.rgb = colour or SLATE

def set_row_height(row, points):
    trPr = row._tr.get_or_add_trPr()
    h = OxmlElement('w:trHeight')
    h.set(qn('w:val'), str(int(points * 20)))
    h.set(qn('w:hRule'), 'atLeast')
    trPr.append(h)

def data_table(headers, rows, widths, blank_cols=(), row_pts=None):
    t = doc.add_table(rows=1 + len(rows), cols=len(headers))
    t.alignment = WD_TABLE_ALIGNMENT.LEFT
    set_borders(t)
    for i, h in enumerate(headers):
        cell_text(t.rows[0].cells[i], h, size=9, bold=True)
        shade(t.rows[0].cells[i], 'EEF2F6')
    for ri, row in enumerate(rows, start=1):
        for ci, val in enumerate(row):
            cell_text(t.rows[ri].cells[ci], str(val), size=9.5,
                      colour=FAINT if ci in blank_cols else SLATE)
            if ci in blank_cols:
                shade(t.rows[ri].cells[ci], 'FFFDF6')
        if row_pts:
            set_row_height(t.rows[ri], row_pts)
    set_widths(t, widths)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return t

def answer_box(task_id, lines=7):
    """A shaded single-cell box with room to type."""
    t = doc.add_table(rows=1, cols=1)
    set_borders(t, box_only=True, box_colour='D98500', box_size=8)
    c = t.rows[0].cells[0]
    shade(c, 'FFFDF6')
    cell_text(c, 'TYPE YOUR ANSWER FOR %s BELOW THIS LINE' % task_id,
              size=8.5, bold=True, colour=AMBER, after=3)
    for _ in range(lines):
        pg = c.add_paragraph()
        pg.paragraph_format.space_after = Pt(3)
    set_widths(t, [W_TOTAL])
    doc.add_paragraph().paragraph_format.space_after = Pt(3)
    return t

# ============================= CONTENT ======================================
rich([('INF1781 GROUP PROJECT', True, TEAL, 9.5)], after=3)
rich([('Work allocation and writing pack', True, SLATE, 22)], after=5)
para('Scenario 2 — SME Digital Transformation · Lerato’s Hardware & Home', size=11.5, colour=FAINT, after=2)
para('Live site: https://chraetenlategan.github.io/INF181-group-project/', size=9.5, colour=FAINT, after=10)

heading('How to use this document', 1)
para('Every outstanding task on the project is listed here and assigned to one of four people. '
     'Each task has a short brief — what to cover, which demonstration screen proves it, and where to '
     'look the facts up — followed by a shaded box to type your answer into.')
rich([('Type inside the shaded boxes only. ', True, SLATE, 10.5),
      ('Do not change the task IDs or the headings above them — they are how your writing gets matched '
       'back to the exact spot on the website.', False, SLATE, 10.5)], after=4)
para('Write in full sentences and paragraphs — the finished thing a visitor will read, not notes. '
     'The word counts are guides, not limits.', after=4)

heading('Two kinds of work', 2)
bullet('The 36 numbered tasks below. These are the places where the website currently shows an orange '
       'placeholder box and no draft text at all. Write them from scratch.')
bullet('Rewriting the draft prose already on your pages — the tables, callouts, card summaries, examples '
       'and the sentences between sections. That text was AI-drafted as scaffolding. The brief allows AI '
       'to help build the site but not to write what a visitor reads, so it must be rewritten in your own '
       'words and every factual claim in it checked.')
rich([('Keep ', True, SLATE, 10.5),
      ('the structure, the layout, the diagrams, the live demonstration and its data set.  ', False, SLATE, 10.5),
      ('Rewrite ', True, SLATE, 10.5),
      ('anything a visitor reads.', False, SLATE, 10.5)])

heading('Sending it back', 2)
para('Fill in your own part, save the file, and upload it. One person can collect all four parts into a '
     'single copy, or each person can send their own — either works, because every task ID is unique.')

heading('Ground rules for everybody', 2)
for b in ['Write for Lerato, not for the lecturer. Short sentences. Any technical term gets a '
          'plain-language explanation the first time it appears.',
          'South African throughout: rands, VAT, POPIA (never GDPR), SARS, load shedding, Yoco and '
          'SnapScan, local suppliers.',
          'Be honest about trade-offs. The brief asks for it and the rubric rewards it. A page that only '
          'sells the upside scores badly.',
          'Every factual claim needs a source. Add it to the Sources page as you go — do not leave it to the end.',
          'Use the demonstration. Each brief names the screen that proves its point; pointing at a real '
          'number beats asserting one.',
          'Never state a POPIA section number, a SARS retention period or a software price from memory. '
          'Check it, then cite it.']:
    bullet(b)
page_break()

heading('Who does what', 1)
data_table(['Person','Role','Pages owned','Tasks'],
           [['Person %d' % p['n'], p['role'], '; '.join(p['owns']),
             '%d  + glossary' % len(p['tasks'])] for p in PEOPLE],
           [1150, 2050, 4300, 1860])
para('Swap these around if it suits the group better — but write down who ended up with what. The '
     'contributions section is a marked requirement, and the Q&A may put questions to individuals.',
     italic=True, size=10, colour=FAINT)

heading('Names', 2)
para('Fill this in first, then keep it with the project.', size=10, colour=FAINT)
data_table(['Person','Full name','Student number','Signed off by'],
           [['Person %d' % p['n'], '', '', ''] for p in PEOPLE],
           [1150, 3400, 2405, 2405], blank_cols=(1,2,3), row_pts=22)

heading('Review pairs', 2)
para('Nobody signs off their own work. Person 1 and Person 2 check each other; Person 3 and Person 4 '
     'check each other. It catches errors cheaply, and it is the evidence of collaboration the rubric '
     'asks for — teamwork is 10% on its own.')
page_break()

for idx, prs in enumerate(PEOPLE):
    heading('Person %d — %s' % (prs['n'], prs['role']), 1)
    rich([('Pages you own: ', True, SLATE, 10.5), (', '.join(prs['owns']), False, SLATE, 10.5)])
    para(prs['note'], italic=True, size=10, colour=FAINT, after=10)

    heading('Besides the writing tasks', 2)
    for x in prs['extra']:
        bullet(x)

    heading('Your writing tasks', 2)
    last_page = None
    for tid in prs['tasks']:
        t = byid[tid]
        if t['page'] != last_page:
            heading('%s   ·   %s' % (PAGE_TITLE[t['page']], t['page']), 3)
            last_page = t['page']
        keep(rich([(t['id'] + '   ', True, AMBER, 11), (t['task'], True, SLATE, 11)], before=7, after=2))
        keep(rich([('Where it goes:  ', True, FAINT, 9),
                   ('the orange box under the heading “%s”' % t['section'], False, FAINT, 9)], after=4))
        keep(para('Cover, in your own words:', size=9.5, after=2))
        for b in t['bullets']:
            bullet(b, size=9.5)
        if t['evidence']:
            rich([('Evidence you can point at:  ', True, SLATE, 9.5), (t['evidence'], False, SLATE, 9.5)], after=3)
        if t['sources']:
            rich([('Where to look it up:  ', True, SLATE, 9.5), (t['sources'], False, SLATE, 9.5)], after=3)
        answer_box(t['id'])

    heading('Your glossary terms', 2)
    para('One or two plain sentences each, plus this shop’s own example — “at Lerato’s this '
         'is…”. A definition without an example will not be remembered, and in Q&A any member may '
         'be asked to define any term on the site.', size=10)
    data_table(['Term','What it means, in plain language','At Lerato’s'],
               [[term, '', ''] for term in GLOSSARY[prs['n']]],
               [2150, 4150, 3060], blank_cols=(1,2), row_pts=40)
    if idx < len(PEOPLE) - 1:
        page_break()

page_break()
heading('Everyone — before submission', 1)

heading('The glossary, collectively', 2)
para('The 46 terms are split four ways above. Once they are written, swap and check each other’s. '
     'The glossary is the one place where a wrong definition is most likely to be spotted by the marker.')

heading('Design rationale (the PDF submitted on BC Connect)', 2)
para('Each person writes the rationale for their own pages: the headings, why those headings, the content '
     'under each, and why it was included. Person 4 assembles. The skeleton is in '
     'docs/design-rationale.md in the project folder.')
for b in ['Person 1 — the depth topic, and the justification for choosing it',
          'Person 2 — POPIA and ethics, and the AI disclaimer stated accurately',
          'Person 3 — systems and integration, and the demonstration write-up',
          'Person 4 — the client narrative, the roadmap, and final assembly']:
    bullet(b)

heading('Everyone must be able to do this without notes', 2)
for b in ['Explain the difference between a spreadsheet row and a stored record, and why it matters to this client',
          'Define metadata, and give three fields from the envelope and what each one answers',
          'Name the information quality dimensions, with the shop’s own example of each',
          'Explain why validation has two severities rather than one',
          'Name the four POPIA questions the shop must be able to answer',
          'Explain why the team did not recommend AI forecasting for this client yet',
          'Explain islands of data, and single source of truth',
          'Explain the difference between configuring and customising, and why it matters',
          'Walk through the roadmap and defend the ordering',
          'Name one thing the team advised the client NOT to spend money on, and why',
          'Drive the live demonstration: capture a sale, break a rule, generate an invoice, produce a POPIA report',
          'Say honestly how AI was used on the project']:
    bullet(b)

heading('Final checklist', 2)
for b in ['Every orange placeholder box deleted from the HTML — they are visible on the live site',
          'All AI-drafted prose rewritten in the team’s own words',
          'Every POPIA section number verified against the Act',
          'Every rand figure on the roadmap filled in, with the date it was checked',
          'All 17 rows of the sourcing checklist sourced, and the reference list assembled',
          'All 46 glossary definitions written and cross-checked',
          'Site tested on the presentation machine, with a copy on a USB stick as backup',
          'An invoice printed to PDF from the demonstration, to confirm the print layout',
          'Design rationale exported to PDF, with contributions and the AI disclaimer',
          'Proofread by somebody who did not write it']:
    bullet(b)

core = doc.core_properties
core.title = 'INF1781 — work allocation and writing pack'
core.author = 'INF1781 Group Project'
core.comments = 'Task allocation for four students, with typing areas for each section of the website.'

out = '/home/chraeten/Downloads/INF181/INF1781-work-allocation.docx'
doc.save(out)
print('written:', out)
print('tasks allocated:', sum(len(p['tasks']) for p in PEOPLE), '+ 1 shared glossary task =',
      sum(len(p['tasks']) for p in PEOPLE) + 1, 'of', len(todos))
print('glossary terms:', sum(len(v) for v in GLOSSARY.values()))
