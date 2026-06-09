FROM node:20-slim

# Install Python + reportlab for PDF generation
RUN apt-get update && apt-get install -y python3 python3-pip python3-venv && \
    python3 -m pip install --break-system-packages reportlab && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install
COPY package.json ./
RUN npm install --production=false

# Copy source
COPY . .

# Build frontend
RUN npm run build -- --config vite.config.ts

# Remove dev dependencies
RUN npm prune --production

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server/index.js"]
