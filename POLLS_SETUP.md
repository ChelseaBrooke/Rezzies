# Polls Feature Setup

The Polls page has been enhanced with the new "idea board" style UI, full poll lifecycle, and role-based access.

## Database Migration

Run the migration to add the new columns and update constraints:

```bash
npx prisma migrate deploy
# or for development:
npx prisma migrate dev
```

Then regenerate the Prisma client if needed:

```bash
npx prisma generate
```

The migration `20260214000000_polls_enhanced`:
- Adds `title`, `description`, `category`, `pollType`, `status`, `showResultsLive`, `startAt`, `endAt` to Poll
- Migrates existing `question` → `title`, `active` → `open`
- Updates PollVote unique constraint for multi-choice support

## Features

- **Polls list page**: Search, category pills (All, Scheduling, Meals, Activities, Rooms/Beds, Other), sort (Most Recent, Ending Soon, Most Votes, Newest, Oldest)
- **Add New Poll** (hosts only): Create poll with title, description, category, type (single/multi), options, duration
- **Poll cards**: Status pills (Open, Closing soon, Closed, Draft), vote count, time labels
- **Voting**: Single or multiple choice; results visible when allowed
- **Host actions**: Close poll, Nudge non-responders (stub)

## Dummy Data

If the database schema is not yet migrated, the load will catch errors and return sample dummy polls so you can preview the UI.
