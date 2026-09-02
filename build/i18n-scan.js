/* Walks the whole academy as a student and as an admin and reports every
   phrase the interface rendered that the Dutch dictionary does not cover.

   The check is deliberately blunt: load each page in English, collect the
   text nodes and the four perceivable attributes, then subtract the keys in
   assets/js/km-i18n.js and everything that came out of the course database.
   What is left is untranslated interface.

     python3 -m http.server 8099
     node build/i18n-scan.js
*/
const { chromium } = require('playwright');

const BASE = 'http://localhost:8099';

const PAGES = [
  ['/login.html', 'form'],
  ['/signup.html', 'form'],
  ['/reset.html', 'form'],
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
  ['/app-settings.html', '#sname'],
  ['/README-academy.html', '.panel']
];

/* README-academy.html is the wiring note for whoever sets the backend up, not
   part of the student's academy, and it stops being reachable the moment a
   Supabase project is connected. It is left in English on purpose. */
const SKIP_PAGES = /README-academy/;

const ADMIN = [
  ['/admin.html', '.admin'],
  ['/admin.html#users', '.admin'],
  ['/admin.html#content', '.admin'],
  ['/admin.html#quizzes', '.admin'],
  ['/admin.html#projects', '.admin'],
  ['/admin.html#settings', '.admin']
];

async function noFonts(ctx) {
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
}

async function signIn(page, who) {
  await page.goto(BASE + '/app-settings.html', { waitUntil: 'networkidle' });
  await page.evaluate(async () => { if (window.KMDB) { await KMDB.init(); await KMDB.signOut(); } });
  await page.evaluate(() => { try { localStorage.setItem('km-lang', 'en'); } catch (e) {} });
  await page.goto(BASE + '/login.html', { waitUntil: 'networkidle' });
  await page.waitForSelector('.demo-key', { timeout: 15000 });
  await page.locator('.demo-key', { hasText: who }).click();
  await page.waitForURL('**/app-dashboard.html', { timeout: 15000 });
}

/* Everything the course database can put on screen. Those strings are
   translated by their own _nl columns, not by the dictionary. */
