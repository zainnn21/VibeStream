import { shuffleArray } from "../utils/shuffleArray.ts";

export const executeShuffle = async (interaction: any, queue: any) => {
  const serverQueue = queue.get(interaction.guild.id);

  console.log("🔀 Shuffling queue");
  if (!serverQueue) {
    console.log("❌ No queue found");
    return interaction.reply("❌ Bot is not playing anything");
  }

  // Cek jika tidak ada cukup lagu untuk diacak
  if (serverQueue.songs.length < 3) {
    console.log("❌ Not enough songs in the queue to shuffle.");
    // 1 (playing) + 1 (next)
    return interaction.reply("❌ Not enough songs in the queue to shuffle.");
  }

  // 1. Ambil dan PISAHKAN lagu yang sedang diputar
  const nowPlaying = serverQueue.songs.shift(); // 'shift()' menghapus dan mengembalikan elemen pertama

  console.log("🎵 Now playing:", nowPlaying);
  // 2. Acak SISA antrian menggunakan Fisher-Yates
  const shuffledQueue = shuffleArray(serverQueue.songs);

  console.log("🎵 Shuffled queue:", shuffledQueue);
  // 3. Gabungkan kembali: lagu 'nowPlaying' di depan + sisa antrian yang sudah diacak
  serverQueue.songs = [nowPlaying, ...shuffledQueue];
  console.log("🎵 New queue:", serverQueue.songs);
  await interaction.reply("🔀 Shuffled queue.");
};
