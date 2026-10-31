# Job Agent

Next.js + Supabase job search assistant with owner-only access, job discovery and scoring, contact discovery, and review-before-send Gmail drafts.

## Setup
1. **Supabase**: create a free project. In the SQL editor run `supabase/migrations/0001_init.sql`, then:
   `insert into app_owner (email) values ('you@gmail.com');`
2. **Google sign-in**: Google Cloud Console → APIs & Services → Credentials → OAuth client (Web). Authorized redirect URI: `https://lnvzlifylleybgrftjfj.supabase.co/auth/v1/callback`. In Supabase → Authentication → Providers → Google, paste the client ID and secret.
3. **Supabase URL config**: Authentication → URL Configuration → add `http://localhost:3000/**` (and your Vercel URL later) as redirect URLs.
4. `cp .env.example .env.local` and fill in the Supabase URL, publishable/anon key, server-only secret key (Project Settings → API), and `ALLOWED_EMAIL`. Add optional stage-specific variables below as you enable those features.
5. `npm install && npm run dev`, open http://localhost:3000.

## Deploy (Vercel)
Import the repo, add required environment variables to Vercel (including `SUPABASE_SECRET_KEY` for discovery and Stage 4 Gmail variables if using email features), deploy, then add your Vercel URL to Supabase and Google OAuth redirect URLs.

Keep service secrets and Google OAuth credentials server-only. Never prefix them with `NEXT_PUBLIC_` or commit their values.

## Security notes
- Access is enforced twice: middleware checks `ALLOWED_EMAIL`, and Postgres RLS allows only emails in `app_owner`.
- Never commit `.env.local`.

## Stage 2: discovery and scoring
1. Run `supabase/migrations/0002_company_name_unique.sql` in the Supabase SQL editor.
2. Configure variables from `.env.example` as needed: `SUPABASE_SECRET_KEY`, `GEMINI_API_KEY`, optional `ANTHROPIC_API_KEY`, `ADZUNA_APP_ID`/`ADZUNA_APP_KEY`, `RAPIDAPI_KEY`, and `CRON_SECRET`.
3. Restart the dev server, sign in, and select **Run discovery**. Each run scores up to 20 jobs; run again until no jobs remain to score.
4. Edit `src/config/profile.ts` and `src/config/companies.ts` to adjust search and scoring.

On Vercel, `vercel.json` runs discovery daily at 03:00 UTC. Configure the required environment variables in the Vercel project. Gemini scoring is optional; without an AI key, scoring falls back to rules.

## Stage 3: contact discovery
1. Run `supabase/migrations/0003_contacts.sql` in the Supabase SQL editor.
2. Optionally configure `REOON_API_KEY` or `HUNTER_API_KEY` to verify publicly listed email addresses.
3. Select **Find contacts** on the dashboard to check up to four shortlisted companies.

Contact discovery checks company websites for publicly listed addresses, honours `robots.txt`, and does not guess email addresses. Addresses without verifier confirmation remain unverified.

## Stage 4: emails and Gmail
1. Run `supabase/migrations/0004_emails.sql` in the Supabase SQL editor.
2. In Google Cloud Console, enable the Gmail API and add the `gmail.compose` scope to the OAuth consent screen. Add `http://localhost:3000/api/gmail/callback` as an OAuth client redirect URI (and your deployed URL followed by `/api/gmail/callback`).
3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Generate a 32-byte encryption key and set its 64-character hexadecimal value as `TOKEN_ENCRYPTION_KEY` (for example: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`). Configure `CANDIDATE_NAME`, `PORTFOLIO_URL`, and `RESUME_URL`, then restart the dev server.
4. On the dashboard, select **Connect Gmail**, then **Write emails**, and review them under **Review emails**.

Refresh tokens are encrypted before storage. Emails are created as Gmail drafts and sent only after explicit approval, only to verified addresses, with one application per company and role and a daily send limit from `settings.daily_send_limit` (15 by default, resetting at midnight IST). Companies without a verified address get a copy-only email. Google OAuth apps in Testing mode may require reconnecting after the refresh token expires.
