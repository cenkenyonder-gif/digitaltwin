FROM node:20

WORKDIR /app

# Ensure we use production settings
ENV NODE_ENV=production
ENV PORT=8080

# Install dependencies (Standard image guarantees system libs)
COPY package*.json ./
RUN npm install --only=production

# Copy application files
COPY . .

# Expose the standard Cloud Run port
EXPOSE 8080

# Start server directly
CMD ["node", "src/index.js"]
