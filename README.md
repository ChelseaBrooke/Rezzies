# Rezzies

A consumer-friendly web application that allows trip organizers to fairly split vacation rental costs among guests. No more spreadsheets, group chat confusion, or last-minute renegotiations.

## Tech Stack

- **Framework**: SvelteKit (TypeScript)
- **Database**: Supabase (PostgreSQL)
- **ORM**: Prisma
- **Email**: Resend
- **Hosting**: Vercel
- **Package Manager**: npm

## Features

- **Trip Management**: Create and manage multiple trips with Airbnb/VRBO integration
- **Flexible Pricing Models**: Support for per-room, per-bed, per-person, and per-person-per-night pricing
- **Room & Bed Setup**: Easy interface for hosts to configure room inventory
- **Invite Code Access**: Secure trip access via unique invite codes
- **Guest Reservations**: Simple reservation flow for guests with automatic price calculation
- **Host Dashboard**: View reservations, manage trips, and export ledger data
- **Email Confirmations**: Automated confirmation emails via Resend
- **Double-booking Prevention**: Automatic conflict detection

## Prerequisites

- Node.js 18+ and npm
- Supabase account and project
- Resend account with API key
- Vercel account (for deployment)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd RSVPsite
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and fill in all required values (see Environment Variables section below).

4. Set up the database:
```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations
npm run db:dev
```

5. Seed initial data (rooms and beds):
```bash
# You'll need to create a seed script or manually insert rooms/beds
# See Database Setup section below
```

## Environment Variables

### Required Variables

- `PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key (public)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (server-only, never expose to client)
- `DATABASE_URL` - PostgreSQL connection string (use **Connection pooling** in Supabase, port **6543**). Append `?pgbouncer=true` so Prisma works with the pooler (e.g. `...6543/postgres?pgbouncer=true`). Without this you may see "connection forcibly closed" (10054) or timeouts.
- `DIRECT_URL` - PostgreSQL direct connection string (Supabase **Direct** connection, port **5432**; used for migrations only)
- `RESEND_API_KEY` - Resend API key (`re_...`)
- `RESEND_FROM_EMAIL` - Verified sender address (use `onboarding@resend.dev` for testing)
- `RESEND_FROM_NAME` - Display name for sender (optional)
- `INTERNAL_API_KEY` - Secret key for protecting write endpoints
- `APP_BASE_URL` - Base URL of your app (e.g., https://your-app.vercel.app)
- `NODE_ENV` - Environment (development, production)

## Database Setup

### Initial Migration

After setting up your Supabase project and configuring `DATABASE_URL`, run:

```bash
npm run db:dev
```

This will create all tables (Room, Bed, GuestSubmission, EmailLog, AdminUser).

### Seeding Rooms and Beds

You need to populate the database with rooms and beds. The pricing logic expects specific bed IDs matching the canonical inventory in `src/lib/server/pricing.ts`.

You can either:

1. **Use Prisma Studio** (recommended for initial setup):
```bash
npm run db:studio
```

Then manually create rooms and beds matching the structure in `pricing.ts`.

2. **Create a seed script** (see `prisma/seed.ts` if available)

3. **Use SQL directly** in Supabase dashboard

### Creating an Admin User

To create an admin user, you'll need to hash a password and insert it into the database. You can use a script or Prisma Studio:

```typescript
import { hashPassword } from '$lib/server/auth';
import { prisma } from '$lib/server/prisma';

