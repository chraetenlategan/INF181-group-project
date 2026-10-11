// FileExplorer.js — the list of saved financial statements in the database.
//
// Deliberately flat: every business is listed by name, and selecting one shows its
// financial years. The only things to do with a statement are Open it or copy it into a
// New Year — no folders, moving, renaming or file imports, which only confused the
// Business → financial-statement-year pattern the accountants actually work in.
// Statements saved without a company name are hidden.
//
// Talks to the LAN database through DataStore. Like "Save to Database", it needs the database
// to be reachable, so when offline it shows a short explanation instead of an empty list.
//
// Depends on: DataStore.js, BusinessInfoManager.js (to open a statement),
// EditToolbarPages.js (_styledPrompt).

class FileExplorer {
  static ENTITY_ICONS = {
    company:    `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="14" height="14" rx="2"/><path d="M7 8h2m-2 3h2m-2 3h2m4-6h0m0 3h0m0 3h0"/><path d="M3 8h14"/></svg>`,
    cc:         `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="10" r="5"/><circle cx="12" cy="10" r="5"/></svg>`,
    trust:      `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2l7 5v4c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V7l7-5z"/></svg>`,
    npo:        `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 4C8 4 4 7 4 11s3 6 6 6 6-2 6-6-2-7-6-7z"/><path d="M10 4v13m-4-5h8"/></svg>`,
    npc:        `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 17.5h15"/><path d="M4.5 17.5V8l5.5-4 5.5 4v9.5"/><path d="M10 14.5s-2.2-1.6-2.2-3a1.3 1.3 0 012.2-.9 1.3 1.3 0 012.2.9c0 1.4-2.2 3-2.2 3z"/></svg>`,
    hoa:        `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 17.5h17"/><path d="M3.5 17.5v-7l4-3 4 3v7"/><path d="M11.5 17.5v-5l3-2.5 3 2.5v5"/><path d="M6 17.5v-3h3v3"/></svg>`,
    school:     `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3L2 8l8 5 8-5-8-5z"/><path d="M4 9.5v4.5l6 3.5 6-3.5V9.5"/></svg>`,
    bc:         `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="16" height="12" rx="1.5"/><path d="M2 10h16M6 6V4a2 2 0 012-2h4a2 2 0 012 2v2M6 14h2m4 0h2"/></svg>`,
    church:     `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v4m-2-2h4"/><path d="M6 8h8l1 10H5L6 8z"/><path d="M8.5 18v-4a1.5 1.5 0 013 0v4"/></svg>`,
    club:       `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="7" r="4"/><path d="M3 18c0-3.5 3-6 7-6s7 2.5 7 6"/></svg>`,
    individual: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="6" r="3.5"/><path d="M4 18c0-3 2.5-5.5 6-5.5s6 2.5 6 5.5"/></svg>`,
    attorneys:  `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2L3 6h14L10 2z"/><rect x="4" y="6" width="12" height="1.5"/><path d="M6 7.5V15m4-7.5V15m4-7.5V15"/><rect x="3" y="15" width="14" height="2" rx=".5"/></svg>`,
  };


  constructor(businessInfoManager) {
    this.biz = businessInfoManager;
    this.overlay = null;
    this.entries = [];           // all business rows (metadata only)
    this._allBizSearch = '';     // business search query
    this._allBizSelected = null; // selected company_name
  }

  // ── Open the explorer ──
  async open() {
    if (this.overlay) this.overlay.remove();
    this._allBizSearch = '';
    this._build();
    try {
      await this._refresh();
    } catch (err) {
      console.error('File Explorer failed to open:', err);
      this._renderUnavailable(err);
    }
  }

  close() {
    if (this.overlay) { this.overlay.remove(); this.overlay = null; }
  }

