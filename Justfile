# ─── project-minato Justfile ─────────────────────────────────────────────────
# Requirements: just, bun, docker (buildx), docker compose

image   := "gergogyulai/minato"
tag_dev := "dev"

# ─── default ─────────────────────────────────────────────────────────────────

# List available recipes
default:
    @just --list

# ─── development ─────────────────────────────────────────────────────────────

# Start all dev services (infra + turbo dev)
dev: infra-up
    bun run dev

# Start only the web app
dev-web:
    bun turbo dev --filter=web

# Start only the server
dev-server:
    bun turbo dev --filter=@project-minato/api

# Start only the jobs worker
dev-jobs:
    bun turbo dev --filter=@project-minato/jobs

# ─── build ───────────────────────────────────────────────────────────────────

# Build all apps via turborepo
build:
    bun run build

# Type-check all packages
check-types:
    bun run check-types

# Run biome formatter/linter with auto-fix
lint:
    bun run check

# ─── database ────────────────────────────────────────────────────────────────

# Push schema changes to the database (no migration file)
db-push:
    bun run db:push

# Open Drizzle Studio
db-studio:
    bun run db:studio

# Generate migration files from schema changes
db-generate:
    bun run db:generate

# Run pending migrations against the database
db-migrate:
    bun run db:migrate

# ─── infrastructure (dev compose) ────────────────────────────────────────────

# Start dev infrastructure (postgres, redis, meilisearch, flaresolverr)
infra-up:
    docker compose -f docker-compose.dev.yaml up -d

# Stop dev infrastructure
infra-down:
    docker compose -f docker-compose.dev.yaml down

# Tail logs from dev infrastructure
infra-logs:
    docker compose -f docker-compose.dev.yaml logs -f

# ─── production stack ────────────────────────────────────────────────────────

# Start the full production stack locally
stack-up:
    docker compose -f docker-compose.yaml up -d

# Stop the production stack
stack-down:
    docker compose -f docker-compose.yaml down

# Start the debug stack
debug-up:
    docker compose -f docker-compose.debug.yaml up -d

# Stop the debug stack
debug-down:
    docker compose -f docker-compose.debug.yaml down

# ─── docker image ────────────────────────────────────────────────────────────

# Build dev image for the current platform (no push)
docker-build:
    docker build -t {{image}}:{{tag_dev}} .

# Build multi-arch dev image and push to registry
docker-push:
    docker buildx build \
        --platform linux/amd64,linux/arm64 \
        -t {{image}}:{{tag_dev}} \
        --push .

# Build multi-arch release image tagged :latest and push
docker-release version="latest":
    docker buildx build \
        --platform linux/amd64,linux/arm64 \
        -t {{image}}:{{version}} \
        -t {{image}}:latest \
        --push .

# Build multi-arch release image with a specific semver tag and push
docker-release-tag version:
    docker buildx build \
        --platform linux/amd64,linux/arm64 \
        -t {{image}}:{{version}} \
        --push .

# Pull the latest dev image
docker-pull:
    docker pull {{image}}:{{tag_dev}}

# ─── cleanup ─────────────────────────────────────────────────────────────────

# Remove all build artifacts (dist/, .turbo/, next build output)
clean:
    rm -rf apps/*/dist packages/*/dist apps/*/.next .turbo

# Remove node_modules across the entire monorepo
clean-modules:
    rm -rf node_modules packages/*/node_modules apps/*/node_modules

# Remove everything: node_modules, build artifacts, lockfile — then reinstall
nuke: clean clean-modules
    rm -f bun.lock
    bun install

# Remove dangling docker images/containers for this project
docker-clean:
    docker image prune -f
    docker container prune -f
