const { chromium } = require('playwright');
const { prepare } = require('./preview');
(async () => {
  const b = await chromium.launch();
  const errs = [];

  // 1 · reduced motion
  const rm = await prepare(await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }));
  const p1 = await rm.newPage();
  p1.on('pageerror', e => errs.push('RM ' + e.message));
  await p1.goto('http://localhost:8099/index.html', { waitUntil: 'networkidle' });
  await p1.waitForTimeout(1800);
  console.log('reduced-motion · loader removed:', (await p1.locator('.loader').count()) === 0,
    '| cursor absent:', (await p1.locator('.cursor').count()) === 0,
    '| hero words visible:', await p1.locator('.hero__title .reveal-word').first().evaluate(e => getComputedStyle(e).opacity),
    '| machine live:', (await p1.locator('.machine__preview .site.is-live').count()) === 1);
  await p1.evaluate(() => document.querySelector('.statement').scrollIntoView());
  await p1.waitForTimeout(400);
  console.log('reduced-motion · statement visible:', await p1.locator('.statement__l--a .reveal-word').first().evaluate(e => getComputedStyle(e).opacity));

  // 2 · layout shift
  const ctx = await prepare(await b.newContext({ viewport: { width: 1440, height: 900 } }));
  const p2 = await ctx.newPage();
  await p2.addInitScript(() => {
    window.__cls = 0;
    new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; })
      .observe({ type: 'layout-shift', buffered: true });
  });
  await p2.goto('http://localhost:8099/index.html', { waitUntil: 'networkidle' });
  await p2.waitForTimeout(4000);
  await p2.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); } });
  await p2.waitForTimeout(600);
  console.log('CLS (whole page scroll):', (await p2.evaluate(() => window.__cls)).toFixed(4));

  // 3 · keyboard: menu open/close, skip link
  const p3 = await ctx.newPage();
  p3.on('pageerror', e => errs.push('KB ' + e.message));
  await p3.goto('http://localhost:8099/index.html', { waitUntil: 'networkidle' });
  await p3.waitForTimeout(1500);
  await p3.keyboard.press('Tab');
  console.log('first tab stop:', await p3.evaluate(() => document.activeElement.className));
  await p3.locator('.burger').focus();
  await p3.keyboard.press('Enter');
  await p3.waitForTimeout(900);
  console.log('menu opened by keyboard:', (await p3.locator('.menu.is-open').count()) === 1);
  await p3.keyboard.press('Escape');
  await p3.waitForTimeout(900);
  console.log('menu closed by Escape:', (await p3.locator('.menu.is-open').count()) === 0);

  // 4 · single-file bundle with hash routing
  const p4 = await ctx.newPage();
  p4.on('pageerror', e => errs.push('BUNDLE ' + e.message));
  p4.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|fonts.g/.test(m.text())) errs.push('BUNDLE ' + m.text()); });
  await p4.goto('http://localhost:8099/dist/km-dev-ai-course.html', { waitUntil: 'networkidle' });
  await p4.waitForTimeout(2500);
  console.log('bundle · page:', await p4.evaluate(() => document.querySelector('.page-main').dataset.page));
  await p4.locator('.nav__link[href="course.html"]').click();
  await p4.waitForTimeout(2200);
  console.log('bundle · routed to:', await p4.evaluate(() => document.querySelector('.page-main').dataset.page),
              '| hash:', await p4.evaluate(() => location.hash),
              '| timeline present:', (await p4.locator('[data-timeline]').count()) === 1);
  await p4.goBack(); await p4.waitForTimeout(2000);
  console.log('bundle · back to:', await p4.evaluate(() => document.querySelector('.page-main').dataset.page));
  await p4.goto('http://localhost:8099/dist/km-dev-ai-course.html#work', { waitUntil: 'networkidle' });
  await p4.waitForTimeout(2500);
  console.log('bundle · deep link #work →', await p4.evaluate(() => document.querySelector('.page-main').dataset.page),
              '| projects:', await p4.locator('.proj').count());

  console.log(errs.length ? '\nERRORS:\n' + errs.slice(0, 8).join('\n') : '\nno errors');
  await b.close();
})();
