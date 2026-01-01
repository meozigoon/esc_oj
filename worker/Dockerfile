FROM node:18-bullseye AS builder
WORKDIR /app
COPY package.json ./
COPY package-lock.json ./
COPY server/package.json server/
COPY worker/package.json worker/
COPY client/package.json client/
COPY prisma prisma
RUN npm install
COPY worker worker
RUN npm run build -w worker

FROM node:18-bullseye
WORKDIR /app
RUN apt-get update \
  && apt-get install -y ca-certificates curl gnupg \
  && install -m 0755 -d /etc/apt/keyrings \
  && curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
  && chmod a+r /etc/apt/keyrings/docker.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian bullseye stable" > /etc/apt/sources.list.d/docker.list \
  && apt-get update \
  && apt-get install -y docker-ce-cli \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/worker/dist /app/worker/dist
COPY worker/package.json /app/worker/package.json
COPY prisma /app/prisma
CMD ["node", "worker/dist/index.js"]
