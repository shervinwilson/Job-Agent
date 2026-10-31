# Job Agent: Stage 1 (foundation)

Real Next.js + Supabase app: Google sign-in locked to one account, full database schema with row-level security, and a dashboard that reads live data (search, status filter, sorting, CSV export). No mock data. The table is empty until Stage 2 adds job discovery.

## Setup
1. **Supabase**: create a free project. In the SQL editor run `supabase/migrations/0001_init.sql`, then:
   `insert into app_owner (email) values ('you@gmail.com');`
2. **Google sign-in**: Google Cloud Console → APIs & Services → Credentials → OAuth client (Web). Authorized redirect URI: `https://lnvzlifylleybgrftjfj.supabase.co/auth/v1/callback`. In Supabase → Authentication → Providers → Google, paste the client ID and secret.
3. **Supabase URL config**: Authentication → URL Configuration → add `http://localhost:3000/**` (and your Vercel URL later) as redirect URLs.
4. `cp .env.example .env.local` and fill in the Supabase URL, publishable/anon key, server-only secret key (Project Settings → API), and `ALLOWED_EMAIL`. Set `GEMINI_API_KEY` to enable Gemini scoring; without it, scoring falls back to rules (or Claude if configured).
5. `npm install && npm run dev`, open http://localhost:3000.

## Deploy (Vercel)
Import the repo, add the same environment variables to Vercel (including `SUPABASE_SECRET_KEY` for discovery and optionally `GEMINI_API_KEY` for Gemini scoring), deploy, then add the Vercel URL to Supabase redirect URLs.

Keep `SUPABASE_SECRET_KEY` and `GEMINI_API_KEY` server-only. Never prefix them with `NEXT_PUBLIC_` or commit their values.

## Security notes
- Access is enforced twice: middleware checks `ALLOWED_EMAIL`, and Postgres RLS allows only emails in `app_owner`.
- Never commit `.env.local`. Later stages add secrets (Anthropic, Google OAuth, Hunter) as server-only variables.
