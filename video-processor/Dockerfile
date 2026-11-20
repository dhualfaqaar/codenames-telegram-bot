FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY video-processor/server.mjs ./server.mjs
USER node
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "server.mjs"]
