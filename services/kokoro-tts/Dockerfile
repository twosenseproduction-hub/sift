# Kokoro-82M + PyTorch CPU. Deploy as its own Fly app (2GB+ RAM recommended).
FROM python:3.11-slim-bookworm

RUN apt-get update \
  && apt-get install -y --no-install-recommends espeak-ng libsndfile1 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
  && pip install --no-cache-dir -r requirements.txt

COPY app.py .

ENV KOKORO_DEVICE=cpu
EXPOSE 8888

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8888"]
