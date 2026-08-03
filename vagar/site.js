/* VAGAR ADVISORY — depth and motion for the non-film pages.
   Enhancement is applied from here rather than hand-tagged in each page, so
   the five documents stay plain content. Everything is opt-out under
   prefers-reduced-motion and pointer-tilt only binds on hover-capable input. */

(function () {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---- scroll reveal --------------------------------------------------- */
  const revealTargets = document.querySelectorAll(
    '.band .card, .band ol.steps li, .band > .wrap > .kicker, .band > .wrap > .h,' +
    '.band > .wrap > .lede, .band .chips, .band .btnrow'
  );

  revealTargets.forEach(el => el.classList.add('reveal'));

  // Stagger siblings inside each grid so rows cascade instead of popping.
  document.querySelectorAll('.grid, ol.steps, .contact-grid').forEach(group => {
    [...group.children].forEach((child, i) => {
      child.style.setProperty('--rd', Math.min(i, 6) * 70 + 'ms');
    });
  });

  if (reduce || !('IntersectionObserver' in window)) {
    revealTargets.forEach(el => el.classList.add('is-in'));
  } else {
    const waiting = new Set(revealTargets);
    const show = (el) => { el.classList.add('is-in'); io.unobserve(el); waiting.delete(el); };

    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) show(e.target); });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
    revealTargets.forEach(el => io.observe(el));

    // Safety sweep. Jumping down the page in one go (anchor link, fast flick,
    // restored scroll position) takes a block straight from below the viewport
    // to above it — not-intersecting to not-intersecting — so the observer
    // never fires for it and it would stay invisible for good.
    let sweeping = false;
    const sweep = () => {
      waiting.forEach(el => { if (el.getBoundingClientRect().top < 0) show(el); });
      if (!waiting.size) removeEventListener('scroll', onScroll);
      sweeping = false;
    };
    const onScroll = () => {
      if (!sweeping) { sweeping = true; requestAnimationFrame(sweep); }
    };
    addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---- pointer tilt ----------------------------------------------------- */
  if (canHover && !reduce) {
    const MAX = 5.5;                        // degrees; past ~7 it reads as a gimmick
    const cards = document.querySelectorAll('.band .card, .band ol.steps li');
    let queued = false, pending = [];

    const flush = () => {
      pending.forEach(([el, rx, ry, mx, my]) => {
        el.style.setProperty('--rx', rx.toFixed(2) + 'deg');
        el.style.setProperty('--ry', ry.toFixed(2) + 'deg');
        el.style.setProperty('--mx', mx.toFixed(1) + '%');
        el.style.setProperty('--my', my.toFixed(1) + '%');
      });
      pending = []; queued = false;
    };

    cards.forEach(el => {
      el.classList.add('tilt');
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        pending.push([el, (0.5 - py) * MAX * 2, (px - 0.5) * MAX * 2, px * 100, py * 100]);
        if (!queued) { queued = true; requestAnimationFrame(flush); }
      });
      el.addEventListener('pointerleave', () => {
        el.style.setProperty('--rx', '0deg');
        el.style.setProperty('--ry', '0deg');
      });
    });
  }

  /* ---- image accordion --------------------------------------------------- */
  const acc = document.querySelector('.iacc');
  if (acc) {
    const items = [...acc.querySelectorAll('.iacc__item')];
    const setActive = (el) => items.forEach(i => i.classList.toggle('is-active', i === el));

    items.forEach(el => {
      // Hover drives it on a mouse; touch has no hover, so the panels stay a
      // swipeable strip there and a tap just opens the one you touched.
      if (canHover) el.addEventListener('pointerenter', () => setActive(el));
      el.addEventListener('click', () => setActive(el));
      el.addEventListener('focus', () => setActive(el));
    });

    // Arrow keys move between panels for keyboard users.
    acc.addEventListener('keydown', (e) => {
      const i = items.indexOf(document.activeElement);
      if (i < 0) return;
      const next = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : -1;
      if (next >= 0 && next < items.length) { e.preventDefault(); items[next].focus(); }
    });
  }

  /* ---- prefetch on intent ------------------------------------------------
     View transitions only smooth the swap; the page still has to arrive. Warm
     it while the pointer is on its way to the link. */
  const primed = new Set();
  const prime = (href) => {
    if (!href || primed.has(href)) return;
    primed.add(href);
    const l = document.createElement('link');
    l.rel = 'prefetch'; l.href = href; l.as = 'document';
    document.head.appendChild(l);
  };
  document.querySelectorAll('.site-nav a, .site-cta, .fnav a, .btn').forEach(a => {
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:')) return;
    a.addEventListener('pointerenter', () => prime(href), { once: true });
    a.addEventListener('focus', () => prime(href), { once: true });
  });

  /* ---- hero depth ------------------------------------------------------- */
  // The still and the headline ride the same scroll at different rates, which
  // reads as depth without a second asset.
  const hero = document.querySelector('.phero');
  if (hero && !reduce) {
    const img = hero.querySelector('.phero__img');
    const copy = hero.querySelector('.wrap');
    let ticking = false;

    const onScroll = () => {
      const y = window.scrollY;
      if (y > hero.offsetHeight + 200) { ticking = false; return; }
      const p = Math.min(y / Math.max(hero.offsetHeight, 1), 1);
      if (img) img.style.transform = `translate3d(0, ${(p * 14).toFixed(2)}%, 0) scale(${(1.06 + p * 0.06).toFixed(4)})`;
      if (copy) {
        copy.style.transform = `translate3d(0, ${(p * -26).toFixed(1)}px, 0)`;
        copy.style.opacity = String(Math.max(0, 1 - p * 1.15));
      }
      ticking = false;
    };

    if (img) img.style.willChange = 'transform';
    addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
    }, { passive: true });
    onScroll();
  }
})();
