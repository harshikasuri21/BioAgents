# Stage 1: Clone the repository including submodules
FROM node:23.3.0-slim AS clone-stage
RUN apt-get update && apt-get install -y git && apt-get clean && rm -rf /var/lib/apt/lists/*
WORKDIR /repo
# Clone repository with submodules
RUN git clone --recurse-submodules https://github.com/bio-xyz/BioAgents.git .

# Stage 2: Build the application
FROM node:23.3.0-slim AS builder
RUN apt-get update && apt-get install -y \
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
    libssl-dev \
    libsecret-1-dev && \
    apt-get clean && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@9.15.4
WORKDIR /app
# Copy the repository (with submodules) from the previous stage
COPY --from=clone-stage /repo .
# Install dependencies, build the project, and prune dev dependencies
RUN pnpm install && pnpm run build && pnpm prune --prod

# Stage 3: Final runtime image
FROM node:23.3.0-slim
RUN apt-get update && apt-get install -y \
    git \
    python3 \
    ffmpeg && \
    apt-get clean && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@9.15.4
WORKDIR /app
# Copy built artifacts and the necessary files from the builder stage
COPY --from=builder /app .
# Expose required ports (adjust if needed)
EXPOSE 3000 5173
# Start your application; adjust the command according to your project's requirements
CMD ["sh", "-c", "pnpm start & pnpm start:client"]
