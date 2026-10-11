// EditToolbar.js — Editing toolbar: formatting, undo/redo, paragraph spacing,
// indent ruler, and toolbar help overlay.
// Loaded before EditToolbarPages.js and app.js; all functions are global.

// ── Hand-edited pages ──
// A manual edit on the preview (RHS) marks the page it touched as edited.
// An edited page is kept exactly as the user left it when the document
// regenerates from the form; every other page rebuilds normally. Each
// generated page carries a stable `data-page-uid` (derived from its heading)
// so an edited page can be matched to - and swapped in for - its regenerated
// counterpart.
//
// This is deliberately invisible. It used to be "pinning", with a badge on
// every edited page and a status bar explaining that the page had stopped
// following the form - and the reason it had to be explained is that it was
// not true of the values, only of the wording. It is now true of the wording
// alone: the values inside an edited page are *protected variables*
// (DocVars.js) and are re-rendered in place whenever the form moves, so an
// edited page keeps following the left-hand side without being rebuilt and
// there is nothing left for the user to understand or switch off.
let _rhsInputListener = null;
let _rhsBeforeInputListener = null;
let _manualPageSeq = 0;
// Generated pages the user deleted in edit mode - suppressed on regeneration
// so they don't silently come back.
let _removedPageUids = new Set();

// Assign a stable identity to every freshly generated page. The uid derives
// from the page's section and the fixed wording of its first heading, plus an
// occurrence counter for repeats; it stays stable across regenerations as long
// as the section still exists in the new document.
//
// Form values (`.hl-kw`) are left out of the heading text. Before 4.56.1 they
// were not, so a page headed by the client's name — the trust resolution is
// headed "<TRUST NAME> – <REG NO>" and nothing else — changed identity whenever
// the name or registration number was edited. A hand-edited copy of it then
// matched nothing in the regenerated document, was re-inserted beside it, and
// the page appeared twice.
function _uidSlug(text) {
  return (text || '').trim().toLowerCase()
    .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

function _pageUidBase(page) {
  const h = page.querySelector('h1, h2, h3');
  let text = '';
  if (h) {
    const c = h.cloneNode(true);
    c.querySelectorAll('.hl-kw').forEach(s => s.remove());
    text = c.textContent;
  }
  const section = page.getAttribute('data-doc-section') || '';
  const slug = _uidSlug(text);
  const base = [section, slug].filter(Boolean).join('/');
  return base || (page.className || 'page').trim().split(/\s+/).join('-');
}

// The pre-4.56.1 uid base (whole heading text, values included). Statements
// saved since 4.29.0 store their edited pages under it, so it is kept on every
// generated page as a second key to match those against.
function _legacyPageUidBase(page) {
  const h = page.querySelector('h1, h2, h3');
  const base = (h?.textContent || '').trim().toLowerCase()
    .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 60);
  return base || (page.className || 'page').trim().split(/\s+/).join('-');
}

function _assignPageUids(output) {
  const counts = {};
  const legacyCounts = {};
  output.querySelectorAll('.doc-page, .cover-page').forEach(page => {
    const base = _pageUidBase(page);
    const n = counts[base] = (counts[base] || 0) + 1;
    page.setAttribute('data-page-uid', base + '@' + n);
    const lBase = _legacyPageUidBase(page);
    const ln = legacyCounts[lBase] = (legacyCounts[lBase] || 0) + 1;
    page.setAttribute('data-page-uid-legacy', lBase + '@' + ln);
  });
}

// Generated (not hand-edited) pages in `output` carrying `uid`, under the
// current scheme or the legacy one.
function _pagesByUid(output, uid) {
  if (!uid) return [];
  const q = CSS.escape(uid);
  const keep = p => p.matches('.doc-page, .cover-page') && !p.hasAttribute('data-edited');
  let found = Array.from(output.querySelectorAll(`[data-page-uid="${q}"]`)).filter(keep);
  if (!found.length) found = Array.from(output.querySelectorAll(`[data-page-uid-legacy="${q}"]`)).filter(keep);
  return found;
}

function _pageUidOf(page) {
  return page?.getAttribute?.('data-page-uid') || '';
}

// Give an edit-mode-created page (Add Page, Word/PDF import, overflow reflow)
// a synthetic uid and mark it edited immediately - it has no generated
// counterpart, so only that keeps it alive across regenerations.
function _markManualPage(page) {
  page.setAttribute('data-page-uid', 'manual@' + Date.now() + '-' + (++_manualPageSeq));
  _markPageEdited(page);
}

// Mark a page as hand-edited (and any continuation pages sharing its uid - the
// paginator treats those as one unit, so they must be preserved together).
function _markPageEdited(page) {
  if (!page) return;
  const uid = _pageUidOf(page);
  const output = document.getElementById('document-output');
  const group = (uid && output)
    ? Array.from(output.querySelectorAll(`[data-page-uid="${CSS.escape(uid)}"]`))
    : [];
  if (!group.includes(page)) group.push(page);
  group.forEach(p => p.setAttribute('data-edited', 'true'));
  _notePreviewChange();
}

// A preview edit is now part of the statement — it is saved with the record and
// kept in the draft — so it counts as an unsaved change like a form edit does.
function _notePreviewChange() {
  if (typeof _hasUnsavedChanges !== 'undefined') _hasUnsavedChanges = true;
  if (typeof BusinessInfoManager !== 'undefined') BusinessInfoManager.markSaveButton(true);
  if (typeof DraftCache !== 'undefined') DraftCache.touch();
}

function _markPageEditedOf(node) {
  const el = node?.nodeType === 1 ? node : node?.parentElement;
  const page = el?.closest?.('.doc-page, .cover-page');
  if (page) _markPageEdited(page);
}

function _hasPreviewEdits() {
  return _removedPageUids.size > 0 ||
    !!document.querySelector('#document-output [data-edited]');
}

function _onRhsInput(e) {
  _markPageEditedOf(e.target);
  // Typing inside a protected variable is the same statement as typing in the
  // form field that produced it, so it goes straight back to that field. This
  // is the half of the two-way sync that runs in edit mode; LiveSync.js covers
  // the click-to-edit path outside it.
  if (typeof DocVars !== 'undefined') {
    if (e.inputType === 'insertParagraph') DocVars.unbindEmptyAtCaret();
    DocVars.pullAtCaret();
  }
  // The auditor is usually here *because* a highlighted value is wrong, and
  // retyping it makes the browser carry the old text's computed colour onto the
  // new text as an inline red. Strip it as the edit happens: this page is now
  // hand-edited, and a hand-edited page is preserved through every regeneration,
  // save and export — so anything left behind now is on the final PDF.
  const el = e.target?.nodeType === 1 ? e.target : e.target?.parentElement;
  const page = el?.closest?.('.doc-page, .cover-page');
  if (page) stripHighlightColour(page);
  if (!e.isComposing) _syncSigRule();
  if (typeof EditTableRows !== 'undefined') EditTableRows.onInput(e);
}

// Typing at the edge of a protected variable is prose beside it, not an edit of
// the value — see DocVars.insertBesideAtCaret. The browser's own insertion is
// cancelled there, so no 'input' event follows: mark the page edited here.
function _onRhsBeforeInput(e) {
  if (_idxSigLineBreak(e)) return;
  if (typeof DocVars === 'undefined' || !DocVars.insertBesideAtCaret(e)) return;
  _markPageEditedOf(window.getSelection()?.anchorNode);
}

// Enter on an index-page signatory name ("CA VAN NIEKERK (DECEASED …)") is a
// request to carry the rest of the name onto a second line under the first.
// The browser's own Enter splits `.idx-sig-name` into two divs, and since the
// row is a flex line (name | signature rule) the copy becomes a third column
// and the row falls apart. So the break is a <br> inside the name instead —
// the same shape the generator uses for the board-rep caption — and the rule
// stays bottom-aligned with the last line. A <br> carries no text, so a
// protected variable it lands in still holds exactly the field's value.
function _idxSigLineBreak(e) {
  if (e.inputType !== 'insertParagraph' && e.inputType !== 'insertLineBreak') return false;
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return false;
  const node = sel.anchorNode;
  const el = node?.nodeType === 1 ? node : node?.parentElement;
  const name = el?.closest?.('.index-page .idx-sig-name');
  if (!name) return false;

  e.preventDefault();
  _saveSnapshot();
  const r = sel.getRangeAt(0);
  if (!r.collapsed) r.deleteContents();
  const br = document.createElement('br');
  r.insertNode(br);

  // A <br> with nothing after it in the block draws no new line; give the caret
  // a second one to stand on when Enter was pressed at the very end.
  const tail = document.createRange();
  tail.setStartAfter(br);
  tail.setEnd(name, name.childNodes.length);
  if (!tail.toString() && !tail.cloneContents().querySelector?.('br')) {
    br.parentNode.insertBefore(document.createElement('br'), br.nextSibling);
  }

  const caret = document.createRange();
  caret.setStartAfter(br);
  caret.collapse(true);
  sel.removeAllRanges();
  sel.addRange(caret);
  _markPageEditedOf(name);
  return true;
}

// ── Typed signature rules (______ → solid line) ──
// A run of underscores typed into the preview is a signature line. Rendered as
// literal underscores it comes out as a dotted/broken row that also drifts with
// the font; what the auditor wants is one solid rule of exactly the length they
// typed. So the run is wrapped in a `.sig-rule` span whose CSS hides the glyphs
// and draws a border under the same box — identical width, and it visibly grows
// with every extra underscore because the caret is left inside the span.
//
// Everything here works off the caret's own text node: no full-page rescan, and
// the caret position is recomputed explicitly rather than restored from a
// serialised offset, which is what makes it safe to run on every keystroke.
const SIG_RULE_MIN = 3; // underscores needed before a run becomes a line

function _sigCaret() {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || !sel.isCollapsed) return null;
  const r = sel.getRangeAt(0);
  if (r.startContainer.nodeType !== 3) return null;
  return { node: r.startContainer, offset: r.startOffset };
}

function _sigSetCaret(node, offset) {
  if (!node || !node.isConnected) return;
  const sel = window.getSelection();
  const r = document.createRange();
  r.setStart(node, Math.max(0, Math.min(offset, node.length)));
  r.collapse(true);
  sel.removeAllRanges();
  sel.addRange(r);
}

function _syncSigRule() {
  const c = _sigCaret();
  if (!c) return;
  if (!c.node.parentElement?.closest?.('#document-output')) return;
  const span = c.node.parentElement.closest('.sig-rule');
  if (span) _sigRuleClean(span, c.offset);
  else _sigRuleWrap(c.node, c.offset);
}

// Caret is in ordinary text: if it sits in/next to a long enough underscore run,
// lift that run into its own .sig-rule span and leave the caret inside it.
function _sigRuleWrap(node, offset) {
  const text = node.data;
  let start = offset, end = offset;
  while (start > 0 && text[start - 1] === '_') start--;
  while (end < text.length && text[end] === '_') end++;
  if (end - start < SIG_RULE_MIN) return;
  const parent = node.parentNode;
  if (!parent) return;
  const span = document.createElement('span');
  span.className = 'sig-rule';
  span.textContent = text.slice(start, end);
  const after = document.createTextNode(text.slice(end));
  parent.replaceChild(after, node);
  parent.insertBefore(span, after);
  if (start > 0) parent.insertBefore(document.createTextNode(text.slice(0, start)), span);
  _sigSetCaret(span.firstChild, offset - start);
}

