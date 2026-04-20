# Multi-stage build for production
FROM node:18-alpine AS backend-builder

WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --only=production

COPY backend/ ./
RUN npm run build

FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

FROM node:18-alpine AS production

WORKDIR /app

# Copy backend files
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY --from=backend-builder /app/backend/node_modules ./backend/node_modules
COPY --from=backend-builder /app/backend/package.json ./backend/package.json

# Copy frontend files
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Copy shared files and root files
COPY shared/ ./shared/
COPY package.json ./
COPY README.md ./

# Install production dependencies for backend
WORKDIR /app/backend
RUN npm ci --only=production && npm cache clean --force

# Expose port
EXPOSE 3001

# Start the application
CMD ["npm", "start", "--prefix", "backend"]