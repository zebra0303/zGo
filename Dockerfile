# ==========================================
# Stage 1: Build Client (React/Vite)
# ==========================================
FROM node:24-bookworm-slim AS client-builder
WORKDIR /app/client

# Copy package files
COPY client/package*.json ./
# For workspaces or monorepos, copy root package.json if needed
COPY package*.json /app/

# Install dependencies
RUN npm install

# Copy source code and build
COPY client/ ./
RUN npm run build

# ==========================================
# Stage 2: Build Server (Node/Express)
# ==========================================
FROM node:24-bookworm-slim AS server-builder
WORKDIR /app/server

# Copy package files
COPY server/package*.json ./
COPY package*.json /app/

# Install dependencies
RUN npm install

# Copy source code and build
COPY server/ ./
RUN npm run build

# ==========================================
# Stage 3: Production Image
# ==========================================
FROM node:24-bookworm-slim AS production

# Install OS dependencies for KataGo and general utilities
RUN apt-get update && apt-get install -y \
    wget \
    unzip \
    libzip4 \
    && rm -rf /var/lib/apt/lists/*

# Download and install KataGo (Eigen Linux version - CPU only, universally compatible)
# We place the executable in /usr/local/bin so it's available in PATH
WORKDIR /tmp
RUN wget https://github.com/lightvector/KataGo/releases/download/v1.15.3/katago-v1.15.3-eigen-linux-x64.zip && \
    unzip katago-v1.15.3-eigen-linux-x64.zip -d /usr/local/bin/ && \
    chmod +x /usr/local/bin/katago && \
    rm katago-v1.15.3-eigen-linux-x64.zip

# Set up the application directory
WORKDIR /app

# Copy built client
COPY --from=client-builder /app/client/dist ./client/dist

# Copy built server and node_modules
# We copy package.json and node_modules to run the production server
WORKDIR /app/server
COPY --from=server-builder /app/server/package*.json ./
COPY --from=server-builder /app/server/node_modules ./node_modules
COPY --from=server-builder /app/server/dist ./dist

# Create directories that will be mounted to ensure proper permissions
RUN mkdir -p /app/server/database /app/server/katago

# Expose the server port
EXPOSE 3001

# Command to run the server. Downloads the model if it doesn't exist in the mounted volume.
CMD ["sh", "-c", "if [ ! -f /app/server/katago/katago-model.bin.gz ]; then wget https://katagoarchive.org/g170/neuralnets/g170e-b10c128-s1141046784-d204142634.bin.gz -O /app/server/katago/katago-model.bin.gz; fi && npm start"]
