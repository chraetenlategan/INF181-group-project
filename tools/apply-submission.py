# -*- coding: utf-8 -*-
"""Drop a filled-in allocation pack onto the website.

Reads Submission.docx with the standard library only (no python-docx needed),
matches every answer box back to its task ID, and replaces the matching orange
placeholder in the HTML with the team's writing. Glossary rows are matched by
term. Anything still blank in the pack is left as a placeholder.

    python3 tools/apply-submission.py Submission.docx
"""
import html
import json
import re
import sys
import zipfile
from xml.etree import ElementTree as ET

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
NS = {'w': W[1:-1]}
PROMPT = re.compile(r'^TYPE YOUR ANSWER FOR ([A-Z]{2}-\d{2}) BELOW THIS LINE\s*(.*)$')
TASK_ID = re.compile(r'^([A-Z]{2}-\d{2})\b')

# Task IDs in the order their placeholders appear on each page. Verified against
# tools/tasks.json, which is what build-allocation-pack.py numbered them from.
PAGES = [
    ('index.html',                     ['HM-01', 'HM-02']),
    ('login.html',                     ['LG-01']),
    ('pages/data-management.html',     ['DM-%02d' % i for i in range(1, 11)]),
    ('pages/ethics-privacy.html',      ['EP-01', 'EP-02', 'EP-03', 'EP-04']),
    ('pages/ai-decision-support.html', ['AI-01', 'AI-02', 'AI-03', 'AI-04']),
    ('pages/enterprise-systems.html',  ['ES-01', 'ES-02', 'ES-03', 'ES-04', 'ES-05']),
    ('pages/adapting-is.html',         ['MF-01', 'MF-02', 'MF-03', 'MF-04', 'MF-05']),
    ('pages/roadmap.html',             ['RM-01', 'RM-02', 'RM-03']),
    ('pages/glossary.html',            ['GL-01']),
    ('pages/references.html',          ['RF-01']),
]


# ---------------------------------------------------------------- reading .docx

def para_text(p):
    out = []
    for n in p.iter():
        if n.tag == W + 't':
            out.append(n.text or '')
        elif n.tag == W + 'tab':
            out.append('\t')
        elif n.tag == W + 'br':
            out.append('\n')
    return ''.join(out)


def cell_lines(tc):
    return [para_text(p) for p in tc.findall('w:p', NS)]


def cell_text(tc):
    return '\n'.join(cell_lines(tc)).strip()


def read_pack(path):
    body = ET.fromstring(zipfile.ZipFile(path).read('word/document.xml')).find('w:body', NS)
    answers, glossary, names, current = {}, {}, [], None
    for el in body:
        tag = el.tag.split('}')[1]
        if tag == 'p':
            text = para_text(el).strip()
            m = TASK_ID.match(text)
            if m and len(text) > 10:          # the task heading, not a stray mention
                current = m.group(1)
            continue
        if tag != 'tbl':
            continue
        rows = el.findall('w:tr', NS)
        if not rows:
            continue
        first = rows[0].findall('w:tc', NS)
        head = [cell_text(c) for c in first]

        # An answer box: a single shaded cell. The prompt line is normally intact,
        # but a student who typed over it still leaves the answer in position.
        if len(rows) == 1 and len(first) == 1:
            lines = cell_lines(first[0])
            tid, keep = current, lines
            if lines:
                m = PROMPT.match(lines[0].strip())
                if m:
                    tid = m.group(1)
                    keep = ([m.group(2)] if m.group(2).strip() else []) + lines[1:]
            if tid:
                answers[tid] = '\n'.join(keep).strip()
            continue

        if head[:1] == ['Term'] and len(head) == 3:
            for r in rows[1:]:
                c = r.findall('w:tc', NS)
                term = cell_text(c[0])
                if term:
                    glossary[term] = {'definition': cell_text(c[1]), 'example': cell_text(c[2])}
            continue

        if head[:2] == ['Person', 'Full name']:
            for r in rows[1:]:
                names.append([cell_text(c) for c in r.findall('w:tc', NS)])
    return answers, glossary, names


# ------------------------------------------------------------- prose -> markup

SENT_SPLIT = re.compile(r'(?<=[.!?”"])\s{2,}')
ORDERED = re.compile(r'^\(?(\d{1,2})[.)]\s+')
BULLET = re.compile(r'^[-•–*]\s+')


def inline(text):
    text = html.escape(text, quote=False)
    text = re.sub(r'`([^`]+)`', r'<code>\1</code>', text)
    return text.strip()


