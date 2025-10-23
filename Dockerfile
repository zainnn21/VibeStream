FROM node:22-slim

# Install dependency yang dibutuhkan (ffmpeg dan yt-dlp)
RUN apt-get update && \
    apt-get install -y ffmpeg curl unzip make g++ python3 && \
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
      -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Salin package dan install dependencies
COPY package*.json ./
RUN npm install

# Salin semua file project
COPY . .
CMD ["npm", "run", "devnode"]