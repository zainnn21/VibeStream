import { Client, GatewayIntentBits, GuildMember } from "discord.js";
import type { Interaction, VoiceBasedChannel } from "discord.js";
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayer,
  AudioPlayerStatus,
  StreamType,
} from "@discordjs/voice";
import youtubedlExec from "youtube-dl-exec";
const youtubedl = youtubedlExec.create(
  process.env.YOUTUBE_DL_PATH || "./yt-dlp"
);
import yts from "yt-search";

interface Song {
  title: string;
  url: string;
}
interface Queue {
  voiceChannel: VoiceBasedChannel;
  connection: any;
  player: AudioPlayer;
  songs: Song[];
  volume: number;
  playing: boolean;
}

const token = process.env.DISCORD_TOKEN;
if (!token) {
  throw new Error("🛑 Missing environment variables");
}

const queue = new Map<string, Queue>();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

client.once("clientReady", () => {
  console.log(`✅ Bot Logged in as ${client.user?.tag}`);
  console.log(`📋 Registered in ${client.guilds.cache.size} guilds`);
  client.user?.setActivity("Music via /play");
});

client.on("interactionCreate", async (interaction: Interaction) => {
  console.log("🔔 Interaction received:", interaction.type);
  if (!interaction.isChatInputCommand()) {
    console.log("⚠️ Not a chat input command");
    return;
  }
  if (!interaction.guild) {
    console.log("⚠️ Not in a guild");
    return interaction.reply("You must use this command in a server");
  }
  const { commandName } = interaction;

  if (commandName === "play") {
    const query = interaction.options.getString("query", true);
    console.log(`🎵 Query: ${query}`);
    await executePlay(interaction, query);
  } else if (commandName === "stop") {
    await executeStop(interaction);
  }
});

const executePlay = async (interaction: any, query: string) => {
  const member = interaction.member as GuildMember;
  const voiceChannel = member?.voice.channel;

  console.log(`👤 Member: ${member?.user.tag}`);
  console.log(`🔊 Voice Channel: ${voiceChannel?.name || "Not in voice"}`);

  if (!voiceChannel) {
    console.log("❌ User not in voice channel");
    return interaction.reply({
      content: "You must be in a voice channel to use this command",
      ephemeral: true,
    });
  }

  await interaction.deferReply();
  console.log(`🔍 Searching for: ${query}`);

  try {
    const isUrl = query.startsWith("https://") || query.startsWith("http://");
    let songUrl = "";
    let songTitle = "";

    if (isUrl) {
      console.log("📎 Processing URL...");

      const cleanUrl =
        query?.split("?")[0] +
        (query?.includes("?v=")
          ? "?" + query?.split("?")[1]?.split("&")[0]
          : "");
      console.log(`🧹 Cleaned URL: ${cleanUrl}`);

      // Add timeout to prevent hanging
      const timeout = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("yt-dlp timeout after 15 seconds")),
          15000
        )
      );

      const fetchInfo = youtubedl(cleanUrl, {
        dumpSingleJson: true,
        noCheckCertificates: true,
        preferFreeFormats: true,
        noWarnings: true,
        noPlaylist: true,
        skipDownload: true,
      });

      const info = (await Promise.race([fetchInfo, timeout])) as any;

      songUrl = cleanUrl;
      songTitle = (info as { title: string }).title || "Unknown Title";
      console.log(`✅ Got title: ${songTitle}`);
    } else {
      console.log("🔎 Searching YouTube...");
      const searchResults = await yts(query);
      const videos = searchResults.videos;
      if (videos.length === 0) {
        console.log("❌ No results found");
        return interaction.editReply("No results found");
      }
      songUrl = videos[0]?.url ?? "";
      songTitle = videos[0]?.title ?? "";
      console.log(`✅ Found: ${songTitle}`);
    }

    const song: Song = { title: songTitle, url: songUrl };

    let serverQueue = queue.get(interaction.guild.id);
    if (!serverQueue) {
      console.log("🔗 Creating new queue and joining voice channel...");
      console.log(`   Channel ID: ${voiceChannel.id}`);
      console.log(`   Guild ID: ${voiceChannel.guild.id}`);

      try {
        const connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: voiceChannel.guild.id,
          adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        });
        const player = createAudioPlayer();
        const queueContract: Queue = {
          voiceChannel,
          connection,
          player,
          songs: [],
          volume: 100,
          playing: true,
        };
        queue.set(interaction.guild.id, queueContract);
        serverQueue = queueContract;
        serverQueue.songs.push(song);

        connection.subscribe(player);
        console.log("✅ Player subscribed to connection");

        console.log("▶️ Starting playback...");
        playSong(interaction.guild.id, serverQueue.songs[0] as Song);
        serverQueue.playing = true;
        await interaction.editReply(`🎵 Now playing: ${song.title}`);
      } catch (error) {
        console.error("❌ Error joining voice channel:", error);
        return interaction.editReply(
          "❌ Failed to join voice channel. Check bot permissions!"
        );
      }
    } else {
      console.log(
        `➕ Adding to existing queue (${serverQueue.songs.length} songs)`
      );
      serverQueue.songs.push(song);
      await interaction.editReply(`🎶 Added to queue: ${song.title}`);
    }
  } catch (error) {
    console.error("❌ Error in executePlay:", error);
    return interaction.editReply(
      "❌ Something went wrong while trying to play the song."
    );
  }
};

