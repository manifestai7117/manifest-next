# Manifest — Complete Production Setup Guide
## Next.js + Supabase + Anthropic + Resend

---

## WHAT'S INCLUDED

This is a production-grade Next.js 14 app with:
- Real authentication (email + Google OAuth) via Supabase Auth
- Email verification and password reset emails (built into Supabase)
- PostgreSQL database via Supabase with proper Row Level Security
- AI Goal Generator (server-side, API key never exposed)
- AI Coach with full conversation history stored in DB
- Goal Circles with real-time group chat + AI coach responses
- Streak tracker with real check-in data
- Welcome emails via Resend
- Vision art generation
- Print shop (connect Stripe + Printful to complete)

---

## STEP 1 — CREATE SUPABASE PROJECT (10 min)

1. Go to https://supabase.com → New project
2. Choose a name (e.g. "manifest"), set a strong DB password, pick a region
3. Wait ~2 min for it to initialize

### Run the database schema:
1. In Supabase dashboard → SQL Editor → New query
2. Copy the ENTIRE contents of `supabase-schema.sql`
3. Click Run

### Get your keys:
- Settings → API
- Copy: Project URL, anon/public key, service_role key (keep this secret!)

### Enable Google OAuth (optional but recommended):
- Authentication → Providers → Google → Enable
- You'll need a Google Cloud project with OAuth credentials
- Set redirect URL to: `https://your-project.supabase.co/auth/v1/callback`

### Configure email templates in Supabase:
- Authentication → Email Templates
- These are auto-sent by Supabase for:
  - Email confirmation (on signup)
  - Password reset
  - Email change
- Customize them to match Manifest branding

### Set your site URL:
- Authentication → URL Configuration
- Site URL: `https://your-vercel-url.vercel.app`
- Redirect URLs: `https://your-vercel-url.vercel.app/**`

---

## STEP 2 — GET ANTHROPIC API KEY (2 min)

1. Go to https://console.anthropic.com
2. API Keys → Create key
3. Copy it — starts with sk-ant-

---

## STEP 3 — GET RESEND API KEY (5 min)

1. Go to https://resend.com → Create account
2. API Keys → Create API Key
3. Copy it — starts with re_
4. Add and verify your sending domain (or use their test domain for development)

---

## STEP 4 — LOCAL DEVELOPMENT

```bash
# Clone / download the manifest-next folder
cd manifest-next

# Install dependencies
npm install

# Copy env file
cp .env.local.example .env.local

# Fill in your keys:
# NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
# SUPABASE_SERVICE_ROLE_KEY=eyJ...
# ANTHROPIC_API_KEY=sk-ant-...
# RESEND_API_KEY=re_...
# RESEND_FROM_EMAIL=hello@yourdomain.com
# NEXT_PUBLIC_APP_URL=http://localhost:3000

# Run dev server
npm run dev
```

Open http://localhost:3000

---

## STEP 5 — DEPLOY TO VERCEL (10 min)

### Option A: Via Vercel dashboard (easiest)
1. Push your code to GitHub (new repo)
2. Go to https://vercel.com/new
3. Import your GitHub repo
4. Framework: Next.js (auto-detected)
5. Add ALL environment variables from .env.local
6. Change NEXT_PUBLIC_APP_URL to your Vercel URL
7. Click Deploy

### Option B: Via CLI
```bash
npm install -g vercel
vercel
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add ANTHROPIC_API_KEY
vercel env add RESEND_API_KEY
vercel env add RESEND_FROM_EMAIL
vercel env add NEXT_PUBLIC_APP_URL
vercel --prod
```

### After deploy:
1. Update Supabase → Authentication → URL Configuration with your real Vercel URL
2. Update NEXT_PUBLIC_APP_URL in Vercel environment variables
3. Redeploy for env var changes to take effect

---

## STEP 6 — CONNECT STRIPE FOR PAYMENTS (Optional)

```bash
npm install stripe @stripe/stripe-js
```

