# -*- coding: utf-8 -*-
"""Read a filled-in allocation pack and pull out what the students typed.

Maps each answer back to its task ID, and each glossary row back to its term,
so the writing can be dropped onto the website without hunting for it.
"""
import sys, re, json
from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph
from docx.oxml.ns import qn

PROMPT = re.compile(r'^TYPE YOUR ANSWER FOR ([A-Z]{2}-\d{2}) BELOW THIS LINE\s*$')

def body_items(doc):
    for child in doc.element.body.iterchildren():
        if child.tag == qn('w:p'):
            yield Paragraph(child, doc)
        elif child.tag == qn('w:tbl'):
            yield Table(child, doc)

def read(path):
    doc = Document(path)
    answers, glossary, names = {}, {}, []
    for item in body_items(doc):
        if not isinstance(item, Table):
            continue
        rows = item.rows
        head = [c.text.strip() for c in rows[0].cells]

        # Answer box: one cell, first line is the prompt.
        if len(rows) == 1 and len(rows[0].cells) == 1:
            lines = [p.text.rstrip() for p in rows[0].cells[0].paragraphs]
            m = PROMPT.match(lines[0].strip()) if lines else None
            if m:
                text = '\n'.join(l for l in lines[1:]).strip()
                answers[m.group(1)] = text
            continue

        # Glossary table.
        if head[:1] == ['Term'] and len(head) == 3:
            for r in rows[1:]:
                term = r.cells[0].text.strip()
                if not term:
                    continue
                glossary[term] = {
                    'definition': r.cells[1].text.strip(),
                    'example':    r.cells[2].text.strip(),
                }
            continue

        # Names table.
        if head[:2] == ['Person', 'Full name']:
            for r in rows[1:]:
                names.append({
                    'person':  r.cells[0].text.strip(),
                    'name':    r.cells[1].text.strip(),
                    'student': r.cells[2].text.strip(),
                    'checked': r.cells[3].text.strip(),
                })
            continue

    return answers, glossary, names

if __name__ == '__main__':
    a, g, n = read(sys.argv[1])
    filled_a = {k: v for k, v in a.items() if v}
    filled_g = {k: v for k, v in g.items() if v['definition'] or v['example']}
    filled_n = [x for x in n if x['name']]
    print('answer boxes found : %d  (filled: %d)' % (len(a), len(filled_a)))
    print('glossary terms     : %d  (filled: %d)' % (len(g), len(filled_g)))
    print('names rows         : %d  (filled: %d)' % (len(n), len(filled_n)))
    print('empty tasks        :', ', '.join(sorted(k for k in a if not a[k])) or 'none')
    if len(sys.argv) > 2 and sys.argv[2] == '-v':
        for k in sorted(filled_a):
            print('\n--- %s (%d words) ---' % (k, len(filled_a[k].split())))
            print(filled_a[k][:300])
        for k, v in filled_g.items():
            print('\nGLOSSARY %s :: %s | %s' % (k, v['definition'][:70], v['example'][:50]))
        for x in filled_n:
            print('NAME', x)
