# ── Stage 1: Install deps & build (cần build-tools để compile bcrypt) ──
FROM node:20-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate --schema=prisma/schema.prisma

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY apps ./apps
COPY libs ./libs

RUN npm run build
RUN npm run build:worker

# ── Stage 2: Production image ──
FROM node:20-slim AS production

RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy node_modules nguyên vẹn từ builder (bcrypt đã compile cho cùng distro)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist
COPY package.json ./
COPY scripts ./scripts

RUN npx prisma generate --schema=prisma/schema.prisma
# Giảm image từ ~750MB -> ~300MB, pull nhanh hơn 10-15s khi Render cold start.
# Giữ `prisma` CLI cho `prisma migrate deploy` ở CMD (prisma nằm trong devDependencies
# nên prune sẽ xóa — cài lại riêng cho production).
RUN npm prune --omit=dev && npm install prisma@5.20.0 --no-save --loglevel=error

EXPOSE 3000

# Gộp API + Worker trong 1 Web Service để vừa 750h free-tier (1x744h).
# Worker bind WORKER_PORT=3001 tránh conflict $PORT của API.
# `prisma migrate deploy` giữ ở CMD cho local docker; trên Render nên chuyển
# vào Pre-deploy Command để save 5-8s mỗi wake (xem README).
CMD ["sh", "-c", "npx prisma migrate deploy --schema=prisma/schema.prisma && node scripts/start-merged.mjs"]