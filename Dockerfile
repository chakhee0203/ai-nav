# Stage 1: Build Client
FROM node:20-alpine AS client-builder
WORKDIR /app/client

# Copy client dependency files
COPY client/package*.json ./
RUN npm install

# Copy client source code and build
COPY client/ ./
# Force output to 'dist' directory inside /app/client, ignoring vite.config.js setting
RUN npm run build -- --outDir dist

# Stage 2: Setup Server
FROM node:20-alpine
WORKDIR /app

# Copy root dependency files (server deps are in root package.json)
COPY package*.json ./
RUN npm install --omit=dev

# Copy server source code
COPY server/ ./

# Copy built client assets to server's public directory
# server/index.js supports serving from ./public
COPY --from=client-builder /app/client/dist ./public

# Environment variables
ENV NODE_ENV=production

EXPOSE 3000
CMD ["node", "index.js"]
