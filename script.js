(() => {
  'use strict';

  const svg = document.getElementById('gardenSvg');
  const stemPath = document.getElementById('stemPath');
  const liliesLayer = document.getElementById('liliesLayer');
  const leavesLayer = document.getElementById('leavesLayer');
  const finalMessage = document.getElementById('finalMessage');
  const scrollHint = document.getElementById('scrollHint');
  const beatTexts = document.querySelectorAll('.beat-text');

  const VB_W = 1000;
  const VB_H = 1000;
  const BASE_X = 500;     // stem base x
  const BASE_Y = 1000;    // stem base y (bottom of viewBox)
  const MAX_STEM_Y = 150; // topmost point the stem reaches at 100% growth (before lilies appear stage)

  // Gentle S-curve sway points for the stem, defined as fractions of full growth.
  const swayPoints = [
    { t: 0,    dx: 0 },
    { t: 0.25, dx: -26 },
    { t: 0.5,  dx: 18 },
    { t: 0.75, dx: -14 },
    { t: 1,    dx: 8 },
  ];

  function swayAt(t) {
    // piecewise linear interpolation between sway points
    for (let i = 0; i < swayPoints.length - 1; i++) {
      const a = swayPoints[i], b = swayPoints[i + 1];
      if (t >= a.t && t <= b.t) {
        const local = (t - a.t) / (b.t - a.t || 1);
        return a.dx + (b.dx - a.dx) * local;
      }
    }
    return swayPoints[swayPoints.length - 1].dx;
  }

  function stemPointAt(t) {
    // t in [0,1] -> point along stem from base to current tip
    const y = BASE_Y - (BASE_Y - MAX_STEM_Y) * t;
    const x = BASE_X + swayAt(t);
    return { x, y };
  }

  function buildStemPath(growth) {
    // growth in [0,1]. Build a smooth path using several sample points up to `growth`.
    if (growth <= 0) return `M ${BASE_X} ${BASE_Y} L ${BASE_X} ${BASE_Y}`;
    const SAMPLES = 24;
    const pts = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const t = (i / SAMPLES) * growth;
      pts.push(stemPointAt(t));
    }
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const midX = ((prev.x + curr.x) / 2).toFixed(1);
      const midY = ((prev.y + curr.y) / 2).toFixed(1);
      d += ` Q ${prev.x.toFixed(1)} ${prev.y.toFixed(1)} ${midX} ${midY}`;
    }
    const last = pts[pts.length - 1];
    d += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
    return d;
  }

  // ---------- Leaves ----------
  // A handful of leaves at fixed growth-thresholds along the stem, fading/scaling in.
  const leafDefs = [
    { t: 0.18, side: 1,  len: 90,  width: 34 },
    { t: 0.30, side: -1, len: 100, width: 38 },
    { t: 0.46, side: 1,  len: 80,  width: 30 },
    { t: 0.60, side: -1, len: 86,  width: 32 },
  ];

  function leafPathD(x, y, side, len, width, angleDeg) {
    // a simple leaf blade as a quadratic-curve teardrop, pointing outward+upward
    const rad = (angleDeg * Math.PI) / 180;
    const tipX = x + Math.cos(rad) * len * side;
    const tipY = y - Math.sin(rad) * len;
    const ctrl1X = x + Math.cos(rad) * len * 0.35 * side - Math.sin(rad) * width * 0.5;
    const ctrl1Y = y - Math.sin(rad) * len * 0.35 - Math.cos(rad) * width * 0.1;
    const ctrl2X = x + Math.cos(rad) * len * 0.35 * side + Math.sin(rad) * width * 0.5;
    const ctrl2Y = y - Math.sin(rad) * len * 0.35 + Math.cos(rad) * width * 0.1;
    return `M ${x.toFixed(1)} ${y.toFixed(1)} Q ${ctrl1X.toFixed(1)} ${ctrl1Y.toFixed(1)} ${tipX.toFixed(1)} ${tipY.toFixed(1)} Q ${ctrl2X.toFixed(1)} ${ctrl2Y.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)} Z`;
  }

  const leafEls = leafDefs.map((def) => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', 'leaf');
    path.style.opacity = '0';
    path.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    path.style.transformBox = 'fill-box';
    leavesLayer.appendChild(path);
    return { def, el: path };
  });

  function updateLeaves(growth) {
    leafEls.forEach(({ def, el }) => {
      if (growth >= def.t) {
        const p = stemPointAt(def.t);
        const angle = 38;
        el.setAttribute('d', leafPathD(p.x, p.y, def.side, def.len, def.width, angle));
        const reveal = Math.min(1, (growth - def.t) / 0.12);
        el.style.opacity = String(0.92 * reveal);
        el.style.transform = `scale(${0.7 + 0.3 * reveal})`;
      } else {
        el.style.opacity = '0';
      }
    });
  }

  // ---------- Lilies ----------
  // Each lily blooms at a growth threshold (along the grown portion of stem) and at an offset.
  const lilyDefs = [
    { t: 0.34, side: -1, dist: 60,  scale: 0.78, rot: -14, petals: 6, variant: 0 },
    { t: 0.42, side: 1,  dist: 70,  scale: 0.95, rot: 10,  petals: 6, variant: 1 },
    { t: 0.50, side: -1, dist: 50,  scale: 0.7,  rot: -20, petals: 6, variant: 0 },
    { t: 0.58, side: 1,  dist: 64,  scale: 0.88, rot: 16,  petals: 6, variant: 1 },
    { t: 0.66, side: -1, dist: 74,  scale: 1.0,  rot: -8,  petals: 6, variant: 0 },
    { t: 0.72, side: 1,  dist: 56,  scale: 0.8,  rot: 20,  petals: 6, variant: 1 },
    { t: 0.80, side: -1, dist: 66,  scale: 0.92, rot: -16, petals: 6, variant: 0 },
    { t: 0.86, side: 1,  dist: 48,  scale: 0.7,  rot: 12,  petals: 6, variant: 1 },
    { t: 0.92, side: 0,  dist: 0,   scale: 1.15, rot: 0,   petals: 6, variant: 0 }, // crown lily at the very top
  ];

  function makePetalPath(length, width) {
    // pointed-oval petal, tip up, base at origin (0,0)
    return `M 0 0
            C ${-width * 0.55} ${-length * 0.32}, ${-width * 0.42} ${-length * 0.78}, 0 ${-length}
            C ${width * 0.42} ${-length * 0.78}, ${width * 0.55} ${-length * 0.32}, 0 0
            Z`;
  }

  function buildLily(def) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'lily-group');
    g.style.transition = 'opacity 0.9s ease';

    const petalLen = 78;
    const petalWidth = 34;
    const gradId = def.variant === 0 ? 'petalGrad' : 'petalGradAlt';
    const petalCount = def.petals;

    // Outer ring of petals
    for (let i = 0; i < petalCount; i++) {
      const angle = (360 / petalCount) * i;
      const petal = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      petal.setAttribute('class', 'petal');
      petal.setAttribute('d', makePetalPath(petalLen, petalWidth));
      petal.setAttribute('fill', `url(#${gradId})`);
      petal.setAttribute('stroke', 'rgba(255,255,255,0.18)');
      petal.setAttribute('stroke-width', '0.6');
      petal.setAttribute('transform', `rotate(${angle}) translate(0,2) rotate(0)`);
      petal.style.transformOrigin = '0px 0px';
      g.appendChild(petal);
    }

    // Inner smaller petals for depth
    for (let i = 0; i < petalCount; i++) {
      const angle = (360 / petalCount) * i + 30;
      const petal = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      petal.setAttribute('class', 'petal petal-inner');
      petal.setAttribute('d', makePetalPath(petalLen * 0.62, petalWidth * 0.7));
      petal.setAttribute('fill', `url(#${gradId})`);
      petal.setAttribute('opacity', '0.92');
      petal.setAttribute('transform', `rotate(${angle})`);
      petal.style.transformOrigin = '0px 0px';
      g.appendChild(petal);
    }

    // Center
    const center = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    center.setAttribute('r', '7');
    center.setAttribute('fill', 'url(#centerGrad)');
    g.appendChild(center);

    // Stamens
    for (let i = 0; i < 5; i++) {
      const angle = (360 / 5) * i + 15;
      const rad = (angle * Math.PI) / 180;
      const sx = Math.cos(rad) * 16;
      const sy = Math.sin(rad) * 16;
      const stamen = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      stamen.setAttribute('x1', '0');
      stamen.setAttribute('y1', '0');
      stamen.setAttribute('x2', sx.toFixed(1));
      stamen.setAttribute('y2', sy.toFixed(1));
      stamen.setAttribute('stroke', '#b5703f');
      stamen.setAttribute('stroke-width', '1.4');
      stamen.setAttribute('stroke-linecap', 'round');
      g.appendChild(stamen);
      const anther = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      anther.setAttribute('cx', sx.toFixed(1));
      anther.setAttribute('cy', sy.toFixed(1));
      anther.setAttribute('r', '2.4');
      anther.setAttribute('fill', '#7a4a2c');
      g.appendChild(anther);
    }

    liliesLayer.appendChild(g);
    return g;
  }

  const lilyEls = lilyDefs.map((def) => ({ def, g: buildLily(def), bloomed: false }));

  function updateLilies(growth) {
    lilyEls.forEach(({ def, g, bloomed: _b }, idx) => {
      if (growth >= def.t) {
        const anchorT = Math.min(def.t, growth);
        const p = stemPointAt(anchorT);
        const cx = p.x + def.side * def.dist;
        const cy = p.y - 10;

        const reveal = Math.min(1, (growth - def.t) / 0.1);
        const eased = reveal * reveal * (3 - 2 * reveal); // smoothstep
        const scale = def.scale * (0.35 + 0.65 * eased);

        g.setAttribute(
          'transform',
          `translate(${cx.toFixed(1)}, ${cy.toFixed(1)}) rotate(${def.rot}) scale(${scale.toFixed(3)})`
        );
        g.style.opacity = String(eased);
      } else {
        g.style.opacity = '0';
      }
    });
  }

  // ---------- Scroll-driven master update ----------
  let ticking = false;
  let lastProgress = -1;

  function getScrollProgress() {
    const doc = document.documentElement;
    const scrollTop = window.scrollY || doc.scrollTop;
    const maxScroll = doc.scrollHeight - window.innerHeight;
    if (maxScroll <= 0) return 0;
    return Math.min(1, Math.max(0, scrollTop / maxScroll));
  }

  // Growth completes by ~78% scroll so the last stretch is reserved for the message.
  const GROWTH_COMPLETE_AT = 0.78;
  const MESSAGE_START_AT = 0.86;
  const MESSAGE_FULL_AT = 0.98;

  function update() {
    const progress = getScrollProgress();
    if (Math.abs(progress - lastProgress) < 0.0008) {
      ticking = false;
      return;
    }
    lastProgress = progress;

    const growth = Math.min(1, progress / GROWTH_COMPLETE_AT);
    stemPath.setAttribute('d', buildStemPath(growth));
    updateLeaves(growth);
    updateLilies(growth);

    // Final message opacity
    let msgOpacity = 0;
    if (progress >= MESSAGE_START_AT) {
      msgOpacity = (progress - MESSAGE_START_AT) / (MESSAGE_FULL_AT - MESSAGE_START_AT);
      msgOpacity = Math.min(1, Math.max(0, msgOpacity));
      msgOpacity = msgOpacity * msgOpacity * (3 - 2 * msgOpacity);
    }
    finalMessage.style.opacity = String(msgOpacity);
    finalMessage.style.transform = `translateY(${(1 - msgOpacity) * 18}px)`;
    finalMessage.style.pointerEvents = msgOpacity > 0.4 ? 'auto' : 'none';

    // Scroll hint fade
    scrollHint.style.opacity = progress > 0.04 ? '0' : '1';

    ticking = false;
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();

  // ---------- Active beat text highlighting ----------
  const beatObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const textEl = entry.target.querySelector('.beat-text');
        if (!textEl) return;
        if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
          textEl.classList.add('is-active');
        } else {
          textEl.classList.remove('is-active');
        }
      });
    },
    { threshold: [0, 0.5, 1] }
  );
  document.querySelectorAll('.beat').forEach((b) => beatObserver.observe(b));

  // ---------- Music toggle ----------
  const musicBtn = document.getElementById('musicToggle');
  const audio = document.getElementById('bgMusic');
  audio.volume = 0.5;
  const labelEl = musicBtn.querySelector('.music-label');

  musicBtn.addEventListener('click', async () => {
    if (audio.paused) {
      try {
        await audio.play();
        musicBtn.classList.add('playing');
        labelEl.textContent = 'Pause music';
        musicBtn.setAttribute('aria-label', 'Pause background music');
      } catch (err) {
        console.error('Audio play failed:', err);
        labelEl.textContent = 'Music unavailable';
        musicBtn.setAttribute('aria-label', 'Music unavailable');
        // Try reloading the audio source; a subsequent user gesture may succeed.
        try {
          audio.load();
        } catch (e) {
          // ignore load errors
        }
        // Provide a tooltip hint for debugging in the UI
        musicBtn.title = 'Music unavailable — check audio file or browser settings';
      }
    } else {
      audio.pause();
      musicBtn.classList.remove('playing');
      labelEl.textContent = 'Play music';
      musicBtn.setAttribute('aria-label', 'Play background music');
    }
  });
})();
