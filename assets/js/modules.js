/* ==========================================================================
   KM.DEV — AI DEVELOPER COURSE
   modules.js · every interactive system on the site
   ========================================================================== */

(function (KM) {
  'use strict';

  const $ = KM.$, $$ = KM.$$, clamp = KM.clamp, lerp = KM.lerp, wait = KM.wait;

  /* ================================================== syntax highlighter */

  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* Masked tokenising: a finished token is parked behind a placeholder built
     from the letters A-J, so no later rule can match inside markup we already
     emitted. Everything is restored at the end. */
  const ENC = 'ABCDEFGHIJ';
  const encode = (n) => String(n).split('').map((d) => ENC[+d]).join('');
  const decode = (s) => parseInt(s.split('').map((c) => ENC.indexOf(c)).join(''), 10);
  const M0 = '\u0001', M1 = '\u0002';

  function hl(src, lang) {
    const store = [];
    const keep = (html) => { store.push(html); return M0 + encode(store.length - 1) + M1; };
    const wrap = (cls) => (m) => keep('<i class="' + cls + '">' + m + '</i>');

    let s = esc(src);

    if (lang === 'html') {
      s = s.replace(/&lt;!--[\s\S]*?--&gt;/g, wrap('tk-com'));
      s = s.replace(/\s([a-zA-Z-]+)="([^"]*)"/g, (m, a, v) =>
        ' ' + keep('<i class="tk-attr">' + a + '</i><i class="tk-punc">=</i><i class="tk-str">"' + v + '"</i>'));
      s = s.replace(/(&lt;\/?)([a-zA-Z][\w-]*)/g, (m, p, t) =>
        keep('<i class="tk-punc">' + p + '</i><i class="tk-tag">' + t + '</i>'));
      s = s.replace(/(\/?&gt;)/g, wrap('tk-punc'));
    } else if (lang === 'css') {
      s = s.replace(/\/\*[\s\S]*?\*\//g, wrap('tk-com'));
      s = s.replace(/^(\s*)([.#][\w\-.:>\s]*?)(\s*\{)/, (m, sp, sel, br) =>
        sp + keep('<i class="tk-sel">' + sel + '</i>') + keep('<i class="tk-punc">' + br + '</i>'));
      s = s.replace(/^(\s*)([a-z-]+)(\s*:)/, (m, sp, p, c) =>
        sp + keep('<i class="tk-prop">' + p + '</i>') + keep('<i class="tk-punc">' + c + '</i>'));
      s = s.replace(/#[0-9a-fA-F]{3,8}\b/g, wrap('tk-val'));
      s = s.replace(/\d+\.?\d*(px|rem|em|%|vh|vw|s|ms|deg|fr|ch)?/g, wrap('tk-num'));
    } else {
      s = s.replace(/\/\/.*$/g, wrap('tk-com'));
      s = s.replace(/(['"`])(?:(?!\1)[^\\]|\\.)*\1/g, wrap('tk-str'));
      s = s.replace(/\b(const|let|var|function|return|if|else|for|of|new|await|async|export|import|from|class)\b/g, wrap('tk-kw'));
      s = s.replace(/\b([a-z_$][\w$]*)(?=\()/g, wrap('tk-fn'));
      s = s.replace(/\d+\.?\d*/g, wrap('tk-num'));
    }

    let out = s, guard = 0;
    while (out.indexOf(M0) !== -1 && guard++ < 20) {
      out = out.replace(/\u0001([A-J]+)\u0002/g, (m, code) => store[decode(code)]);
    }
    return out;
  }

  KM.hl = hl;

  /* renders a static block of code lines; an entry may be a string or
     {t, lang} so one block can mix markup and styles */
  function renderLines(host, lines, lang, startAt) {
    host.innerHTML = '';
    lines.forEach((d, i) => {
      const t = typeof d === 'string' ? d : d.t;
      const l = typeof d === 'string' ? lang : (d.lang || lang);
      host.appendChild(lineEl(t, (startAt || 1) + i, l));
    });
  }

  function lineEl(text, n, lang) {
    const el = document.createElement('div');
    el.className = 'code-line';
    el.innerHTML = '<span class="code-line__n">' + n + '</span><span class="code-line__t">' + hl(text, lang) + '</span>';
    return el;
  }

  /* types a set of lines with human-irregular rhythm */
  async function typeLines(host, lines, lang, opts) {
    opts = opts || {};
    for (let i = 0; i < lines.length; i++) {
      if (opts.cancelled && opts.cancelled()) return;
      const raw = lines[i];
      const el = lineEl('', (opts.start || 1) + i, lang);
      const t = $('.code-line__t', el);
      host.appendChild(el);
      el.classList.add('is-active');
      if (host.parentElement) host.parentElement.scrollTop = host.scrollHeight;

      if (KM.reduced()) {
        t.innerHTML = hl(raw, lang);
      } else if (raw.trim() === '') {
        await wait(60);
      } else {
        const speed = raw.length > 40 ? 7 : 16;         // long lines stream faster
        for (let c = 1; c <= raw.length; c++) {
          t.textContent = raw.slice(0, c);
          if (c % 2 === 0) await wait(speed + Math.random() * 10);
        }
        t.innerHTML = hl(raw, lang);
      }
      el.classList.remove('is-active');
      if (!KM.reduced()) await wait(opts.gap != null ? opts.gap : 40 + Math.random() * 90);
    }
  }

  /* ======================================================== 05 · MACHINE */
  /* PROMPT → AI → CODE → BROWSER → WEBSITE, on load, then stays alive.    */

  const HERO_FILES = [
    {
      tab: 'index.html', lang: 'html', lines: [
        '<section class="hero">',
        '  <p class="eyebrow">Nordwerk Studio</p>',
        '  <h1 class="hero-title">Design that works.</h1>',
        '  <a class="cta" href="#work">See the work</a>',
        '</section>'
      ]
    },
    {
      tab: 'styles.css', lang: 'css', lines: [
        '.hero-title{',
        '  font-size: clamp(32px, 6vw, 72px);',
        '  letter-spacing: -0.04em;',
        '}'
      ]
    },
    {
      tab: 'script.js', lang: 'js', lines: [
        'const cards = document.querySelectorAll(".card");',
        'reveal(cards, { stagger: 80 });'
      ]
    }
  ];

  KM.register('machine', function (root) {
    const box = $('[data-machine]', root);
    if (!box) return;

    let dead = false;
    KM.cleanup(() => { dead = true; });
    const cancelled = () => dead;

    const field = $('.prompt__field', box);
    const send = $('.prompt__send', box);
    const ghost = $('.ghost-cursor', box);
    const thinks = $$('.think', box);
    const tabs = $$('.editor__tab', box);
    const body = $('[data-code]', box);
    const term = $('.term', box);
    const rows = $$('.term__row', term || box);
    const skel = $('.machine__skeleton', box);
    const idle = $('.machine__idle', box);
    const site = $('.machine__preview .site', box);
    const chip = $('[data-chip]', box);
    const promptText = field ? (field.dataset.type || '') : '';

    function moveGhost(target, ox, oy) {
      if (!ghost || !target) return;
      const b = box.getBoundingClientRect();
      const r = target.getBoundingClientRect();
      ghost.style.transform = 'translate3d(' +
        (r.left - b.left + (ox == null ? r.width * 0.25 : ox)) + 'px,' +
        (r.top - b.top + (oy == null ? r.height * 0.5 : oy)) + 'px,0)';
    }

    function setChip(cls, text) {
      if (!chip) return;
      chip.className = 'chip ' + cls;
      const s = $('span', chip);
      if (s) s.textContent = text;
    }

    async function run() {
      if (KM.reduced()) {
        field.innerHTML = '<span>' + promptText + '</span>';
        HERO_FILES.forEach((f, i) => { if (i === 0) renderLines(body, f.lines, f.lang, 1); });
        tabs.forEach((t) => t.classList.remove('is-pending'));
        thinks.forEach((t) => t.classList.add('is-in', 'is-done'));
        rows.forEach((r) => r.classList.add('is-in'));
        if (idle) idle.classList.add('is-off');
        if (skel) skel.classList.add('is-off');
        if (site) site.classList.add('is-live');
        setChip('chip is-ok', 'Live');
        return;
      }

      await wait(260);
      ghost.style.transition = 'transform 900ms cubic-bezier(.33,1,.68,1), opacity 300ms linear';
      moveGhost(box, 60, 300);
      ghost.classList.add('is-on');
      await wait(120);
      moveGhost(field, 30, 26);
      await wait(760);
      if (cancelled()) return;

      field.classList.add('is-focus');
      field.innerHTML = '<span class="ptxt"></span><span class="caret"></span>';
      const ptxt = $('.ptxt', field);
      for (let i = 1; i <= promptText.length; i++) {
        if (cancelled()) return;
        ptxt.textContent = promptText.slice(0, i);
        await wait(promptText[i - 1] === ' ' ? 26 : 18 + Math.random() * 34);
      }
      await wait(420);
      $('.caret', field) && $('.caret', field).remove();

      moveGhost(send, 34, 18);
      await wait(560);
      if (cancelled()) return;
      send.classList.add('is-hit');
      await wait(160);
      send.classList.remove('is-hit');
      field.classList.remove('is-focus');
      field.classList.add('is-sent');
      ghost.classList.remove('is-on');

      setChip('chip is-work', 'Thinking');
      for (let i = 0; i < thinks.length; i++) {
        if (cancelled()) return;
        thinks[i].classList.add('is-in');
        await wait(420);
        thinks[i].classList.add('is-done');
      }

      setChip('chip is-work', 'Generating');
      body.innerHTML = '';
      let n = 1;
      for (let f = 0; f < HERO_FILES.length; f++) {
        if (cancelled()) return;
        tabs.forEach((t, i) => {
          t.classList.toggle('is-active', i === f);
          t.classList.toggle('is-pending', i > f);
        });
        if (f > 0) { body.innerHTML = ''; n = 1; }
        await typeLines(body, HERO_FILES[f].lines, HERO_FILES[f].lang, { start: n, cancelled: cancelled });
        n += HERO_FILES[f].lines.length;
        await wait(320);
      }

      // build
      for (let i = 0; i < rows.length; i++) {
        if (cancelled()) return;
        rows[i].classList.add('is-in');
        if (i === 0) { setChip('chip is-work', 'Building'); if (idle) idle.classList.add('is-off'); if (skel) skel.classList.add('is-on'); }
        if (i === 1) setChip('chip is-work', 'Compiling');
        await wait(560);
      }
      if (cancelled()) return;
      if (skel) skel.classList.add('is-off');
      if (site) site.classList.add('is-live');
      setChip('chip is-ok', 'Live');
      tabs.forEach((t) => t.classList.remove('is-pending'));
      showFile(0);                       // rest on the file you would open first
    }

    /* the editor stays usable once the sequence is done */
    function showFile(i) {
      tabs.forEach((t, n) => t.classList.toggle('is-active', n === i));
      renderLines(body, HERO_FILES[i].lines, HERO_FILES[i].lang, 1);
    }
    tabs.forEach((t, i) => {
      t.setAttribute('tabindex', '0');
      t.setAttribute('data-cursor', 'Open');
      const open = () => { if (!t.classList.contains('is-pending')) showFile(i); };
      t.addEventListener('click', open);
      t.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });

    // start once the hero is actually on screen
    const io = new IntersectionObserver((en) => {
      if (en[0].isIntersecting) { io.disconnect(); run(); }
    }, { threshold: 0.2 });
    io.observe(box);
    KM.cleanup(() => io.disconnect());

    // stays interactive: re-run on demand
    const replay = $('[data-replay]', box);
    if (replay) replay.addEventListener('click', function () {
      thinks.forEach((t) => t.classList.remove('is-in', 'is-done'));
      rows.forEach((r) => r.classList.remove('is-in'));
      if (idle) idle.classList.remove('is-off');
      if (skel) skel.classList.remove('is-on', 'is-off');
      if (site) site.classList.remove('is-live');
      field.classList.remove('is-sent');
      field.innerHTML = '<span class="prompt__ph">' + (field.dataset.ph || '') + '</span>';
      body.innerHTML = '';
      run();
    });
  });

  /* ====================================================== 09 · TRANSFORM */

  KM.register('transform', function (root) {
    const track = $('[data-transform]', root);
    if (!track) return;
    const panels = $$('.tpanel', track);
    const steps = $$('.tstep', track);
    const bar = $('.transform__progress', track);
    const promptBox = $('.tpanel__prompt', track);
    const codeHost = $('[data-tcode]', track);

    if (codeHost) {
      renderLines(codeHost, [
        { t: '<!-- index.html -->', lang: 'html' },
        { t: '<section class="hero">', lang: 'html' },
        { t: '  <p class="eyebrow">Studio Vanhorn</p>', lang: 'html' },
        { t: '  <h1>We build brands that behave.</h1>', lang: 'html' },
        { t: '  <a class="cta" href="#work">Selected work</a>', lang: 'html' },
        { t: '</section>', lang: 'html' },
        { t: '', lang: 'html' },
        { t: '/* styles.css */', lang: 'css' },
        { t: '.hero{ padding: 120px 0; }', lang: 'css' },
        { t: '.hero h1{', lang: 'css' },
        { t: '  font-size: clamp(40px, 7vw, 96px);', lang: 'css' },
        { t: '  letter-spacing: -0.04em;', lang: 'css' },
        { t: '  line-height: 0.96;', lang: 'css' },
        { t: '}', lang: 'css' },
        { t: '.cta{ border-radius: 28px; }', lang: 'css' }
      ], 'html', 1);
    }

    let cur = -1;
    const off = KM.onScroll(function () {
      const r = track.getBoundingClientRect();
      const total = track.offsetHeight - window.innerHeight;
      const p = clamp((-r.top) / (total || 1), 0, 1);
      if (bar) bar.style.setProperty('--p', p.toFixed(4));

      const idx = p < 0.22 ? 0 : p < 0.46 ? 1 : p < 0.74 ? 2 : 3;
      if (promptBox) promptBox.classList.toggle('is-full', p > 0.34);
      if (idx !== cur) {
        cur = idx;
        panels.forEach((el, i) => el.classList.toggle('is-on', i === idx));
        steps.forEach((el, i) => el.classList.toggle('is-on', i <= idx));
      }
    });
    KM.cleanup(off);
  });

  /* ==================================================== 11 · ERROR → FIX */

  KM.register('fixdemo', function (root) {
    const box = $('[data-fix]', root);
    if (!box) return;

    const appBtn = $('[data-app-btn]', box);
    const toast = $('.fix__toast', box);
    const chatBody = $('.chat__body', box);
    const askBtn = $('[data-ask]', box);
    const applyBtn = $('[data-apply]', box);
    const codeHost = $('[data-fixcode]', box);
    const chip = $('[data-fixchip]', box);
    const msgs = $$('.msg', chatBody);

    const BROKEN = [
      'const btn = document.querySelector(".btn-subscribe");',
      '',
      'btn.addEventListener("click", () => {',
      '  subscribe();',
      '});'
    ];
    const FIXED = [
      'const btn = document.querySelector(".btn-sub");',
      '',
      'btn?.addEventListener("click", () => {',
      '  subscribe();',
      '});'
    ];

    let state = 0;
    function setChip(cls, text) {
      if (!chip) return;
      chip.className = 'chip ' + cls;
      const s = $('span', chip);
      if (s) s.textContent = text;
    }

    renderLines(codeHost, BROKEN, 'js', 1);
    $$('.code-line', codeHost)[0].classList.add('is-del');

    function showToast(text, ok) {
      if (!toast) return;
      const s = $('span', toast);
      if (s) s.textContent = text;
      toast.classList.toggle('is-ok', !!ok);
      toast.classList.add('is-on');
    }

    if (appBtn) appBtn.addEventListener('click', function () {
      if (state >= 2) { showToast(appBtn.dataset.okmsg || 'Subscribed.', true); return; }
      showToast(appBtn.dataset.errmsg || 'Nothing happens. TypeError: btn is null', false);
      if (askBtn) askBtn.removeAttribute('disabled');
    });

    if (askBtn) askBtn.addEventListener('click', async function () {
      if (state >= 1) return;
      state = 1;
      askBtn.setAttribute('disabled', '');
      setChip('chip is-work', 'Analyzing');
      for (let i = 0; i < msgs.length; i++) {
        msgs[i].classList.add('is-in');
        chatBody.scrollTop = chatBody.scrollHeight;
        await wait(i === 0 ? 420 : 900);
      }
      setChip('chip is-error', 'Problem detected');
      if (applyBtn) applyBtn.removeAttribute('disabled');
    });

    if (applyBtn) applyBtn.addEventListener('click', async function () {
      if (state >= 2) return;
      state = 2;
      applyBtn.setAttribute('disabled', '');
      setChip('chip is-work', 'Applying fix');
      const lines = $$('.code-line', codeHost);
      lines[0].classList.add('is-del');
      await wait(420);
      const el = lineEl(FIXED[0], 1, 'js');
      el.classList.add('is-add');
      lines[0].replaceWith(el);
      lines[2] && lines[2].classList.add('is-add');
      $('.code-line__t', lines[2]).innerHTML = hl(FIXED[2], 'js');
      await wait(520);
      setChip('chip is-ok', 'Fixed');
      if (appBtn) appBtn.classList.add('is-fixed');
      showToast(appBtn ? (appBtn.dataset.okmsg || 'Subscribed.') : 'Fixed.', true);
    });
  });

  /* ================================================ 12 · BEFORE / AFTER */

  KM.register('slider', function (root) {
    const ba = $('[data-ba]', root);
    if (!ba) return;
    const handle = $('.ba__handle', ba);
    const pct = $('.ba__pct', ba);
    let x = 0.5, vx = 0, target = 0.5, dragging = false, last = 0.5, stopFrame = null;

    function paint() {
      ba.style.setProperty('--x', (x * 100).toFixed(2) + '%');
      if (pct) pct.textContent = Math.round(x * 100) + '%';
    }
    paint();

    function frame() {
      if (dragging) {
        vx = (target - x) * 0.35;
        x += vx;
      } else {
        vx *= 0.92;                                   // momentum
        x += vx;
        // gentle snapping near the thirds
        const snaps = [0.08, 0.5, 0.92];
        let near = null;
        snaps.forEach((s) => { if (Math.abs(x - s) < 0.045) near = s; });
        if (near !== null && Math.abs(vx) < 0.006) x = lerp(x, near, 0.14);
        if (Math.abs(vx) < 0.0004 && (near === null || Math.abs(x - near) < 0.001)) {
          if (stopFrame) { stopFrame(); stopFrame = null; }
        }
      }
      x = clamp(x, 0.02, 0.98);
      paint();
    }
    function ensure() { if (!stopFrame) stopFrame = KM.onFrame(frame); }

    function pos(e) {
      const r = ba.getBoundingClientRect();
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      return clamp((cx - r.left) / r.width, 0.02, 0.98);
    }
    function down(e) {
      dragging = true; ba.classList.add('is-drag');
      target = pos(e); last = target; ensure();
      if (e.cancelable) e.preventDefault();
    }
    function move(e) {
      if (!dragging) return;
      target = pos(e);
      vx = (target - last) * 0.6; last = target;
    }
    function up() {
      if (!dragging) return;
      dragging = false; ba.classList.remove('is-drag');
      ensure();
    }

    ba.addEventListener('mousedown', down);
    ba.addEventListener('touchstart', down, { passive: false });
    window.addEventListener('mousemove', move, { passive: true });
    window.addEventListener('touchmove', move, { passive: true });
    window.addEventListener('mouseup', up);
    window.addEventListener('touchend', up);

    // keyboard (27)
    if (handle) {
      handle.setAttribute('tabindex', '0');
      handle.setAttribute('role', 'slider');
      handle.setAttribute('aria-valuemin', '0');
      handle.setAttribute('aria-valuemax', '100');
      handle.addEventListener('keydown', function (e) {
        const step = e.shiftKey ? 0.1 : 0.03;
        if (e.key === 'ArrowLeft') { x = clamp(x - step, 0.02, 0.98); paint(); e.preventDefault(); }
        if (e.key === 'ArrowRight') { x = clamp(x + step, 0.02, 0.98); paint(); e.preventDefault(); }
        handle.setAttribute('aria-valuenow', Math.round(x * 100));
      });
    }

    KM.cleanup(function () {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchend', up);
      if (stopFrame) stopFrame();
    });
  });

  /* ======================================================= 13 · TIMELINE */

  KM.register('timeline', function (root) {
    const tl = $('[data-timeline]', root);
    if (!tl) return;
    const chapters = $$('.chapter', tl);
    const spine = $('.timeline__spine i', tl);
    const views = $$('.tv', tl);
    let active = -1;

    function setActive(i) {
      if (i === active) return;
      active = i;
      chapters.forEach((c, n) => c.classList.toggle('is-on', n === i));
      views.forEach((v, n) => v.classList.toggle('is-on', n === i));
    }

    const off = KM.onScroll(function () {
      const mid = window.innerHeight * 0.42;
      let best = 0, bestD = Infinity;
      chapters.forEach((c, i) => {
        const r = c.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - mid);
        if (d < bestD) { bestD = d; best = i; }
      });
      setActive(best);
      if (spine) {
        const first = chapters[0].getBoundingClientRect();
        const lastR = chapters[chapters.length - 1].getBoundingClientRect();
        const span = lastR.bottom - first.top;
        const p = clamp((mid - first.top) / (span || 1), 0, 1);
        spine.style.setProperty('--h', (p * 100).toFixed(2) + '%');
      }
    });
    KM.cleanup(off);

    chapters.forEach((c, i) => {
      c.addEventListener('click', () => {
        setActive(i);
        c.scrollIntoView({ behavior: KM.reduced() ? 'auto' : 'smooth', block: 'center' });
      });
      c.setAttribute('tabindex', '0');
      c.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); c.click(); } });
    });
  });

  /* ============================================= 14/15 · CODE EXPLAINER */

  KM.register('explainer', function (root) {
    const box = $('[data-explainer]', root);
    if (!box) return;
    const host = $('[data-xcode]', box);
    const site = $('.site', box);
    const note = $('.explainer__note', box);
    if (!host || !site) return;

    /* each entry: code text, the element it draws, and (optionally) the live
       values it cycles through — code and design change together. */
    const LINES = [
      { t: '.hero{', lang: 'css' },
      { t: '  padding: 22px;', lang: 'css', el: 'root', prop: 'padding',
        cycle: ['22px', '48px', '12px'], apply: (v) => site.style.setProperty('--sp', v),
        note: ['padding', 'Space is a design decision. Change one value and the whole composition breathes differently.'] },
      { t: '  background: #ffffff;', lang: 'css', el: 'root',
        note: ['background', 'The surface colour. Everything else is judged against it.'] },
      { t: '}', lang: 'css' },
      { t: '', lang: 'css' },
      { t: '.hero-title{', lang: 'css' },
      { t: '  font-size: 34px;', lang: 'css', el: 'title', prop: 'font-size',
        cycle: ['34px', '52px', '22px'], apply: (v) => { $('.site__title', site).style.fontSize = v; },
        note: ['font-size', 'Typography carries the hierarchy. This single line decides what the visitor reads first.'] },
      { t: '  letter-spacing: -0.035em;', lang: 'css', el: 'title',
        note: ['letter-spacing', 'Large type needs tighter tracking. Defaults are set for body text, not headlines.'] },
      { t: '}', lang: 'css' },
      { t: '', lang: 'css' },
      { t: '.cta{', lang: 'css' },
      { t: '  border-radius: 14px;', lang: 'css', el: 'cta', prop: 'border-radius',
        cycle: ['14px', '999px', '2px'], apply: (v) => site.style.setProperty('--rad', v),
        note: ['border-radius', 'Radius sets the tone. Sharp reads technical, round reads friendly — pick on purpose.'] },
      { t: '}', lang: 'css' },
      { t: '', lang: 'css' },
      { t: '.card{ aspect-ratio: 4 / 3; }', lang: 'css', el: 'cards',
        note: ['aspect-ratio', 'Fixing the ratio is what stops the grid from jumping while images load.'] }
    ];

    const targets = {
      root: site,
      title: $('.site__title', site),
      cta: $('.site__cta', site),
      cards: $('.site__grid', site)
    };

    host.innerHTML = '';
    LINES.forEach((def, i) => {
      const el = lineEl(def.t, i + 1, def.lang);
      if (def.el) {
        el.classList.add('code-line--pick');
        el.setAttribute('tabindex', '0');
        el.setAttribute('role', 'button');
        el.setAttribute('data-cursor', 'Inspect');
        const hint = document.createElement('span');
        hint.className = 'code-line__hint';
        hint.textContent = def.cycle ? 'click to change' : 'click to inspect';
        el.appendChild(hint);
        let step = 0;

        const activate = () => {
          $$('.code-line--pick', host).forEach((l) => l.classList.remove('is-sel'));
          el.classList.add('is-sel');
          Object.keys(targets).forEach((k) => targets[k] && targets[k].classList.remove('is-hi'));
          const tgt = targets[def.el];
          if (tgt) tgt.classList.add('is-hi');
          if (def.cycle) {
            step = (step + 1) % def.cycle.length;
            const v = def.cycle[step];
            def.apply(v);
            const txt = '  ' + def.prop + ': ' + v + ';';
            const holder = $('.code-line__t', el);
            holder.innerHTML = hl(txt, 'css');
            holder.classList.add('is-changing');
            setTimeout(() => holder.classList.remove('is-changing'), 260);
          }
          if (note && def.note) {
            $('b', note).textContent = def.note[0];
            $('p', note).textContent = def.note[1];
          }
        };

        el.addEventListener('click', activate);
        el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); } });
      }
      host.appendChild(el);
    });
  });

  /* ================================================ 21 · PROMPT BUILDER */

  KM.register('builder', function (root) {
    const box = $('[data-builder]', root);
    if (!box) return;
    const out = $('[data-bout]', box);
    const meter = $('.builder__meter', box);
    const counter = $('[data-bcount]', box);
    const opts = $$('.opt', box);
    const chosen = {};

    function render() {
      const keys = Object.keys(chosen).filter((k) => chosen[k]);
      const base = out.dataset.base || 'Build';
      let s = base;
      const order = ['goal', 'audience', 'style', 'layout', 'function', 'constraints'];
      order.forEach((k) => { if (chosen[k]) s += ' ' + chosen[k]; });
      out.innerHTML = '<span class="seg seg-base is-on">' + esc(s) + '</span>';
      const p = keys.length / 6;
      if (meter) meter.style.setProperty('--p', p.toFixed(3));
      if (counter) counter.textContent = keys.length + ' / 6';
    }

    opts.forEach((o) => {
      o.addEventListener('click', function () {
        const g = o.dataset.group;
        const on = o.classList.contains('is-on');
        $$('.opt[data-group="' + g + '"]', box).forEach((x) => x.classList.remove('is-on'));
        if (on) { chosen[g] = null; }
        else { o.classList.add('is-on'); chosen[g] = o.dataset.value; }
        render();
      });
    });

    document.addEventListener('km:lang', render);
    KM.cleanup(() => document.removeEventListener('km:lang', render));
    render();
  });

  /* ==================================================== 22 · MINI LESSON */

  KM.register('quiz', function (root) {
    $$('[data-quiz]', root).forEach(function (q) {
      const opts = $$('.qopt', q);
      const verdict = $('.quiz__verdict', q);
      opts.forEach((o) => {
        o.addEventListener('click', function () {
          if (q.classList.contains('is-answered')) return;
          q.classList.add('is-answered');
          opts.forEach((x) => {
            const right = x.dataset.right !== undefined;
            x.classList.add(right ? 'is-right' : 'is-wrong');
            const v = $('.qopt__v', x);
            if (v) v.textContent = right ? (x.dataset.vgood || 'Strong prompt') : (x.dataset.vbad || 'Too vague');
          });
          if (verdict) verdict.classList.add('is-on');
        });
      });
    });
  });

  /* ============================================= 17/18 · GALLERY FOLLOWER */

  KM.register('gallery', function (root) {
    const gal = $('[data-gallery]', root);
    if (!gal) return;
    const follower = $('.follower');
    if (!follower || !KM.fine() || KM.reduced()) return;

    const previews = $$('.pv', follower);
    let mx = 0, my = 0, fx = 0, fy = 0, scale = 0, tScale = 0, stop = null, vx = 0;

    /* the preview sits beside the cursor, never under it, and is kept inside
       the viewport; it lags with a little mass and leans into its velocity */
    function target() {
      const w = follower.offsetWidth || 280;
      const h = follower.offsetHeight || 200;
      const tx = clamp(mx + w / 2 + 30, w / 2 + 16, window.innerWidth - w / 2 - 16);
      const ty = clamp(my, h / 2 + 16, window.innerHeight - h / 2 - 16);
      return [tx, ty];
    }

    function frame() {
      const [tx, ty] = target();
      fx = lerp(fx, tx, 0.13);
      fy = lerp(fy, ty, 0.13);
      vx = lerp(vx, clamp((tx - fx) * 0.05, -5, 5), 0.1);
      scale = lerp(scale, tScale, 0.14);
      follower.style.transform =
        'translate3d(' + fx.toFixed(1) + 'px,' + fy.toFixed(1) + 'px,0) translate(-50%,-50%) scale(' + scale.toFixed(3) + ') rotate(' + vx.toFixed(2) + 'deg)';
      if (tScale === 0 && scale < 0.005) { follower.classList.remove('is-on'); if (stop) { stop(); stop = null; } }
    }
    function ensure() { if (!stop) stop = KM.onFrame(frame); }

    gal.addEventListener('mousemove', (e) => { mx = e.clientX; my = e.clientY; }, { passive: true });

    $$('.proj', gal).forEach((p) => {
      p.addEventListener('mouseenter', (e) => {
        mx = e.clientX; my = e.clientY;
        if (scale < 0.01) { const t = target(); fx = t[0]; fy = t[1]; }
        previews.forEach((v) => v.classList.toggle('is-on', v.dataset.pv === p.dataset.pv));
        follower.classList.add('is-on');
        tScale = 1; ensure();
      });
      p.addEventListener('mouseleave', () => { tScale = 0; ensure(); });
    });
    gal.addEventListener('mouseleave', () => { tScale = 0; ensure(); });
    KM.cleanup(() => { if (stop) stop(); follower.classList.remove('is-on'); });
  });

  /* =========================================================== 19 · MORPH */

  KM.register('morph', function (root) {
    $$('[data-morph]', root).forEach(function (m) {
      const words = $$('span', m);
      let cur = -1;
      const off = KM.onScroll(function () {
        const r = m.getBoundingClientRect();
        const p = clamp((window.innerHeight - r.top) / (window.innerHeight + r.height), 0, 1);
        const i = clamp(Math.floor(p * words.length * 1.02), 0, words.length - 1);
        if (i !== cur) {
          cur = i;
          words.forEach((w, n) => w.classList.toggle('is-on', n === i));
        }
      });
      KM.cleanup(off);
    });
  });

  /* ============================================================= 33 · FAQ */

  KM.register('faq', function (root) {
    $$('.qa', root).forEach(function (qa) {
      const btn = $('.qa__btn', qa);
      const panel = $('.qa__panel', qa);
      if (!btn || !panel) return;
      const id = 'qa-' + Math.random().toString(36).slice(2, 8);
      panel.id = id;
      btn.setAttribute('aria-controls', id);
      btn.setAttribute('aria-expanded', 'false');
      btn.addEventListener('click', function () {
        const open = !qa.classList.contains('is-open');
        $$('.qa', root).forEach((o) => {
          o.classList.remove('is-open');
          const b = $('.qa__btn', o); if (b) b.setAttribute('aria-expanded', 'false');
        });
        qa.classList.toggle('is-open', open);
        btn.setAttribute('aria-expanded', String(open));
      });
    });
  });

  /* ============================================================ 34 · LOOP */

  KM.register('loop', function (root) {
    const loop = $('[data-loop]', root);
    if (!loop) return;
    const words = $$('.loop__w', loop);
    let i = 0, timer = null;
    const io = new IntersectionObserver((en) => {
      if (en[0].isIntersecting && !timer && !KM.reduced()) {
        timer = setInterval(() => {
          words.forEach((w, n) => w.classList.toggle('is-on', n === i % words.length));
          i++;
        }, 900);
      } else if (!en[0].isIntersecting && timer) { clearInterval(timer); timer = null; }
    }, { threshold: 0.3 });
    io.observe(loop);
    KM.cleanup(() => { io.disconnect(); if (timer) clearInterval(timer); });
  });

  /* ====================================== 16 · statement scroll behaviour */
  /* "AI writes." recedes as you scroll. "You build." stays. */

  KM.register('statement', function (root) {
    $$('.statement', root).forEach(function (sec) {
      const a = $('.statement__l--a', sec);
      if (!a || KM.reduced()) return;
      const off = KM.onScroll(function () {
        const r = sec.getBoundingClientRect();
        const p = clamp((window.innerHeight * 0.5 - r.top) / (window.innerHeight * 0.85), 0, 1);
        a.style.opacity = String(1 - p * 0.92);
        a.style.transform = 'translate3d(0,' + (-p * 26).toFixed(1) + 'px,0)';
      });
      KM.cleanup(off);
    });
  });

  /* ================================================ 07 · sticky scale-out */

  KM.register('handoff', function (root) {
    const h = $('[data-handoff]', root);
    if (!h || KM.reduced()) return;
    const target = $('.machine__preview', h) || h;
    const off = KM.onScroll(function () {
      const r = h.getBoundingClientRect();
      const p = clamp((window.innerHeight - r.bottom) / (window.innerHeight * 0.9), 0, 1);
      target.style.transform = 'scale(' + (1 + p * 0.05).toFixed(4) + ')';
      target.style.opacity = String(1 - p * 0.85);
    });
    KM.cleanup(off);
  });

})(window.KM);
