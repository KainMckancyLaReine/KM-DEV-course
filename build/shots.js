const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const shot = async (name) => page.screenshot({ path: `/home/claude/km-dev-course/build/v-${name}.png` });

  await page.goto('http://localhost:8099/index.html', { waitUntil: 'networkidle' });
  await page.waitForSelector('.machine__preview .site.is-live', { timeout: 40000 });
  await page.evaluate(() => window.scrollTo(0, 620));
  await page.waitForTimeout(900); await shot('machine');

  await page.evaluate(() => { const t = document.querySelector('.transform'); window.scrollTo(0, t.offsetTop + window.innerHeight * 6.6); });
  await page.waitForTimeout(1200); await shot('transform');

  await page.evaluate(() => document.querySelector('[data-fix]').scrollIntoView({ block: 'center', behavior: 'auto' }));
  await page.waitForTimeout(900);
  await page.locator('[data-app-btn]').click(); await page.waitForTimeout(400);
  await page.locator('[data-ask]').click(); await page.waitForTimeout(2800);
  await page.locator('[data-apply]').click(); await page.waitForTimeout(1400); await shot('fix');

  await page.evaluate(() => document.querySelector('[data-ba]').scrollIntoView({ block: 'center', behavior: 'auto' }));
  await page.waitForTimeout(900); await shot('ba');

  await page.evaluate(() => document.querySelector('.statement').scrollIntoView({ block: 'center', behavior: 'auto' }));
  await page.waitForTimeout(1200); await shot('statement');

  await page.evaluate(() => document.querySelector('.final').scrollIntoView({ block: 'end', behavior: 'auto' }));
  await page.waitForTimeout(1200); await shot('final');

  await page.goto('http://localhost:8099/course.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.evaluate(() => document.querySelector('[data-timeline]').scrollIntoView({ block: 'center', behavior: 'auto' }));
  await page.waitForTimeout(900); await shot('timeline');
  await page.evaluate(() => document.querySelector('[data-explainer]').scrollIntoView({ block: 'center', behavior: 'auto' }));
  await page.waitForTimeout(900);
  await page.locator('.code-line--pick').nth(2).click(); await page.waitForTimeout(600); await shot('explainer');
  await page.evaluate(() => document.querySelector('.versus').scrollIntoView({ block: 'center', behavior: 'auto' }));
  await page.waitForTimeout(900); await shot('versus');
  await page.evaluate(() => document.querySelector('[data-builder]').scrollIntoView({ block: 'center', behavior: 'auto' }));
  await page.waitForTimeout(700);
  await page.locator('.opt[data-group="goal"]').first().click();
  await page.locator('.opt[data-group="audience"]').nth(1).click();
  await page.locator('.opt[data-group="style"]').first().click();
  await page.locator('.opt[data-group="layout"]').first().click();
  await page.waitForTimeout(700); await shot('builder');
  await page.evaluate(() => document.querySelector('.morph').scrollIntoView({ block: 'center', behavior: 'auto' }));
  await page.waitForTimeout(900); await shot('morph');

  await page.goto('http://localhost:8099/work.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.evaluate(() => document.querySelector('[data-gallery]').scrollIntoView({ block: 'center', behavior: 'auto' }));
  await page.waitForTimeout(600);
  await page.locator('.proj').nth(2).hover(); await page.waitForTimeout(800); await shot('gallery');

  await page.goto('http://localhost:8099/faq.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.evaluate(() => document.querySelector('.faq').scrollIntoView({ block: 'start', behavior: 'auto' }));
  await page.locator('.qa__btn').nth(1).click(); await page.waitForTimeout(800); await shot('faq');

  // mobile
  const m = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const mp = await m.newPage();
  await mp.goto('http://localhost:8099/index.html', { waitUntil: 'networkidle' });
  await mp.waitForTimeout(3000);
  await mp.screenshot({ path: '/home/claude/km-dev-course/build/v-m-hero.png' });
  await mp.evaluate(() => document.querySelector('[data-ba]').scrollIntoView({ block: 'center' }));
  await mp.waitForTimeout(800);
  await mp.screenshot({ path: '/home/claude/km-dev-course/build/v-m-ba.png' });
  await mp.goto('http://localhost:8099/work.html', { waitUntil: 'networkidle' });
  await mp.waitForTimeout(1500);
  await mp.evaluate(() => document.querySelector('[data-gallery]').scrollIntoView({ block: 'start' }));
  await mp.waitForTimeout(800);
  await mp.screenshot({ path: '/home/claude/km-dev-course/build/v-m-gallery.png' });

  await b.close();
})();
