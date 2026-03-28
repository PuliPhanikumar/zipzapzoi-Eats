FROM node:20-alpine

WORKDIR /app

# Copy backend package files first for cached dependency install
COPY backend/package*.json ./backend/

WORKDIR /app/backend
RUN npm ci --only=production

# Generate Prisma client
COPY backend/prisma ./prisma
RUN npx prisma generate

# Copy backend source
COPY backend/ .

# Copy frontend files to parent directory (backend serves from ../)
WORKDIR /app
COPY *.html ./
COPY manifest.json ./
COPY sw.js ./
COPY js/ ./js/
COPY global_sidebar.js ./

# Set working directory back to backend
WORKDIR /app/backend

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-5000}/api/health || exit 1

EXPOSE ${PORT:-5000}

# Run migrations and start server
CMD ["sh", "-c", "npx prisma migrate deploy && node index.js"]
