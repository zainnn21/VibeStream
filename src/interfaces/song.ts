import type { Duration, Author } from "yt-search";

/**
 * Interface untuk data lagu yang akan diputar
 */
export interface Song {
  title: string;
  url: string;
  thumbnail?: string;
  image?: string;
  duration?: Duration;
  views?: number;
  author?: Author;
  timestamp?: string;
  description?: string;
  ago?: string;
}
