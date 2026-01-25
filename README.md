# TechChain Talent Hub

The premier recruiting marketplace for crypto talent. A three-sided platform connecting:
- **Companies** posting roles and defining commission terms
- **Approved recruiters** browsing roles, submitting candidates, and earning commissions
- **Candidates** joining the talent community, getting assessments, and receiving AI career coaching

## Features

### For Recruiters
- Access exclusive crypto roles from top companies
- Request/claim role access based on access model
- Submit candidates with consent and attestation
- Track submissions through the hiring pipeline
- Earn commissions when candidates start (paid 14 days after start date)
- Stripe Connect integration for fast payouts

### For Candidates (Talent Community)
- Create profile with career preferences and crypto interests
- Upload resume and link social profiles
- Get Crypto Native Score assessing ecosystem involvement
- GitHub-based technical skill scoring
- Role fit assessments against desired positions
- Personalized 30/60/90 day employability plan
- Optional discoverability for recruiters

### For Companies
- Post roles with customizable commission structures
- Define role access models (open, request, invite-only)
- AI-generated screening questions
- Review AI-scored candidate submissions
- Track candidates through hiring stages
- Hidden talent recommendations from community

### Platform Features
- RBAC with recruiter approval workflow
- Configurable platform take rate (global, company, role overrides)
- Payment collection at start date + 14 days
- Idempotent, transactional payment state machine
- AI-powered assessments with Zod schema validation
- pgvector embeddings for candidate matching
- BullMQ background jobs for async processing
- DEV_MODE for local testing without external services

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui components
- **Auth**: NextAuth.js (email magic link + Google OAuth)
- **Database**: PostgreSQL with pgvector extension
- **ORM**: Prisma
- **Background Jobs**: BullMQ + Redis
- **Payments**: Stripe + Stripe Connect
- **Email**: Resend
- **AI**: OpenAI API (with mock provider for dev)
- **Storage**: S3-compatible (with local fallback for dev)

## Quick Start

### Prerequisites
- Node.js 20+
- pnpm 8+
- Docker (for Postgres and Redis)

### Setup

```bash
# Clone the repository
git clone <repository-url>
cd techchain-talent-hub

# Run setup script (installs deps, starts Docker, seeds database)
chmod +x infra/scripts/setup.sh
./infra/scripts/setup.sh
```

Or manually:

```bash
# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env

# Start Docker services
docker compose -f infra/docker/docker-compose.yml up -d

# Generate Prisma client
pnpm db:generate

# Push schema to database
pnpm db:push

# Seed demo data
pnpm db:seed
```

### Running the Application

```bash
# Terminal 1: Start the web app
pnpm dev

# Terminal 2: Start the background worker
pnpm worker:dev
```

