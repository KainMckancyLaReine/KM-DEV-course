/* Captures the frames the pricing page shows under "Don't imagine the course."

   They are photographs of the running application, taken from the same build
   that ships — signed in, with real course content on screen. That is the
   whole point: a pricing page that shows a drawing of a product is showing
   you a drawing.

     python3 -m http.server 8099
     node build/shots-pricing.js
*/
const { chromium } = require('playwright');
const { prepare } = require('./preview');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:8099';
const OUT = path.join(__dirname, '..', 'assets', 'img');

/* A wide, shallow frame: the pricing page shows these inside a browser
   chrome, so a tall screenshot would only be scaled into illegibility. */
const W = 1440, H = 900;

const SHOTS = [
  ['app-dashboard',   '/app-dashboard.html', '.meter__pct', 0],
  ['app-course',      '/app-course.html', '.level', 0],
  ['app-lesson',      '/app-lesson.html?l=context', '.lesson__title', 420],
  ['app-prompts',     '/app-prompts.html', '.prompt-c', 0],
  ['app-assessment',  '/app-assessment.html?a=foundation-assessment', '.assess__q', 0],
  ['app-project',     '/app-project.html?p=first-landing-page', '.checklist', 260],
  ['app-progress',    '/app-progress.html', '.meter__pct', 0],
  ['app-certificate', '/app-certificate.html', '.state, .cert', 0]
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });

  const b = await chromium.launch();
  const ctx = await prepare(await b.newContext({
    viewport: { width: W, height: H }, deviceScaleFactor: 2
  }));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const page = await ctx.newPage();

  /* Signed in as the student, because that is the product being sold. */
  await page.goto(BASE + '/app-settings.html', { waitUntil: 'networkidle' });
  await page.evaluate(async () => { if (window.KMDB) { await KMDB.init(); await KMDB.signOut(); } });
  await page.goto(BASE + '/login.html', { waitUntil: 'networkidle' });
  await page.waitForSelector('.demo-key');
  await page.locator('.demo-key', { hasText: 'User B' }).click();
  await page.waitForURL('**/app-dashboard.html');

  /* Some progress, so the frames show a course in use rather than an empty
     one. This is the demo student's own record; nothing is invented. */
  await page.evaluate(async () => {
    const c = await KMDB.content();
    const done = c.lessons.filter((l) => l.published).slice(0, 5);
    for (const l of done) await KMDB.setLessonProgress(l.id, { completed: true });
    await KMDB.toggleBookmark(c.lessons.filter((l) => l.published)[6].id);
  });

  for (const [name, url, sel, scroll] of SHOTS) {
    await page.goto(BASE + url, { waitUntil: 'networkidle' });
    try { await page.waitForSelector(sel, { timeout: 12000 }); } catch (e) {}
    /* The preview banner belongs to preview mode, not to the product. */
    await page.evaluate(() => {
      const bar = document.querySelector('.preview-bar');
      if (bar) bar.remove();
    });
    if (scroll) await page.evaluate((y) => window.scrollTo(0, y), scroll);
    await page.waitForTimeout(900);
    const file = path.join(OUT, 'shot-' + name + '.png');
    await page.screenshot({ path: file });
    console.log('  →', path.relative(path.join(__dirname, '..'), file),
                (fs.statSync(file).size / 1024).toFixed(0) + ' KB');
  }

  await b.close();
})();
