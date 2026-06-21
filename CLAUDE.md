# How We Build Divvi

> The rulebook for humans and agents. Keep it **tight** — it's loaded into context every session. Detail lives in the linked docs; this file is the rules. Process/PR flow is in [`CONTRIBUTING.md`](./CONTRIBUTING.md).
> **Status:** v0 skeleton — expand as conventions emerge; split into `docs/` companions when a section gets heavy.

---

## Prime directives

1. **The split must be defensible.** A guest must be able to look at their number and understand *why*. No magic adjustments. (See [`PRICING.md`](./PRICING.md).)
2. **Inform, don't pressure.** We surface what's happening; we never nag or guilt a guest (esp. cost re-approval). One quiet notification, host drives any nudge.
3. **Money is integer cents.** Never float money internally. Round only at display.

---

## Stack & where code goes

- **SvelteKit 2 + Svelte 5 (runes) + TypeScript**, Prisma + PostgreSQL (Supabase), Stripe (publish fee *only*), **Resend** (email — *not* SendGrid), Google Places, Vercel.
- **Server-only code → `$lib/server/`.** Never import server modules into client components.
- **Data loading → `load` functions.** **Mutations → form actions** (page) or `/api/*` routes (programmatic). Don't fetch your own `/api` route from a `load`.
- **Validation → zod** at the boundary (see `$lib/server/validation.ts`).

## Backend rules

- **Batch your Prisma queries.** Use `include`/`select`; **no N+1 in `load` functions.** (This is our #1 perf bug — trip dashboard loads were 3–5s.)
- **One pricing engine: `calculateReservationPrice` (`$lib/server/pricing-canonical.ts`).** Never add a second pricing path. Read [`PRICING.md`](./PRICING.md) before touching pricing.
- **Money:** integer cents; fields end in `Cents`; round only at presentation.
- **Auth:** session cookie (`user_session`); gate host actions with the existing role checks (`isHost` / `co-host`).

## Frontend rules

- **TypeScript everywhere** — `<script lang="ts">` (all ~100 components do).
- **Runes (Svelte 5), not legacy.** Props via a typed interface; state with `$state`; derived with `$derived`; effects with `$effect` (sparingly). **No `export let` / `$:`.**
  ```svelte
  <script lang="ts">
    interface Props { variant: 'first-trip' | 'first-rsvp'; }
    let { variant }: Props = $props();
    let current = $state(0);
  </script>
  ```
- **Components live in feature folders** under `src/lib/components/<area>/` (`trips`, `wizard`, `itinerary`, `profile`, `layout`, `games`). There is **no formal `ui/` kit** — share feature components + tokens; don't build a parallel primitive library.
- **Reuse over duplication.** When two flows need the same thing, extract one shared component (e.g. settings ↔ new-trip cards) — don't copy-paste.
- **Keep components dumb about the server** — data comes from `load`; mutations go through form actions / `$lib/server`. No business logic in `.svelte`.
- Always handle **loading / empty / error** states. Accessibility: semantic elements, labels, keyboard paths.

## UI/UX & design tokens

- **Source of truth: [`src/styles/theme.css`](./src/styles/theme.css)** ("Divvi Design System"). Rendered preview: [`docs/PALETTE.html`](./docs/PALETTE.html).
- **Never hardcode hex or px — use tokens:** colors (`--primary`, `--surface`, `--danger`, `--bg`…), spacing (`--spacing-*`), radius (`--radius-*`), shadows (`--shadow-*`), transitions (`--transition-*`).
- **Palette roles:** myrtle-green `#2F7778` (`--primary`) = primary & borders · alloy-orange `#CE5612` (`--warm`) = CTAs & logo · bright-yellow `#F7AA29` (`--carrot`) = accents · middle-blue `#7ACED3` (`--sky`) = soft accent · sand `#E3CEAA` = warm neutral · chocolate `#a5440e` = danger · page bg neutral light, surfaces white.
- **Typography:** `--font-display` (Fraunces) for headings/editorial; `--font-body` (Plus Jakarta Sans) for everything else; display scale `--display-xl/lg/md`. Don't re-declare font stacks per component.
- **Voice:** plain language; show *why* a price is what it is; "inform, don't pressure." Light emoji in onboarding/empty states is on-brand.

## Naming & vocabulary

- **Never use "reservation" or "booking" in UI/components/config.** Use *RSVP*, *trip*, *join*. Enforced by `npm run lint:vocabulary` (`scripts/check-vocabulary.mjs`).
- **Pricing model casing:** store/compare **snake_case** (`per_bed`); canonical server math **UPPER_SNAKE** (`PER_BED`); UI **kebab** (`per-bed`). Don't mix.
- Money fields end in **`Cents`**. Files/components: match the surrounding convention.

## Testing (mandatory bar)

- **Unit (vitest) required for pricing / money logic.** No tests → PR sent back.
- **E2E (Playwright) for spine funnels** (create → invite → RSVP → invoice); suite is per-persona under `e2e/`.
- **Run `npm run check && npm test` before every push.**

## Git & PRs

- **PR-per-story**, branch `<type>/<STORY-ID>-<slug>`, **Conventional Commits**, **squash-merge**.
- **Tiered approval:** code-review agent on every PR; **Brett approves pricing / migrations / auth / money**; rest merge on agent-pass + green CI.
- Full process + git snippets → [`CONTRIBUTING.md`](./CONTRIBUTING.md). Update the story's status in [`docs/PLAN.md`](./docs/PLAN.md).

## Footguns — never do this

- ❌ Add a second pricing engine, or compute price outside `calculateReservationPrice`.
- ❌ Unbatched Prisma queries in a `load` (N+1).
- ❌ Float math on money; rounding mid-pipeline.
- ❌ The words "reservation"/"booking" in UI.
- ❌ Hardcoded hex colors instead of theme tokens.
- ❌ Commit straight to `main`; merge a pricing/migration PR without Brett.
- ❌ Resurrect `per_person_per_night`, `sharingExponentAlpha`, or `privacyPremiumP` (removed).

## Map

- [`PRICING.md`](./PRICING.md) — pricing spec (authoritative)
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — how it's built
- [`docs/PRD.md`](./docs/PRD.md) — what it is
- [`docs/PLAN.md`](./docs/PLAN.md) — story backlog & status
- [`docs/LAUNCH_CUTLINE.md`](./docs/LAUNCH_CUTLINE.md) — v1 scope
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — PR workflow
