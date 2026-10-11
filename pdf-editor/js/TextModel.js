/* ═══════════════════════════════════════════════════════════════════════════
   TextModel.js — words → lines → blocks, and the one layout engine.

   Two responsibilities:

   1. GROUPING. Whatever the text came from (a real PDF text layer or an OCR
      pass over a raster) it arrives as a bag of word boxes in millimetres.
      This file turns that into lines, and lines into paragraph blocks — the
      unit the user actually clicks on and edits.

   2. LAYOUT. `layout()` is the single authority on where re-typeset text
      lands. Both renderers call it: the on-screen overlay and the PDF
      exporter. That is deliberate — if the screen wrapped text one way and
      the exporter another, the preview would be lying, which is exactly the
      failure mode this tool exists to remove.

   All geometry in millimetres on the A4 sheet, origin top-left.
   ═══════════════════════════════════════════════════════════════════════════ */

window.PGText = (function () {
  'use strict';

  const T = window.PGTPL;

  // Measuring canvas. Text is measured at a fixed 20 px per mm so that
  // rounding in measureText() is far below anything visible on the page, then
  // divided back down to mm.
  const MEAS_PPMM = 20;
  const _measCanvas = document.createElement('canvas');
  const _meas = _measCanvas.getContext('2d');

  function fontSpec(sizePt, bold, italic, pxPerMm) {
    const px = T.ptToMm(sizePt) * pxPerMm;
    return (italic ? 'italic ' : '') + (bold ? '600 ' : '400 ') +
           px.toFixed(3) + 'px "' + T.BODY_FONT + '", sans-serif';
  }

  // Width of a string in mm at a given point size.
  function widthMm(str, sizePt, bold, italic) {
    _meas.font = fontSpec(sizePt, bold, italic, MEAS_PPMM);
    return _meas.measureText(str).width / MEAS_PPMM;
  }

  /* ── Inline marks (bold / underline on part of a block) ──────────────────
     A block is one style by default (block.bold / block.italic). When the user
     bolds or underlines part of it, block.marks holds one bitmask per character
     of block.text: M_BOLD | M_UNDER. Absolute, not relative to the block — a
     heading that is bold throughout carries M_BOLD on every character, and a
     word un-bolded inside it carries 0. null means "no marks", and a block
     with no marks takes exactly the old single-style path everywhere.
     Italic stays block-wide: OCR cannot read it and nobody has asked for it. */
  const M_BOLD = 1, M_UNDER = 2;

  function plainMark(block) { return block.bold ? M_BOLD : 0; }

  function hasMarks(block) {
    const m = block.marks;
    if (!m) return false;
    const p = plainMark(block);
    for (let i = 0; i < m.length; i++) if (m[i] !== p) return true;
    return false;
  }

  function markAt(block, i) {
    const m = block.marks;
    return m && m[i] != null ? m[i] : plainMark(block);
  }

  // block.text[s, e) as runs of one style each.
  function runsOf(block, s, e) {
    const runs = [];
    for (let i = s; i < e; i++) {
      const k = markAt(block, i);
      const last = runs[runs.length - 1];
      if (last && last.mark === k) last.text += block.text[i];
      else runs.push({ text: block.text[i], mark: k, bold: !!(k & M_BOLD), underline: !!(k & M_UNDER) });
    }
    return runs;
  }

  function widthRuns(block, s, e) {
    let w = 0;
    for (const r of runsOf(block, s, e)) w += widthMm(r.text, block.sizePt, r.bold, block.italic);
    return w;
  }

  /* A marked line, broken into word-sized pieces positioned in mm, plus the
     underline spans. Spaces get the justification gap, exactly as the plain
     path's word-by-word placement does. Both renderers draw these as-is. */
  function segmentsOf(block, s, e, x0, wordSpaceMm) {
    const segs = [], unders = [];
    let x = x0;
    for (const r of runsOf(block, s, e)) {
      for (const piece of r.text.split(/( )/)) {
        if (!piece) continue;
        let w = widthMm(piece, block.sizePt, r.bold, block.italic);
        if (piece === ' ') w += wordSpaceMm;
        else segs.push({ text: piece, xMm: x, wMm: w, bold: r.bold });
        if (r.underline) {
          const u = unders[unders.length - 1];
          if (u && Math.abs(u.xMm + u.wMm - x) < 1e-6) u.wMm += w;
          else unders.push({ xMm: x, wMm: w });
        }
        x += w;
      }
    }
    // An underline that ends on a space would draw a stub past the last word.
    for (const u of unders) {
      let end = u.xMm;
      for (const g of segs) {
        if (g.xMm >= u.xMm - 1e-6 && g.xMm + g.wMm <= u.xMm + u.wMm + 1e-6) end = Math.max(end, g.xMm + g.wMm);
      }
      u.wMm = end - u.xMm;
    }
    return { segs, unders: unders.filter(u => u.wMm > 0), widthMm: x - x0 };
  }

  /* How far this exact string's ink reaches above and below the baseline, in
     em. OCR hands back a glyph box, and what that box means depends on the
     letters: "Specific" (cap + descender) is ~1.0 em tall, "some" is ~0.55 em.
     Dividing every box by one fixed ratio read any word with a descender as
     ~40% too big — a 9.5pt line came back as 14pt, split off its paragraph
     and was re-typeset at 14pt. Measuring the actual string in Poppins gives
     both the size and the baseline. inkWEm is the ink width, which an
     underline does not stretch the way it stretches the height; inkLeftEm
     is where the ink starts relative to the pen origin (the side bearing,
     negative when the ink starts right of it). */
  function glyphExtentEm(str) {
    _meas.font = fontSpec(100 * T.PT_PER_MM, false, false, 1); // 100px
    const m = _meas.measureText(str);
    return {
      ascEm: m.actualBoundingBoxAscent / 100,
      descEm: m.actualBoundingBoxDescent / 100,
      inkWEm: (m.actualBoundingBoxLeft + m.actualBoundingBoxRight) / 100,
      inkLeftEm: m.actualBoundingBoxLeft / 100
    };
  }

  /* ── Grouping ────────────────────────────────────────────────────────────
     Words carry { text, xMm, yMm, wMm, hMm, baseMm, sizePt, bold, italic }.
     yMm is the top of the glyph box, baseMm the baseline.                  */

  // Words sharing a baseline (within a third of their own height) are one
  // line. Tolerance is proportional rather than absolute so a 16pt heading and
  // 9.5pt body text are both grouped correctly.
  function groupLines(words) {
    const ws = words.filter(w => w.text && w.text.trim()).slice()
      .sort((a, b) => a.baseMm - b.baseMm || a.xMm - b.xMm);
    const lines = [];

    for (const w of ws) {
      const tol = Math.max(0.6, w.hMm * 0.35);
      let line = null;
      // Only ever look at the last few lines — words arrive in baseline order.
      for (let i = lines.length - 1; i >= 0 && i >= lines.length - 3; i--) {
        if (Math.abs(lines[i].baseMm - w.baseMm) <= tol) { line = lines[i]; break; }
      }
      if (!line) {
        line = { words: [], baseMm: w.baseMm, yMm: w.yMm, hMm: w.hMm };
        lines.push(line);
      }
      line.words.push(w);
      // Running average keeps one tall word from dragging the whole baseline.
      line.baseMm = (line.baseMm * (line.words.length - 1) + w.baseMm) / line.words.length;
    }

    for (const line of lines) {
      line.words.sort((a, b) => a.xMm - b.xMm);
      line.xMm = Math.min(...line.words.map(w => w.xMm));
      const right = Math.max(...line.words.map(w => w.xMm + w.wMm));
      line.wMm = right - line.xMm;
      line.rightMm = right;
      line.yMm = Math.min(...line.words.map(w => w.yMm));
      line.hMm = Math.max(...line.words.map(w => w.yMm + w.hMm)) - line.yMm;
      line.sizePt = median(line.words.map(w => w.sizePt));
      line.bold = line.words.filter(w => w.bold).length * 2 >= line.words.length;
      line.italic = line.words.filter(w => w.italic).length * 2 >= line.words.length;
      line.text = joinWords(line.words);
      // A line broken into far-apart runs is a table row, not a sentence. The
      // widest internal gap tells us which, and it is worth knowing: table
      // rows must never be re-wrapped.
      line.maxGapMm = 0;
      for (let i = 1; i < line.words.length; i++) {
        const gap = line.words[i].xMm - (line.words[i - 1].xMm + line.words[i - 1].wMm);
        if (gap > line.maxGapMm) line.maxGapMm = gap;
      }
    }

    lines.sort((a, b) => a.baseMm - b.baseMm);
    return lines;
  }

  // Re-insert the spaces the word boxes imply. A gap wider than a quarter of
  // the font size is a space; a much wider one (a table column) becomes a run
  // of spaces so the text a user edits still reads like the page looks.
  function joinWords(words) {
    let out = '';
    for (let i = 0; i < words.length; i++) {
      if (i > 0) {
        const gap = words[i].xMm - (words[i - 1].xMm + words[i - 1].wMm);
        const em = T.ptToMm(words[i].sizePt);
        if (gap > em * 1.6) {
          out += '  ';           // table-ish gap: two spaces, still one token
        } else if (gap > em * 0.18) {
          out += ' ';
        }
      }
      out += words[i].text;
    }
    return out;
  }

  function median(nums) {
    const a = nums.slice().sort((x, y) => x - y);
    return a.length ? a[Math.floor(a.length / 2)] : T.BODY_PT;
  }

  /* Lines → blocks.

     A block break happens when any of these is true between two lines:
       • the vertical gap is more than 1.2× the running line pitch
         (a blank line, or the generator's paragraph spacing — about 1.36×,
         which a looser threshold merged into one block with a wrong pitch);
       • the font size changes by more than 12% (heading vs body);
       • boldness flips (a heading above its paragraph);
       • one of them is a table row and the other is not.

     A leading indent on the second line does NOT break the block — that is
     ordinary paragraph flow. A leading indent on the *first* line of a run
     does, because that is how a new indented paragraph starts.              */
  function groupBlocks(lines, metrics) {
    const blocks = [];
    let cur = null;
    let pitch = 0;

    const isTable = ln => ln.maxGapMm > T.ptToMm(ln.sizePt) * 2.2;

    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i];
      const prev = i > 0 ? lines[i - 1] : null;
      let brk = !cur;

      if (prev && cur) {
        const gap = ln.baseMm - prev.baseMm;
        const expect = pitch || T.ptToMm(prev.sizePt) * metrics.lh;
        if (gap > expect * 1.2) brk = true;
        if (Math.abs(ln.sizePt - prev.sizePt) / Math.max(1, prev.sizePt) > 0.12) brk = true;
        if (ln.bold !== prev.bold) brk = true;
        if (isTable(ln) !== isTable(prev)) brk = true;
        // Both table rows but the column grid moved → different table.
        if (isTable(ln) && isTable(prev) && Math.abs(ln.xMm - prev.xMm) > 3) brk = true;
      }

      if (brk) {
        cur = { lines: [ln] };
        blocks.push(cur);
        pitch = 0;
      } else {
        pitch = pitch
          ? (pitch * (cur.lines.length - 1) + (ln.baseMm - prev.baseMm)) / cur.lines.length
          : (ln.baseMm - prev.baseMm);
        cur.lines.push(ln);
      }
    }

    return blocks.map((b, i) => finishBlock(b, i, metrics));
  }

  function finishBlock(b, idx, metrics) {
    const lines = b.lines;
    const xMm = Math.min(...lines.map(l => l.xMm));
    const rightMm = Math.max(...lines.map(l => l.rightMm));
    const yMm = Math.min(...lines.map(l => l.yMm));
    const bottomMm = Math.max(...lines.map(l => l.yMm + l.hMm));
    const sizePt = median(lines.map(l => l.sizePt));
    const table = lines.some(l => l.maxGapMm > T.ptToMm(l.sizePt) * 2.2);

    // Pitch: measured if we have two lines, template default otherwise.
    let lhMm;
    if (lines.length > 1) {
      const gaps = [];
      for (let i = 1; i < lines.length; i++) gaps.push(lines[i].baseMm - lines[i - 1].baseMm);
      lhMm = median(gaps);
    } else {
      lhMm = T.ptToMm(sizePt) * metrics.lh;
    }

    const chrome = yMm < T.CHROME.top - 2 || bottomMm > T.PAGE.h - T.CHROME.bottom + 2;

    return {
      id: 'b' + idx,
      xMm, yMm,
      wMm: rightMm - xMm,
      hMm: bottomMm - yMm,
      rightMm, bottomMm,
      baseMm: lines[0].baseMm,
      lhMm,
      sizePt,
      bold: lines[0].bold,
      italic: lines[0].italic,
      align: detectAlign(lines, metrics, table),
      table,
      // A single line is never re-wrapped: headings, table rows and signature
      // lines grow sideways rather than folding onto a second line, which is
      // what the generator would have done too.
      wrap: lines.length > 1 && !table,
      wrapWidthMm: lines.length > 1 ? Math.max(rightMm, ...lines.map(l => l.rightMm)) - xMm : 0,
      chrome,
      // The source line objects, kept so layout() can work out which original
      // pixels still need erasing when the text gets shorter.
      lines,
      srcLines: lines.map(l => l.text),
      text: lines.map(l => l.text).join('\n'),
      origText: lines.map(l => l.text).join('\n'),
      dirty: false
    };
  }

  // Alignment from line edges. Justified text is the interesting case: every
  // line but the last ends flush right.
  function detectAlign(lines, metrics, table) {
    if (table || lines.length === 0) return 'left';
    const L = metrics.colLeft, R = metrics.colRight;
    const xs = lines.map(l => l.xMm), rs = lines.map(l => l.rightMm);
    const minX = Math.min(...xs), maxR = Math.max(...rs);

    // Centred: comparable slack on both sides, and meaningful slack at that.
    const slackL = minX - L, slackR = R - maxR;
    if (slackL > 6 && slackR > 6 && Math.abs(slackL - slackR) < Math.max(4, (slackL + slackR) * 0.18)) {
      return 'center';
    }
    // Right-aligned: flush right, clearly indented left.
    if (slackR < 2 && slackL > 12) return 'right';

    if (lines.length >= 3) {
      const body = rs.slice(0, -1);
      const spread = Math.max(...body) - Math.min(...body);
      if (spread < 1.2 && Math.max(...body) > L + (R - L) * 0.85) return 'justify';
    }
    return 'left';
  }

  /* ── Layout ──────────────────────────────────────────────────────────────
     The authority. Given a block's current text and its template metrics,
     produce the exact lines to paint — positions in mm, words already spaced.

     Returns:
       {
         lines: [ { text, xMm, baseMm, wordSpaceMm, words:[{text,xMm}] } ],
         boxMm: { x, y, w, h }      // area to white out before painting
       }                                                                    */
  function layout(block, metrics) {
    const sizePt = block.sizePt;
    const bold = block.bold, italic = block.italic;
    const lhMm = block.lhMm;
    const L = metrics.colLeft, R = metrics.colRight;

    // Where the text may run to. A wrapping block keeps the width it had; a
    // single-line block may grow to the column edge before it is forced to
    // fold (so a longer company name does not silently vanish off the sheet).
    const maxW = block.wrap
      ? Math.min(block.wrapWidthMm, R - block.xMm)
      : R - block.xMm;

    const marked = hasMarks(block);

    // Hard line breaks the user typed are honoured; each is then wrapped.
    // `starts` is each line's offset into block.text, so a marked block can
    // look up the style of every character it paints.
    const paras = String(block.text).split('\n');
    const raw = [], starts = [];
    let paraStart = 0;
    for (const para of paras) {
      const ps = paraStart;
      const measure = marked ? (s, e) => widthRuns(block, ps + s, ps + e) : null;
      const wrapped = wrapText(para, maxW, sizePt, bold, italic, block.wrap, measure);
      // An empty paragraph is a deliberate blank line — keep it.
      if (!wrapped.length) { raw.push(''); starts.push(ps); }
      let cursor = 0;
      for (const w of wrapped) {
        const at = para.indexOf(w, cursor);
        raw.push(w); starts.push(ps + at);
        cursor = at + w.length;
      }
      paraStart += para.length + 1;
    }

    const out = [];
    for (let i = 0; i < raw.length; i++) {
      const text = raw[i];
      const s0 = starts[i], s1 = starts[i] + text.length;
      let lineMarked = false;
      if (marked) {
        const p = plainMark(block);
        for (let j = s0; j < s1 && !lineMarked; j++) lineMarked = markAt(block, j) !== p;
      }
      const natural = lineMarked ? widthRuns(block, s0, s1) : widthMm(text, sizePt, bold, italic);
      let xMm = block.xMm;
      let wordSpaceMm = 0;

      if (block.align === 'center') {
        // Centre inside the block's own original span, not the whole column —
        // a centred signature name belongs over its own rule.
        const span = block.wrap ? maxW : Math.max(block.wMm, natural);
        xMm = block.xMm + (span - natural) / 2;
      } else if (block.align === 'right') {
        xMm = block.rightMm - natural;
      } else if (block.align === 'justify' && i < raw.length - 1 && raw[i + 1] !== '') {
        const gaps = (text.match(/ /g) || []).length;
        if (gaps > 0 && natural < maxW) wordSpaceMm = (maxW - natural) / gaps;
      }

      const line = {
        text,
        xMm,
        baseMm: block.baseMm + i * lhMm,
        wordSpaceMm,
        widthMm: natural + wordSpaceMm * ((text.match(/ /g) || []).length),
        marked: lineMarked
      };
      if (lineMarked) {
        const sg = segmentsOf(block, s0, s1, xMm, wordSpaceMm);
        line.segs = sg.segs;
        line.unders = sg.unders;
        line.widthMm = sg.widthMm;
      }
      out.push(line);
    }

    /* Which lines actually changed.

       This matters more than it looks. On an OCR'd page the model's text is a
       machine's reading of the pixels — good, but not perfect. If a user fixes
       one word in a paragraph and we re-render the whole paragraph, every
       OCR mistake in the *other* lines gets baked into the output, replacing
       pixels that were correct. So: find the first line that differs, and
       repaint only from there. Correct an eight-line paragraph's last line and
       seven lines of original pixels are left completely alone.

       Once the text reflows (a line count change, or an edit that pushes words
       onto the next line) everything from the first difference down has to be
       repainted — there is no way to patch around that.                     */
    const src = block.srcLines || [];
    let from = 0;
    // A line with the same wording that now carries bold/underline has changed
    // too — the original pixels show it plain.
    while (from < out.length && from < src.length &&
           out[from].text === src[from] && !out[from].marked) from++;

    // `from === out.length` on its own does not mean "nothing changed" — the
    // text may simply have got shorter, in which case there is nothing new to
    // paint but there are still stale lines below to erase.
    const changed = from < out.length || out.length !== src.length;

    const ascMm = T.ptToMm(sizePt) * 0.82;
    const descMm = T.ptToMm(sizePt) * 0.30;

    // Erase region: the new lines from `from` down, unioned with the original
    // lines from `from` down (so text that got shorter does not leave a tail
    // of old pixels behind).
    const newTail = out.slice(from);
    const oldTail = (block.lines || []).slice(from);

    let top = Infinity, bottom = -Infinity, left = Infinity, right = -Infinity;
    for (const l of newTail) {
      top = Math.min(top, l.baseMm - ascMm);
      bottom = Math.max(bottom, l.baseMm + descMm);
      left = Math.min(left, l.xMm);
      right = Math.max(right, l.xMm + l.widthMm);
    }
    for (const l of oldTail) {
      top = Math.min(top, l.yMm, l.baseMm - ascMm);
      bottom = Math.max(bottom, l.yMm + l.hMm, l.baseMm + descMm);
      left = Math.min(left, l.xMm);
      right = Math.max(right, l.rightMm);
    }
    if (!isFinite(top)) { top = block.yMm; bottom = block.bottomMm; left = block.xMm; right = block.rightMm; }

    top -= 0.4; bottom += 0.4; left -= 0.6; right += 0.6;

    const emMm = T.ptToMm(sizePt);
    return {
      lines: out,
      from,
      changed,
      // Underline geometry, shared by the screen and the exporter.
      underOffsetMm: emMm * 0.11,
      underThickMm: Math.max(0.12, emMm * 0.055),
      boxMm: {
        x: Math.max(0, left),
        y: Math.max(0, top),
        w: Math.min(T.PAGE.w, right) - Math.max(0, left),
        h: Math.min(T.PAGE.h, bottom) - Math.max(0, top)
      }
    };
  }

  /* Baseline offset, in em, from the top of a `line-height: 1` box.

     Needed so a DOM <span> and a canvas fillText put the same glyph in the
     same place: canvas positions by the alphabetic baseline directly, the DOM
     positions by the box top. Measured from the loaded font rather than
     hard-coded, because it changes with the font and the generator's body
     font is admin-adjustable. */
  let _baseEm = null;
  function baselineEm() {
    if (_baseEm != null) return _baseEm;
    _meas.font = fontSpec(100 * T.PT_PER_MM, false, false, 1); // 100px
    const m = _meas.measureText('Hxg');
    const asc = m.fontBoundingBoxAscent, desc = m.fontBoundingBoxDescent;
    _baseEm = (asc && desc) ? ((1 - (asc + desc) / 100) / 2 + asc / 100) : 0.85;
    return _baseEm;
  }

  // Call once the webfont has arrived; the measurements above are wrong while
  // the fallback font is still in place.
  function resetMetrics() { _baseEm = null; }

  // Greedy word wrap in mm. `allowWrap` false means "never fold" — used for
  // headings, table rows and anything that was a single line to begin with.
  // `measure(s, e)`, when given, measures t[s, e) — a marked block passes one
  // that accounts for its bold runs. Every returned line is a substring of
  // `text`, which is how layout() maps lines back to character offsets.
  function wrapText(text, maxW, sizePt, bold, italic, allowWrap, measure) {
    const t = text.replace(/\s+$/, '');
    if (!t) return [];
    if (!allowWrap) return [t];
    const w = measure || ((s, e) => widthMm(t.slice(s, e), sizePt, bold, italic));
    if (w(0, t.length) <= maxW) return [t];

    const words = t.split(' ');
    const lines = [];
    let start = 0, end = -1, pos = 0;   // current line is t[start, end)
    for (const word of words) {
      const ws = pos, we = pos + word.length;
      pos = we + 1;
      if (end <= start) { start = ws; end = we; continue; }
      if (w(start, we) > maxW) {
        lines.push(t.slice(start, end));
        start = ws; end = we;
      } else {
        end = we;
      }
    }
    if (end > start) lines.push(t.slice(start, end));
    return lines;
  }

  return {
    MEAS_PPMM,
    fontSpec, widthMm, glyphExtentEm, baselineEm, resetMetrics,
    groupLines, groupBlocks,
    layout, wrapText,
    M_BOLD, M_UNDER, hasMarks, runsOf
  };
})();
