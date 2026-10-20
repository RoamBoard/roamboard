FROM node:24-bookworm-slim AS build

WORKDIR /workspace/backend

COPY backend/package.json backend/package-lock.json ./
RUN npm ci

COPY shared /workspace/shared
COPY backend/tsconfig.json backend/tsconfig.build.json ./
COPY backend/src ./src

RUN npm run build && npm prune --omit=dev

FROM node:24-bookworm-slim AS runner

WORKDIR /workspace/backend
ENV NODE_ENV=production
ENV PORT=3001

COPY --from=build --chown=node:node /workspace/shared /workspace/shared
COPY --from=build --chown=node:node /workspace/backend/package.json ./package.json
COPY --from=build --chown=node:node /workspace/backend/node_modules ./node_modules
COPY --from=build --chown=node:node /workspace/backend/dist ./dist

USER node
EXPOSE 3001

CMD ["node", "dist/server.js"]

