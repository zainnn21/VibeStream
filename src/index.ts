
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

import { Client, GatewayIntentBits, GuildMember } from "discord.js";
import type { Interaction, VoiceBasedChannel } from "discord.js";
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayer,
  AudioPlayerStatus,
  StreamType,
} from "@discordjs/voice";
import youtubedlExec from "youtube-dl-exec";

// Inisialisasi yt-dlp dengan path custom atau default
const youtubedl = youtubedlExec.create(
  process.env.YOUTUBE_DL_PATH || "./yt-dlp"
);
import yts from "yt-search";

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Interface untuk data lagu yang akan diputar
 */
interface Song {
  title: string;
  url: string;
}

/**
 * Interface untuk queue musik per server
 * Menyimpan informasi tentang voice connection dan playlist
 */
interface Queue {
  voiceChannel: VoiceBasedChannel;  // Channel voice tempat bot berada
  connection: any;                  // Voice connection object
  player: AudioPlayer;              // Audio player untuk streaming
  songs: Song[];                    // Array lagu dalam queue
  volume: number;                   // Volume level (0-100)
  playing: boolean;                 // Status sedang memutar atau tidak
}

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
    await executePlay(interaction, query);
  } else if (commandName === "stop") {
    await executeStop(interaction);
  }
});


// ============================================================================
// COMMAND HANDLERS
// ============================================================================

/**
 * Handler untuk command /play
 * Memutar musik dari YouTube URL atau search query
 * 
 * @param interaction - Discord interaction object
 * @param query - URL YouTube atau keyword pencarian
 * 
 * Flow:
 * 1. Validasi user ada di voice channel
 * 2. Extract/search info lagu dari query
 * 3. Join voice channel jika belum ada queue
 * 4. Tambahkan lagu ke queue dan mulai playback
 */
