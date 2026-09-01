/* ==========================================================================
   KM.DEV — AI DEVELOPER COURSE
   core.js · motion system, cursor, loader, navigation, reveal engine, router
   No dependencies. transform/opacity/clip-path only.
   ========================================================================== */

window.KM = window.KM || {};

(function (KM) {
  'use strict';

  /* ---------------------------------------------------------------- utils */

  const $  = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp  = (a, b, t) => a + (b - a) * t;
  const RM = window.matchMedia('(prefers-reduced-motion: reduce)');
  const FINE = window.matchMedia('(hover: hover) and (pointer: fine)');

  KM.$ = $; KM.$$ = $$; KM.clamp = clamp; KM.lerp = lerp;
  KM.reduced = () => RM.matches;
  KM.fine = () => FINE.matches;

  /* ------------------------------------------------- shared rAF scheduler */

  const frameJobs = new Set();
  let running = false;
  function tick() {
    frameJobs.forEach((fn) => fn());
    if (frameJobs.size) requestAnimationFrame(tick);
    else running = false;
  }
  KM.onFrame = function (fn) {
    frameJobs.add(fn);
    if (!running) { running = true; requestAnimationFrame(tick); }
    return () => frameJobs.delete(fn);
  };

  /* ------------------------------------------------ scroll subscription */

  const scrollJobs = new Set();
  let sy = window.scrollY, ticking = false;
  function flushScroll() {
    ticking = false;
    scrollJobs.forEach((fn) => fn(sy));
  }
  window.addEventListener('scroll', () => {
    sy = window.scrollY;
    if (!ticking) { ticking = true; requestAnimationFrame(flushScroll); }
  }, { passive: true });
  window.addEventListener('resize', () => { sy = window.scrollY; flushScroll(); }, { passive: true });

  KM.onScroll = function (fn) { scrollJobs.add(fn); fn(window.scrollY); return () => scrollJobs.delete(fn); };

  /* -------------------------------------------------- teardown registry */

  let teardowns = [];
  KM.cleanup = function (fn) { if (fn) teardowns.push(fn); };
  KM.destroyPage = function () {
    teardowns.forEach((fn) => { try { fn(); } catch (e) {} });
    teardowns = [];
  };

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  KM.wait = wait;

  /* ====================================================== text splitting */

  KM.split = function (root) {
    $$('[data-split]', root).forEach((el) => {
      if (el.dataset.splitDone) return;
      el.dataset.splitDone = '1';
      const lines = el.innerHTML.split(/<br\s*\/?>/i);
      let i = 0;
      el.innerHTML = lines.map((line) => {
        const words = line.trim().split(/\s+/).filter(Boolean).map((w) => {
          const d = (i++) * 65;
          return '<span class="reveal-word" style="--wd:' + d + 'ms">' + w + '</span>';
        }).join(' ');
        return '<span class="reveal-line">' + words + '</span>';
      }).join('');
    });
  };

  /* ======================================================= reveal engine */

  KM.reveals = function (root) {
    const items = $$('[data-reveal]', root);
    if (!items.length) return;
    if (KM.reduced()) { items.forEach((e) => e.classList.add('is-in')); return; }

    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const el = en.target;
        const stagger = parseInt(el.dataset.stagger || '0', 10);
        if (stagger) {
          const kids = Array.from(el.children);
          kids.forEach((k, i) => { k.style.setProperty('--rd', (i * stagger) + 'ms'); });
        }
        el.classList.add('is-in');
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });

    items.forEach((el) => io.observe(el));
    KM.cleanup(() => io.disconnect());
  };

  /* ============================================================== cursor */

  KM.cursor = function () {
    if (!FINE.matches || KM.reduced()) return;
    if ($('.cursor')) return;

    const dot = document.createElement('div');
    dot.className = 'cursor';
    const ring = document.createElement('div');
    ring.className = 'cursor-ring';
    const label = document.createElement('span');
    label.className = 'cursor-ring__label';
    ring.appendChild(label);
    document.body.appendChild(dot);
    document.body.appendChild(ring);

    let mx = window.innerWidth / 2, my = window.innerHeight / 2;
    let rx = mx, ry = my;

    window.addEventListener('mousemove', (e) => {
      // only ever reveal it once a real pointer has actually moved
      if (!document.documentElement.classList.contains('has-cursor')) {
        rx = e.clientX; ry = e.clientY;
        document.documentElement.classList.add('has-cursor');
      }
      mx = e.clientX; my = e.clientY;
      dot.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0)';
    }, { passive: true });

    document.addEventListener('mouseleave', () => document.documentElement.classList.add('cursor-hidden'));
    document.addEventListener('mouseenter', () => document.documentElement.classList.remove('cursor-hidden'));

    KM.onFrame(function () {
      rx = lerp(rx, mx, 0.16);
      ry = lerp(ry, my, 0.16);
      ring.style.transform = 'translate3d(' + rx + 'px,' + ry + 'px,0)';
    });

    // contextual state
    const root = document.documentElement;
    function evaluate(e) {
      const t = e.target.closest ? e.target.closest('[data-cursor],a,button,.qopt,.chapter,.code-line--pick') : null;
      if (!t) { root.classList.remove('cursor-active', 'cursor-link'); return; }
      const txt = t.getAttribute && t.getAttribute('data-cursor');
      if (txt) {
        label.textContent = txt;
        root.classList.add('cursor-active');
        root.classList.remove('cursor-link');
      } else {
        root.classList.add('cursor-link');
        root.classList.remove('cursor-active');
      }
    }
    document.addEventListener('mouseover', evaluate, { passive: true });
    document.addEventListener('mouseout', (e) => {
      if (!e.relatedTarget) root.classList.remove('cursor-active', 'cursor-link');
    }, { passive: true });

    // dark-surface detection — the cursor inverts over ink sections
    window.addEventListener('mousemove', () => {
      const el = document.elementFromPoint(clamp(mx, 1, window.innerWidth - 2), clamp(my, 1, window.innerHeight - 2));
      const dark = el && el.closest && el.closest('.on-dark,.statement,.transform,.footer,.final,.menu');
      root.classList.toggle('cursor-dark', !!dark);
    }, { passive: true });
  };

  /* =========================================================== magnetic */

  KM.magnetic = function (root) {
    if (!FINE.matches || KM.reduced()) return;
    $$('[data-magnetic]', root).forEach((el) => {
      const strength = parseFloat(el.dataset.magnetic) || 0.28;
      const max = 14;
      let tx = 0, ty = 0, cx = 0, cy = 0, active = false, stop = null;

      function loop() {
        cx = lerp(cx, tx, 0.18); cy = lerp(cy, ty, 0.18);
        el.style.transform = 'translate3d(' + cx.toFixed(2) + 'px,' + cy.toFixed(2) + 'px,0)';
        if (!active && Math.abs(cx) < 0.05 && Math.abs(cy) < 0.05) {
          el.style.transform = '';
          if (stop) { stop(); stop = null; }
        }
      }
      function start() { if (!stop) stop = KM.onFrame(loop); }

      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        tx = clamp((e.clientX - (r.left + r.width / 2)) * strength, -max, max);
        ty = clamp((e.clientY - (r.top + r.height / 2)) * strength, -max, max);
        active = true; start();
      });
      el.addEventListener('mouseleave', () => { tx = 0; ty = 0; active = false; start(); });
    });
  };

  /* ============================================================= loader */

  KM.loader = function () {
    const el = $('.loader');
    if (!el) return Promise.resolve();
    let seen = false;
    try { seen = sessionStorage.getItem('km-seen') === '1'; } catch (e) {}
    if (seen || KM.reduced()) {
      el.remove();
      document.body.classList.remove('is-locked');
      return Promise.resolve();
    }
    try { sessionStorage.setItem('km-seen', '1'); } catch (e) {}

    const bar = $('.loader__bar', el);
    const count = $('.loader__count', el);
    const status = $('.loader__status', el);
    const steps = [
      ['01 / 04', 'Initializing experience', 0.25],
      ['02 / 04', 'Loading brand system', 0.5],
      ['03 / 04', 'Compiling interactions', 0.78],
      ['04 / 04', 'Ready', 1]
    ];

    document.body.classList.add('is-locked');
    el.classList.add('is-ready');

    return (async function () {
      await wait(240);
      for (const [c, s, p] of steps) {
        count.textContent = c;
        status.textContent = s;
        bar.style.transform = 'scaleX(' + p + ')';
        await wait(300);
      }
      await wait(220);
      el.classList.add('is-done');
      document.body.classList.remove('is-locked');
      document.body.classList.add('is-hero-ready');
      await wait(700);
      el.remove();
    })();
  };

  /* ========================================================== navigation */

  KM.nav = function () {
    const nav = $('.nav');
    if (!nav) return;
    let last = window.scrollY;
    KM.onScroll(function (y) {
      nav.classList.toggle('is-stuck', y > 24);
      const menuOpen = document.body.classList.contains('is-locked');
      if (!menuOpen) nav.classList.toggle('is-hidden', y > 420 && y > last + 4);
      last = y;
    });

    const burger = $('.burger');
    const menu = $('.menu');
    if (burger && menu) {
      const toggle = (force) => {
        const open = force !== undefined ? force : !menu.classList.contains('is-open');
        menu.classList.toggle('is-open', open);
        burger.classList.toggle('is-open', open);
        burger.setAttribute('aria-expanded', String(open));
        document.body.classList.toggle('is-locked', open);
        nav.classList.remove('is-hidden');
      };
      burger.addEventListener('click', () => toggle());
      $$('.menu a', menu).forEach((a) => a.addEventListener('click', () => toggle(false)));
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') toggle(false); });
      KM.closeMenu = () => toggle(false);
    }
  };

  /* ================================================================ i18n */

  KM.setLang = function (lang) {
    document.documentElement.lang = lang;
    try { localStorage.setItem('km-lang', lang); } catch (e) {}
    $$('[data-en]').forEach((el) => {
      const v = el.getAttribute('data-' + lang);
      if (v != null) el.textContent = v;
    });
    $$('[data-en-html]').forEach((el) => {
      const v = el.getAttribute('data-' + lang + '-html');
      if (v != null) el.innerHTML = v;
    });
    $$('[data-en-aria]').forEach((el) => {
      const v = el.getAttribute('data-' + lang + '-aria');
      if (v != null) el.setAttribute('aria-label', v);
    });
    $$('.lang__btn').forEach((b) => b.classList.toggle('is-active', b.dataset.lang === lang));
    document.dispatchEvent(new CustomEvent('km:lang', { detail: lang }));
  };

  KM.currentLang = function () {
    let l = 'en';
    try { l = localStorage.getItem('km-lang') || 'en'; } catch (e) {}
    return l === 'nl' ? 'nl' : 'en';
  };

  KM.langBar = function () {
    $$('.lang__btn').forEach((b) => {
      b.addEventListener('click', () => KM.setLang(b.dataset.lang));
    });
  };

  /* ============================================================== router */
  /* Multi-page site with soft page transitions. Falls back to a normal
     browser navigation whenever anything is unusual — never traps the user. */

  const CACHE = new Map();
  const bundled = () => !!window.KM_PAGES;

  function pageKey(href) {
    if (!href) return 'index.html';
    if (href.charAt(0) === '#' && bundled()) {
      const k = href.slice(1).split('#')[0];
      return (window.KM_PAGES[k] ? k : 'index') + '.html';
    }
    const u = new URL(href, location.href);
    let p = u.pathname.split('/').pop();
    if (!p) p = 'index.html';
    return p;
  }

  async function fetchPage(href) {
    if (window.KM_PAGES) {                       // single-file bundle mode
      const key = pageKey(href).replace('.html', '');
      const tpl = window.KM_PAGES[key] || window.KM_PAGES.index;
      return tpl;
    }
    const key = pageKey(href);
    if (CACHE.has(key)) return CACHE.get(key);
    const res = await fetch(href, { credentials: 'same-origin' });
    if (!res.ok) throw new Error('bad status');
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const main = doc.querySelector('.page-main');
    if (!main) throw new Error('no main');
    const payload = { html: main.innerHTML, title: doc.title, page: main.dataset.page || key };
    CACHE.set(key, payload);
    return payload;
  }

  KM.go = async function (href, push) {
    const main = $('.page-main');
    const pt = $('.pt');
    if (!main) { location.href = href; return; }

    let payload;
    try { payload = await fetchPage(href); }
    catch (e) { location.href = href; return; }

    if (KM.closeMenu) KM.closeMenu();

    if (pt && !KM.reduced()) {
      pt.classList.remove('is-uncover');
      pt.classList.add('is-cover');
      await wait(560);
    }

    KM.destroyPage();
    main.innerHTML = payload.html;
    main.dataset.page = payload.page;
    document.title = payload.title;
    window.scrollTo(0, 0);

    $$('.nav__link').forEach((a) => {
      a.classList.toggle('is-active', pageKey(a.getAttribute('href')) === pageKey(href));
    });

    if (push !== false) {
      const url = bundled() ? '#' + pageKey(href).replace('.html', '') : href;
      history.pushState({ href: href }, '', url);
    }

    KM.boot(main);

    const frag = (href.split('#')[1] || '');
    if (frag && !(bundled() && href.charAt(0) === '#')) {
      const t = document.getElementById(frag);
      if (t) t.scrollIntoView({ behavior: 'auto', block: 'start' });
    }

    if (pt && !KM.reduced()) {
      pt.classList.remove('is-cover');
      pt.classList.add('is-uncover');
      await wait(760);
      pt.classList.remove('is-uncover');
    }
  };

  KM.router = function () {
    if (location.protocol === 'file:' && !bundled()) return;  // let the browser handle it
    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      const a = e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      const href = a.getAttribute('href');
      if (!href || a.target === '_blank' || a.hasAttribute('download') || a.dataset.noRoute !== undefined) return;
      if (/^(https?:)?\/\//i.test(href) && new URL(href, location.href).origin !== location.origin) return;
      if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      if (!/\.html($|[?#])/.test(href) && href !== './' && href !== '/') return;
      e.preventDefault();
      if (pageKey(href) === pageKey(location.href)) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
      KM.go(href, true);
    });
    window.addEventListener('popstate', function (ev) {
      const href = (ev.state && ev.state.href) || (bundled() ? (location.hash || 'index.html') : location.href);
      KM.go(href, false);
    });

  };

  /* deep link straight into a page of the single-file bundle */
  function deepLink() {
    if (!bundled() || !location.hash) return null;
    const key = location.hash.slice(1).split('#')[0];
    return (window.KM_PAGES[key] && key !== 'index') ? location.hash : null;
  }

  /* =============================================================== boot */

  KM.modules = {};
  KM.register = function (name, fn) { KM.modules[name] = fn; };

  KM.boot = function (root) {
    root = root || document;
    KM.split(root);
    KM.reveals(root);
    KM.magnetic(root);
    Object.keys(KM.modules).forEach((k) => {
      try { KM.modules[k](root); } catch (e) { /* one module must never break the page */ }
    });
    KM.setLang(KM.currentLang());
  };

  KM.start = function () {
    KM.cursor();
    KM.nav();
    KM.langBar();
    KM.router();
    const deep = deepLink();
    if (deep) KM.go(deep, false);
    else KM.boot($('.page-main') || document);
    KM.loader().then(() => {
      document.body.classList.add('is-hero-ready');
      document.dispatchEvent(new CustomEvent('km:ready'));
    });
  };

  /* start after every module file has had a chance to register itself */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(KM.start, 0));
  } else {
    setTimeout(KM.start, 0);
  }
})(window.KM);