// Caret is inside an existing rule. Keep the span holding underscores only:
// anything else typed into it (or a run shrunk below the threshold by
// backspacing) is moved back out to plain text, carrying the caret with it.
function _sigRuleClean(span, offset) {
  if (span.childNodes.length !== 1 || span.firstChild.nodeType !== 3) return;
  const text = span.textContent;
  const m = new RegExp(`_{${SIG_RULE_MIN},}`).exec(text);
  const parent = span.parentNode;
  if (!parent) return;
  if (!m) { // no line left — unwrap, then let a nearby run re-form
    const plain = document.createTextNode(text);
    parent.replaceChild(plain, span);
    // Merge with the neighbouring text nodes by hand: normalize() would do it
    // too, but it invalidates the node the caret offset is measured against.
    let caret = offset;
    const prev = plain.previousSibling;
    if (prev && prev.nodeType === 3) {
      caret += prev.data.length;
      plain.data = prev.data + plain.data;
      prev.remove();
    }
    const next = plain.nextSibling;
    if (next && next.nodeType === 3) {
      plain.data += next.data;
      next.remove();
    }
    _sigSetCaret(plain, caret);
    _sigRuleWrap(plain, caret);
    return;
  }
  const before = text.slice(0, m.index);
  const run = m[0];
  const after = text.slice(m.index + run.length);
  if (!before && !after) return; // already exactly one run
  span.textContent = run;
  let beforeNode = null, afterNode = null;
  if (before) parent.insertBefore(beforeNode = document.createTextNode(before), span);
  if (after) parent.insertBefore(afterNode = document.createTextNode(after), span.nextSibling);
  if (offset <= before.length && beforeNode) _sigSetCaret(beforeNode, offset);
  else if (offset <= before.length + run.length) _sigSetCaret(span.firstChild, offset - before.length);
  else if (afterNode) _sigSetCaret(afterNode, offset - before.length - run.length);
}

// Hand-edited pages under `root`, grouped by uid (a page plus its
// continuations), each remembering the uid of the nearest preceding unedited
// page as an insertion anchor for the case where the section no longer exists
// in the new document.
function _editedGroups(root) {
  const pages = Array.from(root.querySelectorAll('.doc-page, .cover-page'));
  const groups = [];
  const byUid = {};
  let lastCleanUid = null;
  pages.forEach(page => {
    const uid = _pageUidOf(page);
    if (!page.hasAttribute('data-edited')) {
      if (uid) lastCleanUid = uid;
      return;
    }
    let g = uid ? byUid[uid] : null;
    if (!g) {
      g = { uid, nodes: [], anchorUid: lastCleanUid };
      if (uid) byUid[uid] = g;
      groups.push(g);
    }
    g.nodes.push(page);
  });
  return groups;
}

// Snapshot hand-edited pages before a regeneration wipes the preview. Edits
// read back from a saved statement or a draft (_loadPreviewEdits) are waiting
// in _pendingPreviewEdits and join in here, on the first regeneration after
// the load.
function _collectPreservedPages(output) {
  const groups = _editedGroups(output);
  if (_pendingPreviewEdits) {
    const tpl = document.createElement('template');
    _pendingPreviewEdits.forEach(g => {
      const nodes = (g.html || []).map(h => {
        tpl.innerHTML = h;
        const n = tpl.content.firstElementChild;
        if (n) n.setAttribute('data-edited', 'true');
        return n;
      }).filter(Boolean);
      if (nodes.length) groups.push({ uid: g.uid || '', nodes, anchorUid: g.anchorUid || null });
    });
    _pendingPreviewEdits = null;
  }
  if (!groups.length && !_removedPageUids.size) return null;
  return { groups };
}

// ── Preview edits on disk ──
// Hand-edited pages are saved with the statement (`previewEdits` in the record)
// and kept in the draft, so a reopen or a refresh brings them back. Only the
// edited pages are stored, never the whole document: everything else is rebuilt
// from the form as before, and the stored pages go through the same
// preserve-and-patch as a regeneration — so their protected variables are
// brought back in step with the form the moment they are restored.
// Open in New Year never carries them (BusinessInfoManager._formOnly).
let _pendingPreviewEdits = null;

// A page as it should be stored: no editor state, no editor chrome.
function _cleanPageHtml(page) {
  const c = page.cloneNode(true);
  c.removeAttribute('contenteditable');
  c.querySelectorAll('.insert-page-zone').forEach(z => z.remove());
  c.querySelectorAll('.tbl-row-hover').forEach(r => r.classList.remove('tbl-row-hover'));
  c.querySelectorAll('.sig-name[data-sig-editable]').forEach(n => {
    n.removeAttribute('contenteditable');
    n.removeAttribute('data-sig-editable');
  });
  return c.outerHTML;
}

function _serializeEditGroups(groups, removed) {
  if (!groups.length && !removed.length) return null;
  return {
    v: 1,
    groups: groups.map(g => ({ uid: g.uid, anchorUid: g.anchorUid, html: g.nodes.map(_cleanPageHtml) })),
    removed,
  };
}

// The current preview's edits, or null when there are none.
function _serializePreviewEdits() {
  const output = document.getElementById('document-output');
  if (!output) return null;
  return _serializeEditGroups(_editedGroups(output), Array.from(_removedPageUids));
}

// Statements saved before 4.29.0 have no `previewEdits`, but their full
// document HTML (`savedPagesHtml`) still carries the edited pages, flagged
// `data-edited`. Lift just those out. Deleted pages were never recorded there.
function _previewEditsFromHtml(html) {
  if (!html || typeof html !== 'string') return null;
  const box = document.createElement('div');
  box.innerHTML = html;
  return _serializeEditGroups(_editedGroups(box).filter(g => g.uid), []);
}

// Queue saved edits for the next generateDoc(). Call after applyFormState()
// (which clears edits) and before the regeneration that follows it.
function _loadPreviewEdits(edits) {
  _pendingPreviewEdits = null;
  if (!edits || edits.v !== 1) return false;
  _removedPageUids = new Set(Array.isArray(edits.removed) ? edits.removed : []);
  _pendingPreviewEdits = Array.isArray(edits.groups) && edits.groups.length ? edits.groups : null;
  return !!(_pendingPreviewEdits || _removedPageUids.size);
}

// Merge hand-edited pages into the freshly generated document: pages whose uid
// still exists replace their regenerated counterparts in place; unmatched
// groups (manually added pages, or sections gone from the new document) are
// re-inserted after their old neighbour.
//
// Then — and this is the whole point of protected variables — every value
// inside those preserved pages is re-rendered from the form field it came
// from. The user's wording survives the regeneration; the values do not go
// stale with it. The old pinning design had no such step, so an edited page
// silently kept showing whatever the form said at the moment it was edited,
// which is how a superseded loan account holder reached a signed certificate.
function _restorePreservedPages(output, preserved) {
  if (_removedPageUids.size) {
    output.querySelectorAll('.doc-page, .cover-page').forEach(p => {
      if (_removedPageUids.has(_pageUidOf(p)) ||
          _removedPageUids.has(p.getAttribute('data-page-uid-legacy') || '')) p.remove();
    });
  }
  if (!preserved) return;
  preserved.groups.forEach(g => {
    g.nodes.forEach(n => n.removeAttribute('contenteditable'));
    let matches = _pagesByUid(output, g.uid);
    // No match by uid: a group stored under a uid that went stale (an edited
    // page saved while the old, value-bearing uid was in use, after its heading
    // values had changed — the duplicated trust resolution). Match it by its own
    // section and fixed heading wording against a generated page nobody has
    // claimed yet.
    if (!matches.length && g.uid && !g.uid.startsWith('manual@') && g.nodes[0]) {
      const base = _pageUidBase(g.nodes[0]);
      const free = Array.from(output.querySelectorAll('.doc-page:not([data-edited]), .cover-page:not([data-edited])'))
        .find(p => _pageUidOf(p).startsWith(base + '@'));
      if (free) matches = _pagesByUid(output, _pageUidOf(free));
    }
    if (matches.length) {
      const at = matches[0];
      // Accounting policies ticked or unticked since the page was edited: add,
      // remove and renumber them inside the edited page itself, then let the
      // paginator reflow the group once (data-reflow).
      const fresh = matches.flatMap(m => Array.from(m.querySelectorAll('.policy-entry')));
      if (_reconcilePolicyEntries(g.nodes, fresh)) {
        g.nodes.forEach(n => n.setAttribute('data-reflow', 'true'));
      }
      // Carry the current uid onto the preserved pages, so the next
      // regeneration matches them directly.
      const uid = _pageUidOf(at);
      g.nodes.forEach(n => {
        if (uid) n.setAttribute('data-page-uid', uid);
        output.insertBefore(n, at);
      });
      matches.forEach(m => m.remove());
    } else {
      // Every policy unticked: the generated document has no policy page left
      // to match. Take the policies out of the edited one too, and drop it if
      // nothing but its header remains.
      if (!output.querySelector('.policy-entry') &&
          g.nodes.some(n => n.querySelector('.policy-entry[data-policy-key]'))) {
        _reconcilePolicyEntries(g.nodes, []);
        if (!g.nodes.some(n => n.querySelector('.policy-entry'))) return;
        g.nodes.forEach(n => n.setAttribute('data-reflow', 'true'));
      }
      let ref = null;
      if (g.anchorUid) {
        const anchors = _pagesByUid(output, g.anchorUid);
        ref = anchors.length ? anchors[anchors.length - 1] : null;
      }
      g.nodes.forEach(n => {
        if (ref) ref.after(n);
        else output.insertBefore(n, output.firstElementChild);
        ref = n;
      });
    }
    if (typeof DocVars !== 'undefined') DocVars.patch(g.nodes);
  });
}

