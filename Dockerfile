# ── Stage 1: Install deps & build (cần build-tools để compile bcrypt) ──
FROM node:25-slim AS builder

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
FROM node:25-slim AS production

RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy node_modules nguyên vẹn từ builder (bcrypt đã compile cho cùng distro)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist

RUN npx prisma generate --schema=prisma/schema.prisma

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy --schema=prisma/schema.prisma && node dist/apps/api/main"]