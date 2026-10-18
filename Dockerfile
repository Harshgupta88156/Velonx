FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 DATABASE_PATH=/app/data/districtcare.db DEMO_MODE=true
WORKDIR /app
RUN groupadd --gid 1001 districtcare && useradd --uid 1001 --gid districtcare districtcare && mkdir data && chown districtcare:districtcare data
COPY --from=build --chown=districtcare:districtcare /app/.next/standalone ./
COPY --from=build --chown=districtcare:districtcare /app/.next/static ./.next/static
COPY --from=build --chown=districtcare:districtcare /app/public ./public
USER districtcare
EXPOSE 3000
CMD ["node", "server.js"]
