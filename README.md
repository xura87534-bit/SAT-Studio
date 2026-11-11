# SAT Studio

Adaptive SAT practice: Bluebook-style two-module tests with IRT scoring, a graphing calculator, a word bank, progress tracking, a Claude tutor, and a Students page for teachers.

It ships in two forms:

- **Web app (PWA)**: hosted on Vercel. In Chrome, open the site and click **Install** in the address bar to get a desktop app with its own icon and window. It also works on phones and offline.
- **Chrome extension** (`extension/`): a toolbar button that opens the app in its own window.

## How it fits together

| Piece | Where | What it does |
|---|---|---|
| App | `public/index.html` | The original SAT Studio app, almost unchanged |
| Platform layer | `public/platform.js` | Provides the `window.claude.use()` features the app expects (`user`, `db`, `sample`), using Supabase and our API |
| Claude function | `api/claude.js` | Checks the user's sign-in and daily allowance, then streams the Claude reply |
| Database | `supabase/schema.sql` | Tables and row-level security: students see only their own data, admins see the student summaries |
| Offline | `public/sw.js` | Caches the app so it opens without a connection. Progress saves locally and syncs when back online |

If Supabase isn't configured, or a student picks **Use offline on this device**, the app runs entirely in the browser, as the downloaded copy did before.

## Setup (about 20 minutes)

### 1. Supabase (logins and database)

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query**: paste `supabase/schema.sql` and run it.
3. Make yourself an admin so the Students page appears. Run this with your own email:
   ```sql
   insert into public.admins (email) values ('you@example.com');
   ```
4. **Authentication → Providers**:
   - **Email** is on by default, which enables magic links.
   - **Google**: turn it on and paste a Client ID and Secret from Google Cloud Console (APIs & Services → Credentials → OAuth client ID → Web application). Add `https://YOUR-PROJECT.supabase.co/auth/v1/callback` as an authorized redirect URI.
5. **Authentication → URL Configuration**: set **Site URL** to your Vercel address (for example `https://sat-studio.vercel.app`) and add the same address to **Redirect URLs**.
6. **Project Settings → API**: copy the **Project URL** and the **anon public** key for step 2.

### 2. Vercel (hosting and the Claude function)

1. Import this GitHub repo at [vercel.com/new](https://vercel.com/new). Leave the framework set to **Other**, since `vercel.json` handles the build.
2. Add these environment variables (see `.env.example`):
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY` from step 1.6
   - Optional: `ANTHROPIC_API_KEY` from [console.anthropic.com](https://console.anthropic.com). This needs prepaid API credits. Without it, the app works fully except the Claude tutor, question generation and Claude feedback, which stay hidden. Add the key later and redeploy to turn them on.
   - Optional: `CLAUDE_MODEL` (default `claude-opus-5-5`) and `DAILY_AI_LIMIT` (default 150 Claude requests per student per day)
3. Deploy. Visit the site and sign in. The sidebar says **Claude connected** if you added an API key, or **Built-in questions** if not.

### 3. Chrome extension (optional)

1. In `extension/background.js`, set `APP_URL` to your Vercel address.
2. To try it: open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and choose the `extension` folder.
3. To publish: zip the `extension` folder and upload it in the [Chrome Web Store developer dashboard](https://chrome.google.com/webstore/devconsole). There's a one-time $5 developer fee.

## Billing (SAT Studio Pro)

Students pay by card transfer (Payme, Click, Uzum or any bank app), press **I've paid**, and you approve the payment on the **Students** page. No merchant account is needed.

| Piece | Where | What it does |
|---|---|---|
| Prices and free limits | `public/plans.js` | The one place to change a price or a limit |
| Billing page, paywalls, admin panel | `public/billing.js` | Go Pro page, lock badges, payment sheet, Payments panel on Students |
| Plans and payments | `supabase/billing-2026-11.sql` | Who has Pro and until when; payment requests; Claude allowance by plan |

To switch it on:

1. Supabase **SQL Editor**: paste `supabase/billing-2026-11.sql` and run it.
2. Vercel environment variables:
   - `PAY_CARD` (the card students transfer to) and `PAY_NAME` (the cardholder name banks show)
   - `PAY_TELEGRAM` (username that receives receipts); optional `PAY_LINK` (a Payme or Click payment link)
   - Optional: `FREE_DAILY_AI_LIMIT` (default 10), `CLAUDE_MODEL_FREE` and `CLAUDE_MODEL_PRO` (default: `CLAUDE_MODEL` for both)
3. Sign in as an admin and open **Go Pro**: the launch checklist shows what is still missing. Only admins see the page at this stage.
4. Set `BILLING=on` and redeploy. Free limits, the Go Pro page and the pricing section on `/welcome` are now live for students.

Each day, check **Students → Payments**, match each request to a transfer in your bank app, and press **Approve**. To give Pro without a request (cash, a prize), use **Give Pro days** on the same panel.

Built-in tests and drills are limited in the browser, so a determined student can get around those limits. The Claude allowance is enforced on the server.

## Costs

- **Supabase and Vercel**: the free tiers cover a class-sized group.
- **Claude**: billed to your Anthropic account per use. Question generation and feedback cost the most. Use `DAILY_AI_LIMIT` to cap each student, and set a monthly spend limit in the Anthropic Console. For a cheaper model, set `CLAUDE_MODEL` to `claude-sonnet-5-5` or `claude-haiku-5-5`.

## Updating the app

`public/index.html` is the app itself, so edit it and push. Vercel redeploys automatically, and installed apps pick up the new version the next time they open.
