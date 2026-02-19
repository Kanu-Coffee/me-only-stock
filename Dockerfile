FROM node:20-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY server/package*.json ./server/
RUN npm --prefix server install
COPY server ./server
COPY --from=client-builder /app/client/dist ./public
COPY .env.example ./.env.example
EXPOSE 4000
CMD ["node", "server/index.js"]
