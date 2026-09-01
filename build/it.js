const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|fonts.g/.test(m.text())) errs.push(m.text()); });

  await page.goto('http://localhost:8099/index.html', { waitUntil: 'networkidle' });
  await page.waitForSelector('.machine__preview .site.is-live', { timeout: 40000 });
  console.log('OK hero build sequence reaches live');
  console.log('   code lines:', await page.locator('[data-code] .code-line').count(),
              '| syntax tokens:', await page.locator('[data-code] i[class^="tk-"]').count());
  const raw = await page.locator('[data-code]').innerHTML();
  if (raw.indexOf('') !== -1 || raw.indexOf('') !== -1) errs.push('highlighter placeholder leaked into DOM');

  await page.locator('[data-app-btn]').scrollIntoViewIfNeeded();
  await page.locator('[data-app-btn]').click();
  await page.waitForSelector('.fix__toast.is-on');
  await page.locator('[data-ask]').click();
  await page.waitForSelector('[data-fixchip].is-error', { timeout: 12000 });
  await page.locator('[data-apply]').click();
  await page.waitForSelector('[data-fixchip].is-ok', { timeout: 12000 });
  console.log('OK error -> ask -> apply -> fixed');

  const ba = page.locator('[data-ba]');
  await ba.scrollIntoViewIfNeeded();
  const box = await ba.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.22, box.y + box.height / 2, { steps: 14 });
  await page.mouse.up();
  await page.waitForTimeout(1000);
  console.log('OK slider settled at', (await ba.evaluate(el => getComputedStyle(el).getPropertyValue('--x'))).trim());

  await page.evaluate(() => { const t = document.querySelector('[data-transform]'); window.scrollTo(0, t.offsetTop + t.offsetHeight * 0.85); });
  await page.waitForTimeout(700);
  console.log('OK transform active panel index',
    await page.evaluate(() => [...document.querySelectorAll('.tpanel')].findIndex(p => p.classList.contains('is-on'))));

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator('.lang__btn[data-lang="nl"]').click();
  await page.waitForTimeout(250);
  console.log('OK NL:', (await page.locator('.hero__sub').innerText()).slice(0, 56));
  await page.locator('.lang__btn[data-lang="en"]').click();

  await page.locator('.nav__link[href="course.html"]').click();
  await page.waitForTimeout(2000);
  console.log('OK routed to', await page.evaluate(() => document.querySelector('.page-main').dataset.page),
              '| url', page.url().split('/').pop(), '| title', await page.title());

  await page.locator('.code-line--pick').first().scrollIntoViewIfNeeded();
  const before = await page.locator('.explainer .site').evaluate(el => getComputedStyle(el).padding);
  await page.locator('.code-line--pick').first().click();
  await page.waitForTimeout(500);
  const after = await page.locator('.explainer .site').evaluate(el => getComputedStyle(el).padding);
  console.log('OK explainer padding', before, '->', after,
              '| highlighted:', await page.locator('.explainer [data-el].is-hi, .explainer .site.is-hi').count());

  await page.locator('.opt[data-group="goal"]').first().click();
  await page.locator('.opt[data-group="style"]').first().click();
  await page.waitForTimeout(250);
  console.log('OK builder:', (await page.locator('[data-bout]').innerText()).slice(0, 96), '|', await page.locator('[data-bcount]').innerText());

  await page.locator('.qopt[data-right]').scrollIntoViewIfNeeded();
  await page.locator('.qopt[data-right]').click();
  await page.waitForTimeout(400);
  console.log('OK quiz verdict:', (await page.locator('.quiz__verdict.is-on').count()) === 1);

  await page.evaluate(() => { const c = document.querySelectorAll('.chapter')[5]; window.scrollTo(0, c.getBoundingClientRect().top + window.scrollY - 300); });
  await page.waitForTimeout(600);
  console.log('OK active chapter:', await page.locator('.chapter.is-on .chapter__t').innerText());

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.locator('.nav__link[href="work.html"]').click();
  await page.waitForTimeout(2000);
  const p1 = page.locator('.proj').first();
  await p1.scrollIntoViewIfNeeded();
  await p1.hover();
  await page.waitForTimeout(700);
  console.log('OK follower visible:', (await page.locator('.follower.is-on').count()) === 1,
              '| preview:', await page.locator('.follower .pv.is-on').getAttribute('data-pv'));

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.locator('.nav__link[href="faq.html"]').click();
  await page.waitForTimeout(2000);
  await page.locator('.qa__btn').first().click();
  await page.waitForTimeout(600);
  console.log('OK faq opens:', (await page.locator('.qa.is-open').count()) === 1);

  await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  console.log('OK focus reaches:', await page.evaluate(() => document.activeElement.className || document.activeElement.tagName));

  if (errs.length) { console.log('\nFAIL errors:'); errs.slice(0, 10).forEach(e => console.log('   ', e.slice(0, 240))); }
  else console.log('\nOK no runtime errors across the whole flow');
  await b.close();
})();
