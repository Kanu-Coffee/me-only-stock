FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY server.js ./server.js
COPY server ./server
COPY public ./public
EXPOSE 3259
CMD ["npm", "start"]
