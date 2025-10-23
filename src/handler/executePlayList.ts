import type { GuildMember } from "discord.js";
import { joinVoiceChannel, createAudioPlayer } from "@discordjs/voice";
import type { Song } from "../interfaces/song.ts";
import type { Queue } from "../interfaces/queue.ts";
import { playSong } from "../utils/playSong.ts";

/**
 * Handler untuk command /playlist
 * Memutar seluruh playlist dari YouTube
 *
 * @param interaction - Discord interaction object
 * @param playlistUrl - URL playlist YouTube
 *
 * Flow:
 * 1. Validasi user ada di voice channel
 * 2. Extract semua video URLs dari playlist
 * 3. Add ke queue dengan lazy loading
 * 4. Skip otomatis video yang unavailable/restricted
 */
export const executePlayList = async (
  interaction: any,
  queue: any,
  youtubedl: any,
  query: string
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
      ephemeral: true,
    });
  }

  // Validasi: Pastikan URL adalah playlist YouTube
  if (!query.includes("list=")) {
    return interaction.reply({
      content: "❌ Please provide a valid YouTube playlist URL",
      ephemeral: true,
    });
  }

  await interaction.deferReply();
  console.log(`📋 Processing playlist: ${query}`);

  try {
    // ========== FETCH PLAYLIST INFO ==========
    console.log("🔍 Fetching playlist info...");

    // Timeout untuk playlist info (30 detik)
    const timeout = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Playlist fetch timeout after 30 seconds")),
        30000
      )
    );

    // flag flatPlaylist true ini akan lebih cepat karena yang diambil hanya id,url,judul

    const fetchPlaylist = youtubedl(query, {
      dumpSingleJson: true,
      noCheckCertificates: true,
      noWarnings: true,
      flatPlaylist: true,
      skipDownload: true,
      geoBypass: true, // Bypass geo-restrictions
      yesPlaylist: true, // Force playlist extraction
    });

    const playlistInfo = (await Promise.race([fetchPlaylist, timeout])) as any;

    // Extract entries (videos) dari playlist
    const entries = playlistInfo.entries || [];

    if (entries.length === 0) {
      console.log("❌ No videos found in playlist");
      return interaction.editReply("❌ No videos found in this playlist");
    }

    console.log(`✅ Found ${entries.length} videos in playlist`);

    // ========== PREPARE SONGS ==========
    const songs: Song[] = [];
    let skippedCount = 0;

    // Process setiap video dari playlist
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];

      // Skip jika tidak ada ID atau URL
      if (!entry.id && !entry.url) {
        console.log(`⏭️ Skipping invalid entry at position ${i + 1}`);
        skippedCount++;
        continue;
      }

      // Buat URL lengkap
      let videoUrl = entry.url;
      if (!videoUrl && entry.id) {
        videoUrl = `https://www.youtube.com/watch?v=${entry.id}`;
      }

      // Tambahkan ke array songs
      songs.push({
        title: entry.title || `Video ${i + 1}`,
        url: videoUrl,
      });
    }

    if (songs.length === 0) {
      console.log("❌ All videos are unavailable");
      return interaction.editReply(
        "❌ All videos in this playlist are unavailable or restricted"
      );
    }

    console.log(
      `✅ ${songs.length} videos ready to play (${skippedCount} skipped)`
    );

    // ========== SETUP QUEUE ==========
    let serverQueue = queue.get(interaction.guild.id);

    if (!serverQueue) {
      // Buat queue baru jika belum ada
      console.log("🔗 Creating new queue and joining voice channel...");

      try {
        const connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: voiceChannel.guild.id,
          adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        });

        const player = createAudioPlayer();

        const queueContract: Queue = {
          voiceChannel,
          connection,
          player,
          songs: [],
          volume: 100,
          playing: true,
        };

        queue.set(interaction.guild.id, queueContract);
        serverQueue = queueContract;

        // Tambahkan semua lagu ke queue
        serverQueue.songs.push(...songs);

        connection.subscribe(player);
        console.log("✅ Player subscribed to connection");

        // Mulai playback lagu pertama
        console.log("▶️ Starting playlist playback...");
        playSong(
          interaction.guild.id,
          serverQueue.songs[0] as Song,
          queue,
          youtubedl
        );

        // Reply dengan info playlist
        await interaction.editReply(
          `🎵 **Playlist Started!**\n` +
            `✅ Added ${songs.length} songs to queue\n` +
            (skippedCount > 0
              ? `⏭️ Skipped ${skippedCount} unavailable videos\n`
              : "") +
            `▶️ Now playing: **${songs[0]?.title}**`
        );
      } catch (error) {
        console.error("❌ Error joining voice channel:", error);
        return interaction.editReply(
          "❌ Failed to join voice channel. Check bot permissions!"
        );
      }
    } else {
      // Queue sudah ada, tambahkan ke existing queue
      console.log(`➕ Adding playlist to existing queue`);
      serverQueue.songs.push(...songs);

      await interaction.editReply(
        `🎶 **Playlist Added to Queue!**\n` +
          `✅ Added ${songs.length} songs\n` +
          (skippedCount > 0
            ? `⏭️ Skipped ${skippedCount} unavailable videos\n`
            : "") +
          `📋 Total songs in queue: ${serverQueue.songs.length}`
      );
    }
  } catch (error) {
    console.error("❌ Error in executePlaylist:", error);
    return interaction.editReply(
      "❌ Something went wrong while processing the playlist. The playlist might be private or unavailable."
    );
  }
};
