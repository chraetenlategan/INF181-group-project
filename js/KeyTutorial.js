// ══════════════════════════════════════════════════════════════════════════
// KeyTutorial — announces KeyScroll (j/k, f/d) and walks the user through it
//
//   • First start after the feature shipped: a small "New" card, bottom right,
//     offering the tutorial. Either answer marks it seen (localStorage), so it
//     shows once per machine.
//   • Settings → Help → Keyboard Scrolling replays the tutorial any time.
//
// The tutorial is hands-on: each step lights up the panel a key drives and
// waits for the user to scroll it a good stretch — about two panels' worth —
// with that key, on the real app.
// KeyScroll does the scrolling; this only measures how far the panel moved and
// fills a progress bar with it. Finishing throws a little confetti.
//
// There has to be something to scroll, so a tutorial started against an empty
// preview generates a document first (see `ensurePreview`).
//
// The INF181 mascot fronts it (KeyBuddy.js): it points at the panel in play,
// thinks when a wrong key lands, gives a thumbs up per step cleared and throws
// both hands up at the end.
// ══════════════════════════════════════════════════════════════════════════

const KeyTutorial = (function () {
  const SEEN_KEY = 'policygenKeyTutorialSeen';

  // `pose` points the mascot at the panel the key drives — the preview sits on
  // the right, the form on the left. Two drawn poses rather than one mirrored
  // with CSS: mirroring turned the INF181 logo on its head into a reflection.
  // How far a step asks the panel to move, in panel-heights.
  const SPAN = 2;

  const STEPS = [
    { key: 'j', panel: '.preview-panel', pose: 'pointr', dir:  1, text: 'scroll the <b>preview</b> down a page' },
    { key: 'k', panel: '.preview-panel', pose: 'pointr', dir: -1, text: 'scroll the <b>preview</b> back up' },
    { key: 'f', panel: '.form-panel',    pose: 'point',  dir:  1, text: 'scroll the <b>form</b> down a page' },
    { key: 'd', panel: '.form-panel',    pose: 'point',  dir: -1, text: 'scroll the <b>form</b> back up' },
  ];

  let card = null;      // the coach card while the tutorial runs
  let step = -1;        // -1 = intro, STEPS.length = done
  let watch = null;     // the scroll the current step is measuring
  let keyAt = 0;        // when the step's key was last pressed
  // Keys the user is holding down. A step finishes mid-hold, so whatever was
  // already down when it did carries into the next step — and must not be
  // taken for a wrong answer there. It is forgiven until it is released.
  const held = new Set();
  let carried = new Set();
  let lastKey = null;   // the key that cleared the previous step, and when
  let lastKeyAt = 0;

  function seen() {
    try { return localStorage.getItem(SEEN_KEY) === '1'; } catch (_) { return true; }
  }
  function markSeen() {
    try { localStorage.setItem(SEEN_KEY, '1'); } catch (_) {}
  }

  // ── Announcement ────────────────────────────────────────────────────────
  function announce() {
    if (seen() || /[?&]monkey\b/.test(location.search)) return;
    if (document.getElementById('kt-announce')) return;
    const el = document.createElement('div');
    el.id = 'kt-announce';
    el.className = 'kt-announce kt-has-buddy';
    el.innerHTML = `
      ${KeyBuddy.html('notes')}
      <div class="kt-badge">New</div>
      <div class="kt-announce-title">Scroll without the mouse</div>
      <div class="kt-announce-keys">
        <span class="kt-key kt-key-sm">d</span><span class="kt-key kt-key-sm">f</span>
        <span class="kt-announce-gap"></span>
        <span class="kt-key kt-key-sm">j</span><span class="kt-key kt-key-sm">k</span>
      </div>
      <div class="kt-actions">
        <button class="kt-btn kt-btn-ghost" data-act="later">Later</button>
        <button class="kt-btn kt-btn-gold" data-act="go">Show me</button>
      </div>`;
    el.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (!act) return;
      markSeen();
      el.classList.remove('kt-in');
      setTimeout(() => el.remove(), 250);
      if (act === 'go') start();
    });
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('kt-in'));
  }

  // ── Tutorial ────────────────────────────────────────────────────────────

  // Nothing to practise on if the preview is empty — generate the document the
  // form is already holding. With no entity type chosen yet there is nothing to
  // generate either, so pick Company, exactly as clicking its card would.
  function ensurePreview() {
    const out = document.getElementById('document-output');
    if (!out || out.querySelector('.doc-page, .cover-page')) return;
    const ec = document.getElementById('ec-company');
    if (!document.querySelector('.entity-card.selected') && ec &&
        typeof selectEntity === 'function') {
      selectEntity(ec, 'company');          // picks the type and generates
    } else if (typeof generateAndPreview === 'function') {
      generateAndPreview();
    }
  }

  function start() {
    markSeen();
    document.getElementById('kt-announce')?.remove();
    stop();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    card = document.createElement('div');
    card.className = 'kt-coach kt-has-buddy';
    card.addEventListener('click', onClick);
    document.body.appendChild(card);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('keyup', onKeyUp, true);
    held.clear();
    carried = new Set();
    ensurePreview();
    step = -1;
    KeyBuddy.preload();
    render();
    requestAnimationFrame(() => card && card.classList.add('kt-in'));
  }

  function stop() {
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('keyup', onKeyUp, true);
    held.clear();
    unwatch();
    spot(null);
    if (card) {
      const c = card;
      card = null;
      c.classList.remove('kt-in');
      setTimeout(() => c.remove(), 250);
    }
  }

  // ── Measuring the scroll ────────────────────────────────────────────────
  // A step is done when its panel has moved a page in the step's direction.
  // Only movement within a moment of the step's own key counts, so spinning the
  // mouse wheel does not fill the bar — the point of the exercise is the key.

  function posOf(t) { return t === window ? window.scrollY : t.scrollTop; }

  function roomOf(t, dir) {
    const at = posOf(t);
    if (dir < 0) return at;
    return t === window
      ? document.documentElement.scrollHeight - window.innerHeight - at
      : t.scrollHeight - t.clientHeight - at;
  }

  function spanOf(t) {
    return (t === window ? window.innerHeight : t.clientHeight) * SPAN;
  }

  function watchStep() {
    unwatch();
    const s = STEPS[step];
    const target = KeyScroll.scrollerFor(s.panel);
    if (!target) return;
    // Scrolling up needs somewhere to come back from.
    if (s.dir < 0 && roomOf(target, -1) < spanOf(target)) {
      target.scrollBy({ top: spanOf(target), behavior: 'auto' });
    }
    watch = {
      target,
      from: posOf(target),
      need: Math.max(60, Math.min(spanOf(target), roomOf(target, s.dir))),
      done: 0,
      onScroll: () => {
        if (!watch || Date.now() - keyAt > 700) return;
        const moved = (posOf(watch.target) - watch.from) * s.dir;
        watch.done = Math.max(watch.done, moved);
        paint();
        if (watch.done >= watch.need) finishStep();
      },
    };
    target.addEventListener('scroll', watch.onScroll, { passive: true });
    paint();
  }

  function unwatch() {
    if (watch) watch.target.removeEventListener('scroll', watch.onScroll);
    watch = null;
  }

  function progress() {
    return watch && watch.need ? Math.min(1, Math.max(0, watch.done / watch.need)) : 0;
  }

  // Cheap enough to run on every scroll event: one width, no re-render.
  function paint() {
    const fill = card && card.querySelector('.kt-bar-fill');
    if (fill) fill.style.width = `${Math.round(progress() * 100)}%`;
  }

  function finishStep() {
    unwatch();
    carried = new Set(held);
    lastKey = STEPS[step].key;
    lastKeyAt = Date.now();
    step++;
    const done = step >= STEPS.length;
    if (done) confetti();
    else KeyBuddy.set(card, 'thumb', { say: KeyBuddy.praise() });
    setTimeout(render, done ? 0 : 760);
  }

  function spot(selector) {
    document.querySelectorAll('.kt-spot').forEach(p => p.classList.remove('kt-spot'));
    if (selector) document.querySelector(selector)?.classList.add('kt-spot');
  }

  function render() {
    if (!card) return;
    if (step < 0) {
      spot(null);
      card.innerHTML = `
        <button class="kt-close" data-act="close" title="Close">×</button>
        ${KeyBuddy.html('hello')}
        <div class="kt-title">Two hands, two panels</div>
        <div class="kt-hands">
          <div class="kt-hand">
            <div class="kt-hand-keys"><span class="kt-key">d</span><span class="kt-key">f</span></div>
            <div class="kt-hand-label">Left hand → form</div>
          </div>
          <div class="kt-hand">
            <div class="kt-hand-keys"><span class="kt-key">j</span><span class="kt-key">k</span></div>
            <div class="kt-hand-label">Right hand → preview</div>
          </div>
        </div>
        <div class="kt-actions">
          <button class="kt-btn kt-btn-gold" data-act="next">Let's try it</button>
        </div>`;
      return;
    }
    if (step >= STEPS.length) {
      spot(null);
      card.innerHTML = `
        <button class="kt-close" data-act="close" title="Close">×</button>
        ${KeyBuddy.html('cheer', { say: 'Perfect!' })}
        <div class="kt-title">You've got it!</div>
        <div class="kt-sub">It takes a little practice, but it saves a tremendous amount of time compared to scrolling with the mouse.</div>
        <div class="kt-sub">Works any time you're not typing in a field.</div>
        <div class="kt-actions">
          <button class="kt-btn kt-btn-gold" data-act="close">Done</button>
        </div>`;
      return;
    }
    const s = STEPS[step];
    spot(s.panel);
    const dots = STEPS.map((_, i) =>
      `<span class="kt-dot${i < step ? ' kt-dot-done' : i === step ? ' kt-dot-now' : ''}"></span>`).join('');
    card.innerHTML = `
      <button class="kt-close" data-act="close" title="Close">×</button>
      ${KeyBuddy.html(s.pose, { say: 'Hold it down if you like.' })}
      <div class="kt-dots">${dots}</div>
      <div class="kt-step">
        <span class="kt-key kt-key-big" id="kt-cap">${s.key}</span>
        <div class="kt-step-text">Press <b>${s.key}</b> to ${s.text}.</div>
      </div>
      <div class="kt-bar"><div class="kt-bar-fill"></div></div>
      <div class="kt-actions">
        <button class="kt-btn kt-btn-ghost" data-act="close">Skip tutorial</button>
      </div>`;
    watchStep();
  }

  function onClick(e) {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'close') stop();
    else if (act === 'next') { step = 0; render(); }
    // A clicked button keeps focus; harmless for KeyScroll, but drop it so
    // Space/Enter don't re-fire it while the user is pressing letters.
    if (e.target.blur) e.target.blur();
  }

  function onKeyUp(e) {
    held.delete(e.key);
    carried.delete(e.key);
  }

  function onKey(e) {
    if (!card) return;
    if (e.key.length === 1) held.add(e.key);
    if (e.key === 'Escape') { stop(); return; }
    if (step < 0 || step >= STEPS.length) return;
    if (e.ctrlKey || e.altKey || e.metaKey || KeyScroll.caretSomewhere()) return;
    const s = STEPS[step];
    const cap = document.getElementById('kt-cap');
    if (e.key !== s.key) {
      // Still on the key that cleared the last step — held down, or spammed a
      // few more times before the eye caught up. Neither is a mistake.
      if (carried.has(e.key)) return;
      if (e.key === lastKey && Date.now() - lastKeyAt < 1400) return;
      if (cap && /^[a-z]$/i.test(e.key)) {
        cap.classList.remove('kt-wiggle'); void cap.offsetWidth; cap.classList.add('kt-wiggle');
        KeyBuddy.flash(card, 'think', KeyBuddy.nudge(), 1100);
      }
      return;
    }
    // KeyScroll moves the panel; the scroll listener is what fills the bar.
    keyAt = Date.now();
    if (cap) {
      cap.classList.add('kt-pressed');
      setTimeout(() => cap.classList.remove('kt-pressed'), 120);
    }
    // A panel already at the end cannot move, so credit the press itself.
    if (watch && roomOf(watch.target, s.dir) < 2) {
      watch.done = watch.need;
      paint();
      finishStep();
    }
  }

  // ── Confetti ────────────────────────────────────────────────────────────
  function confetti() {
    const canvas = document.createElement('canvas');
    canvas.className = 'kt-confetti';
    document.body.appendChild(canvas);
    const dpr = window.devicePixelRatio || 1;
    const W = window.innerWidth, H = window.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const colours = ['#c9a84c', '#e8d080', '#a8882e', '#1a1a2e', '#4a4a6a', '#faf8f3'];
    const bits = Array.from({ length: 140 }, () => ({
      x: W / 2 + (Math.random() - 0.5) * 120,
      y: H - 140,
      vx: (Math.random() - 0.5) * 14,
      vy: -(Math.random() * 13 + 9),
      w: Math.random() * 6 + 4,
      h: Math.random() * 9 + 5,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      c: colours[Math.floor(Math.random() * colours.length)],
    }));
    const t0 = performance.now();
    (function frame(now) {
      const t = now - t0;
      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, t - 2000) / 800);
      for (const b of bits) {
        b.vy += 0.35; b.vx *= 0.99; b.x += b.vx; b.y += b.vy; b.r += b.vr;
        ctx.save();
        ctx.translate(b.x, b.y); ctx.rotate(b.r);
        ctx.fillStyle = b.c;
        ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h * Math.abs(Math.cos(b.r * 2)));
        ctx.restore();
      }
      if (t < 2800) requestAnimationFrame(frame); else canvas.remove();
    })(t0);
  }

  return { announce, start, stop };
})();
