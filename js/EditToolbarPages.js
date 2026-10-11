// EditToolbarPages.js — Page management: letterhead/footer insertion,
// page selector, signatures, Word import, reorder, add/remove pages.
// Depends on EditToolbar.js (_saveSnapshot). All functions are global.

// ── Helper: get all document pages ──
function _getPages() {
  const output = document.getElementById('document-output');
  if (!output) return null;
  const pages = output.querySelectorAll('.doc-page, .cover-page');
  return pages.length ? pages : null;
}

// ── Styled input modal (replaces browser prompt) ──
function _styledPrompt(title, hint, placeholder) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'ps-input-overlay';
    overlay.innerHTML = `
      <div class="ps-input-modal">
        <h3>${title}</h3>
        <p class="ps-input-hint">${hint || ''}</p>
        <input type="text" placeholder="${placeholder || ''}" autofocus>
        <div class="ps-actions">
          <button class="ps-btn ps-btn-cancel">Cancel</button>
          <button class="ps-btn ps-btn-apply">OK</button>
        </div>
      </div>`;

    const input = overlay.querySelector('input');
    const apply = () => { const v = input.value; overlay.remove(); resolve(v); };
    const cancel = () => { overlay.remove(); resolve(null); };

    overlay.querySelector('.ps-btn-apply').addEventListener('click', apply);
    overlay.querySelector('.ps-btn-cancel').addEventListener('click', cancel);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') apply(); if (e.key === 'Escape') cancel(); });
    overlay.addEventListener('click', e => { if (e.target === overlay) cancel(); });

    document.body.appendChild(overlay);
    requestAnimationFrame(() => input.focus());
  });
}

// ── Visual page selector ──
function _selectPages(pages, actionLabel) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'page-selector-overlay';

    function _pageLabel(page, i) {
      const h2 = page.querySelector('h2');
      if (h2) return h2.textContent.trim().substring(0, 22);
      if (page.classList.contains('cover-page')) return 'Cover Page';
      return 'Page ' + (i + 1);
    }

    const selected = new Set();

    function render() {
      const cards = overlay.querySelectorAll('.ps-page-card');
      cards.forEach(c => {
        const idx = +c.dataset.idx;
        c.classList.toggle('selected', selected.has(idx));
      });
      overlay.querySelector('.ps-btn-apply').disabled = selected.size === 0;
      Array.from(pages).forEach((p, i) => {
        p.classList.toggle('page-selected-glow', selected.has(i));
      });
    }

    function cleanup() {
      Array.from(pages).forEach(p => p.classList.remove('page-selected-glow'));
      overlay.remove();
    }

    let gridHTML = '';
    for (let i = 0; i < pages.length; i++) {
      gridHTML += `<div class="ps-page-card" data-idx="${i}">
        <div class="ps-thumb-wrap" data-thumb-idx="${i}"></div>
        <div class="ps-card-footer">
          <span class="ps-card-num">${i + 1}</span>
          <span class="ps-card-label">${_pageLabel(pages[i], i)}</span>
        </div>
      </div>`;
    }

    overlay.innerHTML = `
      <div class="page-selector-modal">
        <h3>${actionLabel || 'Select Pages'}</h3>
        <p class="ps-subtitle">Click pages to select, then apply</p>
        <div class="ps-grid">${gridHTML}</div>
        <div class="ps-actions">
          <button class="ps-select-all">Select All</button>
          <button class="ps-btn ps-btn-cancel">Cancel</button>
          <button class="ps-btn ps-btn-apply" disabled>Apply</button>
        </div>
      </div>`;

    // Render mini thumbnails by cloning pages
    requestAnimationFrame(() => {
      overlay.querySelectorAll('.ps-thumb-wrap').forEach(wrap => {
        const idx = +wrap.dataset.thumbIdx;
        const page = pages[idx];
        const clone = page.cloneNode(true);
        clone.removeAttribute('contenteditable');
        clone.classList.remove('page-selected-glow');
        const wrapW = wrap.offsetWidth || 120;
        const pageW = page.offsetWidth || 740;
        const scale = wrapW / pageW;
        clone.style.cssText = `
          width: ${pageW}px; min-height: auto; margin: 0;
          padding: 20px 24px; box-shadow: none; pointer-events: none;
          font-size: 9.5pt; line-height: 1.4;
          position: absolute; top: 0; left: 0;
          transform: scale(${scale}); transform-origin: top left;
        `;
        clone.className = page.className + ' ps-thumb-inner';
        wrap.appendChild(clone);
      });
    });

    overlay.querySelectorAll('.ps-page-card').forEach(card => {
      card.addEventListener('click', () => {
        const idx = +card.dataset.idx;
        if (selected.has(idx)) selected.delete(idx); else selected.add(idx);
        render();
      });
    });

    overlay.querySelector('.ps-select-all').addEventListener('click', () => {
      if (selected.size === pages.length) { selected.clear(); }
      else { for (let i = 0; i < pages.length; i++) selected.add(i); }
      render();
    });

    overlay.querySelector('.ps-btn-cancel').addEventListener('click', () => { cleanup(); resolve(null); });
    overlay.querySelector('.ps-btn-apply').addEventListener('click', () => {
      const result = Array.from(selected).sort((a, b) => a - b);
      cleanup();
      resolve(result);
    });
    overlay.addEventListener('click', e => { if (e.target === overlay) { cleanup(); resolve(null); } });

    document.body.appendChild(overlay);
    render();
  });
}

