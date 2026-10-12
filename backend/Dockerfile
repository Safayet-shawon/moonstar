# Build context = repository root:  docker build -f backend/Dockerfile -t moonstar-api .
FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --workspace=@moonstar/backend --workspace=@moonstar/shared --include-workspace-root=false
COPY packages packages
COPY backend backend
RUN npm run build -w @moonstar/backend

FROM node:22-alpine AS prod-deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --omit=dev --workspace=@moonstar/backend --workspace=@moonstar/shared --include-workspace-root=false

FROM node:22-alpine
ENV NODE_ENV=production PORT=4000
WORKDIR /app/backend
COPY --from=prod-deps /repo/node_modules /app/node_modules
COPY --from=prod-deps /repo/backend/node_modules ./node_modules
COPY --from=build /repo/backend/dist ./dist
COPY backend/db ./db
COPY backend/assets ./assets
COPY backend/package.json ./
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:4000/api/health || exit 1
CMD ["node", "dist/server.mjs"]
