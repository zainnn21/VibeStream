import { EmbedBuilder } from "discord.js";
import { GuildMember } from "discord.js";

export const embedPlaylistStart = (
  playlistUrl: string,
  songs: any[],
  skippedCount: number,
  interaction: any
) => {
  const firstSong = songs[0];
  const member = interaction.member as GuildMember;
  const voiceChannel = member?.voice.channel;

  const embed = new EmbedBuilder()
    .setColor("#5865F2")
    .setTitle("🎶 Playlist Started!")
    .setURL(playlistUrl)
    .setThumbnail(firstSong?.thumbnail || "https://i.imgur.com/8rZxK9T.png")
    .setDescription(
      `✅ **${songs.length}** songs added to queue\n` +
        (skippedCount > 0
          ? `⚠️ Skipped **${skippedCount}** unavailable videos\n`
          : `📀 All videos are playable!`)
    )
    .addFields(
      {
        name: "▶️ Now Playing",
        value: `[${firstSong?.title || "Unknown"}](${firstSong?.url || "#"})`,
      },
      {
        name: "📋 Queue Overview",
        value:
          songs
            .slice(1, 10)
            .map((song, i) => `**${i + 1}.** [${song.title}](${song.url})`)
            .join("\n") || "_No other songs in queue_",
      }
    )
    .setFooter({
      text: `Total Songs: ${songs.length} • Requested by ${member?.user.tag} • In ${voiceChannel?.name}`,
      iconURL: member?.user.displayAvatarURL(),
    })
    .setTimestamp();

  return { embeds: [embed] };
};
