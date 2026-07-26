FROM node:22-bookworm-slim

RUN apt-get update -qq && apt-get install -y -qq \
    default-jdk-headless \
    wget unzip zip \
    && rm -rf /var/lib/apt/lists/*

ENV ANDROID_SDK_ROOT=/opt/android-sdk
RUN mkdir -p ${ANDROID_SDK_ROOT} && \
    cd ${ANDROID_SDK_ROOT} && \
    wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip && \
    unzip -q commandlinetools-linux-*.zip && \
    rm -f commandlinetools-linux-*.zip && \
    mkdir -p cmdline-tools/latest && \
    mv cmdline-tools/* cmdline-tools/latest/ 2>/dev/null; true && \
    yes | ${ANDROID_SDK_ROOT}/cmdline-tools/latest/bin/sdkmanager \
      "build-tools;35.0.0" "platforms;android-34" > /dev/null 2>&1 || true

ENV PATH=${PATH}:${ANDROID_SDK_ROOT}/build-tools/35.0.0

WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY src/ ./src/
COPY templates/ ./templates/
COPY public/ ./public/

RUN mkdir -p templates && touch templates/base.apk

EXPOSE 10000
CMD ["node", "src/index.js"]
