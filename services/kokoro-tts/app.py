"""
Minimal HTTP wrapper around hexgrad Kokoro (Apache-2.0).
American English pipeline only (`lang_code='a'`); pick voices like `af_heart`, `am_adam`.
"""
from __future__ import annotations

import io
import os
import re
from contextlib import asynccontextmanager

import numpy as np
import soundfile as sf
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

MAX_CHARS = int(os.environ.get("KOKORO_MAX_CHARS", "2500"))
SAMPLE_RATE = 24000
_VOICE_RE = re.compile(r"^[a-z]{2}_[a-z0-9_]{1,48}$")

_pipeline = None


@asynccontextmanager
async def lifespan(_: FastAPI):
    global _pipeline
    from kokoro import KPipeline

    device = os.environ.get("KOKORO_DEVICE", "cpu")
    _pipeline = KPipeline(lang_code="a", device=device)
    yield
    _pipeline = None


app = FastAPI(title="Kokoro TTS", lifespan=lifespan)


class TtsRequest(BaseModel):
    text: str = Field(..., max_length=MAX_CHARS)
    voice: str = "af_heart"
    speed: float = Field(1.0, ge=0.5, le=1.5)


@app.get("/health")
def health():
    return {"ok": True, "model": _pipeline is not None}


@app.post("/tts")
def synthesize(req: TtsRequest):
    if _pipeline is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Empty text")
    if not _VOICE_RE.match(req.voice):
        raise HTTPException(
            status_code=400,
            detail="Invalid voice id (expected Kokoro voice name, e.g. af_heart, am_adam)",
        )

    chunks: list[np.ndarray] = []
    for result in _pipeline(text, voice=req.voice, speed=req.speed):
        audio = result.audio
        if audio is None:
            continue
        chunks.append(audio.detach().cpu().numpy().astype(np.float32).reshape(-1))

    if not chunks:
        raise HTTPException(status_code=400, detail="No audio generated")

    wav = np.concatenate(chunks)
    buf = io.BytesIO()
    sf.write(buf, wav, SAMPLE_RATE, format="WAV", subtype="PCM_16")
    buf.seek(0)
    return Response(content=buf.read(), media_type="audio/wav")
