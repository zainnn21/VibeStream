import { playSong } from "../utils/playSong.ts";

export const executeSkip = async (
  interaction: any,
  queue: any,
  youtubedl: any
) => {
  const serverQueue = queue.get(interaction.guild.id);

  if (!serverQueue) {
    return interaction.reply("❌ Bot is not playing anything");
  }

  if (serverQueue.songs.length <= 1) {
    serverQueue.player.stop(true); // hentikan player
    serverQueue.connection.destroy();
    queue.delete(interaction.guild.id);
    return interaction.reply("📭 Queue ended, leaving voice channel");
  }

  // Matikan proses yt-dlp & ffmpeg lama biar gak error EPIPE
  try {
    serverQueue.currentYtdlp?.kill("SIGKILL");
    serverQueue.currentFFmpeg?.kill("SIGKILL");
  } catch {}

  // ⏹️ Hentikan audio player aktif
  serverQueue.player.stop(true);

  // ⏭️ Hapus lagu pertama dan mainkan yang berikutnya
  serverQueue.songs.shift();

  const nextSong = serverQueue.songs[0];
  if (!nextSong) {
    serverQueue.connection.destroy();
    queue.delete(interaction.guild.id);
    return interaction.reply("📭 Queue empty, leaving voice channel");
  }

  if (!serverQueue || !serverQueue.songs[0]) {
    return interaction.reply("❌ No more songs to skip to!");
  }

  if (serverQueue.destroyed) {
    return interaction.reply("⚠️ Queue already ended!");
  }

  serverQueue.playing = true;
  await playSong(interaction.guild.id, nextSong, queue, youtubedl);
  await interaction.reply(`⏭️ Skipped! Now playing **${nextSong.title}**`);
};
