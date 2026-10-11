// ChangeGlow.js — on for every user (4.97.0; admin-only before). Off under Settings.
//
// After a left-hand-side action, whatever that action changed on the preview
// glows blue for a couple of seconds, so the user can see what the button they
// just pressed actually did to the document.
//
// It does not try to know the generator's rules ("this checkbox adds that
// sentence"). There are far too many of them. Instead it compares the document
// as it was before the regeneration with the document after it, text block by
// text block, and marks the difference:
//
//   • a block that is new              → the whole block glows
//   • a block whose wording changed    → only the changed words glow
//   • a block that disappeared         → the first words of whatever moved up
//                                        into its place get a dashed underline
//
// The marking uses the CSS Custom Highlight API (CSS.highlights) — no element
// is wrapped, no class or style is written to the page. That matters: the page
// HTML is saved (savedPagesHtml / previewEdits), exported and diffed by other
// modules, and a glow must never end up in any of them. A browser without the
// API simply gets no glow.
//
// Hooks (app.js):
//   ChangeGlow.before(output)  — top of generateDoc(), and before DocVars.patch()
//                                on the edit-mode path. Snapshots the text.
//   ChangeGlow.after(output)   — once the new document is paginated. Diffs and
//                                paints.
//
// Only regenerations that follow a real user interaction outside the preview
// glow — loading a statement, the startup restore and typing on the preview
// itself do not.

