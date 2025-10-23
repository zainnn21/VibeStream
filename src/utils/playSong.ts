import {
  createAudioResource,
  AudioPlayerStatus,
  StreamType,
  Node,
} from "@discordjs/voice";
import type { Song } from "../interfaces/song.ts";
import { execSync, spawn } from "child_process";
import ffmpegPath from "ffmpeg-static";

/**
 * Fungsi utama untuk memutar lagu
 */
export const playSong = async (
  guildId: string,
  song: Song,
  queue: any,
  youtubedl: any
) => {
  console.log(`🎵 Now playing: ${song.title}`);
  const serverQueue = queue.get(guildId);

  if (!serverQueue) {
    console.log("❌ No server queue found");
    return;
  }

  if (!song) {
    await new Promise((r) => setTimeout(r, 200));
    if (!serverQueue.songs[0]) {
      console.log("❌ No song found after delay");
      serverQueue.connection.destroy();
      queue.delete(guildId);
      return;
    }
    song = serverQueue.songs[0];
  }

  const { player } = serverQueue;
  player.removeAllListeners();

  // Stop player lama (jaga-jaga biar gak tumpang tindih)
  try {
    player.stop(true);
  } catch {}

  // ✅ Cek FFmpeg
  try {
    execSync(`${ffmpegPath} -version`, { stdio: "ignore" });
  } catch {
    console.error("❌ FFmpeg not found!");
    serverQueue.textChannel?.send?.("⚠️ FFmpeg not found!");
    return;
  }

  try {
    //  Pastikan FFmpeg ada
    try {
      execSync(`${ffmpegPath} -version`, { stdio: "ignore" });
      console.log("✅ FFmpeg detected at:", ffmpegPath);
    } catch {
      console.error("❌ FFmpeg not found!");
      serverQueue.textChannel?.send?.("⚠️ FFmpeg not found!");
      return;
    }

    // Jalankan yt-dlp dan stream ke stdout
    const ytdlp = spawn("yt-dlp", [
      "-f",
      "bestaudio[ext=webm]/bestaudio/best",
      "-o",
      "-", // stream ke stdout
      "--no-playlist",
      "--quiet",
      "--no-warnings",
      "--no-check-certificates",
      "--add-header",
      "User-Agent: Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      "--add-header",
      "Referer: https://www.youtube.com/",
      "--extractor-args",
      "youtube:player_client=android",
      song.url,
    ]);

    //  Proses stream yt-dlp → ffmpeg
    const ffmpeg = spawn(
      ffmpegPath!,
      [
        "-hide_banner",
        "-loglevel",
        "warning",
        "-i",
        "pipe:0",
        "-vn",
        "-f",
        "s16le",
        "-ar",
        "48000",
        "-ac",
        "2",
        "pipe:1",
      ],
      { stdio: ["pipe", "pipe", "inherit"] }
    );

    serverQueue.currentYtdlp = ytdlp;
    serverQueue.currentFFmpeg = ffmpeg;

    // Tangani error EPIPE dan stream
    ytdlp.stdout.pipe(ffmpeg.stdin).on("error", (err) => {
      if ((err as NodeJS.ErrnoException).code !== "EPIPE") {
        console.error("❌ Stream pipe error:", err);
      }
    });

    ffmpeg.stdin.on("error", (err) => {
      if ((err as NodeJS.ErrnoException).code !== "EPIPE") {
        console.error("⚠️ FFmpeg stdin error:", err);
      }
    });

    //  Buat resource audio
    const resource = createAudioResource(ffmpeg.stdout, {
      inputType: StreamType.Raw,
    });
    // ▶ Mulai mainkan
    player.play(resource);
    serverQueue.playing = true;
    console.log(`▶️ Playing: ${song.title}`);

    // 🔁 Saat lagu selesai
    player.once(AudioPlayerStatus.Idle, async () => {
      if (serverQueue.destroyed) return; // ✅ sudah dihapus, abaikan
      if (serverQueue.playing) return; // ✅ lagi transisi, abaikan

      console.log("⏭️ Song finished, moving to next...");
      serverQueue.playing = false;

      try {
        ytdlp.kill("SIGKILL");
        ffmpeg.kill("SIGKILL");
      } catch {}

      serverQueue.songs.shift();

      if (serverQueue.songs.length > 0) {
        const nextSong = serverQueue.songs[0];
        await new Promise((r) => setTimeout(r, 300));
        serverQueue.playing = true;
        await playSong(guildId, nextSong, queue, youtubedl);
      } else {
        console.log("📭 Queue empty, leaving channel");
        serverQueue.destroyed = true; // ✅ tandai supaya event lain tidak jalan
        serverQueue.connection.destroy();
        queue.delete(guildId);
      }
    });

    //  Error player
    player.once("error", (err: any) => {
      console.error("❌ Player error:", err);
      try {
        ytdlp.kill("SIGKILL");
        ffmpeg.kill("SIGKILL");
      } catch {}
      serverQueue.songs.shift();
      if (serverQueue.songs.length > 0) {
        playSong(guildId, serverQueue.songs[0], queue, youtubedl);
      } else {
        serverQueue.connection.destroy();
        queue.delete(guildId);
      }
    });
  } catch (error) {
    console.error("❌ Error playing song:", error);
    serverQueue.songs.shift();
    if (serverQueue.songs.length > 0) {
      playSong(guildId, serverQueue.songs[0], queue, youtubedl);
    } else {
      serverQueue.connection.destroy();
      queue.delete(guildId);
    }
  }
};
