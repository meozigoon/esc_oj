FROM node:18-bullseye AS builder
WORKDIR /app
COPY package.json ./
COPY package-lock.json ./
COPY server/package.json server/
COPY worker/package.json worker/
COPY client/package.json client/
COPY prisma prisma
RUN npm install
COPY server server
RUN npm run build -w server

FROM node:18-bullseye
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/server/dist /app/server/dist
COPY server/package.json /app/server/package.json
COPY prisma /app/prisma
EXPOSE 3000
CMD ["node", "server/dist/index.js"]