const ChangeGlow = (() => {
  const HL_MAIN = 'change-glow';
  const HL_NEAR = 'change-glow-near';

  let HOLD_MS = 2200;        // full strength
  let FADE_MS = 1300;        // then fades out
  // A regeneration this long after the last interaction is not the user's doing
  // (debounce is 300ms, a big document generates in well under a second).
  const INTERACTION_WINDOW_MS = 3500;
  // LCS table guard — beyond this many cells, fall back to a multiset compare.
  const MAX_CELLS = 4000000;
  const MAX_WORD_CELLS = 250000;
  // Above both of these the change is wholesale (entity type switch, a
  // different statement loaded): painting the whole document blue says nothing.
  const WHOLESALE_MIN_BLOCKS = 40;
  const WHOLESALE_RATIO = 0.5;
  const NEAR_WORDS = 6;
  const OFF_KEY = 'policygenChangeGlowOff';

  const BLOCK_TAGS = new Set([
    'P', 'DIV', 'LI', 'TD', 'TH', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'DT', 'DD', 'BLOCKQUOTE', 'PRE', 'SECTION', 'ARTICLE', 'CAPTION',
    'TABLE', 'TR', 'UL', 'OL', 'HEADER', 'FOOTER'
  ]);
  // Page furniture — the same list SuperRed skips, plus our own escape hatch.
  const SKIP_SELECTOR = '.page-split-chip, .letterhead-img, .letterhead-footer, ' +
    '.page-header, .page-number, script, style, .no-change-glow';

  let _lastInteraction = 0;
  let _snapshot = null;      // string[] — block texts of the last settled document
  let _styleEl = null;
  let _timers = [];
  let _raf = 0;
  let _last = null;

  // ── Gate ─────────────────────────────────────────────────────────────────

  function supported() {
    return typeof CSS !== 'undefined' && CSS.highlights &&
      typeof Highlight === 'function';
  }

  function isOff() {
    try { return localStorage.getItem(OFF_KEY) === '1'; } catch (_) { return false; }
  }

  function enabled() {
    return supported() && !isOff();
  }

  function setEnabled(on) {
    try {
      if (on) localStorage.removeItem(OFF_KEY);
      else localStorage.setItem(OFF_KEY, '1');
    } catch (_) {}
    if (!on) clear();
    refreshSetting();
  }

  function toggle() { setEnabled(isOff()); }

  // The Settings entry (index.html #settings-change-glow): offered to everyone
  // wherever the browser can draw the glow at all.
  function refreshSetting() {
    const section = document.getElementById('settings-change-glow');
    if (section) {
      const offered = supported();
      section.style.display = offered ? '' : 'none';
    }
    const btn = document.getElementById('btn-change-glow');
    if (btn) btn.textContent = 'Highlight changes: ' + (isOff() ? 'Off' : 'On');
  }

  // Re-check every time the menu is opened — the name can change in Settings.
  document.addEventListener('click', (e) => {
    if (e.target && e.target.closest && e.target.closest('#btn-settings')) refreshSetting();
  }, true);

  // Any trusted interaction outside the preview and the top toolbar counts:
  // the form panel itself, but also the calendar picker and other popups that
  // write into the form from outside it.
  ['input', 'change', 'click', 'keydown'].forEach(type => {
    document.addEventListener(type, (e) => {
      if (!e.isTrusted) return;
      const t = e.target;
      if (t && t.closest && t.closest('.preview-panel, #mode-toggle-bar')) return;
      _lastInteraction = Date.now();
    }, true);
  });

  function userCaused() {
    return Date.now() - _lastInteraction < INTERACTION_WINDOW_MS;
  }

  // ── Text blocks ──────────────────────────────────────────────────────────
  // A block is the nearest block-level element around a text node; its text is
  // its *own* text nodes only (a nested block is its own block). Returns
  // [{ el, nodes: Text[], text: string, key: string }] in document order.

  function collect(root) {
    const byEl = new Map();
    const skipCache = new Map();
    const skipped = (el) => {
      if (!el) return false;
      let v = skipCache.get(el);
      if (v === undefined) { v = !!el.closest(SKIP_SELECTOR); skipCache.set(el, v); }
      return v;
    };
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      const parent = n.parentElement;
      if (!parent || skipped(parent)) continue;
      let el = parent;
      while (el && el !== root && !BLOCK_TAGS.has(el.tagName)) el = el.parentElement;
      if (!el) el = root;
      let b = byEl.get(el);
      if (!b) { b = { el, nodes: [] }; byEl.set(el, b); }
      b.nodes.push(n);
    }
    const out = [];
    byEl.forEach(b => {
      b.text = b.nodes.map(t => t.nodeValue).join('');
      b.key = b.text.replace(/\s+/g, ' ').trim();
      if (b.key) out.push(b);
    });
    return out;
  }

  // ── Diff ─────────────────────────────────────────────────────────────────
  // Longest common subsequence over two arrays (compared with eq). Returns ops:
  // { t: 'eq', a, b } | { t: 'del', a } | { t: 'ins', b }. Common prefix and
  // suffix are trimmed first — a typical edit touches a handful of blocks out
  // of hundreds, so the table that is actually built is tiny.

  function lcsOps(A, B, eq, maxCells) {
    const n = A.length, m = B.length;
    let p = 0;
    while (p < n && p < m && eq(A[p], B[p])) p++;
    let s = 0;
    while (s < n - p && s < m - p && eq(A[n - 1 - s], B[m - 1 - s])) s++;
    const ops = [];
    for (let i = 0; i < p; i++) ops.push({ t: 'eq', a: i, b: i });

    const a0 = p, a1 = n - s, b0 = p, b1 = m - s;
    const R = a1 - a0, C = b1 - b0;
    if (R * C > maxCells) return null;

    if (R && C) {
      const W = C + 1;
      const T = (R + 1) * W > 0 && Math.min(R, C) < 65535
        ? new Uint16Array((R + 1) * W) : new Uint32Array((R + 1) * W);
      for (let i = R - 1; i >= 0; i--) {
        for (let j = C - 1; j >= 0; j--) {
          T[i * W + j] = eq(A[a0 + i], B[b0 + j])
            ? T[(i + 1) * W + j + 1] + 1
            : Math.max(T[(i + 1) * W + j], T[i * W + j + 1]);
        }
      }
      let i = 0, j = 0;
      while (i < R && j < C) {
        if (eq(A[a0 + i], B[b0 + j])) { ops.push({ t: 'eq', a: a0 + i, b: b0 + j }); i++; j++; }
        else if (T[(i + 1) * W + j] >= T[i * W + j + 1]) { ops.push({ t: 'del', a: a0 + i }); i++; }
        else { ops.push({ t: 'ins', b: b0 + j }); j++; }
      }
      for (; i < R; i++) ops.push({ t: 'del', a: a0 + i });
      for (; j < C; j++) ops.push({ t: 'ins', b: b0 + j });
    } else {
      for (let i = a0; i < a1; i++) ops.push({ t: 'del', a: i });
      for (let j = b0; j < b1; j++) ops.push({ t: 'ins', b: j });
    }
    for (let k = 0; k < s; k++) ops.push({ t: 'eq', a: a1 + k, b: b1 + k });
    return ops;
  }

  // Words with their offsets in the raw block text. A number keeps its inner
  // separators ("1.2", "R1,000.00", "31/12/2025") so a renumbered heading or a
  // changed amount glows whole; other punctuation is its own token so
  // "2025." → "2026." marks the number, not the full stop.
  function words(text) {
    const out = [];
    const re = /\p{L}*\p{N}+(?:[.,/]\p{N}+)+|[\p{L}\p{N}]+(?:['’]\p{L}+)*|[^\s\p{L}\p{N}]/gu;
    let m;
    while ((m = re.exec(text))) out.push({ w: m[0], s: m.index, e: m.index + m[0].length });
    return out;
  }

  function similarity(aKey, bKey) {
    const a = new Set(aKey.toLowerCase().split(' '));
    const b = new Set(bKey.toLowerCase().split(' '));
    let both = 0;
    a.forEach(w => { if (b.has(w)) both++; });
    return both / Math.max(1, Math.max(a.size, b.size));
  }

  // ── Marks and ranges ─────────────────────────────────────────────────────
  // A mark is { s, e, k } — a [start, end) stretch of one block's own text and
  // its kind ('main' glow or 'near' underline). Marks are kept as offsets, not
  // Ranges, so they can be carried onto the next rebuild (see after()).

  // Offsets → one Range per text node crossed (never one range across a nested
  // block's text).
  function rangesFor(block, start, end) {
    const out = [];
    let off = 0;
    for (const node of block.nodes) {
      const len = node.nodeValue.length;
      const s = Math.max(start, off), e = Math.min(end, off + len);
      if (e > s && node.nodeValue.slice(s - off, e - off).trim()) {
        const r = document.createRange();
        r.setStart(node, s - off);
        r.setEnd(node, e - off);
        out.push(r);
      }
      off += len;
      if (off >= end) break;
    }
    return out;
  }

  function wholeBlock(block) {
    return [{ s: 0, e: block.text.length, k: 'main' }];
  }

  function firstWords(block, count) {
    const ws = words(block.text);
    if (!ws.length) return [];
    return [{ s: ws[0].s, e: ws[Math.min(count, ws.length) - 1].e, k: 'near' }];
  }

  // Changed block: mark the words of the new text that are not in the old.
  // Runs of inserted words are merged so the glow covers the spaces too.
  function changedWords(oldKey, block) {
    const A = words(oldKey).map(x => x.w);
    const Bw = words(block.text);
    const ops = lcsOps(A, Bw.map(x => x.w), (x, y) => x === y, MAX_WORD_CELLS);
    if (!ops) return wholeBlock(block);
    const out = [];
    let runStart = -1, runEnd = -1;
    let pendingDel = false;
    const flush = () => {
      if (runStart >= 0) out.push({ s: Bw[runStart].s, e: Bw[runEnd].e, k: 'main' });
      runStart = runEnd = -1;
    };
    for (const op of ops) {
      if (op.t === 'ins') {
        if (runStart < 0) runStart = op.b;
        runEnd = op.b;
        pendingDel = false;
      } else if (op.t === 'del') {
        flush();
        pendingDel = true;
      } else {
        flush();
        // Words taken out with nothing put back: underline the word that now
        // sits where they were.
        if (pendingDel) out.push({ s: Bw[op.b].s, e: Bw[op.b].e, k: 'near' });
        pendingDel = false;
      }
    }
    flush();
    if (pendingDel && Bw.length) {
      const w = Bw[Bw.length - 1];
      out.push({ s: w.s, e: w.e, k: 'near' });
    }
    return out;
  }

  // ── Paint ────────────────────────────────────────────────────────────────

  // The marks on screen: [{ b, key, s, e, k }] against the block list of the
  // last after(). Null once the glow has faded.
  let _marks = null;

  function ensureStyle() {
    if (_styleEl) return _styleEl;
    _styleEl = document.createElement('style');
    _styleEl.id = 'change-glow-style';
    document.head.appendChild(_styleEl);
    return _styleEl;
  }

  function setStrength(a) {
    const bg = (0.30 * a).toFixed(3);
    const ln = (0.95 * a).toFixed(3);
    // Text goes blue only while the glow is at full strength; ::highlight cannot
    // fade a colour back to whatever the text was (black, or SuperRed's red).
    const colour = a >= 1 ? 'color: #1d4ed8;' : '';
    ensureStyle().textContent =
      `::highlight(${HL_MAIN}) { background-color: rgba(59,130,246,${bg}); ${colour} }\n` +
      `::highlight(${HL_NEAR}) { text-decoration: underline dashed rgba(37,99,235,${ln});` +
      ` text-decoration-thickness: 2px; text-underline-offset: 3px; }`;
  }

  function clear() {
    _timers.forEach(clearTimeout);
    _timers = [];
    cancelAnimationFrame(_raf);
    _marks = null;
    if (supported()) {
      CSS.highlights.delete(HL_MAIN);
      CSS.highlights.delete(HL_NEAR);
    }
  }

  // Marks → Ranges → the two highlights. Returns the main ranges (or the near
  // ones when there are none) for revealIfHidden().
  function render(blocks) {
    const main = [], near = [];
    (_marks || []).forEach(m => {
      const block = blocks[m.b];
      if (!block) return;
      (m.k === 'main' ? main : near).push(...rangesFor(block, m.s, m.e));
    });
    CSS.highlights.set(HL_MAIN, new Highlight(...main));
    CSS.highlights.set(HL_NEAR, new Highlight(...near));
    return main.length ? main : near;
  }

  function startTimers() {
    _timers.push(setTimeout(() => {
      const t0 = performance.now();
      const step = (now) => {
        const k = Math.min(1, (now - t0) / FADE_MS);
        setStrength(0.999 * (1 - k));
        if (k < 1) _raf = requestAnimationFrame(step);
        else clear();
      };
      _raf = requestAnimationFrame(step);
    }, HOLD_MS));
  }

  // If nothing that glows is on screen once the section jump has settled,
  // bring the first change into view — otherwise the user pressed a button and
  // saw nothing happen.
  function revealIfHidden(ranges) {
    _timers.push(setTimeout(() => {
      const panel = document.querySelector('.preview-panel');
      if (!panel || !ranges.length) return;
      const pr = panel.getBoundingClientRect();
      let first = null;
      for (const r of ranges) {
        const rr = r.getBoundingClientRect();
        if (!rr.width && !rr.height) continue;
        if (rr.bottom > pr.top && rr.top < pr.bottom) return;   // one is visible
        if (!first) first = rr;
      }
      if (!first) return;
      const delta = first.top - pr.top - pr.height / 3;
      panel.scrollTo({ top: panel.scrollTop + delta, behavior: 'smooth' });
    }, 450));
  }

  // ── Hooks ────────────────────────────────────────────────────────────────

  let _snapshotAt = 0;
  let _snapshotByUser = false;

  function before(root) {
    if (!enabled() || !root) { _snapshot = null; return; }
    // Two regenerations before the first one is paginated: keep the older
    // snapshot, it is the last document the user actually saw. (Unless it is
    // stale — an after() that never came.)
    if (_snapshot && Date.now() - _snapshotAt < 3000) {
      _snapshotByUser = _snapshotByUser || userCaused();
      return;
    }
    _snapshot = collect(root).map(b => b.key);
    _snapshotAt = Date.now();
    // Judged here, not in after(): pagination waits on images and a frame, and
    // that delay is not the user's.
    _snapshotByUser = userCaused();
  }

  function after(root) {
    const old = _snapshot;
    _snapshot = null;
    const byUser = _snapshotByUser;
    _last = { at: Date.now(), old: old && old.length, user: byUser };
    if (!old || !old.length || !root || !enabled()) { clear(); return; }

    const blocks = collect(root);
    const newKeys = blocks.map(b => b.key);
    let ops = lcsOps(old, newKeys, (x, y) => x === y, MAX_CELLS);
    if (!ops) {
      // Too big a middle for the table: anything not present in the old
      // document (as a multiset) counts as new.
      const pool = new Map();
      old.forEach(k => pool.set(k, (pool.get(k) || 0) + 1));
      ops = newKeys.map((k, b) => {
        const c = pool.get(k) || 0;
        if (c) { pool.set(k, c - 1); return { t: 'eq', b }; }
        return { t: 'ins', b };
      });
    }

    // Group into hunks of consecutive non-equal ops; remember where each old
    // block that survived went.
    const hunks = [];
    const moved = new Map();
    let cur = null;
    ops.forEach((op) => {
      if (op.t === 'eq') {
        if (op.a !== undefined) moved.set(op.a, op.b);
        if (cur) { cur.nextEq = op.b; hunks.push(cur); cur = null; }
        return;
      }
      if (!cur) cur = { dels: [], ins: [], seq: [], nextEq: -1 };
      cur.seq.push(op);
      (op.t === 'del' ? cur.dels : cur.ins).push(op.t === 'del' ? op.a : op.b);
    });
    if (cur) hunks.push(cur);

    const touched = hunks.reduce((s, h) => s + h.ins.length, 0);
    Object.assign(_last, { blocks: blocks.length, hunks: hunks.length, touched });

    // Nothing changed — or not by the user's hand. A glow still running from
    // the previous rebuild must not die with the old DOM: carry its marks onto
    // the blocks they moved to and keep the clock running.
    if (!hunks.length || !byUser) {
      if (_marks) {
        _marks = _marks
          .filter(m => old[m.b] === m.key && moved.has(m.b))
          .map(m => Object.assign({}, m, { b: moved.get(m.b) }));
        render(blocks);
      }
      return;
    }

    clear();
    if (touched >= WHOLESALE_MIN_BLOCKS && touched > blocks.length * WHOLESALE_RATIO) return;

    const marks = [];
    const add = (bi, list) => list.forEach(m =>
      marks.push(Object.assign(m, { b: bi, key: blocks[bi].key })));
    hunks.forEach(h => {
      if (!h.ins.length) {
        // Pure removal: hint at the spot with whatever now sits there.
        if (h.nextEq >= 0) add(h.nextEq, firstWords(blocks[h.nextEq], NEAR_WORDS));
        return;
      }
      const freeDels = h.dels.slice();
      const whole = new Set();
      h.ins.forEach(bi => {
        const block = blocks[bi];
        // Pair the new block with the most similar removed one in the same
        // hunk: a reworded sentence, not a brand-new one.
        let best = -1, bestSim = 0;
        freeDels.forEach((ai, k) => {
          const sim = similarity(old[ai], block.key);
          if (sim > bestSim) { bestSim = sim; best = k; }
        });
        if (best >= 0 && bestSim >= 0.3) {
          const ai = freeDels.splice(best, 1)[0];
          add(bi, changedWords(old[ai], block));
        } else {
          add(bi, wholeBlock(block));
          whole.add(bi);
        }
      });
      // Removed blocks nothing took the place of (a policy unticked in front of
      // one that was merely renumbered): hint at the block that now sits where
      // they were, unless that block already glows whole.
      const hinted = new Set();
      freeDels.forEach(ai => {
        const at = h.seq.findIndex(op => op.t === 'del' && op.a === ai);
        const nextIns = h.seq.slice(at + 1).find(op => op.t === 'ins');
        const bi = nextIns ? nextIns.b : h.nextEq;
        if (bi < 0 || hinted.has(bi) || whole.has(bi)) return;
        hinted.add(bi);
        add(bi, firstWords(blocks[bi], NEAR_WORDS));
      });
    });

    _last.marks = marks.length;
    if (!marks.length) return;
    _marks = marks;
    setStrength(1);
    const shown = render(blocks);
    startTimers();
    revealIfHidden(shown);
  }

  // last(): what the most recent after() saw — for tuning the experiment from
  // the console.
  // configure({ holdMs, fadeMs }): retime the glow from the console while tuning.
  function configure(o) {
    if (o && o.holdMs >= 0) HOLD_MS = o.holdMs;
    if (o && o.fadeMs >= 0) FADE_MS = o.fadeMs;
    return { holdMs: HOLD_MS, fadeMs: FADE_MS };
  }

  return { before, after, clear, setEnabled, toggle, enabled, configure, last: () => _last };
})();
