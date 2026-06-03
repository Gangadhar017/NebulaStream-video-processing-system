FROM node:18-alpine

WORKDIR /app

# Copy package descriptors
COPY package*.json ./

# Install packages
RUN npm ci

# Copy source and configurations
COPY . .

# Expose port
EXPOSE 3000

# Start Vite dev server in host mode
CMD ["npm", "run", "dev", "--", "--host"]
