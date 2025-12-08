# Stage 1: Build Client
FROM node:20-alpine AS client-builder
WORKDIR /app/client

# Copy client dependency files
COPY client/package*.json ./
RUN npm install

# Copy client source code and build
COPY client/ ./
RUN npm run build

# Stage 2: Setup Server
FROM node:20-alpine
WORKDIR /app

# Copy server dependency files
COPY server/package*.json ./
RUN npm install --production

# Copy server source code
COPY server/ ./

# Copy built client assets to server's public directory
# server/index.js supports serving from ./public
COPY --from=client-builder /app/client/dist ./public

# Environment variables
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001
CMD ["node", "index.js"]