// ── Accounting policies inside hand-edited pages ──
// The policy notes are one generated page (split by the paginator), so a single
// edit anywhere on it used to freeze the whole policy list: ticking, unticking
// or editing a policy on the left changed nothing on the right. Protected
// variables do not help here — a policy is not a value, it is a block.
//
// So the blocks are reconciled one by one. Every `.policy-entry` carries the
// generator's `data-policy-key` (policy id, or `custom:<form id>`) and its
// number sits in its own `.policy-num` span. On regeneration (and live in edit
// mode) the edited page's entries are compared with the freshly generated ones:
//   - a policy no longer ticked is removed, hand edits and all;
//   - a newly ticked policy is inserted after the entry that precedes it in the
//     generated order;
//   - every entry is renumbered to the generated sequence;
//   - an entry the user never touched (its HTML still hashes to the
//     `data-policy-sig` stamped when it was generated) is swapped for the fresh
//     one, so variant / PPE-rate / wording changes on the left reach it too;
//   - an entry the user did touch keeps their wording.
// `data-policy-keys` on the page records which policies the page was last
// generated with, so a policy the user deleted by hand on the page is not
// brought back by the next regeneration — only a policy newly ticked is.
function _policyHash(html) {
  const s = String(html || '').replace(/ style=""/g, '');
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function _policyHeadKey(entry) {
  const h = entry.querySelector('.underline-heading');
  return 'h:' + _uidSlug((h?.textContent || '').replace(/^\s*[\d.]+\s*/, ''));
}

function _policyKeyOf(entry) {
  return entry.getAttribute('data-policy-key') || _policyHeadKey(entry);
}

function _policyPristine(entry) {
  const sig = entry.getAttribute('data-policy-sig');
  return !!sig && sig === _policyHash(entry.innerHTML);
}

// Stamp the generated (unedited) policy entries after the red checker has
// painted them: their signature, and the policy list on the page(s) holding them.
function _stampPolicyEntries(root) {
  const keys = [];
  root.querySelectorAll('.policy-entry').forEach(e => {
    if (e.closest('[data-edited]')) return;
    e.setAttribute('data-policy-sig', _policyHash(e.innerHTML));
    keys.push(_policyKeyOf(e));
  });
  if (!keys.length) return;
  root.querySelectorAll('.doc-page:not([data-edited])').forEach(p => {
    if (p.querySelector('.policy-entry')) p.setAttribute('data-policy-keys', keys.join(' '));
  });
}

// A generated entry ready to go into an edited page: painted by the red checker
// (which skips edited pages, so it must happen before insertion) and signed.
function _freshPolicyClone(entry) {
  const c = entry.cloneNode(true);
  if (typeof SuperRed !== 'undefined') SuperRed.apply(c);
  c.setAttribute('data-policy-sig', _policyHash(c.innerHTML));
  return c;
}

// Put the leading number of a text node under `el` from `from` to `to`.
function _replaceLeadingNum(el, from, to) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.nodeValue.trim()) continue;
    const m = /^(\s*)(\d+(?:\.\d+)*\.?)/.exec(n.nodeValue);
    if (!m || (from != null && !m[2].startsWith(from))) return null;
    const old = m[2];
    n.nodeValue = m[1] + (from != null ? to + old.slice(from.length) : to) + n.nodeValue.slice(m[0].length);
    return old;
  }
  return null;
}

function _renumberPolicy(entry, want) {
  if (!want) return;
  const span = entry.querySelector('.policy-num');
  let old;
  if (span) {
    old = span.textContent.trim();
    if (old !== want) span.textContent = want;
  } else {
    // Pages saved before the number had its own span.
    const h = entry.querySelector('.underline-heading');
    old = h ? _replaceLeadingNum(h, null, want) : null;
  }
  // Numbered sub-headings (biological assets: "1.4.1 …") follow the parent.
  const oldBase = (old || '').replace(/\.$/, '');
  const newBase = want.replace(/\.$/, '');
  if (oldBase && oldBase !== newBase) {
    entry.querySelectorAll('.policy-subheading').forEach(s => _replaceLeadingNum(s, oldBase + '.', newBase + '.'));
  }
}

// Bring the policy entries in `nodes` (one page group) in line with `fresh`
// (the generated entries, in order). Returns true when entries were added,
// removed or replaced — i.e. the group needs reflowing.
function _reconcilePolicyEntries(nodes, fresh) {
  const live = nodes.flatMap(n => Array.from(n.querySelectorAll('.policy-entry')));
  const stamp = nodes.map(n => n.getAttribute('data-policy-keys')).find(Boolean);
  if (!live.length && !stamp) return false;

  const freshByKey = new Map();
  const freshByHead = new Map();
  fresh.forEach(f => {
    freshByKey.set(_policyKeyOf(f), f);
    freshByHead.set(_policyHeadKey(f), f);
  });
  // Pages saved before entries carried a key: adopt one by heading wording.
  live.forEach(e => {
    if (e.hasAttribute('data-policy-key')) return;
    const f = freshByHead.get(_policyHeadKey(e));
    if (f?.hasAttribute('data-policy-key')) e.setAttribute('data-policy-key', f.getAttribute('data-policy-key'));
  });
  const keyed = live.filter(e => e.hasAttribute('data-policy-key'));
  const known = new Set(stamp ? stamp.split(' ') : keyed.map(_policyKeyOf));

  let changed = false;
  const liveByKey = new Map();
  keyed.forEach(e => {
    const k = e.getAttribute('data-policy-key');
    if (!freshByKey.has(k)) { e.remove(); changed = true; return; }
    if (!liveByKey.has(k)) liveByKey.set(k, e);
  });

  // A policy deleted by hand still holds its number in the generated sequence;
  // close the gap it leaves so the page reads 1.1, 1.2, 1.3 without a hole.
  let skipped = 0;
  const numFor = (f) => {
    const n = f.querySelector('.policy-num')?.textContent.trim() || '';
    const m = /^1\.(\d+)$/.exec(n);
    return (m && skipped) ? `1.${parseInt(m[1], 10) - skipped}` : n;
  };
  const cloneFor = (f) => {
    const c = _freshPolicyClone(f);
    const want = numFor(f);
    if (want !== (f.querySelector('.policy-num')?.textContent.trim() || '')) {
      _renumberPolicy(c, want);
      c.setAttribute('data-policy-sig', _policyHash(c.innerHTML));
    }
    return c;
  };

  let prev = null;
  fresh.forEach(f => {
    const k = _policyKeyOf(f);
    let e = liveByKey.get(k);
    if (e) {
      if (_policyPristine(e)) {
        const c = cloneFor(f);
        if (c.getAttribute('data-policy-sig') !== e.getAttribute('data-policy-sig')) {
          e.replaceWith(c);
          e = c;
          changed = true;
        }
      } else {
        _renumberPolicy(e, numFor(f));
      }
      prev = e;
      return;
    }
    if (known.has(k)) { // deleted by hand on the page — stays deleted
      if (/^1\.\d+$/.test(f.querySelector('.policy-num')?.textContent.trim() || '')) skipped++;
      return;
    }
    const c = cloneFor(f);
    if (prev) {
      prev.after(c);
    } else {
      const next = keyed.find(x => x.isConnected);
      if (next) {
        next.before(c);
      } else {
        const host = nodes[0];
        const num = host.querySelector(':scope > .page-number');
        if (num) host.insertBefore(c, num);
        else host.appendChild(c);
      }
    }
    prev = c;
    changed = true;
  });

  const keys = fresh.map(_policyKeyOf).join(' ');
  nodes.forEach(n => {
    if (keys) n.setAttribute('data-policy-keys', keys);
    else n.removeAttribute('data-policy-keys');
  });
  return changed;
}

// Edit mode never regenerates (liveUpdate only patches protected variables), so
// a policy ticked or unticked there is reconciled straight into the page on
// screen against a document generated off-screen, then the preview reflows.
function _syncPoliciesLive(output) {
  if (typeof documentGenerator === 'undefined') return;
  const first = Array.from(output.querySelectorAll('.doc-page'))
    .find(p => p.querySelector('.policy-entry') || p.hasAttribute('data-policy-keys'));
  if (!first) return;
  const uid = _pageUidOf(first);
  const group = uid
    ? Array.from(output.querySelectorAll(`.doc-page[data-page-uid="${CSS.escape(uid)}"]`))
    : [first];

  const tpl = document.createElement('template');
  tpl.innerHTML = documentGenerator.generate();
  const fresh = Array.from(tpl.content.querySelectorAll('.policy-entry'));
  if (!_reconcilePolicyEntries(group, fresh)) return;

  if (group.some(p => p.hasAttribute('data-edited'))) {
    group.forEach(p => p.setAttribute('data-reflow', 'true'));
  }
  if (typeof PagePaginator !== 'undefined') new PagePaginator(output).paginate();
  output.querySelectorAll('.doc-page, .cover-page').forEach(p => p.setAttribute('contenteditable', 'true'));
  if (typeof _refreshInsertZones === 'function') _refreshInsertZones();
}

// Forget every hand edit without regenerating — used when a business is
// loaded or imported, since the incoming document has nothing to do with them.
function _clearPageEdits() {
  _removedPageUids.clear();
  _pendingPreviewEdits = null;
  document.querySelectorAll('#document-output [data-edited]').forEach(p => {
    p.removeAttribute('data-edited');
  });
  if (typeof DocVars !== 'undefined' && DocVars.forgetRhsWrites) DocVars.forgetRhsWrites();
}

// Discard every preview edit: forget all hand edits and removed pages, and
// rebuild the whole document from the form. Reachable from Settings.
function discardRhsChanges() {
  if (_hasPreviewEdits() && !confirm(
      'Discard your manual changes to the preview and rebuild every page from the form?')) return;
  _clearPageEdits();
  const btn = document.getElementById('btn-edit-preview');
  if (btn?.classList.contains('active')) {
    toggleEditPreview();
  }
  if (typeof generateDoc === 'function') generateDoc();
}

// Rebuild PDF: start the document over as if it were brand new. Unlike
// discardRhsChanges it also puts back every form value that was typed over on
// the preview (a red value retyped on the page writes its form field — see
// DocVars.write), wipes the preview outright before regenerating (so nothing -
// edited pages, their protected variables, manual pages, deleted-page
// suppressions - can be carried across), drops the undo history that could
// bring the old pages back, and counts as an unsaved change so the next Save
// writes the statement without its old `previewEdits`. Reachable from Settings.
//
// Asks through an in-app dialog rather than confirm(): the button gave no sign
// of life at all on the office machines when it relied on the native one.
function rebuildPdf() {
  _askRebuildPdf().then(ok => { if (ok) _doRebuildPdf(); });
}

function _askRebuildPdf() {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'page-selector-overlay';
    const done = (ok) => { overlay.remove(); resolve(ok); };
    overlay.onclick = (e) => { if (e.target === overlay) done(false); };
    const modal = document.createElement('div');
    modal.className = 'page-selector-modal';
    modal.style.maxWidth = '440px';
    modal.innerHTML = `
      <h3 style="margin:0 0 10px;">Rebuild PDF</h3>
      <p style="margin:0 0 16px;font-size:9.5pt;color:var(--muted);">
        Rebuild the whole document from the form as a new document? Every manual
        change on the preview is lost, and values you retyped on the preview go
        back to what the form held before.
      </p>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button type="button" class="btn btn-secondary" data-act="no" style="min-width:100px;">Cancel</button>
        <button type="button" class="btn btn-primary" data-act="yes" style="min-width:100px;">Rebuild</button>
      </div>`;
    modal.querySelector('[data-act="no"]').onclick = () => done(false);
    modal.querySelector('[data-act="yes"]').onclick = () => done(true);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  });
}

function _doRebuildPdf() {
  const btn = document.getElementById('btn-edit-preview');
  if (btn?.classList.contains('active')) toggleEditPreview();
  if (typeof DocVars !== 'undefined' && DocVars.revertRhsWrites) DocVars.revertRhsWrites();
  _clearPageEdits();
  _undoStack = [];
  _redoStack = [];
  const output = document.getElementById('document-output');
  if (output) output.innerHTML = '';
  if (typeof generateDoc === 'function') generateDoc();
  _notePreviewChange();
}

