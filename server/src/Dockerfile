FROM node:20-slim

# Set Java environment variables so java, keytool, and jarsigner are found globally
ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
ENV ANDROID_HOME=/opt/android-sdk
ENV PATH="${JAVA_HOME}/bin:${ANDROID_HOME}/build-tools/34.0.0:${PATH}"

# Install Java 17 + required utility dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    openjdk-17-jdk-headless \
    zip unzip wget ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Download build-tools zip, extract to a temporary folder, and move contents to /34.0.0/
RUN mkdir -p ${ANDROID_HOME}/build-tools/34.0.0 \
    && wget -q https://dl.google.com/android/repository/build-tools_r34-linux.zip -O /tmp/build-tools.zip \
    && unzip -q /tmp/build-tools.zip -d /tmp/build-tools \
    && mv /tmp/build-tools/*/* ${ANDROID_HOME}/build-tools/34.0.0/ \
    && rm -rf /tmp/build-tools* \
    && chmod +x ${ANDROID_HOME}/build-tools/34.0.0/*

WORKDIR /opt/render/project/src
COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 3000
CMD ["npm", "start"]
