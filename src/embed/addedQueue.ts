import { EmbedBuilder } from "discord.js";
import type { Song } from "../interfaces/song";
import { GuildMember } from "discord.js";

export const embedAddedQueue = (song: Song, interaction: any) => {
  const member = interaction.member as GuildMember;
  const voiceChannel = member?.voice.channel;

  const thumbnailUrl =
    song.thumbnail && /^https?:\/\//.test(song.thumbnail)
      ? song.thumbnail
      : song.image && /^https?:\/\//.test(song.image)
      ? song.image
      : "https://i.imgur.com/F2vEwF4.png"; // default icon kalau tidak ada thumbnail

  const formatViews = (views?: number) => {
    if (!views) return "Unknown";
    if (views >= 1_000_000_000) return `${(views / 1_000_000_000).toFixed(1)}B`;
    if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
    if (views >= 1_000) return `${(views / 1_000).toFixed(1)}K`;
    return `${views}`;
  };

  const duration =
    song.duration?.timestamp ||
    (song.duration?.seconds
      ? `${Math.floor(song.duration.seconds / 60)}:${String(
          song.duration.seconds % 60
        ).padStart(2, "0")}`
      : "Unknown");

  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle(`🎵 Added to Queue`)
    .setURL(song.url)
    .setDescription(`**[${song.title}](${song.url})**`)
    .setThumbnail(thumbnailUrl)
    .addFields(
      { name: "🕒 Duration", value: duration, inline: true },
      { name: "👀 Views", value: formatViews(song.views), inline: true },
      { name: "👤 Author", value: song.author?.name || "Unknown", inline: true }
    )
    .setFooter({
      text: `🎶 Requested by ${member?.user.tag} • In ${voiceChannel?.name}`,
      iconURL: member?.user.displayAvatarURL(),
    })
    .setTimestamp();

  return { embeds: [embed] };
};
