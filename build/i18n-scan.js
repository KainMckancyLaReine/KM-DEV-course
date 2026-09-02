/* Walks the whole product in both languages and reports anything that is
   still English after the reader has asked for Dutch.

   The test is deliberately one rule rather than a list of them: load a page in
   English and collect every phrase it rendered; load the same page in Dutch
   and collect again; report what appears in both. It does not matter whether a
   phrase is translated in the markup, by the dictionary, by a render-time
   helper or by a Dutch column in the database — if the two passes disagree,
   it is handled, and if they agree, it is not.

   What that rule cannot know is which repeats are wrong. "Level 01", an email
   address, a file name and a line of CSS are the same in both languages
   because they should be, so those are named in IGNORE below; headlines the
   brand keeps in English are art direction and carry data-split.

     python3 -m http.server 8099
     node build/i18n-scan.js
*/
const { chromium } = require('playwright');
const { prepare } = require('./preview');

const BASE = 'http://localhost:8099';

/* Signed out. A signed-in visitor is redirected off the auth pages, so
   walking them in a logged-in session silently checks the dashboard instead. */
const PUBLIC = [
  ['/login.html', 'form'],
  ['/signup.html', 'form'],
  ['/reset.html', 'form'],
  ['/pricing.html', '.buy'],
  ['/checkout.html', '.co'],
  ['/welcome.html', '.win']
];

const PAGES = [
  ['/app-dashboard.html', '.meter__pct'],
  ['/app-course.html', '.level'],
  ['/app-lesson.html?l=what-is-ai-assisted-development', '.lesson__title'],
  ['/app-lesson.html?l=how-websites-actually-work', '.lesson__title'],
  ['/app-lesson.html?l=frontend-vs-backend', '.lesson__title'],
  ['/app-lesson.html?l=what-claude-can-and-cannot-do', '.lesson__title'],
  ['/app-lesson.html?l=context', '.lesson__title'],
  ['/app-lesson.html?l=good-prompts-vs-bad-prompts', '.lesson__title'],
  ['/app-lesson.html?l=giving-claude-constraints', '.lesson__title'],
  ['/app-lesson.html?l=giving-claude-design-direction', '.lesson__title'],
  ['/app-lesson.html?l=working-with-existing-code', '.lesson__title'],
  ['/app-lesson.html?l=responsive-layout-that-holds', '.lesson__body, .state'],
  ['/app-assessment.html?a=foundation-assessment', '.assess__q'],
  ['/app-assessment.html?a=claude-fundamentals', '.assess__q'],
  ['/app-assessment.html?a=final-assessment', '.state, .assess__q'],
  ['/app-project.html?p=first-landing-page', '.checklist'],
  ['/app-projects.html', '.level'],
  ['/app-progress.html', '.meter__pct'],
  ['/app-prompts.html', '.prompt-c'],
  ['/app-certificate.html', '.state, .cert'],
  ['/app-settings.html', '#sname']
];

const ADMIN = [
  ['/admin.html', '.admin'],
  ['/admin.html#users', '.admin'],
  ['/admin.html#content', '.admin'],
  ['/admin.html#quizzes', '.admin'],
  ['/admin.html#projects', '.admin'],
  ['/admin.html#purchases', '.admin'],
  ['/admin.html#settings', '.admin']
];

async function noFonts(ctx) {
  await prepare(ctx);
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
}

async function setLang(page, lang) {
  await page.evaluate((l) => { try { localStorage.setItem('km-lang', l); } catch (e) {} }, lang);
}

async function signOut(page) {
  await page.goto(BASE + '/app-settings.html', { waitUntil: 'networkidle' });
  await page.evaluate(async () => { if (window.KMDB) { await KMDB.init(); await KMDB.signOut(); } });
}

async function signIn(page, who) {
  await signOut(page);
  await page.goto(BASE + '/login.html', { waitUntil: 'networkidle' });
  await page.waitForSelector('.demo-key', { timeout: 15000 });
  await page.locator('.demo-key', { hasText: who }).click();
  await page.waitForURL('**/app-dashboard.html', { timeout: 15000 });
}

/* Text and the four attributes a reader can perceive. Code, terminals and
   prompt bodies are content rather than interface — their text is source, or
   something the student is meant to paste — so they are left alone. Headlines
   set with data-split are art direction: the site keeps its large typographic
   statements in English on purpose, and that was decided in Phase 1. */
