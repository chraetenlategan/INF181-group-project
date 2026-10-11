// ══════════════════════════════════════════════════════════════════════════
// KeyBuddy — the INF181 mascot that fronts the keyboard tutorial
//
// The sprite sheet the user supplied was cut into six poses (cut-outs with
// alpha, ~260px tall, in web/images/sprites/). This module is only the
// presentation layer: it hands KeyTutorial the markup for a pose plus an
// optional speech bubble, and lets it swap poses afterwards without a full
// re-render.
//
//   KeyBuddy.html(pose, { say })  → markup to drop into a card
//   KeyBuddy.set(root, pose, { say })  → swap pose in place, with a pop
//   KeyBuddy.flash(root, pose, say, ms) → react, then fall back to the pose
//                                         that was showing before
//   KeyBuddy.cheer(line)                → one-off line for the current pose
//
// Deliberately small: six stills, a bob, a pop on change. No pose is animated
// frame-by-frame — the mascot is there to be friendly, not to perform.
// ══════════════════════════════════════════════════════════════════════════

const KeyBuddy = (function () {
  const DIR = 'images/sprites/';

  const POSES = {
    hello: 'inf181-hello.png',   // arms open — greeting
    point:  'inf181-point.png',  // pointing left  — "watch this panel"
    pointr: 'inf181-point-r.png',// pointing right — mirrored, but the logo is not
    think: 'inf181-think.png',   // hand to the chin — "not that key"
    thumb: 'inf181-thumb.png',   // thumbs up — step cleared
    cheer: 'inf181-cheer.png',   // both hands up — finished
    notes: 'inf181-notes.png',   // clipboard — the announcement card
  };

  // Short lines, reused in rotation so the same one doesn't come up twice.
  const PRAISE = ['Nice!', 'That\'s it!', 'Got it.', 'Smooth.', 'Well done!'];
  const NUDGE  = ['Not that one.', 'Try again.', 'Nearly — look at the key.'];
  let praiseAt = 0, nudgeAt = 0;

  function preload() {
    Object.values(POSES).forEach(f => { const i = new Image(); i.src = DIR + f; });
  }

  function src(pose) { return DIR + (POSES[pose] || POSES.hello); }

  function esc(s) {
    return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  }

  function html(pose, opts) {
    const o = opts || {};
    const bubble = o.say
      ? `<div class="kb-say">${esc(o.say)}</div>`
      : '<div class="kb-say kb-say-off"></div>';
    return `<div class="kb" data-pose="${pose}">
      <img class="kb-img" src="${src(pose)}" alt="">
    </div>${bubble}`;
  }

  function node(root) { return (root || document).querySelector('.kb'); }
  function bubble(root) { return (root || document).querySelector('.kb-say'); }

  function set(root, pose, opts) {
    const o = opts || {};
    const kb = node(root);
    if (!kb) return;
    if (kb.dataset.pose !== pose) {
      kb.dataset.pose = pose;
      kb.querySelector('.kb-img').src = src(pose);
      kb.classList.remove('kb-pop'); void kb.offsetWidth; kb.classList.add('kb-pop');
      // Drop the class again so the idle bob (same property) resumes.
      setTimeout(() => kb.classList.remove('kb-pop'), 420);
    }
    if ('say' in o) say(root, o.say);
  }

  function say(root, line) {
    const b = bubble(root);
    if (!b) return;
    b.classList.toggle('kb-say-off', !line);
    if (!line) { b.textContent = ''; return; }
    b.textContent = line;
    b.classList.remove('kb-say-in'); void b.offsetWidth; b.classList.add('kb-say-in');
  }

  // React briefly, then go back to whatever was showing.
  let flashTimer = null;
  function flash(root, pose, line, ms) {
    const kb = node(root);
    if (!kb) return;
    const wasPose = kb.dataset.pose;
    const wasLine = bubble(root) ? bubble(root).textContent : '';
    clearTimeout(flashTimer);
    set(root, pose, { say: line });
    flashTimer = setTimeout(() => {
      if (node(root)) set(root, wasPose, { say: wasLine });
    }, ms || 900);
  }

  function praise() { return PRAISE[praiseAt++ % PRAISE.length]; }
  function nudge()  { return NUDGE[nudgeAt++ % NUDGE.length]; }

  return { html, set, say, flash, praise, nudge, preload };
})();
