FROM node:20-slim

WORKDIR /app

# Copy dependency files first
COPY package*.json ./
COPY .npmrc* ./

# Install production dependencies
RUN npm install --legacy-peer-deps --omit=dev

# Copy application files
COPY . .

# Environment variables
ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

# Start bot script
CMD ["node", "index.js"]
