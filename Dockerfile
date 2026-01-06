# Dockerfile
# Production Node.js image
FROM node:20-alpine

# Ensure production defaults
ENV NODE_ENV=production

WORKDIR /app

# Install deps (including prod-only)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy app source
COPY . .

# If you have a build step (e.g., TS/Nest/Next API), uncomment:
# RUN npm run build

# App listens on 3007
EXPOSE 3007

# Start command (must exist in package.json as "start")
CMD ["npm", "run", "start"]
