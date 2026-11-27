# ian — personal site

One page. Static HTML, CSS and one plain JS file — no framework, no build step,
no dependencies. The only external request is the webfont stylesheet from Google
Fonts (Fraunces, Newsreader, IBM Plex Mono); drop those two `<link>` tags from
`index.html` and everything falls back to system serif and mono. Open
`index.html` in a browser, or serve the folder with `python3 -m http.server`.

**Domain:** `ianthinks.com` — available as of 2026-11-25, not yet registered.

## files
| file | what it is |
|---|---|
| `index.html` | the whole site: hero, intro, filter chips, every entry |
| `style.css`  | everything visual; all colours are variables in the first ~70 lines |
| `app.js`     | theme toggle, filtering, reveal, parallax, progress — then the interactive layer: search palette, sortable tables, charts, code blocks |
| `assets/`    | images you add (the two grid tiles in there are unused now) |
| `build.py`   | optional: bundles the site into one file at `dist/page.html` |

## one-file build
The site needs no build step — `index.html`, `style.css` and `app.js` are served
as they are, and that is the normal way to deploy it. But if you want a single
file to email, hand over, or drop into a host that takes one document:

```
python3 build.py
```

That inlines the CSS and JS into `dist/page.html`. The only thing it
still fetches is the webfont stylesheet; delete the font `<link>`s first if you
want a file that touches the network not at all. It opens straight from disk
with no server.

Re-run it after any change to the three source files — `dist/page.html` is
generated, so don't edit it by hand.

The build refuses to write a file that has lost its doctype, charset, viewport
or closing tags, because a hand-made bundle previously had exactly that damage:
it rendered in quirks mode, guessed windows-1252, and printed `Â·` in the
footer. Better to fail the build than to ship that quietly.

## topics
One chronological feed, filterable. Three topics:

| topic | `data-cat` | classes |
|---|---|---|
| Current events | `current` | `c-current` / `d-current` |
| Stocks         | `markets` | `c-markets` / `d-markets` |
| Code           | `code`    | `c-code` / `d-code` |

## to add an entry
1. Copy the top `<li class="entry-item">` in `index.html`'s `#feed`.
2. Set `data-cat` to `current`, `markets` or `code`, and match the `cat` span's
   `c-` / `d-` classes to the table above.
3. Write the summary line in `.entry-note` and the whole piece in `.entry-body`.
4. Keep newest first.

A long piece can say more in the closed row: `<b class="entry-hint">` ends the
note with one italic line about what's inside, and a `<span class="entry-tags">`
of 3–6 short `<span>`s sits under it as subject chips (the first picks up the
topic colour). Both hide themselves once the entry is open, and the narrow
layout drops all but the first three tags.

Everything opens in place — there are no other pages to link to. Chip counts
update themselves, and a topic with no entries greys its chip out.

### what you can put in an entry body
- Paragraphs, links, lists — styled already.
- `<pre><code>…</code></pre>` for a code block. It gets a language label, a copy
  button and light syntax highlighting automatically. Add `data-lang="shell"`
  (or `js`, `python`) on the `<pre>` to skip the guess.
- `<table class="mini">` for a small numbers table. Any table with 2+ body rows
  becomes sortable — click a header to sort, click again to reverse. Numeric
  columns sort as numbers, and blanks or em-dashes always sink to the bottom.
- `<div class="chart">` for an inline chart, configured with data attributes:
  ```html
  <div class="chart" data-kind="line"
       data-values="18,21,19,26,24,31"
       data-labels="Q1,Q2,Q3,Q4,Q1,Q2"
       data-unit="%" data-caption="Revenue growth, year on year"></div>
  ```
  `data-kind` is `line` or `bar`; everything else is optional. It picks up the
  entry's topic colour, reads out values on hover, and is keyboard-navigable
  with the arrow keys. Needs at least two values.
- `<p class="disclaimer">` for the not-advice line on a stocks entry.

