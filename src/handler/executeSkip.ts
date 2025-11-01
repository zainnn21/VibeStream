import { embedSkipSong } from "../embed/skipSong.ts";
import { playSong } from "../utils/playSong.ts";

export const executeSkip = async (
  interaction: any,
  queue: any,
  youtubedl: any
) => {

  try {
    await interaction.deferReply();
  } catch (err) {
    console.warn("⚠️ Gagal defer reply:", err);
    // Jika defer gagal, kemungkinan interaksi sudah tidak valid.
    return; 
  }

  const serverQueue = queue.get(interaction.guild.id);

  if (!serverQueue) {
    return interaction.editReply("❌ Bot is not playing anything");
  }

  if (serverQueue.songs.length <= 1) {
    try {
      serverQueue.player.stop(true);
      serverQueue.connection.destroy();
    } catch {}
    queue.delete(interaction.guild.id);
    return interaction.editReply("📭 Queue ended, leaving voice channel");
  }

  // ✅ Matikan semua proses aktif (yt-dlp / ffmpeg) dengan aman
  try {
    serverQueue.currentYtdlp?.kill("SIGKILL");
    serverQueue.currentFFmpeg?.kill("SIGKILL");
  } catch (err) {
    console.warn("⚠️ Failed to kill old process:", err);
  }

  // ✅ Ambil lagu yang di-skip dan next song
  const skippedSong = serverQueue.songs.shift(); // langsung hapus dan ambil
  const nextSong = serverQueue.songs[0];

  if (!nextSong) {
    try {
      serverQueue.connection.destroy();
    } catch {}
    queue.delete(interaction.guild.id);
    return interaction.editReply("📭 Queue empty, leaving voice channel");
  }

  // ✅ Pastikan koneksi dan player masih aktif
  if (serverQueue.connection.state.status !== "ready") {
    console.log("🔄 Re-subscribing player to connection");
    serverQueue.connection.subscribe(serverQueue.player);
  }

  // ✅ Set flag dan mulai lagu berikutnya
  serverQueue.playing = true;

  try {
    await playSong(interaction.guild.id, nextSong, queue, youtubedl);
    await interaction.editReply(embedSkipSong(skippedSong, nextSong, interaction));
  } catch (err) {
    console.error("❌ Error while playing next song:", err);
    return interaction.editReply("⚠️ Failed to play the next song.");
  }
};