// ── Letterhead & Footer helpers ──
function _applyHeaderImage(src, pageIndices, pages) {
  _saveSnapshot();
  pageIndices.forEach(idx => {
    const page = pages[idx];
    _markPageEdited(page);
    const existing = page.querySelector('.letterhead-img');
    if (existing) { existing.src = src; }
    else {
      const img = document.createElement('img');
      img.className = 'letterhead-img'; img.src = src; img.alt = 'Letterhead';
      page.insertBefore(img, page.firstChild);
    }
  });
}

function _applyFooterImage(src, pageIndices, pages) {
  _saveSnapshot();
  pageIndices.forEach(idx => {
    const page = pages[idx];
    _markPageEdited(page);
    const existing = page.querySelector('.letterhead-footer-img');
    if (existing) {
      existing.src = src;
      // Chosen by hand — exempt from the orphan-footer sweep even if this page
      // carries no letterhead image.
      existing.closest('.letterhead-footer')?.setAttribute('data-manual-footer', 'true');
    }
    else {
      let footer = page.querySelector('.letterhead-footer');
      if (!footer) { footer = document.createElement('div'); footer.className = 'letterhead-footer'; page.appendChild(footer); }
      footer.setAttribute('data-manual-footer', 'true');
      const img = document.createElement('img');
      img.className = 'letterhead-footer-img'; img.src = src; img.alt = 'Footer';
      footer.innerHTML = ''; footer.appendChild(img);
    }
  });
}

// Wire up the header/footer dropdowns
document.addEventListener('DOMContentLoaded', () => {
  const selHeader = document.getElementById('sel-header');
  const selFooter = document.getElementById('sel-footer');
  const uploadHeader = document.getElementById('upload-header');
  const uploadFooter = document.getElementById('upload-footer');

  if (selHeader) selHeader.addEventListener('change', async function() {
    const val = this.value; this.selectedIndex = 0;
    const pages = _getPages(); if (!pages) return;
    const idx = await _selectPages(pages, 'Insert Letterhead');
    if (!idx || !idx.length) return;
    if (val === '__upload') {
      uploadHeader.onchange = function() {
        if (!this.files[0]) return;
        const reader = new FileReader();
        reader.onload = e => _applyHeaderImage(e.target.result, idx, pages);
        reader.readAsDataURL(this.files[0]); this.value = '';
      };
      uploadHeader.click();
    } else { _applyHeaderImage(val, idx, pages); }
  });

  if (selFooter) selFooter.addEventListener('change', async function() {
    const val = this.value; this.selectedIndex = 0;
    const pages = _getPages(); if (!pages) return;
    const idx = await _selectPages(pages, 'Insert Footer');
    if (!idx || !idx.length) return;
    if (val === '__upload') {
      uploadFooter.onchange = function() {
        if (!this.files[0]) return;
        const reader = new FileReader();
        reader.onload = e => _applyFooterImage(e.target.result, idx, pages);
        reader.readAsDataURL(this.files[0]); this.value = '';
      };
      uploadFooter.click();
    } else { _applyFooterImage(val, idx, pages); }
  });
});

