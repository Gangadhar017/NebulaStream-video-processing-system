FROM node:18-alpine

WORKDIR /app

# Install system dependencies (including ffmpeg and ffprobe)
RUN apk add --no-cache ffmpeg openssl

# Copy manifests
COPY package*.json tsconfig.json ./
COPY prisma ./prisma/

# Install packages
RUN npm ci

# Copy source code
COPY src ./src/

# Generate Prisma Client and Compile TypeScript
RUN npm run build

# Start the worker
CMD ["sh", "-c", "npx prisma generate && node dist/index.js"]
