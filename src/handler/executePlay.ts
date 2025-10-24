import type { GuildMember } from "discord.js";
import { joinVoiceChannel, createAudioPlayer } from "@discordjs/voice";
import type { Song } from "../interfaces/song.ts";
import yts, { type Author, type Duration } from "yt-search";
import type { Queue } from "../interfaces/queue.ts";
import { playSong } from "../utils/playSong.ts";
import { embedPlaySong } from "../embed/playSong.ts";
import { embedAddedQueue } from "../embed/addedQueue.ts";
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
export const executePlay = async (
  interaction: any,
  query: string,
  queue: any,
  youtubedl: any
) => {
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
    let thumbnail = "";
    let image = "";
    let duration: Duration;
    let views = 0;
    let author: Author;
    let timestamp = "";
    let description = "";
    let ago = "";

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
      thumbnail = (info as { thumbnail: string }).thumbnail || "";
      image = (info as { image: string }).image || "";
      duration = (info as { duration: Duration }).duration || {
        seconds: 0,
        timestamp: "",
      };
      views = (info as { viewCount: number }).viewCount || 0;
      author = (info as { author: Author }).author || {
        name: "Unknown Author",
        url: "",
      };
      timestamp = (info as { timestamp: string }).timestamp || "";
      description = (info as { description: string }).description || "";
      ago = (info as { ago: string }).ago || "";
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
      thumbnail = videos[0]?.thumbnail ?? "";
      image = videos[0]?.image ?? "";
      duration = videos[0]?.duration ?? { seconds: 0, timestamp: "" };
      views = videos[0]?.views ?? 0;
      author = videos[0]?.author ?? { name: "Unknown Author", url: "" };
      timestamp = videos[0]?.timestamp ?? "";
      description = videos[0]?.description ?? "";
      ago = videos[0]?.ago ?? "";
      console.log(`✅ Found: ${songTitle}`);
    }

    // Buat object Song
    const song: Song = {
      title: songTitle,
      url: songUrl,
      thumbnail,
      image,
      duration,
      views,
      author,
      timestamp,
      description,
      ago,
    };

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
        playSong(
          interaction.guild.id,
          serverQueue.songs[0] as Song,
          queue,
          youtubedl
        );
        serverQueue.playing = true;

        // Update reply dengan info lagu yang sedang diputar
        await interaction.editReply(embedPlaySong(song, interaction));
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
      await interaction.editReply(embedAddedQueue(song, interaction));
    }
  } catch (error) {
    console.error("❌ Error in executePlay:", error);
    return interaction.editReply(
      "❌ Something went wrong while trying to play the song."
    );
  }
};
