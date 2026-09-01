# KM.dev — AI Developer Course

A flagship, four-page digital experience for the KM.dev AI Developer Course.
Built as a direct evolution of the existing KM.dev brand: same palette, same
typefaces, same radii, same editorial restraint. No new visual identity.

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

Dark surfaces (`--ink-2`, `--ink-3`, `--ink-line`) are derived from `--ink`;
they are not a second palette.

## Motion system

One system, five tiers — nothing gets a random easing.

| Tier | Duration | Used for |
|---|---|---|
| Micro | 150ms | hover, label shift, arrow |
| UI | 280ms | buttons, links, chips, tabs |
| Content | 560ms | reveals, section entrances |
| Story | 900ms | word reveals, clip transitions |
| Cinematic | 1500ms | loader, page transitions |

Easings: `--e-out` (the km.dev button curve), `--e-inout` (heavy),
`--e-soft` (content), `--e-spring` (physical). Everything animates
`transform` / `opacity` only. Physics-driven elements (slider, cursor,
preview follower, magnetic buttons) run on a single shared rAF loop with
velocity and settle, never a flat `transition: transform .3s`.

## Structure

```
index.html      Overview — hero, live build machine, scroll transformation,
                error → AI → fix, before/after, "AI writes. You build."
course.html     Curriculum — 8-chapter timeline, typographic morph, live code
                explainer, bad vs good prompt, prompt builder, mini lesson
work.html       Six project tracks, cursor-following previews
faq.html        Editorial FAQ, enrolment, final loop

assets/css/01-foundation.css   tokens, type, layout, reveal, buttons, cursor,
                               loader, page transition, reduced motion
assets/css/02-chrome.css       nav, menu, footer, browser frame, code editor,
                               terminal, rendered mini-site, footer
assets/css/03-sections.css     every section composition

assets/js/core.js       rAF scheduler, scroll bus, reveal engine, text split,
                        custom cursor, magnetic, loader, nav, i18n, router
assets/js/modules.js    syntax highlighter + every interactive system

build/build.py          composes work/faq from the index shell and emits the
                        single-file bundle
build/qc.js             console errors + horizontal overflow, 4 pages × 3 sizes
build/it.js             interaction suite (every demo, driven end to end)
build/final.js          reduced motion, CLS, keyboard, bundle routing
dist/km-dev-ai-course.html   the whole site as one file (hash routing)
```

## Build

```bash
python3 build/build.py          # regenerate work.html, faq.html and dist/
```

`index.html` is the shell of record. Editing the navigation, menu, loader,
preview follower or footer there and re-running the build propagates it to
`work.html` and `faq.html`. `course.html` keeps its own copy of the shell
because its `<main>` is authored by hand — keep it in sync when the shell
changes.

The page bodies for the generated pages live in `build/work.main.html` and
`build/faq.main.html`.

## Testing

```bash
python3 -m http.server 8099
node build/qc.js       # 12 checks: no console errors, no horizontal overflow
node build/it.js       # every interactive demo, end to end
node build/final.js    # reduced motion, layout shift, keyboard, bundle
```

Current results: 12/12 pages clean, CLS `0.0003`, no runtime errors across the
full interaction flow.

## Languages

EN / NL through `data-en` / `data-nl` (and `data-en-html` / `data-nl-html`,
`data-en-aria` / `data-nl-aria`) — the same pattern the main KM.dev site uses.
The choice is stored in `localStorage` under `km-lang`.

Large typographic statements ("Build websites with AI.", "AI writes. You
build.") stay in English by art direction; every explanatory line, label,
navigation item and FAQ answer is translated.

## Accessibility

Semantic landmarks, a skip link, visible focus rings on both grounds,
keyboard-operable timeline, code explainer, FAQ and comparison slider,
`aria-expanded` on the menu and FAQ, and a full `prefers-reduced-motion`
path — the loader is removed, the custom cursor is disabled, physics is
switched off, and the hero build sequence renders its finished state
immediately.

## Notes on content

Nothing on the site invents credibility. There are no testimonials, client
logos, award badges, student counts or success percentages. Every preview and
mockup is a composition drawn in CSS, not a screenshot or stock image. Where
proof would normally sit, the design uses whitespace instead.
