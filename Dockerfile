# syntax=docker/dockerfile:1
# Bubble Breaker image (06-deployment "Image"): builds the app from source, then serves it with
# unprivileged nginx on port 8080. Base images are pinned by digest; Dependabot bumps them.

FROM node:24-alpine@sha256:a34ab6d7f6f4813f4d0c5469d74685604b962fbdbf5793a7bc7b4998ecb867c8 AS build
WORKDIR /app
# No git hooks inside the image.
ENV HUSKY=0
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:stable-alpine-slim@sha256:5d8bb9437d74a600ec5dbf90c035451c724dc33eac8d3a71078f6f8612c345f6 AS runtime
USER root
RUN rm -rf /usr/share/nginx/html/*
USER 101
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/bubble-breaker/browser /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --start-interval=2s \
  CMD wget -qO- http://127.0.0.1:8080/health || exit 1
