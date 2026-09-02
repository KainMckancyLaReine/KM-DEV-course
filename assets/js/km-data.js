/* ==========================================================================
   KM.dev Academy — data layer
   --------------------------------------------------------------------------
   One API, two adapters.

   live    · Supabase. Real accounts, real Postgres, row level security. The
             browser never decides a quiz score or who is an admin — those are
             server-side functions that check the caller.

   preview · The same interface against a store in this browser, used when no
             Supabase project is configured. It exists so the whole platform
             can be walked through before a backend is connected. It is
             labelled on every screen and it is not a security boundary; even
             so, passwords are PBKDF2-hashed rather than stored as text.
   ========================================================================== */

window.KMDB = (function () {
  'use strict';

  var cfg = window.KM_CONFIG || {};
  var LIVE = !!(cfg.supabaseUrl && cfg.supabaseAnonKey);
  var COURSE_SLUG = cfg.courseSlug || 'ai-web-developer';

  /* Preview mode has no settings table, so it carries the list price. If it
     ever drifts from the real one, the real one wins the moment a Supabase
     project is connected — this number is never charged to anybody. */
  var PREVIEW_PRICE = { amount: 175000, currency: 'EUR', label: 'One-time payment' };

  /* The shape course_outline() returns, built from a local content object.
     Kept here so preview and live hand the pricing page the same thing. */
  function KMOutline(c, price) {
    if (!c || !c.course) return { found: false };
    var levels = (c.levels || []).slice().sort(function (a, b) { return a.position - b.position; });
    var lessons = c.lessons || [];
    var of = function (id) {
      return lessons.filter(function (l) { return l.level_id === id; })
                    .sort(function (a, b) { return a.position - b.position; });
    };
    var sum = function (rows) {
      return rows.reduce(function (n, l) { return n + (l.estimated_minutes || 0); }, 0);
    };
    return {
      found: true,
      course: c.course,
      price: price,
      totals: {
        levels: levels.length,
        lessons: lessons.length,
        published: lessons.filter(function (l) { return l.published; }).length,
        minutes: sum(lessons),
        projects: (c.projects || []).length,
        assessments: (c.quizzes || []).length,
        questions: (c.questions || []).length,
        prompts: (c.prompts || []).length
      },
      levels: levels.map(function (lv) {
        var ls = of(lv.id);
        return {
          position: lv.position, slug: lv.slug,
          title: lv.title, title_nl: lv.title_nl,
          description: lv.description, description_nl: lv.description_nl,
          lessons: ls.length,
          published: ls.filter(function (l) { return l.published; }).length,
          minutes: sum(ls),
          projects: (c.projects || []).filter(function (p) { return p.level_id === lv.id; }).length,
          assessments: (c.quizzes || []).filter(function (q) { return q.level_id === lv.id; }).length,
          lesson_titles: ls.map(function (l) {
            return { title: l.title, title_nl: l.title_nl,
                     minutes: l.estimated_minutes, published: l.published };
          })
        };
      })
    };
  }

  /* ------------------------------------------------------------ utilities */

  function clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
  function now() { return new Date().toISOString(); }

  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    var b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    var h = [].map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    return [h.slice(0, 8), h.slice(8, 12), h.slice(12, 16), h.slice(16, 20), h.slice(20)].join('-');
  }

  function hex(buf) {
    return [].map.call(new Uint8Array(buf), function (x) {
      return ('0' + x.toString(16)).slice(-2);
    }).join('');
  }

  async function derive(password, saltHex) {
    var enc = new TextEncoder();
    var salt = new Uint8Array((saltHex.match(/../g) || []).map(function (h) { return parseInt(h, 16); }));
    var key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    var bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: salt, iterations: 120000, hash: 'SHA-256' }, key, 256);
    return hex(bits);
  }

  function newSalt() { return hex(crypto.getRandomValues(new Uint8Array(16))); }

  /* ==================================================== preview-mode store */

  var KEY = 'km-academy-v1';

  var Store = {
    read: function () {
      try {
        var raw = localStorage.getItem(KEY);
        if (raw) return JSON.parse(raw);
      } catch (e) { /* private window, blocked storage — fall through */ }
      return null;
    },
    write: function (d) {
      try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* ignore */ }
      Store._mem = d;
    },
    _mem: null,
    get: function () {
      if (Store._mem) return Store._mem;
      var d = Store.read();
      if (!d) { d = Store.fresh(); Store.write(d); }
      /* A page that does not ship the course seed (the marketing site) can
         create the store before the content is known. Fill it in the first
         time a page that does have the seed opens the store. */
      if (window.KM_SEED && (!d.content || !d.content.levels || !d.content.levels.length)) {
        d.content = Store.fresh().content;
        Store.write(d);
      }
      Store._mem = d;
      return d;
    },
    fresh: function () {
      var seed = window.KM_SEED || {};
      return {
        v: 1,
        users: [],
        session: null,
        content: {
          course: clone(seed.course) || null,
          levels: clone(seed.levels) || [],
          lessons: clone(seed.lessons) || [],
          projects: clone(seed.projects) || [],
          prompts: clone(seed.prompts) || [],
          quizzes: clone(seed.quizzes) || [],
          questions: clone(seed.questions) || [],
          answers: clone(seed.answers) || []
        },
        lesson_progress: [],
        lesson_notes: [],
        bookmarks: [],
        project_progress: [],
        quiz_attempts: [],
        certificates: []
      };
    },
    reset: function () {
      Store._mem = null;
      try { localStorage.removeItem(KEY); } catch (e) {}
      return Store.get();
    }
  };

  /* Two accounts exist from the first load so the flow can be walked through
     immediately. Their passwords are generated at runtime and never leave
     this browser; the sign-in buttons on the login screen use them directly,
     which is why no password appears in this source. */
  var DEMO = [
    { name: 'Kain', email: 'kain@km.dev', role: 'admin' },
    { name: 'User B', email: 'userb@km.dev', role: 'student' }
  ];

  async function ensureDemoUsers() {
    var d = Store.get();
    var made = false;
    for (var i = 0; i < DEMO.length; i++) {
      var spec = DEMO[i];
      if (d.users.some(function (u) { return u.email === spec.email; })) continue;
      var salt = newSalt();
      var pw = 'preview-' + hex(crypto.getRandomValues(new Uint8Array(12)));
      d.users.push({
        id: uuid(), name: spec.name, email: spec.email, role: spec.role,
        salt: salt, hash: await derive(pw, salt), demo_key: pw,
        created_at: now(), last_active_at: null
      });
      made = true;
    }
    if (made) Store.write(d);
    return d;
  }

  /* -------------------------------------------------- preview: helpers --- */

  function byId(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function bySlug(list, slug) {
    for (var i = 0; i < list.length; i++) if (list[i].slug === slug) return list[i];
    return null;
  }
  function where(list, pred) { return list.filter(pred); }

  function upsert(list, match, patch) {
    var row = null;
    for (var i = 0; i < list.length; i++) if (match(list[i])) { row = list[i]; break; }
    if (!row) { row = { id: uuid() }; list.push(row); }
    Object.keys(patch).forEach(function (k) { row[k] = patch[k]; });
    return row;
  }

  function publicUser(u) {
    if (!u) return null;
    return { id: u.id, name: u.name, email: u.email, role: u.role,
             created_at: u.created_at, last_active_at: u.last_active_at };
  }

  /* ========================================================= preview adapter */

  var preview = {
    live: false,

    /* demo accounts are created lazily, so a page that only needs the
       session never pays for two key derivations */
    async init() { Store.get(); },

    async getSession() {
      var d = Store.get();
      if (!d.session) return null;
      if (d.session.expires < Date.now()) { d.session = null; Store.write(d); return null; }
      var u = byId(d.users, d.session.user_id);
      return u ? { user: publicUser(u) } : null;
    },

    async demoAccounts() {
      var d = await ensureDemoUsers();
      return d.users
        .filter(function (u) { return u.demo_key; })
        .map(function (u) { return { name: u.name, email: u.email, role: u.role, key: u.demo_key }; });
    },

    async signUp(input) {
      var d = Store.get();
      if (d.users.some(function (u) { return u.email.toLowerCase() === input.email.toLowerCase(); })) {
        throw new Error('An account with that email already exists.');
      }
      var salt = newSalt();
      var user = {
        id: uuid(), name: input.name, email: input.email.toLowerCase(),
        role: 'student', salt: salt, hash: await derive(input.password, salt),
        created_at: now(), last_active_at: now()
      };
      d.users.push(user);
      d.session = { user_id: user.id, expires: Date.now() + 1000 * 60 * 60 * 24 * 14 };
      Store.write(d);
      return { user: publicUser(user) };
    },

    async signIn(input) {
      var d = await ensureDemoUsers();
      var u = d.users.filter(function (x) {
        return x.email.toLowerCase() === String(input.email).toLowerCase();
      })[0];
      if (!u) throw new Error('No account found for that email address.');
      var h = await derive(input.password, u.salt);
      if (h !== u.hash) throw new Error('That password does not match this account.');
      u.last_active_at = now();
      d.session = { user_id: u.id, expires: Date.now() + 1000 * 60 * 60 * 24 * 14 };
      Store.write(d);
      return { user: publicUser(u) };
    },

    async signOut() {
      var d = Store.get();
      d.session = null;
      Store.write(d);
    },

    async resetPassword() {
      throw new Error('Password reset needs a mail server, so it is only available once Supabase is connected.');
    },

    async updateName(name) {
      var d = Store.get();
      var u = byId(d.users, d.session && d.session.user_id);
      if (!u) throw new Error('Not signed in.');
      u.name = name;
      Store.write(d);
      return publicUser(u);
    },

    async touch() {
      var d = Store.get();
      var u = byId(d.users, d.session && d.session.user_id);
      if (u) { u.last_active_at = now(); Store.write(d); }
    },

    async content() { return clone(Store.get().content); },

    async progressRows() {
      var d = Store.get();
      var uid = d.session && d.session.user_id;
      return clone(where(d.lesson_progress, function (r) { return r.user_id === uid; }));
    },

    async setLessonProgress(lessonId, patch) {
      var d = Store.get();
      var uid = d.session.user_id;
      var row = upsert(d.lesson_progress,
        function (r) { return r.user_id === uid && r.lesson_id === lessonId; },
        Object.assign({ user_id: uid, lesson_id: lessonId, last_seen_at: now() }, patch));
      Store.write(d);
      return clone(row);
    },

    async getNote(lessonId) {
      var d = Store.get(), uid = d.session.user_id;
      var row = where(d.lesson_notes, function (r) {
        return r.user_id === uid && r.lesson_id === lessonId;
      })[0];
      return row ? row.body : '';
    },

    async saveNote(lessonId, body) {
      var d = Store.get(), uid = d.session.user_id;
      upsert(d.lesson_notes,
        function (r) { return r.user_id === uid && r.lesson_id === lessonId; },
        { user_id: uid, lesson_id: lessonId, body: body, updated_at: now() });
      Store.write(d);
    },

    async bookmarks() {
      var d = Store.get(), uid = d.session.user_id;
      return where(d.bookmarks, function (r) { return r.user_id === uid; })
        .map(function (r) { return r.lesson_id; });
    },

    async toggleBookmark(lessonId) {
      var d = Store.get(), uid = d.session.user_id;
      var i = d.bookmarks.findIndex(function (r) {
        return r.user_id === uid && r.lesson_id === lessonId;
      });
      if (i >= 0) { d.bookmarks.splice(i, 1); Store.write(d); return false; }
      d.bookmarks.push({ id: uuid(), user_id: uid, lesson_id: lessonId, created_at: now() });
      Store.write(d);
      return true;
    },

    /* ------------------------------------------------------------ access */
    /* Preview mode has no payment provider and says so. It reports the state
       an owner would be in, because the point of preview is to walk the
       product — but it never pretends a payment happened. */
    async accessState() {
      var d = Store.get();
      var u = d.session && byId(d.users, d.session.user_id);
      if (!u) {
        return { signed_in: false, state: 'anonymous', has_access: false, price: PREVIEW_PRICE };
      }
      return {
        signed_in: true, role: u.role, has_access: true,
        state: u.role === 'admin' ? 'admin' : 'active_student',
        preview: true,
        purchase: { status: 'paid', amount: PREVIEW_PRICE.amount,
                    currency: PREVIEW_PRICE.currency, paid_at: u.created_at },
        price: PREVIEW_PRICE
      };
    },

    async outline() {
      /* The public pages load km-outline.js and nothing else; the academy has
         the whole seed. Either is enough to answer this. */
      if (window.KM_OUTLINE) {
        var o = {}, k;
        for (k in KM_OUTLINE) if (Object.prototype.hasOwnProperty.call(KM_OUTLINE, k)) o[k] = KM_OUTLINE[k];
        o.price = PREVIEW_PRICE;
        return o;
      }
      return KMOutline(Store.get().content, PREVIEW_PRICE);
    },

    async purchases() { return []; },

    async startCheckout() {
      throw new Error('Payments need the Supabase backend. This is preview mode.');
    },

    async quizWithQuestions(slug) {
      var d = Store.get(), c = d.content;
      var quiz = bySlug(c.quizzes, slug);
      if (!quiz) return null;
      var qs = where(c.questions, function (q) { return q.quiz_id === quiz.id; })
        .sort(function (a, b) { return a.position - b.position; })
        .map(function (q) {
          return {
            id: q.id, question: q.question, question_nl: q.question_nl,
            type: q.type, points: q.points,
            options: where(c.answers, function (a) { return a.question_id === q.id; })
              .sort(function (a, b) { return a.position - b.position; })
              .map(function (a) { return { id: a.id, answer: a.answer, answer_nl: a.answer_nl }; })
          };
        });
      return { quiz: clone(quiz), questions: qs };
    },

    /* Mirrors the server function so preview and live behave identically. */
    async submitQuiz(quizId, answersMap) {
      var d = Store.get(), c = d.content, uid = d.session.user_id;
      var quiz = byId(c.quizzes, quizId);
      var qs = where(c.questions, function (q) { return q.quiz_id === quizId; })
        .sort(function (a, b) { return a.position - b.position; });
      var score = 0, total = 0, detail = [];

      qs.forEach(function (q) {
        total += q.points;
        var correct = where(c.answers, function (a) { return a.question_id === q.id && a.is_correct; })
          .map(function (a) { return a.id; }).sort();
        var chosen = (answersMap[q.id] || []).slice().sort();
        var ok = correct.length === chosen.length &&
                 correct.every(function (x, i) { return x === chosen[i]; });
        if (ok) score += q.points;
        detail.push({ question_id: q.id, correct: ok, chosen: chosen,
                      answer: correct, explanation: q.explanation,
                      explanation_nl: q.explanation_nl });
      });

      var pct = total ? Math.round(100 * score / total) : 0;
      var passed = pct >= quiz.passing_score;
      d.quiz_attempts.push({
        id: uuid(), user_id: uid, quiz_id: quizId, score: score, total: total,
        percentage: pct, passed: passed, detail: detail, created_at: now()
      });
      Store.write(d);
      return { score: score, total: total, percentage: pct, passed: passed,
               passing_score: quiz.passing_score, detail: detail };
    },

    async attempts() {
      var d = Store.get(), uid = d.session.user_id;
      return clone(where(d.quiz_attempts, function (a) { return a.user_id === uid; }));
    },

    async projectProgress() {
      var d = Store.get(), uid = d.session.user_id;
      return clone(where(d.project_progress, function (r) { return r.user_id === uid; }));
    },

    async saveProject(projectId, patch) {
      var d = Store.get(), uid = d.session.user_id;
      var row = upsert(d.project_progress,
        function (r) { return r.user_id === uid && r.project_id === projectId; },
        Object.assign({ user_id: uid, project_id: projectId, updated_at: now() }, patch));
      Store.write(d);
      return clone(row);
    },

    async certificate() {
      var d = Store.get(), uid = d.session.user_id;
      return clone(where(d.certificates, function (c) { return c.user_id === uid; })[0] || null);
    },

    async claimCertificate(state) {
      var d = Store.get(), uid = d.session.user_id;
      if (!state.eligible) {
        return { issued: false, percentage: state.percentage, final_passed: state.finalPassed };
      }
      var u = byId(d.users, uid);
      var existing = where(d.certificates, function (c) { return c.user_id === uid; })[0];
      if (!existing) {
        existing = {
          id: uuid(), user_id: uid, course_id: d.content.course.id,
          certificate_id: 'KMD-' + new Date().getFullYear() + '-' +
                          uid.replace(/-/g, '').slice(0, 6).toUpperCase(),
          issued_at: now()
        };
        d.certificates.push(existing);
        Store.write(d);
      }
      return { issued: true, certificate_id: existing.certificate_id,
               issued_at: existing.issued_at, name: u.name };
    },

    /* ------------------------------------------------------------- admin */
    /* Preview mode is not a security boundary, but it must behave the same
       way the server does — otherwise the flow you test here is not the flow
       you ship. Every admin call checks the role first, exactly as the
       SECURITY DEFINER functions do in Postgres. */
    admin: {
      _guard: function () {
        var d = Store.get();
        var u = byId(d.users, d.session && d.session.user_id);
        if (!u || u.role !== 'admin') throw new Error('forbidden');
        return d;
      },

      async purchases() {
        this._guard();
        /* Preview mode never took a payment, so it has none to show. Saying
           so is more useful than inventing a row. */
        return [];
      },
      async setAccess() {
        this._guard();
        throw new Error('Access is granted by the database. This is preview mode.');
      },
      async setPrice() {
        this._guard();
        throw new Error('The price lives in the settings table. This is preview mode.');
      },

      async overview() {
        preview.admin._guard();
        var d = Store.get();
        var students = where(d.users, function (u) { return u.role === 'student'; });
        var cutoff = Date.now() - 14 * 864e5;
        var published = where(d.content.lessons, function (l) { return l.published; });
        var perStudent = students.map(function (u) {
          var done = where(d.lesson_progress, function (r) {
            return r.user_id === u.id && r.completed;
          }).length;
          return published.length ? Math.round(100 * done / published.length) : 0;
        });
        var attempts = d.quiz_attempts;
        var byDay = {};
        d.lesson_progress.forEach(function (r) {
          if (!r.completed || !r.completed_at) return;
          var day = r.completed_at.slice(0, 10);
          byDay[day] = (byDay[day] || 0) + 1;
        });
        return {
          total_students: students.length,
          active_students: students.filter(function (u) {
            return u.last_active_at && new Date(u.last_active_at).getTime() > cutoff;
          }).length,
          lessons_completed: where(d.lesson_progress, function (r) { return r.completed; }).length,
          published_lessons: published.length,
          total_lessons: d.content.lessons.length,
          average_progress: perStudent.length
            ? Math.round(perStudent.reduce(function (a, b) { return a + b; }, 0) / perStudent.length) : 0,
          attempts: attempts.length,
          pass_rate: attempts.length
            ? Math.round(100 * attempts.filter(function (a) { return a.passed; }).length / attempts.length) : 0,
          projects_started: where(d.project_progress, function (r) {
            return r.status !== 'not_started';
          }).length,
          completions_by_day: Object.keys(byDay).sort().map(function (k) {
            return { day: k, n: byDay[k] };
          })
        };
      },

      async users() {
        preview.admin._guard();
        var d = Store.get();
        var published = where(d.content.lessons, function (l) { return l.published; }).length;
        return d.users.map(function (u) {
          var done = where(d.lesson_progress, function (r) {
            return r.user_id === u.id && r.completed;
          }).length;
          return {
            id: u.id, name: u.name, email: u.email, role: u.role,
            created_at: u.created_at, last_active_at: u.last_active_at,
            completed_lessons: done, total_lessons: published,
            percentage: published ? Math.round(100 * done / published) : 0,
            attempts: where(d.quiz_attempts, function (a) { return a.user_id === u.id; }).length
          };
        });
      },

      async user(id) {
        preview.admin._guard();
        var d = Store.get();
        var u = byId(d.users, id);
        if (!u) return null;
        return {
          profile: publicUser(u),
          progress: clone(where(d.lesson_progress, function (r) { return r.user_id === id; })),
          attempts: clone(where(d.quiz_attempts, function (a) { return a.user_id === id; })),
          projects: clone(where(d.project_progress, function (p) { return p.user_id === id; }))
        };
      },

      async saveLesson(id, patch) {
        preview.admin._guard();
        var d = Store.get();
        var l = byId(d.content.lessons, id);
        if (!l) throw new Error('Lesson not found.');
        Object.keys(patch).forEach(function (k) { l[k] = patch[k]; });
        l.updated_at = now();
        Store.write(d);
        return clone(l);
      },

      async createLesson(levelId, data) {
        preview.admin._guard();
        var d = Store.get();
        var siblings = where(d.content.lessons, function (l) { return l.level_id === levelId; });
        var row = {
          id: uuid(), level_id: levelId,
          slug: data.slug || ('lesson-' + uuid().slice(0, 8)),
          title: data.title || 'Untitled lesson', description: data.description || '',
          content: data.content || [], position: siblings.length + 1,
          published: false, estimated_minutes: data.estimated_minutes || 10,
          video_url: null, video_duration: null, updated_at: now()
        };
        d.content.lessons.push(row);
        Store.write(d);
        return clone(row);
      },

      async deleteLesson(id) {
        preview.admin._guard();
        var d = Store.get();
        d.content.lessons = d.content.lessons.filter(function (l) { return l.id !== id; });
        d.lesson_progress = d.lesson_progress.filter(function (r) { return r.lesson_id !== id; });
        Store.write(d);
      },

      async reorderLessons(levelId, ids) {
        preview.admin._guard();
        var d = Store.get();
        ids.forEach(function (id, i) {
          var l = byId(d.content.lessons, id);
          if (l && l.level_id === levelId) l.position = i + 1;
        });
        Store.write(d);
      },

      async saveLevel(id, patch) {
        preview.admin._guard();
        var d = Store.get();
        var lv = byId(d.content.levels, id);
        if (!lv) throw new Error('Level not found.');
        Object.keys(patch).forEach(function (k) { lv[k] = patch[k]; });
        Store.write(d);
        return clone(lv);
      },

      async quiz(quizId) {
        preview.admin._guard();
        var d = Store.get(), c = d.content;
        return where(c.questions, function (q) { return q.quiz_id === quizId; })
          .sort(function (a, b) { return a.position - b.position; })
          .map(function (q) {
            return Object.assign(clone(q), {
              answers: where(c.answers, function (a) { return a.question_id === q.id; })
                .sort(function (a, b) { return a.position - b.position; }).map(clone)
            });
          });
      },

      async saveQuiz(id, patch) {
        preview.admin._guard();
        var d = Store.get();
        var qz = byId(d.content.quizzes, id);
        Object.keys(patch).forEach(function (k) { qz[k] = patch[k]; });
        Store.write(d);
        return clone(qz);
      },

      async saveQuestion(quizId, question) {
        preview.admin._guard();
        var d = Store.get(), c = d.content;
        var row = question.id ? byId(c.questions, question.id) : null;
        if (!row) {
          row = { id: uuid(), quiz_id: quizId,
                  position: where(c.questions, function (q) { return q.quiz_id === quizId; }).length + 1 };
          c.questions.push(row);
        }
        row.question = question.question;
        row.type = question.type;
        row.explanation = question.explanation || '';
        row.points = question.points || 1;

        c.answers = c.answers.filter(function (a) { return a.question_id !== row.id; });
        (question.answers || []).forEach(function (a, i) {
          c.answers.push({ id: a.id || uuid(), question_id: row.id, answer: a.answer,
                           is_correct: !!a.is_correct, position: i + 1 });
        });
        Store.write(d);
        return clone(row);
      },

      async deleteQuestion(id) {
        preview.admin._guard();
        var d = Store.get(), c = d.content;
        c.questions = c.questions.filter(function (q) { return q.id !== id; });
        c.answers = c.answers.filter(function (a) { return a.question_id !== id; });
        Store.write(d);
      }
    }
  };

  /* ======================================================= supabase adapter */

  var sb = null;

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('Could not load the Supabase client.')); };
      document.head.appendChild(s);
    });
  }

  function fail(error) {
    if (!error) return;
    throw new Error(error.message || 'Something went wrong.');
  }

  var live = {
    live: true,

    async init() {
      if (!window.supabase) await loadScript(cfg.supabaseScript);
      sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
    },

    async getSession() {
      var s = await sb.auth.getSession();
      if (!s.data.session) return null;
      var r = await sb.from('profiles').select('*').eq('id', s.data.session.user.id).single();
      if (r.error) return null;
      return { user: r.data };
    },

    async demoAccounts() { return []; },

    async signUp(input) {
      var r = await sb.auth.signUp({
        email: input.email, password: input.password,
        options: { data: { name: input.name } }
      });
      fail(r.error);
      if (!r.data.session) {
        throw new Error('Account created. Confirm your email address, then log in.');
      }
      return await live.getSession();
    },

    async signIn(input) {
      var r = await sb.auth.signInWithPassword({ email: input.email, password: input.password });
      if (r.error) throw new Error('That email and password do not match an account.');
      return await live.getSession();
    },

    async signOut() { await sb.auth.signOut(); },

    async resetPassword(email) {
      var r = await sb.auth.resetPasswordForEmail(email, {
        redirectTo: location.origin + location.pathname.replace(/[^/]*$/, 'reset.html')
      });
      fail(r.error);
    },

    async updateName(name) {
      var s = await sb.auth.getUser();
      var r = await sb.from('profiles').update({ name: name }).eq('id', s.data.user.id).select().single();
      fail(r.error);
      return r.data;
    },

    async touch() { await sb.rpc('touch_last_active'); },

    async content() {
      var course = await sb.from('courses').select('*').eq('slug', COURSE_SLUG).single();
      fail(course.error);
      var out = { course: course.data };
      var q = await Promise.all([
        sb.from('levels').select('*').eq('course_id', course.data.id).order('position'),
        sb.from('lessons').select('*').order('position'),
        sb.from('projects').select('*').order('position'),
        sb.from('prompts').select('*').order('position'),
        sb.from('quizzes').select('*').order('position')
      ]);
      q.forEach(function (r) { fail(r.error); });
      out.levels = q[0].data; out.lessons = q[1].data; out.projects = q[2].data;
      out.prompts = q[3].data; out.quizzes = q[4].data;
      return out;
    },

    async progressRows() {
      var r = await sb.from('lesson_progress').select('*');
      fail(r.error);
      return r.data;
    },

    async setLessonProgress(lessonId, patch) {
      var s = await sb.auth.getUser();
      var row = Object.assign({ user_id: s.data.user.id, lesson_id: lessonId, last_seen_at: now() }, patch);
      var r = await sb.from('lesson_progress').upsert(row, { onConflict: 'user_id,lesson_id' }).select().single();
      fail(r.error);
      return r.data;
    },

    async getNote(lessonId) {
      var r = await sb.from('lesson_notes').select('body').eq('lesson_id', lessonId).maybeSingle();
      fail(r.error);
      return r.data ? r.data.body : '';
    },

    async saveNote(lessonId, body) {
      var s = await sb.auth.getUser();
      var r = await sb.from('lesson_notes').upsert(
        { user_id: s.data.user.id, lesson_id: lessonId, body: body, updated_at: now() },
        { onConflict: 'user_id,lesson_id' });
      fail(r.error);
    },

    async bookmarks() {
      var r = await sb.from('bookmarks').select('lesson_id');
      fail(r.error);
      return r.data.map(function (x) { return x.lesson_id; });
    },

    async toggleBookmark(lessonId) {
      var s = await sb.auth.getUser();
      var found = await sb.from('bookmarks').select('id').eq('lesson_id', lessonId).maybeSingle();
      fail(found.error);
      if (found.data) {
        var del = await sb.from('bookmarks').delete().eq('id', found.data.id);
        fail(del.error);
        return false;
      }
      var ins = await sb.from('bookmarks').insert({ user_id: s.data.user.id, lesson_id: lessonId });
      fail(ins.error);
      return true;
    },

    /* ------------------------------------------------------------ access */
    async accessState() {
      var r = await sb.rpc('access_state');
      fail(r.error);
      return r.data;
    },

    async outline() {
      var r = await sb.rpc('course_outline', { p_slug: COURSE_SLUG });
      fail(r.error);
      var o = r.data || { found: false };
      var p = await sb.from('settings').select('value').eq('key', 'course_price').maybeSingle();
      if (p.data && p.data.value) o.price = p.data.value;
      return o;
    },

    async purchases() {
      var r = await sb.from('purchases').select('*').order('created_at', { ascending: false });
      fail(r.error);
      return r.data || [];
    },

    /* Asks the server to open a Stripe Checkout Session. The only thing sent
       is the session's own token: the amount, the course and the account all
       come from the database on the other side. */
    async startCheckout() {
      var s = await sb.auth.getSession();
      if (!s.data.session) throw new Error('Not signed in.');
      var res = await fetch(cfg.supabaseUrl + '/functions/v1/create-checkout', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + s.data.session.access_token,
          apikey: cfg.supabaseAnonKey,
          'content-type': 'application/json'
        },
        body: '{}'
      });
      var out = await res.json().catch(function () { return {}; });
      if (!res.ok) {
        if (out.error === 'already_owned') throw new Error('This account already owns the course.');
        throw new Error(out.error || 'The checkout could not be opened.');
      }
      return out;
    },

    async quizWithQuestions(slug) {
      var qz = await sb.from('quizzes').select('*').eq('slug', slug).maybeSingle();
      fail(qz.error);
      if (!qz.data) return null;
      var qs = await sb.from('quiz_questions')
        .select('id, question, question_nl, type, points, position')
        .eq('quiz_id', qz.data.id).order('position');
      fail(qs.error);
      var ids = qs.data.map(function (q) { return q.id; });
      /* is_correct is not granted to students at the column level, so it is
         not merely omitted here — it cannot be selected. */
      var as = await sb.from('quiz_answers')
        .select('id, question_id, answer, answer_nl, position').in('question_id', ids).order('position');
      fail(as.error);
      return {
        quiz: qz.data,
        questions: qs.data.map(function (q) {
          return Object.assign({}, q, {
            options: as.data.filter(function (a) { return a.question_id === q.id; })
              .map(function (a) { return { id: a.id, answer: a.answer, answer_nl: a.answer_nl }; })
          });
        })
      };
    },

    async submitQuiz(quizId, answersMap) {
      var r = await sb.rpc('submit_quiz', { p_quiz_id: quizId, p_answers: answersMap });
      fail(r.error);
      return r.data;
    },

    async attempts() {
      var r = await sb.from('quiz_attempts').select('*').order('created_at', { ascending: false });
      fail(r.error);
      return r.data;
    },

    async projectProgress() {
      var r = await sb.from('project_progress').select('*');
      fail(r.error);
      return r.data;
    },

    async saveProject(projectId, patch) {
      var s = await sb.auth.getUser();
      var r = await sb.from('project_progress').upsert(
        Object.assign({ user_id: s.data.user.id, project_id: projectId, updated_at: now() }, patch),
        { onConflict: 'user_id,project_id' }).select().single();
      fail(r.error);
      return r.data;
    },

    async certificate() {
      var r = await sb.from('certificates').select('*').maybeSingle();
      fail(r.error);
      return r.data;
    },

    async claimCertificate() {
      var r = await sb.rpc('claim_certificate', { p_course_slug: COURSE_SLUG });
      fail(r.error);
      return r.data;
    },

    admin: {
      async overview() { var r = await sb.rpc('admin_overview'); fail(r.error); return r.data; },
      async users() { var r = await sb.rpc('admin_users'); fail(r.error); return r.data; },

      async purchases() { var r = await sb.rpc('admin_purchases'); fail(r.error); return r.data; },

      /* Granting access by hand — a bank transfer, a refund, a student who
         paid another way. It writes an ordinary purchase row, so there stays
         one definition of who owns the course. */
      async setAccess(userId, status, note) {
        var r = await sb.rpc('admin_set_access',
          { p_user_id: userId, p_status: status, p_note: note || '' });
        fail(r.error); return r.data;
      },

      async setPrice(amount, currency, label) {
        var r = await sb.rpc('admin_set_setting', {
          p_key: 'course_price',
          p_value: { amount: amount, currency: currency || 'EUR',
                     label: label || 'One-time payment' }
        });
        fail(r.error); return r.data;
      },

      async user(id) {
        var q = await Promise.all([
          sb.from('profiles').select('*').eq('id', id).single(),
          sb.from('lesson_progress').select('*').eq('user_id', id),
          sb.from('quiz_attempts').select('*').eq('user_id', id),
          sb.from('project_progress').select('*').eq('user_id', id)
        ]);
        q.forEach(function (r) { fail(r.error); });
        return { profile: q[0].data, progress: q[1].data, attempts: q[2].data, projects: q[3].data };
      },

      async saveLesson(id, patch) {
        var r = await sb.from('lessons')
          .update(Object.assign({}, patch, { updated_at: now() })).eq('id', id).select().single();
        fail(r.error);
        return r.data;
      },

      async createLesson(levelId, data) {
        var count = await sb.from('lessons').select('id', { count: 'exact', head: true }).eq('level_id', levelId);
        var r = await sb.from('lessons').insert({
          level_id: levelId, slug: data.slug, title: data.title || 'Untitled lesson',
          description: data.description || '', content: data.content || [],
          position: (count.count || 0) + 1, published: false,
          estimated_minutes: data.estimated_minutes || 10
        }).select().single();
        fail(r.error);
        return r.data;
      },

      async deleteLesson(id) { var r = await sb.from('lessons').delete().eq('id', id); fail(r.error); },

      async reorderLessons(levelId, ids) {
        for (var i = 0; i < ids.length; i++) {
          var r = await sb.from('lessons').update({ position: i + 1 }).eq('id', ids[i]);
          fail(r.error);
        }
      },

      async saveLevel(id, patch) {
        var r = await sb.from('levels').update(patch).eq('id', id).select().single();
        fail(r.error);
        return r.data;
      },

      async quiz(quizId) { var r = await sb.rpc('admin_quiz', { p_quiz_id: quizId }); fail(r.error); return r.data; },

      async saveQuiz(id, patch) {
        var r = await sb.from('quizzes').update(patch).eq('id', id).select().single();
        fail(r.error);
        return r.data;
      },

      async saveQuestion(quizId, question) {
        var row;
        if (question.id) {
          row = await sb.from('quiz_questions').update({
            question: question.question, type: question.type,
            explanation: question.explanation || '', points: question.points || 1
          }).eq('id', question.id).select().single();
        } else {
          var count = await sb.from('quiz_questions')
            .select('id', { count: 'exact', head: true }).eq('quiz_id', quizId);
          row = await sb.from('quiz_questions').insert({
            quiz_id: quizId, question: question.question, type: question.type,
            explanation: question.explanation || '', points: question.points || 1,
            position: (count.count || 0) + 1
          }).select().single();
        }
        fail(row.error);
        var del = await sb.from('quiz_answers').delete().eq('question_id', row.data.id);
        fail(del.error);
        var ins = await sb.from('quiz_answers').insert(
          (question.answers || []).map(function (a, i) {
            return { question_id: row.data.id, answer: a.answer,
                     is_correct: !!a.is_correct, position: i + 1 };
          }));
        fail(ins.error);
        return row.data;
      },

      async deleteQuestion(id) {
        var r = await sb.from('quiz_questions').delete().eq('id', id);
        fail(r.error);
      }
    }
  };

  /* ========================================================== localization */
  /* Course content is stored twice: the English column and, beside it, the
     Dutch one. The reader's language decides which is handed to the interface.
     An empty translation falls back to English — a gap is worse than a
     sentence in the wrong language. The admin editors deliberately bypass this
     and always see the English record, so a translation can never be saved
     over the source.                                                         */

  var NL_FIELDS = {
    title: 'title_nl', description: 'description_nl', content: 'content_nl',
    brief: 'brief_nl', purpose: 'purpose_nl', body: 'body_nl',
    explanation: 'explanation_nl', subtitle: 'subtitle_nl',
    question: 'question_nl', answer: 'answer_nl'
  };

  function lang() {
    try {
      if (window.KM && KM.currentLang) return KM.currentLang();
      return localStorage.getItem('km-lang') || 'en';
    } catch (e) { return 'en'; }
  }

  function filled(v) {
    if (v == null) return false;
    if (typeof v === 'string') return v.trim() !== '';
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') return Object.keys(v).length > 0;
    return true;
  }

  function localizeRow(row) {
    if (!row || typeof row !== 'object') return row;
    var out = {}, k;
    for (k in row) if (Object.prototype.hasOwnProperty.call(row, k)) out[k] = row[k];
    for (k in NL_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(out, NL_FIELDS[k]) && filled(out[NL_FIELDS[k]])) {
        out[k] = out[NL_FIELDS[k]];
      }
    }
    return out;
  }

  function localize(v) {
    if (lang() !== 'nl') return v;
    if (Array.isArray(v)) return v.map(localizeRow);
    return localizeRow(v);
  }

  function localizeContent(c) {
    if (!c || lang() !== 'nl') return c;
    return {
      course: localize(c.course),
      levels: localize(c.levels || []),
      lessons: localize(c.lessons || []),
      projects: localize(c.projects || []),
      prompts: localize(c.prompts || []),
      quizzes: localize(c.quizzes || []),
      questions: localize(c.questions || []),
      answers: localize(c.answers || [])
    };
  }

  /* ============================================================ public API */

  var A = LIVE ? live : preview;
  var ready = null;

  var API = {
    live: LIVE,
    mode: LIVE ? 'supabase' : 'preview',
    courseSlug: COURSE_SLUG,

    init: function () {
      if (!ready) ready = A.init().then(function () { return API; });
      return ready;
    },

    resetPreview: function () {
      if (LIVE) return;
      Store.reset();
    },

    /* auth */
    getSession: function () { return A.getSession(); },
    demoAccounts: function () { return A.demoAccounts(); },
    signUp: function (i) { return A.signUp(i); },
    signIn: function (i) { return A.signIn(i); },
    signOut: function () { return A.signOut(); },
    resetPassword: function (e) { return A.resetPassword(e); },
    updateName: function (n) { return A.updateName(n); },
    touch: function () { return A.touch(); },

    /* access + purchase */
    accessState: function () { return A.accessState(); },
    outline: function () { return A.outline(); },
    purchases: function () { return A.purchases(); },
    startCheckout: function () { return A.startCheckout(); },

    /* content + progress */
    content: function () { return A.content().then(localizeContent); },
    progressRows: function () { return A.progressRows(); },
    setLessonProgress: function (id, p) { return A.setLessonProgress(id, p); },
    getNote: function (id) { return A.getNote(id); },
    saveNote: function (id, b) { return A.saveNote(id, b); },
    bookmarks: function () { return A.bookmarks(); },
    toggleBookmark: function (id) { return A.toggleBookmark(id); },

    /* quizzes */
    quizWithQuestions: function (slug) {
      return A.quizWithQuestions(slug).then(function (r) {
        if (!r || lang() !== 'nl') return r;
        return {
          quiz: localize(r.quiz),
          questions: (r.questions || []).map(function (q) {
            var out = localizeRow(q);
            out.options = (q.options || []).map(localizeRow);
            return out;
          })
        };
      });
    },
    submitQuiz: function (id, a) {
      return A.submitQuiz(id, a).then(function (r) {
        if (!r || lang() !== 'nl') return r;
        var out = {}, k;
        for (k in r) if (Object.prototype.hasOwnProperty.call(r, k)) out[k] = r[k];
        out.detail = (r.detail || []).map(function (d) {
          var e = {}, kk;
          for (kk in d) if (Object.prototype.hasOwnProperty.call(d, kk)) e[kk] = d[kk];
          if (filled(e.explanation_nl)) e.explanation = e.explanation_nl;
          return e;
        });
        return out;
      });
    },
    attempts: function () {
      return A.attempts().then(function (rows) {
        if (lang() !== 'nl') return rows;
        return (rows || []).map(function (r) {
          var out = {}, k;
          for (k in r) if (Object.prototype.hasOwnProperty.call(r, k)) out[k] = r[k];
          out.detail = (r.detail || []).map(function (d) {
            var e = {}, kk;
            for (kk in d) if (Object.prototype.hasOwnProperty.call(d, kk)) e[kk] = d[kk];
            if (filled(e.explanation_nl)) e.explanation = e.explanation_nl;
            return e;
          });
          return out;
        });
      });
    },

    /* projects + certificate */
    projectProgress: function () { return A.projectProgress(); },
    saveProject: function (id, p) { return A.saveProject(id, p); },
    certificate: function () { return A.certificate(); },
    claimCertificate: function (state) { return A.claimCertificate(state); },

    admin: A.admin
  };

  return API;
})();
