import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import type { Song } from "../interfaces/song";

export const executeShowQueue = async (interaction: any, queue: any) => {
  const serverQueue = queue.get(interaction.guild.id);
  if (!serverQueue) {
    return interaction.reply("❌ Bot is not playing anything");
  }

  const songs: Song[] = serverQueue.songs;
  const songsPerPage = 10;
  const totalPages = Math.ceil(songs.length / songsPerPage);
  let currentPage = 0;

  // Fungsi pembuat embed berdasarkan halaman
  const generateEmbed = (page: number) => {
    const start = page * songsPerPage;
    const end = start + songsPerPage;

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle(`🎵 Music Queue (Page ${page + 1}/${totalPages})`)
      .setDescription(
        songs
          .slice(start, end)
          .map((song: Song, index: number) => {
            return `**${start + index + 1}.** ${song.title.substring(0, 80)}${
              song.title.length > 80 ? "..." : ""
            }`;
          })
          .join("\n")
      )
      .setFooter({ text: `Total songs: ${songs.length}` });

    return embed;
  };

  // Tombol navigasi
  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("prev")
      .setLabel("⬅️")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(currentPage === 0),
    new ButtonBuilder()
      .setCustomId("next")
      .setLabel("➡️")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(currentPage === totalPages - 1)
  );

  // Kirim embed pertama
  const message = await interaction.reply({
    embeds: [generateEmbed(currentPage)],
    components: [buttons],
    fetchReply: true,
  });

  // Kolektor interaksi tombol
  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 60000, // 1 menit aktif
  });

  collector.on("collect", async (i: any) => {
    if (i.user.id !== interaction.user.id)
      return i.reply({ content: "❌ Kamu tidak bisa mengontrol queue ini.", ephemeral: true });

    if (i.customId === "prev" && currentPage > 0) currentPage--;
    else if (i.customId === "next" && currentPage < totalPages - 1) currentPage++;

    // Update embed & tombol
    const newButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("prev")
        .setLabel("⬅️")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(currentPage === 0),
      new ButtonBuilder()
        .setCustomId("next")
        .setLabel("➡️")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(currentPage === totalPages - 1)
    );

    await i.update({
      embeds: [generateEmbed(currentPage)],
      components: [newButtons],
    });
  });

  collector.on("end", async () => {
    // Disable tombol setelah waktu habis
    const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("prev")
        .setLabel("⬅️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId("next")
        .setLabel("➡️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );
    await message.edit({ components: [disabledRow] }).catch(() => {});
  });
};
