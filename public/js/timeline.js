// Timeline pages: renders items from JSON and drives a TurtleBot down a right-angle path as you scroll.
// The bot behaves like a differential-drive robot: it drives straight along each segment and
// rotates in place at every corner. Cards are all shown on load; the bot marks each one as it docks.
(function () {
  const section = document.querySelector('.timeline');
  if (!section) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SVGNS = 'http://www.w3.org/2000/svg';
  const REF_LINE = 0.62;    // fraction of the viewport height the bot tries to stay on
  const DOCK_OFFSET = 36;   // px from a card's top edge to its dock
  const LANE_MARGIN = 16;   // keep the route this far inside the lane edges

  // ---------- Rendering ----------
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // "[like this]" marks content still to be filled in; render it as a visible placeholder.
  const fmt = (s) => esc(s).replace(/\[([^\]]+)\]/g, '<span class="ph">$1</span>');

  function cardHTML(item) {
    const parts = [];
    if (item.period) parts.push(`<p class="tl-period">${fmt(item.period)}</p>`);
    parts.push(`<h3 class="tl-title">${fmt(item.title)}</h3>`);
    if (item.org) {
      const loc = item.location ? `<span class="loc">${fmt(item.location)}</span>` : '';
      parts.push(`<p class="tl-org">${fmt(item.org)}${loc}</p>`);
    }
    if (item.summary) parts.push(`<p class="tl-summary">${fmt(item.summary)}</p>`);
    if (item.bullets && item.bullets.length) {
      parts.push(`<ul class="tl-bullets">${item.bullets.map((b) => `<li>${fmt(b)}</li>`).join('')}</ul>`);
    }
    if (item.tags && item.tags.length) {
      parts.push(`<ul class="chips">${item.tags.map((t) => `<li class="chip">${esc(t)}</li>`).join('')}</ul>`);
    }
    if (item.links && item.links.length) {
      parts.push(`<p class="tl-links">${item.links.map((l) =>
        `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join('')}</p>`);
    }
    return `<article class="tl-card">${parts.join('')}</article>`;
  }

  const BOT_SVG = `
    <svg viewBox="-24 -24 48 48" aria-hidden="true">
      <g class="chassis">
        <path class="scan" d="M0 0 L40 -22 A46 46 0 0 1 40 22 Z"/>
        <rect class="wheel" x="-8" y="-23" width="16" height="6" rx="2"/>
        <rect class="wheel" x="-8" y="17" width="16" height="6" rx="2"/>
        <circle class="body" r="19"/>
        <circle class="plate" r="14.5"/>
        <circle class="standoff" cx="10" cy="-10" r="1.3"/>
        <circle class="standoff" cx="10" cy="10" r="1.3"/>
        <circle class="standoff" cx="-10" cy="-10" r="1.3"/>
        <circle class="standoff" cx="-10" cy="10" r="1.3"/>
        <circle class="standoff" cx="-15" cy="0" r="1.6"/>
        <rect class="led" x="15" y="-2.5" width="2.5" height="5" rx="1"/>
        <circle class="lds" r="7"/>
        <g class="spinner"><line class="lds-beam" x1="0" y1="0" x2="5.5" y2="0"/></g>
      </g>
    </svg>`;

  // ---------- Path planning ----------
  // Small seeded PRNG so the route stays the same across resizes but differs per visit.
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const SEED = (Math.random() * 2 ** 31) | 0;

  // Builds an axis-aligned polyline: starts at the top of the lane, zigzags randomly within the
  // lane, and visits a dock on the lane edge next to each card.
  function plan(lane, docks, endY) {
    const rand = mulberry32(SEED);
    const minX = lane.left + LANE_MARGIN;
    const maxX = lane.right - LANE_MARGIN;
    const span = Math.max(0, maxX - minX);
    const pickX = (from) => {
      if (span < 8) return minX + span / 2;
      for (let i = 0; i < 6; i++) {
        const x = minX + rand() * span;
        if (Math.abs(x - from) > Math.min(36, span * 0.4)) return x;
      }
      return from < minX + span / 2 ? maxX : minX;
    };

    const pts = [{ x: minX + span / 2, y: 0 }];
    let cur = pts[0];
    const docksS = [];

    docks.forEach((d) => {
      // Leave the previous dock back into the lane.
      if (cur.x < minX || cur.x > maxX) {
        cur = { x: pickX(cur.x), y: cur.y };
        pts.push(cur);
      }
      // Random right-angle jogs on the way down.
      const room = d.y - cur.y;
      const jogs = room > 320 ? 1 + Math.floor(rand() * 2) : room > 120 ? 1 : 0;
      for (let j = 0; j < jogs; j++) {
        const remaining = d.y - cur.y;
        const y = cur.y + remaining * (0.25 + rand() * 0.4) / (jogs - j);
        if (y - cur.y < 24 || d.y - y < 32) break;
        pts.push({ x: cur.x, y });
        cur = { x: pickX(cur.x), y };
        pts.push(cur);
      }
      // Down to the dock's row, then across to the dock.
      if (d.y > cur.y) { cur = { x: cur.x, y: d.y }; pts.push(cur); }
      cur = { x: d.x, y: d.y };
      pts.push(cur);
      docksS.push(pts.length - 1);
    });

    // Head for the goal at the bottom.
    if (cur.x < minX || cur.x > maxX) { cur = { x: minX + span / 2, y: cur.y }; pts.push(cur); }
    pts.push({ x: cur.x, y: endY });

    return simplify(pts, docksS);
  }

  // Drop zero-length segments and merge collinear ones; remap dock indices to the result.
  function simplify(pts, dockIdx) {
    const keep = new Set(dockIdx);
    const out = [pts[0]];
    const map = new Map([[0, 0]]);
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i], last = out[out.length - 1];
      if (Math.abs(p.x - last.x) < 0.5 && Math.abs(p.y - last.y) < 0.5) { map.set(i, out.length - 1); continue; }
      if (out.length >= 2) {
        const prev = out[out.length - 2];
        const collinear = (Math.abs(prev.x - last.x) < 0.5 && Math.abs(last.x - p.x) < 0.5) ||
                          (Math.abs(prev.y - last.y) < 0.5 && Math.abs(last.y - p.y) < 0.5);
        const sameDir = collinear && Math.sign(last.x - prev.x) === Math.sign(p.x - last.x) &&
                                     Math.sign(last.y - prev.y) === Math.sign(p.y - last.y);
        const lastIsDock = [...map].some(([k, v]) => v === out.length - 1 && keep.has(k));
        if (sameDir && !lastIsDock) {
          out[out.length - 1] = p;
          map.set(i, out.length - 1);
          continue;
        }
      }
      out.push(p);
      map.set(i, out.length - 1);
    }
    return { pts: out, docks: dockIdx.map((i) => map.get(i)) };
  }

  // ---------- State ----------
  let items = [], els = {}, route = null;
  const bot = { seg: 0, t: 0, heading: Math.PI / 2, x: 0, y: 0, v: 0 };
  let lastTime = 0, running = false, built = false;

  function build(data) {
    section.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'tl-grid';

    const lane = document.createElement('div');
    lane.className = 'lane';
    lane.style.gridRow = `1 / ${data.length + 1}`;
    grid.appendChild(lane);

    items = data.map((item, i) => {
      const el = document.createElement('div');
      el.className = `tl-item ${i % 2 === 0 ? 'left' : 'right'}`;
      el.style.gridRow = String(i + 1);
      el.style.setProperty('--d', `${Math.min(i, 8) * 70}ms`);
      el.innerHTML = cardHTML(item);
      grid.appendChild(el);
      return { el, data: item, visited: false };
    });

    const svg = document.createElementNS(SVGNS, 'svg');
    svg.classList.add('track');
    svg.setAttribute('aria-hidden', 'true');
    const planPath = document.createElementNS(SVGNS, 'path');
    planPath.classList.add('track-plan');
    const donePath = document.createElementNS(SVGNS, 'path');
    donePath.classList.add('track-done');
    const dockG = document.createElementNS(SVGNS, 'g');
    svg.append(planPath, donePath, dockG);

    const botEl = document.createElement('div');
    botEl.className = 'bot';
    botEl.innerHTML = BOT_SVG;
    botEl.title = 'Click me';
    const bubble = document.createElement('div');
    bubble.className = 'bot-bubble';

    section.append(svg, grid, botEl, bubble);
    const goalLabel = document.createElement('div');
    goalLabel.className = 'goal-label';
    goalLabel.textContent = 'goal';
    section.appendChild(goalLabel);

    els = { grid, lane, svg, planPath, donePath, dockG, botEl, bubble, goalLabel, hud: document.querySelector('.hud') };

    botEl.addEventListener('click', twirl);
  }

  // Measure layout and (re)plan the route.
  function layout(keepProgress) {
    const base = section.getBoundingClientRect();
    const lr = els.lane.getBoundingClientRect();
    const lane = { left: lr.left - base.left, right: lr.right - base.left };
    const mobile = window.matchMedia('(max-width: 820px)').matches;

    // Docks sit on the lane edge that touches each card.
    const docks = items.map(({ el }) => {
      const r = el.getBoundingClientRect();
      const left = el.classList.contains('left') && !mobile;
      return { x: left ? lane.left : lane.right, y: r.top - base.top + DOCK_OFFSET };
    });
    const prevS = route ? route.segs[bot.seg].start + bot.t : 0;

    const endY = base.height - 64;
    const { pts, docks: dockIdx } = plan(lane, docks, endY);

    // Segment table
    const segs = [];
    let total = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const len = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
      segs.push({ a, b, len, start: total, heading: Math.atan2(b.y - a.y, b.x - a.x), vertical: a.x === b.x });
      total += len;
    }
    const dockS = dockIdx.map((pi) => (pi > 0 ? segs[pi - 1].start + segs[pi - 1].len : 0));

    route = { pts, segs, total, dockS, endY };

    // Draw
    const w = Math.ceil(base.width), h = Math.ceil(base.height);
    els.svg.setAttribute('width', w);
    els.svg.setAttribute('height', h);
    els.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const d = 'M' + pts.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L');
    els.planPath.setAttribute('d', d);
    els.donePath.setAttribute('d', d);
    els.donePath.style.strokeDasharray = `${total} ${total}`;

    els.dockG.innerHTML = '';
    route.dockEls = dockIdx.map((pi, i) => {
      const p = pts[pi];
      const g = document.createElementNS(SVGNS, 'g');
      const ping = document.createElementNS(SVGNS, 'circle');
      ping.setAttribute('class', 'dock-ping');
      ping.setAttribute('cx', p.x); ping.setAttribute('cy', p.y); ping.setAttribute('r', 5);
      const c = document.createElementNS(SVGNS, 'circle');
      c.setAttribute('class', 'dock' + (items[i].visited ? ' reached' : ''));
      c.setAttribute('cx', p.x); c.setAttribute('cy', p.y); c.setAttribute('r', 5);
      g.append(ping, c);
      els.dockG.appendChild(g);
      return { c, ping };
    });

    // Goal marker: a small crosshair, like an RViz nav goal.
    const end = pts[pts.length - 1];
    const goal = document.createElementNS(SVGNS, 'g');
    goal.innerHTML =
      `<circle class="goal" cx="${end.x}" cy="${end.y}" r="12"/>` +
      `<path class="goal" d="M${end.x - 18} ${end.y}h10M${end.x + 8} ${end.y}h10M${end.x} ${end.y - 18}v10M${end.x} ${end.y + 8}v10"/>`;
    els.goalLabel.style.left = `${end.x}px`;
    els.goalLabel.style.top = `${end.y + 30}px`;
    els.dockG.appendChild(goal);
    route.goalEls = goal.querySelectorAll('.goal');

    if (reduced) {
      placeAt(targetS());
    } else if (keepProgress) {
      placeAt(Math.min(prevS, total));
    } else {
      bot.seg = 0; bot.t = 0; bot.heading = route.segs[0].heading;
    }
    render();
  }

  // Put the bot directly at arc-length s (used after resize and for reduced motion).
  function placeAt(s) {
    const segs = route.segs;
    let i = 0;
    while (i < segs.length - 1 && s > segs[i].start + segs[i].len) i++;
    bot.seg = i;
    bot.t = Math.max(0, Math.min(segs[i].len, s - segs[i].start));
    bot.heading = segs[i].heading;
  }

  // Where the bot should be: the furthest point whose y is above the reference line.
  function targetS() {
    const base = section.getBoundingClientRect();
    const doc = document.documentElement;
    if (window.scrollY + window.innerHeight >= doc.scrollHeight - 2) return route.total;
    const refY = window.innerHeight * REF_LINE - base.top;
    let s = 0;
    for (const seg of route.segs) {
      if (seg.vertical) {
        if (refY >= seg.b.y) { s = seg.start + seg.len; continue; }
        return seg.start + Math.max(0, refY - seg.a.y);
      }
      if (refY >= seg.a.y) { s = seg.start + seg.len; continue; }
      return s;
    }
    return s;
  }

  const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

  function step(dt) {
    const segs = route.segs;
    const S = targetS();
    let cur = segs[bot.seg].start + bot.t;
    const dist = Math.abs(S - cur);
    const speed = Math.min(6000, Math.max(150, dist * 3.2));         // px/s
    const turnRate = Math.PI * 2.4 * (1 + Math.min(10, dist / 250)); // rad/s
    let budget = speed * dt;
    let moved = 0;

    for (let guard = 0; guard < 64 && budget > 1e-3; guard++) {
      const seg = segs[bot.seg];
      const diff = wrapAngle(seg.heading - bot.heading);
      if (Math.abs(diff) > 1e-3) {
        // Rotate in place before driving this segment.
        const turn = Math.min(Math.abs(diff), turnRate * dt);
        bot.heading = wrapAngle(bot.heading + Math.sign(diff) * turn);
        break;
      }
      bot.heading = seg.heading;
      if (S > cur + 0.5) {
        const room = seg.len - bot.t;
        if (room <= 1e-3) { if (bot.seg < segs.length - 1) { bot.seg++; bot.t = 0; continue; } break; }
        const d = Math.min(budget, room, S - cur);
        bot.t += d; cur += d; budget -= d; moved += d;
      } else if (S < cur - 0.5) {
        // Reverse along the path, like backing up.
        if (bot.t <= 1e-3) { if (bot.seg > 0) { bot.seg--; bot.t = segs[bot.seg].len; continue; } break; }
        const d = Math.min(budget, bot.t, cur - S);
        bot.t -= d; cur -= d; budget -= d; moved -= d;
      } else break;
    }
    bot.v = dt > 0 ? moved / dt : 0;
  }

  function render() {
    const seg = route.segs[bot.seg];
    const f = seg.len ? bot.t / seg.len : 0;
    bot.x = seg.a.x + (seg.b.x - seg.a.x) * f;
    bot.y = seg.a.y + (seg.b.y - seg.a.y) * f;
    const s = seg.start + bot.t;

    els.botEl.style.transform = `translate(${bot.x}px, ${bot.y}px) rotate(${bot.heading}rad)`;
    els.bubble.style.left = `${bot.x}px`;
    els.bubble.style.top = `${bot.y}px`;
    els.donePath.style.strokeDashoffset = String(route.total - s);

    // Mark visited docks; the most recent one is the bot's "current station".
    let current = -1;
    route.dockS.forEach((ds, i) => {
      const here = s >= ds - 1;
      if (here) current = i;
      if (here !== items[i].visited) {
        items[i].visited = here;
        items[i].el.classList.toggle('visited', here);
        route.dockEls[i].c.classList.toggle('reached', here);
        route.dockEls[i].ping.classList.toggle('go', here);
      }
    });
    items.forEach((it, i) => it.el.classList.toggle('current', i === current));

    const atGoal = s >= route.total - 1;
    route.goalEls.forEach((g) => g.classList.toggle('reached', atGoal));
    els.goalLabel.classList.toggle('reached', atGoal);
    els.goalLabel.textContent = atGoal ? 'goal reached' : 'goal';

    if (current !== lastHud) { lastHud = current; renderHud(current); }
  }

  // Thematic HUD: a career "status" topic that follows the bot from station to station.
  let lastHud = null;
  const years = (str) => (String(str).match(/\b(19|20)\d{2}\b/g) || []).map(Number);
  function renderHud(i) {
    if (!els.hud) return;
    const all = items.flatMap((it) => years(it.data.period));
    const since = all.length ? Math.min(...all) : null;
    const now = new Date().getFullYear();
    const it = i >= 0 ? items[i].data : null;
    const stripPh = (t) => esc(String(t || '—').replace(/\[([^\]]+)\]/g, '$1'));
    const row = (k, v, cls = '') => `<div class="row ${cls}"><span>${k}</span><span>${v}</span></div>`;
    els.hud.innerHTML =
      `<div class="topic"><span class="live"></span>/career/status</div>` +
      row('station', it ? stripPh(it.org.split(' — ')[0]) : 'en route', 'wide') +
      row('role', it ? stripPh(it.title) : '—', 'wide') +
      row('period', it ? stripPh(it.period) : '—', 'wide') +
      (since ? row('building robots', `${now - since} yrs <span class="dim">since ${since}</span>`) : '') +
      row('stations', `${i + 1}/${items.length}`);
  }

  function loop(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000 || 0);
    lastTime = now;
    step(dt);
    render();
    requestAnimationFrame(loop);
  }

  let bubbleTimer;
  const QUIPS = ['/cmd_vel received', 'beep boop', 'rosnode ping: ok', 'localized ✓', 'spinning up lidar…'];
  function twirl() {
    const el = els.botEl;
    el.classList.remove('twirl');
    void el.offsetWidth;
    el.classList.add('twirl');
    els.bubble.textContent = QUIPS[Math.floor(Math.random() * QUIPS.length)];
    els.bubble.classList.add('show');
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => els.bubble.classList.remove('show'), 1400);
  }

  // ---------- Boot ----------
  async function init() {
    let data;
    try {
      const res = await fetch(section.dataset.source);
      data = (await res.json()).filter((item) => !item.draft);
    } catch (err) {
      section.innerHTML = '<p class="kicker">Could not load timeline data.</p>';
      console.error(err);
      return;
    }

    if (!reduced) document.documentElement.classList.add('anim');
    build(data);
    layout(false);
    built = true;
    // Everything is readable right away: cards fade in together on load.
    requestAnimationFrame(() => items.forEach((it) => it.el.classList.add('shown')));
    if (els.hud) {
      els.hud.classList.add('on');
      // Get out of the way of the footer links.
      const footer = document.querySelector('.site-footer');
      if (footer && 'IntersectionObserver' in window) {
        new IntersectionObserver(([e]) => els.hud.classList.toggle('on', !e.isIntersecting)).observe(footer);
      }
    }

    if (!reduced && !running) {
      running = true;
      lastTime = performance.now();
      requestAnimationFrame(loop);
    } else if (reduced) {
      window.addEventListener('scroll', () => { placeAt(targetS()); render(); }, { passive: true });
    }

    // Re-plan when layout changes (resize, web fonts finishing, etc.).
    let t;
    const relayout = () => { clearTimeout(t); t = setTimeout(() => built && layout(true), 120); };
    window.addEventListener('resize', relayout);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
    if ('ResizeObserver' in window) new ResizeObserver(relayout).observe(els.grid);
  }

  init();
})();
