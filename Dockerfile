FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt ./
RUN python -m pip install --no-cache-dir --upgrade pip setuptools wheel \
    && python -m pip install --no-cache-dir -r requirements.txt

COPY . .
RUN mkdir -p /data /data/uploads /data/qrcodes /data/public_uploads /data/backups

ENV ALI_BABA_HOST=0.0.0.0 \
    ALI_BABA_PORT=51847 \
    ALI_BABA_DEBUG=0 \
    ALI_BABA_DB_PATH=/data/ali_baba.db \
    ALI_BABA_UPLOAD_FOLDER=/data/uploads \
    ALI_BABA_QR_FOLDER=/data/qrcodes \
    ALI_BABA_PUBLIC_UPLOAD_FOLDER=/data/public_uploads \
    ALI_BABA_BACKUP_FOLDER=/data/backups \
    ALI_BABA_PROXY_FIX=1 \
    ALI_BABA_REQUIRE_SECURE_PASSWORD=1

EXPOSE 51847

CMD ["sh", "-c", "python init_db.py && exec gunicorn --bind \"0.0.0.0:${ALI_BABA_PORT:-51847}\" --workers \"${GUNICORN_WORKERS:-2}\" --forwarded-allow-ips='*' --access-logfile - --error-logfile - app:app"]
