# ==========================================
# Stage 1: Build Client & Server (npm workspaces)
# ==========================================
FROM node:24-bookworm-slim AS builder
WORKDIR /app

# Install git and native build tools for @zebra/core git dependency and better-sqlite3/bcrypt
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    python3 \
    make \
    g++ \
    ca-certificates && \
    rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/

RUN npm ci --allow-git=all --ignore-scripts && npm rebuild better-sqlite3 bcrypt

COPY client/ ./client/
COPY server/ ./server/

RUN npm run build && npm prune --omit=dev

# ==========================================
# Stage 2: Production Image
# ==========================================
FROM node:24-bookworm-slim AS production

# Install OS dependencies for KataGo over HTTPS only
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    unzip \
    ca-certificates \
    libzip4 \
    libssl-dev && \
    ln -sf /usr/lib/x86_64-linux-gnu/libzip.so.4 /usr/lib/x86_64-linux-gnu/libzip.so.5 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /tmp
RUN wget -q https://github.com/lightvector/KataGo/releases/download/v1.15.3/katago-v1.15.3-eigen-linux-x64.zip && \
    unzip katago-v1.15.3-eigen-linux-x64.zip -d /usr/local/bin/ && \
    chmod +x /usr/local/bin/katago && \
    rm katago-v1.15.3-eigen-linux-x64.zip

WORKDIR /app

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/server/package.json ./server/package.json
COPY --from=builder /app/server/dist ./server/dist
COPY server/katago/gtp_config.cfg ./server/katago/gtp_config.cfg

RUN mkdir -p /app/server/database /app/server/katago && \
    chown -R node:node /app

USER node
WORKDIR /app/server

EXPOSE 3001

CMD ["sh", "-c", "if [ ! -f /app/server/katago/katago-model.bin.gz ]; then wget -q https://katagoarchive.org/g170/neuralnets/g170e-b10c128-s1141046784-d204142634.bin.gz -O /app/server/katago/katago-model.bin.gz; fi && node dist/index.js"]
