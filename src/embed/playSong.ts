// import { EmbedBuilder } from "discord.js";
// import type { Song } from "../interfaces/song";

// export const embedPlaySong = (song: Song) => {
//   const embed = new EmbedBuilder()
//     .setColor(0x0099ff)
//     .setTitle(`🎵 Now Playing`)
//     .setDescription(`**${song.title}**`)
//     .setThumbnail(song.thumbnail || song.image)
//     .setURL(song.url)
//     .addFields(
//       { name: "Duration", value: `${song.duration}`, inline: true },
//       { name: "Views", value: `${song.views}`, inline: true },
//       { name: "Author", value: `${song.author.name}`, inline: true },
//       { name: "Published", value: `${song.timestamp}`, inline: true },
//     )
//     .setTimestamp();
//   return { embeds: [embed] };
// };
