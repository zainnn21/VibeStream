
export const executeSkip = async (interaction: any, queue: any) => {
  const serverQueue = queue.get(interaction.guild.id);
  if (!serverQueue) {
    console.log("❌ No queue found");
    return interaction.reply("❌ Bot is not playing anything");
  }
  console.log("⏭️ Skipping song");
  if (serverQueue.songs.length <= 1) {
    serverQueue.player.stop(); 
    await interaction.reply("⏭️ Skipping last song. Bot stopping.");
    return;
  }
  serverQueue.player.stop();
  const nextSongTitle = serverQueue.songs[1].title;
  await interaction.reply(`⏭️ Song skipped! Now playing: **${nextSongTitle}**`);
};