  // ── Build the shell ──
  _build() {
    const overlay = document.createElement('div');
    overlay.id = 'file-explorer-overlay';
    overlay.className = 'page-selector-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) this.close(); };

    const modal = document.createElement('div');
    modal.className = 'page-selector-modal fe-modal fe-fullscreen';

    modal.innerHTML = `
      <button type="button" class="fe-close-x" id="fe-close-x" title="Close File Explorer" aria-label="Close File Explorer">&times;</button>
      <h3>File Explorer</h3>
      <div class="fe-tab-content" id="fe-tab-statements">
        <div class="fe-toolbar">
          <button class="ps-btn ps-btn-secondary fe-refresh-btn" id="fe-refresh" title="Refresh" aria-label="Refresh"><svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16.5 10a6.5 6.5 0 1 1-1.9-4.6"/><path d="M16.5 3v3.5H13"/></svg></button>        </div>
        <div class="fe-body" id="fe-body-all">
          <div class="fe-folders" id="fe-all-folders">
            <div class="fe-search-wrap">
              <input type="text" class="fe-search" id="fe-all-search" placeholder="Search businesses…" autocomplete="off">
            </div>
            <div class="fe-folder-list" id="fe-all-folder-list"></div>
          </div>
          <div class="fe-drag-handle" id="fe-all-drag-handle" title="Drag to resize"></div>
          <div class="fe-files" id="fe-all-files"></div>
        </div>
      </div>
      <div class="ps-actions" style="margin-top:16px;">
        <button class="ps-btn ps-btn-secondary" id="fe-close">Close</button>
      </div>`;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    this.overlay = overlay;

    modal.querySelector('#fe-refresh').onclick = () => this._refresh();
    modal.querySelector('#fe-close').onclick = () => this.close();
    modal.querySelector('#fe-close-x').onclick = () => this.close();

    const allSearch = modal.querySelector('#fe-all-search');
    allSearch.oninput = () => { this._allBizSearch = allSearch.value; this._renderAllBizFolders(); };

    this._initDragHandle(modal, '#fe-all-drag-handle', '#fe-all-folders');
  }


  _initDragHandle(modal, handleSel, foldersSel) {
    const handle = modal.querySelector(handleSel || '#fe-drag-handle');
    const body = handle.closest('.fe-body');
    const folders = modal.querySelector(foldersSel || '#fe-folders');
    if (!handle || !body || !folders) return;
    let dragging = false, startX = 0, startW = 0;

    const onMove = (e) => {
      if (!dragging) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const delta = clientX - startX;
      const newW = Math.max(140, Math.min(startW + delta, body.clientWidth - 180));
      folders.style.width = newW + 'px';
      folders.style.minWidth = newW + 'px';
      folders.style.maxWidth = newW + 'px';
      body.style.gridTemplateColumns = newW + 'px auto 1fr';
    };
    const onUp = () => {
      dragging = false;
      handle.classList.remove('fe-dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
    };
    const onDown = (e) => {
      dragging = true;
      startX = e.touches ? e.touches[0].clientX : e.clientX;
      startW = folders.offsetWidth;
      handle.classList.add('fe-dragging');
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onUp);
      e.preventDefault();
    };
    handle.addEventListener('mousedown', onDown);
    handle.addEventListener('touchstart', onDown, { passive: false });
  }

  // ── Load statements from the database ──
  async _refresh() {
    const allListEl = this.overlay.querySelector('#fe-all-folder-list');
    const allFilesEl = this.overlay.querySelector('#fe-all-files');
    allListEl.innerHTML = '<div class="fe-empty">Loading…</div>';
    allFilesEl.innerHTML = '';

    try {
      this.entries = (await DataStore.list()) || [];
    } catch (err) {
      this._renderUnavailable(err);
      return;
    }
    this._renderAllBiz();
  }

