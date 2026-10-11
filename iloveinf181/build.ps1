# Build script: reads base64 asset files and injects them into index.html
# The letterhead PDFs contain both header + footer as full-page overlays

$auditLhPdf = (Get-Content "$PSScriptRoot\temp_audit_lh.txt" -Raw).Trim()
$caLhPdf    = (Get-Content "$PSScriptRoot\temp_ca_lh.txt" -Raw).Trim()
$auditLhPng = (Get-Content "$PSScriptRoot\temp_audit_lh_png.txt" -Raw).Trim()
$caLhPng    = (Get-Content "$PSScriptRoot\temp_ca_lh_png.txt" -Raw).Trim()

$html = Get-Content "$PSScriptRoot\index.html" -Raw

# Insert the letterhead assets JS block right before the closing </body> tag
# We add it as a module script that sets window globals before the main script runs

$assetsBlock = @"
<script type="module" id="letterhead-assets">
// Embedded letterhead PDF assets (base64)
window.__LH_ASSETS__ = {
  audit: {
    name: 'INF181 Audit Group',
    pdfBase64: '$auditLhPdf',
    previewPng: 'data:image/png;base64,$auditLhPng',
  },
  ca: {
    name: 'INF181 Group Project',
    pdfBase64: '$caLhPdf',
    previewPng: 'data:image/png;base64,$caLhPng',
  }
};
</script>
"@

# Insert the assets block right before the first <script tag
$html = $html -replace '(<!-- pdf\.js & pdf-lib from CDN -->)', "$assetsBlock`n  `$1"

# Now inject the letterhead UI into the toolbar (after the Reset button)
$lhToolbarButton = @'
      <div class="separator"></div>
      <button class="btn" id="btnLetterhead" disabled>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/></svg>
        Letterhead
      </button>
'@
$html = $html -replace '(<button class="btn" id="btnReset">Reset</button>)', "`$1`n$lhToolbarButton"

# Add letterhead modal HTML before the toast div
$lhModal = @'
  <!-- Letterhead picker modal -->
  <div class="modal-overlay" id="lhModal">
    <div style="background:var(--surface);border-radius:var(--radius);padding:28px 32px;max-width:520px;width:100%;position:relative;">
      <button class="modal-close" id="lhModalClose" style="top:8px;right:12px;">&times;</button>
      <h3 style="font-size:17px;font-weight:700;margin-bottom:6px;">Apply Letterhead</h3>
      <p style="font-size:13px;color:var(--text-muted);margin-bottom:18px;">Choose a letterhead to apply to selected pages. The letterhead (header + footer) will be merged as a background layer.</p>
      <div style="display:flex;gap:16px;margin-bottom:20px;" id="lhChoices">
        <label class="lh-choice" data-lh="audit" style="flex:1;cursor:pointer;border:2px solid var(--border);border-radius:var(--radius-sm);overflow:hidden;transition:border-color 0.15s;">
          <img id="lhPreviewAudit" style="width:100%;display:block;background:#fff;" alt="Audit Inc.">
          <div style="padding:8px 10px;font-size:12px;font-weight:600;text-align:center;">INF181 Audit Group</div>
        </label>
        <label class="lh-choice" data-lh="ca" style="flex:1;cursor:pointer;border:2px solid var(--border);border-radius:var(--radius-sm);overflow:hidden;transition:border-color 0.15s;">
          <img id="lhPreviewCA" style="width:100%;display:block;background:#fff;" alt="INF181 CA">
          <div style="padding:8px 10px;font-size:12px;font-weight:600;text-align:center;">INF181 Group Project</div>
        </label>
      </div>
      <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;">
        <label style="font-size:13px;display:flex;align-items:center;gap:6px;">
          <span>Apply to:</span>
          <select id="lhApplyMode" style="padding:6px 10px;border-radius:6px;border:1px solid var(--border);background:var(--surface-hover);color:var(--text);font-size:13px;">
            <option value="selected">Selected pages only</option>
            <option value="all">All pages</option>
            <option value="first">First page only</option>
            <option value="allExceptFirst">All except first</option>
          </select>
        </label>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;">
        <button class="btn" id="lhCancel">Cancel</button>
        <button class="btn btn-primary" id="lhApply" disabled>Apply Letterhead</button>
      </div>
    </div>
  </div>
'@
$html = $html -replace '(<!-- Toast -->)', "$lhModal`n`n  `$1"