const executeStop = async (interaction: any) => {
  const serverQueue = queue.get(interaction.guild.id);
  if (!serverQueue) {
    console.log("❌ No queue found");
    return interaction.reply("❌ Bot is not playing anything");
  }
  console.log("⏹️ Stopping music and destroying connection");
  serverQueue.songs = [];
  serverQueue.connection.destroy();
  queue.delete(interaction.guild.id);
  await interaction.reply("⏹️ Music stopped");
};

const playSong = async (guildId: string, song: Song) => {
  const serverQueue = queue.get(guildId);
  if (!serverQueue || !song) {
    console.log("❌ No queue or song found");
    if (serverQueue) {
      serverQueue.connection.destroy();
      queue.delete(guildId);
    }
    return;
  }

  const { player } = serverQueue;
  player.removeAllListeners(AudioPlayerStatus.Idle);
  player.removeAllListeners("error");

  player.on(AudioPlayerStatus.Idle, async () => {
    console.log("⏭️ Song finished, checking queue...");
    serverQueue.playing = false;
    serverQueue.songs.shift();

    if (serverQueue.songs.length > 0) {
      console.log(`📋 ${serverQueue.songs.length} songs remaining in queue`);
      await new Promise((r) => setTimeout(r, 300)); //delay for 0.3 seconds
      const nextSong = serverQueue.songs[0];
      playSong(guildId, nextSong as Song);
    } else {
      console.log("📭 Queue empty, leaving voice channel");
      serverQueue.connection.destroy();
      queue.delete(guildId);
    }
  });

  player.on("error", (error) => {
    console.error("❌ Audio player error:", error);
    console.error("Audio player error");
    serverQueue.songs.shift();
    if (serverQueue.songs.length > 0) {
      const nextSong = serverQueue.songs[0] as Song;
      playSong(guildId, nextSong);
    } else {
      serverQueue.connection.destroy();
      queue.delete(guildId);
    }
  });

  try {
    player.stop(true);
    const info = (await youtubedl(song.url, {
      dumpSingleJson: true,
      noCheckCertificates: true,
      preferFreeFormats: true,
      noWarnings: true,
      format: "bestaudio",
    })) as any;

    const audioUrl = info.url || info.formats?.[0]?.url;
    if (typeof audioUrl !== "string" || !audioUrl) {
      throw new Error("Audio URL not found");
    }

    console.log("✅ Audio URL obtained");

    const resource = createAudioResource(audioUrl, {
      inputType: StreamType.Arbitrary,
    });

    player.play(resource);
    serverQueue.playing = true;
    console.log("▶️ Playing song");
  } catch (error) {
    console.error("❌ Error playing song:", error);
    serverQueue.songs.shift();
    if (serverQueue.songs.length > 0) {
      const nextSong = serverQueue.songs[0];
      if (nextSong) {
        playSong(guildId, nextSong);
      }
    }
    return;
  }
};

console.log("🚀 Attempting to login...");
client.login(token);
