FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app ./
RUN npm ci --omit=dev
EXPOSE 8080
CMD ["node","src/index.js"]