// ── Toggle edit mode ──
function toggleEditPreview() {
  const output = document.getElementById('document-output');
  const btn = document.getElementById('btn-edit-preview');
  const toolbar = document.getElementById('edit-toolbar');
  const ruler = document.getElementById('indent-ruler');
  const bar = document.getElementById('mode-toggle-bar');
  if (!output) return;
  const isEditing = btn?.classList.contains('active');
  if (isEditing) {
    // Leaving edit mode keeps the edits in the preview DOM — hand-edited pages
    // survive regeneration, so nothing needs guarding here.
    if (_rhsInputListener) {
      output.removeEventListener('input', _rhsInputListener);
      _rhsInputListener = null;
    }
    if (_rhsBeforeInputListener) {
      output.removeEventListener('beforeinput', _rhsBeforeInputListener);
      _rhsBeforeInputListener = null;
    }
    if (_fontSizeReadoutListener) {
      document.removeEventListener('selectionchange', _fontSizeReadoutListener);
      _fontSizeReadoutListener = null;
      const label = document.getElementById('opt-font-size-label');
      if (label) label.textContent = 'Aa';
      const lhLabel = document.getElementById('opt-line-height-label');
      if (lhLabel) lhLabel.textContent = '↕';
      const fsBox = document.getElementById('input-font-size');
      if (fsBox) fsBox.value = '';
    }
    output.querySelectorAll('.doc-page, .cover-page').forEach(p => p.removeAttribute('contenteditable'));
    btn?.classList.remove('active');
    btn && (btn.textContent = '✏️ Edit');
    toolbar?.classList.remove('visible');
    ruler?.classList.remove('visible');
    bar?.classList.remove('editing');
    _teardownSigDrag();
    if (typeof EditTableRows !== 'undefined') EditTableRows.detach();
    if (typeof _refreshInsertZones === 'function') _refreshInsertZones();
  } else {
    output.querySelectorAll('.doc-page, .cover-page').forEach(p => p.setAttribute('contenteditable', 'true'));
    btn?.classList.add('active');
    btn && (btn.textContent = '✏️ Stop Editing');
    toolbar?.classList.add('visible');
    ruler?.classList.add('visible');
    bar?.classList.add('editing');
    _initRuler();
    _initSigDrag();
    if (typeof EditTableRows !== 'undefined') EditTableRows.attach(output);
    if (typeof _refreshInsertZones === 'function') _refreshInsertZones();
    _rhsInputListener = _onRhsInput;
    output.addEventListener('input', _rhsInputListener);
    _rhsBeforeInputListener = _onRhsBeforeInput;
    output.addEventListener('beforeinput', _rhsBeforeInputListener);
    _fontSizeReadoutListener = _updateFontSizeReadout;
    document.addEventListener('selectionchange', _fontSizeReadoutListener);
  }
}

// ── Formatting toolbar commands ──
function execFmt(command) {
  document.execCommand(command, false, null);
}
function execFmtVal(command, value) {
  if (value) document.execCommand(command, false, value);
}

// ── Font Size (preset + custom exact pt) ──
// Dispatcher for the toolbar font-size dropdown. Preset values (1–6) map to the
// legacy execCommand sizes; "custom" hands over to the exact-pt box beside it.
function applyFontSize(value) {
  if (!value) return;
  if (value === 'custom') { setCustomFontSize(); return; }
  execFmtVal('fontSize', value);
}

// "Custom…" used to open the browser's prompt(). It now puts the caret in the
// toolbar's pt box, pre-filled with the selection's size, ready to type over.
function setCustomFontSize() {
  const sel = window.getSelection();
  if ((!sel || sel.isCollapsed) && !_restoreEditSelection()) {
    alert('Select some text first to set a custom font size.');
    return;
  }
  const box = document.getElementById('input-font-size');
  if (!box) return;
  _updateFontSizeReadout();
  box.focus();
  box.select();
}

// The free-text route: type any pt size into the toolbar box, press Enter.
function applyFontSizeInput() {
  const box = document.getElementById('input-font-size');
  if (!box) return;
  const raw = box.value.trim();
  if (!raw) return;
  const pt = parseFloat(raw);
  if (!isFinite(pt) || pt < 1 || pt > 200) {
    alert('Please enter a font size between 1 and 200 points — for example 11 or 12.5.');
    return;
  }
  if (_applyFontSizePt(pt)) box.blur();
}

// Apply an exact point size to the current (or last remembered) selection.
// Works by applying the legacy sentinel size 7, then rewriting the <font>
// elements the browser produced into ones carrying the precise pt value —
// this handles selections spanning multiple nodes correctly.
function _applyFontSizePt(pt) {
  const output = document.getElementById('document-output');
  if (!output) return false;
  let sel = window.getSelection();
  const inPreview = sel && sel.rangeCount && !sel.isCollapsed && output.contains(sel.anchorNode);
  if (!inPreview && !_restoreEditSelection()) {
    alert('Select some text first to set the font size.');
    return false;
  }
  sel = window.getSelection();
  const range = sel.getRangeAt(0).cloneRange();
  // execCommand acts on the focused editing host — with focus still in the pt
  // box it would do nothing, so hand focus back to the page and re-select.
  const host = (range.commonAncestorContainer.nodeType === 1
    ? range.commonAncestorContainer
    : range.commonAncestorContainer.parentElement)?.closest('[contenteditable="true"]');
  if (host && document.activeElement !== host) {
    host.focus({ preventScroll: true });
    sel.removeAllRanges();
    sel.addRange(range);
  }
  _saveSnapshot();
  _markPageEditedOf(sel.anchorNode);
  document.execCommand('fontSize', false, '7');
  output.querySelectorAll('font[size="7"]').forEach(f => {
    f.removeAttribute('size');
    f.style.fontSize = pt + 'pt';
  });
  _updateFontSizeReadout();
  return true;
}

// ── Font-size readout ──
// While edit mode is on, the font-size dropdown's placeholder shows the size of
// the current selection instead of "Aa", so users can read the exact pt value.
let _fontSizeReadoutListener = null;

// The last non-collapsed selection made inside the preview. Toolbar controls that
// take keyboard focus (the exact-line-height box) steal the document selection,
// so they restore this before acting on it.
let _lastEditRange = null;

function _restoreEditSelection() {
  const output = document.getElementById('document-output');
  if (!_lastEditRange || !output || !output.contains(_lastEditRange.commonAncestorContainer)) return false;
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(_lastEditRange);
  return true;
}

// Every distinct computed font size (in px) covered by a range, read off the
// parent element of each text node the range touches.
function _rangeFontSizes(range) {
  const sizes = new Set();
  const root = range.commonAncestorContainer;
  const add = node => {
    const el = node.nodeType === 3 ? node.parentElement : node;
    if (el) sizes.add(window.getComputedStyle(el).fontSize);
  };
  if (root.nodeType === 3) { add(root); return sizes; }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: n => (range.intersectsNode(n) && n.nodeValue.trim())
      ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
  });
  while (walker.nextNode()) add(walker.currentNode);
  if (!sizes.size) add(root);
  return sizes;
}

// px is absolute at print size, so the pt conversion is a plain 72/96 ratio.
function _pxToPtLabel(px) {
  const pt = parseFloat(px) * 0.75;
  if (!isFinite(pt)) return null;
  return (Math.round(pt * 10) / 10) + 'pt';
}

// Every distinct line-height a range touches, expressed as a unitless ratio of
// line-height ÷ font-size (getComputedStyle always resolves both to px), so the
// readout reads like a word-processor's line-spacing value (1.0, 1.15, 1.5…).
function _rangeLineHeights(range) {
  const ratios = new Set();
  const root = range.commonAncestorContainer;
  const add = node => {
    const el = node.nodeType === 3 ? node.parentElement : node;
    if (!el) return;
    const cs = window.getComputedStyle(el);
    const lh = parseFloat(cs.lineHeight);
    const fs = parseFloat(cs.fontSize);
    if (isFinite(lh) && isFinite(fs) && fs > 0) {
      ratios.add(String(Math.round((lh / fs) * 100) / 100));
    }
  };
  if (root.nodeType === 3) { add(root); return ratios; }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: n => (range.intersectsNode(n) && n.nodeValue.trim())
      ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
  });
  while (walker.nextNode()) add(walker.currentNode);
  if (!ratios.size) add(root);
  return ratios;
}

// Refresh both selection readouts: font size on the font-size dropdown and line
// height on the paragraph-spacing (¶) dropdown, so a highlight shows both.
function _updateFontSizeReadout() {
  const label = document.getElementById('opt-font-size-label');
  const lhLabel = document.getElementById('opt-line-height-label');
  const reset = () => {
    if (label) label.textContent = 'Aa';
    if (lhLabel) lhLabel.textContent = '↕';
  };
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || sel.isCollapsed) return reset();
  const output = document.getElementById('document-output');
  if (!output || !output.contains(sel.anchorNode)) return reset();
  const range = sel.getRangeAt(0);
  // Focusing the exact-line-height box moves the document selection into the box,
  // so the range the user highlighted has to be remembered here, while it exists.
  _lastEditRange = range.cloneRange();

  if (label) {
    const sizes = _rangeFontSizes(range);
    if (sizes.size !== 1) label.textContent = sizes.size ? 'Mixed' : 'Aa';
    else label.textContent = _pxToPtLabel([...sizes][0]) || 'Aa';
    const fsBox = document.getElementById('input-font-size');
    // Never overwrite a size the user is in the middle of typing.
    if (fsBox && document.activeElement !== fsBox) {
      fsBox.value = sizes.size === 1 ? (parseFloat(_pxToPtLabel([...sizes][0])) || '') : '';
    }
  }
  if (lhLabel) {
    const heights = _rangeLineHeights(range);
    if (heights.size !== 1) lhLabel.textContent = heights.size ? 'Mix' : '¶';
    else lhLabel.textContent = [...heights][0] + '×';
    const box = document.getElementById('input-line-height');
    // Never overwrite a value the user is in the middle of typing.
    if (box && document.activeElement !== box) {
      box.value = heights.size === 1 ? [...heights][0] : '';
    }
  }
}

// ── Format Painter ──
// Copies the character formatting of the selected text (font family, size,
// weight, style, decoration, letter/word spacing, capitalisation, colour and
// highlight) together with the paragraph formatting of the block it sits in
// (line height, alignment, spacing above/below, first-line indent), then
// re-applies both to the next selection made in the preview.
//
// Two things used to make it miss:
//   * it read its styles off `anchorNode.parentElement`, which is the page (or
//     some wrapper) whenever the selection started at a block boundary — so it
//     copied the page defaults instead of the text's own formatting;
//   * it wrapped the target in a span and stopped there, so an inline style or
//     a <b>/<font> tag already inside the target still won the cascade and the
//     paint appeared to do nothing.
// It now reads from the first real text node inside the range, and clears the
// competing formatting inside the span it paints.
const FMT_PAINTER_INLINE = [
  'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontVariant',
  'letterSpacing', 'wordSpacing', 'textTransform', 'textDecorationLine',
  'color', 'backgroundColor'
];
const FMT_PAINTER_BLOCK = ['textAlign', 'marginTop', 'marginBottom', 'textIndent'];
const FMT_PAINTER_BLOCK_SEL = 'p, li, h1, h2, h3, h4, h5, h6, td, th, blockquote';
// Inline tags that hard-code one of the painted properties. Painting a weight
// onto text wrapped in <b> only works if the <b> goes.
const FMT_PAINTER_TAG_PROP = {
  B: 'fontWeight', STRONG: 'fontWeight',
  I: 'fontStyle', EM: 'fontStyle',
  U: 'textDecorationLine', S: 'textDecorationLine', STRIKE: 'textDecorationLine'
};

let _fmtPainter = null;        // captured { inline, block } while the painter is armed
let _fmtPainterSticky = false; // Shift/Alt-click: stay armed for repeated painting

