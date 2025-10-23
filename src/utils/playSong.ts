import {
  createAudioResource,
  AudioPlayerStatus,
  StreamType,
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
  if (!serverQueue || !song) {
    console.log("❌ No queue or song found");
    serverQueue?.connection?.destroy();
    queue.delete(guildId);
    return;
  }

  const { player } = serverQueue;
  player.removeAllListeners();

  // 🔁 Event: saat lagu selesai
  player.once(AudioPlayerStatus.Idle, async () => {
    console.log("⏭️ Song finished, moving to next...");
    serverQueue.playing = false;
    serverQueue.songs.shift();

    if (serverQueue.songs.length > 0) {
      const nextSong = serverQueue.songs[0];
      await new Promise((r) => setTimeout(r, 300));
      playSong(guildId, nextSong, queue, youtubedl);
    } else {
      console.log("📭 Queue empty, leaving channel");
      serverQueue.connection.destroy();
      queue.delete(guildId);
    }
  });

  // ⚠️ Event: error audio
  player.once("error", (err: Error) => {
    console.error("❌ Player error:", err);
    serverQueue.songs.shift();
    if (serverQueue.songs.length > 0) {
      playSong(guildId, serverQueue.songs[0], queue, youtubedl);
    } else {
      serverQueue.connection.destroy();
      queue.delete(guildId);
    }
  });

  try {
    // Stop player sebelumnya
    player.stop(true);

    // ✅ Pastikan FFmpeg ada
    try {
      execSync(`${ffmpegPath} -version`, { stdio: "ignore" });
      console.log("✅ FFmpeg detected at:", ffmpegPath);
    } catch {
      console.error("❌ FFmpeg not found!");
      serverQueue.textChannel?.send?.("⚠️ FFmpeg not found!");
      return;
    }

    // 🎧 Jalankan yt-dlp dan stream ke stdout
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

    // 🚰 Proses stream yt-dlp → ffmpeg
    const ffmpeg = spawn(
      ffmpegPath!,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        "pipe:0",
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

    ytdlp.stdout.pipe(ffmpeg.stdin);

    // 🧠 Logging & error handling
    ytdlp.stderr.on("data", (d) =>
      console.error("❗ yt-dlp error:", d.toString())
    );
    ytdlp.on("close", (code) => {
      if (code !== 0) console.warn(`⚠️ yt-dlp exited with code ${code}`);
    });

    ffmpeg.on("close", (code) => {
      if (code !== 0) console.warn(`⚠️ FFmpeg exited with code ${code}`);
    });

    // 🎵 Buat resource dari output ffmpeg
    const resource = createAudioResource(ffmpeg.stdout, {
      inputType: StreamType.Raw,
    });

    // ▶️ Play
    player.play(resource);
    serverQueue.playing = true;
    console.log(`▶️ Playing song: ${song.title}`);
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
