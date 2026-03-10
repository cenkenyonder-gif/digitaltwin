FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Multi-stage build for a smaller, faster-starting image
FROM node:20-alpine
WORKDIR /app
# Only copy necessary files from the builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/public ./public

EXPOSE 8080
CMD ["node", "src/index.js"]

