// Helper function untuk algoritma Fisher-Yates
export const shuffleArray = (array: any[]) => {
  // Looping dari elemen terakhir ke elemen kedua
  for (let i = array.length - 1; i > 0; i--) {
    // Pilih indeks acak dari 0 sampai i
    const j = Math.floor(Math.random() * (i + 1));

    // Tukar posisi elemen i dengan elemen j
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array; // Kembalikan array yang sudah diacak
};
