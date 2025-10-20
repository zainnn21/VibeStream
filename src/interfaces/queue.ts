import type { Song } from "./song";
import { AudioPlayer } from "@discordjs/voice";
import type { VoiceBasedChannel } from "discord.js";
/**
 * Interface untuk queue musik per server
 * Menyimpan informasi tentang voice connection dan playlist
 */
export interface Queue {
  voiceChannel: VoiceBasedChannel; // Channel voice tempat bot berada
  connection: any; // Voice connection object
  player: AudioPlayer; // Audio player untuk streaming
  songs: Song[]; // Array lagu dalam queue
  volume: number; // Volume level (0-100)
  playing: boolean; // Status sedang memutar atau tidak
}
