import type { Express, NextFunction, Request, Response } from "express";

const KOKORO_URL = process.env.KOKORO_TTS_URL?.replace(/\/$/, "");
const MAX_CHARS = 2500;
const VOICE_RE = /^[a-z]{2}_[a-z0-9_]{1,48}$/;

/**
 * Proxies signed-in clients to a self-hosted Kokoro HTTP service.
 * Set `KOKORO_TTS_URL` (e.g. `http://127.0.0.1:8888` or `https://your-kokoro.fly.dev`)
 * to enable `POST /api/tts/kokoro`.
 */
export function registerKokoroTtsProxy(
  app: Express,
  requireAuth: (req: Request, res: Response, next: NextFunction) => void,
): void {
  if (!KOKORO_URL) return;

  app.post("/api/tts/kokoro", requireAuth, async (req, res) => {
    const raw = req.body as {
      text?: unknown;
      voice?: unknown;
      speed?: unknown;
    };
    const text = typeof raw.text === "string" ? raw.text.trim() : "";
    if (!text) {
      return res.status(400).json({ error: "text is required" });
    }
    if (text.length > MAX_CHARS) {
      return res.status(400).json({ error: `text exceeds ${MAX_CHARS} characters` });
    }

    const voice = typeof raw.voice === "string" && raw.voice ? raw.voice : "af_heart";
    if (!VOICE_RE.test(voice)) {
      return res.status(400).json({ error: "Invalid voice id" });
    }
    const speed =
      typeof raw.speed === "number" && Number.isFinite(raw.speed) ? raw.speed : 1;

    try {
      const upstream = await fetch(`${KOKORO_URL}/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice, speed }),
      });
      if (!upstream.ok) {
        const detail = (await upstream.text()).slice(0, 400);
        return res
          .status(502)
          .json({ error: "Kokoro upstream error", detail });
      }
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.setHeader("Content-Type", "audio/wav");
      res.setHeader("Cache-Control", "no-store");
      res.send(buf);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(502).json({ error: "Could not reach Kokoro TTS", detail: msg });
    }
  });
}
