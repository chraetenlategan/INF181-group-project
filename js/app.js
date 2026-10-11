// app.js — Initialisation: creates instances, wires up globals
// Depends on: config.js, utils.js, EntityManager.js, CalendarPicker.js,
//             DocumentGenerator.js, PreviewManager.js, ExcelImporter.js

const USER_NAME_KEY = 'policygenUserName';

// Opened through INF181Server.exe, the shell already knows who is sitting here: the
// person signed in with Cloudflare once, on this machine, ever, and the shell
// verified the signature on that enrolment before publishing the name. See
// INF181-Server-Shell/src/Inf181ServerShell/Identity.cs.
//
// It wins over the stored name on purpose. A machine two people share must not
// silently leave the second of them working as the first — which is exactly what
// a remembered localStorage name does, and the whole reason ownership on a file
// was ever wrong. Absent in a plain browser, where the prompt below still runs.
//
// This is identification, not authentication, and nothing here is gated behind
// it — the same as the typed name it replaces.
function shellUserName() {
  try {
    const user = window.__INF181_USER__;
    if (user && typeof user.name === 'string' && user.name.trim()) return user.name.trim();
  } catch (_) { }
  return '';
}

function getUserName() {
  const fromShell = shellUserName();
  if (fromShell) return fromShell;

  try { return localStorage.getItem(USER_NAME_KEY) || ''; } catch (_) { return ''; }
}

function setUserName(name) {
  try { localStorage.setItem(USER_NAME_KEY, name); } catch (_) {}
  const el = document.getElementById('settings-username');
  if (el) el.value = name;
  refreshPdfEditorAccess();
}

// Admin gate. The File Explorer's "Recent" view is only offered to this user — identified purely by the name typed at
// the login prompt, or handed over by the shell. This is a convenience gate, not
// security: everything it shows is already available to any client through the normal API.
const ADMIN_USER_NAME = 'admin';

// On the first name only. People typed "Admin" here; the shell's staff directory
// says "Test User", and an exact match against the whole string would have
// switched these features off the moment the sign-in started supplying full names —
// silently, since nothing announces an admin feature that did not appear.
function isAdminUser() {
  return getUserName().trim().split(/\s+/)[0].toLowerCase() === ADMIN_USER_NAME;
}

// PDF editor gate. Offered only to these people — matched anywhere in the name,
// case-insensitive, so "Rosa", "rosa smith" and a shell-supplied full name
// all qualify. Same kind of gate as isAdminUser(): convenience, not security.
const PDF_EDITOR_USERS = ['rosa', 'rita', 'admin'];

function canUsePdfEditor() {
  const name = getUserName().toLowerCase();
  return PDF_EDITOR_USERS.some(n => name.includes(n));
}

function refreshPdfEditorAccess() {
  const section = document.getElementById('settings-pdf-editor');
  if (section) section.style.display = canUsePdfEditor() ? '' : 'none';
}

function openPdfEditor() {
  if (!canUsePdfEditor()) return;
  previewManager.openEditor('pdf-editor', new URL('pdf-editor/index.html', window.location.href).href);
}

