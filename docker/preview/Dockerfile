# Full-stack preview image build (shared builder). Targets: preview-backend, preview-frontend
# Build: docker compose -f docker-compose.preview.yml build

FROM node:20-bookworm AS builder

WORKDIR /workspace

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# SPA talks to /api on the same origin (nginx proxies to backend)
ENV RUNTIME_USE_SAME_ORIGIN_FOR_API=true
ENV E2E_AUTH_ENABLED=true
RUN node scripts/write-runtime-config.js http://127.0.0.1:3000

RUN npx nx run backend:build:development --skip-nx-cache
RUN npx nx run frontend:build:development --skip-nx-cache

# --- Backend: LocalStack + local HTTP server (Lambda-style router)
FROM node:20-bookworm-slim AS preview-backend

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /workspace/dist/apps/backend/ ./
RUN npm ci --omit=dev
COPY --from=builder /workspace/scripts ./scripts
COPY docker/preview/backend-entrypoint.sh /usr/local/bin/preview-backend-entrypoint.sh
RUN chmod +x /usr/local/bin/preview-backend-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/preview-backend-entrypoint.sh"]

# --- Frontend: static SPA + nginx reverse proxy to backend
FROM nginx:1.27-alpine AS preview-frontend

COPY --from=builder /workspace/dist/apps/frontend/browser /usr/share/nginx/html
COPY docker/preview/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
