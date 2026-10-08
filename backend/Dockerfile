FROM node:22-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN rm -f package-lock.json && npm install

COPY . .

EXPOSE 3001

CMD ["npm", "run", "dev"]
