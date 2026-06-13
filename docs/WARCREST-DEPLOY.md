# Warcrest (exofront-game) — deploy rules

The browser RTS at **exofront.siftnow.io** is **not** part of the Sift app deploy pipeline.

## Canonical source

| What | Where |
|------|--------|
| Game repo | [`twosenseproduction-hub/warcrest`](https://github.com/twosenseproduction-hub/warcrest) |
| Local path (typical) | `../warcrest` next to `sift`, or `sift/warcrest/` if cloned inside the monorepo |
| Fly app | `exofront-game` |
| URL | https://exofront.siftnow.io |

## Deploy (only this way)

```bash
cd warcrest
./scripts/deploy.sh
```

From the sift repo root:

```bash
./scripts/deploy-warcrest.sh
```

The deploy script refuses to run unless:

- `.warcrest-root` exists (marks the canonical tree)
- `src/config.js` contains **Iron Crown** (not the stale Aurex/Crimson fork)
- `fly.toml` targets `exofront-game`

## Do not deploy from

- **`rts-game/`** — outdated fork; `fly.toml` removed on purpose
- **`sift/` repo root** — that `fly deploy` is for **Sift** (`sift-twosense`), not the game

## CI

Pushes to `main` on the **warcrest** GitHub repo run `.github/workflows/fly-deploy.yml` and deploy via the same guarded script. Add `FLY_API_TOKEN` to warcrest repo secrets.

## If production regresses

1. Confirm live config: `curl -s https://exofront.siftnow.io/src/config.js | grep "Iron Crown"`
2. Redeploy from warcrest: `./scripts/deploy.sh`
3. Roll back Fly if needed: `fly releases -a exofront-game --image` then `fly deploy --image registry.fly.io/exofront-game:<previous-tag>`
