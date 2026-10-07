// Projects page: info-graphic cards that fade in and out as they enter and leave the viewport,
// a summary strip with a top-technologies chart, and category filters.
(function () {
  const root = document.querySelector('.projects');
  if (!root) return;
  const gridEl = root.querySelector('.proj-grid');
  const filtersEl = root.querySelector('.proj-filters');
  const summaryEl = document.querySelector('.proj-summary');

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (s) => esc(s).replace(/\[([^\]]+)\]/g, '<span class="ph">$1</span>');
  const catsOf = (p) => p.categories || (p.category ? [p.category] : []);

  // ---------- Figures: small line drawings keyed by project "kind" (viewBox 240x120) ----------
  const FIGS = {
    platform: () => `
      <line class="ln thick" x1="62" y1="102" x2="178" y2="102"/>
      <g class="ln">
        <line x1="70" y1="102" x2="88" y2="54"/><line x1="92" y1="102" x2="84" y2="54"/>
        <line x1="108" y1="102" x2="122" y2="54"/><line x1="132" y1="102" x2="118" y2="54"/>
        <line x1="148" y1="102" x2="156" y2="54"/><line x1="170" y1="102" x2="152" y2="54"/>
      </g>
      <g class="tilt">
        <line class="ac thick" x1="78" y1="54" x2="162" y2="54"/>
        <circle class="dot roll" cx="128" cy="45" r="7"/>
      </g>`,
    arm: () => `
      <rect class="ln" x="44" y="96" width="32" height="10" rx="2"/>
      <path class="ac dash flow" d="M164 92 C 196 70, 196 34, 158 22"/>
      <line class="ln thick" x1="60" y1="96" x2="108" y2="52"/>
      <circle class="joint" cx="60" cy="96" r="5"/>
      <g class="swing">
        <line class="ln thick" x1="108" y1="52" x2="164" y2="70"/>
        <circle class="dot" cx="164" cy="70" r="4.5"/>
      </g>
      <circle class="joint" cx="108" cy="52" r="5"/>`,
    vision: () => `
      <rect class="ln" x="28" y="46" width="40" height="28" rx="4"/>
      <circle class="ac" cx="68" cy="60" r="6"/>
      <path class="ln dash" d="M74 56 L150 22 M74 64 L150 98"/>
      <rect class="tag" x="156" y="30" width="60" height="60" rx="2"/>
      <g class="tag-bits">
        <rect x="166" y="40" width="12" height="12"/><rect x="190" y="40" width="16" height="8"/>
        <rect x="166" y="64" width="8" height="16"/><rect x="182" y="58" width="12" height="12"/>
        <rect x="198" y="68" width="8" height="12"/>
      </g>
      <rect class="ac dash blink" x="150" y="24" width="72" height="72" rx="3"/>`,
    mobile: () => `
      <path class="ac dash flow" d="M92 70 H150 V34 H196"/>
      <g class="ln"><path d="M196 24v20M186 34h20"/><circle cx="196" cy="34" r="7"/></g>
      <g transform="translate(78 70)">
        <rect class="wheel" x="-8" y="-20" width="16" height="5" rx="2"/>
        <rect class="wheel" x="-8" y="15" width="16" height="5" rx="2"/>
        <circle class="body" r="16"/><circle class="ac" r="5.5"/>
        <g class="spin"><line class="ac" x1="0" y1="0" x2="4.5" y2="0"/></g>
      </g>`,
    swerve: () => `
      <rect class="ln" x="66" y="24" width="108" height="72" rx="6"/>
      ${[[80, 38], [160, 38], [80, 82], [160, 82]].map(([x, y]) => `
        <g transform="translate(${x} ${y})"><circle class="ln" r="11"/>
          <g class="steer"><rect class="wheel" x="-3.5" y="-8" width="7" height="16" rx="2"/>
          <path class="ac" d="M0 -14 V-20 M-3 -17 L0 -20 L3 -17"/></g></g>`).join('')}
      <path class="ac dash" d="M120 60 m-14 0 a14 14 0 1 1 28 0"/>`,
    profile: () => `
      <path class="ln" d="M36 102 H212 M36 102 V18"/>
      <path class="area" d="M40 102 L82 34 H168 L210 102 Z"/>
      <path class="ac thick" d="M40 102 L82 34 H168 L210 102"/>
      <text class="lbl" x="28" y="24">v</text><text class="lbl" x="206" y="116">t</text>
      <circle class="dot ride" cx="40" cy="102" r="4"/>`,
    medical: () => `
      <path class="ln" d="M20 64 H240" opacity=".35"/>
      <path class="ac thick" d="M16 64 H70 L80 64 L88 40 L98 92 L108 26 L118 78 L124 64 H170 L178 54 L186 64 H232"/>
      <g class="ln"><path d="M206 22v20M196 32h20"/></g>
      <circle class="dot ride-ecg" cx="16" cy="64" r="4"/>`,
    signal: () => {
      let d = 'M20 46', x = 20, seed = 7;
      const r = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
      while (x < 220) { x += 4; const amp = 6 + 22 * Math.exp(-((x - 110) ** 2) / 1600); d += ` L${x} ${(46 + (r() - 0.5) * amp * 2).toFixed(1)}`; }
      const pts = Array.from({ length: 14 }, (_, i) => [40 + (i * 37) % 170, 88 + (i * 13) % 22]);
      return `<path class="ac" d="${d}"/>
        <path class="ln" d="M20 104 H220" opacity=".5"/>
        ${pts.map(([px, py], i) => `<circle class="${i % 3 ? 'pt' : 'dot'}" cx="${px}" cy="${py}" r="3"/>`).join('')}`;
    },
    hex: () => {
      const hex = (cx, cy, r) => 'M' + Array.from({ length: 6 }, (_, i) => {
        const a = Math.PI / 6 + (i * Math.PI) / 3; return `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
      }).join(' L') + ' Z';
      const cells = [];
      for (let row = 0; row < 3; row++) for (let col = 0; col < 5; col++) {
        const cx = 60 + col * 30 + (row % 2) * 15, cy = 30 + row * 26;
        cells.push(`<path class="${row === 1 && col === 2 ? 'hexon' : 'ln'}" d="${hex(cx, cy, 16)}"/>`);
      }
      return cells.join('');
    },
    rink: () => `
      <rect class="ln" x="30" y="20" width="180" height="80" rx="34"/>
      <line class="ac" x1="120" y1="20" x2="120" y2="100"/>
      <line class="ln" x1="84" y1="20" x2="84" y2="100" opacity=".6"/>
      <line class="ln" x1="156" y1="20" x2="156" y2="100" opacity=".6"/>
      <circle class="ac" cx="120" cy="60" r="12"/>
      <circle class="ln" cx="62" cy="60" r="9"/><circle class="ln" cx="178" cy="60" r="9"/>
      <circle class="puck slide" cx="100" cy="72" r="4"/>`,
    fs: () => `
      <rect class="ln" x="96" y="14" width="48" height="20" rx="3"/>
      <path class="ln" d="M120 34 V48 M60 48 H180 M60 48 V62 M120 48 V62 M180 48 V62"/>
      <rect class="ln" x="40" y="62" width="40" height="18" rx="3"/>
      <rect class="ln" x="100" y="62" width="40" height="18" rx="3"/>
      <rect class="ac" x="160" y="62" width="40" height="18" rx="3"/>
      <path class="ac dash flow" d="M180 80 V100 H140"/>
      <rect class="fillac" x="100" y="92" width="40" height="18" rx="3"/>`,
    ml: () => {
      const a = [[54, 34], [70, 50], [62, 72], [88, 40], [80, 64], [96, 56], [72, 88]];
      const b = [[150, 40], [170, 58], [160, 80], [186, 44], [176, 86], [196, 66], [142, 68]];
      return `<path class="ac dash" d="M118 16 L124 108"/>
        ${a.map(([x, y]) => `<circle class="pt" cx="${x}" cy="${y}" r="4"/>`).join('')}
        ${b.map(([x, y]) => `<circle class="dot" cx="${x}" cy="${y}" r="4"/>`).join('')}`;
    },
    ros: () => `
      <ellipse class="ln" cx="52" cy="60" rx="34" ry="16"/>
      <ellipse class="ac" cx="128" cy="60" rx="30" ry="16"/>
      <ellipse class="ln" cx="200" cy="60" rx="30" ry="16"/>
      <path class="ac dash flow" d="M86 60 H96 M158 60 H168"/>
      <text class="lbl" x="52" y="64" text-anchor="middle">/sensor</text>
      <text class="lbl" x="128" y="64" text-anchor="middle">/driver</text>
      <text class="lbl" x="200" y="64" text-anchor="middle">/robot</text>`,
    teaching: () => `
      <rect class="ln" x="40" y="16" width="160" height="92" rx="6"/>
      <path class="ln" d="M40 32 H200"/>
      <circle class="pt" cx="52" cy="24" r="2.5"/><circle class="pt" cx="62" cy="24" r="2.5"/><circle class="pt" cx="72" cy="24" r="2.5"/>
      <g class="code">
        <rect x="54" y="44" width="56" height="5" rx="2"/><rect x="66" y="56" width="88" height="5" rx="2"/>
        <rect x="66" y="68" width="64" height="5" rx="2"/><rect x="54" y="80" width="24" height="5" rx="2"/>
      </g>
      <rect class="fillac blink" x="82" y="79" width="6" height="8"/>`,
  };

  function figure(kind) {
    const draw = FIGS[kind] || FIGS.teaching;
    return `<svg viewBox="0 0 240 120" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${draw()}</svg>`;
  }

  // Long tag lists collapse to the first few with a "+N more" toggle.
  const TAG_LIMIT = 10;
  function tagsHTML(tags) {
    if (!tags.length) return '';
    const extra = tags.length - TAG_LIMIT;
    return `<ul class="chips">${tags.map((t, i) => `<li class="chip${i >= TAG_LIMIT ? ' extra' : ''}">${esc(t)}</li>`).join('')}${
      extra > 0 ? `<li><button type="button" class="chip chip-more" aria-expanded="false" data-more="+${extra} more">+${extra} more</button></li>` : ''}</ul>`;
  }

  function cardHTML(p, i) {
    const links = (p.links || []).map((l) => l.download
      ? `<a href="${esc(l.url)}" download>${esc(l.label)} <span aria-hidden="true">↓</span></a>`
      : `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} <span aria-hidden="true">↗</span></a>`).join('');
    return `
      <div class="pfig">
        <span class="pidx">${String(i + 1).padStart(2, '0')}</span>
        <span class="pcat">${catsOf(p).slice(0, 2).map(esc).join(' · ') || 'Project'}${catsOf(p).length > 2 ? ` <span class="more">+${catsOf(p).length - 2}</span>` : ''}</span>
        ${figure(p.kind)}
      </div>
      <div class="pbody">
        ${p.org ? `<p class="porg">${fmt(p.org)}</p>` : ''}
        <h3 class="ptitle">${fmt(p.title)}</h3>
        ${p.summary ? `<p class="psum">${fmt(p.summary)}</p>` : ''}
        ${p.bullets && p.bullets.length ? `<ul class="tl-bullets">${p.bullets.map((b) => `<li>${fmt(b)}</li>`).join('')}</ul>` : ''}
      </div>
      <div class="pfoot">
        ${tagsHTML(p.tags || [])}
        ${links ? `<p class="plinks">${links}</p>` : ''}
      </div>`;
  }

  // ---------- Summary strip ----------
  function summaryHTML(data) {
    const counts = new Map();
    data.forEach((p) => (p.tags || []).forEach((t) => counts.set(t, (counts.get(t) || 0) + 1)));
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 6);
    const max = top.length ? top[0][1] : 1;

    const tile = (v, l) => `<div class="stat"><span class="stat-v">${v}</span><span class="stat-l">${l}</span></div>`;
    return `
      <div class="stats">
        ${tile(data.length, 'projects')}
        ${tile(counts.size, 'technologies')}
      </div>
      <figure class="bars">
        <figcaption class="kicker">Most-used technologies <span class="dim">· projects per tag</span></figcaption>
        <ul>
          ${top.map(([t, n]) => `
            <li data-tag="${esc(t)}" tabindex="0">
              <span class="bar-l">${esc(t)}</span>
              <span class="bar-t"><span class="bar-f" style="--w:${(n / max) * 100}%"></span></span>
              <span class="bar-v">${n}</span>
            </li>`).join('')}
        </ul>
      </figure>`;
  }

  // ---------- Boot ----------
  async function init() {
    let data;
    try {
      data = (await (await fetch(root.dataset.source)).json()).filter((p) => !p.draft);
    } catch (err) {
      gridEl.innerHTML = '<p class="kicker">Could not load projects.</p>';
      console.error(err);
      return;
    }

    const cards = data.map((p, i) => {
      const el = document.createElement('article');
      el.className = 'pcard';
      el.style.setProperty('--d', `${(i % 3) * 70}ms`);
      el.innerHTML = cardHTML(p, i);
      gridEl.appendChild(el);
      return { el, data: p };
    });

    gridEl.addEventListener('click', (e) => {
      const b = e.target.closest('.chip-more');
      if (!b) return;
      const open = b.closest('.pcard').classList.toggle('all-tags');
      b.setAttribute('aria-expanded', String(open));
      b.textContent = open ? 'show less' : b.dataset.more;
    });

    // Fade in when entering the viewport, out when leaving (both directions).
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => e.target.classList.toggle('in', e.isIntersecting));
      }, { threshold: 0.12, rootMargin: '-4% 0px -4% 0px' });
      cards.forEach((c) => io.observe(c.el));
    } else {
      cards.forEach((c) => c.el.classList.add('in'));
    }

    // Filters
    let active = 'All';
    let activeTag = null;
    // Categories ordered by how many projects carry them.
    const catCount = new Map();
    data.forEach((p) => catsOf(p).forEach((c) => catCount.set(c, (catCount.get(c) || 0) + 1)));
    const cats = ['All', ...[...catCount.keys()].sort((a, b) => catCount.get(b) - catCount.get(a) || a.localeCompare(b))];
    filtersEl.innerHTML = cats.map((c) => {
      const n = c === 'All' ? data.length : catCount.get(c);
      return `<button type="button" class="pf" data-cat="${esc(c)}" aria-pressed="${c === active}">${esc(c)} <span class="n">${n}</span></button>`;
    }).join('');

    function apply() {
      cards.forEach(({ el, data: p }) => {
        const show = (active === 'All' || catsOf(p).includes(active)) && (!activeTag || (p.tags || []).includes(activeTag));
        if (show) {
          if (el.hidden) { el.hidden = false; void el.offsetWidth; }
          el.classList.remove('gone');
        } else if (!el.hidden) {
          el.classList.add('gone');
          setTimeout(() => { if (el.classList.contains('gone')) el.hidden = true; }, 280);
        }
      });
      filtersEl.querySelectorAll('.pf').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cat === active && !activeTag)));
      summaryEl.querySelectorAll('.bars li').forEach((li) => li.classList.toggle('on', li.dataset.tag === activeTag));
    }

    filtersEl.addEventListener('click', (e) => {
      const b = e.target.closest('.pf');
      if (!b) return;
      active = b.dataset.cat;
      activeTag = null;
      apply();
    });

    if (summaryEl) {
      summaryEl.innerHTML = summaryHTML(data);
      requestAnimationFrame(() => summaryEl.classList.add('in'));
      // Bars double as tag filters; hover shows which projects use the tag.
      const tip = document.createElement('div');
      tip.className = 'bar-tip';
      summaryEl.appendChild(tip);
      summaryEl.querySelectorAll('.bars li').forEach((li) => {
        const tag = li.dataset.tag;
        const names = data.filter((p) => (p.tags || []).includes(tag)).map((p) => p.title);
        const show = () => {
          tip.innerHTML = `<strong>${esc(tag)}</strong> · ${names.length} project${names.length > 1 ? 's' : ''}<br>${names.map(esc).join('<br>')}<div class="dim">click to filter</div>`;
          const r = li.getBoundingClientRect(), base = summaryEl.getBoundingClientRect();
          tip.style.left = `${r.left - base.left + Math.min(r.width - 220, 120)}px`;
          tip.style.top = `${r.bottom - base.top + 6}px`;
          tip.classList.add('show');
        };
        const hide = () => tip.classList.remove('show');
        const toggle = () => { activeTag = activeTag === tag ? null : tag; active = 'All'; apply(); };
        li.addEventListener('mouseenter', show);
        li.addEventListener('focus', show);
        li.addEventListener('mouseleave', hide);
        li.addEventListener('blur', hide);
        li.addEventListener('click', toggle);
        li.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
      });
    }
  }

  init();
})();
