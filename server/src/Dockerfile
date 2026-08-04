FROM node:20-slim

# 1. Install Java 17 and core build utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    openjdk-17-jdk-headless \
    zip unzip wget ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# 2. Configure Android SDK environment variables
ENV ANDROID_HOME=/opt/android-sdk
ENV PATH="${ANDROID_HOME}/build-tools/34.0.0:${PATH}"

# 3. Download and extract Android SDK Build-Tools 34.0.0
RUN mkdir -p ${ANDROID_HOME}/build-tools/34.0.0 \
    && wget -q https://dl.google.com/android/repository/build-tools_r34-linux.zip -O /tmp/build-tools.zip \
    && unzip -q /tmp/build-tools.zip -d /tmp/build-tools \
    && cp -r /tmp/build-tools/*/. ${ANDROID_HOME}/build-tools/34.0.0/ \
    && rm -rf /tmp/build-tools* \
    && chmod +x ${ANDROID_HOME}/build-tools/34.0.0/*

WORKDIR /opt/render/project/src

# 4. Install Node dependencies (uses npm install to prevent missing lockfile crashes)
COPY package*.json ./
RUN npm install

# 5. Copy project source files
COPY . .

EXPOSE 3000
CMD ["npm", "start"]
