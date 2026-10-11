// ══════════════════════════════════════════════════════════════════════════
// PreviewScrollbar — the preview panel's own scroll rail
//
// The preview panel scrolls natively, but its native scrollbar is a 5px hairline
// that auditors kept missing entirely (and on a trackpad it is hidden until you
// already scroll). This gives the preview a real, always-visible scrollbar of its
// own, plus a button on the same rail that blows the preview up to fill the
// screen — the financial statements on their own, with no form beside them.
//
// The rail lives on <body> and is positioned from the panel's bounding rect
// rather than being a child of the panel, so it is unaffected by the panel's own
// scrolling, by #document-output's scale transform, and by anything that wipes
// or re-prepends children of the panel (generateDoc, the pin status bar).
// ══════════════════════════════════════════════════════════════════════════

const PreviewScrollbar = (function () {
  const RAIL_W = 26;      // must match .preview-scrollrail width in styles.css
  const MIN_THUMB = 40;

  let rail = null, track = null, thumb = null, btnFull = null, btnExit = null;
  let dragging = false, dragGrabY = 0, dragThumbTop = 0;
  let frame = 0;

  function panelEl() { return document.querySelector('.preview-panel'); }

  function panelVisible() {
    const p = panelEl();
    if (!p) return false;
    if (document.body.classList.contains('preview-fullscreen')) return true;
    return p.offsetParent !== null && p.getClientRects().length > 0;
  }

  // ── Build ────────────────────────────────────────────────────────────────
  function build() {
    if (rail) return;
    rail = document.createElement('div');
    rail.className = 'preview-scrollrail';
    rail.id = 'preview-scrollrail';
    rail.setAttribute('aria-hidden', 'false');
    rail.innerHTML = `
      <button type="button" class="pscroll-btn" id="btn-preview-fullscreen"
        title="Fullscreen the document preview (Esc to exit)"
        aria-label="Fullscreen the document preview">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"
             stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 3 21 3 21 9"/>
          <polyline points="9 21 3 21 3 15"/>
          <line x1="21" y1="3" x2="14" y2="10"/>
          <line x1="3" y1="21" x2="10" y2="14"/>
        </svg>
      </button>
      <div class="pscroll-track" id="pscroll-track">
        <div class="pscroll-thumb" id="pscroll-thumb" role="scrollbar"
             aria-orientation="vertical" tabindex="0"
             aria-label="Scroll the document preview"></div>
      </div>`;
    document.body.appendChild(rail);

    // Visible way back out of fullscreen. Lives on <body> beside the rail so it
    // is never wiped by a regenerate, and is shown by CSS only in fullscreen.
    btnExit = document.createElement('button');
    btnExit.type = 'button';
    btnExit.className = 'preview-exit-fs';
    btnExit.id = 'btn-exit-preview-fullscreen';
    btnExit.title = 'Exit fullscreen preview';
    btnExit.setAttribute('aria-label', 'Exit fullscreen preview');
    btnExit.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"
           stroke-linecap="round" stroke-linejoin="round">
        <line x1="5" y1="5" x2="19" y2="19"/>
        <line x1="19" y1="5" x2="5" y2="19"/>
      </svg>
      <span>Exit Fullscreen</span>
      <span class="exit-fs-key">Esc</span>`;
    btnExit.addEventListener('click', () => setFullscreen(false));
    document.body.appendChild(btnExit);

    track = rail.querySelector('.pscroll-track');
    thumb = rail.querySelector('.pscroll-thumb');
    btnFull = rail.querySelector('#btn-preview-fullscreen');

    btnFull.addEventListener('click', toggleFullscreen);
    thumb.addEventListener('pointerdown', onThumbDown);
    thumb.addEventListener('keydown', onThumbKey);
    track.addEventListener('pointerdown', onTrackDown);

    const panel = panelEl();
    if (panel) panel.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, { passive: true });

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(schedule);
      if (panel) ro.observe(panel);
      const scaler = document.getElementById('document-scaler');
      if (scaler) ro.observe(scaler);
      ro.observe(document.documentElement);
    }
    if (typeof MutationObserver !== 'undefined') {
      const out = document.getElementById('document-output');
      if (out) new MutationObserver(schedule).observe(out, { childList: true, subtree: false });
    }
  }

  // ── Layout ───────────────────────────────────────────────────────────────
  function schedule() {
    if (frame) return;
    frame = requestAnimationFrame(() => { frame = 0; update(); });
  }

  function update() {
    if (!rail) return;
    const panel = panelEl();
    if (!panel || !panelVisible()) { rail.classList.remove('visible'); return; }

    const r = panel.getBoundingClientRect();
    if (r.height <= 0 || r.width <= 0) { rail.classList.remove('visible'); return; }

    rail.classList.add('visible');
    rail.style.top = r.top + 'px';
    rail.style.height = r.height + 'px';
    rail.style.left = (r.right - RAIL_W - 6) + 'px';

    const view = panel.clientHeight;
    const total = panel.scrollHeight;
    const maxScroll = Math.max(0, total - view);
    const trackH = track.clientHeight;

    if (maxScroll < 1 || trackH <= 0) {
      rail.classList.add('no-scroll');
      thumb.style.height = trackH + 'px';
      thumb.style.transform = 'translateY(0px)';
      return;
    }
    rail.classList.remove('no-scroll');

    const thumbH = Math.max(MIN_THUMB, Math.round(trackH * view / total));
    const travel = trackH - thumbH;
    const top = Math.round((panel.scrollTop / maxScroll) * travel);
    thumb.style.height = thumbH + 'px';
    thumb.style.transform = `translateY(${top}px)`;
    thumb.setAttribute('aria-valuenow', Math.round((panel.scrollTop / maxScroll) * 100));
  }

  // ── Dragging ─────────────────────────────────────────────────────────────
  function scrollToThumbTop(top) {
    const panel = panelEl();
    if (!panel) return;
    const trackH = track.clientHeight;
    const thumbH = thumb.offsetHeight;
    const travel = Math.max(1, trackH - thumbH);
    const maxScroll = Math.max(0, panel.scrollHeight - panel.clientHeight);
    const clamped = Math.min(travel, Math.max(0, top));
    panel.scrollTop = (clamped / travel) * maxScroll;
    update();
  }

  function onThumbDown(e) {
    e.preventDefault();
    e.stopPropagation();
    dragging = true;
    dragGrabY = e.clientY;
    const m = /translateY\((-?[\d.]+)px\)/.exec(thumb.style.transform || '');
    dragThumbTop = m ? parseFloat(m[1]) : 0;
    thumb.setPointerCapture?.(e.pointerId);
    rail.classList.add('dragging');
    document.body.classList.add('pscroll-dragging');
    thumb.addEventListener('pointermove', onThumbMove);
    thumb.addEventListener('pointerup', onThumbUp);
    thumb.addEventListener('pointercancel', onThumbUp);
  }

  function onThumbMove(e) {
    if (!dragging) return;
    scrollToThumbTop(dragThumbTop + (e.clientY - dragGrabY));
  }

  function onThumbUp(e) {
    dragging = false;
    thumb.releasePointerCapture?.(e.pointerId);
    rail.classList.remove('dragging');
    document.body.classList.remove('pscroll-dragging');
    thumb.removeEventListener('pointermove', onThumbMove);
    thumb.removeEventListener('pointerup', onThumbUp);
    thumb.removeEventListener('pointercancel', onThumbUp);
  }

  // Click anywhere on the empty track: centre the thumb there.
  function onTrackDown(e) {
    if (e.target === thumb) return;
    const rect = track.getBoundingClientRect();
    scrollToThumbTop(e.clientY - rect.top - thumb.offsetHeight / 2);
  }

  function onThumbKey(e) {
    const panel = panelEl();
    if (!panel) return;
    const page = panel.clientHeight * 0.9;
    let d = 0;
    if (e.key === 'ArrowDown') d = 60;
    else if (e.key === 'ArrowUp') d = -60;
    else if (e.key === 'PageDown') d = page;
    else if (e.key === 'PageUp') d = -page;
    else if (e.key === 'Home') { panel.scrollTop = 0; update(); e.preventDefault(); return; }
    else if (e.key === 'End') { panel.scrollTop = panel.scrollHeight; update(); e.preventDefault(); return; }
    else return;
    e.preventDefault();
    panel.scrollTop += d;
    update();
  }

  // ── Fullscreen ───────────────────────────────────────────────────────────
  // CSS-only: the panel is pinned to the viewport rather than handed to the
  // Fullscreen API, so the rail (which is a sibling on <body>) stays reachable
  // and Esc can be handled without fighting the browser's own fullscreen UI.
  function isFullscreen() {
    return document.body.classList.contains('preview-fullscreen');
  }

  function setFullscreen(on) {
    document.body.classList.toggle('preview-fullscreen', !!on);
    if (btnFull) {
      btnFull.classList.toggle('active', !!on);
      btnFull.title = on
        ? 'Exit fullscreen preview (Esc)'
        : 'Fullscreen the document preview (Esc to exit)';
      btnFull.innerHTML = on
        ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"
                stroke-linecap="round" stroke-linejoin="round">
             <polyline points="4 14 10 14 10 20"/>
             <polyline points="20 10 14 10 14 4"/>
             <line x1="14" y1="10" x2="21" y2="3"/>
             <line x1="3" y1="21" x2="10" y2="14"/>
           </svg>`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"
                stroke-linecap="round" stroke-linejoin="round">
             <polyline points="15 3 21 3 21 9"/>
             <polyline points="9 21 3 21 3 15"/>
             <line x1="21" y1="3" x2="14" y2="10"/>
             <line x1="3" y1="21" x2="10" y2="14"/>
           </svg>`;
    }
    // The panel just changed size; the page scale is derived from its width.
    if (typeof previewManager !== 'undefined' && previewManager?._schedulePageScale) {
      previewManager._schedulePageScale();
    }
    schedule();
    // A second pass after the layout settles — the scale write above changes
    // #document-scaler's height, which changes what there is to scroll.
    setTimeout(schedule, 60);
  }

  function toggleFullscreen() {
    setFullscreen(!isFullscreen());
  }

  // Clicking the empty backdrop beside the pages exits as well — the same
  // gesture every other overlay in the app answers to. Clicks that land on a
  // page (or on any control) are left alone.
  document.addEventListener('click', (e) => {
    if (!isFullscreen()) return;
    const panel = panelEl();
    if (!panel || e.target !== panel) return;
    setFullscreen(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isFullscreen()) {
      e.preventDefault();
      setFullscreen(false);
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { build(); schedule(); });
  } else {
    build(); schedule();
  }

  return { refresh: schedule, toggleFullscreen, setFullscreen, isFullscreen };
})();

// Exposed for the top-bar / help modal and for any caller that wants the
// preview blown up without going through the rail button.
function togglePreviewFullscreen() { PreviewScrollbar.toggleFullscreen(); }
