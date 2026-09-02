/* Responsive + console + reduced-motion check for every academy page,
   signed in as a student and again as an admin. Also captures screenshots. */
const { chromium } = require('playwright');
const { prepare } = require('./preview');

const BASE = 'http://localhost:8099';
const noise = /ERR_TUNNEL|fonts\.g|favicon|ERR_FAILED/;
const SIZES = [
  { w: 1440, h: 950, tag: 'desktop' },
  { w: 834, h: 1000, tag: 'tablet' },
  { w: 390, h: 844, tag: 'mobile' }
];

const PAGES = [
  ['/app-dashboard.html', '.meter__pct'],
  ['/app-course.html', '.level'],
  ['/app-lesson.html?l=context', '.lesson__title'],
  ['/app-assessment.html?a=claude-fundamentals', '.assess__q'],
  ['/app-project.html?p=first-landing-page', '.checklist'],
  ['/app-projects.html', '.level'],
  ['/app-progress.html', '.meter__pct'],
  ['/app-prompts.html', '.prompt-c'],
  ['/app-certificate.html', '.state, .cert'],
  ['/app-settings.html', '#sname'],
  ['/README-academy.html', '.panel']
];

async function signIn(page, who) {
  /* sign out first: login.html sends a signed-in visitor to the dashboard */
  await page.goto(BASE + '/app-settings.html', { waitUntil: 'networkidle' });
  await page.evaluate(async () => { if (window.KMDB) { await KMDB.init(); await KMDB.signOut(); } });
  await page.goto(BASE + '/login.html', { waitUntil: 'networkidle' });
  await page.waitForSelector('.demo-key', { timeout: 15000 });
  await page.locator('.demo-key', { hasText: who }).click();
  await page.waitForURL('**/app-dashboard.html', { timeout: 15000 });
}

/* The sandbox has no route to Google Fonts; blocking the request keeps
   networkidle from waiting on a connection that will never open. */
async function noFonts(ctx) {
  await prepare(ctx);
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
}

(async () => {
  const b = await chromium.launch();
  let bad = 0;

  for (const size of SIZES) {
    const ctx = await b.newContext({ viewport: { width: size.w, height: size.h } });
    await noFonts(ctx);
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !noise.test(m.text())) errs.push(m.text()); });

    await signIn(page, 'User B');

    for (const [url, sel] of PAGES) {
      errs.length = 0;
      await page.goto(BASE + url, { waitUntil: 'networkidle' });
      try { await page.waitForSelector(sel, { timeout: 12000 }); }
      catch (e) { errs.push('missing ' + sel); }
      await page.waitForTimeout(500);
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight * 0.8) {
          window.scrollTo(0, y); await new Promise(r => setTimeout(r, 40));
        }
        window.scrollTo(0, 0);
      });
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      const ok = !errs.length && overflow <= 1;
      if (!ok) { bad++; console.log('FAIL ' + url + ' @' + size.tag + '  overflowX=' + overflow); errs.slice(0, 4).forEach(e => console.log('       ' + e.slice(0, 180))); }
      else console.log('OK   ' + url + ' @' + size.tag);

      if (size.tag === 'desktop') {
        const name = url.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'home';
        await page.screenshot({ path: '/home/claude/kmdev/build/a-' + name + '.png' });
      }
    }

    /* admin at each size */
    await signIn(page, 'Kain');
    errs.length = 0;
    await page.goto(BASE + '/admin.html', { waitUntil: 'networkidle' });
    await page.waitForSelector('.admin__nav', { timeout: 15000 });
    for (const sec of ['overview', 'users', 'content', 'quizzes', 'projects', 'settings']) {
      await page.locator('[data-sec="' + sec + '"]').click();
      await page.waitForTimeout(700);
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      const ok = !errs.length && overflow <= 1;
      if (!ok) { bad++; console.log('FAIL admin/' + sec + ' @' + size.tag + '  overflowX=' + overflow); errs.slice(0, 3).forEach(e => console.log('       ' + e.slice(0, 160))); }
      else console.log('OK   admin/' + sec + ' @' + size.tag);
      if (size.tag === 'desktop') {
        await page.screenshot({ path: '/home/claude/kmdev/build/a-admin-' + sec + '.png' });
      }
    }
    await ctx.close();
  }

  /* the signed-out pages, in their own context */
  for (const size of SIZES) {
    const ctx = await b.newContext({ viewport: { width: size.w, height: size.h } });
    await noFonts(ctx);
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !noise.test(m.text())) errs.push(m.text()); });
    for (const url of ['/login.html', '/signup.html', '/reset.html', '/index.html', '/faq.html']) {
      errs.length = 0;
      await page.goto(BASE + url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(900);
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      const ok = !errs.length && overflow <= 1;
      if (!ok) { bad++; console.log('FAIL ' + url + ' @' + size.tag + '  overflowX=' + overflow);
        errs.slice(0, 4).forEach(e => console.log('       ' + e.slice(0, 180))); }
      else console.log('OK   ' + url + ' @' + size.tag + ' (signed out)');
      if (size.tag === 'desktop') {
        await page.screenshot({ path: '/home/claude/kmdev/build/a-out' + url.replace(/[^a-z0-9]+/gi, '-') + '.png' });
      }
    }
    await ctx.close();
  }

  /* reduced motion */
  const rm = await b.newContext({ viewport: { width: 1440, height: 950 }, reducedMotion: 'reduce' });
  await noFonts(rm);
  const p2 = await rm.newPage();
  const rmErrs = [];
  p2.on('pageerror', e => rmErrs.push(e.message));
  await signIn(p2, 'User B');
  await p2.goto(BASE + '/app-lesson.html?l=context', { waitUntil: 'networkidle' });
  await p2.waitForSelector('.lesson__title');
  await p2.waitForTimeout(700);
  const visible = await p2.locator('.lesson__body .enter').first().evaluate(e => getComputedStyle(e).opacity);
  console.log((visible === '1' && !rmErrs.length ? 'OK   ' : 'FAIL ') +
    'reduced motion: lesson content visible without animation  opacity=' + visible);
  if (visible !== '1') bad++;

  await b.close();
  console.log(bad ? '\n' + bad + ' failures' : '\nall academy pages clean');
  process.exitCode = bad ? 1 : 0;
})();