function showLoginPrompt(onDone) {
  const existing = document.getElementById('login-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'login-overlay';
  overlay.className = 'page-selector-overlay login-overlay-no-dismiss';

  const modal = document.createElement('div');
  modal.className = 'page-selector-modal';
  modal.style.maxWidth = '380px';
  modal.innerHTML = `
    <h3>Welcome</h3>
    <div class="ps-subtitle">Enter your name so others can see who is working on a file.</div>
    <div class="field-group" style="margin-top:14px;">
      <label for="login-name-input">Your name</label>
      <input type="text" id="login-name-input" placeholder="e.g. Admin"
        autocomplete="off" spellcheck="false" maxlength="40"
        style="width:100%;box-sizing:border-box;padding:9px 12px;border:2px solid #e8e8e8;border-radius:8px;font-family:'Poppins',sans-serif;font-size:13px;">
    </div>
    <div id="login-error" style="font-size:12px;color:#c0392b;min-height:16px;margin-top:6px;"></div>
    <div class="ps-actions" style="margin-top:12px;">
      <button class="ps-btn ps-btn-primary" id="login-confirm-btn">Continue</button>
    </div>`;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const input = modal.querySelector('#login-name-input');
  const err = modal.querySelector('#login-error');
  const btn = modal.querySelector('#login-confirm-btn');

  const confirm = () => {
    const name = (input.value || '').trim();
    if (!name) { err.textContent = 'Please enter your name.'; input.focus(); return; }
    setUserName(name);
    overlay.remove();
    if (onDone) onDone();
  };

  btn.onclick = confirm;
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') confirm(); });
  requestAnimationFrame(() => input.focus());
}

let _liveUpdateTimer = null;

function liveUpdate() {
  refreshTrustResolutionRepOptions();
  const output = document.getElementById('document-output');
  if (!output || !output.classList.contains('visible')) return;
  if (typeof previewManager === 'undefined' || !previewManager.previewVisible) return;

  // ✏️ Edit mode: the document on screen is the user's own markup, so it is
  // never rebuilt from the form. Only the protected variables move — each is
  // re-rendered inside the span it already occupies (DocVars), which is how a
  // hand-edited document still follows the left-hand side. This is also the
  // "rebuild only what changed" path: no generate, no pagination, no scroll.
  //
  // Skipped while the caret is in the preview: the user is typing on the right,
  // that typing is what is writing the form field, and rewriting the text node
  // under the caret would collapse the selection.
  if (document.getElementById('btn-edit-preview')?.classList.contains('active')) {
    updateBusinessHeader();
    if (typeof DocVars === 'undefined') return;
    if (output.contains(document.activeElement)) return;
    clearTimeout(_liveUpdateTimer);
    _liveUpdateTimer = setTimeout(() => {
      if (output.contains(document.activeElement)) return;
      if (typeof ChangeGlow !== 'undefined') ChangeGlow.before(output);
      DocVars.patch(output);
      // Policies ticked or unticked on the left are added to / removed from the
      // notes pages in place, edited or not — see _syncPoliciesLive.
      if (typeof _syncPoliciesLive === 'function') _syncPoliciesLive(output);
      if (typeof ChangeGlow !== 'undefined') ChangeGlow.after(output);
    }, 150);
    return;
  }
  // A value is being typed on the preview itself (LiveSync). Regenerating now
  // would delete the span under the caret; the commit runs liveUpdate() again.
  if (typeof LiveSync !== 'undefined' && LiveSync.isEditing()) return;

  updateBusinessHeader();
  clearTimeout(_liveUpdateTimer);
  _liveUpdateTimer = setTimeout(() => {
    if (!output.classList.contains('visible')) return;
    if (document.getElementById('btn-edit-preview')?.classList.contains('active')) return;
    if (typeof LiveSync !== 'undefined' && LiveSync.isEditing()) return;
    generateDoc();
    requestAnimationFrame(() => scrollPreviewToActiveSection());
  }, 300);
}

// An import writes the whole form at once, but liveUpdate() only refreshes a
// document that is already on screen — so the first import of a session left the
// preview empty until the user touched a field. Import paths call this instead:
// it generates the document when there isn't one yet, and otherwise behaves
// exactly like a normal live update.
function ensureDocumentGenerated() {
  if (typeof DraftCache !== 'undefined') DraftCache.touch();
  if (document.getElementById('btn-edit-preview')?.classList.contains('active')) return;
  const output = document.getElementById('document-output');
  if (output && output.classList.contains('visible')) { liveUpdate(); return; }
  generateDoc();
}

// ── Create instances ──
const entityManager = new EntityManager(liveUpdate);

const CAL_CONFIG = createCalConfig({
  autoFillPrevYear: () => entityManager.autoFillPrevYear(),
  liveUpdate: liveUpdate
});
const calendarPicker = new CalendarPicker(CAL_CONFIG);

const documentGenerator = new DocumentGenerator(entityManager);

const previewManager = new PreviewManager({
  appContainer:   document.getElementById('app-container'),
  toggleBar:      document.getElementById('mode-toggle-bar'),
  toggleLabel:    document.getElementById('toggle-label'),
  modeLabel:      document.getElementById('mode-label'),
  documentOutput: document.getElementById('document-output'),
  previewPanel:   document.querySelector('.preview-panel')
}, generateDoc);

const excelImporter = new ExcelImporter(entityManager);
const businessInfoManager = new BusinessInfoManager(entityManager);
const fileExplorer = new FileExplorer(businessInfoManager);

// ── Generate & preview ──
function generateAndPreview() {
  generateDoc();
}

function generateDoc() {
  syncNpoOrgSlots();
  const output = document.getElementById('document-output');
  // Experiment: remember the text on screen so what this rebuild changes can glow.
  if (typeof ChangeGlow !== 'undefined') ChangeGlow.before(output);
  // Detach hand-edited pages (manual preview edits) before the rebuild wipes
  // them. They are put back — and their protected variables brought back in
  // step with the form — by _restorePreservedPages() below.
  const preserved = (output && typeof _collectPreservedPages === 'function')
    ? _collectPreservedPages(output)
    : null;
  const html = documentGenerator.generate();
  const placeholder = document.getElementById('placeholder');
  if (output) {
    output.innerHTML = html;
    if (typeof _assignPageUids === 'function') _assignPageUids(output);
    if (typeof _restorePreservedPages === 'function') _restorePreservedPages(output, preserved);
    // The red checker repaints before pagination and before the change-report
    // baseline is taken, so the wrappers are part of the page the reviewer sees
    // and never register as a manual edit.
    if (typeof SuperRed !== 'undefined') SuperRed.apply(output);
    if (typeof _stampPolicyEntries === 'function') _stampPolicyEntries(output);
    output.classList.add('visible');
    // Paginate after images load so measurements are accurate
    const imgs = Array.from(output.querySelectorAll('img'));
    const pending = imgs.filter(img => !img.complete);
    let paginated = false;
    const runPaginate = () => {
      if (paginated) return;
      paginated = true;
      requestAnimationFrame(() => {
        previewManager.paginatePreview();
        if (typeof ChangeGlow !== 'undefined') ChangeGlow.after(output);
      });
    };
    if (pending.length === 0) {
      runPaginate();
    } else {
      let remaining = pending.length;
      const onDone = () => { if (--remaining <= 0) runPaginate(); };
      pending.forEach(img => {
        img.addEventListener('load', onDone, { once: true });
        img.addEventListener('error', onDone, { once: true });
      });
      setTimeout(runPaginate, 2000);
    }
  }
  if (placeholder) placeholder.style.display = 'none';
  document.getElementById('btn-print')?.classList.add('visible');
  document.getElementById('btn-ILoveINF181')?.classList.add('visible');
  document.getElementById('btn-organise')?.classList.add('visible');
  // Every regeneration rebuilds the pages from scratch, so the split assignments
  // have to be re-stamped. OrganiseManager keys them by section rather than page
  // number, so a manual choice survives a reflow that moves the page.
  if (typeof OrganiseManager !== 'undefined') OrganiseManager.apply();
  // Exit edit mode on each generate (hand-edited pages were preserved above)
  const btnEdit = document.getElementById('btn-edit-preview');
  if (btnEdit?.classList.contains('active')) {
    btnEdit.classList.remove('active');
    btnEdit.textContent = '✏️ Edit';
  }
  document.getElementById('edit-toolbar')?.classList.remove('visible');
  document.getElementById('indent-ruler')?.classList.remove('visible');
  const docOutput = document.getElementById('document-output');
  if (docOutput && _rhsInputListener) {
    docOutput.removeEventListener('input', _rhsInputListener);
    _rhsInputListener = null;
  }
}

// ── Current-business banner ──
// Shows the loaded/edited business name and its financial year at the top of the
// page. Reads straight from the form so it stays correct as the user edits, and is
// refreshed on load/import (applyFormState) and on every live update.
function updateBusinessHeader() {
  const banner = document.getElementById('business-banner');
  if (!banner) return;
  const name = (document.getElementById('companyName')?.value || '').trim();
  if (!name) { banner.style.display = 'none'; return; }

  const ye = (document.getElementById('yearEnd')?.value || '').trim();
  const year = (ye.match(/(?:19|20)\d{2}/) || [])[0] || '';

  const nameEl = document.getElementById('bb-name');
  const yearEl = document.getElementById('bb-year');
  if (nameEl) nameEl.textContent = name;
  if (yearEl) {
    yearEl.textContent = year ? `FY ${year}` : '';
    yearEl.style.display = year ? '' : 'none';
  }
  banner.style.display = '';
}

// ── Bar help modal ──


function toggleBarHelp() {
  const modal = document.getElementById('bar-help-modal');
  const overlay = document.getElementById('bar-help-overlay');
  const btn = document.getElementById('btn-bar-help');
  const open = !modal.classList.contains('visible');
  modal.classList.toggle('visible', open);
  overlay.classList.toggle('visible', open);
  btn?.classList.toggle('active', open);
}

function closeBarHelp() {
  document.getElementById('bar-help-modal')?.classList.remove('visible');
  document.getElementById('bar-help-overlay')?.classList.remove('visible');
  document.getElementById('btn-bar-help')?.classList.remove('active');
}

// ── Settings menu toggle ──
function toggleSettingsMenu() {
  const btn = document.getElementById('btn-settings');
  const menu = document.getElementById('settings-menu');
  if (!menu) return;
  const open = menu.classList.toggle('visible');
  btn?.classList.toggle('active', open);
}

document.addEventListener('click', (e) => {
  const wrap = document.getElementById('settings-wrap');
  const menu = document.getElementById('settings-menu');
  if (!wrap || !menu) return;
  if (!wrap.contains(e.target)) {
    menu.classList.remove('visible');
    document.getElementById('btn-settings')?.classList.remove('active');
  }
});

// ── Red checker ──
// The review highlight (values, dates, amounts, people, blanks) is always on —
// everyone in the office reviews statements now, so it is not a preference. The
// painting itself lives in SuperRed.js; this only starts it once the DOM is up.
(function startRedChecker() {
  if (typeof SuperRed === 'undefined') return;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => SuperRed.start(), { once: true });
  } else {
    SuperRed.start();
  }
})();