const passwordHash = await hashPassword('your-secure-password');
await prisma.adminUser.create({
  data: {
    email: 'admin@example.com',
    passwordHash
  }
});
```

## Troubleshooting

### "Can't reach database server" or "Connection forcibly closed" (10054)

1. **Supabase project paused** – In [Supabase Dashboard](https://supabase.com/dashboard), open your project and **Restore** if it’s paused (common on free tier).
2. **Pooler URL must use `?pgbouncer=true`** – For `DATABASE_URL` (pooler, port 6543), the query string must include `pgbouncer=true`. Example:
   ```text
   postgresql://postgres.[ref]:[password]@aws-1-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true
   ```
   Prisma uses the pooler in transaction mode; without `pgbouncer=true`, connections can be dropped by the server (10054).
3. **Direct URL for migrations** – Keep `DIRECT_URL` as the **Direct** connection (port 5432). Use it only for migrations; use `DATABASE_URL` (pooler) for the app at runtime.

## Development

Run the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run db:migrate` - Deploy migrations (production)
- `npm run db:dev` - Create and apply migrations (development)
- `npm run db:studio` - Open Prisma Studio
- `npm run prisma:generate` - Generate Prisma Client

## Project Structure

```
src/
├── lib/
│   ├── server/          # Server-only code
│   │   ├── prisma.ts    # Prisma client
│   │   ├── pricing.ts   # Pricing calculation logic
│   │   ├── validation.ts # Zod schemas
│   │   ├── auth.ts      # Admin authentication
│   │   ├── api-protection.ts # API key protection
│   │   └── email/        # Resend + HTML renderers
│   └── components/      # UI components
├── routes/
│   ├── +page.svelte     # Welcome page
│   ├── select/          # Room selection page
│   ├── confirmation/    # Confirmation page
│   ├── admin/           # Admin routes (protected)
│   └── api/             # API endpoints
└── prisma/
    └── schema.prisma    # Database schema
```

## Pricing Logic

Pricing is calculated based on:
- **Bed type** (king, queen, twin, bunk) - each has a base weight
- **Room sharing** - rooms with more beds have a privacy penalty
- **Stay duration** - linear scaling with number of nights

The total cost is distributed proportionally across all beds, ensuring:
- Sum of all beds for full 7-night stay = $7,538
- Higher privacy beds cost more
- Shared rooms are discounted

See `src/lib/server/pricing.ts` for the implementation.

## Deployment

### Vercel

1. Push your code to GitHub
2. Import the project in Vercel
3. Configure all environment variables in Vercel dashboard (see Environment Variables section)
4. Deploy

Vercel will automatically:
- Run `npm run build`
- Deploy serverless functions
- Set up preview deployments for PRs

### Database Migrations on Vercel

For production deployments, add a build command that runs migrations:

```json
{
  "buildCommand": "npm run prisma:generate && npm run db:migrate && npm run build"
}
```

Or configure Vercel to run migrations as a post-deploy step.

### Accessing Your App

After deployment:
- **Guest Access**: Share the invite code with guests. They can access trips at `https://your-app.vercel.app/trip/[INVITE_CODE]`
- **Host Access**: Log in at `https://your-app.vercel.app/admin/login`
- **Home Page**: `https://your-app.vercel.app/` - Guests can enter invite codes here

## Security

- All write endpoints are protected by `INTERNAL_API_KEY`
- Guest submissions use SvelteKit form actions (server-side, CSRF-protected)
- Admin routes require authentication via session cookies
- Never expose `SUPABASE_SERVICE_ROLE_KEY` or `INTERNAL_API_KEY` to the client
- Database access is server-only via Prisma

## Email (Resend)

Transactional HTML is built in code: trip invites (`src/lib/server/email/render/trip-invite.ts`) and guest confirmations (`render/guest-confirmation.ts`). Configure `RESEND_API_KEY` and a verified `RESEND_FROM_EMAIL`.

## Troubleshooting

### Prisma Client not found
Run `npm run prisma:generate`

### Database connection errors
- Verify `DATABASE_URL` is correct
- For migrations, ensure `DIRECT_URL` is set (non-pooled connection)
- Check Supabase connection pooling settings

### Email not sending
- Verify `RESEND_API_KEY` and `RESEND_FROM_EMAIL` (domain must be verified in Resend for production)
- Review the `EmailLog` table for failures

## License

[Your License Here]
