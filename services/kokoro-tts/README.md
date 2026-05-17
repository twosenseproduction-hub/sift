# Self-hosted Kokoro TTS

Small **FastAPI** service around [`kokoro`](https://github.com/hexgrad/kokoro) (Apache-2.0). Run it **next to** the main Sift app—**not** inside the Node `Dockerfile`—so Fly memory/CPU stay sized for SQLite + Express.

## Run locally

```bash
cd services/kokoro-tts
python3.11 -m venv .venv
source .venv/bin/activate
# macOS: brew install espeak-ng
# Debian/Ubuntu: sudo apt-get install -y espeak-ng libsndfile1
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
export KOKORO_DEVICE=cpu
uvicorn app:app --host 127.0.0.1 --port 8888
```

Health: `GET http://127.0.0.1:8888/health`  
Synthesis: `POST http://127.0.0.1:8888/tts` with JSON body:

```json
{ "text": "Hello from Kokoro.", "voice": "af_heart", "speed": 1.0 }
```

Response: `audio/wav` (24 kHz). Voices are **American English** names from the Kokoro model card (e.g. `af_heart`, `am_adam`).

## Wire Sift to it

1. Start the service (above) or deploy it to Fly (below).
2. On the **main** Sift process, set:

   `KOKORO_TTS_URL=http://127.0.0.1:8888`

   (or your Fly/internal URL, **no trailing slash**).

3. Restart the server. Signed-in clients can call:

   `POST /api/tts/kokoro`  
   Body: `{ "text": string, "voice"?: string, "speed"?: number }`  
   Returns the same `audio/wav` stream (proxied from Kokoro).

If `KOKORO_TTS_URL` is unset, the route is **not registered** (no-op).

## Deploy on Fly.io (separate app)

1. `cd services/kokoro-tts`
2. `cp fly.toml.example fly.toml` and set a unique `app = "..."`.
3. First deploy downloads **~300MB+** of PyTorch + Kokoro weights from Hugging Face; allow a few minutes and use **2GB RAM** minimum (`fly.toml.example` uses `2048mb`).
4. Optional: set `HF_HOME` to a Fly volume if you want to cache weights across restarts.
5. Set the main Sift app secret:

   `fly secrets set KOKORO_TTS_URL=https://<your-kokoro-app>.fly.dev`

   For private machine-to-machine traffic, use Fly’s [private networking](https://fly.io/docs/reference/private-networking/) (`*.internal`) instead of public HTTPS if both apps live in the same org.

## Notes

- **Cold start**: first synthesis after idle may be slow while weights load.
- **CPU vs GPU**: `KOKORO_DEVICE` defaults to `cpu` (set to `cuda` only on GPU machines).
- **Abuse**: the Sift proxy requires **auth** and caps text length; still rate-limit at the edge if you expose Kokoro publicly.
