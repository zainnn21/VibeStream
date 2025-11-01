import { EmbedBuilder } from "discord.js";


const formatViews = (views?: number) => {
  // Tangani 'undefined' atau 'null'
  if (views === undefined || views === null) {
    return "Unknown";
  }
  // Tangani '0'
  if (views === 0) {
    return "0";
  }

  // Logika pemformatan
  if (views >= 1_000_000_000) {
    const num = (views / 1_000_000_000).toFixed(1);
    return `${num.replace(/\.0$/, "")}B`; // 5.0B -> 5B
  }
  if (views >= 1_000_000) {
    const num = (views / 1_000_000).toFixed(1);
    return `${num.replace(/\.0$/, "")}M`; // 1.0M -> 1M
  }
  if (views >= 1_000) {
    const num = (views / 1_000).toFixed(1);
    return `${num.replace(/\.0$/, "")}K`; // 2.0K -> 2K
  }

  // Angka di bawah 1000
  return `${views}`;
};

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
  const views = formatViews(nextSong.views);

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