// ── Insert Signature Space ──
async function insertSignatureSpace() {
  const pages = _getPages(); if (!pages) return;
  const idx = await _selectPages(pages, 'Insert Signature');
  if (!idx || !idx.length) return;

  const nameVal = await _styledPrompt(
    'Signature Line',
    'Enter a name to display below the line, or leave blank.',
    'e.g. J. Visser'
  ) ?? '';

  _saveSnapshot();
  idx.forEach(i => {
    const page = pages[i];
    _markPageEdited(page);
    const sigHtml = document.createElement('div');
    sigHtml.className = 'signature-block';
    const entry = document.createElement('div');
    entry.className = 'sig-entry';
    entry.contentEditable = 'false';
    entry.innerHTML = `
      <div class="sig-space" style="min-height:50px;"></div>
      <div class="sig-line">&nbsp;</div>
      <div class="sig-name">${nameVal || '&nbsp;'}</div>`;
    sigHtml.appendChild(entry);
    const footer = page.querySelector('.letterhead-footer');
    if (footer) { page.insertBefore(sigHtml, footer); }
    else { page.appendChild(sigHtml); }
  });
  if (typeof _initSigDrag === 'function') _initSigDrag();
}

// ── Upload Word Document ──
function uploadWordDoc() {
  const output = document.getElementById('document-output');
  if (!output) { alert('Generate a document first before importing.'); return; }

  const fileInput = document.getElementById('upload-word');
  fileInput.onchange = async function () {
    const file = this.files[0]; if (!file) return; this.value = '';

    const overlay = document.createElement('div');
    overlay.className = 'page-selector-overlay';
    overlay.innerHTML = `
      <div class="page-selector-modal" style="text-align:center;">
        <div class="ps-upload-status">
          <div class="ps-spinner"></div>
          <p>Importing <strong>${file.name}</strong>…</p>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer }, {
        styleMap: [
          "p[style-name='Heading 1'] => h2:fresh",
          "p[style-name='Heading 2'] => h3:fresh",
          "p[style-name='Heading 3'] => h4:fresh"
        ]
      });

      const html = result.value;
      if (!html || !html.trim()) { overlay.remove(); alert('The document appears to be empty or could not be read.'); return; }

      _saveSnapshot();
      const wrapper = document.createElement('div'); wrapper.innerHTML = html;
      const sections = []; let currentSection = [];
      wrapper.childNodes.forEach(node => {
        if (node.nodeName === 'H2' && currentSection.length > 0) { sections.push(currentSection); currentSection = []; }
        currentSection.push(node);
      });
      if (currentSection.length) sections.push(currentSection);

      const existingPages = output.querySelectorAll('.doc-page, .cover-page');
      let pageNum = existingPages.length + 1;

      sections.forEach(nodes => {
        const page = document.createElement('div'); page.className = 'doc-page';
        nodes.forEach(n => page.appendChild(n.cloneNode(true)));
        const pgNum = document.createElement('div'); pgNum.className = 'page-number'; pgNum.textContent = pageNum++;
        page.appendChild(pgNum);
        const editBtn = document.getElementById('btn-edit-preview');
        if (editBtn && editBtn.classList.contains('active')) page.setAttribute('contenteditable', 'true');
        output.appendChild(page);
        _markManualPage(page);
      });
      overlay.remove();
    } catch (err) {
      overlay.remove(); console.error('Word import error:', err);
      alert('Failed to import the document. Please ensure it is a valid .docx file.');
    }
  };
  fileInput.click();
}

// ── Reorder Pages (Drag & Drop) ──
function reorderPages() {
  const output = document.getElementById('document-output');
  if (!output) return;
  const pages = output.querySelectorAll('.doc-page, .cover-page');
  if (!pages.length) { alert('No pages to reorder. Generate a document first.'); return; }

  const overlay = document.createElement('div');
  overlay.className = 'page-selector-overlay';

  function _pageLabel(page, i) {
    const h2 = page.querySelector('h2');
    if (h2) return h2.textContent.trim().substring(0, 22);
    if (page.classList.contains('cover-page')) return 'Cover Page';
    return 'Page ' + (i + 1);
  }

  const pageOrder = Array.from(pages);

  function buildGrid() {
    return pageOrder.map((page, i) =>
      `<div class="reorder-card" data-reorder-idx="${i}" draggable="true"><div class="ps-thumb-wrap" data-reorder-thumb="${i}"></div><div class="reorder-footer"><span class="reorder-num">${i + 1}</span><span class="reorder-label">${_pageLabel(page, i)}</span><span class="reorder-grip">⠿</span></div></div>`
    ).join('');
  }

  overlay.innerHTML = `<div class="page-selector-modal"><h3>Reorder Pages</h3><p class="ps-subtitle">Drag and drop pages to reorder them</p><div class="reorder-grid" id="reorder-grid">${buildGrid()}</div><div class="ps-actions"><button class="ps-btn ps-btn-cancel">Cancel</button><button class="ps-btn ps-btn-apply">Apply Order</button></div></div>`;

  const grid = overlay.querySelector('#reorder-grid');
  let dragIdx = null;

  function renderThumbs() {
    overlay.querySelectorAll('.ps-thumb-wrap[data-reorder-thumb]').forEach(wrap => {
      const idx = +wrap.dataset.reorderThumb, page = pageOrder[idx];
      if (!page || wrap.childElementCount) return;
      const clone = page.cloneNode(true);
      clone.removeAttribute('contenteditable'); clone.classList.remove('page-selected-glow');
      const wrapW = wrap.offsetWidth || 130, pageW = page.offsetWidth || 740, scale = wrapW / pageW;
      clone.style.cssText = `width:${pageW}px;min-height:auto;margin:0;padding:20px 24px;box-shadow:none;pointer-events:none;font-size:9.5pt;line-height:1.4;position:absolute;top:0;left:0;transform:scale(${scale});transform-origin:top left;`;
      clone.className = page.className + ' ps-thumb-inner';
      wrap.appendChild(clone);
    });
  }

  function rebuildGridDOM() { grid.innerHTML = buildGrid(); attachDragListeners(); requestAnimationFrame(renderThumbs); }

  function attachDragListeners() {
    const cards = grid.querySelectorAll('.reorder-card');
    cards.forEach(card => {
      card.addEventListener('dragstart', e => {
        dragIdx = +card.dataset.reorderIdx; card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragIdx);
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        grid.querySelectorAll('.reorder-card').forEach(c => c.classList.remove('drag-over'));
        dragIdx = null;
      });
      card.addEventListener('dragover', e => {
        e.preventDefault(); e.dataTransfer.dropEffect = 'move';
        if (+card.dataset.reorderIdx !== dragIdx) card.classList.add('drag-over');
      });
      card.addEventListener('dragleave', () => { card.classList.remove('drag-over'); });
      card.addEventListener('drop', e => {
        e.preventDefault(); card.classList.remove('drag-over');
        const targetIdx = +card.dataset.reorderIdx;
        if (dragIdx === null || dragIdx === targetIdx) return;
        const moved = pageOrder.splice(dragIdx, 1)[0];
        pageOrder.splice(targetIdx, 0, moved);
        dragIdx = null; rebuildGridDOM();
      });
    });

    // Touch support for mobile
    let touchDragIdx = null, touchClone = null, touchTarget = null;
    cards.forEach(card => {
      card.addEventListener('touchstart', e => {
        touchDragIdx = +card.dataset.reorderIdx; card.classList.add('dragging');
        touchClone = card.cloneNode(true);
        touchClone.style.cssText = `position:fixed;z-index:99999;pointer-events:none;width:${card.offsetWidth}px;opacity:0.85;transform:rotate(2deg);box-shadow:0 8px 24px rgba(0,0,0,0.3);`;
        document.body.appendChild(touchClone);
        const t = e.touches[0];
        touchClone.style.left = (t.clientX - card.offsetWidth / 2) + 'px';
        touchClone.style.top = (t.clientY - 40) + 'px';
      }, { passive: true });

      card.addEventListener('touchmove', e => {
        if (touchClone) {
          const t = e.touches[0];
          touchClone.style.left = (t.clientX - touchClone.offsetWidth / 2) + 'px';
          touchClone.style.top = (t.clientY - 40) + 'px';
          const el = document.elementFromPoint(t.clientX, t.clientY);
          const targetCard = el?.closest('.reorder-card');
          grid.querySelectorAll('.reorder-card').forEach(c => c.classList.remove('drag-over'));
          if (targetCard && +targetCard.dataset.reorderIdx !== touchDragIdx) {
            targetCard.classList.add('drag-over'); touchTarget = +targetCard.dataset.reorderIdx;
          } else { touchTarget = null; }
        }
        e.preventDefault();
      }, { passive: false });

      card.addEventListener('touchend', () => {
        if (touchClone) { touchClone.remove(); touchClone = null; }
        grid.querySelectorAll('.reorder-card').forEach(c => { c.classList.remove('dragging'); c.classList.remove('drag-over'); });
        if (touchDragIdx !== null && touchTarget !== null && touchDragIdx !== touchTarget) {
          const moved = pageOrder.splice(touchDragIdx, 1)[0];
          pageOrder.splice(touchTarget, 0, moved); rebuildGridDOM();
        }
        touchDragIdx = null; touchTarget = null;
      });
    });
  }

  overlay.querySelector('.ps-btn-cancel').addEventListener('click', () => overlay.remove());
  overlay.querySelector('.ps-btn-apply').addEventListener('click', () => {
    _saveSnapshot();
    pageOrder.forEach((page, i) => {
      output.appendChild(page);
      const pgNum = page.querySelector('.page-number');
      if (pgNum) pgNum.textContent = i + 1;
    });
    overlay.remove();
    // Page order isn't tracked: pages that were not hand-edited return to
    // their generated positions if the document regenerates from the form.
    if (typeof BusinessInfoManager !== 'undefined') {
      BusinessInfoManager.showToast(
        'Note: the new page order resets if the document regenerates from the form. Reorder as a final step (or in I Love INF181).',
        'info', 7000
      );
    }
  });
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  document.body.appendChild(overlay);
  attachDragListeners();
  requestAnimationFrame(renderThumbs);
}

// ── Create a blank doc-page modelled on a reference page ──
// Clones the reference page's letterhead/footer so the new page matches, and
// honours the current edit-mode / page-number toggles. When `withSeed` is true
// a placeholder paragraph is added so the page isn't completely empty; pass
// false when the caller will immediately fill the page (e.g. overflow reflow).
function _createBlankPage(refPage, withSeed = true) {
  const newPage = document.createElement('div');
  newPage.className = 'doc-page';

  if (refPage) {
    const headerImg = refPage.querySelector('.letterhead-img');
    if (headerImg) newPage.appendChild(headerImg.cloneNode(true));
  }

  if (withSeed) {
    const p = document.createElement('p'); p.innerHTML = '&nbsp;'; newPage.appendChild(p);
  }

  if (refPage) {
    const footer = refPage.querySelector('.letterhead-footer');
    if (footer) newPage.appendChild(footer.cloneNode(true));
  }

  const pgNum = document.createElement('div');
  pgNum.className = 'page-number';
  const showingNums = document.getElementById('btn-page-numbers')?.classList.contains('tb-active');
  pgNum.style.display = showingNums ? 'block' : 'none';
  newPage.appendChild(pgNum);

  const editBtn = document.getElementById('btn-edit-preview');
  if (editBtn && editBtn.classList.contains('active')) newPage.setAttribute('contenteditable', 'true');

  return newPage;
}

// ── Renumber every page's page-number element to its position ──
function _renumberPages() {
  const output = document.getElementById('document-output');
  if (!output) return;
  output.querySelectorAll('.doc-page, .cover-page').forEach((page, i) => {
    const pgNum = page.querySelector('.page-number');
    if (pgNum) pgNum.textContent = i + 1;
  });
}

// ── Add Page ──
function addPage() {
  const output = document.getElementById('document-output');
  if (!output) { alert('Generate a document first.'); return; }
  const pages = output.querySelectorAll('.doc-page, .cover-page');
  if (!pages.length) { alert('Generate a document first.'); return; }

  _saveSnapshot();

  const newPage = _createBlankPage(pages[pages.length - 1]);
  output.appendChild(newPage);
  _markManualPage(newPage);
  _renumberPages();

  const preview = document.querySelector('.preview-panel');
  if (preview) { requestAnimationFrame(() => { newPage.scrollIntoView({ behavior: 'smooth', block: 'start' }); }); }
}

// ── Insert a blank page directly after a given page ──
// Used by the "Insert page here" controls rendered between pages in edit mode.
function insertPageAfter(refPage) {
  const output = document.getElementById('document-output');
  if (!output || !refPage) return;

  _saveSnapshot();

  const newPage = _createBlankPage(refPage);
  refPage.after(newPage);
  _markManualPage(newPage);
  _renumberPages();

  requestAnimationFrame(() => { newPage.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
}

// ── Remove Page ──
async function removePage() {
  const pages = _getPages();
  if (!pages) { alert('No pages to remove. Generate a document first.'); return; }

  const idx = await _selectPages(pages, 'Remove Pages');
  if (!idx || !idx.length) return;

  _saveSnapshot();

  const output = document.getElementById('document-output');
  const allPages = Array.from(output.querySelectorAll('.doc-page, .cover-page'));

  idx.slice().reverse().forEach(i => {
    const page = allPages[i];
    if (!page) return;
    // Remember removed generated pages so a regeneration doesn't bring them back
    const uid = _pageUidOf(page);
    if (uid && !uid.startsWith('manual@')) _removedPageUids.add(uid);
    page.remove();
  });
  _notePreviewChange();

  const remaining = output.querySelectorAll('.doc-page, .cover-page');
  remaining.forEach((page, i) => {
    const pgNum = page.querySelector('.page-number');
    if (pgNum) pgNum.textContent = i + 1;
  });
}

// ── Upload PDF Document ──
function uploadPdfDoc() {
  const output = document.getElementById('document-output');
  if (!output) { alert('Generate a document first before importing.'); return; }

  const fileInput = document.getElementById('upload-pdf');
  fileInput.onchange = async function () {
    const file = this.files[0]; if (!file) return; this.value = '';

    const overlay = document.createElement('div');
    overlay.className = 'page-selector-overlay';
    overlay.innerHTML = `
      <div class="page-selector-modal" style="text-align:center;">
        <div class="ps-upload-status">
          <div class="ps-spinner"></div>
          <p>Importing <strong>${file.name}</strong>…</p>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;

      if (numPages === 0) { overlay.remove(); alert('The PDF appears to be empty.'); return; }

      _saveSnapshot();

      const existingPages = output.querySelectorAll('.doc-page, .cover-page');
      let pageNum = existingPages.length + 1;
      const scale = 2;

      for (let i = 1; i <= numPages; i++) {
        overlay.querySelector('p').innerHTML = `Importing <strong>${file.name}</strong>… page ${i} of ${numPages}`;

        const pdfPage = await pdf.getPage(i);
        const viewport = pdfPage.getViewport({ scale });

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');

        await pdfPage.render({ canvasContext: ctx, viewport }).promise;

        const imgDataUrl = canvas.toDataURL('image/png');

        const page = document.createElement('div');
        page.className = 'doc-page pdf-imported-page';
        page.style.padding = '0';
        page.style.overflow = 'hidden';

        const img = document.createElement('img');
        img.src = imgDataUrl;
        img.alt = `PDF page ${i}`;
        img.style.cssText = 'width:100%;height:auto;display:block;';
        page.appendChild(img);

        const pgNumEl = document.createElement('div');
        pgNumEl.className = 'page-number';
        pgNumEl.textContent = pageNum++;
        page.appendChild(pgNumEl);

        const editBtn = document.getElementById('btn-edit-preview');
        if (editBtn && editBtn.classList.contains('active')) page.setAttribute('contenteditable', 'true');

        output.appendChild(page);
        _markManualPage(page);
      }

      overlay.remove();
    } catch (err) {
      overlay.remove(); console.error('PDF import error:', err);
      alert('Failed to import the PDF. Please ensure it is a valid .pdf file.');
    }
  };
  fileInput.click();
}

