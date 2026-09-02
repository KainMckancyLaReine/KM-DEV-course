/* ==========================================================================
   KM.dev Academy — configuration
   --------------------------------------------------------------------------
   Fill these two values in to switch the platform from preview mode to the
   real thing. Both are safe to commit: the anon key is designed to be public
   and every rule that protects data lives in row level security on the
   server, not in this file.

     1. Create a project at supabase.com
     2. Settings → API → copy the Project URL and the anon public key
     3. Paste them below and commit
     4. Run db/schema.sql then db/seed.sql in the SQL editor
     5. Sign up at /signup.html with kain@km.dev — the bootstrap table in the
        schema makes that account an admin on creation. Nothing about the
        password is stored here or anywhere else in the front end.

   Leave them empty and the platform runs in preview mode: the same interface
   against a store in this browser, clearly labelled, so nothing pretends to
   be a real account.
   ========================================================================== */

window.KM_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: '',

  courseSlug: 'ai-web-developer',

  /* Loaded only when the two values above are set. */
  supabaseScript: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js'
};
