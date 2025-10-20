/**
 * Discord Music Bot
 *
 * Bot untuk memutar musik dari YouTube di voice channel Discord
 * Menggunakan yt-dlp untuk ekstraksi audio dan @discordjs/voice untuk streaming
 *
 * Dependencies:
 * - discord.js: Library untuk berinteraksi dengan Discord API
 * - @discordjs/voice: Library untuk voice connection dan audio streaming
 * - youtube-dl-exec: Wrapper untuk yt-dlp/youtube-dl
 * - yt-search: Library untuk search video YouTube
 */

import { Client, GatewayIntentBits} from "discord.js";
import type { Interaction} from "discord.js";
import { executePlay } from "./handler/executePlay";
import { executeStop } from "./handler/executeStop";
import { executeSkip } from "./handler/executeSkip";
import { executeShowQueue } from "./handler/executeShowQueue";
import { executeShuffle } from "./handler/executeShuffle";
import { executeHelp } from "./handler/executeHelp";
import type { Queue } from "./interfaces/queue";
import youtubedlExec from "youtube-dl-exec";
const youtubedl = youtubedlExec.create(
  process.env.YOUTUBE_DL_PATH || "../yt-dlp"
);

// ============================================================================
// INITIALIZATION
// ============================================================================
// Validasi token dari environment variable
const token = process.env.DISCORD_TOKEN;
if (!token) {
  throw new Error("🛑 Missing environment variables");
}

/**
 * Map untuk menyimpan queue musik per server (guild)
 * Key: Guild ID (string)
 * Value: Queue object
 */
const queue = new Map<string, Queue>();

/**
 * Inisialisasi Discord client dengan intents yang diperlukan
 * - Guilds: Untuk akses informasi server
 * - GuildVoiceStates: Untuk tracking status voice channel
 */
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

// ============================================================================
// EVENT LISTENERS
// ============================================================================

/**
 * Event: Bot berhasil login dan siap digunakan
 * Hanya dipanggil sekali saat bot pertama kali connect
 */
client.once("clientReady", () => {
  console.log(`✅ Bot Logged in as ${client.user?.tag}`);
  console.log(`📋 Registered in ${client.guilds.cache.size} guilds`);
  // Set bot activity/status yang terlihat di Discord
  client.user?.setActivity("Music via /play");
});

/**
 * Event: Menerima interaction dari user (slash command, button, dll)
 * Handler utama untuk semua slash commands
 */
client.on("interactionCreate", async (interaction: Interaction) => {
  console.log("🔔 Interaction received:", interaction.type);

  // Filter hanya chat input commands (slash commands)
  if (!interaction.isChatInputCommand()) {
    console.log("⚠️ Not a chat input command");
    return;
  }

  // Pastikan command digunakan di dalam server (bukan DM)
  if (!interaction.guild) {
    console.log("⚠️ Not in a guild");
    return interaction.reply("You must use this command in a server");
  }
  const { commandName } = interaction;

  // Routing command ke fungsi yang sesuai
  if (commandName === "play") {
    const query = interaction.options.getString("query", true);
    console.log(`🎵 Query: ${query}`);
    await executePlay(interaction, query, queue, youtubedl);
  } else if (commandName === "stop") {
    await executeStop(interaction, queue);
  } else if (commandName === "skip") {
    await executeSkip(interaction, queue);
  } else if (commandName === "queue") {
    await executeShowQueue(interaction, queue);
  } else if (commandName === "shuffle") {
    await executeShuffle(interaction, queue);
  } else if (commandName === "help") {
    await executeHelp(interaction);
  } else {
    console.log("⚠️ Unknown command");
    return interaction.reply("Unknown command");
  }
});

console.log("🚀 Attempting to login...");
client.login(token);