// ════════════════════════════════════════════════════════════════════════════
// "Insert page here" controls between pages (edit mode only)
// ════════════════════════════════════════════════════════════════════════════

// Rebuild the inter-page insert controls. Inserts a `.insert-page-zone` after
// each page while editing; removes them all when not editing. The controls are
// transient UI siblings of the pages — they are stripped before printing and
// before a business is saved, so they never become part of the document.
let _insertZoneObserver = null;
function _refreshInsertZones() {
  const output = document.getElementById('document-output');
  if (!output) return;
  const editing = document.getElementById('btn-edit-preview')?.classList.contains('active');

  // Pause the observer so our own DOM edits don't re-trigger a rebuild.
  if (_insertZoneObserver) _insertZoneObserver.disconnect();

  output.querySelectorAll('.insert-page-zone').forEach(z => z.remove());

  if (editing) {
    output.querySelectorAll('.doc-page, .cover-page').forEach(page => {
      const zone = document.createElement('div');
      zone.className = 'insert-page-zone';
      zone.setAttribute('contenteditable', 'false');
      zone.innerHTML = '<button type="button" class="insert-page-btn" tabindex="-1">+ Insert page here</button>';
      page.after(zone);
    });
  }

  if (_insertZoneObserver) _insertZoneObserver.observe(output, { childList: true });
}

