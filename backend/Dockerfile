# ── StreamVault Backend Dockerfile ──────────────────────────────────────────
FROM python:3.11-slim

# Install system dependencies
# - ffmpeg: media processing and transcoding
# - curl: used by Docker health check
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend

# Install Python dependencies (separate layer for Docker cache efficiency)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY . .

# Pre-create all upload subdirectories so the app starts cleanly
RUN mkdir -p \
    uploads/media \
    uploads/posters \
    uploads/logos \
    uploads/qr_codes \
    uploads/branding \
    uploads/notifications \
    uploads/cvr \
    uploads/apk \
    uploads/thumbnails

EXPOSE 8001

# 2 workers for production — adjust based on your server's CPU count (2 x CPUs + 1)
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "2"]
