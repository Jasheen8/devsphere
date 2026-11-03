FROM node:22-alpine AS build
WORKDIR /app
# Prisma Client generation needs datasource env values, but image builds must
# never receive or bake in production credentials.
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build DIRECT_URL=postgresql://build:build@127.0.0.1:5432/build
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/api/prisma/schema.prisma apps/api/prisma/schema.prisma
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/template-engine/package.json packages/template-engine/package.json
COPY packages/shared packages/shared
COPY packages/template-engine packages/template-engine
RUN npm ci
COPY apps/api apps/api
RUN npm run prisma:generate -w apps/api && npm run build -w packages/shared && npm run build -w packages/template-engine && npm run build -w apps/api
RUN npm prune --omit=dev
FROM node:22-alpine
WORKDIR /app
ARG RENDER_GIT_COMMIT=unknown
ENV BUILD_GIT_SHA=$RENDER_GIT_COMMIT
LABEL org.opencontainers.image.revision=$RENDER_GIT_COMMIT
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/packages ./packages
CMD ["node","apps/api/dist/server.js"]
