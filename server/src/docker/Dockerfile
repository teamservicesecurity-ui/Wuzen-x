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

# 4. Copy everything into the workdir first
COPY . .

# 5. Handle package.json whether it sits in root or a server subfolder
RUN if [ -f "./package.json" ]; then \
        npm install; \
    elif [ -f "./server/package.json" ]; then \
        cp ./server/package*.json ./ && npm install; \
    else \
        echo "Error: package.json not found" && exit 1; \
    fi

EXPOSE 3000
CMD ["npm", "start"]
