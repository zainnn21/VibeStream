# 🎵 VibeStream - A Modern Discord Music Bot

A high-performance, simple-to-use Discord music bot built with **Bun**, **TypeScript**, and **discord.js**. It uses the robust `yt-dlp` library to stream high-quality audio directly from YouTube.

This bot is built using modern Slash Commands (`/`) for a seamless user experience.

---

## ✨ Features

- **Slash Commands:** Easy-to-use `/` commands for all functions.
- **YouTube Streaming:** Plays audio from YouTube links or search queries.
- **Queue System:** A full-featured song queue.
- **Core Controls:** Play, stop, skip, and view the queue.
- **Queue Management:** Shuffle the upcoming songs.
- **Help Command:** A dynamic embedded help message.

---

## 🛠️ Tech Stack

- **Runtime:** [Bun.js](https://bun.sh/)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Library:** [discord.js v14](https://discord.js.org/)
- **Voice:** `@discordjs/voice`
- **Streaming:** [youtube-dl-exec](https://www.npmjs.com/package/youtube-dl-exec) (wrapper for `yt-dlp`)

---

## 🚀 Getting Started

Follow these steps to get your own instance of the bot up and running.

### 1. Prerequisites

- [Bun.js](https://bun.sh/docs/installation) (v1.0.0 or higher)
- [Node.js](https://nodejs.org/en) (LTS version) - Required to use `npm` for one specific package.
- A **Discord Bot Account** with a Token and Client ID. (Get this from the [Discord Developer Portal](https://discord.com/developers/applications)).

### 2. Bot Setup & Invite

1.  **Create a Bot:** Go to the [Discord Developer Portal](https://discord.com/developers/applications), create a "New Application," and add a "Bot" to it.
2.  **Enable Intents:** In the "Bot" tab, enable the **`GUILD_VOICE_STATES`** Privileged Gateway Intent.
3.  **Invite the Bot:**
    - Go to the "OAuth2" -> "URL Generator" tab.
    - Select the following scopes:
      - `bot`
      - `applications.commands`
    - In "Bot Permissions," select:
      - `View Channels`
      - `Send Messages`
      - `Connect`
      - `Speak`
    - Copy the generated URL, paste it into your browser, and invite the bot to your test server.

### 3. Installation

1.  **Clone the repository:**

2.  **Install dependencies with Bun:**

    ```bash
    bun install
    ```

3.  **Install `yt-dlp` with npm:**
    _This package has known installation issues with Bun, so we use `npm` just for this one._

    ```bash
    npm install yt-dlp
    ```

4.  **Create your environment file:**
    Create a file named `.env` in the root of the project and add your credentials:
    ```.env
    DISCORD_TOKEN=YOUR_SUPER_SECRET_BOT_TOKEN
    CLIENT_ID=YOUR_BOTS_APPLICATION_ID
    GUILD_ID=YOUR_TEST_SERVERS_ID
    ```

### 4. Deploy Commands

Before starting the bot, you must register its `/` commands with Discord.

_Run this command **one time** (and again any time you add a new command):_

```bash
bun run deploy-commands.ts
```

### 5. Run the Bot

You're all set! Start the bot.

```bash
bun run index.ts
```

## 🤖 Available Commands

- `/play [query]` - Plays a song from a YouTube URL or search query.
- `/stop` - Stops the music, clears the queue, and disconnects the bot.
- `/skip` - Skips the current song and plays the next in the queue.
- `/queue` - Displays the current song queue (up to 10 songs).
- `/shuffle` - Shuffles the upcoming songs in the queue.
- `/help` - Shows the help message with all available commands.

## Visual Flow

Windows (Direct Mode) (yt-dlp → URL → DiscordJS → Voice Channel) Not needed FFmpeg
Docker (Pipe Mode) (yt-dlp → FFmpeg (convert audio) → stdout (pipe:1) → DiscordJS → Voice Channel) FFmpeg needed to convert format

## ⚠️ Disclaimer

This project is intended for educational purposes only. Streaming audio from YouTube may violate their Terms of Service. Use this bot at your own risk. The creators of this bot are not responsible for any misuse or for your bot/IP being banned by YouTube or Discord.