async function contentStrings(page) {
  return page.evaluate(async () => {
    const out = new Set();
    const push = v => {
      if (typeof v === 'string') {
        out.add(v.trim());
        v.split(/\*\*|`|\n/).forEach(l => { const t = l.trim(); if (t) out.add(t); });
      }
      else if (Array.isArray(v)) v.forEach(push);
      else if (v && typeof v === 'object') Object.values(v).forEach(push);
    };
    push(window.KM_SEED || {});
    return Array.from(out).filter(Boolean);
  });
}

async function collect(page) {
  return page.evaluate(() => {
    const SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, CODE: 1, PRE: 1, TEXTAREA: 1 };
    const SKIP_CLASS = /(^|\s)(blk-code|editor|code-line|term|prompt-c__body|diff|no-i18n)(\s|$)/;
    const skipped = el => SKIP[el.tagName] ||
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
        ['placeholder', 'aria-label', 'title', 'alt'].forEach(a => {
          if (n.hasAttribute(a) && !n.hasAttribute('data-nl-aria')) {
            const v = n.getAttribute(a).trim();
            if (v) found.add(v);
          }
        });
      }
    }
    return Array.from(found);
  });
}

/* Anything with no letters, or nothing but names, numbers and code, is not a
   phrase a reader would notice as being in the wrong language. */
const IGNORE = [
  /^[^A-Za-z]*$/,                      /* numbers, arrows, punctuation */
  /^(KM\.dev|Claude|Supabase|Kain|User B|GitHub|Anthropic)/,
  /^[a-z0-9._/-]+\.(js|json|sql|html|css|py|sh)$/,
  /^(EN|NL|HTML|CSS|JavaScript|JS|URL|AI|UI|API|RLS|SQL|⌘K|esc|S|M)$/,
  /^[a-z_]+\(\)?$/,                    /* is_admin, profiles, role */
  /^(admin_bootstrap|quiz_answers|lesson_progress|is_correct|service_role)$/,
  /^\d+\s*(px|%|ms|em|min|s)$/,
  /^(student|admin|draft|published)$/,
  /^[A-Z]{1,2}$/,                      /* avatar initials, keyboard hints */
  /^[a-z]+@[a-z.]+$/,                  /* addresses */
  /^\{[A-Z0-9 _]+\}$/,                 /* prompt placeholders */
  /^Level \d+/,                        /* "Level" is the same word in Dutch */
  /^Prompt \/ \d+$/,
  /Academy$/                           /* the product name, not a phrase */
];

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
  await noFonts(ctx);
  const page = await ctx.newPage();

  await page.goto(BASE + '/app-dashboard.html', { waitUntil: 'networkidle' });
  const dict = await page.evaluate(() => Object.keys((window.KMT && KMT.dict) || {}));
  const covered = s => page.evaluate(t => !!(window.KMT && KMT.lookup(t)), s);
  const content = new Set(await contentStrings(page));
  const known = new Set(dict);

  const missing = new Map();
  const raw = [];

  async function sweep(list, who) {
    for (const [url, sel] of list) {
      if (SKIP_PAGES.test(url)) continue;
      await page.goto(BASE + url, { waitUntil: 'networkidle' });
      try { await page.waitForSelector(sel, { timeout: 12000 }); } catch (e) {}
      await page.waitForTimeout(350);
      for (const s of await collect(page)) {
        raw.push([s, who + ' ' + url]);
        if (known.has(s) || content.has(s)) continue;
        /* "03 — Context" is a database title with an index in front of it. */
        if (content.has(s.replace(/^\d+\s*[—·/-]?\s*/, '').trim())) continue;
        if (IGNORE.some(r => r.test(s))) continue;
        if (await covered(s)) continue;
        if (!missing.has(s)) missing.set(s, who + ' ' + url);
      }
    }
  }

  await signIn(page, 'User B');
  await sweep(PAGES, 'student');

  await signIn(page, 'Kain');
  await sweep(PAGES, 'admin');
  await sweep(ADMIN, 'admin');

  /* Phase two. English keys must not survive a switch to Dutch — this is what
     proves the engine runs, not merely that the dictionary is complete. */
  const leftover = new Map();
  await page.evaluate(() => { try { localStorage.setItem('km-lang', 'nl'); } catch (e) {} });
  for (const [url, sel] of PAGES.concat(ADMIN)) {
    if (SKIP_PAGES.test(url)) continue;
    await page.goto(BASE + url, { waitUntil: 'networkidle' });
    try { await page.waitForSelector(sel, { timeout: 12000 }); } catch (e) {}
    await page.waitForTimeout(400);
    for (const s of await collect(page)) {
      if (!known.has(s)) continue;
      const nl = await page.evaluate(t => KMT.lookup(t), s);
      if (nl && nl !== s && !leftover.has(s)) leftover.set(s, url);
    }
  }

  require('fs').writeFileSync('/tmp/i18n-raw.json',
    JSON.stringify({ dict, content: Array.from(content), raw }, null, 0));

  await b.close();

  let bad = 0;
  if (missing.size) {
    bad += missing.size;
    console.log('i18n · ' + missing.size + ' phrase(s) with no Dutch:\n');
    for (const [s, where] of missing) {
      console.log('    ' + JSON.stringify(s) + '   [' + where + ']');
    }
  } else {
    console.log('i18n · every rendered phrase is covered by the dictionary');
  }

  if (leftover.size) {
    bad += leftover.size;
    console.log('\ni18n · ' + leftover.size + ' phrase(s) still English in Dutch mode:\n');
    for (const [s, where] of leftover) {
      console.log('    ' + JSON.stringify(s) + '   [' + where + ']');
    }
  } else {
    console.log('i18n · nothing rendered in English once the language is Dutch');
  }
  process.exit(bad ? 1 : 0);
})();