// ── Initialise on load ──
entityManager.onReportTypeChange();
entityManager.addDirector();
entityManager.addDirector();
entityManager.buildPolicyChecklist();
entityManager.onCompilerSignerChange();

document.addEventListener('DOMContentLoaded', () => {
  entityManager.onCompilerSignerChange();

  // Suggestions under the start panel's ClientReg box, so the client can be
  // picked while typing instead of only after pressing the button.
  if (typeof ClientRegSearch !== 'undefined' && ClientRegSearch.attachTypeahead) {
    ClientRegSearch.attachTypeahead(
      document.getElementById('start-clientreg-input'),
      document.getElementById('start-clientreg-suggest')
    );
  }

  const nameInput = document.getElementById('settings-username');
  if (nameInput) {
    nameInput.value = getUserName();

    // Under the shell the name is not this field's to change — getUserName()
    // reads the sign-in first, so anything typed here would be accepted, saved,
    // and then ignored. A box that quietly discards what you type is worse than
    // one you cannot type in.
    if (shellUserName()) {
      nameInput.readOnly = true;
      nameInput.style.opacity = '0.7';
      nameInput.style.cursor = 'not-allowed';
      nameInput.title = 'From your INF181 Tools sign-in. Change it there.';
    }
  }

  refreshPdfEditorAccess();

  // Bring back the form from the last session, if the app was closed mid-work.
  if (typeof DraftCache !== 'undefined') DraftCache.restore();

  const startApp = () => {
    if (typeof ConnectionManager !== 'undefined') ConnectionManager.init();
    if (typeof KeyTutorial !== 'undefined') setTimeout(KeyTutorial.announce, 1200);
  };

  if (!getUserName()) {
    showLoginPrompt(startApp);
  } else {
    startApp();
  }
});

// Wire bank "Other" live input
document.addEventListener('input', function (e) {
  if (e.target.id === 'bankOther') {
    document.getElementById('bankName').value = e.target.value;
    liveUpdate();
  }
});

// Mark the save button as "unsaved" whenever the form changes
let _hasUnsavedChanges = false;
document.addEventListener('input', function (e) {
  const form = document.querySelector('.form-panel');
  if (form && form.contains(e.target)) {
    _hasUnsavedChanges = true;
    BusinessInfoManager.markSaveButton(true);
  }
});

function clearUnsavedFlag() { _hasUnsavedChanges = false; }

