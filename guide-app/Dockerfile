# ── Guide App (Customer TV Guide) Dockerfile ─────────────────────────────────
FROM node:18-alpine AS builder

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .

ARG REACT_APP_API_URL
ARG REACT_APP_GUIDE_TITLE=StreamVault TV
ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV REACT_APP_GUIDE_TITLE=$REACT_APP_GUIDE_TITLE

RUN yarn build

# ── Serve with nginx on port 3001 ─────────────────────────────────────────────
FROM nginx:alpine

COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3001
CMD ["nginx", "-g", "daemon off;"]
