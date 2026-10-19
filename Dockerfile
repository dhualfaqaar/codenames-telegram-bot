FROM node:22-slim

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
