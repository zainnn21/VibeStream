import { EmbedBuilder } from "discord.js";

export const executeHelp = async (interaction: any) => {
  const helpEmbed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle("🎵 List Commands VibeStream")
    .setDescription("These are the available commands:")
    .addFields(
      {
        name: "`/play [query]`",
        value: "Play music (link or title).",
      },
      {
        name: "`/stop`",
        value: "Stop the music.",
      },
      {
        name: "`/skip`",
        value: "Skip the music.",
      },
      {
        name: "`/queue`",
        value: "Show the queue.",
      },
      {
        name: "`/shuffle`",
        value: "Shuffle the queue.",
      },
      {
        name: "`/help`",
        value: "Show this message.",
      }
    )
    .setFooter({ text: "Bot Music by Zain" })
    .setTimestamp();
  await interaction.reply({ embeds: [helpEmbed] });
};
