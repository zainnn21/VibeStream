
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
export const executeStop = async (interaction: any, queue: any) => {
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