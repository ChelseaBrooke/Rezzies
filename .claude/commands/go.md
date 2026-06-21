---
description: Work the next story in docs/PLAN.md — reconcile merged work, pick the next story, do it on a branch, push + open a reviewed draft PR. One story per run.
---

You are running the Divvi **"Go" loop**. Do exactly this, in order. Do **one** story per run, then stop.

## 1. Reconcile what's merged
- Read `docs/PLAN.md`.
- For every story currently marked **⊙ In review**, check whether its branch/commit merged into `main`
  (`git log main --oneline | grep <STORY-ID>`, or `git branch --merged main`).
- For each that merged, flip its status to **✅ Done**. List what just completed.

## 2. Pick the next story
- Follow the **Suggested sequencing** in `docs/PLAN.md`. Choose the first story that is **all** of:
  - **☐ Todo**, and
  - **unblocked** (its dependencies are ✅), and
  - **greenlit** — respect the gate at the bottom of PLAN.md. Until `docs/LAUNCH_CUTLINE.md` is
    approved, only the carved-out starters (**B1–B3, PF1**, and docs **DC** stories) may run.
- If everything left is blocked or gated, **stop** and tell the dev exactly what's blocking.
- State the chosen story (ID + title) and one line on why it's next.

## 3. Do the work (via the owning agent)
- Branch off fresh `main`: `<type>/<STORY-ID>-<slug>` (e.g. `fix/B2-guest-missing-user`).
- Delegate to the story's **Owner** agent (the PLAN "Owner" column — e.g. `divvi-backend`,
  `pricing-be`, `perf-be`, `divvi-frontend`, `observability`, `docs`) to implement to the story's
  **acceptance criteria**, following `CLAUDE.md`.
- Run `npm run check && npm test`. Report the **real** results — never assume.
- Commit with a Conventional Commit incl. the story ID.

## 4. Push + open a draft PR
- `git push -u origin <branch>`, then open a **draft PR**: `gh pr create --draft`, titled
  `<type>(scope): <summary> (<STORY-ID>)`, body filled from the **PR template in `CONTRIBUTING.md`**
  (Story / What / Why / Testing checklist / "Closes story <ID>"). **Never merge.**
- If the story touches **pricing, DB migrations, auth, or money**, mark in the PR that it
  **requires Brett's approval** before merge (tiered gate).
- If `gh` or a GitHub remote isn't available, push what you can and tell the dev to open the PR manually.

## 5. Pre-review + update the tracker
- Run the **code-review** agent on the new PR. Have it post its verdict as a **PR comment** and include
  the summary in your report — so the dev opens an already-reviewed PR.
- Set the story's status in `docs/PLAN.md` to **⊙ In review** (PR open) — **not** ✅. ✅ is assigned in
  step 1 of the next run, once merged. Update the Dashboard "Done" counts if any reconciled in step 1.
- Regenerate `docs/PLAN.html` from PLAN.md (use the `/tmp/md2html2.py` converter pattern).

## 6. Report, then STOP
Tell the dev:
- **Done this run:** story ID + what changed + branch + **PR link**.
- **Review verdict:** the code-review agent's summary (approve / request changes) + any approval needed.
- **Verify locally:** the acceptance steps to check, plus test results.
- **Next up:** the story `/go` will pick next time.

Then **stop** — one story per `/go`. The dev reviews the draft PR, addresses any comments, and
squash-merges. The next `/go` reconciles that merge to ✅.

> To work a specific story instead of the next one, the dev can say e.g. `/go B3`.
