# The production image. compose.prod.yml builds two targets from it: `migrate`,
# which applies the migrations and exits, and `app`, which runs the site.

FROM docker.io/library/node:24-bookworm-slim AS base
RUN npm install --global pnpm@11.28.5
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# drizzle-kit is a dev dependency, so migrations run from the build stage,
# which still has it. NODE_ENV=production keeps drizzle.config.ts from looking
# for .env.local.
FROM build AS migrate
ENV NODE_ENV=production
CMD ["pnpm", "db:migrate"]

# Nitro bundles what the server needs into .output, so the site runs without
# node_modules or the source.
FROM docker.io/library/node:24-bookworm-slim AS app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /app/.output ./.output
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
