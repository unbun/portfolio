// Home hero: an occupancy-grid of dots that "lights up" around the pointer, like a lidar return.
(function () {
  const canvas = document.querySelector('.hero-grid');
  const prompt = document.querySelector('.prompt');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Typed shell prompt: picks a random command, and every 15s erases it and types a different one.
  if (prompt) {
    const CYCLE_MS = 15000;
    let options = [];
    try { options = JSON.parse(prompt.dataset.prompts || '[]'); } catch {}
    const caret = document.createElement('span');
    caret.className = 'caret';
    let current = '';
    let timer;

    const show = (s) => { prompt.textContent = s; prompt.appendChild(caret); };
    const pick = () => {
      const pool = options.length > 1 ? options.filter((o) => o !== current) : options;
      return pool.length ? pool[Math.floor(Math.random() * pool.length)] : '';
    };

    const typeOut = (text, done) => {
      let i = 0;
      const tick = () => {
        show(text.slice(0, i));
        if (i++ < text.length) timer = setTimeout(tick, i === 1 ? 400 : 28 + Math.random() * 40);
        else done();
      };
      tick();
    };
    const erase = (done) => {
      const shown = prompt.textContent;
      let n = shown.length;
      const tick = () => {
        show(shown.slice(0, n));
        if (n-- > 0) timer = setTimeout(tick, 14);
        else done();
      };
      tick();
    };

    const next = () => {
      const text = pick();
      current = text;
      const schedule = () => { timer = setTimeout(cycle, CYCLE_MS); };
      if (reduced) { show(text); schedule(); } else typeOut(text, schedule);
    };
    const cycle = () => (reduced || !prompt.textContent ? next() : erase(next));

    // Don't burn cycles in a background tab; pick up where it left off on return.
    document.addEventListener('visibilitychange', () => {
      clearTimeout(timer);
      if (!document.hidden) timer = setTimeout(cycle, CYCLE_MS);
    });
    if (options.length) next();
  }

  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const SPACING = 26;
  const RADIUS = 170;
  let w = 0, h = 0, dpr = 1;
  let colors = {};
  const pointer = { x: -1e4, y: -1e4, active: false };
  const idle = { t: 0 };

  function readColors() {
    const s = getComputedStyle(document.documentElement);
    colors = { dot: s.getPropertyValue('--line-strong').trim(), blue: s.getPropertyValue('--blue').trim() };
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = r.width; h = r.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    readColors();
    if (reduced) draw(-1e4, -1e4);
  }

  function draw(px, py) {
    ctx.clearRect(0, 0, w, h);
    const offX = (w % SPACING) / 2, offY = (h % SPACING) / 2;
    for (let y = offY; y < h; y += SPACING) {
      for (let x = offX; x < w; x += SPACING) {
        const d = Math.hypot(x - px, y - py);
        const k = Math.max(0, 1 - d / RADIUS);
        if (k > 0) {
          ctx.globalAlpha = 0.25 + k * 0.75;
          ctx.fillStyle = colors.blue;
          const s = 1.4 + k * 2.2;
          ctx.fillRect(x - s / 2, y - s / 2, s, s);
        } else {
          ctx.globalAlpha = 0.7;
          ctx.fillStyle = colors.dot;
          ctx.fillRect(x - 0.7, y - 0.7, 1.4, 1.4);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  // Smoothed "sensor" position chases the pointer; when idle it wanders on a slow Lissajous path.
  const sensor = { x: 0, y: 0 };
  function frame() {
    idle.t += 0.004;
    const tx = pointer.active ? pointer.x : w * (0.62 + 0.22 * Math.sin(idle.t * 1.3));
    const ty = pointer.active ? pointer.y : h * (0.45 + 0.25 * Math.sin(idle.t * 2.1));
    sensor.x += (tx - sensor.x) * 0.12;
    sensor.y += (ty - sensor.y) * 0.12;
    draw(sensor.x, sensor.y);
    requestAnimationFrame(frame);
  }

  const hero = canvas.parentElement;
  hero.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.x = e.clientX - r.left;
    pointer.y = e.clientY - r.top;
    pointer.active = true;
  });
  hero.addEventListener('pointerleave', () => { pointer.active = false; });

  window.addEventListener('resize', resize);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readColors);
  resize();
  sensor.x = w * 0.62; sensor.y = h * 0.45;
  if (!reduced) requestAnimationFrame(frame);
})();
