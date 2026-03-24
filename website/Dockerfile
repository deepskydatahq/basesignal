# Build stage
FROM node:20-alpine AS build
WORKDIR /app

# Install deps
COPY package.json package-lock.json ./
RUN npm ci

# Copy source
COPY . .

# Build static site
RUN npm run build

# Production stage
FROM nginx:alpine AS production

# Copy built static files
COPY --from=build /app/dist /usr/share/nginx/html

# Nginx config for SPA-style routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Run as non-root
RUN chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx /var/log/nginx /etc/nginx/conf.d
USER nginx

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
