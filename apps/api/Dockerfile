FROM node:22-alpine AS build
WORKDIR /app
COPY package.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared packages/shared
COPY packages/template-engine packages/template-engine
RUN npm install
COPY apps/api apps/api
RUN npm run build -w packages/shared && npm run build -w packages/template-engine && npm run build -w apps/api
FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/packages ./packages
CMD ["node","apps/api/dist/server.js"]