// ════════════════════════════════════════════════════════════════════════════
// Unlock Jump Pages — overflow text flows onto a new page on Enter
// ════════════════════════════════════════════════════════════════════════════

let _jumpPagesEnabled = false;
function toggleJumpPages() {
  _jumpPagesEnabled = !_jumpPagesEnabled;
  document.getElementById('btn-jump-pages')?.classList.toggle('tb-active', _jumpPagesEnabled);
}

// Structural children that stay anchored to their page (never reflow).
function _isStructuralChild(el) {
  return el.nodeType === 1 && (
    el.classList.contains('letterhead-img') ||
    el.classList.contains('letterhead-footer') ||
    el.classList.contains('page-number')
  );
}

// First content child of a page (i.e. where moved content should be prepended).
// Falls back to the footer/page-number so moved content lands above them.
function _firstContentChild(page) {
  for (const c of page.children) { if (!_isStructuralChild(c)) return c; }
  return page.querySelector('.letterhead-footer') || page.querySelector('.page-number') || null;
}

// While a page's content exceeds its fixed A4 height, move trailing content
// blocks onto the following page (creating it if needed), preserving order.
function _reflowPageOverflow(page) {
  if (!page) return;
  let guard = 0;
  while (page.scrollHeight > page.clientHeight + 2 && guard++ < 500) {
    const content = Array.from(page.children).filter(c => !_isStructuralChild(c));
    if (content.length <= 1) break; // keep at least one block on the page

    let next = page.nextElementSibling;
    while (next && !(next.classList.contains('doc-page') || next.classList.contains('cover-page'))) {
      next = next.nextElementSibling;
    }
    if (!next) {
      next = _createBlankPage(page, false);
      page.after(next);
      _markManualPage(next);
    } else {
      // Manual content flows onto this page, so it must survive regeneration
      _markPageEdited(next);
    }

    next.insertBefore(content[content.length - 1], _firstContentChild(next));
  }
}

