import type { Song } from "../interfaces/song";

export const executeShowQueue = async (interaction: any, queue: any) => {
  const serverQueue = queue.get(interaction.guild.id);
  if (!serverQueue) {
    console.log("❌ No queue found");
    return interaction.reply("❌ Bot is not playing anything");
  }
  const queueString = serverQueue.songs
    .map((song: Song, index:number) => {
      return `${index + 1}. ${song.title} `;
    })
    .join("\n");
  await interaction.reply(`🎵 Queue:\n${queueString}`);
};