def paragraphs(answer):
    """One list entry per paragraph the student typed, long runs broken up."""
    out = []
    for line in answer.split('\n'):
        line = line.strip()
        if not line:
            continue
        # Word paragraphs that swallowed several paragraphs' worth of text are
        # split again at sentence ends followed by a deliberate double space.
        parts = SENT_SPLIT.split(line) if len(line) > 400 else [line]
        out.extend(p.strip() for p in parts if p.strip())
    return out


def render(answer, indent='    '):
    blocks, buf, kind = [], [], None

    def flush():
        if not buf:
            return
        if kind == 'ol':
            items = ''.join('<li>%s</li>' % inline(x) for x in buf)
            blocks.append('<ol>%s</ol>' % items)
        elif kind == 'ul':
            items = ''.join('<li>%s</li>' % inline(x) for x in buf)
            blocks.append('<ul>%s</ul>' % items)
        buf.clear()

    for para in paragraphs(answer):
        if ORDERED.match(para):
            if kind != 'ol':
                flush()
            kind = 'ol'
            buf.append(ORDERED.sub('', para))
            continue
        if BULLET.match(para):
            if kind != 'ul':
                flush()
            kind = 'ul'
            buf.append(BULLET.sub('', para))
            continue
        flush()
        kind = None
        if len(para) <= 90 and para.endswith(':'):
            blocks.append('<p><strong>%s</strong></p>' % inline(para))
        else:
            blocks.append('<p>%s</p>' % inline(para))
    flush()
    return '\n'.join(indent + b for b in blocks)


# ------------------------------------------------------------------ the rewrite

def todo_spans(source):
    """Start and end offsets of every <div class="todo"> block, in page order."""
    spans = []
    for m in re.finditer(r'<div class="todo">', source):
        depth, end = 0, None
        for t in re.finditer(r'<div\b|</div>', source[m.start():]):
            if t.group(0) == '</div>':
                depth -= 1
                if depth == 0:
                    end = m.start() + t.end()
                    break
            else:
                depth += 1
        spans.append((m.start(), end))
    return spans


GLOSSARY_CELL = re.compile(
    r'<td><strong>(?P<term>[^<]+)</strong></td>\s*\n'
    r'\s*<td><span class="todo__tag"[^>]*>team writes</span>\s*\n'
    r'\s*<span class="muted"[^>]*>[^<]*</span></td>')


def fill_glossary(source, glossary):
    filled = []

    def repl(m):
        term = html.unescape(m.group('term')).strip()
        entry = glossary.get(term)
        if not entry or not (entry['definition'] or entry['example']):
            return m.group(0)
        filled.append(term)
        cell = inline(entry['definition'])
        if entry['example']:
            cell += ' <span class="muted">At Lerato\'s: %s</span>' % inline(entry['example'])
        return '<td><strong>%s</strong></td>\n      <td>%s</td>' % (m.group('term'), cell)

    return GLOSSARY_CELL.sub(repl, source), filled


def main(pack):
    answers, glossary, names = read_pack(pack)
    report = []

    for page, ids in PAGES:
        source = open(page, encoding='utf-8').read()
        before = source

        if page == 'pages/glossary.html':
            source, filled = fill_glossary(source, glossary)
            report.append('%-32s glossary: %d of %d terms written'
                          % (page, len(filled), len(glossary)))
            remaining = source.count('>team writes<')
            if remaining == 0:
                spans = todo_spans(source)
                if spans:
                    s, e = spans[0]
                    source = source[:s].rstrip('\n ') + source[e:]
            else:
                report.append('%-32s %d terms still blank — placeholder kept'
                              % ('', remaining))
        else:
            spans = todo_spans(source)
            if len(spans) != len(ids):
                sys.exit('%s: expected %d placeholders, found %d'
                         % (page, len(ids), len(spans)))
            done = []
            for (s, e), tid in reversed(list(zip(spans, ids))):
                text = answers.get(tid, '').strip()
                if not text:
                    continue
                line_start = source.rfind('\n', 0, s) + 1
                indent = source[line_start:s]
                shared = bool(indent.strip())
                if shared:                    # something else sits on the line
                    line_start, indent = s, '    '
                elif not indent:              # placeholder sat hard against the margin
                    prev = [l for l in source[:line_start].split('\n') if l.strip()]
                    indent = re.match(r'[ \t]*', prev[-1]).group(0) if prev else '    '
                block = render(text, indent)
                if shared:
                    block = block.lstrip(' \t')
                source = source[:line_start] + block + source[e:]
                done.append(tid)
            missing = [t for t in ids if t not in done]
            report.append('%-32s %d of %d written%s'
                          % (page, len(done), len(ids),
                             '  (still blank: %s)' % ', '.join(missing) if missing else ''))

        if source != before:
            open(page, 'w', encoding='utf-8').write(source)

    print('\n'.join(report))
    print('\nnames:', json.dumps(names, ensure_ascii=False))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'Submission.docx')
