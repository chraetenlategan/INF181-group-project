/**
 * Gold Comet Mouse Trail
 * A smooth tapered ribbon that follows the cursor and melts away.
 * Active on Fridays; Ctrl+Shift+1 toggles it any day (dev shortcut).
 */

(function() {
  const TRAIL_LIFE = 500;   // ms a point stays in the ribbon
  const HEAD_WIDTH = 6;     // px, ribbon width at the cursor
  const GLOW_SCALE = 3;     // glow pass is this many times wider
  const MIN_DIST = 3;       // px of movement before a new point is recorded

  let canvas = null;
  let ctx = null;
  let width = 0, height = 0;
  let points = [];          // { x, y, t }
  let rafId = null;
  let active = false;

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  function onMouseMove(e) {
    const last = points[points.length - 1];
    if (last && Math.hypot(e.clientX - last.x, e.clientY - last.y) < MIN_DIST) {
      last.t = performance.now(); // keep the head fresh while hovering
      return;
    }
    points.push({ x: e.clientX, y: e.clientY, t: performance.now() });
  }

  // Draw the ribbon once with a given width/alpha multiplier.
  // Each segment is stroked through the midpoints of its neighbours
  // (quadratic through the real point), which keeps the curve smooth.
  function drawRibbon(now, widthScale, alphaScale, color) {
    for (let i = 1; i < points.length - 1; i++) {
      const p0 = points[i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];

      const age = (now - p1.t) / TRAIL_LIFE;      // 0 = fresh, 1 = gone
      if (age >= 1) continue;
      const strength = 1 - age;

      ctx.strokeStyle = color;
      ctx.globalAlpha = strength * alphaScale;
      ctx.lineWidth = Math.max(HEAD_WIDTH * strength * widthScale, 0.5);
      ctx.beginPath();
      ctx.moveTo((p0.x + p1.x) / 2, (p0.y + p1.y) / 2);
      ctx.quadraticCurveTo(p1.x, p1.y, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
      ctx.stroke();
    }
  }

  function animate() {
    const now = performance.now();
    ctx.clearRect(0, 0, width, height);

    // Drop expired points (keep one extra so the tail tapers off-screen)
    while (points.length > 1 && now - points[0].t > TRAIL_LIFE) {
      points.shift();
    }

    if (points.length > 2) {
      ctx.globalCompositeOperation = 'lighter';
      drawRibbon(now, GLOW_SCALE, 0.10, '#D4AF37'); // soft gold halo
      drawRibbon(now, 1.4, 0.35, '#E8C55A');        // mid body
      drawRibbon(now, 0.6, 0.9, '#FFF6D8');         // bright core
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }

    rafId = requestAnimationFrame(animate);
  }

  function start() {
    if (active) return;
    active = true;
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'mouse-trail-canvas';
      canvas.style.position = 'fixed';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.width = '100vw';
      canvas.style.height = '100vh';
      canvas.style.pointerEvents = 'none';
      canvas.style.zIndex = '9999';
      ctx = canvas.getContext('2d');
    }
    document.body.appendChild(canvas);
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMouseMove);
    animate();
  }

  function stop() {
    if (!active) return;
    active = false;
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', resize);
    window.removeEventListener('mousemove', onMouseMove);
    points = [];
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  }

  // Dev shortcut: Ctrl+Shift+1 toggles the trail regardless of day
  // (Ctrl+Alt is avoided because Windows treats it as AltGr on many layouts)
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && !e.altKey && (e.code === 'Digit1' || e.code === 'Numpad1')) {
      e.preventDefault();
      active ? stop() : start();
    }
  });

  // Friday-only easter egg (getDay(): 0 = Sunday ... 5 = Friday)
  if (new Date().getDay() === 5) {
    if (document.body) start();
    else document.addEventListener('DOMContentLoaded', start);
  }
})();
