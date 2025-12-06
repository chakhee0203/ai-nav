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
COPY --from=client-build /app/client/dist ../client/dist

# Environment variables
ENV NODE_ENV=production
ENV PORT=7860
# 7860 is the default port for Hugging Face Spaces

# Expose port
EXPOSE 7860

# Start server
CMD ["node", "index.js"]
