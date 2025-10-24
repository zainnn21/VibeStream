import { EmbedBuilder } from "discord.js";

export const embedSkipSong = (
  skippedSong: any,
  nextSong: any,
  interaction: any
) => {
  // Normalisasi durasi
  const duration =
    typeof nextSong.duration === "string"
      ? nextSong.duration
      : nextSong.duration?.timestamp ||
        (nextSong.duration?.seconds
          ? `${Math.floor(nextSong.duration.seconds / 60)}:${String(
              nextSong.duration.seconds % 60
            ).padStart(2, "0")}`
          : "Unknown");

  // Normalisasi views
  const views =
    typeof nextSong.views === "number"
      ? nextSong.views.toLocaleString()
      : nextSong.views || "N/A";

  const embed = new EmbedBuilder()
    .setColor(0x1db954)
    .setTitle("⏭️ Song Skipped")
    .setDescription(
      `**Skipped:** [${skippedSong.title}](${skippedSong.url})\n\n🎶 **Now Playing:** [${nextSong.title}](${nextSong.url})`
    )
    .addFields(
      { name: "⏱ Duration", value: duration, inline: true },
      { name: "👁️ Views", value: views, inline: true },
      {
        name: "🙋 Requested by",
        value: `${interaction.member?.user?.tag || "Unknown User"}`,
        inline: true,
      }
    )
    .setFooter({ text: "Enjoy your next track!" })
    .setTimestamp();

  if (nextSong.thumbnail && nextSong.thumbnail.startsWith("http")) {
    embed.setThumbnail(nextSong.thumbnail);
  } else if (nextSong.image && nextSong.image.startsWith("http")) {
    embed.setThumbnail(nextSong.image);
  }

  return { embeds: [embed] };
};
