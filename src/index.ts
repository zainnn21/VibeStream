import { Client, GatewayIntentBits, GuildMember } from "discord.js";
import type { Interaction, VoiceBasedChannel } from "discord.js";
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  VoiceConnectionStatus,
  AudioPlayer,
  AudioPlayerStatus,
} from "@discordjs/voice";
import play, { YouTubeVideo } from "play-dl";

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

client.once("clientReady", (readyClient: Client) => {
  console.log(`Bot Logged in as ${readyClient.user?.tag}`);
  readyClient.user?.setActivity("Music via /play");
});

client.on("interactionCreate", async (interaction: Interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (!interaction.guild) {
    return interaction.reply("You must use this command in a server");
  }
  const { commandName } = interaction;

  if (commandName === "play") {
    const query = interaction.options.getString("query", true);
    await executePlay(interaction, query);
  } else if (commandName === "stop") {
    await executeStop(interaction);
  }
});

const executePlay = async (interaction: any, query: string) => {
  const member = interaction.member as GuildMember;
  const voiceChannel = member?.voice.channel;

  if (!voiceChannel) {
    return interaction.reply(
      "You must be in a voice channel to use this command"
    );
  }

  await interaction.reply(`Find....🔎 ${query}`);

  let songInfo: YouTubeVideo;
  try {
    const searchResults = await play.search(query, {
      limit: 1,
      source: {
        youtube: "video",
      },
    });
    if (searchResults.length === 0) {
      return interaction.followUp("No results found");
    }
    songInfo = searchResults[0] as YouTubeVideo;
  } catch (error) {
    console.error(error);
    return interaction.followUp("Something went wrong");
  }

  if (!songInfo.url) {
    return interaction.followUp("Video not found Url not valid");
  }
  
  const song: Song = {
    title: songInfo.title || "Title not found",
    url: songInfo.url,
  };

  let serverQueue = queue.get(interaction.guild.id);
  if (!serverQueue) {
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

    playSong(interaction.guild.id, serverQueue.songs[0] as Song);
    serverQueue.playing = true;
    await interaction.followUp(`playing music: ${song.title}`);
  } else {
    serverQueue.songs.push(song);
    if (!serverQueue.playing) {
      playSong(interaction.guild.id, serverQueue.songs[0] as Song);
      serverQueue.playing = true;
      await interaction.followUp(`continue: ${song.title}`);
    } else {
      await interaction.followUp(`added to queue: ${song.title}`);
    }
  }
};

const executeStop = async (interaction: any) => {
  const serverQueue = queue.get(interaction.guild.id);
  if (!serverQueue) {
    return interaction.reply("Bot is not playing anything");
  }
  serverQueue.songs = [];
  serverQueue.connection.destroy();
  queue.delete(interaction.guild.id);
  await interaction.reply("Music stopped");
};

const playSong = async (guildId: string, song: Song) => {
  const serverQueue = queue.get(guildId);
  if (!serverQueue || !song) {
    if (serverQueue) {
      serverQueue.connection.destroy();
      queue.delete(guildId);
    }
    return;
  }
  let stream;
  try {
    stream = await play.stream(song.url);
  } catch (error) {
    console.error("Error streaming:", error);
    serverQueue.songs.shift();
    if (serverQueue.songs.length > 0) {
      const song = serverQueue.songs[0];
      if (song) {
        playSong(guildId, song);
      }
    }
    return;
  }
  const resource = createAudioResource(stream.stream, {
    inputType: stream.type,
  });
  serverQueue.player.play(resource);
  serverQueue.playing = true;
  serverQueue.player.once(AudioPlayerStatus.Idle, () => {
    serverQueue.playing = false;
    serverQueue.songs.shift();
    if (serverQueue.songs.length > 0) {
      const song = serverQueue.songs[0];
      if (song) {
        playSong(guildId, song);
      }
    }
  });
  serverQueue.player.on("error", (error) => {
    console.error("Audio player error:", error);
    serverQueue.songs.shift();
    if (serverQueue.songs.length > 0) {
      const song = serverQueue.songs[0];
      if (song) {
        playSong(guildId, song);
      }
    }
    serverQueue.playing = false;
  });
};

client.login(token);
