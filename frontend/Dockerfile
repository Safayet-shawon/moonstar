# Build context = repository root:  docker build -f frontend/Dockerfile -t moonstar-web .
FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --workspace=@moonstar/frontend --workspace=@moonstar/shared --include-workspace-root=false
COPY packages packages
COPY frontend frontend
# rewrites() are compiled in at build time: point them at the API service name
ARG BACKEND_URL=http://backend:4000
ARG NEXT_PUBLIC_SITE_URL=https://www.moonstarpower.com
ENV BACKEND_URL=$BACKEND_URL NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL NEXT_TELEMETRY_DISABLED=1
RUN npm run build -w @moonstar/frontend

FROM node:22-alpine
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=build /repo/frontend/.next/standalone ./
COPY --from=build /repo/frontend/.next/static ./frontend/.next/static
COPY --from=build /repo/frontend/public ./frontend/public
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app
EXPOSE 3000
CMD ["node", "frontend/server.js"]
