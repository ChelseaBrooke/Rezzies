# Contributing to Divvi — Workflow Guide

> **Read this first.** We're moving from "commit straight to `main`" to a **PR-per-story** flow. This guide is the *how* and the *why*, with copy-paste commands. The standing engineering rules live in [`CLAUDE.md`](./CLAUDE.md); this doc is the process.

---

## What's changing (and why)

**Before:** edit on `main` → commit → push. Fast, but no review, no safety net, and hard to track what shipped.

**Now:** one **story** = one **branch** = one **PR** → reviewed → squash-merged.

Why bother: it gives us reviewable units, an automated quality gate, and a clean history where every commit on `main` maps to a story in [`PLAN.md`](./docs/PLAN.md). The cost is a little ceremony per change — this guide keeps that ceremony small.

**The one mental shift:** a story isn't done when it works on your machine. **It's done when its PR is reviewed and squash-merged.**

---

## Local database setup (first run)

You need a local Postgres before anything else works. We use the Supabase CLI.

```bash
# 1. Start local Supabase (Postgres on 54322, Studio on 54323)
supabase start

# 2. Point .env at it. Locally BOTH URLs are the same direct connection --
#    there is no pooler, so do NOT add ?pgbouncer=true here.
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
DIRECT_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres

# 3. Build the schema and seed a dev trip -- one command
npm run db:fresh
```

`npm run db:fresh` drops the `public` schema, replays the full migration history
with `prisma migrate deploy`, regenerates the Prisma client, and runs the dev
seed. It **refuses to run unless `DATABASE_URL` and `DIRECT_URL` both point at
localhost**, because it is destructive.

To do it by hand instead:

```bash
npx prisma migrate deploy   # build the schema from prisma/migrations
npm run db:seed             # dev users + one published trip
```

### What the seed gives you

`npm run db:seed` (`prisma/seed.ts`) creates a published three-night trip with
rooms, beds, trip members, RSVPs and bed assignments — enough for the dashboard
and the pricing engine to render something real. It is idempotent: users are
upserted, and the demo trip is rebuilt on each run, so re-running never
duplicates. Dev logins (**local only — never use these anywhere real**):

| Email | Password | Role |
|---|---|---|
| `host@divvi.local` | `DivviDev123!` | host |
| `guest@divvi.local` | `DivviDev123!` | guest |
| `guest2@divvi.local` | `DivviDev123!` | guest |

### Running e2e

Playwright seeds its own fixtures on top of the same database:

```bash
npm run test:e2e
```

### Verifying the migration history is still self-sufficient

A fresh database must be buildable from `prisma/migrations` alone. If you change
the schema, confirm the history still matches it:

```bash
# one-time: a scratch database for Prisma to replay migrations into
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c 'CREATE DATABASE divvi_shadow;'

npx prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url "postgresql://postgres:postgres@127.0.0.1:54322/divvi_shadow" \
  --script
```

It must print `No difference detected.` If it prints SQL, the schema has drifted
ahead of the migrations — add a migration containing exactly that SQL. **Never
patch a database by hand-running SQL**; that is what caused the drift TD4 fixed.
The shadow database is reset by this command, so point it at a scratch database,
never at the one you are working in.

### Before merging a migration that touches an already-deployed database

Production and existing local databases may already contain a change (for
example, if it was ever applied by hand). Migrations in this repo are therefore
written **idempotently** — `ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT
EXISTS`, guarded `DO $$` blocks for constraints — so `migrate deploy` is safe to
run anywhere. Keep doing that.

Whatever the style, run a **read-only** diff against production before merging:

```bash
npx prisma migrate diff \
  --from-url "$PROD_DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma
```

If that reports `No difference detected.`, production already matches the schema
and the migration will be a no-op there. If it reports SQL, production is itself
missing something — sort that out before merging. (This matters most for the one
statement in `20260827000000_close_schema_drift` that is destructive: it drops
the long-dead `Trip.inviteCode` column.)

---

## The loop (copy-paste)

