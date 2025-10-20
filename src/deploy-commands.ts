import {REST, Routes, SlashCommandBuilder} from 'discord.js'

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;
console.log(token, clientId, guildId)

if (!token || !clientId || !guildId){
    throw new Error("🛑 Missing environment variables");
}

const commands =[
    new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play a music")
    .addStringOption(option=>
        option.setName("query")
        .setDescription("music title or link")
        .setRequired(true)),

        new SlashCommandBuilder()
        .setName('stop')
        .setDescription('stop the music')
].map(command => command.toJSON());

const rest = new REST({version: '10'}).setToken(token);

(async() =>{
    try {
        console.log(`started registering ${commands.length} (/) commands`)
        const data:any = await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            {body: commands});
            console.log(`successfully registered ${data.length} (/) commands`)
    } catch (error) {
        console.error(error);
    }
})();