async function collect(page) {
  return page.evaluate(() => {
    const SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, CODE: 1, PRE: 1, TEXTAREA: 1 };
    const SKIP_CLASS = /(^|\s)(blk-code|editor|code-line|term|prompt-c__body|diff|no-i18n)(\s|$)/;
    const skipped = (el) =>
      SKIP[el.tagName] ||
      el.hasAttribute('data-split') ||
      (typeof el.className === 'string' && SKIP_CLASS.test(el.className));

    const found = new Set();
    const w = document.createTreeWalker(document.body,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
        acceptNode(n) {
          if (n.nodeType === 1) return skipped(n) ? NodeFilter.FILTER_REJECT
                                                  : NodeFilter.FILTER_ACCEPT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
    let n;
    while ((n = w.nextNode())) {
      if (n.nodeType === 3) {
        const t = n.nodeValue.trim();
        if (t) found.add(t);
      } else {
        ['placeholder', 'aria-label', 'title', 'alt'].forEach((a) => {
          if (n.hasAttribute(a)) {
            const v = n.getAttribute(a).trim();
            if (v) found.add(v);
          }
        });
      }
    }
    return Array.from(found);
  });
}

/* Repeats that are correct: no letters at all, names, identifiers, numbers
   with units, addresses, and words the two languages share. */
const IGNORE = [
  /^[^A-Za-z]*$/,
  /^(KM\.dev|Claude|Supabase|Stripe|Kain|User B|GitHub|Anthropic|Amsterdam)/,
  /^[a-z0-9._/-]+\.(js|json|sql|html|css|py|sh|nl|com|dev)$/,
  /^(EN|NL|HTML|CSS|JavaScript|JS|URL|AI|UI|API|RLS|SQL|UX|SEO|⌘K|esc)$/,
  /^[a-z_]+\(\)?$/,
  /^(admin_bootstrap|quiz_answers|lesson_progress|is_correct|service_role|has_access|profiles|role)$/,
  /^\d+\s*(px|%|ms|em|min|s|m|h)$/,
  /^(student|admin|draft|published|paid|refunded|cancelled|not_purchased)$/,
  /^[A-Z]{1,2}$/,
  /^[a-z0-9._%+-]+@[a-z0-9.-]+$/,
  /^\{[A-Z0-9 _]+\}$/,
  /^Level \d+/,
  /^Prompt \/ \d+$/,
  /^km\.dev$/,
  /Academy$/,
  /^km\.dev\//,                        /* the addresses in the browser frames */
  /^\d\d[ —]/                          /* "04 — HTML, CSS & JavaScript" */
];

/* Words the brand keeps in English on purpose, in both languages. */
const BRAND = new Set([
  'Overview', 'Course', 'Work', 'FAQ', 'Pricing',
  'Prompt · Code · Website', 'Selected work', 'Ship faster', 'New in', 'Usage',
  'Build websites', 'with AI.', 'Hello.', 'We are building it.',
  'Learn · Build · Understand · Iterate · Ship',
  'Planning', 'Research', 'Design', 'Components', 'Performance', 'Accessibility',
  'Polish', 'Debugging', 'Refactoring', 'Responsive', 'Context', 'Constraints',
  'Output', 'Goal', 'Functionality', 'Technology', 'Studio Vanhorn',
  'Dashboard', 'Account', 'Prompt', 'Prompts', 'Project', 'Projects',
  'Design engineer', 'Front-end dev', 'Layout', 'Bug', 'Style', 'Options',
  'Review', 'Test', 'Build', 'Deploy', 'Final', 'Certificate', 'Idea', 'Code',
  'Animate', 'Purchases', 'Revenue', 'Paid', 'Average',

  /* Terms Dutch developers use in English, which is how the course teaches
     them and how the translation was written on purpose. */
  'Responsive', 'Responsive design', 'Responsive development', 'Responsive QA',
  'Responsive bugs', 'Spacing', 'Typography', 'Composition', 'Motion',
  'Colour', 'State', 'Data', 'Deployment', 'Refactor', 'Final Polish',
  'Checklist', 'Radius', 'Accent', 'HTML, CSS & JavaScript', 'AI Web Developer',
  'ERROR', 'DIAGNOSE', 'FIX', 'TEST', 'Levels', 'Debug', 'Start', 'Menu',

  /* Prompt-library categories are one-word technical labels and are stored
     without a Dutch column on purpose — a Dutch developer says "Animation". */
  'Animation',

  'AI Course', 'AI Developer Course', 'KM.DEV / AI DEVELOPER COURSE',
  'Build websites with AI', 'EN / NL', 'open', 'context', 'constraints', 'output',
  "TypeError: Cannot read properties of null (reading 'addEventListener')\n  at script.js:40",

  /* The fictional studio the demos are built around, and its own copy. */
  'Vanhorn', 'Two people.', 'One studio.', 'Studio',
  '© 2026 KM.dev'
]);

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
  await noFonts(ctx);
  const page = await ctx.newPage();

  const missing = new Map();

  /* One page, both languages. The difference is the answer. */
  async function sweep(list, who, before) {
    for (const [url, sel] of list) {
      const seen = {};
      for (const lang of ['en', 'nl']) {
        if (before) await before();
        await page.goto(BASE + url, { waitUntil: 'networkidle' });
        await setLang(page, lang);
        await page.reload({ waitUntil: 'networkidle' });
        try { await page.waitForSelector(sel, { timeout: 12000 }); } catch (e) {}
        await page.waitForTimeout(400);
        seen[lang] = new Set(await collect(page));
      }
      for (const s of seen.en) {
        if (!seen.nl.has(s)) continue;              /* it changed — handled */
        if (BRAND.has(s)) continue;
        if (IGNORE.some((r) => r.test(s))) continue;
        if (!missing.has(s)) missing.set(s, who + ' ' + url);
      }
    }
  }

  await sweep(PUBLIC, 'public', () => signOut(page));

  await signIn(page, 'User B');
  await sweep(PAGES, 'student', null);

  await signIn(page, 'Kain');
  await sweep(ADMIN, 'admin', null);

  await b.close();

  if (!missing.size) {
    console.log('i18n · nothing stays English when the reader asks for Dutch');
    process.exit(0);
  }
  console.log('i18n · ' + missing.size + ' phrase(s) unchanged between English and Dutch:\n');
  for (const [s, where] of missing) {
    console.log('    ' + JSON.stringify(s) + '   [' + where + ']');
  }
  process.exit(1);
})();