window.addEventListener('beforeunload', function (e) {
  if (_hasUnsavedChanges) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// Init calendar close-on-click-outside
calendarPicker.init();

// ── Custom PPE sub-items (1.1) ──
let ppeSubItemCounter = 0;

function addPpeSubItem() {
  ppeSubItemCounter++;
  const id = 'ppe-custom-sub-' + ppeSubItemCounter;
  const container = document.getElementById('ppe-custom-subitems-list');
  const entry = document.createElement('div');
  entry.className = 'ppe-custom-sub-entry';
  entry.id = id;
  entry.style.cssText = 'display:flex;align-items:start;gap:8px;margin-bottom:10px;padding:8px 10px;background:var(--cream);border:1px solid var(--border);border-radius:7px;';
  entry.innerHTML = `
    <div style="flex:1;display:flex;gap:10px;align-items:end;flex-wrap:wrap;">
      <div class="field-group" style="flex:1;min-width:140px;margin-bottom:0;">
        <label style="font-size:12px;">Asset Type</label>
        <input type="text" class="ppe-csub-label" placeholder="e.g. Solar Panels" oninput="liveUpdate()">
      </div>
      <div class="field-group" style="width:130px;margin-bottom:0;">
        <label style="font-size:12px;">Rate</label>
        <input type="text" class="ppe-csub-rate" placeholder="e.g. 20%" oninput="liveUpdate()">
      </div>
    </div>
    <button type="button" class="btn-remove" onclick="removePpeSubItem('${id}')" title="Remove" style="margin-top:22px;">&times;</button>`;
  container.appendChild(entry);
}

function removePpeSubItem(id) {
  document.getElementById(id)?.remove();
  liveUpdate();
}

function getCustomPpeSubItems() {
  const entries = document.querySelectorAll('.ppe-custom-sub-entry');
  const result = [];
  entries.forEach(entry => {
    const label = entry.querySelector('.ppe-csub-label')?.value.trim();
    const rate = entry.querySelector('.ppe-csub-rate')?.value.trim();
    if (label) {
      result.push({ label: label, rate: rate || '' });
    }
  });
  return result;
}

// ── Custom accounting policies ──
let customPolicyCounter = 0;

function addCustomPolicy() {
  customPolicyCounter++;
  const id = 'custom-pol-' + customPolicyCounter;
  const container = document.getElementById('custom-policies-list');
  const entry = document.createElement('div');
  entry.className = 'custom-policy-entry';
  entry.id = id;
  entry.innerHTML = `
    <div style="display:flex;align-items:start;gap:8px;">
      <div style="flex:1;">
        <div style="display:flex;gap:10px;align-items:end;margin-bottom:8px;">
          <div class="field-group" style="flex:1;margin-bottom:0;">
            <label>Policy Heading</label>
            <input type="text" class="cp-heading" placeholder="e.g. Revenue Recognition" oninput="liveUpdate()">
          </div>
          <div class="field-group" style="width:120px;margin-bottom:0;">
            <label>Position</label>
            <input type="text" class="cp-position" placeholder="End" oninput="liveUpdate()" title="Type a number (e.g. 3) to insert at that position, or leave blank to add at the end">
          </div>
        </div>
        <div class="field-group" style="margin-bottom:0;">
          <label>Policy Content</label>
          <textarea class="cp-content" rows="3" placeholder="Describe the accounting policy..." oninput="liveUpdate()"></textarea>
        </div>
      </div>
      <button type="button" class="btn-remove" onclick="removeCustomPolicy('${id}')" title="Remove" style="margin-top:22px;">×</button>
    </div>`;
  container.appendChild(entry);
}

function removeCustomPolicy(id) {
  document.getElementById(id)?.remove();
  liveUpdate();
}

function getCustomPolicies() {
  const entries = document.querySelectorAll('.custom-policy-entry');
  const result = [];
  entries.forEach(entry => {
    const heading = entry.querySelector('.cp-heading')?.value.trim();
    const content = entry.querySelector('.cp-content')?.value.trim();
    const posRaw = entry.querySelector('.cp-position')?.value.trim();
    const position = posRaw ? parseFloat(posRaw) : null;
    if (heading || content) {
      result.push({
        id: entry.id,
        heading: heading || 'Custom Policy',
        content: content || '',
        position: position,
        // What the user actually typed. "1.10" and "1.1" are the same float
        // but different display numbers, so the generator resolves the slot
        // from this string and only falls back to the float for saved
        // businesses written before it existed.
        positionRaw: posRaw || ''
      });
    }
  });
  return result;
}

// ── Policy inline editing ──
// Convention: the edit textarea holds plain text with \n line breaks; the
// display div and the generated document hold HTML with <br> line breaks.
function policyHtmlToText(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = npoOrgSlotsToToken(html || '').replace(/<br\s*\/?>/gi, '\n');
  return tmp.textContent;
}

function policyTextToHtml(text) {
  const tmp = document.createElement('div');
  tmp.textContent = text || '';
  return tmp.innerHTML.replace(/\n/g, '<br>');
}

function togglePolicyEdit(policyId) {
  const display = document.getElementById('policy-text-' + policyId);
  const editor = document.getElementById('policy-edit-' + policyId);
  if (!display || !editor) return;
  const isEditing = editor.style.display !== 'none';
  if (isEditing) {
    display.innerHTML = policyTextToHtml(editor.value);
    display.style.display = '';
    editor.style.display = 'none';
  } else {
    editor.value = policyHtmlToText(display.innerHTML);
    display.style.display = 'none';
    editor.style.display = '';
    editor.focus();
  }
}

function getPolicyText(policyId) {
  const editor = document.getElementById('policy-edit-' + policyId);
  const display = document.getElementById('policy-text-' + policyId);
  if (editor && editor.style.display !== 'none') return policyTextToHtml(editor.value);
  if (display) return npoOrgSlotsToToken(display.innerHTML);
  return null;
}

// ── NPO variables chosen in place ──
// The NPO policies show their variables as controls sitting exactly where the
// token is in the policy text: [NPO_ORG] ("organisation" / "club" / "centre") and
// [NPO_DEPT_OF] ("Social Development" / "Education") as dropdowns, [NPO_DEPT]
// ("Mpumalanga Department", free text) as a text box. Each control is a
// mirror: the real field is the hidden one in the NPO block, which save/load
// and the generator read. Every reader of the policy text (getPolicyText,
// policyHtmlToText) turns the mirror back into its token.
// (A function, not a top-level const: the checklist is built further up this
// file, before a const here would be initialised.)
function _npoInlineVars() {
  return [
    { token: '[NPO_ORG]', field: 'npoOrgName', options: NPO_ORG_OPTIONS, title: 'How the NPO is described' },
    { token: '[NPO_DEPT_OF]', field: 'npoDeptOf', options: NPO_DEPT_OF_OPTIONS, title: 'Department of' },
    { token: '[NPO_DEPT]', field: 'npoDeptName', title: 'Department (e.g. Mpumalanga Department)' },
    { token: '[PPE_STMT]', field: 'ppeStmtName', options: PPE_STMT_OPTIONS, title: 'Statement of' },
  ];
}

// The control carries its token's name without the brackets ("NPO_ORG", not
// "[NPO_ORG]"): with the brackets the swapped-in control held the very token
// the watcher looks for, so it swapped again inside its own attribute and the
// policy text came out as mangled markup (4.75.0 – 4.77.0).
function npoOrgSlotsToToken(html) {
  return (html || '')
    .replace(/<select[^>]*\bdata-npo-token="([^"]+)"[^>]*>[\s\S]*?<\/select>/gi, '[$1]')
    .replace(/<input[^>]*\bdata-npo-token="([^"]+)"[^>]*>/gi, '[$1]');
}

