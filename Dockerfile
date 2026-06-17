# Use the official Bun base image (Debian-based)
FROM oven/bun:1-slim AS base

# Install system dependencies (ffmpeg is required for audio processing/resampling)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy lockfile and package configuration for all workspaces
COPY package.json bun.lock ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/

# Install dependencies for the monorepo
RUN bun install --frozen-lockfile

# Copy the rest of the application source code
COPY . .

# Run type checking to ensure everything is correct
RUN bun run typecheck

# Build the frontend assets
RUN bun run build

EXPOSE 3000

# Start the Hono backend dev server
CMD ["bun", "run", "dev:backend"]
