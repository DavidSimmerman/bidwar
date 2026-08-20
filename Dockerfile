# Explicit Node version. The toolchain needs ^20.19 || ^22.12 || >=24, and Nixpacks
# pinned 22.11, so the build died before it started. Pin it here instead of guessing
# what the builder provides.
FROM node:24-slim AS build
WORKDIR /app
RUN npm install -g pnpm@11.6.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# Runtime carries only production deps: adapter-node leaves them external.
FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000
RUN npm install -g pnpm@11.6.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod && pnpm store prune

COPY --from=build /app/build ./build
# Migrations are applied on boot, so the SQL has to ship with the image.
COPY --from=build /app/drizzle ./drizzle

EXPOSE 3000
CMD ["node", "build"]
