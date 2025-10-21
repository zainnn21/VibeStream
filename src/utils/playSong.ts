import {
  createAudioResource,
  AudioPlayerStatus,
  StreamType,
} from "@discordjs/voice";
import type { Song } from "../interfaces/song";
import { execSync, spawn } from "child_process";
// Inisialisasi yt-dlp dengan path custom atau default

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
export const playSong = async (
  guildId: string,
  song: Song,
  queue: any,
  youtubedl: any
) => {
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
      playSong(guildId, nextSong as Song, queue, youtubedl);
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
  player.on("error", (error: Error) => {
    console.error("❌ Audio player error:", error);

    // Skip lagu yang error
    serverQueue.songs.shift();
    if (serverQueue.songs.length > 0) {
      // Coba putar lagu berikutnya
      const nextSong = serverQueue.songs[0] as Song;
      playSong(guildId, nextSong, queue, youtubedl);
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
      format: "bestaudio[ext=webm]/bestaudio",
      noCheckCertificates: true,
      preferFreeFormats: true,
      addHeader: [
        "User-Agent: Mozilla/5.0",
        "Referer: https://www.youtube.com/",
      ],
    })) as any;

    console.log("🔗 Audio URL:", info.url);

    // Extract audio URL dari response yt-dlp
    // Bisa ada di info.url atau info.formats[0].url
    const audioUrl = info.url || info.formats?.[0]?.url;

    console.log("🎶 Streaming:", audioUrl);

    // Validasi: Pastikan audio URL valid
    if (typeof audioUrl !== "string" || !audioUrl) {
      throw new Error("Audio URL not found");
    }

    let ffmpegAvailable = false;
    try {
      execSync("ffmpeg -version", { stdio: "ignore" });
      ffmpegAvailable = true;
    } catch (error) {
      ffmpegAvailable = false;
    }
    console.log("✅ Audio URL obtained");

    let resource;

    if (ffmpegAvailable) {
      const ffmpeg = spawn("ffmpeg", [
        "-i",
        audioUrl, // input dari YouTube
        "-f",
        "s16le", // format PCM mentah
        "-ar",
        "48000", // sample rate 48kHz (standar Discord)
        "-ac",
        "2", // stereo
        "pipe:1", // stream hasil FFmpeg ke stdout
      ]);

      ffmpeg.stderr.on("data", (data) => {
        console.log("🐧 FFmpeg log:", data.toString());
      });

      resource = createAudioResource(ffmpeg.stdout, {
        inputType: StreamType.Raw,
      });
    } else {
      console.log("FFmpeg not found — using direct stream mode");
      /**
       * Create audio resource dari URL
       * StreamType.Arbitrary: Format stream tidak diketahui,
       * biarkan @discordjs/voice auto-detect
       */
      resource = createAudioResource(audioUrl, {
        inputType: StreamType.Arbitrary,
      });
    }

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
        playSong(guildId, nextSong, queue, youtubedl);
      }
    }
    return;
  }
};
