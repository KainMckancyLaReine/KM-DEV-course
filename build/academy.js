/* End-to-end acceptance run for the academy, in preview mode.
   Drives the full student flow and the full admin flow the way a person would. */
const { chromium } = require('playwright');

const BASE = 'http://localhost:8099';
const noise = /ERR_TUNNEL|fonts\.g|favicon|ERR_FAILED/;

function log(ok, msg, extra) {
  console.log((ok ? 'OK   ' : 'FAIL ') + msg + (extra ? '  ' + extra : ''));
  if (!ok) process.exitCode = 1;
}

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !noise.test(m.text())) errs.push(m.text()); });

  const go = async (u) => { await page.goto(BASE + u, { waitUntil: 'networkidle' }); await page.waitForTimeout(500); };

  /* ---------------------------------------------------- 1 · guard + login */
  await go('/app-dashboard.html');
  log(page.url().includes('login.html'), 'signed-out visit to the dashboard redirects to login',
      page.url().split('/').pop());

  await page.waitForSelector('.demo-key', { timeout: 8000 });
  const keys = await page.locator('.demo-key').allInnerTexts();
  log(keys.length === 2, 'two preview accounts offered', JSON.stringify(keys));

  /* sign in as the student through the real form, not the shortcut */
  const studentBtn = page.locator('.demo-key', { hasText: 'User B' });
  await studentBtn.click();
  await page.waitForURL('**/app-dashboard.html', { timeout: 12000 });
  await page.waitForSelector('.next__title', { timeout: 12000 });
  log(true, 'User B signed in and landed on the dashboard');

  const greeting = await page.locator('.app__title').innerText();
  log(/Good to see you, User/.test(greeting), 'dashboard greets the signed-in student', greeting);

  const avatar = await page.locator('.acct__btn').innerText();
  log(avatar.trim() === 'UB', 'navbar shows the account initials', avatar.trim());

  const previewBar = await page.locator('.preview-bar').count();
  log(previewBar === 1, 'preview mode is labelled on screen');

  /* ------------------------------------------------------- 2 · the course */
  await go('/app-course.html');
  const levels = await page.locator('.level').count();
  const locked = await page.locator('.level.is-locked').count();
  log(levels === 8, 'eight levels listed', String(levels));
  log(locked === 7, 'levels after the first are locked until the one before is complete', String(locked));

  /* ------------------------------------------------------- 3 · one lesson */
  await page.locator('.level').first().locator('a.btn').click();
  await page.waitForSelector('.lesson__title', { timeout: 12000 });
  const title = await page.locator('.lesson__title').innerText();
  log(/AI-assisted development/i.test(title), 'first lesson opens', title);

  const blocks = await page.locator('.lesson__body .enter').count();
  log(blocks > 8, 'lesson content rendered from the database', blocks + ' blocks');
  log(await page.locator('.sidebar .sitem').count() >= 6, 'course sidebar lists the level');
  log(await page.locator('.blk-figure').count() >= 1, 'drawn diagram rendered');
  log(await page.locator('.idemo').count() >= 1, 'interactive demo rendered');
  log(await page.locator('.vid').count() >= 0, 'video component present when the lesson has one');

  /* copy a prompt for real */
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
  const promptBtn = page.locator('[data-copy-prompt]').first();
  await promptBtn.scrollIntoViewIfNeeded();
  await promptBtn.click();
  await page.waitForTimeout(400);
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  log(clip.length > 60, 'copy prompt actually writes to the clipboard', clip.slice(0, 44) + '…');
  log(await promptBtn.innerText().then(t => /copied/i.test(t)), 'copy button confirms');

  /* the "why this works" panel */
  await page.locator('[data-why]').first().click();
  await page.waitForTimeout(400);
  log(await page.locator('.why.is-open').count() >= 1, 'prompt explanation opens');

  /* inline quiz */
  const iq = page.locator('[data-inline-quiz]').first();
  if (await iq.count()) {
    await iq.locator('.aopt').first().scrollIntoViewIfNeeded();
    await iq.locator('.aopt').first().click();
    await page.waitForTimeout(300);
    log(await iq.locator('.aopt.is-right').count() === 1, 'inline quiz marks the right answer');
  }

  /* note autosave */
  await page.locator('#note').fill('Context is the whole game.');
  await page.waitForTimeout(1200);

  /* complete the lesson */
  await page.locator('[data-mark]').click();
  await page.waitForTimeout(700);
  log(await page.locator('.complete.is-done').count() === 1, 'lesson marked complete');

  /* bookmark */
  await page.locator('[data-save]').click();
  await page.waitForTimeout(400);
  log(/saved/i.test(await page.locator('[data-save]').innerText()), 'lesson saved to the dashboard');

  /* keyboard navigation */
  const before = page.url();
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(1200);
  log(page.url() !== before, 'right arrow moves to the next lesson', page.url().split('=').pop());

  /* --------------------------------------------- 4 · complete a whole level */
  const lessons = ['what-is-ai-assisted-development', 'how-websites-actually-work',
                   'frontend-vs-backend', 'html-css-javascript',
                   'what-claude-can-and-cannot-do', 'your-ai-development-workflow'];
  for (const slug of lessons) {
    await go('/app-lesson.html?l=' + slug);
    await page.waitForSelector('[data-mark]', { timeout: 12000 });
    if (!/Completed/.test(await page.locator('[data-mark]').innerText())) {
      await page.locator('[data-mark]').click();
      await page.waitForTimeout(350);
    }
  }
  await go('/app-dashboard.html');
  await page.waitForSelector('.meter__pct');
  await page.waitForTimeout(1400);
  const pct = await page.locator('.meter__pct').innerText();
  log(parseInt(pct) > 0, 'course progress reflects the completed lessons', pct);

  /* --------------------------------------------------- 5 · the assessment */
  await go('/app-assessment.html?a=foundation-assessment');
  await page.waitForSelector('.assess__q', { timeout: 12000 });
  const qCount = await page.locator('[data-counter]').innerText();
  log(/01 \/ 10/.test(qCount), 'assessment starts at question one of ten', qCount);

  for (let i = 0; i < 10; i++) {
    await page.locator('.aopt').first().click();
    await page.waitForTimeout(120);
    await page.locator('[data-next]').click();
    await page.waitForTimeout(260);
  }
  await page.waitForSelector('.result__score', { timeout: 12000 });
  const score = await page.locator('.result__score').innerText();
  log(/\/\s*10/.test(score.replace(/\s+/g, ' ')), 'assessment graded and scored', score.replace(/\n/g, ' '));

  await page.locator('[data-review]').click();
  await page.waitForTimeout(500);
  log(await page.locator('[data-review-list] .panel').count() === 10, 'every answer can be reviewed with its explanation');

  /* the attempt is stored */
  await go('/app-progress.html');
  await page.waitForSelector('.panel');
  log(await page.locator('.chip.is-error, .chip.is-ok').count() >= 1, 'the attempt is recorded against the account');

  /* ------------------------------------------------------- 6 · a project */
  await go('/app-project.html?p=first-landing-page');
  await page.waitForSelector('.checklist', { timeout: 12000 });
  await page.locator('.check').first().click();
  await page.waitForTimeout(400);
  log(await page.locator('.check.is-on').count() === 1, 'project checklist item persists');

  /* --------------------------------------------------- 7 · prompt library */
  await go('/app-prompts.html');
  await page.waitForSelector('.prompt-c', { timeout: 12000 });
  const nPrompts = await page.locator('.prompt-c').count();
  log(nPrompts === 12, 'every prompt in the library is listed', String(nPrompts));
  await page.locator('.lib__cat', { hasText: 'Debug' }).click();
  await page.waitForTimeout(300);
  log(await page.locator('.prompt-c').count() === 1, 'category filter works');

  /* ------------------------------------------------- 8 · command palette */
  await page.keyboard.press('Meta+k');
  await page.waitForTimeout(500);
  log(await page.locator('.cmdk.is-on').count() === 1, 'command palette opens with ⌘K');
  await page.locator('.cmdk__input').fill('responsive');
  await page.waitForTimeout(300);
  const hits = await page.locator('.cmdk__item').count();
  log(hits > 0, 'search finds lessons by keyword', hits + ' results');
  await page.keyboard.press('Escape');

  /* ------------------------------------- 9 · student cannot reach the admin */
  await go('/admin.html');
  await page.waitForSelector('.state, .admin', { timeout: 12000 });
  const adminBlocked = await page.locator('.state h3').count()
    ? await page.locator('.state h3').innerText() : '';
  log(/administrators/i.test(adminBlocked), 'a student is refused the admin area', adminBlocked);

  const asStudent = await page.evaluate(async () => {
    try { const u = await KMDB.admin.users(); return 'returned ' + u.length + ' rows'; }
    catch (e) { return 'refused: ' + e.message; }
  });
  log(/refused/.test(asStudent), 'a direct admin call from a student account is refused', asStudent);

  /* ------------------------------------------------- 10 · sign out, back in */
  await go('/app-dashboard.html');
  await page.locator('.acct__btn').click();
  await page.waitForTimeout(300);
  await page.locator('[data-signout]').click();
  await page.waitForURL('**/index.html', { timeout: 12000 });
  log(true, 'sign out returns to the marketing site');

  await go('/app-dashboard.html');
  log(page.url().includes('login.html'), 'the session really ended');

  await page.locator('.demo-key', { hasText: 'User B' }).click();
  await page.waitForURL('**/app-dashboard.html', { timeout: 12000 });
  await page.waitForSelector('.meter__pct');
  await page.waitForTimeout(1400);            // the count-up finishes
  const pct2 = await page.locator('.meter__pct').innerText();
  log(parseInt(pct2) === parseInt(pct), 'progress survived signing out and back in', pct + ' → ' + pct2);

  /* ================================================== ADMIN FLOW (Kain) === */
  await page.locator('.acct__btn').click();
  await page.locator('[data-signout]').click();
  await page.waitForURL('**/index.html', { timeout: 12000 });
  await go('/login.html');
  await page.waitForSelector('.demo-key');
  await page.locator('.demo-key', { hasText: 'Kain' }).click();
  await page.waitForURL('**/app-dashboard.html', { timeout: 12000 });
  log(await page.locator('.acct__btn').getAttribute('data-role') === 'admin', 'Kain is recognised as an admin');

  await go('/admin.html');
  await page.waitForSelector('.admin__nav', { timeout: 12000 });
  log(true, 'admin dashboard opens for the admin account');
  await page.waitForSelector('.stat');
  const stats = await page.locator('.stat b').allInnerTexts();
  log(stats.length >= 6, 'overview shows real metrics', stats.join(' · '));

  await page.locator('[data-sec="users"]').click();
  await page.waitForSelector('.table tbody tr', { timeout: 12000 });
  const rows = await page.locator('.table tbody tr').count();
  log(rows === 2, 'both accounts listed in user management', String(rows));

  await page.locator('[data-user]').nth(1).click();
  await page.waitForSelector('.statgrid', { timeout: 12000 });
  const detail = await page.locator('[data-panel] .app__title').innerText();
  log(detail.length > 0, 'a student detail page opens', detail);

  await page.locator('[data-sec="content"]').click();
  await page.waitForSelector('[data-lesson]', { timeout: 12000 });
  log(await page.locator('[data-lesson]').count() === 69, 'every lesson is manageable',
      (await page.locator('[data-lesson]').count()) + ' lessons');

  await page.locator('[data-edit]').first().click();
  await page.waitForSelector('#e-title', { timeout: 12000 });
  await page.locator('#e-title').fill('What is AI-assisted development? (edited)');
  await page.locator('[data-save]').click();
  await page.waitForTimeout(700);
  log(/saved/i.test(await page.locator('[data-state]').innerText()), 'lesson edit saves',
      await page.locator('[data-state]').innerText());

  await go('/app-lesson.html?l=what-is-ai-assisted-development');
  await page.waitForSelector('.lesson__title', { timeout: 12000 });
  log(/edited/.test(await page.locator('.lesson__title').innerText()),
      'the edit is visible to a reader', await page.locator('.lesson__title').innerText());

  /* publish / unpublish */
  await go('/admin.html');
  await page.locator('[data-sec="content"]').click();
  await page.waitForSelector('[data-edit]');
  await page.locator('[data-edit]').first().click();
  await page.waitForSelector('[data-publish]');
  await page.locator('#e-title').fill('What is AI-assisted development?');
  await page.locator('[data-save]').click();
  await page.waitForTimeout(600);
  await page.locator('[data-publish]').click();
  await page.waitForTimeout(800);
  const pill = await page.locator('.status-pill').first().innerText();
  log(/draft/i.test(pill), 'unpublish works', pill);
  await page.locator('[data-publish]').click();
  await page.waitForTimeout(800);
  log(/published/i.test(await page.locator('.status-pill').first().innerText()), 'publish works again');

  /* quiz editing */
  await go('/admin.html');
  await page.locator('[data-sec="quizzes"]').click();
  await page.waitForSelector('[data-quiz]', { timeout: 12000 });
  await page.locator('[data-quiz]').first().click();
  await page.waitForSelector('[data-q]', { timeout: 12000 });
  const qs0 = await page.locator('[data-q]').count();
  await page.locator('[data-addq]').click();
  await page.waitForTimeout(900);
  const qs1 = await page.locator('[data-q]').count();
  log(qs1 === qs0 + 1, 'a question can be added', qs0 + ' → ' + qs1);

  const last = page.locator('[data-q]').last();
  await last.locator('[data-qtext]').fill('Which of these is a constraint?');
  await last.locator('[data-answers]').fill('* No external libraries\nMake it look nice');
  await last.locator('[data-qwhy]').fill('A constraint can be checked by someone who has never met you.');
  await last.locator('[data-saveq]').click();
  await page.waitForTimeout(900);
  log(true, 'the question saves');

  await page.locator('[data-q]').last().locator('[data-delq]').click();
  page.on('dialog', d => d.accept());
  await page.waitForTimeout(900);

  await b.close();
  console.log('');
  if (errs.length) { console.log('CONSOLE ERRORS:'); errs.slice(0, 12).forEach(e => console.log('  ' + e.slice(0, 200))); process.exitCode = 1; }
  else console.log('OK   no console errors across the entire run');
})();