Open [http://localhost:3000](http://localhost:3000)

### Demo Accounts

Use magic link login with these emails:

| Role | Email |
|------|-------|
| Platform Admin | admin@techchain.io |
| Company Admin | hiring@defiprotocol.example |
| Approved Recruiter | alice@recruiting.example |
| Pending Recruiter | bob@recruiting.example |
| Candidate | dev@example.com |

In DEV_MODE, magic link emails are stored in the `DevEmail` table. Check them with:
```bash
pnpm db:studio
```

## Environment Variables

All environment variables are documented in `.env.example`. Key variables:

### DEV_MODE

Set `DEV_MODE=true` to enable:
- Mock AI provider (returns schema-valid JSON without API calls)
- Mock payment processing (simulates Stripe flows)
- Local file storage (saves to /tmp instead of S3)
- Email logging to database (instead of sending via Resend)
- Mock GitHub API responses (when no GITHUB_TOKEN)

### Required in Production

```bash
# Database
DATABASE_URL="postgresql://..."
REDIS_URL="redis://..."

# Auth
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="https://your-domain.com"

# Email
RESEND_API_KEY="..."

# Payments
STRIPE_SECRET_KEY="..."
STRIPE_WEBHOOK_SECRET="..."

# AI
OPENAI_API_KEY="..."
AI_PROVIDER="openai"

# Storage
S3_BUCKET="..."
S3_ACCESS_KEY_ID="..."
S3_SECRET_ACCESS_KEY="..."
```

### Optional Integrations

```bash
# Google OAuth
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# GitHub API (for skill scoring)
GITHUB_TOKEN=""

# Stripe Connect
STRIPE_CONNECT_CLIENT_ID=""
```

## Project Structure

```
techchain-talent-hub/
├── apps/
│   ├── web/                 # Next.js application
│   │   ├── src/
│   │   │   ├── app/         # App router pages
│   │   │   ├── components/  # React components
│   │   │   └── lib/         # Frontend utilities
│   │   └── ...
│   └── worker/              # BullMQ background worker
│       └── src/
│           └── index.ts     # Worker entry point
├── packages/
│   ├── db/                  # Prisma schema and client
│   │   └── prisma/
│   │       ├── schema.prisma
│   │       └── seed.ts
│   └── lib/                 # Shared services
│       └── src/
│           ├── services/    # Auth, AI, payments, etc.
│           ├── schemas.ts   # Zod schemas
│           └── queue.ts     # BullMQ queues
├── infra/
│   ├── docker/
│   │   └── docker-compose.yml
│   └── scripts/
│       ├── setup.sh
│       └── smoke-test.sh
└── ...
```

## API Routes

### Authentication
- `POST /api/auth/[...nextauth]` - NextAuth handlers

### Roles
- `GET /api/roles` - List roles (filtered by user role)
- `POST /api/roles` - Create role (company users)
- `GET /api/roles/[id]` - Get role details
- `PATCH /api/roles/[id]` - Update role
- `POST /api/roles/[id]/access` - Request role access
- `PATCH /api/roles/[id]/access` - Approve/reject access

### Submissions
- `GET /api/submissions` - List submissions
- `POST /api/submissions` - Submit candidate

### Candidates (Talent Community)
- `GET /api/candidates/profile` - Get own profile
- `POST /api/candidates/profile` - Create profile
- `PATCH /api/candidates/profile` - Update profile
- `GET /api/candidates/assessments` - Get assessments
- `POST /api/candidates/assessments` - Trigger assessment

### Admin
- `GET /api/admin/recruiters` - List recruiters
- `PATCH /api/admin/recruiters` - Approve/reject recruiter

## Running Tests

```bash
# Run smoke tests
chmod +x infra/scripts/smoke-test.sh
./infra/scripts/smoke-test.sh

# Type checking
pnpm typecheck
```

## Stripe Webhook Setup

For local development with Stripe webhooks:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`.

## Payment Flow

1. **Candidate Hired**: Commission created with status `PENDING_HIRE`
2. **Candidate Starts**: Status → `PENDING_START` → `PENDING_PAYMENT`
3. **Payment Scheduled**: At start_date + 14 days, status → `PAYMENT_SCHEDULED`
4. **Payment Collected**: Worker collects from company → `PAYMENT_COLLECTED`
5. **Payout Ready**: Status → `PAYOUT_PENDING`
6. **Payout Initiated**: Transfer to recruiter's Connect account → `PAYOUT_PROCESSING`
7. **Payout Complete**: Status → `PAYOUT_COMPLETED`

## AI Assessments

All AI outputs are validated with Zod schemas:

- `CryptoScoreSchema` - Crypto native score assessment
- `EmployabilityPlanSchema` - 30/60/90 day career plan
- `RoleFitAssessmentSchema` - Role fit analysis
- `CandidateSummarySchema` - Submission summary

In DEV_MODE, the MockAI provider returns schema-valid mock responses.

## Consent & Privacy

The platform respects candidate privacy:
- `consentToProcess` - Required for any data processing
- `consentToAnalyzeFootprint` - Optional, enables crypto score from social links
- `consentToAnalyzeGithub` - Optional, enables GitHub skill scoring
- `consentToBeContacted` - Optional, enables recruiter outreach
- `discoverable` - Requires consentToBeContacted, makes profile visible to recruiters

Candidates can revoke consent at any time via `/candidate/privacy`.

## Fraud Prevention

- Email verification required
- Optional phone verification (feature flag)
- GitHub proof verification for discoverable profiles
- Fraud score calculation for candidates
- Interview verification for submissions

## License

Proprietary - All rights reserved.
