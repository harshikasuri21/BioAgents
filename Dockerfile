FROM node:20.11.0-slim AS base

# Install pnpm and essential packages
RUN npm install -g pnpm@9.15.4 && \
    apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y \
    git \
    python3 \
    python3-pip \
    curl \
    node-gyp \
    ffmpeg \
    libtool-bin \
    autoconf \
    automake \
    libopus-dev \
    make \
    g++ \
    build-essential \
    libcairo2-dev \
    libjpeg-dev \
    libpango1.0-dev \
    libgif-dev \
    openssl \
    libssl-dev libsecret-1-dev \
    ghostscript \
    graphicsmagick \
    libxml2-dev && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN pnpm install 

# Copy source code
COPY . .

# Build stage
FROM base AS builder

RUN pnpm build

# Production stage
FROM node:20.11.0-slim AS production
WORKDIR /app

RUN npm install -g pnpm@9.15.4 && \
    apt-get update && \
    apt-get install -y \
    git \
    python3 \
    ffmpeg \
    ghostscript \
    graphicsmagick \
    make \
    g++ \
    build-essential \
    libxml2-dev && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy package files and install dependencies
COPY package.json ./
RUN pnpm install --verbose && pnpm add uuid

# Copy built assets
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Copy database migrations and schemas
COPY drizzle ./drizzle
COPY src/db/schemas ./src/db/schemas
COPY drizzle.config.ts ./
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Set environment variables
ENV NODE_ENV=production

# Expose port
EXPOSE 3000

# Start the application
ENTRYPOINT ["./docker-entrypoint.sh"]
