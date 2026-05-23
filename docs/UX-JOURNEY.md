# Sift UX journey map (developer-facing)

Sift is a quiet reflection tool: submit a thought → receive a structured read → return later to check in. It is not a chat product.

## File map

| Journey stage | Client | Server |
|---------------|--------|--------|
| Auth | `client/src/lib/auth.tsx`, `client/src/components/auth-dialog.tsx`, `client/src/pages/reset-passphrase.tsx` | `POST /api/auth/*` in `server/routes.ts`, `users` + `sessions` + `passphrase_reset_tokens` in `server/storage.ts` |
| First sift | `client/src/pages/home.tsx`, `client/src/components/bedroom-session/*` | `POST /api/sift`, `POST /api/sift/:id/deepen` |
| Onboarding sample | `client/src/pages/onboarding-preview.tsx`, `client/src/components/onboarding/sift-onboarding-flow.tsx` | — (local profile via `client/src/lib/sift-experience.ts`) |
| Saved result / check-in | `client/src/pages/shared.tsx`, `client/src/components/sift-ui.tsx`, `client/src/components/checkin.tsx` | `GET /api/sift/:id`, `POST /api/sift/:id/checkin` |
| History / library | `client/src/pages/library.tsx` | `GET /api/library`, `GET /api/library/:id` |
| Return path | `client/src/components/home-reentry-hint.tsx`, `client/src/components/sift-ui.tsx` (`ReEntryBlock`) | `GET /api/reentry` |

## Journey stages

### 1. Onboarding
- Signed-out user without `supportProfile.completedAt` sees `SiftOnboardingFlow` (welcome → choice → optional personalize).
- Paths: try free sifts (guest), create account, or tune support then start.
- **Preview without shipping:** `#/onboarding-preview` — same component, step picker, no auth side effects.

### 2. Activation
- User runs a sift (`POST /api/sift`), deepens in Home, requests clarity summary.
- Guest: save prompt → signup → `POST /api/guest/claim`.
- Signed-in: sift appears in Library.

### 3. Retention
- Library lists saved clarity with movement notes (left off, shifted).
- `GET /api/reentry` surfaces one quiet prompt on Home when signed in (`HomeReEntryHint`).
- Continue thread / check-in links from Library detail → `/s/:id` (shared view + `CheckinBlock`).

### 4. Recovery
- Live session snapshot: `sift.liveSession.v1` in `home.tsx`.
- Passphrase reset: `POST /api/auth/forgot-passphrase` + `POST /api/auth/reset-passphrase` (email on file required; link logged in dev).
- Crisis: `care` response, no persistence.

## Weaknesses (audit)

**Product**
- Dual result surfaces (Home conversation/summary vs `Result` on `/s/:id`) still coexist.
- Email delivery for reset is stubbed (console log in development).
- Daily prompt / garden routes exist but redirect home.

**Technical**
- Auth token: `queryClient` persists bearer token; comment in `auth.tsx` is stale.
- `SupportProfile` schema still allows legacy companion fields; UI forces base only.

## Env / ops

| Variable | Purpose |
|----------|---------|
| `SIFT_API_KEY` | Server-side Anthropic for guests |
| `ANTHROPIC_MODEL` | Main model |
| `NODE_ENV=development` | Returns `devResetUrl` on forgot-passphrase |

## Storage migration

On boot, `server/storage.ts` creates `passphrase_reset_tokens` if missing. No manual migration step.
