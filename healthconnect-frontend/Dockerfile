# syntax=docker/dockerfile:1

FROM node:20-alpine AS build

WORKDIR /app

# Install dependencies first to maximize Docker layer caching.
COPY package*.json ./
RUN npm ci

# Copy source and build static assets.
COPY . .

# Build-time API URL for Vite frontend.
ARG VITE_API_URL=http://backend:5000
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build

FROM node:20-alpine AS runtime

WORKDIR /app

# 'serve' provides a simple production static file server.
RUN npm install -g serve@14

COPY --from=build /app/dist ./dist

EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "3000"]