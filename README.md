# shiftshappn

Premium Canadian medical scrubs ecommerce platform built with React Router v8 (framework mode), Neon Postgres, Prisma, Cloudinary, Stripe, and Tailwind CSS.

## Requirements

- **Node.js 22.22+** (required by React Router 8)
- Neon Postgres database
- Stripe account (test mode for development)
- Cloudinary account (optional for images)
- Resend account (optional for emails)

## Quick Start

```bash
# Use Node 22+
nvm use 22

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Fill in DATABASE_URL, STRIPE keys, etc.

# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Seed demo data (admin, products, homepage blocks)
npm run db:seed

# Start dev server
npm run dev
```

## Default Admin Login

After seeding:
- **Email:** admin@shiftshappn.com
- **Password:** admin123

## Environment Variables

See `.env.example` for all required variables.

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon pooled connection string |
| `DATABASE_URL_UNPOOLED` | Neon direct connection (for migrations) |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `RESEND_API_KEY` | Resend email API key |
| `SESSION_SECRET` | Cookie signing secret |
| `APP_URL` | App URL (e.g. http://localhost:5173) |

## Project Structure

```
app/
  routes/           # All route modules (storefront + admin + API)
  components/       # UI components (storefront, admin, homepage-blocks)
  lib/              # Server utilities (db, stripe, cloudinary, session, seo)
prisma/
  schema.prisma     # Database schema (16 models)
  seed.ts           # Seed script
```

## Features

### Storefront
- Block-driven homepage (editable via admin)
- Product listing pages (Women, Men, Colour, Fabric)
- Product detail with variant selectors and cart
- Cart drawer with Stripe Checkout
- Blog / Journal
- Customer accounts with order history
- SEO: sitemap.xml, robots.txt, JSON-LD structured data

### Admin Panel (`/admin`)
- Dashboard with revenue stats and low-stock alerts
- Product CRUD with variant grid
- Categories, Collections, Homepage blocks
- Orders with fulfill/refund actions
- Blog CMS, Discount codes, Media library
- Review moderation

## Stripe Webhook (Local Dev)

```bash
stripe listen --forward-to localhost:5173/api/webhook
```

Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET` in `.env`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run typecheck` | TypeScript check |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to database |
| `npm run db:seed` | Seed demo data |
| `npm run db:studio` | Open Prisma Studio |

## Tech Stack

- **Framework:** React Router 8 (SSR)
- **Database:** Neon Postgres + Prisma 6
- **Payments:** Stripe Checkout
- **Images:** Cloudinary CDN
- **Email:** Resend
- **Styling:** Tailwind CSS v4
- **State:** Zustand (cart)
