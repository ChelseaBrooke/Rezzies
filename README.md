# Wedding Airbnb Room Selection App

A lightweight web app for coordinating room and bed assignments for wedding guests staying at an Airbnb property.

## Tech Stack

- **Framework**: SvelteKit (TypeScript)
- **Database**: Supabase (PostgreSQL)
- **ORM**: Prisma
- **Email**: SendGrid
- **Hosting**: Vercel
- **Package Manager**: npm

## Features

- Guest room/bed selection with dynamic pricing
- Automatic price calculation based on bed type, room sharing, and stay duration
- Email confirmations via SendGrid templates
- Admin dashboard for viewing submissions
- Double-booking prevention
- No user authentication required for guests (public access)

## Prerequisites

- Node.js 18+ and npm
- Supabase account and project
- SendGrid account with API key
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
- `DATABASE_URL` - PostgreSQL connection string (pooled, for runtime)
- `DIRECT_URL` - PostgreSQL direct connection string (non-pooled, for migrations)
- `SENDGRID_API_KEY` - SendGrid API key
- `SENDGRID_FROM_EMAIL` - Email address to send from
- `SENDGRID_FROM_NAME` - Display name for sender (optional)
- `SENDGRID_TEMPLATE_GUEST_CONFIRMATION` - SendGrid template ID for guest confirmation emails
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
│   │   └── email/        # SendGrid integration
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
3. Configure all environment variables in Vercel dashboard
4. Deploy

Vercel will automatically:
- Run `npm run build`
- Deploy serverless functions
- Set up preview deployments for PRs

### Database Migrations on Vercel

For production deployments, migrations should run automatically via the `db:migrate` script in your build process, or you can configure Vercel to run migrations as a build step.

## Security

- All write endpoints are protected by `INTERNAL_API_KEY`
- Guest submissions use SvelteKit form actions (server-side, CSRF-protected)
- Admin routes require authentication via session cookies
- Never expose `SUPABASE_SERVICE_ROLE_KEY` or `INTERNAL_API_KEY` to the client
- Database access is server-only via Prisma

## SendGrid Templates

You need to create a SendGrid Dynamic Transactional Template for guest confirmations. The template should use these variables:

- `guestName`
- `roomName`
- `bedType`
- `checkInDate`
- `checkOutDate`
- `nights`
- `totalPrice`
- `confirmationUrl`

Set the template ID in `SENDGRID_TEMPLATE_GUEST_CONFIRMATION`.

## Troubleshooting

### Prisma Client not found
Run `npm run prisma:generate`

### Database connection errors
- Verify `DATABASE_URL` is correct
- For migrations, ensure `DIRECT_URL` is set (non-pooled connection)
- Check Supabase connection pooling settings

### Email not sending
- Verify `SENDGRID_API_KEY` is correct
- Check SendGrid template ID matches
- Review email logs in database (`EmailLog` table)

## License

[Your License Here]