Add to .env.local:
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_ELITE_PRICE_ID=price_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

Create a webhook handler at `/api/webhooks/stripe` to:
- Handle `checkout.session.completed` → update user plan in Supabase
- Handle `customer.subscription.deleted` → downgrade to free

---

## STEP 7 — CONNECT PRINTFUL FOR PRINT ORDERS (Optional)

1. Create account at printful.com
2. Add your products (canvas, poster, framed prints)
3. Get your API key: Settings → API
4. Add to .env: `PRINTFUL_API_KEY=...`
5. Create `/api/print/order` route to POST orders to Printful API

---

## VIEWING YOUR DATA (Supabase Dashboard)

Go to your Supabase project → Table Editor to see:

| Table | What it contains |
|-------|-----------------|
| profiles | All signed-up users, name, email, plan |
| goals | Every goal created, with AI-generated content |
| checkins | Every daily check-in with mood and notes |
| coach_messages | Full AI coach conversation history |
| circles | The 6 goal circles |
| circle_members | Who joined which circle |
| circle_messages | All group chat messages |

You can also go to Authentication → Users to see all registered users.

---

## ARCHITECTURE OVERVIEW

```
src/
├── app/
│   ├── page.tsx                 ← Landing page
│   ├── auth/
│   │   ├── login/page.tsx       ← Sign in
│   │   ├── signup/page.tsx      ← Sign up (sends verification email)
│   │   └── callback/route.ts   ← OAuth + email verification handler
│   ├── onboarding/page.tsx      ← 4-step goal creation flow
│   ├── dashboard/
│   │   ├── layout.tsx           ← Server: auth check + data fetch
│   │   ├── page.tsx             ← Overview
│   │   ├── goal/page.tsx        ← Goal detail
│   │   ├── coach/page.tsx       ← AI coach chat (saves to DB)
│   │   ├── circles/page.tsx     ← Goal circles + group chat
│   │   ├── streak/page.tsx      ← Streak calendar
│   │   ├── art/page.tsx         ← Vision art
│   │   └── print/page.tsx       ← Print shop
│   └── api/
│       ├── goals/generate/      ← AI goal + art generation (server-side)
│       ├── coach/               ← AI coach (saves conversation to DB)
│       ├── checkin/             ← Check-in + streak logic
│       ├── circles/             ← Circle messages + AI responses
│       └── email/welcome/       ← Welcome email via Resend
├── components/
│   └── dashboard/
│       ├── DashboardShell.tsx   ← Sidebar navigation
│       └── CheckInButton.tsx    ← Interactive check-in with mood
├── lib/
│   └── supabase/
│       ├── client.ts            ← Browser Supabase client
│       └── server.ts            ← Server Supabase client
├── middleware.ts                ← Auth protection for /dashboard
└── types/index.ts               ← TypeScript types
```

---

## LAUNCH CHECKLIST

- [ ] Supabase project created and schema applied
- [ ] All 6 environment variables set in Vercel
- [ ] Supabase Site URL updated to production URL
- [ ] Tested signup → email verification → onboarding → dashboard flow
- [ ] Tested AI coach responds with goal context
- [ ] Tested check-in increments streak
- [ ] Tested goal circles chat
- [ ] Privacy policy page added (use Termly.io)
- [ ] Terms of service page added
- [ ] Custom domain connected (Vercel → Settings → Domains)
- [ ] Resend domain verified for email delivery
- [ ] Google OAuth configured (optional)

---

## COMMON ISSUES

**"relation does not exist" error**
→ Run the supabase-schema.sql in Supabase SQL Editor

**Auth callback not working**
→ Check Supabase → Authentication → URL Configuration → add your domain to Redirect URLs

**AI not responding**
→ Check ANTHROPIC_API_KEY is set in Vercel → Environment Variables → Redeploy

**Emails not sending**
→ Verify your domain in Resend dashboard → Check RESEND_FROM_EMAIL matches verified domain

**Build fails**
→ Run `npm run build` locally first to catch TypeScript errors
