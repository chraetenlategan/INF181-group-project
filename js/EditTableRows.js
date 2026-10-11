// ═══════════════════════════════════════════════════════════════
// EditTableRows.js — rows of the General Information and Index tables
// as whole units in edit mode.
//
// Both tables stretch to fill their page (`flex: 1` in styles.css), so the
// browser spreads the page's height evenly over however many rows there are.
// Deleting a row's text used to leave the row behind — two empty cells taking
// a full share of that height, a gap nobody could select away. Now:
//
//   • a row whose text has all been deleted is removed with it, and the rest
//     re-spread over the page on their own;
//   • hovering a row shows a small "+ / ×" control beside it: add a blank row
//     below, or remove this one.
//
// The control lives on <body>, outside #document-output, so it never reaches a
// save, a draft or an export. Rows added here carry `data-row-new` until they
// hold text, so the empty-row sweep leaves a row the user is about to fill in.
// Depends on EditToolbar.js (_markPageEdited, _saveSnapshot).
// ═══════════════════════════════════════════════════════════════

const EditTableRows = (() => {
  const TABLES = '.cover-info-table, .index-table';
  const PAGE = '.doc-page, .cover-page';

  let _output = null;
  let _ctrl = null;
  let _row = null;        // row the control is showing for
  let _hideTimer = null;

  // The outer row of a General Information / Index table holding `node`. The
  // director list nests its own table (`.cover-id-align`) inside a cell; a row
  // of that is part of the outer row, not a row of its own.
  function rowOf(node) {
    const el = node?.nodeType === 1 ? node : node?.parentElement;
    let tr = el?.closest?.('tr');
    while (tr) {
      const table = tr.closest('table');
      if (!table) return null;
      if (table.matches(TABLES)) return _output?.contains(tr) ? tr : null;
      tr = table.parentElement?.closest('tr');
    }
    return null;
  }

  function isEmpty(row) {
    return !row.textContent.replace(/[\s ​]/g, '') && !row.querySelector('img');
  }

  function caretIn(cell, atEnd) {
    const sel = window.getSelection();
    if (!sel || !cell) return;
    const r = document.createRange();
    r.selectNodeContents(cell);
    r.collapse(!atEnd);
    sel.removeAllRanges();
    sel.addRange(r);
  }

  // ── Empty-row sweep ─────────────────────────────────────────
  // Called from EditToolbar._onRhsInput on every edit-mode input. Only a
  // deletion can empty a row, so only a deletion sweeps; a selection that ran
  // across several rows empties them all, hence the whole page is checked.
  function onInput(e) {
    const el = e.target?.nodeType === 1 ? e.target : e.target?.parentElement;
    const page = el?.closest?.(PAGE);
    if (!page) return;
    page.querySelectorAll('tr[data-row-new]').forEach(r => {
      if (!isEmpty(r)) r.removeAttribute('data-row-new');
    });
    if (!String(e.inputType || '').startsWith('delete')) return;

    const caretRow = rowOf(window.getSelection()?.anchorNode);
    const doomed = [];
    page.querySelectorAll(TABLES).forEach(t => {
      Array.from(t.rows).forEach(r => {
        if (!r.hasAttribute('data-row-new') && isEmpty(r)) doomed.push(r);
      });
    });
    if (!doomed.length) return;

    if (typeof _saveSnapshot === 'function') _saveSnapshot();
    // Keep the caret in the table: the row after the one it was in, else the
    // one before.
    let land = null;
    if (caretRow && doomed.includes(caretRow)) {
      let n = caretRow.nextElementSibling;
      while (n && doomed.includes(n)) n = n.nextElementSibling;
      let p = caretRow.previousElementSibling;
      while (p && doomed.includes(p)) p = p.previousElementSibling;
      land = n ? { cell: n.cells[0], end: false } : p ? { cell: p.cells[p.cells.length - 1], end: true } : null;
    }
    doomed.forEach(r => r.remove());
    if (land) caretIn(land.cell, land.end);
    if (doomed.includes(_row)) hide();
    if (typeof _markPageEdited === 'function') _markPageEdited(page);
  }

  // ── Hover control ───────────────────────────────────────────
  function build() {
    if (_ctrl) return _ctrl;
    _ctrl = document.createElement('div');
    _ctrl.className = 'tbl-row-ctrl';
    _ctrl.innerHTML =
      '<button type="button" data-act="add" title="Add a row below">+</button>' +
      '<button type="button" data-act="del" title="Remove this row">×</button>';
    // mousedown, not click, and no default: the caret stays where it was.
    _ctrl.addEventListener('mousedown', e => {
      e.preventDefault();
      const act = e.target?.closest?.('button')?.dataset.act;
      if (act === 'add') addBelow(_row);
      else if (act === 'del') removeRow(_row);
    });
    _ctrl.addEventListener('mouseenter', () => clearTimeout(_hideTimer));
    _ctrl.addEventListener('mouseleave', scheduleHide);
    document.body.appendChild(_ctrl);
    return _ctrl;
  }

  function place(row) {
    if (!row || !row.isConnected) return hide();
    clearTimeout(_hideTimer);
    _row = row;
    const c = build();
    const r = row.getBoundingClientRect();
    c.style.display = 'flex';
    c.style.left = `${Math.round(r.right + 6)}px`;
    c.style.top = `${Math.round(r.top + r.height / 2 - c.offsetHeight / 2)}px`;
    _output?.querySelectorAll('tr.tbl-row-hover').forEach(t => t.classList.remove('tbl-row-hover'));
    row.classList.add('tbl-row-hover');
  }

  function hide() {
    clearTimeout(_hideTimer);
    if (_ctrl) _ctrl.style.display = 'none';
    _row?.classList.remove('tbl-row-hover');
    _row = null;
  }

  function scheduleHide() {
    clearTimeout(_hideTimer);
    _hideTimer = setTimeout(hide, 250);
  }

  function onMouseMove(e) {
    const row = rowOf(e.target);
    if (row) { if (row !== _row || _ctrl?.style.display === 'none') place(row); else clearTimeout(_hideTimer); }
    else if (_row) scheduleHide();
  }

  function addBelow(row) {
    if (!row || !row.isConnected) return;
    if (typeof _saveSnapshot === 'function') _saveSnapshot();
    const tr = document.createElement('tr');
    tr.setAttribute('data-row-new', '');
    Array.from(row.cells).forEach(cell => {
      const td = document.createElement(cell.tagName);
      if (cell.className) td.className = cell.className;
      td.innerHTML = '<br>';
      tr.appendChild(td);
    });
    row.after(tr);
    caretIn(tr.cells[0], false);
    if (typeof _markPageEdited === 'function') _markPageEdited(row.closest(PAGE));
    place(tr);
  }

  function removeRow(row) {
    if (!row || !row.isConnected) return;
    if (typeof _saveSnapshot === 'function') _saveSnapshot();
    const page = row.closest(PAGE);
    row.remove();
    hide();
    if (typeof _markPageEdited === 'function') _markPageEdited(page);
  }

  // ── Lifecycle (EditToolbar.toggleEditPreview) ──────────────
  function attach(output) {
    detach();
    _output = output;
    output.addEventListener('mousemove', onMouseMove);
    output.addEventListener('mouseleave', scheduleHide);
    document.addEventListener('scroll', hide, true);
  }

  function detach() {
    if (_output) {
      _output.removeEventListener('mousemove', onMouseMove);
      _output.removeEventListener('mouseleave', scheduleHide);
    }
    document.removeEventListener('scroll', hide, true);
    hide();
    _output = null;
  }

  return { attach, detach, onInput };
})();
