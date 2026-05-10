FROM node:24-alpine AS base
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy source
COPY src/ ./src/

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "src/server.js"]
