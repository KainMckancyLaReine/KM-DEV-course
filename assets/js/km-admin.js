/* ==========================================================================
   KM.dev Academy — admin
   The interface hides what a student may not use; the database refuses it.
   Every write below goes through a policy or a function that checks the role
   on the server, so this file is convenience, not protection.
   ========================================================================== */

window.KMAdmin = (function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return KMBlocks.esc(s); };
  var pad = function (n) { return ('0' + n).slice(-2); };

  var content = null, model = null, section = 'overview', view = null;

  var SECTIONS = [
    ['overview', 'Overview'],
    ['users', 'Users'],
    ['content', 'Course'],
    ['quizzes', 'Quizzes'],
    ['projects', 'Projects'],
    ['settings', 'Settings']
  ];

  function toast(m) { KMApp.toast(m); }

  async function refresh() {
    content = await KMDB.content();
    model = KMApp.buildModel(content);
  }

  /* ------------------------------------------------------------- overview */

  async function renderOverview(host) {
    host.innerHTML = '<div class="sk sk-block" style="height:220px"></div>';
    var o = await KMDB.admin.overview();
    var days = o.completions_by_day || [];
    var max = Math.max(1, Math.max.apply(null, days.map(function (d) { return d.n; }).concat([1])));

    host.innerHTML =
      '<div class="app__head"><div><span class="t-tag">Overview</span>' +
      '<h2 class="app__title" style="margin-top:12px">The course, in numbers.</h2></div></div>' +
      '<div class="statgrid">' +
        card(o.total_students, 'Total students') +
        card(o.active_students, 'Active in 14 days') +
        card(o.lessons_completed, 'Lessons completed') +
        card(o.average_progress + '%', 'Average progress') +
        card(o.pass_rate + '%', 'Assessment pass rate') +
        card(o.projects_started, 'Projects started') +
      '</div>' +
      '<div class="dash" style="margin-top:var(--gutter)">' +
        '<div class="panel"><div class="panel__head"><h3>Lessons completed, last 14 days</h3>' +
          '<span class="mono">' + days.reduce(function (a, d) { return a + d.n; }, 0) + ' total</span></div>' +
          (days.length
            ? '<div class="chart" data-chart>' + days.map(function (d, i) {
                return '<span class="chart__col" style="height:' + Math.round(100 * d.n / max) +
                  '%;--cd:' + (i * 40) + 'ms" title="' + esc(d.day) + ': ' + d.n + '"></span>';
              }).join('') + '</div>' +
              '<div class="chart__axis"><span class="mono">' + esc(days[0].day) + '</span>' +
              '<span class="mono">' + esc(days[days.length - 1].day) + '</span></div>'
            : '<p class="t-small">No lessons completed in the last fourteen days.</p>') +
        '</div>' +
        '<div class="panel"><div class="panel__head"><h3>Content</h3></div>' +
          '<div class="minilist">' +
            row('Levels', String(model.levels.length)) +
            row('Lessons published', o.published_lessons + ' / ' + o.total_lessons) +
            row('Assessments', String((content.quizzes || []).length)) +
            row('Projects', String((content.projects || []).length)) +
            row('Prompts', String((content.prompts || []).length)) +
          '</div>' +
        '</div>' +
      '</div>';

    var chart = $('[data-chart]', host);
    if (chart) requestAnimationFrame(function () { chart.classList.add('is-in'); });
  }

  function card(v, l) {
    return '<div class="stat"><b>' + esc(String(v)) + '</b><span>' + esc(l) + '</span></div>';
  }
  function row(a, b) {
    return '<div class="minilist__row"><span class="minilist__t">' + esc(a) +
      '</span><span class="minilist__x">' + esc(b) + '</span></div>';
  }

  /* ---------------------------------------------------------------- users */

  async function renderUsers(host, userId) {
    host.innerHTML = '<div class="sk sk-block" style="height:220px"></div>';

    if (userId) {
      var d = await KMDB.admin.user(userId);
      if (!d) { host.innerHTML = '<div class="state"><h3>No such user.</h3></div>'; return; }
      var done = d.progress.filter(function (p) { return p.completed; });
      host.innerHTML =
        '<div class="crumbs"><a href="#" data-back-users>Users</a><i></i>' +
        '<span class="mono">' + esc(d.profile.email) + '</span></div>' +
        '<div class="app__head"><div><span class="t-tag">Student</span>' +
        '<h2 class="app__title" style="margin-top:12px">' + esc(d.profile.name) + '</h2>' +
        '<p class="t-small" style="margin-top:10px">' + esc(d.profile.email) + ' · ' +
        '<span class="role' + (d.profile.role === 'admin' ? ' is-admin' : '') + '">' +
        esc(d.profile.role) + '</span></p></div></div>' +
        '<div class="statgrid">' +
          card(done.length, 'Lessons completed') +
          card(d.attempts.length, 'Assessment attempts') +
          card(d.projects.filter(function (p) { return p.status !== 'not_started'; }).length, 'Projects started') +
        '</div>' +
        '<div class="dash" style="margin-top:var(--gutter)">' +
          '<div class="panel"><div class="panel__head"><h3>Completed lessons</h3></div>' +
            (done.length ? '<div class="minilist">' + done.map(function (p) {
              var l = model.allLessons.filter(function (x) { return x.id === p.lesson_id; })[0];
              return row(l ? l.title : 'Lesson',
                p.completed_at ? String(p.completed_at).slice(0, 10) : '');
            }).join('') + '</div>' : '<p class="t-small">Nothing completed yet.</p>') +
          '</div>' +
          '<div class="panel"><div class="panel__head"><h3>Assessment attempts</h3></div>' +
            (d.attempts.length ? '<div class="minilist">' + d.attempts.map(function (a) {
              var q = (content.quizzes || []).filter(function (x) { return x.id === a.quiz_id; })[0];
              return '<div class="minilist__row"><span class="minilist__t">' +
                esc(q ? q.title : 'Assessment') + '</span><span class="minilist__x">' +
                a.percentage + '% · ' + (a.passed ? 'passed' : 'not passed') + '</span></div>';
            }).join('') + '</div>' : '<p class="t-small">No attempts yet.</p>') +
          '</div>' +
        '</div>';
      $('[data-back-users]', host).addEventListener('click', function (e) {
        e.preventDefault(); renderUsers(host, null);
      });
      return;
    }

    var users = await KMDB.admin.users();
    host.innerHTML =
      '<div class="app__head"><div><span class="t-tag">Users</span>' +
      '<h2 class="app__title" style="margin-top:12px">' + users.length + ' account' +
      (users.length === 1 ? '' : 's') + '</h2></div></div>' +
      '<div class="table__wrap"><table class="table"><thead><tr>' +
        '<th>Name</th><th>Email</th><th>Role</th><th>Progress</th><th>Last active</th><th></th>' +
      '</tr></thead><tbody>' +
      users.map(function (u) {
        return '<tr><td>' + esc(u.name) + '</td>' +
          '<td class="mono" style="text-transform:none;letter-spacing:0">' + esc(u.email) + '</td>' +
          '<td><span class="role' + (u.role === 'admin' ? ' is-admin' : '') + '">' + esc(u.role) + '</span></td>' +
          '<td><span class="bar-mini"><i style="--p:' + ((u.percentage || 0) / 100) + '"></i></span> ' +
            (u.percentage || 0) + '%</td>' +
          '<td class="t-small">' + (u.last_active_at ? String(u.last_active_at).slice(0, 10) : '—') + '</td>' +
          '<td><button class="btn btn--sm btn--ghost" type="button" data-user="' + esc(u.id) + '">' +
            '<span class="btn__label">Open</span></button></td></tr>';
      }).join('') + '</tbody></table></div>';

    $$('[data-user]', host).forEach(function (b) {
      b.addEventListener('click', function () { renderUsers(host, b.dataset.user); });
    });
  }

  /* -------------------------------------------------------------- content */

  var editing = null;

  async function renderContent(host) {
    if (editing) return renderEditor(host, editing);

    host.innerHTML =
      '<div class="app__head"><div><span class="t-tag">Course</span>' +
      '<h2 class="app__title" style="margin-top:12px">' + esc(model.course.title) + '</h2>' +
      '<p class="t-small" style="margin-top:10px">' + model.allLessons.length + ' lessons · ' +
      model.publishedLessons.length + ' published</p></div></div>' +
      model.levels.map(function (lv) {
        return '<div class="panel" style="margin-bottom:var(--gutter)">' +
          '<div class="panel__head">' +
            '<h3>Level ' + pad(lv.index) + ' — ' + esc(lv.title) + '</h3>' +
            '<span style="display:flex;gap:8px;align-items:center">' +
              '<span class="status-pill' + (lv.published ? ' is-published' : '') + '">' +
                (lv.published ? 'published' : 'draft') + '</span>' +
              '<button class="btn btn--sm btn--ghost" type="button" data-toggle-level="' + esc(lv.id) + '">' +
                '<span class="btn__label">' + (lv.published ? 'Unpublish' : 'Publish') + '</span></button>' +
              '<button class="btn btn--sm btn--ghost" type="button" data-add-lesson="' + esc(lv.id) + '">' +
                '<span class="btn__label">Add lesson</span></button>' +
            '</span>' +
          '</div>' +
          '<div class="blocks" data-level-list="' + esc(lv.id) + '">' +
            lv.lessons.map(function (l, i) {
              return '<div class="block-row" draggable="true" data-lesson="' + esc(l.id) + '">' +
                '<div class="block-row__head">' +
                  '<span class="block-row__grip" aria-hidden="true">⋮⋮</span>' +
                  '<span class="block-row__type">' + pad(i + 1) + '</span>' +
                  '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
                    esc(l.title) + '</span>' +
                  '<span class="status-pill' + (l.published ? ' is-published' : '') + '">' +
                    (l.published ? 'published' : 'draft') + '</span>' +
                  '<span class="block-row__acts">' +
                    '<button class="icon-btn" type="button" data-edit="' + esc(l.id) + '" title="Edit">✎</button>' +
                    '<button class="icon-btn is-danger" type="button" data-del="' + esc(l.id) + '" title="Delete">×</button>' +
                  '</span>' +
                '</div></div>';
            }).join('') +
          '</div></div>';
      }).join('');

    $$('[data-edit]', host).forEach(function (b) {
      b.addEventListener('click', function () { editing = b.dataset.edit; renderContent(host); });
    });
    $$('[data-del]', host).forEach(function (b) {
      b.addEventListener('click', async function () {
        var l = model.allLessons.filter(function (x) { return x.id === b.dataset.del; })[0];
        if (!confirmDelete(l ? l.title : 'this lesson')) return;
        await KMDB.admin.deleteLesson(b.dataset.del);
        await refresh();
        renderContent(host);
        toast('Lesson deleted');
      });
    });
    $$('[data-add-lesson]', host).forEach(function (b) {
      b.addEventListener('click', async function () {
        var l = await KMDB.admin.createLesson(b.dataset.addLesson, {
          title: 'Untitled lesson',
          slug: 'lesson-' + Math.random().toString(36).slice(2, 8)
        });
        await refresh();
        editing = l.id;
        renderContent(host);
      });
    });
    $$('[data-toggle-level]', host).forEach(function (b) {
      b.addEventListener('click', async function () {
        var lv = model.levels.filter(function (x) { return x.id === b.dataset.toggleLevel; })[0];
        await KMDB.admin.saveLevel(lv.id, { published: !lv.published });
        await refresh();
        renderContent(host);
      });
    });

    enableDrag(host);
  }

  function confirmDelete(what) {
    return window.confirm('Delete “' + what + '”? Progress recorded against it is removed too.');
  }

  function enableDrag(host) {
    $$('[data-level-list]', host).forEach(function (list) {
      var dragging = null;
      $$('[data-lesson]', list).forEach(function (row) {
        row.addEventListener('dragstart', function () {
          dragging = row; row.classList.add('is-dragging');
        });
        row.addEventListener('dragend', async function () {
          row.classList.remove('is-dragging');
          $$('[data-lesson]', list).forEach(function (r) { r.classList.remove('is-over'); });
          var ids = $$('[data-lesson]', list).map(function (r) { return r.dataset.lesson; });
          await KMDB.admin.reorderLessons(list.dataset.levelList, ids);
          await refresh();
          toast('Order saved');
        });
        row.addEventListener('dragover', function (e) {
          e.preventDefault();
          if (!dragging || dragging === row) return;
          row.classList.add('is-over');
          var r = row.getBoundingClientRect();
          var after = (e.clientY - r.top) > r.height / 2;
          list.insertBefore(dragging, after ? row.nextSibling : row);
        });
        row.addEventListener('dragleave', function () { row.classList.remove('is-over'); });
      });
    });
  }

  /* --------------------------------------------------------- lesson editor */

  var BLOCK_TYPES = [
    ['h', 'Heading'], ['p', 'Text'], ['list', 'List'], ['code', 'Code'],
    ['prompt', 'Prompt'], ['figure', 'Diagram'], ['img', 'Image'], ['video', 'Video'],
    ['callout', 'Callout'], ['task', 'Task'], ['quiz', 'Quiz'], ['demo', 'Interactive demo'],
    ['summary', 'Summary']
  ];

  function blankBlock(t) {
    switch (t) {
      case 'h': return { t: 'h', text: 'New heading' };
      case 'p': return { t: 'p', text: '' };
      case 'list': return { t: 'list', items: [''] };
      case 'code': return { t: 'code', lang: 'html', filename: 'index.html', code: '' };
      case 'prompt': return { t: 'prompt', n: '01', title: '', body: '',
                              why: { context: '', constraints: '', output: '', iteration: '' } };
      case 'figure': return { t: 'figure', kind: 'layers', caption: '' };
      case 'img': return { t: 'img', src: '', alt: '', caption: '' };
      case 'video': return { t: 'video', src: '', duration: '' };
      case 'callout': return { t: 'callout', kind: 'note', title: '', text: '' };
      case 'task': return { t: 'task', title: '', steps: [''], done: '' };
      case 'quiz': return { t: 'quiz', q: '', type: 'single', options: ['', ''], correct: [0], why: '' };
      case 'demo': return { t: 'demo', kind: 'context-compare', title: '' };
      case 'summary': return { t: 'summary', points: [''] };
      default: return { t: 'p', text: '' };
    }
  }

  async function renderEditor(host, lessonId) {
    var lesson = model.allLessons.filter(function (l) { return l.id === lessonId; })[0];
    if (!lesson) { editing = null; return renderContent(host); }
    var draft = JSON.parse(JSON.stringify(lesson));
    var dirty = false;

    function markDirty() {
      dirty = true;
      $('[data-state]', host).textContent = 'Unsaved changes';
    }

    function paint() {
      host.innerHTML =
        '<div class="crumbs"><a href="#" data-back>Course</a><i></i>' +
        '<span class="mono">' + esc(draft.slug) + '</span></div>' +
        '<div class="app__head"><div><span class="t-tag">Lesson editor</span>' +
          '<h2 class="app__title" style="margin-top:12px">' + esc(draft.title) + '</h2></div>' +
          '<span class="status-pill' + (draft.published ? ' is-published' : '') + '">' +
            (draft.published ? 'published' : 'draft') + '</span></div>' +

        '<div class="editor-grid">' +
          '<div class="panel">' +
            '<div class="field"><label for="e-title">Title</label>' +
              '<input id="e-title" type="text" value="' + esc(draft.title) + '"></div>' +
            '<div class="field"><label for="e-slug">Slug</label>' +
              '<input id="e-slug" type="text" value="' + esc(draft.slug) + '"></div>' +
            '<div class="field"><label for="e-desc">Description</label>' +
              '<textarea id="e-desc" style="min-height:80px">' + esc(draft.description) + '</textarea></div>' +
            '<div class="field"><label for="e-min">Estimated minutes</label>' +
              '<input id="e-min" type="number" min="1" value="' + (draft.estimated_minutes || 10) + '"></div>' +
            '<div class="field"><label for="e-video">Video URL</label>' +
              '<input id="e-video" type="url" value="' + esc(draft.video_url || '') + '" placeholder="https://…">' +
              '<span class="field__hint">Leave empty and the player shows an honest placeholder ' +
              'rather than pretending a video exists.</span></div>' +
          '</div>' +

          '<div>' +
            '<div class="panel__head"><h3>Content blocks</h3>' +
              '<span class="mono">' + draft.content.length + ' blocks</span></div>' +
            '<div class="blocks" data-blocks>' +
              draft.content.map(blockRow).join('') +
            '</div>' +
            '<div class="pillrow" style="margin-top:14px">' +
              BLOCK_TYPES.map(function (b) {
                return '<button class="idemo__tab" type="button" data-add="' + b[0] + '">+ ' + esc(b[1]) + '</button>';
              }).join('') +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="savebar">' +
          '<button class="btn" type="button" data-save><span class="btn__label">Save draft</span>' +
            '<i class="btn__arrow"></i></button>' +
          '<button class="btn btn--ghost" type="button" data-preview><span class="btn__label">Preview</span>' +
            '<i class="btn__arrow"></i></button>' +
          '<button class="btn ' + (draft.published ? 'btn--ghost' : 'btn--accent') + '" type="button" data-publish>' +
            '<span class="btn__label">' + (draft.published ? 'Unpublish' : 'Publish') + '</span>' +
            '<i class="btn__arrow"></i></button>' +
          '<span class="savebar__state" data-state>' + (dirty ? 'Unsaved changes' : 'Saved') + '</span>' +
        '</div>';

      $('[data-back]', host).addEventListener('click', function (e) {
        e.preventDefault();
        if (dirty && !window.confirm('Leave without saving?')) return;
        editing = null; renderContent(host);
      });

      ['title', 'slug', 'desc', 'min', 'video'].forEach(function (k) {
        var input = $('#e-' + k, host);
        if (!input) return;
        input.addEventListener('input', function () {
          if (k === 'title') draft.title = input.value;
          if (k === 'slug') draft.slug = input.value;
          if (k === 'desc') draft.description = input.value;
          if (k === 'min') draft.estimated_minutes = +input.value || 10;
          if (k === 'video') draft.video_url = input.value;
          markDirty();
        });
      });

      wireBlocks();

      $$('[data-add]', host).forEach(function (b) {
        b.addEventListener('click', function () {
          draft.content.push(blankBlock(b.dataset.add));
          markDirty();
          paint();
        });
      });

      $('[data-save]', host).addEventListener('click', save);
      $('[data-publish]', host).addEventListener('click', async function () {
        draft.published = !draft.published;
        await save();
        paint();
      });
      $('[data-preview]', host).addEventListener('click', async function () {
        await save();
        window.open(KMApp.lessonUrl(draft.slug), '_blank', 'noopener');
      });
    }

    async function save() {
      try {
        await KMDB.admin.saveLesson(draft.id, {
          title: draft.title, slug: draft.slug, description: draft.description,
          content: draft.content, estimated_minutes: draft.estimated_minutes,
          published: draft.published, video_url: draft.video_url || null
        });
        dirty = false;
        var s = $('[data-state]', host);
        if (s) s.textContent = 'Saved ' + new Date().toLocaleTimeString();
        await refresh();
        toast('Lesson saved');
      } catch (e) { toast(e.message); }
    }

    function blockRow(b, i) {
      var body = '';
      if (b.t === 'h' || b.t === 'p') {
        body = '<textarea data-f="text" data-i="' + i + '">' + esc(b.text || '') + '</textarea>';
      } else if (b.t === 'list' || b.t === 'summary') {
        var key = b.t === 'list' ? 'items' : 'points';
        body = '<textarea data-f="' + key + '" data-i="' + i + '" data-lines>' +
          esc((b[key] || []).join('\n')) + '</textarea>';
      } else if (b.t === 'code') {
        body = '<input type="text" data-f="filename" data-i="' + i + '" value="' + esc(b.filename || '') +
          '" placeholder="file name" style="margin-bottom:8px">' +
          '<textarea data-f="code" data-i="' + i + '" style="font-family:\'Space Mono\',monospace">' +
          esc(b.code || '') + '</textarea>';
      } else if (b.t === 'prompt') {
        body = '<input type="text" data-f="title" data-i="' + i + '" value="' + esc(b.title || '') +
          '" placeholder="prompt title" style="margin-bottom:8px">' +
          '<textarea data-f="body" data-i="' + i + '">' + esc(b.body || '') + '</textarea>';
      } else if (b.t === 'callout') {
        body = '<input type="text" data-f="title" data-i="' + i + '" value="' + esc(b.title || '') +
          '" placeholder="title" style="margin-bottom:8px">' +
          '<textarea data-f="text" data-i="' + i + '">' + esc(b.text || '') + '</textarea>';
      } else if (b.t === 'task') {
        body = '<input type="text" data-f="title" data-i="' + i + '" value="' + esc(b.title || '') +
          '" placeholder="task title" style="margin-bottom:8px">' +
          '<textarea data-f="steps" data-i="' + i + '" data-lines>' + esc((b.steps || []).join('\n')) + '</textarea>';
      } else if (b.t === 'img') {
        body = '<input type="text" data-f="src" data-i="' + i + '" value="' + esc(b.src || '') +
          '" placeholder="image URL" style="margin-bottom:8px">' +
          '<input type="text" data-f="caption" data-i="' + i + '" value="' + esc(b.caption || '') +
          '" placeholder="caption">';
      } else if (b.t === 'video') {
        body = '<input type="text" data-f="src" data-i="' + i + '" value="' + esc(b.src || '') +
          '" placeholder="video URL">';
      } else if (b.t === 'figure' || b.t === 'demo') {
        var kinds = b.t === 'figure'
          ? Object.keys(KMBlocks.diagrams)
          : ['context-compare', 'code-explainer', 'trust-boundary', 'session', 'versus',
             'instruction-gap', 'prompt-builder', 'constraint-lab', 'direction-lab', 'diff-review'];
        body = '<select data-f="kind" data-i="' + i + '" style="width:100%;padding:10px;border:1px solid var(--line);border-radius:8px">' +
          kinds.map(function (k) {
            return '<option value="' + esc(k) + '"' + (b.kind === k ? ' selected' : '') + '>' + esc(k) + '</option>';
          }).join('') + '</select>' +
          '<input type="text" data-f="caption" data-i="' + i + '" value="' + esc(b.caption || b.title || '') +
          '" placeholder="caption" style="margin-top:8px">';
      } else if (b.t === 'quiz') {
        body = '<textarea data-f="q" data-i="' + i + '" placeholder="question">' + esc(b.q || '') + '</textarea>' +
          '<textarea data-f="options" data-i="' + i + '" data-lines placeholder="one option per line" ' +
          'style="margin-top:8px">' + esc((b.options || []).join('\n')) + '</textarea>' +
          '<input type="text" data-f="correct" data-i="' + i + '" value="' + esc((b.correct || []).join(',')) +
          '" placeholder="index of correct answers, e.g. 1" style="margin-top:8px">' +
          '<textarea data-f="why" data-i="' + i + '" placeholder="explanation" style="margin-top:8px">' +
          esc(b.why || '') + '</textarea>';
      }
      return '<div class="block-row" draggable="true" data-block="' + i + '">' +
        '<div class="block-row__head">' +
          '<span class="block-row__grip" aria-hidden="true">⋮⋮</span>' +
          '<span class="block-row__type">' + esc(b.t) + '</span>' +
          '<span class="block-row__acts">' +
            '<button class="icon-btn" type="button" data-up="' + i + '" title="Move up">↑</button>' +
            '<button class="icon-btn" type="button" data-down="' + i + '" title="Move down">↓</button>' +
            '<button class="icon-btn is-danger" type="button" data-rm="' + i + '" title="Remove">×</button>' +
          '</span>' +
        '</div>' + body + '</div>';
    }

    function wireBlocks() {
      $$('[data-f]', host).forEach(function (input) {
        if (input.id && input.id.indexOf('e-') === 0) return;
        input.addEventListener('input', function () {
          var i = +input.dataset.i, f = input.dataset.f, b = draft.content[i];
          if (input.hasAttribute('data-lines')) {
            b[f] = input.value.split('\n');
          } else if (f === 'correct') {
            b[f] = input.value.split(',').map(function (x) { return parseInt(x, 10); })
              .filter(function (x) { return !isNaN(x); });
          } else {
            b[f] = input.value;
          }
          markDirty();
        });
        input.addEventListener('change', function () {
          if (input.tagName === 'SELECT') {
            draft.content[+input.dataset.i][input.dataset.f] = input.value;
            markDirty();
          }
        });
      });
      $$('[data-rm]', host).forEach(function (b) {
        b.addEventListener('click', function () {
          draft.content.splice(+b.dataset.rm, 1); markDirty(); paint();
        });
      });
      $$('[data-up]', host).forEach(function (b) {
        b.addEventListener('click', function () {
          var i = +b.dataset.up;
          if (i === 0) return;
          var x = draft.content.splice(i, 1)[0];
          draft.content.splice(i - 1, 0, x);
          markDirty(); paint();
        });
      });
      $$('[data-down]', host).forEach(function (b) {
        b.addEventListener('click', function () {
          var i = +b.dataset.down;
          if (i >= draft.content.length - 1) return;
          var x = draft.content.splice(i, 1)[0];
          draft.content.splice(i + 1, 0, x);
          markDirty(); paint();
        });
      });

      var list = $('[data-blocks]', host);
      if (!list) return;
      var dragging = null;
      $$('[data-block]', list).forEach(function (rowEl) {
        rowEl.addEventListener('dragstart', function () { dragging = rowEl; rowEl.classList.add('is-dragging'); });
        rowEl.addEventListener('dragend', function () {
          rowEl.classList.remove('is-dragging');
          var order = $$('[data-block]', list).map(function (r) { return +r.dataset.block; });
          draft.content = order.map(function (i) { return draft.content[i]; });
          markDirty();
          paint();
        });
        rowEl.addEventListener('dragover', function (e) {
          e.preventDefault();
          if (!dragging || dragging === rowEl) return;
          var r = rowEl.getBoundingClientRect();
          list.insertBefore(dragging, (e.clientY - r.top) > r.height / 2 ? rowEl.nextSibling : rowEl);
        });
      });
    }

    paint();
  }

  /* -------------------------------------------------------------- quizzes */

  var editingQuiz = null;

  async function renderQuizzes(host) {
    if (editingQuiz) return renderQuizEditor(host, editingQuiz);

    host.innerHTML =
      '<div class="app__head"><div><span class="t-tag">Quizzes</span>' +
      '<h2 class="app__title" style="margin-top:12px">Assessments</h2></div></div>' +
      '<div class="table__wrap"><table class="table"><thead><tr>' +
      '<th>Title</th><th>Level</th><th>Questions</th><th>Pass mark</th><th>Status</th><th></th>' +
      '</tr></thead><tbody>' +
      (content.quizzes || []).map(function (q) {
        var lv = model.levels.filter(function (l) { return l.id === q.level_id; })[0];
        return '<tr><td>' + esc(q.title) + '</td>' +
          '<td class="t-small">' + (lv ? 'Level ' + pad(lv.index) : '—') + '</td>' +
          '<td data-count="' + esc(q.id) + '">…</td>' +
          '<td>' + q.passing_score + '%</td>' +
          '<td><span class="status-pill' + (q.published ? ' is-published' : '') + '">' +
            (q.published ? 'published' : 'draft') + '</span></td>' +
          '<td><button class="btn btn--sm btn--ghost" type="button" data-quiz="' + esc(q.id) + '">' +
          '<span class="btn__label">Edit</span></button></td></tr>';
      }).join('') + '</tbody></table></div>';

    for (var i = 0; i < (content.quizzes || []).length; i++) {
      var q = content.quizzes[i];
      var qs = await KMDB.admin.quiz(q.id);
      var cell = $('[data-count="' + q.id + '"]', host);
      if (cell) cell.textContent = qs.length;
    }

    $$('[data-quiz]', host).forEach(function (b) {
      b.addEventListener('click', function () { editingQuiz = b.dataset.quiz; renderQuizzes(host); });
    });
  }

  async function renderQuizEditor(host, quizId) {
    var quiz = (content.quizzes || []).filter(function (q) { return q.id === quizId; })[0];
    var questions = await KMDB.admin.quiz(quizId);

    host.innerHTML =
      '<div class="crumbs"><a href="#" data-back>Quizzes</a><i></i>' +
      '<span class="mono">' + esc(quiz.slug) + '</span></div>' +
      '<div class="app__head"><div><span class="t-tag">Quiz editor</span>' +
      '<h2 class="app__title" style="margin-top:12px">' + esc(quiz.title) + '</h2></div>' +
      '<span style="display:flex;gap:8px;align-items:center">' +
        '<span class="status-pill' + (quiz.published ? ' is-published' : '') + '">' +
          (quiz.published ? 'published' : 'draft') + '</span>' +
        '<button class="btn btn--sm ' + (quiz.published ? 'btn--ghost' : 'btn--accent') + '" type="button" data-pub>' +
        '<span class="btn__label">' + (quiz.published ? 'Unpublish' : 'Publish') + '</span></button>' +
      '</span></div>' +
      '<div class="blocks" data-qs>' + questions.map(questionRow).join('') + '</div>' +
      '<div class="pillrow" style="margin-top:14px">' +
        '<button class="btn btn--ghost btn--sm" type="button" data-addq>' +
        '<span class="btn__label">Add question</span><i class="btn__arrow"></i></button></div>';

    $('[data-back]', host).addEventListener('click', function (e) {
      e.preventDefault(); editingQuiz = null; renderQuizzes(host);
    });
    $('[data-pub]', host).addEventListener('click', async function () {
      await KMDB.admin.saveQuiz(quizId, { published: !quiz.published });
      await refresh();
      renderQuizEditor(host, quizId);
    });
    $('[data-addq]', host).addEventListener('click', async function () {
      await KMDB.admin.saveQuestion(quizId, {
        question: 'New question', type: 'single', explanation: '', points: 1,
        answers: [{ answer: 'Option A', is_correct: true }, { answer: 'Option B', is_correct: false }]
      });
      await refresh();
      renderQuizEditor(host, quizId);
    });

    $$('[data-saveq]', host).forEach(function (b) {
      b.addEventListener('click', async function () {
        var wrap = b.closest('[data-q]');
        var id = wrap.dataset.q || null;
        var answers = $('[data-answers]', wrap).value.split('\n')
          .map(function (line) { return line.trim(); })
          .filter(Boolean)
          .map(function (line) {
            var correct = /^\*/.test(line);
            return { answer: line.replace(/^\*\s?/, ''), is_correct: correct };
          });
        if (!answers.some(function (a) { return a.is_correct; })) {
          toast('Mark at least one answer with a leading * as correct');
          return;
        }
        await KMDB.admin.saveQuestion(quizId, {
          id: id || undefined,
          question: $('[data-qtext]', wrap).value,
          type: $('[data-qtype]', wrap).value,
          explanation: $('[data-qwhy]', wrap).value,
          points: 1,
          answers: answers
        });
        await refresh();
        toast('Question saved');
        renderQuizEditor(host, quizId);
      });
    });
    $$('[data-delq]', host).forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!window.confirm('Delete this question?')) return;
        await KMDB.admin.deleteQuestion(b.dataset.delq);
        await refresh();
        renderQuizEditor(host, quizId);
      });
    });
  }

  function questionRow(q, i) {
    var types = ['single', 'multi', 'tf', 'scenario', 'prompt', 'debug'];
    return '<div class="block-row" data-q="' + esc(q.id) + '">' +
      '<div class="block-row__head"><span class="block-row__type">' + pad(i + 1) + '</span>' +
        '<select data-qtype style="padding:6px 10px;border:1px solid var(--line);border-radius:8px">' +
          types.map(function (t) {
            return '<option value="' + t + '"' + (q.type === t ? ' selected' : '') + '>' + t + '</option>';
          }).join('') + '</select>' +
        '<span class="block-row__acts">' +
          '<button class="btn btn--sm btn--ghost" type="button" data-saveq><span class="btn__label">Save</span></button>' +
          '<button class="icon-btn is-danger" type="button" data-delq="' + esc(q.id) + '">×</button>' +
        '</span></div>' +
      '<textarea data-qtext placeholder="question">' + esc(q.question) + '</textarea>' +
      '<textarea data-answers placeholder="one answer per line, prefix correct ones with *">' +
        esc((q.answers || []).map(function (a) {
          return (a.is_correct ? '* ' : '') + a.answer;
        }).join('\n')) + '</textarea>' +
      '<textarea data-qwhy placeholder="explanation shown after answering">' + esc(q.explanation || '') + '</textarea>' +
      '</div>';
  }

  /* ------------------------------------------------------------- projects */

  async function renderProjects(host) {
    host.innerHTML =
      '<div class="app__head"><div><span class="t-tag">Projects</span>' +
      '<h2 class="app__title" style="margin-top:12px">Briefs</h2></div></div>' +
      '<div class="table__wrap"><table class="table"><thead><tr>' +
      '<th>Title</th><th>Level</th><th>Requirements</th><th>Checklist</th><th></th>' +
      '</tr></thead><tbody>' +
      (content.projects || []).map(function (p) {
        var lv = model.levels.filter(function (l) { return l.id === p.level_id; })[0];
        var b = p.brief || {};
        return '<tr><td>' + esc(p.title) + '</td>' +
          '<td class="t-small">' + (lv ? 'Level ' + pad(lv.index) : '—') + '</td>' +
          '<td>' + (b.requirements || []).length + '</td>' +
          '<td>' + (b.checklist || []).length + '</td>' +
          '<td><a class="btn btn--sm btn--ghost" href="' + KMApp.projectUrl(p.slug) + '" target="_blank" rel="noopener">' +
          '<span class="btn__label">View</span></a></td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<p class="t-small" style="margin-top:18px">Project briefs live in <code>content/course.json</code> ' +
      'and are regenerated by <code>build/gen_seed.py</code>, so they stay in version control alongside ' +
      'the rest of the course.</p>';
  }

  /* ------------------------------------------------------------- settings */

  async function renderSettings(host) {
    host.innerHTML =
      '<div class="app__head"><div><span class="t-tag">Settings</span>' +
      '<h2 class="app__title" style="margin-top:12px">How this instance is wired</h2></div></div>' +
      '<div class="dash">' +
        '<div class="panel"><div class="panel__head"><h3>Data</h3></div>' +
          '<div class="minilist">' +
            row('Mode', KMDB.live ? 'Supabase' : 'Preview (this browser)') +
            row('Course slug', KMDB.courseSlug) +
            row('Levels', String(model.levels.length)) +
            row('Lessons', String(model.allLessons.length)) +
          '</div>' +
          (KMDB.live ? '' : '<p class="t-small">Add your Supabase URL and anon key to ' +
            '<code>assets/js/km-config.js</code>, run <code>db/schema.sql</code> and ' +
            '<code>db/seed.sql</code>, and this switches to real accounts with server-side ' +
            'authorization. Nothing in the interface changes.</p>') +
        '</div>' +
        '<div class="panel"><div class="panel__head"><h3>Authorization</h3></div>' +
          '<p class="t-small">Admin access is decided by the <code>role</code> column on ' +
          '<code>profiles</code> and enforced by row level security and SECURITY DEFINER ' +
          'functions. Hiding this section from a student is a convenience; the database is ' +
          'what actually refuses them.</p>' +
          '<p class="t-small">New admins are created by adding their email to ' +
          '<code>admin_bootstrap</code> before they sign up, or by an existing admin changing ' +
          'their role. No password ever appears in front-end code.</p>' +
        '</div>' +
      '</div>';
  }

  /* ----------------------------------------------------------------- boot */

  var RENDER = {
    overview: renderOverview,
    users: function (h) { return renderUsers(h, null); },
    content: renderContent,
    quizzes: renderQuizzes,
    projects: renderProjects,
    settings: renderSettings
  };

  async function boot(root) {
    view = $('[data-admin]', root || document);
    if (!view) return;

    await KMDB.init();
    if (KMApp.renderPreviewBar) KMApp.renderPreviewBar();
    var session = await KMDB.getSession();
    if (!session) { location.href = 'login.html?next=admin.html'; return; }
    if (session.user.role !== 'admin') {
      view.innerHTML = '<div class="state"><span class="t-tag">Not available</span>' +
        '<h3>This area is for administrators.</h3>' +
        '<p>Your account is a student account. The database refuses admin queries from it, ' +
        'so there is nothing to see here even with the interface open.</p>' +
        '<a class="btn btn--ghost" href="app-dashboard.html"><span class="btn__label">Your dashboard</span>' +
        '<i class="btn__arrow"></i></a></div>';
      return;
    }

    await refresh();

    view.innerHTML =
      '<div class="admin">' +
        '<nav class="admin__nav">' + SECTIONS.map(function (s, i) {
          return '<button type="button" data-sec="' + s[0] + '"' +
            (i === 0 ? ' class="is-on"' : '') + '>' + esc(s[1]) +
            '<span class="mono">' + pad(i + 1) + '</span></button>';
        }).join('') + '</nav>' +
        '<div data-panel></div>' +
      '</div>';

    var panel = $('[data-panel]', view);
    $$('[data-sec]', view).forEach(function (b) {
      b.addEventListener('click', async function () {
        section = b.dataset.sec;
        editing = null; editingQuiz = null;
        $$('[data-sec]', view).forEach(function (x) { x.classList.toggle('is-on', x === b); });
        await RENDER[section](panel);
      });
    });

    await RENDER[section](panel);
  }

  if (window.KM && KM.register) {
    KM.register('academy-admin', function (root) { boot(root); });
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { boot(document); });
  } else {
    boot(document);
  }

  return { boot: boot };
})();
