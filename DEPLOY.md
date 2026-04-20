# Deploying Sift to a live public URL

This guide gets Sift running on the open internet at a `*.fly.dev` subdomain in
about 10 minutes. You only need Fly.io and an Anthropic API key.

## One-time setup

### 1. Get an Anthropic API key

1. Go to https://console.anthropic.com
2. Sign in → API Keys → Create Key
3. Copy the key (starts with `sk-ant-`)
4. Add at least $5 of credits under Billing — usage per sift is a fraction of a cent

### 2. Install the Fly CLI + create an account

```bash
# macOS
brew install flyctl

# or the curl installer (any OS)
curl -L https://fly.io/install.sh | sh
```

Then:

```bash
fly auth signup    # or: fly auth login  if you already have an account
```

Fly asks for a credit card, but small apps like this cost $0–$2/month on
their free allowances.

## Deploy

From the `sift/` directory:

```bash
# 1. Create the app (reads fly.toml). If the name is taken, pick another:
fly launch --copy-config --no-deploy --name sift-twosense --region sjc

# 2. Create the persistent volume for the SQLite database (1 GB is plenty):
fly volumes create sift_data --region sjc --size 1 --yes

# 3. Set your Anthropic API key as a secret (never commit this):
fly secrets set ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxx

# 4. Deploy!
fly deploy
```

After a few minutes you'll see:

```
Visit your newly deployed app at https://sift-twosense.fly.dev/
```

Open that URL — anyone on the internet can now use your Sift.

## Updating the app

Any time you change the code:

```bash
fly deploy
```

It rebuilds the Docker image on Fly's remote builder and rolls the machine.
The SQLite database on the `/data` volume survives across deploys.

## Rotating the Anthropic key

```bash
fly secrets set ANTHROPIC_API_KEY=sk-ant-new-key-here
```

Fly automatically restarts the app with the new secret.

## Logs / debugging

```bash
fly logs              # tail logs
fly status            # machine health
fly ssh console       # shell into the running container (use: sqlite3 /data/sift.db to inspect)
```

## Custom domain (optional)

Once your `*.fly.dev` URL works, adding `sift.yourname.com` is a 2-minute task:

```bash
fly certs add sift.yourname.com
# Follow the DNS instructions Fly prints (add a CNAME or A record)
```

## Environment variables the app reads

| Variable            | Default                        | Purpose                                                      |
| ------------------- | ------------------------------ | ------------------------------------------------------------ |
| `ANTHROPIC_API_KEY` | —                              | **Required.** Anthropic API key for Claude.                  |
| `ANTHROPIC_MODEL`   | `claude-sonnet-4-5-20250929`   | Override if you want a different Claude variant.             |
| `DB_PATH`           | `./data.db`                    | Where the SQLite file lives. Fly sets this to `/data/sift.db`.|
| `PORT`              | `5000` (dev) / `8080` (docker) | Server port. Fly maps this to 443 externally.                |
