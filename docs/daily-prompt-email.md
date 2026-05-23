# Daily prompt email

Gentle daily re-engagement: one Sift library prompt per day, selected by the same `selectDailyPrompt(...)` engine used in the app. Opt-in only, timezone-aware, sent via Resend on a Fly cron schedule.

## Feature flag

Off by default. Set on the server:

```bash
DAILY_PROMPT_EMAIL_ENABLED=true
```

Until this is `true`, users can save preferences but cannot enable sends (`PATCH /api/me/notifications` returns 503 when turning on).

## Required env vars

| Variable | Purpose |
|----------|---------|
| `DAILY_PROMPT_EMAIL_ENABLED` | Master switch (`true` / `false`, default `false`) |
| `RESEND_API_KEY` | Resend API key |
| `RESEND_FROM_EMAIL` | Verified sender, e.g. `Sift <prompts@siftnow.io>` |
| `APP_BASE_URL` | Deep link base, e.g. `https://app.siftnow.io` |
| `DB_PATH` | Same SQLite path as the web app (`/data/sift.db` on Fly) |

## Local development

1. Copy env vars into `.env` (never commit secrets).
2. Run the web app: `npm run dev`
3. Sign in, open **Settings** (Library or Home header) → **Daily check-in**
4. Add an email under Profile, enable daily prompts, pick hour + timezone
5. Manual batch (dry run against real DB):

```bash
DAILY_PROMPT_EMAIL_ENABLED=true RESEND_API_KEY=re_xxx npm run job:daily-prompts
```

The job logs per-user skip/send/fail reasons. Without Resend configured, sends are skipped with `RESEND_API_KEY not configured`.

## Fly cron deployment

The Docker image includes [Supercronic](https://github.com/aptible/supercronic). `fly.toml` defines two processes:

- **app** — HTTP server (`node dist/index.cjs`)
- **cron** — `supercronic /app/crontab` (every 15 minutes)

After deploy:

```bash
# One cron machine (shares the same volume mount as app)
fly scale count cron=1 --process-group cron

# Secrets
fly secrets set \
  DAILY_PROMPT_EMAIL_ENABLED=true \
  RESEND_API_KEY=re_xxx \
  RESEND_FROM_EMAIL="Sift <prompts@siftnow.io>" \
  APP_BASE_URL=https://app.siftnow.io
```

Both processes must use the same `DB_PATH` and volume so send markers persist.

## API

- `GET /api/me/notifications` — read preferences + `featureEnabled`
- `PATCH /api/me/notifications` — enable/disable, hour, timezone, `pauseForDays: 7`

## Deep links

Email CTA: `{APP_BASE_URL}/#/?dailyPrompt=1&promptId={id}`

Home preloads the prompt into the composer (no auto-submit) and shows a short “Today’s check-in” handoff.

## Safety

- Email body contains only the generated library prompt — no sift transcripts
- Requires account email on file
- Idempotent per local calendar day (`lastDailyPromptSentAt` + claim guard)
- Per-user failures do not abort the batch

## Rollout checklist

- [ ] Resend domain verified and `RESEND_FROM_EMAIL` tested
- [ ] `APP_BASE_URL` points at production hash router
- [ ] `fly scale count cron=1 --process-group cron`
- [ ] `DAILY_PROMPT_EMAIL_ENABLED=true` on Fly
- [ ] Opt in with a test account; confirm deep link + composer preload
- [ ] Check logs: `fly logs --process-group cron`
- [ ] Confirm pause-for-7-days and turn-off from Settings

## Tests

```bash
npm test
```

Covers timezone eligibility, idempotency guards, prompt selection path, and email HTML escaping.
