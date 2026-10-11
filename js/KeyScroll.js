// ══════════════════════════════════════════════════════════════════════════
// KeyScroll — vim-style scrolling of the two panels from the keyboard
//
//   j / k  scroll the preview (right) down / up
//   f / d  scroll the form (left) down / up
//
// Only when the caret is nowhere: a focused input, textarea, select or any
// contenteditable (the preview in ✏️ Edit, a LiveSync value being typed over)
// gets the letter as normal typing. Ctrl / Alt / Meta combos are left alone.
// When a panel is not its own scroller (form-only view), the window scrolls.
// ══════════════════════════════════════════════════════════════════════════

const KeyScroll = (function () {
  const STEP = 80;

  const KEYS = {
    j: { panel: '.preview-panel', dir: 1 },
    k: { panel: '.preview-panel', dir: -1 },
    f: { panel: '.form-panel', dir: 1 },
    d: { panel: '.form-panel', dir: -1 },
  };

  function caretSomewhere() {
    const a = document.activeElement;
    if (!a || a === document.body || a === document.documentElement) return false;
    if (a.isContentEditable) return true;
    const tag = a.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (tag === 'INPUT') {
      const t = (a.type || '').toLowerCase();
      return !['button', 'submit', 'reset', 'checkbox', 'radio', 'range', 'color', 'file', 'image'].includes(t);
    }
    return false;
  }

  function scroller(el) {
    if (!el || el.getClientRects().length === 0) return null;
    const oy = getComputedStyle(el).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight) return el;
    return window;
  }

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey || e.defaultPrevented) return;
    const spec = KEYS[e.key];
    if (!spec || caretSomewhere()) return;
    const target = scroller(document.querySelector(spec.panel));
    if (!target) return;
    e.preventDefault();
    target.scrollBy({ top: spec.dir * STEP, behavior: e.repeat ? 'auto' : 'smooth' });
  });

  return { caretSomewhere, scrollerFor: (sel) => scroller(document.querySelector(sel)), STEP };
})();