  // Offline / database-down state.
  _renderUnavailable(err) {
    const filesEl = this.overlay.querySelector('#fe-all-files');
    const allListEl = this.overlay.querySelector('#fe-all-folder-list');
    if (allListEl) allListEl.innerHTML = '';
    const offline = err && err.isConnectionError;
    const detail = err && err.networkDetail ? '<br><br><small style="opacity:.7">Detail: ' + err.networkDetail + '</small>' : '';
    filesEl.innerHTML = `<div class="fe-empty fe-unavailable">${
      offline
        ? 'The File Explorer needs the shared database, which isn\'t reachable right now.<br><br>' +
          '<b>Possible causes:</b><br>' +
          '• The database service is not running on the office PC.<br>' +
          '• The server address is wrong (check Settings → Change connection…).<br>' +
          '• A firewall is blocking port ' + (function() { try { return new URL(DataStore.baseUrl()).port || '4000'; } catch(_) { return '4000'; } })() + '.<br>' +
          '• This PC is not on the same network as the office PC.<br><br>' +
          'While offline you can still save your work with "Save as JSON File".' + detail
        : 'Could not load the File Explorer.<br><br>' + (err ? err.message : '') + detail
    }</div>`;
  }

  _iconBtn(label, glyph, onClick, danger) {
    const b = document.createElement('button');
    b.className = 'fe-icon-btn' + (danger ? ' fe-icon-danger' : '');
    b.title = label;
    b.setAttribute('aria-label', label);
    b.textContent = glyph;
    b.onclick = onClick;
    return b;
  }

  // ── File operations ──
  async _open(f, btn, opts) {
    // Hand off to the existing loader, which fetches the full record and closes the overlay.
    await this._whileLoading(btn, overlay => this.biz._loadEntry({ id: f.id }, overlay, opts));
  }

  // One load at a time. On a slow network the explorer sits there with no sign
  // anything happened, so people click Open again — and every extra click used
  // to queue another full load, landing seconds later over whatever they had
  // moved on to. The loader removes the overlay it was handed; only forget our
  // reference if that is still the explorer on screen (it may have been closed
  // and reopened meanwhile — nulling the new one left its search box throwing).
  async _whileLoading(btn, load) {
    if (this._loading) {
      BusinessInfoManager.showToast('Still opening the previous statement — please wait.', 'info', 3000);
      return;
    }
    this._loading = true;
    const overlay = this.overlay;
    const label = btn ? btn.textContent : '';
    if (btn) { btn.textContent = 'Opening…'; btn.disabled = true; }
    try {
      await load(overlay);
    } finally {
      this._loading = false;
      if (btn) { btn.textContent = label; btn.disabled = false; }
      if (this.overlay === overlay && overlay && !overlay.isConnected) this.overlay = null;
    }
  }

  // Copy a statement into a brand-new year and open that copy.
  async _openInNewYear(f, btn) {
    if (this._loading) {
      BusinessInfoManager.showToast('Still opening the previous statement — please wait.', 'info', 3000);
      return;
    }
    const suggested = String((Number(f.year) || new Date().getFullYear()) + 1);
    const answer = await _styledPrompt(
      'Open in New Year',
      'Which financial year is this new statement for? Everything from the previous ' +
      'year is copied across, with the year ends rolled forward and this year\'s ' +
      'dates and results left blank — change what moved, confirm what did not.',
      suggested);
    if (answer == null) return;
    const year = String(answer).trim();
    if (!/^(?:19|20)\d{2}$/.test(year)) {
      alert('Enter a four-digit year, for example ' + suggested + '.');
      return;
    }
    await this._whileLoading(btn, overlay => this.biz.openInNewYear(f, overlay, year));
  }

  // Soft delete. The record goes to the server's recycle bin, which is not
  // shown in the UI — it can still be restored through /api/recycle-bin.
  async _delete(f) {
    const label = [f.company_name, f.year].filter(Boolean).join(' ') || f.file || 'this statement';
    if (!confirm(`Delete "${label}"?`)) return;
    try {
      await DataStore.remove(f.id);
    } catch (err) {
      alert(err.message);
      return;
    }
    // Deleting the statement that is open: the next Save creates a new record
    // instead of writing to the deleted one.
    if (this.biz && this.biz.currentBusinessId === f.id) {
      this.biz.currentBusinessId = null;
      if (typeof DraftCache !== 'undefined' && DraftCache.touch) DraftCache.touch();
    }
    await this._refresh();
  }

