/* Shared test setup.
   --------------------------------------------------------------------------
   assets/js/km-config.js holds the real Supabase project, which is what the
   published site should use. The suites are not allowed to depend on it: a
   test that talks to the live database is slow, needs credentials nobody
   should put in a repository, and writes rows into the thing it is testing.

   So every context serves an empty config in place of the real one. The
   platform then runs in preview mode — the same interface, the same course,
   against a store in the browser — which is exactly the surface these suites
   are meant to exercise. Nothing in the product changes; the substitution
   happens in the browser context the test drives.

   Fonts are deliberately not touched here. Some suites abort them (so that
   networkidle does not wait on a connection the sandbox cannot open) and
   filter the resulting console noise; the ones that do not, must not have it
   introduced behind their back.                                             */

const PREVIEW_CONFIG = `/* served by build/preview.js during tests */
window.KM_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  courseSlug: 'ai-web-developer',
  supabaseScript: ''
};
`;

async function prepare(ctx) {
  await ctx.route(/km-config\.js/, r =>
    r.fulfill({ status: 200, contentType: 'application/javascript', body: PREVIEW_CONFIG }));
  return ctx;
}

module.exports = { prepare, PREVIEW_CONFIG };