### long pieces
A piece with sections takes `class="entry-body is-long"` — a wider measure —
and `<h3>` for each section heading (they get a short rule above them in the
topic's colour). `<p class="lede">` sets the opening paragraph slightly larger.

### the CPO diagram
`index.html` carries one hand-drawn interactive figure, `<figure class="cpo">`,
in the optical networking entry. It's a schematic of a co-packaged optics
switch: click any block for an explanation, or run the transmit / receive
buttons to walk a dot through the package step by step. Three rules if you
touch it:
- Every description lives once, in `<dl class="cpo-key">` at the bottom of the
  figure. JS reads it into the read-out panel; with JS off it renders as a
  plain key. Edit the copy there, nowhere else.
- The two invisible `<path class="cpo-rail">` elements (`#cpo-tx`, `#cpo-rx`)
  are what the dot travels along. The step boundaries in `CPO_FLOWS` in
  `app.js` are fractions of those paths — move a block and they need redoing.
- Below ~560px the drawing scrolls sideways and the stage pans itself to
  follow the signal, so don't shrink the SVG's `min-width` to make it fit.

## what's interactive
- **Search** (`⌘K` / `Ctrl K`, or `/`, or the button in the top bar) opens a
  command palette that searches titles, topics, dates, summaries and the full
  body text of every entry. `↑` `↓` move, `↵` opens — which un-filters if
  needed, expands the entry, scrolls to it and flashes it. `?q=export` in the
  URL opens the palette primed with that search, so a search is linkable. The
  button only appears once there is at least one entry.
- **Theme toggle** (top right) cycles Auto → Light → Dark. Auto follows the OS.
  The choice is remembered per browser, and applied before first paint so there's
  no flash of the wrong theme on reload.
- **Filter chips** fade the feed, update the counts, and write the topic to the
  URL — so `…/#markets` is a linkable filtered view. Arrow keys move between chips.
- **Entries open in place** via `<details>`, so they work with JS off and are
  linkable, findable with Cmd+F when open, and printable.
- **Scroll reveal** fades entries in as they arrive, staggered.
- **Hero parallax** separates the ridges as you scroll. The wafer halo breathes,
  the vias pulse, and stars twinkle in dark mode only.
- **Reading progress** bar across the top of the page.
- **Entry open/close is animated** — the height is driven from JS, because
  `<details>` can't animate on its own. With JS off it still opens, instantly.
- **Filtering uses View Transitions** where the browser supports them, so rows
  cross-fade and slide to their new positions instead of snapping. Browsers
  without it fall back to the old fade.

All of it is switched off automatically for anyone with "reduce motion" set in
their OS accessibility settings.

## adding a fourth topic
1. Add `--c-newthing` to the `:root`, `prefers-color-scheme` and
   `:root[data-theme="dark"]` token blocks in `style.css` — all three need it.
2. Add `.d-newthing` and `.c-newthing` rules next to the others, plus the
   `.entry-item[data-cat="newthing"] .entry { --tint: … }` line.
3. Add one `<button class="chip" data-filter="newthing">` to `.filters`.

## the artwork
All original SVG — no stock photos, no licensing, no external requests.
The hero is inlined in `index.html` and drawn with CSS classes rather than fixed
fills, so it repaints for dark mode. Ridge shapes are the `<path class="ridge-N">`
lines. The `.hero-scrim` div keeps the title legible — don't remove it.

## before going public
- [ ] Register `ianthinks.com` (Cloudflare Registrar, at cost, ~$10/yr)
- [ ] Paste real entries into `#feed` (patterns in `_entry-examples.html`)
- [ ] Delete `<meta name="robots" content="noindex, nofollow">`
- [ ] Uncomment the canonical/og block in `index.html`

## deploying
Cloudflare Pages, free:
1. Register the domain at Cloudflare Registrar — DNS lands in the right account.
2. Pages → Create → "Upload assets" → drag this folder in.
3. Custom domains → add `ianthinks.com`.

**Keep it private:** Cloudflare Access (Zero Trust) puts a login in front of the
whole site — free tier, allow-list your own email. Set it up before attaching the
domain if you want zero public exposure.

## notes
- Type is Fraunces (titles), Newsreader (body) and IBM Plex Mono (labels),
  loaded from Google Fonts. Remove the two font `<link>` tags in `index.html`
  to go fully request-free; the stack falls back to Georgia and the system mono.
- The interactive layer is defensive: no entries means no search button, a
  table with one row isn't made sortable, a chart with fewer than two values is
  left alone, and the copy button falls back to selecting the text if the
  clipboard API is blocked.
- If a CSS edit doesn't show up locally, it's browser cache — hard-refresh
  (Cmd+Shift+R). Cloudflare handles this correctly on deploy.
