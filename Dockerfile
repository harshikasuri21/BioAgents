FROM node:23.3.0-slim AS base

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
    graphicsmagick && \
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
FROM node:23.3.0-slim AS production
WORKDIR /app

RUN npm install -g pnpm@9.15.4 && \
    apt-get update && \
    apt-get install -y \
    git \
    python3 \
    ffmpeg \
    ghostscript \
    graphicsmagick && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY package.json ./
RUN pnpm install --prod 

# Copy built assets
COPY --from=builder /app/dist ./dist

# Set environment variables
ENV NODE_ENV=production

# Expose port
EXPOSE 3000

# Start the application
CMD ["pnpm", "start"]