function _camelToCss(prop) {
  return prop.replace(/[A-Z]/g, c => '-' + c.toLowerCase());
}

// The element that actually carries the formatting of a range: the parent of the
// first non-blank text node it touches. Falls back to the range container.
function _rangeStyleSource(range) {
  const root = range.commonAncestorContainer;
  if (root.nodeType === 3) return root.parentElement;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: n => (range.intersectsNode(n) && n.nodeValue.trim())
      ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
  });
  const text = walker.nextNode();
  if (text) return text.parentElement;
  return root.nodeType === 1 ? root : root.parentElement;
}

function _capturePainterStyles(range) {
  const el = _rangeStyleSource(range);
  if (!el) return null;
  const cs = window.getComputedStyle(el);

  const inline = {};
  FMT_PAINTER_INLINE.forEach(p => { if (cs[p]) inline[p] = cs[p]; });
  // The keyword highlight is a preview-only review aid, not a format anyone
  // authored — painting it would write that red onto the printed page. Every
  // other colour is the auditor's own and gets copied.
  if (isHighlightColour(inline.color)) delete inline.color;
  if (isHighlightColour(inline.backgroundColor)) delete inline.backgroundColor;
  const bg = (inline.backgroundColor || '').replace(/\s/g, '');
  if (!bg || bg === 'transparent' || /^rgba\(0,0,0,0\)$/.test(bg)) delete inline.backgroundColor;

  const block = {};
  const src = el.closest(FMT_PAINTER_BLOCK_SEL);
  if (src) {
    const bcs = window.getComputedStyle(src);
    // Unitless, so the painted spacing scales with the target's own font size —
    // the same ratio the line-height readout reports.
    const lh = parseFloat(bcs.lineHeight);
    const fs = parseFloat(bcs.fontSize);
    if (isFinite(lh) && isFinite(fs) && fs > 0) {
      block.lineHeight = String(Math.round((lh / fs) * 100) / 100);
    }
    FMT_PAINTER_BLOCK.forEach(p => { if (bcs[p]) block[p] = bcs[p]; });
  }
  return { inline, block };
}

function _unwrapElement(el) {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
}

// Strip whatever inside the painted span would out-rank it: legacy <font>
// elements, formatting tags that own a painted property, and inline styles that
// restate one.
function _clearCompetingFormatting(span, inline) {
  const props = Object.keys(inline);
  const paintsDecoration = props.includes('textDecorationLine');
  Array.from(span.querySelectorAll('*')).forEach(el => {
    if (el.tagName === 'FONT') { _unwrapElement(el); return; }
    const owned = FMT_PAINTER_TAG_PROP[el.tagName];
    if (owned && props.includes(owned)) { _unwrapElement(el); return; }
    if (!el.style) return;
    props.forEach(p => el.style.removeProperty(_camelToCss(p)));
    if (paintsDecoration) {
      el.style.removeProperty('text-decoration');
      el.style.removeProperty('text-decoration-color');
      el.style.removeProperty('text-decoration-style');
    }
    if (!el.getAttribute('style')) el.removeAttribute('style');
  });
}

function _paintSelection(styles) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || sel.isCollapsed) return false;
  const output = document.getElementById('document-output');
  if (!output || !output.contains(sel.anchorNode)) return false;

  const range = sel.getRangeAt(0);
  const container = range.commonAncestorContainer;
  const page = container.nodeType === 1
    ? container.closest('.doc-page, .cover-page')
    : container.parentElement?.closest('.doc-page, .cover-page');
  if (!page) return false;

  _saveSnapshot();

  // Collect the target blocks before the DOM is rewritten — `intersectsNode`
  // needs the range still intact, and the elements survive the wrap either way.
  const blocks = [];
  if (Object.keys(styles.block).length) {
    page.querySelectorAll(FMT_PAINTER_BLOCK_SEL).forEach(b => {
      if (range.intersectsNode(b)) blocks.push(b);
    });
  }

  const span = document.createElement('span');
  Object.entries(styles.inline).forEach(([k, v]) => { span.style[k] = v; });
  // surroundContents throws when the selection starts or ends midway through a
  // child element; extractContents splits those boundaries for us.
  try {
    range.surroundContents(span);
  } catch (_) {
    span.appendChild(range.extractContents());
    range.insertNode(span);
  }
  _clearCompetingFormatting(span, styles.inline);

  blocks.forEach(b => {
    Object.entries(styles.block).forEach(([k, v]) => { b.style[k] = v; });
  });

  _markPageEdited(page);
  _updateFontSizeReadout();
  return true;
}

function _disarmFormatPainter() {
  _fmtPainter = null;
  _fmtPainterSticky = false;
  const btn = document.getElementById('btn-fmt-painter');
  btn?.classList.remove('tb-active', 'tb-sticky');
  const output = document.getElementById('document-output');
  output?.classList.remove('fmt-painter-cursor');
  output?.removeEventListener('mouseup', _fmtPainterMouseUp);
  document.removeEventListener('keydown', _fmtPainterKeyDown, true);
}

function _fmtPainterMouseUp() {
  // Let the browser finish settling the selection this mouseup produced.
  setTimeout(() => {
    if (!_fmtPainter) return;
    const sel = window.getSelection();
    // A plain click only places the caret — stay armed rather than burning the
    // copied formatting on nothing, which is what made the painter feel random.
    if (!sel || !sel.rangeCount || sel.isCollapsed) return;
    const styles = _fmtPainter;
    const sticky = _fmtPainterSticky;
    const painted = _paintSelection(styles);
    if (!sticky && painted) {
      _disarmFormatPainter();
      window.getSelection()?.removeAllRanges();
    }
  }, 0);
}

function _fmtPainterKeyDown(e) {
  if (e.key === 'Escape') {
    e.preventDefault();
    _disarmFormatPainter();
  }
}

function toggleFormatPainter(evt) {
  const btn = document.getElementById('btn-fmt-painter');
  if (_fmtPainter) { _disarmFormatPainter(); return; }

  const sel = window.getSelection();
  const output = document.getElementById('document-output');
  if (!output) return;
  if (!sel || !sel.rangeCount || sel.isCollapsed || !output.contains(sel.anchorNode)) {
    alert('Select the text whose formatting you want to copy, then click the Format Painter.');
    return;
  }
  const styles = _capturePainterStyles(sel.getRangeAt(0));
  if (!styles) return;

  _fmtPainter = styles;
  _fmtPainterSticky = !!(evt && (evt.shiftKey || evt.altKey));
  btn?.classList.add('tb-active');
  if (_fmtPainterSticky) btn?.classList.add('tb-sticky');
  output.classList.add('fmt-painter-cursor');
  output.addEventListener('mouseup', _fmtPainterMouseUp);
  document.addEventListener('keydown', _fmtPainterKeyDown, true);

  if (typeof BusinessInfoManager !== 'undefined') {
    BusinessInfoManager.showToast(
      _fmtPainterSticky
        ? 'Format Painter locked on — select text to paint it, as often as you like. Esc or click the button again to stop.'
        : 'Format Painter armed — select the text to paint. Esc to cancel; Shift-click the button to keep it on for several selections.',
      'info', 5000
    );
  }
}

// ── Page number toggle ──
function togglePageNumbers() {
  const output = document.getElementById('document-output');
  const btn = document.getElementById('btn-page-numbers');
  if (!output) return;
  const isShowing = btn.classList.contains('tb-active');
  const nums = output.querySelectorAll('.page-number');
  if (isShowing) {
    nums.forEach(el => el.style.display = 'none');
    btn.classList.remove('tb-active');
  } else {
    nums.forEach(el => el.style.display = 'block');
    btn.classList.add('tb-active');
  }
}

// ── Undo / Redo with snapshot fallback for DOM mutations ──
let _undoStack = [];
let _redoStack = [];

function _saveSnapshot() {
  const output = document.getElementById('document-output');
  if (!output) return;
  _undoStack.push(output.innerHTML);
  if (_undoStack.length > 30) _undoStack.shift(); // cap memory
  _redoStack = [];
}

function toolbarUndo() {
  const output = document.getElementById('document-output');
  if (!output) return;
  // Try native undo first
  if (document.queryCommandEnabled('undo')) {
    document.execCommand('undo', false, null);
  }
  // Fallback: snapshot undo
  if (_undoStack.length) {
    _redoStack.push(output.innerHTML);
    output.innerHTML = _undoStack.pop();
    output.querySelectorAll('.doc-page, .cover-page').forEach(p => p.setAttribute('contenteditable', 'true'));
    _initSigDrag();
    }
}

function toolbarRedo() {
  const output = document.getElementById('document-output');
  if (!output) return;
  if (document.queryCommandEnabled('redo')) {
    document.execCommand('redo', false, null);
  }
  if (_redoStack.length) {
    _undoStack.push(output.innerHTML);
    output.innerHTML = _redoStack.pop();
    output.querySelectorAll('.doc-page, .cover-page').forEach(p => p.setAttribute('contenteditable', 'true'));
    _initSigDrag();
    }
}

// ── Paragraph Spacing ──
function setParaSpacing(pt) {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) {
    alert('Select some text first to change paragraph spacing.');
    return;
  }
  const range = sel.getRangeAt(0);
  const container = range.commonAncestorContainer;
  const page = container.nodeType === 1
    ? container.closest('.doc-page, .cover-page')
    : container.parentElement?.closest('.doc-page, .cover-page');
  if (!page) return;

  _saveSnapshot();
  _markPageEdited(page);
  const paras = page.querySelectorAll('p, li, h2, h3');
  paras.forEach(p => {
    if (range.intersectsNode(p)) {
      p.style.marginBottom = pt + 'pt';
    }
  });
}

// ── Line Height ──
// Applies a unitless line-height (1.0, 1.15, 1.7…) to every block the selection
// touches. Unitless so it scales with each block's own font size, matching how
// the readout on the ↕ dropdown reports it. "custom" prompts for an exact ratio.
function setLineHeight(value) {
  if (value === 'custom') { setCustomLineHeight(); return; }
  const ratio = parseFloat(value);
  if (!isFinite(ratio) || ratio <= 0) return;
  _applyLineHeight(ratio);
}

function setCustomLineHeight() {
  const sel = window.getSelection();
  if ((!sel || sel.isCollapsed) && !_restoreEditSelection()) {
    alert('Select some text first to change line height.');
    return;
  }
  const heights = _rangeLineHeights(sel.getRangeAt(0));
  const current = heights.size === 1 ? [...heights][0] : '';
  const input = prompt('Enter line height (e.g. 1.5, 1.7):', current || '1.15');
  if (input === null) return;
  const ratio = parseFloat(input);
  if (!isFinite(ratio) || ratio <= 0 || ratio > 10) {
    alert('Please enter a valid line height between 0.1 and 10.');
    return;
  }
  _applyLineHeight(ratio);
}

// The ↕ dropdown only offers round numbers. This is the free-text route: type
// any ratio (1.2, 1.35, 1.45…) into the toolbar box and press Enter.
function applyLineHeightInput() {
  const box = document.getElementById('input-line-height');
  if (!box) return;
  const raw = box.value.trim();
  if (!raw) return;
  const ratio = parseFloat(raw);
  if (!isFinite(ratio) || ratio < 0.1 || ratio > 10) {
    alert('Please enter a line height between 0.1 and 10 — for example 1.2 or 1.4.');
    return;
  }
  if (!_restoreEditSelection()) {
    alert('Select some text first to change line height.');
    return;
  }
  _applyLineHeight(ratio);
  box.blur();
}

