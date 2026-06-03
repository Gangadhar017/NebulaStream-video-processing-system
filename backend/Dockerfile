FROM node:18-alpine

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache openssl

# Copy manifests
COPY package*.json tsconfig.json ./
COPY prisma ./prisma/

# Install packages
RUN npm ci

# Copy source code
COPY src ./src/

# Generate Prisma Client and Compile TypeScript
RUN npm run build

# Expose API Port
EXPOSE 5000

# Run migrations and start the server
CMD ["sh", "-c", "npx prisma db push && node dist/server.js"]
