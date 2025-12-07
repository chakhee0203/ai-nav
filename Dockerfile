# Build stage for React frontend
FROM node:20-alpine as client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app/server

# Copy server dependencies
COPY server/package*.json ./
RUN npm install --production

# Copy server code
COPY server/ ./

# Copy built frontend from previous stage
# Note: vite.config.js now outputs to ../public, so we copy from /app/public
# Copy into ./public (merging with server/public if exists)
COPY --from=client-build /app/public ./public

# Environment variables
ENV NODE_ENV=production

# Expose port (Zeabur uses this to detect port)
EXPOSE 3000

# Start server
CMD ["node", "index.js"]
