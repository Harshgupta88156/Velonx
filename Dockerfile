FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 DATABASE_PATH=/app/data/velonx.db DEMO_MODE=true
WORKDIR /app
RUN groupadd --gid 1001 velonx && useradd --uid 1001 --gid velonx velonx && mkdir data && chown velonx:velonx data
COPY --from=build --chown=velonx:velonx /app/.next/standalone ./
COPY --from=build --chown=velonx:velonx /app/.next/static ./.next/static
COPY --from=build --chown=velonx:velonx /app/public ./public
USER velonx
EXPOSE 3000
CMD ["node", "server.js"]