const executePlay = async (interaction: any, query: string) => {
  const member = interaction.member as GuildMember;
  const voiceChannel = member?.voice.channel;

  console.log(`👤 Member: ${member?.user.tag}`);
  console.log(`🔊 Voice Channel: ${voiceChannel?.name || "Not in voice"}`);

  // Validasi: User harus berada di voice channel
  if (!voiceChannel) {
    console.log("❌ User not in voice channel");
    return interaction.reply({
      content: "You must be in a voice channel to use this command",
      ephemeral: true, // Reply hanya terlihat oleh user yang menjalankan command
    });
  }

  // Defer reply untuk mencegah timeout (3 detik default)
  // Karena proses search/extract bisa lama
  await interaction.deferReply();
  console.log(`🔍 Searching for: ${query}`);

  try {
    const isUrl = query.startsWith("https://") || query.startsWith("http://");
    let songUrl = "";
    let songTitle = "";

    if (isUrl) {
      // ========== PROCESSING URL ==========
      console.log("📎 Processing URL...");

      // Bersihkan URL dari parameter playlist yang tidak perlu
      // Contoh: https://youtu.be/xxx?list=yyy&index=0 -> https://youtu.be/xxx?v=xxx
      const cleanUrl =
        query?.split("?")[0] +
        (query?.includes("?v=")
          ? "?" + query?.split("?")[1]?.split("&")[0]
          : "");
      console.log(`🧹 Cleaned URL: ${cleanUrl}`);

      // Tambahkan timeout untuk mencegah hanging
      // yt-dlp kadang bisa sangat lambat atau stuck
      const timeout = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("yt-dlp timeout after 15 seconds")),
          15000
        )
      );

      // Fetch info video menggunakan yt-dlp
      const fetchInfo = youtubedl(cleanUrl, {
        dumpSingleJson: true, // Output dalam format JSON
        noCheckCertificates: true, // Skip SSL certificate verification
        preferFreeFormats: true, // Prioritas format gratis/tidak encrypted
        noWarnings: true, // Suppress warnings
        noPlaylist: true, // Jangan process playlist, hanya 1 video
        skipDownload: true, // Jangan download file, hanya ambil info
      });

      // Race antara fetch dan timeout
      const info = (await Promise.race([fetchInfo, timeout])) as any;

      songUrl = cleanUrl;
      songTitle = (info as { title: string }).title || "Unknown Title";
      console.log(`✅ Got title: ${songTitle}`);
    } else {
      // ========== SEARCHING BY KEYWORD ==========
      console.log("🔎 Searching YouTube...");
      const searchResults = await yts(query);
      const videos = searchResults.videos;

      // Validasi: Pastikan ada hasil search
      if (videos.length === 0) {
        console.log("❌ No results found");
        return interaction.editReply("No results found");
      }

      // Ambil video pertama dari hasil search
      songUrl = videos[0]?.url ?? "";
      songTitle = videos[0]?.title ?? "";
      console.log(`✅ Found: ${songTitle}`);
    }

    // Buat object Song
    const song: Song = { title: songTitle, url: songUrl };

    // Ambil queue server ini dari Map
    let serverQueue = queue.get(interaction.guild.id);
    if (!serverQueue) {
      // ========== QUEUE BELUM ADA (BOT BELUM MASUK VOICE) ==========
      console.log("🔗 Creating new queue and joining voice channel...");
      console.log(`   Channel ID: ${voiceChannel.id}`);
      console.log(`   Guild ID: ${voiceChannel.guild.id}`);

      try {
        // Join voice channel
        const connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: voiceChannel.guild.id,
          adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        });

        // Buat audio player untuk streaming
        const player = createAudioPlayer();

        // Buat queue contract untuk server ini
        const queueContract: Queue = {
          voiceChannel,
          connection,
          player,
          songs: [],
          volume: 100,
          playing: true,
        };

        // Simpan queue ke Map
        queue.set(interaction.guild.id, queueContract);
        serverQueue = queueContract;

        // Tambahkan lagu pertama ke queue
        serverQueue.songs.push(song);

        // Subscribe player ke connection agar audio bisa diputar
        connection.subscribe(player);
        console.log("✅ Player subscribed to connection");

        // Mulai playback lagu pertama
        console.log("▶️ Starting playback...");
        playSong(interaction.guild.id, serverQueue.songs[0] as Song);
        serverQueue.playing = true;

        // Update reply dengan info lagu yang sedang diputar
        await interaction.editReply(`🎵 Now playing: ${song.title}`);
      } catch (error) {
        console.error("❌ Error joining voice channel:", error);
        return interaction.editReply(
          "❌ Failed to join voice channel. Check bot permissions!"
        );
      }
    } else {
      // ========== QUEUE SUDAH ADA (BOT SUDAH DI VOICE) ==========
      // Tambahkan lagu ke queue yang sudah ada
      console.log(
        `➕ Adding to existing queue (${serverQueue.songs.length} songs)`
      );
      serverQueue.songs.push(song);
      await interaction.editReply(`🎶 Added to queue: ${song.title}`);
    }
  } catch (error) {
    console.error("❌ Error in executePlay:", error);
    return interaction.editReply(
      "❌ Something went wrong while trying to play the song."
    );
  }
};

/**
 * Handler untuk command /stop
 * Menghentikan musik dan membersihkan queue
 * 
 * @param interaction - Discord interaction object
 * 
 * Flow:
 * 1. Cek apakah ada queue aktif
 * 2. Destroy voice connection
 * 3. Hapus queue dari Map
 */
const executeStop = async (interaction: any) => {
  const serverQueue = queue.get(interaction.guild.id);

  // Validasi: Pastikan bot sedang memutar musik
  if (!serverQueue) {
    console.log("❌ No queue found");
    return interaction.reply("❌ Bot is not playing anything");
  }
  console.log("⏹️ Stopping music and destroying connection");

  // Clear semua lagu dari queue
  serverQueue.songs = [];

  // Disconnect dari voice channel
  serverQueue.connection.destroy();

  // Hapus queue dari Map
  queue.delete(interaction.guild.id);
  await interaction.reply("⏹️ Music stopped");
};

// ============================================================================
// AUDIO PLAYBACK
// ============================================================================

/**
 * Fungsi untuk memutar lagu
 * Core function untuk streaming audio ke voice channel
 * 
 * @param guildId - ID server
 * @param song - Object lagu yang akan diputar
 * 
 * Flow:
 * 1. Setup event listeners untuk player (Idle, Error)
 * 2. Fetch audio stream URL dari yt-dlp
 * 3. Create audio resource dan play
 * 4. Handle next song atau cleanup jika queue kosong
 */
