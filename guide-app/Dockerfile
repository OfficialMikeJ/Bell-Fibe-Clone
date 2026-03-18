# ── StreamVault Guide App (Customer TV Guide) Dockerfile ────────────────────
# Stage 1: Build React app
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (layer cache)
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --network-timeout 300000

# Copy source and inject env vars at build time
COPY . .
ARG REACT_APP_API_URL
ARG REACT_APP_GUIDE_TITLE=StreamVault TV
ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV REACT_APP_GUIDE_TITLE=$REACT_APP_GUIDE_TITLE

RUN yarn build

# Stage 2: Serve with Nginx
FROM nginx:1.27-alpine

RUN rm /etc/nginx/conf.d/default.conf

COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
