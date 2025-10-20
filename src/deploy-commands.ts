import { REST, Routes, SlashCommandBuilder } from "discord.js";

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;
console.log(token, clientId, guildId);

if (!token || !clientId || !guildId) {
  throw new Error("🛑 Missing environment variables");
}

const commands = [
  new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play a music")
    .addStringOption((option) =>
      option
        .setName("query")
        .setDescription("music title or link")
        .setRequired(true)
    ),

  new SlashCommandBuilder().setName("stop").setDescription("stop the music"),

  new SlashCommandBuilder().setName("skip").setDescription("skip the music"),

  new SlashCommandBuilder().setName("pause").setDescription("pause the music"),

  new SlashCommandBuilder()
    .setName("resume")
    .setDescription("resume the music"),

  new SlashCommandBuilder().setName("queue").setDescription("show the queue"),

  new SlashCommandBuilder().setName("clear").setDescription("clear the queue"),

  new SlashCommandBuilder().setName("loop").setDescription("loop the music"),

  new SlashCommandBuilder()
    .setName("shuffle")
    .setDescription("shuffle the music"),

  new SlashCommandBuilder()
    .setName("volume")
    .setDescription("change the volume")
    .addIntegerOption((option) =>
      option
        .setName("volume")
        .setDescription("volume level")
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(100)
    ),

  new SlashCommandBuilder().setName("lyrics").setDescription("show the lyrics"),

  new SlashCommandBuilder().setName("help").setDescription("show help"),

  new SlashCommandBuilder()
    .setName("priority")
    .setDescription("change priority of queue"),
].map((command) => command.toJSON());

const rest = new REST({ version: "10" }).setToken(token);

(async () => {
  try {
    console.log(`started registering ${commands.length} (/) commands`);
    const data: any = await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands }
    );
    console.log(`successfully registered ${data.length} (/) commands`);
  } catch (error) {
    console.error(error);
  }
})();
