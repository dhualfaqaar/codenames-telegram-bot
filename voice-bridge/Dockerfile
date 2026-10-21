FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY voice-bridge/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY public/code-games-avatar.jpg /app/cover.jpg
COPY voice-bridge/bridge.py /app/bridge.py

ENV PORT=10000
EXPOSE 10000

CMD ["python3", "-u", "/app/bridge.py"]
