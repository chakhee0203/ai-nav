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
COPY --from=client-build /app/public /app/public

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "index.js"]