# Add CSS for letterhead choice highlighting
$lhCss = @'

    /* ── Letterhead modal ── */
    .lh-choice:hover { border-color: var(--accent) !important; }
    .lh-choice.active { border-color: var(--accent) !important; box-shadow: 0 0 0 3px var(--accent-glow); }
    .lh-badge {
      position: absolute;
      bottom: 34px;
      left: 8px;
      font-size: 9px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      background: var(--accent);
      color: #fff;
      z-index: 5;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
'@
$html = $html -replace '(/\* ── Scrollbar ── \*/)', "$lhCss`n`n    `$1"

# Now inject the letterhead JS logic into the main script, right before the closing </script>
$lhJs = @'

    // ─── Letterhead Feature ───
    const lhAssets = window.__LH_ASSETS__ || {};
    let selectedLh = null; // 'audit' or 'ca'

    // Populate preview images
    if (lhAssets.audit) document.getElementById('lhPreviewAudit').src = lhAssets.audit.previewPng;
    if (lhAssets.ca) document.getElementById('lhPreviewCA').src = lhAssets.ca.previewPng;

    const lhModal = document.getElementById('lhModal');
    const btnLetterhead = document.getElementById('btnLetterhead');
    const lhApplyBtn = document.getElementById('lhApply');
    const lhApplyMode = document.getElementById('lhApplyMode');

    // Enable letterhead button when pages are selected
    const origUpdateSelectionUI = updateSelectionUI;
    updateSelectionUI = function() {
      origUpdateSelectionUI();
      btnLetterhead.disabled = selectedIds.size === 0 && pages.length === 0;
    };

    // Also enable after load
    const origLoadPdf2 = loadPdf;
    loadPdf = async function(file) {
      await origLoadPdf2(file);
      btnLetterhead.disabled = false;
    };

    btnLetterhead.addEventListener('click', () => {
      selectedLh = null;
      document.querySelectorAll('.lh-choice').forEach(c => c.classList.remove('active'));
      lhApplyBtn.disabled = true;
      lhModal.classList.add('active');
    });

    document.getElementById('lhModalClose').addEventListener('click', () => lhModal.classList.remove('active'));
    document.getElementById('lhCancel').addEventListener('click', () => lhModal.classList.remove('active'));
    lhModal.addEventListener('click', (e) => { if (e.target === lhModal) lhModal.classList.remove('active'); });

    document.querySelectorAll('.lh-choice').forEach(choice => {
      choice.addEventListener('click', () => {
        document.querySelectorAll('.lh-choice').forEach(c => c.classList.remove('active'));
        choice.classList.add('active');
        selectedLh = choice.dataset.lh;
        lhApplyBtn.disabled = false;
      });
    });

    lhApplyBtn.addEventListener('click', async () => {
      if (!selectedLh || !lhAssets[selectedLh]) return;
      lhModal.classList.remove('active');

      const mode = lhApplyMode.value;
      let targetIds;
      if (mode === 'all') {
        targetIds = new Set(pages.map(p => p.id));
      } else if (mode === 'first') {
        targetIds = new Set(pages.length > 0 ? [pages[0].id] : []);
      } else if (mode === 'allExceptFirst') {
        targetIds = new Set(pages.slice(1).map(p => p.id));
      } else {
        targetIds = new Set(selectedIds);
      }

      if (targetIds.size === 0) {
        showToast('No pages to apply letterhead to');
        return;
      }

      saveHistory();
      showToast('Applying letterhead...');

      try {
        const lhPdfBytes = Uint8Array.from(atob(lhAssets[selectedLh].pdfBase64), c => c.charCodeAt(0));
        const lhDoc = await PDFDocument.load(lhPdfBytes);

        for (const page of pages) {
          if (!targetIds.has(page.id)) continue;

          const srcDoc = await PDFDocument.load(page.pdfBytes);
          const outputDoc = await PDFDocument.create();

          const [lhPage] = await outputDoc.copyPages(lhDoc, [0]);
          const [contentPage] = await outputDoc.copyPages(srcDoc, [page.pageIndex]);

          const lhRef = outputDoc.addPage(lhPage);
          const embedded = await outputDoc.embedPage(contentPage);
          lhRef.drawPage(embedded);

          const mergedBytes = await outputDoc.save();
          page.pdfBytes = new Uint8Array(mergedBytes);
          page.pageIndex = 0;
          page.letterhead = selectedLh;
        }

        renderGrid();
        showToast(`Letterhead applied to ${targetIds.size} page(s)`);
      } catch (err) {
        console.error('Letterhead error:', err);
        showToast('Error applying letterhead');
      }
    });
'@
$html = $html -replace '(\s*</script>\s*</body>)', "$lhJs`$1"

# Write the final built file
$outputPath = "$PSScriptRoot\ILoveINF181.html"
[System.IO.File]::WriteAllText($outputPath, $html, [System.Text.Encoding]::UTF8)
Write-Host "Built: $outputPath"
