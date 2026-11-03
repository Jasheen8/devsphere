FROM node:22-alpine AS build
WORKDIR /app
ARG RENDER_GIT_COMMIT=unknown
ARG VITE_API_URL=http://localhost:4000/api
ENV RENDER_GIT_COMMIT=$RENDER_GIT_COMMIT
ENV VITE_API_URL=$VITE_API_URL
# Workspace install may run Prisma Client's postinstall. Use build-only local
# placeholders so no production database credentials are needed by the image.
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
COPY apps/web apps/web
RUN npm run build -w packages/shared && npm run build -w packages/template-engine && npm run build -w apps/web
RUN node -e 'const fs = require("node:fs"); const raw = process.env.RENDER_GIT_COMMIT || ""; const gitSha = /^[a-f0-9]{7,40}$/i.test(raw) ? raw.toLowerCase() : "unknown"; fs.writeFileSync("apps/web/dist/version.json", JSON.stringify({ service: "devsphere-web", gitSha }) + "\n");'
FROM nginx:alpine
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
ARG RENDER_GIT_COMMIT=unknown
LABEL org.opencontainers.image.revision=$RENDER_GIT_COMMIT
EXPOSE 80
