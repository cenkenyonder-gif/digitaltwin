FROM node:24

WORKDIR /app

# Install dependencies (on the target architecture)
COPY package*.json ./
RUN npm install

# Copy application files
COPY . .

# Set clear environment variables
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# Run Node directly for maximum visibility
CMD ["node", "src/index.js"]