// Place the caret at the start of an element.
function _placeCaretAtStart(el) {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(true);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

// Resolve the direct page-child block that contains the given node.
function _pageChildBlock(node, page) {
  let el = node.nodeType === 1 ? node : node.parentElement;
  while (el && el.parentElement && el.parentElement !== page) el = el.parentElement;
  return el && el.parentElement === page ? el : null;
}

// ── Wire up jump-pages keydown + insert-zone observer ──
document.addEventListener('DOMContentLoaded', () => {
  const output = document.getElementById('document-output');
  if (!output) return;

  // Keep insert zones in sync whenever pages are added or removed.
  _insertZoneObserver = new MutationObserver(muts => {
    const touchesPage = node => node.nodeType === 1 &&
      (node.classList.contains('doc-page') || node.classList.contains('cover-page'));
    const relevant = muts.some(m =>
      Array.from(m.addedNodes).some(touchesPage) ||
      Array.from(m.removedNodes).some(touchesPage));
    if (relevant) _refreshInsertZones();
  });
  _insertZoneObserver.observe(output, { childList: true });

  // Click an "Insert page here" button → new page after the page above it.
  output.addEventListener('click', e => {
    const btn = e.target.closest('.insert-page-btn');
    if (!btn) return;
    const zone = btn.closest('.insert-page-zone');
    const page = zone?.previousElementSibling;
    if (page && (page.classList.contains('doc-page') || page.classList.contains('cover-page'))) {
      insertPageAfter(page);
    }
  });

  // Enter inside an overflowing page (with jump pages on) pushes the overflow
  // onto the next page and follows the caret there.
  output.addEventListener('keydown', e => {
    if (!_jumpPagesEnabled || e.key !== 'Enter') return;
    const editBtn = document.getElementById('btn-edit-preview');
    if (!editBtn || !editBtn.classList.contains('active')) return;

    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const startNode = sel.anchorNode;
    const page = (startNode.nodeType === 1 ? startNode : startNode.parentElement)
      ?.closest('.doc-page, .cover-page');
    if (!page) return;

    // Let the browser insert the newline first, then reflow if it overflowed.
    requestAnimationFrame(() => {
      if (page.scrollHeight <= page.clientHeight + 2) return;

      const s = window.getSelection();
      const caretBlock = s && s.anchorNode ? _pageChildBlock(s.anchorNode, page) : null;

      _saveSnapshot();
      _reflowPageOverflow(page);
      _renumberPages();
      _refreshInsertZones();

      if (caretBlock) {
        _placeCaretAtStart(caretBlock);
        const movedPage = caretBlock.closest('.doc-page, .cover-page');
        if (movedPage) requestAnimationFrame(() =>
          movedPage.scrollIntoView({ behavior: 'smooth', block: 'center' }));
      }
    });
  });
});
