# Bid War

Party bidding game. SvelteKit + TS + Tailwind v4 + Postgres (Drizzle ORM).

## Motion is a requirement, not polish

**Every screen animates on entry. No exceptions — including error pages, empty
states, and anything added later.** The feel to aim for is Super Smash Bros
character select: things *slam* into place with an overshoot, they don't fade.

A screen that renders statically is a bug, same as a broken button.

### Use the existing vocabulary — don't invent a second one

It all lives in `src/app.css`. Reach for these before writing a new keyframe:

| class | what it does |
|---|---|
| `smash-in` | slam up into place with an overshoot — headings, hero titles |
| `smash-left` | slam in from the left — rows, chips, menu items |
| `stagger` | on a **container**: slams its direct children in one after another |
| `punch` | quick scale pop — something landed (a vote, a filled seat) |
| `press` | springy squash on `:active` — every button and link |
| `chip` | filter/toggle pill: brightens on hover, kicks on press |
| `tile` | character-select card: lifts + glows in `--glow` on hover/focus |
| `shake` | horizontal shake — rejected input |
| `ring-pulse`, `burst` | live-bid glow and win impact (game screen) |

Cascading a list: put `smash-in` on each item with an inline
`animation-delay:{i * 0.035}s`. Re-key a container (`{#key filter}`) to replay
the whole cascade when its contents change.

### Three things that have already bitten

1. **Don't `{#key}` a focusable element to replay an animation.** It remounts
   and drops keyboard focus mid-interaction. Animate the node directly instead
   — `el.animate([...])` (Web Animations API) — or restore focus after `tick()`.
2. **Svelte transitions ignore the CSS reduced-motion block.** `in:fly`,
   `out:scale`, `animate:flip` keep running. Gate every one on `motionOK()`
   (see `routes/new/+page.svelte`).
3. **Component-scoped overrides must match specificity.** `.resting {}` loses
   to `.c2 .resting {}`, so a reduced-motion override can silently do nothing.
   Always verify the computed `animationName` actually changed.

### Reduced motion is non-negotiable

Every new keyframe goes in the `@media (prefers-reduced-motion: reduce)` block
in `app.css`. The bar: **0 running animations and 0 invisible elements** on
every page. Watch for animations that fade *in* — killing them must leave the
element visible, not stuck at `opacity: 0`.

Hover affordances stay under reduced motion (the tile keeps its colour ring),
only the movement goes.

### Check it before saying it's done

With the dev server up, in the browser console on each page:

```js
// during the first second of a page load — should be well above zero
document.getAnimations().length

// with reduced motion forced on (DevTools > Rendering > Emulate CSS media)
// both must be 0
document.getAnimations().filter(a => a.playState === 'running').length
[...document.querySelectorAll('body *')]
  .filter(e => +getComputedStyle(e).opacity === 0 && getComputedStyle(e).display !== 'none').length
```

Screenshots don't prove motion. Measure it, or record a clip.

## Other conventions

- **Drafts** are the biddable lists. Items are stored as `{ n: string }`
  objects, not bare strings, so cover art and per-item images can be added
  later without a migration.
- **Categories are a fixed list** (`src/lib/drafts.ts`). Free-text categories
  turn into 400 spellings of "sports" and kill browsing.
- **Identity is the `bw_pid` httpOnly cookie** — no accounts. It's what makes
  one-vote-per-browser and "delete your own draft" work. Never trust a
  client-supplied id for either.
- **Seed content is written from scratch.** Don't scrape another site's lists
  into the market.
- **Never load→mutate→save a game yourself.** Use `withGame(id, fn)`; it holds
  `SELECT … FOR UPDATE` on the row for the whole read-apply-write. A plain read
  then write loses concurrent moves — measured at 1 of 25 writes surviving.
- Migrations are generated (`pnpm db:generate`) from `src/lib/server/schema.ts`
  and applied automatically on boot by the `init` hook in `hooks.server.ts`.
- `DATABASE_URL` selects the database; it defaults to the local `bidwar` one.
  The db tests need a throwaway Postgres and default to `bidwar_test`.
- Tests: `pnpm test`. Type check: `pnpm check` (keep it at
  0 errors).
