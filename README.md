# KM.dev — AI Developer Course & Academy

A marketing site and a full learning platform, built as one product on the
existing KM.dev brand. Same palette, same typefaces, same radii, same editorial
restraint — no second visual identity anywhere in it.

```
Marketing          index · course · work · faq
Academy            signup · login · reset · dashboard · course · lesson
                   assessment · project · progress · prompts · certificate · settings
Administration     admin (overview, users, content, quizzes, projects, settings)
```

---

## Running it

It is a static site. Open `index.html`, or serve the folder:

```bash
python3 -m http.server 8099
```

Out of the box the academy runs in **preview mode**: real screens, real course
content, real interactions, against a store in this browser. It is labelled on
every page, because a sign-in screen that only pretends to sign you in is worse
than none. Two accounts exist from the first load — Kain (admin) and User B
(student) — and the login page signs you in as either with one click.

To make it real, see **[Connecting the backend](#connecting-the-backend)** or
open `/README-academy.html` in the running site.

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

db/
  schema.sql             tables, row level security, server-side grading
  seed.sql               generated — the whole course as SQL

assets/css/
  01-foundation.css      tokens, type, layout, reveal, buttons, cursor, loader
  02-chrome.css          nav, menu, footer, browser frame, code editor, terminal
  03-sections.css        marketing section compositions
  04-app.css             the academy: dashboard, lessons, quizzes, admin, states

assets/js/
  core.js                rAF scheduler, scroll bus, reveal engine, custom cursor,
                         magnetic, loader, nav, i18n, soft page transitions
  modules.js             marketing interactions + the syntax highlighter
  km-config.js           the two Supabase values (yours to fill in)
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
passing; 20 database security checks passing.

## Accessibility

Semantic landmarks, a skip link, visible focus rings on both grounds, keyboard
operation throughout — including the timeline, the code explainer, the FAQ, the
comparison slider, the lesson shortcuts (`←` `→` `M` `S`) and the `⌘K` command
palette — `aria-expanded` on every disclosure, and a full
`prefers-reduced-motion` path that replaces cinematic transitions with fades
and leaves everything usable.

## Languages

The marketing site is EN / NL through `data-en` / `data-nl` (and the `-html`
and `-aria` variants), the same pattern the main KM.dev site uses; the choice
is remembered in `localStorage`. Large typographic statements stay in English
by art direction. The academy is currently English only — the content system
supports a translated field per block whenever that becomes worth doing.

## Notes on content

Nothing here invents credibility. No testimonials, client logos, award badges,
student counts or success percentages. Every preview and mockup is a
composition drawn in CSS. Where proof would normally sit, the design uses
whitespace instead.
