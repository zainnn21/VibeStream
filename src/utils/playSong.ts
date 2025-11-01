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
): Promise<Song> => {
  const serverQueue = queue.get(guildId);

  if (!serverQueue) {
    console.log("❌ No server queue found");
    return song;
  }

  if (!song) {
    await new Promise((r) => setTimeout(r, 200));
    if (!serverQueue.songs[0]) {
      console.log("❌ No song found after delay");
      serverQueue.connection.destroy();
      queue.delete(guildId);
      return song;
    }
    song = serverQueue.songs[0];
  }

  const { player } = serverQueue;
  player.removeAllListeners();

  // ✅ Cek FFmpeg
  try {
    execSync(`${ffmpegPath} -version`, { stdio: "ignore" });
  } catch {
    console.error("❌ FFmpeg not found!");
    serverQueue.textChannel?.send?.("⚠️ FFmpeg not found!");
    return song;
  }

  //  Pastikan FFmpeg ada
  try {
    execSync(`${ffmpegPath} -version`, { stdio: "ignore" });
    console.log("✅ FFmpeg detected at:", ffmpegPath);
  } catch {
    console.error("❌ FFmpeg not found!");
    serverQueue.textChannel?.send?.("⚠️ FFmpeg not found!");
    return song;
  }

  await new Promise((r) => setTimeout(r, 700)); // delay 0.7 detik

  try {
    if (!song.duration || !song.views) {
      try {
        const info = await youtubedl(song.url, {
          dumpSingleJson: true,
          noCheckCertificates: true,
          noWarnings: true,
          noPlaylist: true,
          skipDownload: true,
          preferFreeFormats: true,
          geoBypass: true,
        });

        song.title = info.title || song.title;
        song.duration = {
          seconds: info.duration,
          timestamp:
            info.duration_string ||
            (info.duration
              ? new Date(info.duration * 1000).toISOString().substr(14, 5)
              : "N/A"),
        };
        song.views = info.view_count;
        song.thumbnail = info.thumbnail;
        song.author = {
          name: info.uploader || "Unknown",
          url: info.uploader_url || "",
        };

        if (serverQueue.songs[0] && serverQueue.songs[0].url === song.url) {
          serverQueue.songs[0] = song;
        }
        console.log(`✅ Hydrated: ${song.title}`);
      } catch (error: any) {
        console.error(
          `❌ Failed to hydrate song: ${song.title}`,
          error.message
        );
        player.emit("error", new Error(`Failed to hydrate ${song.title}`));
        return song;
      }
    }

    console.log(`🎵 Now playing: ${song.title}`);
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

    await new Promise<void>((resolve) => {
      ytdlp.stdout.once("readable", () => {
        resolve();
      });
    });

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

    ytdlp.on("error", async (err) => {
      console.error("❌ yt-dlp error:", err);
      await new Promise((r) => setTimeout(r, 500)); // delay sebelum retry
      if (serverQueue.songs.length > 0) {
        playSong(guildId, serverQueue.songs[0], queue, youtubedl);
      }
    });
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
      metadata: song,
    });

    player.play(resource);
    serverQueue.playing = true;

    player.on(AudioPlayerStatus.Playing, () => {
      console.log(`🎧 Now streaming: ${song.title}`);
    });

    // 🔁 Saat lagu selesai
    player.once(AudioPlayerStatus.Idle, async () => {
      if (serverQueue.destroyed) {
        console.log("⏹️ Queue already destroyed, ignoring Idle event");
        return;
      }

      console.log("⏭️ Song finished, moving to next...");

      // ✅ Set playing = false SEBELUM proses apapun
      serverQueue.playing = false;

      // Cleanup proses lama
      try {
        ytdlp.kill("SIGKILL");
        ffmpeg.kill("SIGKILL");
      } catch {}

      // Hapus lagu yang sudah selesai
      serverQueue.songs.shift();

      if (serverQueue.songs.length > 0) {
        const nextSong = serverQueue.songs[0];
        console.log(`▶️ Playing next song: ${nextSong.title}`);

        // Delay kecil untuk stabilitas
        await new Promise((r) => setTimeout(r, 300));

        // ✅ PENTING: Set playing = true sebelum playSong
        serverQueue.playing = true;
        await playSong(guildId, nextSong, queue, youtubedl);
      } else {
        console.log("📭 Queue empty, leaving channel");
        serverQueue.destroyed = true;
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
    return song;
  } catch (error) {
    console.error("❌ Error playing song:", error);
    serverQueue.songs.shift();
    if (serverQueue.songs.length > 0) {
      return playSong(guildId, serverQueue.songs[0], queue, youtubedl);
    } else {
      serverQueue.connection.destroy();
      queue.delete(guildId);
      return song;
    }
  }
};
