/* ==========================================================================
   KM.dev Academy — application shell and page controllers
   ========================================================================== */

window.KMApp = (function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

  var state = { session: null, model: null, progress: null, attempts: null, bookmarks: [] };

  /* ------------------------------------------------------------------ util */

  function qs(name) {
    if (window.KM_PAGES && location.hash.indexOf('?') >= 0) {
      return new URLSearchParams(location.hash.split('?')[1]).get(name);
    }
    return new URLSearchParams(location.search).get(name);
  }

  /* In the normal site this is a page load. In the single-file bundle it is a
     soft navigation, so the whole academy works from one document. */
  function go(url) {
    if (window.KM_PAGES && window.KM && KM.go && /\.html/.test(url)) {
      KM.go(url, true);
      return;
    }
    location.href = url;
  }
  function pad(n) { return ('0' + n).slice(-2); }

  function toast(message) {
    var t = $('.toast') || (function () {
      var n = document.createElement('div');
      n.className = 'toast';
      n.innerHTML = '<i></i><span></span>';
      document.body.appendChild(n);
      return n;
    })();
    $('span', t).textContent = message;
    t.classList.add('is-on');
    clearTimeout(t._x);
    t._x = setTimeout(function () { t.classList.remove('is-on'); }, 2600);
  }

  function initials(name) {
    return String(name || '?').trim().split(/\s+/).slice(0, 2)
      .map(function (w) { return w[0]; }).join('').toUpperCase();
  }

  function skeleton(host, kind) {
    if (!host) return;
    if (kind === 'lesson') {
      host.innerHTML = '<div class="sk sk-title"></div>' +
        '<div class="sk sk-line" style="width:90%"></div><div class="sk sk-line" style="width:76%"></div>' +
        '<div class="sk sk-block" style="margin-top:26px"></div>';
    } else {
      host.innerHTML = '<div class="sk sk-title"></div>' +
        '<div class="sk sk-block" style="height:120px;margin-bottom:16px"></div>' +
        '<div class="sk sk-block" style="height:200px"></div>';
    }
  }

  function errorState(host, message, retry) {
    host.innerHTML = '<div class="state"><span class="t-tag">Error</span>' +
      '<h3>Something went wrong.</h3><p>' + esc(message) + '</p>' +
      '<button class="btn btn--ghost" type="button" data-retry>' +
      '<span class="btn__label">Try again</span><i class="btn__arrow"></i></button></div>';
    var b = $('[data-retry]', host);
    if (b) b.addEventListener('click', retry || function () { location.reload(); });
  }

  /* ============================================================ course model */

  function buildModel(content) {
    var levels = content.levels.slice().sort(function (a, b) { return a.position - b.position; });
    var lessons = content.lessons.slice().sort(function (a, b) { return a.position - b.position; });

    var model = {
      course: content.course,
      prompts: content.prompts || [],
      levels: levels.map(function (lv) {
        return {
          id: lv.id, slug: lv.slug, title: lv.title, description: lv.description,
          position: lv.position, published: lv.published,
          lessons: lessons.filter(function (l) { return l.level_id === lv.id; }),
          quiz: (content.quizzes || []).filter(function (q) { return q.level_id === lv.id; })[0] || null,
          project: (content.projects || []).filter(function (p) { return p.level_id === lv.id; })[0] || null
        };
      })
    };

    model.allLessons = [];
    model.levels.forEach(function (lv) {
      lv.lessons.forEach(function (l) { model.allLessons.push(Object.assign({}, l, { level: lv })); });
    });
    model.publishedLessons = model.allLessons.filter(function (l) { return l.published; });
    return model;
  }

  function decorate(model, progressRows, attempts) {
    var done = {};
    (progressRows || []).forEach(function (r) { done[r.lesson_id] = r; });
    var passed = {};
    (attempts || []).forEach(function (a) { if (a.passed) passed[a.quiz_id] = true; });

    var unlocked = true;
    model.levels.forEach(function (lv, i) {
      var pub = lv.lessons.filter(function (l) { return l.published; });
      lv.publishedCount = pub.length;
      lv.doneCount = pub.filter(function (l) { return done[l.id] && done[l.id].completed; }).length;
      lv.percentage = pub.length ? Math.round(100 * lv.doneCount / pub.length) : 0;
      lv.quizPassed = lv.quiz ? !!passed[lv.quiz.id] : null;
      lv.locked = !unlocked;
      lv.complete = pub.length > 0 && lv.doneCount === pub.length &&
                    (!lv.quiz || !lv.quiz.published || lv.quizPassed);
      lv.index = i + 1;
      /* the next level opens once this one is finished; a level with nothing
         published yet never blocks the one after it */
      if (pub.length > 0) unlocked = lv.complete;
    });

    model.progressMap = done;
    model.passedQuizzes = passed;
    model.completed = model.publishedLessons.filter(function (l) {
      return done[l.id] && done[l.id].completed;
    }).length;
    model.total = model.publishedLessons.length;
    model.percentage = model.total ? Math.round(100 * model.completed / model.total) : 0;
    model.levelsComplete = model.levels.filter(function (l) { return l.complete; }).length;
    return model;
  }

  function nextLesson(model) {
    for (var i = 0; i < model.levels.length; i++) {
      var lv = model.levels[i];
      if (lv.locked) continue;
      for (var j = 0; j < lv.lessons.length; j++) {
        var l = lv.lessons[j];
        if (!l.published) continue;
        var p = model.progressMap[l.id];
        if (!p || !p.completed) return { level: lv, lesson: l, n: j + 1 };
      }
      if (lv.quiz && lv.quiz.published && !lv.quizPassed) {
        return { level: lv, quiz: lv.quiz };
      }
    }
    return null;
  }

  function lessonUrl(slug) { return 'app-lesson.html?l=' + encodeURIComponent(slug); }
  function quizUrl(slug) { return 'app-assessment.html?a=' + encodeURIComponent(slug); }
  function projectUrl(slug) { return 'app-project.html?p=' + encodeURIComponent(slug); }

  /* ============================================================ chrome ---- */

  function renderPreviewBar() {
    if (KMDB.live) return;
    if ($('.preview-bar')) return;
    var bar = document.createElement('div');
    bar.className = 'preview-bar';
    bar.innerHTML = '<div class="shell preview-bar__in">' +
      '<b>Preview mode</b>' +
      '<span>No Supabase project is connected, so accounts and progress live in this browser only. ' +
      'Nothing here is a real account.</span>' +
      '<a class="btn btn--sm btn--ghost" href="README-academy.html" data-no-route>' +
      '<span class="btn__label">How to connect it</span><i class="btn__arrow"></i></a>' +
      '</div>';
    document.body.insertBefore(bar, document.body.firstChild);
    document.body.classList.add('has-preview-bar');
  }

  function renderAccount() {
    var host = $('[data-account]');
    if (!host) return;
    var u = state.session && state.session.user;

    if (!u) {
      host.innerHTML =
        '<a class="nav__link" href="login.html">Log in</a>' +
        '<a class="btn btn--sm" href="signup.html" data-magnetic="0.3" data-cursor="Start">' +
        '<span class="btn__label">Start learning</span><i class="btn__arrow"></i></a>';
      return;
    }

    host.innerHTML =
      '<div class="acct">' +
        '<button class="acct__btn" type="button" data-role="' + esc(u.role) + '" ' +
          'aria-haspopup="true" aria-expanded="false" aria-label="Account">' + esc(initials(u.name)) + '</button>' +
        '<span class="acct__tip">Account</span>' +
        '<div class="acct__menu" role="menu">' +
          '<div class="acct__head"><b>' + esc(u.name) + '</b><span>' + esc(u.email) + '</span></div>' +
          '<a href="app-dashboard.html" role="menuitem">Dashboard</a>' +
          '<a href="app-course.html" role="menuitem">My Course</a>' +
          '<a href="app-progress.html" role="menuitem">Progress</a>' +
          '<a href="app-prompts.html" role="menuitem">Prompt library</a>' +
          (u.role === 'admin' ? '<a href="admin.html" role="menuitem">Admin</a>' : '') +
          '<div class="acct__sep"></div>' +
          '<a href="app-settings.html" role="menuitem">Settings</a>' +
          '<button type="button" role="menuitem" class="is-danger" data-signout>Log out</button>' +
        '</div>' +
      '</div>';

    var wrap = $('.acct', host);
    var btn = $('.acct__btn', host);
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = wrap.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', function () { wrap.classList.remove('is-open'); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') wrap.classList.remove('is-open');
    });
    $('[data-signout]', host).addEventListener('click', async function () {
      await KMDB.signOut();
      go('index.html');
    });
  }

  var SITE_LINKS = [
    ['index.html', 'Overview', 'Overzicht'],
    ['course.html', 'Course', 'Cursus'],
    ['work.html', 'Work', 'Werk'],
    ['faq.html', 'FAQ', 'FAQ']
  ];
  var APP_LINKS = [
    ['app-course.html', 'Course'],
    ['app-progress.html', 'My Progress'],
    ['app-projects.html', 'Projects'],
    ['app-prompts.html', 'Resources']
  ];

  function currentPage() {
    var main = $('.page-main');
    if (main && main.dataset.page) return main.dataset.page;
    return location.pathname.split('/').pop() || 'index.html';
  }

  /* One navigation element, two sets of links. The marketing pages keep their
     translations; the academy pages get the learning navigation. */
  function renderLearningNav() {
    var nav = $('[data-learning-nav]');
    if (!nav) return;
    var main = $('.page-main');
    var space = main && main.dataset.space === 'app' ? 'app' : 'site';
    var here = currentPage();

    if (space === 'app') {
      if (!state.session) { nav.innerHTML = ''; return; }
      nav.innerHTML = APP_LINKS.map(function (l) {
        return '<a class="nav__link' + (here === l[0] ? ' is-active' : '') + '" href="' + l[0] + '">' +
          esc(l[1]) + '</a>';
      }).join('');
      return;
    }

    nav.innerHTML = SITE_LINKS.map(function (l) {
      return '<a class="nav__link' + (here === l[0] ? ' is-active' : '') + '" href="' + l[0] + '"' +
        ' data-en="' + esc(l[1]) + '" data-nl="' + esc(l[2]) + '">' + esc(l[1]) + '</a>';
    }).join('');
    if (window.KM && KM.setLang) KM.setLang(KM.currentLang());
  }

  /* ============================================================ page: auth */

  function scorePassword(pw) {
    var s = 0;
    if (pw.length >= 8) s++;
    if (pw.length >= 12) s++;
    if (/[0-9]/.test(pw) && /[a-zA-Z]/.test(pw)) s++;
    if (/[^a-zA-Z0-9]/.test(pw)) s++;
    return Math.min(4, s);
  }

  function fieldError(input, message) {
    var f = input.closest('.field');
    f.classList.toggle('is-error', !!message);
    var e = $('.field__error', f);
    if (e) e.textContent = message || '';
    return !message;
  }

  async function handoff(lines) {
    var h = $('.handoff');
    if (!h) return;
    h.classList.add('is-on');
    var els = $$('.handoff__line', h);
    for (var i = 0; i < lines.length && i < els.length; i++) {
      els[i].textContent = lines[i];
      els[i].classList.add('is-on');
      await new Promise(function (r) { setTimeout(r, 900); });
    }
    await new Promise(function (r) { setTimeout(r, 500); });
  }

  async function mountAuth(view) {
    var form = $('form[data-auth]');
    if (!form) return;
    var kind = form.dataset.auth;

    if (!KMDB.live) {
      var host = $('[data-demo-keys]');
      if (host) {
        var accounts = await KMDB.demoAccounts();
        host.innerHTML = '<span class="mono" style="width:100%">Preview accounts — one click, no password to remember</span>' +
          accounts.map(function (a) {
            return '<button class="demo-key" type="button" data-email="' + esc(a.email) + '" ' +
              'data-key="' + esc(a.key) + '">' + esc(a.name) + ' <i>' + esc(a.role) + '</i></button>';
          }).join('');
        $$('.demo-key', host).forEach(function (b) {
          b.addEventListener('click', async function () {
            try {
              await KMDB.signIn({ email: b.dataset.email, password: b.dataset.key });
              await handoff(['Signed in.', 'Opening your dashboard…']);
              go('app-dashboard.html');
            } catch (e) { toast(e.message); }
          });
        });
      }
    }

    var pw = $('#password', form);
    var meter = $('.pw', form);
    if (pw && meter) {
      pw.addEventListener('input', function () {
        meter.setAttribute('data-score', String(scorePassword(pw.value)));
      });
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var errBox = $('.form__error', form);
      errBox.classList.remove('is-on');
      var ok = true;

      var email = $('#email', form);
      if (email) ok = fieldError(email, /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value)
        ? '' : 'That does not look like an email address.') && ok;

      if (kind === 'signup') {
        var name = $('#name', form);
        ok = fieldError(name, name.value.trim().length >= 2 ? '' : 'Please enter your name.') && ok;
        ok = fieldError(pw, pw.value.length >= 8 ? '' : 'Use at least 8 characters.') && ok;
        var confirm = $('#confirm', form);
        ok = fieldError(confirm, confirm.value === pw.value ? '' : 'The two passwords do not match.') && ok;
      } else if (kind === 'login') {
        ok = fieldError(pw, pw.value.length ? '' : 'Enter your password.') && ok;
      }
      if (!ok) return;

      var submit = $('button[type="submit"]', form);
      submit.disabled = true;
      var label = $('.btn__label', submit);
      var was = label.textContent;
      label.textContent = kind === 'signup' ? 'Creating account…' : 'Signing in…';

      try {
        if (kind === 'signup') {
          await KMDB.signUp({ name: $('#name', form).value.trim(), email: email.value.trim(), password: pw.value });
          await handoff(['Account created.', 'Preparing your learning environment…']);
        } else if (kind === 'login') {
          await KMDB.signIn({ email: email.value.trim(), password: pw.value });
          await handoff(['Welcome back.', 'Opening your dashboard…']);
        } else {
          await KMDB.resetPassword(email.value.trim());
          errBox.textContent = 'If that address has an account, a reset link is on its way.';
          errBox.classList.add('is-on');
          submit.disabled = false;
          label.textContent = was;
          return;
        }
        go('app-dashboard.html');
      } catch (err) {
        errBox.textContent = err.message;
        errBox.classList.add('is-on');
        submit.disabled = false;
        label.textContent = was;
      }
    });
    void view;
  }

  /* ======================================================= page: dashboard */

  async function mountDashboard(view) {
    skeleton(view, 'dash');
    try {
      var content = await KMDB.content();
      var model = buildModel(content);
      var rows = await KMDB.progressRows();
      var attempts = await KMDB.attempts();
      state.bookmarks = await KMDB.bookmarks();
      decorate(model, rows, attempts);
      state.model = model;

      var projects = await KMDB.projectProgress();
      var started = projects.filter(function (p) { return p.status !== 'not_started'; }).length;
      var next = nextLesson(model);
      var u = state.session.user;

      var recent = rows.filter(function (r) { return r.completed; })
        .sort(function (a, b) { return String(b.completed_at).localeCompare(String(a.completed_at)); })
        .slice(0, 5)
        .map(function (r) {
          var l = model.allLessons.filter(function (x) { return x.id === r.lesson_id; })[0];
          return l ? l : null;
        }).filter(Boolean);

      var saved = state.bookmarks.map(function (id) {
        return model.allLessons.filter(function (l) { return l.id === id; })[0];
      }).filter(Boolean);

      view.innerHTML =
        '<div class="app__head"><div>' +
          '<span class="t-tag">Dashboard</span>' +
          '<h1 class="app__title" style="margin-top:14px">Good to see you, ' + esc(u.name) + '.</h1>' +
        '</div>' +
        '<a class="btn btn--ghost" href="app-course.html" data-magnetic="0.25">' +
        '<span class="btn__label">Course overview</span><i class="btn__arrow"></i></a></div>' +

        '<div class="dash">' +
          '<div class="panel panel--ink next">' +
            (next
              ? '<span class="t-tag">Your next step</span>' +
                '<div class="next__meta"><span class="mono">Level ' + pad(next.level.index) + ' · ' +
                  esc(next.level.title) + '</span></div>' +
                '<p class="next__title">' + esc(next.lesson ? next.lesson.title : next.quiz.title) + '</p>' +
                '<p class="t-small" style="max-width:46ch">' +
                  esc(next.lesson ? (next.lesson.description || '') : (next.quiz.subtitle || '')) + '</p>' +
                '<div class="next__row">' +
                  '<a class="btn btn--accent" href="' +
                    (next.lesson ? lessonUrl(next.lesson.slug) : quizUrl(next.quiz.slug)) + '" ' +
                    'data-magnetic="0.3" data-cursor="Open">' +
                    '<span class="btn__label">' + (next.lesson ? 'Continue lesson' : 'Take the assessment') +
                    '</span><i class="btn__arrow"></i></a>' +
                  (next.lesson ? '<span class="mono">' + next.lesson.estimated_minutes + ' min read</span>' : '') +
                '</div>'
              : '<span class="t-tag">All caught up</span>' +
                '<p class="next__title">Every published lesson is complete.</p>' +
                '<p class="t-small" style="max-width:46ch">More levels are being written. ' +
                'In the meantime the prompt library and your projects are where the work continues.</p>' +
                '<div class="next__row"><a class="btn btn--accent" href="app-prompts.html">' +
                '<span class="btn__label">Open the prompt library</span><i class="btn__arrow"></i></a></div>') +
          '</div>' +

          '<div class="panel">' +
            '<div class="meter">' +
              '<div class="meter__top"><span class="mono">Course progress</span>' +
                '<span class="mono">' + model.completed + ' / ' + model.total + '</span></div>' +
              '<span class="meter__pct" data-count="' + model.percentage + '">0%</span>' +
              '<span class="meter__line"><i style="--p:' + (model.percentage / 100) + '"></i></span>' +
              '<div class="meter__legend">' +
                '<span class="t-small">' + model.completed + ' / ' + model.total + ' lessons completed</span>' +
                '<span class="t-small">' + model.levelsComplete + ' / ' + model.levels.length + ' levels completed</span>' +
                '<span class="t-small">' + started + ' project' + (started === 1 ? '' : 's') + ' started</span>' +
              '</div>' +
            '</div>' +
            '<div style="margin-top:auto;padding-top:20px;border-top:1px solid var(--line)">' +
              '<span class="mono" style="display:block;margin-bottom:12px">Levels</span>' +
              '<div class="levelstrip">' + model.levels.map(function (lv) {
                var cls = lv.complete ? 'is-complete' : lv.locked ? 'is-locked'
                  : lv.doneCount ? 'is-active' : '';
                return '<a class="levelstrip__i ' + cls + '" href="app-course.html" ' +
                  'title="Level ' + pad(lv.index) + ' — ' + esc(lv.title) + '">' +
                  '<i style="--p:' + (lv.percentage / 100) + '"></i>' +
                  '<span>' + pad(lv.index) + '</span></a>';
              }).join('') + '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="statgrid" style="margin-top:var(--gutter)">' +
          stat(model.levelsComplete + ' / ' + model.levels.length, 'Levels completed') +
          stat(String(attempts.length), 'Assessment attempts') +
          stat(saved.length ? String(saved.length) : '0', 'Saved lessons') +
        '</div>' +

        '<div class="dash" style="margin-top:var(--gutter)">' +
          '<div class="panel"><div class="panel__head"><h3>Recently completed</h3>' +
            '<a class="xlink" href="app-progress.html"><span>All progress</span><i class="btn__arrow"></i></a></div>' +
            (recent.length
              ? '<div class="minilist">' + recent.map(function (l, i) {
                  return '<a href="' + lessonUrl(l.slug) + '"><span class="minilist__n">' + pad(i + 1) +
                    '</span><span class="minilist__t">' + esc(l.title) + '</span>' +
                    '<span class="minilist__x">' + esc(l.level.title) + '</span></a>';
                }).join('') + '</div>'
              : '<p class="t-small">Nothing completed yet. The first lesson takes about ten minutes.</p>') +
          '</div>' +
          '<div class="panel"><div class="panel__head"><h3>Saved lessons</h3></div>' +
            (saved.length
              ? '<div class="minilist">' + saved.map(function (l, i) {
                  return '<a href="' + lessonUrl(l.slug) + '"><span class="minilist__n">' + pad(i + 1) +
                    '</span><span class="minilist__t">' + esc(l.title) + '</span>' +
                    '<span class="minilist__x">saved</span></a>';
                }).join('') + '</div>'
              : '<p class="t-small">Press <kbd>S</kbd> on any lesson to save it here.</p>') +
          '</div>' +
        '</div>';

      countUp($('[data-count]', view));
      if (window.KM && KM.magnetic) KM.magnetic(view);
    } catch (e) {
      errorState(view, e.message, function () { mountDashboard(view); });
    }
  }

  function stat(value, label) {
    return '<div class="stat"><b>' + esc(value) + '</b><span>' + esc(label) + '</span></div>';
  }

  function countUp(node) {
    if (!node) return;
    var target = +node.dataset.count || 0;
    if (window.KM && KM.reduced && KM.reduced()) { node.textContent = target + '%'; return; }
    var start = performance.now(), dur = 900;
    function tick(t) {
      var p = Math.min(1, (t - start) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      node.textContent = Math.round(target * eased) + '%';
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* ========================================================== page: course */

  async function mountCourse(view) {
    skeleton(view, 'dash');
    try {
      var content = await KMDB.content();
      var model = buildModel(content);
      decorate(model, await KMDB.progressRows(), await KMDB.attempts());
      state.model = model;

      var totalLessons = model.allLessons.length;
      var assessments = model.levels.filter(function (l) { return l.quiz; }).length;
      var projects = model.levels.filter(function (l) { return l.project; }).length;

      view.innerHTML =
        '<div class="app__head"><div>' +
          '<span class="t-tag">Course</span>' +
          '<h1 class="app__title" style="margin-top:14px">' + esc(model.course.title) + '</h1>' +
          '<p class="t-lead" style="margin-top:16px">' + esc(model.course.description) + '</p>' +
          '<p class="mono" style="margin-top:18px">' + model.levels.length + ' levels · ' +
            totalLessons + ' lessons · ' + projects + ' projects · ' + assessments + ' assessments · ' +
            model.total + ' published so far</p>' +
        '</div></div>' +
        '<div class="levels">' + model.levels.map(function (lv) { return levelRow(lv, model); }).join('') + '</div>';

      $$('.level', view).forEach(function (row) {
        var head = $('.level__row', row);
        head.addEventListener('click', function (e) {
          if (e.target.closest('a')) return;
          row.classList.toggle('is-open');
        });
      });
      if (window.KM && KM.magnetic) KM.magnetic(view);
    } catch (e) {
      errorState(view, e.message, function () { mountCourse(view); });
    }
  }

  function levelRow(lv, model) {
    var status = lv.locked ? 'Locked' : lv.complete ? 'Completed'
      : lv.doneCount > 0 ? 'In progress' : 'Not started';
    var firstOpen = lv.lessons.filter(function (l) { return l.published; })[0];
    return '<article class="level' + (lv.locked ? ' is-locked' : '') +
        (lv.complete ? ' is-complete' : '') + '">' +
      '<div class="level__row">' +
        '<span class="level__n">Level ' + pad(lv.index) + '</span>' +
        '<div><h2 class="level__title">' + esc(lv.title) + '</h2>' +
          '<p class="level__desc">' + esc(lv.description) + '</p></div>' +
        '<div class="level__meta">' +
          '<span class="level__bar"><i style="--p:' + (lv.percentage / 100) + '"></i></span>' +
          '<span class="mono">' + lv.doneCount + ' / ' + lv.publishedCount + ' published · ' +
            lv.lessons.length + ' planned</span>' +
          (lv.quiz ? '<span class="mono">' + (lv.quiz.published
              ? (lv.quizPassed ? 'assessment passed' : 'assessment available')
              : 'assessment in draft') + '</span>' : '') +
        '</div>' +
        '<div class="level__cta">' +
          (lv.locked
            ? '<span class="level__lock">' + lockIcon() + ' Complete level ' + pad(lv.index - 1) + '</span>'
            : firstOpen
              ? '<a class="btn btn--sm btn--ghost" href="' + lessonUrl(firstOpen.slug) + '" data-magnetic="0.25">' +
                '<span class="btn__label">' + (lv.doneCount ? 'Continue' : 'Start') + '</span><i class="btn__arrow"></i></a>'
              : '<span class="status-pill">In writing</span>') +
        '</div>' +
      '</div>' +
      '<div class="level__lessons">' +
        lv.lessons.map(function (l, i) {
          var p = model.progressMap[l.id];
          var cls = !l.published ? 'is-locked' : (p && p.completed ? 'is-done' : '');
          var inner = '<span class="tick ' + cls + '">' + (p && p.completed ? '✓' : '') + '</span>' +
            '<span>' + pad(i + 1) + ' — ' + esc(l.title) + '</span>';
          return l.published && !lv.locked
            ? '<a class="level__lesson" href="' + lessonUrl(l.slug) + '">' + inner + '</a>'
            : '<span class="level__lesson" style="opacity:.5">' + inner + '</span>';
        }).join('') +
        (lv.quiz && lv.quiz.published && !lv.locked
          ? '<a class="level__lesson" href="' + quizUrl(lv.quiz.slug) + '">' +
            '<span class="tick ' + (lv.quizPassed ? 'is-done' : '') + '">' + (lv.quizPassed ? '✓' : '') + '</span>' +
            '<span>Assessment — ' + esc(lv.quiz.title) + '</span></a>' : '') +
        (lv.project && !lv.locked
          ? '<a class="level__lesson" href="' + projectUrl(lv.project.slug) + '">' +
            '<span class="tick"></span><span>Project — ' + esc(lv.project.title) + '</span></a>' : '') +
      '</div>' +
      '<span class="mono" style="display:block;margin-top:12px">' + status + '</span>' +
      '</article>';
  }

  function lockIcon() {
    return '<svg viewBox="0 0 11 13" fill="none" aria-hidden="true">' +
      '<rect x="1" y="5" width="9" height="7" rx="1.5" stroke="currentColor"/>' +
      '<path d="M3 5V3.5a2.5 2.5 0 015 0V5" stroke="currentColor"/></svg>';
  }

  /* ========================================================== page: lesson */

  async function mountLesson(view) {
    var slug = qs('l');
    skeleton(view, 'lesson');
    try {
      var content = await KMDB.content();
      var model = buildModel(content);
      decorate(model, await KMDB.progressRows(), await KMDB.attempts());
      state.model = model;
      window.KMApp._model = model;
      state.bookmarks = await KMDB.bookmarks();

      var entry = model.allLessons.filter(function (l) { return l.slug === slug; })[0];
      if (!entry) {
        view.innerHTML = '<div class="state"><span class="t-tag">Not found</span>' +
          '<h3>That lesson does not exist.</h3>' +
          '<p>It may have been renamed. The course overview has everything that is published.</p>' +
          '<a class="btn btn--ghost" href="app-course.html"><span class="btn__label">Course overview</span>' +
          '<i class="btn__arrow"></i></a></div>';
        return;
      }
      if (!entry.published) {
        view.innerHTML = '<div class="state state--locked"><span class="t-tag">In writing</span>' +
          '<h3>' + esc(entry.title) + '</h3>' +
          '<p>This lesson is planned and its place in the course is fixed, but the content is still ' +
          'being written. It appears here the moment it is published.</p>' +
          '<a class="btn btn--ghost" href="app-course.html"><span class="btn__label">Back to the course</span>' +
          '<i class="btn__arrow"></i></a></div>';
        return;
      }

      var lv = entry.level;
      var siblings = lv.lessons.filter(function (l) { return l.published; });
      var idx = siblings.findIndex(function (l) { return l.id === entry.id; });
      var prev = siblings[idx - 1] || null;
      var next = siblings[idx + 1] || null;
      var prog = model.progressMap[entry.id];
      var isDone = !!(prog && prog.completed);
      var isSaved = state.bookmarks.indexOf(entry.id) >= 0;

      view.innerHTML =
        '<div class="lesson">' +
          '<aside class="lesson__aside"><div class="sidebar" data-sidebar>' +
            '<div class="sidebar__head" data-sidebar-toggle>' +
              '<span class="mono">Level ' + pad(lv.index) + '</span>' +
              '<span class="mono">' + lv.doneCount + ' / ' + lv.publishedCount + '</span>' +
            '</div>' +
            '<div class="sidebar__body">' +
              '<div class="sidebar__level"><span>' + esc(lv.title) + '</span></div>' +
              lv.lessons.map(function (l, i) {
                var p = model.progressMap[l.id];
                var cur = l.id === entry.id;
                var cls = 'sitem' + (cur ? ' is-current' : '') + (!l.published ? ' is-locked' : '');
                var tick = '<span class="tick ' + (p && p.completed ? 'is-done' : (cur ? 'is-current' : (!l.published ? 'is-locked' : ''))) + '">' +
                  (p && p.completed ? '✓' : '') + '</span>';
                return l.published
                  ? '<a class="' + cls + '" href="' + lessonUrl(l.slug) + '">' + tick +
                    '<span class="sitem__t">' + pad(i + 1) + ' ' + esc(l.title) + '</span></a>'
                  : '<span class="' + cls + '">' + tick + '<span class="sitem__t">' + pad(i + 1) + ' ' +
                    esc(l.title) + '</span></span>';
              }).join('') +
              (lv.quiz && lv.quiz.published
                ? '<a class="sitem" href="' + quizUrl(lv.quiz.slug) + '">' +
                  '<span class="tick ' + (lv.quizPassed ? 'is-done' : '') + '">' + (lv.quizPassed ? '✓' : '') + '</span>' +
                  '<span class="sitem__t">Assessment</span></a>' : '') +
            '</div>' +
          '</div>' +
          '<div class="mono" style="padding:0 4px">' +
            '<kbd>←</kbd> <kbd>→</kbd> move · <kbd>M</kbd> complete · <kbd>S</kbd> save</div>' +
          '</aside>' +

          '<article class="lesson__main">' +
            '<div class="crumbs"><a href="app-course.html">Course</a><i></i>' +
              '<a href="app-course.html">Level ' + pad(lv.index) + '</a><i></i>' +
              '<span class="mono">Lesson ' + pad(idx + 1) + '</span></div>' +
            '<div class="lesson__eyebrow enter"><span class="mono">Level ' + pad(lv.index) + ' / Lesson ' +
              pad(idx + 1) + '</span><span class="chip"><i></i><span>' + esc(lv.title) + '</span></span></div>' +
            '<h1 class="lesson__title enter">' + esc(entry.title) + '</h1>' +
            '<p class="lesson__desc enter">' + esc(entry.description) + '</p>' +
            '<div class="lesson__facts enter">' +
              '<span class="mono">' + entry.estimated_minutes + ' min read</span>' +
              '<span class="mono">Lesson ' + pad(idx + 1) + ' of ' + pad(siblings.length) + '</span>' +
              '<button class="xlink" type="button" data-save><span>' +
                (isSaved ? 'Saved ✓' : 'Save') + '</span></button>' +
            '</div>' +
            '<div class="lesson__body" data-body></div>' +

            '<div class="lesson__foot">' +
              '<div class="complete' + (isDone ? ' is-done' : '') + '" data-complete>' +
                '<div><span class="t-tag">Lesson complete?</span>' +
                  '<p class="t-small" style="margin-top:6px">Progress is saved to your account, ' +
                  'so you can pick this up on another device.</p></div>' +
                '<button class="btn' + (isDone ? ' btn--ghost' : '') + '" type="button" data-mark ' +
                  'data-magnetic="0.3"><span class="btn__label">' +
                  (isDone ? 'Completed ✓' : 'Mark as complete') + '</span><i class="btn__arrow"></i></button>' +
              '</div>' +

              '<div class="notes">' +
                '<div class="panel__head"><h3 class="t-h4">My notes</h3>' +
                  '<span class="notes__status" data-note-status>Saved</span></div>' +
                '<div class="field"><textarea id="note" placeholder="Anything you want to remember from this lesson."></textarea></div>' +
                '<span class="t-small">Private to you. Not visible to anyone else.</span>' +
              '</div>' +

              '<div class="lesson-nav">' +
                (prev ? '<a class="xlink is-prev" href="' + lessonUrl(prev.slug) + '">' +
                  '<i class="btn__arrow" style="transform:rotate(180deg)"></i>' +
                  '<span class="lesson-nav__side"><span>Previous</span><b>' + esc(prev.title) + '</b></span></a>'
                  : '<span></span>') +
                (next ? '<a class="xlink" href="' + lessonUrl(next.slug) + '" style="text-align:right">' +
                  '<span class="lesson-nav__side"><span>Next lesson</span><b>' + esc(next.title) + '</b></span>' +
                  '<i class="btn__arrow"></i></a>'
                  : (lv.quiz && lv.quiz.published
                    ? '<a class="btn" href="' + quizUrl(lv.quiz.slug) + '"><span class="btn__label">' +
                      'Take the assessment</span><i class="btn__arrow"></i></a>'
                    : '<a class="btn btn--ghost" href="app-course.html"><span class="btn__label">' +
                      'Back to the course</span><i class="btn__arrow"></i></a>')) +
              '</div>' +
            '</div>' +
          '</article>' +
        '</div>';

      /* content ---------------------------------------------------- */
      KMBlocks.render($('[data-body]', view), entry.content, {
        onVideoSeen: function (p) {
          KMDB.setLessonProgress(entry.id, { video_progress: p, video_seen: true });
          toast('Video marked as watched');
        },
        onVideoProgress: function (p) {
          KMDB.setLessonProgress(entry.id, { video_progress: p });
        }
      });

      /* entrance --------------------------------------------------- */
      $$('.lesson__main > .enter', view).forEach(function (n, i) {
        n.style.setProperty('--ed', i * 90 + 'ms');
        setTimeout(function () { n.classList.add('is-in'); }, 20);
      });

      /* completion ------------------------------------------------- */
      var mark = $('[data-mark]', view);
      mark.addEventListener('click', async function () {
        isDone = !isDone;
        await KMDB.setLessonProgress(entry.id, {
          completed: isDone, completed_at: isDone ? new Date().toISOString() : null
        });
        $('[data-complete]', view).classList.toggle('is-done', isDone);
        mark.classList.toggle('btn--ghost', isDone);
        $('.btn__label', mark).textContent = isDone ? 'Completed ✓' : 'Mark as complete';
        toast(isDone ? 'Lesson completed' : 'Marked as not complete');
        var refreshed = decorate(buildModel(content), await KMDB.progressRows(), await KMDB.attempts());
        var lvNow = refreshed.levels.filter(function (x) { return x.id === lv.id; })[0];
        if (isDone && lvNow && lvNow.complete) levelUp(lvNow);
      });

      /* bookmark --------------------------------------------------- */
      var save = $('[data-save]', view);
      save.addEventListener('click', async function () {
        var on = await KMDB.toggleBookmark(entry.id);
        $('span', save).textContent = on ? 'Saved ✓' : 'Save';
        toast(on ? 'Saved to your dashboard' : 'Removed from saved');
      });

      /* notes ------------------------------------------------------ */
      var note = $('#note', view);
      note.value = await KMDB.getNote(entry.id);
      var timer = null;
      note.addEventListener('input', function () {
        clearTimeout(timer);
        timer = setTimeout(async function () {
          await KMDB.saveNote(entry.id, note.value);
          var s = $('[data-note-status]', view);
          s.classList.add('is-on');
          setTimeout(function () { s.classList.remove('is-on'); }, 1600);
        }, 700);
      });

      /* mobile sidebar --------------------------------------------- */
      $('[data-sidebar-toggle]', view).addEventListener('click', function () {
        $('[data-sidebar]', view).classList.toggle('is-open');
      });

      /* keyboard --------------------------------------------------- */
      var onKey = function (e) {
        if (/input|textarea/i.test(document.activeElement.tagName)) return;
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        if (e.key === 'ArrowLeft' && prev) go(lessonUrl(prev.slug));
        if (e.key === 'ArrowRight' && next) go(lessonUrl(next.slug));
        if (e.key.toLowerCase() === 'm') mark.click();
        if (e.key.toLowerCase() === 's') { e.preventDefault(); save.click(); }
      };
      document.addEventListener('keydown', onKey);
      if (window.KM && KM.cleanup) KM.cleanup(function () { document.removeEventListener('keydown', onKey); });
      if (window.KM && KM.magnetic) KM.magnetic(view);
    } catch (e) {
      errorState(view, e.message, function () { mountLesson(view); });
    }
  }

  function levelUp(lv) {
    var n = document.createElement('div');
    n.className = 'levelup';
    n.innerHTML = '<span class="mono">Level ' + pad(lv.index) + '</span><b>Level complete</b>' +
      '<span class="t-small" style="color:var(--on-ink-dim)">' + esc(lv.title) + '</span>';
    document.body.appendChild(n);
    requestAnimationFrame(function () { n.classList.add('is-on'); });
    setTimeout(function () {
      n.classList.remove('is-on');
      setTimeout(function () { n.remove(); }, 1000);
    }, 1900);
  }

  /* ====================================================== page: assessment */

  async function mountAssessment(view) {
    var slug = qs('a');
    skeleton(view, 'dash');
    try {
      var data = await KMDB.quizWithQuestions(slug);
      if (!data || !data.questions.length) {
        view.innerHTML = '<div class="state state--locked"><span class="t-tag">In writing</span>' +
          '<h3>' + esc(data ? data.quiz.title : 'Assessment') + '</h3>' +
          '<p>The questions for this assessment are still being written. It unlocks the moment ' +
          'it is published, and your progress in the level is unaffected.</p>' +
          '<a class="btn btn--ghost" href="app-course.html"><span class="btn__label">Back to the course</span>' +
          '<i class="btn__arrow"></i></a></div>';
        return;
      }

      var quiz = data.quiz, questions = data.questions;
      var answers = {}, i = 0, submitted = null;

      view.innerHTML =
        '<div class="assess" data-assess>' +
          '<div class="assess__head">' +
            '<span class="t-tag">Assessment / ' + esc(quiz.title) + '</span>' +
            '<h1 class="app__title">' + esc(quiz.subtitle || quiz.title) + '</h1>' +
            '<p class="t-small">' + questions.length + ' questions · ' + quiz.passing_score +
            '% to pass · your answers are graded on the server</p>' +
          '</div>' +
          '<div class="assess__bar"><span class="mono" data-counter></span>' +
            '<span class="meter__line"><i data-bar></i></span></div>' +
          '<div data-stage></div>' +
        '</div>';

      var stage = $('[data-stage]', view);

      function paint() {
        var q = questions[i];
        var multi = q.type === 'multi';
        $('[data-counter]', view).textContent = 'Question ' + pad(i + 1) + ' / ' + pad(questions.length);
        $('[data-bar]', view).style.setProperty('--p', ((i) / questions.length).toFixed(3));

        stage.innerHTML =
          '<h2 class="assess__q">' + esc(q.question) + '</h2>' +
          (multi ? '<p class="t-small" style="margin-top:10px">Select every answer that applies.</p>' : '') +
          '<div class="aopts" style="margin-top:26px">' + q.options.map(function (o, n) {
            var picked = (answers[q.id] || []).indexOf(o.id) >= 0;
            return '<button class="aopt' + (multi ? ' is-multi' : '') + (picked ? ' is-picked' : '') +
              '" type="button" data-o="' + esc(o.id) + '">' +
              '<span class="aopt__k">' + 'ABCDEF'[n] + '</span>' +
              '<span class="aopt__t">' + esc(o.answer) + '</span>' +
              '<span class="aopt__mark"></span></button>';
          }).join('') + '</div>' +
          '<div class="assess__foot">' +
            (i > 0 ? '<button class="btn btn--ghost btn--sm" type="button" data-back>' +
              '<span class="btn__label">Back</span></button>' : '<span></span>') +
            '<button class="btn" type="button" data-next data-magnetic="0.28"><span class="btn__label">' +
            (i === questions.length - 1 ? 'Submit assessment' : 'Next question') +
            '</span><i class="btn__arrow"></i></button>' +
          '</div>';

        $$('.aopt', stage).forEach(function (b) {
          b.addEventListener('click', function () {
            var id = b.dataset.o;
            var cur = answers[q.id] || [];
            if (multi) {
              var at = cur.indexOf(id);
              if (at >= 0) cur.splice(at, 1); else cur.push(id);
            } else {
              cur = [id];
            }
            answers[q.id] = cur;
            $$('.aopt', stage).forEach(function (x) {
              x.classList.toggle('is-picked', cur.indexOf(x.dataset.o) >= 0);
            });
          });
        });

        var back = $('[data-back]', stage);
        if (back) back.addEventListener('click', function () { i--; paint(); });
        $('[data-next]', stage).addEventListener('click', async function () {
          if (!(answers[q.id] || []).length) { toast('Choose an answer to continue'); return; }
          if (i < questions.length - 1) { i++; paint(); return; }
          this.disabled = true;
          $('.btn__label', this).textContent = 'Grading…';
          try {
            submitted = await KMDB.submitQuiz(quiz.id, answers);
            results();
          } catch (err) {
            toast(err.message);
            this.disabled = false;
            $('.btn__label', this).textContent = 'Submit assessment';
          }
        });
        if (window.KM && KM.magnetic) KM.magnetic(stage);
      }

      function results() {
        var r = submitted;
        $('[data-bar]', view).style.setProperty('--p', 1);
        $('[data-counter]', view).textContent = 'Complete';
        stage.innerHTML =
          '<div class="result"><span class="result__score" data-score>0<small>/' + r.total + '</small></span>' +
            '<span class="result__verdict">' + (r.passed
              ? (r.percentage === 100 ? 'Every one.' : 'Strong understanding.')
              : 'Not quite yet.') + '</span>' +
            '<span class="result__line"><i style="--p:' + (r.percentage / 100) + '"></i></span>' +
            '<p class="t-small">' + (r.passed
              ? 'You passed this assessment. It is recorded against your account.'
              : 'You need ' + r.passing_score + '% to pass. The explanations below are the useful part — ' +
                'read them, then take it again.') + '</p>' +
            '<div class="result__actions">' +
              '<button class="btn btn--ghost" type="button" data-review><span class="btn__label">' +
              'Review answers</span><i class="btn__arrow"></i></button>' +
              (r.passed
                ? '<a class="btn" href="app-course.html"><span class="btn__label">Continue</span>' +
                  '<i class="btn__arrow"></i></a>'
                : '<button class="btn" type="button" data-again><span class="btn__label">Try again</span>' +
                  '<i class="btn__arrow"></i></button>') +
            '</div>' +
          '</div><div data-review-list></div>';

        var scoreEl = $('[data-score]', stage);
        var target = r.score;
        if (window.KM && KM.reduced && KM.reduced()) {
          scoreEl.innerHTML = target + '<small>/' + r.total + '</small>';
        } else {
          var t0 = performance.now();
          (function tick(t) {
            var p = Math.min(1, (t - t0) / 1100);
            var v = Math.round(target * (1 - Math.pow(1 - p, 3)));
            scoreEl.innerHTML = v + '<small>/' + r.total + '</small>';
            if (p < 1) requestAnimationFrame(tick);
          })(t0);
        }
        requestAnimationFrame(function () { $('.result', stage).classList.add('is-in'); });

        $('[data-review]', stage).addEventListener('click', function () {
          var list = $('[data-review-list]', stage);
          if (list.innerHTML) { list.innerHTML = ''; return; }
          list.innerHTML = '<div style="display:flex;flex-direction:column;gap:20px;margin-top:20px">' +
            r.detail.map(function (d, n) {
              var q = questions.filter(function (x) { return x.id === d.question_id; })[0] || {};
              return '<div class="panel">' +
                '<div class="panel__head"><span class="mono">Question ' + pad(n + 1) + '</span>' +
                '<span class="chip ' + (d.correct ? 'is-ok' : 'is-error') + '"><i></i><span>' +
                (d.correct ? 'Correct' : 'Not quite') + '</span></span></div>' +
                '<p class="blk-p">' + esc(q.question || '') + '</p>' +
                '<div class="aopts">' + (q.options || []).map(function (o) {
                  var isRight = (d.answer || []).indexOf(o.id) >= 0;
                  var wasPicked = (d.chosen || []).indexOf(o.id) >= 0;
                  return '<div class="aopt' + (isRight ? ' is-right' : (wasPicked ? ' is-wrong' : '')) + '">' +
                    '<span class="aopt__k">' + (isRight ? '✓' : (wasPicked ? '×' : '')) + '</span>' +
                    '<span class="aopt__t">' + esc(o.answer) + '</span><span class="aopt__mark"></span></div>';
                }).join('') + '</div>' +
                '<div class="assess__why is-on"><p class="blk-p">' + esc(d.explanation) + '</p></div>' +
                '</div>';
            }).join('') + '</div>';
        });

        var again = $('[data-again]', stage);
        if (again) again.addEventListener('click', function () {
          answers = {}; i = 0; submitted = null; paint();
        });
      }

      paint();
    } catch (e) {
      errorState(view, e.message, function () { mountAssessment(view); });
    }
  }

  /* ========================================================= page: project */

  async function mountProject(view) {
    var slug = qs('p');
    skeleton(view, 'dash');
    try {
      var content = await KMDB.content();
      var project = (content.projects || []).filter(function (p) { return p.slug === slug; })[0];
      if (!project) {
        var model = buildModel(content);
        decorate(model, await KMDB.progressRows(), await KMDB.attempts());
        view.innerHTML =
          '<div class="app__head"><div><span class="t-tag">Projects</span>' +
          '<h1 class="app__title" style="margin-top:14px">Build real things.</h1>' +
          '<p class="t-lead" style="margin-top:16px">Four briefs. Each one uses everything from the ' +
          'levels before it, and each one ends with something you could show a client.</p></div></div>' +
          '<div class="levels">' + (content.projects || []).map(function (p) {
            var lv = model.levels.filter(function (l) { return l.id === p.level_id; })[0];
            return '<article class="level"><div class="level__row">' +
              '<span class="level__n">' + (p.is_final ? 'Final' : 'Project') + '</span>' +
              '<div><h2 class="level__title">' + esc(p.title) + '</h2>' +
              '<p class="level__desc">' + esc(p.description) + '</p></div>' +
              '<div class="level__meta"><span class="mono">' + (lv ? 'Level ' + pad(lv.index) + ' · ' + esc(lv.title) : '') + '</span></div>' +
              '<div class="level__cta"><a class="btn btn--sm btn--ghost" href="' + projectUrl(p.slug) + '">' +
              '<span class="btn__label">Open brief</span><i class="btn__arrow"></i></a></div>' +
              '</div></article>';
          }).join('') + '</div>';
        return;
      }

      var rows = await KMDB.projectProgress();
      var mine = rows.filter(function (r) { return r.project_id === project.id; })[0] ||
                 { status: 'not_started', checklist: [] };
      var brief = project.brief || {};
      var checks = brief.checklist || [];
      var ticked = mine.checklist || [];
      var promptSlugs = brief.prompts || [];
      var prompts = (content.prompts || []).filter(function (p) { return promptSlugs.indexOf(p.slug) >= 0; });

      view.innerHTML =
        '<div class="crumbs"><a href="app-course.html">Course</a><i></i>' +
        '<a href="app-projects.html">Projects</a><i></i><span class="mono">Brief</span></div>' +
        '<div class="app__head"><div><span class="t-tag">' + (project.is_final ? 'Final project' : 'Project') + '</span>' +
        '<h1 class="app__title" style="margin-top:14px">' + esc(project.title) + '</h1>' +
        '<p class="t-lead" style="margin-top:16px">' + esc(project.description) + '</p></div></div>' +

        '<div class="project">' +
          '<div class="brief">' +
            '<div class="brief__block"><h3>Client brief</h3>' +
              '<p class="blk-p">' + esc(brief.client || '') + '</p>' +
              '<p class="blk-p"><strong>Goal.</strong> ' + esc(brief.goal || '') + '</p></div>' +
            '<div class="brief__block"><h3>Requirements</h3>' +
              '<ul class="blk-list">' + (brief.requirements || []).map(function (r) {
                return '<li class="blk-li"><i></i><span>' + esc(r) + '</span></li>';
              }).join('') + '</ul></div>' +
            (prompts.length ? '<div class="brief__block"><h3>Recommended prompts</h3>' +
              '<div style="display:flex;flex-direction:column;gap:16px">' +
              prompts.map(promptCard).join('') + '</div></div>' : '') +
          '</div>' +

          '<div class="panel">' +
            '<div class="panel__head"><h3>Checklist</h3>' +
              '<span class="status-pill' + (mine.status === 'complete' ? ' is-published' : '') + '" data-status>' +
              esc(mine.status.replace('_', ' ')) + '</span></div>' +
            '<div class="checklist">' + checks.map(function (c, n) {
              var on = ticked.indexOf(n) >= 0;
              return '<button class="check' + (on ? ' is-on' : '') + '" type="button" data-c="' + n + '">' +
                '<span class="check__box"></span><span>' + esc(c) + '</span></button>';
            }).join('') + '</div>' +
            '<div class="meter"><div class="meter__top"><span class="mono">Done</span>' +
              '<span class="mono" data-cn>' + ticked.length + ' / ' + checks.length + '</span></div>' +
              '<span class="meter__line"><i data-cbar style="--p:' +
                (checks.length ? ticked.length / checks.length : 0) + '"></i></span></div>' +
            '<button class="btn" type="button" data-submit data-magnetic="0.28"><span class="btn__label">' +
              (mine.status === 'complete' ? 'Marked as delivered' : 'Mark as delivered') +
              '</span><i class="btn__arrow"></i></button>' +
          '</div>' +
        '</div>';

      wirePromptCards(view);

      function persist(status) {
        return KMDB.saveProject(project.id, { status: status, checklist: ticked });
      }

      $$('[data-c]', view).forEach(function (b) {
        b.addEventListener('click', async function () {
          var n = +b.dataset.c, at = ticked.indexOf(n);
          if (at >= 0) ticked.splice(at, 1); else ticked.push(n);
          b.classList.toggle('is-on', at < 0);
          $('[data-cn]', view).textContent = ticked.length + ' / ' + checks.length;
          $('[data-cbar]', view).style.setProperty('--p', checks.length ? ticked.length / checks.length : 0);
          await persist(ticked.length === checks.length ? 'complete'
            : ticked.length ? 'in_progress' : 'not_started');
        });
      });

      $('[data-submit]', view).addEventListener('click', async function () {
        await persist('complete');
        $('[data-status]', view).textContent = 'complete';
        $('[data-status]', view).classList.add('is-published');
        $('.btn__label', this).textContent = 'Marked as delivered';
        toast('Project marked as delivered');
      });
      if (window.KM && KM.magnetic) KM.magnetic(view);
    } catch (e) {
      errorState(view, e.message, function () { mountProject(view); });
    }
  }

  /* ========================================================= page: prompts */

  function promptCard(p) {
    return '<div class="prompt-c" data-prompt-card>' +
      '<div class="prompt-c__head"><span class="prompt-c__n">' + esc(p.category) + '</span>' +
      '<span class="prompt-c__title">' + esc(p.title) + '</span></div>' +
      '<div class="prompt-c__body">' + esc(p.body).replace(/\{([A-Z0-9 _]+)\}/g, '<span class="ph">{$1}</span>') + '</div>' +
      '<div class="prompt-c__foot">' +
        '<button class="copy" type="button" data-copy><span class="copy__icon"></span><span>Copy prompt</span></button>' +
        '<span class="mono" style="color:var(--on-ink-dim)">' + esc(p.purpose || '') + '</span></div>' +
      (p.explanation && p.explanation.context
        ? '<div class="why"><button class="why__btn" type="button" data-why-btn>' +
          '<span>Why this works</span><span class="mono">open</span></button>' +
          '<div class="why__panel"><div class="why__inner"><div class="why__grid">' +
          ['context', 'constraints', 'output', 'iteration'].map(function (k) {
            return '<div class="why__cell"><b>' + k + '</b><p>' + esc(p.explanation[k] || '') + '</p></div>';
          }).join('') + '</div></div></div></div>' : '') +
      '<script type="application/json" data-raw>' + JSON.stringify(p.body).replace(/</g, '\\u003c') + '<\/script></div>';
  }

  function wirePromptCards(root) {
    $$('[data-prompt-card]', root).forEach(function (card) {
      var raw = JSON.parse($('script[data-raw]', card).textContent);
      $('[data-copy]', card).addEventListener('click', function () { KMBlocks.copyText(raw, this); });
      var wb = $('[data-why-btn]', card);
      if (wb) wb.addEventListener('click', function () {
        var why = wb.closest('.why');
        var open = why.classList.toggle('is-open');
        $('.mono', wb).textContent = open ? 'close' : 'open';
      });
    });
  }

  async function mountPrompts(view) {
    skeleton(view, 'dash');
    try {
      var content = await KMDB.content();
      var prompts = content.prompts || [];
      var cats = [];
      prompts.forEach(function (p) { if (cats.indexOf(p.category) < 0) cats.push(p.category); });
      var active = 'All';

      view.innerHTML =
        '<div class="app__head"><div><span class="t-tag">Resources</span>' +
        '<h1 class="app__title" style="margin-top:14px">Prompt library</h1>' +
        '<p class="t-lead" style="margin-top:16px">Every prompt in the course, with the reasoning ' +
        'behind it. Copy one, replace the placeholders, and read the explanation before you send it.</p></div></div>' +
        '<div class="lib">' +
          '<div class="lib__cats">' + ['All'].concat(cats).map(function (c) {
            return '<button class="lib__cat' + (c === 'All' ? ' is-on' : '') + '" type="button" data-cat="' +
              esc(c) + '">' + esc(c) + '</button>';
          }).join('') + '</div>' +
          '<div class="lib__list" data-list></div>' +
        '</div>';

      function paint() {
        var list = active === 'All' ? prompts
          : prompts.filter(function (p) { return p.category === active; });
        $('[data-list]', view).innerHTML = list.map(promptCard).join('');
        wirePromptCards($('[data-list]', view));
      }
      $$('[data-cat]', view).forEach(function (b) {
        b.addEventListener('click', function () {
          active = b.dataset.cat;
          $$('[data-cat]', view).forEach(function (x) { x.classList.toggle('is-on', x === b); });
          paint();
        });
      });
      paint();
    } catch (e) {
      errorState(view, e.message, function () { mountPrompts(view); });
    }
  }

  /* ======================================================== page: progress */

  async function mountProgress(view) {
    skeleton(view, 'dash');
    try {
      var content = await KMDB.content();
      var model = buildModel(content);
      var rows = await KMDB.progressRows();
      var attempts = await KMDB.attempts();
      decorate(model, rows, attempts);

      view.innerHTML =
        '<div class="app__head"><div><span class="t-tag">My progress</span>' +
        '<h1 class="app__title" style="margin-top:14px">Where you are.</h1></div></div>' +

        '<div class="dash">' +
          '<div class="panel"><div class="meter">' +
            '<div class="meter__top"><span class="mono">Course</span><span class="mono">' +
              model.completed + ' / ' + model.total + '</span></div>' +
            '<span class="meter__pct" data-count="' + model.percentage + '">0%</span>' +
            '<span class="meter__line"><i style="--p:' + (model.percentage / 100) + '"></i></span>' +
          '</div></div>' +
          '<div class="panel"><div class="panel__head"><h3>Assessments</h3></div>' +
            (attempts.length
              ? '<div class="minilist">' + attempts.slice(0, 6).map(function (a) {
                  var q = (content.quizzes || []).filter(function (x) { return x.id === a.quiz_id; })[0];
                  return '<div class="minilist__row"><span class="minilist__n">' + a.percentage +
                    '%</span><span class="minilist__t">' + esc(q ? q.title : 'Assessment') + '</span>' +
                    '<span class="chip ' + (a.passed ? 'is-ok' : 'is-error') + '"><i></i><span>' +
                    (a.passed ? 'passed' : 'not passed') + '</span></span></div>';
                }).join('') + '</div>'
              : '<p class="t-small">No attempts yet.</p>') +
          '</div>' +
        '</div>' +

        '<div style="margin-top:var(--gutter)">' +
          model.levels.map(function (lv) {
            return '<div class="panel" style="margin-bottom:var(--gutter)">' +
              '<div class="panel__head"><h3>Level ' + pad(lv.index) + ' — ' + esc(lv.title) + '</h3>' +
              '<span class="mono">' + lv.doneCount + ' / ' + lv.publishedCount + '</span></div>' +
              '<span class="meter__line"><i style="--p:' + (lv.percentage / 100) + '"></i></span>' +
              '<div class="minilist">' + lv.lessons.map(function (l, i) {
                var p = model.progressMap[l.id];
                return '<div class="minilist__row"><span class="minilist__n">' + pad(i + 1) + '</span>' +
                  '<span class="minilist__t">' + esc(l.title) + '</span>' +
                  '<span class="minilist__x">' + (!l.published ? 'draft'
                    : p && p.completed ? 'complete' : 'not started') + '</span></div>';
              }).join('') + '</div></div>';
          }).join('') +
        '</div>';

      countUp($('[data-count]', view));
    } catch (e) {
      errorState(view, e.message, function () { mountProgress(view); });
    }
  }

  /* ===================================================== page: certificate */

  async function mountCertificate(view) {
    skeleton(view, 'dash');
    try {
      var content = await KMDB.content();
      var model = buildModel(content);
      var attempts = await KMDB.attempts();
      decorate(model, await KMDB.progressRows(), attempts);
      var finalQuiz = (content.quizzes || []).filter(function (q) { return q.slug === 'final-assessment'; })[0];
      var finalPassed = finalQuiz ? attempts.some(function (a) { return a.quiz_id === finalQuiz.id && a.passed; }) : false;
      var eligible = model.percentage >= 100 && finalPassed;

      var res = await KMDB.claimCertificate({
        eligible: eligible, percentage: model.percentage, finalPassed: finalPassed
      });

      var u = state.session.user;
      view.innerHTML = res.issued
        ? '<div class="cert">' +
            '<div class="cert__top"><span class="cert__mark">KM.dev</span>' +
            '<span class="mono">Certificate ' + esc(res.certificate_id) + '</span></div>' +
            '<div><span class="t-tag">Course completed</span>' +
            '<h1 class="cert__title" style="margin-top:16px">AI Web Developer</h1></div>' +
            '<div><span class="mono">Awarded to</span>' +
            '<p class="cert__name" style="margin-top:10px">' + esc(res.name || u.name) + '</p></div>' +
            '<div class="cert__grid">' +
              '<div><span class="mono">Issued</span><p class="t-small">' +
                esc(new Date(res.issued_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })) + '</p></div>' +
              '<div><span class="mono">Lessons completed</span><p class="t-small">' +
                model.completed + ' of ' + model.total + '</p></div>' +
              '<div><span class="mono">Issued by</span><p class="t-small">KM.dev — this is a course ' +
                'completion certificate, not an external accreditation.</p></div>' +
            '</div>' +
          '</div>'
        : '<div class="app__head"><div><span class="t-tag">Certificate</span>' +
          '<h1 class="app__title" style="margin-top:14px">Not yet.</h1></div></div>' +
          '<div class="state state--locked cert__locked">' +
            '<p>The certificate is issued once every published lesson is complete and the final ' +
            'assessment has been passed. Both are checked on the server, so it cannot be claimed early.</p>' +
            '<div class="statgrid" style="width:100%">' +
              stat(model.percentage + '%', 'Lessons complete') +
              stat(finalPassed ? 'Passed' : 'Not yet', 'Final assessment') +
              stat(model.levelsComplete + ' / ' + model.levels.length, 'Levels complete') +
            '</div>' +
            '<a class="btn" href="app-course.html"><span class="btn__label">Keep going</span>' +
            '<i class="btn__arrow"></i></a>' +
          '</div>';
    } catch (e) {
      errorState(view, e.message, function () { mountCertificate(view); });
    }
  }

  /* ======================================================== page: settings */

  async function mountSettings(view) {
    var u = state.session.user;
    view.innerHTML =
      '<div class="app__head"><div><span class="t-tag">Settings</span>' +
      '<h1 class="app__title" style="margin-top:14px">Your account.</h1></div></div>' +
      '<div class="dash">' +
        '<div class="panel">' +
          '<div class="panel__head"><h3>Profile</h3></div>' +
          '<div class="field"><label for="sname">Name</label>' +
            '<input id="sname" type="text" value="' + esc(u.name) + '"></div>' +
          '<div class="field"><label for="semail">Email</label>' +
            '<input id="semail" type="email" value="' + esc(u.email) + '" disabled>' +
            '<span class="field__hint">Changing an email address means re-verifying it, so it is ' +
            'handled by the authentication provider rather than here.</span></div>' +
          '<button class="btn" type="button" data-save-name><span class="btn__label">Save changes</span>' +
          '<i class="btn__arrow"></i></button>' +
        '</div>' +
        '<div class="panel">' +
          '<div class="panel__head"><h3>Session</h3></div>' +
          '<div class="minilist">' +
            '<div class="minilist__row"><span class="minilist__t">Role</span>' +
              '<span class="role' + (u.role === 'admin' ? ' is-admin' : '') + '">' + esc(u.role) + '</span></div>' +
            '<div class="minilist__row"><span class="minilist__t">Data</span>' +
              '<span class="minilist__x">' + (KMDB.live ? 'Supabase' : 'this browser') + '</span></div>' +
          '</div>' +
          (KMDB.live ? '' :
            '<p class="t-small">Preview mode keeps everything in this browser. Clearing it removes ' +
            'the accounts and all progress — useful when you want to walk the flow again from nothing.</p>' +
            '<button class="btn btn--ghost" type="button" data-reset><span class="btn__label">' +
            'Clear preview data</span><i class="btn__arrow"></i></button>') +
        '</div>' +
      '</div>';

    $('[data-save-name]', view).addEventListener('click', async function () {
      var name = $('#sname', view).value.trim();
      if (name.length < 2) { toast('Please enter your name'); return; }
      await KMDB.updateName(name);
      state.session.user.name = name;
      renderAccount();
      toast('Saved');
    });
    var reset = $('[data-reset]', view);
    if (reset) reset.addEventListener('click', async function () {
      KMDB.resetPreview();
      await KMDB.signOut();
      go('index.html');
    });
  }

  /* ========================================================= command palette */

  function mountPalette() {
    if ($('.cmdk')) return;
    var box = document.createElement('div');
    box.className = 'cmdk';
    box.innerHTML =
      '<div class="cmdk__box" role="dialog" aria-modal="true" aria-label="Search">' +
        '<input class="cmdk__input" type="text" placeholder="Search lessons, prompts, levels…" aria-label="Search">' +
        '<div class="cmdk__list" data-list></div>' +
        '<div class="cmdk__foot"><span>↑ ↓ move</span><span>↵ open</span><span>esc close</span></div>' +
      '</div>';
    document.body.appendChild(box);

    var input = $('.cmdk__input', box);
    var list = $('[data-list]', box);
    var items = [], filtered = [], cursor = 0;

    async function ensureIndex() {
      if (items.length) return;
      var content = await KMDB.content();
      var model = buildModel(content);
      model.levels.forEach(function (lv) {
        items.push({ kind: 'Level', t: 'Level ' + pad(lv.index) + ' — ' + lv.title, url: 'app-course.html' });
        lv.lessons.forEach(function (l) {
          items.push({ kind: l.published ? 'Lesson' : 'Draft', t: l.title,
                       url: l.published ? lessonUrl(l.slug) : 'app-course.html',
                       extra: (l.description || '') + ' ' + lv.title });
        });
        if (lv.quiz) items.push({ kind: 'Assessment', t: lv.quiz.title, url: quizUrl(lv.quiz.slug) });
        if (lv.project) items.push({ kind: 'Project', t: lv.project.title, url: projectUrl(lv.project.slug) });
      });
      (content.prompts || []).forEach(function (p) {
        items.push({ kind: 'Prompt', t: p.title, url: 'app-prompts.html', extra: p.category + ' ' + p.purpose });
      });
      [['Dashboard', 'app-dashboard.html'], ['Course', 'app-course.html'],
       ['My progress', 'app-progress.html'], ['Projects', 'app-projects.html'],
       ['Prompt library', 'app-prompts.html'], ['Certificate', 'app-certificate.html'],
       ['Settings', 'app-settings.html']].forEach(function (p) {
        items.push({ kind: 'Go to', t: p[0], url: p[1] });
      });
    }

    function paint() {
      var q = input.value.trim().toLowerCase();
      filtered = q
        ? items.filter(function (it) {
            return (it.t + ' ' + (it.extra || '') + ' ' + it.kind).toLowerCase().indexOf(q) >= 0;
          }).slice(0, 40)
        : items.filter(function (it) { return it.kind === 'Go to' || it.kind === 'Level'; }).slice(0, 12);
      cursor = 0;
      list.innerHTML = filtered.length
        ? filtered.map(function (it, i) {
            return '<button class="cmdk__item' + (i === 0 ? ' is-active' : '') + '" type="button" data-i="' + i + '">' +
              '<span class="cmdk__kind">' + esc(it.kind) + '</span>' +
              '<span class="cmdk__t">' + esc(it.t) + '</span></button>';
          }).join('')
        : '<div class="cmdk__empty">Nothing matches “' + esc(input.value) + '”.</div>';
      $$('.cmdk__item', list).forEach(function (b) {
        b.addEventListener('click', function () { go(filtered[+b.dataset.i].url); });
      });
    }

    function move(d) {
      if (!filtered.length) return;
      cursor = (cursor + d + filtered.length) % filtered.length;
      $$('.cmdk__item', list).forEach(function (b, i) { b.classList.toggle('is-active', i === cursor); });
      var active = $('.cmdk__item.is-active', list);
      if (active) active.scrollIntoView({ block: 'nearest' });
    }

    async function open() {
      await ensureIndex();
      paint();
      box.classList.add('is-on');
      input.value = '';
      paint();
      input.focus();
    }
    function close() { box.classList.remove('is-on'); }

    input.addEventListener('input', paint);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      if (e.key === 'Enter' && filtered[cursor]) go(filtered[cursor].url);
      if (e.key === 'Escape') close();
    });
    box.addEventListener('click', function (e) { if (e.target === box) close(); });

    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); open(); }
      if (e.key === 'Escape') close();
    });

    KMApp.openPalette = open;
  }

  /* ================================================================= boot */

  var VIEWS = {
    auth: mountAuth,
    dashboard: mountDashboard,
    course: mountCourse,
    lesson: mountLesson,
    assessment: mountAssessment,
    project: mountProject,
    prompts: mountPrompts,
    progress: mountProgress,
    certificate: mountCertificate,
    settings: mountSettings
  };

  async function boot(root) {
    root = root || document;
    var view = $('[data-view]', root);
    var kind = view ? view.dataset.view : null;

    try { await KMDB.init(); } catch (e) {
      if (view) errorState(view, e.message, function () { location.reload(); });
      return;
    }

    /* the account entry in the navbar exists on every page, signed in or not */
    state.session = await KMDB.getSession();
    renderAccount();
    if (!view) return;

    renderPreviewBar();
    renderLearningNav();

    var needsAuth = kind !== 'auth';
    if (needsAuth && !state.session) {
      var back = encodeURIComponent(location.pathname.split('/').pop() + location.search);
      go('login.html?next=' + back);
      return;
    }
    if (kind === 'auth' && state.session) { go('app-dashboard.html'); return; }

    if (state.session) {
      KMDB.touch();
      mountPalette();
      var trigger = $('[data-open-palette]');
      if (trigger) trigger.addEventListener('click', function () { KMApp.openPalette(); });
    }

    var fn = VIEWS[kind];
    if (fn) await fn(view);
  }

  var KMApp = {
    boot: boot,
    toast: toast,
    state: state,
    buildModel: buildModel,
    decorate: decorate,
    lessonUrl: lessonUrl,
    quizUrl: quizUrl,
    projectUrl: projectUrl,
    pad: pad,
    promptCard: promptCard,
    wirePromptCards: wirePromptCards,
    skeleton: skeleton,
    errorState: errorState,
    renderPreviewBar: renderPreviewBar,
    renderAccount: renderAccount,
    _model: null
  };

  if (window.KM && KM.register) {
    KM.register('academy', function (root) { boot(root); });
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { boot(document); });
  } else {
    boot(document);
  }

  return KMApp;
})();
