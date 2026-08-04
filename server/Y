FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    openjdk-17-jdk-headless \
    zip unzip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/render/project/src

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000
CMD ["npm", "start"]