function _applyLineHeight(ratio) {
  const sel = window.getSelection();
  if ((!sel || sel.isCollapsed) && !_restoreEditSelection()) {
    alert('Select some text first to change line height.');
    return;
  }
  const range = sel.getRangeAt(0);
  const container = range.commonAncestorContainer;
  const page = container.nodeType === 1
    ? container.closest('.doc-page, .cover-page')
    : container.parentElement?.closest('.doc-page, .cover-page');
  if (!page) return;

  _saveSnapshot();
  _markPageEdited(page);
  const paras = page.querySelectorAll('p, li, h2, h3');
  paras.forEach(p => {
    if (range.intersectsNode(p)) {
      p.style.lineHeight = String(ratio);
    }
  });
  _updateFontSizeReadout();
}

// ── Indent Ruler ──
let _rulerLeftPx = 0;
let _rulerRightPx = 0;

function _initRuler() {
  const track = document.getElementById('ruler-track');
  const ticks = document.getElementById('ruler-ticks');
  if (!track || !ticks) return;

  ticks.innerHTML = '';
  const trackW = track.offsetWidth;
  if (trackW <= 0) return;

  // Full A4 width = 21cm, ruler spans edge to edge
  const cmCount = 21;
  for (let cm = 0; cm <= cmCount; cm++) {
    const x = (cm / cmCount) * trackW;
    const tick = document.createElement('div');
    tick.className = 'ruler-tick ruler-tick-major';
    tick.style.left = x + 'px';
    ticks.appendChild(tick);

    const label = document.createElement('div');
    label.className = 'ruler-tick-label';
    label.style.left = x + 'px';
    label.textContent = cm;
    ticks.appendChild(label);

    if (cm < cmCount) {
      const halfX = ((cm + 0.5) / cmCount) * trackW;
      const minor = document.createElement('div');
      minor.className = 'ruler-tick ruler-tick-minor';
      minor.style.left = halfX + 'px';
      ticks.appendChild(minor);
    }
  }

  // Reset handle positions
  const left = document.getElementById('ruler-left');
  const right = document.getElementById('ruler-right');
  if (left) { left.style.left = '0px'; left.style.right = ''; }
  if (right) { right.style.right = '0px'; right.style.left = ''; }
  _rulerLeftPx = 0;
  _rulerRightPx = 0;

  _attachRulerDrag('ruler-left', 'left');
  _attachRulerDrag('ruler-right', 'right');
}

function _attachRulerDrag(handleId, side) {
  const handle = document.getElementById(handleId);
  const track = document.getElementById('ruler-track');
  if (!handle || !track) return;

  // Remove old listeners by replacing the node
  const fresh = handle.cloneNode(true);
  handle.parentNode.replaceChild(fresh, handle);

  let startX = 0;
  let startPos = 0;

  function onDown(e) {
    e.preventDefault();
    fresh.classList.add('dragging');
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    startX = clientX;
    startPos = side === 'left' ? _rulerLeftPx : _rulerRightPx;
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onUp);
  }

  function onMove(e) {
    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const dx = clientX - startX;
    const trackW = track.offsetWidth;

    if (side === 'left') {
      _rulerLeftPx = Math.max(0, Math.min(startPos + dx, trackW - _rulerRightPx - 40));
      fresh.style.left = _rulerLeftPx + 'px';
    } else {
      _rulerRightPx = Math.max(0, Math.min(startPos - dx, trackW - _rulerLeftPx - 40));
      fresh.style.right = _rulerRightPx + 'px';
    }
    _applyIndent();
  }

  function onUp() {
    fresh.classList.remove('dragging');
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onUp);
  }

  fresh.addEventListener('mousedown', onDown);
  fresh.addEventListener('touchstart', onDown, { passive: false });
}

function _applyIndent() {
  const track = document.getElementById('ruler-track');
  const output = document.getElementById('document-output');
  if (!track || !output) return;

  const trackW = track.offsetWidth;
  if (trackW <= 0) return;

  // Ruler spans full A4 (21cm). Convert handle px to mm.
  const leftMm = (_rulerLeftPx / trackW) * 210;
  const rightMm = (_rulerRightPx / trackW) * 210;

  // Applied in mm, the same unit the page itself is built in. This used to
  // convert to px against a hard-coded 740px page width while also recording
  // the value in mm for the print window — so a 20mm indent was 20mm on paper
  // but 70.5px (≈18.7mm) on screen.
  const leftCss = leftMm.toFixed(2) + 'mm';
  const rightCss = rightMm.toFixed(2) + 'mm';
  const bleedCss = 'calc(100% + ' + (leftMm + rightMm).toFixed(2) + 'mm)';

  const sel = window.getSelection();
  let targetPage = null;
  if (sel && sel.anchorNode) {
    const node = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
    targetPage = node?.closest('.doc-page, .cover-page');
  }

  const pages = targetPage ? [targetPage] : output.querySelectorAll('.doc-page, .cover-page');
  pages.forEach(page => {
    // Store indent as data attributes (mm) for the print window to read
    page.dataset.indentLeft = leftMm.toFixed(1);
    page.dataset.indentRight = rightMm.toFixed(1);
    page.style.paddingLeft = leftCss;
    page.style.paddingRight = rightCss;

    // Adjust letterhead bleed to match new padding
    const hdr = page.querySelector('.letterhead-img');
    if (hdr) {
      hdr.style.marginLeft = '-' + leftCss;
      hdr.style.marginRight = '-' + rightCss;
      hdr.style.width = bleedCss;
    }
    const ftrImg = page.querySelector('.letterhead-footer-img');
    if (ftrImg) {
      ftrImg.style.marginLeft = '-' + leftCss;
      ftrImg.style.marginRight = '-' + rightCss;
      ftrImg.style.width = bleedCss;
    }
  });
}

