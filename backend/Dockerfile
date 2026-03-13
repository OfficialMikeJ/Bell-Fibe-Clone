# ── Backend Dockerfile ────────────────────────────────────────────────────────
FROM python:3.11-slim

# System deps (FFmpeg for media processing)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend

# Install Python deps first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY . .

# Create upload directories
RUN mkdir -p uploads/logos uploads/media uploads/thumbnails uploads/qr_codes

EXPOSE 8001

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]
