FROM node:22-slim

# ffmpeg is what turns a video into a real Telegram voice note (OGG/Opus).
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies (including dev deps needed for the Vite build)
COPY package*.json ./
RUN npm install --include=dev

# Copy the rest of the project and build the frontend
COPY . .
RUN npm run build

ENV NODE_ENV=production
# The platform injects PORT; server.ts falls back to 3000.
EXPOSE 3000

CMD ["npm", "start"]
