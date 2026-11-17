# Multi-stage build for Astro SSR Standalone (Node 22-alpine)
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build Astro application
COPY . .
RUN npm run build

# Production runtime stage
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled standalone server and client assets from builder
COPY --from=builder /app/dist ./dist

EXPOSE 4321

CMD ["node", "dist/server/entry.mjs"]