function _npoSlotHtml(v) {
  const real = document.getElementById(v.field);
  const value = real ? real.value : '';
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const attrs = `class="npo-org-inline" data-npo-token="${v.token.slice(1, -1)}" data-npo-field="${v.field}" title="${v.title}"`;
  if (v.options) {
    const opts = v.options
      .map(o => `<option value="${esc(o)}"${o === value ? ' selected' : ''}>${esc(o)}</option>`).join('');
    return `<select ${attrs} onchange="onNpoOrgInline(this)">${opts}</select>`;
  }
  return `<input type="text" ${attrs} value="${esc(value)}" size="${Math.max(value.length, 8)}" oninput="onNpoOrgInline(this)">`;
}

// Whenever the display's text is (re)written, swap each token for its
// control. The swap itself leaves no token behind, so it does not loop.
function watchNpoOrgSlots(display) {
  if (!display) return;
  const fill = () => {
    let html = display.innerHTML;
    const vars = _npoInlineVars().filter(v => html.includes(v.token));
    if (!vars.length) return;
    vars.forEach(v => { html = html.split(v.token).join(_npoSlotHtml(v)); });
    display.innerHTML = html;
  };
  new MutationObserver(fill).observe(display, { childList: true, subtree: true });
  fill();
}

function onNpoOrgInline(el) {
  const real = document.getElementById(el.dataset.npoField);
  if (real) real.value = el.value;
  if (el.tagName === 'INPUT') el.size = Math.max(el.value.length, 8);
  syncNpoOrgSlots();
  liveUpdate();
}

