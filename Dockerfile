FROM node:20-slim

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --production

# Copy application files
COPY . .

# Ensure the app listens on the correct interface and port
ENV PORT=8080
EXPOSE 8080

# Use npm start to follow the defined start script
CMD ["npm", "start"]
