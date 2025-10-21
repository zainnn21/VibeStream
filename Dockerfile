FROM oven/bun:1
RUN apt-get update && apt-get install -y ffmpeg unzip curl
WORKDIR  /app
COPY package.json ./
COPY bun.lock ./
RUN bun install --frozen-lockfile
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
RUN chmod a+rx /usr/local/bin/yt-dlp
COPY . .
CMD ["bun", "run","src/index.ts"]