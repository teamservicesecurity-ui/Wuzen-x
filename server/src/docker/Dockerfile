# ==========================================
# Stage 1: Build & Dependencies Setup
# ==========================================
FROM node:20-slim AS builder

WORKDIR /app/server

# Copy package manifests
COPY server/package*.json ./

# Install production dependencies (uses npm install to avoid missing package-lock errors)
RUN npm install --omit=dev

# Copy server application source code
COPY server/ ./

# ==========================================
# Stage 2: Final Production Environment
# ==========================================
FROM node:20-slim

# 1. Install Java 17 and core build utilities for APK preflight checks
RUN apt-get update && apt-get install -y --no-install-recommends \
    openjdk-17-jdk-headless \
    zip unzip wget ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# 2. Configure Android SDK environment variables
ENV ANDROID_HOME=/opt/android-sdk
ENV PATH="${ANDROID_HOME}/build-tools/34.0.0:${PATH}"

# 3. Download and reliably structure Android SDK Build-Tools 34.0.0
RUN mkdir -p ${ANDROID_HOME}/build-tools/34.0.0 \
    && wget -q https://dl.google.com/android/repository/build-tools_r34-linux.zip -O /tmp/build-tools.zip \
    && unzip -q /tmp/build-tools.zip -d /tmp/build-tools \
    && cp -r /tmp/build-tools/*/. ${ANDROID_HOME}/build-tools/34.0.0/ \
    && rm -rf /tmp/build-tools* \
    && chmod +x ${ANDROID_HOME}/build-tools/34.0.0/*

WORKDIR /app/server

# 4. Copy node_modules and code from builder stage
COPY --from=builder /app/server /app/server

EXPOSE 3000
CMD ["npm", "start"]
