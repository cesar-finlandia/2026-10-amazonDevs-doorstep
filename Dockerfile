# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim
ENV NODE_ENV=production PORT=8080 PYTHONUNBUFFERED=1 PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY --chown=node:node . .
RUN npx vite build --logLevel error \
 && mkdir -p logs \
 && chown -R node:node /app
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npx", "vite-node", "src/server/index.ts"]