// ── Toolbar Help ──
function showToolbarHelp() {
  const overlay = document.createElement('div');
  overlay.className = 'page-selector-overlay';
  overlay.innerHTML = `
    <div class="help-modal">
      <h3>Toolbar Guide</h3>
      <p class="help-subtitle">A quick overview of every tool available in the editing toolbar</p>

      <div class="help-section">
        <div class="help-section-title">Text Formatting</div>
        <div class="help-row">
          <div class="help-icon"><span class="help-icon-text" style="font-weight:900;">B</span></div>
          <div class="help-text"><strong>Bold</strong><span>Make selected text bold</span></div>
        </div>
        <div class="help-row">
          <div class="help-icon"><span class="help-icon-text" style="font-style:italic;">I</span></div>
          <div class="help-text"><strong>Italic</strong><span>Italicise selected text</span></div>
        </div>
        <div class="help-row">
          <div class="help-icon"><span class="help-icon-text" style="text-decoration:underline;">U</span></div>
          <div class="help-text"><strong>Underline</strong><span>Underline selected text</span></div>
        </div>
        <div class="help-row">
          <div class="help-icon"><span class="help-icon-text" style="text-decoration:line-through;">S</span></div>
          <div class="help-text"><strong>Strikethrough</strong><span>Strike through selected text</span></div>
        </div>
        <div class="help-row">
          <div class="help-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 3H5a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z"/><path d="M12 9v4"/><path d="M8 17h8l-4 4-4-4z"/></svg>
          </div>
          <div class="help-text"><strong>Format Painter</strong><span>Select formatted text, click the brush, then select the text to copy it onto — font, size, bold/italic/underline, colour, line height, alignment and paragraph spacing all come across. Shift-click the brush to keep it on for several selections; Esc cancels.</span></div>
        </div>
      </div>

      <div class="help-section">
        <div class="help-section-title">Alignment &amp; Size</div>
        <div class="help-row">
          <div class="help-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg></div>
          <div class="help-text"><strong>Align Left</strong><span>Align selected text to the left margin</span></div>
        </div>
        <div class="help-row">
          <div class="help-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg></div>
          <div class="help-text"><strong>Align Centre</strong><span>Centre-align selected text</span></div>
        </div>
        <div class="help-row">
          <div class="help-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></div>
          <div class="help-text"><strong>Justify</strong><span>Justify text so it aligns evenly on both left and right margins</span></div>
        </div>
        <div class="help-row">
          <div class="help-icon"><span class="help-icon-text">Aa</span></div>
          <div class="help-text"><strong>Font Size</strong><span>Change the font size of selected text. Choose a preset (8, 10, 12, 14, 18, or 24pt) or pick "Custom…" to type any exact point size.</span></div>
        </div>
        <div class="help-row">
          <div class="help-icon"><span class="help-icon-text">&para;</span></div>
          <div class="help-text"><strong>Paragraph Spacing</strong><span>Adjust the space between paragraphs in the selected text.</span></div>
        </div>
        <div class="help-row">
          <div class="help-icon"><span class="help-icon-text">&#x2195;</span></div>
          <div class="help-text"><strong>Line Height</strong><span>Set the line spacing of the selected paragraphs. Pick a preset from the &#x2195; list, or type any exact value — 1.2, 1.35, 1.45 — into the box next to it and press Enter.</span></div>
        </div>
        <div class="help-row">
          <div class="help-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="4" x2="21" y2="4"/><polygon points="7 8 7 12 10 10 7 8" fill="currentColor" stroke="none"/><polygon points="17 8 17 12 14 10 17 8" fill="currentColor" stroke="none"/><line x1="3" y1="20" x2="21" y2="20"/></svg></div>
          <div class="help-text"><strong>Indent Ruler</strong><span>Drag the left or right triangle markers on the ruler above the preview to adjust text indentation on the active page.</span></div>
        </div>
      </div>

      <div class="help-section">
        <div class="help-section-title">Document Elements</div>
        <div class="help-row">
          <div class="help-icon"><span class="help-icon-text">Hdr</span></div>
          <div class="help-text"><strong>Insert Letterhead</strong><span>Add a letterhead image to the top of selected pages. Choose a preset (CA or Audit) or upload your own image.</span></div>
        </div>
        <div class="help-row">
          <div class="help-icon"><span class="help-icon-text">Ftr</span></div>
          <div class="help-text"><strong>Insert Footer</strong><span>Add a footer image to the bottom of selected pages. Choose a preset (CA or Audit) or upload your own image.</span></div>
        </div>
        <div class="help-row">
          <div class="help-icon"><span class="help-icon-text" style="font-weight:900;">#</span></div>
          <div class="help-text"><strong>Page Numbers</strong><span>Toggle page numbers on or off at the bottom of each page</span></div>
        </div>
        <div class="help-row">
          <div class="help-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 18.5l3.5-3.5c.83-.83 2.17-.83 3 0s.83 2.17 0 3L6 21.5H3v-3z"/><line x1="2" y1="22" x2="22" y2="22"/></svg></div>
          <div class="help-text"><strong>Signature Line</strong><span>Insert a signature block with an optional name label on selected pages. Grab the line to drag it anywhere on the page &mdash; drag it onto another page and it moves there. If the two pages aren't on screen together, click the signature to select it, press <em>Ctrl+X</em> to cut it, then click the page you want it on and press <em>Ctrl+V</em>. Backspace or Delete removes a selected signature.</span></div>
        </div>
        <div class="help-row">
          <div class="help-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="4 2"/><path d="M12 8v8M8 12h8"/></svg></div>
          <div class="help-text"><strong>Float Selection</strong><span>Select any text or content, then click to make it a freely draggable block. Drag it anywhere on the page — even over other text.</span></div>
        </div>
      </div>

      <div class="help-section">
        <div class="help-section-title">Pages</div>
        <div class="help-row">
          <div class="help-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 12 15 15"/></svg></div>
          <div class="help-text"><strong>Import Word Document</strong><span>Upload a .docx file to append its content as new pages.</span></div>
        </div>
        <div class="help-row">
          <div class="help-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><path d="M17 8h2a1 1 0 0 1 1 1v2"/><polyline points="20 8 17 8 17 5"/><path d="M7 16H5a1 1 0 0 0-1 1v2"/><polyline points="4 16 7 16 7 19"/></svg></div>
          <div class="help-text"><strong>Reorder Pages</strong><span>Drag and drop page thumbnails to rearrange them.</span></div>
        </div>
        <div class="help-row">
          <div class="help-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg></div>
          <div class="help-text"><strong>Add Page</strong><span>Add a new blank page inheriting the last page's letterhead and footer.</span></div>
        </div>
        <div class="help-row">
          <div class="help-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="13" rx="1"/><line x1="12" y1="16" x2="12" y2="22"/><polyline points="9 19 12 22 15 19"/></svg></div>
          <div class="help-text"><strong>Unlock Jump Pages</strong><span>When on, typing past the bottom of a page (e.g. pressing Enter repeatedly) flows the overflowing text onto a new page and follows the cursor there, instead of running off the bottom. While editing you can also click the <em>"Insert page here"</em> button shown below any page to drop a new blank page at that spot.</span></div>
        </div>
        <div class="help-row">
          <div class="help-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="14" x2="15" y2="14"/></svg></div>
          <div class="help-text"><strong>Remove Page</strong><span>Select pages to remove; remaining pages are renumbered.</span></div>
        </div>
      </div>

      <div class="help-section">
        <div class="help-section-title">History</div>
        <div class="help-row">
          <div class="help-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg></div>
          <div class="help-text"><strong>Undo</strong><span>Reverse the last change you made to the document</span></div>
        </div>
        <div class="help-row">
          <div class="help-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10"/></svg></div>
          <div class="help-text"><strong>Redo</strong><span>Re-apply a change that was undone</span></div>
        </div>
      </div>

      <div class="help-close-wrap">
        <button class="ps-btn ps-btn-apply" id="help-close-btn">Got it</button>
      </div>
    </div>`;

  overlay.querySelector('#help-close-btn').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

// ── Free-Drag System ──
// Shared engine for dragging sig-lines AND user-floated blocks.
// Positions stored as percentages of the page so they scale for print.

function _initSigDrag() {
  const output = document.getElementById('document-output');
  if (!output) return;
  // Clear stray selection highlights (e.g. restored by an undo/redo snapshot)
  output.querySelectorAll('.sig-selected').forEach(el => {
    if (el !== _sigSelectedEl) el.classList.remove('sig-selected');
  });
  const bind = el => {
    if (el._dragBound) return;
    el._dragBound = true;
    el.addEventListener('mousedown', _freeDragStart);
    el.addEventListener('touchstart', _freeDragStart, { passive: false });
  };
  // Whole signature entries drag as one unit so line + name never separate
  output.querySelectorAll('.sig-entry, .float-block').forEach(bind);
  // The sign-off group (every signature on the page + the date beneath them)
  // drags as one unit too. A mousedown on an inner .sig-entry is handled by
  // that entry and stops propagating, so a single signature still moves alone;
  // grabbing anywhere else in the group takes the date along, which is what
  // keeps the date from being stranded when the sign-off is nudged.
  output.querySelectorAll('.sig-group').forEach(bind);
  // Standalone sig-lines (older content not wrapped in a .sig-entry)
  output.querySelectorAll('.sig-line').forEach(el => {
    if (!el.closest('.sig-entry')) bind(el);
  });
  _enableSigNameEditing(output);
  document.addEventListener('mousedown', _sigSelOutsideClick);
  document.addEventListener('keydown', _sigSelKeydown, true);
  document.addEventListener('keydown', _sigClipKeydown, true);
}

// The signer's name under a signature line is text an auditor legitimately
// needs to correct — a middle initial, a signatory who changed after the last
// import. It was untypeable because .sig-entry is contenteditable="false" (so
// space + line + name drag as one atomic unit), and that flag disables the
// caret for everything inside it. Marking the name itself editable restores
// the caret without loosening the rest of the block: the blank signing space
// and the line stay atomic and still start a drag.
//
// Done here, at edit-mode start, rather than in DocumentGenerator, so it also
// reaches signatures on saved pages, Word/PDF imports and blocks inserted by
// the toolbar — every current and past source of .sig-name markup. The flag is
// stripped again on teardown, because contenteditable="true" is honoured no
// matter what its ancestors say: left behind, a name would stay typeable in
// the plain preview, outside edit mode, with nothing marking the page as edited
// and so nothing keeping the edit.
function _enableSigNameEditing(root) {
  root.querySelectorAll('.sig-name').forEach(n => {
    n.setAttribute('contenteditable', 'true');
    n.setAttribute('data-sig-editable', '1');
  });
}

function _disableSigNameEditing(root) {
  root.querySelectorAll('.sig-name[data-sig-editable]').forEach(n => {
    n.removeAttribute('contenteditable');
    n.removeAttribute('data-sig-editable');
  });
}

function _teardownSigDrag() {
  const output = document.getElementById('document-output');
  if (!output) return;
  output.querySelectorAll('.sig-group, .sig-entry, .sig-line, .float-block').forEach(el => {
    el.removeEventListener('mousedown', _freeDragStart);
    el.removeEventListener('touchstart', _freeDragStart);
    el._dragBound = false;
  });
  _disableSigNameEditing(output);
  _deselectSig();
  document.removeEventListener('mousedown', _sigSelOutsideClick);
  document.removeEventListener('keydown', _sigSelKeydown, true);
  document.removeEventListener('keydown', _sigClipKeydown, true);
  _sigClipboard = null;
  _lastClickedPage = null;
}

// ── Signature selection + Backspace/Delete removal ──
// Clicking a signature block in edit mode selects it (red outline);
// Backspace or Delete then removes it. Click anywhere else to deselect.
let _sigSelectedEl = null;

function _selectSig(el) {
  if (_sigSelectedEl === el) return;
  _deselectSig();
  _sigSelectedEl = el;
  el.classList.add('sig-selected');
}

function _deselectSig() {
  _sigSelectedEl?.classList.remove('sig-selected');
  _sigSelectedEl = null;
}

function _sigSelOutsideClick(e) {
  // Also the one place that sees every press on the preview, so it is where the
  // paste target is remembered: pasting a cut signature needs to know which
  // sheet the user is looking at, and a press on a page is the clearest
  // statement of that. Presses on a signature never reach here (_freeDragStart
  // stops propagation), which is right — cutting one should not retarget the
  // paste at the page it came from.
  const page = e.target?.closest?.('.doc-page, .cover-page');
  if (page) _lastClickedPage = page;
  // Any mousedown that does reach here means "clicked elsewhere".
  if (_sigSelectedEl && !_sigSelectedEl.contains(e.target)) _deselectSig();
}

function _sigSelKeydown(e) {
  if (!_sigSelectedEl) return;
  if (e.key !== 'Backspace' && e.key !== 'Delete') return;
  if (e.target.closest?.('input, textarea, select')) return;
  // Backspace while the caret is in a signer's name means "delete a letter",
  // not "delete the signature". The check is on the caret rather than
  // e.target because in edit mode the whole page is contenteditable, so the
  // event target is the page for every keystroke anywhere on it.
  if (_caretInSigName()) return;
  e.preventDefault();
  e.stopPropagation();
  const el = _sigSelectedEl;
  _deselectSig();
  if (!el.isConnected) return;
  if (typeof _saveSnapshot === 'function') _saveSnapshot();
  _markPageEditedOf(el);
  if (el._floatPh?.isConnected) el._floatPh.remove();
  el.remove();
}

// ── Signature cut / paste across pages ──
// A signature belongs to whatever sheet the closing paragraph ended up on, and
// that is not always the sheet the generator put it on: a long
// "(on behalf of …)" caption can push a block onto its own row and spill the
// last signature over the page break. Dragging solves it when both sheets are
// on screen at once; when they are not, the signature is cut from one page and
// pasted onto another.
//
// The clipboard is this module's own — the OS clipboard is left alone, so a cut
// signature never overwrites text the user had copied. It holds the block's
// markup plus where it sat on its old page, so the paste lands in the same spot
// on the new one rather than at a corner the user then has to drag it out of.
let _sigClipboard = null;
let _lastClickedPage = null;

function _sigClipKeydown(e) {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
  const key = (e.key || '').toLowerCase();
  if (key === 'x') {
    if (!_sigSelectedEl || !_sigSelectedEl.isConnected) return;
    // A real text selection means the user is cutting text, not the block.
    const sel = window.getSelection();
    if (_caretInSigName() && sel && !sel.isCollapsed) return;
    e.preventDefault();
    e.stopPropagation();
    _cutSelectedSig();
  } else if (key === 'v') {
    // Only claimed while a signature is actually on this clipboard, so an
    // ordinary Ctrl+V is untouched the rest of the time.
    if (!_sigClipboard) return;
    e.preventDefault();
    e.stopPropagation();
    _pasteSig();
  }
}

// The page holding the caret — the user's most recent statement of "here".
function _caretPage() {
  const sel = window.getSelection();
  const n = sel && sel.anchorNode;
  const el = n ? (n.nodeType === 1 ? n : n.parentElement) : null;
  return el?.closest?.('.doc-page, .cover-page') || null;
}

function _cutSelectedSig() {
  const el = _sigSelectedEl;
  const page = el.closest('.doc-page, .cover-page');
  if (!page) return;
  if (typeof _saveSnapshot === 'function') _saveSnapshot();
  _markPageEdited(page);

  // Position as a percentage of the page, exactly as the free-drag engine
  // stores it, so an in-flow signature and a dragged one paste back the same
  // way. Percentages also survive the preview's scale transform.
  const pageRect = page.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const clone = el.cloneNode(true);
  clone.classList.remove('sig-selected', 'free-dragging');
  _sigClipboard = {
    html: clone.outerHTML,
    leftPct: pageRect.width ? (elRect.left - pageRect.left) / pageRect.width * 100 : 0,
    topPct: pageRect.height ? (elRect.top - pageRect.top) / pageRect.height * 100 : 0,
    // offsetWidth, not the rect: the rect is in scaled screen px, and this is
    // written back as a CSS length. See _beginFreeDrag.
    width: el.offsetWidth
  };

  _deselectSig();
  if (el._floatPh?.isConnected) el._floatPh.remove();
  el.remove();
  if (typeof BusinessInfoManager !== 'undefined') {
    BusinessInfoManager.showToast(
      'Signature cut. Click the page you want it on, then press Ctrl+V.', 'info', 6000
    );
  }
}

function _pasteSig() {
  const page = _caretPage() || _lastClickedPage;
  if (!page || !page.isConnected || !page.hasAttribute('contenteditable')) {
    if (typeof BusinessInfoManager !== 'undefined') {
      BusinessInfoManager.showToast('Click the page you want the signature on first, then press Ctrl+V.', 'warning', 5000);
    }
    return;
  }
  const wrap = document.createElement('div');
  wrap.innerHTML = _sigClipboard.html;
  const el = wrap.firstElementChild;
  if (!el) { _sigClipboard = null; return; }

  if (typeof _saveSnapshot === 'function') _saveSnapshot();
  _markPageEdited(page);

  // Pasted free-floating: the target page's flow was laid out without this
  // block, and dropping it back into the flow would reshuffle a page the user
  // did not ask to change. Floating puts it exactly where it was on its old
  // sheet, and it drags from there.
  el.classList.add('free-floating');
  el.style.left = _sigClipboard.leftPct + '%';
  el.style.top = _sigClipboard.topPct + '%';
  if (_sigClipboard.width) el.style.width = _sigClipboard.width + 'px';
  el._floatPh = null;
  el._dragBound = false;
  page.appendChild(el);
  _sigClipboard = null;

  // Rebind drag + name editing so the pasted block behaves like every other
  // signature. Re-adding the document listeners is a no-op — same function,
  // same capture flag.
  _initSigDrag();
  _selectSig(el);
  if (typeof BusinessInfoManager !== 'undefined') {
    BusinessInfoManager.showToast('Signature pasted — drag it into place.', 'success', 4000);
  }
}

let _dragState = null;

// Is the caret inside an editable signer's name?
function _caretInSigName() {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || !sel.anchorNode) return false;
  const node = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
  return !!node?.closest?.('.sig-name[data-sig-editable]');
}

