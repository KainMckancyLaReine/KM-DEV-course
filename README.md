# KM.dev — AI Developer Course & Academy

A marketing site and a full learning platform, built as one product on the
existing KM.dev brand. Same palette, same typefaces, same radii, same editorial
restraint — no second visual identity anywhere in it.

```
Public             index · course · work · faq · pricing
Purchase           checkout · welcome
Academy            signup · login · reset · dashboard · course · lesson
                   assessment · project · progress · prompts · certificate · settings
Administration     admin (overview, users, content, quizzes, projects,
                   purchases, settings)
```

The course costs **€1.750**, once, for the whole programme including the levels
still being written. The price is a row in the `settings` table, not a number
in five files, and it is what the checkout charges — the browser never sends an
amount.

---

## Running it

It is a static site. Open `index.html`, or serve the folder:

```bash
python3 -m http.server 8099
```

This instance is connected to a Supabase project, so the accounts, the
sessions, the progress and the grading are real. Sign up at `/signup.html`;
an address listed in the `admin_bootstrap` table becomes an administrator at
the moment the account is created, and no password appears anywhere in this
repository.

With `supabaseUrl` and `supabaseAnonKey` left empty in
`assets/js/km-config.js`, the same code runs in **preview mode** instead: real
screens, real course content, real interactions, against a store in this
browser. It is labelled on every page, because a sign-in screen that only
pretends to sign you in is worse than none. That is how the product can be
walked through before any infrastructure exists — see
**[Connecting the backend](#connecting-the-backend)**.

---

## Brand tokens (inherited, not invented)

Taken verbatim from `kainmckancylareine.github.io/KM-DEV`:

| Role | Value |
|---|---|
| Background | `#f4f3ef` |
| Paper | `#ffffff` |
| Ink | `#0d0d0d` |
| Muted | `#b6b4ac` |
| Gray | `#6f6d66` |
| Line | `#e4e2d9` |
| Accent | `#c6ff4a` |
| Accent ink | `#3f5a17` |
| Radius | `28px` (`24 / 20 / 32` variants) |
| Display | Space Grotesk 500/600 |
| Body | Inter 400/500/600 |
| Data / labels | Space Mono, `.16em`, uppercase |

Dark surfaces (`--ink-2`, `--ink-3`, `--ink-line`) are derived from `--ink`.
They are not a second palette.

## Motion system

One system, five tiers — nothing gets a random easing.

| Tier | Duration | Used for |
|---|---|---|
| Micro | 150ms | hover, label shift, arrow |
| UI | 280ms | buttons, links, chips, tabs |
| Content | 560ms | reveals, section and lesson entrances |
| Story | 900ms | word reveals, level completion |
| Cinematic | 1500ms | loader, page transitions |

Easings: `--e-out` (the km.dev button curve), `--e-inout` (heavy), `--e-soft`
(content), `--e-spring` (physical). Everything animates `transform` and
`opacity` only. Physics-driven elements — the comparison slider, the cursor,
the project preview follower, magnetic buttons — run on one shared rAF loop
with velocity and settle.

---

## Layout of the repository

```
content/                 the course, version-controlled
  course.json            levels, projects, assessments, prompt library
  level-01.json          Think Like a Builder — six lessons, written
  level-02.json          Mastering Claude — eight lessons, written
  nl/                    the Dutch twin of each file above

db/
  schema.sql             tables, row level security, server-side grading
  phase15.sql            purchases, settings, and access that follows a payment
  seed.sql               generated — the whole course as SQL

supabase/functions/
  create-checkout/       opens a Stripe session; reads the price from the database
  stripe-webhook/        the only thing in the system that may say "paid"

assets/css/
  01-foundation.css      tokens, type, layout, reveal, buttons, cursor, loader
  02-chrome.css          nav, menu, footer, browser frame, code editor, terminal
  03-sections.css        marketing section compositions
  04-app.css             the academy: dashboard, lessons, quizzes, admin, states

assets/js/
  core.js                rAF scheduler, scroll bus, reveal engine, custom cursor,
                         magnetic, loader, nav, i18n, soft page transitions
  modules.js             marketing interactions + the syntax highlighter
  km-config.js           the two Supabase values
  km-i18n.js             the academy interface in Dutch, and the engine
  km-outline.js          generated — the programme's shape, for the pricing page
  km-pricing.js          pricing page, checkout, confirmation
  seed-data.js           generated — the course for preview mode
  km-data.js             one data API, two adapters (Supabase / preview)
  km-blocks.js           lesson renderer: blocks, diagrams, demos, video, lightbox
  km-app.js              app shell and every student page
  km-admin.js            admin dashboard and the content editors

build/
  gen_seed.py            content/*.json → db/seed.sql + assets/js/seed-data.js
  gen_app.py             the academy page shells
  build.py               work/faq from the index shell + the single-file bundle
  qc.js  qc-app.js       console errors, horizontal overflow, 3 breakpoints
  it.js  academy.js      interaction suites, driven end to end
  i18n-scan.js           every rendered phrase, both languages, both roles
  shots-pricing.js       captures the pricing page's frames from the real app
  final.js               reduced motion, layout shift, keyboard, bundle routing
  db-test.sh             applies the schema to a throwaway Postgres and checks
                         that the security properties actually hold
```

### Build

```bash
python3 build/gen_seed.py     # course content → SQL seed + browser seed
python3 build/gen_app.py      # academy page shells
python3 build/build.py        # work.html, faq.html, dist/ bundle
```

`index.html` is the shell of record for the marketing pages; `build/gen_app.py`
owns the academy shells. Editing the navigation, the account menu, the script
order or the footer happens in one place and propagates.

---

## Connecting the backend

Preview mode exists so the product can be judged before any infrastructure is
set up. It is not a substitute for one, and it is not a security boundary.
Five steps, roughly ten minutes:

1. **Create a Supabase project.** Copy the Project URL and the *anon public*
   key from Settings → API. The anon key is meant to be public; it identifies
   the project and grants nothing. Never commit the service role key.
2. **Run `db/schema.sql`, then `db/seed.sql`** in the SQL editor.
3. **Paste the two values into `assets/js/km-config.js`** and commit. The
   preview banner disappears; nothing else in the interface changes.
4. **Sign up at `/signup.html`** as `kain@km.dev` and `userb@km.dev`. The first
   address is in the `admin_bootstrap` table that the seed installs, so the
   trigger that creates the profile marks it as an admin at that moment. You
   choose both passwords in the browser; neither exists anywhere in this repo.
5. **Check that it refuses what it should.** Signed in as the student, call
   `KMDB.admin.users()` from the console. It throws.

## Paying for it

`db/phase15.sql` adds three things: a `settings` table holding the price, a
`purchases` table holding the lifecycle of a payment, and `has_access()` — the
function every content policy is now written in terms of.

The order matters. A browser cannot write a purchase row: `authenticated` has
no insert or update policy on that table at all. Rows are written by
`open_checkout()` and `record_payment()`, which are revoked from every role a
session can hold and are reachable only by the two Edge Functions running with
the service key. `create-checkout` reads the amount from `settings` rather than
accepting one, and `stripe-webhook` verifies Stripe's signature over the raw
body — with a timestamp tolerance, and a constant-time comparison — before it
believes a word of it.

So the sequence that grants access is: Stripe charges the card → Stripe signs an
event → the webhook verifies the signature → `record_payment` sets the row to
`paid` → `has_access()` starts returning true → the content policies open. There
is no step in that list a browser can reach.

A refund runs the same path in reverse and the course closes again.

```bash
supabase functions deploy create-checkout
supabase functions deploy stripe-webhook --no-verify-jwt
supabase secrets set STRIPE_SECRET_KEY=sk_… STRIPE_WEBHOOK_SECRET=whsec_… \
                     SITE_URL=https://your-site
```

An administrator can also set a purchase by hand — a bank transfer, a refund
handled elsewhere — from **Admin → Purchases**. It writes an ordinary purchase
row, so there stays one definition of who owns the course.

### What a visitor sees before paying

The pricing page is public and its numbers are real: the level titles, lesson
titles, counts and timings all come from `course_outline()`, a function `anon`
may call which returns the programme's *shape* and nothing else. A signed-in
account that has not paid gets the same thing — the programme, its own account,
and a price — because the lessons behind it return zero rows to it. That is not
a hidden button; `bash build/db-test.sh` proves the account cannot read a
lesson, a quiz question, an answer, a project brief or a prompt by any route.

### What the database enforces

Hiding a control is manners. These are the actual permissions, and
`bash build/db-test.sh` proves each one against a real Postgres:

- A student reads only their own progress, notes, bookmarks, attempts and
  certificate rows. An admin can read all of them; notes stay private to their
  author even from an admin.
- `is_correct` on `quiz_answers` is **not granted to students at the column
  level**, so the right answers cannot be fetched before submitting — not by
  the interface, and not by a hand-written query either.
- Quizzes are graded by `submit_quiz()`, a `SECURITY DEFINER` function. The
  browser sends the chosen answer ids and receives a score; it never decides
  one. The attempt is recorded in the same call.
- `admin_overview()`, `admin_users()` and `admin_quiz()` check the caller's
  role on the server and raise otherwise.
- A student cannot change their own role: a trigger rejects it.
- Course progress is a **view**, derived from the lessons, so a stored
  percentage can never drift away from reality.
- The certificate is issued by `claim_certificate()`, which verifies completion
  and the final assessment before it will issue anything.

---

## The course

| | |
|---|---|
| Levels | 8 |
| Lessons | 69 planned, 14 written and published |
| Languages | English and Dutch, throughout |
| Assessments | 5 (2 written, 20 questions) |
| Projects | 3 plus a final client brief |
| Prompt library | 12 prompts, each with its reasoning |

Level 01 (*Think Like a Builder*) and Level 02 (*Mastering Claude*) are written
in full, following the lesson architecture: understand, see, learn, try,
prompt, build, test, complete. Every later lesson exists as a real database
record with its title, order and estimated length — so progress, unlocking and
the dashboard are all real — and is marked **draft** until its content is
written. Draft is an honest state; "coming soon" is not.

Content lives in `content/*.json` and is regenerated into both the SQL seed and
the browser store by one script, so it is never maintained twice. Lessons can
also be written in the admin editor, block by block.

### Lesson content blocks

`text · heading · list · code · prompt · figure · image · video · callout ·
task · quiz · interactive demo · summary`

Ten interactive demos are implemented and working: context comparison, a live
code explainer, the trust boundary sorter, a replayed Claude session, weak vs
strong prompts, instruction ambiguity, the prompt builder, the constraint lab,
the direction lab, and diff review.

Figures are drawn in CSS from the lesson data — no stock imagery anywhere in
the product. Image and video blocks show an honest placeholder until a real
file is attached in the editor, rather than inventing one.

---

## Testing

```bash
python3 -m http.server 8099

node build/qc.js         # marketing: 4 pages × 3 breakpoints
node build/it.js         # marketing: every interactive demo
node build/final.js      # reduced motion, layout shift, keyboard, bundle
node build/qc-app.js     # academy: 13 pages + 6 admin sections × 3 breakpoints
node build/academy.js    # the full student flow and the full admin flow
bash  build/db-test.sh   # the schema and its security properties on real Postgres
```

Current results: every page clean at desktop, tablet and mobile with no console
errors and no horizontal overflow; CLS `0.0003`; 49 end-to-end acceptance checks
passing; 63 database checks passing, including that an account without a
payment cannot read the course by any route; nothing rendered in English once
the language is Dutch.

## Accessibility

Semantic landmarks, a skip link, visible focus rings on both grounds, keyboard
operation throughout — including the timeline, the code explainer, the FAQ, the
comparison slider, the lesson shortcuts (`←` `→` `M` `S`) and the `⌘K` command
palette — `aria-expanded` on every disclosure, and a full
`prefers-reduced-motion` path that replaces cinematic transitions with fades
and leaves everything usable.

## Languages

One switch, EN / NL, covers the whole product — the marketing pages and the
academy behind the login. The choice is remembered in `localStorage`.

The two halves get there differently, because they are built differently.

**The marketing pages** carry their translations in the markup, through
`data-en` / `data-nl` (and the `-html` and `-aria` variants) — the same pattern
the main KM.dev site uses. Large typographic statements stay in English by art
direction.

**The course content** is translated in the database. Every table that holds
something a student reads has a Dutch column beside the English one —
`title_nl`, `content_nl`, `brief_nl`, `question_nl`, `answer_nl`,
`explanation_nl` — filled from `content/nl/*.json` by the same generator that
fills the English ones. `km-data.js` hands the interface the column that
matches the chosen language and falls back to English where a translation is
missing, so a gap is never a blank. The admin editors deliberately bypass this
and always show the English record, so a translation can never be saved over
its source.

**The academy interface** — the several hundred phrases the application itself
produces — lives in one dictionary, `assets/js/km-i18n.js`, applied to the
rendered document. Scattering attribute pairs through eight thousand lines of
rendering code would have been the worse thing to maintain. Code blocks,
terminals and prompt bodies are excluded by class: their text is either source
or something the student is meant to paste.

`node build/i18n-scan.js` walks every page in both roles and fails on two
things: a phrase the interface rendered that the dictionary does not cover, and
an English phrase still on screen after the language is switched to Dutch. The
first proves the dictionary is complete; the second proves it is actually being
applied.

## Notes on content

Nothing here invents credibility. No testimonials, client logos, award badges,
student counts or success percentages. Every preview and mockup is a
composition drawn in CSS. Where proof would normally sit, the design uses
whitespace instead.
