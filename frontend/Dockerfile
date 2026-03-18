# ── StreamVault Frontend (Admin Dashboard) Dockerfile ───────────────────────
# Stage 1: Build React app
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (layer cache — only re-runs when package files change)
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --network-timeout 300000

# Copy source and inject backend URL at build time
COPY . .
ARG REACT_APP_BACKEND_URL
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL

RUN yarn build

# Stage 2: Serve with Nginx
FROM nginx:1.27-alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