function _freeDragStart(e) {
  const el = e.currentTarget;
  const page = el.closest('.doc-page, .cover-page');
  if (!page || !page.hasAttribute('contenteditable')) return;

  // Grabbing a sig-line's native resize handle (right edge) → let the browser resize
  const line = el.classList.contains('sig-line')
    ? el
    : (e.target.closest ? e.target.closest('.sig-line') : null);
  if (line) {
    const rect = line.getBoundingClientRect();
    const cx = (e.touches ? e.touches[0].clientX : e.clientX);
    if (cx > rect.right - 14) return;
  }

  // Pressing on the signer's name is ambiguous: it could be "put the caret
  // here" or "drag this signature by its name". preventDefault() is what kills
  // the caret, so on the name we withhold it and wait — move the pointer past
  // a few pixels and it becomes a drag, release without moving and the click
  // lands as a normal click and the caret appears. Everywhere else in the
  // block (the blank signing space, the line) drags immediately, as before.
  const nameTarget = e.target.closest?.('.sig-name[data-sig-editable]');
  if (nameTarget && el.contains(nameTarget)) {
    // Still stop propagation: without it the enclosing .sig-group arms its own
    // deferred drag on the same press and both would start moving at once.
    e.stopPropagation();
    _deselectSig();
    _armDeferredDrag(el, e);
    return;
  }

  e.preventDefault();
  e.stopPropagation();
  _beginFreeDrag(el, page, e);
}

// Wait for real pointer movement before turning a press on a signer's name
// into a drag. Anything short of the threshold is left alone so the browser
// places the caret itself.
let _pendingDrag = null;

function _armDeferredDrag(el, e) {
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  _pendingDrag = { el, startX: clientX, startY: clientY };
  document.addEventListener('mousemove', _deferredDragMove);
  document.addEventListener('mouseup', _cancelDeferredDrag);
  document.addEventListener('touchmove', _deferredDragMove, { passive: false });
  document.addEventListener('touchend', _cancelDeferredDrag);
}

function _deferredDragMove(e) {
  if (!_pendingDrag) return;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  if (Math.abs(clientX - _pendingDrag.startX) < 4 &&
      Math.abs(clientY - _pendingDrag.startY) < 4) return;
  const el = _pendingDrag.el;
  const page = el.closest('.doc-page, .cover-page');
  _cancelDeferredDrag();
  if (!page) return;
  e.preventDefault();
  // Drop the caret and the text selection the un-prevented press created,
  // otherwise the browser keeps extending it while the block moves.
  window.getSelection()?.removeAllRanges();
  _beginFreeDrag(el, page, e);
}

function _cancelDeferredDrag() {
  _pendingDrag = null;
  document.removeEventListener('mousemove', _deferredDragMove);
  document.removeEventListener('mouseup', _cancelDeferredDrag);
  document.removeEventListener('touchmove', _deferredDragMove);
  document.removeEventListener('touchend', _cancelDeferredDrag);
}

function _beginFreeDrag(el, page, e) {
  _markPageEdited(page);

  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  const pageRect = page.getBoundingClientRect();
  const pageW = pageRect.width;
  const pageH = pageRect.height;

  if (!el.classList.contains('free-floating')) {
    if (typeof _saveSnapshot === 'function') _saveSnapshot();
    const elRect = el.getBoundingClientRect();
    // Sizes written back as CSS lengths must come from offsetWidth/offsetHeight,
    // not the rect: the preview scales the page down with a transform, so the
    // rect is in screen px while a CSS px here is in the page's own unscaled
    // coordinates. Using the rect would shrink the block by the preview scale.
    const elW = el.offsetWidth;
    const elH = el.offsetHeight;

    // Insert invisible placeholder to hold flow space
    const ph = document.createElement('div');
    ph.className = 'float-placeholder';
    ph.style.width = elW + 'px';
    ph.style.height = elH + 'px';
    ph.style.display = 'inline-block';
    el.parentNode.insertBefore(ph, el);
    el._floatPh = ph; // so deleting the block can also clear its flow space

    // Convert current position to page-relative percentages
    const leftPct = ((elRect.left - pageRect.left) / pageW * 100);
    const topPct = ((elRect.top - pageRect.top) / pageH * 100);
    el.style.left = leftPct + '%';
    el.style.top = topPct + '%';
    el.style.width = elW + 'px';
    page.appendChild(el);
    el.classList.add('free-floating');
  }

  // Clicking a signature selects it so Backspace/Delete can remove it
  // (float-blocks hold user content, so they stay drag-only)
  if (el.classList.contains('sig-entry') || el.classList.contains('sig-line')) _selectSig(el);

  el.classList.add('free-dragging');

  const elRect2 = el.getBoundingClientRect();
  _dragState = {
    el, page,
    elW: elRect2.width, elH: elRect2.height,
    // Where inside the block the user grabbed it, in screen px. Tracking the
    // grab point rather than a start-position delta is what lets the block
    // change page mid-drag: the position is recomputed from the pointer and
    // whichever page is under it, so nothing depends on where the drag began.
    grabDX: clientX - elRect2.left,
    grabDY: clientY - elRect2.top,
    snapX: [], snapY: []
  };
  _collectSnapTargets(_dragState);

  document.addEventListener('mousemove', _freeDragMove);
  document.addEventListener('mouseup', _freeDragEnd);
  document.addEventListener('touchmove', _freeDragMove, { passive: false });
  document.addEventListener('touchend', _freeDragEnd);
}

// Snap targets: edges of the other signature elements on the block's current
// page (and the element's own placeholder = its original spot), in
// page-relative pixels. Recomputed whenever the block changes page.
function _collectSnapTargets(s) {
  const pageRect = s.page.getBoundingClientRect();
  s.snapX = [];
  s.snapY = [];
  s.page.querySelectorAll('.sig-group, .sig-entry, .sig-line, .float-block, .float-placeholder').forEach(other => {
    if (other === s.el || s.el.contains(other) || other.contains(s.el)) return;
    if (other.classList.contains('sig-line') && other.closest('.sig-entry')) return;
    const r = other.getBoundingClientRect();
    s.snapX.push(r.left - pageRect.left);
    s.snapY.push(r.top - pageRect.top);
  });
}

// The page under the pointer, ignoring the block being dragged (which sits
// under the cursor the whole time).
function _pageUnderPointer(x, y, dragged) {
  const stack = document.elementsFromPoint(x, y) || [];
  for (const node of stack) {
    if (dragged.contains(node)) continue;
    const page = node.closest?.('.doc-page, .cover-page');
    if (page) return page;
  }
  return null;
}

// Move a mid-drag block onto another sheet. The placeholder holding its old
// flow space goes with it — the block has left that page, so the space it used
// to occupy must close up rather than stay reserved for something that is no
// longer there.
function _moveDragToPage(s, page) {
  _markPageEdited(page);
  if (s.el._floatPh?.isConnected) s.el._floatPh.remove();
  s.el._floatPh = null;
  page.appendChild(s.el);
  s.page = page;
  _collectSnapTargets(s);
}

function _freeDragMove(e) {
  if (!_dragState) return;
  e.preventDefault();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  const s = _dragState;

  // Dragged onto a different sheet → it belongs to that sheet now. A signature
  // orphaned by a page break is fixed by moving it, not by nudging it within a
  // page it should not be on.
  const over = _pageUnderPointer(clientX, clientY, s.el);
  if (over && over !== s.page && over.hasAttribute('contenteditable')) _moveDragToPage(s, over);

  // Live rect: the page can be a different one, and the flow above it can have
  // closed up, since the drag started.
  const pageRect = s.page.getBoundingClientRect();
  const pageW = pageRect.width;
  const pageH = pageRect.height;
  let left = clientX - s.grabDX - pageRect.left;
  let top = clientY - s.grabDY - pageRect.top;

  // Snap to other signature elements so blocks line up exactly
  const SNAP = 8;
  for (const t of s.snapX) { if (Math.abs(left - t) <= SNAP) { left = t; break; } }
  for (const t of s.snapY) { if (Math.abs(top - t) <= SNAP) { top = t; break; } }

  // Keep the block fully on the page
  left = Math.max(0, Math.min(left, pageW - s.elW));
  top = Math.max(0, Math.min(top, pageH - s.elH));

  s.el.style.left = (left / pageW * 100) + '%';
  s.el.style.top = (top / pageH * 100) + '%';
}

function _freeDragEnd() {
  if (!_dragState) return;
  _dragState.el.classList.remove('free-dragging');
  _dragState = null;
  document.removeEventListener('mousemove', _freeDragMove);
  document.removeEventListener('mouseup', _freeDragEnd);
  document.removeEventListener('touchmove', _freeDragMove);
  document.removeEventListener('touchend', _freeDragEnd);
}

// ── Float Selection ──
// Wraps the current selection in a draggable .float-block.
function floatSelection() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) {
    alert('Select some text or content first, then click Float.');
    return;
  }
  const range = sel.getRangeAt(0);
  const page = range.commonAncestorContainer.nodeType === 1
    ? range.commonAncestorContainer.closest('.doc-page, .cover-page')
    : range.commonAncestorContainer.parentElement?.closest('.doc-page, .cover-page');
  if (!page) { alert('Selection must be inside a document page.'); return; }

  if (typeof _saveSnapshot === 'function') _saveSnapshot();
  _markPageEdited(page);

  const contents = range.extractContents();
  const block = document.createElement('div');
  block.className = 'float-block';
  block.contentEditable = 'false';
  block.appendChild(contents);

  range.insertNode(block);
  sel.removeAllRanges();

  _initSigDrag();
}
