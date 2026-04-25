## P1 - High-Value UX Corrections

- [ ] **Add mode-specific behavior to sub-pages**
  - **Files:**
    - `src/routes/trips/[tripId]/itinerary/+page.svelte`
    - `src/routes/trips/[tripId]/rooms/+page.svelte`
    - `src/routes/trips/[tripId]/guests/+page.svelte`
    - `src/routes/trips/[tripId]/activities/+page.svelte`
    - `src/routes/trips/[tripId]/files/+page.svelte`
    - `src/routes/trips/[tripId]/polls/+page.svelte`
  - **Change:** Use dashboard mode to alter emphasis/content for Planning vs Vacation vs Recap (at least one clear mode-specific change per page).

## P2 - Cleanup and Consistency

- [ ] **Add missing account settings wiring**
  - **Files:** `src/routes/settings/+page.server.ts`, `src/routes/settings/+page.svelte`
  - **Change:** Wire blocked users + privacy/security controls, or remove non-functional controls (MFA/export placeholders) until implemented.

- [ ] **Fix mobile UX in messages**
  - **File:** `src/routes/messages/+page.svelte`
  - **Change:** Add narrow-screen master/detail behavior (conversation list pane + chat pane toggle) instead of fixed split columns.

## P3 - Terminology and Content Quality

- [ ] **Normalize legacy reservation wording**
  - **Files:**
    - `src/routes/confirmation/[id]/+page.svelte`
    - Any shared templates tied to reservation flow
  - **Change:** Replace reservation-heavy phrasing with Divvi trip vocabulary where appropriate.

- [ ] **Add vocabulary guardrail**
  - **Files:** lint script/config (`package.json` scripts or dedicated check script)
  - **Change:** Add text check for disallowed terms in route/component copy (`reservation`, `booking`, etc.) and fail CI on regressions.