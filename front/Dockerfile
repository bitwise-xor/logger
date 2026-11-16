# The new front end (logger.): a small SvelteKit server (adapter-node) that calls the core's JSON door.
# Built on the same pinned Node image as the hub and tools/front-pnpm (one copy on disk). Bump version and digest together.
ARG NODE_IMAGE=node:24.22.2-slim@sha256:c86ecead9e55a5210ac1727de38a4ca840bf03dcaf34dc9749addbf383b1920c

FROM ${NODE_IMAGE} AS build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /front
# Dependencies first, so source changes reuse the installed layer.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# Every package is a devDependency, so the build bundles them all: the image needs no node_modules.
RUN pnpm build && chmod -R a+rX build

FROM ${NODE_IMAGE}
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0
WORKDIR /app
COPY --from=build /front/build ./build
COPY --from=build /front/package.json ./
USER node
EXPOSE 3000
CMD ["node", "build"]
