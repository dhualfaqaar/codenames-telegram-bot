FROM node:22-slim

WORKDIR /app

# Install dependencies (including dev deps needed for the Vite build)
COPY package*.json ./
RUN npm install --include=dev

# Copy the rest of the project and build the frontend
COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=7860
EXPOSE 7860

CMD ["npm", "start"]