  // ── Recycle Bin ──
  async _openRecycleBin() {
    const overlay = document.createElement('div');
    overlay.className = 'page-selector-overlay fe-rb-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    const modal = document.createElement('div');
    modal.className = 'page-selector-modal fe-modal fe-rb-modal';
    modal.innerHTML = `
      <h3>🗑 Recycle Bin</h3>
      <div class="fe-rb-list" id="fe-rb-list"><div class="fe-empty">Loading…</div></div>
      <div class="ps-actions fe-rb-footer">
        <button class="ps-btn fe-rb-empty-btn" id="fe-rb-empty">Empty Recycle Bin</button>
        <button class="ps-btn ps-btn-secondary" id="fe-rb-close">Close</button>
      </div>`;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    modal.querySelector('#fe-rb-close').onclick = () => overlay.remove();
    modal.querySelector('#fe-rb-empty').onclick = () => this._emptyRecycleBin(overlay);

    await this._refreshRecycleBin(modal);
  }

  async _refreshRecycleBin(modal) {
    const listEl = modal.querySelector('#fe-rb-list');
    try {
      const items = await DataStore.listRecycleBin();
      listEl.innerHTML = '';
      if (!items.length) {
        listEl.innerHTML = '<div class="fe-empty">The recycle bin is empty.</div>';
        return;
      }
      items.forEach(f => listEl.appendChild(this._recycleBinRow(f, modal)));
    } catch (err) {
      listEl.innerHTML = `<div class="fe-empty fe-unavailable">Could not load recycle bin.<br>${err.message}</div>`;
    }
  }

  _recycleBinRow(f, modal) {
    const row = document.createElement('div');
    row.className = 'fe-file-item fe-rb-row';

    const main = document.createElement('div');
    main.className = 'fe-file-main';
    const name = document.createElement('div');
    name.className = 'fe-file-name';
    name.textContent = f.file || '(untitled)';
    const meta = document.createElement('div');
    meta.className = 'fe-file-meta';
    meta.textContent = [
      f.company_name || null,
      f.entity_type || null,
      f.year ? String(f.year) : null,
      f.deleted_at ? `deleted ${String(f.deleted_at).slice(0, 10)}` : null,
    ].filter(Boolean).join(' · ');
    meta.title = meta.textContent;
    main.appendChild(name);
    main.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'fe-file-actions';
    const restoreBtn = this._iconBtn('Restore', '↩', async () => {
      try {
        await DataStore.restore(f.id);
        await this._refresh();
        await this._refreshRecycleBin(modal);
      } catch (err) { alert(err.message); }
    });
    const deleteBtn = this._iconBtn('Delete permanently', '🗑', () => this._permanentDelete(f, modal), true);
    actions.appendChild(restoreBtn);
    actions.appendChild(deleteBtn);

    row.appendChild(main);
    row.appendChild(actions);
    return row;
  }

  async _permanentDelete(f, modal) {
    const password = await this._passwordPrompt(
      `Permanently delete "${f.file || 'this statement'}"?`,
      'This cannot be undone. Enter the password to confirm.'
    );
    if (password == null) return;
    try {
      await DataStore.permanentDelete(f.id, password);
      await this._refreshRecycleBin(modal);
    } catch (err) {
      alert(err.message === 'Incorrect password.' ? 'Incorrect password.' : err.message);
    }
  }

