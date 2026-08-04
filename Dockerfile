FROM node:20-slim

# Java (keytool/jarsigner) + zip tools + wget
RUN apt-get update && apt-get install -y --no-install-recommends \
    openjdk-17-jdk-headless \
    zip unzip wget ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Android build-tools 34.0.0 → apksigner (v1+v2 signing) + zipalign
RUN wget -q https://dl.google.com/android/repository/build-tools_r34-linux.zip -O /tmp/build-tools.zip \
    && unzip -q /tmp/build-tools.zip -d /opt/ \
    && rm /tmp/build-tools.zip \
    && chmod +x /opt/android-sdk-linux/build-tools/34.0.0/*

ENV PATH="/opt/android-sdk-linux/build-tools/34.0.0:$PATH" \
    ANDROID_HOME="/opt/android-sdk-linux"

WORKDIR /opt/render/project/src
COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 3000
CMD ["npm", "start"]
