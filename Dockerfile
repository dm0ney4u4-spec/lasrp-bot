FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run db:generate && npm run build
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DEMO_MODE=false DATABASE_MODE=postgres
RUN mkdir -p /app/data && chown -R node:node /app/data
USER node
EXPOSE 3000
CMD ["npm", "start"]
