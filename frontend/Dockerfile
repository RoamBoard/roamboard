FROM node:24-bookworm-slim AS build

RUN corepack enable

WORKDIR /workspace/frontend

COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY shared /workspace/shared
COPY frontend ./

ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=""
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm build

FROM node:24-bookworm-slim AS runner

WORKDIR /workspace
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=build --chown=node:node /workspace/frontend/.next/standalone ./
COPY --from=build --chown=node:node /workspace/frontend/.next/static ./frontend/.next/static
COPY --from=build --chown=node:node /workspace/frontend/public ./frontend/public

USER node
EXPOSE 3000

CMD ["node", "frontend/server.js"]

