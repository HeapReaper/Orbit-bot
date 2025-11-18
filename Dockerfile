# Stage 1: Build locally
FROM oven/bun:latest AS builder

# Install dependencies for Prisma generation
RUN apt-get update && apt-get install -y \
    tzdata \
    openssl \
  && ln -fs /usr/share/zoneinfo/Europe/Amsterdam /etc/localtime \
  && dpkg-reconfigure --frontend noninteractive tzdata \
  && apt-get clean

WORKDIR /app

# Copy everything
COPY . .

# Install Bun dependencies
RUN bun install

# Generate Prisma client locally (this will fail if Prisma CDN is down, so do it on your machine)
# This command should already be run locally and committed: 
# bunx prisma generate

# -------------------------
# Stage 2: Production image
FROM oven/bun:latest

WORKDIR /app

# Install tzdata + openssl
RUN apt-get update && apt-get install -y \
    tzdata \
    openssl \
  && ln -fs /usr/share/zoneinfo/Europe/Amsterdam /etc/localtime \
  && dpkg-reconfigure --frontend noninteractive tzdata \
  && apt-get clean

# Copy source code
COPY . .

# Copy pre-built Prisma client from builder
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Install other Bun dependencies (skip Prisma, it's already there)
RUN bun install --no-prisma

WORKDIR /app/src

EXPOSE 3144

CMD ["bun", "run", "index.ts"]