```bash
# 1. Start from fresh main
git checkout main && git pull

# 2. Branch for the story (see naming below)
git checkout -b fix/B2-guest-missing-user

# 3. ...do the work...

# 4. Gate it locally — BOTH must pass before you push
npm run check      # types + vocabulary lint
npm test           # vitest (and e2e if the story touches a spine funnel)

# 5. Commit (Conventional Commits + story ID)
git add -A
git commit -m "fix(guests): align userId param on guest edit (B2)"

# 6. Push and open the PR
git push -u origin fix/B2-guest-missing-user
# open the PR on GitHub (or: gh pr create)
```

Then: the **code-review agent reviews automatically** → address comments → **squash-merge** → branch auto-deletes.

---

## Branch naming

`<type>/<STORY-ID>-<short-slug>`

| Type | Use for |
|---|---|
| `feat` | new behavior |
| `fix` | bug fix |
| `perf` | performance |
| `refactor` | no behavior change |
| `chore` | tooling/deps |
| `docs` | docs only |
| `test` | tests only |

Examples: `fix/B2-guest-missing-user` · `feat/PR6-perperson-attendance` · `perf/PF2-trip-load-queries`

**Grouping:** if several small stories touch the same files (same epic), it's fine to do them on **one branch / one PR** — name it after the lead story. Don't split work just to hit "one PR per story" when it adds friction.

---

## Commits — Conventional Commits

`type(scope): summary (STORY-ID)`

- `fix(guests): align userId param on guest edit (B2)`
- `feat(pricing): split per_person by live attendance (PR6)`
- `perf(trip): batch room/bed queries on dashboard load (PF2)`

Keep the summary imperative and under ~72 chars. Body optional (the "why"). Agent-authored commits also append a `Co-Authored-By:` trailer.

---

## Pull requests

**Title:** same as your lead commit, with the story ID.
**Body template:**

```md
## Story
B2 — Guest edit fails with "Missing user"

## What
Aligned the form field to the action param (`userId`).

## Why
Edit form posted `userId` but the action read `targetUserId`.

## Testing
- [ ] `npm run check` passes
- [ ] `npm test` passes
- [ ] Manually: host sets a guest's status + room, no error
- [ ] Added/updated test: <path>

Closes story B2.
```

### Review & merge

1. **Code-review agent** reviews every PR — correctness, that **required tests exist**, the footguns ([`CLAUDE.md`](./CLAUDE.md)), and security. It leaves inline comments. No waiting on a human for round one.
2. **Tiered human approval:**
   - **Brett approves** PRs that touch **pricing, DB migrations, auth, or money**.
   - Everything else can merge on **code-review-agent pass + green CI**.
3. **Squash-merge only** — one clean commit per story on `main`. Delete the branch.

*(No "fast lane" — docs and typo PRs go through the same review. It's quick because they're small.)*

---

## Testing bar (mandatory)

- **Unit tests (vitest) are required for pricing / money logic** — it's the defensible-split core. A pricing PR without tests will be sent back.
- **E2E (Playwright) for the spine funnels** — trip create → invite → RSVP → invoice. The suite is organized by persona under `e2e/` (`host`, `guest`, `anonymous`, …).
- Elsewhere: pragmatic. Don't gold-plate; do cover the behavior you changed.
- **Always run `npm run check && npm test` before pushing.**

---

## FAQ — for the transition

**"This feels slower than committing to main."** The slowdown is mostly first-PR learning. Stories are pre-sliced small (see `PLAN.md`), the code-review agent reviews instantly, and squash-merge keeps it one commit. After a few PRs it's muscle memory.

**"What if my change is tiny?"** Still a branch + PR — but tiny changes get tiny, fast reviews. Group trivially-related tiny changes into one PR.

**"I started on `main` by accident."** Move the work to a branch before committing:
```bash
git stash && git checkout -b fix/XX-... && git stash pop
```

**"`main` moved while I was working."** Rebase before opening the PR:
```bash
git fetch origin && git rebase origin/main
```

**"Which story am I even on?"** Every task is a story ID in [`PLAN.md`](./docs/PLAN.md). Pick one, branch with its ID, and check it off there when merged.

**"Do I update PLAN.md?"** Yes — flip the story's status (☐ → ◐ → ✅) as you go. That's our buyoff tracker.
