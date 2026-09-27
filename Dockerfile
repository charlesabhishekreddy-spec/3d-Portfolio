# Multi-stage build: install → compile the client → ship only runtime deps.
#
# Storage defaults to GitHub-backed (see storage.js), so this image needs no
# volume. Set GITHUB_TOKEN, GITHUB_REPO and GITHUB_BRANCH to persist content
# and images; the /data paths below are only a local cache.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
# Must include devDependencies: the client is built in this stage and Vite is a
# devDependency. NODE_ENV is deliberately not set here for the same reason.
RUN npm ci --include=dev
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/tmp/portfolio-data \
    UPLOAD_DIR=/tmp/portfolio-uploads
# Run as the unprivileged user that the base image already provides.
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/data ./data
COPY --from=build --chown=node:node /app/server.js ./server.js
COPY --from=build --chown=node:node /app/storage.js ./storage.js
COPY --from=build --chown=node:node /app/package.json ./package.json
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