// Bring every mirror back in step with its real field (after a load or draft
// restore sets the hidden field directly) — the in-text controls and the
// Step 4 "organisation, club or centre" picker.
function syncNpoOrgSlots() {
  document.querySelectorAll('.npo-org-inline[data-npo-field], .npo-org-pick[data-npo-field]').forEach(el => {
    const real = document.getElementById(el.dataset.npoField);
    if (!real || el.value === real.value) return;
    el.value = real.value;
    if (el.tagName === 'INPUT') el.size = Math.max(el.value.length, 8);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// GLOBAL WRAPPERS — bridge inline onclick/onchange handlers to class instances
// ══════════════════════════════════════════════════════════════════════════════

// EntityManager — entity switching & form controls
function selectEntity(el, type) {
  // Clicking the one visible (already selected) card just expands the list again —
  // it does not re-run the entity switch, so no form state is touched.
  const grid = el.closest('.entity-grid');
  if (grid && grid.classList.contains('collapsed') && el.classList.contains('selected')) {
    grid.classList.remove('collapsed');
    return;
  }
  entityManager.selectEntity(el, type);
  // Open the live preview straight away so the user sees the document build up as
  // they fill in the form — no need to press Generate first. Honoured only when
  // Live Preview is enabled in Settings.
  generateAndPreview();
}
function toggleAttReg()                { entityManager.toggleAttReg(); }
function autoFillPrevYear()            { entityManager.autoFillPrevYear(); }
function updateBank()                  { entityManager.updateBank(); }
function updateShareCapital()         { entityManager.updateShareCapital(); }
function updateDividend()              { entityManager.updateDividend(); }
function updateParent()                { entityManager.updateParent(); }
function updateGroupCo()               { entityManager.updateGroupCo(); }
function onTradingAsToggle()           { entityManager.onTradingAsToggle(); }
function onSecondIndividualToggle(scrollIntoView) { entityManager.onSecondIndividualToggle(scrollIntoView); }
function onIndividualStatementTypeChange() { entityManager.onIndividualStatementTypeChange(); }
function onNpcBodyChange()             { entityManager.onNpcBodyChange(); }
function onNpoBodyChange()             { entityManager.onNpoBodyChange(); }
function onPpraChange()                { entityManager.onPpraChange(); }
function addAdditionalIndividual()     { entityManager.addAdditionalIndividual(); }
function removeAdditionalIndividual(i) { entityManager.removeAdditionalIndividual(i); }
function onCompilerSignerChange()      { entityManager.onCompilerSignerChange(); }

// EntityManager — directors, shareholders, loan certs
function addDirector()                 { entityManager.addDirector(); }
function moveDirector(id, direction)   { entityManager.moveDirector(id, direction); }
function removeDirector(id)            { entityManager.removeDirector(id); }
function toggleIndependentTrustee(id)   { entityManager.toggleIndependentTrustee(id); }
function toggleIndTrusteeType(id)      { entityManager.toggleIndTrusteeType(id); }
function toggleDirBoardRep(id)         { entityManager.toggleDirBoardRep(id); }
function addShareholder()              { entityManager.addShareholder(); }
function removeShareholder(idx)        { entityManager.removeShareholder(idx); }
function onShareholderTypeChange(idx)  { entityManager.onShareholderTypeChange(idx); }
function addLoanCert()                 { entityManager.addLoanCert(); }
function removeLoanCert(idx)           { entityManager.removeLoanCert(idx); }
// Parse the Step 5 Postal Address ("street, city, postal number") into its
// parts. The postal number (a trailing all-digit part) is dropped; whatever is
// left ends in the city, with the street being everything before it. Returns
// null when the field is blank. The loan-cert "place of signing" and the Step 8
// minutes Meeting Place derive their town from here; the Step 6 AGM venues use
// the Registered Address instead.
function parsePostalAddress() {
  return splitAddress(document.getElementById('postalAddress')?.value || '');
}

// Split a free-typed address into { street, city }: comma-separated, trailing
// postal code dropped, last remaining part treated as the town/city.
function splitAddress(raw) {
  raw = (raw || '').trim();
  if (!raw) return null;
  const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
  if (!parts.length) return null;
  if (parts.length > 1 && /^\d[\d\s]*$/.test(parts[parts.length - 1])) parts.pop(); // drop postal code
  const city = parts.length ? parts[parts.length - 1] : '';
  const street = parts.slice(0, -1).join(', ');
  return { street, city };
}

// The town/city for the loan-cert "place of signing", from the Postal Address.
// Falls back to DUMMYVILLE (the firm's town) when no address is entered yet.
function loanCertAutoCity() {
  const p = parsePostalAddress();
  return (p && p.city) ? p.city.toUpperCase() : 'DUMMYVILLE';
}

// The auto-fill value for a loan-cert Date Signed field: "<CITY>, <Date of Issue>".
// Empty if the Date of Issue hasn't been entered yet.
function loanCertAutoDateValue() {
  const doi = (document.getElementById('dateOfIssue')?.value || '').trim();
  return doi ? loanCertAutoCity() + ', ' + doi.toUpperCase() : '';
}

// Push the current Date of Issue into every loan-cert date field that is still on
// auto (i.e. the user hasn't typed their own value into it). Called whenever the
// Date of Issue changes.
function syncAutoLoanCertDates() {
  const val = loanCertAutoDateValue();
  if (!val) return;
  document.querySelectorAll('#loan-cert-list input[id^="lc-date-"][data-auto="1"]').forEach(f => {
    f.value = val;
  });
}

// The user typed into a loan-cert date field — they now own it, so stop
// auto-tracking the Date of Issue for this field.
function onLoanCertDateInput(idx) {
  const field = document.getElementById(`lc-date-${idx}`);
  if (field) field.removeAttribute('data-auto');
  liveUpdate();
}

// Date of Issue changed by the user — it no longer tracks the approval date.
// Clearing the field hands it back to auto-tracking (and immediately refills it
// from the approval date), so a user who deletes the pre-filled value isn't left
// with a permanently blank field that the hint still claims is auto-filled.
// Re-sync any auto loan-cert dates + meeting dates, then live update.
function onDateOfIssueChange() {
  const el = document.getElementById('dateOfIssue');
  if (el && !el.value.trim()) {
    el.dataset.auto = '1';
    syncAutoSigningDates();
  } else {
    el?.removeAttribute('data-auto');
  }
  syncAutoLoanCertDates();
  syncAutoMeetingDates();
  liveUpdate();
}

// ── The three signing dates all default to one date ────────────────────────
// In practice the statements are approved, signed by the compiler and issued on
// the same day, so "Date Financial Statements Approved" is the master: the
// "Date Signed by Compiler" (dotted format) and the cover page's "Date of
// Issue" (long format) follow it while they still carry data-auto="1". Typing
// or calendar-picking either one drops the flag and that field is then the
// user's own — same pattern as the loan-cert and meeting dates.

// The approval date as entered (e.g. "19 January 2025"). Empty if blank.
function dateApprovedValue() {
  return (document.getElementById('dateApproved')?.value || '').trim();
}

// Push the approval date into the compiler-signed and issue dates while they
// are still on auto, converting to each field's own format.
function syncAutoSigningDates() {
  const val = dateApprovedValue();
  if (!val) return;
  const d = calendarPicker.parseCalDate(val);

  const signed = document.getElementById('dateSigned');
  if (signed && signed.dataset.auto === '1') {
    signed.value = d ? calendarPicker.formatCalDate(d, 'dotted') : val;
  }
  const issue = document.getElementById('dateOfIssue');
  if (issue && issue.dataset.auto === '1') {
    issue.value = d ? calendarPicker.formatCalDate(d, 'long') : val;
  }
}

// The user set the compiler-signed date themselves — stop tracking approval.
// Clearing it hands the field back to auto-tracking (see onDateOfIssueChange).
function onDateSignedInput() {
  const el = document.getElementById('dateSigned');
  if (el && !el.value.trim()) {
    el.dataset.auto = '1';
    syncAutoSigningDates();
  } else {
    el?.removeAttribute('data-auto');
  }
  liveUpdate();
}

// Date Financial Statements Approved changed — push it into the two dates that
// track it, re-sync everything downstream of the Date of Issue (loan-cert and
// AGM dates), re-sync the Step 8 minutes dates, then live update.
function onDateApprovedChange() {
  syncAutoSigningDates();
  syncAutoLoanCertDates();
  syncAutoMeetingDates();
  liveUpdate();
}

// ── Meeting venues: auto-track the Registered Address ───────────
// The "held at ____" venue fields pre-populate from the Step 5 Registered /
// Physical Address (street + city, postal code dropped) but stay editable: as
// soon as the user types their own value the field drops its data-auto flag and
// stops tracking. Same pattern as the meeting dates.
// The Step 6 body-corporate AGM venue takes the full street + city from the
// Registered Address — a body corporate AGM happens at the scheme's
// physical place, and a PO Box is not somewhere anyone can sit down.
// The Step 6 trust meeting venue takes the town from the Postal Address (street
// and postal code dropped), falling back to the Registered Address town
// when no postal address has been entered. A trust's meeting is minuted in the town
// the trust corresponds from — the same source the trust's loan certificates use
// for their place of signing, so the two never disagree on the same document.
// The Step 8 minutes "Meeting Place" is a town name only, and it comes from the
// Postal Address too: that field reads "PO Box 123, Dummyville, 0001", and
// the town in the middle of it is the one the minutes must record ("Dummyville").
const MEETING_VENUE_FIELDS = ['bcAGMVenue'];
const TRUST_VENUE_FIELDS   = ['trustAGMVenue'];
const MINUTES_VENUE_FIELDS = ['minutes-venue', 'cc-minutes-venue'];

// Split the Registered Address into { street, city }, dropping a
// trailing postal code. Null when the field is empty.
function parseRegAddress() {
  return splitAddress(document.getElementById('regAddress')?.value || '');
}

// "street, City" from the Registered Address. Empty if no address entered yet.
function meetingAutoVenueValue() {
  const p = parseRegAddress();
  if (!p) return '';
  return [p.street, p.city].filter(Boolean).join(', ');
}

// Town only from the Postal Address, for the Step 6 trust meeting venue: the
// minutes record the town the trust met in, not the street it corresponds from.
// Falls back to the Registered Address town when no postal address has
// been entered. Empty only when neither address is filled in.
function trustAutoVenueValue() {
  const p = parsePostalAddress();
  const reg = parseRegAddress();
  return (p && p.city) || (reg && reg.city) || '';
}

// Town only from the Postal Address ("PO Box 123, Dummyville, 0001" →
// "Dummyville"), for the Step 8 minutes Meeting Place.
function minutesAutoVenueValue() {
  const p = parsePostalAddress();
  return (p && p.city) ? p.city : '';
}

// Push the current venues into every venue field still on auto (Step 6 gets a
// full address — registered for the body corporate, postal for the trust — and
// the Step 8 minutes get the city only).
function syncAutoMeetingVenues() {
  const full = meetingAutoVenueValue();
  if (full) {
    MEETING_VENUE_FIELDS.forEach(id => {
      const f = document.getElementById(id);
      if (f && f.dataset.auto === '1') f.value = full;
    });
  }
  const trustVenue = trustAutoVenueValue();
  if (trustVenue) {
    TRUST_VENUE_FIELDS.forEach(id => {
      const f = document.getElementById(id);
      if (f && f.dataset.auto === '1') f.value = trustVenue;
    });
  }
  const city = minutesAutoVenueValue();
  if (city) {
    MINUTES_VENUE_FIELDS.forEach(id => {
      const f = document.getElementById(id);
      if (f && f.dataset.auto === '1') f.value = city;
    });
  }
}

// The user set this meeting-venue field themselves — stop tracking the address.
function onMeetingVenueInput(id) {
  const f = document.getElementById(id);
  if (f) f.removeAttribute('data-auto');
  liveUpdate();
}

// Postal Address changed — re-sync the loan-cert cities, the Step 6 trust meeting
// venue and the Step 8 minutes Meeting Place (all of which come from it), then
// live update.
function onPostalAddressChange() {
  syncAutoLoanCertDates();
  syncAutoMeetingVenues();
  liveUpdate();
}

// Registered Address changed — re-sync the Step 6 body-corporate AGM
// venue (an AGM is held at a physical address, not a PO Box), plus the trust
// venue while it is still falling back to this field, then live update.
function onRegAddressChange() {
  syncAutoMeetingVenues();
  liveUpdate();
}

// ── Meeting / AGM minutes dates: auto-track the Date of Issue ──────────────
// The AGM / minutes date fields pre-populate from the Date of Issue but stay
// editable: as soon as the user types (or calendar-picks) their own value the
// field drops its data-auto flag and stops tracking. Same idea as loan certs,
// but the fields are static (in index.html) rather than dynamically built.
// Step 6 AGM dates track the Date of Issue; the Step 8 minutes record the
// meeting where the financial statements were approved, so they track the
// "Date Financial Statements Approved" instead. So does the trust resolution
// date (Step 6), which is normally the day the statements were approved.
const MEETING_DATE_FIELDS = ['bcAGMDate', 'trustAGMDate'];
const MINUTES_DATE_FIELDS = ['minutes-date', 'cc-minutes-date', 'trustResolutionDate'];

// The plain long-date value to seed a Step 6 AGM date with: the Date of Issue
// as entered (e.g. "2 February 2026"). Empty if the Date of Issue is blank.
function meetingAutoDateValue() {
  return (document.getElementById('dateOfIssue')?.value || '').trim();
}

// The Step 8 minutes date: the "Date Financial Statements Approved" as entered.
// Empty if that field is blank.
function minutesAutoDateValue() {
  return (document.getElementById('dateApproved')?.value || '').trim();
}

// Push the current auto dates into every meeting-date field still on auto.
function syncAutoMeetingDates() {
  const meetVal = meetingAutoDateValue();
  if (meetVal) {
    MEETING_DATE_FIELDS.forEach(id => {
      const f = document.getElementById(id);
      if (f && f.dataset.auto === '1') f.value = meetVal;
    });
  }
  const minVal = minutesAutoDateValue();
  if (minVal) {
    MINUTES_DATE_FIELDS.forEach(id => {
      const f = document.getElementById(id);
      if (f && f.dataset.auto === '1') f.value = minVal;
    });
  }
}

// The user set this meeting-date field themselves — stop tracking Date of Issue.
function onMeetingDateInput(id) {
  const f = document.getElementById(id);
  if (f) f.removeAttribute('data-auto');
  liveUpdate();
}

// ── Trust resolution: the representative trustee ──────────────────────────
// Item 3 of the trust resolution designates the trustee who represents the
// trust as director of related parties. That is nearly always one person, so
// the user picks them here. The choice is kept by name in the hidden
// #trustResolutionRep (saved with the form); the select is rebuilt from the
// signing trustees (independent trustees excluded) whenever the form changes.
// "__all__" keeps the old wording that names every signing trustee.
function refreshTrustResolutionRepOptions() {
  const sel = document.getElementById('sel-trustResolutionRep');
  const store = document.getElementById('trustResolutionRep');
  if (!sel || !store || typeof entityManager === 'undefined') return;
  if (entityManager.currentEntityType !== 'trust') return;
  const names = entityManager.getDirectors().filter(d => !d.isIndTrustee).map(d => d.full);
  const saved = store.value;
  const opts = [['', '— Select a trustee —'], ...names.map(n => [n, n])];
  if (names.length > 1) opts.push(['__all__', 'All trustees']);
  // A saved name no longer in the list (trustee renamed or removed) stays
  // visible so the user can see what the page is waiting for.
  if (saved && saved !== '__all__' && !names.includes(saved)) opts.push([saved, `${saved} (not in Trustees)`]);
  const sig = JSON.stringify(opts);
  if (sel.dataset.sig !== sig) {
    sel.innerHTML = '';
    opts.forEach(([v, t]) => {
      const o = document.createElement('option');
      o.value = v; o.textContent = t;
      sel.appendChild(o);
    });
    sel.dataset.sig = sig;
  }
  sel.value = opts.some(([v]) => v === saved) ? saved : '';
}

function onTrustResolutionRepChange() {
  const sel = document.getElementById('sel-trustResolutionRep');
  const store = document.getElementById('trustResolutionRep');
  if (sel && store) store.value = sel.value;
  liveUpdate();
}

// EntityManager — report type & sub-option handlers
function onReportTypeChange()          { entityManager.onReportTypeChange(); }
function onReportTypePicked()          { entityManager.onReportTypePicked(); }
function onAuditTypeChange()           { entityManager.onAuditTypeChange(); }
function onSchoolAuditTypeChange()     { entityManager.onSchoolAuditTypeChange(); }
function onAttOpinionTypeChange()      { entityManager.onAttOpinionTypeChange(); }
function onReviewTypeChange()          { entityManager.onReviewTypeChange(); }
function onReviewQualifiedBasisChange(){ entityManager.onReviewQualifiedBasisChange(); }
function onReviewTrustAmountsInput()   { entityManager.onReviewTrustAmountsInput(); }
function onCompilationTypeChange()     { entityManager.onCompilationTypeChange(); }

// EntityManager — preparer & school preparer
function updatePreparerPreview()           { entityManager.updatePreparerPreview(); }
function onPreparerCapacityChange()        { entityManager.onPreparerCapacityChange(); }
function selectPreparerQuick()              { entityManager.selectPreparerQuick(); }
function updateSchoolPreparerPreview()     { entityManager.updateSchoolPreparerPreview(); }
function onSchoolPreparerCapacityChange()  { entityManager.onSchoolPreparerCapacityChange(); }

// EntityManager — engagement letter
function toggleEngagementTypes()       { entityManager.toggleEngagementTypes(); }
function onEngagementTypesChange()     { entityManager.onEngagementTypesChange(); }
function onEngagementSignerChange(selectId) { entityManager.onEngagementSignerChange(selectId); }

// EntityManager — body corporate & trust
function onBcEventsChange()            { entityManager.onBcEventsChange(); }
function onBcMgmtRulesChange()         { entityManager.onBcMgmtRulesChange(); }
function onTrustDeedChange()           { entityManager.onTrustDeedChange(); }
function onTrustResolutionLetterChange() { entityManager.onTrustResolutionLetterChange(); }
function onTrustBankAcctChange() { entityManager.onTrustBankAcctChange(); }

// Church Step 7 toggle
function toggleChurchStep7() {
  const hide = document.querySelector('input[name="churchPolicies"]:checked')?.value === 'no';
  document.getElementById('step7-block').style.display = hide ? 'none' : '';
  document.getElementById('step7-divider').style.display = hide ? 'none' : '';
}

// EntityManager — accounting policies
function selectAllPolicies(checked)    { entityManager.selectAllPolicies(checked); }
function togglePolicy(id)              { entityManager.togglePolicy(id); }
function onSubItemChange(sid)          { entityManager.onSubItemChange(sid); }
function onPolicyTextOption(id)        { entityManager.onPolicyTextOption(id); }
function onRateSelect(sid)             { entityManager.onRateSelect(sid); }
function onPpeResidualToggle()         { entityManager.onPpeResidualToggle(); }
function onPpeDepreciationToggle()   { entityManager.onPpeDepreciationToggle(); }

// CalendarPicker
function toggleCal(calId)              { calendarPicker.toggleCal(calId); }

// PreviewManager
function printDocument()               { previewManager.printDocument(); }
function editWithILoveINF181()            { previewManager.editWithILoveINF181(); }

// OrganiseManager
function toggleOrganise()              { OrganiseManager.toggle(); }
function downloadOrderReport()         { OrganiseManager.downloadOrderReport(); }
function resetOrganise()               { OrganiseManager.resetOverrides(); }
function closeILoveINF181()               { previewManager.closeILoveINF181(); }

// Open I Love INF181 standalone — no generated document, no hand-off. The editor
// falls through to its own upload box so users can open/organise any PDF.
// Reuses the same overlay; if the editor was closed with work in it, the user
// is asked whether to return to that or start a new one.
function openILoveINF181() {
  previewManager.openEditor('ILoveINF181', new URL('ILoveINF181/index.html', window.location.href).href);
}

// Start panel (the empty preview side) — hand whatever the user typed to the
// ClientReg dialog so the search is already run by the time it opens.
function startClientRegSearch() {
  const input = document.getElementById('start-clientreg-input');
  const query = input ? input.value.trim() : '';
  ClientRegSearch.open(query);
}

// ExcelImporter
function importClientReg(input)          { excelImporter.importClientReg(input); }

// BusinessInfoManager
function saveBusinessInfo()            { businessInfoManager.saveToDatabase(); }
function openFileExplorer()            { fileExplorer.open(); }

// ── Auto-save ──
let _autoSaveTimer = null;
function toggleAutoSave() {
  const active = _autoSaveTimer != null;
  if (active) {
    clearInterval(_autoSaveTimer);
    _autoSaveTimer = null;
    localStorage.setItem('policygenAutoSave', '0');
  } else {
    _autoSaveTimer = setInterval(() => _autoSaveTick(), 60000);
    localStorage.setItem('policygenAutoSave', '1');
  }
  _updateAutoSaveButton();
}
function _updateAutoSaveButton() {
  const btn = document.getElementById('btn-autosave');
  if (btn) btn.classList.toggle('autosave-active', _autoSaveTimer != null);
}
async function _autoSaveTick() {
  if (DataStore.isOffline()) return;
  try {
    await businessInfoManager.silentSave();
  } catch (_) { /* swallow — no notification */ }
}
// Restore auto-save state from previous session
if (localStorage.getItem('policygenAutoSave') === '1') {
  _autoSaveTimer = setInterval(() => _autoSaveTick(), 60000);
  _updateAutoSaveButton();
}

// ── Admin panel ── opened from Settings → Administration → Admin Panel
// (AdminPanel.open() shows the password prompt). The old secret Shift + :
// shortcut was removed when the panel moved into Settings.
