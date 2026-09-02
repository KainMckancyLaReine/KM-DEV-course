/* ==========================================================================
   KM.dev — pricing, checkout and the confirmation screen
   --------------------------------------------------------------------------
   Two jobs.

   The first is that no number on the pricing page is written by hand. The
   price comes from the settings table and the programme's shape comes from
   course_outline() — a function any visitor may call, which returns titles and
   counts and nothing else. A page that advertises "40+ lessons" while the
   database holds 32 is lying about the first thing a buyer can check, so this
   file would rather render a dash for a moment than a number it invented.

   The second is the purchase itself. The browser starts a checkout and then
   waits; it never decides that a payment happened. That decision is made by
   Stripe's webhook against the database, and this file's only part in it is
   asking, politely and repeatedly, whether it has been made yet.
   ========================================================================== */

(function (KM) {
  'use strict';

  var $ = KM.$, $$ = KM.$$, clamp = KM.clamp;

  function nl() { return KM.currentLang() === 'nl'; }
  function t(en, du) { return nl() ? du : en; }

  /* ---------------------------------------------------------------- money */

  /* Minor units in, a price a person reads out. Dutch and English differ in
     the separators, so the locale follows the language toggle rather than the
     browser's idea of where the reader lives. */
  function money(amount, currency) {
    var value = (Number(amount) || 0) / 100;
    try {
      return new Intl.NumberFormat(nl() ? 'nl-NL' : 'en-IE', {
        style: 'currency', currency: currency || 'EUR',
        minimumFractionDigits: value % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2
      }).format(value);
    } catch (e) {
      return (currency === 'EUR' ? '€' : '') + value.toFixed(0);
    }
  }

  var PRICE = null;   /* { amount, currency, label } once it is known */

  function paintPrice() {
    if (!PRICE) return;
    var text = money(PRICE.amount, PRICE.currency);
    $$('[data-price]').forEach(function (el) { el.textContent = text; });
  }

  /* ------------------------------------------------------------ the data */

  /* Live, this is one RPC. In preview mode there is no server, so the same
     shape is assembled from the seed the browser already has — the pricing
     page then still shows the real programme, just the local copy of it. */
  function outline() {
    if (window.KMDB && KMDB.outline) {
      return KMDB.init().then(function () { return KMDB.outline(); });
    }
    return Promise.resolve(fromSeed());
  }

  /* Preview mode has no server, so the same shape is assembled from the seed
     the browser already holds. km-data.js uses this too. */
  function fromSeed() {
    var s = window.KM_SEED;
    if (!s) return { found: false };
    var levels = (s.levels || []).slice().sort(function (a, b) { return a.position - b.position; });
    var lessons = s.lessons || [];
    var per = function (id) { return lessons.filter(function (l) { return l.level_id === id; }); };

    return {
      found: true,
      course: s.course,
      price: { amount: 175000, currency: 'EUR' },
      totals: {
        levels: levels.length,
        lessons: lessons.length,
        published: lessons.filter(function (l) { return l.published; }).length,
        minutes: lessons.reduce(function (n, l) { return n + (l.estimated_minutes || 0); }, 0),
        projects: (s.projects || []).length,
        assessments: (s.quizzes || []).length,
        questions: (s.questions || []).length,
        prompts: (s.prompts || []).length
      },
      levels: levels.map(function (lv) {
        var ls = per(lv.id).sort(function (a, b) { return a.position - b.position; });
        return {
          position: lv.position, slug: lv.slug,
          title: lv.title, title_nl: lv.title_nl,
          description: lv.description, description_nl: lv.description_nl,
          lessons: ls.length,
          published: ls.filter(function (l) { return l.published; }).length,
          minutes: ls.reduce(function (n, l) { return n + (l.estimated_minutes || 0); }, 0),
          projects: (s.projects || []).filter(function (p) { return p.level_id === lv.id; }).length,
          assessments: (s.quizzes || []).filter(function (q) { return q.level_id === lv.id; }).length,
          lesson_titles: ls.map(function (l) {
            return { title: l.title, title_nl: l.title_nl,
                     minutes: l.estimated_minutes, published: l.published };
          })
        };
      })
    };
  }

  function pick(row, field) {
    if (!row) return '';
    var v = nl() ? row[field + '_nl'] : null;
    return (v && String(v).trim()) ? v : (row[field] || '');
  }

  function hhmm(minutes) {
    var h = Math.floor(minutes / 60), m = minutes % 60;
    if (!h) return m + 'm';
    return h + 'h' + (m ? ' ' + String(m).padStart(2, '0') + 'm' : '');
  }

  /* Counting up to a number reads as confidence; counting up to a number the
     reader is about to compare against a curriculum reads as theatre. So the
     numbers animate once, briefly, and never on a reduced-motion setting. */
  function countTo(el, value) {
    if (KM.reduced()) { el.textContent = String(value); return; }
    var from = 0, start = null, dur = 620;
    function step(ts) {
      if (start === null) start = ts;
      var p = clamp((ts - start) / dur, 0, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(from + (value - from) * eased));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ==================================================== 01 · the numbers */

  KM.register('pricing-facts', function (root) {
    var slots = $$('[data-out]', root);
    var curr  = $('[data-curriculum]', root);
    if (!slots.length && !curr) return;

    outline().then(function (o) {
      if (!o || !o.found) {
        if (curr) curr.innerHTML = '<p class="curr__loading mono">' +
          t('The programme could not be read just now.',
            'Het programma kon nu niet gelezen worden.') + '</p>';
        return;
      }
      if (o.price) { PRICE = o.price; paintPrice(); }

      var tot = o.totals || {};
      var values = {
        levels: tot.levels, lessons: tot.lessons, published: tot.published,
        projects: tot.projects, prompts: tot.prompts,
        questions: tot.questions, assessments: tot.assessments,
        hours: Math.round((tot.minutes || 0) / 60)
      };

      slots.forEach(function (el) {
        var v = values[el.getAttribute('data-out')];
        if (v == null) { el.textContent = '—'; return; }
        /* Wait until it is on screen, so the count is seen rather than missed. */
        if ('IntersectionObserver' in window && !KM.reduced()) {
          var io = new IntersectionObserver(function (es) {
            if (es[0].isIntersecting) { countTo(el, v); io.disconnect(); }
          }, { threshold: 0.4 });
          io.observe(el);
          KM.cleanup(function () { io.disconnect(); });
        } else {
          el.textContent = String(v);
        }
      });

      if (curr) renderCurriculum(curr, o);
      document.addEventListener('km:lang', function () {
        paintPrice();
        if (curr) renderCurriculum(curr, o);
      });
    }).catch(function () {
      if (curr) curr.innerHTML = '<p class="curr__loading mono">' +
        t('The programme could not be read just now.',
          'Het programma kon nu niet gelezen worden.') + '</p>';
    });
  });

  /* ================================================== 02 · the curriculum */

  function renderCurriculum(host, o) {
    var html = (o.levels || []).map(function (lv, i) {
      var n = String(lv.position || i + 1).padStart(2, '0');
      var lessons = lv.lesson_titles || [];
      var open = lv.published > 0;

      var items = lessons.map(function (l, j) {
        return '<li class="' + (l.published ? '' : 'is-draft') + '">' +
          '<b>' + String(j + 1).padStart(2, '0') + '</b>' +
          '<span>' + esc(pick(l, 'title')) + '</span>' +
          (l.published
            ? '<em>' + l.minutes + 'm</em>'
            : '<em>' + t('in writing', 'in ontwikkeling') + '</em>') +
          '</li>';
      }).join('');

      var meta = [
        lv.lessons + ' ' + (lv.lessons === 1 ? t('lesson', 'les') : t('lessons', 'lessen')),
        hhmm(lv.minutes || 0)
      ];
      if (lv.projects) meta.push(lv.projects + ' ' + t('project', 'project'));

      return '<div class="curr__lv" data-lv>' +
        '<button class="curr__btn" type="button" aria-expanded="false">' +
          '<span class="curr__n">Level ' + n + '</span>' +
          '<span><span class="curr__t">' + esc(pick(lv, 'title')) + '</span>' +
            '<span class="curr__d">' + esc(pick(lv, 'description')) + '</span></span>' +
          '<span class="curr__meta">' + meta.map(esc).join(' · ') +
            '<i class="curr__lock' + (open ? ' curr__lock--open' : '') + '" aria-hidden="true"></i>' +
          '</span>' +
        '</button>' +
        '<div class="curr__body"><div class="curr__inner">' +
          '<ul class="curr__lessons">' + items + '</ul>' +
        '</div></div>' +
      '</div>';
    }).join('');

    host.innerHTML = html;
    wireCurriculum(host);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function wireCurriculum(host) {
    $$('[data-lv]', host).forEach(function (lv) {
      var btn = $('.curr__btn', lv);
      var body = $('.curr__body', lv);
      var inner = $('.curr__inner', lv);

      btn.addEventListener('click', function () {
        var open = btn.getAttribute('aria-expanded') === 'true';

        /* One at a time: a curriculum with eight panels open is a list. */
        $$('[data-lv]', host).forEach(function (other) {
          if (other === lv) return;
          var b = $('.curr__btn', other), y = $('.curr__body', other);
          b.setAttribute('aria-expanded', 'false');
          y.style.height = '0px';
        });

        btn.setAttribute('aria-expanded', open ? 'false' : 'true');
        body.style.height = open ? '0px' : inner.offsetHeight + 'px';
      });
    });

    /* Height in pixels is what makes the transition possible, so it has to be
       recomputed when the column count changes underneath it. */
    var ro = 'ResizeObserver' in window && new ResizeObserver(function () {
      $$('[data-lv]', host).forEach(function (lv) {
        var btn = $('.curr__btn', lv), body = $('.curr__body', lv);
        if (btn.getAttribute('aria-expanded') === 'true') {
          body.style.height = $('.curr__inner', lv).offsetHeight + 'px';
        }
      });
    });
    if (ro) { ro.observe(host); KM.cleanup(function () { ro.disconnect(); }); }
  }

  /* ================================================ 03 · debugging demo */

  var FIX = [
    { en: 'TypeError: Cannot read properties of null (reading \'addEventListener\')\n  at script.js:40',
      nl: 'TypeError: Cannot read properties of null (reading \'addEventListener\')\n  at script.js:40' },
    { en: 'The script runs before the button exists. Line 40 looks for #subscribe\nin a document the parser has not reached yet — the element is null, and\nnull has no addEventListener.',
      nl: 'Het script draait voordat de knop bestaat. Regel 40 zoekt naar #subscribe\nin een document waar de parser nog niet is — het element is null, en\nnull heeft geen addEventListener.' },
    { en: 'Move the tag to the end of <body>, or add defer. One line.\nNot a try/catch around the symptom, and not a rewrite of the file.',
      nl: 'Verplaats de tag naar het eind van <body>, of zet er defer op. Eén regel.\nGeen try/catch om het symptoom heen, en geen herschrijving van het bestand.' },
    { en: 'Reload. Click it. The console stays quiet and the form submits.\nThen break it again on purpose, so you know the test was real.',
      nl: 'Herladen. Klikken. De console blijft stil en het formulier verstuurt.\nMaak het daarna expres weer stuk, zodat je weet dat de test echt was.' }
  ];

  KM.register('pricing-fix', function (root) {
    var host = $('[data-fixline]', root);
    var out = $('[data-fixline-out]', root);
    if (!host || !out) return;

    function show(i) {
      $$('.fixline__step', host).forEach(function (b, j) {
        b.classList.toggle('is-on', j <= i);
      });
      out.textContent = nl() ? FIX[i].nl : FIX[i].en;
    }

    $$('.fixline__step', host).forEach(function (b, i) {
      b.addEventListener('click', function () { show(i); });
    });
    document.addEventListener('km:lang', function () {
      var on = $$('.fixline__step.is-on', host).length;
      show(Math.max(0, on - 1));
    });
    show(0);
  });

  /* ============================================== 04 · responsive preview */

  KM.register('pricing-viewport', function (root) {
    var vp = $('[data-viewport]', root);
    if (!vp) return;
    var site = $('[data-vp-site]', vp);
    var grip = $('[data-vp-grip]', vp);
    var label = $('[data-vp-w]', vp);
    var body = $('.vp__body', vp);
    var frac = 1;

    function apply() {
      var full = body.clientWidth - 36;
      var w = Math.round(full * frac);
      site.style.width = w + 'px';
      /* The label reports the width the site believes it has, not the pixels
         on this screen, because that is the number a developer reasons with. */
      var shown = Math.round(1440 * frac);
      label.textContent = shown + 'px';
      vp.classList.toggle('is-narrow', shown < 900);
      vp.classList.toggle('is-tiny', shown < 560);
      grip.style.left = (18 + w - 13) + 'px';
    }

    function at(clientX) {
      var r = body.getBoundingClientRect();
      frac = clamp((clientX - r.left - 18) / (r.width - 36), 0.24, 1);
      apply();
    }

    var dragging = false;
    grip.addEventListener('pointerdown', function (e) {
      dragging = true; grip.setPointerCapture(e.pointerId); e.preventDefault();
    });
    grip.addEventListener('pointermove', function (e) { if (dragging) at(e.clientX); });
    grip.addEventListener('pointerup', function () { dragging = false; });
    grip.addEventListener('pointercancel', function () { dragging = false; });

    /* Keyboard: the demo is a control, so it answers to arrow keys. */
    grip.addEventListener('keydown', function (e) {
      var step = e.shiftKey ? 0.12 : 0.04;
      if (e.key === 'ArrowLeft') { frac = clamp(frac - step, 0.24, 1); apply(); e.preventDefault(); }
      if (e.key === 'ArrowRight') { frac = clamp(frac + step, 0.24, 1); apply(); e.preventDefault(); }
    });

    window.addEventListener('resize', apply);
    KM.cleanup(function () { window.removeEventListener('resize', apply); });
    apply();
  });

  /* ======================================================= 05 · journey */

  var STEPS = [
    { key: 'Idea', nl: 'Idee', url: '—',
      en_copy: 'A sentence and nothing else. No structure, no hierarchy, no idea what it should look like.',
      nl_copy: 'Eén zin en verder niets. Geen structuur, geen hiërarchie, nog geen beeld.',
      draw: function () {
        return '<div class="jf"><span class="jf__badge"><i></i>Idea</span>' +
          '<p class="jf__code">' + t('“I need a website for my studio.”',
                                      '“Ik heb een website nodig voor mijn studio.”') + '</p>' +
          '<div class="jf__line jf__line--a"></div><div class="jf__line jf__line--b"></div>' +
          '<div class="jf__line jf__line--c"></div></div>';
      } },
    { key: 'Prompt', nl: 'Prompt', url: 'claude.ai',
      en_copy: 'The same idea, said properly: who it is for, what it must do, and what is ruled out.',
      nl_copy: 'Hetzelfde idee, maar goed gezegd: voor wie, wat het moet doen, en wat is uitgesloten.',
      draw: function () {
        return '<div class="jf"><span class="jf__badge"><i></i>Prompt</span>' +
          '<div class="jf__chat"><div class="jf__msg jf__msg--me">' +
          t('A one-page site for a two-person studio. Visitors are art directors comparing ' +
            'shortlists. One action: view the work. ',
            'Een one-page site voor een studio van twee. Bezoekers zijn art directors die ' +
            'shortlists vergelijken. Eén actie: het werk bekijken. ') +
          '<b>' + t('No stock imagery, readable at 360px, three files.',
                    'Geen stockbeelden, leesbaar op 360px, drie bestanden.') +
          '</b></div></div></div>';
      } },
    { key: 'Claude', nl: 'Claude', url: 'claude.ai',
      en_copy: 'It answers with a structure first, so there is something to disagree with before there is code.',
      nl_copy: 'Het antwoordt eerst met een structuur, zodat er iets is om het oneens mee te zijn voordat er code is.',
      draw: function () {
        return '<div class="jf"><span class="jf__badge"><i></i>Structure</span>' +
          '<div class="jf__chat">' +
          '<div class="jf__msg">' +
          t('Five sections: a hero that states what you do, three project rows, a short about, ' +
            'one contact block.',
            'Vijf secties: een hero die zegt wat je doet, drie projectrijen, een kort over-blok ' +
            'en één contactblok.') + '</div>' +
          '<div class="jf__msg jf__msg--me">' +
          t('Agreed. Build the hero only.', 'Akkoord. Bouw alleen de hero.') + '</div>' +
          '</div></div>';
      } },
    { key: 'Code', nl: 'Code', url: 'index.html',
      en_copy: 'Now the code — and the first thing you do with it is read it.',
      nl_copy: 'Nu de code — en het eerste wat je ermee doet, is hem lezen.',
      draw: function () {
        return '<div class="jf"><span class="jf__badge"><i></i>index.html</span>' +
          '<p class="jf__code">&lt;<b>section</b> class="hero"&gt;\n' +
          '  &lt;<b>h1</b>&gt;Two people.\n      One studio.&lt;/<b>h1</b>&gt;\n' +
          '  &lt;<b>a</b> href="#work"&gt;See the work&lt;/<b>a</b>&gt;\n' +
          '&lt;/<b>section</b>&gt;</p></div>';
      } },
    { key: 'Design', nl: 'Design', url: 'studio-vanhorn.nl',
      en_copy: 'Typography, spacing and one accent. This is where a generated page starts looking like a decision.',
      nl_copy: 'Typografie, ruimte en één accent. Hier begint een gegenereerde pagina op een beslissing te lijken.',
      draw: function () {
        return '<div class="jf__site"><h4 class="jf__h">Two people.<br>One studio.</h4>' +
          '<div class="jf__row"><i></i><i></i><i></i></div></div>';
      } },
    { key: 'Debug', nl: 'Debug', url: 'studio-vanhorn.nl',
      en_copy: 'Something breaks. You describe it precisely, and the fix turns out to be two lines.',
      nl_copy: 'Er gaat iets stuk. Je beschrijft het precies, en de fix blijkt twee regels te zijn.',
      draw: function () {
        return '<div class="jf"><span class="jf__badge"><i></i>Console</span>' +
          '<p class="jf__code">' +
          t('At 380px the headline overlaps the nav.\n\n' +
            '<b>→</b> The hero has a fixed 120px top padding,\n  the nav wraps to two lines below 420px.\n' +
            '<b>→</b> Tie the padding to the nav height.',
            'Op 380px overlapt de kop de nav.\n\n' +
            '<b>→</b> De hero heeft een vaste top padding van 120px,\n  de nav breekt onder 420px naar twee regels.\n' +
            '<b>→</b> Koppel de padding aan de nav-hoogte.') + '</p></div>';
      } },
    { key: 'Responsive', nl: 'Responsive', url: 'studio-vanhorn.nl',
      en_copy: 'Then it has to hold at every width — not shrink, hold.',
      nl_copy: 'Daarna moet het op elke breedte standhouden — niet krimpen, standhouden.',
      draw: function () {
        return '<div class="jf__site" style="max-width:290px;margin:0 auto">' +
          '<h4 class="jf__h" style="font-size:20px">Two people.<br>One studio.</h4>' +
          '<div class="jf__row" style="grid-template-columns:1fr 1fr"><i></i><i></i></div></div>';
      } },
    { key: 'Animate', nl: 'Animate', url: 'studio-vanhorn.nl',
      en_copy: 'Motion last, and only where it carries meaning. Everything else stays still.',
      nl_copy: 'Beweging als laatste, en alleen waar het betekenis draagt. De rest blijft staan.',
      draw: function () {
        return '<div class="jf__site"><h4 class="jf__h">Two people.<br>One studio.</h4>' +
          '<div class="jf__row"><i style="opacity:.35"></i><i style="opacity:.7"></i><i></i></div>' +
          '<p class="jf__code" style="margin-top:14px">' +
          t('transform + opacity · 560ms · one curve',
            'transform + opacity · 560ms · één curve') + '</p></div>';
      } },
    { key: 'Test', nl: 'Test', url: 'studio-vanhorn.nl',
      en_copy: 'Keyboard, contrast, three widths, a slow connection. The boring pass that separates a demo from work.',
      nl_copy: 'Toetsenbord, contrast, drie breedtes, een trage verbinding. De saaie ronde die een demo van werk onderscheidt.',
      draw: function () {
        return '<div class="jf"><span class="jf__badge"><i></i>Checks</span>' +
          '<p class="jf__code">' +
          t('<b>✓</b> keyboard reaches every control\n' +
            '<b>✓</b> contrast passes on both grounds\n' +
            '<b>✓</b> 360 · 834 · 1440 clean\n' +
            '<b>✓</b> no layout shift on load',
            '<b>✓</b> toetsenbord bereikt elke bediening\n' +
            '<b>✓</b> contrast haalt het op beide gronden\n' +
            '<b>✓</b> 360 · 834 · 1440 schoon\n' +
            '<b>✓</b> geen layout shift bij het laden') + '</p></div>';
      } },
    { key: 'Deploy', nl: 'Deploy', url: 'studio-vanhorn.nl',
      en_copy: 'And it is online, at a real address, under your name.',
      nl_copy: 'En het staat online, op een echt adres, onder je eigen naam.',
      draw: function () {
        return '<div class="jf__site"><h4 class="jf__h">Two people.<br>One studio.</h4>' +
          '<div class="jf__row"><i></i><i></i><i></i></div>' +
          '<p class="jf__code" style="margin-top:14px"><b>● live</b>  studio-vanhorn.nl</p></div>';
      } }
  ];

  KM.register('journey', function (root) {
    var sec = $('[data-journey]', root);
    if (!sec) return;

    var title = $('[data-journey-title]', sec);
    var copy  = $('[data-journey-copy]', sec);
    var url   = $('[data-journey-url]', sec);
    var body  = $('[data-journey-body]', sec);
    var bar   = $('[data-journey-progress]', sec);
    var steps = $$('[data-journey-steps] li', sec);
    var last = -1;

    function paint(i) {
      if (i === last) return;
      last = i;
      var s = STEPS[i];
      title.textContent = nl() ? s.nl : s.key;
      copy.textContent = nl() ? s.nl_copy : s.en_copy;
      url.textContent = s.url;
      body.innerHTML = s.draw();
      steps.forEach(function (li, j) {
        li.classList.toggle('is-on', j === i);
        li.classList.toggle('is-past', j < i);
      });
    }

    /* The section is as tall as it has steps; the pin inside it holds while
       the page scrolls through them. Reduced motion gets step one and no pin,
       which the stylesheet has already arranged. */
    if (!KM.reduced()) {
      sec.style.height = (STEPS.length * 62) + 'vh';
    }

    var off = KM.onScroll(function () {
      var r = sec.getBoundingClientRect();
      var span = sec.offsetHeight - window.innerHeight;
      var p = span > 0 ? clamp(-r.top / span, 0, 1) : 0;
      bar.style.width = (p * 100).toFixed(2) + '%';
      paint(Math.min(STEPS.length - 1, Math.floor(p * STEPS.length * 0.999)));
    });
    KM.cleanup(off);

    document.addEventListener('km:lang', function () { var i = last; last = -1; paint(i < 0 ? 0 : i); });
    paint(0);
  });

  /* ================================================= 06 · the screenshots */

  /* Frames of the real application, captured by build/shots-pricing.js from
     the running academy. If a file is missing the panel says so rather than
     showing a placeholder that pretends to be the product. */
  var SHOTS = [
    ['dashboard',   'Dashboard',       'app-dashboard', 'km.dev/academy',
     'Where a session starts: what to do next, what is done, what is saved.',
     'Waar een sessie begint: wat je nu doet, wat af is, wat je bewaard hebt.'],
    ['course',      'Course',          'app-course', 'km.dev/academy/course',
     'Eight levels, each unlocking when the one before it is finished.',
     'Acht levels, elk gaat open als het vorige af is.'],
    ['lesson',      'Lesson',          'app-lesson', 'km.dev/academy/lesson',
     'A written lesson: text, diagrams drawn in CSS, prompts, and demos you operate.',
     'Een geschreven les: tekst, in CSS getekende diagrammen, prompts en demo’s die je zelf bedient.'],
    ['prompts',     'Prompt library',  'app-prompts', 'km.dev/academy/prompts',
     'Every prompt with the reasoning behind it, in four parts.',
     'Elke prompt met de redenering erachter, in vier delen.'],
    ['assessment',  'Assessment',      'app-assessment', 'km.dev/academy/assessment',
     'Graded on the server. The right answers are not in the page before you submit.',
     'Nagekeken op de server. De juiste antwoorden staan niet in de pagina voordat je inlevert.'],
    ['project',     'Project',         'app-project', 'km.dev/academy/project',
     'A written client brief, its requirements, and a checklist you work through.',
     'Een geschreven klantbriefing, de eisen, en een checklist die je afwerkt.'],
    ['progress',    'Progress',        'app-progress', 'km.dev/academy/progress',
     'Derived from the lessons themselves, so it cannot drift from what you did.',
     'Afgeleid uit de lessen zelf, dus het kan niet afwijken van wat je gedaan hebt.'],
    ['certificate', 'Certificate',     'app-certificate', 'km.dev/academy/certificate',
     'Issued once the work is finished — checked on the server, not claimed early.',
     'Uitgegeven als het werk af is — op de server gecontroleerd, niet te vroeg op te eisen.']
  ];

  KM.register('pricing-shots', function (root) {
    var host = $('[data-shots]', root);
    if (!host) return;
    var tabs = $('[data-shots-tabs]', host);
    var body = $('[data-shots-body]', host);
    var cap  = $('[data-shots-cap]', host);
    var url  = $('[data-shots-url]', host);
    var i = 0;

    tabs.innerHTML = SHOTS.map(function (s, j) {
      return '<button class="shots__tab" type="button" role="tab" ' +
             'aria-selected="' + (j === 0) + '" data-i="' + j + '">' + esc(s[1]) + '</button>';
    }).join('');

    function show(j) {
      i = j;
      var s = SHOTS[j];
      $$('.shots__tab', tabs).forEach(function (b, k) {
        b.setAttribute('aria-selected', String(k === j));
      });
      url.textContent = s[3];
      cap.textContent = nl() ? s[5] : s[4];
      body.innerHTML = '<img src="assets/img/shot-' + s[2] + '.png" alt="' +
        esc(s[1]) + ' — KM.dev Academy" loading="lazy" decoding="async">';
      var img = $('img', body);
      img.addEventListener('error', function () {
        body.innerHTML = '<p class="shots__missing">' +
          t('This frame has not been captured yet.',
            'Dit beeld is nog niet vastgelegd.') + '</p>';
      });
    }

    tabs.addEventListener('click', function (e) {
      var b = e.target.closest('.shots__tab');
      if (b) show(+b.getAttribute('data-i'));
    });
    tabs.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var next = (i + (e.key === 'ArrowRight' ? 1 : SHOTS.length - 1)) % SHOTS.length;
      show(next);
      $$('.shots__tab', tabs)[next].focus();
      e.preventDefault();
    });
    document.addEventListener('km:lang', function () { show(i); });
    show(0);
  });

  /* ============================================== 07 · sticky buy on mobile */

  KM.register('stickybuy', function (root) {
    var bar = $('[data-stickybuy]', root);
    if (!bar) return;
    var hero = $('.pricing-hero', root);
    var final = $('.final', root);

    var off = KM.onScroll(function () {
      if (!hero) return;
      var past = hero.getBoundingClientRect().bottom < 0;
      /* It stands down again at the bottom, where the page has its own CTA and
         a second one would just be in the way. */
      var atEnd = final && final.getBoundingClientRect().top < window.innerHeight * 0.9;
      bar.classList.toggle('is-on', past && !atEnd);
      bar.setAttribute('aria-hidden', String(!(past && !atEnd)));
    });
    KM.cleanup(off);
  });

  /* ==================================================== 08 · the purchase */

  /* Every "buy" control ends up here. If nobody is signed in the account has
     to exist first — the payment is attached to it — so the visitor is sent
     to sign up with a note about where they were going. */
  KM.register('buy', function (root) {
    $$('[data-buy]', root).forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        go();
      });
    });

    function go() {
      if (!window.KMDB) { location.href = 'checkout.html'; return; }
      KMDB.init().then(function () { return KMDB.getSession(); }).then(function (s) {
        if (!s) {
          try { sessionStorage.setItem('km-after-auth', 'checkout.html'); } catch (err) {}
          location.href = 'signup.html?next=checkout';
          return;
        }
        location.href = 'checkout.html';
      }).catch(function () { location.href = 'checkout.html'; });
    }
  });

  /* ==================================================== 09 · the checkout */

  KM.register('checkout', function (root) {
    var side = $('.co__side', root);
    if (!side) return;

    var payBtn  = $('[data-co-pay]', root);
    var errBox  = $('[data-co-err]', root);
    var account = $('[data-co-account]', root);
    var steps   = $$('[data-co-steps] li', root);

    function fail(msg) {
      errBox.textContent = msg;
      errBox.classList.add('is-on');
      payBtn.disabled = false;
      $('.btn__label', payBtn).textContent = t('Complete purchase', 'Aankoop afronden');
    }

    function step(i) {
      steps.forEach(function (li, j) { li.classList.toggle('is-on', j <= i); });
    }

    if (!window.KMDB) { fail(t('The account system is not loaded.', 'Het accountsysteem is niet geladen.')); return; }

    KMDB.init()
      .then(function () { return Promise.all([KMDB.getSession(), KMDB.outline()]); })
      .then(function (r) {
        var session = r[0], o = r[1];
        if (o && o.price) { PRICE = o.price; paintPrice(); }

        /* No account, no purchase to attach. Send them one step back rather
           than taking a payment that has nowhere to land. */
        if (!session) {
          step(0);
          account.innerHTML =
            '<div class="locked" style="margin-top:clamp(24px,3vw,34px)">' +
            '<span class="t-tag is-plain mono">' + t('First, an account', 'Eerst een account') + '</span>' +
            '<h2 class="t-h4 locked__h">' +
              t('A purchase belongs to an account.', 'Een aankoop hoort bij een account.') + '</h2>' +
            '<p class="locked__p">' +
              t('Create one — it takes a moment — and you will come straight back here.',
                'Maak er een aan — dat is zo gebeurd — en je komt hier meteen weer terug.') + '</p>' +
            '<div class="locked__buy">' +
              '<a class="btn btn--accent" href="signup.html?next=checkout"><span class="btn__label">' +
                t('Create an account', 'Account aanmaken') + '</span><i class="btn__arrow"></i></a>' +
              '<a class="xlink" href="login.html?next=checkout"><span>' +
                t('I already have one', 'Ik heb er al een') + '</span></a>' +
            '</div></div>';
          payBtn.disabled = true;
          return;
        }

        var user = session.user || session;
        account.innerHTML =
          '<div class="co__row" style="margin-top:clamp(24px,3vw,34px);border-top:1px solid var(--line);padding-top:16px">' +
          '<span>' + t('Signed in as', 'Ingelogd als') + '</span><b>' + esc(user.email || '') + '</b></div>';
        step(1);

        /* Already owns it — say so and point at the door rather than at a
           second payment. */
        return KMDB.accessState().then(function (a) {
          if (a && a.has_access) {
            payBtn.disabled = true;
            account.insertAdjacentHTML('beforeend',
              '<div class="locked" style="margin-top:22px">' +
              '<h2 class="t-h4 locked__h">' +
                t('You already have access.', 'Je hebt al toegang.') + '</h2>' +
              '<p class="locked__p">' +
                t('This account owns the course. There is nothing to pay.',
                  'Dit account bezit de cursus. Er valt niets te betalen.') + '</p>' +
              '<div class="locked__buy"><a class="btn btn--accent" href="app-dashboard.html">' +
              '<span class="btn__label">' + t('Open the academy', 'Open de academy') +
              '</span><i class="btn__arrow"></i></a></div></div>');
          }
        });
      })
      .catch(function (e) { fail(e.message || String(e)); });

    payBtn.addEventListener('click', function () {
      errBox.classList.remove('is-on');
      payBtn.disabled = true;
      $('.btn__label', payBtn).textContent = t('Opening Stripe…', 'Stripe wordt geopend…');
      step(1);

      KMDB.startCheckout().then(function (r) {
        if (!r || !r.url) throw new Error(t('No payment page was returned.',
                                            'Er kwam geen betaalpagina terug.'));
        location.href = r.url;
      }).catch(function (e) { fail(e.message || String(e)); });
    });
  });

  /* ================================================= 10 · you are in */

  KM.register('welcome', function (root) {
    var win = $('[data-welcome]', root);
    if (!win) return;

    var tag  = $('[data-win-tag]', win);
    var head = $('[data-win-h]', win);
    var sub  = $('[data-win-sub]', win);
    var note = $('[data-win-note]', win);
    var acts = $('[data-win-actions]', win);
    var seq  = $$('[data-win-seq] li', win);

    function light(upTo) {
      seq.forEach(function (li, i) { li.classList.toggle('is-on', i <= upTo); });
    }

    function arrived() {
      tag.textContent = t('Payment confirmed', 'Betaling bevestigd');
      head.textContent = t('You’re in.', 'Je bent binnen.');
      sub.textContent = t('Your AI Developer journey starts now.',
                          'Je reis als AI developer begint nu.');
      note.textContent = '';
      acts.hidden = false;

      /* The four lines light in sequence because that is the order the four
         things actually happened in, not to fill time. */
      if (KM.reduced()) { light(3); return; }
      [0, 1, 2, 3].forEach(function (i) {
        setTimeout(function () { light(i); }, 220 + i * 340);
      });
    }

    function waiting(seconds) {
      note.textContent = seconds > 20
        ? t('Still waiting on the payment provider. You can close this page — access is switched on server-side either way, and the dashboard will show it.',
            'We wachten nog op de betaalprovider. Je kunt deze pagina sluiten — de toegang wordt hoe dan ook op de server aangezet, en het dashboard laat het zien.')
        : '';
    }

    if (!window.KMDB) return;

    var started = Date.now();
    var timer = null;

    function poll() {
      KMDB.accessState().then(function (a) {
        if (a && a.has_access) { clearInterval(timer); arrived(); return; }
        var waited = Math.round((Date.now() - started) / 1000);
        light(a && a.purchase ? 0 : -1);
        waiting(waited);
        /* Two minutes is generous for a card and short for a bank transfer.
           After that we stop asking rather than spin forever. */
        if (waited > 120) {
          clearInterval(timer);
          tag.textContent = t('Not confirmed yet', 'Nog niet bevestigd');
          head.textContent = t('Almost.', 'Bijna.');
          sub.textContent = t('The payment has not been confirmed to the server yet. Some methods settle after a delay. Your access will switch on by itself the moment it does.',
                              'De betaling is nog niet bij de server bevestigd. Sommige methodes worden met vertraging afgerond. Je toegang gaat vanzelf aan zodra dat gebeurt.');
          note.textContent = t('Nothing is lost — this page is only watching.',
                               'Er gaat niets verloren — deze pagina kijkt alleen mee.');
          acts.hidden = false;
        }
      }).catch(function () {});
    }

    KMDB.init().then(function () { return KMDB.getSession(); }).then(function (s) {
      if (!s) {
        tag.textContent = t('Sign in to continue', 'Log in om verder te gaan');
        head.textContent = t('Almost.', 'Bijna.');
        sub.textContent = t('Sign in with the account you paid with and the course will be open.',
                            'Log in met het account waarmee je betaald hebt, dan staat de cursus open.');
        acts.hidden = false;
        $('a', acts).setAttribute('href', 'login.html');
        $('.btn__label', $('a', acts)).textContent = t('Log in', 'Inloggen');
        return;
      }
      poll();
      timer = setInterval(poll, 2500);
      KM.cleanup(function () { clearInterval(timer); });
    });
  });

})(window.KM);