const playSong = async (guildId: string, song: Song) => {
  const serverQueue = queue.get(guildId);

  // Validasi: Pastikan queue dan song valid
  if (!serverQueue || !song) {
    console.log("❌ No queue or song found");
    if (serverQueue) {
      serverQueue.connection.destroy();
      queue.delete(guildId);
    }
    return;
  }

  // Bersihkan event listeners lama untuk mencegah memory leak
  const { player } = serverQueue;
  player.removeAllListeners(AudioPlayerStatus.Idle);
  player.removeAllListeners("error");

    /**
   * Event: Audio player selesai memutar lagu (Idle state)
   * Triggered saat lagu selesai atau di-stop
   */
  player.on(AudioPlayerStatus.Idle, async () => {
    console.log("⏭️ Song finished, checking queue...");
    serverQueue.playing = false;
    serverQueue.songs.shift();

    // Hapus lagu yang sudah selesai dari queue
    if (serverQueue.songs.length > 0) {
      // Masih ada lagu di queue, putar lagu berikutnya
      console.log(`📋 ${serverQueue.songs.length} songs remaining in queue`);

      // Delay 0.3 detik sebelum lagu berikutnya
      // Untuk mencegah audio buffering issues
      await new Promise((r) => setTimeout(r, 300));

      const nextSong = serverQueue.songs[0];
      playSong(guildId, nextSong as Song);
    } else {   
      // Queue kosong, disconnect dari voice
      console.log("📭 Queue empty, leaving voice channel");
      serverQueue.connection.destroy();
      queue.delete(guildId);
    }
  });

    /**
   * Event: Error saat playback audio
   * Handle error dan skip ke lagu berikutnya
   */
  player.on("error", (error) => {
    console.error("❌ Audio player error:", error);

    // Skip lagu yang error
    serverQueue.songs.shift();
    if (serverQueue.songs.length > 0) {
      // Coba putar lagu berikutnya
      const nextSong = serverQueue.songs[0] as Song;
      playSong(guildId, nextSong);
    } else {
      // Tidak ada lagu lagi, disconnect
      serverQueue.connection.destroy();
      queue.delete(guildId);
    }
  });

  try {
    // Stop player sebelum play lagu baru
    // Force stop untuk memastikan player benar-benar berhenti
    player.stop(true);

     /**
     * Fetch audio stream URL dari YouTube
     * yt-dlp akan extract direct URL ke audio stream
     * yang bisa digunakan untuk streaming real-time
     */
    const info = (await youtubedl(song.url, {
      dumpSingleJson: true,
      noCheckCertificates: true,
      preferFreeFormats: true,
      noWarnings: true,
      format: "bestaudio",  // Pilih format audio terbaik
    })) as any;

    // Extract audio URL dari response yt-dlp
    // Bisa ada di info.url atau info.formats[0].url
    const audioUrl = info.url || info.formats?.[0]?.url;

    // Validasi: Pastikan audio URL valid
    if (typeof audioUrl !== "string" || !audioUrl) {
      throw new Error("Audio URL not found");
    }

    console.log("✅ Audio URL obtained");

      /**
     * Create audio resource dari URL
     * StreamType.Arbitrary: Format stream tidak diketahui,
     * biarkan @discordjs/voice auto-detect
     */
    const resource = createAudioResource(audioUrl, {
      inputType: StreamType.Arbitrary,
    });

    // Play audio resource
    player.play(resource);
    serverQueue.playing = true;
    console.log("▶️ Playing song");
  } catch (error) {
    console.error("❌ Error playing song:", error);

    // Error saat fetch/play, skip ke lagu berikutnya
    serverQueue.songs.shift();
    if (serverQueue.songs.length > 0) {
      const nextSong = serverQueue.songs[0];
      if (nextSong) {
        playSong(guildId, nextSong);
      }
    }
    return;
  }
};

// ============================================================================
// BOT STARTUP
// ============================================================================

console.log("🚀 Attempting to login...");
client.login(token);