  async _emptyRecycleBin(overlay) {
    const modal = overlay.querySelector('.fe-rb-modal');
    const listEl = modal.querySelector('#fe-rb-list');
    const count = listEl.querySelectorAll('.fe-rb-row').length;
    if (!count) { alert('The recycle bin is already empty.'); return; }
    const password = await this._passwordPrompt(
      `Empty Recycle Bin (${count} item${count === 1 ? '' : 's'})`,
      'This permanently deletes everything in the bin and cannot be undone. Enter the password to confirm.'
    );
    if (password == null) return;
    try {
      await DataStore.emptyRecycleBin(password);
      await this._refreshRecycleBin(modal);
    } catch (err) {
      alert(err.message === 'Incorrect password.' ? 'Incorrect password.' : err.message);
    }
  }

  _passwordPrompt(title, hint) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'ps-input-overlay';
      overlay.innerHTML = `
        <div class="ps-input-modal">
          <h3>${title}</h3>
          <p class="ps-input-hint">${hint}</p>
          <input type="password" placeholder="Password" autofocus>
          <div class="ps-actions">
            <button class="ps-btn ps-btn-cancel">Cancel</button>
            <button class="ps-btn ps-btn-apply ps-btn-danger">Confirm</button>
          </div>
        </div>`;
      const input = overlay.querySelector('input');
      const apply = () => { const v = input.value; cleanup(); resolve(v); };
      const cancel = () => { cleanup(); resolve(null); };
      const cleanup = () => overlay.remove();
      overlay.querySelector('.ps-btn-apply').onclick = apply;
      overlay.querySelector('.ps-btn-cancel').onclick = cancel;
      input.addEventListener('keydown', e => { if (e.key === 'Enter') apply(); if (e.key === 'Escape') cancel(); });
      overlay.addEventListener('click', e => { if (e.target === overlay) cancel(); });
      document.body.appendChild(overlay);
      requestAnimationFrame(() => input.focus());
    });
  }

  // ── All-Business mode ──

  _renderAllBiz() {
    this._renderAllBizFolders();
    this._renderAllBizFiles();
  }

  _allBizGroups() {
    const groups = {};
    this.entries.forEach(e => {
      const key = (e.company_name || '').trim();
      if (!key) return; // statements with no company name are not shown
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    });
    return Object.keys(groups)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      .map(name => ({
        name,
        entries: groups[name].sort((a, b) => (b.year || 0) - (a.year || 0)),
        entityType: groups[name][0]?.entity_type || null,
      }));
  }

  _renderAllBizFolders() {
    const el = this.overlay.querySelector('#fe-all-folder-list');
    el.innerHTML = '';
    const groups = this._allBizGroups();
    const query = (this._allBizSearch || '').toLowerCase().trim();
    const visible = query
      ? groups.filter(g => g.name.toLowerCase().includes(query))
      : groups;

    if (!groups.length) {
      el.innerHTML = '<div class="fe-empty">No businesses saved yet.</div>';
      return;
    }
    if (!visible.length) {
      el.innerHTML = '<div class="fe-empty">No businesses match your search.</div>';
      return;
    }

    if (!this._allBizSelected || !visible.some(g => g.name === this._allBizSelected)) {
      this._allBizSelected = visible[0].name;
    }

    visible.forEach(g => {
      const row = document.createElement('button');
      row.className = 'fe-folder-item' + (g.name === this._allBizSelected ? ' selected' : '');
      row.onclick = () => { this._allBizSelected = g.name; this._renderAllBizFolders(); this._renderAllBizFiles(); };

      const icon = document.createElement('span');
      icon.className = 'fe-folder-icon';
      if (g.entityType && FileExplorer.ENTITY_ICONS[g.entityType]) {
        icon.innerHTML = FileExplorer.ENTITY_ICONS[g.entityType];
      } else {
        icon.textContent = '📁';
      }

      const name = document.createElement('span');
      name.className = 'fe-folder-name';
      name.textContent = g.name;
      const count = document.createElement('span');
      count.className = 'fe-folder-count';
      count.textContent = String(g.entries.length);

      row.appendChild(icon);
      row.appendChild(name);
      row.appendChild(count);
      el.appendChild(row);
    });
  }

  _renderAllBizFiles() {
    const el = this.overlay.querySelector('#fe-all-files');
    el.innerHTML = '';
    if (!this._allBizSelected) {
      el.innerHTML = '<div class="fe-empty">Select a business on the left.</div>';
      return;
    }

    const groups = this._allBizGroups();
    const group = groups.find(g => g.name === this._allBizSelected);
    if (!group) {
      el.innerHTML = '<div class="fe-empty">Select a business on the left.</div>';
      return;
    }

    const head = document.createElement('div');
    head.className = 'fe-files-head';
    const title = document.createElement('div');
    title.className = 'fe-files-title';
    title.textContent = group.name;
    const subtitle = document.createElement('div');
    subtitle.className = 'fe-files-subtitle';
    subtitle.textContent = group.entries.length + ' statement' + (group.entries.length === 1 ? '' : 's');
    const headLeft = document.createElement('div');
    headLeft.appendChild(title);
    headLeft.appendChild(subtitle);
    head.appendChild(headLeft);
    el.appendChild(head);

    const list = document.createElement('div');
    list.className = 'fe-file-list';
    group.entries.forEach(f => list.appendChild(this._allBizFileRow(f)));
    el.appendChild(list);
  }

  _allBizFileRow(f) {
    const row = document.createElement('div');
    row.className = 'fe-file-item fe-allbiz-row';

    const iconWrap = document.createElement('span');
    iconWrap.className = 'fe-file-icon';
    if (f.entity_type && FileExplorer.ENTITY_ICONS[f.entity_type]) {
      iconWrap.innerHTML = FileExplorer.ENTITY_ICONS[f.entity_type];
    } else {
      iconWrap.textContent = '📄';
    }

    const main = document.createElement('div');
    main.className = 'fe-file-main';
    const name = document.createElement('div');
    name.className = 'fe-file-name';
    name.textContent = f.year ? `${f.year}` : (f.file || '(untitled)');
    const meta = document.createElement('div');
    meta.className = 'fe-file-meta';
    const parts = [
      f.file || null,
      f.updated_at ? `updated ${String(f.updated_at).slice(0, 10)}` : null,
    ].filter(Boolean);
    meta.textContent = parts.join(' · ');
    meta.title = meta.textContent;
    main.appendChild(name);
    main.appendChild(meta);

    if (f.lockedBy) {
      row.classList.add('fe-file-locked');
      const lockBadge = document.createElement('span');
      lockBadge.className = 'fe-lock-badge';
      lockBadge.textContent = '🔒 ' + f.lockedBy;
      meta.appendChild(document.createTextNode(' · '));
      meta.appendChild(lockBadge);
    }

    const actions = document.createElement('div');
    actions.className = 'fe-file-actions fe-allbiz-actions';
    actions.appendChild(this._actionBtn('Open', 'Open this statement (form values, document rebuilt)', e => this._open(f, e.currentTarget)));
    actions.appendChild(this._actionBtn('Open LHS only', 'Open the form values only — the document is built fresh, without the saved preview edits', e => this._open(f, e.currentTarget, { lhsOnly: true })));
    actions.appendChild(this._actionBtn('New Year', 'Copy this statement into a new year', e => this._openInNewYear(f, e.currentTarget)));
    const del = this._actionBtn('Delete', 'Delete this statement', () => this._delete(f));
    del.classList.add('fe-action-danger');
    actions.appendChild(del);
    row.appendChild(iconWrap);
    row.appendChild(main);
    row.appendChild(actions);
    return row;
  }

  _actionBtn(label, tooltip, onClick) {
    const b = document.createElement('button');
    b.className = 'fe-action-btn';
    b.title = tooltip;
    b.textContent = label;
    b.onclick = onClick;
    return b;
  }
}
