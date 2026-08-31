FROM node:22-alpine AS build
WORKDIR /app
COPY package.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY packages/shared packages/shared
COPY packages/template-engine packages/template-engine
RUN npm install
COPY apps/web apps/web
RUN npm run build -w packages/shared && npm run build -w packages/template-engine && npm run build -w apps/web
FROM nginx:alpine
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
