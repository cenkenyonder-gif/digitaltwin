FROM node:20-slim

WORKDIR /app

# Ensure we use production settings
ENV NODE_ENV=production
ENV PORT=8080

# Install dependencies in the Linux environment
COPY package*.json ./
RUN npm install --only=production

# Copy application code
COPY . .

# Expose the standard Cloud Run port
EXPOSE 8080

# Start node directly
CMD ["node", "src/index.js"]
